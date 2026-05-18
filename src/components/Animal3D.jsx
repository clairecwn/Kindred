import { useEffect, useRef } from "react";
import * as THREE from "three";

// ── Colour palettes ─────────────────────────────────────────────
const SKIN = {
  honey: 0xF2B66D, ivory: 0xF4DCC4, mint: 0x82C9A0,
  berry: 0xCF7AA4, sky: 0x83AEE8, cocoa: 0x9B7256, slate: 0x738392
};

const OUTFIT_COL = {
  none: null, hoodie: 0x4A6E8E, jacket: 0xE07050,
  overalls: 0x3A6070, kimono: 0xC870AA, explorer: 0x8A6840
};

const SHOE_COL = {
  none: null, sneakers: 0xF0F4F8, boots: 0x6B4D38, sandals: 0xC89A5A
};

// ── Animation parameters per emotion ───────────────────────────
const EMOTION_FX = {
  happy:    { bob: 0.05,  speed: 1.1,  lean: 0.02,  shake: 0,    squint: 0.18 },
  excited:  { bob: 0.09,  speed: 1.65, lean: 0.04,  shake: 0.04, squint: 0 },
  calm:     { bob: 0.022, speed: 0.75, lean: 0,     shake: 0,    squint: 0.1 },
  anxious:  { bob: 0.032, speed: 1.35, lean: 0.025, shake: 0.02, squint: 0 },
  sad:      { bob: 0.015, speed: 0.62, lean: -0.06, shake: 0,    squint: 0.3 },
  tired:    { bob: 0.012, speed: 0.5,  lean: -0.04, shake: 0,    squint: 0.45 },
  angry:    { bob: 0.03,  speed: 1.25, lean: 0.01,  shake: 0.03, squint: 0.05 },
  content:  { bob: 0.028, speed: 0.9,  lean: 0.01,  squint: 0.12 },
  grateful: { bob: 0.04,  speed: 1.0,  lean: 0.02,  squint: 0.1 },
  neutral:  { bob: 0.028, speed: 0.88, lean: 0,     shake: 0,    squint: 0 },
};

// ── Helpers ─────────────────────────────────────────────────────
function mix(a, b, t) {
  const ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF;
  const br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF;
  return ((Math.round(ar + (br - ar) * t) << 16) |
          (Math.round(ag + (bg - ag) * t) << 8) |
           Math.round(ab + (bb - ab) * t));
}

function lighten(hex, t) { return mix(hex, 0xFFFFFF, t); }
function darken(hex, t)  { return mix(hex, 0x000000, t); }

function eyeColorFor(animal) {
  return { fox: 0xB05818, rabbit: 0xE050C0, bear: 0x4A3020,
           cat: 0x3A8030, dog: 0x7A5020, panda: 0x3A2A1A }[animal] ?? 0x405080;
}

