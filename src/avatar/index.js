/**
 * index.js — public entry point for the Kindred avatar module. Kingdom
 * (src/components/LandView.jsx) and Grove (src/grove/scene) both import
 * from here, never from individual files, so the two 3D spaces stay on
 * one implementation.
 *
 *   import { createAvatar, applyDescriptor, adaptLegacyDescriptor } from "src/avatar/index.js";
 *   const avatar = createAvatar(adaptLegacyDescriptor(player));
 *   scene.add(avatar);
 *   applyDescriptor(avatar, { wardrobe: { head: "head_beanie" } });
 *   avatar.userData.animation.update(dt);   // per frame
 *   playClip(avatar, "wave", { once: true });
 */

export {
  createAvatar,
  applyDescriptor,
  disposeAvatar,
  playClip,
  preloadAvatarModels,
  AVATAR_HEIGHT,
} from "./KindredRig.js";

export {
  CAST,
  CAST_IDS,
  DEFAULT_CHARACTER,
  getCharacter,
  SLOTS,
  SLOT_LIST,
  WARDROBE_ITEMS,
  getItem,
  itemsFor,
  sanitizeEquipped,
  SKIN_TONES,
  HAIR_TONES,
  CLOTH_TONES,
  CLIPS,
  CLIP_LIST,
  FPS,
} from "./castData.js";

export {
  loadModel,
  preload,
  getCharacterModel,
  getWardrobeModel,
  isModelReady,
  onLoaded,
} from "./kindredModels.js";

export {
  adaptLegacyDescriptor,
  isLegacyDescriptor,
  toAvatarDescriptor,
} from "./kindredAdapter.js";

/* ---- compatibility shims -------------------------------------------
 * The cast replaced the old animal species, but CharacterView.jsx still
 * reads these names. They now describe cast members instead. Migrate the
 * screen at leisure and delete this block.
 */
import { CAST as _CAST, CLOTH_TONES as _CLOTH } from "./castData.js";

export const SPECIES_LIST = _CAST.map((c) => c.id);
export const SPECIES_NAME = Object.fromEntries(_CAST.map((c) => [c.id, c.name]));
export const PERSONALITY = Object.fromEntries(
  _CAST.map((c) => [c.id, { name: c.name, vibe: c.vibe, hair: c.hair, presents: c.presents }]),
);
export function getPersonality(id) {
  return PERSONALITY[id] ?? PERSONALITY[_CAST[0].id];
}
export const COLOURWAYS = _CLOTH.map((hex, i) => ({
  id: `cw${i}`,
  name: ["Lilac", "Oat", "Denim", "Rose", "Amber", "Clay", "Fern", "Ember"][i] ?? `Tone ${i}`,
  main: hex,
}));
export function getColourway(id) {
  return COLOURWAYS.find((c) => c.id === id) ?? COLOURWAYS[0];
}
