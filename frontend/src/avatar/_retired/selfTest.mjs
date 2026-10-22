/**
 * selfTest.mjs — standalone self-test for the Grove avatar module.
 * Run with: node src/avatar/selfTest.mjs
 *
 * Constructs every species with several wardrobe combinations, asserts
 * bone/socket/mesh counts, asserts applyDescriptor swaps items in place
 * without changing the Group identity, and validates every procedural
 * animation clip only references real bones. No test framework — plain
 * assert + a pass/fail counter so this can run in CI with just `node`.
 */

import assert from "node:assert/strict";
import { createAvatar, applyDescriptor, disposeAvatar } from "./AvatarRig.js";
import { SPECIES_LIST } from "./species.js";
import { BONE_LIST, SOCKET_LIST } from "./skeleton.js";
import { WARDROBE_ITEMS, SLOTS, itemsForSlot } from "./wardrobe.js";
import { adaptLegacyDescriptor } from "./adapter.js";
import { buildAllProceduralClips, assertClipBonesValid } from "./clips.js";
import { preloadAvatarModels, getSpeciesModel, getWardrobeModel } from "./modelCache.js";
import { hasGarment } from "./glbBody.js";
import { BONE_REST } from "./rigSpec.js";

// Load the Blender-authored cast first so every assertion below runs
// against the REAL shipped .glb pipeline, not the procedural fallback
// createAvatar() uses while the model cache is still cold.
const preloaded = await preloadAvatarModels();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  - ${name}`);
    console.log(`        ${err.message}`);
  }
}

function countMeshes(root) {
  let n = 0;
  root.traverse((o) => { if (o.isMesh) n += 1; });
  return n;
}

/** Axis-aligned bounds of every rendered vertex, in world space. */
function measureBounds(root) {
  root.updateMatrixWorld(true);
  let minY = Infinity, maxY = -Infinity;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  });
  return { height: maxY - minY, minY, maxY };
}

function countBones(root) {
  let n = 0;
  root.traverse((o) => { if (o.isBone) n += 1; });
  return n;
}

console.log("=== Grove avatar self-test ===\n");

// ── 1. Every species builds with a correct bone/socket rig ─────────────
for (const species of SPECIES_LIST) {
  test(`createAvatar("${species}") has ${BONE_LIST.length} bones`, () => {
    const avatar = createAvatar({ species });
    assert.equal(countBones(avatar), BONE_LIST.length);
    for (const name of BONE_LIST) {
      assert.ok(avatar.userData.getBone(name)?.isBone, `missing bone ${name}`);
    }
    disposeAvatar(avatar);
  });

  test(`createAvatar("${species}") has all ${SOCKET_LIST.length} sockets`, () => {
    const avatar = createAvatar({ species });
    for (const name of SOCKET_LIST) {
      assert.ok(avatar.userData.getSocket(name), `missing socket ${name}`);
    }
    disposeAvatar(avatar);
  });

  test(`createAvatar("${species}") builds from the authored .glb`, () => {
    assert.ok(getSpeciesModel(species), `public/models/kindred_${species}.glb did not load`);
    const avatar = createAvatar({ species });
    assert.equal(avatar.userData.rig.source, "glb");
    const meshCount = countMeshes(avatar);
    assert.ok(meshCount >= 8, `expected >=8 authored meshes, got ${meshCount}`);
    // The body is ONE fused skinned mesh, not a pile of rigidly-parented
    // primitives — that fusion is what gives the cast a clean silhouette.
    let body = null;
    avatar.traverse((o) => { if (o.name === "Body") body = o; });
    assert.ok(body?.isSkinnedMesh, "Body must be a single SkinnedMesh");
    assert.ok(body.geometry.attributes.skinIndex, "Body must carry skin weights");
    disposeAvatar(avatar);
  });

  test(`createAvatar("${species}") keeps a chunky-mascot head-to-body ratio`, () => {
    const avatar = createAvatar({ species });
    avatar.updateMatrixWorld(true);
    const bounds = measureBounds(avatar);
    const headDiameter = avatar.userData.rig.headRadius * 2;
    const heads = bounds.height / headDiameter;
    assert.ok(heads >= 2.0 && heads <= 4.0,
      `${species} is ${heads.toFixed(2)} heads tall; target is a 2-4 head chunky mascot`);
    disposeAvatar(avatar);
  });

  test(`createAvatar("${species}") clips only reference real bones`, () => {
    const clips = buildAllProceduralClips(species);
    assert.ok(Object.keys(clips).length >= 8);
    assertClipBonesValid(clips);
  });
}

// ── 2. Several wardrobe combinations per species ────────────────────────
const combos = [
  { head: "beanie", body: "hoodie", feet: "sneakers", back: "scarf", face: "round_glasses" },
  { head: "crown", body: "kimono", feet: "boots", back: "explorer_pack", face: "star_glasses" },
  { head: "felt_hat", body: "overalls", feet: "sandals", back: "satchel", face: null },
  { head: null, body: "floral_hoodie", feet: null, back: "heart_pin", face: "moon_earrings" },
];

for (const species of SPECIES_LIST) {
  combos.forEach((wardrobe, i) => {
    test(`createAvatar("${species}") wardrobe combo #${i} equips every requested slot`, () => {
      const avatar = createAvatar({ species, wardrobe, powerups: ["steady_aura"] });
      for (const [slot, itemId] of Object.entries(wardrobe)) {
        const attached = avatar.userData.rig.attachments[slot];
        if (itemId) {
          assert.ok(attached, `slot ${slot} expected item ${itemId} but nothing attached`);
          assert.equal(attached.item.id, itemId);
        } else {
          assert.ok(!attached, `slot ${slot} expected empty but has ${attached?.item?.id}`);
        }
      }
      assert.ok(avatar.userData.rig.attachments[SLOTS.AURA], "steady_aura power-up not attached");
      disposeAvatar(avatar);
    });
  });
}

