// src/kingdom/islandState.js
//
// The Kingdom island as plain data, with the rules for changing it. No
// three.js here: the scene is a view of this state and the tests run it
// in Node.
//
//   state.placed  things the player put down:
//                 { id, item, cx, cz, rot, day?, variant?, water?, wateredDay? }
//                 cx, cz is the lowest cell of the footprint; rot is quarter
//                 turns; day is the day a plant went in (or the day it would
//                 have gone in, after a harvest sends it back a few stages);
//                 variant is its colour; water counts the days it was
//                 watered since the last harvest
//   state.wild    what the island started with: { id, mesh, x, z, rot, scale }
//   state.house   { stage: "tent" | "frame" | "cabin", roof, startedDay, woodUsed }
//   state.produce harvested goods by name
//
// Ownership stays in the Grove's own store. Placing an item reserves one
// owned copy; storing it releases the reservation (see ownership.js).
// Plants grow by real calendar days and nothing ever wilts or dies.

import { ITEMS, WILD, HOUSE, TOOLS } from "./items.js";
import { availableQuantity, KINGDOM_STORAGE_KEY } from "./ownership.js";

export const VERSION = 2;
const DAY_MS = 86400000;

/** Whole local calendar days since the epoch: a plant put in at 11 pm is a
 * day older at midnight, the way a garden is "a day on" each morning. */
export function dayNumber(date = new Date()) {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / DAY_MS);
}

/** Today as the island counts it. `dayOffset` exists for testing growth
 * without waiting (development only; the game never changes it). */
export function today(state, date = new Date()) {
  return dayNumber(date) + (state?.dayOffset ?? 0);
}

/** `stamp` names the layout the island stands on (kingdomPreview.layoutStamp).
 * When Blender has laid Day 1 out again since the island was saved, the
 * saved wild growth stood on the old land: it is replaced by the new
 * layout's. What the player placed, the house and the harvest are kept. */
export function createIsland(saved = null, layout = null, stamp = null) {
  const wildOf = () => {
    const wild = [];
    for (const entry of layout?.day1 ?? []) {
      if (!WILD[entry.mesh]) continue;            // the tent is the house, not a wild thing
      wild.push({ id: entry.name, mesh: entry.mesh, x: entry.x, z: entry.z, rot: entry.rot ?? 0, scale: entry.scale ?? 1 });
    }
    return wild;
  };
  if (saved && saved.version === VERSION && Array.isArray(saved.placed)) {
    const moved = stamp !== null && saved.layout !== stamp;
    return {
      version: VERSION,
      layout: stamp ?? saved.layout ?? null,
      placed: saved.placed.filter((p) => ITEMS[p.item]),
      wild: moved ? wildOf() : Array.isArray(saved.wild) ? saved.wild.filter((w) => WILD[w.mesh]) : [],
      house: { stage: "tent", roof: "red", startedDay: null, woodUsed: 0, ...(saved.house ?? {}) },
      produce: { ...(saved.produce ?? {}) },
      dayOffset: Number.isFinite(saved.dayOffset) ? saved.dayOffset : 0,
    };
  }
  return { version: VERSION, layout: stamp, placed: [], wild: wildOf(), house: { stage: "tent", roof: "red", startedDay: null, woodUsed: 0 }, produce: {}, dayOffset: 0 };
}

// ── Footprints ────────────────────────────────────────────────────────────
export function footprint(item, rot = 0) {
  const [w, d] = item.size;
  return rot % 2 === 0 ? [w, d] : [d, w];
}

export function cellsOf(item, cx, cz, rot = 0) {
  const [w, d] = footprint(item, rot);
  const cells = [];
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) cells.push([cx + x, cz + z]);
  return cells;
}

/** Where the piece stands in the world: the centre of its footprint, and its
 * turn about the vertical. */
export function poseOf(item, placed) {
  const [w, d] = footprint(item, placed.rot);
  return { x: placed.cx + w / 2, z: placed.cz + d / 2, rotY: -(placed.rot % 4) * Math.PI / 2 };
}

/** The lowest cell of a footprint centred as near (x, z) as the grid allows. */
export function cellFor(item, x, z, rot = 0) {
  const [w, d] = footprint(item, rot);
  return { cx: Math.round(x - w / 2), cz: Math.round(z - d / 2) };
}

const key = (x, z) => `${x},${z}`;

export function siteCells(site) {
  const [w, d] = site.cells ?? HOUSE.size;
  const x0 = Math.round(site.x - w / 2), z0 = Math.round(site.z - d / 2);
  const cells = [];
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) cells.push([x0 + x, z0 + z]);
  return cells;
}

/** Every taken cell: "x,z" -> { type: "placed" | "wild" | "house", id }. */
export function occupancy(state, site = null) {
  const taken = new Map();
  if (site) for (const [x, z] of siteCells(site)) taken.set(key(x, z), { type: "house", id: "house" });
  for (const w of state.wild) {
    if (WILD[w.mesh]?.cell === false) continue;
    taken.set(key(Math.floor(w.x), Math.floor(w.z)), { type: "wild", id: w.id });
  }
  for (const p of state.placed) {
    for (const [x, z] of cellsOf(ITEMS[p.item], p.cx, p.cz, p.rot)) taken.set(key(x, z), { type: "placed", id: p.id });
  }
  return taken;
}

