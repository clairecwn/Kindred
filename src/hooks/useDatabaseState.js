import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useSession } from "../lib/SessionProvider.jsx";

const DB_NAME = "kindred-world";
const STORE = "state";
const TABLE = "user_state";

// The world blob changes on every animation frame while the character walks, so
// remote writes are coalesced instead of fired per keystroke/step.
const REMOTE_WRITE_DEBOUNCE_MS = 800;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readRecord(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeRecord(key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function readCache(cacheKey) {
  try {
    const saved = window.localStorage.getItem(cacheKey);
    return saved ? JSON.parse(saved) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A piece of saved world state, addressed by a stable string key.
 *
 * Signed in with Supabase configured, the row in `user_state` is the source of
 * truth and IndexedDB/localStorage act as an offline cache. Otherwise it
 * behaves exactly as it always did, local-only.
 */
export function useDatabaseState(key, initialValue) {
  const { userId } = useSession();

  // Local copies are namespaced per account, so signing in as someone else on a
  // shared browser cannot surface the previous account's cached world.
  const cacheKey = userId ? `${key}::${userId}` : key;

  const initialRef = useRef(initialValue);
  const [value, setValue] = useState(() => readCache(cacheKey) ?? initialRef.current);

  // Guards the save effect until the load below has resolved. Without it the
  // first render would immediately persist `initialValue`, overwriting the
  // saved world with defaults before it ever arrived.
  const hydrated = useRef(false);
  const flushTimer = useRef(null);

  useEffect(() => {
    hydrated.current = false;
    let cancelled = false;

    (async () => {
      let remote;
      if (supabase && userId) {
        const { data, error } = await supabase
          .from(TABLE)
          .select("value")
          .eq("user_id", userId)
          .eq("key", key)
          .maybeSingle();
        if (error) console.warn(`[Kindred] Could not load "${key}":`, error.message);
        else if (data) remote = data.value;
      }

      const local = remote === undefined
        ? await readRecord(cacheKey).catch(() => undefined)
        : undefined;

      if (cancelled) return;

      const resolved = remote ?? local ?? readCache(cacheKey) ?? initialRef.current;
      setValue(resolved);
      hydrated.current = true;
    })();

    return () => { cancelled = true; };
  }, [key, cacheKey, userId]);

  // Latest row still owed to the server, held so it can be flushed early if the
  // page goes away before the debounce window closes. Dropping it would lose
  // the write for good: the local caches are already updated, but a reload
  // prefers the (now stale) remote row over them.
  const pending = useRef(null);
  const flush = useRef(() => {});
  flush.current = () => {
    if (!supabase || !pending.current) return;
    const row = pending.current;
    pending.current = null;
    supabase
      .from(TABLE)
      .upsert(row, { onConflict: "user_id,key" })
      .then(({ error }) => {
        if (error) console.warn(`[Kindred] Could not save "${row.key}":`, error.message);
      });
  };

  useEffect(() => {
    if (!hydrated.current) return;

    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(value));
    } catch { /* quota exceeded — the IndexedDB write below still stands */ }
    writeRecord(cacheKey, value).catch(() => {});

    if (!supabase || !userId) return;

    pending.current = { user_id: userId, key, value };
    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => flush.current(), REMOTE_WRITE_DEBOUNCE_MS);
  }, [cacheKey, key, userId, value]);

  useEffect(() => {
    // pagehide rather than beforeunload — it also covers mobile tab eviction.
    const flushNow = () => { clearTimeout(flushTimer.current); flush.current(); };
    window.addEventListener("pagehide", flushNow);
    return () => {
      window.removeEventListener("pagehide", flushNow);
      flushNow();
    };
  }, []);

  return [value, setValue];
}
