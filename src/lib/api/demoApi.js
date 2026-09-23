// In-memory stand-in for the Supabase API, used only when VITE_DEMO_MODE=true (local UI work and
// browser tests without a Supabase project). It mirrors the same rules as the database functions,
// but nothing is shared or saved: a page reload starts again from the seed data.
import { SEED_PUBS } from "../../data/seedPubs.js";
import { PUB_RESEARCH } from "../../data/pubResearch.js";
import { validatePriceReport } from "../core/prices.js";
import { normaliseText } from "../core/search.js";
import { preparePhoto } from "./photos.js";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);
const clone = value => JSON.parse(JSON.stringify(value));
const wait = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));

export function createDemoApi() {
  const now = Date.now();
  const pubs = SEED_PUBS.map(({ drinks, ...pub }) => {
    const r = PUB_RESEARCH[pub.id] || {};
    return { ...pub, uploads_paused: false, is_published: true, website: r.website || null, drinks_menu_url: r.drinks_menu_url || null, operator: r.operator || null };
  });
  const pubAdmin = new Map(SEED_PUBS.map(pub => [pub.id, {
    pub_id: pub.id, prices_online: PUB_RESEARCH[pub.id]?.prices_online || "unknown", notes: PUB_RESEARCH[pub.id]?.notes || "", prices_checked_at: null
  }]));
  const drinks = [];
  const reports = [];
  SEED_PUBS.forEach((pub, pubIndex) => pub.drinks.forEach((d, drinkIndex) => {
    const updated = new Date(now - (3 + ((pubIndex * 5 + drinkIndex * 3) % 35)) * 86400000).toISOString();
    const drink = { id: uid(), pub_id: pub.id, name: d.name, category: d.category, measure: d.measure || "pint", current_price: d.price, source: "seed", last_updated_at: updated };
    drinks.push(drink);
    reports.push({ id: uid(), pub_id: pub.id, drink_id: drink.id, drink_name: d.name, category: d.category, measure: drink.measure, price: d.price, note: null, reported_at: updated, reporter: null, source: "seed", is_hidden: false });
  }));

  // One demo admin account so the admin screens can be tried out.
  const users = [{ id: uid(), email: "admin@example.com", username: "admin", password: "password123", is_admin: true }];
  const favourites = [];
  const bingo = [];
  const photos = [];
  const photoUrls = new Map();
  const authListeners = new Set();
  const changeListeners = new Set();
  let session = null;

  const profileOf = id => users.find(u => u.id === id);
  const requireUser = () => {
    if (!session) throw new Error("Sign in first");
    return session.user.id;
  };
  const requireAdmin = () => {
    if (!profileOf(requireUser())?.is_admin) throw new Error("Admins only");
  };
  const setSession = user => {
    session = user ? { user: { id: user.id, email: user.email } } : null;
    authListeners.forEach(cb => cb(session));
  };
  const emit = event => changeListeners.forEach(cb => cb(event));
  const isAdmin = () => Boolean(session && profileOf(session.user.id)?.is_admin);
  const visible = pubId => pubs.some(p => p.id === pubId && (p.is_published || isAdmin()));
  const fail = message => { throw new Error(message); };
  const withReporter = r => ({ ...r, reporter_profile: r.reporter ? { username: profileOf(r.reporter)?.username } : null });

  return {
    mode: "demo",
    auth: {
      async getSession() { return session; },
      onChange(cb) { authListeners.add(cb); return () => authListeners.delete(cb); },
      async signUp({ email, username, password }) {
        await wait();
        if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) throw new Error("Usernames must be 3-24 letters, numbers or underscores");
        if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) throw new Error("That username is already taken");
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) throw new Error("An account with that email already exists. Try signing in.");
        const user = { id: uid(), email, username, password, is_admin: false };
        users.push(user);
        setSession(user);
        return { needsConfirmation: false };
      },
      async signIn({ identifier, password }) {
        await wait();
        const id = identifier.trim().toLowerCase();
        const user = users.find(u => u.email.toLowerCase() === id || u.username.toLowerCase() === id);
        if (!user || user.password !== password) throw new Error("Wrong email/username or password.");
        setSession(user);
      },
      async signOut() { setSession(null); },
      async sendPasswordReset() { await wait(); }
    },

    async getProfile(userId) {
      const user = profileOf(userId);
      return user ? { id: user.id, username: user.username, is_admin: user.is_admin } : null;
    },

    async listPubs() {
      await wait();
      return clone(pubs.filter(p => p.is_published).map(pub => ({ ...pub, drinks: drinks.filter(d => d.pub_id === pub.id) })));
    },

    async getPub(id) {
      await wait();
      const pub = pubs.find(p => p.id === id);
      if (!pub || !visible(id)) return null;
      const admin = isAdmin();
      return clone({
        ...pub,
        drinks: drinks.filter(d => d.pub_id === id),
        pub_photos: photos.filter(p => p.pub_id === id && (!p.is_hidden || admin))
      });
    },

    async getDrinkHistory(drinkId) {
      await wait(60);
      return clone(reports.filter(r => r.drink_id === drinkId && !r.is_hidden).map(withReporter).sort((a, b) => b.reported_at.localeCompare(a.reported_at)));
    },

    async listRecentReports(limit = 30) {
      await wait(60);
      return clone(reports
        .filter(r => r.source === "community" && !r.is_hidden)
        .sort((a, b) => b.reported_at.localeCompare(a.reported_at))
        .slice(0, limit)
        .map(r => ({ ...withReporter(r), pub: pubs.find(p => p.id === r.pub_id) })));
    },

    async submitPriceReport(input) {
      await wait();
      const userId = requireUser();
      const { ok, value, errors } = validatePriceReport(input);
      if (!ok) throw new Error(Object.values(errors)[0]);
      if (!visible(value.pubId)) throw new Error("Unknown pub");
      const hourAgo = Date.now() - 3600000;
      if (reports.filter(r => r.reporter === userId && Date.parse(r.reported_at) > hourAgo).length >= 20) {
        throw new Error("You have reported a lot of prices in the last hour. Try again later");
      }
      let drink = value.drinkId
        ? drinks.find(d => d.id === value.drinkId && d.pub_id === value.pubId)
        : drinks.find(d => d.pub_id === value.pubId && normaliseText(d.name) === normaliseText(value.drinkName) && d.measure === value.measure);
      if (value.drinkId && !drink) throw new Error("That drink is not listed at this pub");
      if (!drink) {
        drink = { id: uid(), pub_id: value.pubId, name: value.drinkName, category: value.category, measure: value.measure, current_price: value.price, source: "community", last_updated_at: new Date().toISOString() };
        drinks.push(drink);
      }
      if (reports.some(r => r.reporter === userId && r.drink_id === drink.id && Date.parse(r.reported_at) > Date.now() - 600000)) {
        throw new Error("You reported this drink a few minutes ago");
      }
      const report = { id: uid(), pub_id: value.pubId, drink_id: drink.id, drink_name: drink.name, category: drink.category, measure: drink.measure, price: value.price, note: value.note, reported_at: new Date().toISOString(), reporter: userId, source: "community", is_hidden: false };
      reports.push(report);
      Object.assign(drink, { current_price: value.price, last_updated_at: report.reported_at, source: "community", source_url: null });
      emit({ table: "price_reports", payload: { eventType: "INSERT", new: report } });
      return clone(report);
    },

    subscribeToChanges(cb) {
      changeListeners.add(cb);
      setTimeout(() => cb({ status: "SUBSCRIBED" }), 0);
      return () => changeListeners.delete(cb);
    },

    async listFavourites(userId) { return favourites.filter(f => f.user_id === userId).map(f => f.pub_id); },
    async setFavourite(userId, pubId, isFavourite) {
      requireUser();
      const index = favourites.findIndex(f => f.user_id === userId && f.pub_id === pubId);
      if (isFavourite && index === -1) favourites.push({ user_id: userId, pub_id: pubId });
      if (!isFavourite && index !== -1) favourites.splice(index, 1);
    },

    async listBingoProgress(userId) { return clone(bingo.filter(b => b.user_id === userId)); },
    async setBingoTile(userId, tileId, done) {
      requireUser();
      const index = bingo.findIndex(b => b.user_id === userId && b.tile_id === tileId);
      if (done && index === -1) bingo.push({ user_id: userId, tile_id: tileId, completed_at: new Date().toISOString() });
      if (!done && index !== -1) bingo.splice(index, 1);
    },

    async getMyActivity(userId) {
      return {
        reports: clone(reports.filter(r => r.reporter === userId)),
        photoCount: photos.filter(p => p.uploaded_by === userId).length
      };
    },

    photoUrl(path) { return photoUrls.get(path) || ""; },
    async uploadPhoto(userId, pubId, file, caption) {
      requireUser();
      if (pubs.find(p => p.id === pubId)?.uploads_paused) throw new Error("Photo uploads are paused for this pub.");
      const prepared = await preparePhoto(file);
      const path = `${pubId}/${userId}/${Date.now()}.jpg`;
      photoUrls.set(path, URL.createObjectURL(prepared));
      photos.unshift({ id: uid(), pub_id: pubId, storage_path: path, caption: caption || null, uploaded_by: userId, created_at: new Date().toISOString(), is_hidden: false });
    },
    async deletePhoto(photo) {
      const index = photos.findIndex(p => p.id === photo.id);
      if (index !== -1) photos.splice(index, 1);
    },

    admin: {
      async listPubs() {
        requireAdmin();
        await wait();
        return clone(pubs.map(pub => ({
          ...pub,
          drinks: drinks.filter(d => d.pub_id === pub.id),
          pub_admin: pubAdmin.get(pub.id) || null,
          pub_photos: [{ count: photos.filter(p => p.pub_id === pub.id).length }]
        })).sort((a, b) => a.name.localeCompare(b.name)));
      },
      async getPub(id) {
        requireAdmin();
        await wait(60);
        const pub = pubs.find(p => p.id === id);
        return pub ? clone({ ...pub, drinks: drinks.filter(d => d.pub_id === id), pub_admin: pubAdmin.get(id) || null }) : null;
      },
      async savePub(input) {
        requireAdmin();
        await wait();
        const id = String(input.id || "").trim();
        if (!/^[a-z0-9-]{2,80}$/.test(id)) fail("Pub id must be 2-80 lowercase letters, numbers or dashes");
        const num = v => (v === "" || v == null ? null : Number(v));
        const row = {
          id,
          name: String(input.name || "").trim(),
          address: String(input.address || "").trim() || null,
          area: String(input.area || "").trim(),
          lat: num(input.lat),
          lng: num(input.lng),
          opened_year: num(input.opened_year),
          tags: (input.tags || []).map(t => t.trim()).filter(Boolean),
          description: input.description || "",
          is_published: Boolean(input.is_published),
          website: String(input.website || "").trim() || null,
          drinks_menu_url: String(input.drinks_menu_url || "").trim() || null,
          operator: String(input.operator || "").trim() || null
        };
        if ([row.lat, row.lng, row.opened_year].some(v => v !== null && !Number.isFinite(v))) fail("Latitude, longitude and opening year must be numbers");
        if (row.name.length < 2) fail("Pub name must be 2-100 characters");
        if (row.area.length < 2) fail("Area must be 2-40 characters");
        if (row.website && !/^https?:\/\/\S+$/.test(row.website)) fail("Website must start with http:// or https://");
        if (row.drinks_menu_url && !/^https?:\/\/\S+$/.test(row.drinks_menu_url)) fail("Drinks menu link must start with http:// or https://");
        if (row.is_published && (!row.address || row.lat === null || row.lng === null)) {
          fail("To publish a pub it needs an address and a map position (lat/lng). Save it hidden until then.");
        }
        const existing = pubs.find(p => p.id === id);
        if (existing) Object.assign(existing, row);
        else pubs.push({ ...row, uploads_paused: false });
        if (!pubAdmin.has(id)) pubAdmin.set(id, { pub_id: id, prices_online: "unknown", notes: "", prices_checked_at: null });
        emit({ table: "drinks", payload: {} });
        return clone(pubs.find(p => p.id === id));
      },
      async savePubAdmin(pubId, { pricesOnline, notes, markChecked }) {
        requireAdmin();
        await wait(60);
        const current = pubAdmin.get(pubId) || { pub_id: pubId, prices_checked_at: null };
        const next = { ...current, prices_online: pricesOnline || "unknown", notes: notes || "", prices_checked_at: markChecked ? new Date().toISOString() : current.prices_checked_at };
        pubAdmin.set(pubId, next);
        return clone(next);
      },
      async setDrinkPrice(value) {
        requireAdmin();
        await wait();
        if (!["website", "admin"].includes(value.source)) fail("Source must be website or admin");
        if (value.source === "website" && !value.sourceUrl) fail("Add the link to the page the price came from");
        if (value.sourceUrl && !/^https?:\/\/\S+$/.test(value.sourceUrl)) fail("Source link must start with http:// or https://");
        if (!(value.price >= 1 && value.price <= 25)) fail("Price must be between £1.00 and £25.00");
        const measure = value.measure || "pint";
        let drink = value.drinkId
          ? drinks.find(d => d.id === value.drinkId && d.pub_id === value.pubId)
          : drinks.find(d => d.pub_id === value.pubId && normaliseText(d.name) === normaliseText(value.drinkName) && d.measure === measure);
        if (value.drinkId && !drink) fail("That drink is not listed at this pub");
        if (!drink) {
          if (!value.drinkName || value.drinkName.trim().length < 2) fail("Drink names must be 2-60 characters");
          if (!value.category) fail("Pick a valid category");
          drink = { id: uid(), pub_id: value.pubId, name: value.drinkName.trim(), category: value.category, measure };
          drinks.push(drink);
        }
        const report = {
          id: uid(), pub_id: value.pubId, drink_id: drink.id, drink_name: drink.name, category: drink.category, measure: drink.measure,
          price: value.price, note: value.note || null, reported_at: new Date().toISOString(), reporter: session.user.id,
          source: value.source, source_url: value.sourceUrl || null, is_hidden: false
        };
        reports.push(report);
        Object.assign(drink, { current_price: value.price, last_updated_at: report.reported_at, source: value.source, source_url: value.sourceUrl || null });
        emit({ table: "price_reports", payload: { eventType: "INSERT", new: report } });
        return clone(report);
      },
      async updateDrink(drinkId, { name, category, measure }) {
        requireAdmin();
        const drink = drinks.find(d => d.id === drinkId) || fail("Drink not found");
        const clean = String(name || "").replace(/\s+/g, " ").trim();
        if (clean.length < 2 || clean.length > 60) fail("Check the drink name (2-60 characters), category and measure");
        if (drinks.some(d => d.id !== drinkId && d.pub_id === drink.pub_id && normaliseText(d.name) === normaliseText(clean) && d.measure === measure)) {
          fail("This pub already lists a drink with that name and measure");
        }
        Object.assign(drink, { name: clean, category, measure });
        return clone(drink);
      },
      async deleteDrink(drinkId) {
        requireAdmin();
        const index = drinks.findIndex(d => d.id === drinkId);
        if (index !== -1) drinks.splice(index, 1);
        emit({ table: "drinks", payload: {} });
      },
      async setUploadsPaused(pubId, paused) {
        requireAdmin();
        const pub = pubs.find(p => p.id === pubId);
        if (pub) pub.uploads_paused = paused;
      },
      async setReportHidden(reportId, hidden) {
        requireAdmin();
        const report = reports.find(r => r.id === reportId);
        if (!report) throw new Error("Report not found");
        report.is_hidden = hidden;
        const latest = reports.filter(r => r.drink_id === report.drink_id && !r.is_hidden).sort((a, b) => b.reported_at.localeCompare(a.reported_at))[0];
        const drink = drinks.find(d => d.id === report.drink_id);
        if (latest && drink) Object.assign(drink, { current_price: latest.price, last_updated_at: latest.reported_at, source: latest.source, source_url: latest.source_url || null });
        emit({ table: "price_reports", payload: { eventType: "UPDATE", new: report } });
      },
      async setPhotoHidden(photoId, hidden) {
        requireAdmin();
        const photo = photos.find(p => p.id === photoId);
        if (photo) photo.is_hidden = hidden;
      }
    }
  };
}
