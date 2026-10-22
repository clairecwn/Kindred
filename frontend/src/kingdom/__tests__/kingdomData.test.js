// The files Blender exports (assets/kingdom/blender/passes/k20_export.py) and
// the item table the game reads must agree. This test fails when one changes
// without the other: a renamed kit mesh, a Day 1 thing standing where the
// house goes, a spawn point inside a post.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCollision } from "../kingdomAssets.js";
import { ITEMS, WILD, HOUSE } from "../items.js";
import { createIsland, siteCells, occupancy } from "../islandState.js";

const DIR = new URL("../../../public/models/env/kingdom/", import.meta.url);
const layout = JSON.parse(readFileSync(new URL("kingdom_layout.json", DIR), "utf8"));
const collision = parseCollision(JSON.parse(readFileSync(new URL("kingdom_collision.json", DIR), "utf8")));

test("every mesh the game asks for is in the exported kit", () => {
  const kit = new Set(layout.kit);
  const wanted = [
    ...Object.values(ITEMS).flatMap((item) => [item.mesh, item.rail, ...(item.stages ?? []).map((stage) => stage.mesh)]),
    "KK_Wet_Patch",
    ...Object.keys(WILD),
    ...Object.values(HOUSE.stages).map((stage) => stage.mesh),
  ].filter(Boolean);
  assert.deepEqual(wanted.filter((name) => !kit.has(name)), []);
});

test("every item is sold in the Grove under the id it names", async () => {
  const { CATALOG } = await import("../../grove/economy/catalog.js");
  const sold = new Set(Object.values(CATALOG).flat().map((entry) => entry.id));
  const { TOOLS } = await import("../items.js");
  const wanted = [...Object.values(ITEMS).map((item) => item.grove), ...Object.values(TOOLS).map((tool) => tool.grove), HOUSE.cabin.cost.grove];
  assert.deepEqual(wanted.filter((id) => !sold.has(id)), []);
});

test("the house plot is whole cells of open lawn", () => {
  assert.deepEqual(layout.site.cells, HOUSE.size);
  const cells = siteCells(layout.site);
  assert.equal(cells.length, 36);
  assert.deepEqual(cells.filter(([x, z]) => !collision.buildable(x, z)), []);
});

test("the player arrives on open ground and can walk to the lawn", () => {
  const { grid } = collision;
  assert.equal(grid.circleBlocked(layout.spawn.x, layout.spawn.z, 0.36), false);
  // straight up the dock and through the arch
  for (let z = layout.spawn.z; z > layout.dock.from.z - 5; z -= 0.25) assert.equal(grid.circleBlocked(0, z, 0.36), false, `blocked at z ${z}`);
});

test("the great tree's terrace is reached by its ramp and nowhere else", () => {
  const { grid } = collision;
  const { terrace } = layout, ramp = terrace.ramp, x = (ramp.x0 + ramp.x1) / 2;      // where Blender put the terrace and its ramp
  assert.ok(grid.groundAt(x, ramp.zTop + 0.6) > terrace.top - 0.1, "the terrace top is raised");            // where the ramp arrives
  let last = 0;
  for (let z = ramp.zFoot + 0.5; z > ramp.zTop + 0.6; z -= 0.25) {
    assert.equal(grid.circleBlocked(x, z, 0.36), false, `ramp blocked at z ${z}`);
    const h = grid.groundAt(x, z);
    assert.ok(h - last < 0.2, `a step of ${(h - last).toFixed(2)} m on the ramp at z ${z}`);     // a slope, never a wall
    last = h;
  }
  assert.equal(grid.circleBlocked(terrace.x + terrace.radius + 0.45, terrace.z, 0.2), true, "the terrace's cliff is closed");
});

test("there is room to build, and Day 1 leaves the plot, the path and the cells clear", () => {
  let buildable = 0;
  for (let x = -26; x < 26; x++) for (let z = -22; z < 26; z++) if (collision.buildable(x, z)) buildable++;
  assert.ok(buildable > 800, `only ${buildable} buildable cells`);
  const island = createIsland(null, layout);
  assert.ok(island.wild.length > 60);
  const plot = new Set(siteCells(layout.site).map(([x, z]) => `${x},${z}`));
  const seen = new Set();
  for (const w of island.wild) {
    if (WILD[w.mesh].cell === false) continue;
    const cell = `${Math.floor(w.x)},${Math.floor(w.z)}`;
    assert.equal(plot.has(cell), false, `${w.id} stands on the house plot`);
    assert.equal(seen.has(cell), false, `${w.id} shares a cell`);
    seen.add(cell);
    assert.equal(collision.buildable(Math.floor(w.x), Math.floor(w.z)), true, `${w.id} is not on open lawn`);
  }
  assert.equal(occupancy(island, layout.site).size, plot.size + seen.size);
});
