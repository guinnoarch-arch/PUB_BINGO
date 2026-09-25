import { describe, expect, it } from "vitest";
import {
  addDays, dayLabel, formatSchedule, formatTime, groupByDay, londonNow, occurrences, pubsWithFeatures, upcoming, weekdayOf, whenRange
} from "../../src/lib/core/events.js";

const ev = (over) => ({ id: over.title, pub_id: "p", category: "live-music", schedule: "weekly", weekdays: [], start_time: null, end_time: null, ...over });
const events = [
  ev({ title: "Sing-along", category: "sing-along", weekdays: [3, 6], start_time: "19:00:00" }),
  ev({ title: "Comedy", category: "comedy", weekdays: [1, 3], start_time: "19:30" }),
  ev({ title: "Trad session", weekdays: [0] }),
  ev({ title: "Quiz", category: "quiz", weekdays: [3], start_time: "20:00", end_time: "22:00" }),
  ev({ title: "England v France", category: "sports", schedule: "one-off", event_date: "2026-09-26", start_time: "15:00", pub_id: "q" })
];

describe("London time", () => {
  it("uses London time, not the device's", () => {
    // 23:30 UTC on 23 Sep = 00:30 on 24 Sep in London (BST)
    expect(londonNow(new Date("2026-09-23T23:30:00Z"))).toEqual({ dateKey: "2026-09-24", weekday: 4, minutes: 30 });
    // Winter: GMT = UTC
    expect(londonNow(new Date("2026-12-01T18:05:00Z"))).toEqual({ dateKey: "2026-12-01", weekday: 2, minutes: 1085 });
  });

  it("does date maths across months", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(weekdayOf("2026-09-23")).toBe(3);
  });
});

describe("formatting", () => {
  it("formats times and schedules", () => {
    expect(formatTime("19:30:00")).toBe("7:30pm");
    expect(formatTime("20:00")).toBe("8pm");
    expect(formatTime("00:15")).toBe("12:15am");
    expect(formatTime(null)).toBe("");
    expect(formatSchedule(events[0])).toBe("Every Wed & Sat · from 7pm");
    expect(formatSchedule(ev({ title: "x", weekdays: [0, 4, 5, 6] }))).toBe("Every Thu, Fri, Sat & Sun");
    expect(formatSchedule(ev({ title: "x", weekdays: [0, 1, 2, 3, 4, 5, 6] }))).toBe("Every day");
    expect(formatSchedule(events[3])).toBe("Every Wed · 8pm–10pm");
    expect(formatSchedule(events[4])).toBe("Sat 26 Sep · from 3pm");
  });

  it("labels days", () => {
    expect(dayLabel("2026-09-23", "2026-09-23")).toBe("Today");
    expect(dayLabel("2026-09-24", "2026-09-23")).toBe("Tomorrow");
    expect(dayLabel("2026-09-26", "2026-09-23")).toBe("Sat 26 Sep");
  });
});

