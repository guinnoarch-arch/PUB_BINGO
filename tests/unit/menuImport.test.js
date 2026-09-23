import { describe, expect, it } from "vitest";
import { buildImportRows, guessCategory, itemsToLines, nameScore, parseMenuLines } from "../../src/lib/core/menuImport.js";

const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });

describe("itemsToLines", () => {
  it("rebuilds lines top to bottom, left to right, joining items on the same row", () => {
    const lines = itemsToLines([
      item("£6.80", 400, 700), item("Oyster Stout", 50, 701), item("4.6%", 250, 700),
      item("DRAUGHT", 50, 760),
      item("Temple Lager", 50, 680), item("£6.60", 400, 680), item("  ", 10, 10)
    ]);
    expect(lines).toEqual(["DRAUGHT", "Oyster Stout 4.6% £6.80", "Temple Lager £6.60"]);
  });
});

describe("parseMenuLines", () => {
  it("reads names, ABVs, pint and half prices", () => {
    const rows = parseMenuLines([
      "DRAUGHT BEER",
      "Porterhouse Oyster Stout 4.6% £6.80 £3.45",
      "Temple Lager ......... 4.2% £6.60",
      "Budvar Original 5.0% 6.90 3.50",
      "Half of Guinness £3.40",
      "Pinot Grigio 175ml £8.50",
      "Aspall Cyder",
      "£6.95",
      "Opening hours 11:00 - 23:00",
      "Tel: 020 7379 7917"
    ]);
    expect(rows.map(r => [r.name, r.pint, r.half, r.category, r.draught])).toEqual([
      ["Porterhouse Oyster Stout", 6.8, 3.45, "Stout", true],
      ["Temple Lager", 6.6, null, "Lager", true],
      ["Budvar Original", 6.9, 3.5, "Lager", true],
      ["Guinness", null, 3.4, "Stout", true],
      ["Pinot Grigio 175ml", 8.5, null, "Other", false],
      ["Aspall Cyder", 6.95, null, "Cider", true]
    ]);
  });

  it("treats two unrelated prices as pint + something else, and ignores silly prices", () => {
    const [row] = parseMenuLines(["Special Ale £6.00 £9.50", "Nonsense £99.99"]);
    expect(row).toMatchObject({ pint: 6, half: null });
    expect(parseMenuLines(["Nonsense £99.99"])).toEqual([]);
  });

  it("accepts comma decimals", () => {
    expect(parseMenuLines(["Camden Hells 6,85"])[0].pint).toBe(6.85);
  });
});

describe("guessCategory / nameScore", () => {
  it("guesses categories", () => {
    expect(guessCategory("Yippy IPA")).toBe("IPA");
    expect(guessCategory("Plain Porter")).toBe("Stout");
    expect(guessCategory("London Pride")).toBe("Real Ale");
    expect(guessCategory("Schneider Weisse")).toBe("Wheat Beer");
    expect(guessCategory("Mystery Thing")).toBe("Other");
  });

  it("scores name similarity", () => {
    expect(nameScore("Oyster Stout", "Porterhouse Oyster Stout")).toBeGreaterThanOrEqual(0.85);
    expect(nameScore("Guinness", "guinness")).toBe(1);
    expect(nameScore("Temple Lager", "Oyster Stout")).toBe(0);
  });
});

describe("buildImportRows", () => {
  const drinks = [
    { id: "d1", name: "Porterhouse Oyster Stout", category: "Stout", measure: "pint", current_price: 7.2 },
    { id: "d2", name: "Porterhouse Temple Bräu", category: "Lager", measure: "pint", current_price: 7.1 },
    { id: "d3", name: "Guinness", category: "Stout", measure: "half", current_price: 3.9 },
    { id: "d4", name: "Stonewell Cider", category: "Cider", measure: "pint", current_price: 7.1 }
  ];

  it("matches existing drinks, suggests new ones, and pre-ticks confident changes only", () => {
    const rows = buildImportRows(parseMenuLines([
      "Oyster Stout 4.6% £6.80 £3.45",
      "Temple Lager 4.2% £6.60",
      "Guinness £7.60 £3.80",
      "Stonewell Cider £7.10",
      "Pinot Grigio 175ml £8.50"
    ]), drinks);
    const view = rows.map(r => [r.name, r.measure, r.price, r.drinkId, r.selected]);
    expect(view).toEqual([
      ["Porterhouse Oyster Stout", "pint", 6.8, "d1", true],
      ["Temple Lager", "pint", 6.6, null, false],
      ["Guinness", "pint", 7.6, null, false],
      ["Guinness", "half", 3.8, "d3", true],
      ["Stonewell Cider", "pint", 7.1, "d4", false],
      ["Pinot Grigio 175ml", "pint", 8.5, null, false]
    ]);
    expect(rows[0].currentPrice).toBe(7.2);
  });

  it("never matches the same listed drink twice", () => {
    const rows = buildImportRows(parseMenuLines(["Oyster Stout £6.80", "Porterhouse Oyster Stout £6.90"]), drinks);
    expect(rows.filter(r => r.drinkId === "d1")).toHaveLength(1);
  });
});
