/**
 * wardrobe.js — the Grove 3D avatar slot system and item catalogue.
 *
 * This is data only (plain ES module, no framework imports) so it can be
 * consumed by AvatarRig.js, by UI, and by the Blender export tooling notes
 * in tools/blender/build_wardrobe.py without any coupling.
 *
 * Slot and item ids intentionally reuse the ids already established by the
 * 2D companion system (see src/components/SpriteCharacter.jsx and
 * src/data/seed.js) so a single character-state object can drive both the
 * 2D sprite and this 3D avatar with no translation layer.
 *
 * See docs/grove/CHARACTER-BIBLE.md section 4 for the full design spec
 * this file implements.
 */

// ── Slots ───────────────────────────────────────────────────────────────
// Every wardrobe item belongs to exactly one slot. Each slot maps to one
// socket name on the rig (see CHARACTER-BIBLE.md section 5), except "body"
// which deforms with the base mesh rather than attaching to a socket.
export const SLOTS = Object.freeze({
  HEAD: "head",
  FACE: "face",
  BODY: "body",
  LEGS: "legs",
  BACK: "back",
  HANDS: "hands",
  FEET: "feet",
  AURA: "aura",
});

export const SLOT_LIST = Object.freeze(Object.values(SLOTS));

// Slot -> rig socket name. "body" has no socket: body-slot items are
// skinned to the base armature instead of parented to an empty.
export const SLOT_SOCKET = Object.freeze({
  head: "SOCKET_head",
  face: "SOCKET_face",
  body: null,
  legs: null,
  back: "SOCKET_back",
  hands: ["SOCKET_hand_L", "SOCKET_hand_R"],
  feet: ["SOCKET_foot_L", "SOCKET_foot_R"],
  aura: "SOCKET_aura",
});

// Whether a slot's geometry deforms with the body skeleton (skinned to the
// same armature as the base mesh) or rigid-attaches to its socket empty.
export const SLOT_ATTACH_MODE = Object.freeze({
  head: "rigid",
  face: "rigid",
  body: "deform",
  legs: "deform",
  back: "rigid",
  hands: "rigid",
  feet: "rigid",
  aura: "rigid",
});

// ── Tintable material slots ────────────────────────────────────────────
// Every base body mesh and most garments carry these material-slot names.
// AvatarRig.js looks materials up by these names and swaps .color on them;
// geometry is never touched by a re-tint.
export const MATERIAL_SLOTS = Object.freeze({
  SKIN: "mat_skin",
  SKIN_SHADOW: "mat_skin_shadow",
  TRIM: "mat_trim",
  MAIN: "mat_main",
});

// ── Skin tones ──────────────────────────────────────────────────────────
// Matches SPRITE_SKINS in src/components/SpriteCharacter.jsx.
export const SKIN_TONES = Object.freeze({
  honey: 0xffd49a,
  ivory: 0xfff2e0,
  peach: 0xffcea0,
  mint: 0xb8e4ca,
  berry: 0xebb0cc,
  sky: 0xb2d4f0,
  cocoa: 0xba7c50,
  slate: 0xa4b6c8,
  tan: 0xd6a070,
  brown: 0xa46838,
  deep: 0x6c4022,
  rose: 0xdca4ac,
  golden: 0xeab862,
  cream: 0xfff2e0,
  umber: 0x7c4a2a,
});

// ── Item tiers ────────────────────────────────────────────────────────
// common  — free, unlocked by playing.
// seasonal — limited-window, cosmetic only, no gameplay effect.
// earned  — unlocked by a specific in-app action (journaling, activities,
//           the social ladder). Never purchasable with real money, never
//           randomized. See CHARACTER-BIBLE.md section 4 for the full
//           "no pay-to-win, no lootboxes" rationale.
export const TIERS = Object.freeze({
  COMMON: "common",
  SEASONAL: "seasonal",
  EARNED: "earned",
});

/**
 * One wardrobe item.
 * @typedef {Object} WardrobeItem
 * @property {string} id            unique item id
 * @property {string} slot          one of SLOTS
 * @property {string} name          display name
 * @property {string} tier          one of TIERS
 * @property {boolean} tintable     whether mat_main/mat_trim accept a player color swap
 * @property {string} [unlock]      human-readable unlock condition for earned/seasonal items
 * @property {boolean} powerUp      true only for cosmetic aura items with a light-effect cue
 * @property {string} [modelId]     glTF asset id this item loads (see tools/blender/build_wardrobe.py)
 */

