/**
 * body.js — procedural body-mesh builder for the Grove avatar. Builds a
 * chunky, Overcooked/Brawl-Stars-style creature entirely from primitive
 * THREE geometries (spheres, capsules, cones, tori) attached rigidly onto
 * the bones from skeleton.js, per species silhouette params (species.js)
 * and a runtime-tintable palette (materials.js's MATERIAL_SLOTS).
 *
 * No binary assets of any kind — everything here is visible on screen
 * from geometry + flat toon material alone (CHARACTER-BIBLE.md section 1:
 * "no PBR anywhere", "hands and feet read as mitts and pads").
 */

import * as THREE from "three";
import { getSpecies, AVATAR_HEIGHT } from "./species.js";
import { toonMat, darken, addOutline, MATERIAL_SLOTS } from "./materials.js";

/**
 * @param {Object} palette { skin: hex, main: hex, trim: hex }
 * @param {string} speciesId
 * @param {Object<string, THREE.Bone>} bones
 * @returns {{ meshes: THREE.Mesh[], materials: Object<string, THREE.Material> }}
 */
export function buildBody(speciesId, palette, bones, height = AVATAR_HEIGHT) {
  const sp = getSpecies(speciesId);
  const skinHex = palette?.skin ?? sp.defaultSkin;
  const mainHex = palette?.main ?? 0xE0765A;
  const trimHex = palette?.trim ?? 0xF6C7B8;

  const matSkin = toonMat(skinHex, MATERIAL_SLOTS.SKIN);
  const matSkinShadow = toonMat(darken(skinHex), MATERIAL_SLOTS.SKIN_SHADOW);
  const matMain = toonMat(mainHex, MATERIAL_SLOTS.MAIN);
  const matTrim = toonMat(trimHex, MATERIAL_SLOTS.TRIM);
  const matDark = toonMat(darken(skinHex, 0.3), "mat_ink");
  // Eyes are flat, UNLIT MeshBasicMaterial, not the Half-Lambert toon
  // shader used everywhere else. This is deliberate: the eyes are the
  // single biggest appeal lever (brief point 1) and MUST read as stark
  // white/near-black from any camera or lighting angle. Running them
  // through the same lit shader as skin let the toon quantisation's
  // "highlight band" wash the near-black pupil toward grey and the
  // shadow band tint the white sclera cool/pale — exactly the "two tiny
  // grey slivers" regression. Flat colour sidesteps that entirely.
  const matEyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matEyePupil = new THREE.MeshBasicMaterial({ color: 0x1a1410 });
  const matHighlight = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const meshes = [];
  const add = (mesh, bone, outline = true) => {
    bone.add(mesh);
    meshes.push(mesh);
    if (outline) addOutline(mesh);
    return mesh;
  };

  const h = height;
  // Slightly narrower torso than the raw species width so the big head
  // reads as dominant over a smaller body mass (section 1: "big head,
  // small body", pushed toward a 1-head : 1.6-body proportion).
  const shoulderW = sp.shoulderWidth * h * 0.92;
  const hipW = sp.hipWidth * h * 0.92;

  // ── Torso (Hips + Spine chain) — soft pear silhouette, no hourglass.
  // `bodyLow` gets a wide range here on purpose: overall body shape is
  // one of the few knobs every species can use for its silhouette (brief
  // point 4 — "vary overall shape ... not just colour"), so a low-slung
  // species (bear) reads as a genuinely different squat mass from a lean
  // one (cat), not a subtly-scaled copy of the same torso. ──
  const hipMesh = new THREE.Mesh(new THREE.SphereGeometry(hipW * 0.32, 20, 14), matMain);
  hipMesh.scale.set(1.0, 0.60 + sp.bodyLow * 0.55, 0.85);
  hipMesh.position.set(0, 0.02 * h, 0);
  add(hipMesh, bones.Hips);

  const chestMesh = new THREE.Mesh(new THREE.SphereGeometry(shoulderW * 0.30, 22, 16), matMain);
  chestMesh.scale.set(1.05, 0.75 + sp.bodyLow * 0.35, 0.9);
  chestMesh.position.set(0, 0.05 * h, 0);
  add(chestMesh, bones.Spine_02);

  const bellyMesh = new THREE.Mesh(new THREE.SphereGeometry(shoulderW * 0.21, 16, 12), matTrim);
  bellyMesh.scale.set(1.0, 1.15, 0.35);
  bellyMesh.position.set(0, 0.0, shoulderW * 0.28);
  add(bellyMesh, bones.Spine_02);

  // ── Head — big, soft, forward-facing, but NOT the whole character.
  // Head-to-body ratio is measured against the FULL standing figure:
  // skeleton.js's bone chain below the head sums to ~0.72h, so
  // headR = 0.19h puts head diameter (0.38h) at ~42% of total height
  // (~0.91h) — solidly in the chibi 1:2-1:3 band, with the torso, arms
  // and legs all still clearly separate visible masses.
  const headR = h * 0.19;
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(headR, 26, 20), matSkin);
  headMesh.scale.set(1.0, 1.0, 0.9);
  add(headMesh, bones.Head);

  const muzzleMesh = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.42, 16, 12), matSkinShadow);
  muzzleMesh.scale.set(1.05, 0.72, 0.6 * sp.muzzleLen + 0.4);
  muzzleMesh.position.set(0, -headR * 0.18, headR * 0.78 * (0.6 * sp.muzzleLen + 0.5));
  add(muzzleMesh, bones.Head);

  const noseMesh = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.11, 12, 10), matDark);
  noseMesh.position.copy(muzzleMesh.position).add(new THREE.Vector3(0, headR * 0.10, headR * 0.30 * sp.muzzleLen));
  add(noseMesh, bones.Head, false);

  // Simple flat "face" plane placeholder for the emotion face-texture swap
  // (section 3): a small quad in front of the muzzle, named so a future
  // baked emotion texture can target it by name without touching geometry.
  const faceMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(headR * 0.9, headR * 0.55),
    new THREE.MeshBasicMaterial({ color: 0x241812, transparent: true, opacity: 0.0 })
  );
  faceMesh.name = "FacePlate";
  faceMesh.position.set(0, headR * 0.08, headR * 0.86);
  bones.Head.add(faceMesh);
  meshes.push(faceMesh);

  // Eyes — the single biggest appeal lever (CHARACTER-BIBLE.md section 1).
  // A face reads the instant there are two big, dark, high-contrast
  // shapes about a third of the way down the head: oversized white
  // sclera (visibly bigger than the pupil), a dark pupil, and a small
  // fixed specular highlight dot, all pulled forward past the muzzle so
  // they never get lost against the skin sphere. Sized/spaced for
  // readability at typical Grove/Kingdom camera distance, not up-close
  // realism. A small per-side size/position asymmetry keeps the face
  // from reading as a dead, machine-mirrored mannequin (section 6).
  const eyeMeshes = [];
  const EYE_Y = headR * 0.30; // ~one third down from the crown
  const EYE_Z = headR * 0.88;
  const EYE_X = headR * 0.40;
  for (const side of [-1, 1]) {
    const tag = side < 0 ? "L" : "R";
    const asym = side < 0 ? 1.0 : 0.92; // left eye reads very slightly larger
    const jitterY = side < 0 ? 0.01 : -0.015;

    // Sclera: large, flat white, clearly bigger than the pupil.
    const white = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.30 * asym, 18, 14), matEyeWhite);
    white.scale.set(0.95, 1.08, 0.5);
    white.position.set(side * EYE_X, EYE_Y + jitterY * headR, EYE_Z);
    white.name = `EyeWhite_${tag}`;
    add(white, bones.Head, false);

    // Pupil: dark, clearly smaller than the sclera but still big.
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.17 * asym, 14, 12), matEyePupil);
    pupil.position.set(side * (EYE_X + headR * 0.02), EYE_Y + jitterY * headR - headR * 0.01, EYE_Z + headR * 0.10);
    pupil.name = `EyePupil_${tag}`;
    add(pupil, bones.Head, false);

    const highlight = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.055 * asym, 8, 6), matHighlight);
    highlight.position.set(
      side * (EYE_X + headR * 0.02) + headR * 0.06,
      EYE_Y + jitterY * headR + headR * 0.06,
      EYE_Z + headR * 0.16
    );
    highlight.name = `EyeHighlight_${tag}`;
    bones.Head.add(highlight);
    meshes.push(highlight);

    eyeMeshes.push(white, pupil);
  }

  // Panda's ONE signature element (species.js `eyePatch`): big dark
  // "eye holes" behind each eye, the Chuck-Jones/Spike move quoted in
  // CHARACTER-BIBLE.md section 1 — one exaggerated dark patch is the
  // whole differentiator, nothing else added.
  if (sp.eyePatch) {
    for (const side of [-1, 1]) {
      const patch = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.34, 16, 12), matDark);
      patch.scale.set(0.85, 1.1, 0.32);
      patch.position.set(side * EYE_X * 0.98, EYE_Y * 1.02, EYE_Z - headR * 0.06);
      add(patch, bones.Head, false);
    }
  }

  // Ears — species-specific shape/size, biggest silhouette differentiator.
  // Each ear sits on its own pivot Object3D (not a skeleton bone) so the
  // animation layer can lag it slightly behind head rotation for cheap
  // secondary motion without growing the deform-bone list.
  const earPivots = buildEars(sp, headR, bones.Head, matSkin, matSkinShadow, add);

  // ── Arms ──────────────────────────────────────────────────────────
  // Thicker and noticeably shorter than a realistic limb (brief point 2:
  // "limbs stubby"), sized to match the shortened arm/leg bone chain in
  // skeleton.js so the mesh never overshoots its joints.
  const limbR = Math.max(h * 0.10, 0.115 * h);
  for (const side of ["L", "R"]) {
    const sign = side === "L" ? 1 : -1;
    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(limbR * 0.95, h * 0.085, 6, 10), matMain);
    upperArm.rotation.z = sign * 0.05;
    upperArm.position.set(0, -h * 0.05, 0);
    add(upperArm, bones[`UpperArm_${side}`]);

    const lowerArm = new THREE.Mesh(new THREE.CapsuleGeometry(limbR * 0.8, h * 0.07, 6, 10), matMain);
    lowerArm.position.set(0, -h * 0.045, 0);
    add(lowerArm, bones[`LowerArm_${side}`]);

    // Hand — one plain rounded mitt, no fingers, pushed extra chunky so
    // it unmistakably reads as a mitten (brief point 2).
    const hand = new THREE.Mesh(new THREE.SphereGeometry(limbR * 1.15, 14, 10), matSkin);
    hand.scale.set(1.05, 0.85, 1.2);
    hand.position.set(0, -h * 0.032, h * 0.01);
    add(hand, bones[`Hand_${side}`]);
  }

  // ── Legs ──────────────────────────────────────────────────────────
  for (const side of ["L", "R"]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(limbR * 1.1, h * 0.085, 6, 10), matTrim);
    thigh.position.set(0, -h * 0.05, 0);
    add(thigh, bones[`Thigh_${side}`]);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(limbR * 0.95, h * 0.085, 6, 10), matTrim);
    shin.position.set(0, -h * 0.05, 0);
    add(shin, bones[`Shin_${side}`]);

    // Foot — one plain rounded block, flatter and wider than the hand
    // mitt so the two read as distinct shapes (brief point 2: "feet
    // simple rounded blocks").
    const foot = new THREE.Mesh(new THREE.BoxGeometry(limbR * 2.1, limbR * 1.1, limbR * 2.7, 2, 2, 2), matSkin);
    foot.position.set(0, -h * 0.015, h * 0.03);
    add(foot, bones[`Foot_${side}`]);
  }

  // ── Tail — species-specific, secondary-motion driver. ────────────
  buildTail(sp, h, bones.Tail_01, bones.Tail_02, matSkin, matSkinShadow, add);

  // Hedgehog's ONE signature element: a full spike crown over the head
  // (species.js `signature`), not a small back-of-body tuft — this is
  // the one thing that has to read in silhouette from any angle.
  if (sp.backTopper) {
    const n = 8;
    for (let i = 0; i < n; i += 1) {
      const t = i / (n - 1); // 0 (front) .. 1 (back)
      const spike = new THREE.Mesh(new THREE.ConeGeometry(h * 0.052, h * 0.24, 7), matSkinShadow);
      spike.position.set(0, headR * 0.88, headR * (0.65 - t * 1.55));
      spike.rotation.x = -Math.PI * 0.08 + t * Math.PI * 0.9;
      add(spike, bones.Head, false);
    }
  }

  return {
    meshes,
    materials: {
      [MATERIAL_SLOTS.SKIN]: matSkin,
      [MATERIAL_SLOTS.SKIN_SHADOW]: matSkinShadow,
      [MATERIAL_SLOTS.MAIN]: matMain,
      [MATERIAL_SLOTS.TRIM]: matTrim,
    },
    faceMesh,
    eyeMeshes,
    earPivots,
    headR,
    // Real sizes of the bare-body masses wardrobe has to actually cover,
    // exposed so AvatarRig.js can size garments against the ACTUAL body
    // being dressed rather than one hardcoded guess. chestR/hipR vary a
    // lot by species (a bear's "one huge round body" chest is roughly
    // double a cat's) - without this, a garment sized for an average
    // species was smaller than a wide species' own bare torso and got
    // buried inside it, invisible, which is exactly the "wardrobe
    // doesn't work" bug reported from actually equipping items in-app.
    chestR: shoulderW * 0.30,
    hipR: hipW * 0.32,
    limbR,
  };
}

