import { describe, expect, it } from "vitest";
import { cheapestPerPub, cheapestPints, drinkMatches, normaliseText, priceHistoryStats, searchDrinks, sortResults } from "../../src/lib/core/search.js";
import { distanceMetres, formatDistance, isInArea } from "../../src/lib/core/geo.js";
import { pub, seedPubsAsApi } from "./fixtures.js";

describe("normaliseText / drinkMatches", () => {
  it("ignores case, accents, punctuation and ampersands", () => {
    expect(normaliseText("  Brodie's CITRA ")).toBe("brodies citra");
    expect(normaliseText("Temple Bräu")).toBe("temple brau");
    expect(normaliseText("Lost & Grounded")).toBe("lost and grounded");
  });

  it("matches by name word prefixes", () => {
    const drink = { name: "Camden Hells", category: "Lager" };
    expect(drinkMatches(drink, "camden hells")).toBe(true);
    expect(drinkMatches(drink, "hell")).toBe(true);
    expect(drinkMatches(drink, "Cam")).toBe(true);
    expect(drinkMatches(drink, "amden")).toBe(false);
    expect(drinkMatches(drink, "guinness")).toBe(false);
  });

  it("matches by category keyword", () => {
    expect(drinkMatches({ name: "Cloudwater IPA", category: "IPA" }, "ipa")).toBe(true);
    expect(drinkMatches({ name: "Porterhouse Hop Head", category: "IPA" }, "IPA")).toBe(true);
    expect(drinkMatches({ name: "Guinness", category: "Stout" }, "stout")).toBe(true);
    expect(drinkMatches({ name: "Titanic Plum Porter", category: "Stout" }, "porter")).toBe(true);
    expect(drinkMatches({ name: "Guinness", category: "Stout" }, "cider")).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(drinkMatches({ name: "Anything", category: "Other" }, "   ")).toBe(true);
  });
});

describe("searchDrinks", () => {
  const pubs = seedPubsAsApi();

  it("finds every pub stocking Guinness, cheapest first", () => {
    const rows = searchDrinks(pubs, { query: "Guinness" });
    const stocking = pubs.filter(p => p.drinks.some(d => d.name === "Guinness")).length;
    expect(rows).toHaveLength(stocking);
    expect(rows.every(r => r.drink.name === "Guinness")).toBe(true);
    for (let i = 1; i < rows.length; i += 1) expect(rows[i].pintPrice).toBeGreaterThanOrEqual(rows[i - 1].pintPrice);
    expect(rows[0].pub.name).toBe("The Toucan");
  });

  it("sorts French House halves by pint-equivalent price", () => {
    const rows = searchDrinks(pubs, { query: "Guinness" });
    const french = rows.find(r => r.pub.id === "the-french-house");
    expect(french.price).toBe(3.9);
    expect(french.pintPrice).toBe(7.8);
    expect(rows.at(-1).pub.id).toBe("the-french-house");
  });

  it("returns an empty list for an unknown drink", () => {
    expect(searchDrinks(pubs, { query: "Buckfast" })).toEqual([]);
  });

  it("filters by category", () => {
    const rows = searchDrinks(pubs, { category: "Cider" });
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every(r => r.drink.category === "Cider")).toBe(true);
  });

  it("skips drinks with missing or invalid prices", () => {
    const rows = searchDrinks([pub("a", 51.51, -0.13, [{ name: "Beer", current_price: null }, { name: "Beer 2", current_price: "abc" }, { name: "Beer 3", current_price: 6 }])]);
    expect(rows.map(r => r.drink.name)).toEqual(["Beer 3"]);
  });

  it("copes with missing input", () => {
    expect(searchDrinks(undefined, {})).toEqual([]);
    expect(searchDrinks([{ id: "x", name: "x" }], { query: "a" })).toEqual([]);
  });

  it("sorts by real distance from a chosen point, falling back to price without one", () => {
    const near = pub("near", 51.5101, -0.1301, [{ name: "Guinness", current_price: 7.5 }]);
    const far = pub("far", 51.52, -0.14, [{ name: "Guinness", current_price: 5.5 }]);
    const origin = { lat: 51.51, lng: -0.13 };
    expect(searchDrinks([far, near], { query: "guinness", origin, sortBy: "distance" }).map(r => r.pub.id)).toEqual(["near", "far"]);
    expect(searchDrinks([far, near], { query: "guinness", origin, sortBy: "price" }).map(r => r.pub.id)).toEqual(["far", "near"]);
    expect(searchDrinks([far, near], { query: "guinness", sortBy: "distance" }).map(r => r.pub.id)).toEqual(["far", "near"]);
  });

  it("breaks price ties by distance, then name", () => {
    const a = pub("b-pub", 51.52, -0.14, [{ name: "Lager", current_price: 6 }]);
    const b = pub("a-pub", 51.5101, -0.1301, [{ name: "Lager", current_price: 6 }]);
    const c = pub("c-pub", 51.52, -0.14, [{ name: "Lager", current_price: 6 }]);
    expect(sortResults(searchDrinks([a, b, c], { origin: { lat: 51.51, lng: -0.13 } })).map(r => r.pub.id)).toEqual(["a-pub", "b-pub", "c-pub"]);
  });
});

describe("cheapestPerPub / cheapestPints", () => {
  const pubs = seedPubsAsApi();

  it("keeps each pub's cheapest match", () => {
    const best = cheapestPerPub(searchDrinks(pubs, { query: "ale" }));
    expect(best.get("the-harp").drink.name).toBe("Harveys Sussex Best");
  });

  it("builds a one-per-pub leaderboard, cheapest first", () => {
    const board = cheapestPints(pubs, { limit: 5 });
    expect(board).toHaveLength(5);
    expect(new Set(board.map(r => r.pub.id)).size).toBe(5);
    expect(board[0]).toMatchObject({ pintPrice: 5.6 });
    expect(board[0].pub.id).toBe("the-harp");
  });

  it("can include several drinks from the same pub", () => {
    const board = cheapestPints(pubs, { limit: 3, onePerPub: false });
    expect(board.map(r => r.pintPrice)).toEqual([5.6, 5.9, 5.9]);
  });
});

