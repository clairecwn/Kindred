import { useEffect, useRef } from "react";
import * as THREE from "three";

const bodyColors = {
  honey: 0xf2b66d,
  mint: 0x82c9a0,
  berry: 0xcf7aa4,
  sky: 0x83aee8,
  cocoa: 0x9b7256
};

function makeEar(kind, material) {
  if (kind === "bunny") {
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

export default function Animal3D({ emotion, animal, color, accessory }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 1.05, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 5);
    scene.add(key, new THREE.AmbientLight(0xffffff, 1.5));

    const root = new THREE.Group();
    scene.add(root);

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.86, 48, 32),
      new THREE.MeshStandardMaterial({ color: bodyColors[color] || bodyColors.honey, roughness: 0.58 })
    );
    body.scale.set(1, 1.12, 0.9);
    body.position.y = -0.1;
    root.add(body);

    const face = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 32, 24),
      new THREE.MeshStandardMaterial({ color: 0xffe1bd, roughness: 0.6 })
    );
    face.scale.set(1.12, 0.78, 0.32);
    face.position.set(0, 0.04, 0.76);
    root.add(face);

    const earMaterial = new THREE.MeshStandardMaterial({ color: bodyColors[color] || bodyColors.honey, roughness: 0.6 });
    root.add(makeEar(animal, earMaterial));

    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2528, roughness: 0.4 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), eyeMaterial);
    const rightEye = leftEye.clone();
    leftEye.position.set(-0.19, 0.18, 1.04);
    rightEye.position.set(0.19, 0.18, 1.04);
    root.add(leftEye, rightEye);

    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x3c2c2c })
    );
    nose.scale.set(1.2, 0.85, 0.7);
    nose.position.set(0, 0.02, 1.12);
    root.add(nose);

    const mouthCurve = emotion === "sad" || emotion === "anxious" ? -0.18 : emotion === "excited" ? 0.3 : 0.14;
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.012, 8, 30, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x6b3d32 })
    );
    mouth.position.set(0, -0.11 + mouthCurve * 0.1, 1.13);
    mouth.rotation.x = Math.PI / 2;
    mouth.rotation.z = mouthCurve < 0 ? Math.PI : 0;
    root.add(mouth);

    if (accessory === "scarf") {
      const scarf = new THREE.Mesh(
        new THREE.TorusGeometry(0.54, 0.055, 16, 48),
        new THREE.MeshStandardMaterial({ color: 0x3d7c92, roughness: 0.45 })
      );
      scarf.position.set(0, -0.42, 0.08);
      scarf.rotation.x = Math.PI / 2;
      root.add(scarf);
    }

    if (accessory === "hat") {
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.06, 32),
        new THREE.MeshStandardMaterial({ color: 0x3c4856 })
      );
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.34, 0.28, 32),
        new THREE.MeshStandardMaterial({ color: 0x556170 })
      );
      brim.position.y = 0.69;
      top.position.y = 0.86;
      root.add(brim, top);
    }

    const resize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);

    let frame = 0;
    let animationId = 0;
    const animate = () => {
      frame += 0.016;
      root.rotation.y = Math.sin(frame * 0.8) * 0.18;
      root.position.y = Math.sin(frame * 1.8) * 0.045;
      if (emotion === "excited") root.rotation.z = Math.sin(frame * 4) * 0.045;
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      mount.innerHTML = "";
    };
  }, [animal, color, accessory, emotion]);

  return <div className="animal-stage" ref={mountRef} aria-label="3D animated character" />;
}
