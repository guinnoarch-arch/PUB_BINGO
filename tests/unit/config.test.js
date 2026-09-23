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
  it("maps common failures to plain English", () => {
    expect(friendlyError(new TypeError("Failed to fetch"))).toMatch(/Can't reach the server/);
    expect(friendlyError({ message: "Invalid login credentials" })).toMatch(/Wrong email/);
    expect(friendlyError({ message: "new row violates row-level security policy" })).toMatch(/permission/);
    expect(friendlyError({ message: "You reported this drink a few minutes ago" })).toBe("You reported this drink a few minutes ago");
    expect(friendlyError(null, "fallback")).toBe("fallback");
  });
});
