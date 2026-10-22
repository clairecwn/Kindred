import test from "node:test";
import assert from "node:assert/strict";
import {
  ESCALATOR, buildChain, treadHeight, pointAt, project, stepDistance, stepPosition, riderSurface,
  chainBlock, findBoarding, startRide, advanceRide,
} from "../escalatorMath.js";

// The rig exactly as pass 4 authors it in Blender: 21 steps one tread apart,
// one hidden under each landing plate, 40 degrees in between. Game axes
// (y up, z = -Blender y). `top` is the x of the upper landing's outer edge.
// The upper pair is the lower one turned half a turn about x = `turn`, so the
// two criss-cross (pass 4 does the same to the model).
function rig({ top, lowFloor, laneZ, direction, turn }) {
  const zb = lowFloor * 5, zt = zb + 5, zc = zb + 0.12, lift = 0.012;
  const x1 = top + 0.9, x2 = x1 + (zt - zc) / Math.tan((40 * Math.PI) / 180);
  const run = (x2 - x1) / 18, slope = (zt - zc) / (x2 - x1);
  const points = [];
  for (let k = -1; k < 20; k++) {
    const x = x1 + (k + 0.5) * run;
    points.push({ x, y: zc + Math.min(Math.max((x2 + run / 2 - x) * slope, 0), zt - zc) + lift, z: laneZ });
  }
  if (turn !== undefined) for (const p of points) p.x = 2 * turn - p.x;
  if (direction === "up") points.reverse(); // index 0 is where a step enters its run
  return buildChain({ id: `test-${direction}-${lowFloor}`, direction, points });
}
const mall = () => [
  rig({ top: -12, lowFloor: 0, laneZ: 1.15, direction: "up" }),
  rig({ top: -12, lowFloor: 0, laneZ: -1.15, direction: "down" }),
  rig({ top: -22.1, lowFloor: 1, laneZ: -1.15, direction: "up", turn: -17.55 }),
  rig({ top: -22.1, lowFloor: 1, laneZ: 1.15, direction: "down", turn: -17.55 }),
];
const PLAYER_RADIUS = 0.52;
const UPPER = [{ minX: -29.2, maxX: -10.4, minZ: -21.2, maxZ: 21.2 }, { minX: 10.4, maxX: 29.2, minZ: -21.2, maxZ: 21.2 },
  { minX: -10.8, maxX: 10.8, minZ: 9.7, maxZ: 16.3 }, { minX: -10.8, maxX: 10.8, minZ: -16.3, maxZ: -9.7 }];
function standable(chains, floor, x, z) {
  const regions = floor === 0 ? [{ minX: -29.2, maxX: 29.2, minZ: -21.2, maxZ: 21.2 }] : UPPER;
  if (!regions.some((r) => x >= r.minX + PLAYER_RADIUS && x <= r.maxX - PLAYER_RADIUS && z >= r.minZ + PLAYER_RADIUS && z <= r.maxZ - PLAYER_RADIUS)) return false;
  if (floor === 0 && Math.hypot(x, z) < 2.0 + PLAYER_RADIUS) return false; // fountain
  for (const chain of chains) {
    const box = chainBlock(chain, floor);
    if (!box) continue;
    const nx = Math.max(box.minX, Math.min(x, box.maxX)), nz = Math.max(box.minZ, Math.min(z, box.maxZ));
    if (Math.hypot(x - nx, z - nz) < PLAYER_RADIUS) return false;
  }
  return true;
}
function rideToEnd(chain, start, clock = 0) {
  const ride = startRide(chain, start.x, start.z);
  const dt = 1 / 60; let t = clock, pose = null, maxJump = 0, maxLift = 0, last = null; const phases = new Set();
  for (let i = 0; i < 60 * 40 && !ride.done; i++) {
    t += dt; pose = advanceRide(ride, dt, t); phases.add(pose.phase);
    if (last) { maxJump = Math.max(maxJump, Math.hypot(pose.x - last.x, pose.z - last.z)); maxLift = Math.max(maxLift, Math.abs(pose.y - last.y)); }
    last = pose;
  }
  return { pose, seconds: t - clock, maxJump, maxLift, phases, ride };
}

