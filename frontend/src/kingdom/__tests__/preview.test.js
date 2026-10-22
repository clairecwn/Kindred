// Looking at the island before it is a game (kingdomPreview.js): the Day 1
// view and the developed view, and the piece-by-piece list of the showcase
// that Blender writes for the second (assets/kingdom/blender/passes/k31_export_view.py).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { wildList, blocksOf, layoutStamp, GROWTH } from "../kingdomPreview.js";
import { createIsland } from "../islandState.js";
import { decodeRuns } from "../kingdomAssets.js";

const DIR = new URL("../../../public/models/env/kingdom/", import.meta.url);
const read = (file) => JSON.parse(readFileSync(new URL(file, DIR), "utf8"));
const glb = (file) => {
  const bytes = readFileSync(new URL(file, DIR));
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
};
const land = read("kingdom_sections.json");
const layout = read("kingdom_layout.json");
const showcase = read("kingdom_showcase.json");
const view = read("kingdom_view.json");
const houseSizes = read("kingdom_house_kit.json").sizes;
const cells = decodeRuns(land.grid.data, land.grid.nx * land.grid.nz);

// Which materials each kit mesh is made of, over the four kit files.
const kitMaterials = new Map();
for (const file of ["kingdom_kit.glb", "kingdom_decor_kit.glb", "kingdom_house_kit.glb", "kingdom_life_kit.glb"]) {
  const gltf = glb(file);
  for (const node of gltf.nodes) {
    if (node.mesh === undefined) continue;
    kitMaterials.set(node.name, new Set(gltf.meshes[node.mesh].primitives.map((primitive) => gltf.materials[primitive.material]?.name)));
  }
}

