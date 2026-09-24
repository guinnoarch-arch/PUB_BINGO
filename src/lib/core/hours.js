// Opening hours: { "0": [["12:00", "22:30"]], ... } with 0 = Sunday. A closing time at or before the
// opening time means after midnight (e.g. ["18:00", "01:00"]).
import { formatTime, londonNow, timeToMinutes } from "./events.js";

const rangesFor = (hours, weekday) => (hours && hours[String(weekday)]) || [];

// true / false, or null when the pub's hours aren't known.
export function isOpenAt(hours, now = londonNow()) {
  if (!hours || !Object.keys(hours).length) return null;
  for (const [open, close] of rangesFor(hours, now.weekday)) {
    const o = timeToMinutes(open);
    const c = timeToMinutes(close);
    if (c > o ? now.minutes >= o && now.minutes < c : now.minutes >= o) return true;
  }
  for (const [open, close] of rangesFor(hours, (now.weekday + 6) % 7)) {
    const o = timeToMinutes(open);
    const c = timeToMinutes(close);
    if (c <= o && now.minutes < c) return true;
  }
  return false;
}

export function todayHoursText(hours, now = londonNow()) {
  if (!hours || !Object.keys(hours).length) return null;
  const ranges = rangesFor(hours, now.weekday);
  if (!ranges.length) return "Closed today";
  return ranges.map(([o, c]) => `${formatTime(o)}–${formatTime(c)}`).join(", ");
}

// "Open now · until 11pm" / "Closed · opens 12pm"
export function openStatus(hours, now = londonNow()) {
  const open = isOpenAt(hours, now);
  if (open == null) return null;
  if (open) {
    const ranges = [...rangesFor(hours, now.weekday), ...rangesFor(hours, (now.weekday + 6) % 7).filter(([o, c]) => timeToMinutes(c) <= timeToMinutes(o))];
    const current = ranges.find(([o, c]) => {
      const om = timeToMinutes(o); const cm = timeToMinutes(c);
      return cm > om ? now.minutes >= om && now.minutes < cm : now.minutes >= om || now.minutes < cm;
    });
    return { open: true, text: current ? `Open now · until ${formatTime(current[1])}` : "Open now" };
  }
  const later = rangesFor(hours, now.weekday).find(([o]) => timeToMinutes(o) > now.minutes);
  return { open: false, text: later ? `Closed · opens ${formatTime(later[0])}` : "Closed now" };
}
