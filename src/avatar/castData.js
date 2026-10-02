/**
 * castData.js — the single source of truth for who the cast are and what
 * they can wear. Mirrors public/models/kindred_cast.json and
 * kindred_wardrobe.json so UI code can read this synchronously without a
 * fetch; the JSON files stay authoritative for the Blender side.
 *
 * Every cast member shares one 20-bone rig and the same 11 clips, so
 * wardrobe meshes and animations are interchangeable across all of them.
 *
 * `presents` gates the wardrobe: an item shows for a character when the
 * item is "any" or matches that character's own `presents` value. That is
 * what keeps skirts and dresses out of a short-haired masc character's
 * wardrobe and vice versa.
 */

export const MODEL_BASE = "/models/";
export const WARDROBE_MODEL = "kindred_wardrobe";

export const CAST = [
  {
    id: "kai", name: "Kai", model: "kindred_char01", presents: "masc",
    hair: "short side-swept", vibe: "steady, easygoing, the one who shows up",
    palette: { skin: 0xEBC9A8, hair: 0x6B4A33 },
  },
  {
    id: "alex", name: "Alex", model: "kindred_tobi", presents: "masc",
    hair: "tall textured crop, high hairline", vibe: "playful troublemaker with a soft centre",
    palette: { skin: 0xAD7A5C, hair: 0x1D191B },
  },
  {
    id: "bella", name: "Bella", model: "kindred_juno", presents: "femme",
    hair: "high ponytail with face-framing locks", vibe: "bright and bouncy, first one out the door",
    palette: { skin: 0xE5B48C, hair: 0xD87E3E },
  },
  {
    id: "tate", name: "Tate", model: "kindred_wren", presents: "femme",
    hair: "long, centre part, waves past the shoulders", vibe: "quiet and observant, listens more than talks",
    palette: { skin: 0xF2D8C6, hair: 0x372E33 },
  },
  {
    id: "lara", name: "Lara", model: "kindred_sage", presents: "femme",
    hair: "side braid", vibe: "warm and unhurried, makes the tea",
    palette: { skin: 0x8B6049, hair: 0x4A352D },
  },
];

/* No `cloth` in the palettes: each body already carries its own designed
   outfit, in two tones (Kai's orange tee over blue shorts, and so on).
   Seeding one cloth colour repaints the shirt and the pants to the same
   value and flattens that. A player-chosen cloth tone still overrides it. */

/* The `model` keys are the GLB filenames the Blender exporter writes and are
   deliberately NOT renamed with the characters: the id is what the game and
   every save refer to, the filename is an internal asset path. */

export const CAST_IDS = CAST.map((c) => c.id);
export const DEFAULT_CHARACTER = "kai";

export function getCharacter(id) {
  return CAST.find((c) => c.id === id) ?? CAST[0];
}

export const SLOTS = {
  TOP: "top", BOTTOM: "bottom", HEAD: "head",
  FACE: "face", NECK: "neck", BACK: "back",
};
export const SLOT_LIST = Object.values(SLOTS);

/** kind: "skin" = skinned garment rebound to the character's skeleton;
 *        "attach" = rigid mesh parented to one bone. */
export const WARDROBE_ITEMS = [
  { id: "top_tee",      slot: "top",    presents: "any",   kind: "skin",   meshes: ["Top_Tee"],      label: "Cotton tee",      tint: "w_tee" },
  { id: "top_hoodie",   slot: "top",    presents: "any",   kind: "skin",   meshes: ["Top_Hoodie"],   label: "Hoodie",          tint: "w_hoodie" },
  { id: "top_button",   slot: "top",    presents: "masc",  kind: "skin",   meshes: ["Top_Button"],   label: "Button-up shirt", tint: "w_oxford" },
  { id: "top_bomber",   slot: "top",    presents: "masc",  kind: "skin",   meshes: ["Top_Bomber", "Top_BomberTrim"], label: "Bomber jacket", tint: "w_bomber" },
  { id: "top_cardigan", slot: "top",    presents: "femme", kind: "skin",   meshes: ["Top_Cardigan"], label: "Knit cardigan",   tint: "w_cardi" },
  { id: "dress",        slot: "top",    presents: "femme", kind: "skin",   meshes: ["Dress"],        label: "Pinafore dress",  tint: "w_rose", covers: ["bottom"] },

  { id: "bottom_joggers",  slot: "bottom", presents: "any",   kind: "skin", meshes: ["Bottom_Joggers"],  label: "Joggers",      tint: "w_jogger" },
  { id: "bottom_overalls", slot: "bottom", presents: "any",   kind: "skin", meshes: ["Bottom_Overalls"], label: "Overalls",     tint: "w_denim" },
  { id: "bottom_cargo",    slot: "bottom", presents: "masc",  kind: "skin", meshes: ["Bottom_Cargo"],    label: "Cargo shorts", tint: "w_cargo" },
  { id: "bottom_skirt",    slot: "bottom", presents: "femme", kind: "skin", meshes: ["Bottom_Skirt"],    label: "A-line skirt", tint: "w_mustard" },

  { id: "head_cap",     slot: "head", presents: "any",   kind: "attach", meshes: ["Acc_Cap", "Acc_CapTrim"], label: "Ball cap" },
  { id: "head_beanie",  slot: "head", presents: "any",   kind: "attach", meshes: ["Acc_Beanie"],     label: "Knit beanie",   tint: "a_sage" },
  { id: "head_flower",  slot: "head", presents: "femme", kind: "attach", meshes: ["Acc_FlowerClip"], label: "Flower clip" },
  { id: "face_glasses", slot: "face", presents: "any",   kind: "attach", meshes: ["Acc_Glasses"],    label: "Round glasses" },
  { id: "neck_scarf",   slot: "neck", presents: "any",   kind: "attach", meshes: ["Acc_Scarf"],      label: "Wool scarf",    tint: "a_terracotta" },
  { id: "back_pack",    slot: "back", presents: "any",   kind: "attach", meshes: ["Acc_Backpack"],   label: "Day pack",      tint: "a_clay" },
];