// ── 3. Every catalogued item attaches without throwing ──────────────────
test("every WARDROBE_ITEMS entry attaches cleanly on a bear", () => {
  for (const item of WARDROBE_ITEMS) {
    // The aura slot is driven only by `powerups` (no pay-to-win equip via
    // the plain wardrobe map — see CHARACTER-BIBLE.md section 4).
    const descriptor = item.slot === SLOTS.AURA
      ? { species: "bear", powerups: [item.id] }
      : { species: "bear", wardrobe: { [item.slot]: item.id } };
    const avatar = createAvatar(descriptor);
    const attached = avatar.userData.rig.attachments[item.slot];
    assert.ok(attached, `item ${item.id} (slot ${item.slot}) did not attach`);
    assert.equal(attached.item.id, item.id);
    disposeAvatar(avatar);
  }
});

// ── 3b. Authored garments are skinned to the SAME skeleton ─────────────
test("the wardrobe .glb loaded", () => {
  assert.ok(getWardrobeModel(), "public/models/kindred_wardrobe.glb did not load");
  assert.ok(preloaded.every((m) => m), "one or more avatar models failed to load");
});

for (const item of WARDROBE_ITEMS) {
  if (!item.modelId || !hasGarment(getWardrobeModel(), item.modelId)) continue;
  test(`garment "${item.id}" is weighted to the wearer's own bones`, () => {
    const avatar = createAvatar({ species: "fox", wardrobe: { [item.slot]: item.id } });
    const rig = avatar.userData.rig;
    const attached = rig.attachments[item.slot];
    assert.ok(attached, `${item.id} did not attach`);
    const skinned = [];
    attached.object3d.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
    assert.ok(skinned.length > 0, `${item.id} attached as un-skinned geometry`);
    for (const mesh of skinned) {
      assert.ok(mesh.geometry.attributes.skinIndex, `${item.id} has no skin weights`);
      // Every bone the garment is bound to must be a bone of THIS
      // character, not a leftover from the wardrobe file's own armature.
      for (const bone of mesh.skeleton.bones) {
        assert.equal(rig.bones[bone.name], bone,
          `${item.id} is bound to a foreign bone "${bone.name}"`);
      }
    }
    disposeAvatar(avatar);
  });
}

test("every bone sits at its shared rigSpec rest position", () => {
  const avatar = createAvatar({ species: "bear" });
  for (const [name, rest] of Object.entries(BONE_REST)) {
    const bone = avatar.userData.getBone(name);
    const p = bone.getWorldPosition(new (bone.position.constructor)());
    for (const [i, axis] of ["x", "y", "z"].entries()) {
      assert.ok(Math.abs(p[axis] - rest[i]) < 0.01,
        `${name}.${axis} is ${p[axis].toFixed(3)}, rig spec says ${rest[i].toFixed(3)}`);
    }
  }
  disposeAvatar(avatar);
});

