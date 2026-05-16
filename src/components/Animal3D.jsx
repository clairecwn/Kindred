import { useEffect, useRef } from "react";
import * as THREE from "three";

const bodyColors = {
  honey: 0xf2b66d,
  mint: 0x82c9a0,
  berry: 0xcf7aa4,
  sky: 0x83aee8,
  cocoa: 0x9b7256,
  ivory: 0xf4dcc4,
  slate: 0x738392
};

const outfitColors = {
  none: null,
  hoodie: 0x466a8f,
  jacket: 0xe97451,
  overalls: 0x315f73,
  kimono: 0xd76ba8,
  explorer: 0x8c6f49
};

const shoeColors = {
  none: 0x3f5360,
  sneakers: 0xf4f7f8,
  boots: 0x6b4d38,
  sandals: 0xb88755
};

const emotionMotion = {
  sad: { bob: 0.022, speed: 0.75, lean: -0.035 },
  tired: { bob: 0.018, speed: 0.62, lean: -0.025 },
  calm: { bob: 0.03, speed: 0.82, lean: 0 },
  anxious: { bob: 0.034, speed: 1.25, lean: 0.02 },
  excited: { bob: 0.07, speed: 1.55, lean: 0.04 },
  happy: { bob: 0.05, speed: 1.08, lean: 0.02 },
  neutral: { bob: 0.038, speed: 0.9, lean: 0 }
};

function makeEar(kind, material) {
  if (kind === "rabbit" || kind === "bunny") {
    const group = new THREE.Group();
    const geo = new THREE.CapsuleGeometry(0.16, 0.62, 8, 14);
    const left = new THREE.Mesh(geo, material);
    const right = new THREE.Mesh(geo, material);
    left.position.set(-0.27, 0.94, 0);
    right.position.set(0.27, 0.94, 0);
    left.rotation.z = -0.18;
    right.rotation.z = 0.18;
    group.add(left, right);
    return group;
  }

  if (kind === "bear" || kind === "panda") {
    const group = new THREE.Group();
    const geo = new THREE.SphereGeometry(0.2, 24, 18);
    const left = new THREE.Mesh(geo, material);
    const right = left.clone();
    left.scale.set(1, 0.9, 0.62);
    right.scale.copy(left.scale);
    left.position.set(-0.42, 0.7, 0.02);
    right.position.set(0.42, 0.7, 0.02);
    group.add(left, right);
    return group;
  }

  if (kind === "dog") {
    const group = new THREE.Group();
    const geo = new THREE.CapsuleGeometry(0.13, 0.42, 8, 14);
    const left = new THREE.Mesh(geo, material);
    const right = left.clone();
    left.position.set(-0.4, 0.55, 0.05);
    right.position.set(0.4, 0.55, 0.05);
    left.rotation.z = 0.55;
    right.rotation.z = -0.55;
    group.add(left, right);
    return group;
  }

  const group = new THREE.Group();
  const geo = new THREE.ConeGeometry(0.22, 0.4, 24);
  const left = new THREE.Mesh(geo, material);
  const right = new THREE.Mesh(geo, material);
  left.position.set(-0.34, 0.72, 0);
  right.position.set(0.34, 0.72, 0);
  left.rotation.z = 0.32;
  right.rotation.z = -0.32;
  group.add(left, right);
  return group;
}

