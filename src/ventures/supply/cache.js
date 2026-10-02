/**
 * cache.js
 *
 * Tiny TTL cache for supply adapters, backed by localStorage when available
 * and an in-memory Map otherwise (SSR/tests/private browsing). Never throws.
 */

const memoryStore = new Map();

function hasLocalStorage() {
  try {
    return typeof localStorage !== "undefined" && localStorage !== null;
  } catch {
    return false;
  }
}

export function cacheGet(key) {
  try {
    if (hasLocalStorage()) {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { expiresAt, value } = JSON.parse(raw);
      if (expiresAt && expiresAt < Date.now()) {
        localStorage.removeItem(key);
        return null;
      }
      return value;
    }
  } catch {
    // fall through to memory store
  }

  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlMs) {
  const expiresAt = ttlMs ? Date.now() + ttlMs : null;
  try {
    if (hasLocalStorage()) {
      localStorage.setItem(key, JSON.stringify({ expiresAt, value }));
      return;
    }
  } catch {
    // fall through to memory store
  }
  memoryStore.set(key, { expiresAt, value });
}
