// Weekly bingo: a new 3×3 card every Monday (London time), the same for everyone that week.
// "auto" tiles complete from what you do in the app that week; "self" tiles you tick yourself.
import { completedLines } from "./bingo.js";
import { addDays, londonNow, weekdayOf } from "./events.js";
import { pintPrice } from "./prices.js";

const inWeek = (value, start) => {
  const key = String(value || "").slice(0, 10);
  return key >= start && key < addDays(start, 7);
};

export const WEEKLY_POOL = [
  { id: "report", mode: "auto", title: "Report a price", detail: "Any drink, any pub.", test: a => a.reports.length >= 1 },
  { id: "three-reports", mode: "auto", title: "Report 3 prices", detail: "Keep the prices fresh.", test: a => a.reports.length >= 3 },
  { id: "confirm-three", mode: "auto", title: "Confirm 3 prices", detail: "Tap “Still right?” on 3 drinks.", test: a => a.confirms.length >= 3 },
  { id: "two-areas", mode: "auto", title: "Report in 2 areas", detail: "e.g. Soho and Holborn.", test: a => new Set(a.reports.map(r => a.pubsById[r.pub_id]?.area).filter(Boolean)).size >= 2 },
  { id: "stout", mode: "auto", title: "Report a stout price", detail: "Guinness, porter…", test: a => a.reports.some(r => r.category === "Stout") },
  { id: "cider", mode: "auto", title: "Report a cider price", detail: "Any cider on draught.", test: a => a.reports.some(r => r.category === "Cider") },
  { id: "real-ale", mode: "auto", title: "Report a real ale price", detail: "Cask counts.", test: a => a.reports.some(r => r.category === "Real Ale") },
  { id: "cheap", mode: "auto", title: "Find a pint under £6", detail: "Report it when you do.", test: a => a.reports.some(r => (pintPrice(r.price, r.measure || "pint") ?? 99) < 6) },
  { id: "check-in-two", mode: "auto", title: "Check in at 2 pubs", detail: "Use Check in on the pub page.", test: a => new Set(a.checkins.map(c => c.pub_id)).size >= 2 },
  { id: "old-pub", mode: "auto", title: "Check in somewhere pre-1850", detail: "Opening year on the pub page.", test: a => a.checkins.some(c => (a.pubsById[c.pub_id]?.opened_year ?? 9999) < 1850) },
  { id: "pour", mode: "auto", title: "Rate a Guinness pour", detail: "On any pub that serves it.", test: a => a.pours >= 1 },
  { id: "menu", mode: "auto", title: "Send a menu", detail: "Suggestions → Menu or price.", test: a => a.menus >= 1 },
  { id: "new-beer", mode: "self", title: "Try a beer you've never had", detail: "Tick when done." },
  { id: "garden", mode: "self", title: "Drink outside", detail: "Beer garden or pavement." },
  { id: "quiz", mode: "self", title: "Go to a quiz or live music", detail: "See What's on." },
  { id: "match", mode: "self", title: "Watch a match in a pub", detail: "Sport on TV." },
  { id: "half", mode: "self", title: "Have a half somewhere new", detail: "A new pub for you." },
  { id: "bring-friend", mode: "self", title: "Bring a friend to Pub Bingo", detail: "Show them the app." }
];

// Monday of the current London week, e.g. "2026-09-21".
export function weekStart(now = londonNow()) {
  return addDays(now.dateKey, -((weekdayOf(now.dateKey) + 6) % 7));
}

// Small seeded shuffle so everyone gets the same card each week.
function seeded(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 5 auto + 4 self tiles, shuffled. Tile ids are prefixed with the week so progress is kept per week.
export function weeklyCard(start) {
  const random = seeded(start);
  const autos = shuffle(WEEKLY_POOL.filter(t => t.mode === "auto"), random).slice(0, 5);
  const selfs = shuffle(WEEKLY_POOL.filter(t => t.mode === "self"), random).slice(0, 4);
  return shuffle([...autos, ...selfs], random).map(t => ({ ...t, id: `w${start}-${t.id}`, baseId: t.id }));
}

// activity: { reports, checkins, pourRatings: [{created_at}], menus: [{created_at}] } (all-time; filtered here)
export function weeklyActivity(activity, start, pubsById = {}) {
  const reports = (activity.reports || []).filter(r => inWeek(r.reported_at, start));
  return {
    pubsById,
    reports: reports.filter(r => (r.kind || "report") === "report"),
    confirms: reports.filter(r => r.kind === "confirm"),
    checkins: (activity.checkins || []).filter(c => inWeek(c.created_at, start)),
    pours: (activity.pourRatings || []).filter(p => inWeek(p.created_at, start)).length,
    menus: (activity.menus || []).filter(m => inWeek(m.created_at, start)).length
  };
}

export function weeklyCardState(start, progressRows = [], activity = {}, pubsById = {}) {
  const stored = new Map(progressRows.map(row => [row.tile_id, row.completed_at]));
  const week = weeklyActivity(activity, start, pubsById);
  return weeklyCard(start).map(tile => {
    const completedAt = stored.get(tile.id) || null;
    const earned = tile.mode === "auto" && Boolean(tile.test?.(week));
    return { ...tile, done: Boolean(completedAt) || earned, completedAt, needsSaving: earned && !completedAt };
  });
}

// Weeks in a row with at least one line, counting back from this week (or last week, if this
// week's card isn't done yet).
export function weeklyStreak(progressRows = [], now = londonNow()) {
  const done = new Set(progressRows.map(r => r.tile_id));
  const hasLine = start => completedLines(weeklyCard(start).map(t => ({ done: done.has(t.id) }))).length > 0;
  let start = weekStart(now);
  if (!hasLine(start)) start = addDays(start, -7);
  let streak = 0;
  while (streak < 104 && hasLine(start)) {
    streak += 1;
    start = addDays(start, -7);
  }
  return streak;
}
