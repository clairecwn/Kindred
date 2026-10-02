// src/grove/scene/assets.js
//
// Loads the two authored environment GLBs (public/models/env/kit.glb and
// buildings.glb, produced by tools/blender/env_kit.py and
// tools/blender/env_buildings.py) and hands GroveScene a registry of
// plain BufferGeometries keyed by the Blender object name.
//
// Why geometries and not scenes: every kit piece is drawn many times, so
// the scene never instantiates the loaded meshes. It pulls the geometry
// out once and draws N copies from a single InstancedMesh with the shared
// toon material — a hundred benches and a thousand tufts cost the same
// number of draw calls as one.
//
// The GLBs deliberately carry NO normals (it roughly quartered the file
// size, since dropping them let the exporter weld vertices). Flat faceted
// shading is restored here with toNonIndexed() + computeVertexNormals(),
// which is exactly the look the kit was authored for.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const FILES = {
  kit: "models/env/kit.glb",
  buildings: "models/env/buildings.glb",
};

let cached = null;

function baseUrl() {
  if (typeof document !== "undefined" && document.baseURI) return document.baseURI;
  return "/";
}

function prepare(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  g.deleteAttribute("uv");
  g.deleteAttribute("uv1");
  g.deleteAttribute("tangent");
  g.computeVertexNormals(); // non-indexed => genuinely flat per-face normals
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

function collect(gltf, into) {
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    const g = prepare(obj.geometry);
    g.applyMatrix4(obj.matrixWorld);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    into.set(obj.name, g);
  });
}

/**
 * Resolves to { kit: Map<string, BufferGeometry>, buildings: Map<...>,
 * get(name), size(name) }. Cached module-wide: remounting Grove reuses the
 * already-parsed geometry instead of re-downloading.
 */
export function loadEnvAssets() {
  if (cached) return cached;
  const loader = new GLTFLoader();
  const base = baseUrl();
  cached = Promise.all(
    Object.entries(FILES).map(([key, path]) =>
      new Promise((resolve, reject) => {
        loader.load(new URL(path, base).href, (gltf) => {
          const map = new Map();
          collect(gltf, map);
          resolve([key, map]);
        }, undefined, reject);
      }),
    ),
  ).then((pairs) => {
    const registry = Object.fromEntries(pairs);
    const all = new Map([...registry.kit, ...registry.buildings]);
    return {
      ...registry,
      all,
      get(name) {
        const g = all.get(name);
        if (!g) throw new Error(`[grove] unknown env asset "${name}"`);
        return g;
      },
      /** Footprint + height of a piece, so placement code can align things
       * to the ground or space them without hard-coded magic numbers. */
      size(name) {
        const b = all.get(name)?.boundingBox;
        if (!b) return { w: 1, h: 1, d: 1 };
        return { w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z };
      },
      names: [...all.keys()],
    };
  });
  return cached;
}

/**
 * Builds one InstancedMesh from a kit geometry and a list of placements.
 * `placements` entries: { x, z, y?, rotY?, scale?, tint? }. A `tint` is
 * multiplied into the piece's authored vertex colours via instanceColor,
 * which is how one tree geometry becomes a whole varied wood.
 */
export function instanceProp(geometry, material, placements, name = "prop") {
  if (!placements.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  mesh.name = name;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  let tinted = false;
  placements.forEach((p, i) => {
    e.set(0, p.rotY ?? 0, 0);
    q.setFromEuler(e);
    const sc = p.scale ?? 1;
    v.set(p.x, p.y ?? 0, p.z);
    s.set(sc, p.scaleY ?? sc, sc);
    m.compose(v, q, s);
    mesh.setMatrixAt(i, m);
    if (p.tint !== undefined) { tinted = true; c.set(p.tint); mesh.setColorAt(i, c); }
    else { c.set(0xffffff); mesh.setColorAt(i, c); }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = true;
  mesh.computeBoundingSphere();
  if (!tinted && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}
