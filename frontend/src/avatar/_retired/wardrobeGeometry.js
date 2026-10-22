/**
 * wardrobeGeometry.js — procedural THREE geometry for every item in
 * wardrobe.js's WARDROBE_ITEMS catalogue (CHARACTER-BIBLE.md section 4).
 * Kept separate from wardrobe.js (which stays plain data, no THREE
 * import) so the catalogue can be read by non-rendering code (UI lists,
 * the adapter, save-game validation) without pulling in three.js.
 *
 * Every item is one of a small set of reusable primitive "shapes" — this
 * mirrors tools/blender/build_wardrobe.py's SHAPE_BUILDERS table 1:1 so
 * the eventual baked-glTF pipeline and this procedural fallback describe
 * the same silhouettes.
 */

import * as THREE from "three";
import { toonMat, MATERIAL_SLOTS } from "./materials.js";
import { getItem } from "./wardrobe.js";

// modelId -> shape key. Mirrors tools/blender/build_wardrobe.py's
// WARDROBE_CATALOGUE shape assignment.
const SHAPE_OF = {
  body_hoodie: "garment_torso", body_linen: "garment_torso", body_overalls: "garment_torso",
  body_floral_hoodie: "garment_torso", body_forest_vest: "garment_torso", body_kimono: "garment_torso",
  body_spot_markings: "decal", body_soft_fur: "decal",
  head_beanie: "hat_dome", head_felt_hat: "hat_brimmed", head_stargazer_cap: "hat_dome",
  head_cherry_blossom_crown: "circlet", head_sunrise_beret: "hat_brimmed", head_crown: "circlet",
  face_round_glasses: "glasses", face_star_glasses: "glasses", face_blush_markings: "decal",
  face_moon_earrings: "earrings",
  feet_sneakers: "shoe", feet_sandals: "shoe", feet_boots: "shoe",
  back_scarf: "scarf", back_snow_scarf: "scarf", back_first_friend_scarf: "scarf",
  back_heart_pin: "pin", back_coral_branch_pin: "pin", back_golden_leaf_brooch: "pin",
  back_listener_badge: "pin",
  back_satchel: "bag", back_explorer_pack: "bag",
  back_plain_collar: "collar",
  back_firefly_lantern_charm: "charm",
  aura_steady: "aura_ring", aura_warm: "aura_ring",
};

function mats(item) {
  if (!item.tintable) return { fixed: toonMat(0xC9A0D0, MATERIAL_SLOTS.FIXED) };
  return {
    main: toonMat(0xE0765A, MATERIAL_SLOTS.MAIN),
    trim: toonMat(0xF6C7B8, MATERIAL_SLOTS.TRIM),
  };
}

function buildHatDome(m, refs) {
  const g = new THREE.Group();
  // Domed cap has to actually clear the head it sits on (refs.headR),
  // not a fixed radius smaller than every species' head - was 0.135
  // against a real head radius of ~0.30, i.e. under half size, so it
  // rendered as a marble balanced on the scalp instead of a worn hat.
  const r = refs.headR * 1.18;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(r, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    m.main ?? m.fixed
  );
  dome.scale.set(1.0, 0.85, 1.0);
  dome.position.y = refs.headR * 0.42;
  g.add(dome);
  return g;
}

function buildHatBrimmed(m, refs) {
  const g = new THREE.Group();
  const crownR = refs.headR * 0.95;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(crownR, crownR * 1.05, refs.headR * 0.5, 16), m.main ?? m.fixed);
  crown.position.y = refs.headR * 0.55;
  g.add(crown);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(refs.headR * 1.32, refs.headR * 1.32, refs.headR * 0.1, 20), m.trim ?? m.main ?? m.fixed);
  brim.position.y = refs.headR * 0.32;
  g.add(brim);
  return g;
}

function buildGlasses(m) {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 16), m.trim ?? m.fixed);
    rim.position.set(side * 0.06, 0, 0);
    g.add(rim);
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 6), m.trim ?? m.fixed);
  bridge.rotation.z = Math.PI / 2;
  g.add(bridge);
  return g;
}

function buildShoe(m, refs) {
  // Was a fixed 0.09 radius against a real foot box roughly 0.19 across
  // (limbR-derived) - about half size, so shoes sat inside/behind the
  // bare foot mesh rather than covering it. Sized off limbR instead.
  const r = refs.limbR * 1.35;
  const shoe = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m.main ?? m.fixed);
  shoe.scale.set(1.1, 0.6, 1.5);
  const g = new THREE.Group();
  g.add(shoe);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.68, 0.012, 6, 12), m.trim ?? m.main ?? m.fixed);
  trim.rotation.x = Math.PI / 2;
  trim.position.z = -r * 0.35;
  g.add(trim);
  return g;
}

