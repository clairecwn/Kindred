// src/kingdom/items.js
//
// Everything that can stand on the Kingdom island, in one table. The
// placement rules (islandState.js), the scene (KingdomScene.js) and the
// tests all read it; nothing else decides what an item is.
//
// Sizes are in 1 m cells, [across, deep], as the piece faces the camera at
// rotation 0. `grove` is the Grove catalog id that owning it means: placing
// one reserves one owned copy, storing it gives the copy back.
// Mesh names are nodes in kingdom_kit.glb (assets/kingdom/blender).
//
// Plants:
//   stages      what is drawn at each stage: { mesh, scale }. Stage 0 is the
//               same seedling for every plant.
//   stageDays   real days spent in each stage before the next (one shorter
//               than stages)
//   harvest     base yield, how many extra a watered crop can give, and the
//               stage the plant goes back to afterwards. Nothing ever wilts.
//   variants    colours to choose from when planting. A colour repaints
//               exactly the materials KI_petalA and KI_petalB.

export const CELL = 1;

const S = (mesh, scale = 1) => ({ mesh, scale });
const SEEDLING = S("KK_Seedling");

function crop(id, label, mesh, grove, plural, stageDays, regrowStage = 1) {
  return {
    id, label, grove, kind: "crop", size: [1, 1], solid: false,
    stages: [SEEDLING, S(`KK_Crop_${mesh}_S2`), S(`KK_Crop_${mesh}_S3`), S(`KK_Crop_${mesh}`)],
    stageNames: ["just planted", "sprouting", "growing", "ready to harvest"],
    stageDays, waterable: true,
    harvest: { produce: id, label: plural, base: 1, waterBonus: 2, regrowStage },
  };
}

function flower(id, label, mesh, grove, variants, stageDays = [1, 1, 1], extra = {}) {
  return {
    id, label, grove, kind: "flower", size: [1, 1], solid: false,
    stages: [SEEDLING, S(`KK_${mesh}_S2`), S(`KK_${mesh}_S3`), S(`KK_${mesh}_S4`)],
    stageNames: ["just planted", "sprouting", "in bud", "in bloom"],
    stageDays, variants, ...extra,
  };
}

function tree(id, label, grove, bare, fruiting = null, plural = null) {
  const stages = [SEEDLING, S("KK_Tree_Sapling"), S(bare, 0.6), S(bare, 0.85)];
  const item = {
    id, label, grove, kind: "tree", size: [1, 1], solid: true, solidFrom: 1,
    stages, stageNames: ["just planted", "a sapling", "a young tree", "fully grown"], stageDays: [1, 2, 3],
    // Trunk and crown at scale 1, for the walk grid and the camera.
    tall: { trunk: 0.42, crown: 1.7, crownAt: 2.9 },
  };
  if (fruiting) {
    stages.push(S(fruiting, 0.85));
    item.stageNames.push("bearing fruit");
    item.stageDays.push(2);
    item.harvest = { produce: id, label: plural, base: 3, waterBonus: 0, regrowStage: 3 };
  }
  return item;
}

const PINK = [0xff7eb6, 0xffb91f], WHITE = [0xfffaec, 0xfbd000], YELLOW = [0xfbd000, 0xfffaec], PURPLE = [0x8b5fd9, 0xffb91f], RED = [0xe52521, 0xfbd000];

