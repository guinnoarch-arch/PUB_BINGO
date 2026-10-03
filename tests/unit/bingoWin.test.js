import { describe, expect, it } from "vitest";
import { BINGO_TILES, buildCardState, completedLines, evaluateAutoTiles, isFullHouse } from "../../src/lib/core/bingo.js";
import { WEEKLY_POOL, weeklyCard, weeklyCardState, weeklyStreak } from "../../src/lib/core/weeklyBingo.js";
import { addDays } from "../../src/lib/core/events.js";

// Builds a card where the tiles at these indexes are done.
const cardWith = indexes => Array.from({ length: 9 }, (_, i) => ({ done: indexes.includes(i) }));

// An independent definition of "has a line", from row/column coordinates rather than the LINES table.
function hasLineByCoordinates(done) {
  const at = (row, col) => done[row * 3 + col];
  for (let i = 0; i < 3; i += 1) {
    if (at(i, 0) && at(i, 1) && at(i, 2)) return true;
    if (at(0, i) && at(1, i) && at(2, i)) return true;
  }
  return (at(0, 0) && at(1, 1) && at(2, 2)) || (at(0, 2) && at(1, 1) && at(2, 0));
}

describe("bingo win detection", () => {
  it.each([
    ["top row", [0, 1, 2]], ["middle row", [3, 4, 5]], ["bottom row", [6, 7, 8]],
    ["left column", [0, 3, 6]], ["middle column", [1, 4, 7]], ["right column", [2, 5, 8]],
    ["diagonal", [0, 4, 8]], ["anti-diagonal", [2, 4, 6]]
  ])("detects the %s", (_, line) => {
    expect(completedLines(cardWith(line))).toEqual([line]);
  });

  it("matches the coordinate definition for every one of the 512 possible cards", () => {
    for (let mask = 0; mask < 512; mask += 1) {
      const indexes = Array.from({ length: 9 }, (_, i) => i).filter(i => mask & (1 << i));
      const card = cardWith(indexes);
      expect(completedLines(card).length > 0).toBe(hasLineByCoordinates(card.map(t => t.done)));
    }
  });

  it.each([
    ["an L shape", [3, 6, 7]],
    ["the four corners", [0, 2, 6, 8]],
    ["a row that wraps round", [2, 3, 4]],
    ["a broken diagonal", [0, 4, 7]],
    ["six tiles with no line", [0, 1, 3, 5, 7, 8]]
  ])("does not call %s a line", (_, indexes) => {
    expect(completedLines(cardWith(indexes))).toEqual([]);
  });

  it("only counts a full house when every tile is done", () => {
    expect(isFullHouse(cardWith([0, 1, 2, 3, 4, 5, 6, 7, 8]))).toBe(true);
    expect(isFullHouse(cardWith([0, 1, 2, 3, 4, 5, 6, 7]))).toBe(false);
    expect(isFullHouse([])).toBe(false);
  });

  it("ignores tiles beyond the 3×3 grid and missing tiles", () => {
    expect(completedLines([{ done: true }, { done: true }])).toEqual([]);
  });
});

describe("bingo cards have no duplicates", () => {
  it("the classic card has 9 different tiles", () => {
    expect(new Set(BINGO_TILES.map(t => t.id)).size).toBe(9);
    expect(new Set(BINGO_TILES.map(t => t.title)).size).toBe(9);
  });

  it("every weekly card for four years has 9 different tiles", () => {
    expect(new Set(WEEKLY_POOL.map(t => t.id)).size).toBe(WEEKLY_POOL.length);
    let start = "2026-01-05";
    for (let week = 0; week < 208; week += 1) {
      const card = weeklyCard(start);
      expect(card).toHaveLength(9);
      expect(new Set(card.map(t => t.baseId)).size).toBe(9);
      start = addDays(start, 7);
    }
  });
});

describe("classic card auto tiles", () => {
  it("doesn't count “Still right?” confirmations as price reports", () => {
    const confirms = Array.from({ length: 5 }, () => ({ kind: "confirm", price: 5 }));
    expect(evaluateAutoTiles({ reports: confirms })).toMatchObject({ "first-report": false, "five-reports": false, "cheap-report": false });
    expect(evaluateAutoTiles({ reports: [...confirms, { kind: "report", price: 5 }] })).toMatchObject({ "first-report": true, "five-reports": false, "cheap-report": true });
  });

  it("keeps an auto tile done once it's saved, even if the activity changes", () => {
    const card = buildCardState([{ tile_id: "first-report", completed_at: "2026-09-01" }], {});
    expect(card.find(t => t.id === "first-report")).toMatchObject({ done: true, needsSaving: false });
  });
});

describe("weekly streak", () => {
  const now = { dateKey: "2026-09-24", weekday: 4, minutes: 720 };

  it("counts a week whose line came from auto tiles that were never saved", () => {
    const start = "2026-09-21";
    const card = weeklyCard(start);
    // Tick the self tiles and earn every auto tile from activity that week, without saving anything.
    const progress = card.filter(t => t.mode === "self").map(t => ({ tile_id: t.id }));
    const activity = {
      reports: [
        { kind: "report", category: "Stout", pub_id: "a", price: 5, reported_at: "2026-09-22T19:00:00Z" },
        { kind: "report", category: "Cider", pub_id: "b", price: 5, reported_at: "2026-09-22T19:05:00Z" },
        { kind: "report", category: "Real Ale", pub_id: "a", price: 5, reported_at: "2026-09-22T19:10:00Z" },
        ...Array.from({ length: 3 }, (_, i) => ({ kind: "confirm", pub_id: "a", reported_at: `2026-09-22T20:0${i}:00Z` }))
      ],
      checkins: [{ pub_id: "a", created_at: "2026-09-22T19:00:00Z" }, { pub_id: "b", created_at: "2026-09-22T19:00:00Z" }],
      pourRatings: [{ created_at: "2026-09-22T19:00:00Z" }],
      menus: [{ created_at: "2026-09-22T19:00:00Z" }]
    };
    const pubsById = { a: { area: "Soho", opened_year: 1700 }, b: { area: "Holborn", opened_year: 1900 } };
    expect(completedLines(weeklyCardState(start, progress, activity, pubsById)).length).toBeGreaterThan(0);
    expect(weeklyStreak(progress, now, activity, pubsById)).toBe(1);
    expect(weeklyStreak([], now, {}, pubsById)).toBe(0);
  });
});