/**
 * @param {object} env  { buildable(x, z): boolean, site }: the island as
 *   baked from Blender. A cell is buildable when all of it is open lawn.
 */
export function canPlace(state, env, itemId, cx, cz, rot = 0, { ignoreId = null } = {}) {
  const item = ITEMS[itemId];
  if (!item) return { ok: false, reason: "unknown-item" };
  if (![cx, cz, rot].every(Number.isInteger)) return { ok: false, reason: "off-grid" };
  const taken = occupancy(state, env.site);
  for (const [x, z] of cellsOf(item, cx, cz, rot)) {
    if (!env.buildable(x, z)) return { ok: false, reason: "not-buildable" };
    const holder = taken.get(key(x, z));
    if (holder && holder.id !== ignoreId) return { ok: false, reason: "occupied", holder };
  }
  return { ok: true };
}

// ── Ownership ─────────────────────────────────────────────────────────────
/** What this island holds of the Grove's stock, in the shape ownership.js
 * counts: one row per reserved copy. */
export function reservations(state) {
  const rows = state.placed.map((p) => ({ id: p.id, itemId: ITEMS[p.item].grove }));
  for (let i = 0; i < (state.house.woodUsed ?? 0); i++) rows.push({ id: `house-wood-${i}`, itemId: HOUSE.cabin.cost.grove });
  return rows;
}

export function available(state, snapshot, groveId, movingId = null) {
  return availableQuantity(snapshot, reservations(state), groveId, movingId);
}

/** Items the player owns and could put down now, with how many are free. */
export function placeable(state, snapshot) {
  return Object.values(ITEMS)
    .map((item) => ({ item, free: available(state, snapshot, item.grove) }))
    .filter((row) => row.free > 0);
}

let counter = 0;
function newId(itemId, day) {
  counter = (counter + 1) % 1e6;
  return `${itemId}-${day}-${Date.now().toString(36)}-${counter}`;
}

export function place(state, env, snapshot, itemId, cx, cz, rot, day, variant = null) {
  const fit = canPlace(state, env, itemId, cx, cz, rot);
  if (!fit.ok) return fit;
  const item = ITEMS[itemId];
  if (available(state, snapshot, item.grove) < 1) return { ok: false, reason: "none-owned" };
  const placed = { id: newId(itemId, day), item: itemId, cx, cz, rot: ((rot % 4) + 4) % 4 };
  if (item.stages) placed.day = day;
  if (item.variants) placed.variant = item.variants[variant] ? variant : Object.keys(item.variants)[0];
  // Loose dressing (grass) under the new piece goes: it was never in the way.
  const cells = new Set(cellsOf(item, cx, cz, rot).map(([x, z]) => key(x, z)));
  const wild = state.wild.filter((w) => !(WILD[w.mesh]?.cell === false && cells.has(key(Math.floor(w.x), Math.floor(w.z)))));
  return { ok: true, placed, state: { ...state, wild, placed: [...state.placed, placed] } };
}

export function move(state, env, id, cx, cz, rot) {
  const current = state.placed.find((p) => p.id === id);
  if (!current) return { ok: false, reason: "not-found" };
  const fit = canPlace(state, env, current.item, cx, cz, rot, { ignoreId: id });
  if (!fit.ok) return fit;
  const next = { ...current, cx, cz, rot: ((rot % 4) + 4) % 4 };
  return { ok: true, placed: next, state: { ...state, placed: state.placed.map((p) => (p.id === id ? next : p)) } };
}

/** Pick a placed piece back up. Its owned copy is free again at once. */
export function store(state, id) {
  if (!state.placed.some((p) => p.id === id)) return { ok: false, reason: "not-found" };
  return { ok: true, state: { ...state, placed: state.placed.filter((p) => p.id !== id) } };
}

/** Clear a wild thing for good. */
export function clearWild(state, id) {
  if (!state.wild.some((w) => w.id === id)) return { ok: false, reason: "not-found" };
  return { ok: true, state: { ...state, wild: state.wild.filter((w) => w.id !== id) } };
}

// ── Growth ────────────────────────────────────────────────────────────────
/** The age in days at which each stage begins: [0, ...]. */
export function stageStarts(item) {
  const starts = [0];
  const days = item.stageDays ?? [];
  for (let i = 0; i < item.stages.length - 1; i++) starts.push(starts[i] + (days[i] ?? 1));
  return starts;
}

function ageOf(placed, day) {
  return Math.max(0, day - (placed.day ?? day));
}

export function stageOf(placed, day) {
  const item = ITEMS[placed.item];
  if (!item?.stages) return 0;
  const starts = stageStarts(item), age = ageOf(placed, day);
  let stage = 0;
  while (stage + 1 < starts.length && age >= starts[stage + 1]) stage++;
  return stage;
}

