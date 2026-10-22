// The finished world Blender exports (assets/kingdom/blender/passes/k20_export.py
// and k26_showcase.py): the beach can be walked to and all the way round, the
// land the island grows into joins on by its bridges, and the showcase island
// is a layout the game's own rules would allow.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeRuns, parseCollision } from "../kingdomAssets.js";

const DIR = new URL("../../../public/models/env/kingdom/", import.meta.url);
const read = (file) => JSON.parse(readFileSync(new URL(file, DIR), "utf8"));
const baked = read("kingdom_collision.json");
const layout = read("kingdom_layout.json");
const showcase = read("kingdom_showcase.json");
const decor = read("kingdom_decor_kit.json");
const house = read("kingdom_house_kit.json");
const collision = parseCollision(baked);
const CELL = baked.cell;
const LAWN = 1, BEACH = 5, STEPS = 6, BRIDGE = 7;

/** One or more baked blocks laid over each other (later ones on top) as one grid. Outside every block is sea. */
function compose(...blocks) {
  const minX = Math.min(...blocks.map((b) => b.minX)), minZ = Math.min(...blocks.map((b) => b.minZ));
  const maxX = Math.max(...blocks.map((b) => b.minX + b.nx * CELL)), maxZ = Math.max(...blocks.map((b) => b.minZ + b.nz * CELL));
  const nx = Math.round((maxX - minX) / CELL), nz = Math.round((maxZ - minZ) / CELL);
  const closed = new Uint8Array(nx * nz).fill(1), height = new Float32Array(nx * nz), surface = new Uint8Array(nx * nz);
  for (const b of blocks) {
    const n = b.nx * b.nz, g = decodeRuns(b.grid, n), h = decodeRuns(b.height, n), s = decodeRuns(b.surface, n);
    const ox = Math.round((b.minX - minX) / CELL), oz = Math.round((b.minZ - minZ) / CELL);
    for (let iz = 0; iz < b.nz; iz++) {
      for (let ix = 0; ix < b.nx; ix++) {
        const from = iz * b.nx + ix, to = (iz + oz) * nx + ix + ox;
        closed[to] = g[from] & 1; height[to] = baked.heightBase + h[from] * baked.heightStep; surface[to] = s[from];
      }
    }
  }
  const at = (x, z) => {
    const ix = Math.floor((x - minX) / CELL), iz = Math.floor((z - minZ) / CELL);
    return ix < 0 || iz < 0 || ix >= nx || iz >= nz ? -1 : iz * nx + ix;
  };
  return { nx, nz, closed, height, surface, at };
}

/** Every cell a walker can get to from (x, z): open cells, a step of at most half a metre at a time. */
function walk(land, x, z) {
  const start = land.at(x, z), seen = new Uint8Array(land.nx * land.nz), todo = [start];
  assert.ok(start >= 0 && !land.closed[start], "the walk starts on open ground");
  seen[start] = 1;
  while (todo.length) {
    const i = todo.pop(), ix = i % land.nx;
    for (const j of [i - 1, i + 1, i - land.nx, i + land.nx]) {
      if (j < 0 || j >= seen.length || seen[j] || land.closed[j]) continue;
      if (Math.abs((j % land.nx) - ix) > 1) continue;                        // no wrapping round the edge of the grid
      if (Math.abs(land.height[j] - land.height[i]) > 0.5) continue;
      seen[j] = 1; todo.push(j);
    }
  }
  return seen;
}
const count = (land, seen, kind) => { let open = 0, reached = 0; for (let i = 0; i < seen.length; i++) if (!land.closed[i] && land.surface[i] === kind) { open++; reached += seen[i]; } return { open, reached }; };

test("the block the game reads today is unchanged in form, and the new blocks sit beside it", () => {
  const { island, terrain, expansions } = baked;
  assert.equal(decodeRuns(island.grid, island.nx * island.nz).length, island.nx * island.nz);
  assert.ok(island.buildable > 1800, "most of the lawn can be built on");
  assert.equal(terrain.buildable, island.buildable, "both blocks agree on where building is allowed");
  assert.ok(terrain.cells[BEACH] > 9000 && terrain.cells[STEPS] > 300, "the terrain has a beach and steps");
  assert.deepEqual(Object.keys(expansions).sort(), ["east", "west"]);
});

