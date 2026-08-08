import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const SPRITE_URL = "/models/sprite.glb";

// ── Emotion → animation clip ──────────────────────────────────────────────
const EMOTION_CLIP = {
  happy: "Happy", excited: "Happy", grateful: "Happy",
  calm: "Idle", neutral: "Idle", content: "Idle",
  sad: "Idle", tired: "Idle", anxious: "Idle", angry: "Idle",
};
const EMOTION_SPEED = {
  excited: 1.55, happy: 1.20, anxious: 1.30, angry: 1.20,
  sad: 0.55, tired: 0.48, calm: 0.88, neutral: 1.00, content: 0.92, grateful: 1.10,
};
const EMOTION_BLINK = {
  tired: 4.2, excited: 1.4, anxious: 1.8, happy: 2.4,
  calm: 3.5, neutral: 3.2, sad: 5.0, angry: 2.0, content: 3.3, grateful: 2.8,
};

// ── Sprite material coloring ──────────────────────────────────────────────
// Default colors applied to each mesh by short name (node name minus "GEO-sprite_")
const SPRITE_MESH_DEFAULTS = {
  'body_head':   0xFFCEA0,
  'body_arms':   0xFFCEA0,
  'body_legs':   0xFFCEA0,
  'body_torso':  0xFFCEA0,
  'cap':         0x5DC5D8,
  'cap_inside':  0x3AA0B5,
  'diaper':      0xF2E8D8,
  'eye.L':       0xF5F0E8,
  'eye.R':       0xF5F0E8,
  'eyedot.L':    0x160D06,
  'eyedot.R':    0x160D06,
};

// Material name overrides (catches materials used as sub-slots on multi-mat meshes)
const SPRITE_MAT_OVERRIDES = {
  'sprite.skin.001':   0xFFCEA0,
  'sprite.head':       0xFFCEA0,
  'sprite.cap':        0x5DC5D8,
  'sprite.cap_inside': 0x3AA0B5,
  'sprite.diaper':     0xF2E8D8,
  'sprite.eyes':       0xF5F0E8,
  'sprite.pupils':     0x160D06,
  'sprite.highlights': 0xFFFFFF,
  'sprite.eyebrows':   0x1C1008,
};

// Skin tones applied to exposed-skin meshes (head + any un-covered body parts)
const SPRITE_SKINS = {
  honey:  0xFFD49A, ivory:  0xFFF2E0, peach:  0xFFCEA0,
  mint:   0xB8E4CA, berry:  0xEBB0CC, sky:    0xB2D4F0,
  cocoa:  0xBA7C50, slate:  0xA4B6C8, tan:    0xD6A070,
  brown:  0xA46838, deep:   0x6C4022, rose:   0xDCA4AC,
  golden: 0xEAB862, cream:  0xFFF2E0, umber:  0x7C4A2A,
};

// Outfit palettes — each outfit gives the cap, torso, arms, legs, diaper a look.
// null means "use skin color" for that slot.
const SPRITE_OUTFITS = {
  default: {
    cap: 0x5DC5D8, cap_inside: 0x3AA0B5,
    torso: null, arms: null,
    legs: 0xD4E8F4, diaper: 0xD4E8F4,
  },
  hoodie: {
    cap: 0xE5723A, cap_inside: 0xC04820,
    torso: 0xE5723A, arms: 0xE5723A,
    legs: 0x5A80A5, diaper: 0x5A80A5,
  },
  floral: {
    cap: 0xE8A4BE, cap_inside: 0xC28096,
    torso: 0xE8A4BE, arms: 0xF2CCD8,
    legs: 0xF0C8D8, diaper: 0xF5DDE5,
  },
  forest: {
    cap: 0x5E9C7F, cap_inside: 0x3C7058,
    torso: 0x5E9C7F, arms: 0x5E9C7F,
    legs: 0x4A7C62, diaper: 0x4A7C62,
  },
  linen: {
    cap: 0xA6D0CD, cap_inside: 0x7BA4A0,
    torso: 0xCAD6B8, arms: 0xCAD6B8,
    legs: 0xD8E6C6, diaper: 0xE8F2D8,
  },
  stargazer: {
    cap: 0x9278CC, cap_inside: 0x6652A0,
    torso: 0x7880C8, arms: 0x7880C8,
    legs: 0x5860A2, diaper: 0x5860A2,
  },
};

