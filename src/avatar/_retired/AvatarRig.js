/**
 * AvatarRig.js — the Grove 3D avatar factory: createAvatar(descriptor)
 * builds a fully procedural (no binary assets), rigged, wardrobe-ready
 * THREE.Group; applyDescriptor(avatar, descriptor) diffs and live-updates
 * one in place. This is the one module both Kingdom (LandView.jsx) and
 * Grove (src/grove/scene) import to get the same customisable avatar.
 *
 * See docs/grove/CHARACTER-BIBLE.md sections 1, 4, 5, 7.
 *
 * Descriptor shape (the canonical, "new" shape — see adapter.js for the
 * app's existing {animal, skin, outfit} player-record shape):
 *   {
 *     species: "fox" | "rabbit" | "bear" | "cat" | "dog" | "panda" | "otter" | "hedgehog",
 *     palette: { skin?: hexNumber, main?: hexNumber, trim?: hexNumber },
 *     wardrobe: { head?, face?, body?, back?, hands?, feet?, aura?: itemId|null },
 *     powerups: string[]  // wardrobe item ids with `powerUp: true` (aura slot)
 *   }
 */

import * as THREE from "three";
import { buildSkeleton, BONE_LIST, SOCKET_LIST } from "./skeleton.js";
import { buildBody } from "./body.js";
import { getSpecies, SPECIES_LIST, AVATAR_HEIGHT } from "./species.js";
import { buildWardrobeGeometry } from "./wardrobeGeometry.js";
import {
  SLOTS,
  SLOT_LIST,
  SLOT_SOCKET,
  SLOT_ATTACH_MODE,
  MATERIAL_SLOTS,
  getItem,
  sanitizeEquipped,
} from "./wardrobe.js";
import { AnimationController } from "./AnimationController.js";
import { getSpeciesModel, getWardrobeModel, onModelLoaded, preloadAvatarModels, loadModel } from "./modelCache.js";
import { buildBodyFromModel, buildGarmentFromModel, hasGarment } from "./glbBody.js";

export { preloadAvatarModels };

export { SLOTS, SLOT_LIST, MATERIAL_SLOTS, AVATAR_HEIGHT, SPECIES_LIST };

function normalizeSpecies(species) {
  return SPECIES_LIST.includes(species) ? species : "bear";
}

function disposeObject3D(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => m?.dispose?.());
  });
}

function equipItem(rig, slot, itemId) {
  unequipItem(rig, slot);
  if (!itemId) return null;
  const item = getItem(itemId);
  if (!item || item.slot !== slot) return null;

  // Real 3D clothing first: if tools/blender/build_wardrobe_glb.py
  // authored this item, use the skinned garment and rebind it onto this
  // character's own bones, so it deforms with the body. Items with no
  // authored mesh yet fall back to the procedural primitive builder,
  // sized against THIS avatar's real body/head/limb dimensions.
  let built = null;
  const wardrobeModel = getWardrobeModel();
  if (item.modelId && wardrobeModel && hasGarment(wardrobeModel, item.modelId)) {
    built = buildGarmentFromModel(wardrobeModel, item.modelId, rig.bones, rig.palette);
    if (built) built.skinned = true;
  }
  if (!built) {
    built = buildWardrobeGeometry(itemId, {
      headR: rig.headRadius,
      limbR: rig.limbR,
      chestR: rig.chestR,
    });
  }
  if (!built) return null;
  const { object3d, materials } = built;
  object3d.name = `wardrobe_${item.id}`;

  // Tint a freshly-equipped item to the avatar's CURRENT palette right
  // away, rather than leaving it at wardrobeGeometry.js's hardcoded
  // placeholder colour until some later, unrelated palette change came
  // through applyPalette(). Previously every garment rendered in the
  // same orange/peach regardless of the outfit colour actually chosen.
  if (item.tintable) {
    if (materials[MATERIAL_SLOTS.MAIN] && rig.palette.main != null) {
      materials[MATERIAL_SLOTS.MAIN].color.setHex(rig.palette.main);
    }
    if (materials[MATERIAL_SLOTS.TRIM] && rig.palette.trim != null) {
      materials[MATERIAL_SLOTS.TRIM].color.setHex(rig.palette.trim);
    }
  }

  const attachMode = SLOT_ATTACH_MODE[slot];
  const instances = [object3d];
  if (built.skinned) {
    // A skinned garment carries its own bone bindings; it is parented to
    // the avatar root and follows the skeleton through skinning, exactly
    // like the body mesh does.
    rig.root.add(object3d);
  } else if (attachMode === "deform") {
    // Body-slot garments rigid-attach onto the same bone the base body
    // uses for torso mass (Spine_02), which is this rig's equivalent of
    // "shares the base armature" from CHARACTER-BIBLE.md section 4 (see
    // skeleton.js's doc comment on the rigid-attach-everywhere
    // simplification).
    rig.bones.Spine_02.add(object3d);
  } else {
    const socketName = SLOT_SOCKET[slot];
    const socketNames = Array.isArray(socketName) ? socketName : [socketName];
    const targets = socketNames.map((n) => rig.sockets[n]).filter(Boolean);
    if (targets.length > 1) {
      // hands/feet: clone the built object per socket so left/right both
      // get geometry instead of double-parenting the same node.
      instances.length = 0;
      targets.forEach((target, i) => {
        const inst = i === 0 ? object3d : object3d.clone(true);
        target.add(inst);
        instances.push(inst);
      });
    } else if (targets[0]) {
      targets[0].add(object3d);
    } else {
      rig.root.add(object3d);
    }
  }

  rig.attachments[slot] = { object3d, instances, item, materials };

  if (item.tintable) {
    Object.entries(materials).forEach(([name, mat]) => {
      rig.wardrobeMaterials[slot] = rig.wardrobeMaterials[slot] || {};
      rig.wardrobeMaterials[slot][name] = mat;
    });
  }
  return object3d;
}

