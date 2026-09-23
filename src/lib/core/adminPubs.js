// Summaries for the admin pubs table. Pure functions so they can be unit tested.

export const PRICES_ONLINE_LABELS = { yes: "Yes", partial: "Partly", no: "No", unknown: "Not checked" };
export const SOURCE_LABELS = { seed: "Seed estimate", community: "Community", website: "Pub website", admin: "Checked by admin" };
// Sources we treat as real prices rather than guesses.
export const VERIFIED_SOURCES = new Set(["community", "website", "admin"]);

// PostgREST returns a one-to-one embed as an object, but older setups can return an array.
export function one(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

// What's missing before a pub is useful (or allowed) to publish.
export function missingInfo(pub) {
  const missing = [];
  if (!pub.address) missing.push("address");
  if (!Number.isFinite(pub.lat) || !Number.isFinite(pub.lng)) missing.push("map position");
  if (!pub.description) missing.push("description");
  if (!pub.website) missing.push("website");
  if (!(pub.drinks || []).length) missing.push("drinks");
  return missing;
}

export function canPublish(pub) {
  return Boolean(pub.address) && Number.isFinite(pub.lat) && Number.isFinite(pub.lng);
}

export function summarisePub(pub) {
  const drinks = pub.drinks || [];
  const verified = drinks.filter(d => VERIFIED_SOURCES.has(d.source)).length;
  const bySource = { seed: 0, community: 0, website: 0, admin: 0 };
  drinks.forEach(d => { bySource[d.source] = (bySource[d.source] || 0) + 1; });
  const times = drinks.map(d => Date.parse(d.last_updated_at)).filter(Number.isFinite);
  const admin = one(pub.pub_admin) || {};
  const photoCount = Array.isArray(pub.pub_photos) ? (pub.pub_photos[0]?.count ?? pub.pub_photos.length) : 0;
  return {
    id: pub.id,
    name: pub.name,
    area: pub.area,
    published: pub.is_published !== false,
    drinkCount: drinks.length,
    verifiedCount: verified,
    verifiedPct: drinks.length ? Math.round((verified / drinks.length) * 100) : 0,
    bySource,
    lastPriceUpdate: times.length ? new Date(Math.max(...times)).toISOString() : null,
    website: pub.website || null,
    menuUrl: pub.drinks_menu_url || null,
    operator: pub.operator || "",
    pricesOnline: admin.prices_online || "unknown",
    pricesCheckedAt: admin.prices_checked_at || null,
    notes: admin.notes || "",
    uploadsPaused: Boolean(pub.uploads_paused),
    eventCount: (pub.events || []).filter(e => e.is_published).length,
    eventsToCheck: (pub.events || []).filter(e => !e.is_published).length,
    photoCount,
    missing: missingInfo(pub)
  };
}

const COMPARE = {
  name: (a, b) => a.name.localeCompare(b.name),
  area: (a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name),
  published: (a, b) => Number(b.published) - Number(a.published),
  drinkCount: (a, b) => a.drinkCount - b.drinkCount,
  verifiedPct: (a, b) => a.verifiedPct - b.verifiedPct,
  lastPriceUpdate: (a, b) => (Date.parse(a.lastPriceUpdate) || 0) - (Date.parse(b.lastPriceUpdate) || 0),
  website: (a, b) => Number(Boolean(b.website)) - Number(Boolean(a.website)),
  pricesOnline: (a, b) => ["yes", "partial", "unknown", "no"].indexOf(a.pricesOnline) - ["yes", "partial", "unknown", "no"].indexOf(b.pricesOnline),
  operator: (a, b) => a.operator.localeCompare(b.operator),
  missing: (a, b) => a.missing.length - b.missing.length,
  eventCount: (a, b) => a.eventCount - b.eventCount || a.eventsToCheck - b.eventsToCheck
};

export function sortRows(rows, key = "name", direction = "asc") {
  const compare = COMPARE[key] || COMPARE.name;
  const sorted = [...rows].sort((a, b) => compare(a, b) || a.name.localeCompare(b.name));
  return direction === "desc" ? sorted.reverse() : sorted;
}

// status: all | published | hidden | needs-prices (has seed estimates) | no-website | events-to-check
export function filterRows(rows, { text = "", status = "all" } = {}) {
  const needle = text.trim().toLowerCase();
  return rows.filter(row => {
    if (needle && ![row.name, row.area, row.operator, row.website || ""].some(v => v.toLowerCase().includes(needle))) return false;
    if (status === "published") return row.published;
    if (status === "hidden") return !row.published;
    if (status === "needs-prices") return row.bySource.seed > 0 || row.drinkCount === 0;
    if (status === "no-website") return !row.website;
    if (status === "events-to-check") return row.eventsToCheck > 0;
    return true;
  });
}

// Totals for the strip above the table.
export function adminTotals(rows) {
  const drinks = rows.reduce((n, r) => n + r.drinkCount, 0);
  const verified = rows.reduce((n, r) => n + r.verifiedCount, 0);
  return {
    pubs: rows.length,
    published: rows.filter(r => r.published).length,
    hidden: rows.filter(r => !r.published).length,
    drinks,
    verifiedPct: drinks ? Math.round((verified / drinks) * 100) : 0,
    withWebsite: rows.filter(r => r.website).length
  };
}

// Turns a pub name into a URL-safe id, e.g. "The Lamb & Flag" -> "the-lamb-and-flag".
export function slugify(name) {
  return String(name || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// CSV export of the admin table (opens in Excel / Google Sheets).
const CSV_COLUMNS = [
  ["Pub", r => r.name],
  ["Area", r => r.area],
  ["Status", r => (r.published ? "Live" : "Hidden")],
  ["Drinks", r => r.drinkCount],
  ["Real prices %", r => r.verifiedPct],
  ["Estimates", r => r.bySource.seed],
  ["Community", r => r.bySource.community],
  ["From website", r => r.bySource.website],
  ["Checked by admin", r => r.bySource.admin],
  ["Last price update", r => (r.lastPriceUpdate ? r.lastPriceUpdate.slice(0, 10) : "")],
  ["Website", r => r.website || ""],
  ["Drinks menu", r => r.menuUrl || ""],
  ["Prices online", r => PRICES_ONLINE_LABELS[r.pricesOnline] || r.pricesOnline],
  ["Prices last checked", r => (r.pricesCheckedAt ? r.pricesCheckedAt.slice(0, 10) : "")],
  ["Operator", r => r.operator],
  ["Missing info", r => r.missing.join("; ")],
  ["Events live", r => r.eventCount],
  ["Events to check", r => r.eventsToCheck],
  ["Photo uploads", r => (r.uploadsPaused ? "Paused" : "Open")],
  ["Notes", r => r.notes]
];

function csvCell(value) {
  let text = String(value ?? "");
  // Stop spreadsheet apps treating text as a formula.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows) {
  const lines = [CSV_COLUMNS.map(([title]) => csvCell(title)).join(",")];
  rows.forEach(row => lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(row))).join(",")));
  return lines.join("\r\n");
}
