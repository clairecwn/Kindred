// src/grove/interiors/escalatorMath.js
//
// The moving-escalator maths, kept free of three.js so it runs under
// `node --test`. Everything here works from one thing only: the rest
// positions of an escalator's steps, as authored in the Grove Blender file
// (nodes named ESC_<pair>_<Up|Down>_Step_<nn>, index 00 where a step enters
// its run, so a step always travels toward the next index).
//
// A chain is described along its own axis: `s` is the horizontal distance
// travelled from the entry end, `q` the sideways offset from the lane's
// centre line. Steps sit one tread ("pitch") apart in `s` and stay level;
// their height is the path height at their `s`. The first and last step of a
// chain rest hidden under the landing plates, which is where the loop wraps.

export const ESCALATOR = Object.freeze({
  floorHeight: 5,
  beltSpeed: 1.05, // m/s along the floor plan; a calm ride of about six seconds
  walkSpeed: 1.7, // stepping on and off the landing plates
  laneHalfWidth: 0.95, // balustrade to balustrade
  endMargin: 0.3, // solid footprint past each end of the chain
  openingReach: 1.6, // extra blocked length over the floor opening on the upper level
  lowBelow: 3.3, // treads lower than this above a floor have their truss within head height of it
  boardFrom: -1.7, // boarding zone, measured from the entry end of the chain
  boardTo: 0.2, // up to the comb: someone who steps onto the landing plate from the side is taken too
  boardHalfWidth: 0.6,
  boardMinSpeed: 0.35, // the player has to be walking onto it, not just standing nearby
  releaseBeyond: 1.7, // where the rider is set down past the exit end: clear of the handrail ends, so they can step off to either side at once
  rampNear: 0.25, // landing surface blends to the floor between these two distances
  rampFar: 0.85,
});

const mod = (value, length) => ((value % length) + length) % length;
const smooth = (t) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };

/** @param {{id:string, direction:"up"|"down", points:Array<{x:number,y:number,z:number}>}} spec */
export function buildChain({ id, direction, points }, config = ESCALATOR) {
  const n = points.length;
  if (n < 4) throw new Error(`escalator ${id}: needs at least four steps, got ${n}`);
  const first = points[0], last = points[n - 1];
  const run = Math.hypot(last.x - first.x, last.z - first.z);
  if (run < 1e-6) throw new Error(`escalator ${id}: steps do not span any distance`);
  const pitch = run / (n - 1);
  const ux = (last.x - first.x) / run, uz = (last.z - first.z) / run;
  const heights = points.map((p) => p.y);
  return {
    id, direction, n, pitch, ux, uz, heights,
    length: n * pitch,
    originX: first.x - ux * pitch / 2,
    originZ: first.z - uz * pitch / 2,
    heading: Math.atan2(ux, uz),
    entryFloor: Math.round(heights[0] / config.floorHeight),
    exitFloor: Math.round(heights[n - 1] / config.floorHeight),
  };
}

/** Height of the tread surface at distance `s` (flat past either end). */
export function treadHeight(chain, s) {
  const f = s / chain.pitch - 0.5;
  if (f <= 0) return chain.heights[0];
  if (f >= chain.n - 1) return chain.heights[chain.n - 1];
  const i = Math.floor(f), t = f - i;
  return chain.heights[i] + (chain.heights[i + 1] - chain.heights[i]) * t;
}

export function pointAt(chain, s, q = 0) {
  return { x: chain.originX + chain.ux * s - chain.uz * q, z: chain.originZ + chain.uz * s + chain.ux * q };
}

export function project(chain, x, z) {
  const dx = x - chain.originX, dz = z - chain.originZ;
  return { s: dx * chain.ux + dz * chain.uz, q: -dx * chain.uz + dz * chain.ux };
}

/** Where step `index` is along the chain at time `t` (seconds). */
export function stepDistance(chain, index, t, config = ESCALATOR) {
  return mod((index + 0.5) * chain.pitch + config.beltSpeed * t, chain.length);
}

export function stepPosition(chain, index, t, config = ESCALATOR) {
  const s = stepDistance(chain, index, t, config);
  const p = pointAt(chain, s);
  return { x: p.x, y: treadHeight(chain, s), z: p.z, s };
}

/** Height of whatever the rider stands on at `s`: floor, landing plate or tread. */
export function riderSurface(chain, s, config = ESCALATOR) {
  const span = config.rampFar - config.rampNear;
  if (s < 0) {
    const floor = chain.entryFloor * config.floorHeight;
    return floor + (chain.heights[0] - floor) * (1 - smooth((-s - config.rampNear) / span));
  }
  if (s > chain.length) {
    const floor = chain.exitFloor * config.floorHeight;
    const last = chain.heights[chain.n - 1];
    return floor + (last - floor) * (1 - smooth((s - chain.length - config.rampNear) / span));
  }
  return treadHeight(chain, s);
}