test("every flight of steps takes a walker from the lawn down to the sand", () => {
  const land = compose(baked.terrain);
  assert.equal(layout.steps.length, 4);
  for (const flight of layout.steps) {
    const dx = flight.foot.x - flight.top.x, dz = flight.foot.z - flight.top.z, len = Math.hypot(dx, dz);
    let last = null;
    for (let d = -1.5; d <= len + 0.9; d += 0.25) {
      const i = land.at(flight.top.x + (dx / len) * d, flight.top.z + (dz / len) * d);
      assert.ok(i >= 0 && !land.closed[i], `${flight.name} is blocked ${d} m from its top`);
      if (last !== null) assert.ok(Math.abs(land.height[i] - last) <= 0.45, `${flight.name} has a step of ${(land.height[i] - last).toFixed(2)} m`);
      last = land.height[i];
      if (d === -1.5) assert.ok(Math.abs(last) < 0.06, `${flight.name} starts on the lawn`);
    }
    const end = land.at(flight.foot.x + (dx / len) * 0.9, flight.foot.z + (dz / len) * 0.9);
    assert.equal(land.surface[end], BEACH, `${flight.name} ends on the beach`);
    assert.ok(last < -1.5, `${flight.name} goes down to the sand`);
  }
});

test("from where the player arrives, the whole beach can be walked", () => {
  const land = compose(baked.terrain), seen = walk(land, layout.spawn.x, layout.spawn.z);
  const beach = count(land, seen, BEACH), lawn = count(land, seen, LAWN);
  assert.ok(beach.reached / beach.open > 0.99, `${beach.reached} of ${beach.open} beach cells reached`);
  assert.ok(lawn.reached / lawn.open > 0.99, `${lawn.reached} of ${lawn.open} lawn cells reached`);
  assert.equal(land.closed[land.at(layout.dock.end.x + 6, layout.dock.end.z - 1)], 1, "the sea beside the dock is closed");
});

test("new land is cut off until it is opened, and joined by its bridge after", () => {
  const home = compose(baked.terrain), before = walk(home, layout.spawn.x, layout.spawn.z);
  for (const [name, patch] of Object.entries(baked.expansions)) {
    const i0 = home.at(patch.centre.x, patch.centre.z);
    assert.ok(i0 < 0 || !before[i0], `the ${name} isle is out of reach before it is opened`);
    const land = compose(baked.terrain, patch), seen = walk(land, layout.spawn.x, layout.spawn.z);
    const spots = [[-4, 0], [-4, 4], [-4, -4], [0, 6]].map(([dx, dz]) => land.at(patch.centre.x + dx, patch.centre.z + dz));      // west and south of the middle: the east isle's terrace and its ramp stand to the north-east
    const lawn = spots.filter((i) => !land.closed[i] && land.surface[i] === LAWN);
    assert.ok(lawn.length >= 3, `the middle of the ${name} isle is lawn`);
    assert.ok(lawn.every((i) => seen[i]), `the ${name} isle is reached over its bridge`);
    assert.ok(count(land, seen, BRIDGE).reached > 100, `the ${name} bridge is walked`);
    assert.ok(patch.buildable > 150, `the ${name} isle has room to build`);
  }
  const all = compose(baked.terrain, ...Object.values(baked.expansions)), seen = walk(all, layout.spawn.x, layout.spawn.z), beach = count(all, seen, BEACH);
  assert.ok(beach.reached / beach.open > 0.97, `with both isles open ${beach.reached} of ${beach.open} beach cells are reached`);
});

// ---- the showcase island
const key = ([x, z]) => `${x},${z}`;
const cellsOf = (piece) => { const out = []; for (let x = 0; x < piece.cells[0]; x++) for (let z = 0; z < piece.cells[1]; z++) out.push([piece.cell[0] + x, piece.cell[1] + z]); return out; };
const pathCells = Object.values(showcase.paths).flat(), paths = new Set(pathCells.map(key)), water = new Set(showcase.pond.map(key));