/** @type {WardrobeItem[]} */
export const WARDROBE_ITEMS = Object.freeze([
  // ── Common tier ───────────────────────────────────────────────────
  { id: "hoodie", slot: SLOTS.BODY, name: "Hoodie", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "body_hoodie" },
  { id: "linen", slot: SLOTS.BODY, name: "Linen Set", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "body_linen" },
  { id: "overalls", slot: SLOTS.BODY, name: "Overalls", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "body_overalls" },
  // ── Bottoms ───────────────────────────────────────────────────────
  // Real 3D garments skinned to the leg bones (tools/blender/build_wardrobe_glb.py).
  { id: "shorts", slot: SLOTS.LEGS, name: "Shorts", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "legs_shorts" },
  { id: "trousers", slot: SLOTS.LEGS, name: "Trousers", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "legs_trousers" },
  { id: "skirt", slot: SLOTS.LEGS, name: "Skirt", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "legs_skirt" },
  { id: "leggings", slot: SLOTS.LEGS, name: "Leggings", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "legs_leggings" },

  { id: "beanie", slot: SLOTS.HEAD, name: "Beanie", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "head_beanie" },
  { id: "felt_hat", slot: SLOTS.HEAD, name: "Felt Hat", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "head_felt_hat" },
  { id: "round_glasses", slot: SLOTS.FACE, name: "Round Glasses", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "face_round_glasses" },
  { id: "sneakers", slot: SLOTS.FEET, name: "Sneakers", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "feet_sneakers" },
  { id: "sandals", slot: SLOTS.FEET, name: "Sandals", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "feet_sandals" },
  { id: "scarf", slot: SLOTS.BACK, name: "Scarf", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "back_scarf" },
  { id: "heart_pin", slot: SLOTS.BACK, name: "Heart Pin", tier: TIERS.COMMON, tintable: false, powerUp: false, modelId: "back_heart_pin" },
  { id: "satchel", slot: SLOTS.BACK, name: "Satchel", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "back_satchel" },
  { id: "blush_markings", slot: SLOTS.FACE, name: "Blush Markings", tier: TIERS.COMMON, tintable: false, powerUp: false, modelId: "face_blush_markings" },
  { id: "spot_markings", slot: SLOTS.BODY, name: "Spot Markings", tier: TIERS.COMMON, tintable: false, powerUp: false, modelId: "body_spot_markings" },
  { id: "soft_fur", slot: SLOTS.BODY, name: "Soft Fur", tier: TIERS.COMMON, tintable: false, powerUp: false, modelId: "body_soft_fur" },
  { id: "plain_collar", slot: SLOTS.BACK, name: "Plain Collar", tier: TIERS.COMMON, tintable: true, powerUp: false, modelId: "back_plain_collar" },

  // ── Seasonal tier ─────────────────────────────────────────────────
  { id: "floral_hoodie", slot: SLOTS.BODY, name: "Floral Hoodie", tier: TIERS.SEASONAL, tintable: true, powerUp: false, modelId: "body_floral_hoodie" },
  { id: "forest_vest", slot: SLOTS.BODY, name: "Forest Vest", tier: TIERS.SEASONAL, tintable: true, powerUp: false, modelId: "body_forest_vest" },
  { id: "stargazer_cap", slot: SLOTS.HEAD, name: "Stargazer Cap", tier: TIERS.SEASONAL, tintable: true, powerUp: false, modelId: "head_stargazer_cap" },
  { id: "cherry_blossom_crown", slot: SLOTS.HEAD, name: "Cherry Blossom Crown", tier: TIERS.SEASONAL, tintable: false, powerUp: false, modelId: "head_cherry_blossom_crown" },
  { id: "firefly_lantern_charm", slot: SLOTS.BACK, name: "Firefly Lantern Charm", tier: TIERS.SEASONAL, tintable: false, powerUp: false, modelId: "back_firefly_lantern_charm" },
  { id: "coral_branch_pin", slot: SLOTS.BACK, name: "Coral Branch Pin", tier: TIERS.SEASONAL, tintable: false, powerUp: false, modelId: "back_coral_branch_pin" },
  { id: "moon_earrings", slot: SLOTS.FACE, name: "Moon Earrings", tier: TIERS.SEASONAL, tintable: false, powerUp: false, modelId: "face_moon_earrings" },
  { id: "golden_leaf_brooch", slot: SLOTS.BACK, name: "Golden Leaf Brooch", tier: TIERS.SEASONAL, tintable: false, powerUp: false, modelId: "back_golden_leaf_brooch" },
  { id: "snow_scarf", slot: SLOTS.BACK, name: "Snow Scarf", tier: TIERS.SEASONAL, tintable: true, powerUp: false, modelId: "back_snow_scarf" },
  { id: "sunrise_beret", slot: SLOTS.HEAD, name: "Sunrise Beret", tier: TIERS.SEASONAL, tintable: true, powerUp: false, modelId: "head_sunrise_beret" },

  // ── Earned tier ───────────────────────────────────────────────────
  { id: "crown", slot: SLOTS.HEAD, name: "Crown", tier: TIERS.EARNED, tintable: false, unlock: "Long journaling streak", powerUp: false, modelId: "head_crown" },
  { id: "explorer_pack", slot: SLOTS.BACK, name: "Explorer Pack", tier: TIERS.EARNED, tintable: true, unlock: "Attend 5 outdoor Grove activities", powerUp: false, modelId: "back_explorer_pack" },
  { id: "kimono", slot: SLOTS.BODY, name: "Kimono", tier: TIERS.EARNED, tintable: true, unlock: "Calm-emotion streak", powerUp: false, modelId: "body_kimono" },
  { id: "star_glasses", slot: SLOTS.FACE, name: "Star Glasses", tier: TIERS.EARNED, tintable: false, unlock: "First social-ladder rung", powerUp: false, modelId: "face_star_glasses" },
  { id: "boots", slot: SLOTS.FEET, name: "Boots", tier: TIERS.EARNED, tintable: true, unlock: "Movement-activity milestone", powerUp: false, modelId: "feet_boots" },
  { id: "listener_badge", slot: SLOTS.BACK, name: "Listener Badge", tier: TIERS.EARNED, tintable: false, unlock: "Host a support-circle activity", powerUp: false, modelId: "back_listener_badge" },
  { id: "steady_aura", slot: SLOTS.AURA, name: "Steady Aura", tier: TIERS.EARNED, tintable: false, unlock: "Long calm/content streak", powerUp: true, modelId: "aura_steady" },
  { id: "warm_aura", slot: SLOTS.AURA, name: "Warm Aura", tier: TIERS.EARNED, tintable: false, unlock: "Gratitude-journal milestone", powerUp: true, modelId: "aura_warm" },
  { id: "first_friend_scarf", slot: SLOTS.BACK, name: "First Friend Scarf", tier: TIERS.EARNED, tintable: false, unlock: "Complete an activity with another Kindred user", powerUp: false, modelId: "back_first_friend_scarf" },
]);