export default function Animal3D({
  emotion,
  animal,
  skin,
  color,
  outfit = "none",
  hat = "none",
  accessory = "none",
  glasses = "none",
  shoes = "none",
  pattern = "none",
  furStyle = "soft",
  emote = "wave",
  animation = "idle",
  rotation = 0,
  interactive = false
}) {
  const mountRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0.94, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 5);
    scene.add(key, new THREE.AmbientLight(0xffffff, 1.5));

    const root = new THREE.Group();
    scene.add(root);

    const bodyColor = bodyColors[skin || color] || bodyColors.honey;
    const accentColor = animal === "panda" ? 0x242a2e : bodyColor;
    const outfitColor = outfitColors[outfit];

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 48, 32),
      new THREE.MeshStandardMaterial({ color: animal === "panda" ? 0xf5efe5 : bodyColor, roughness: 0.58 })
    );
    body.scale.set(0.92, 1.08, 0.72);
    body.position.y = -0.64;
    root.add(body);

    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 32, 20),
      new THREE.MeshStandardMaterial({ color: 0xffe1bd, roughness: 0.6 })
    );
    belly.scale.set(0.9, 1.08, 0.22);
    belly.position.set(0, -0.66, 0.55);
    root.add(belly);

    const face = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 40, 28),
      new THREE.MeshStandardMaterial({ color: 0xffe1bd, roughness: 0.6 })
    );
    face.scale.set(1.08, 0.78, 0.34);
    face.position.set(0, 0.2, 0.78);
    root.add(face);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 48, 30),
      new THREE.MeshStandardMaterial({ color: animal === "panda" ? 0xf5efe5 : bodyColor, roughness: 0.58 })
    );
    head.scale.set(1, 0.92, 0.88);
    head.position.y = 0.28;
    root.add(head);
    head.renderOrder = -1;

    const earMaterial = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.6 });
    root.add(makeEar(animal, earMaterial));

    if (furStyle !== "soft") {
      const tuftMaterial = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.64 });
      const tuftCount = furStyle === "spiky" ? 3 : 2;
      Array.from({ length: tuftCount }).forEach((_, index) => {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 16), tuftMaterial);
        tuft.position.set((index - (tuftCount - 1) / 2) * 0.13, 0.95, 0.03);
        tuft.rotation.z = (index - 1) * 0.12;
        root.add(tuft);
      });
    }

    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2528, roughness: 0.4 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), eyeMaterial);
    const rightEye = leftEye.clone();
    leftEye.position.set(-0.19, 0.34, 1.08);
    rightEye.position.set(0.19, 0.34, 1.08);
    root.add(leftEye, rightEye);

    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x3c2c2c })
    );
    nose.scale.set(1.2, 0.85, 0.7);
    nose.position.set(0, 0.15, 1.16);
    root.add(nose);

    const mouthCurve = emotion === "sad" || emotion === "anxious" ? -0.18 : emotion === "excited" ? 0.3 : 0.14;
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.012, 8, 30, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x6b3d32 })
    );
    mouth.position.set(0, 0.03 + mouthCurve * 0.1, 1.17);
    mouth.rotation.x = Math.PI / 2;
    mouth.rotation.z = mouthCurve < 0 ? Math.PI : 0;
    root.add(mouth);

    const limbMaterial = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.62 });
    const footMaterial = new THREE.MeshStandardMaterial({ color: shoeColors[shoes] || shoeColors.none, roughness: 0.55 });
    const armGeo = new THREE.CapsuleGeometry(0.1, 0.5, 8, 16);
    const leftArm = new THREE.Mesh(armGeo, limbMaterial);
    const rightArm = leftArm.clone();
    leftArm.position.set(-0.67, -0.62, 0.05);
    rightArm.position.set(0.67, -0.62, 0.05);
    leftArm.rotation.z = 0.38;
    rightArm.rotation.z = -0.38;
    root.add(leftArm, rightArm);

    const legGeo = new THREE.CapsuleGeometry(0.12, 0.34, 8, 16);
    const leftLeg = new THREE.Mesh(legGeo, footMaterial);
    const rightLeg = leftLeg.clone();
    leftLeg.position.set(-0.24, -1.38, 0.06);
    rightLeg.position.set(0.24, -1.38, 0.06);
    root.add(leftLeg, rightLeg);

    if (animal === "fox" || animal === "cat") {
      const tail = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.13, 0.9, 10, 18),
        limbMaterial
      );
      tail.position.set(0.72, -0.88, -0.28);
      tail.rotation.z = -0.95;
      tail.rotation.y = -0.25;
      root.add(tail);
    }

    if (outfitColor) {
      const shirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.62, 0.74, 40),
        new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.5 })
      );
      shirt.position.y = -0.72;
      shirt.scale.z = 0.78;
      root.add(shirt);

      if (outfit === "overalls" || outfit === "explorer") {
        [-0.22, 0.22].forEach((x) => {
          const strap = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.58, 0.04),
            new THREE.MeshStandardMaterial({ color: 0xf0d08d, roughness: 0.48 })
          );
          strap.position.set(x, -0.44, 0.58);
          strap.rotation.z = x < 0 ? -0.08 : 0.08;
          root.add(strap);
        });
      }
    }

    if (pattern === "spots") {
      [-0.24, 0.22, 0.03].forEach((x, index) => {
        const spot = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 16, 12),
          new THREE.MeshStandardMaterial({ color: 0x6f5647, roughness: 0.6 })
        );
        spot.scale.set(1, 0.62, 0.18);
        spot.position.set(x, index === 2 ? -0.24 : 0.58, 0.72);
        root.add(spot);
      });
    }

    if (pattern === "blush") {
      [-0.34, 0.34].forEach((x) => {
        const cheek = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 16, 12),
          new THREE.MeshStandardMaterial({ color: 0xf2a3a8, roughness: 0.7 })
        );
        cheek.scale.set(1.3, 0.72, 0.18);
        cheek.position.set(x, 0.2, 1.14);
        root.add(cheek);
      });
    }

    if (accessory === "scarf") {
      const scarf = new THREE.Mesh(
        new THREE.TorusGeometry(0.54, 0.055, 16, 48),
        new THREE.MeshStandardMaterial({ color: 0x3d7c92, roughness: 0.45 })
      );
      scarf.position.set(0, -0.2, 0.08);
      scarf.rotation.x = Math.PI / 2;
      root.add(scarf);
    }

    const headwear = hat !== "none" ? hat : accessory;
    if (headwear === "hat" || headwear === "crown" || headwear === "beanie") {
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.06, headwear === "crown" ? 6 : 32),
        new THREE.MeshStandardMaterial({ color: headwear === "crown" ? 0xf6c65b : 0x3c4856 })
      );
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.34, headwear === "beanie" ? 0.18 : 0.28, 32),
        new THREE.MeshStandardMaterial({ color: headwear === "beanie" ? 0xd76ba8 : 0x556170 })
      );
      brim.position.y = 0.84;
      top.position.y = 1.01;
      root.add(brim, top);
    }

    if (glasses !== "none" || accessory === "glasses") {
      [-0.19, 0.19].forEach((x) => {
        const lens = new THREE.Mesh(
          new THREE.TorusGeometry(0.11, 0.01, 8, 24),
          new THREE.MeshStandardMaterial({ color: 0x26323d })
        );
        lens.position.set(x, 0.34, 1.1);
        root.add(lens);
      });
    }

    if (accessory === "satchel") {
      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 1.05, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x7b5138, roughness: 0.56 })
      );
      strap.position.set(0.02, -0.48, 0.62);
      strap.rotation.z = -0.48;
      root.add(strap);
    }

    if (emote === "heart") {
      const heart = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 18, 12),
        new THREE.MeshStandardMaterial({ color: 0xee6f8f, roughness: 0.45 })
      );
      heart.scale.set(1.3, 1, 0.35);
      heart.position.set(0.42, 0.7, 0.92);
      root.add(heart);
    }

    root.rotation.y = THREE.MathUtils.degToRad(rotation);

    const onPointerDown = (event) => {
      if (!interactive) return;
      dragRef.current = event.clientX;
    };
    const onPointerMove = (event) => {
      if (!interactive || dragRef.current === null) return;
      const delta = event.clientX - dragRef.current;
      root.rotation.y = THREE.MathUtils.degToRad(Math.max(-90, Math.min(90, rotation + delta * 0.4)));
    };
    const onPointerUp = () => {
      dragRef.current = null;
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    const resize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);

    let frame = 0;
    let animationId = 0;
    const motion = emotionMotion[emotion] || emotionMotion.neutral;
    const animate = () => {
      frame += 0.016;
      if (!interactive && rotation === 0) root.rotation.y = Math.sin(frame * 0.8) * 0.18;
      root.position.y = Math.sin(frame * 1.8 * motion.speed) * motion.bob;
      root.rotation.x = motion.lean;
      if (emotion === "excited") root.rotation.z = Math.sin(frame * 4) * 0.045;
      if (emotion === "anxious") root.rotation.z = Math.sin(frame * 8) * 0.014;
      if (animation === "dance") root.rotation.z = Math.sin(frame * 5) * 0.07;
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
      mount.innerHTML = "";
    };
  }, [animal, skin, color, outfit, hat, accessory, glasses, shoes, pattern, furStyle, emote, animation, emotion, rotation, interactive]);

  return <div className="animal-stage" ref={mountRef} aria-label="3D animated character" />;
}
