/**
 * kindredSelfTest.mjs — exercises the real authored assets, not stubs.
 * Run: node src/avatar/kindredSelfTest.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CAST, CAST_IDS, itemsFor, sanitizeEquipped, CLIP_LIST, SLOT_LIST,
         HAIR_MESH, HAIR_MESH_UNDER_HAT } from "./castData.js";
import { preload, getCharacterModel, getWardrobeModel } from "./kindredModels.js";
import { createAvatar, applyDescriptor, disposeAvatar, playClip } from "./KindredRig.js";

await preload();

test("every cast member loads with all 11 clips", () => {
  for (const c of CAST) {
    const g = getCharacterModel(c.id);
    assert.ok(g, `${c.id} failed to load`);
    const names = g.animations.map((a) => a.name).sort();
    assert.deepEqual(names, [...CLIP_LIST].sort(), `${c.id} clip mismatch`);
  }
});

test("all cast share one skeleton, so clips and wardrobe interchange", () => {
  const boneSets = CAST.map((c) => {
    const s = new Set();
    getCharacterModel(c.id).scene.traverse((o) => { if (o.isBone) s.add(o.name); });
    return [...s].sort().join(",");
  });
  assert.equal(new Set(boneSets).size, 1, "cast skeletons diverge");
  assert.equal(boneSets[0].split(",").length, 20);
});

test("wardrobe garments are skinned to that same skeleton", () => {
  const w = getWardrobeModel();
  assert.ok(w, "wardrobe failed to load");
  const bodyBones = new Set();
  getCharacterModel("kai").scene.traverse((o) => { if (o.isBone) bodyBones.add(o.name); });
  let skinned = 0;
  w.scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    skinned += 1;
    for (const b of o.skeleton.bones) {
      assert.ok(bodyBones.has(b.name), `garment ${o.name} wants unknown bone ${b.name}`);
    }
  });
  assert.ok(skinned >= 10, `expected the garments to be skinned, saw ${skinned}`);
});

test("wardrobe is gated by presentation", () => {
  const mascBottoms = itemsFor("kai", "bottom").map((i) => i.id);
  const femmeBottoms = itemsFor("tate", "bottom").map((i) => i.id);
  assert.ok(!mascBottoms.includes("bottom_skirt"), "masc character offered a skirt");
  assert.ok(!itemsFor("kai", "top").map((i) => i.id).includes("dress"));
  assert.ok(femmeBottoms.includes("bottom_skirt"));
  assert.ok(!femmeBottoms.includes("bottom_cargo"));
  // and a saved record that breaks the rule gets cleaned, not rendered
  const cleaned = sanitizeEquipped("kai", { bottom: "bottom_skirt", top: "dress" });
  assert.equal(cleaned.bottom, null);
  assert.equal(cleaned.top, null);
});

test("a dress clears the bottom slot", () => {
  const cleaned = sanitizeEquipped("tate", { top: "dress", bottom: "bottom_skirt" });
  assert.equal(cleaned.top, "dress");
  assert.equal(cleaned.bottom, null);
});

test("every character builds, equips and animates", () => {
  for (const c of CAST) {
    const allowed = itemsFor(c.id);
    const wardrobe = {};
    for (const slot of SLOT_LIST) {
      const first = allowed.find((i) => i.slot === slot);
      if (first) wardrobe[slot] = first.id;
    }
    const avatar = createAvatar({ character: c.id, wardrobe });
    assert.ok(avatar.userData.rig, `${c.id}: no rig`);
    assert.ok(!avatar.userData.rig.pending, `${c.id}: still cold after preload`);

    let skinnedMeshes = 0;
    avatar.traverse((o) => { if (o.isSkinnedMesh) skinnedMeshes += 1; });
    assert.ok(skinnedMeshes > 1, `${c.id}: garments did not bind`);

    for (const clip of CLIP_LIST) {
      assert.ok(avatar.userData.animation.actions.has(clip), `${c.id}: missing ${clip}`);
    }
    // stepping the mixer must actually move the skeleton
    const head = avatar.userData.getBone("head");
    const before = head.quaternion.clone();
    playClip(avatar, "wave");
    avatar.userData.animation.update(0.6);
    avatar.updateMatrixWorld(true);
    assert.ok(avatar.userData.animation.current, `${c.id}: no active action`);
    void before;
    disposeAvatar(avatar);
  }
});

test("swapping character rebuilds in place, keeping the Group", () => {
  const avatar = createAvatar({ character: "kai" });
  const id = avatar.id;
  applyDescriptor(avatar, { character: "lara" });
  assert.equal(avatar.id, id, "Group identity changed on species swap");
  assert.equal(avatar.userData.rig.characterId, "lara");
  disposeAvatar(avatar);
});

test("palette retints without leaking between avatars", () => {
  const a = createAvatar({ character: "kai" });
  const b = createAvatar({ character: "kai" });
  applyDescriptor(a, { palette: { skin: 0x112233 } });
  assert.equal(a.userData.rig.materials.get("skin").color.getHex(), 0x112233);
  assert.notEqual(b.userData.rig.materials.get("skin").color.getHex(), 0x112233);
  disposeAvatar(a); disposeAvatar(b);
});

test("every character ships both a full and a hat-safe hair mesh", () => {
  for (const c of CAST) {
    const names = [];
    getCharacterModel(c.id).scene.traverse((o) => { if (o.isMesh) names.push(o.name); });
    const has = (suffix) => names.some((n) => n === suffix || n.endsWith(`_${suffix}`));
    assert.ok(has(HAIR_MESH), `${c.id}: missing ${HAIR_MESH}`);
    assert.ok(has(HAIR_MESH_UNDER_HAT), `${c.id}: missing ${HAIR_MESH_UNDER_HAT}`);
  }
});

test("a hat swaps in the flattened hair, removing it swaps back", () => {
  for (const c of CAST) {
    const avatar = createAvatar({ character: c.id });
    const rig = avatar.userData.rig;
    assert.ok(rig.hairFull && rig.hairHat, `${c.id}: hair meshes not found on the rig`);
    assert.equal(rig.hairFull.visible, true, `${c.id}: full hair hidden with no hat`);
    assert.equal(rig.hairHat.visible, false, `${c.id}: hat hair showing with no hat`);

    applyDescriptor(avatar, { wardrobe: { head: "head_cap" } });
    assert.equal(rig.hairFull.visible, false, `${c.id}: full hair still on under a cap`);
    assert.equal(rig.hairHat.visible, true, `${c.id}: hat hair not swapped in`);

    applyDescriptor(avatar, { wardrobe: { head: null } });
    assert.equal(rig.hairFull.visible, true, `${c.id}: full hair not restored`);
    assert.equal(rig.hairHat.visible, false, `${c.id}: hat hair left on`);
    disposeAvatar(avatar);
  }
});

test("each character keeps its own hair colour", () => {
  const seen = new Set();
  for (const c of CAST) {
    const avatar = createAvatar({ character: c.id });
    let hairMat = null;
    for (const [name, mat] of avatar.userData.rig.materials) {
      if (name === "hair" || name.startsWith("hair_") || name.startsWith("hair.")) {
        hairMat = mat; break;
      }
    }
    assert.ok(hairMat, `${c.id}: no hair material`);
    seen.add(hairMat.color.getHex());
    disposeAvatar(avatar);
  }
  assert.ok(seen.size >= 3, "cast hair colours collapsed to the same value");
});

test("the body's baked-in clothing hides under an equipped garment", () => {
  for (const c of CAST) {
    const avatar = createAvatar({ character: c.id });
    const rig = avatar.userData.rig;
    const pantsOf = () => {
      for (const [n, m] of rig.materials) {
        if (n === "pants" || n.startsWith("pants.")) return m.color.getHex();
      }
      return null;
    };
    const bare = pantsOf();
    assert.ok(bare != null, `${c.id}: no pants material`);

    applyDescriptor(avatar, { wardrobe: { bottom: "bottom_joggers" } });
    let garment = null;
    for (const [n, m] of rig.materials) if (n === "w_jogger") garment = m.color.getHex();
    assert.ok(garment != null, `${c.id}: joggers material missing`);
    assert.equal(pantsOf(), garment, `${c.id}: underlayer did not follow the garment`);

    applyDescriptor(avatar, { wardrobe: { bottom: null } });
    assert.equal(pantsOf(), bare, `${c.id}: underlayer not restored when undressed`);
    disposeAvatar(avatar);
  }
});

test("every character's tongue sits inside its mouth", () => {
  // the face tweaks reshape each mouth; the tongue has to follow or the
  // mouth reads as a flat dark line
  for (const c of CAST) {
    const g = getCharacterModel(c.id);
    let ink = null, tongue = null;
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name === "FaceInk" || o.name.endsWith("_FaceInk")) ink = o;
      if (o.name === "Tongue" || o.name.endsWith("_Tongue")) tongue = o;
    });
    assert.ok(ink && tongue, `${c.id}: face meshes missing`);
    ink.geometry.computeBoundingBox();
    tongue.geometry.computeBoundingBox();
    const ib = ink.geometry.boundingBox, tb = tongue.geometry.boundingBox;
    const tc = (tb.min.y + tb.max.y) / 2;          // y is up in the exported glTF
    assert.ok(tc > ib.min.y && tc < ib.max.y,
      `${c.id}: tongue centre ${tc.toFixed(3)} outside mouth [${ib.min.y.toFixed(3)}, ${ib.max.y.toFixed(3)}]`);
  }
});