// Hat overrides (replace cap colors from the outfit)
const SPRITE_HATS = {
  beanie: { cap: 0xD4A0A0, cap_inside: 0xA87070 },
  hat:    { cap: 0x786050, cap_inside: 0x4A3828 },
  crown:  { cap: 0xF0C840, cap_inside: 0xC89820 },
  beret:  { cap: 0xE0B060, cap_inside: 0xB08030 },
  knit:   { cap: 0xD87070, cap_inside: 0xA84048 },
  star:   { cap: 0x8A94D8, cap_inside: 0x5860A4 },
};

// Show/hide OUTFIT-* and ACC-* nodes in the GLB model
function applyOutfitVisibility(model, character) {
  const outfit = character?.outfit ?? "hoodie";
  const acc    = character?.accessory ?? "none";
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.name.startsWith("OUTFIT-")) {
      const id = obj.name.slice(7).split("_")[0];
      obj.visible = (id === outfit);
    } else if (obj.name.startsWith("ACC-")) {
      // ACC-scarf, ACC-moon_L, ACC-moon_R, ACC-leaf
      const id = obj.name.slice(4).replace(/_[LR]$/, "");
      obj.visible = (id === acc);
    }
  });
}

// Apply outfit + skin to cloned per-mesh materials
function applyAppearance(meshMats, character) {
  const skinKey  = character?.skin ?? character?.color ?? "honey";
  const skinHex  = SPRITE_SKINS[skinKey] ?? SPRITE_SKINS.honey;
  const outfit   = SPRITE_OUTFITS[character?.outfit] ?? SPRITE_OUTFITS.default;
  const hatOver  = SPRITE_HATS[character?.hat];

  const set = (k, hex) => { if (meshMats[k] && hex != null) meshMats[k].color.setHex(hex); };

  set("body_head",  skinHex);
  set("body_arms",  outfit.arms  ?? skinHex);
  set("body_torso", outfit.torso ?? skinHex);
  set("body_legs",  outfit.legs);
  set("diaper",     outfit.diaper);

  const capColor  = hatOver?.cap        ?? outfit.cap;
  const capInside = hatOver?.cap_inside ?? outfit.cap_inside;
  set("cap",        capColor);
  set("cap_inside", capInside);
}

// ── Accessory overlays (scarf, earrings, leaf badge) ─────────────────────
// Positions are in world-space (overlay added to root group, not to the model)
function toon(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.84, metalness: 0.02, ...opts });
}

const OUTFIT_ACCENT = {
  hoodie:    0xE77E63, floral: 0xE9A9BB, forest: 0x5E9C7F,
  linen:     0xA8D4D1, stargazer: 0x7D83C6, default: 0x5DC5D8,
};

function makeAccessoryOverlay(character, headY) {
  const accentHex = OUTFIT_ACCENT[character?.outfit] ?? OUTFIT_ACCENT.default;
  const g = new THREE.Group();

  if (character?.accessory === "scarf") {
    const sc = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.044, 10, 36),
      toon(accentHex)
    );
    sc.scale.set(1, 0.55, 0.45);
    sc.rotation.x = Math.PI / 2;
    sc.position.set(0, headY - 0.50, 0.02);
    g.add(sc);
    const tail = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.032, 0.22, 6, 10),
      toon(accentHex)
    );
    tail.position.set(-0.14, headY - 0.62, 0.18);
    tail.rotation.z = 0.28;
    g.add(tail);
  }

  if (character?.accessory === "moon") {
    [-1, 1].forEach((s) => {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(0.046, 0.009, 7, 14, Math.PI * 1.35),
        toon(0xe8d7ff)
      );
      m.position.set(s * 0.30, headY + 0.10, 0.10);
      m.rotation.z = s * 0.52;
      g.add(m);
    });
  }

  if (character?.accessory === "leaf") {
    const lf = new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 10, 7),
      toon(0xd3aa52)
    );
    lf.scale.set(0.68, 1.22, 0.24);
    lf.position.set(0.16, headY - 0.28, 0.28);
    lf.rotation.z = -0.44;
    g.add(lf);
  }

  return g.children.length ? g : null;
}

// ── Lighting ──────────────────────────────────────────────────────────────
function setupLighting(scene) {
  scene.add(new THREE.AmbientLight(0xfff8f0, 1.4));
  const key = new THREE.DirectionalLight(0xfff2d8, 2.2);
  key.position.set(2.5, 4.5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd0e0ff, 0.9);
  fill.position.set(-3, 1.5, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffcdb8, 0.6);
  rim.position.set(0, 2, -4);
  scene.add(rim);
}

