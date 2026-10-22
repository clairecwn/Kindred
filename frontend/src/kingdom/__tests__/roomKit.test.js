// The interior room kit Blender exports (assets/kingdom/blender/passes/k23_export_room.py):
// every shell, part and finish the list names must be in the model file, rooms
// must sit on the half-metre grid, and every example room must fit its walls.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const DIR = new URL("../../../public/models/env/kingdom/", import.meta.url);
const kit = JSON.parse(readFileSync(new URL("kingdom_room_kit.json", DIR), "utf8"));
const bytes = readFileSync(new URL("kingdom_room_kit.glb", DIR));
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
const nodes = new Set(gltf.nodes.map((node) => node.name));
const materials = new Map(gltf.materials.map((material) => [material.name, material]));
const allParts = { ...kit.parts.windows, ...kit.parts.wall, ...kit.parts.floor };
for (const [width, beam] of Object.entries(kit.parts.beams)) allParts[`Beam_${width}`] = beam;
for (const name of Object.keys(kit.parts.windows)) { allParts[`Window_${name}`] = kit.parts.windows[name]; delete allParts[name]; }

test("every shell, part and finish sample is in the model file", () => {
  const wanted = [...Object.values(kit.rooms), ...Object.values(allParts)].map((part) => part.mesh);
  for (const kind of Object.values(kit.finishes)) wanted.push(...Object.values(kind).map((finish) => finish.sample));
  assert.deepEqual(wanted.filter((name) => !nodes.has(name)), []);
});

test("rooms are on the half-metre grid, open at the front, and every house has its rooms", () => {
  for (const [name, room] of Object.entries(kit.rooms)) {
    const [w, d] = room.inside;
    assert.deepEqual(room.cells, [w / kit.snap, d / kit.snap], `${name}: cells`);
    assert.ok(Number.isInteger(room.cells[0]) && Number.isInteger(room.cells[1]), `${name}: whole cells`);
    assert.ok(room.min[1] > -d / 2 - 0.4, `${name}: nothing stands in front of the open side`);
    assert.ok(room.min[2] + room.size[2] >= kit.height, `${name}: walls reach their height`);
    assert.ok(nodes.has(room.beam), `${name}: has a beam of its width`);
  }
  for (const [house, rooms] of Object.entries(kit.houses)) for (const room of rooms) assert.ok(kit.rooms[room], `${house}: ${room}`);
});

test("finishes carry a picture, and the tinted ones can be repainted", () => {
  for (const [kind, table] of Object.entries(kit.finishes)) {
    assert.ok(Object.keys(table).length >= 3, `${kind}: at least three finishes`);
    for (const [name, finish] of Object.entries(table)) {
      const pbr = materials.get(finish.material)?.pbrMetallicRoughness;
      assert.ok(pbr?.baseColorTexture, `${kind} ${name}: has its picture`);
      if (finish.tint) assert.ok(pbr.baseColorFactor && pbr.baseColorFactor.slice(0, 3).some((v) => v < 0.99), `${kind} ${name}: its colour is the tint`);
    }
  }
  assert.ok(materials.get(kit.recolour.floor)?.pbrMetallicRoughness?.baseColorTexture, "the default floor is a finish too");
  for (const name of [kit.recolour.wall, ...kit.recolour.trim]) assert.ok(materials.has(name), name);
});

test("wall parts stand against their wall and nothing is below the floor", () => {
  for (const [name, part] of Object.entries(allParts)) {
    const onFloor = name === "Stair_Down" || name === "Doormat" || name.startsWith("Beam");
    if (!onFloor) assert.ok(part.min[1] + part.size[1] <= 0.03 && part.min[1] + part.size[1] >= -0.01, `${name}: its back is on the wall`);
    if (!name.startsWith("Window") && name !== "Sconce") assert.ok(part.min[2] > -0.011, `${name}: nothing below the floor`);
    assert.ok(part.triangles <= 2400, `${name}: ${part.triangles} triangles`);
  }
});

test("every example room can be built: known parts, inside the walls, under the wall top", () => {
  assert.equal(kit.examples.length, Object.keys(kit.rooms).length);
  for (const example of kit.examples) {
    const room = kit.rooms[example.room];
    const [w, d] = room.inside;
    assert.ok(kit.finishes.floor[example.finish.floor], `${example.room}: floor ${example.finish.floor}`);
    if (example.finish.wall) assert.ok(kit.finishes.wall[example.finish.wall], `${example.room}: wall ${example.finish.wall}`);
    for (const [name, wall, u, z] of example.parts) {
      const part = allParts[name];
      assert.ok(part, `${example.room}: ${name}`);
      if (wall === "floor") continue;
      const run = wall === "back" ? w : d;
      const lo = wall === "back" ? -w / 2 : -d / 2 + 0.2;
      // along a side wall the part is turned, so its x runs along y (left wall) or against it (right wall)
      const [a, b] = wall === "right" ? [u - (part.min[0] + part.size[0]), u - part.min[0]] : [u + part.min[0], u + part.min[0] + part.size[0]];
      assert.ok(a >= lo - 0.03 && b <= run / 2 + 0.03, `${example.room}: ${name} on the ${wall} wall runs ${a.toFixed(2)} to ${b.toFixed(2)}`);
      assert.ok(z + part.min[2] + part.size[2] <= kit.height + 0.12, `${example.room}: ${name} is under the wall top`);
    }
  }
});