// ── Lookup helpers ──────────────────────────────────────────────────────

const BY_ID = new Map(WARDROBE_ITEMS.map((item) => [item.id, item]));

export function getItem(id) {
  return BY_ID.get(id) ?? null;
}

export function itemsForSlot(slot) {
  return WARDROBE_ITEMS.filter((item) => item.slot === slot);
}

export function itemsForTier(tier) {
  return WARDROBE_ITEMS.filter((item) => item.tier === tier);
}

/**
 * Validate a full "equipped" state object (one item id per slot, or null).
 * Used by AvatarRig.js before attaching items — filters out unknown ids
 * or ids equipped in the wrong slot rather than throwing, so a stale save
 * or a mismatched item id degrades gracefully instead of crashing render.
 * @param {Object<string,string|null>} equipped
 * @returns {Object<string,string|null>}
 */
export function sanitizeEquipped(equipped = {}) {
  const clean = {};
  for (const slot of SLOT_LIST) {
    const id = equipped[slot];
    if (!id) { clean[slot] = null; continue; }
    const item = getItem(id);
    clean[slot] = item && item.slot === slot ? id : null;
  }
  return clean;
}

/** No pay-to-win: power-up items only ever carry a cosmetic aura effect. */
export function isPowerUp(id) {
  return getItem(id)?.powerUp === true;
}


// ── Colourways ─────────────────────────────────────────────────────────
// Garments carry exactly two tintable material slots (mat_main, mat_trim),
// so a colourway is two hex values and costs no extra geometry or draw
// calls. Every entry stays inside the Design Bible's palette rules: warm,
// muted, never pure white or pure black, saturation reserved for accents.
export const COLOURWAYS = Object.freeze([
  { id: "terracotta", name: "Terracotta", main: 0xC96A4E, trim: 0xF6DCB6 },
  { id: "sage", name: "Sage", main: 0x7E9A6B, trim: 0xF0E4C6 },
  { id: "dusk", name: "Dusk", main: 0x6E7AA8, trim: 0xE8DCF0 },
  { id: "ochre", name: "Ochre", main: 0xD9A05C, trim: 0xFFF0D2 },
  { id: "lavender", name: "Lavender", main: 0xA898CC, trim: 0xFFF2E2 },
  { id: "seafoam", name: "Seafoam", main: 0x6FA8A2, trim: 0xFBEBCF },
  { id: "clay", name: "Clay", main: 0xB07B5E, trim: 0xF2DEC2 },
  { id: "plum", name: "Plum", main: 0x8A5F78, trim: 0xF3DDDF },
]);

export function getColourway(id) {
  return COLOURWAYS.find((c) => c.id === id) ?? COLOURWAYS[0];
}
