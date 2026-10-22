import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createWaterFlow, waterKind, WATER_SPEED } from "../../scene/water.js";

test("water parts are told apart by name", () => {
  assert.equal(waterKind("WATER_Atrium_Pool"), "rings");
  assert.equal(waterKind("WATER_Park_Bowl"), "rings");
  assert.equal(waterKind("WATER_Atrium_Fall"), "flow");
  assert.equal(waterKind("WATER_Park_Jets"), "flow");
  assert.equal(waterKind("Atrium_Fountain_Bloom"), null);
});

test("the water flows: each texture slides along V at its own pace, and only water moves", () => {
  const root = new THREE.Group();
  const make = (name) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: new THREE.Texture() }));
    mesh.name = name; root.add(mesh); return mesh;
  };
  const pool = make("WATER_Atrium_Pool"), fall = make("WATER_Atrium_Fall"), wall = make("Mall_Wall");
  const water = createWaterFlow(root);
  assert.equal(water.count, 2);
  for (let i = 0; i < 30; i++) water.update(1 / 60);
  assert.ok(Math.abs(pool.material.map.offset.y - WATER_SPEED.rings * 0.5) < 1e-6);
  assert.ok(Math.abs(fall.material.map.offset.y - WATER_SPEED.flow * 0.5) < 1e-6);
  assert.equal(wall.material.map.offset.y, 0);
  assert.equal(fall.material.transparent, true, "the falling sheet is see-through");
  assert.equal(fall.material.depthWrite, false);
  assert.equal(pool.material.map.wrapT, THREE.RepeatWrapping);
  // A model with no water in it is fine.
  assert.equal(createWaterFlow(new THREE.Group()).count, 0);
});
