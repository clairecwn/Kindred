// The life kit Blender exports (assets/kingdom/blender/passes/k24_export_life.py):
// every creature and effect the list names must be in the model file, stand on
// the ground (or float on the water), be of a sensible size, and every one the
// showcase island sets out must be a part of the kit.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const DIR = new URL("../../../public/models/env/kingdom/", import.meta.url);
const kit = JSON.parse(readFileSync(new URL("kingdom_life_kit.json", DIR), "utf8"));
const showcase = JSON.parse(readFileSync(new URL("kingdom_showcase.json", DIR), "utf8"));
const bytes = readFileSync(new URL("kingdom_life_kit.glb", DIR));
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
const nodes = new Set(gltf.nodes.map((node) => node.name));
const parts = Object.entries(kit.parts);

test("every part the life kit lists is in the model file, and every group is listed", () => {
  assert.deepEqual(parts.map(([name]) => name).filter((name) => !nodes.has(name)), []);
  assert.deepEqual(Object.values(kit.groups).flat().sort(), parts.map(([name]) => name).sort());
  for (const group of ["yard", "pond", "air", "effect", "boat"]) assert.ok(kit.groups[group]?.length > 0, `group ${group} has parts`);
  assert.ok(parts.length >= 18, "the kit has its animals, fliers, effects and the boat");
});

test("land creatures stand on the ground and floating parts sit on the water line", () => {
  for (const [name, part] of parts) {
    const low = part.min[2], top = low + part.size[2];
    if (part.floats) assert.ok(low <= 0.01 && top >= 0, `${name} sits on the water line`);      // the ripple is flat: it lies on the line
    else if (part.kind === "animal") assert.ok(Math.abs(low) < 0.03, `${name} stands on the ground (lowest point ${low})`);
    assert.ok(part.triangles <= 6000, `${name} has ${part.triangles} triangles`);      // the animals are rigged now (creatures.js): their stills are the rig posed, rounder than before
  }
});

test("each creature is the size it should be beside a 1.9 m character", () => {
  const tall = (name) => kit.parts[name].min[2] + kit.parts[name].size[2];
  assert.ok(tall("KL_Pony") > 1.4 && tall("KL_Pony") < 2.0, "a pony's ears reach about the character's head");
  assert.ok(tall("KL_Cow") > 1.2 && tall("KL_Cow") < 1.8);
  assert.ok(tall("KL_Sheep") > 0.7 && tall("KL_Sheep") < 1.2);
  assert.ok(tall("KL_Chicken") > 0.4 && tall("KL_Chicken") < 0.8);
  assert.ok(tall("KL_Chick") < 0.35 && tall("KL_Cat_Sit") < 0.8 && tall("KL_Duck") < 0.7);
  assert.ok(kit.parts.KL_Boat.size[1] > 3 && kit.parts.KL_Boat.size[1] < 5, "the boat is a small one");
  assert.ok(kit.parts.KL_Butterfly.size[0] < 0.7 && kit.parts.KL_Bird.size[2] < 0.45);
});

test("every pose belongs to a creature, and the butterfly's wing can be hinged", () => {
  for (const [creature, poses] of Object.entries(kit.creatures)) {
    for (const mesh of Object.values(poses)) assert.ok(kit.parts[mesh], `${creature}: ${mesh}`);
  }
  assert.deepEqual(Object.keys(kit.creatures.KL_Pony).sort(), ["graze", "stand"]);
  assert.deepEqual(Object.keys(kit.creatures.KL_Duck).sort(), ["stand", "swim"]);
  const wing = kit.parts.KL_Butterfly_Wing;
  assert.deepEqual(wing.hinge, [0, 0, 0]);
  assert.ok(wing.min[0] >= 0, "the wing lies on one side of its hinge");
  for (const name of ["KL_Pony", "KL_Cow", "KL_Chicken", "KL_Cat_Sit", "KL_Butterfly", "KL_Bird", "KL_Boat"]) assert.ok(kit.parts[name].paint?.A, `${name} can be recoloured`);
});

test("the showcase island's creatures come from the kit and are where they belong", () => {
  assert.ok(showcase.life.length >= 30);
  assert.deepEqual([...new Set(showcase.life.map((one) => one.mesh))].filter((mesh) => !kit.parts[mesh]), []);
  const boat = showcase.life.find((one) => one.mesh === "KL_Boat");
  assert.ok(boat.y < -2, "the boat floats on the sea, below the lawn");
  for (const one of showcase.life) {
    if (one.mesh === "KL_Duck_Swim") assert.ok(showcase.pond.some(([x, z]) => x === Math.floor(one.x) && z === Math.floor(one.z)), "a swimming duck is on the pond");
    if (kit.parts[one.mesh].kind === "animal" && !kit.parts[one.mesh].floats && one.mesh !== "KL_Cat_Sit") assert.equal(one.y, 0, `${one.mesh} stands on the lawn`);
  }
});
