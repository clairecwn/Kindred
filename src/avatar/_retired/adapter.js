/**
 * adapter.js — maps the app's EXISTING player-record descriptor shape
 * ({animal, skin, outfit, hat, accessory, glasses}), as already used by
 * src/components/SpriteCharacter.jsx / CharacterView.jsx and whatever is
 * saved for existing players, onto the new Grove avatar descriptor shape
 * consumed by createAvatar()/applyDescriptor() in AvatarRig.js.
 *
 * This is the ONLY place that translation happens. Both LandView.jsx
 * (Kingdom) and src/grove/scene (Grove) should call
 * `adaptLegacyDescriptor(player)` once when reading a saved player record
 * and pass the result to createAvatar/applyDescriptor — never hand-roll
 * the mapping elsewhere, or the two spaces will drift.
 *
 * Existing ids (animal/skin/outfit/hat/accessory/glasses) come from
 * src/components/SpriteCharacter.jsx's SPRITE_SKINS / SPRITE_OUTFITS /
 * SPRITE_HATS tables and src/components/CharacterView.jsx's OUTFITS /
 * HATS / GLASSES / ACCESSORIES option lists.
 */

import { SKIN_TONES, SLOTS, getColourway } from "./wardrobe.js";
import { SPECIES_LIST } from "./species.js";

// SpriteCharacter.jsx's SPRITE_OUTFITS keys -> this system's body-slot
// wardrobe item id (see CHARACTER-BIBLE.md section 4's item list). Outfit
// ids with no direct wardrobe equivalent fall back to "hoodie".
const OUTFIT_TO_BODY_ITEM = {
  default: null,
  hoodie: "hoodie",
  floral: "floral_hoodie",
  forest: "forest_vest",
  linen: "linen",
  stargazer: null, // stargazer is a hat treatment in SpriteCharacter, not a body item
  overalls: "overalls",
  kimono: "kimono",
  jacket: "hoodie",
  explorer: null, // explorer_pack is a back item, applied via `accessory`/`hat` legacy fields if present
};

// SpriteCharacter.jsx's SPRITE_HATS keys -> head-slot wardrobe item id.
const HAT_TO_HEAD_ITEM = {
  beanie: "beanie",
  hat: "felt_hat",
  crown: "crown",
  beret: "sunrise_beret",
  knit: "beanie",
  star: null, // "star" hat has no head-slot analogue; see glasses mapping for star_glasses
};

// CharacterView.jsx's GLASSES ids -> face-slot wardrobe item id.
const GLASSES_TO_FACE_ITEM = {
  none: null,
  round: "round_glasses",
  star: "star_glasses",
};

// CharacterView.jsx's BOTTOMS ids -> legs-slot wardrobe item id. The legs
// slot is new with the authored 3D wardrobe (tools/blender/build_wardrobe_glb.py);
// a saved player record with no `bottoms` key simply gets bare legs.
const BOTTOMS_TO_LEGS_ITEM = {
  none: null,
  shorts: "shorts",
  trousers: "trousers",
  skirt: "skirt",
  leggings: "leggings",
};

// CharacterView.jsx's SHOES ids -> feet-slot wardrobe item id.
const SHOES_TO_FEET_ITEM = {
  none: null,
  sneakers: "sneakers",
  sandals: "sandals",
  boots: "boots",
};

// CharacterView.jsx's ACCESSORIES ids -> back-slot wardrobe item id.
const ACCESSORY_TO_BACK_ITEM = {
  none: null,
  scarf: "scarf",
  satchel: "satchel",
  heart: "heart_pin",
};

// Outfit trim/main colors already used by SpriteCharacter.jsx's fallback
// bear builder (FALLBACK_OUTFITS), reused verbatim as the new palette's
// main/trim so a legacy player's outfit reads as the same color in Grove.
const OUTFIT_PALETTE = {
  hoodie: { main: 0xe77e63, trim: 0xf6c7b8 },
  floral: { main: 0xe9a9bb, trim: 0xfff1d4 },
  forest: { main: 0x5e9c7f, trim: 0xd7c57e },
  linen: { main: 0xa8d4d1, trim: 0xfff4de },
  stargazer: { main: 0x7d83c6, trim: 0xf0d889 },
  default: { main: 0xe0765a, trim: 0xf6c7b8 },
};

/**
 * @param {{animal?, skin?, color?, outfit?, hat?, accessory?, glasses?}} legacy
 * @returns {{species:string, palette:Object, wardrobe:Object, powerups:string[]}}
 */
export function adaptLegacyDescriptor(legacy = {}) {
  const species = SPECIES_LIST.includes(legacy.animal) ? legacy.animal : "bear";

  const skinKey = legacy.skin ?? legacy.color ?? "honey";
  const skinHex = SKIN_TONES[skinKey] ?? SKIN_TONES.honey;
  // A chosen colourway wins over the outfit's own default main/trim:
  // one garment mesh, many looks, which is the whole point of keeping
  // mat_main/mat_trim tintable rather than baking colour into the model.
  const outfitPalette = legacy.colourway
    ? getColourway(legacy.colourway)
    : (OUTFIT_PALETTE[legacy.outfit] ?? OUTFIT_PALETTE.default);

  const wardrobe = {
    [SLOTS.BODY]: OUTFIT_TO_BODY_ITEM[legacy.outfit] ?? null,
    [SLOTS.HEAD]: HAT_TO_HEAD_ITEM[legacy.hat] ?? null,
    [SLOTS.FACE]: GLASSES_TO_FACE_ITEM[legacy.glasses] ?? null,
    [SLOTS.BACK]: ACCESSORY_TO_BACK_ITEM[legacy.accessory] ?? null,
    [SLOTS.LEGS]: BOTTOMS_TO_LEGS_ITEM[legacy.bottoms] ?? null,
    [SLOTS.HANDS]: null,
    [SLOTS.FEET]: SHOES_TO_FEET_ITEM[legacy.shoes] ?? null,
    [SLOTS.AURA]: null,
  };

  return {
    species,
    palette: { skin: skinHex, main: outfitPalette.main, trim: outfitPalette.trim },
    wardrobe,
    powerups: [],
  };
}

/** True if a descriptor looks like the legacy {animal, skin, outfit} shape. */
export function isLegacyDescriptor(descriptor) {
  return !!descriptor && ("animal" in descriptor) && !("species" in descriptor);
}

/** Accepts either shape and always returns the new createAvatar() shape. */
export function toAvatarDescriptor(descriptor) {
  return isLegacyDescriptor(descriptor) ? adaptLegacyDescriptor(descriptor) : descriptor;
}