test("a chain is read from its step rest positions", () => {
  const [up, down] = mall();
  assert.equal(up.n, 21);
  assert.ok(Math.abs(up.pitch - 0.3231) < 1e-3);
  assert.equal(up.entryFloor, 0); assert.equal(up.exitFloor, 1);
  assert.equal(down.entryFloor, 1); assert.equal(down.exitFloor, 0);
  assert.ok(up.ux < -0.999, "the up lane climbs toward -x");
  assert.ok(down.ux > 0.999, "the down lane descends toward +x");
});

test("steps stay one tread apart, level with the path, and loop under the plates", () => {
  for (const chain of mall()) {
    for (const t of [0, 0.13, 1.7, 25.5]) {
      const s = Array.from({ length: chain.n }, (_, i) => stepDistance(chain, i, t)).sort((a, b) => a - b);
      for (let i = 1; i < s.length; i++) assert.ok(Math.abs(s[i] - s[i - 1] - chain.pitch) < 1e-9);
      for (let i = 0; i < chain.n; i++) {
        const p = stepPosition(chain, i, t);
        assert.ok(p.s >= 0 && p.s < chain.length);
        assert.ok(Math.abs(p.y - treadHeight(chain, p.s)) < 1e-9);
      }
    }
    // At rest every step is exactly where Blender put it.
    for (let i = 0; i < chain.n; i++) assert.ok(Math.abs(stepPosition(chain, i, 0).y - chain.heights[i]) < 1e-9);
    // A step only wraps while it is flat and hidden: same height either side of the seam.
    assert.ok(Math.abs(treadHeight(chain, 0) - chain.heights[0]) < 1e-9);
    assert.ok(Math.abs(treadHeight(chain, chain.length - 1e-6) - chain.heights[chain.n - 1]) < 1e-9);
    assert.ok(Math.abs(chain.heights[0] - chain.heights[1]) < 1e-9, "entry landing is flat");
    assert.ok(Math.abs(chain.heights[chain.n - 1] - chain.heights[chain.n - 2]) < 1e-9, "exit landing is flat");
  }
});

test("project and pointAt are inverses", () => {
  for (const chain of mall()) {
    const p = pointAt(chain, 2.4, -0.3), back = project(chain, p.x, p.z);
    assert.ok(Math.abs(back.s - 2.4) < 1e-9 && Math.abs(back.q + 0.3) < 1e-9);
  }
});

test("boarding needs the right level, the lane, and walking onto it", () => {
  const chains = mall(); const [up] = chains;
  const at = pointAt(up, -1.0, 0.2);
  assert.equal(findBoarding(chains, { ...at, vx: up.ux * 2, vz: 0 }, 0), up);
  assert.equal(findBoarding(chains, { ...at, vx: 0, vz: 0 }, 0), null, "standing still does not board");
  assert.equal(findBoarding(chains, { ...at, vx: -up.ux * 2, vz: 0 }, 0), null, "walking away does not board");
  assert.equal(findBoarding(chains, { ...at, vx: up.ux * 2, vz: 0 }, 1), null, "wrong level");
  const wide = pointAt(up, -1.0, 0.9);
  assert.equal(findBoarding(chains, { ...wide, vx: up.ux * 2, vz: 0 }, 0), null, "beside the lane");
});