function unequipItem(rig, slot) {
  const current = rig.attachments[slot];
  if (!current) return;
  for (const inst of current.instances ?? [current.object3d]) {
    inst.parent?.remove(inst);
    disposeObject3D(inst);
  }
  delete rig.attachments[slot];
  delete rig.wardrobeMaterials[slot];
}

function applyPalette(rig, palette = {}) {
  rig.palette = { ...rig.palette, ...palette };
  const skinMat = rig.materials[MATERIAL_SLOTS.SKIN];
  const shadowMat = rig.materials[MATERIAL_SLOTS.SKIN_SHADOW];
  if (palette.skin != null && skinMat) {
    skinMat.color.setHex(palette.skin);
    if (shadowMat) shadowMat.color.copy(skinMat.color).multiplyScalar(0.65);
    // Muzzle / belly / inner-ear accent tone follows the skin choice.
    const lightMat = rig.materials.mat_skin_light;
    if (lightMat) lightMat.color.copy(skinMat.color).lerp(new THREE.Color(0xfffaf0), 0.55);
  }
  const mainMat = rig.materials[MATERIAL_SLOTS.MAIN];
  const trimMat = rig.materials[MATERIAL_SLOTS.TRIM];
  if (palette.main != null && mainMat) mainMat.color.setHex(palette.main);
  if (palette.trim != null && trimMat) trimMat.color.setHex(palette.trim);
  // Tintable equipped wardrobe items follow the same main/trim palette.
  for (const slotMats of Object.values(rig.wardrobeMaterials)) {
    if (palette.main != null && slotMats[MATERIAL_SLOTS.MAIN]) {
      slotMats[MATERIAL_SLOTS.MAIN].color.setHex(palette.main);
    }
    if (palette.trim != null && slotMats[MATERIAL_SLOTS.TRIM]) {
      slotMats[MATERIAL_SLOTS.TRIM].color.setHex(palette.trim);
    }
  }
}

function applyPowerups(rig, powerups = []) {
  const wanted = new Set(powerups.filter((id) => getItem(id)?.powerUp));
  const current = rig.attachments[SLOTS.AURA]?.item?.id ?? null;
  const nextId = wanted.size ? [...wanted][0] : null;
  if (nextId !== current) {
    equipItem(rig, SLOTS.AURA, nextId);
  }
  rig.powerups = [...wanted];
}

/**
 * Build a full avatar from a descriptor. Synchronous — nothing here loads
 * over the network, every mesh is built from primitives on the spot.
 * @param {Object} descriptor
 * @returns {THREE.Group}
 */
export function createAvatar(descriptor = {}) {
  const root = new THREE.Group();
  root.name = "KindredAvatar";
  buildInto(root, normalizeSpecies(descriptor.species), descriptor);
  return root;
}

/**
 * Fill an (empty) Group with a complete character. Used by createAvatar,
 * by the species-change path of applyDescriptor, and by the async upgrade
 * that swaps a procedural placeholder for the authored GLB the moment it
 * finishes loading.
 */
