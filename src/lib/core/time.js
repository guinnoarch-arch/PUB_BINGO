// Dates and times, always shown in UK style and London time: "3 Oct 2026", "Sat 3 Oct 2026", "3 Oct".

export const DAY_MS = 86400000;
const LONDON = "Europe/London";

const toTime = value => {
  // A bare "2026-10-03" is a calendar date, so read it at midday to avoid slipping a day.
  const text = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
  return new Date(text).getTime();
};

// formatDay("2026-10-03") → "3 Oct 2026"; { weekday: true } → "Sat 3 Oct 2026"; { year: false } → "3 Oct".
export function formatDay(value, { weekday = false, year = true } = {}) {
  const time = toTime(value);
  if (!Number.isFinite(time)) return "unknown date";
  return new Date(time).toLocaleDateString("en-GB", {
    timeZone: LONDON, day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), ...(weekday ? { weekday: "short" } : {})
  }).replace(",", "");
}

// "3 Oct 2026, 19:40"
export function formatDateTime(value) {
  const time = toTime(value);
  if (!Number.isFinite(time)) return "unknown date";
  const clock = new Date(time).toLocaleTimeString("en-GB", { timeZone: LONDON, hour: "2-digit", minute: "2-digit" });
  return `${formatDay(time)}, ${clock}`;
}

// "just now", "5 min ago", "3 hours ago", "2 days ago", then a date.
export function timeAgo(value, now = Date.now()) {
  const time = toTime(value);
  if (!Number.isFinite(time)) return "unknown";
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDay(time);
}

// Prices older than this get a "may be out of date" hint.
const STALE_AFTER_DAYS = 90;
export function isStale(value, now = Date.now()) {
  const time = toTime(value);
  return !Number.isFinite(time) || now - time > STALE_AFTER_DAYS * DAY_MS;
}
