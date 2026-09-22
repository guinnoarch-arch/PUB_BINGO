import { describe, expect, it } from "vitest";
import { BINGO_TILES, buildCardState, completedLines, evaluateAutoTiles } from "../../src/lib/core/bingo.js";
import { isStale, timeAgo } from "../../src/lib/core/time.js";
import { SEED_PUBS } from "../../src/data/seedPubs.js";

const pubsById = Object.fromEntries(SEED_PUBS.map(p => [p.id, p]));

describe("bingo", () => {
  it("has a 3×3 card with unique tile ids", () => {
    expect(BINGO_TILES).toHaveLength(9);
    expect(new Set(BINGO_TILES.map(t => t.id)).size).toBe(9);
    BINGO_TILES.forEach(t => expect(t.id).toMatch(/^[a-z0-9-]{1,40}$/));
  });

  it("auto-completes tiles from activity", () => {
    expect(evaluateAutoTiles({})).toEqual({ "first-report": false, "two-areas": false, "cheap-report": false, photo: false, "five-reports": false });
    const result = evaluateAutoTiles({
      reports: [{ price: 7 }, { price: 3.2, measure: "half" }, { price: 6.9 }, { price: 7 }, { price: 6.6 }],
      favouritePubIds: ["the-harp", "lamb-and-flag", "the-toucan"],
      photoCount: 1,
      pubsById
    });
    expect(result).toEqual({ "first-report": true, "two-areas": true, "cheap-report": true, photo: true, "five-reports": true });
  });

  it("does not count two favourites in the same area", () => {
    expect(evaluateAutoTiles({ favouritePubIds: ["the-harp", "lamb-and-flag"], pubsById })["two-areas"]).toBe(false);
  });

  it("does not count a half as a cheap pint", () => {
    expect(evaluateAutoTiles({ reports: [{ price: 3.5, measure: "half" }] })["cheap-report"]).toBe(false);
  });

  it("merges saved progress with live auto results and flags new auto wins for saving", () => {
    const state = buildCardState([{ tile_id: "try-stout", completed_at: "2026-09-01" }, { tile_id: "two-areas", completed_at: "2026-09-02" }], { "first-report": true });
    const byId = Object.fromEntries(state.map(t => [t.id, t]));
    expect(byId["try-stout"]).toMatchObject({ done: true, needsSaving: false });
    expect(byId["two-areas"]).toMatchObject({ done: true, needsSaving: false });
    expect(byId["first-report"]).toMatchObject({ done: true, needsSaving: true });
    expect(byId["cheap-pint"].done).toBe(false);
  });

  it("finds completed lines", () => {
    const state = BINGO_TILES.map((t, i) => ({ ...t, done: [0, 4, 8, 1].includes(i) }));
    expect(completedLines(state)).toEqual([[0, 4, 8]]);
    expect(completedLines(BINGO_TILES.map(t => ({ ...t, done: true })))).toHaveLength(8);
  });
});

describe("time", () => {
  const now = new Date("2026-09-22T12:00:00Z").getTime();
  it.each([
    ["2026-09-22T11:59:40Z", "just now"],
    ["2026-09-22T11:55:00Z", "5 min ago"],
    ["2026-09-22T11:00:00Z", "1 hour ago"],
    ["2026-09-22T09:00:00Z", "3 hours ago"],
    ["2026-09-19T12:00:00Z", "3 days ago"],
    ["2026-01-05T12:00:00Z", "5 Jan 2026"],
    ["nonsense", "unknown"]
  ])("timeAgo(%s) = %s", (value, expected) => expect(timeAgo(value, now)).toBe(expected));

  it("flags prices older than 90 days as stale", () => {
    expect(isStale("2026-09-01T00:00:00Z", now)).toBe(false);
    expect(isStale("2026-05-01T00:00:00Z", now)).toBe(true);
  });
});