// ── Main component ───────────────────────────────────────────────
export default function Animal3D({
  emotion = "calm", animal = "fox",
  skin, color, outfit = "none", hat = "none",
  accessory = "none", glasses = "none", shoes = "none",
  pattern = "none", furStyle = "soft",
  emote = "wave", animation = "idle",
  rotation = 0, interactive = false
}) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer & Scene ────────────────────────────────────────
    const W = mount.clientWidth  || 300;
    const H = mount.clientHeight || 380;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 60);
    camera.position.set(0, 0.7, 5.8);
    camera.lookAt(0, 0.4, 0);

    // ── Cel-shading gradient map (3 bands) ──────────────────────
    const gradData = new Uint8Array([0, 128, 255]);
    const gradMap  = new THREE.DataTexture(gradData, 3, 1, THREE.RedFormat);
    gradMap.magFilter = THREE.NearestFilter;
    gradMap.minFilter = THREE.NearestFilter;
    gradMap.needsUpdate = true;

    const toon = (col, extra = {}) =>
      new THREE.MeshToonMaterial({ color: col, gradientMap: gradMap, ...extra });

    // ── Lighting ────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xFFF8F0, 0.9));
    const key = new THREE.DirectionalLight(0xFFFFFF, 1.9);
    key.position.set(2.5, 5, 4);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xFFEEDD, 0.35);
    fill.position.set(-2.5, 0.5, 2);
    scene.add(fill);

    // ── Colour derivations ───────────────────────────────────────
    const isPanda     = animal === "panda";
    const base        = SKIN[skin || color] ?? SKIN.honey;
    const bodyCol     = isPanda ? 0xF5F0E8 : base;
    const darkCol     = isPanda ? 0x2A2020 : darken(base, 0.32);
    const bellyCol    = lighten(base, 0.28);
    const outfitCol   = OUTFIT_COL[outfit]  ?? null;
    const shoeCol     = SHOE_COL[shoes]     ?? null;
    const eyeCol      = eyeColorFor(animal);

    // ── Root ────────────────────────────────────────────────────
    const root = new THREE.Group();
    scene.add(root);
    root.rotation.y = THREE.MathUtils.degToRad(rotation);

    // ══════════════════════════════════════════════════════════
    //  BODY  (compact ellipsoid — chibi proportions)
    // ══════════════════════════════════════════════════════════
    const torsoMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 32, 22),
      toon(bodyCol)
    );
    torsoMesh.scale.set(1, 1.28, 0.88);
    root.add(torsoMesh);

    // Belly patch (lighter)
    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 24, 16),
      toon(bellyCol)
    );
    belly.scale.set(0.9, 1.15, 0.28);
    belly.position.set(0, -0.02, 0.34);
    root.add(belly);

    // ══════════════════════════════════════════════════════════
    //  NECK  (short, merges head into body)
    // ══════════════════════════════════════════════════════════
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 0.12, 18),
      toon(bodyCol)
    );
    neck.position.y = 0.47;
    root.add(neck);

    // ══════════════════════════════════════════════════════════
    //  HEAD  (large sphere — key to chibi look)
    // ══════════════════════════════════════════════════════════
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.1;
    root.add(headGroup);

    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 48, 30),
      toon(bodyCol)
    );
    headMesh.scale.set(1, 0.96, 0.92);
    headGroup.add(headMesh);

    // Muzzle (lighter snout area)
    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 28, 20),
      toon(bellyCol)
    );
    muzzle.scale.set(1.05, 0.7, 0.32);
    muzzle.position.set(0, -0.14, 0.7);
    headGroup.add(muzzle);

    // ── EYES (anime-style — large, expressive) ───────────────────
    const isSad     = ["sad","anxious","tired"].includes(emotion);
    const isHappy   = ["happy","excited","grateful"].includes(emotion);
    const eyeSquint = (EMOTION_FX[emotion] ?? EMOTION_FX.neutral).squint;

    [[-0.27, 0.1, 0.66], [0.27, 0.1, 0.66]].forEach(([x, y, z]) => {
      const eg = new THREE.Group();
      eg.position.set(x, y, z);
      headGroup.add(eg);

      // White sclera
      const sclera = new THREE.Mesh(
        new THREE.SphereGeometry(0.175, 24, 18),
        new THREE.MeshToonMaterial({ color: 0xFFFFFF, gradientMap: gradMap })
      );
      sclera.scale.set(1, 1.12 - eyeSquint * 0.6, 0.42);
      eg.add(sclera);

      // Iris
      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.125, 20, 16),
        toon(eyeCol)
      );
      iris.scale.set(1, 1.1 - eyeSquint * 0.5, 0.55);
      iris.position.z = 0.05;
      eg.add(iris);

      // Pupil (rounder when happy, narrower when sad)
      const pScale = isSad ? 0.7 : isHappy ? 1.05 : 0.88;
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 16, 14),
        toon(0x100508)
      );
      pupil.scale.set(pScale, (1 - eyeSquint * 0.4), 0.55);
      pupil.position.z = 0.07;
      eg.add(pupil);

      // Sparkle highlight (anime look)
      const sparkle = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
      );
      sparkle.position.set(0.055, 0.066, 0.12);
      eg.add(sparkle);

      // Droop/raise eyelid tint (faint)
      if (eyeSquint > 0.2) {
        const lid = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 20, 12),
          new THREE.MeshToonMaterial({ color: bodyCol, gradientMap: gradMap, transparent: true, opacity: 0.7 })
        );
        lid.scale.set(1.05, eyeSquint, 0.45);
        lid.position.set(0, 0.12, 0.04);
        eg.add(lid);
      }
    });

    // ── CHEEK BLUSH (always visible, animal cute staple) ────────
    [-0.38, 0.38].forEach((x) => {
      const blush = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 18, 14),
        new THREE.MeshToonMaterial({ color: 0xF08098, gradientMap: gradMap, transparent: true, opacity: 0.58 })
      );
      blush.scale.set(1.6, 0.78, 0.28);
      blush.position.set(x, -0.1, 0.67);
      headGroup.add(blush);
    });

    // ── NOSE ────────────────────────────────────────────────────
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 16, 12),
      toon(0x2D1818)
    );
    nose.scale.set(1.35, 0.82, 0.68);
    nose.position.set(0, -0.09, 0.73);
    headGroup.add(nose);

    // ── MOUTH (changes with emotion) ─────────────────────────────
    const mouthFrown = isSad;
    const mouthBig   = isHappy;
    const mouthArc   = mouthBig ? Math.PI * 0.82 : mouthFrown ? Math.PI * 0.6 : Math.PI * 0.65;
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.135, 0.019, 8, 32, mouthArc),
      toon(0x6C2828)
    );
    mouth.position.set(0, mouthFrown ? -0.18 : -0.25, 0.73);
    mouth.rotation.z = mouthFrown ? Math.PI * 1.2 : mouthBig ? -0.15 : 0;
    mouth.rotation.x = 0.3;
    headGroup.add(mouth);

    // Spots on cheeks (pattern)
    if (pattern === "spots") {
      [-0.25, 0.25, 0.02].forEach((x, i) => {
        const spot = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 16, 12),
          toon(darken(base, 0.25))
        );
        spot.scale.set(1, 0.6, 0.2);
        spot.position.set(x, i === 2 ? -0.25 : 0.55, 0.71);
        headGroup.add(spot);
      });
    }

    // ── EARS (per animal) ────────────────────────────────────────
    buildEars(headGroup, animal, bodyCol, darkCol, bellyCol, toon);

    // ── PANDA EYE PATCHES ───────────────────────────────────────
    if (isPanda) {
      [-0.27, 0.27].forEach((x) => {
        const patch = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 20, 16),
          toon(0x2A2020)
        );
        patch.scale.set(1.2, 0.95, 0.38);
        patch.position.set(x, 0.1, 0.62);
        headGroup.add(patch);
      });
    }

    // ── FUR TUFT (spiky / tufted style) ─────────────────────────
    if (furStyle !== "soft") {
      const tuftMat = toon(darkCol);
      const count   = furStyle === "spiky" ? 4 : 2;
      for (let i = 0; i < count; i++) {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 16), tuftMat);
        tuft.position.set((i - (count - 1) / 2) * 0.15, 0.7, 0.04);
        tuft.rotation.z = (i - (count - 1) / 2) * 0.1;
        headGroup.add(tuft);
      }
    }

    // ══════════════════════════════════════════════════════════
    //  ARMS & HANDS
    // ══════════════════════════════════════════════════════════
    const armGeo  = new THREE.CapsuleGeometry(0.1,  0.38, 8, 12);
    const handGeo = new THREE.SphereGeometry(0.13, 16, 12);

    [-1, 1].forEach((side) => {
      const arm = new THREE.Mesh(armGeo, toon(bodyCol));
      arm.position.set(side * 0.52, 0.06, 0.04);
      arm.rotation.z = side * 0.52;
      root.add(arm);

      const hand = new THREE.Mesh(handGeo, toon(bodyCol));
      hand.position.set(side * 0.72, -0.22, 0.04);
      root.add(hand);
    });

    // ══════════════════════════════════════════════════════════
    //  LEGS & FEET
    // ══════════════════════════════════════════════════════════
    const legGeo  = new THREE.CapsuleGeometry(0.12, 0.3,  8, 12);
    const footMat = toon(shoeCol ?? lighten(bodyCol, 0.18));

    [-1, 1].forEach((side) => {
      const leg = new THREE.Mesh(legGeo, toon(bodyCol));
      leg.position.set(side * 0.22, -0.66, 0);
      root.add(leg);

      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), footMat);
      foot.scale.set(1.3, 0.62, 1.55);
      foot.position.set(side * 0.26, -0.98, 0.11);
      root.add(foot);
    });

    // ══════════════════════════════════════════════════════════
    //  TAIL (per animal)
    // ══════════════════════════════════════════════════════════
    buildTail(root, animal, bodyCol, bellyCol, darkCol, toon);

    // ══════════════════════════════════════════════════════════
    //  OUTFIT
    // ══════════════════════════════════════════════════════════
    if (outfitCol) {
      const shirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.36, 0.64, 36),
        toon(outfitCol)
      );
      shirt.scale.z = 0.88;
      shirt.position.y = -0.1;
      root.add(shirt);

      // Sleeves
      [-1, 1].forEach((side) => {
        const sleeve = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.11, 0.3, 8, 10),
          toon(outfitCol)
        );
        sleeve.position.set(side * 0.48, 0.05, 0.02);
        sleeve.rotation.z = side * 0.5;
        root.add(sleeve);
      });

      // Overalls straps
      if (outfit === "overalls" || outfit === "explorer") {
        [-0.12, 0.12].forEach((x) => {
          const strap = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.54, 0.04),
            toon(0xF0D080)
          );
          strap.position.set(x, -0.05, 0.32);
          root.add(strap);
        });
      }
    }

    // ══════════════════════════════════════════════════════════
    //  HAT
    // ══════════════════════════════════════════════════════════
    if (hat && hat !== "none") buildHat(headGroup, hat, toon);

    // ══════════════════════════════════════════════════════════
    //  GLASSES
    // ══════════════════════════════════════════════════════════
    if (glasses && glasses !== "none") {
      [-0.27, 0.27].forEach((x) => {
        const frame = new THREE.Mesh(
          new THREE.TorusGeometry(0.125, 0.013, 8, 28),
          toon(0x28303A)
        );
        frame.position.set(x, 0.1, 0.72);
        frame.scale.set(1, 1.1, 0.42);
        headGroup.add(frame);
      });
      const bridge = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.01, 0.22, 6, 8),
        toon(0x28303A)
      );
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.1, 0.73);
      headGroup.add(bridge);

      if (glasses === "star") {
        [-0.27, 0.27].forEach((x) => {
          for (let i = 0; i < 5; i++) {
            const pt = new THREE.Mesh(
              new THREE.ConeGeometry(0.03, 0.08, 3),
              toon(0x28303A)
            );
            const a = (i / 5) * Math.PI * 2;
            pt.position.set(x + Math.cos(a) * 0.12, 0.1 + Math.sin(a) * 0.12, 0.72);
            pt.rotation.z = a;
            headGroup.add(pt);
          }
        });
      }
    }

    // ══════════════════════════════════════════════════════════
    //  ACCESSORIES
    // ══════════════════════════════════════════════════════════
    if (accessory === "scarf") {
      const scarf = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.072, 14, 44),
        toon(0x3D7C92)
      );
      scarf.position.set(0, 0.38, 0.06);
      scarf.rotation.x = Math.PI / 2;
      root.add(scarf);
      // Scarf tail hanging
      const tail = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.05, 0.32, 6, 10),
        toon(0x3D7C92)
      );
      tail.position.set(-0.22, 0.14, 0.38);
      tail.rotation.z = 0.3;
      root.add(tail);
    }

    if (accessory === "satchel") {
      const bag = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.22, 0.13),
        toon(0x7B5138)
      );
      bag.position.set(0.56, -0.3, 0.12);
      root.add(bag);
      const strap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.013, 0.013, 0.88, 8),
        toon(0x7B5138)
      );
      strap.rotation.z = 0.38;
      strap.position.set(0.22, 0.05, 0.1);
      root.add(strap);
    }

    if (accessory === "heart" || emote === "heart") {
      const heart = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 18, 14),
        toon(0xEE6090)
      );
      heart.scale.set(1.4, 1, 0.4);
      heart.position.set(0.48, 0.78, 0.88);
      root.add(heart);
    }

    // ══════════════════════════════════════════════════════════
    //  INTERACTION — drag to rotate (touch + mouse)
    // ══════════════════════════════════════════════════════════
    let dragX    = null;
    let baseRotY = THREE.MathUtils.degToRad(rotation);

    const onDown = (e) => {
      if (!interactive) return;
      dragX = e.clientX ?? e.touches?.[0]?.clientX ?? null;
    };
    const onMove = (e) => {
      if (!interactive || dragX === null) return;
      const cx  = e.clientX ?? e.touches?.[0]?.clientX ?? dragX;
      root.rotation.y = baseRotY + (cx - dragX) * 0.014;
    };
    const onUp = (e) => {
      if (!interactive || dragX === null) return;
      const cx  = e.clientX ?? e.changedTouches?.[0]?.clientX ?? dragX;
      baseRotY  = baseRotY + (cx - dragX) * 0.014;
      dragX     = null;
    };

    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);

    // ── Responsive resize ────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w < 1 || h < 1) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    // ══════════════════════════════════════════════════════════
    //  ANIMATION LOOP
    // ══════════════════════════════════════════════════════════
    let t = 0;
    let rafId;
    const fx = EMOTION_FX[emotion] ?? EMOTION_FX.neutral;

    function tick() {
      rafId = requestAnimationFrame(tick);
      t += 0.016;

      // Bob (up-down breathe)
      root.position.y = Math.sin(t * fx.speed * 1.8) * fx.bob;

      // Lean (head tilt for sadness / excitement)
      root.rotation.x = fx.lean;

      // Shake / tremble
      if (fx.shake) {
        root.rotation.z = Math.sin(t * (emotion === "anxious" ? 7 : 5)) * fx.shake;
      } else if (animation === "dance") {
        root.rotation.z = Math.sin(t * 5.2) * 0.08;
        headGroup.rotation.z = Math.sin(t * 5.2 + 1) * 0.06;
      } else {
        root.rotation.z = 0;
      }

      // Gentle arm swing (idle breathing feel)
      const swing = Math.sin(t * fx.speed) * 0.06;
      root.children.forEach((c) => {
        if (c === headGroup || c === torsoMesh || c === belly || c === neck) return;
        // Light oscillation passes through all children (intentional atmosphere)
      });

      // Auto-rotate when not interactive and not being dragged
      if (!interactive) {
        root.rotation.y = baseRotY + Math.sin(t * 0.5) * 0.22;
      } else if (dragX === null) {
        root.rotation.y = baseRotY;
      }

      // Head subtle look-around
      headGroup.rotation.y = Math.sin(t * 0.45) * (interactive ? 0 : 0.1);

      renderer.render(scene, camera);
    }
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
      ro.disconnect();
      renderer.dispose();
      mount.innerHTML = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animal, skin, color, outfit, hat, accessory, glasses, shoes, pattern, furStyle, emote, animation, emotion, rotation, interactive]);

  return <div className="animal-stage" ref={mountRef} aria-label="3D animated character" />;
}

