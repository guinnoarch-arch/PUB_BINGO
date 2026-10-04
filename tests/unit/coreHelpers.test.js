import { describe, expect, it } from "vitest";
import { crawlSummary } from "../../src/lib/core/crawl.js";
import { sortDrinksForMenu } from "../../src/lib/core/search.js";
import { filterPubs } from "../../src/lib/core/pubFilters.js";
import { reporterPoints } from "../../src/lib/core/badges.js";

describe("sortDrinksForMenu", () => {
  const drinks = [
    { name: "Cider B", category: "Cider", measure: "pint", current_price: 6 },
    { name: "Lager bottle", category: "Lager", measure: "bottle", current_price: 4 },
    { name: "Lager Z", category: "Lager", measure: "pint", current_price: 6.5 },
    { name: "Lager A", category: "Lager", measure: "pint", current_price: 5.5 }
  ];
  const categories = ["Lager", "Cider"];
  it("puts draught before bottles, cheapest first, within each category", () => {
    expect(sortDrinksForMenu(drinks, { categories }).map(d => d.name)).toEqual(["Lager A", "Lager Z", "Lager bottle", "Cider B"]);
  });
  it("can sort by name for the admin table", () => {
    expect(sortDrinksForMenu(drinks, { by: "name", categories }).map(d => d.name)).toEqual(["Lager A", "Lager bottle", "Lager Z", "Cider B"]);
  });
  it("copes with no drinks and doesn't change the original", () => {
    expect(sortDrinksForMenu(null)).toEqual([]);
    const copy = [...drinks];
    sortDrinksForMenu(drinks, { categories });
    expect(drinks).toEqual(copy);
  });
});

describe("crawlSummary", () => {
  const route = [{ id: "a", lat: 51.5, lng: -0.12 }, { id: "b", lat: 51.501, lng: -0.12 }];
  const best = new Map([["a", { pintPrice: 5 }]]);
  it("adds up walking, cost and unpriced stops", () => {
    const summary = crawlSummary(route, null, best);
    expect(summary.legs[0]).toBe(0);
    expect(summary.walk).toBeGreaterThan(100);
    expect(summary.walk).toBeLessThan(120);
    expect(summary.total).toBe(5);
    expect(summary.unpriced).toBe(1);
  });
});

describe("filterPubs", () => {
  const pubs = [{ id: "a", tags: ["beer-garden"] }, { id: "b", tags: [] }];
  it("returns everything with no filters", () => expect(filterPubs(pubs, new Set())).toBe(pubs));
  it("filters by outside seating and sport", () => {
    expect(filterPubs(pubs, new Set(["outside"])).map(p => p.id)).toEqual(["a"]);
    expect(filterPubs(pubs, new Set(["sport"]), { sportPubIds: new Set(["b"]) }).map(p => p.id)).toEqual(["b"]);
  });
});

describe("reporterPoints", () => {
  it("scores reports, checks and used menus", () => {
    expect(reporterPoints({ reports: 2, confirms: 1, menus_used: 1 })).toBe(6);
    expect(reporterPoints({})).toBe(0);
  });
});