function buildEars(sp, headR, headBone, matSkin, matSkinShadow, add) {
  const size = headR * 0.5 * sp.earSize;
  const pivots = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Object3D();
    pivot.name = side < 0 ? "EarPivot_L" : "EarPivot_R";
    pivot.position.set(side * headR * 0.52, headR * 0.62, -headR * 0.05);
    headBone.add(pivot);
    pivots.push(pivot);

    let outer;
    switch (sp.ear) {
      case "triangle":
        outer = new THREE.Mesh(new THREE.ConeGeometry(size * 0.55, size * 1.3, 4), matSkin);
        outer.rotation.y = Math.PI / 4;
        break;
      case "long_floppy":
        outer = new THREE.Mesh(new THREE.CapsuleGeometry(size * 0.28, size * 1.4, 6, 8), matSkin);
        outer.rotation.z = side * 0.18;
        break;
      case "floppy":
        outer = new THREE.Mesh(new THREE.SphereGeometry(size * 0.5, 12, 10), matSkin);
        outer.scale.set(0.6, 1.4, 0.4);
        break;
      case "neat":
        outer = new THREE.Mesh(new THREE.ConeGeometry(size * 0.4, size * 0.9, 4), matSkin);
        outer.rotation.y = Math.PI / 4;
        break;
      case "round_patch":
        outer = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 14, 10), matSkinShadow);
        break;
      case "wide_round":
        outer = new THREE.Mesh(new THREE.SphereGeometry(size * 0.45, 12, 10), matSkin);
        outer.scale.set(1.1, 0.8, 0.5);
        break;
      case "round_small":
      default:
        outer = new THREE.Mesh(new THREE.SphereGeometry(size * 0.42, 12, 10), matSkin);
        break;
    }
    add(outer, pivot);
  }
  return pivots;
}

