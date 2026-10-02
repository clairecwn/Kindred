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
  SKIN_TONE_NAMES,
  HAIR_TONE_NAMES,
  CLOTH_TONE_NAMES,
  hexCss,
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
