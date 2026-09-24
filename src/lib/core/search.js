import { distanceMetres } from "./geo.js";
import { isDraught, pintPrice } from "./prices.js";

export function normaliseText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Common ways people type categories.
const CATEGORY_ALIASES = {
  lager: "Lager", lagers: "Lager", pils: "Lager", pilsner: "Lager",
  ipa: "IPA",
  "pale ale": "Pale Ale", pale: "Pale Ale", apa: "Pale Ale",
  "real ale": "Real Ale", cask: "Real Ale", bitter: "Real Ale", ale: "Real Ale",
  stout: "Stout", porter: "Stout",
  cider: "Cider", cyder: "Cider",
  "wheat beer": "Wheat Beer", wheat: "Wheat Beer", weisse: "Wheat Beer", weissbier: "Wheat Beer"
};

export function categoryForQuery(query) {
  return CATEGORY_ALIASES[normaliseText(query)] || null;
}

// A drink matches when every word of the query appears in its name, or the query names its category.
export function drinkMatches(drink, query) {
  const q = normaliseText(query);
  if (!q) return true;
  const nameWords = normaliseText(drink.name).split(" ");
  if (q.split(" ").every(word => nameWords.some(part => part.startsWith(word)))) return true;
  const category = categoryForQuery(q);
  return Boolean(category) && drink.category === category;
}

// Adds pint-equivalent price and distance from the origin (if any) to every drink.
export function enrichDrink(pub, drink, origin) {
  const price = Number(drink.current_price);
  const measure = drink.measure || "pint";
  return {
    pub,
    drink,
    price,
    measure,
    volumeMl: drink.volume_ml ?? null,
    draught: isDraught(measure),
    pintPrice: pintPrice(price, measure, drink.volume_ml),
    distance: origin ? distanceMetres(origin, { lat: pub.lat, lng: pub.lng }) : null
  };
}

// Compare by price per pint; bottles of unknown size (no pint price) go last, by their own price.
const pintKey = row => (row.pintPrice == null ? Infinity : row.pintPrice);
const comparePint = (a, b) => (pintKey(a) - pintKey(b)) || (pintKey(a) === Infinity ? a.price - b.price : 0);
const byPrice = (a, b) => comparePint(a, b) || (a.distance ?? 0) - (b.distance ?? 0) || a.pub.name.localeCompare(b.pub.name);
const byDistance = (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || comparePint(a, b) || a.pub.name.localeCompare(b.pub.name);

export function sortResults(rows, sortBy = "price") {
  const sorted = [...rows];
  sorted.sort(sortBy === "distance" ? byDistance : byPrice);
  return sorted;
}

// Every (pub, drink) pair matching the query, sorted cheapest-first (or nearest-first).
// Drinks with no valid price are skipped rather than sorted to the top.
// A "real" price came from a visitor, the pub's website or an admin check, not a starting estimate.
export function isRealPrice(drink) {
  // A fixed happy-hour price (e.g. "£5 pints 4-7pm", added by an admin) counts as real too.
  return Boolean(drink) && (drink.source !== "seed" || Boolean(drink.deal?.fixed));
}

// realOnly: leave out starting estimates (used for public search, map pins and the leaderboard).
// draughtOnly: leave out bottles and cans (used for "cheapest pint" rankings).
export function searchDrinks(pubs, { query = "", origin = null, sortBy = "price", category = null, realOnly = false, draughtOnly = false } = {}) {
  const rows = [];
  for (const pub of pubs || []) {
    for (const drink of pub.drinks || []) {
      if (!(Number(drink.current_price) > 0)) continue;
      if (realOnly && !isRealPrice(drink)) continue;
      if (draughtOnly && !isDraught(drink.measure)) continue;
      if (category && drink.category !== category) continue;
      if (!drinkMatches(drink, query)) continue;
      rows.push(enrichDrink(pub, drink, origin));
    }
  }
  return sortResults(rows, sortBy === "distance" && origin ? "distance" : "price");
}

// Groups search results by pub: one row per pub with its cheapest matching drink. Used for map pins.
export function cheapestPerPub(rows) {
  const best = new Map();
  for (const row of rows) {
    const current = best.get(row.pub.id);
    // Prefer draught; among the same kind, the lowest price per pint.
    const better = !current
      || (row.draught && !current.draught)
      || (row.draught === current.draught && comparePint(row, current) < 0);
    if (better) best.set(row.pub.id, row);
  }
  return best;
}

// "Cheapest pint right now": the cheapest drinks across all pubs, optionally one per pub.
// Pubs that stock a matching drink but only have an estimate for it (no real price yet).
export function unconfirmedPubs(pubs, { query = "", category = null } = {}) {
  const confirmed = new Set(searchDrinks(pubs, { query, category, realOnly: true }).map(row => row.pub.id));
  const result = new Map();
  for (const row of searchDrinks(pubs, { query, category })) {
    if (isRealPrice(row.drink) || confirmed.has(row.pub.id)) continue;
    if (!result.has(row.pub.id)) result.set(row.pub.id, { pub: row.pub, drinks: [] });
    result.get(row.pub.id).drinks.push(row.drink.name);
  }
  return [...result.values()].sort((a, b) => a.pub.name.localeCompare(b.pub.name));
}

// Draught only: a bottle is not "a pint".
export function cheapestPints(pubs, { limit = 10, category = null, onePerPub = true, realOnly = false } = {}) {
  let rows = searchDrinks(pubs, { category, realOnly, draughtOnly: true });
  if (onePerPub) {
    const seen = new Set();
    rows = rows.filter(row => (seen.has(row.pub.id) ? false : seen.add(row.pub.id)));
  }
  return rows.slice(0, limit);
}

// Summary stats for a single drink's report history (for trends).
export function priceHistoryStats(reports) {
  const prices = (reports || []).map(r => Number(r.price)).filter(p => p > 0);
  if (!prices.length) return null;
  const sorted = [...reports].sort((a, b) => new Date(a.reported_at) - new Date(b.reported_at));
  const first = Number(sorted[0].price);
  const last = Number(sorted[sorted.length - 1].price);
  return {
    count: prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    average: Math.round((prices.reduce((sum, p) => sum + p, 0) / prices.length) * 100) / 100,
    change: Math.round((last - first) * 100) / 100
  };
}
