// The house kit Blender exports (assets/kingdom/blender/passes/k21_export_house.py):
// every part the list names must be in the model file, every size must have
// its sockets, and the materials a house is recoloured by must exist.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const DIR = new URL("../../../public/models/env/kingdom/", import.meta.url);
const kit = JSON.parse(readFileSync(new URL("kingdom_house_kit.json", DIR), "utf8"));
const bytes = readFileSync(new URL("kingdom_house_kit.glb", DIR));
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
const nodes = new Set(gltf.nodes.map((node) => node.name));
const materials = new Set(gltf.materials.map((material) => material.name));

test("every part the kit lists is in the model file", () => {
  const wanted = [];
  for (const size of Object.values(kit.sizes)) {
    wanted.push(...Object.values(size.meshes), ...Object.values(size.roofs).map((roof) => roof.mesh));
  }
  for (const group of Object.values(kit.parts)) wanted.push(...Object.values(group).map((part) => part.mesh));
  assert.deepEqual(wanted.filter((name) => !nodes.has(name)), []);
});

test("every size has a door, a porch, a roof and windows that sit on its walls", () => {
  for (const [name, size] of Object.entries(kit.sizes)) {
    const [w, d, h] = size.body;
    const { door, porch, roof, windows } = size.sockets;
    assert.equal(door[1], -d / 2, `${name}: the door is on the front wall`);
    assert.equal(door[2], kit.base, `${name}: the door stands on the floor line`);
    assert.equal(porch[2], 0, `${name}: the porch is on the ground`);
    assert.equal(roof[2], h, `${name}: the roof sits on the wall top`);
    assert.ok(windows.length >= 2, `${name}: has windows`);
    for (const [x, y, z] of windows) {
      const onWall = Math.abs(Math.abs(x) - w / 2) < 1e-6 || Math.abs(Math.abs(y) - d / 2) < 1e-6;
      assert.ok(onWall, `${name}: window at ${x}, ${y} is on a wall`);
      assert.ok(z + 0.8 < h, `${name}: window at height ${z} is below the cornice`);
    }
    assert.ok(w <= size.plot[0] && d <= size.plot[1], `${name}: the body fits its plot`);
  }
});

test("the materials a house is recoloured by are in the file, and every example can be built", () => {
  const missing = Object.values(kit.recolour).flat().filter((name) => !materials.has(name));
  assert.deepEqual(missing, []);
  for (const example of kit.examples) {
    const size = kit.sizes[example.size];
    assert.ok(size.roofs[example.roof], `${example.size}: roof ${example.roof}`);
    assert.ok(kit.parts.doors[example.door].sizes.includes(example.size), `${example.size}: door ${example.door} fits`);
    assert.ok(kit.parts.porches[example.porch].sizes.includes(example.size), `${example.size}: porch ${example.porch} fits`);
    assert.ok(kit.parts.windows[example.window], `${example.size}: window ${example.window}`);
  }
});