test("every boarding zone can be reached on foot and every ride ends on walkable floor", () => {
  const chains = mall();
  for (const chain of chains) {
    let reachable = 0;
    for (let s = ESCALATOR.boardFrom; s <= ESCALATOR.boardTo; s += 0.05) {
      const p = pointAt(chain, s, 0);
      if (standable(chains, chain.entryFloor, p.x, p.z)) reachable++;
    }
    assert.ok(reachable >= 8, `${chain.id}: boarding zone reachable (${reachable} samples)`);
    const end = pointAt(chain, chain.length + ESCALATOR.releaseBeyond, 0);
    assert.ok(standable(chains, chain.exitFloor, end.x, end.z), `${chain.id}: release point is free`);
    // Arriving must not drop the rider straight into another boarding zone.
    assert.equal(findBoarding(chains, { ...end, vx: chain.ux * 3, vz: chain.uz * 3 }, chain.exitFloor), null, `${chain.id}: no chained boarding on arrival`);
  }
});

test("a ride carries the player to the next level and sets them down", () => {
  for (const chain of mall()) {
    for (const clock of [0, 0.11, 3.3]) {
      const start = pointAt(chain, -1.1, 0.35);
      const { pose, seconds, maxJump, maxLift, phases } = rideToEnd(chain, start, clock);
      assert.ok(pose.done, `${chain.id}: ride finishes`);
      assert.deepEqual([...phases].sort(), ["approach", "leave", "ride", "settle"].sort());
      assert.ok(Math.abs(pose.y - chain.exitFloor * 5) < 1e-9, `${chain.id}: ends at the arrival level, got ${pose.y}`);
      const end = pointAt(chain, chain.length + ESCALATOR.releaseBeyond, 0);
      assert.ok(Math.hypot(pose.x - end.x, pose.z - end.z) < 1e-9);
      assert.ok(seconds > 5 && seconds < 12, `${chain.id}: ride takes ${seconds.toFixed(1)} s`);
      assert.ok(maxJump < 0.06, `${chain.id}: no teleporting (largest frame move ${maxJump.toFixed(3)} m)`);
      assert.ok(maxLift < 0.05, `${chain.id}: height changes smoothly (largest frame change ${maxLift.toFixed(3)} m)`);
    }
  }
});

test("on the steps the rider stays on one tread", () => {
  const [up] = mall(); const ride = startRide(up, ...Object.values(pointAt(up, -1.0, 0)));
  const dt = 1 / 60; let t = 0, checked = 0;
  while (!ride.done && t < 40) {
    t += dt; const pose = advanceRide(ride, dt, t);
    if (pose.phase === "ride") {
      const step = stepPosition(up, ride.step, t);
      assert.ok(Math.hypot(pose.x - step.x, pose.z - step.z) < 1e-9 && Math.abs(pose.y - step.y) < 1e-9);
      checked++;
    }
  }
  assert.ok(checked > 200);
});

test("rider height starts at the departure level", () => {
  for (const chain of mall()) {
    assert.ok(Math.abs(riderSurface(chain, ESCALATOR.boardFrom) - chain.entryFloor * 5) < 1e-9);
    assert.ok(Math.abs(riderSurface(chain, chain.length + ESCALATOR.releaseBeyond) - chain.exitFloor * 5) < 1e-9);
  }
});

test("an escalator blocks its footprint, and the floor opening on its upper level", () => {
  const [up, , up2] = mall();
  assert.equal(chainBlock(up, 2), null);
  const ground = chainBlock(up, 0), upper = chainBlock(up, 1);
  assert.ok(ground.maxZ - ground.minZ > 1.8 && ground.maxX - ground.minX > 3.5);
  assert.ok(ground.minX > -10, "on the ground floor it stops where the escalator is overhead: no invisible wall under its high end");
  assert.ok(upper.maxX > ground.maxX + 1.5, "upper-level block reaches over the opening");
  const top = chainBlock(up2, 2), foot = chainBlock(up2, 1);
  assert.ok(top.maxX > -13.6 && top.minX < -21.5, "covers the Level 3 opening");
  assert.ok(foot.maxX < -15.5, "and on Level 2 leaves the floor under its high end free, where riders from below step off");
});
