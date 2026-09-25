// In-memory stand-in for the Supabase API, used only when VITE_DEMO_MODE=true (local UI work and
// browser tests without a Supabase project). It mirrors the same rules as the database functions,
// but nothing is shared or saved: a page reload starts again from the seed data.
import { SEED_PUBS } from "../../data/seedPubs.js";
import { PUB_RESEARCH } from "../../data/pubResearch.js";
import { SEED_EVENTS } from "../../data/seedEvents.js";
import { EVENT_CATEGORIES } from "../../data/features.js";
import { validatePriceReport } from "../core/prices.js";
import { normaliseText } from "../core/search.js";
import { preparePhoto } from "./photos.js";
import { londonToday, prepareMenuFile, validateSeenOn } from "./menuFiles.js";
import { FEATURE_KEYS, FEATURES } from "../featureList.js";
import { distanceMetres } from "../core/geo.js";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);
const clone = value => JSON.parse(JSON.stringify(value));
const wait = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));

export function createDemoApi() {
  const now = Date.now();
  const pubs = SEED_PUBS.map(({ drinks, ...pub }) => {
    const r = PUB_RESEARCH[pub.id] || {};
    return { ...pub, uploads_paused: false, is_published: true, website: r.website || null, drinks_menu_url: r.drinks_menu_url || null, food_menu_url: r.food_menu_url || null, operator: r.operator || null };
  });
  const pubAdmin = new Map(SEED_PUBS.map(pub => [pub.id, {
    pub_id: pub.id, prices_online: PUB_RESEARCH[pub.id]?.prices_online || "unknown", notes: [PUB_RESEARCH[pub.id]?.notes, PUB_RESEARCH[pub.id]?.update].filter(Boolean).join("\n\n"), prices_checked_at: null
  }]));
  const drinks = [];
  const reports = [];
  SEED_PUBS.forEach((pub, pubIndex) => pub.drinks.forEach((d, drinkIndex) => {
    const updated = new Date(now - (3 + ((pubIndex * 5 + drinkIndex * 3) % 35)) * 86400000).toISOString();
    const source = d.source || "seed";
    const when = d.updated ? new Date(d.updated).toISOString() : updated;
    const drink = { id: uid(), pub_id: pub.id, name: d.name, category: d.category, measure: d.measure || "pint", volume_ml: d.volume_ml ?? null, current_price: d.price, source, source_url: d.source_url || null, last_updated_at: when };
    drinks.push(drink);
    reports.push({ id: uid(), pub_id: pub.id, drink_id: drink.id, drink_name: d.name, category: d.category, measure: drink.measure, price: d.price, note: null, reported_at: when, reporter: null, source, source_url: drink.source_url, is_hidden: false });
  }));

  const events = SEED_EVENTS.map(e => ({
    id: uid(), schedule: "weekly", event_date: null, source: "research", is_published: false, checked_at: null, ...e
  }));

  // One demo admin account so the admin screens can be tried out.
  const users = [{ id: uid(), email: "admin@example.com", username: "admin", password: "password123", is_admin: true }];
  const favourites = [];
  const bingo = [];
  const photos = [];
  const photoUrls = new Map();
  const menus = [];
  const suggestions = [];
  const suggestionVotes = new Map(); // `${id}:${userId}` -> 1 | -1
  const menuSubmissions = [];
  const featureSwitches = new Map(FEATURE_KEYS.map(key => [key, false]));
  const deals = [];
  const checkins = [];
  const pourRatings = [];
  const priceWatches = [];
  const receiptFiles = new Map();
  const submissionFiles = new Map(); // storage_path -> File (demo only: lives in this tab)
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
  const featureOn = key => featureSwitches.get(key) || isAdmin();
  const requireFeature = key => { if (!featureOn(key)) fail("This feature isn't available yet"); };
  // Same rule as the database: 5 reports matched by someone else (within 10p, 14 days), none hidden lately.
  const isTrusted = userId => {
    if (profileOf(userId)?.is_admin) return true;
    const mine = reports.filter(r => r.reporter === userId && r.source === "community");
    const matched = mine.filter(r => !r.is_hidden && reports.some(o => o.drink_id === r.drink_id && o.id !== r.id && !o.is_hidden
      && o.source !== "seed" && o.reporter !== userId && Math.abs(o.price - r.price) <= 0.1
      && Math.abs(Date.parse(o.reported_at) - Date.parse(r.reported_at)) <= 14 * 86400000)).length;
    const hiddenLately = mine.some(r => r.is_hidden && !r.held && Date.parse(r.reported_at) > Date.now() - 90 * 86400000);
    return matched >= 5 && !hiddenLately;
  };
  const recomputeDrink = drinkId => {
    const latest = reports.filter(r => r.drink_id === drinkId && !r.is_hidden).sort((a, b) => b.reported_at.localeCompare(a.reported_at))[0];
    const drink = drinks.find(d => d.id === drinkId);
    if (latest && drink) Object.assign(drink, { current_price: latest.price, last_updated_at: latest.reported_at, source: latest.source, source_url: latest.source_url || null });
  };

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

    async listEvents({ pubId } = {}) {
      await wait(60);
      return clone(events.filter(e => e.is_published && visible(e.pub_id) && (!pubId || e.pub_id === pubId)));
    },

    async listSuggestions() {
      await wait(60);
      const me = session?.user?.id;
      const rows = suggestions.map(s => {
        const votes = [...suggestionVotes.entries()].filter(([k]) => k.startsWith(`${s.id}:`)).map(([, v]) => v);
        return {
          ...s, username: profileOf(s.submitted_by)?.username || null,
          up_votes: votes.filter(v => v === 1).length, down_votes: votes.filter(v => v === -1).length,
          my_vote: (me && suggestionVotes.get(`${s.id}:${me}`)) || 0, is_mine: Boolean(me && s.submitted_by === me)
        };
      });
      rows.sort((a, b) => (b.up_votes - b.down_votes) - (a.up_votes - a.down_votes) || b.created_at.localeCompare(a.created_at));
      return clone(rows.map(({ submitted_by, ...r }) => r));
    },
    async submitSuggestion(category, message) {
      await wait();
      const me = requireUser();
      const text = String(message || "").replace(/[ \t]+/g, " ").trim();
      if (text.length < 3) fail("Write a bit more first");
      if (text.length > 1000) fail("Keep it under 1000 characters");
      if (!["idea", "pub", "problem", "other"].includes(category)) fail("Pick a type");
      if (suggestions.filter(s => s.submitted_by === me && Date.parse(s.created_at) > Date.now() - 3600000).length >= 5) {
        fail("You've sent a lot of suggestions in the last hour. Try again later");
      }
      const now = new Date().toISOString();
      const row = { id: uid(), submitted_by: me, category, message: text, status: "new", admin_note: null, created_at: now, updated_at: now };
      suggestions.push(row);
      return clone(row);
    },
    async voteSuggestion(id, vote) {
      const me = requireUser();
      if (![-1, 0, 1].includes(vote)) fail("Invalid vote");
      if (vote === 0) suggestionVotes.delete(`${id}:${me}`); else suggestionVotes.set(`${id}:${me}`, vote);
    },

    async submitMenu(userId, { pubId, pubName, seenOn, note, file }) {
      await wait();
      const me = requireUser();
      const prepared = await prepareMenuFile(file);
      if (pubId && !pubs.some(p => p.id === pubId && p.is_published)) fail("Pick a pub from the list");
      const name = String(pubName || "").replace(/\s+/g, " ").trim();
      if (!pubId && (name.length < 2 || name.length > 100)) fail("Say which pub the menu is from");
      const dateProblem = validateSeenOn(seenOn, londonToday());
      if (dateProblem) fail(dateProblem.replace(/\.$/, ""));
      if (String(note || "").trim().length > 500) fail("Keep the note under 500 characters");
      if (menuSubmissions.filter(m => m.submitted_by === me && Date.parse(m.created_at) > Date.now() - 86400000).length >= 10) {
        fail("You've sent 10 menus today. Thanks! Try again tomorrow");
      }
      const path = `${me}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${prepared.ext}`;
      submissionFiles.set(path, prepared.file);
      const row = {
        id: uid(), submitted_by: me, pub_id: pubId || null, pub_name: pubId ? null : name, storage_path: path,
        file_name: String(file.name || "menu").slice(0, 200), file_kind: prepared.ext === "pdf" ? "pdf" : "photo",
        seen_on: seenOn, note: String(note || "").trim() || null, status: "new", admin_note: null, prices_imported: 0,
        reviewed_at: null, created_at: new Date().toISOString()
      };
      menuSubmissions.unshift(row);
      return clone(row);
    },
    async listMyMenus(userId) {
      await wait(60);
      const withPub = m => ({ ...m, pub: m.pub_id ? { id: m.pub_id, name: pubs.find(p => p.id === m.pub_id)?.name } : null });
      return clone(menuSubmissions.filter(m => m.submitted_by === userId).map(withPub));
    },

    async getDrinkHistory(drinkId) {
      await wait(60);
      const me = session?.user?.id;
      return clone(reports.filter(r => r.drink_id === drinkId && (!r.is_hidden || isAdmin() || (r.held && r.reporter === me))).map(withReporter).sort((a, b) => b.reported_at.localeCompare(a.reported_at)));
    },

    async listRecentReports(limit = 30) {
      await wait(60);
      return clone(reports
        .filter(r => r.source === "community" && (!r.is_hidden || isAdmin()))
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
      const existing = Boolean(drink);
      if (!drink) {
        drink = { id: uid(), pub_id: value.pubId, name: value.drinkName, category: value.category, measure: value.measure, current_price: value.price, source: "community", last_updated_at: new Date().toISOString() };
        drinks.push(drink);
      }
      if (reports.some(r => r.reporter === userId && r.drink_id === drink.id && Date.parse(r.reported_at) > Date.now() - 600000)) {
        throw new Error("You reported this drink a few minutes ago");
      }
      const hold = existing && featureSwitches.get("trusted_reporters") && drink.source !== "seed"
        && Math.abs(value.price - drink.current_price) / drink.current_price > 0.4 && !isTrusted(userId);
      const report = { id: uid(), pub_id: value.pubId, drink_id: drink.id, drink_name: drink.name, category: drink.category, measure: drink.measure, price: value.price, note: value.note, reported_at: new Date().toISOString(), reporter: userId, source: "community", is_hidden: hold, held: hold, kind: "report", receipt_path: null };
      reports.push(report);
      if (!hold) Object.assign(drink, { current_price: value.price, last_updated_at: report.reported_at, source: "community", source_url: null });
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
      const menus = menuSubmissions.filter(m => m.submitted_by === userId);
      return clone({
        reports: reports.filter(r => r.reporter === userId && !r.is_hidden),
        photoCount: photos.filter(p => p.uploaded_by === userId).length,
        checkins: checkins.filter(c => c.user_id === userId),
        menus,
        menusUsed: menus.filter(m => m.status === "used").length,
        pourRatings: pourRatings.filter(r => r.user_id === userId),
        trusted: isTrusted(userId)
      });
    },

    async listFeatures() {
      return [...featureSwitches.entries()].map(([key, is_live]) => ({ key, is_live }));
    },
    async confirmPrice(drinkId) {
      await wait();
      const me = requireUser();
      requireFeature("still_right");
      const drink = drinks.find(d => d.id === drinkId);
      if (!drink || !visible(drink.pub_id)) fail("Drink not found");
      if (reports.filter(r => r.reporter === me && Date.parse(r.reported_at) > Date.now() - 3600000).length >= 20) fail("You have reported a lot of prices in the last hour. Try again later");
      if (reports.some(r => r.reporter === me && r.drink_id === drinkId && Date.parse(r.reported_at) > Date.now() - 12 * 3600000)) fail("You've already checked this price today. Thanks!");
      const report = { id: uid(), pub_id: drink.pub_id, drink_id: drink.id, drink_name: drink.name, category: drink.category, measure: drink.measure, price: drink.current_price, note: "Still right", reported_at: new Date().toISOString(), reporter: me, source: "community", is_hidden: false, held: false, kind: "confirm", receipt_path: null };
      reports.push(report);
      Object.assign(drink, { last_updated_at: report.reported_at, source: "community", source_url: null });
      emit({ table: "price_reports", payload: { eventType: "INSERT", new: report } });
      return clone(report);
    },
    async uploadReceipt(userId, reportId, file) {
      requireUser();
      requireFeature("receipts");
      const prepared = await preparePhoto(file);
      const report = reports.find(r => r.id === reportId && r.reporter === userId && Date.parse(r.reported_at) > Date.now() - 3600000);
      if (!report) fail("You can only add a receipt to your own report, within an hour");
      const path = `${userId}/${Date.now()}.jpg`;
      receiptFiles.set(path, prepared);
      report.receipt_path = path;
      emit({ table: "price_reports", payload: {} });
    },
    async trustedUsernames() {
      return users.filter(u => reports.some(r => r.reporter === u.id && r.source === "community") && isTrusted(u.id)).map(u => u.username);
    },
    async communityStats(since = null) {
      const from = since ? Date.parse(since) : 0;
      return users.map(u => {
        const mine = reports.filter(r => r.reporter === u.id && r.source === "community" && !r.is_hidden && Date.parse(r.reported_at) >= from);
        const menusUsed = menuSubmissions.filter(m => m.submitted_by === u.id && m.status === "used" && Date.parse(m.created_at) >= from).length;
        return {
          username: u.username, reports: mine.filter(r => r.kind !== "confirm").length, confirms: mine.filter(r => r.kind === "confirm").length,
          receipts: mine.filter(r => r.receipt_path).length, menus_used: menusUsed, trusted: isTrusted(u.id)
        };
      }).filter(r => r.reports + r.confirms + r.menus_used > 0)
        .sort((a, b) => (b.reports + b.confirms + 3 * b.menus_used) - (a.reports + a.confirms + 3 * a.menus_used) || a.username.localeCompare(b.username));
    },
    async listDeals() {
      return clone(deals.filter(d => d.is_published && visible(d.pub_id)));
    },
    async checkIn(pubId, lat, lng) {
      await wait();
      const me = requireUser();
      requireFeature("check_ins");
      const pub = pubs.find(p => p.id === pubId);
      if (!pub || !visible(pubId)) fail("Unknown pub");
      if (lat == null || lng == null) fail("Share your location to check in");
      const metres = distanceMetres({ lat, lng }, { lat: pub.lat, lng: pub.lng });
      if (metres > 200) fail(`You need to be at the pub to check in (you look about ${Math.round(metres)} m away)`);
      if (checkins.some(c => c.user_id === me && c.pub_id === pubId && Date.parse(c.created_at) > Date.now() - 3 * 3600000)) fail("You're already checked in here");
      const row = { id: uid(), user_id: me, pub_id: pubId, created_at: new Date().toISOString() };
      checkins.push(row);
      return clone(row);
    },
    async pubBusy() {
      const recent = checkins.filter(c => Date.parse(c.created_at) > Date.now() - 90 * 60000);
      const by = new Map();
      recent.forEach(c => { if (!by.has(c.pub_id)) by.set(c.pub_id, new Set()); by.get(c.pub_id).add(c.user_id); });
      return [...by.entries()].map(([pub_id, set]) => ({ pub_id, people: set.size }));
    },
    async ratePour(pubId, rating) {
      await wait();
      const me = requireUser();
      requireFeature("guinness_score");
      if (!(rating >= 1 && rating <= 5)) fail("Pick 1 to 5");
      if (!drinks.some(d => d.pub_id === pubId && /guinness/i.test(d.name))) fail("This pub doesn't list Guinness");
      const today = londonToday();
      const existing = pourRatings.find(r => r.user_id === me && r.pub_id === pubId && r.rated_on === today);
      if (existing) Object.assign(existing, { rating, created_at: new Date().toISOString() });
      else pourRatings.push({ user_id: me, pub_id: pubId, rated_on: today, rating, created_at: new Date().toISOString() });
    },
    async pourScores() {
      const by = new Map();
      pourRatings.forEach(r => { if (!by.has(r.pub_id)) by.set(r.pub_id, []); by.get(r.pub_id).push(r.rating); });
      return [...by.entries()].map(([pub_id, list]) => ({ pub_id, score: Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10, ratings: list.length }));
    },
    async listPriceWatches(userId) {
      return clone(priceWatches.filter(w => w.user_id === userId));
    },
    async addPriceWatch({ query, maxPrice, area }) {
      await wait();
      const me = requireUser();
      requireFeature("price_watch");
      const q = String(query || "").replace(/\s+/g, " ").trim();
      if (q.length < 2 || q.length > 60) fail("Type a drink, like Guinness or IPA");
      if (!(maxPrice >= 1 && maxPrice <= 25)) fail("Price must be between £1.00 and £25.00");
      if (priceWatches.filter(w => w.user_id === me).length >= 10) fail("You can watch up to 10 prices. Remove one first");
      const row = { id: uid(), user_id: me, query: q, max_price: Math.round(maxPrice * 100) / 100, area: area || null, created_at: new Date().toISOString() };
      priceWatches.push(row);
      return clone(row);
    },
    async deletePriceWatch(id) {
      const me = requireUser();
      const i = priceWatches.findIndex(w => w.id === id && w.user_id === me);
      if (i !== -1) priceWatches.splice(i, 1);
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
          pub_photos: [{ count: photos.filter(p => p.pub_id === pub.id).length }],
          events: events.filter(e => e.pub_id === pub.id).map(e => ({ id: e.id, is_published: e.is_published }))
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
          food_menu_url: String(input.food_menu_url || "").trim() || null,
          operator: String(input.operator || "").trim() || null
        };
        if ([row.lat, row.lng, row.opened_year].some(v => v !== null && !Number.isFinite(v))) fail("Latitude, longitude and opening year must be numbers");
        if (row.name.length < 2) fail("Pub name must be 2-100 characters");
        if (row.area.length < 2) fail("Area must be 2-40 characters");
        if (row.website && !/^https?:\/\/\S+$/.test(row.website)) fail("Website must start with http:// or https://");
        if (row.drinks_menu_url && !/^https?:\/\/\S+$/.test(row.drinks_menu_url)) fail("Drinks menu link must start with http:// or https://");
        if (row.food_menu_url && !/^https?:\/\/\S+$/.test(row.food_menu_url)) fail("Food menu link must start with http:// or https://");
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
        const today = londonToday();
        if (value.observedOn && value.observedOn > today) fail("The date seen can't be in the future");
        const when = value.observedOn && value.observedOn < today
          ? new Date(`${value.observedOn}T12:00:00Z`).toISOString()
          : new Date().toISOString();
        const measure = value.measure || "pint";
        let drink = value.drinkId
          ? drinks.find(d => d.id === value.drinkId && d.pub_id === value.pubId)
          : drinks.find(d => d.pub_id === value.pubId && normaliseText(d.name) === normaliseText(value.drinkName) && d.measure === measure);
        if (value.drinkId && !drink) fail("That drink is not listed at this pub");
        if (!drink) {
          if (!value.drinkName || value.drinkName.trim().length < 2) fail("Drink names must be 2-60 characters");
          if (!value.category) fail("Pick a valid category");
          drink = { id: uid(), pub_id: value.pubId, name: value.drinkName.trim(), category: value.category, measure, source: "seed", last_updated_at: null };
          drinks.push(drink);
        }
        const report = {
          id: uid(), pub_id: value.pubId, drink_id: drink.id, drink_name: drink.name, category: drink.category, measure: drink.measure,
          price: value.price, note: value.note || null, reported_at: when, reporter: session.user.id,
          source: value.source, source_url: value.sourceUrl || null, is_hidden: false
        };
        reports.push(report);
        // An older price goes into the history but doesn't replace a newer one.
        if (drink.source === "seed" || !drink.last_updated_at || when >= drink.last_updated_at) {
          Object.assign(drink, { current_price: value.price, last_updated_at: when, source: value.source, source_url: value.sourceUrl || null });
        }
        emit({ table: "price_reports", payload: { eventType: "INSERT", new: report } });
        return clone(report);
      },
      async updateDrink(drinkId, { name, category, measure, volumeMl = null }) {
        requireAdmin();
        const drink = drinks.find(d => d.id === drinkId) || fail("Drink not found");
        const clean = String(name || "").replace(/\s+/g, " ").trim();
        if (clean.length < 2 || clean.length > 60) fail("Check the drink name (2-60 characters), category and measure");
        if (drinks.some(d => d.id !== drinkId && d.pub_id === drink.pub_id && normaliseText(d.name) === normaliseText(clean) && d.measure === measure)) {
          fail("This pub already lists a drink with that name and measure");
        }
        Object.assign(drink, { name: clean, category, measure, volume_ml: ["bottle", "can"].includes(measure) ? volumeMl : null });
        return clone(drink);
      },
      async uploadMenu(userId, pubId, file) {
        requireAdmin();
        await wait();
        const path = `${pubId}/${Date.now()}-${file.name || "menu.pdf"}`;
        // Demo only: the file lives in this tab (viewUrl); prices need an https source link like the real app gives.
        const row = {
          id: uid(), pub_id: pubId, storage_path: path, file_name: file.name || "menu.pdf", uploaded_by: userId,
          uploaded_at: new Date().toISOString(), prices_imported: 0,
          url: `https://demo.pub-bingo.invalid/menus/${encodeURIComponent(path)}`, viewUrl: URL.createObjectURL(file)
        };
        menus.unshift(row);
        return clone(row);
      },
      async listMenus(pubId) {
        requireAdmin();
        return clone(menus.filter(m => m.pub_id === pubId));
      },
      async markMenuImported(menuId, count) {
        const menu = menus.find(m => m.id === menuId);
        if (menu) menu.prices_imported = count;
      },
      async listEvents({ pubId } = {}) {
        requireAdmin();
        return clone(events.filter(e => !pubId || e.pub_id === pubId).sort((a, b) => a.title.localeCompare(b.title)));
      },
      async saveEvent(input) {
        requireAdmin();
        await wait();
        const title = String(input.title || "").trim();
        const days = [...new Set((input.weekdays || []).map(Number))].sort();
        if (title.length < 2 || title.length > 100) fail("Event title must be 2-100 characters");
        if (!EVENT_CATEGORIES.some(c => c.key === input.category)) fail("Pick an event type");
        if (!pubs.some(p => p.id === input.pub_id)) fail("Unknown pub");
        if (input.schedule === "weekly" && (!days.length || days.some(d => d < 0 || d > 6))) fail("Pick at least one day of the week");
        if (input.schedule === "one-off" && !input.event_date) fail("Pick a date for a one-off event");
        if (input.source_url && !/^https?:\/\/\S+$/.test(input.source_url)) fail("Link must start with http:// or https://");
        if (events.some(e => e.pub_id === input.pub_id && e.title === title && e.id !== input.id)) fail("This pub already has an event with that title");
        const row = {
          pub_id: input.pub_id, title, category: input.category, description: input.description || "", schedule: input.schedule,
          weekdays: input.schedule === "weekly" ? days : [], event_date: input.schedule === "one-off" ? input.event_date : null,
          start_time: input.start_time || null, end_time: input.end_time || null,
          source_url: input.source_url || null, is_published: Boolean(input.is_published)
        };
        let saved = input.id ? events.find(e => e.id === input.id) : null;
        if (input.id && !saved) fail("Event not found");
        if (saved) {
          if (row.is_published && !saved.is_published) row.checked_at = new Date().toISOString();
          Object.assign(saved, row);
        } else {
          saved = { id: uid(), source: input.source || "admin", checked_at: row.is_published ? new Date().toISOString() : null, ...row };
          events.push(saved);
        }
        emit({ table: "events", payload: {} });
        return clone(saved);
      },
      async deleteEvent(eventId) {
        requireAdmin();
        const index = events.findIndex(e => e.id === eventId);
        if (index !== -1) events.splice(index, 1);
        emit({ table: "events", payload: {} });
      },
      async deleteDrink(drinkId) {
        requireAdmin();
        const index = drinks.findIndex(d => d.id === drinkId);
        if (index !== -1) drinks.splice(index, 1);
        emit({ table: "drinks", payload: {} });
      },
      async updateSuggestion(id, status, note) {
        requireAdmin();
        const row = suggestions.find(s => s.id === id) || fail("Suggestion not found");
        if (!["new", "reviewed", "planned", "in_progress", "done", "rejected"].includes(status)) fail("Pick a valid status");
        Object.assign(row, { status, admin_note: String(note || "").trim() || null, updated_at: new Date().toISOString() });
      },
      async deleteSuggestion(id) {
        requireAdmin();
        const i = suggestions.findIndex(s => s.id === id);
        if (i !== -1) suggestions.splice(i, 1);
      },
      async listMenuSubmissions() {
        requireAdmin();
        await wait(60);
        return clone(menuSubmissions.map(m => ({
          ...m,
          pub: m.pub_id ? (({ id, name, area }) => ({ id, name, area }))(pubs.find(p => p.id === m.pub_id) || { id: m.pub_id }) : null,
          sender: { username: profileOf(m.submitted_by)?.username || null }
        })));
      },
      async getMenuSubmission(id) {
        const list = await this.listMenuSubmissions();
        return list.find(m => m.id === id) || null;
      },
      async menuSubmissionUrl(path) {
        requireAdmin();
        const file = submissionFiles.get(path);
        return file ? URL.createObjectURL(file) : "";
      },
      async menuSubmissionFile(submission) {
        requireAdmin();
        return submissionFiles.get(submission.storage_path) || fail("File not found");
      },
      async reviewMenuSubmission(id, { status, note = null, pricesImported = null }) {
        requireAdmin();
        if (!["new", "used", "not_used"].includes(status)) fail("Pick a valid status");
        const row = menuSubmissions.find(m => m.id === id) || fail("Menu not found");
        Object.assign(row, {
          status, admin_note: String(note || "").trim() || null,
          prices_imported: row.prices_imported + (pricesImported || 0), reviewed_at: new Date().toISOString()
        });
        return clone(row);
      },
      async deleteMenuSubmission(id) {
        requireAdmin();
        const i = menuSubmissions.findIndex(m => m.id === id);
        if (i !== -1) submissionFiles.delete(menuSubmissions.splice(i, 1)[0].storage_path);
      },
      async setFeature(key, live) {
        requireAdmin();
        const info = FEATURES.find(f => f.key === key) || fail("Unknown feature");
        if (info.status === "needs_setup" && live) fail("This feature needs setting up before it can be launched");
        featureSwitches.set(key, Boolean(live));
        emit({ table: "app_features", payload: {} });
        return { key, is_live: Boolean(live) };
      },
      async listDeals(pubId) {
        requireAdmin();
        return clone(deals.filter(d => d.pub_id === pubId));
      },
      async saveDeal(input) {
        requireAdmin();
        await wait();
        const days = [...new Set((input.days || []).map(Number))].sort();
        const title = String(input.title || "").trim();
        const price = input.deal_price === "" || input.deal_price == null ? null : Number(input.deal_price);
        const pct = input.discount_pct === "" || input.discount_pct == null ? null : Number(input.discount_pct);
        const bad = title.length < 3 || title.length > 80 || !days.length || !input.start_time || !input.end_time || input.start_time === input.end_time
          || (price == null) === (pct == null) || (price != null && !(price >= 1 && price <= 25)) || (pct != null && !(pct >= 5 && pct <= 75));
        if (bad) fail("Check the deal: a title (3-80 characters), at least one day, different start and end times, and either a price (£1-£25) or a discount (5-75%)");
        const row = {
          pub_id: input.pub_id, title, days, start_time: input.start_time, end_time: input.end_time, drink_id: input.drink_id || null,
          category: input.category || null, deal_price: price, discount_pct: pct, source: input.source || "admin",
          source_url: input.source_url || null, is_published: Boolean(input.is_published), updated_at: new Date().toISOString()
        };
        let saved;
        if (input.id) {
          saved = deals.find(d => d.id === input.id) || fail("Deal not found");
          Object.assign(saved, row);
        } else {
          saved = { id: uid(), created_at: new Date().toISOString(), ...row };
          deals.push(saved);
        }
        emit({ table: "deals", payload: {} });
        return clone(saved);
      },
      async deleteDeal(id) {
        requireAdmin();
        const i = deals.findIndex(d => d.id === id);
        if (i !== -1) deals.splice(i, 1);
        emit({ table: "deals", payload: {} });
      },
      async setOpeningHours(pubId, hours) {
        requireAdmin();
        const pub = pubs.find(p => p.id === pubId) || fail("Unknown pub");
        for (const ranges of Object.values(hours || {})) {
          for (const [o, c] of ranges) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(o) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c)) fail("Times must look like 11:00 or 23:30");
        }
        pub.opening_hours = hours && Object.keys(hours).length ? hours : null;
        emit({ table: "pubs", payload: {} });
      },
      async listHeldReports() {
        requireAdmin();
        return clone(reports.filter(r => r.held).map(r => ({ ...withReporter(r), pub: pubs.find(p => p.id === r.pub_id), drink: { current_price: drinks.find(d => d.id === r.drink_id)?.current_price } })));
      },
      async reviewHeldReport(id, approve) {
        requireAdmin();
        const report = reports.find(r => r.id === id && r.held) || fail("That report isn't waiting for review");
        Object.assign(report, { held: false, is_hidden: !approve });
        recomputeDrink(report.drink_id);
        emit({ table: "price_reports", payload: {} });
      },
      async receiptUrl(path) {
        requireAdmin();
        const file = receiptFiles.get(path);
        return file ? URL.createObjectURL(file) : "";
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
