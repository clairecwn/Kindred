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
