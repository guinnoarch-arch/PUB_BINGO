import { createDemoApi } from "./demoApi.js";
import { createSupabaseApi } from "./supabaseApi.js";

const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const demo = import.meta.env.VITE_DEMO_MODE === "true";

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
  if (!url || !anonKey) {
    return { api: null, configError: "This build isn't connected to a database yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy." };
  }
  if (looksLikeSecretKey(anonKey)) {
    return { api: null, configError: "The configured key looks like a service-role key. Only the public anon key belongs in the browser." };
  }
  try {
    new URL(url);
  } catch {
    return { api: null, configError: "VITE_SUPABASE_URL isn't a valid URL." };
  }
  return { api: createSupabaseApi(url, anonKey), configError: null };
}

export const { api, configError } = createApi();