test("every part of the showcase is a part the kits hold", () => {
  const known = new Set([...Object.keys(decor.parts), ...layout.kit, ...Object.keys(house.meshes)]);
  const wanted = [];
  for (const piece of showcase.pieces) wanted.push(piece.mesh, piece.leaf?.mesh, ...(piece.plants ?? []).map((plant) => plant.mesh));
  for (const thing of showcase.wild) wanted.push(thing.mesh);
  for (const b of showcase.buildings) {
    wanted.push(`KH_Body_${b.size}`, `KH_Roof_${b.roof}_${b.size}`, `KH_Door_${b.door}`, `KH_Window_${b.window}`, `KH_Porch_${b.porch}`);
    if (b.chimney) wanted.push(`KH_Chimney_${b.chimney}`);
    for (const [part, colour] of Object.entries(b.colours)) assert.ok(house.colours[part][colour], `${b.name}: ${part} colour ${colour}`);
  }
  for (const style of Object.keys(showcase.paths)) wanted.push(...Object.values(decor.sets.paths[style]));
  for (const fence of showcase.fences) wanted.push(...Object.values(decor.sets.fences[fence.style]));
  assert.deepEqual([...new Set(wanted.filter(Boolean))].filter((name) => !known.has(name)), []);
});

test("nothing in the showcase shares a cell, stands off the lawn or blocks a way", () => {
  const taken = new Map(), problems = [];
  const take = (cell, name, { lawn = true } = {}) => {
    const k = key(cell);
    if (taken.has(k)) problems.push(`${name} and ${taken.get(k)} share ${k}`);
    if (paths.has(k) || water.has(k)) problems.push(`${name} stands on a path or in the pond at ${k}`);
    if (lawn && !collision.buildable(cell[0], cell[1])) problems.push(`${name} is not on open lawn at ${k}`);
    taken.set(k, name);
  };
  for (const b of showcase.buildings) {
    const plot = new Set(); for (let x = 0; x < b.plot[2]; x++) for (let z = 0; z < b.plot[3]; z++) plot.add(key([b.plot[0] + x, b.plot[1] + z]));
    for (const cell of b.cells) take(cell, b.name, { lawn: plot.has(key(cell)) });      // a porch may stand on the end of the island's own path
  }
  for (const fence of showcase.fences) for (const cell of fence.cells) take(cell, `${fence.style} fence`);
  for (const piece of showcase.pieces) {
    if (piece.kind === "over") continue;                                               // an arch or a pergola: things pass under it
    if (piece.kind === "afloat") { for (const cell of cellsOf(piece)) assert.ok(water.has(key(cell)), `${piece.mesh} floats on the pond`); continue; }
    for (const cell of cellsOf(piece)) take(cell, piece.mesh);
  }
  for (const thing of showcase.wild) if (thing.takes) take([Math.floor(thing.x), Math.floor(thing.z)], thing.mesh);
  for (const cell of showcase.pond) assert.ok(collision.buildable(cell[0], cell[1]), `pond cell ${key(cell)} is on the lawn`);
  for (const cell of pathCells) assert.ok(!water.has(key(cell)), `path cell ${key(cell)} is not in the pond`);
  const gates = new Set(showcase.fences.flatMap((fence) => fence.gates.map((gate) => key(gate.cell))));
  for (const cell of showcase.clear) if (taken.has(key(cell)) && !gates.has(key(cell))) problems.push(`${taken.get(key(cell))} is in the way of steps or a bridge at ${key(cell)}`);
  assert.deepEqual(problems, []);
  assert.equal(new Set(pathCells.map(key)).size, pathCells.length, "no path cell is laid twice");
  assert.ok(taken.size > 400 && pathCells.length > 180 && showcase.pond.length >= 20, "the showcase is a developed island");
  assert.ok(taken.size + pathCells.length + showcase.pond.length < 0.45 * baked.island.buildable, "more than half the lawn is left open: the island is not crowded");
});

test("the showcase house stands on the plot the first cabin is built on", () => {
  const home = showcase.buildings.find((b) => b.name === "House");
  assert.equal(home.x, layout.site.x); assert.equal(home.z, layout.site.z);
  assert.equal(home.size, "Manor", "the showcase shows the biggest house");
  for (const b of showcase.buildings) assert.deepEqual(house.sizes[b.size].plot, b.plot.slice(2), `${b.name} takes its size's plot`);
});
