// Turns the text of a PDF drinks menu into suggested prices for a pub's drinks.
// Pure functions (no PDF library here) so they can be unit tested; the admin reviews every
// suggestion before anything is saved.
import { normaliseText } from "./search.js";

const PRICE_RE = /£?\s?(\d{1,2}[.,]\d{2})(?!\d)/g;
const ABV_RE = /\b\d{1,2}(?:[.,]\d{1,2})?\s?%/g;
const NOT_DRAUGHT_RE = /\b(\d{2,4}\s?ml|\d{2,3}\s?cl|bottle|bottles|can|cans|glass|large|small|carafe|wine|prosecco|champagne|gin|vodka|rum|whisk(e)?y|tequila|cocktail|shot|spirit|soft drink|juice|cola|coke|lemonade|tonic|coffee|tea|crisps|nuts)\b/i;
const HALF_RE = /\b(half|½)\b/i;

// Groups pdf.js text items ({str, transform:[a,b,c,d,x,y]}) into lines, top to bottom, left to right.
export function itemsToLines(items, tolerance = 3) {
  const rows = [];
  for (const item of items || []) {
    const text = String(item.str ?? "");
    if (!text.trim()) continue;
    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    let row = rows.find(r => Math.abs(r.y - y) <= tolerance);
    if (!row) { row = { y, parts: [] }; rows.push(row); }
    row.parts.push({ x, text });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map(r => r.parts.sort((a, b) => a.x - b.x).map(p => p.text.trim()).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function guessCategory(name) {
  const n = normaliseText(name);
  if (/\b(stout|porter)\b/.test(n)) return "Stout";
  if (/\bcider|cyder|perry\b/.test(n)) return "Cider";
  if (/\b(ipa|neipa|dipa)\b/.test(n)) return "IPA";
  if (/\bpale\b/.test(n)) return "Pale Ale";
  if (/\b(wheat|weiss|weisse|weizen|witbier|blanc)\b/.test(n)) return "Wheat Beer";
  if (/\b(lager|pils|pilsner|helles|hells|budvar|peroni|madri|asahi|moretti|amstel|heineken|carlsberg|stella|camden hells|kronenbourg)\b/.test(n)) return "Lager";
  if (/\b(ale|bitter|best|mild|esb|pride|landlord)\b/.test(n)) return "Real Ale";
  if (/\bguinness\b/.test(n)) return "Stout";
  return "Other";
}

function cleanName(text) {
  return text
    .replace(ABV_RE, " ")
    .replace(/\b(pint|half|½|draught|draft|on tap)\b/gi, " ")
    .replace(/[•·|:*_…]+|\.{2,}|-{2,}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—,]+|[\s\-–—,]+$/g, "")
    .replace(/^(of|a)\s+/i, "")
    .trim();
}

const toNumber = s => Number(s.replace(",", "."));

// Parses menu lines into candidates: { raw, name, pint, half, category, draught }.
// "Oyster Stout 4.6% £6.80 £3.45" -> pint 6.80, half 3.45. A name on one line with its
// prices on the next is joined up.
export function parseMenuLines(lines) {
  const out = [];
  let pendingName = null;
  for (const raw of lines || []) {
    const prices = [...raw.matchAll(PRICE_RE)].map(m => toNumber(m[1])).filter(p => p >= 1 && p <= 25);
    const firstPrice = raw.search(PRICE_RE);
    let name = cleanName(firstPrice >= 0 ? raw.slice(0, firstPrice) : raw);

    if (!prices.length) {
      // Possible drink name whose prices are on the next line.
      pendingName = name.length >= 2 && name.length <= 60 && /[a-z]/i.test(name) ? { name, raw } : null;
      continue;
    }
    let fullRaw = raw;
    if (name.length < 2 && pendingName) {
      name = pendingName.name;
      fullRaw = `${pendingName.raw} ${raw}`;
    }
    pendingName = null;
    if (name.length < 2 || name.length > 60 || !/[a-z]/i.test(name)) continue;

    let pint = null;
    let half = null;
    if (prices.length >= 2) {
      const [a, b] = prices;
      const hi = Math.max(a, b);
      const lo = Math.min(a, b);
      if (lo / hi >= 0.4 && lo / hi <= 0.62) { pint = hi; half = lo; } else { pint = a; }
    } else if (HALF_RE.test(raw)) {
      half = prices[0];
    } else {
      pint = prices[0];
    }
    out.push({ raw: fullRaw, name, pint, half, category: guessCategory(name), draught: !NOT_DRAUGHT_RE.test(fullRaw) });
  }
  return out;
}

function tokens(text) {
  return normaliseText(text).split(" ").filter(t => t && !["the", "and", "of", "draught", "draft"].includes(t));
}

// 0..1 similarity between a menu name and a listed drink name.
export function nameScore(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const na = normaliseText(a);
  const nb = normaliseText(b);
  if (na === nb) return 1;
  const sa = new Set(ta);
  const shared = tb.filter(t => sa.has(t)).length;
  // Containment ("Oyster Stout" vs "Porterhouse Oyster Stout") counts strongly.
  const contained = shared === Math.min(ta.length, tb.length) ? 0.85 : 0;
  const jaccard = shared / new Set([...ta, ...tb]).size;
  return Math.max(contained, jaccard);
}

// Builds review rows: each candidate matched to the best existing drink (same measure), or a new drink.
// Rows start ticked only when they're a confident match to a listed draught drink with a changed price.
export function buildImportRows(candidates, drinks, { threshold = 0.6 } = {}) {
  const rows = [];
  const usedDrinkIds = new Set();
  for (const c of candidates) {
    for (const [measure, price] of [["pint", c.pint], ["half", c.half]]) {
      if (price == null) continue;
      let best = null;
      for (const d of drinks || []) {
        if ((d.measure || "pint") !== measure || usedDrinkIds.has(d.id)) continue;
        const score = nameScore(c.name, d.name);
        if (score >= threshold && (!best || score > best.score)) best = { drink: d, score };
      }
      if (best) usedDrinkIds.add(best.drink.id);
      const changed = best ? Math.abs(Number(best.drink.current_price) - price) >= 0.005 : true;
      rows.push({
        key: `${rows.length}`,
        raw: c.raw,
        name: best ? best.drink.name : c.name,
        menuName: c.name,
        category: best ? best.drink.category : c.category,
        measure,
        price,
        drinkId: best?.drink.id || null,
        currentPrice: best ? Number(best.drink.current_price) : null,
        score: best?.score || 0,
        draught: c.draught,
        selected: Boolean(best) && c.draught && changed
      });
    }
  }
  // Only offer halves when the pub lists the drink by the half (e.g. The French House);
  // otherwise a pint price is what we want.
  return rows.filter(r => r.measure === "pint" || r.drinkId);
}
