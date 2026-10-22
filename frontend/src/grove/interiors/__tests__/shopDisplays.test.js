// Where the item models stand in each shop (public/models/items/shop_displays.json,
// written by assets/items/shop_displays.py). The mall itself is not changed by
// the displays, so these checks use the mall's own baked collision: a stand may
// only be on open floor, clear of the entry mat, and every item a shop sells
// must have a spot and a model.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseGroveCollision } from "../../player/collisionGrid.js";
import { CATALOG } from "../../economy/catalog.js";

const PUBLIC = new URL("../../../../public/models/", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, PUBLIC), "utf8"));
const displays = read("items/shop_displays.json");
const items = read("items/items.json").items;
const world = parseGroveCollision(read("env/grove/grove_collision.json"));
const glb = (path) => {
  const bytes = readFileSync(new URL(path, PUBLIC));
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
};
const kitNodes = new Set(glb(`items/${displays.kit}`).nodes.map((node) => node.name));
const shops = Object.entries(displays.shops);
// the shop's own frame to the game's, as the file says
const toGame = (shop, x, y) => [shop.game.x - shop.game.k * x, shop.game.z + shop.game.k * y];
const CATALOG_KEY = { "grove-grocer": "grocery", "home-nook": "furniture", "cafe-canopy": "eatery", "sole-search": "shoes", "pixel-pantry": "games",
  "maker-meadow": "maker", "seasonal-pop-up": "seasonal", "book-burrow": "books", alltimefitness: "wellness", "food-hall": "foodhall", "rooftop-garden": "gardenShop" };

test("every shop with a display shows exactly what it sells, each on a model that exists", () => {
  assert.equal(shops.length, 11, "Thread + Thimble is on hold; the other eleven shops have a display");
  for (const [id, shop] of shops) {
    const sold = CATALOG[CATALOG_KEY[id]].map((item) => item.id).sort();
    assert.deepEqual(Object.keys(shop.spots).sort(), sold, `${id}: one spot for each item on sale`);
    for (const itemId of sold) assert.equal(items[itemId].shop, id, `${itemId} has a model in this shop's file`);
  }
});

test("stands and their small parts are in the display kit", () => {
  for (const [id, shop] of shops) {
    for (const stand of shop.stands) assert.ok(kitNodes.has(stand.stand), `${id}: ${stand.stand}`);
    for (const extra of shop.extras) assert.ok(kitNodes.has(extra.mesh), `${id}: ${extra.mesh}`);
    const tags = shop.extras.filter((extra) => extra.mesh === "SD_Tag").map((extra) => extra.for).sort();
    assert.deepEqual(tags, Object.keys(shop.spots).sort(), `${id}: one price tag for each item`);
  }
});

test("every stand is on open floor inside its shop and clear of the entry mat", () => {
  for (const [id, shop] of shops) {
    const grid = world.mall[shop.floor].grid;
    for (const solid of shop.solids) {
      const box = "r" in solid ? [solid.cx - solid.r, solid.cx + solid.r, solid.cy - solid.r, solid.cy + solid.r] : [solid.x0, solid.x1, solid.y0, solid.y1];
      const [x0, x1, y0, y1] = box;
      assert.ok(x0 > -5.75 && x1 < 5.75 && y0 > -3.4 && y1 < 3.45, `${id}: inside the shop`);
      assert.ok(!(y0 < -2.69 && x0 < 1.6 && x1 > -1.6), `${id}: not on the entry mat`);
      for (let x = x0 + 0.06; x < x1; x += 0.12) {
        for (let y = y0 + 0.06; y < y1; y += 0.12) {
          if ("r" in solid && Math.hypot(x - solid.cx, y - solid.cy) > solid.r) continue;
          const [gx, gz] = toGame(shop, x, y);
          assert.ok(!grid.circleBlocked(gx, gz, 0.01), `${id}: a stand covers something solid at ${x.toFixed(2)}, ${y.toFixed(2)}`);
        }
      }
    }
  }
});

test("every item sits on its stand, facing the lane, and can be walked up to", () => {
  for (const [id, shop] of shops) {
    const grid = world.mall[shop.floor].grid;
    for (const [itemId, spot] of Object.entries(shop.spots)) {
      assert.ok(Math.abs(spot.x) < 5.75 && spot.y > -3.4 && spot.y < 3.45 && spot.z >= 0 && spot.z < 2.2, `${itemId}: inside the shop`);
      if (spot.stand !== null) {
        const stand = shop.stands[spot.stand];
        const [w, d] = displays.stands[stand.stand].size;
        assert.ok(Math.abs(spot.x - stand.x) <= w / 2 && Math.abs(spot.y - stand.y) <= d / 2, `${itemId}: on ${stand.stand}`);
      }
      // next to the item's stand (or next to the item, if it stands on the floor) a player can stand, inside the shop
      const own = shop.solids.find((solid) => (spot.stand !== null && solid.stand === spot.stand) || solid.item === itemId);
      const gap = (x, y) => {
        if (!own) return Math.hypot(x - spot.x, y - spot.y) - 0.55;
        if ("r" in own) return Math.max(0, Math.hypot(x - own.cx, y - own.cy) - own.r);
        return Math.hypot(Math.max(own.x0 - x, 0, x - own.x1), Math.max(own.y0 - y, 0, y - own.y1));
      };
      let reach = false;
      for (let x = -5.4; x < 5.4 && !reach; x += 0.125) {
        for (let y = -3.3; y < 3.3; y += 0.125) {
          if (gap(x, y) > 0.9) continue;
          const [gx, gz] = toGame(shop, x, y);
          const inStand = shop.solids.some((solid) => ("r" in solid
            ? Math.hypot(x - solid.cx, y - solid.cy) < solid.r + 0.36
            : x > solid.x0 - 0.36 && x < solid.x1 + 0.36 && y > solid.y0 - 0.36 && y < solid.y1 + 0.36));
          if (!inStand && !grid.circleBlocked(gx, gz, 0.36)) { reach = true; break; }
        }
      }
      assert.ok(reach, `${itemId}: there is a place to stand next to it`);
    }
  }
});
