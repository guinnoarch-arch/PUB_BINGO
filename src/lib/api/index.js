import { createDemoApi } from "./demoApi.js";
import { createSupabaseApi } from "./supabaseApi.js";

const rawUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const demo = import.meta.env.VITE_DEMO_MODE === "true";

// Supabase clients need just the project address (https://xxxx.supabase.co). People often paste the
// REST endpoint (…/rest/v1/) or leave off https://, which makes every request fail with
// "Invalid path specified in request URL". Keep only the origin. Returns "" if it isn't a URL.
export function normaliseSupabaseUrl(value) {
  let text = String(value || "").trim().replace(/^["']|["']$/g, "");
  if (!text) return "";
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  try {
    return new URL(text).origin;
  } catch {
    return "";
  }
}

// Secret keys must never ship to the browser. Covers new-style sb_secret_ keys and legacy JWT keys.
export function looksLikeSecretKey(key) {
  if (key.startsWith("sb_secret_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

// Returns { api, configError }. Production builds need Supabase settings; demo mode is opt-in only.
function createApi() {
  if (demo) return { api: createDemoApi(), configError: null };
  const url = normaliseSupabaseUrl(rawUrl);
  if (!rawUrl || !anonKey) {
    return { api: null, configError: "This build isn't connected to a database yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy." };
  }
  if (looksLikeSecretKey(anonKey)) {
    return { api: null, configError: "The configured key looks like a service-role key. Only the public anon key belongs in the browser." };
  }
  if (!url) {
    return { api: null, configError: "VITE_SUPABASE_URL isn't a valid URL. It should look like https://abcd1234.supabase.co" };
  }
  return { api: createSupabaseApi(url, anonKey), configError: null };
}

export const { api, configError } = createApi();