// ── Clip helpers ──────────────────────────────────────────────────────────
function buildClipMap(animations) {
  const map = {};
  animations.forEach((clip) => {
    map[clip.name] = clip;
    const short = clip.name.replace(/^Kindred_/i, "");
    if (short !== clip.name) map[short] = clip;
  });
  return map;
}

function resolveClip(emotion, character, clips) {
  if (character?.emote === "wave")      return clips["Wave"] || clips["Kindred_Wave"] || null;
  if (character?.animation === "walk")  return clips["Walk"] || clips["Kindred_Walk"] || null;
  if (character?.animation === "dance") return clips["Happy"] || clips["Kindred_Happy"] || null;
  const name = EMOTION_CLIP[emotion] ?? "Idle";
  return clips[name] || clips[`Kindred_${name}`] || clips["Idle"] || clips["Kindred_Idle"] || null;
}

// ── Fallback bear constants + builder ────────────────────────────────────
const SKIN_HEX = {
  honey: 0xD4894A, ivory: 0xEACBA0, peach: 0xD4A07A, tan: 0xB07040,
  brown: 0x7A4828, deep: 0x4A2A14, rose: 0xD49494, golden: 0xC87030,
  cream: 0xEACBA0, umber: 0x7A4828, mint: 0x82C9A0, berry: 0xCF7AA4,
  sky: 0x83AEE8, cocoa: 0x9B7256, slate: 0x738392,
};
const FALLBACK_OUTFITS = {
  hoodie:    { main: 0xE77E63, trim: 0xF6C7B8, leg: 0x7E9AAA },
  floral:    { main: 0xE9A9BB, trim: 0xFFF1D4, leg: 0xC989A0 },
  forest:    { main: 0x5E9C7F, trim: 0xD7C57E, leg: 0x496C5C },
  linen:     { main: 0xA8D4D1, trim: 0xFFF4DE, leg: 0x5E8090 },
  stargazer: { main: 0x7D83C6, trim: 0xF0D889, leg: 0x4D507E },
};
const FALLBACK_HATS = { beret: 0xDDAA4C, knit: 0xD87970, star: 0x858BD6 };
const EMOTION_FX = {
  happy:[0.042,1.20,0.022,0.08], excited:[0.068,1.80,0.038,0.10],
  calm:[0.016,0.70,0.005,0.03],  neutral:[0.018,0.82,0.007,0.04],
  content:[0.022,0.88,0.010,0.04], sad:[0.010,0.55,0.003,0.02],
  tired:[0.008,0.46,0.002,0.01], anxious:[0.024,1.40,0.022,0.06],
  angry:[0.022,1.25,0.018,0.05], grateful:[0.032,1.00,0.015,0.06],
};

function colorForSkin(ch) { return SKIN_HEX[ch?.skin ?? ch?.color ?? "honey"] ?? SKIN_HEX.honey; }
function outfitFor(ch)     { return FALLBACK_OUTFITS[ch?.outfit] ?? FALLBACK_OUTFITS.hoodie; }

