// src/grove/economy/catalog.js
//
// Cosmetic-only wares for the enterable buildings of the Commons. Prices are small
// and readable (tens to low hundreds) — nothing here is a journaling,
// social, or task feature; coins only ever buy decoration and cosmetics.
// Stock "rotates daily" by deterministically picking a subset flagged
// `isNewToday`, seeded from the calendar date so it is stable within a
// day and different the next — NEVER a countdown timer. No randomised
// purchase outcomes anywhere: every price buys exactly the item shown.

// Small deterministic PRNG (matches the one already used in GroveScene.js)
// so "today's picks" are stable across reloads within the same day.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayNumber(date = new Date()) {
  return Math.floor(date.getTime() / 86400000);
}

// Each item: id, label, price (coins), shape (a tiny procedural-geometry
// descriptor the interior builder turns into a display-case mesh, so no
// binary assets are ever needed), and the shop it belongs to.
export const CATALOG = Object.freeze({
  grocery: [
    { id: "gro-breadloaf", label: "Warm Loaf", price: 18, shape: { kind: "box", color: 0xd2a05e } },
    { id: "gro-honeyjar", label: "Honey Jar", price: 45, shape: { kind: "jar", color: 0xe8a840 } },
    { id: "gro-fruitbowl", label: "Bowl of Plums", price: 32, shape: { kind: "sphere", color: 0x9b6a9b } },
    { id: "gro-teatin", label: "Tin of Leaves", price: 38, shape: { kind: "cylinder", color: 0x6fa38a } },
    { id: "gro-eggbasket", label: "Egg Basket", price: 26, shape: { kind: "box", color: 0xe6d3a4 } },
    { id: "gro-seedpack", label: "Packet of Seeds", price: 15, shape: { kind: "box", color: 0x8fbf63 } },
    { id: "gro-plantpot", label: "Little Plant Pot", price: 35, shape: { kind: "potPlant", color: 0x6bae82 } },
  ],
  furniture: [
    { id: "fur-stool", label: "Wonky Stool", price: 40, shape: { kind: "cylinder", color: 0xa8764a } },
    { id: "fur-lamp", label: "Reading Lamp", price: 85, shape: { kind: "lamp", color: 0xe8845a } },
    { id: "fur-rug", label: "Round Rug", price: 60, shape: { kind: "mat", color: 0xc4744a } },
    { id: "fur-shelf", label: "Small Shelf", price: 95, shape: { kind: "box", color: 0x7a5233 } },
    { id: "fur-birdhouse", label: "Birdhouse", price: 65, shape: { kind: "birdhouse", color: 0xa86a3a } },
    { id: "fur-planter", label: "Window Planter", price: 55, shape: { kind: "potPlant", color: 0x8fb89a } },
  ],
  boutique: [
    { id: "bou-scarf", label: "Woven Scarf", price: 55, shape: { kind: "torus", color: 0x9b72cf } },
    { id: "bou-strawhat", label: "Straw Hat", price: 40, shape: { kind: "cone", color: 0xd9b26a } },
    { id: "bou-cardigan", label: "Soft Cardigan", price: 90, shape: { kind: "box", color: 0xd98a9b } },
    { id: "bou-boots", label: "Sturdy Boots", price: 75, shape: { kind: "box", color: 0x7a5233 } },
    { id: "bou-pin", label: "Enamel Pin", price: 12, shape: { kind: "sphere", color: 0x5b9b8a } },
    { id: "bou-shawl", label: "Evening Shawl", price: 110, shape: { kind: "mat", color: 0xa98bd1 } },
  ],
  home: [
    { id: "hom-cushion", label: "Floor Cushion", price: 30, shape: { kind: "cylinder", color: 0xd98a9b } },
    { id: "hom-kettle", label: "Little Kettle", price: 50, shape: { kind: "teapot", color: 0x5b9b8a } },
    { id: "hom-lantern", label: "Paper Lantern", price: 65, shape: { kind: "sphere", color: 0xffcf7a } },
    { id: "hom-chime", label: "Wind Chime", price: 90, shape: { kind: "cylinderTall", color: 0xbfd8e0 } },
    { id: "hom-mat", label: "Doormat", price: 22, shape: { kind: "mat", color: 0xa8764a } },
    { id: "hom-pot", label: "Windowsill Fern", price: 35, shape: { kind: "potPlant", color: 0x74b05a } },
  ],
  general: [
    { id: "gen-strawhat", label: "Straw Hat", price: 40, shape: { kind: "cone", color: 0xd9b26a } },
    { id: "gen-lantern", label: "Paper Lantern", price: 65, shape: { kind: "sphere", color: 0xffcf7a } },
    { id: "gen-teacup", label: "Painted Teacup", price: 25, shape: { kind: "cylinder", color: 0xe8845a } },
    { id: "gen-scarf", label: "Woven Scarf", price: 55, shape: { kind: "torus", color: 0x9b72cf } },
    { id: "gen-windchime", label: "Wind Chime", price: 90, shape: { kind: "cylinderTall", color: 0xbfd8e0 } },
    { id: "gen-plantpot", label: "Little Plant Pot", price: 35, shape: { kind: "potPlant", color: 0x6bae82 } },
  ],
  eatery: [
    { id: "eat-mug", label: "Cocoa Mug", price: 20, shape: { kind: "cylinder", color: 0x8a5a34 } },
    { id: "eat-tart", label: "Berry Tart", price: 30, shape: { kind: "tart", color: 0xc0546a } },
    { id: "eat-teapot", label: "Garden Teapot", price: 70, shape: { kind: "teapot", color: 0x5b9b8a } },
    { id: "eat-honeyjar", label: "Honey Jar", price: 45, shape: { kind: "jar", color: 0xe8a840 } },
    { id: "eat-picnicmat", label: "Picnic Mat", price: 60, shape: { kind: "mat", color: 0xd4a853 } },
  ],
  workshop: [
    { id: "wor-lamp", label: "Desk Lamp", price: 80, shape: { kind: "lamp", color: 0xe8845a } },
    { id: "wor-toolbox", label: "Tiny Toolbox", price: 50, shape: { kind: "box", color: 0x6a5a48 } },
    { id: "wor-birdhouse", label: "Birdhouse", price: 65, shape: { kind: "birdhouse", color: 0xa86a3a } },
    { id: "wor-gearclock", label: "Gear Clock", price: 110, shape: { kind: "torus", color: 0x8a8a8a } },
    { id: "wor-jarofbolts", label: "Jar of Bolts", price: 20, shape: { kind: "jar", color: 0x9fb0b8 } },
  ],
  shoes: [
    { id: "sho-cloudstep", label: "Cloudstep Sneakers", price: 88, shape: { kind: "box", color: 0xe8845a } },
    { id: "sho-rainboot", label: "Rainpath Boots", price: 82, shape: { kind: "box", color: 0x5b9b8a } },
    { id: "sho-sunsandal", label: "Sunloop Sandals", price: 54, shape: { kind: "torus", color: 0xd9b26a } },
    { id: "sho-ankleboot", label: "Moss Ankle Boots", price: 96, shape: { kind: "box", color: 0x7a5233 } },
    { id: "sho-sockroll", label: "Comfy Sock Roll", price: 18, shape: { kind: "cylinder", color: 0xa98bd1 } },
  ],
  games: [
    { id: "gam-handheld", label: "Pocket Console", price: 120, shape: { kind: "box", color: 0x5b9b8a } },
    { id: "gam-controller", label: "Meadow Controller", price: 72, shape: { kind: "box", color: 0x9b72cf } },
    { id: "gam-headphones", label: "Cloud Headphones", price: 84, shape: { kind: "torus", color: 0xd98a9b } },
    { id: "gam-adventure", label: "Tiny Adventure Game", price: 48, shape: { kind: "box", color: 0xe8a840 } },
    { id: "gam-collectible", label: "Pixel Pal Figure", price: 36, shape: { kind: "sphere", color: 0x6bae82 } },
  ],
  maker: [
    { id: "mak-toolbox", label: "Pocket Toolbox", price: 58, shape: { kind: "box", color: 0xc4744a } },
    { id: "mak-yarn", label: "Soft Yarn Ball", price: 22, shape: { kind: "sphere", color: 0xa98bd1 } },
    { id: "mak-paint", label: "Meadow Paint Tin", price: 32, shape: { kind: "cylinder", color: 0x6bae82 } },
    { id: "mak-sewing", label: "Mini Sewing Machine", price: 135, shape: { kind: "box", color: 0xe8c87a } },
    { id: "mak-birdhouse", label: "Build-a-Birdhouse Kit", price: 68, shape: { kind: "birdhouse", color: 0xa8764a } },
  ],
  seasonal: [
    { id: "sea-gift", label: "Wrapped Grove Gift", price: 45, shape: { kind: "box", color: 0xd98a9b } },
    { id: "sea-lantern", label: "Festival Lantern", price: 64, shape: { kind: "sphere", color: 0xffcf7a } },
    { id: "sea-ribbon", label: "Celebration Ribbon", price: 24, shape: { kind: "torus", color: 0x9b72cf } },
    { id: "sea-tree", label: "Tabletop Evergreen", price: 78, shape: { kind: "potPlant", color: 0x6bae82 } },
  ],
  books: [
    { id: "boo-fieldguide", label: "Grove Field Guide", price: 42, shape: { kind: "box", color: 0x6fa38a } },
    { id: "boo-storybook", label: "Lanternfall Stories", price: 38, shape: { kind: "box", color: 0xc4744a } },
    { id: "boo-sketchbook", label: "Pocket Sketchbook", price: 28, shape: { kind: "box", color: 0xd9b26a } },
    { id: "boo-cookbook", label: "Hearthlight Recipes", price: 46, shape: { kind: "box", color: 0xe8845a } },
    { id: "boo-journal", label: "Clothbound Journal", price: 34, shape: { kind: "box", color: 0xa98bd1 } },
  ],
  wellness: [
    { id: "wel-candle", label: "Willow Candle", price: 32, shape: { kind: "cylinder", color: 0xffcf7a } },
    { id: "wel-yogamat", label: "Quiet Yoga Mat", price: 58, shape: { kind: "mat", color: 0x8fb89a } },
    { id: "wel-cushion", label: "Meditation Cushion", price: 44, shape: { kind: "cylinder", color: 0xa98bd1 } },
    { id: "wel-bathoil", label: "Willow Bath Oil", price: 39, shape: { kind: "jar", color: 0x5b9b8a } },
    { id: "wel-balmbottle", label: "Calm Balm", price: 26, shape: { kind: "jar", color: 0xd9b26a } },
  ],
  foodhall: [
    { id: "foo-noodlebowl", label: "Garden Noodle Bowl", price: 28, shape: { kind: "cylinder", color: 0xe8a840 } },
    { id: "foo-ricebowl", label: "Sunroot Rice Bowl", price: 24, shape: { kind: "cylinder", color: 0xe6d3a4 } },
    { id: "foo-fruitcup", label: "Moonberry Cup", price: 18, shape: { kind: "cylinder", color: 0x9b72cf } },
    { id: "foo-teatray", label: "Tea and Tart Tray", price: 34, shape: { kind: "mat", color: 0xc4744a } },
    { id: "foo-soup", label: "Hearth Broth", price: 22, shape: { kind: "cylinder", color: 0xa8764a } },
  ],
  gardenShop: [
    { id: "gar-fern", label: "Windowsill Fern", price: 35, shape: { kind: "potPlant", color: 0x74b05a } },
    { id: "gar-flowerpot", label: "Moonflower Pot", price: 48, shape: { kind: "potPlant", color: 0x9b72cf } },
    { id: "gar-seeds", label: "Wildflower Seeds", price: 16, shape: { kind: "box", color: 0x8fbf63 } },
    { id: "gar-planter", label: "Garden Planter", price: 72, shape: { kind: "box", color: 0xa8764a } },
    { id: "gar-bench", label: "Small Garden Bench", price: 115, shape: { kind: "box", color: 0x7a5233 } },
  ],
  stage: [
    { id: "sta-mask", label: "Painted Mask", price: 55, shape: { kind: "mask", color: 0xd4a853 } },
    { id: "sta-lantern2", label: "Stage Lantern", price: 70, shape: { kind: "sphere", color: 0xffe28a } },
    { id: "sta-drum", label: "Hand Drum", price: 85, shape: { kind: "cylinder", color: 0x9b6a3a } },
    { id: "sta-ribbon", label: "Victory Ribbon", price: 30, shape: { kind: "torus", color: 0x9b72cf } },
    { id: "sta-confettijar", label: "Confetti Jar", price: 40, shape: { kind: "jar", color: 0xe8845a } },
  ],
});

/** Returns the ids flagged "new today" for one shop — deterministic per
 * calendar day, framed in the UI as "New Today", never a ticking timer. */
export function todaysPicks(shopId, count = 2) {
  const items = CATALOG[shopId] ?? [];
  if (items.length === 0) return new Set();
  const rand = mulberry32(dayNumber() * 2654435761 + hashString(shopId));
  const idxs = items.map((_, i) => i);
  // Fisher-Yates using the seeded rand, take the first `count`.
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return new Set(idxs.slice(0, Math.min(count, items.length)).map((i) => items[i].id));
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
