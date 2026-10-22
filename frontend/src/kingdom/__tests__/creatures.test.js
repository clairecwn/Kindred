// The rigged creatures Blender exports (assets/kingdom/blender/passes/k33_creatures.py)
// and the routine they live by (creatures.js).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { ROUTINE, nextPlan, startClip } from "../creatures.js";

const DIR = new URL("../../../public/models/env/kingdom/", import.meta.url);
const doc = JSON.parse(readFileSync(new URL("creatures/creatures.json", DIR), "utf8"));
const life = JSON.parse(readFileSync(new URL("kingdom_life_kit.json", DIR), "utf8"));
const glb = (file) => {
  const bytes = readFileSync(new URL(file, DIR));
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
};

test("every creature is a rigged model with the clips its list names, and a routine to live by", () => {
  const names = Object.keys(doc.creatures);
  for (const animal of ["Cow", "Pony", "Sheep", "Chicken", "Chick", "Duck", "Cat", "Bird", "Butterfly"]) assert.ok(names.includes(animal), animal);
  for (const [name, c] of Object.entries(doc.creatures)) {
    assert.ok(existsSync(new URL(c.file, DIR)), `${name}: ${c.file}`);
    const gltf = glb(c.file);
    assert.equal(gltf.skins?.length, 1, `${name} has one skeleton`);
    assert.ok(gltf.skins[0].joints.length >= 3, `${name} has bones`);
    assert.deepEqual(gltf.animations.map((a) => a.name).sort(), Object.keys(c.clips).sort(), `${name}: clips`);
    for (const a of gltf.animations) assert.ok(a.channels.length > 0, `${name} ${a.name} moves something`);
    assert.ok(ROUTINE[name], `${name} has a routine`);
    for (const clip of ROUTINE[name].rest ?? []) assert.ok(c.clips[clip], `${name} rests in ${clip}, a clip it has`);
    if (ROUTINE[name].swim) assert.ok(c.clips[ROUTINE[name].swim], `${name} can swim`);
    if (ROUTINE[name].roam) assert.ok(c.clips.Walk && c.speed > 0.1 && c.speed < 1.2, `${name} walks, at a sensible pace`);
    for (const still of c.stands_for) {
      assert.ok(life.parts[still], `${name} stands in for ${still}, a life kit part`);
      assert.ok(c.clips[startClip(still)], `${name} starts ${still} in ${startClip(still)}, a clip it has`);
    }
    assert.ok(c.triangles <= 6000, `${name}: ${c.triangles} triangles`);
  }
  const covered = new Set(Object.values(doc.creatures).flatMap((c) => c.stands_for));
  for (const [name, part] of Object.entries(life.parts)) if (part.kind === "animal") assert.ok(covered.has(name), `${name} has a living creature`);
});

test("a creature rests and wanders round its home, never into what blocks it, and rests after a walk", () => {
  let seed = 7; const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const home = { x: 10, z: -4 };
  let walks = 0, rests = 0;
  for (let i = 0; i < 400; i++) {
    const plan = nextPlan("Cow", { home, at: home, random, blocked: (x) => x > 11.5 });
    if (plan.to) {
      walks++;
      assert.equal(plan.clip, "Walk");
      assert.ok(Math.hypot(plan.to.x - home.x, plan.to.z - home.z) <= ROUTINE.Cow.roam + 1e-9);
      assert.ok(plan.to.x <= 11.5, "never to a blocked spot");
      const after = nextPlan("Cow", { home, at: plan.to, random, last: plan });
      assert.ok(!after.to && after.secs > 0, "after a walk, a rest");
    } else { rests++; assert.ok(ROUTINE.Cow.rest.includes(plan.clip) && plan.secs >= ROUTINE.Cow.restFor[0]); }
  }
  assert.ok(walks > 50 && rests > 50, `${walks} walks, ${rests} rests`);
  const swim = nextPlan("Duck", { home, at: home, swimming: true, random });
  assert.equal(swim.clip, "Swim", "a duck on the pond only swims");
  assert.equal(nextPlan("Bird", { home, at: home, random }).to, undefined, "a bird on its perch stays there");
  assert.equal(startClip("KL_Pony_Graze"), "Eat"); assert.equal(startClip("KL_Duck_Swim"), "Swim"); assert.equal(startClip("KL_Cat_Sit"), "Sit"); assert.equal(startClip("KL_Sheep"), "Idle");
});

test("the camp and decor pieces that move are rigged models with their loop, each standing in for a kit piece", () => {
  const props = JSON.parse(readFileSync(new URL("props/props.json", DIR), "utf8")).props;
  const kitNodes = new Set([...glb("kingdom_kit.glb").nodes, ...glb("kingdom_decor_kit.glb").nodes].map((n) => n.name));
  for (const name of ["Campfire", "Tent", "Lily", "Reeds", "Swing"]) assert.ok(props[name], name);
  for (const [name, p] of Object.entries(props)) {
    const gltf = glb(p.file);
    assert.equal(gltf.skins?.length, 1, `${name} is rigged`);
    assert.ok(gltf.animations.some((a) => a.name === p.loop && a.channels.length > 0), `${name} plays ${p.loop}`);
    if (p.stands_for === null) assert.ok(Object.values(props).some((q) => q.flame === name), `${name} is part of another piece`);
    else assert.ok(kitNodes.has(p.stands_for), `${name} takes the place of ${p.stands_for}, a kit piece`);
    assert.ok(p.triangles < 6000, `${name}: ${p.triangles} triangles`);
  }
  assert.ok(props.Campfire.fire, "the campfire gets light, sparks and smoke");
  assert.ok(props[props.Campfire.flame]?.billboard, "the campfire has its flame, which turns to face the camera");
});