export const ITEMS = Object.freeze({
  bench: {
    id: "bench", label: "Garden Bench", grove: "gar-bench", kind: "decor",
    mesh: "KK_Bench", size: [2, 1], solid: true,
    seat: { y: 0.42, depth: 0.6 },
  },
  fence: {
    id: "fence", label: "Picket Fence", grove: "mak-fence", kind: "decor",
    mesh: "KK_Fence_Post", rail: "KK_Fence_Rail", size: [1, 1], solid: true, connects: true,
  },

  carrot:     crop("carrot", "Carrot", "Carrot", "gar-carrotseed", "carrots", [1, 1, 1]),
  cabbage:    crop("cabbage", "Cabbage", "Cabbage", "gar-cabbageseed", "cabbages", [1, 1, 2]),
  pumpkin:    crop("pumpkin", "Pumpkin", "Pumpkin", "gar-pumpkinseed", "pumpkins", [1, 2, 2]),
  tomato:     crop("tomato", "Tomato", "Tomato", "gar-tomatoseed", "tomatoes", [1, 1, 2], 2),
  corn:       crop("corn", "Corn", "Corn", "gar-cornseed", "corn cobs", [1, 2, 2]),
  strawberry: crop("strawberry", "Strawberry", "Strawberry", "gar-strawberryseed", "strawberries", [1, 1, 1], 2),

  daisy:     flower("daisy", "Daisy", "Daisy", "gar-daisyseed", { pink: { label: "Pink", colors: PINK }, white: { label: "White", colors: WHITE }, yellow: { label: "Yellow", colors: YELLOW }, purple: { label: "Purple", colors: PURPLE } }),
  tulip:     flower("tulip", "Tulip", "Tulip", "gar-tulipbulb", { red: { label: "Red", colors: RED }, yellow: { label: "Yellow", colors: [0xfbd000, 0xff8a2a] }, pink: { label: "Pink", colors: PINK }, purple: { label: "Purple", colors: PURPLE } }),
  sunflower: flower("sunflower", "Sunflower", "Sunflower", "gar-sunflowerseed", { yellow: { label: "Yellow", colors: [0xfbd000, 0xa8622b] } }, [1, 2, 2], { faces: true }),
  rose:      flower("rose", "Rose Bush", "Rose", "gar-rosebush", { red: { label: "Red", colors: [0xe52521, 0xb5211b] }, pink: { label: "Pink", colors: [0xff7eb6, 0xf45c8c] }, white: { label: "White", colors: [0xfffaec, 0xffe9a0] } }, [1, 2, 2]),
  lavender:  flower("lavender", "Lavender", "Lavender", "gar-lavenderseed", { purple: { label: "Purple", colors: [0x8b5fd9, 0x8b5fd9] }, blue: { label: "Blue", colors: [0x4f8fe8, 0x4f8fe8] } }),

  oak:    tree("oak", "Oak Tree", "gar-acorn", "KK_Tree_Round"),
  apple:  tree("apple", "Apple Tree", "gar-applesapling", "KK_Tree_Round", "KK_Tree_Apple", "apples"),
  orange: tree("orange", "Orange Tree", "gar-orangesapling", "KK_Tree_Citrus_Bare", "KK_Tree_Citrus", "oranges"),
});

export const ITEM_LIST = Object.freeze(Object.values(ITEMS));

/** Things owned once and used, never placed. */
export const TOOLS = Object.freeze({
  wateringCan: { grove: "gar-wateringcan", label: "Watering Can" },
});

/** What a harvest is called in the HUD, by produce name. */
export const PRODUCE_LABEL = Object.freeze(Object.fromEntries(
  ITEM_LIST.filter((item) => item.harvest).map((item) => [item.harvest.produce, item.harvest.label[0].toUpperCase() + item.harvest.label.slice(1)]),
));

/** Wild things a new island starts with, by kit mesh. `cell: false` means it
 * is only dressing: it takes no cell and building over it removes it. */
export const WILD = Object.freeze({
  KK_Tree_Round:    { label: "tree", solid: true, tall: true, trunk: 0.42, crown: 1.7, crownAt: 2.9 },
  KK_Bush:          { label: "bush", solid: true },
  KK_Rock:          { label: "rock", solid: true },
  KK_Campfire:      { label: "campfire", solid: true },
  KK_Log_Stool:     { label: "log stool", solid: true, seat: { y: 0.42, depth: 0.5 } },
  KK_Sign_Sprout:   { label: "marker", solid: true },
  KK_Flower_pink:   { label: "wild flower", solid: false },
  KK_Flower_yellow: { label: "wild flower", solid: false },
  KK_Flower_white:  { label: "wild flower", solid: false },
  KK_Flower_purple: { label: "wild flower", solid: false },
  KK_Grass_Tuft:    { label: "grass", solid: false, cell: false },
});

/** The house ladder. Built so far: tent to cabin. */
export const HOUSE = Object.freeze({
  size: [6, 6],
  stages: {
    tent:  { mesh: "KK_Tent", body: [3.4, 3.3], label: "Tent" },
    frame: { mesh: "KK_Cabin_Frame", body: [5.8, 5.2], label: "Cabin (being built)" },
    cabin: { mesh: "KK_Cabin", body: [5.8, 5.2], label: "Cabin" },
  },
  cabin: { cost: { grove: "mak-wood", label: "wood", count: 4 }, buildDays: 1 },
  // A roof colour repaints exactly the three materials KI_roofA/B/C.
  roofs: {
    red:   { label: "Red",   colors: [0xe52521, 0xf05236, 0xb5211b] },
    blue:  { label: "Blue",  colors: [0x049cd8, 0x38b6ea, 0x0478ac] },
    green: { label: "Green", colors: [0x43b047, 0x8fdc4e, 0x2e9a45] },
  },
});

export const ROOF_MATERIALS = Object.freeze(["KI_roofA", "KI_roofB", "KI_roofC"]);
export const PETAL_MATERIALS = Object.freeze(["KI_petalA", "KI_petalB"]);
