import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const EXTERIOR_FILE = "models/env/grove/grove_exterior.glb";

export const GROVE_EXTERIOR_SPAWN = Object.freeze({ x: 0, z: -43.5 });
// Walking in starts on the approach, before the arch and the canopy, so
// the entrance dressing never comes between the camera and the player.
export const GROVE_EXTERIOR_ENTRANCE = Object.freeze({ x: 0, z: -26.4, minX: -4.6, maxX: 4.6, minZ: -27.6, maxZ: -20 });
export const GROVE_EXTERIOR_RETURN = Object.freeze({ x: 0, z: -31.5, heading: Math.PI });
export const GROVE_EXTERIOR_PRESENCE_ANCHORS = Object.freeze([
  { x: -7.5, z: -35.5, rotY: 0.25 },
  { x: 7.5, z: -35.5, rotY: -0.25 },
  { x: -4.5, z: -43.5, rotY: 0 },
  { x: 4.5, z: -43.5, rotY: 0 },
]);

// Decorative park props are intentionally non-blocking. They still read as
// solid visually, but cannot trap the player between broad imported AABBs.
// Only the two structural entrance piers participate in movement collision.
const SOLID_NAME = /^Entrance_(?:Left|Right)_Pier$/i;

function assetUrl() {
  const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : "http://localhost/";
  return new URL(EXTERIOR_FILE, base).href;
}

function prepareMaterials(scene) {
  scene.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      if ("roughness" in material) material.roughness = Math.max(0.62, material.roughness ?? 0.8);
      if ("metalness" in material) material.metalness = Math.min(0.12, material.metalness ?? 0);
      if (material.map) material.map.anisotropy = 8;   // crisper lawn and path patterns at a glancing angle
      material.needsUpdate = true;
    }
  });
}

function buildExteriorColliders(scene) {
  const colliders = [{
    kind: "walkable",
    label: "grove-authored-park",
    regions: [{ minX: -29.0, maxX: 29.0, minZ: -47.5, maxZ: -21.4 }],
  }];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!object.isMesh || !SOLID_NAME.test(object.name)) return;
    const bounds = new THREE.Box3().setFromObject(object);
    if (bounds.isEmpty() || bounds.max.y < 0.25) return;
    const padding = 0.12;
    colliders.push({
      minX: bounds.min.x - padding,
      maxX: bounds.max.x + padding,
      minZ: bounds.min.z - padding,
      maxZ: bounds.max.z + padding,
      label: `grove-exterior:${object.name}`,
    });
  });
  return colliders;
}

export async function loadGroveExterior() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(assetUrl());
  const group = gltf.scene;
  group.name = "grove-authored-mall-and-park";
  prepareMaterials(group);

  let meshes = 0;
  let triangles = 0;
  group.traverse((object) => {
    if (!object.isMesh) return;
    meshes += 1;
    const geometry = object.geometry;
    triangles += geometry.index
      ? geometry.index.count / 3
      : (geometry.attributes.position?.count ?? 0) / 3;
  });

  return {
    group,
    colliders: buildExteriorColliders(group),
    stats: { source: "grove_exterior.glb", meshes, triangles: Math.round(triangles) },
  };
}
