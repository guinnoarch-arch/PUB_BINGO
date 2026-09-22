import { CATEGORIES } from "../../data/seedPubs.js";

// Sensible bounds for a central-London pint (or half). Anything outside is almost certainly a typo.
export const MIN_PRICE = 1;
export const MAX_PRICE = 25;
export const MEASURES = ["pint", "half", "two-thirds", "schooner"];
const MEASURE_TO_PINT = { pint: 1, half: 2, "two-thirds": 1.5, schooner: 1.5 };

export const LIMITS = { drinkName: { min: 2, max: 60 }, note: { max: 200 } };

// Accepts "5.80", "£5.80", " 5.8 ", "5,80", "580p". Returns a number rounded to pence, or null.
export function parsePrice(input) {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) / 100 : null;
  if (typeof input !== "string") return null;
  let text = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return null;
  const pence = /^(\d{2,4})p$/.exec(text);
  if (pence) return Number(pence[1]) / 100;
  text = text.replace(/^£/, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100) / 100;
}

// Price for a full pint, so halves (e.g. The French House) compare fairly with pints.
export function pintPrice(price, measure = "pint") {
  const factor = MEASURE_TO_PINT[measure] ?? 1;
  return Math.round(Number(price) * factor * 100) / 100;
}

export function formatPrice(value) {
  if (value == null || !Number.isFinite(Number(value))) return "–";
  return `£${Number(value).toFixed(2)}`;
}

export function cleanText(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

// Validates a price report from the form. Mirrors the checks in submit_price_report() in the database,
// which remains the real gatekeeper. Returns { ok, value, errors }.
export function validatePriceReport(input = {}) {
  const errors = {};
  const price = parsePrice(input.price);
  if (price == null) errors.price = "Enter a price like 5.80";
  else if (price < MIN_PRICE || price > MAX_PRICE) errors.price = `Price must be between ${formatPrice(MIN_PRICE)} and ${formatPrice(MAX_PRICE)}`;

  const drinkId = input.drinkId || null;
  const drinkName = cleanText(input.drinkName);
  if (!drinkId) {
    if (drinkName.length < LIMITS.drinkName.min) errors.drinkName = "Enter the drink's name";
    else if (drinkName.length > LIMITS.drinkName.max) errors.drinkName = `Keep the name under ${LIMITS.drinkName.max} characters`;
  }

  const category = input.category || (drinkId ? null : "");
  if (!drinkId && !CATEGORIES.includes(category)) errors.category = "Pick a category";
  if (drinkId && category && !CATEGORIES.includes(category)) errors.category = "Pick a category";

  const measure = input.measure || "pint";
  if (!MEASURES.includes(measure)) errors.measure = "Pick a measure";

  const note = cleanText(input.note);
  if (note.length > LIMITS.note.max) errors.note = `Keep notes under ${LIMITS.note.max} characters`;

  if (!input.pubId) errors.pubId = "Pick a pub";

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok ? { pubId: input.pubId, drinkId, drinkName: drinkId ? null : drinkName, category: category || null, measure, price, note: note || null } : null
  };
}
