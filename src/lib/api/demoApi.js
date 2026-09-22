// In-memory stand-in for the Supabase API, used only when VITE_DEMO_MODE=true (local UI work and
// browser tests without a Supabase project). It mirrors the same rules as the database functions,
// but nothing is shared or saved: a page reload starts again from the seed data.
import { SEED_PUBS } from "../../data/seedPubs.js";
import { validatePriceReport } from "../core/prices.js";
import { normaliseText } from "../core/search.js";
import { preparePhoto } from "./photos.js";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);
const clone = value => JSON.parse(JSON.stringify(value));
const wait = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));

export function createDemoApi() {
  const now = Date.now();
  const pubs = SEED_PUBS.map(({ drinks, ...pub }) => ({ ...pub, uploads_paused: false }));
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
      return clone(pubs.map(pub => ({ ...pub, drinks: drinks.filter(d => d.pub_id === pub.id) })));
    },

    async getPub(id) {
      await wait();
      const pub = pubs.find(p => p.id === id);
      if (!pub) return null;
      const admin = session && profileOf(session.user.id)?.is_admin;
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
      Object.assign(drink, { current_price: value.price, last_updated_at: report.reported_at, source: "community" });
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
        if (latest && drink) Object.assign(drink, { current_price: latest.price, last_updated_at: latest.reported_at, source: latest.source });
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