function buildBear(character) {
  const furHex = colorForSkin(character);
  const outfit = outfitFor(character);
  const fur      = toon(furHex);
  const innerFur = toon(new THREE.Color(furHex).multiplyScalar(0.65).getHex());
  const root = new THREE.Group(); root.name = "BearRoot";
  const bodyGroup = new THREE.Group(); bodyGroup.name = "BodyGroup";
  bodyGroup.position.set(0, -0.06, 0); root.add(bodyGroup);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.50, 10, 20), toon(outfit.main));
  torso.scale.set(1.05, 1.0, 0.78); bodyGroup.add(torso);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), toon(outfit.trim));
  belly.scale.set(1.0, 1.3, 0.32); belly.position.set(0, 0.02, 0.30); bodyGroup.add(belly);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.030, 8, 32), toon(outfit.trim));
  hem.position.set(0, -0.28, 0); hem.scale.set(1.0, 0.40, 0.36); hem.rotation.x = Math.PI / 2; bodyGroup.add(hem);
  const neckGroup = new THREE.Group(); neckGroup.name = "NeckGroup";
  neckGroup.position.set(0, 0.34, 0); bodyGroup.add(neckGroup);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.16, 14), fur);
  neck.position.set(0, 0.04, 0.02); neckGroup.add(neck);
  const headGroup = new THREE.Group(); headGroup.name = "HeadGroup";
  headGroup.position.set(0, 0.20, 0); neckGroup.add(headGroup);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.41, 32, 22), fur);
  headMesh.scale.set(1.0, 1.02, 0.92); headMesh.position.set(0, 0.20, 0); headGroup.add(headMesh);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.20, 20, 14), innerFur);
  muzzle.scale.set(1.18, 0.72, 0.54); muzzle.position.set(0, 0.06, 0.52); headGroup.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), toon(0x241510));
  nose.scale.set(1.1, 0.7, 0.52); nose.position.set(0, 0.16, 0.70); headGroup.add(nose);
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.068, 0.013, 6, 16, Math.PI),
    toon(new THREE.Color(furHex).multiplyScalar(0.55).getHex())
  );
  smile.position.set(0, -0.02, 0.68); smile.scale.set(1, 0.48, 0.24); smile.rotation.z = Math.PI; headGroup.add(smile);
  [-0.20, 0.20].forEach((x) => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xf0a2aa, transparent: true, opacity: 0.28 }));
    cheek.scale.set(1.25, 0.52, 0.18); cheek.position.set(x, 0.02, 0.52); headGroup.add(cheek);
  });
  const openEyes = [], closedEyes = [];
  [-0.165, 0.165].forEach((x) => {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.070, 16, 12), toon(0xfffbf5));
    w.scale.set(0.88, 1.0, 0.26); w.position.set(x, 0.22, 0.54); headGroup.add(w); openEyes.push(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 8), toon(0x17100d));
    p.scale.set(0.88, 1.0, 0.28); p.position.set(x, 0.22, 0.58); headGroup.add(p); openEyes.push(p);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), toon(0xffffff));
    sh.scale.set(1, 1, 0.3); sh.position.set(x + 0.012, 0.235, 0.60); headGroup.add(sh); openEyes.push(sh);
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      toon(new THREE.Color(furHex).multiplyScalar(0.78).getHex())
    );
    lid.scale.set(1.05, 0.42, 0.26); lid.position.set(x, 0.22, 0.54);
    lid.rotation.x = -0.28; lid.visible = false; headGroup.add(lid); closedEyes.push(lid);
  });
  [-0.33, 0.33].forEach((x) => {
    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.168, 20, 14), fur);
    outer.scale.set(0.88, 0.88, 0.58); outer.position.set(x, 0.56, -0.06); headGroup.add(outer);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.096, 16, 10), toon(0xeea8a8));
    inner.scale.set(0.78, 0.78, 0.28); inner.position.set(x, 0.56, 0.06); headGroup.add(inner);
  });
  const armGroups = {}, legGroups = {};
  [-1, 1].forEach((s) => {
    const ag = new THREE.Group(); ag.name = s < 0 ? "ArmL" : "ArmR";
    ag.position.set(s * 0.43, 0.14, 0); bodyGroup.add(ag); armGroups[ag.name] = ag;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.28, 8, 12), toon(outfit.main));
    arm.position.set(s * 0.05, -0.20, 0.02); arm.rotation.z = s * 0.15; ag.add(arm);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.108, 16, 12), fur);
    paw.scale.set(0.94, 0.82, 0.86); paw.position.set(s * 0.06, -0.40, 0.05); ag.add(paw);
  });
  [-1, 1].forEach((s) => {
    const lg = new THREE.Group(); lg.name = s < 0 ? "LegL" : "LegR";
    lg.position.set(s * 0.18, -0.30, 0); bodyGroup.add(lg); legGroups[lg.name] = lg;
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.108, 0.26, 8, 12), toon(outfit.leg));
    leg.position.set(0, -0.18, 0); lg.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), fur);
    foot.scale.set(1.22, 0.62, 1.38); foot.position.set(0, -0.36, 0.09); lg.add(foot);
  });
  const tailGroup = new THREE.Group(); tailGroup.name = "TailGroup";
  tailGroup.position.set(0, -0.06, -0.38); bodyGroup.add(tailGroup);
  tailGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.130, 14, 10), innerFur));

  if (character?.accessory === "scarf") {
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.055, 12, 38), toon(outfit.main));
    sc.scale.set(1.05, 0.62, 0.46); sc.rotation.x = Math.PI / 2; neckGroup.add(sc);
    const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.28, 6, 10), toon(outfit.main));
    tl.position.set(-0.16, -0.10, 0.26); tl.rotation.z = 0.30; neckGroup.add(tl);
  }
  const hatHex = FALLBACK_HATS[character?.hat];
  if (hatHex) {
    if (character.hat === "beret") {
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.44, 28, 16, 0, Math.PI*2, 0, Math.PI*0.44), toon(hatHex)
      );
      b.position.set(0.07, 0.52, 0); b.scale.set(1.08, 0.52, 0.90); headGroup.add(b);
    } else {
      const k = new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 28, 18, 0, Math.PI*2, 0, Math.PI*0.50), toon(hatHex)
      );
      k.position.set(0, 0.50, 0); k.scale.set(1.0, 0.68, 0.88); headGroup.add(k);
      if (character.hat === "star") {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.088, 0), toon(0xf4db72));
        s.position.set(0.20, 0.72, 0.18); headGroup.add(s);
      }
    }
  }
  return { root, bodyGroup, headGroup, armGroups, legGroups, tailGroup, openEyes, closedEyes };
}