describe("occurrences / upcoming", () => {
  it("expands weekly and one-off events, sorted by date then time (untimed last)", () => {
    const list = occurrences(events, { from: "2026-09-23", days: 7 }); // Wed 23 .. Tue 29
    expect(list.map(o => `${o.dateKey} ${o.event.title}`)).toEqual([
      "2026-09-23 Sing-along", "2026-09-23 Comedy", "2026-09-23 Quiz",
      "2026-09-26 England v France", "2026-09-26 Sing-along",
      "2026-09-27 Trad session",
      "2026-09-28 Comedy"
    ]);
  });

  it("tonight drops events that have already finished", () => {
    const now = { dateKey: "2026-09-23", weekday: 3, minutes: 22 * 60 + 15 }; // Wed 10:15pm
    // 7pm sing-along (assumed 3h) and the 8-10pm quiz are over; 7:30pm comedy runs to 10:30pm
    expect(upcoming(events, { when: "tonight", now }).map(o => o.event.title)).toEqual(["Comedy"]);
    const early = { ...now, minutes: 17 * 60 };
    expect(upcoming(events, { when: "tonight", now: early })).toHaveLength(3);
  });

  it("filters by category and pub", () => {
    const now = { dateKey: "2026-09-23", weekday: 3, minutes: 600 };
    expect(upcoming(events, { when: "week", categories: ["sports"], now }).map(o => o.event.title)).toEqual(["England v France"]);
    expect(upcoming(events, { when: "week", pubIds: new Set(["q"]), now })).toHaveLength(1);
  });

  it("works out 'this weekend'", () => {
    expect(whenRange("weekend", { dateKey: "2026-09-23", weekday: 3 })).toEqual({ from: "2026-09-25", days: 3 });
    expect(whenRange("weekend", { dateKey: "2026-09-26", weekday: 6 })).toEqual({ from: "2026-09-26", days: 2 });
    expect(whenRange("weekend", { dateKey: "2026-09-27", weekday: 0 })).toEqual({ from: "2026-09-27", days: 1 });
    expect(whenRange("tomorrow", { dateKey: "2026-09-23", weekday: 3 })).toEqual({ from: "2026-09-24", days: 1 });
    const weekend = upcoming(events, { when: "weekend", now: { dateKey: "2026-09-23", weekday: 3, minutes: 0 } });
    expect(weekend.map(o => o.event.title)).toEqual(["England v France", "Sing-along", "Trad session"]);
  });

  it("groups by day", () => {
    const groups = groupByDay(occurrences(events, { from: "2026-09-23", days: 2 }), "2026-09-23");
    expect(groups.map(g => [g.label, g.items.length])).toEqual([["Today", 3]]);
  });
});

describe("pubsWithFeatures", () => {
  const pubs = [
    { id: "a", name: "B pub", tags: ["beer-garden", "sports-tv"] },
    { id: "b", name: "A pub", tags: ["beer-garden"] },
    { id: "c", name: "C pub" }
  ];
  it("needs every selected feature", () => {
    expect(pubsWithFeatures(pubs, ["beer-garden"]).map(p => p.name)).toEqual(["A pub", "B pub"]);
    expect(pubsWithFeatures(pubs, ["beer-garden", "sports-tv"]).map(p => p.id)).toEqual(["a"]);
    expect(pubsWithFeatures(pubs, [])).toEqual([]);
  });
});

describe("researched seed data", async () => {
  const { SEED_EVENTS } = await import("../../src/data/seedEvents.js");
  const { SEED_PUBS } = await import("../../src/data/seedPubs.js");
  const { PUB_RESEARCH, RESEARCH_UPDATE_MARKER } = await import("../../src/data/pubResearch.js");
  const { EVENT_CATEGORIES } = await import("../../src/data/features.js");
  const pubIds = new Set(SEED_PUBS.map(p => p.id));

  it("has valid events: known pub and category, days or a date, unique titles per pub", () => {
    const keys = new Set();
    for (const e of SEED_EVENTS) {
      expect(pubIds.has(e.pub_id)).toBe(true);
      expect(EVENT_CATEGORIES.some(c => c.key === e.category)).toBe(true);
      if (e.schedule === "one-off") expect(e.event_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      else expect(e.weekdays.length).toBeGreaterThan(0);
      expect(keys.has(`${e.pub_id}|${e.title}`)).toBe(false);
      keys.add(`${e.pub_id}|${e.title}`);
    }
  });

  it("has well-formed menu links and research updates", () => {
    for (const [id, r] of Object.entries(PUB_RESEARCH)) {
      expect(pubIds.has(id)).toBe(true);
      for (const url of [r.website, r.drinks_menu_url, r.food_menu_url].filter(Boolean)) expect(url).toMatch(/^https?:\/\/\S+$/);
      if (r.update) expect(r.update.startsWith(RESEARCH_UPDATE_MARKER)).toBe(true);
    }
  });
});
