/**
 * KindredRig.js — builds a cast member as a THREE.Group from the authored
 * .glb files, equips wardrobe onto them, and drives the 11 shared clips.
 *
 * Two kinds of wardrobe mesh, handled differently:
 *   - "skin"   a SkinnedMesh authored against the same 20-bone rig. It is
 *              rebound onto THIS character's skeleton by bone name, so it
 *              deforms exactly like the body with no weight painting.
 *   - "attach" a rigid mesh bone-parented in Blender (caps, glasses,
 *              scarf, pack). Cloned onto the matching bone with the same
 *              local transform.
 *
 * Descriptor:
 *   { character: "kai", palette: { skin, hair, cloth }, wardrobe: { top, bottom, head, face, neck, back } }
 * `species` is accepted as an alias for `character` so older call sites
 * keep working.
 */

import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  CAST, CAST_IDS, DEFAULT_CHARACTER, SLOT_LIST, TINT_GROUPS, CLIPS, FPS,
  HAIR_MESH, HAIR_MESH_UNDER_HAT, HAT_SLOTS, UNDERLAYER,
  getCharacter, getItem, sanitizeEquipped,
} from "./castData.js";
import {
  getCharacterModel, getWardrobeModel, loadModel, modelKeyFor, onLoaded, preload,
} from "./kindredModels.js";

export const AVATAR_HEIGHT = 1.88;

function normalizeCharacter(id) {
  return CAST_IDS.includes(id) ? id : DEFAULT_CHARACTER;
}

function disposeObject3D(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => m?.dispose?.());
  });
}

/** Clone a material so retinting one avatar never touches another. */
function ownMaterial(src) {
  const m = src.clone();
  m.name = src.name;
  return m;
}

function collectMaterials(root, into) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const owned = mats.map((m) => {
      if (!m) return m;
      const existing = into.get(m.name);
      if (existing) return existing;
      const copy = ownMaterial(m);
      into.set(m.name, copy);
      return copy;
    });
    o.material = Array.isArray(o.material) ? owned : owned[0];
    o.castShadow = true;
    o.receiveShadow = true;
  });
}

/** Rebind a wardrobe SkinnedMesh onto this character's bones, by name. */
function rebindSkinned(src, bonesByName, materials) {
  const order = src.skeleton.bones.map((b) => b.name);
  const bones = order.map((n) => bonesByName[n]);
  if (bones.some((b) => !b)) return null; // rig mismatch: skip rather than render garbage
  const mesh = new THREE.SkinnedMesh(src.geometry, src.material);
  mesh.name = src.name;
  const skeleton = new THREE.Skeleton(bones, src.skeleton.boneInverses.map((m) => m.clone()));
  mesh.bind(skeleton, src.bindMatrix.clone());
  collectMaterials(mesh, materials);
  return mesh;
}

/** Clone a bone-parented accessory onto the matching bone. */
function cloneAttachment(src, bonesByName, materials) {
  let boneName = null;
  let node = src.parent;
  while (node && !boneName) {
    if (node.isBone) boneName = node.name;
    node = node.parent;
  }
  const bone = boneName ? bonesByName[boneName] : null;
  if (!bone) return null;
  const mesh = src.clone(true);
  mesh.name = src.name;
  mesh.position.copy(src.position);
  mesh.quaternion.copy(src.quaternion);
  mesh.scale.copy(src.scale);
  collectMaterials(mesh, materials);
  bone.add(mesh);
  return mesh;
}

function findByName(root, name) {
  let found = null;
  root.traverse((o) => { if (!found && o.name === name) found = o; });
  return found;
}

/** Blender prefixes each character's objects (Wren_Hair_Full), while the
 *  base model does not (Hair_Full) — so hair is matched by suffix. */
function findBySuffix(root, suffix) {
  let found = null;
  root.traverse((o) => {
    if (found || !o.isMesh) return;
    if (o.name === suffix || o.name.endsWith(`_${suffix}`)) found = o;
  });
  return found;
}

function equip(rig, slot, itemId) {
  unequip(rig, slot);
  if (!itemId) return;
  const item = getItem(itemId);
  if (!item || item.slot !== slot) return;
  const wardrobe = getWardrobeModel();
  if (!wardrobe) { rig.pendingWardrobe = true; return; }

  const built = [];
  for (const meshName of item.meshes) {
    const src = findByName(wardrobe.scene, meshName);
    if (!src) continue;
    if (item.kind === "skin" && src.isSkinnedMesh) {
      const m = rebindSkinned(src, rig.bones, rig.materials);
      if (m) { rig.root.add(m); built.push(m); }
    } else {
      const m = cloneAttachment(src, rig.bones, rig.materials);
      if (m) built.push(m);
    }
  }
  if (!built.length) return;
  rig.attachments[slot] = { item, nodes: built };
  applyPalette(rig, rig.palette);
  syncHair(rig);
  syncUnderlayer(rig);
}

