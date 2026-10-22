// The item models Blender exports (assets/items/blender/passes/i20_export.py)
// against the Grove's catalog. Every thing the mall sells must have a 3D
// model, and what items.json says about a model must be true of the file.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { CATALOG } from "../../grove/economy/catalog.js";

const DIR = new URL("../../../public/models/items/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("items.json", DIR), "utf8"));
// The catalogs of the mall's twelve shops (GroveMallInterior.js SHOPS).
const MALL = ["grocery", "boutique", "furniture", "eatery", "shoes", "games", "maker", "seasonal", "books", "wellness", "foodhall", "gardenShop"];
const TYPES = new Set(["floor", "table", "wall", "hang", "rug", "wear", "pack"]);

function nodeNames(file) {
  const bytes = readFileSync(new URL(file, DIR));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString("utf8"));
  return { nodes: new Set(json.nodes.map((node) => node.name)), materials: new Set((json.materials ?? []).map((m) => m.name)) };
}

test("every item the mall sells has a model", () => {
  const sold = MALL.flatMap((key) => CATALOG[key].map((entry) => entry.id));
  assert.deepEqual(sold.filter((id) => !manifest.items[id]), []);
});

test("every listed model is in the file the list names", () => {
  const cache = new Map();
  const missing = [];
  for (const [id, item] of Object.entries(manifest.items)) {
    assert.ok(existsSync(new URL(item.file, DIR)), `${item.file} exists`);
    if (!cache.has(item.file)) cache.set(item.file, nodeNames(item.file));
    const file = cache.get(item.file);
    if (!file.nodes.has(item.model)) missing.push(`${id}: node ${item.model}`);
    for (const part of Object.values(item.recolour)) if (!file.materials.has(part.material)) missing.push(`${id}: material ${part.material}`);
  }
  assert.deepEqual(missing, []);
});

test("every item keeps to the standard", () => {
  const bad = [];
  for (const [id, item] of Object.entries(manifest.items)) {
    if (!TYPES.has(item.type)) bad.push(`${id}: type ${item.type}`);
    const [w, d, h] = item.size;
    const [cw, cd] = item.cells;
    const fits = item.type === "wall" ? w <= cw + 0.002 && h <= cd + 0.002 : w <= cw + 0.002 && d <= cd + 0.002;
    if (!fits) bad.push(`${id}: ${w} x ${d} x ${h} does not fit ${cw} x ${cd}`);
    if (Math.max(w, d, h) < 0.18) bad.push(`${id}: smaller than 0.18 m`);
    // Origin: on the floor, on the wall, or where it hangs from.
    const [, minY, minZ] = item.min;
    if (item.type === "wall" && Math.abs(minY + d) > 0.006) bad.push(`${id}: back is not on the wall`);
    if (item.type === "hang" && Math.abs(minZ + h) > 0.006) bad.push(`${id}: does not hang from its origin`);
    if (!["wall", "hang"].includes(item.type) && Math.abs(minZ) > 0.006) bad.push(`${id}: base is not on the floor`);
  }
  assert.deepEqual(bad, []);
});
