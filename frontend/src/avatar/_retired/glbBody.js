/**
 * glbBody.js — turns a parsed Blender-authored .glb (modelCache.js) into
 * the same rig shape the procedural builder produces, so AvatarRig.js can
 * use either source behind one API.
 *
 * Why a GLB at all: the old body.js built every character out of a dozen
 * interpenetrating primitives parented rigidly to bones, which read — in
 * Claire's words — as "a bunch of blobs". The Blender pipeline instead
 * voxel-fuses those primitives into ONE watertight, smooth-skinned mesh
 * before export, which is what gives the cast a single clean silhouette.
 *
 * What this module guarantees for the rest of the system:
 *   - bones are the SAME 22 names as skeleton.js (rigSpec.js is shared
 *     with the Blender side), so every clip in clips.js drives a GLB
 *     character with no changes at all;
 *   - SOCKET_* empties are present, so socket-attached wardrobe items
 *     from the old procedural path still work;
 *   - materials are re-created as the project's toon shader keyed by
 *     MATERIAL_SLOTS names, so retinting still means "set .color".
 */

import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { toonMat, darken } from "./materials.js";
import { MATERIAL_SLOTS } from "./wardrobe.js";
import { BONE_LIST, SOCKET_LIST } from "./skeleton.js";
import { getSpecies } from "./species.js";

// Reference dimensions of the authored body, used only to size the
// remaining procedural (non-GLB) wardrobe items. See tools/blender/rig.py.
export const REF_HEAD_R = 0.31;
export const REF_LIMB_R = 0.105;
export const REF_CHEST_R = 0.22;
export const REF_HIP_R = 0.225;

function lighten(hex, amount = 0.55) {
  const c = new THREE.Color(hex);
  return c.lerp(new THREE.Color(0xfffaf0), amount).getHex();
}

/**
 * Rebuild a mesh's material as a project toon material, keyed by the
 * material name Blender exported.
 */
function toonForName(name, palette, species) {
  const skin = palette?.skin ?? species.defaultSkin;
  switch (name) {
    case "mat_skin": return toonMat(skin, MATERIAL_SLOTS.SKIN);
    case "mat_skin_light": return toonMat(lighten(skin), "mat_skin_light");
    case "mat_main": return toonMat(palette?.main ?? 0xC96A4E, MATERIAL_SLOTS.MAIN);
    case "mat_trim": return toonMat(palette?.trim ?? 0xF6DCB6, MATERIAL_SLOTS.TRIM);
    case "mat_ink": return new THREE.MeshBasicMaterial({ color: 0x33241a, name: "mat_ink" });
    // Eyes stay UNLIT on purpose: run through the toon shader the sclera
    // washes cool and the pupil lifts to grey, which is what turned the
    // eyes into "two tiny grey slivers" in the previous build.
    case "mat_eye_white": return new THREE.MeshBasicMaterial({ color: 0xfffbf2, name });
    case "mat_eye_pupil": return new THREE.MeshBasicMaterial({ color: 0x241a12, name });
    case "mat_eye_shine": return new THREE.MeshBasicMaterial({ color: 0xffffff, name });
    default: return toonMat(0xdddddd, name || "mat_unknown");
  }
}

/**
 * Instantiate one character from a parsed glTF.
 * @returns {{root, bones, skeleton, sockets, materials, meshes, eyeMeshes, earPivots, headR, limbR, chestR, hipR}|null}
 */