describe("priceHistoryStats", () => {
  it("summarises a drink's price history", () => {
    const stats = priceHistoryStats([
      { price: "6.40", reported_at: "2026-01-01" },
      { price: "6.10", reported_at: "2026-03-01" },
      { price: "6.70", reported_at: "2026-02-01" }
    ]);
    expect(stats).toEqual({ count: 3, min: 6.1, max: 6.7, average: 6.4, change: -0.3 });
  });

  it("returns null for no history", () => {
    expect(priceHistoryStats([])).toBeNull();
  });
});

describe("geo", () => {
  it("measures distance between two Soho pubs", () => {
    const d = distanceMetres({ lat: 51.51323, lng: -0.13178 }, { lat: 51.51398, lng: -0.13149 });
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(90);
  });

  it("handles bad points and formats distances", () => {
    expect(distanceMetres(null, { lat: 1, lng: 1 })).toBeNull();
    expect(distanceMetres({ lat: NaN, lng: 0 }, { lat: 1, lng: 1 })).toBeNull();
    expect(formatDistance(430)).toBe("430 m · 5 min walk");
    expect(formatDistance(1520)).toBe("1.5 km · 19 min walk");
  });

  it("knows whether a point is in the covered area", () => {
    expect(isInArea({ lat: 51.5132, lng: -0.1275 })).toBe(true);
    expect(isInArea({ lat: 53.48, lng: -2.24 })).toBe(false);
  });
});

describe("real prices only", () => {
  const withSources = () => {
    const pubs = seedPubsAsApi();
    const harp = pubs.find(p => p.id === "the-harp");
    harp.drinks.find(d => d.name === "Guinness").source = "community";
    const toucan = pubs.find(p => p.id === "the-toucan");
    toucan.drinks.find(d => d.name === "Guinness").source = "website";
    const salisbury = pubs.find(p => p.id === "the-salisbury");
    salisbury.drinks.find(d => d.name === "Timothy Taylor Landlord").source = "admin";
    return pubs;
  };

  it("leaves estimates out of search when asked", async () => {
    const { isRealPrice } = await import("../../src/lib/core/search.js");
    const rows = searchDrinks(withSources(), { query: "guinness", realOnly: true });
    expect(rows.map(r => r.pub.id)).toEqual(["the-toucan", "the-harp"]);
    expect(rows.every(r => isRealPrice(r.drink))).toBe(true);
    expect(searchDrinks(seedPubsAsApi(), { realOnly: true })).toEqual([]);
  });

  it("lists pubs that stock a drink but only have an estimate", async () => {
    const { unconfirmedPubs } = await import("../../src/lib/core/search.js");
    const list = unconfirmedPubs(withSources(), { query: "guinness" });
    expect(list).toHaveLength(15);
    expect(list.map(x => x.pub.id)).not.toContain("the-harp");
    expect(list.map(x => x.pub.id)).not.toContain("the-toucan");
    expect(list[0].drinks).toEqual(["Guinness"]);
  });

  it("builds the leaderboard from real prices only", () => {
    const board = cheapestPints(withSources(), { realOnly: true });
    expect(board.map(r => [r.pub.id, r.drink.name])).toEqual([
      ["the-toucan", "Guinness"], ["the-harp", "Guinness"], ["the-salisbury", "Timothy Taylor Landlord"]
    ]);
  });
});

describe("bottles and cans", () => {
  const bottlePub = pub("bottles", 51.528, -0.13, [
    { name: "Peroni", measure: "bottle", volume_ml: 330, current_price: 6.05, source: "website" },
    { name: "Magners", measure: "bottle", volume_ml: null, current_price: 6.25, source: "website", category: "Cider" },
    { name: "Peroni", measure: "pint", current_price: 7.2, source: "community" }
  ]);

  it("prices bottles per pint of beer when the size is known", async () => {
    const { pintPrice, measureLabel, isDraught } = await import("../../src/lib/core/prices.js");
    expect(pintPrice(6.05, "bottle", 330)).toBe(10.41);
    expect(pintPrice(6.25, "bottle", null)).toBeNull();
    expect(measureLabel("bottle", 330)).toBe("330ml bottle");
    expect(measureLabel("can")).toBe("can");
    expect(isDraught("bottle")).toBe(false);
    expect(isDraught(undefined)).toBe(true);
  });

  it("sorts bottles fairly (per pint), unknown sizes last", () => {
    const rows = searchDrinks([bottlePub], { query: "" });
    expect(rows.map(r => `${r.drink.name} ${r.measure}`)).toEqual(["Peroni pint", "Peroni bottle", "Magners bottle"]);
  });

  it("keeps bottles off the cheapest-pint leaderboard and prefers draught for map pins", () => {
    expect(cheapestPints([bottlePub], { onePerPub: false }).map(r => r.measure)).toEqual(["pint"]);
    const onlyBottles = pub("b2", 51.5, -0.1, [{ name: "Corona", measure: "bottle", volume_ml: 330, current_price: 5, source: "website" }]);
    expect(cheapestPints([onlyBottles])).toEqual([]);
    const best = cheapestPerPub(searchDrinks([bottlePub], { query: "peroni" }));
    expect(best.get("bottles").measure).toBe("pint");
    expect(cheapestPerPub(searchDrinks([onlyBottles])).get("b2").measure).toBe("bottle");
  });
});
