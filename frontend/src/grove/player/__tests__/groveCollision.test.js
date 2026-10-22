import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseGroveCollision } from "../collisionGrid.js";
import { PLAYER_RADIUS } from "../PlayerController.js";

// The baked file is produced by assets/grove/bake_collision.py from the
// staged models. These checks pin the places that matter most.
const baked = JSON.parse(readFileSync(new URL("../../../../public/models/env/grove/grove_collision.json", import.meta.url), "utf8"));
const world = parseGroveCollision(baked);
const open = (grid, x, z) => !grid.circleBlocked(x, z, PLAYER_RADIUS);

test("arrival points on every level are open floor", () => {
  const [l1, l2, l3] = world.mall.map((zone) => zone.grid);
  assert.ok(open(l1, 0, -12.8), "mall spawn");
  assert.ok(open(l1, 0, -20.6), "mall exit");
  assert.ok(open(world.park.grid, 0, -43.5), "park spawn");
  assert.ok(open(world.park.grid, 0, -23.7), "park side of the mall doors");
  for (const grid of [l1, l2, l3]) {
    assert.ok(open(grid, 21.5, 0) && open(grid, 20.5, 1.9), "in front of the lift doors");
    assert.ok(!open(grid, 24.9, 0), "the lift shaft itself is closed to walkers");
    assert.ok(open(grid, -9.35, 15.2) && open(grid, -7.65, 15.2), "the foot and the head of the stairs");
  }
  for (const [grid, x, z] of [[l1, -6.3, 1.15], [l2, -16.3, 1.15], [l3, -14.2, 1.15], [l2, -15.9, -1.15], [l2, -25.5, -1.15]]) {
    assert.ok(open(grid, x, z), "escalator boarding point");
  }
});

test("the atrium is open on the ground and a drop on the upper levels", () => {
  const [l1, l2, l3] = world.mall.map((zone) => zone.grid);
  assert.ok(open(l1, 6, 0), "ground floor, beside the fountain");
  assert.ok(!open(l1, 0, 0), "the fountain itself");
  for (const grid of [l2, l3]) {
    assert.ok(!open(grid, 6, 0), "no walking on air over the atrium");
    assert.ok(!open(grid, -10.2, 6), "the balcony railing");
    assert.ok(open(grid, -12.5, 6), "the balcony walkway");
    assert.ok(open(grid, 0, -13), "the bridge across");
  }
});

test("walls stop the camera and every level has somewhere to sit", () => {
  const l1 = world.mall[0].grid;
  // Looking back from just inside the east wall: the wall is within reach.
  assert.ok(l1.cameraReach(28, 0, 1, 0, 8) < 2.5);
  // Along the open concourse the camera gets its full length.
  assert.equal(l1.cameraReach(-20, 0, 0, -1, 6), 6);
  for (const zone of [...world.mall, world.park]) assert.ok(zone.seats.length >= 4);
});

test("mats and rugs carry their height, bare floor is zero", () => {
  const l1 = world.mall[0].grid;
  assert.equal(l1.groundAt(-20, 0), 0, "open concourse");
  const mat = l1.groundAt(-20, 10.95);      // the Cafe's doormat
  assert.ok(mat > 0.08 && mat < 0.2, `doormat height ${mat}`);
});

test("seats face their table, their backrest decides otherwise, and the beanbags are there", () => {
  const seats = (level, match) => world.mall[level].seats.filter((s) => match.test(s.name));
  const facing = (s) => [Math.sin(s.heading), Math.cos(s.heading)];
  // Food Hall benches (level 3) sit either side of the table at z = -12.5: each faces it.
  const food = seats(2, /Food_Communal_Bench/);
  assert.equal(food.length, 6);
  for (const s of food) {
    assert.ok(s.table, "at a table");
    assert.ok(Math.sign(facing(s)[1]) === Math.sign(-12.5 - s.z), "faces the table, not the room");
  }
  // Cafe stools face their own round table.
  for (const s of seats(0, /Cafe_Stool/)) {
    const tx = s.x < -19 ? -20.95 : -16.65, tz = s.x < -19 ? -13.25 : -12.85;
    const [fx, fz] = facing(s);
    assert.ok(fx * (tx - s.x) + fz * (tz - s.z) > 0.6, "toward the table");
  }
  assert.equal(seats(2, /Food_Standing_Stool/).filter((s) => s.table).length, 3, "bar stools face the bar");
  assert.equal(seats(1, /Beanbag/).length, 2);
  for (const zone of world.mall) for (const s of zone.seats) assert.ok(s.y >= 0.3, `${s.name} is a body-height seat`);
});