export function buildBodyFromModel(gltf, speciesId, palette) {
  if (!gltf?.scene) return null;
  const species = getSpecies(speciesId);
  const scene = cloneSkinned(gltf.scene);

  const bones = {};
  const sockets = {};
  const meshes = [];
  const eyeMeshes = [];
  const materials = {};
  const named = {};

  scene.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    else if (SOCKET_LIST.includes(o.name)) sockets[o.name] = o;
    if (o.isMesh) {
      meshes.push(o);
      named[o.name] = o;
      o.frustumCulled = false;
      const srcName = Array.isArray(o.material) ? o.material[0]?.name : o.material?.name;
      let mat = materials[srcName];
      if (!mat) {
        mat = toonForName(srcName, palette, species);
        materials[srcName] = mat;
      }
      o.material = mat;
    }
  });

  for (const name of BONE_LIST) {
    if (!bones[name]) return null; // incomplete rig — fall back to procedural
  }

  // applyPalette() expects these four slot names to exist.
  if (!materials[MATERIAL_SLOTS.SKIN]) materials[MATERIAL_SLOTS.SKIN] = toonMat(palette?.skin ?? species.defaultSkin, MATERIAL_SLOTS.SKIN);
  if (!materials[MATERIAL_SLOTS.SKIN_SHADOW]) {
    materials[MATERIAL_SLOTS.SKIN_SHADOW] = toonMat(
      darken(palette?.skin ?? species.defaultSkin), MATERIAL_SLOTS.SKIN_SHADOW);
  }
  if (!materials[MATERIAL_SLOTS.MAIN]) materials[MATERIAL_SLOTS.MAIN] = toonMat(palette?.main ?? 0xC96A4E, MATERIAL_SLOTS.MAIN);
  if (!materials[MATERIAL_SLOTS.TRIM]) materials[MATERIAL_SLOTS.TRIM] = toonMat(palette?.trim ?? 0xF6DCB6, MATERIAL_SLOTS.TRIM);

  // Blink targets: the sclera + pupil meshes are single joined objects,
  // so squashing their Y is a whole-eye blink for both eyes at once.
  for (const n of ["Eyes", "Pupils", "Shines"]) if (named[n]) eyeMeshes.push(named[n]);
  const earPivots = named.Ears ? [named.Ears] : [];

  const skeleton = meshes.find((m) => m.isSkinnedMesh)?.skeleton
    ?? new THREE.Skeleton(BONE_LIST.map((n) => bones[n]));

  return {
    scene, bones, sockets, skeleton, materials, meshes, eyeMeshes, earPivots,
    headR: REF_HEAD_R, limbR: REF_LIMB_R, chestR: REF_CHEST_R, hipR: REF_HIP_R,
  };
}

/**
 * Pull one garment out of the shared wardrobe glb and rebind it onto a
 * character's own skeleton, by bone name.
 *
 * Rig first, garments second: the garment was authored against the exact
 * same armature, so "fitting" it is a name lookup, not a re-skin. This is
 * the step that makes clothing actually move with the body instead of
 * hovering near it.
 *
 * @returns {{object3d: THREE.Group, materials: Object}|null}
 */
export function buildGarmentFromModel(gltf, modelId, bones, palette) {
  if (!gltf?.scene) return null;
  const wanted = [`garment_${modelId}__main`, `garment_${modelId}__trim`];
  const sources = [];
  gltf.scene.traverse((o) => { if (o.isMesh && wanted.includes(o.name)) sources.push(o); });
  if (!sources.length) return null;

  const group = new THREE.Group();
  group.name = `garment_${modelId}`;
  const materials = {};

  for (const src of sources) {
    const mesh = src.clone();
    mesh.frustumCulled = false;
    const slot = src.name.endsWith("__trim") ? MATERIAL_SLOTS.TRIM : MATERIAL_SLOTS.MAIN;
    if (!materials[slot]) {
      materials[slot] = toonMat(
        slot === MATERIAL_SLOTS.TRIM ? (palette?.trim ?? 0xF6DCB6) : (palette?.main ?? 0xC96A4E),
        slot,
      );
    }
    mesh.material = materials[slot];

    if (src.isSkinnedMesh && src.skeleton) {
      const rebound = src.skeleton.bones.map((b) => bones[b.name]).filter(Boolean);
      if (rebound.length === src.skeleton.bones.length) {
        mesh.bind(new THREE.Skeleton(rebound, src.skeleton.boneInverses), src.bindMatrix);
        mesh.bindMode = THREE.AttachedBindMode;
      }
    }
    group.add(mesh);
  }
  return { object3d: group, materials };
}

/** True if the wardrobe glb contains real geometry for this model id. */
export function hasGarment(gltf, modelId) {
  if (!gltf?.scene) return false;
  let found = false;
  gltf.scene.traverse((o) => { if (o.isMesh && o.name === `garment_${modelId}__main`) found = true; });
  return found;
}
