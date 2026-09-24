import { describe, expect, it } from "vitest";
import { applyDeals, dealIsActive, describeDeal } from "../../src/lib/core/deals.js";
import { isOpenAt, openStatus, todayHoursText } from "../../src/lib/core/hours.js";
import { cheapestCrawl, orderRoute, routeDistance } from "../../src/lib/core/crawl.js";
import { priceRound } from "../../src/lib/core/round.js";
import { needsChecking } from "../../src/lib/core/checking.js";
import { watchMatches } from "../../src/lib/core/watches.js";
import { computeBadges } from "../../src/lib/core/badges.js";
import { weekStart, weeklyCard, weeklyCardState, weeklyStreak } from "../../src/lib/core/weeklyBingo.js";
import { cheapestPints, isRealPrice } from "../../src/lib/core/search.js";

const at = (weekday, hh, mm = 0, dateKey = "2026-09-24") => ({ dateKey, weekday, minutes: hh * 60 + mm });
const drink = (id, name, category, price, extra = {}) => ({ id, name, category, measure: "pint", current_price: price, source: "community", last_updated_at: "2026-09-20T12:00:00Z", ...extra });
const pubs = [
  { id: "a", name: "A", area: "Soho", lat: 51.5136, lng: -0.1318, drinks: [drink("a1", "Guinness", "Stout", 6.5), drink("a2", "Camden Hells", "Lager", 6.9)] },
  { id: "b", name: "B", area: "Holborn", lat: 51.5176, lng: -0.1190, drinks: [drink("b1", "Guinness", "Stout", 5.9), drink("b2", "Estimate Lager", "Lager", 5.0, { source: "seed" })] },
  { id: "c", name: "C", area: "Soho", lat: 51.5140, lng: -0.1300, drinks: [drink("c1", "London Pride", "Real Ale", 6.1)] }
];

describe("happy hours", () => {
  const deal = { id: "d", pub_id: "a", title: "£5 pints", days: [1, 2, 3, 4, 5], start_time: "16:00", end_time: "19:00", deal_price: 5, discount_pct: null };
  it("knows when a deal is on, in London time", () => {
    expect(dealIsActive(deal, at(4, 17))).toBe(true);
    expect(dealIsActive(deal, at(4, 19))).toBe(false);
    expect(dealIsActive(deal, at(6, 17))).toBe(false);
  });
  it("handles deals that run past midnight", () => {
    const late = { ...deal, days: [5], start_time: "22:00", end_time: "01:00" };
    expect(dealIsActive(late, at(5, 23))).toBe(true);
    expect(dealIsActive(late, at(6, 0, 30))).toBe(true);
    expect(dealIsActive(late, at(6, 1, 30))).toBe(false);
  });
  it("shows the deal price during the deal, never a higher one", () => {
    const now = applyDeals(pubs, [deal], at(4, 17));
    const guinness = now[0].drinks[0];
    expect(guinness).toMatchObject({ current_price: 5, regular_price: 6.5, deal: { title: "£5 pints", until: "7pm", fixed: true } });
    expect(applyDeals(pubs, [deal], at(4, 20))[0].drinks[0].current_price).toBe(6.5);
    const pricey = applyDeals(pubs, [{ ...deal, pub_id: "b", deal_price: 7 }], at(4, 17));
    expect(pricey[1].drinks[0].current_price).toBe(5.9);
  });
  it("applies a discount to one category, and a fixed deal price counts as real", () => {
    const off = { ...deal, pub_id: "b", deal_price: null, discount_pct: 20, category: "Lager" };
    const result = applyDeals(pubs, [off], at(4, 17))[1];
    expect(result.drinks[1].current_price).toBe(4);
    expect(result.drinks[0].current_price).toBe(5.9);
    expect(isRealPrice(result.drinks[1])).toBe(false);
    const fixed = applyDeals(pubs, [{ ...deal, pub_id: "b", category: "Lager", deal_price: 4.5 }], at(4, 17))[1];
    expect(isRealPrice(fixed.drinks[1])).toBe(true);
    expect(cheapestPints(applyDeals(pubs, [deal], at(4, 17)), { realOnly: true })[0].drink.name).toBe("Guinness");
  });
  it("describes a deal", () => {
    expect(describeDeal(deal)).toEqual({ what: "£5.00", when: "Every Mon, Tue, Wed, Thu & Fri · 4pm–7pm" });
  });
});

describe("opening hours", () => {
  const hours = { 4: [["12:00", "23:00"]], 5: [["12:00", "01:00"]], 0: [] };
  it("works out open now, including after midnight", () => {
    expect(isOpenAt(hours, at(4, 13))).toBe(true);
    expect(isOpenAt(hours, at(4, 23, 30))).toBe(false);
    expect(isOpenAt(hours, at(6, 0, 30))).toBe(true);
    expect(isOpenAt(hours, at(0, 13))).toBe(false);
    expect(isOpenAt(null, at(4, 13))).toBeNull();
  });
  it("shows today's hours and status", () => {
    expect(todayHoursText(hours, at(4, 9))).toBe("12pm–11pm");
    expect(todayHoursText(hours, at(0, 9))).toBe("Closed today");
    expect(openStatus(hours, at(4, 9))).toEqual({ open: false, text: "Closed · opens 12pm" });
    expect(openStatus(hours, at(4, 13))).toEqual({ open: true, text: "Open now · until 11pm" });
  });
});

