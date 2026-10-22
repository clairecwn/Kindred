// The wild land Blender exports (assets/kingdom/blender/passes/k28_sections.py):
// the home island is big and most of it starts closed. Every cell that can be
// built on is in the start area or in exactly one section, sections are of a
// fair size, each can be reached by opening its neighbours, Day 1 grows only
// in the start area, and the showcase stands only on land it has opened.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeRuns, parseCollision } from "../kingdomAssets.js";

const DIR = new URL("../../../public/models/env/kingdom/", import.meta.url);
const read = (file) => JSON.parse(readFileSync(new URL(file, DIR), "utf8"));
const land = read("kingdom_sections.json");
const layout = read("kingdom_layout.json");
const showcase = read("kingdom_showcase.json");
const baked = read("kingdom_collision.json");
const collision = parseCollision(baked);
const { grid, sections } = land;
const cells = decodeRuns(grid.data, grid.nx * grid.nz);
/** 0 not land to build on, 1 the start area, n + 1 section n. */
const at = (x, z) => {
  const ix = x - grid.minX, iz = z - grid.minZ;
  return ix < 0 || iz < 0 || ix >= grid.nx || iz >= grid.nz ? 0 : cells[iz * grid.nx + ix];
};

test("every cell that can be built on is in the start area or in one section, and no other cell is", () => {
  let wrong = 0, counted = 0;
  for (let z = grid.minZ - 2; z < grid.minZ + grid.nz + 2; z++) {
    for (let x = grid.minX - 2; x < grid.minX + grid.nx + 2; x++) {
      const inLand = at(x, z) > 0;
      if (inLand !== collision.buildable(x, z)) wrong++;
      if (inLand) counted++;
    }
  }
  assert.equal(wrong, 0);
  assert.equal(counted, baked.island.buildable);
  assert.ok(counted > 5000, "the island is big: more than 5,000 cells");
});

test("the start area is roomy and the sections are of a fair size", () => {
  const size = new Map();
  for (const value of cells) if (value) size.set(value - 1, (size.get(value - 1) ?? 0) + 1);
  assert.equal(size.get(0), land.home.cells);
  assert.ok(land.home.cells >= 900 && land.home.cells <= 1500, `the start area has ${land.home.cells} cells`);
  assert.ok(sections.length >= 12, "there are many sections to open");
  for (const section of sections) {
    assert.equal(size.get(section.id), section.cells, `${section.name} counts its cells`);
    assert.ok(section.cells >= 150 && section.cells <= 450, `${section.name} has ${section.cells} cells`);
    assert.equal(at(Math.floor(section.sign.x), Math.floor(section.sign.z)), section.id + 1, `${section.name}'s sign stands on its own land`);
  }
  const closed = sections.reduce((sum, section) => sum + section.cells, 0);
  assert.ok(closed > 3 * land.home.cells, "most of the island starts closed, so there is room to grow for a long time");
});

test("every section can be opened by opening its neighbours first", () => {
  const byId = new Map(sections.map((section) => [section.id, section]));
  for (const section of sections) {
    for (const other of section.nextTo) if (other) assert.ok(byId.get(other).nextTo.includes(section.id), `${section.name} and ${other} agree that they touch`);
  }
  const open = new Set([0]);
  for (let round = 0; round < sections.length; round++) {
    for (const section of sections) if (!open.has(section.id) && section.nextTo.some((id) => open.has(id))) open.add(section.id);
  }
  assert.equal(open.size, sections.length + 1);
  assert.ok(sections.filter((section) => section.ring === 1).length >= 4, "several sections touch the start area: the player chooses which way to grow");
  for (const section of sections) assert.equal(section.ring === 1, section.nextTo.includes(0), `${section.name}'s ring`);
});

test("wild growth stands on its own section and is light enough to draw", () => {
  let triangles = 0;
  for (const section of sections) {
    triangles += section.triangles;
    assert.ok(section.wild.length > 20, `${section.name} is overgrown`);
    const off = section.wild.filter((one) => at(Math.floor(one.x), Math.floor(one.z)) !== section.id + 1);
    assert.deepEqual(off, [], `${section.name}'s growth is on its own land`);
    for (const one of section.wild) assert.ok(layout.kit.includes(one.mesh), `${one.mesh} is in the kit`);
  }
  assert.ok(layout.kit.includes("KK_Land_Sign"));
  assert.ok(triangles < 500000, `all the wild land together is ${triangles} triangles`);
});

test("Day 1 grows only in the start area", () => {
  const off = layout.day1.filter((one) => one.mesh !== "KK_Tent" && at(Math.floor(one.x), Math.floor(one.z)) > 1);
  assert.deepEqual(off.map((one) => one.name), []);
  assert.equal(at(Math.floor(layout.site.x), Math.floor(layout.site.z)), 1, "the house plot is in the start area");
});

test("the showcase stands only on land it has opened", () => {
  const opened = new Set(showcase.opened);
  assert.ok(opened.size >= 3 && opened.size < sections.length, "the showcase is part-way through: some land opened, some still wild");
  const ok = (x, z) => { const v = at(x, z); return v <= 1 || opened.has(v - 1); };
  const bad = [];
  for (const piece of showcase.pieces) {
    for (let x = 0; x < piece.cells[0]; x++) for (let z = 0; z < piece.cells[1]; z++) if (!ok(piece.cell[0] + x, piece.cell[1] + z)) bad.push(piece.mesh);
  }
  for (const b of showcase.buildings) for (const [x, z] of b.cells) if (!ok(x, z)) bad.push(b.name);
  for (const [x, z] of Object.values(showcase.paths).flat()) if (!ok(x, z)) bad.push("path");
  for (const one of showcase.wild) if (!ok(Math.floor(one.x), Math.floor(one.z))) bad.push(one.mesh);
  for (const one of showcase.life) if (one.y === 0 && !ok(Math.floor(one.x), Math.floor(one.z))) bad.push(one.mesh);
  assert.deepEqual(bad, []);
});

test("places are kept for bridges to more land", () => {
  assert.ok(land.bridgePoints.length >= 6);
  assert.equal(land.bridgePoints.filter((point) => point.used).length, Object.keys(baked.expansions).length);
  for (const point of land.bridgePoints) assert.ok(Math.hypot(point.x, point.z) > 30, "a bridge point is on the island's edge");
});

test("wild growth is laid out in groves, not on a grid: several kinds of tree, big and small, off the centre of the cell", () => {
  const kinds = new Set();
  let centred = 0, count = 0;
  for (const section of sections) {
    const trees = section.wild.filter((one) => one.mesh.startsWith("KK_Tree_"));
    assert.ok(trees.length >= 4, `${section.name} has ${trees.length} trees`);
    const sizes = trees.map((tree) => tree.scale);
    assert.ok(Math.max(...sizes) / Math.min(...sizes) >= 1.3, `${section.name} has big trees and small ones`);
    for (const one of section.wild) {
      count++;
      kinds.add(one.mesh);
      const fx = one.x - Math.floor(one.x), fz = one.z - Math.floor(one.z);
      if (Math.abs(fx - 0.5) < 0.005 && Math.abs(fz - 0.5) < 0.005) centred++;
    }
  }
  assert.ok([...kinds].filter((kind) => kind.startsWith("KK_Tree_")).length >= 6, "there are several kinds of wild tree");
  assert.ok(centred / count < 0.05, "growth does not stand in rows");
});