// ══════════════════════════════════════════════════════════════════
//  Per-animal ear builders
// ══════════════════════════════════════════════════════════════════
function buildEars(headGroup, animal, bodyCol, darkCol, bellyCol, toon) {
  switch (animal) {
    case "fox": {
      [-0.33, 0.33].forEach((x, i) => {
        const outer = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.56, 20), toon(bodyCol));
        outer.position.set(x, 0.72, 0.09);
        outer.rotation.z = i === 0 ? 0.16 : -0.16;
        headGroup.add(outer);
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 20), toon(0xFFB5B0));
        inner.position.set(x, 0.73, 0.13);
        inner.rotation.z = i === 0 ? 0.16 : -0.16;
        headGroup.add(inner);
      });
      break;
    }
    case "rabbit": {
      [-0.24, 0.24].forEach((x, i) => {
        const outer = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.76, 8, 12), toon(bodyCol));
        outer.position.set(x, 0.96, 0.06);
        outer.rotation.z = i === 0 ? 0.07 : -0.07;
        headGroup.add(outer);
        const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.56, 8, 10), toon(0xFFB5C5));
        inner.position.set(x, 0.96, 0.12);
        inner.rotation.z = i === 0 ? 0.07 : -0.07;
        headGroup.add(inner);
      });
      break;
    }
    case "bear": {
      [-0.48, 0.48].forEach((x) => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.21, 22, 16), toon(bodyCol));
        ear.scale.set(1, 0.86, 0.7);
        ear.position.set(x, 0.66, 0.05);
        headGroup.add(ear);
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), toon(0xFFB5A0));
        inner.scale.set(1, 0.86, 0.52);
        inner.position.set(x, 0.66, 0.11);
        headGroup.add(inner);
      });
      break;
    }
    case "panda": {
      [-0.48, 0.48].forEach((x) => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.22, 22, 16), toon(0x2A2020));
        ear.scale.set(1, 0.9, 0.7);
        ear.position.set(x, 0.66, 0.05);
        headGroup.add(ear);
      });
      break;
    }
    case "cat": {
      [-0.35, 0.35].forEach((x, i) => {
        const outer = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.44, 20), toon(bodyCol));
        outer.position.set(x, 0.71, 0.07);
        outer.rotation.z = i === 0 ? 0.2 : -0.2;
        headGroup.add(outer);
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 20), toon(0xFFB5A8));
        inner.position.set(x, 0.71, 0.13);
        inner.rotation.z = i === 0 ? 0.2 : -0.2;
        headGroup.add(inner);
      });
      break;
    }
    case "dog": {
      [-0.49, 0.49].forEach((x, i) => {
        const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.44, 8, 12), toon(darkCol));
        ear.position.set(x, 0.42, 0.03);
        ear.rotation.z = i === 0 ? 0.62 : -0.62;
        ear.rotation.x = 0.1;
        headGroup.add(ear);
      });
      break;
    }
    default: {
      // Generic round ears
      [-0.44, 0.44].forEach((x) => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 14), toon(bodyCol));
        ear.scale.set(1, 0.88, 0.65);
        ear.position.set(x, 0.65, 0.04);
        headGroup.add(ear);
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════════
//  Per-animal tail builders
// ══════════════════════════════════════════════════════════════════
function buildTail(root, animal, bodyCol, bellyCol, darkCol, toon) {
  switch (animal) {
    case "fox": {
      // Bushy layered tail curving up
      [[0.16, -0.58, -0.42, 1, 1.6, 0.82],
       [0.3,  -0.32, -0.5,  1, 1.42, 0.78],
       [0.42, -0.04, -0.52, 1, 1.2,  0.72]].forEach(([x, y, z, sx, sy, sz], i) => {
        const seg = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.28 : 0.22 - i * 0.03, 22, 16), toon(bodyCol));
        seg.scale.set(sx, sy, sz);
        seg.position.set(x, y, z);
        root.add(seg);
      });
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), toon(lighten(bellyCol, 0.15)));
      tip.scale.set(1, 1.1, 0.68);
      tip.position.set(0.52, 0.2, -0.52);
      root.add(tip);
      break;
    }
    case "rabbit": {
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.16, 22, 16), toon(0xF5F0F0));
      tail.position.set(0, -0.52, -0.4);
      root.add(tail);
      break;
    }
    case "cat": {
      [[0, -0.5, -0.42], [-0.1, -0.24, -0.49], [-0.2, 0.06, -0.48]].forEach(([x, y, z], i) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.11 - i * 0.02, 14, 10), toon(bodyCol));
        s.scale.set(1, 1.85, 0.78);
        s.position.set(x, y, z);
        root.add(s);
      });
      break;
    }
    case "dog": {
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.32, 8, 10), toon(darkCol));
      tail.position.set(0.05, -0.38, -0.4);
      tail.rotation.z = -0.42;
      root.add(tail);
      break;
    }
    case "bear":
    case "panda": {
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), toon(animal === "panda" ? 0xF5F0E8 : bodyCol));
      tail.position.set(0, -0.52, -0.38);
      root.add(tail);
      break;
    }
  }
}

