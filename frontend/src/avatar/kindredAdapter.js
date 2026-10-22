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
  getCharacter, sanitizeEquipped, SKIN_TONES, HAIR_TONES,
} from "./castData.js";

const LEGACY_ANIMAL_TO_CAST = {
  bear: "kai", dog: "kai",
  fox: "alex", hedgehog: "alex",
  rabbit: "bella", cat: "bella",
  otter: "tate",
  panda: "lara",
};

/** Cast ids that have been renamed since launch. A save written before the
 *  rename still names the old id, and the player should get the same
 *  character back rather than silently being reset to Kai. */
const RENAMED = { tobi: "alex", juno: "bella", wren: "tate", sage: "lara" };

function castIdOf(raw) {
  const id = RENAMED[raw] ?? raw;
  return CAST_IDS.includes(id) ? id : null;
}

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

/** Resolve a saved tone to a hex number.
 *
 *  Saves have carried three different shapes over time: a numeric index into
 *  the tone list, a hex number written straight out, and (from the old
 *  wardrobe screen) a string id like "honey". Accepting all three is what
 *  makes skin colour actually apply — the previous version only accepted an
 *  index, so every string the UI saved fell silently back to the default. */
function hexOf(list, value, fallback) {
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 0 && value < list.length) return list[value];
    if (value > 0xFF) return value;                  // already a colour
  }
  if (typeof value === "string") {
    const m = /^#?([0-9a-f]{6})$/i.exec(value.trim());
    if (m) return parseInt(m[1], 16);
    const n = Number(value);
    if (Number.isInteger(n) && n >= 0 && n < list.length) return list[n];
  }
  return fallback;
}

export function isLegacyDescriptor(d) {
  return !!d && (d.animal !== undefined || d.outfit !== undefined || d.hat !== undefined);
}

export function adaptLegacyDescriptor(record = {}) {
  const characterId =
    castIdOf(record.character) ?? LEGACY_ANIMAL_TO_CAST[record.animal] ?? DEFAULT_CHARACTER;
  const base = getCharacter(characterId);

  // No garments for now. Each character's base body carries its own designed
  // outfit baked in, and the wardrobe meshes still have geometry problems, so
  // the base is what ships. The slots stay in the data model and the rig still
  // supports them - this is a default, not a removal - so turning the wardrobe
  // back on later is a UI change, not a rebuild.
  // Deliberately NOT read off the record. Saves written by the old wardrobe
  // screen still carry equipped ids (a white tee, white joggers, a day pack),
  // and honouring them put a backpack on everyone and covered each
  // character's authored two-tone outfit with a blank garment. Until the
  // wardrobe meshes are rebuilt, every save renders as the base body.
  const wardrobe = {};

  // Only skin is player-editable. Hair and clothing are left unset so the
  // body keeps the colours it was authored with: passing a single `cloth`
  // value would flatten each character's two-tone outfit into one colour.
  const palette = { skin: hexOf(SKIN_TONES, record.skinTone ?? record.skin, base.palette.skin) };
  if (record.hairTone != null) palette.hair = hexOf(HAIR_TONES, record.hairTone, base.palette.hair);
  // `clothTone` is deliberately not read: one cloth value repaints shirt,
  // pants, trim and shoe together, which flattens the authored outfit.
  // It comes back when the wardrobe does.

  return {
    character: characterId,
    palette,
    wardrobe: sanitizeEquipped(characterId, wardrobe),
  };
}

/** Accepts either shape and always returns the new one. */
export function toAvatarDescriptor(d = {}) {
  if (!d || typeof d !== "object") return adaptLegacyDescriptor({});
  // A rig descriptor is the only shape that carries a resolved `palette`.
  // Anything else is a saved player record and has to go through the adapter
  // -- the previous test (`!d.character`) sent every record that merely named
  // a character straight down the rig path, which silently dropped the
  // player's skinTone and hairTone on the floor.
  const isRigShape = !!d.palette && typeof d.palette === "object";
  if (!isRigShape || isLegacyDescriptor(d)) return adaptLegacyDescriptor(d);
  const characterId = castIdOf(d.character) ?? DEFAULT_CHARACTER;
  const base = getCharacter(characterId);
  // Same two rules as adaptLegacyDescriptor, and for the same reason: an old
  // save can carry both a `wardrobe` and a `palette.cloth`, and honouring
  // either one covers the character's authored two-tone outfit with a blank
  // garment or flattens it to a single colour. Neither is player-editable
  // right now, so neither is read back in.
  const { cloth, ...palette } = d.palette ?? {};
  return {
    character: characterId,
    palette: { ...base.palette, ...palette },
    wardrobe: sanitizeEquipped(characterId, {}),
  };
}