function unequip(rig, slot) {
  const cur = rig.attachments[slot];
  if (!cur) return;
  for (const n of cur.nodes) {
    n.parent?.remove(n);
    // geometry is shared with the cached wardrobe gltf, so only drop materials
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    mats.forEach((m) => m?.dispose?.());
  }
  delete rig.attachments[slot];
  syncHair(rig);
  syncUnderlayer(rig);
}

/** Hide the body's baked-in clothing under whatever garment is equipped. */
function syncUnderlayer(rig) {
  for (const [slot, matName] of Object.entries(UNDERLAYER)) {
    const item = rig.attachments[slot]?.item;
    for (const [name, mat] of rig.materials) {
      // per-character bodies carry cloned names: pants, pants.002, ...
      if (name !== matName && !name.startsWith(`${matName}.`)) continue;
      if (item) {
        const tint = item.tint && rig.materials.get(item.tint);
        if (tint) mat.color.copy(tint.color);
      } else if (rig.palette?.cloth != null) {
        mat.color.setHex(rig.palette.cloth);     // back to the character's own colour
      } else {
        const base = rig.baseColors?.get(name);
        if (base != null) mat.color.setHex(base);
      }
    }
  }
}

/** A hat is on -> show the flattened crown so nothing pokes through it. */
function syncHair(rig) {
  const hatted = HAT_SLOTS.some((slot) => rig.attachments[slot]);
  const full = rig.hairFull;
  const under = rig.hairHat;
  if (full) full.visible = !(hatted && under);
  if (under) under.visible = !!(hatted && under);
}

/** Blender suffixes cloned materials (hair.001) and this project prefixes
 *  per-character ones (hair_Wren) — both belong to the same tint group. */
const matchesGroup = (name) => (p) =>
  name === p || name.startsWith(`${p}_`) || name.startsWith(`${p}.`);

function applyPalette(rig, palette = {}) {
  rig.palette = { ...rig.palette, ...palette };
  for (const [key, prefixes] of Object.entries(TINT_GROUPS)) {
    const hex = rig.palette[key];
    if (hex == null) continue;
    for (const [name, mat] of rig.materials) {
      if (prefixes.some(matchesGroup(name))) mat.color.setHex(hex);
    }
  }
  // A garment's own tint material follows the cloth colour too.
  if (rig.palette.cloth != null) {
    for (const { item } of Object.values(rig.attachments)) {
      if (item.tint) rig.materials.get(item.tint)?.color.setHex(rig.palette.cloth);
    }
  }
}

/** Drives the shared clips. One mixer per avatar. */
class Animator {
  constructor(root, clips) {
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = new Map();
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      const meta = CLIPS[clip.name];
      action.clampWhenFinished = true;
      action.loop = meta?.loop === false ? THREE.LoopOnce : THREE.LoopRepeat;
      this.actions.set(clip.name, action);
    }
    this.current = null;
    this.play("idle", 0);
  }
  play(name, fade = 0.25) {
    const next = this.actions.get(name);
    if (!next || next === this.current) return false;
    next.reset().play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
    return true;
  }
  /** Play a one-shot over the idle, then settle back. */
  once(name) {
    const action = this.actions.get(name);
    if (!action) return false;
    const back = this.current;
    action.reset().setLoop(THREE.LoopOnce, 1).play();
    if (back && back !== action) back.crossFadeTo(action, 0.15, false);
    const onDone = (e) => {
      if (e.action !== action) return;
      this.mixer.removeEventListener("finished", onDone);
      this.current = null;
      this.play("idle", 0.25);
    };
    this.mixer.addEventListener("finished", onDone);
    this.current = action;
    return true;
  }
  update(dt) { this.mixer.update(dt); }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.mixer.getRoot()); }
}

