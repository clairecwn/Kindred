// src/grove/scene/water.js
//
// Flowing water for the fountains. The model carries the water as separate
// meshes named WATER_<Fountain>_<Part> (see p26_water.py in the Grove
// Blender scripts): Pool and Bowl are ripple rings, Fall and Jets are
// streaks. Each is unwrapped so that V runs the way the water travels, so
// all the game has to do is slide the texture along V. Nothing moves as
// geometry, which keeps it free on any device.

import * as THREE from "three";

// Repeats of the texture per second. Keep in step with SPEED in p26_water.py,
// so the game and the Blender preview run at the same pace.
export const WATER_SPEED = Object.freeze({ flow: 1.1, rings: 0.22 });

export function waterKind(name) {
  if (!/^WATER_/.test(name ?? "")) return null;
  return /_(Pool|Bowl)(_|$)/.test(name) ? "rings" : "flow";
}

/**
 * Finds the water in a loaded model and returns { count, update(dt) }.
 * Safe on a model with no water in it (count is 0, update does nothing).
 */
export function createWaterFlow(root) {
  const maps = new Map();     // texture -> repeats per second
  let count = 0;
  root?.traverse?.((node) => {
    const kind = node.isMesh ? waterKind(node.name) : null;
    if (!kind) return;
    count += 1;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      const map = material?.map;
      if (!map) continue;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.needsUpdate = true;
      maps.set(map, WATER_SPEED[kind]);
      material.roughness = 0.2;
      if (kind === "flow") {
        // A see-through sheet: drawn after the solid world, both faces, and
        // without hiding the water behind it.
        material.transparent = true;
        material.depthWrite = false;
        material.side = THREE.DoubleSide;
        node.renderOrder = 2;
      }
      material.needsUpdate = true;
    }
  });
  return {
    count,
    update(dt) {
      // The pattern travels towards +V in the model, which is -V in glTF's
      // flipped texture space: sampling further along as time passes.
      for (const [map, speed] of maps) map.offset.y = (map.offset.y + speed * dt) % 1;
    },
  };
}
