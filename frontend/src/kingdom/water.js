// src/kingdom/water.js
//
// The Kingdom's moving water is the Grove's: the fountain, the round pond and
// the pond tiles carry WATER_<Piece>_<Part> meshes (built by
// assets/kingdom/blender/passes/kwater.py the way the Grove's p26_water.py
// builds its fountains), unwrapped so V runs the way the water travels. The
// Grove's src/grove/scene/water.js slides their textures: ripple bands spread
// across pools and bowls, streaks run down the falling sheet and along the jets.
// Every kit file that has water is registered once (addWater); the scene ticks
// them all each frame (tickWater). Copies of a piece share its materials, so one
// slide moves the water on every copy.

import { createWaterFlow } from "../grove/scene/water.js";

const flows = [];

/** Finds the water in a loaded kit and keeps it moving. Returns how many water meshes it found. */
export function addWater(root) {
  root?.traverse?.((node) => { if (node.isMesh && /^WATER_/.test(node.name)) node.castShadow = false; });     // water throws no shadow
  const flow = createWaterFlow(root);
  if (flow.count) flows.push(flow);
  return flow.count;
}

export function tickWater(dt) { for (const flow of flows) flow.update(dt); }
