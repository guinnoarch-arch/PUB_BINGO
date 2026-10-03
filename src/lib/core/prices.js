import { CATEGORIES } from "../../data/seedPubs.js";

// Sensible bounds for a central-London pint (or half). Anything outside is almost certainly a typo.
export const MIN_PRICE = 1;
export const MAX_PRICE = 25;
export const MEASURES = ["pint", "half", "two-thirds", "schooner", "bottle", "can"];
// Draught measures (poured at the bar). Bottles and cans are packaged and never count as "a pint".
export const DRAUGHT_MEASURES = ["pint", "half", "two-thirds", "schooner"];
const MEASURE_TO_PINT = { pint: 1, half: 2, "two-thirds": 1.5, schooner: 1.5 };
const PINT_ML = 568;

export function isDraught(measure = "pint") {
  return DRAUGHT_MEASURES.includes(measure || "pint");
}

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
// Bottles/cans: price per pint of beer when the size is known (e.g. £6.05 for 330ml ≈ £10.41), else null.
export function pintPrice(price, measure = "pint", volumeMl = null) {
  if (!isDraught(measure)) {
    const ml = Number(volumeMl);
    return ml > 0 ? Math.round(((Number(price) * PINT_ML) / ml) * 100) / 100 : null;
  }
  const factor = MEASURE_TO_PINT[measure || "pint"] ?? 1;
  return Math.round(Number(price) * factor * 100) / 100;
}

// "330ml bottle", "can", "half"
export function measureLabel(measure = "pint", volumeMl = null) {
  if (!isDraught(measure) && Number(volumeMl) > 0) return `${volumeMl}ml ${measure}`;
  return measure || "pint";
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
  if (price == null) errors.price = String(input.price ?? "").trim() ? "Enter the price as a number, like 5.80." : "Enter the price you paid, like 5.80.";
  else if (price < MIN_PRICE || price > MAX_PRICE) errors.price = `Enter a price between ${formatPrice(MIN_PRICE)} and ${formatPrice(MAX_PRICE)}. Check the decimal point.`;

  const drinkId = input.drinkId || null;
  const drinkName = cleanText(input.drinkName);
  if (!drinkId) {
    if (drinkName.length < LIMITS.drinkName.min) errors.drinkName = "Enter the drink's name, like Camden Hells.";
    else if (drinkName.length > LIMITS.drinkName.max) errors.drinkName = `Shorten the name to ${LIMITS.drinkName.max} characters or fewer.`;
  }

  const category = input.category || (drinkId ? null : "");
  if (!drinkId && !CATEGORIES.includes(category)) errors.category = "Choose a category, like Lager or Stout.";
  if (drinkId && category && !CATEGORIES.includes(category)) errors.category = "Choose a category from the list.";

  const measure = input.measure || "pint";
  if (!MEASURES.includes(measure)) errors.measure = "Choose a measure from the list.";

  const note = cleanText(input.note);
  if (note.length > LIMITS.note.max) errors.note = `Shorten the note to ${LIMITS.note.max} characters or fewer.`;

  if (!input.pubId) errors.pubId = "Choose a pub.";

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok ? { pubId: input.pubId, drinkId, drinkName: drinkId ? null : drinkName, category: category || null, measure, price, note: note || null } : null
  };
}
