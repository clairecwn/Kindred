import { createClient } from "@supabase/supabase-js";

const url     = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Supabase is optional. With no credentials configured the app keeps working
 * exactly as it did before — saves go to IndexedDB, and no sign-in is required.
 * Every consumer must therefore handle `supabase` being null.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

if (!isSupabaseConfigured) {
  console.info(
    "[Kindred] Supabase not configured — saving locally to IndexedDB. " +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env and restart " +
    "the dev server to enable accounts and cross-device save."
  );
}

const LOCAL_ONLY_KEY = "kindred.localOnly";

/**
 * Set when the player chooses to carry on without an account.
 *
 * `isSupabaseConfigured` only says the env vars are non-empty — never that the
 * project actually answers. Without this escape hatch a deleted, paused or
 * mistyped project URL locks the whole app behind a sign-in screen that can
 * never succeed, even though every save path already falls back to IndexedDB
 * when there is no user id.
 */
export function isLocalOnly() {
  try { return localStorage.getItem(LOCAL_ONLY_KEY) === "1"; }
  catch { return false; }
}

export function setLocalOnly(on) {
  try {
    if (on) localStorage.setItem(LOCAL_ONLY_KEY, "1");
    else    localStorage.removeItem(LOCAL_ONLY_KEY);
  } catch { /* private browsing — the in-memory choice still holds this session */ }
}