function buildTail(sp, h, tail01, tail02, matSkin, matSkinShadow, add) {
  if (sp.tail === "none") return;
  const scale = sp.tailScale ?? 1;
  const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.05, h * 0.10 * scale, 6, 8), matSkin);
  seg1.position.set(0, 0, -h * 0.02 * scale);
  add(seg1, tail01);
  if (sp.tail === "stub") return; // bear/panda — no second segment

  if (sp.tail === "paddle") {
    // Otter's ONE signature element: a single flat, wide paddle — no
    // extra segments, no extra pieces.
    const paddle = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.07, h * 0.15 * scale, 6, 8), matSkinShadow);
    paddle.scale.set(1.6, 0.42, 1.0);
    paddle.position.set(0, 0, -h * 0.05 * scale);
    add(paddle, tail02);
    return;
  }

  if (sp.tail === "sweep") {
    // Fox's ONE signature element: one huge, thick, bushy tail swept up
    // and back — not the same thin capsule every other archetype gets.
    const sweep = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.075, h * 0.16 * scale, 6, 8), matSkinShadow);
    sweep.position.set(0, h * 0.02, -h * 0.09 * scale);
    sweep.rotation.x = -0.55;
    add(sweep, tail02);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(h * 0.085 * scale, 12, 10), matSkin);
    tip.position.set(0, h * 0.07, -h * 0.21 * scale);
    add(tip, tail02, false);
    return;
  }

  if (sp.tail === "whip") {
    // Cat's ONE signature element: one long, thin tail with a curled tip.
    const whip = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.026, h * 0.20 * scale, 6, 8), matSkin);
    whip.position.set(0, 0, -h * 0.10 * scale);
    whip.rotation.x = 0.3;
    add(whip, tail02);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(h * 0.032, 10, 8), matSkinShadow);
    tip.position.set(0, h * 0.035, -h * 0.20 * scale);
    add(tip, tail02, false);
    return;
  }

  const seg2Geo = sp.tail === "poof"
    ? new THREE.SphereGeometry(h * 0.09 * Math.min(scale, 1.3), 14, 10)
    : new THREE.CapsuleGeometry(h * 0.038, h * 0.09 * scale, 6, 8);
  const seg2 = new THREE.Mesh(seg2Geo, sp.tail === "poof" ? matSkin : matSkinShadow);
  seg2.position.set(0, 0, -h * 0.03 * scale);
  if (sp.tail === "curl") seg2.rotation.x = 0.6;
  add(seg2, tail02);
}