// ── 4. applyDescriptor swaps items in place, same Group identity ───────
test("applyDescriptor swaps a head item in place without changing identity", () => {
  const avatar = createAvatar({ species: "fox", wardrobe: { head: "beanie" } });
  const ref = avatar;
  assert.equal(avatar.userData.rig.attachments.head.item.id, "beanie");
  const oldObj = avatar.userData.rig.attachments.head.object3d;

  applyDescriptor(avatar, { wardrobe: { head: "felt_hat" } });
  assert.equal(avatar, ref, "applyDescriptor must not change the Group reference");
  assert.equal(avatar.userData.rig.attachments.head.item.id, "felt_hat");
  assert.notEqual(avatar.userData.rig.attachments.head.object3d, oldObj);
  assert.equal(oldObj.parent, null, "old wardrobe object should be detached");

  applyDescriptor(avatar, { wardrobe: { head: null } });
  assert.ok(!avatar.userData.rig.attachments.head, "head slot should be empty after unequip");

  disposeAvatar(avatar);
});

test("applyDescriptor retints palette in place without touching geometry", () => {
  const avatar = createAvatar({ species: "cat", palette: { main: 0x111111 } });
  const meshCountBefore = countMeshes(avatar);
  const mainMat = avatar.userData.rig.materials.mat_main;
  assert.equal(mainMat.color.getHex(), 0x111111);

  applyDescriptor(avatar, { palette: { main: 0xffcc00 } });
  assert.equal(mainMat.color.getHex(), 0xffcc00, "same material instance should be retinted");
  assert.equal(countMeshes(avatar), meshCountBefore, "retint must not add/remove meshes");
  disposeAvatar(avatar);
});

test("applyDescriptor rebuilds in place on species change, same Group identity", () => {
  const avatar = createAvatar({ species: "rabbit", wardrobe: { head: "beanie" } });
  const ref = avatar;
  applyDescriptor(avatar, { species: "panda" });
  assert.equal(avatar, ref);
  assert.equal(avatar.userData.rig.species, "panda");
  assert.equal(countBones(avatar), BONE_LIST.length);
  disposeAvatar(avatar);
});

test("applyDescriptor swaps a power-up aura in place", () => {
  const avatar = createAvatar({ species: "otter", powerups: ["steady_aura"] });
  assert.equal(avatar.userData.rig.attachments[SLOTS.AURA].item.id, "steady_aura");
  applyDescriptor(avatar, { powerups: ["warm_aura"] });
  assert.equal(avatar.userData.rig.attachments[SLOTS.AURA].item.id, "warm_aura");
  applyDescriptor(avatar, { powerups: [] });
  assert.ok(!avatar.userData.rig.attachments[SLOTS.AURA]);
  disposeAvatar(avatar);
});

// ── 5. Legacy descriptor adapter ────────────────────────────────────────
test("adaptLegacyDescriptor maps {animal,skin,outfit} into a working avatar", () => {
  const legacy = { animal: "dog", skin: "mint", outfit: "hoodie", hat: "beanie", accessory: "scarf" };
  const descriptor = adaptLegacyDescriptor(legacy);
  assert.equal(descriptor.species, "dog");
  const avatar = createAvatar(descriptor);
  assert.equal(avatar.userData.rig.attachments.head.item.id, "beanie");
  assert.equal(avatar.userData.rig.attachments.body.item.id, "hoodie");
  assert.equal(avatar.userData.rig.attachments.back.item.id, "scarf");
  disposeAvatar(avatar);
});

test("adaptLegacyDescriptor falls back to bear for an unknown animal id", () => {
  const descriptor = adaptLegacyDescriptor({ animal: "dragon", skin: "honey" });
  assert.equal(descriptor.species, "bear");
});

test("animation controller drives named clips with crossfade, no throw", () => {
  const avatar = createAvatar({ species: "hedgehog" });
  const anim = avatar.userData.animation;
  anim.update(1 / 60);
  anim.setEmotion("sad");
  anim.update(0.5);
  assert.equal(anim.currentClipName, "Idle_Curl_Hedgehog", "hedgehog should curl on sad");
  anim.setSpeed(1.5);
  anim.update(0.5);
  assert.equal(anim.currentClipName, "Walk");
  assert.ok(anim.playEmote("Wave"));
  anim.update(0.1);
  assert.equal(anim.currentClipName, "Wave");
  disposeAvatar(avatar);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
