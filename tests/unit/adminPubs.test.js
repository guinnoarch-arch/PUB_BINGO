import { describe, expect, it } from "vitest";
import { adminTotals, canPublish, filterRows, missingInfo, one, slugify, sortRows, summarisePub } from "../../src/lib/core/adminPubs.js";

const pub = (over = {}) => ({
  id: "p", name: "Pub", area: "Soho", address: "1 Street", lat: 51.5, lng: -0.1, description: "Nice", website: "https://x.com",
  is_published: true, uploads_paused: false, pub_admin: { prices_online: "yes", notes: "n", prices_checked_at: null },
  pub_photos: [{ count: 2 }],
  drinks: [
    { source: "seed", last_updated_at: "2026-09-01T00:00:00Z" },
    { source: "website", last_updated_at: "2026-09-20T00:00:00Z" },
    { source: "community", last_updated_at: "2026-09-10T00:00:00Z" },
    { source: "admin", last_updated_at: "2026-09-05T00:00:00Z" }
  ],
  ...over
});

describe("summarisePub", () => {
  it("counts drinks, verified share, sources and last update", () => {
    const s = summarisePub(pub());
    expect(s).toMatchObject({
      drinkCount: 4, verifiedCount: 3, verifiedPct: 75, lastPriceUpdate: "2026-09-20T00:00:00.000Z",
      bySource: { seed: 1, community: 1, website: 1, admin: 1 }, pricesOnline: "yes", photoCount: 2, published: true, missing: []
    });
  });

  it("copes with a bare, hidden pub", () => {
    const s = summarisePub({ id: "x", name: "X", area: "Soho", is_published: false });
    expect(s).toMatchObject({ drinkCount: 0, verifiedPct: 0, lastPriceUpdate: null, pricesOnline: "unknown", published: false, photoCount: 0 });
    expect(s.missing).toEqual(["address", "map position", "description", "website", "drinks"]);
  });

  it("accepts pub_admin as an array", () => {
    expect(one([{ a: 1 }])).toEqual({ a: 1 });
    expect(one([])).toBeNull();
    expect(summarisePub(pub({ pub_admin: [{ prices_online: "no" }] })).pricesOnline).toBe("no");
  });
});

describe("missingInfo / canPublish", () => {
  it("needs an address and map position to publish", () => {
    expect(canPublish(pub())).toBe(true);
    expect(canPublish(pub({ lat: null }))).toBe(false);
    expect(canPublish(pub({ address: "" }))).toBe(false);
    expect(missingInfo(pub({ website: null }))).toEqual(["website"]);
  });
});

describe("sortRows / filterRows / adminTotals", () => {
  const rows = [
    summarisePub(pub({ id: "a", name: "Bravo", area: "Soho" })),
    summarisePub(pub({ id: "b", name: "Alpha", area: "Holborn", website: null, drinks: [{ source: "seed", last_updated_at: "2026-01-01" }] })),
    summarisePub(pub({ id: "c", name: "Charlie", area: "Covent Garden", is_published: false, drinks: [] }))
  ];

  it("sorts by column in both directions", () => {
    expect(sortRows(rows, "name").map(r => r.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(sortRows(rows, "name", "desc").map(r => r.name)).toEqual(["Charlie", "Bravo", "Alpha"]);
    expect(sortRows(rows, "drinkCount").map(r => r.name)).toEqual(["Charlie", "Alpha", "Bravo"]);
    expect(sortRows(rows, "verifiedPct", "desc")[0].name).toBe("Bravo");
    expect(sortRows(rows, "nonsense").map(r => r.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("filters by text and status", () => {
    expect(filterRows(rows, { text: "holb" }).map(r => r.name)).toEqual(["Alpha"]);
    expect(filterRows(rows, { status: "hidden" }).map(r => r.name)).toEqual(["Charlie"]);
    expect(filterRows(rows, { status: "published" })).toHaveLength(2);
    expect(filterRows(rows, { status: "needs-prices" }).map(r => r.name)).toEqual(["Bravo", "Alpha", "Charlie"]);
    expect(filterRows(rows, { status: "no-website" }).map(r => r.name)).toEqual(["Alpha"]);
  });

  it("totals the table", () => {
    expect(adminTotals(rows)).toEqual({ pubs: 3, published: 2, hidden: 1, drinks: 5, verifiedPct: 60, withWebsite: 2 });
  });
});

describe("slugify", () => {
  it("makes URL-safe ids", () => {
    expect(slugify("The Lamb & Flag")).toBe("the-lamb-and-flag");
    expect(slugify("  Brodie's Bräu Bar! ")).toBe("brodies-brau-bar");
    expect(slugify("")).toBe("");
  });
});

describe("toCsv", () => {
  it("exports a header and one line per pub, escaping safely", async () => {
    const { toCsv } = await import("../../src/lib/core/adminPubs.js");
    const row = summarisePub(pub({ name: 'The "Best", Pub', pub_admin: { prices_online: "partial", notes: "=HYPERLINK(bad)\nline 2" } }));
    const csv = toCsv([row]).split("\r\n");
    expect(csv[0]).toMatch(/^Pub,Area,Status,Drinks,Real prices %/);
    expect(csv[1]).toContain('"The ""Best"", Pub",Soho,Live,4,75,1,1,1,1,2026-09-20');
    expect(csv[1]).toContain("Partly");
    expect(csv.slice(1).join("\r\n")).toContain(`"'=HYPERLINK(bad)\nline 2"`);
  });
});
