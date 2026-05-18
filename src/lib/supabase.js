/**
 * Supabase client — optional. Activated only when VITE_SUPABASE_URL is set.
 * Falls back to IndexedDB / localStorage when not configured.
 *
 * SQL setup (run once in Supabase → SQL Editor):
 * ─────────────────────────────────────────────────────────────────
 * create table profiles (
 *   id uuid primary key default gen_random_uuid(),
 *   username text unique not null,
 *   coins integer default 500,
 *   created_at timestamptz default now()
 * );
 *
 * create table characters (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references profiles(id) on delete cascade,
 *   data jsonb default '{}',
 *   updated_at timestamptz default now()
 * );
 *
 * create table journal_entries (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references profiles(id) on delete cascade,
 *   entry_text text not null,
 *   emotion text,
 *   confidence float,
 *   created_at timestamptz default now()
 * );
 *
 * create table inventory (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references profiles(id) on delete cascade,
 *   item_id text not null,
 *   item_name text,
 *   item_type text,
 *   purchased_at timestamptz default now()
 * );
 *
 * create table friends (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references profiles(id) on delete cascade,
 *   friend_name text not null,
 *   added_at timestamptz default now()
 * );
 *
 * create table land_state (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references profiles(id) on delete cascade unique,
 *   state jsonb default '{}',
 *   updated_at timestamptz default now()
 * );
 * ─────────────────────────────────────────────────────────────────
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

let _client = null;

export async function getSupabase() {
  if (!isSupabaseEnabled) return null;
  if (_client) return _client;
  const { createClient } = await import("@supabase/supabase-js");
  _client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
}

export async function saveProfile(profile) {
  const sb = await getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("profiles").upsert({
    id: profile.id,
    username: profile.name,
    coins: profile.coins ?? 500,
  });
  return !error;
}

export async function loadProfile(id) {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", id).single();
  return data;
}

export async function saveCharacter(userId, characterData) {
  const sb = await getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("characters").upsert({ user_id: userId, data: characterData, updated_at: new Date().toISOString() });
  return !error;
}

export async function saveJournalEntry(userId, entry) {
  const sb = await getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("journal_entries").insert({
    user_id: userId,
    entry_text: entry.text,
    emotion: entry.emotion,
    confidence: entry.confidence,
  });
  return !error;
}
