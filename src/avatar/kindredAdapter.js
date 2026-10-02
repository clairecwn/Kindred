/**
 * kindredAdapter.js — maps the app's saved player record
 * ({animal, skin, outfit, hat, glasses, bottoms, ...}) onto the cast +
 * wardrobe descriptor that KindredRig consumes.
 *
 * This is the only place that translation happens. The old animal ids are
 * retired, but existing saves still carry one, so each maps to a fixed
 * cast member: a returning player gets the same character every time
 * rather than being reshuffled on each load.
 */

import {
  CAST_IDS, DEFAULT_CHARACTER, SLOT_LIST,
  getCharacter, sanitizeEquipped, SKIN_TONES, HAIR_TONES, CLOTH_TONES,
} from "./castData.js";

const LEGACY_ANIMAL_TO_CAST = {
  bear: "kai", dog: "kai",
  fox: "tobi", hedgehog: "tobi",
  rabbit: "juno", cat: "juno",
  otter: "wren",
  panda: "sage",
};

const OUTFIT_TO_TOP = {
  hoodie: "top_hoodie", jacket: "top_bomber", floral: "top_cardigan",
  forest: "top_bomber", linen: "top_button", kimono: "top_cardigan",
  overalls: "top_tee", default: "top_tee", stargazer: "top_tee", explorer: "top_button",
};
const BOTTOMS_TO_BOTTOM = {
  shorts: "bottom_cargo", trousers: "bottom_joggers", leggings: "bottom_joggers",
  skirt: "bottom_skirt", none: null,
};
const HAT_TO_HEAD = {
  beanie: "head_beanie", knit: "head_beanie", hat: "head_cap",
  crown: "head_flower", beret: "head_flower", star: "head_cap", none: null,
};
const GLASSES_TO_FACE = { round: "face_glasses", star: "face_glasses", none: null };

function hexOf(list, index, fallback) {
  if (typeof index === "number" && list[index] != null) return list[index];
  return fallback;
}

export function isLegacyDescriptor(d) {
  return !!d && (d.animal !== undefined || d.outfit !== undefined || d.hat !== undefined);
}

export function adaptLegacyDescriptor(record = {}) {
  const characterId =
    CAST_IDS.includes(record.character) ? record.character
    : LEGACY_ANIMAL_TO_CAST[record.animal] ?? DEFAULT_CHARACTER;
  const base = getCharacter(characterId);

  const wardrobe = {
    top: OUTFIT_TO_TOP[record.outfit] ?? "top_tee",
    bottom: BOTTOMS_TO_BOTTOM[record.bottoms] ?? "bottom_joggers",
    head: HAT_TO_HEAD[record.hat] ?? null,
    face: GLASSES_TO_FACE[record.glasses] ?? null,
    neck: record.accessory === "scarf" ? "neck_scarf" : null,
    back: record.accessory === "explorer" || record.accessory === "pack" ? "back_pack" : null,
  };

  return {
    character: characterId,
    palette: {
      skin: hexOf(SKIN_TONES, record.skin, base.palette.skin),
      hair: hexOf(HAIR_TONES, record.hair, base.palette.hair),
      cloth: hexOf(CLOTH_TONES, record.colourway, base.palette.cloth),
    },
    wardrobe: sanitizeEquipped(characterId, wardrobe),
  };
}

/** Accepts either shape and always returns the new one. */
export function toAvatarDescriptor(d = {}) {
  if (!d || typeof d !== "object") return adaptLegacyDescriptor({});
  if (isLegacyDescriptor(d) || !d.character) return adaptLegacyDescriptor(d);
  const characterId = CAST_IDS.includes(d.character) ? d.character : DEFAULT_CHARACTER;
  const base = getCharacter(characterId);
  const wardrobe = {};
  for (const slot of SLOT_LIST) wardrobe[slot] = d.wardrobe?.[slot] ?? null;
  return {
    character: characterId,
    palette: { ...base.palette, ...(d.palette ?? {}) },
    wardrobe: sanitizeEquipped(characterId, wardrobe),
  };
}
