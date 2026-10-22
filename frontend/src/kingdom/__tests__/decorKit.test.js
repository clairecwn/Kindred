// The outdoor decor kit Blender exports (assets/kingdom/blender/passes/k22_export_decor.py):
// every part the list names must be in the model file, the sets that are laid
// by rule must be complete, and each part must fit the cells it says it takes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const DIR = new URL("../../../public/models/env/kingdom/", import.meta.url);
const kit = JSON.parse(readFileSync(new URL("kingdom_decor_kit.json", DIR), "utf8"));
const bytes = readFileSync(new URL("kingdom_decor_kit.glb", DIR));
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
const nodes = new Set(gltf.nodes.map((node) => node.name));
const materials = new Set(gltf.materials.map((material) => material.name));
const parts = Object.entries(kit.parts);

test("every part the kit lists is in the model file, and every group is listed", () => {
  assert.deepEqual(parts.map(([name]) => name).filter((name) => !nodes.has(name)), []);
  const grouped = Object.values(kit.groups).flat();
  assert.deepEqual(grouped.slice().sort(), parts.map(([name]) => name).sort());
  for (const group of ["path", "bed", "fence", "lamp", "seat", "arch", "pond", "bridge", "sign"]) {
    assert.ok(kit.groups[group]?.length > 0, `group ${group} has parts`);
  }
});

test("the sets laid by rule name parts that exist", () => {
  const wanted = [];
  for (const set of Object.values(kit.sets.paths)) wanted.push(...Object.values(set));
  for (const set of Object.values(kit.sets.fences)) wanted.push(...Object.values(set));
  for (const set of Object.values(kit.sets.gates)) wanted.push(set.posts, set.leaf);
  const { tile, edge, corner, inner } = kit.sets.pond;
  wanted.push(tile, edge, corner, inner);
  assert.deepEqual(wanted.filter((name) => !kit.parts[name]), []);
});

test("every part stands on the ground inside the cells it takes", () => {
  for (const [name, part] of parts) {
    const [cw, cd] = part.cells;
    const [w, d] = part.size;
    const [x0, y0, z0] = part.min;
    assert.ok(z0 > -0.011, `${name}: nothing below the ground (${z0})`);
    // a fence rail reaches its cell's edge, an arch or a roof may overhang a little; nothing may reach a full cell further
    assert.ok(x0 >= -cw / 2 - 0.36 && x0 + w <= cw / 2 + 0.36, `${name}: ${w} m wide for ${cw} cells`);
    assert.ok(y0 >= -cd / 2 - 0.36 && y0 + d <= cd / 2 + 0.36, `${name}: ${d} m deep for ${cd} cells`);
    const limit = cw * cd >= 4 ? 12000 : 6000;                                   // a centrepiece of 2 x 2 cells or more may carry more
    assert.ok(part.triangles <= limit, `${name}: ${part.triangles} triangles`);
  }
});

test("path tiles, pond tiles and fence rails meet their neighbours", () => {
  for (const [name, set] of Object.entries(kit.sets.paths)) {
    const tile = kit.parts[set.tile];
    if (!set.edge) continue;
    assert.deepEqual(tile.size.slice(0, 2), [1, 1], `${name}: the tile fills its cell`);
    assert.ok(tile.size[2] <= 0.07, `${name}: the tile is low enough to walk on`);
  }
  assert.deepEqual(kit.parts[kit.sets.pond.tile].size.slice(0, 2), [1, 1]);
  for (const [name, set] of Object.entries(kit.sets.fences)) {
    const rail = kit.parts[set.rail];
    assert.ok(Math.abs(rail.min[0] + rail.size[0] - 0.5) < 0.006, `${name}: the rail ends on the cell edge`);
    assert.ok(Math.abs(rail.min[1] + rail.size[1] / 2) < 0.006, `${name}: the rail looks the same from both sides`);
  }
});

test("paint, seats, lights, soil and walks are stated where a part has them", () => {
  for (const [name, part] of parts) {
    for (const material of part.recolour ?? []) assert.ok(materials.has(material), `${name}: ${material}`);
    if (part.group === "seat") assert.ok(part.seat?.length >= 3 && part.seat.length % 3 === 0, `${name}: seat points`);
    if (part.group === "lamp") assert.ok(part.light?.length >= 3 && part.light.length % 3 === 0, `${name}: light points`);
    if (part.group === "bed") assert.equal(part.soil?.length, 3, `${name}: soil height and half size`);
    if (part.group === "bridge") assert.ok(part.walk?.length >= 4 && part.width > 0, `${name}: deck heights`);
    if (part.group === "arch") assert.equal(part.clear?.length, 2, `${name}: the opening`);
  }
});