// ══════════════════════════════════════════════════════════════════
//  Hat builder
// ══════════════════════════════════════════════════════════════════
function buildHat(headGroup, hat, toon) {
  switch (hat) {
    case "hat": {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.04, 36), toon(0x3A4558));
      brim.position.y = 0.72;
      headGroup.add(brim);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.38, 32), toon(0x3A4558));
      top.position.y = 0.92;
      headGroup.add(top);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 32), toon(0xE07050));
      band.position.y = 0.76;
      headGroup.add(band);
      break;
    }
    case "beanie": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.56, 32, 20), toon(0xD87AB8));
      body.scale.set(1, 0.72, 0.9);
      body.position.y = 0.64;
      headGroup.add(body);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), toon(0xF5D0E8));
      pom.position.y = 1.04;
      headGroup.add(pom);
      break;
    }
    case "crown": {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.5, 0.2, 6), toon(0xE8C440));
      band.position.y = 0.74;
      headGroup.add(band);
      for (let i = 0; i < 3; i++) {
        const pt = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), toon(0xE8C440));
        const a = (i / 3) * Math.PI * 2;
        pt.position.set(Math.sin(a) * 0.34, 0.96, Math.cos(a) * 0.34);
        headGroup.add(pt);
        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), toon(0xDD4460));
        gem.position.set(Math.sin(a) * 0.36, 0.84, Math.cos(a) * 0.36);
        headGroup.add(gem);
      }
      break;
    }
  }
}
