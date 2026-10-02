// src/grove/economy/worldState.js
//
// Plain-JS source of truth for Grove's mall economy: coin balance,
// inventory, ownership, and per-interior placed objects. The three.js
// scene (interiors/*, GroveScene) is a VIEW of this state — it never
// invents ownership or stock on its own, it only reads and mutates this
// object through the functions below.
//
// Coins only ever come in from outside (journaling/check-in rewards,
// wired up by whoever owns that system) via `coins` in the constructor
// options. When no balance is passed in at all (coins is left undefined),
// the economy degrades gracefully: spending is treated as always
// affordable in a clearly-labelled "demo" sense, so the mall stays fully
// walkable and buyable in isolation, but nothing here fabricates a real
// balance number for a product surface that would show it.
//
// BANNED, per design: countdown scarcity, loot boxes / randomised
// purchase outcomes, pay-to-skip, spending leaderboards. None of that
// exists in this module and none should be added to it.

import { CATALOG } from "./catalog.js";

const STORAGE_KEY = "kindred.grove.mall.v1";

function loadPersisted() {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(state) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify({
      coins: state.coinsProvided ? undefined : state.coins, // never persist a real balance we don't own
      inventory: state.inventory,
      placedObjects: state.placedObjects,
    }));
  } catch {
    // best-effort only; the mall still works with no persistence
  }
}

/**
 * @param {object} opts
 * @param {number} [opts.coins] current coin balance from the journaling/
 *   check-in economy. Omit to run in graceful-degradation demo mode.
 */
export function createWorldState({ coins } = {}) {
  const persisted = loadPersisted();
  const coinsProvided = typeof coins === "number";
  const state = {
    coinsProvided,
    coins: coinsProvided ? coins : (persisted?.coins ?? 120), // demo starting purse when nothing is wired in
    inventory: persisted?.inventory ?? [], // [{itemId, label, qty}]
    placedObjects: persisted?.placedObjects ?? {}, // interiorId -> [{id, itemId, x, z}]
    listeners: new Set(),
  };
  return state;
}

export function subscribe(state, fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

function notify(state) {
  persist(state);
  state.listeners.forEach((fn) => fn(state));
}

/** External call for when a real coin balance arrives/changes (e.g. after
 * a journal entry is saved elsewhere in the app). Never called by this
 * module's own purchase flow. */
export function setExternalCoins(state, coins) {
  if (typeof coins !== "number") return;
  state.coinsProvided = true;
  state.coins = Math.max(0, Math.round(coins));
  notify(state);
}

export function findCatalogItem(itemId) {
  for (const items of Object.values(CATALOG)) {
    const found = items.find((it) => it.id === itemId);
    if (found) return found;
  }
  return null;
}

export function canAfford(state, itemId) {
  const item = findCatalogItem(itemId);
  if (!item) return false;
  return state.coins >= item.price;
}

/** One-step purchase: deduct coins, add to inventory. Caller (the
 * interior's purchase-flow UI) is responsible for the two-step
 * select-then-confirm interaction; this function is the single
 * atomic commit at the end of it. Returns {ok, reason?}. */
export function purchaseItem(state, itemId) {
  const item = findCatalogItem(itemId);
  if (!item) return { ok: false, reason: "unknown-item" };
  if (state.coins < item.price) return { ok: false, reason: "insufficient-coins" };
  state.coins -= item.price;
  const existing = state.inventory.find((i) => i.itemId === itemId);
  if (existing) existing.qty += 1;
  else state.inventory.push({ itemId, label: item.label, qty: 1 });
  notify(state);
  return { ok: true, item };
}

/** Records a world object (already owned, from inventory) placed down
 * inside a given interior at a floor position, keyed by id so it can be
 * picked back up later. */
export function placeObject(state, interiorId, { id, itemId, x, z }) {
  if (!state.placedObjects[interiorId]) state.placedObjects[interiorId] = [];
  state.placedObjects[interiorId] = state.placedObjects[interiorId].filter((o) => o.id !== id);
  state.placedObjects[interiorId].push({ id, itemId, x, z });
  notify(state);
}

export function removePlacedObject(state, interiorId, id) {
  if (!state.placedObjects[interiorId]) return;
  state.placedObjects[interiorId] = state.placedObjects[interiorId].filter((o) => o.id !== id);
  notify(state);
}

export function getPlacedObjects(state, interiorId) {
  return state.placedObjects[interiorId] ?? [];
}
