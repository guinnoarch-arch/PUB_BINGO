import { describe, expect, it } from "vitest";
import { looksLikeSecretKey, normaliseSupabaseUrl } from "../../src/lib/api/index.js";
import { friendlyError } from "../../src/lib/api/errors.js";

const jwt = payload => `x.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.y`;

describe("looksLikeSecretKey", () => {
  it("flags secret keys and allows public ones", () => {
    expect(looksLikeSecretKey("sb_secret_abc")).toBe(true);
    expect(looksLikeSecretKey(jwt({ role: "service_role" }))).toBe(true);
    expect(looksLikeSecretKey(jwt({ role: "anon" }))).toBe(false);
    expect(looksLikeSecretKey("sb_publishable_abc")).toBe(false);
    expect(looksLikeSecretKey("not.a.jwt")).toBe(false);
  });
});

describe("normaliseSupabaseUrl", () => {
  it("keeps only the project address", () => {
    expect(normaliseSupabaseUrl("https://abcd.supabase.co")).toBe("https://abcd.supabase.co");
    expect(normaliseSupabaseUrl("https://abcd.supabase.co/rest/v1/")).toBe("https://abcd.supabase.co");
    expect(normaliseSupabaseUrl(" https://abcd.supabase.co/ ")).toBe("https://abcd.supabase.co");
    expect(normaliseSupabaseUrl("abcd.supabase.co")).toBe("https://abcd.supabase.co");
    expect(normaliseSupabaseUrl('"https://abcd.supabase.co"')).toBe("https://abcd.supabase.co");
  });

  it("rejects things that aren't URLs", () => {
    expect(normaliseSupabaseUrl("")).toBe("");
    expect(normaliseSupabaseUrl("not a url")).toBe("");
  });
});

describe("friendlyError", () => {
  it("maps common failures to plain English with a next step", () => {
    expect(friendlyError(new TypeError("Failed to fetch"))).toBe("Can't reach Pub Bingo. Check your connection and try again.");
    expect(friendlyError({ message: "Invalid login credentials" })).toMatch(/don't match.*reset your password/);
    expect(friendlyError({ message: "new row violates row-level security policy" })).toMatch(/isn't allowed/);
    expect(friendlyError({ name: "TimeoutError", message: "signal timed out" })).toMatch(/taking too long/);
  });

  it("keeps the database's own messages, rewording the terse ones", () => {
    expect(friendlyError({ message: "Price must be between £1.00 and £25.00" })).toBe("Price must be between £1.00 and £25.00.");
    expect(friendlyError({ message: "You reported this drink a few minutes ago" })).toMatch(/again after 10 minutes/);
    expect(friendlyError({ message: "Admins only" })).toMatch(/Only admins/);
    expect(friendlyError({ message: "Drink not found" })).toMatch(/already been removed/);
  });

  it("never shows raw database or code errors", () => {
    expect(friendlyError({ message: "duplicate key value violates unique constraint \"drinks_pkey\"" }, "Couldn't save the drink.")).toBe("Couldn't save the drink. Try again in a moment.");
    expect(friendlyError({ message: "PGRST116: JSON object requested" })).toMatch(/^That didn't work/);
    expect(friendlyError(new TypeError("Cannot read properties of undefined (reading 'id')"))).toMatch(/^That didn't work/);
  });

  it("adds a next step to fallbacks that don't have one", () => {
    expect(friendlyError(null, "Couldn't load pubs.")).toBe("Couldn't load pubs. Try again in a moment.");
    expect(friendlyError(null, "Couldn't save. Check your connection.")).toBe("Couldn't save. Check your connection.");
  });
});

describe("friendlyError rewording of database limits", () => {
  it("drops the exclamation and says when you can try again", () => {
    expect(friendlyError({ message: "You've sent 10 menus today. Thanks! Try again tomorrow" })).toMatch(/daily limit.*tomorrow\.$/);
    expect(friendlyError({ message: "You've already checked this price today. Thanks!" })).not.toMatch(/!/);
  });
});