function buildInto(root, species, descriptor) {
  const model = getSpeciesModel(species);
  const glb = model ? buildBodyFromModel(model, species, descriptor.palette) : null;

  let bones, skeleton, sockets, materials, bodyBuilt, eyeMeshes, earPivots;
  if (glb) {
    root.add(glb.scene);
    ({ bones, skeleton, sockets, materials, eyeMeshes, earPivots } = glb);
    bodyBuilt = glb;
  } else {
    const built = buildSkeleton(AVATAR_HEIGHT);
    root.add(built.root);
    bones = built.bones;
    skeleton = built.skeleton;
    sockets = built.sockets;
    bodyBuilt = buildBody(species, descriptor.palette, bones, AVATAR_HEIGHT);
    materials = bodyBuilt.materials;
    eyeMeshes = bodyBuilt.eyeMeshes;
    earPivots = bodyBuilt.earPivots;
  }

  const rig = {
    root, bones, skeleton, sockets, materials,
    species, palette: { ...descriptor.palette },
    source: glb ? "glb" : "procedural",
    attachments: {},
    wardrobeMaterials: {},
    powerups: [],
    // Exposed for tooling/tests only (e.g. gameCameraTest.mjs) — not part
    // of the documented public API surface. limbR/chestR feed the
    // procedural-fallback wardrobe sizing above.
    headRadius: bodyBuilt.headR,
    limbR: bodyBuilt.limbR,
    chestR: bodyBuilt.chestR,
    hipR: bodyBuilt.hipR,
  };

  const clean = sanitizeEquipped(descriptor.wardrobe);
  for (const slot of SLOT_LIST) {
    if (slot === SLOTS.AURA) continue; // handled by applyPowerups below
    equipItem(rig, slot, clean[slot]);
  }
  applyPowerups(rig, descriptor.powerups);

  const animation = new AnimationController(root, species, {
    eyeMeshes, earPivots, headBone: bones.Head,
  });

  root.userData.rig = rig;
  root.userData.animation = animation;
  root.userData.descriptor = cloneDescriptor({ species, palette: rig.palette, wardrobe: clean, powerups: rig.powerups });
  root.userData.getSocket = (name) => rig.sockets[name] ?? null;
  root.userData.getBone = (name) => rig.bones[name] ?? null;

  // Cold-cache case: nothing here can await, so build the procedural
  // stand-in now and re-run this same function against the authored GLB
  // the instant it lands. Callers keep the same Group either way.
  if (!glb) {
    loadModel(species); // fetch this species on demand, not all eight up front
    if (root.userData.modelUnsubscribe) root.userData.modelUnsubscribe();
    root.userData.modelUnsubscribe = onModelLoaded((id) => {
      // Either the species model OR the shared wardrobe landing is a
      // reason to rebuild: a character built before the wardrobe arrived
      // is wearing procedural fallback garments.
      const relevant = id === rig.species || id === "kindred_wardrobe";
      if (!relevant) return;
      if (root.userData.rig?.source === "glb" && id !== "kindred_wardrobe") return;
      if (!getSpeciesModel(rig.species)) return;
      root.userData.modelUnsubscribe?.();
      root.userData.modelUnsubscribe = null;
      const keep = root.userData.descriptor;
      rebuildInPlace(root, rig.species, keep);
    });
  }
  return rig;
}

/** Tear a Group's contents down and rebuild them, keeping the Group. */
function rebuildInPlace(avatar, species, descriptor) {
  avatar.userData.animation?.dispose?.();
  avatar.userData.modelUnsubscribe?.();
  avatar.userData.modelUnsubscribe = null;
  [...avatar.children].forEach((c) => {
    avatar.remove(c);
    disposeObject3D(c);
  });
  buildInto(avatar, species, { ...descriptor, species });
  return avatar;
}

function cloneDescriptor(d) {
  return JSON.parse(JSON.stringify(d ?? {}));
}

/**
 * Diff `next` against the avatar's current descriptor and update it in
 * place — no rebuild unless the species itself changed (in which case
 * the same Group's contents are rebuilt so external references to the
 * Group stay valid). This is the one function both Kingdom and Grove call
 * whenever a wardrobe change or power-up needs to go live.
 * @param {THREE.Group} avatar  a Group returned by createAvatar
 * @param {Object} next
 */
export function applyDescriptor(avatar, next = {}) {
  const rig = avatar.userData.rig;
  if (!rig) throw new Error("applyDescriptor: not a createAvatar() Group");

  const nextSpecies = normalizeSpecies(next.species ?? rig.species);
  if (nextSpecies !== rig.species) {
    // Full rebuild in place onto the same Group instance, so callers
    // holding `avatar` never need to re-parent anything.
    rebuildInPlace(avatar, nextSpecies, { ...avatar.userData.descriptor, ...next, species: nextSpecies });
    return avatar;
  }

  if (next.palette) applyPalette(rig, next.palette);

  if (next.wardrobe) {
    const clean = sanitizeEquipped(next.wardrobe);
    const currentDescriptor = avatar.userData.descriptor?.wardrobe ?? {};
    for (const slot of SLOT_LIST) {
      if (slot === SLOTS.AURA) continue;
      if (clean[slot] !== currentDescriptor[slot]) {
        equipItem(rig, slot, clean[slot]);
      }
    }
    avatar.userData.descriptor.wardrobe = clean;
  }

  if (next.powerups) {
    applyPowerups(rig, next.powerups);
    avatar.userData.descriptor.powerups = rig.powerups;
  }

  if (next.palette) avatar.userData.descriptor.palette = rig.palette;

  return avatar;
}

export function disposeAvatar(avatar) {
  avatar.userData.animation?.dispose?.();
  avatar.userData.modelUnsubscribe?.();
  avatar.userData.modelUnsubscribe = null;
  disposeObject3D(avatar);
}

export function getSocketNames() {
  return SOCKET_LIST;
}

export function getBoneNames() {
  return BONE_LIST;
}
