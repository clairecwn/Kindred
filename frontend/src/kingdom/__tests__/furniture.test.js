// The furniture range (assets/items/blender/passes/ib_furniture.py): thirty
// pieces for the rooms of a house. They are not in a shop yet, so they are
// listed under the shop "furniture" and the mall does not see them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATALOG } from "../../grove/economy/catalog.js";

const DIR = new URL("../../../public/models/", import.meta.url);
const items = JSON.parse(readFileSync(new URL("items/items.json", DIR), "utf8")).items;
const rooms = JSON.parse(readFileSync(new URL("env/kingdom/kingdom_room_kit.json", DIR), "utf8"));
const range = Object.entries(items).filter(([, item]) => item.shop === "furniture");

test("the range has its thirty pieces, in a file of their own, and none is on sale in the mall yet", () => {
  assert.equal(range.length, 30);
  const sold = new Set(Object.values(CATALOG).flat().map((entry) => entry.id));
  for (const [id, item] of range) {
    assert.equal(item.file, "items_furniture.glb", id);
    assert.ok(!sold.has(id), `${id} is not in the catalog`);
  }
});

test("every piece sits on the half-metre grid and fits the smallest room it could go in", () => {
  const smallest = Math.min(...Object.values(rooms.rooms).map((room) => Math.min(...room.inside)));
  for (const [id, item] of range) {
    const [cw, cd] = item.cells;
    if (item.type !== "wall") assert.ok(Number.isInteger(cw / rooms.snap) && Number.isInteger(cd / rooms.snap), `${id}: ${cw} x ${cd} is whole cells`);
    assert.ok(cw <= smallest && item.size[2] <= rooms.height, `${id}: fits a ${smallest} m room under a ${rooms.height} m wall`);
    assert.ok(item.triangles <= 6000, `${id}: ${item.triangles} triangles`);
  }
});

test("seats, beds, tables and lamps say where they are used", () => {
  const by = Object.fromEntries(range);
  for (const id of ["fur-sofa", "fur-armchair", "fur-chair", "fur-deskchair", "fur-trunk", "fur-piano", "fur-bathtub"]) {
    const seat = by[id].seat;
    assert.ok(seat?.length >= 4 && seat.length % 4 === 0, `${id}: seat points`);
    for (let i = 0; i < seat.length; i += 4) assert.ok(seat[i + 2] > 0.2 && seat[i + 2] < 0.6, `${id}: seat height ${seat[i + 2]}`);
  }
  for (const id of ["fur-bed", "fur-doublebed"]) assert.ok(by[id].lie?.length >= 4, `${id}: where to lie`);
  for (const id of ["fur-coffeetable", "fur-sidetable", "fur-bookcase", "fur-media", "fur-bedside", "fur-dresser", "fur-diningtable", "fur-counter", "fur-desk", "fur-wallshelf"]) {
    const surface = by[id].surface;
    assert.ok(surface?.length >= 5 && surface.length % 5 === 0, `${id}: surfaces`);
    for (let i = 0; i < surface.length; i += 5) {
      const [x0, y0, x1, y1, z] = surface.slice(i, i + 5);
      assert.ok(x1 > x0 && y1 > y0, `${id}: a surface has an area`);
      assert.ok(x0 >= by[id].min[0] - 0.001 && x1 <= by[id].min[0] + by[id].size[0] + 0.001, `${id}: the surface is on the piece`);
      assert.ok(z <= by[id].min[2] + by[id].size[2] + 0.001, `${id}: the surface is not above the piece`);
    }
  }
  assert.equal(by["fur-tablelamp"].light.length, 3);
  // kitchen pieces share one worktop height and are exactly one metre wide, so they make a run
  for (const id of ["fur-counter", "fur-sink", "fur-stove"]) assert.equal(by[id].size[0], 1, `${id}: one metre wide`);
  assert.equal(by["fur-counter"].surface[4], 0.92);
});
