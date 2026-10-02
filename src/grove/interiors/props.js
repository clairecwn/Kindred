// src/grove/interiors/props.js
//
// Turns a catalog item's tiny `shape` descriptor (see economy/catalog.js)
// into an actual full-size THREE mesh — no binary assets, no textures,
// just a handful of primitive-geometry recipes so every stall item, hand
// carry, and placed object shares one procedural vocabulary. Materials are
// plain MeshStandardMaterial (interiors are small, close-up spaces lit by
// a couple of point lights — the toon ramp is tuned for the outdoor plaza
// and would read muddy indoors) rather than reusing GroveScene's toon
// helper, which needs a live GroveScene instance to call.

import * as THREE from "three";

const materialCache = new Map();
function mat(color) {
  const key = color;
  if (materialCache.has(key)) return materialCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05 });
  materialCache.set(key, m);
  return m;
}

/** Builds a small group representing one catalog item at roughly `scale`
 * metres tall, centred on its own origin at the base (y=0 sits on a
 * shelf/floor). Unknown shape kinds fall back to a plain cube so a new
 * catalog entry never crashes the interior builder. */
export function buildDisplayMesh(shape, scale = 1) {
  const group = new THREE.Group();
  const color = shape?.color ?? 0xd4a853;
  const s = scale;
  switch (shape?.kind) {
    case "cone": {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.45 * s, 0.5 * s, 12), mat(color));
      m.position.y = 0.25 * s;
      group.add(m);
      break;
    }
    case "sphere": {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 14, 10), mat(color));
      m.position.y = 0.32 * s;
      group.add(m);
      break;
    }
    case "cylinder": {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.28 * s, 0.5 * s, 14), mat(color));
      m.position.y = 0.25 * s;
      group.add(m);
      break;
    }
    case "cylinderTall": {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.9 * s, 10), mat(color));
      m.position.y = 0.45 * s;
      group.add(m);
      const bell = new THREE.Mesh(new THREE.ConeGeometry(0.18 * s, 0.22 * s, 10), mat(color));
      bell.position.y = 0.05 * s;
      bell.rotation.x = Math.PI;
      group.add(bell);
      break;
    }
    case "torus": {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.28 * s, 0.09 * s, 10, 16), mat(color));
      m.position.y = 0.32 * s;
      m.rotation.x = Math.PI / 2;
      group.add(m);
      break;
    }
    case "box": {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.34 * s, 0.34 * s), mat(color));
      m.position.y = 0.17 * s;
      group.add(m);
      break;
    }
    case "jar": {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.22 * s, 0.4 * s, 12), mat(color));
      m.position.y = 0.2 * s;
      group.add(m);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 0.06 * s, 12), mat(0x6a5a48));
      lid.position.y = 0.43 * s;
      group.add(lid);
      break;
    }
    case "tart": {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * s, 0.28 * s, 0.14 * s, 16), mat(0xe8c888));
      m.position.y = 0.07 * s;
      group.add(m);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(color));
      top.position.y = 0.14 * s;
      group.add(top);
      break;
    }
    case "teapot": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 14, 10), mat(color));
      body.position.y = 0.3 * s;
      group.add(body);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.05 * s, 0.28 * s, 8), mat(color));
      spout.position.set(0.28 * s, 0.32 * s, 0);
      spout.rotation.z = Math.PI / 3;
      group.add(spout);
      break;
    }
    case "mat": {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * s, 0.45 * s, 0.03 * s, 4), mat(color));
      m.position.y = 0.015 * s;
      m.rotation.y = Math.PI / 4;
      group.add(m);
      break;
    }
    case "lamp": {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.18 * s, 0.05 * s, 10), mat(0x6a5a48));
      group.add(base);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.5 * s, 6), mat(0x6a5a48));
      pole.position.y = 0.27 * s;
      group.add(pole);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16 * s, 0.16 * s, 10), mat(color));
      shade.position.y = 0.55 * s;
      group.add(shade);
      break;
    }
    case "birdhouse": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.3 * s, 0.3 * s), mat(color));
      body.position.y = 0.2 * s;
      group.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.24 * s, 0.2 * s, 4), mat(0x5a4632));
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 0.45 * s;
      group.add(roof);
      break;
    }
    case "mask": {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.24 * s, 14, 10, 0, Math.PI), mat(color));
      m.position.y = 0.3 * s;
      m.rotation.y = Math.PI / 2;
      group.add(m);
      break;
    }
    case "potPlant": {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.14 * s, 0.24 * s, 10), mat(0xc06a3e));
      pot.position.y = 0.12 * s;
      group.add(pot);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 8, 6), mat(color));
      leaf.position.y = 0.34 * s;
      group.add(leaf);
      break;
    }
    default: {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.4 * s, 0.4 * s), mat(color));
      m.position.y = 0.2 * s;
      group.add(m);
    }
  }
  return group;
}
