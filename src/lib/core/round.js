// Round calculator: what a group's round costs at each pub. Each item is a drink name or category
// ("Guinness", "IPA", "any lager") and a number of pints; the cheapest match at each pub is used.
import { distanceMetres } from "./geo.js";
import { isRealPrice, searchDrinks } from "./search.js";

export function priceRound(pubs, items, { origin = null, includeEstimates = false } = {}) {
  const wanted = (items || []).filter(i => String(i.query || "").trim() && i.qty > 0);
  if (!wanted.length) return [];
  const rows = [];
  for (const pub of pubs || []) {
    const lines = [];
    const missing = [];
    for (const item of wanted) {
      const query = String(item.query).replace(/^any\s+/i, "").trim();
      const match = searchDrinks([pub], { query, draughtOnly: true, realOnly: !includeEstimates })[0];
      if (!match) { missing.push(item.query); continue; }
      lines.push({ item, drink: match.drink, each: match.pintPrice, cost: Math.round(match.pintPrice * item.qty * 100) / 100, estimate: !isRealPrice(match.drink) });
    }
    if (!lines.length) continue;
    rows.push({
      pub,
      lines,
      missing,
      complete: missing.length === 0,
      total: Math.round(lines.reduce((sum, l) => sum + l.cost, 0) * 100) / 100,
      hasEstimates: lines.some(l => l.estimate),
      distance: origin ? distanceMetres(origin, { lat: pub.lat, lng: pub.lng }) : null
    });
  }
  return rows.sort((a, b) => Number(b.complete) - Number(a.complete) || a.total - b.total || a.pub.name.localeCompare(b.pub.name));
}
