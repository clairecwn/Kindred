// src/grove/scene/districts.js
//
// Compatibility surface. The authored layout of the world now lives in
// scene/worldLayout.js — this module simply re-exports the pieces older
// callers (GroveView.jsx, the game modes, any future minimap) already
// import from here, so moving the layout didn't require touching them.
//
// New code should import from ./worldLayout.js directly.

export {
  DISTRICTS, ROOM_GRAPH, CAUSEWAYS, SOCIAL_SPOTS, BUILDINGS as LAYOUT_BUILDINGS,
  SCENERY_LANDMARKS, ISLAND, HOME_ISLE, BRIDGE, SPAWN, MALL_PARK,
  buildColliders, districtAt, doorPoints, presenceAnchors, inSpineCorridor,
} from "./worldLayout.js";