function buildInto(root, characterId, descriptor) {
  const character = getCharacter(characterId);
  const gltf = getCharacterModel(characterId);

  if (!gltf) {
    // Cold cache: nothing here can await, so stand up an empty Group now
    // and rebuild the moment the model lands. Callers keep the same Group.
    root.userData.rig = { root, characterId, pending: true, attachments: {}, materials: new Map(), bones: {}, palette: {} };
    loadModel(modelKeyFor(characterId));
    loadModel("kindred_wardrobe");
    root.userData.unsubscribe?.();
    root.userData.unsubscribe = onLoaded((key) => {
      if (key !== modelKeyFor(characterId) && key !== "kindred_wardrobe") return;
      if (!getCharacterModel(characterId)) return;
      root.userData.unsubscribe?.();
      root.userData.unsubscribe = null;
      rebuildInPlace(root, characterId, root.userData.descriptor ?? descriptor);
    });
    root.userData.descriptor = cloneDescriptor({ character: characterId, ...descriptor });
    return root.userData.rig;
  }

  const scene = cloneSkinned(gltf.scene);
  root.add(scene);

  const bones = {};
  scene.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const materials = new Map();
  collectMaterials(scene, materials);

  const rig = {
    root, scene, bones, materials, characterId,
    presents: character.presents,
    attachments: {},
    hairFull: findBySuffix(scene, HAIR_MESH),
    hairHat: findBySuffix(scene, HAIR_MESH_UNDER_HAT),
    palette: { ...character.palette, ...(descriptor.palette ?? {}) },
  };
  rig.baseColors = new Map();
  for (const [name, mat] of materials) rig.baseColors.set(name, mat.color.getHex());
  syncHair(rig);

  const clean = sanitizeEquipped(characterId, descriptor.wardrobe);
  for (const slot of SLOT_LIST) equip(rig, slot, clean[slot]);
  applyPalette(rig, rig.palette);

  const animation = new Animator(root, gltf.animations ?? []);

  root.userData.rig = rig;
  root.userData.animation = animation;
  root.userData.descriptor = cloneDescriptor({
    character: characterId, palette: rig.palette, wardrobe: clean,
  });
  root.userData.getBone = (n) => rig.bones[n] ?? null;

  // If the wardrobe arrived after the body, re-equip once it is here.
  if (rig.pendingWardrobe) {
    root.userData.unsubscribe?.();
    root.userData.unsubscribe = onLoaded((key) => {
      if (key !== "kindred_wardrobe") return;
      root.userData.unsubscribe?.();
      root.userData.unsubscribe = null;
      const d = root.userData.descriptor;
      for (const slot of SLOT_LIST) equip(rig, slot, d.wardrobe[slot]);
    });
  }
  return rig;
}

function rebuildInPlace(avatar, characterId, descriptor) {
  avatar.userData.animation?.dispose?.();
  avatar.userData.unsubscribe?.();
  avatar.userData.unsubscribe = null;
  [...avatar.children].forEach((c) => { avatar.remove(c); disposeObject3D(c); });
  buildInto(avatar, characterId, { ...descriptor, character: characterId });
  return avatar;
}

function cloneDescriptor(d) { return JSON.parse(JSON.stringify(d ?? {})); }

export function createAvatar(descriptor = {}) {
  const root = new THREE.Group();
  root.name = "KindredAvatar";
  const id = normalizeCharacter(descriptor.character ?? descriptor.species);
  buildInto(root, id, descriptor);
  return root;
}

export function applyDescriptor(avatar, next = {}) {
  const rig = avatar.userData.rig;
  if (!rig) throw new Error("applyDescriptor: not a createAvatar() Group");

  const wanted = normalizeCharacter(next.character ?? next.species ?? rig.characterId);
  if (wanted !== rig.characterId) {
    rebuildInPlace(avatar, wanted, { ...avatar.userData.descriptor, ...next, character: wanted });
    return avatar;
  }
  if (rig.pending) return avatar; // still cold; the rebuild will pick these up

  if (next.palette) {
    applyPalette(rig, next.palette);
    syncUnderlayer(rig);   // palette pass repaints the baked clothing; re-hide it
    avatar.userData.descriptor.palette = { ...rig.palette };
  }
  if (next.wardrobe) {
    const clean = sanitizeEquipped(rig.characterId, next.wardrobe);
    const cur = avatar.userData.descriptor?.wardrobe ?? {};
    for (const slot of SLOT_LIST) {
      if (clean[slot] !== cur[slot]) equip(rig, slot, clean[slot]);
    }
    avatar.userData.descriptor.wardrobe = clean;
  }
  return avatar;
}

export function playClip(avatar, name, { once = false } = {}) {
  const a = avatar.userData.animation;
  if (!a) return false;
  return once ? a.once(name) : a.play(name);
}

export function disposeAvatar(avatar) {
  avatar.userData.animation?.dispose?.();
  avatar.userData.unsubscribe?.();
  avatar.userData.unsubscribe = null;
  disposeObject3D(avatar);
}

export { preload as preloadAvatarModels, CAST, CAST_IDS, SLOT_LIST, CLIPS, FPS };