/** What is drawn for a stage: { mesh, scale }. */
export function stageMesh(item, stage) {
  const entry = item.stages[Math.min(stage, item.stages.length - 1)];
  return typeof entry === "string" ? { mesh: entry, scale: 1 } : { mesh: entry.mesh, scale: entry.scale ?? 1 };
}

/** Does it stand in the way at this stage? A seedling never does. */
export function solidAt(item, stage) {
  return Boolean(item.solid) && stage >= (item.solidFrom ?? 0);
}

export function isRipe(placed, day) {
  const item = ITEMS[placed.item];
  return Boolean(item?.harvest) && stageOf(placed, day) === item.stages.length - 1;
}

export function daysUntilNextStage(placed, day) {
  const item = ITEMS[placed.item];
  if (!item?.stages) return null;
  const stage = stageOf(placed, day);
  if (stage >= item.stages.length - 1) return 0;
  return stageStarts(item)[stage + 1] - ageOf(placed, day);
}

/** How many a harvest would give now: the base, plus one for each day the
 * crop was watered, up to its limit. */
export function yieldOf(placed) {
  const h = ITEMS[placed.item]?.harvest;
  return h ? h.base + Math.min(h.waterBonus ?? 0, placed.water ?? 0) : 0;
}

export function harvest(state, id, day) {
  const placed = state.placed.find((p) => p.id === id);
  if (!placed) return { ok: false, reason: "not-found" };
  if (!isRipe(placed, day)) return { ok: false, reason: "not-ripe" };
  const item = ITEMS[placed.item];
  const { produce, regrowStage } = item.harvest;
  const count = yieldOf(placed);
  // Back to an earlier stage, to grow again from there.
  const { water, wateredDay, ...rest } = placed;
  const regrown = { ...rest, day: day - stageStarts(item)[regrowStage] };
  return {
    ok: true, produce, count,
    state: {
      ...state,
      placed: state.placed.map((p) => (p.id === id ? regrown : p)),
      produce: { ...state.produce, [produce]: (state.produce[produce] ?? 0) + count },
    },
  };
}

// ── Watering ──────────────────────────────────────────────────────────────
// Watering is only ever a bonus: a crop that is never watered still grows at
// the same pace and still gives its base harvest.
export function hasTool(snapshot, tool) {
  return availableQuantity(snapshot, [], TOOLS[tool].grove) > 0;
}

export function isWet(placed, day) {
  return placed.wateredDay === day;
}

export function canWater(state, snapshot, id, day) {
  const placed = state.placed.find((p) => p.id === id);
  if (!placed) return { ok: false, reason: "not-found" };
  const item = ITEMS[placed.item];
  if (!item.waterable) return { ok: false, reason: "not-waterable" };
  if (isRipe(placed, day)) return { ok: false, reason: "ripe" };
  if (isWet(placed, day)) return { ok: false, reason: "already-watered" };
  if ((placed.water ?? 0) >= (item.harvest?.waterBonus ?? 0)) return { ok: false, reason: "watered-enough" };
  if (!hasTool(snapshot, "wateringCan")) return { ok: false, reason: "no-can" };
  return { ok: true };
}

export function water(state, snapshot, id, day) {
  const check = canWater(state, snapshot, id, day);
  if (!check.ok) return check;
  return {
    ok: true,
    state: { ...state, placed: state.placed.map((p) => (p.id === id ? { ...p, water: (p.water ?? 0) + 1, wateredDay: day } : p)) },
  };
}

// ── The house ─────────────────────────────────────────────────────────────
/** The stage the house is at on a given day: a frame becomes a cabin once
 * its build days have passed. */
export function houseStage(state, day) {
  const h = state.house;
  if (h.stage === "frame" && h.startedDay !== null && day - h.startedDay >= HOUSE.cabin.buildDays) return "cabin";
  return h.stage;
}

export function canStartCabin(state, snapshot) {
  if (state.house.stage !== "tent") return { ok: false, reason: "already-building" };
  const { grove, count } = HOUSE.cabin.cost;
  const have = available(state, snapshot, grove);
  return have >= count ? { ok: true, have, need: count } : { ok: false, reason: "need-wood", have, need: count };
}

export function startCabin(state, snapshot, roof, day) {
  const check = canStartCabin(state, snapshot);
  if (!check.ok) return check;
  if (!HOUSE.roofs[roof]) return { ok: false, reason: "unknown-roof" };
  return { ok: true, state: { ...state, house: { stage: "frame", roof, startedDay: day, woodUsed: HOUSE.cabin.cost.count } } };
}

/** Write through any change that the calendar has made (a finished cabin). */
export function settle(state, day) {
  const stage = houseStage(state, day);
  return stage === state.house.stage ? state : { ...state, house: { ...state.house, stage } };
}

// ── Saving ────────────────────────────────────────────────────────────────
export function loadIsland(storage, layout, stamp = null) {
  try {
    const raw = storage?.getItem(KINGDOM_STORAGE_KEY);
    return createIsland(raw ? JSON.parse(raw) : null, layout, stamp);
  } catch {
    return createIsland(null, layout, stamp);
  }
}

export function saveIsland(storage, state) {
  try {
    storage?.setItem(KINGDOM_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
