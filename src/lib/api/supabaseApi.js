import { createClient } from "@supabase/supabase-js";
import { ApiError } from "./errors.js";
import { photoPath, preparePhoto } from "./photos.js";

const BUCKET = "pub-photos";

function unwrap({ data, error }, fallback) {
  if (error) throw new ApiError(error, fallback);
  return data;
}

export function createSupabaseApi(url, anonKey) {
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const api = {
    mode: "supabase",

    auth: {
      async getSession() {
        return unwrap(await supabase.auth.getSession()).session;
      },
      onChange(callback) {
        const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
        return () => data.subscription.unsubscribe();
      },
      async signUp({ email, username, password }) {
        const data = unwrap(await supabase.auth.signUp({
          email,
          password,
          options: { data: { username }, emailRedirectTo: window.location.origin }
        }), "Couldn't create your account.");
        return { needsConfirmation: !data.session };
      },
      async signIn({ identifier, password }) {
        let email = identifier.trim();
        if (!email.includes("@")) {
          email = unwrap(await supabase.rpc("resolve_username_login", { username_input: email }));
          if (!email) throw new ApiError({ message: "Invalid login credentials" });
        }
        unwrap(await supabase.auth.signInWithPassword({ email, password }), "Couldn't sign you in.");
      },
      async signOut() {
        unwrap(await supabase.auth.signOut());
      },
      async sendPasswordReset(email) {
        unwrap(await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` }));
      }
    },

    async getProfile(userId) {
      return unwrap(await supabase.from("profiles").select("id, username, is_admin").eq("id", userId).maybeSingle());
    },

    async listPubs() {
      // Admins can read hidden pubs too, so filter explicitly: the public app only lists published ones.
      return unwrap(await supabase.from("pubs").select("*, drinks(*)").eq("is_published", true).order("name"), "Couldn't load pubs.");
    },

    async getPub(id) {
      return unwrap(await supabase
        .from("pubs")
        .select("*, drinks(*), pub_photos(id, storage_path, caption, uploaded_by, created_at, is_hidden)")
        .eq("id", id)
        .maybeSingle(), "Couldn't load this pub.");
    },

    // Published events only (admins can read unpublished ones too, so filter explicitly).
    async listEvents({ pubId } = {}) {
      let query = supabase.from("events").select("*").eq("is_published", true);
      if (pubId) query = query.eq("pub_id", pubId);
      return unwrap(await query, "Couldn't load what's on.");
    },

    async getDrinkHistory(drinkId, limit = 50) {
      return unwrap(await supabase
        .from("price_reports")
        .select("id, price, measure, note, reported_at, source, source_url, is_hidden, reporter_profile:profiles(username)")
        .eq("drink_id", drinkId)
        .order("reported_at", { ascending: false })
        .limit(limit), "Couldn't load price history.");
    },

    async listRecentReports(limit = 30) {
      return unwrap(await supabase
        .from("price_reports")
        .select("id, pub_id, drink_id, drink_name, category, measure, price, note, reported_at, source, is_hidden, pub:pubs(id, name, area), reporter_profile:profiles(username)")
        .eq("source", "community")
        .order("reported_at", { ascending: false })
        .limit(limit), "Couldn't load the feed.");
    },

    async submitPriceReport(value) {
      return unwrap(await supabase.rpc("submit_price_report", {
        p_pub_id: value.pubId,
        p_drink_id: value.drinkId,
        p_drink_name: value.drinkName,
        p_category: value.category,
        p_measure: value.measure,
        p_price: value.price,
        p_note: value.note
      }), "Couldn't save your price.");
    },

    // Calls back whenever a price report or drink changes, for any visitor.
    subscribeToChanges(callback) {
      const channel = supabase
        .channel("pub-bingo-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "price_reports" }, payload => callback({ table: "price_reports", payload }))
        .on("postgres_changes", { event: "*", schema: "public", table: "drinks" }, payload => callback({ table: "drinks", payload }))
        .on("postgres_changes", { event: "*", schema: "public", table: "events" }, payload => callback({ table: "events", payload }))
        .subscribe(status => callback({ status }));
      return () => { supabase.removeChannel(channel); };
    },

    async listFavourites(userId) {
      const rows = unwrap(await supabase.from("favourites").select("pub_id").eq("user_id", userId), "Couldn't load favourites.");
      return rows.map(row => row.pub_id);
    },

    async setFavourite(userId, pubId, isFavourite) {
      if (isFavourite) {
        unwrap(await supabase.from("favourites").upsert({ user_id: userId, pub_id: pubId }, { onConflict: "user_id,pub_id", ignoreDuplicates: true }), "Couldn't save favourite.");
      } else {
        unwrap(await supabase.from("favourites").delete().eq("user_id", userId).eq("pub_id", pubId), "Couldn't remove favourite.");
      }
    },

    async listBingoProgress(userId) {
      return unwrap(await supabase.from("bingo_progress").select("tile_id, completed_at").eq("user_id", userId), "Couldn't load your bingo card.");
    },

    async setBingoTile(userId, tileId, done) {
      if (done) {
        unwrap(await supabase.from("bingo_progress").upsert({ user_id: userId, tile_id: tileId }, { onConflict: "user_id,tile_id", ignoreDuplicates: true }), "Couldn't save your bingo card.");
      } else {
        unwrap(await supabase.from("bingo_progress").delete().eq("user_id", userId).eq("tile_id", tileId), "Couldn't save your bingo card.");
      }
    },

    async getMyActivity(userId) {
      const [reports, photos] = await Promise.all([
        supabase.from("price_reports").select("price, measure, pub_id").eq("reporter", userId).limit(200),
        supabase.from("pub_photos").select("id", { count: "exact", head: true }).eq("uploaded_by", userId)
      ]);
      if (photos.error) throw new ApiError(photos.error);
      return { reports: unwrap(reports), photoCount: photos.count || 0 };
    },

    photoUrl(path) {
      return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },

    async uploadPhoto(userId, pubId, file, caption) {
      const prepared = await preparePhoto(file);
      const path = photoPath(pubId, userId);
      unwrap(await supabase.storage.from(BUCKET).upload(path, prepared, { contentType: prepared.type, upsert: false }), "Couldn't upload your photo.");
      const { error } = await supabase.from("pub_photos").insert({ pub_id: pubId, storage_path: path, caption: caption || null, uploaded_by: userId });
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw new ApiError(error, "Couldn't save your photo.");
      }
    },

    async deletePhoto(photo) {
      unwrap(await supabase.from("pub_photos").delete().eq("id", photo.id), "Couldn't delete the photo.");
      await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    },

    admin: {
      async listPubs() {
        return unwrap(await supabase
          .from("pubs")
          .select("*, drinks(id, name, category, measure, current_price, source, source_url, last_updated_at), pub_admin(*), pub_photos(count), events(id, is_published)")
          .order("name"), "Couldn't load pubs.");
      },
      async getPub(id) {
        return unwrap(await supabase.from("pubs").select("*, drinks(*), pub_admin(*)").eq("id", id).maybeSingle(), "Couldn't load this pub.");
      },
      async savePub(pub) {
        return unwrap(await supabase.rpc("admin_save_pub", { p_pub: pub }), "Couldn't save the pub.");
      },
      async savePubAdmin(pubId, { pricesOnline, notes, markChecked }) {
        return unwrap(await supabase.rpc("admin_save_pub_admin", {
          p_pub_id: pubId, p_prices_online: pricesOnline, p_notes: notes, p_mark_checked: Boolean(markChecked)
        }), "Couldn't save notes.");
      },
      async setDrinkPrice(value) {
        return unwrap(await supabase.rpc("admin_set_drink_price", {
          p_pub_id: value.pubId,
          p_drink_id: value.drinkId || null,
          p_drink_name: value.drinkName || null,
          p_category: value.category || null,
          p_measure: value.measure || null,
          p_price: value.price,
          p_source: value.source,
          p_source_url: value.sourceUrl || null,
          p_note: value.note || null
        }), "Couldn't save the price.");
      },
      async updateDrink(drinkId, { name, category, measure }) {
        return unwrap(await supabase.rpc("admin_update_drink", { p_drink_id: drinkId, p_name: name, p_category: category, p_measure: measure }), "Couldn't update the drink.");
      },
      async listEvents({ pubId } = {}) {
        let query = supabase.from("events").select("*").order("title");
        if (pubId) query = query.eq("pub_id", pubId);
        return unwrap(await query, "Couldn't load events.");
      },
      async saveEvent(event) {
        return unwrap(await supabase.rpc("admin_save_event", { p_event: event }), "Couldn't save the event.");
      },
      async deleteEvent(eventId) {
        unwrap(await supabase.rpc("admin_delete_event", { p_event_id: eventId }), "Couldn't delete the event.");
      },
      async deleteDrink(drinkId) {
        unwrap(await supabase.rpc("admin_delete_drink", { p_drink_id: drinkId }), "Couldn't delete the drink.");
      },
      async setUploadsPaused(pubId, paused) {
        unwrap(await supabase.rpc("admin_set_uploads_paused", { p_pub_id: pubId, p_paused: paused }));
      },
      async setReportHidden(reportId, hidden) {
        unwrap(await supabase.rpc("admin_set_report_hidden", { p_report_id: reportId, p_hidden: hidden }));
      },
      async setPhotoHidden(photoId, hidden) {
        unwrap(await supabase.rpc("admin_set_photo_hidden", { p_photo_id: photoId, p_hidden: hidden }));
      }
    }
  };

  return api;
}