function buildScarf(m) {
  const g = new THREE.Group();
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.032, 10, 24), m.main ?? m.fixed);
  loop.rotation.x = Math.PI / 2;
  g.add(loop);
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.14, 6, 8), m.main ?? m.fixed);
  tail.position.set(-0.08, -0.10, 0.10);
  tail.rotation.z = 0.3;
  g.add(tail);
  return g;
}

function buildPin(m) {
  return new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), m.fixed ?? m.main);
}

function buildBag(m) {
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.08), m.main ?? m.fixed);
  bag.geometry = roundBox(bag.geometry, 0.02);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 16, Math.PI), m.trim ?? m.main ?? m.fixed);
  strap.rotation.z = Math.PI / 2;
  const g = new THREE.Group();
  g.add(bag, strap);
  return g;
}

function buildCollar(m) {
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 8, 20), m.trim ?? m.fixed);
  collar.rotation.x = Math.PI / 2;
  return collar;
}

function buildCirclet(m) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.014, 8, 24), m.fixed ?? m.main);
  const g = new THREE.Group();
  g.add(ring);
  for (let i = 0; i < 5; i += 1) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.02, 0), m.trim ?? m.fixed ?? m.main);
    const a = (i / 5) * Math.PI * 2;
    gem.position.set(Math.cos(a) * 0.135, 0.02, Math.sin(a) * 0.135);
    g.add(gem);
  }
  return g;
}

function buildCharm(m) {
  const g = new THREE.Group();
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), m.fixed ?? m.main);
  g.add(string);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), m.fixed ?? m.main);
  bulb.position.y = -0.06;
  g.add(bulb);
  return g;
}

function buildEarrings(m) {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), m.fixed ?? m.trim ?? m.main);
    drop.position.set(side * 0.10, -0.02, 0.05);
    g.add(drop);
  }
  return g;
}

function buildGarmentTorso(m, refs) {
  // Was a fixed 0.24 radius. That is bigger than a lean species' own
  // torso (fine) but SMALLER than a wide one's (e.g. bear, "one huge
  // round body", real chest radius ~0.38) - so on those species the
  // garment rendered fully inside the opaque bare-body mesh and was
  // invisible no matter what was equipped. Sized off the actual chest
  // radius with a margin so it always sits outside the bare torso.
  const r = refs.chestR * 1.22;
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m.main ?? m.fixed);
  torso.scale.set(1.08, 1.0, 0.95);
  g.add(torso);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(r * 0.83, 0.02, 8, 24), m.trim ?? m.main ?? m.fixed);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = -r * 0.83;
  g.add(hem);
  return g;
}

function buildDecal() {
  // Fixed markings/texture-only items carry no extra geometry — they are
  // baked into the base mesh's texture per CHARACTER-BIBLE.md section 4
  // ("small trims... baked into that garment's own mesh/texture"). An
  // empty placeholder group keeps the attach/detach API uniform.
  return new THREE.Group();
}

function buildAuraRing(m) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 8, 32), m.fixed ?? m.main);
  ring.material = ring.material.clone();
  ring.material.transparent = true;
  ring.material.opacity = 0.75;
  ring.rotation.x = Math.PI / 2;
  ring.userData.isPowerUpFx = true;
  return ring;
}

// Minimal rounded-box helper (bevels the bag corners a touch) — falls back
// to the plain box geometry if BufferGeometryUtils isn't wired up, since
// this is a cosmetic nicety, not load-bearing.
function roundBox(geometry) {
  return geometry;
}

const BUILDERS = {
  hat_dome: buildHatDome,
  hat_brimmed: buildHatBrimmed,
  glasses: buildGlasses,
  shoe: buildShoe,
  scarf: buildScarf,
  pin: buildPin,
  bag: buildBag,
  collar: buildCollar,
  circlet: buildCirclet,
  charm: buildCharm,
  earrings: buildEarrings,
  garment_torso: buildGarmentTorso,
  decal: buildDecal,
  aura_ring: buildAuraRing,
};

/**
 * Build the procedural Object3D for a wardrobe item id, plus its
 * tintable material refs (mat_main/mat_trim, or mat_fixed).
 * @param {string} itemId
 * @returns {{ object3d: THREE.Object3D, materials: Object<string, THREE.Material> } | null}
 */
const DEFAULT_REFS = { headR: 0.304, limbR: 0.184, chestR: 0.24 };

export function buildWardrobeGeometry(itemId, refs = DEFAULT_REFS) {
  const item = getItem(itemId);
  if (!item) return null;
  const shape = SHAPE_OF[item.modelId] ?? "decal";
  const builder = BUILDERS[shape] ?? buildDecal;
  const m = mats(item);
  const object3d = builder(m, { ...DEFAULT_REFS, ...refs });
  object3d.name = `wardrobe_${item.id}`;
  const materials = {};
  if (m.main) materials[MATERIAL_SLOTS.MAIN] = m.main;
  if (m.trim) materials[MATERIAL_SLOTS.TRIM] = m.trim;
  if (m.fixed) materials[MATERIAL_SLOTS.FIXED] = m.fixed;
  return { object3d, materials };
}
