// Happy hours / deals: time-based prices, always in London time.
import { isDraught } from "./prices.js";
import { formatSchedule, formatTime, londonNow, timeToMinutes } from "./events.js";

// A deal can run past midnight (e.g. 22:00–01:00): then it also covers the early hours of the next day.
export function dealIsActive(deal, now = londonNow()) {
  const start = timeToMinutes(deal.start_time);
  const end = timeToMinutes(deal.end_time);
  const days = deal.days || [];
  if (start == null || end == null) return false;
  if (end > start) return days.includes(now.weekday) && now.minutes >= start && now.minutes < end;
  if (days.includes(now.weekday) && now.minutes >= start) return true;
  return days.includes((now.weekday + 6) % 7) && now.minutes < end;
}

// Which drinks a deal covers: one drink, or all draught drinks (optionally of one category).
function dealApplies(deal, drink) {
  if (deal.drink_id) return deal.drink_id === drink.id;
  if (!isDraught(drink.measure)) return false;
  if (deal.deal_price != null && (drink.measure || "pint") !== "pint") return false; // "£5 pints" means pints
  return !deal.category || deal.category === drink.category;
}

function dealPriceFor(deal, drink) {
  const regular = Number(drink.current_price);
  if (deal.deal_price != null) return Number(deal.deal_price);
  return Math.round(regular * (1 - Number(deal.discount_pct) / 100) * 100) / 100;
}

// Returns pubs whose drinks show the deal price while a deal is on (never higher than the usual price).
// The usual price is kept as regular_price, and drink.deal says which deal and when it ends.
export function applyDeals(pubs, deals, now = londonNow()) {
  const active = (deals || []).filter(d => dealIsActive(d, now));
  if (!active.length) return pubs;
  const byPub = new Map();
  for (const deal of active) {
    if (!byPub.has(deal.pub_id)) byPub.set(deal.pub_id, []);
    byPub.get(deal.pub_id).push(deal);
  }
  return (pubs || []).map(pub => {
    const pubDeals = byPub.get(pub.id);
    if (!pubDeals) return pub;
    return {
      ...pub,
      drinks: (pub.drinks || []).map(drink => {
        let best = null;
        for (const deal of pubDeals) {
          if (!dealApplies(deal, drink)) continue;
          const price = dealPriceFor(deal, drink);
          if (price < Number(drink.current_price) && (!best || price < best.price)) best = { deal, price };
        }
        if (!best) return drink;
        return {
          ...drink,
          current_price: best.price,
          regular_price: Number(drink.current_price),
          deal: { id: best.deal.id, title: best.deal.title, until: formatTime(best.deal.end_time), fixed: best.deal.deal_price != null }
        };
      })
    };
  });
}

export function describeDeal(deal) {
  const what = deal.deal_price != null ? `£${Number(deal.deal_price).toFixed(2)}` : `${deal.discount_pct}% off`;
  return { what, when: formatSchedule({ schedule: "weekly", weekdays: deal.days, start_time: deal.start_time, end_time: deal.end_time }) };
}

const LINK_RE = /^https?:\/\/\S+$/i;

// Checks the admin happy-hour form (mirrors the deals table's rules). Returns { field: "message" }.
// form.kind is "price" (fixed price) or "pct" (% off).
export function validateDeal(form) {
  const errors = {};
  const title = String(form.title || "").trim();
  if (title.length < 3 || title.length > 80) errors.title = "Enter a title of 3 to 80 characters, like “Happy hour: £5 pints”.";
  if (!(form.days || []).length) errors.days = "Choose at least one day.";
  if (!form.start_time || !form.end_time) errors.end_time = "Enter both a start and an end time.";
  else if (form.start_time === form.end_time) errors.end_time = "The end time must be different from the start time.";
  if (form.kind === "price") {
    const price = Number(String(form.deal_price ?? "").replace(/^£/, ""));
    if (!(price >= 1 && price <= 25)) errors.deal_price = "Enter a price between £1 and £25, like 5.00.";
  } else {
    const pct = Number(form.discount_pct);
    if (!(Number.isInteger(pct) && pct >= 5 && pct <= 75)) errors.discount_pct = "Enter a whole number between 5 and 75.";
  }
  if (String(form.source_url || "").trim() && !LINK_RE.test(String(form.source_url).trim())) errors.source_url = "Enter a full link starting with https://, or leave it empty.";
  return errors;
}
