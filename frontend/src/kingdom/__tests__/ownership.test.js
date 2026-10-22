import { test } from "node:test";
import assert from "node:assert/strict";
import { availableQuantity, readGroveSnapshot, placeOwnedItem, storeItem } from "../ownership.js";
import { footprint, fitsPlacement } from "../placement.js";

const snapshot = { inventory: [{ itemId: "gar-bench", qty: 2 }],
  placedObjects: { garden: [{ id: "grove-1", itemId: "gar-bench" }] } };
const item = { id: "kingdom-1", itemId: "gar-bench", x: 2, z: 8, rotation: 0 };
test("reserves Grove copies without altering either inventory", () => {
  const before = JSON.stringify(snapshot);
  assert.equal(availableQuantity(snapshot, [], item.itemId), 1);
  const result = placeOwnedItem({ snapshot, placements: [], item, validate: () => true });
  assert.equal(result.ok, true);
  assert.equal(availableQuantity(snapshot, result.placements, item.itemId), 0);
  assert.equal(JSON.stringify(snapshot), before);
});
test("a second placement cannot duplicate the last owned copy", () => {
  assert.equal(placeOwnedItem({ snapshot, placements: [item], item: { ...item, id: "duplicate" },
    validate: () => true }).reason, "no-unplaced-owned-copy");
});
test("moving and storing an existing instance never mint ownership", () => {
  const result = placeOwnedItem({ snapshot, placements: [item], item: { ...item, x: 3 }, validate: () => true });
  assert.equal(result.placements.length, 1);
  assert.equal(result.placements[0].x, 3);
  assert.equal(availableQuantity(snapshot, storeItem(result.placements, item.id), item.itemId), 1);
});
test("no free example furniture or inferred legacy ownership", () => {
  assert.equal(availableQuantity({ inventory: [{ type: "bench", qty: 99 }] }, [], "gar-bench"), 0);
  assert.equal(availableQuantity({}, [], "kingdom.example.garden-bench"), 0);
});
test("duplicate and invalid aggregate rows cannot inflate quantity", () => {
  assert.equal(availableQuantity({ inventory: [snapshot.inventory[0], snapshot.inventory[0],
    { itemId: "gar-bench", qty: Infinity }, { itemId: "gar-bench", qty: "99" }] }, [], "gar-bench"), 2);
});
test("storage failures remain distinct from an empty inventory", () => {
  assert.equal(readGroveSnapshot({ getItem: () => "{broken" }).ok, false);
  assert.equal(readGroveSnapshot({ getItem: () => { throw Error("denied"); } }).ok, false);
  assert.deepEqual(readGroveSnapshot({ getItem: () => null }), { ok: true, snapshot: {} });
});
test("placements fail closed without geometry validation", () => {
  assert.equal(placeOwnedItem({ snapshot, placements: [], item }).ok, false);
  assert.equal(placeOwnedItem({ snapshot, placements: [], item: { ...item, x: NaN }, validate: () => true }).ok, false);
});
test("rotated furniture stays within region and clear of travel corridors", () => {
  const region = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
  const corridor = { minX: -1, maxX: 1, minZ: -5, maxZ: 5 };
  const box = footprint({ x: 3, z: 0, width: 2.2, depth: 0.8, rotation: Math.PI / 2 });
  assert.equal(fitsPlacement(box, region, [corridor]), true);
  assert.equal(fitsPlacement(footprint({ x: 1, z: 0, width: 2.2, depth: 0.8 }), region, [corridor]), false);
  assert.equal(fitsPlacement(footprint({ x: 4.7, z: 0, width: 2.2, depth: 0.8 }), region, []), false);
  assert.equal(fitsPlacement(box, region, [{ minX: NaN }]), false);
});
