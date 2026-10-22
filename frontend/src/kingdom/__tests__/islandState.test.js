import test from "node:test";
import assert from "node:assert/strict";
import {
  createIsland, dayNumber, today, footprint, cellsOf, poseOf, cellFor, canPlace, place, move, store, clearWild,
  stageOf, isRipe, harvest, daysUntilNextStage, houseStage, canStartCabin, startCabin, settle, reservations, placeable,
  stageStarts, stageMesh, solidAt, yieldOf, canWater, water, isWet,
  loadIsland, saveIsland, occupancy,
} from "../islandState.js";
import { ITEMS, HOUSE } from "../items.js";

const site = { x: -3, z: -6, cells: [6, 6] };
// A 40 x 40 lawn with a pond (not buildable) at x 10..12, z 10..12.
const env = { site, buildable: (x, z) => x >= -20 && x < 20 && z >= -20 && z < 20 && !(x >= 10 && x < 12 && z >= 10 && z < 12) };
const owns = (...rows) => ({ inventory: rows.map(([itemId, qty]) => ({ itemId, label: itemId, qty })) });
const layout = { day1: [
  { name: "K_D1_Tree_00", mesh: "KK_Tree_Round", x: 5.5, z: 5.5, rot: 0, scale: 0.8 },
  { name: "K_D1_Grass_00", mesh: "KK_Grass_Tuft", x: 2.3, z: 2.7, rot: 0, scale: 1 },
  { name: "K_D1_Tent", mesh: "KK_Tent", x: -3, z: -6, rot: 0, scale: 1 },
] };

test("a new island starts with the wild things and a tent, and nothing placed", () => {
  const s = createIsland(null, layout);
  assert.equal(s.placed.length, 0);
  assert.deepEqual(s.wild.map((w) => w.id), ["K_D1_Tree_00", "K_D1_Grass_00"]);
  assert.equal(s.house.stage, "tent");
});

test("footprints turn with the piece", () => {
  assert.deepEqual(footprint(ITEMS.bench, 0), [2, 1]);
  assert.deepEqual(footprint(ITEMS.bench, 1), [1, 2]);
  assert.deepEqual(cellsOf(ITEMS.bench, 3, 4, 1), [[3, 4], [3, 5]]);
  assert.deepEqual(poseOf(ITEMS.bench, { cx: 3, cz: 4, rot: 0 }), { x: 4, z: 4.5, rotY: -0 });
  assert.deepEqual(cellFor(ITEMS.bench, 4.2, 4.6, 0), { cx: 3, cz: 4 });
  assert.deepEqual(cellFor(ITEMS.carrot, 4.2, 4.6, 0), { cx: 4, cz: 4 });
});

test("placing needs open lawn, a free cell and an owned copy", () => {
  let s = createIsland(null, layout);
  assert.equal(place(s, env, owns(), "bench", 0, 0, 0, 100).reason, "none-owned");
  assert.equal(place(s, env, owns(["gar-bench", 1]), "bench", 10, 10, 0, 100).reason, "not-buildable");
  assert.equal(place(s, env, owns(["gar-bench", 1]), "bench", 4, 5, 0, 100).reason, "occupied");   // the tree's cell
  assert.equal(place(s, env, owns(["gar-bench", 1]), "bench", -4, -6, 0, 100).reason, "occupied"); // the house plot
  assert.equal(canPlace(s, env, "bench", 0.5, 0, 0).reason, "off-grid");
  const r = place(s, env, owns(["gar-bench", 1]), "bench", 0, 0, 0, 100);
  assert.equal(r.ok, true);
  s = r.state;
  assert.equal(place(s, env, owns(["gar-bench", 1]), "bench", 6, 0, 0, 100).reason, "none-owned");   // the one copy is down
  assert.equal(place(s, env, owns(["gar-bench", 2]), "bench", 1, 0, 0, 100).reason, "occupied");
  assert.equal(place(s, env, owns(["gar-bench", 2]), "bench", 2, 0, 0, 100).ok, true);
});

test("grass under a new piece goes; storing gives the copy back", () => {
  let s = createIsland(null, layout);
  const r = place(s, env, owns(["mak-fence", 1]), "fence", 2, 2, 0, 100);
  assert.equal(r.ok, true);
  assert.equal(r.state.wild.some((w) => w.id === "K_D1_Grass_00"), false);
  s = r.state;
  assert.deepEqual(placeable(s, owns(["mak-fence", 1])), []);
  const back = store(s, r.placed.id);
  assert.equal(back.ok, true);
  assert.equal(placeable(back.state, owns(["mak-fence", 1]))[0].free, 1);
});