describe("crawl planner", () => {
  const stops = [
    { id: "w", lat: 51.5, lng: -0.14 }, { id: "e", lat: 51.5, lng: -0.10 },
    { id: "m", lat: 51.5, lng: -0.12 }, { id: "m2", lat: 51.5, lng: -0.13 }
  ];
  it("walks in a sensible order", () => {
    const route = orderRoute(stops);
    const ids = route.map(s => s.id).join(",");
    expect(["w,m2,m,e", "e,m,m2,w"]).toContain(ids);
    expect(routeDistance(route)).toBeLessThan(routeDistance(stops));
  });
  it("starts from the chosen point", () => {
    expect(orderRoute(stops, { lat: 51.5, lng: -0.095 })[0].id).toBe("e");
  });
  it("picks the cheapest pubs for a cheapest crawl", () => {
    const route = cheapestCrawl(pubs, { count: 2 });
    expect(route.map(p => p.id).sort()).toEqual(["b", "c"]);
    expect(cheapestCrawl(pubs, { count: 3, query: "Guinness" }).map(p => p.id).sort()).toEqual(["a", "b"]);
  });
});

describe("round calculator", () => {
  it("totals the round at each pub, complete rounds first", () => {
    const rows = priceRound(pubs, [{ query: "Guinness", qty: 2 }, { query: "any lager", qty: 1 }]);
    expect(rows[0]).toMatchObject({ pub: { id: "a" }, complete: true, total: 19.9 });
    expect(rows.find(r => r.pub.id === "b")).toMatchObject({ complete: false, missing: ["any lager"], total: 11.8 });
    const withEstimates = priceRound(pubs, [{ query: "Guinness", qty: 2 }, { query: "lager", qty: 1 }], { includeEstimates: true });
    expect(withEstimates[0]).toMatchObject({ pub: { id: "b" }, total: 16.8, hasEstimates: true });
  });
});

describe("needs checking", () => {
  it("lists stale real prices first, then estimates", () => {
    const now = Date.parse("2026-12-01T12:00:00Z");
    const rows = needsChecking(pubs, { now });
    expect(rows[0].estimate).toBe(false);
    expect(rows[rows.length - 1]).toMatchObject({ estimate: true, drink: { id: "b2" } });
    expect(needsChecking(pubs, { now: Date.parse("2026-09-25T12:00:00Z") }).map(r => r.drink.id)).toEqual(["b2"]);
  });
});

describe("price watches", () => {
  it("matches confirmed pints under the price, optionally by area", () => {
    expect(watchMatches(pubs, { query: "Guinness", max_price: 6 }).map(r => r.pub.id)).toEqual(["b"]);
    expect(watchMatches(pubs, { query: "Guinness", max_price: 7, area: "Soho" }).map(r => r.pub.id)).toEqual(["a"]);
    expect(watchMatches(pubs, { query: "lager", max_price: 6 })).toEqual([]);
  });
});

describe("badges", () => {
  it("earns badges from activity", () => {
    const byId = Object.fromEntries(pubs.map(p => [p.id, p]));
    const reports = Array.from({ length: 5 }, () => ({ kind: "report", category: "Stout", pub_id: "a" }));
    const badges = computeBadges({ reports: [...reports, { kind: "confirm", pub_id: "a" }], checkins: [{ pub_id: "b" }], menusUsed: 1 }, byId);
    const got = Object.fromEntries(badges.map(b => [b.id, b.earned]));
    expect(got).toMatchObject({ "first-round": true, regular: false, stout: true, soho: true, holborn: false, "menu-hunter": true, checker: false });
    expect(badges.find(b => b.id === "regular").value).toBe(5);
  });
});

describe("weekly bingo", () => {
  it("starts weeks on Monday in London", () => {
    expect(weekStart(at(4, 12, 0, "2026-09-24"))).toBe("2026-09-21");
    expect(weekStart(at(0, 12, 0, "2026-09-27"))).toBe("2026-09-21");
    expect(weekStart(at(1, 0, 5, "2026-09-28"))).toBe("2026-09-28");
  });
  it("gives everyone the same card each week, with 5 auto and 4 self tiles", () => {
    const card = weeklyCard("2026-09-21");
    expect(card).toHaveLength(9);
    expect(card.filter(t => t.mode === "auto")).toHaveLength(5);
    expect(weeklyCard("2026-09-21").map(t => t.id)).toEqual(card.map(t => t.id));
    expect(weeklyCard("2026-09-28").map(t => t.baseId)).not.toEqual(card.map(t => t.baseId));
    expect(card.every(t => /^[a-z0-9-]{1,40}$/.test(t.id))).toBe(true);
  });
  it("completes auto tiles from this week's activity only", () => {
    const card = weeklyCardState("2026-09-21", [], {
      reports: [{ kind: "report", category: "Stout", pub_id: "a", price: 5.5, reported_at: "2026-09-22T19:00:00Z" },
        { kind: "report", category: "Cider", pub_id: "a", price: 5, reported_at: "2026-09-10T19:00:00Z" }]
    }, {});
    const byBase = Object.fromEntries(card.map(t => [t.baseId, t.done]));
    if ("report" in byBase) expect(byBase.report).toBe(true);
    if ("stout" in byBase) expect(byBase.stout).toBe(true);
    if ("cider" in byBase) expect(byBase.cider).toBe(false);
  });
  it("counts a streak of weeks with a line", () => {
    const rows = [];
    for (const start of ["2026-09-07", "2026-09-14"]) {
      weeklyCard(start).slice(0, 3).forEach(t => rows.push({ tile_id: t.id }));
    }
    expect(weeklyStreak(rows, at(4, 12, 0, "2026-09-24"))).toBe(2);
    expect(weeklyStreak(rows, at(4, 12, 0, "2026-10-01"))).toBe(0);
  });
});
