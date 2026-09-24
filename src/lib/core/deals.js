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
export function dealApplies(deal, drink) {
  if (deal.drink_id) return deal.drink_id === drink.id;
  if (!isDraught(drink.measure)) return false;
  if (deal.deal_price != null && (drink.measure || "pint") !== "pint") return false; // "£5 pints" means pints
  return !deal.category || deal.category === drink.category;
}

export function dealPriceFor(deal, drink) {
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