/** The part of a level this escalator makes unwalkable, as an axis-aligned
 * box, or null when the chain does not touch that level. On its upper level
 * the box also covers the opening the escalator rises through; on its lower
 * level it stops where the escalator is high enough to walk under. Only used
 * when the baked collision grid is missing (the grid knows all of this from
 * the model itself). */
export function chainBlock(chain, floor, config = ESCALATOR) {
  if (floor !== chain.entryFloor && floor !== chain.exitFloor) return null;
  let s0 = -config.endMargin, s1 = chain.length + config.endMargin;
  if (floor === Math.max(chain.entryFloor, chain.exitFloor) && chain.entryFloor !== chain.exitFloor) {
    if (chain.entryFloor < chain.exitFloor) s0 -= config.openingReach; else s1 += config.openingReach;
  } else if (chain.entryFloor !== chain.exitFloor) {
    // On its lower level an escalator is only in the way where it is low.
    // Past the point where it has climbed above head height there is open
    // floor beneath it, and a box there would be an invisible wall.
    const level = floor * config.floorHeight;
    const low = (s) => treadHeight(chain, s) - level < config.lowBelow;
    if (chain.entryFloor < chain.exitFloor) {
      let s = 0;
      while (s < chain.length && low(s)) s += 0.1;
      s1 = Math.min(s1, s + config.endMargin);
    } else {
      let s = chain.length;
      while (s > 0 && low(s)) s -= 0.1;
      s0 = Math.max(s0, s - config.endMargin);
    }
  }
  const corners = [pointAt(chain, s0, -config.laneHalfWidth), pointAt(chain, s0, config.laneHalfWidth),
    pointAt(chain, s1, -config.laneHalfWidth), pointAt(chain, s1, config.laneHalfWidth)];
  return {
    minX: Math.min(...corners.map((c) => c.x)), maxX: Math.max(...corners.map((c) => c.x)),
    minZ: Math.min(...corners.map((c) => c.z)), maxZ: Math.max(...corners.map((c) => c.z)),
    label: "grove-mall-escalator",
  };
}

/** The chain the player is walking onto, if any. `player` = {x, z, vx, vz}. */
export function findBoarding(chains, player, floor, config = ESCALATOR) {
  for (const chain of chains) {
    if (chain.entryFloor !== floor) continue;
    const { s, q } = project(chain, player.x, player.z);
    if (s < config.boardFrom || s > config.boardTo || Math.abs(q) > config.boardHalfWidth) continue;
    if ((player.vx ?? 0) * chain.ux + (player.vz ?? 0) * chain.uz < config.boardMinSpeed) continue;
    return chain;
  }
  return null;
}

export function startRide(chain, x, z) {
  const { s, q } = project(chain, x, z);
  return { chain, phase: "approach", s, q, step: -1, done: false };
}

/** Advance a ride by `dt` with the chain clock at `t` (the same clock that
 * drives stepPosition). Returns the rider's pose for this frame. */
export function advanceRide(ride, dt, t, config = ESCALATOR) {
  const { chain } = ride;
  const comb = chain.pitch; // entry comb: the first step is fully under the plate
  const offAt = (chain.n - 1) * chain.pitch - 0.12; // just before the exit comb
  let walking = false;
  if (ride.phase === "approach") {
    walking = true;
    ride.s += config.walkSpeed * dt;
    ride.q -= Math.sign(ride.q) * Math.min(Math.abs(ride.q), 1.4 * dt);
    if (ride.s >= comb) {
      ride.s = comb;
      let best = -1, bestS = Infinity;
      for (let i = 0; i < chain.n; i++) {
        const s = stepDistance(chain, i, t, config);
        if (s >= comb && s < bestS) { best = i; bestS = s; }
      }
      ride.step = best;
      ride.phase = "settle";
    }
  } else if (ride.phase === "settle") {
    // The chosen step is at most one tread ahead: catch it up, then stand on it.
    const target = stepDistance(chain, ride.step, t, config);
    ride.q -= Math.sign(ride.q) * Math.min(Math.abs(ride.q), 1.4 * dt);
    ride.s = Math.min(target, ride.s + (config.beltSpeed + 1.2) * dt);
    if (target - ride.s < 1e-4) ride.phase = "ride";
  } else if (ride.phase === "ride") {
    const s = stepDistance(chain, ride.step, t, config);
    ride.q = 0;
    if (s >= offAt || s < ride.s) { ride.s = Math.max(ride.s, offAt); ride.phase = "leave"; } else ride.s = s;
  } else if (ride.phase === "leave") {
    walking = true;
    ride.s += config.walkSpeed * dt;
    const end = chain.length + config.releaseBeyond;
    if (ride.s >= end) { ride.s = end; ride.done = true; }
  }
  const p = pointAt(chain, ride.s, ride.q);
  const speed = walking && !ride.done ? config.walkSpeed : 0;
  return {
    x: p.x, z: p.z, y: riderSurface(chain, ride.s, config), heading: chain.heading,
    vx: chain.ux * speed, vz: chain.uz * speed, phase: ride.phase, done: ride.done,
  };
}
