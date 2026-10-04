import { describe, expect, it } from "vitest";
import { validateDeal } from "../../src/lib/core/deals.js";
import { validateEvent } from "../../src/lib/core/events.js";

describe("validateDeal", () => {
  const ok = { title: "Happy hour", days: [1, 2], start_time: "16:00", end_time: "19:00", kind: "price", deal_price: "5.00", source_url: "" };
  it("accepts a valid deal", () => expect(validateDeal(ok)).toEqual({}));
  it("flags each problem on its own field", () => {
    const errors = validateDeal({ ...ok, title: "Hi", days: [], end_time: "16:00", deal_price: "50", source_url: "pub.com" });
    expect(Object.keys(errors).sort()).toEqual(["days", "deal_price", "end_time", "source_url", "title"]);
  });
  it("checks the percentage for % off deals", () => {
    expect(validateDeal({ ...ok, kind: "pct", discount_pct: "80" }).discount_pct).toBeTruthy();
    expect(validateDeal({ ...ok, kind: "pct", discount_pct: "20" })).toEqual({});
  });
});

describe("validateEvent", () => {
  const ok = { title: "Quiz night", schedule: "weekly", weekdays: [3], start_time: "19:30", end_time: "22:00", source_url: "https://pub.example/quiz" };
  it("accepts a valid event", () => expect(validateEvent(ok)).toEqual({}));
  it("needs a day for weekly events and a date for one-offs", () => {
    expect(validateEvent({ ...ok, weekdays: [] }).weekdays).toBeTruthy();
    expect(validateEvent({ ...ok, schedule: "one-off", event_date: "" }).event_date).toBeTruthy();
    expect(validateEvent({ ...ok, schedule: "one-off", event_date: "2026-10-10" })).toEqual({});
  });
  it("rejects matching start and end times and bad links", () => {
    expect(Object.keys(validateEvent({ ...ok, end_time: "19:30", source_url: "www.pub" })).sort()).toEqual(["end_time", "source_url"]);
  });
});