test("every piece of the developed island is a kit piece, and its own colours name materials that piece has", () => {
  assert.ok(view.showcase.length > 800, `the developed island has ${view.showcase.length} pieces`);
  const missing = new Set();
  let recoloured = 0;
  for (const piece of view.showcase) {
    const materials = kitMaterials.get(piece.m);
    if (!materials) { missing.add(piece.m); continue; }
    assert.equal(piece.p.length, 3, `${piece.m}: a place`);
    assert.ok(piece.q ? piece.q.length === 4 : Number.isFinite(piece.r), `${piece.m}: a turn`);
    for (const [material, colour] of Object.entries(piece.c ?? {})) {
      assert.ok(materials.has(material), `${piece.m} has no material ${material}`);
      assert.match(colour, /^#[0-9A-Fa-f]{6}$/, `${piece.m}: ${material} is a colour`);
    }
    if (piece.c) recoloured++;
  }
  assert.deepEqual([...missing], []);
  assert.ok(recoloured >= 4, "the house's roof, walls, trim and door carry the colours chosen for it");
  assert.deepEqual(view.opened, showcase.opened, "both files agree on which sections the showcase has opened");
});

test("Day 1 draws every section wild; the developed island clears the ones it has opened", () => {
  const all = wildList(land, []);
  assert.equal(all.length, land.sections.reduce((sum, section) => sum + section.wild.length + 1, 0), "all the growth and a sign for each section");
  const some = wildList(land, view.opened);
  const cleared = land.sections.filter((section) => view.opened.includes(section.id)).reduce((sum, section) => sum + section.wild.length + 1, 0);
  assert.equal(some.length, all.length - cleared);
  assert.ok(cleared > 100, "opening land clears a lot of growth");
  for (const one of all) assert.ok(kitMaterials.has(one.mesh), `${one.mesh} is in the kit`);
  for (const mesh of Object.keys(GROWTH)) assert.ok(kitMaterials.has(mesh), `${mesh}, which blocks a walker, is a kit piece`);
});

test("what blocks a walker: growth on closed land, and on the developed island its buildings, fences, pond and furniture", () => {
  const day1 = blocksOf({ land });
  assert.equal(day1.rects.length, 0, "Day 1 adds no buildings: the start area is the player's own");
  assert.equal(day1.closed.length, land.sections.reduce((sum, section) => sum + section.cells, 0), "every cell of every section is closed on Day 1");
  const developed = blocksOf({ land, opened: view.opened, showcase, houseSizes });
  const opened = land.sections.filter((section) => view.opened.includes(section.id)).reduce((sum, section) => sum + section.cells, 0);
  assert.equal(developed.closed.length, day1.closed.length - opened, "opened land can be walked on");
  // Closed cells are the sections' own: never the start area, a path, the pier or the beach.
  const grid = land.grid, at = (cx, cz) => { const ix = cx - grid.minX, iz = cz - grid.minZ; return ix < 0 || iz < 0 || ix >= grid.nx || iz >= grid.nz ? 0 : cells[iz * grid.nx + ix]; };
  assert.deepEqual(day1.closed.filter(([cx, cz]) => at(cx, cz) < 2), []);
  const house = developed.rects.filter((rect) => rect.wall);
  assert.equal(house.length, showcase.buildings.length);
  for (const [i, building] of showcase.buildings.entries()) {
    const [x, z, w, d] = building.plot, rect = house[i];
    assert.ok(rect.x0 >= x && rect.x1 <= x + w && rect.z0 >= z && rect.z1 <= z + d, `${building.name} stands inside its plot`);
  }
  // Every path cell of the showcase can be walked: nothing blocks its middle.
  const inside = (px, pz) => developed.closed.some(([cx, cz]) => px > cx && px < cx + 1 && pz > cz && pz < cz + 1) || developed.rects.some((r) => px > r.x0 && px < r.x1 && pz > r.z0 && pz < r.z1) || developed.discs.some((disc) => Math.hypot(px - disc.x, pz - disc.z) < disc.r);
  const blocked = Object.values(showcase.paths).flat().filter(([cx, cz]) => inside(cx + 0.5, cz + 0.5));
  assert.deepEqual(blocked, []);
  assert.ok(!inside(layout.spawn.x, layout.spawn.z), "the pier is clear");
});

test("an island saved on an older layout takes the new wild growth and keeps what the player did", () => {
  const stamp = layoutStamp(layout);
  assert.notEqual(stamp, layoutStamp({ ...layout, day1: layout.day1.slice(1) }), "the stamp changes when Day 1 is laid out again");
  const fresh = createIsland(null, layout, stamp);
  assert.equal(fresh.layout, stamp);
  const old = { ...fresh, layout: "an older layout", wild: [{ id: "K_D1_Tree_99", mesh: "KK_Tree_Round", x: 999, z: 999, rot: 0, scale: 1 }], placed: [{ id: "p1", item: "bench", cx: 2, cz: 30, rot: 0 }], produce: { carrot: 3 } };
  const moved = createIsland(JSON.parse(JSON.stringify(old)), layout, stamp);
  assert.deepEqual(moved.wild, fresh.wild, "the wild growth is the new layout's");
  assert.equal(moved.placed.length, 1, "what was placed is kept");
  assert.deepEqual(moved.produce, { carrot: 3 });
  const same = createIsland(JSON.parse(JSON.stringify({ ...fresh, wild: fresh.wild.slice(3) })), layout, stamp);
  assert.equal(same.wild.length, fresh.wild.length - 3, "on the same layout, what the player cleared stays cleared");
  assert.equal(createIsland(JSON.parse(JSON.stringify(old)), layout).wild.length, 1, "without a stamp nothing is replaced");
});

test("the gallery can put every example house and room together from the kit files", () => {
  const house = read("kingdom_house_kit.json"), room = read("kingdom_room_kit.json"), items = read("../../items/items.json").items;
  const houseNodes = new Set(kitMaterials.keys());
  for (const example of house.examples) {
    const size = house.sizes[example.size];
    assert.ok(size, example.size);
    for (const mesh of [size.meshes.body, size.roofs[example.roof].mesh, `KH_Door_${example.door}`, `KH_Porch_${example.porch}`, `KH_Window_${example.window}`]) assert.ok(houseNodes.has(mesh), `${example.size}: ${mesh}`);
    for (const [part, choice] of Object.entries(example.col ?? {})) assert.ok(house.colours[part]?.[choice], `${example.size}: ${part} ${choice} is a colour choice`);
  }
  assert.ok(house.examples.some((example) => Object.keys(example.col ?? {}).length), "the examples carry their colours");
  assert.deepEqual(Object.keys(room.furniture).sort(), room.examples.map((example) => example.room).sort(), "every example room has its furniture");
  for (const [name, spec] of Object.entries(room.furniture)) for (const entry of Object.values(spec).flat()) assert.ok(items[entry[0]], `${name}: ${entry[0]} is an item`);
});
