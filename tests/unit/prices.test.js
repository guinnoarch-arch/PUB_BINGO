import { describe, expect, it } from "vitest";
import { formatPrice, parsePrice, pintPrice, validatePriceReport } from "../../src/lib/core/prices.js";

describe("parsePrice", () => {
  it.each([
    ["5.80", 5.8], ["£5.80", 5.8], [" 5.8 ", 5.8], ["5,80", 5.8], ["6", 6], ["580p", 5.8], ["£ 7.25", 7.25], [6.456, 6.46]
  ])("parses %j as %s", (input, expected) => expect(parsePrice(input)).toBe(expected));

  it.each([["", null], ["abc", null], ["5.805", null], ["1e3", null], ["-5", null], [NaN, null], [null, null], [{}, null], ["5.8.1", null]])(
    "rejects %j", (input, expected) => expect(parsePrice(input)).toBe(expected)
  );
});

describe("pintPrice", () => {
  it("doubles halves so they compare fairly with pints", () => {
    expect(pintPrice(3.9, "half")).toBe(7.8);
    expect(pintPrice(6.2, "pint")).toBe(6.2);
    expect(pintPrice(5, "two-thirds")).toBe(7.5);
    expect(pintPrice(6, undefined)).toBe(6);
  });
});

describe("formatPrice", () => {
  it("formats pounds and pence", () => {
    expect(formatPrice(5.8)).toBe("£5.80");
    expect(formatPrice(null)).toBe("–");
  });
});

describe("validatePriceReport", () => {
  const base = { pubId: "the-harp", drinkId: "d1", price: "6.20" };

  it("accepts an update to an existing drink", () => {
    const result = validatePriceReport({ ...base, note: "  quiet   Tuesday " });
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({ pubId: "the-harp", drinkId: "d1", price: 6.2, note: "quiet Tuesday", drinkName: null });
  });

  it("requires name and category for a new drink", () => {
    const result = validatePriceReport({ pubId: "the-harp", price: "6" });
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(["category", "drinkName"]);
  });

  it("accepts a valid new drink", () => {
    const result = validatePriceReport({ pubId: "p", price: "£6", drinkName: " Beamish  Stout ", category: "Stout", measure: "pint" });
    expect(result.ok).toBe(true);
    expect(result.value.drinkName).toBe("Beamish Stout");
  });

  it.each([["0.99"], ["25.01"], ["free"], [""]])("rejects price %j", price => {
    expect(validatePriceReport({ ...base, price }).errors.price).toBeTruthy();
  });

  it("rejects long notes, bad categories, bad measures and missing pub", () => {
    const result = validatePriceReport({ price: "6", drinkName: "Beer", category: "Wine", measure: "yard", note: "x".repeat(201) });
    expect(Object.keys(result.errors).sort()).toEqual(["category", "measure", "note", "pubId"]);
  });

  it("strips control characters", () => {
    expect(validatePriceReport({ ...base, note: "hi\u0000there" }).value.note).toBe("hi there");
  });
});