test("a piece can be moved onto its own old cells but not onto another", () => {
  let s = createIsland(null, layout);
  const a = place(s, env, owns(["gar-bench", 2]), "bench", 0, 0, 0, 100); s = a.state;
  const b = place(s, env, owns(["gar-bench", 2]), "bench", 0, 2, 0, 100); s = b.state;
  assert.equal(move(s, env, a.placed.id, 1, 0, 0).ok, true);
  assert.equal(move(s, env, a.placed.id, 1, 2, 0).reason, "occupied");
});

test("wild things can be cleared, which frees their cell", () => {
  let s = createIsland(null, layout);
  assert.equal(occupancy(s, site).has("5,5"), true);
  s = clearWild(s, "K_D1_Tree_00").state;
  assert.equal(occupancy(s, site).has("5,5"), false);
});

test("plants grow one stage a real day and stop at the last", () => {
  const s = place(createIsland(null, layout), env, owns(["gar-carrotseed", 1]), "carrot", 0, 0, 0, 100);
  const p = s.placed;
  assert.deepEqual([100, 101, 102, 103, 110].map((d) => stageOf(p, d)), [0, 1, 2, 3, 3]);
  assert.equal(daysUntilNextStage(p, 100), 1);
  assert.equal(daysUntilNextStage(p, 103), 0);
  assert.equal(isRipe(p, 102), false);
  assert.equal(isRipe(p, 103), true);
});

test("harvest gives produce and the plant grows back from sprouting", () => {
  let r = place(createIsland(null, layout), env, owns(["gar-carrotseed", 1]), "carrot", 0, 0, 0, 100);
  let s = r.state;
  assert.equal(harvest(s, r.placed.id, 101).reason, "not-ripe");
  const h = harvest(s, r.placed.id, 103);
  assert.equal(h.ok, true);
  assert.equal(h.state.produce.carrot, 1);          // never watered: the base harvest
  const again = h.state.placed[0];
  assert.equal(stageOf(again, 103), 1);
  assert.equal(isRipe(again, 105), true);
  assert.equal(harvest(h.state, again.id, 105).state.produce.carrot, 2);
});

test("stages can take different numbers of days", () => {
  assert.deepEqual(stageStarts(ITEMS.pumpkin), [0, 1, 3, 5]);
  const r = place(createIsland(null, layout), env, owns(["gar-pumpkinseed", 1]), "pumpkin", 0, 0, 0, 100);
  assert.deepEqual([100, 101, 102, 103, 104, 105].map((d) => stageOf(r.placed, d)), [0, 1, 1, 2, 2, 3]);
  assert.equal(daysUntilNextStage(r.placed, 101), 2);
  assert.equal(daysUntilNextStage(r.placed, 102), 1);
});

test("watering is a bonus: one more per watered day, up to two, and never needed", () => {
  const can = ["gar-wateringcan", 1];
  let r = place(createIsland(null, layout), env, owns(["gar-carrotseed", 1]), "carrot", 0, 0, 0, 100);
  let s = r.state; const id = r.placed.id;
  assert.equal(canWater(s, owns(), id, 100).reason, "no-can");
  s = water(s, owns(can), id, 100).state;
  assert.equal(isWet(s.placed[0], 100), true);
  assert.equal(isWet(s.placed[0], 101), false);
  assert.equal(canWater(s, owns(can), id, 100).reason, "already-watered");
  s = water(s, owns(can), id, 101).state;
  assert.equal(canWater(s, owns(can), id, 102).reason, "watered-enough");
  assert.equal(yieldOf(s.placed[0]), 3);
  assert.equal(canWater(s, owns(can), id, 103).reason, "ripe");
  const h = harvest(s, id, 103);
  assert.equal(h.count, 3);
  assert.equal(yieldOf(h.state.placed[0]), 1);          // the count starts again after a harvest
  assert.equal(h.state.placed[0].wateredDay, undefined);
  // flowers and trees are not watered
  const f = place(createIsland(null, layout), env, owns(["gar-daisyseed", 1]), "daisy", 0, 0, 0, 100);
  assert.equal(canWater(f.state, owns(can), f.placed.id, 100).reason, "not-waterable");
});

