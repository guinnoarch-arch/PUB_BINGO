// What's on: turns weekly and one-off events into dated occurrences, always in London time
// (so "tonight" is right even if a visitor's phone is set to another time zone).
import { WEEKDAYS } from "../../data/features.js";

const TZ = "Europe/London";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Untimed events are assumed to run all evening; timed ones for 3 hours unless an end is given.
const DEFAULT_LENGTH_MINUTES = 180;

export function londonNow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date).map(p => [p.type, p.value]));
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  return { dateKey, weekday: weekdayOf(dateKey), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function weekdayOf(dateKey) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

export function addDays(dateKey, days) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function timeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function formatTime(value) {
  const minutes = timeToMinutes(value);
  if (minutes == null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour12 = h % 12 || 12;
  return `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

function joinWords(words) {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} & ${words[words.length - 1]}`;
}

export function formatDate(dateKey) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatTimes(event) {
  const start = formatTime(event.start_time);
  const end = formatTime(event.end_time);
  if (start && end) return `${start}–${end}`;
  if (start) return `from ${start}`;
  return "";
}

// e.g. "Every Wed & Sat · from 7:30pm", "Every day", "Sat 13 Mar · from 8pm"
export function formatSchedule(event) {
  const times = formatTimes(event);
  let when;
  if (event.schedule === "one-off") {
    when = event.event_date ? formatDate(event.event_date) : "Date to be confirmed";
  } else {
    const days = [...new Set(event.weekdays || [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // Monday first
    when = days.length === 7 ? "Every day" : `Every ${joinWords(days.map(d => WEEKDAYS[d]))}`;
  }
  return times ? `${when} · ${times}` : when;
}

export function dayLabel(dateKey, todayKey) {
  if (dateKey === todayKey) return "Today";
  if (dateKey === addDays(todayKey, 1)) return "Tomorrow";
  return formatDate(dateKey);
}

// All occurrences between fromKey and fromKey + days - 1 (inclusive), sorted by date then time.
export function occurrences(events, { from, days = 7 }) {
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const dateKey = addDays(from, i);
    const weekday = weekdayOf(dateKey);
    for (const event of events || []) {
      const matches = event.schedule === "one-off"
        ? event.event_date === dateKey
        : (event.weekdays || []).includes(weekday);
      if (matches) out.push({ event, dateKey, startMinutes: timeToMinutes(event.start_time) });
    }
  }
  return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey)
    || (a.startMinutes ?? 24 * 60) - (b.startMinutes ?? 24 * 60)
    || a.event.title.localeCompare(b.event.title));
}

function hasEnded(occurrence, now) {
  if (occurrence.dateKey !== now.dateKey || occurrence.startMinutes == null) return false;
  const end = timeToMinutes(occurrence.event.end_time);
  const finish = end != null && end > occurrence.startMinutes ? end : occurrence.startMinutes + DEFAULT_LENGTH_MINUTES;
  return finish <= now.minutes;
}

export const WHEN_OPTIONS = [
  { key: "tonight", label: "Tonight" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "weekend", label: "Weekend" },
  { key: "week", label: "7 days" }
];

export function whenRange(when, now) {
  const today = now.dateKey;
  if (when === "tonight") return { from: today, days: 1 };
  if (when === "tomorrow") return { from: addDays(today, 1), days: 1 };
  if (when === "weekend") {
    // Fri-Sun. From Friday onwards, "this weekend" starts today.
    const wd = now.weekday;
    if (wd === 0) return { from: today, days: 1 };
    if (wd >= 5) return { from: today, days: 7 - wd + 1 };
    return { from: addDays(today, 5 - wd), days: 3 };
  }
  return { from: today, days: 7 };
}

// Main entry: upcoming occurrences for a "when" option, optionally filtered by categories/pubs.
export function upcoming(events, { when = "week", categories = [], pubIds = null, now = londonNow() } = {}) {
  const range = whenRange(when, now);
  const wanted = new Set(categories);
  return occurrences(events, range).filter(o =>
    (!wanted.size || wanted.has(o.event.category))
    && (!pubIds || pubIds.has(o.event.pub_id))
    && !hasEnded(o, now)
  );
}

export function groupByDay(list, todayKey) {
  const groups = [];
  for (const item of list) {
    const last = groups[groups.length - 1];
    if (last && last.dateKey === item.dateKey) last.items.push(item);
    else groups.push({ dateKey: item.dateKey, label: dayLabel(item.dateKey, todayKey), items: [item] });
  }
  return groups;
}

// Pubs that have ALL the selected feature tags.
export function pubsWithFeatures(pubs, tags = []) {
  if (!tags.length) return [];
  return (pubs || []).filter(pub => tags.every(tag => (pub.tags || []).includes(tag)))
    .sort((a, b) => a.name.localeCompare(b.name));
}