// ── Component ─────────────────────────────────────────────────────────────
export default function SpriteCharacter({
  emotion = "calm",
  interactive = true,
  size = { width: 280, height: 320 },
  character = null,
  onLoad,
}) {
  const mountRef    = useRef(null);
  const runtimeRef  = useRef(null);
  const liveRef     = useRef({ emotion, character });
  const characterKey = useMemo(() => JSON.stringify(character ?? {}), [character]);

  useEffect(() => {
    liveRef.current = { emotion, character };
  }, [emotion, characterKey]); // eslint-disable-line

  // Rebuild bear when character changes (bear fallback mode)
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt || rt.mode !== "bear") return;
    if (rt.bearGroups) rt.root.remove(rt.bearGroups.root);
    const bear = buildBear(liveRef.current.character);
    rt.root.add(bear.root);
    rt.bearGroups = bear;
  }, [characterKey]); // eslint-disable-line

  // Update sprite appearance when character changes (sprite mode)
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt || rt.mode !== "sprite") return;
    if (rt.meshMats) applyAppearance(rt.meshMats, liveRef.current.character);
    if (rt.spriteModel) applyOutfitVisibility(rt.spriteModel, liveRef.current.character);
  }, [characterKey]); // eslint-disable-line

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const { width, height } = size;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
    camera.position.set(0, 0.60, 4.8);
    camera.lookAt(0, 1.0, 0);
    setupLighting(scene);

    const root = new THREE.Group();
    scene.add(root);

    const runtime = { root, mode: "loading" };
    runtimeRef.current = runtime;

    // ── Load rigged sprite GLB ────────────────────────────────────────────
    const loader = new GLTFLoader();
    loader.load(
      SPRITE_URL,
      (gltf) => {
        if (!gltf.animations?.length) {
          useBear(runtime, root, liveRef.current.character, onLoad);
          return;
        }

        const model = gltf.scene;

        // Center + scale to 2.0 world units tall
        const box    = new THREE.Box3().setFromObject(model);
        const size3  = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale  = 2.0 / Math.max(size3.y, 0.001);
        model.position.sub(center);
        model.scale.setScalar(scale);
        model.position.y += 0.10;

        // headY in world space — recompute box after model is positioned+scaled
        const wbox  = new THREE.Box3().setFromObject(model);
        const headY = wbox.min.y + (wbox.max.y - wbox.min.y) * 0.82;

        // Clone materials per mesh and apply colors
        const meshMats = {};
        model.traverse((obj) => {
          if (!obj.isMesh) return;
          const shortName = obj.name.replace("GEO-sprite_", "");

          // Clone every material slot independently
          const rawMats = Array.isArray(obj.material) ? obj.material : [obj.material];
          const cloned  = rawMats.map((m) => {
            const c = m.clone();
            c.roughness = 0.76;
            c.metalness = 0.0;
            // Apply per-material-name defaults
            if (SPRITE_MAT_OVERRIDES[c.name] !== undefined) {
              c.color.setHex(SPRITE_MAT_OVERRIDES[c.name]);
            }
            return c;
          });
          obj.material = cloned.length === 1 ? cloned[0] : cloned;
          obj.castShadow = true;

          // Register primary clone by mesh short name
          meshMats[shortName] = cloned[0];

          // Apply per-mesh default color on top (more specific than material name)
          if (SPRITE_MESH_DEFAULTS[shortName] !== undefined) {
            cloned[0].color.setHex(SPRITE_MESH_DEFAULTS[shortName]);
          }

          // Cap kept at natural scale to match rig
        });

        root.add(model);

        // Apply initial outfit/skin/accessory visibility
        applyAppearance(meshMats, liveRef.current.character);
        applyOutfitVisibility(model, liveRef.current.character);

        // Set up AnimationMixer
        const clips  = buildClipMap(gltf.animations);
        const mixer  = new THREE.AnimationMixer(model);
        const idleClip = clips["Idle"] || clips["Kindred_Idle"] || gltf.animations[0];
        let currentAction = mixer.clipAction(idleClip);
        currentAction.setLoop(THREE.LoopRepeat, Infinity).play();
        let currentClipName = "Idle";

        runtime.mode            = "sprite";
        runtime.mixer           = mixer;
        runtime.clips           = clips;
        runtime.currentAction   = currentAction;
        runtime.currentClipName = currentClipName;
        runtime.spriteModel     = model;
        runtime.meshMats        = meshMats;
        runtime.headY           = headY;

        onLoad?.("sprite");
      },
      undefined,
      () => { useBear(runtime, root, liveRef.current.character, onLoad); }
    );

    function useBear(rt, r, ch, cb) {
      const bear = buildBear(ch);
      r.add(bear.root);
      rt.bearGroups = bear;
      rt.mode = "bear";
      cb?.("bear");
    }

    // ── Drag rotate ───────────────────────────────────────────────────────
    let dragging = false, lastX = 0, baseRot = 0;
    const onDown = (e) => { if (!interactive) return; dragging = true; lastX = e.clientX ?? e.touches?.[0]?.clientX ?? 0; };
    const onMove = (e) => { if (!dragging || !interactive) return; const x = e.clientX ?? e.touches?.[0]?.clientX ?? lastX; baseRot += (x - lastX) * 0.012; lastX = x; };
    const onUp   = () => { dragging = false; };
    if (interactive) {
      renderer.domElement.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup",   onUp);
    }

    // ── Render loop ───────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let t = 0, blinkTimer = 0, blinkClosed = false, waveDone = false, rafId = 0;

    function animate() {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt; blinkTimer += dt;

      const { emotion: em, character: ch } = liveRef.current;
      const rt = runtimeRef.current;
      if (!rt || rt.mode === "loading") { renderer.render(scene, camera); return; }

      const autoRot = interactive && !dragging ? Math.sin(t * 0.38) * 0.055 : 0;
      root.rotation.y = baseRot + autoRot;

      if (rt.mode === "sprite" && rt.mixer) {
        // ── Rigged sprite ──────────────────────────────────────────────
        const targetClip = resolveClip(em, ch, rt.clips);
        const targetName = targetClip?.name ?? "Idle";

        if (targetName !== rt.currentClipName && targetClip) {
          const next = rt.mixer.clipAction(targetClip);
          if (targetName === "Wave" || targetName === "Kindred_Wave") {
            next.setLoop(THREE.LoopOnce, 1).reset();
            next.clampWhenFinished = true;
            waveDone = false;
          } else {
            next.setLoop(THREE.LoopRepeat, Infinity);
          }
          rt.currentAction?.crossFadeTo(next, 0.28, true);
          next.play();
          rt.currentAction    = next;
          rt.currentClipName  = targetName;
        }

        // Wave one-shot → fade back to idle when done
        const isWave = rt.currentClipName === "Wave" || rt.currentClipName === "Kindred_Wave";
        if (isWave && !waveDone && rt.currentAction) {
          const dur = rt.currentAction.getClip().duration;
          if (rt.currentAction.time >= dur - 0.08) {
            waveDone = true;
            const idleClip = rt.clips["Idle"] || rt.clips["Kindred_Idle"];
            if (idleClip) {
              const ia = rt.mixer.clipAction(idleClip);
              ia.setLoop(THREE.LoopRepeat, Infinity);
              rt.currentAction.crossFadeTo(ia, 0.45, true);
              ia.play();
              rt.currentAction = ia;
              rt.currentClipName = "Idle";
            }
          }
        }

        if (rt.currentAction) rt.currentAction.timeScale = EMOTION_SPEED[em] ?? 1.0;
        rt.mixer.update(dt);

        // Gentle float
        root.position.y = Math.sin(t * 0.68) * 0.006;

      } else if (rt.mode === "bear" && rt.bearGroups) {
        // ── Procedural bear fallback ──────────────────────────────────
        const bg = rt.bearGroups;
        const { bodyGroup, headGroup, armGroups, legGroups, tailGroup, openEyes, closedEyes } = bg;
        const [bob, spd, sway, tilt] = EMOTION_FX[em] ?? EMOTION_FX.calm;
        const wave = ch?.emote === "wave";
        const walk = ch?.animation === "walk";
        const dance = ch?.animation === "dance";

        bodyGroup.position.y = -0.06 + Math.sin(t * spd * 2) * bob;
        bodyGroup.rotation.z = dance ? Math.sin(t * 3.0) * 0.18 : Math.sin(t * spd * 0.8) * sway;

        const droopY = (em === "sad" || em === "tired") ? -0.12 : 0;
        headGroup.rotation.x = Math.sin(t * spd * 0.6) * tilt * 0.5 + droopY;
        headGroup.rotation.z = Math.sin(t * spd * 0.5) * tilt * 0.7;

        const tailSpd = (em === "happy" || em === "excited") ? 3.0 : em === "sad" ? 0.6 : 1.4;
        tailGroup.rotation.z = Math.sin(t * tailSpd) * 0.22;
        tailGroup.rotation.x = 0.30 + Math.sin(t * tailSpd * 1.3) * 0.08;

        if (wave) {
          armGroups.ArmR.rotation.z = -1.2 + Math.sin(t * 4.2) * 0.38;
          armGroups.ArmR.rotation.x = 0.15;
          armGroups.ArmL.rotation.z = 0.08; armGroups.ArmL.rotation.x = 0;
          legGroups.LegL.rotation.x = 0; legGroups.LegR.rotation.x = 0;
        } else if (walk) {
          armGroups.ArmL.rotation.x =  Math.sin(t * 3.0) * 0.45;
          armGroups.ArmR.rotation.x = -Math.sin(t * 3.0) * 0.45;
          armGroups.ArmL.rotation.z = 0; armGroups.ArmR.rotation.z = 0;
          legGroups.LegL.rotation.x = -Math.sin(t * 3.0) * 0.35;
          legGroups.LegR.rotation.x =  Math.sin(t * 3.0) * 0.35;
        } else if (dance) {
          armGroups.ArmL.rotation.z =  Math.sin(t * 2.8) * 0.55 + 0.20;
          armGroups.ArmR.rotation.z = -(Math.sin(t * 2.8 + 1.0) * 0.55 + 0.20);
          armGroups.ArmL.rotation.x = Math.sin(t * 1.8) * 0.20;
          armGroups.ArmR.rotation.x = Math.sin(t * 1.8 + 0.8) * 0.20;
          legGroups.LegL.rotation.x =  Math.sin(t * 2.0) * 0.18;
          legGroups.LegR.rotation.x = -Math.sin(t * 2.0) * 0.18;
        } else {
          armGroups.ArmL.rotation.z =  Math.sin(t * spd * 0.7) * 0.06;
          armGroups.ArmR.rotation.z = -Math.sin(t * spd * 0.7 + 1.0) * 0.06;
          armGroups.ArmL.rotation.x =  Math.sin(t * spd * 0.9) * 0.04;
          armGroups.ArmR.rotation.x =  Math.sin(t * spd * 0.9 + 0.5) * 0.04;
          legGroups.LegL.rotation.x = 0; legGroups.LegR.rotation.x = 0;
        }

        const blinkInt = EMOTION_BLINK[em] ?? 3.2;
        if (blinkTimer > blinkInt) {
          blinkClosed = !blinkClosed;
          blinkTimer  = blinkClosed ? blinkInt - 0.12 : 0;
        }
        openEyes.forEach((m) => { m.visible = !blinkClosed; });
        closedEyes.forEach((m) => { m.visible = blinkClosed; });
      }

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      if (interactive) {
        renderer.domElement.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup",   onUp);
      }
      runtime.mixer?.stopAllAction();
      scene.traverse((obj) => {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m?.dispose?.());
      });
      renderer.dispose();
      runtimeRef.current = null;
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [size.width, size.height, interactive, onLoad]); // eslint-disable-line

  return (
    <div
      ref={mountRef}
      style={{ width: size.width, height: size.height, flexShrink: 0, overflow: "hidden", borderRadius: 20 }}
      aria-label="Your animated sprite character. Drag to rotate."
      role="img"
    />
  );
}