test("flowers are planted in a chosen colour", () => {
  const island = createIsland(null, layout);
  assert.equal(place(island, env, owns(["gar-tulipbulb", 1]), "tulip", 0, 0, 0, 100, "purple").placed.variant, "purple");
  assert.equal(place(island, env, owns(["gar-tulipbulb", 1]), "tulip", 0, 0, 0, 100, "tartan").placed.variant, "red");   // unknown: the first colour
  assert.equal(place(island, env, owns(["gar-carrotseed", 1]), "carrot", 0, 0, 0, 100, "purple").placed.variant, undefined);
});

test("a fruit tree grows up, bears fruit, and bears again after picking", () => {
  const r = place(createIsland(null, layout), env, owns(["gar-applesapling", 1]), "apple", 0, 0, 0, 100);
  assert.deepEqual(stageStarts(ITEMS.apple), [0, 1, 3, 6, 8]);
  assert.deepEqual([100, 101, 103, 106, 108].map((d) => stageOf(r.placed, d)), [0, 1, 2, 3, 4]);
  assert.deepEqual(stageMesh(ITEMS.apple, 2), { mesh: "KK_Tree_Round", scale: 0.6 });
  assert.deepEqual(stageMesh(ITEMS.apple, 4), { mesh: "KK_Tree_Apple", scale: 0.85 });
  assert.equal(solidAt(ITEMS.apple, 0), false);       // a seedling can be walked over
  assert.equal(solidAt(ITEMS.apple, 1), true);
  assert.equal(solidAt(ITEMS.carrot, 3), false);
  const h = harvest(r.state, r.placed.id, 108);
  assert.equal(h.count, 3);
  assert.equal(stageOf(h.state.placed[0], 108), 3);   // still fully grown, without fruit
  assert.equal(isRipe(h.state.placed[0], 110), true);
  // an oak bears nothing
  const o = place(createIsland(null, layout), env, owns(["gar-acorn", 1]), "oak", 0, 0, 0, 100);
  assert.equal(stageOf(o.placed, 200), 3);
  assert.equal(isRipe(o.placed, 200), false);
});

test("flowers bloom and are not harvested", () => {
  const r = place(createIsland(null, layout), env, owns(["gar-daisyseed", 1]), "daisy", 0, 0, 0, 100);
  assert.equal(stageOf(r.placed, 103), 3);
  assert.equal(isRipe(r.placed, 103), false);
  assert.equal(harvest(r.state, r.placed.id, 103).reason, "not-ripe");
});

test("the cabin needs four wood, takes a day, and holds the wood", () => {
  let s = createIsland(null, layout);
  assert.deepEqual(canStartCabin(s, owns(["mak-wood", 3])), { ok: false, reason: "need-wood", have: 3, need: 4 });
  assert.equal(startCabin(s, owns(["mak-wood", 4]), "pink", 100).reason, "unknown-roof");
  const r = startCabin(s, owns(["mak-wood", 5]), "blue", 100);
  assert.equal(r.ok, true);
  s = r.state;
  assert.equal(houseStage(s, 100), "frame");
  assert.equal(houseStage(s, 101), "cabin");
  assert.equal(reservations(s).filter((row) => row.itemId === HOUSE.cabin.cost.grove).length, 4);
  assert.equal(canStartCabin(s, owns(["mak-wood", 9])).reason, "already-building");
  assert.equal(settle(s, 100).house.stage, "frame");
  assert.equal(settle(s, 101).house.stage, "cabin");
  assert.equal(settle(s, 101).house.roof, "blue");
});

test("days are local calendar days and the test offset shifts them", () => {
  const lateNight = new Date(2026, 9, 8, 23, 30), nextMorning = new Date(2026, 9, 9, 0, 30);
  assert.equal(dayNumber(nextMorning) - dayNumber(lateNight), 1);
  assert.equal(today({ dayOffset: 3 }, lateNight), dayNumber(lateNight) + 3);
});

test("an island survives a save and a load; a broken save starts fresh", () => {
  const box = new Map();
  const storage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
  const r = place(createIsland(null, layout), env, owns(["gar-carrotseed", 1]), "carrot", 0, 0, 0, 100);
  assert.equal(saveIsland(storage, r.state), true);
  const back = loadIsland(storage, layout);
  assert.deepEqual(back.placed, r.state.placed);
  box.set("kindred.kingdom.island.v1", "{not json");
  assert.equal(loadIsland(storage, layout).placed.length, 0);
});
