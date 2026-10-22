// src/kingdom/kingdomAssets.js
//
// Loads what assets/kingdom/blender/passes/k20_export.py writes:
//   kingdom_world.glb       land, great tree, dock, arch, path spine, sea and islets
//   kingdom_kit.glb         every placeable piece as a node at the origin
//   kingdom_collision.json  what the world blocks, on a 0.25 m grid
//   kingdom_layout.json     spawn, the house site, the Day 1 layout
//   kingdom_sections.json   the wild land: which section every cell is in, and its growth (k28_sections.py)
// and, only when the developed island is looked at (loadDeveloped):
//   kingdom_decor_kit.glb, kingdom_house_kit.glb, kingdom_life_kit.glb   the other kits
//   kingdom_showcase.json   what the showcase island is (k26_showcase.py)
//   kingdom_view.json       the same island piece by piece (k31_export_view.py)
//
// Game axes: x = Blender x, y = Blender z - 2 (the lawn is the floor),
// z = -Blender y. The GLB exporter already turns Blender's Z-up into Y-up,
// so the only thing left to do here is drop the world by the lawn's height.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CollisionGrid, WALK_BLOCKED } from "../grove/player/collisionGrid.js";
import { addWater } from "./water.js";

const DIR = "models/env/kingdom/";
const BACKDROP = /^(K_Sea|K_Islet|K_Cloud|K_Distant|K_Shore_Foam|K_Home_Beach|Distant_)/;
const NO_SHADOW_CAST = /^(K_Sea|K_Shore_Foam|K_Home_Island|K_Home_Beach|K_Path)/;
// A crown is a cluster of smooth balls of few faces (kgreen.py). Shaded by its
// smooth normals it looks round, but a shadow map knows the real faces: every
// face that leans away from the sun would shadow itself and show as a flat
// patch. So leaves throw shadows and do not take them.
const LEAVES = /^KI_(canopy|blossom|cabbage)/;

function url(file) {
  const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : "http://localhost/";
  return new URL(DIR + file, base).href;
}

export function decodeRuns(base64, length) {
  const binary = atob(base64);
  const out = new Uint8Array(length);
  let at = 0;
  for (let i = 0; i + 1 < binary.length && at < length; i += 2) {
    const value = binary.charCodeAt(i);
    const end = Math.min(length, at + binary.charCodeAt(i + 1));
    if (value) out.fill(value, at, end);
    at = end;
  }
  return out;
}

export function prepare(root, { world } = { world: false }) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    let top = object;
    while (top.parent && top.parent !== root) top = top.parent;
    const backdrop = world && BACKDROP.test(top.name);
    object.castShadow = !(world && (backdrop || NO_SHADOW_CAST.test(top.name)));
    object.receiveShadow = !(world && /^(K_Sea|K_Cloud|K_Shore_Foam)/.test(top.name));
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some((material) => material && LEAVES.test(material.name))) object.receiveShadow = false;
    for (const material of materials) {
      if (!material) continue;
      if ("roughness" in material) material.roughness = Math.max(0.62, material.roughness ?? 0.8);
      if ("metalness" in material) material.metalness = Math.min(0.12, material.metalness ?? 0);
      if (material.map) material.map.anisotropy = 8;
      // Glass and water were authored see-through; everything else is solid.
      if (material.transparent && material.opacity > 0.98 && !/^GM_water_flow/.test(material.name)) material.transparent = false;
      if (/^GM_water_flow/.test(material.name)) { material.transparent = true; material.depthWrite = false; object.renderOrder = 2; object.castShadow = false; }   // falling water is see-through, drawn after the solid world
    }
  });
}

/** The island's solid world plus what the builder needs to know about it. */
export function parseCollision(baked) {
  const zone = baked.island;
  const grid = CollisionGrid.fromBaked(zone, baked);
  const count = zone.nx * zone.nz;
  const surface = decodeRuns(zone.surface, count);
  const base = grid.cells.slice();
  const per = Math.round(1 / baked.cell);   // quarter-cells along one 1 m cell
  /** Can a 1 m cell be built on? Only when all of it is open lawn. */
  function buildable(cx, cz) {
    const ix0 = Math.round((cx - zone.minX) / baked.cell), iz0 = Math.round((cz - zone.minZ) / baked.cell);
    if (ix0 < 0 || iz0 < 0 || ix0 + per > zone.nx || iz0 + per > zone.nz) return false;
    for (let iz = iz0; iz < iz0 + per; iz++) {
      for (let ix = ix0; ix < ix0 + per; ix++) {
        const i = iz * zone.nx + ix;
        if ((base[i] & WALK_BLOCKED) || surface[i] !== 1 || (grid.ground && grid.ground[i] !== 0)) return false;
      }
    }
    return true;
  }
  return { grid, base, surface, buildable, cell: baked.cell };
}

const json = (file) => fetch(url(file)).then((r) => {
  if (!r.ok) throw new Error(`${file}: ${r.status}`);
  return r.json();
});

/** Adds every piece of a kit file to `kit`, by the name of its mesh. */
function addKit(kit, gltf) {
  gltf.scene.updateMatrixWorld(true);
  prepare(gltf.scene, { world: false });
  addWater(gltf.scene);                       // the Grove's moving water, where a piece has some (water.js)
  for (const node of [...gltf.scene.children]) kit.set(node.name, node);
}

/** What the developed island needs on top of loadKingdom(): the decor,
 * house and life kits (added to `kit`) and the showcase's two files. */
export async function loadDeveloped(kit) {
  const loader = new GLTFLoader();
  const [decor, house, life, showcase, view, houseKit] = await Promise.all([
    loader.loadAsync(url("kingdom_decor_kit.glb")),
    loader.loadAsync(url("kingdom_house_kit.glb")),
    loader.loadAsync(url("kingdom_life_kit.glb")),
    json("kingdom_showcase.json"),
    json("kingdom_view.json"),
    json("kingdom_house_kit.json"),
  ]);
  for (const gltf of [decor, house, life]) addKit(kit, gltf);
  return { showcase, view, houseSizes: houseKit.sizes };
}

export async function loadKingdom() {
  const loader = new GLTFLoader();
  const [worldGltf, kitGltf, baked, layout, land] = await Promise.all([
    loader.loadAsync(url("kingdom_world.glb")),
    loader.loadAsync(url("kingdom_kit.glb")),
    json("kingdom_collision.json"),
    json("kingdom_layout.json"),
    json("kingdom_sections.json").catch(() => null),       // an island without wild land still loads
  ]);
  const world = worldGltf.scene;
  world.name = "kingdom-world";
  world.position.y = -(layout.lawnBlenderZ ?? 2);
  prepare(world, { world: true });

  const kit = new Map();
  addKit(kit, kitGltf);

  let triangles = 0;
  world.traverse((o) => { if (o.isMesh) triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { world, kit, layout, land, collision: parseCollision(baked), stats: { worldTriangles: Math.round(triangles), kitPieces: kit.size } };
}
