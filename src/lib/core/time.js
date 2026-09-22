// "just now", "5 min ago", "3 hours ago", "2 days ago", then a date.
export function timeAgo(value, now = Date.now()) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "unknown";
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Prices older than this get a "may be out of date" hint.
export const STALE_AFTER_DAYS = 90;
export function isStale(value, now = Date.now()) {
  const time = new Date(value).getTime();
  return !Number.isFinite(time) || now - time > STALE_AFTER_DAYS * 86400000;
}