const ITEM_BY_ID = new Map(WARDROBE_ITEMS.map((i) => [i.id, i]));
export function getItem(id) { return ITEM_BY_ID.get(id) ?? null; }

/** Items a given character is allowed to wear, optionally for one slot. */
export function itemsFor(characterId, slot = null) {
  const { presents } = getCharacter(characterId);
  return WARDROBE_ITEMS.filter(
    (i) => (i.presents === "any" || i.presents === presents) && (!slot || i.slot === slot),
  );
}

/** Drop any equipped ids this character can't wear, and clear a slot
 *  covered by another item (a dress covers the bottom slot). */
export function sanitizeEquipped(characterId, equipped = {}) {
  const allowed = new Set(itemsFor(characterId).map((i) => i.id));
  const out = {};
  for (const slot of SLOT_LIST) {
    const id = equipped[slot];
    out[slot] = id && allowed.has(id) && getItem(id)?.slot === slot ? id : null;
  }
  for (const slot of SLOT_LIST) {
    const item = out[slot] && getItem(out[slot]);
    if (item?.covers) for (const c of item.covers) out[c] = null;
  }
  return out;
}

export const SKIN_TONES = [0xF2D8C2, 0xE8C4A6, 0xD9A87E, 0xB9805A, 0x8C5A3C, 0x5E3B28];
export const HAIR_TONES = [0x4A3428, 0x6B4A33, 0x8C6440, 0xC9A15C, 0x2E2A2E, 0x7E5A6B, 0x9AA7B0];
export const CLOTH_TONES = [0x8B78B0, 0xEED8B4, 0x49668C, 0xD9827E, 0xE1A540, 0xA3987E, 0x73A36F, 0xD16D4D];

/** Names for the swatch rows. Index-aligned with the tone arrays above; the
 *  saved record stores the INDEX, so renaming a tone never invalidates a save. */
export const SKIN_TONE_NAMES = ["Porcelain", "Sand", "Honey", "Caramel", "Chestnut", "Espresso"];
export const HAIR_TONE_NAMES = ["Cocoa", "Chestnut", "Toffee", "Wheat", "Soft black", "Plum", "Ash"];
export const CLOTH_TONE_NAMES = ["Lilac", "Oat", "Denim", "Rose", "Amber", "Clay", "Fern", "Ember"];

/** Hex string for a swatch, e.g. "#e8c4a6". */
export const hexCss = (n) => `#${n.toString(16).padStart(6, "0")}`;

/** Material names in the GLBs, grouped by what a palette entry retints.
 *  Matched by prefix, because each character carries its own hair material
 *  (hair_Wren, hair_Juno, ...) cloned off the shared one. */
export const TINT_GROUPS = {
  skin: ["skin"],
  hair: ["hair"],
  cloth: ["shirt", "pants", "trim", "shoe"],
};

/** Hair meshes present in every character model. A hat swaps the full
 *  crown for the flattened one, so hair can never poke through a hat. */
export const HAIR_MESH = "Hair_Full";
export const HAIR_MESH_UNDER_HAT = "Hair_Hat";
/** Slots whose items sit on the skull and therefore trigger the swap. */
export const HAT_SLOTS = ["head"];

/** The base body has clothing baked into it as material regions. A garment
 *  sits just outside that, so under deep poses (a floor sit flexes the hip
 *  ~90 degrees) the body can bulge through by a pixel or two. Tinting the
 *  underlying region to the garment's own colour makes that invisible —
 *  the standard trick rather than fighting it with more clearance. */
export const UNDERLAYER = { top: "shirt", bottom: "pants" };

export const CLIPS = {
  idle:      { loop: true,  frames: [1, 73] },
  walk:      { loop: true,  frames: [1, 33] },
  run:       { loop: true,  frames: [1, 21] },
  sit_chair: { loop: true,  frames: [1, 73] },
  sit_floor: { loop: true,  frames: [1, 73] },
  jump:      { loop: false, frames: [1, 49] },
  wave:      { loop: false, frames: [1, 61] },
  cheer:     { loop: false, frames: [1, 54] },
  clap:      { loop: false, frames: [1, 44] },
  nod_yes:   { loop: false, frames: [1, 34] },
  shake_no:  { loop: false, frames: [1, 38] },
};
export const CLIP_LIST = Object.keys(CLIPS);
export const FPS = 24;
