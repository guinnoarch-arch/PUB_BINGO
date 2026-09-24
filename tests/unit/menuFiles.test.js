import { describe, expect, it } from "vitest";
import { isPdf, londonToday, menuSubmissionPath, validateMenuSubmissionFile, validateSeenOn } from "../../src/lib/api/menuFiles.js";

describe("menu submissions", () => {
  it("uses the London date, not UTC", () => {
    // 23:30 UTC on 24 Sep is 00:30 on 25 Sep in London (BST).
    expect(londonToday(new Date("2026-09-24T23:30:00Z"))).toBe("2026-09-25");
    expect(londonToday(new Date("2026-01-10T23:30:00Z"))).toBe("2026-01-10");
  });

  it("checks the date seen", () => {
    const today = "2026-09-24";
    expect(validateSeenOn("2026-09-24", today)).toBeNull();
    expect(validateSeenOn("2026-03-01", today)).toBeNull();
    expect(validateSeenOn("", today)).toMatch(/date/);
    expect(validateSeenOn("2026-09-25", today)).toMatch(/future/);
    expect(validateSeenOn("2025-09-23", today)).toMatch(/over a year/);
    expect(validateSeenOn("2025-09-24", today)).toBeNull();
  });

  it("accepts PDFs and photos only", () => {
    expect(validateMenuSubmissionFile(null)).toMatch(/Choose/);
    expect(validateMenuSubmissionFile({ name: "menu.pdf", type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateMenuSubmissionFile({ name: "IMG_1.HEIC", type: "image/heic", size: 1000 })).toBeNull();
    expect(validateMenuSubmissionFile({ name: "menu.docx", type: "application/msword", size: 1000 })).toMatch(/PDF or a photo/);
    expect(validateMenuSubmissionFile({ name: "big.pdf", type: "application/pdf", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(isPdf({ name: "Menu.PDF", type: "" })).toBe(true);
  });

  it("stores files in the sender's own folder", () => {
    expect(menuSubmissionPath("abc-123", "jpg")).toMatch(/^abc-123\/\d+-[a-z0-9]+\.jpg$/);
  });
});
