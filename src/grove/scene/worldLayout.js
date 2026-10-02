// src/grove/scene/worldLayout.js
//
// THE KINDRED COMMONS — the authored layout of the shared world.
//
// Everything spatial about Grove lives here as plain data: no THREE, no
// React, no DOM, so it can be unit-tested, read by a future minimap, and
// changed by a designer without touching build code. GroveScene.js turns
// this into geometry; PlayerController consumes `buildColliders()`;
// InteriorManager consumes `BUILDINGS`.
//
// ── Layout doctrine ───────────────────────────────────────────────────
// A hub-and-spoke board: one raised island plate sitting in calm water,
// a single tall landmark at dead centre, five themed district terraces
// hanging off it on short paved causeways, an arrival landing at the
// player's back, and the player's own small island across a bridge. The
// principles are the ones premium casual games use to make a space
// readable in three seconds — NOT any specific game's level:
//
//   1. ONE hero silhouette (the Kindred Tree) visible from everywhere, so
//      the player is never lost and always has a "home" direction.
//   2. Each district is a closed, rounded terrace with its own floor
//      colour, its own roofline colour, and exactly one big landmark
//      building. Colour + silhouette, never a text label, says where you
//      are (Design Bible s2: "readability first ... use scale, saturation
//      and focus, not colour alone").
//   3. Spokes never touch each other. To go from the Cafe to the Garden
//      you pass back through the hub, which is the decompression beat
//      between two different social temperatures (Design Bible s8).
//   4. Sightlines: the arrival causeway runs dead down the world's spine,
//      so the opening frame is Landing -> causeway -> Tree -> Commons.
//      Nothing tall is allowed inside that corridor.
//   5. Quiet corners everywhere. Every district carries seating that is
//      NOT on the main path, because "multiple entry points and quiet
//      corners" is a hard requirement, not decoration.
//
// Angles: `facing` is the world direction a building's door points, in
// radians, where 0 = +Z. Buildings are authored with their door on local
// +Z, so a mesh's rotation.y is simply `facing`. Facings are kept on the
// cardinals so the AABB collider generator below stays exact.

const HALF_PI = Math.PI / 2;

export const ISLAND = Object.freeze({
  center: { x: 0, z: 0 },
  radius: 54,        // walkable plate
  beach: 3.5,        // sand ring outside the grass
  cliffDepth: 6,     // how far the rock skirt drops below the plate
  seaLevel: -2.4,
});

export const HOME_ISLE = Object.freeze({
  center: { x: 0, z: -80 },
  radius: 16,
  beach: 2.5,
});

export const BRIDGE = Object.freeze({
  minX: -2.2, maxX: 2.2, minZ: -64.5, maxZ: -52.5,
  deckY: 0,
});

export const SPAWN = Object.freeze({ x: 0, z: -30 });

// A compact play garden beside the Commons. It borrows broad interaction
// principles from Nintendo's public Mario design interviews—function-first
// forms, readable landmarks, dense optional discoveries, and one memorable
// transformation—without reproducing Mario geometry, characters, or layouts.
export const MALL_PARK = Object.freeze({
  id: "canopy-park",
  label: "Canopy Park",
  center: { x: -18, z: 27 },
  radius: 7.2,
  hero: { id: "bloom-chimes", x: -18, z: 27, radius: 1.45 },
  portal: {
    x: -14.1,
    z: 29.4,
    clearWidth: 3.3,
    postRadius: 0.24,
    posts: [
      { x: -15.75, z: 29.4 },
      { x: -12.45, z: 29.4 },
    ],
  },
  discoveries: [
    { id: "sun-petal", x: -22.6, z: 24.7, color: 0xffc85a },
    { id: "mint-petal", x: -14.2, z: 23.5, color: 0x79c98b },
    { id: "rose-petal", x: -20.8, z: 32.2, color: 0xe98593 },
  ],
});

// The authored mall interior is loaded only after entering, but the outdoor
// world still needs to promise that destination honestly. This backing mass
// gives the three ground-floor shop pavilions a visible three-storey home.
export const MALL_EXTERIOR = Object.freeze({
  id: "commons-mall-exterior",
  center: { x: 0, z: 49.2 },
  width: 30,
  depth: 1.6,
  height: 10.4,
});

// ── Districts ──────────────────────────────────────────────────────────
// `ladderFloor` is the social-exposure rung a district defaults to (see
// social/SocialLadder.js). Quiet places default LOW.
export const DISTRICTS = Object.freeze([
  {
    id: "hub",
    label: "Lanternfall Plaza",
    sub: "The Kindred Tree. Everyone passes through; nobody has to stop.",
    center: { x: 0, z: 0 }, shape: "circle", radius: 13,
    size: { w: 26, d: 26 },
    accent: "#D9A94F", floor: 0xdcc79b, trim: 0xb8935a,
    ladderFloor: "AMBIENT", minigame: null,
  },
  {
    id: "mall",
    label: "The Commons",
    sub: "Three shopfronts and a courtyard. Browsing counts as an outing.",
    center: { x: 0, z: 34 }, shape: "circle", radius: 17,
    size: { w: 34, d: 34 },
    accent: "#D98A9B", floor: 0xdfcdac, trim: 0xb8765a,
    ladderFloor: "AMBIENT", minigame: null,
    npc: { id: "pell", homeOffset: { x: -12, z: 3 } },
  },
  {
    id: "cafe",
    label: "Hearthlight",
    sub: "Wren's pavilion. Low-stakes chat, only if both sides want it.",
    center: { x: 34, z: 6 }, shape: "circle", radius: 11,
    size: { w: 22, d: 22 },
    accent: "#5B9B8A", floor: 0xd8c4a4, trim: 0x4f8b7a,
    ladderFloor: "AMBIENT", minigame: null,
    npc: { id: "wren", homeOffset: { x: 4, z: 0.5 } },
  },
  {
    id: "garden",
    label: "The Quiet Garden",
    sub: "Bramble's beds and the glasshouse. Solitude is the point.",
    center: { x: -34, z: 6 }, shape: "circle", radius: 11,
    size: { w: 22, d: 22 },
    accent: "#8FB89A", floor: 0xd2ca9f, trim: 0x5f8a62,
    ladderFloor: "GHOST", minigame: "quiet-round",
    npc: { id: "bramble", homeOffset: { x: 1.5, z: -3.5 } },
  },
  {
    id: "stage",
    label: "The Round",
    sub: "Corvin's bandstand and a ring of benches. Showing up is the act.",
    center: { x: 22, z: -26 }, shape: "circle", radius: 11,
    size: { w: 22, d: 22 },
    accent: "#A98BD1", floor: 0xd6c3aa, trim: 0x7a5a8b,
    ladderFloor: "EMOTE", minigame: "festival-games",
    npc: { id: "corvin", homeOffset: { x: -2, z: -4 } },
  },
  {
    id: "workshop",
    label: "The Makery",
    sub: "Tansy's benches and the waterwheel. Make something badly, on purpose.",
    center: { x: -22, z: -26 }, shape: "circle", radius: 11,
    size: { w: 22, d: 22 },
    accent: "#C4744A", floor: 0xd9c2a0, trim: 0x98562f,
    ladderFloor: "AMBIENT", minigame: "hearthfire-kitchen",
    npc: { id: "tansy", homeOffset: { x: 2, z: -3.5 } },
  },
  {
    id: "landing",
    label: "The Landing",
    sub: "Marlow's jetty. Where you came in, and the way to your own island.",
    center: { x: 0, z: -44 }, shape: "circle", radius: 9,
    size: { w: 18, d: 18 },
    accent: "#B9A487", floor: 0xd0bf9a, trim: 0x8a7557,
    ladderFloor: "AMBIENT", minigame: null,
    npc: { id: "marlow", homeOffset: { x: -3.5, z: -1.5 } },
  },
  {
    id: "home",
    label: "Your Island",
    sub: "Small, yours, and never judged. Nobody visits unless you ask.",
    center: { x: 0, z: -80 }, shape: "circle", radius: 16,
    size: { w: 32, d: 32 },
    accent: "#D9A94F", floor: 0xd3c69c, trim: 0xa58a5a,
    ladderFloor: "SOLO", minigame: "long-field",
    npc: { id: "nim", homeOffset: { x: 6, z: 4 } },
  },
]);

// Only the hub connects districts, except the Landing, which additionally
// connects to the player's own island by the bridge. Nothing else is
// adjacent: crossing the hub between two districts is the decompression
// beat, and the bridge is a deliberate "leaving the social world" walk.
export const ROOM_GRAPH = Object.freeze({
  hub: ["mall", "cafe", "garden", "stage", "workshop", "landing"],
  mall: ["hub"], cafe: ["hub"], garden: ["hub"], stage: ["hub"], workshop: ["hub"],
  landing: ["hub", "home"],
  home: ["landing"],
});

// ── Causeways: the paved spokes between the hub and each district ──────
export const CAUSEWAYS = Object.freeze(
  DISTRICTS.filter((d) => d.id !== "hub" && d.id !== "home").map((d) => {
    const hub = DISTRICTS[0];
    const dist = Math.hypot(d.center.x, d.center.z);
    const dir = { x: d.center.x / dist, z: d.center.z / dist };
    const from = { x: dir.x * (hub.radius - 1.5), z: dir.z * (hub.radius - 1.5) };
    const to = { x: dir.x * (dist - d.radius + 1.5), z: dir.z * (dist - d.radius + 1.5) };
    return {
      districtId: d.id, from, to, width: d.id === "mall" ? 6 : 4.6,
      angle: Math.atan2(dir.x, dir.z),
      length: Math.hypot(to.x - from.x, to.z - from.z),
    };
  }),
);

// ── Landmark buildings ─────────────────────────────────────────────────
// `asset` names a mesh in public/models/env/buildings.glb. `facing` is the
// direction the door points. `halfW`/`halfD` are the SOLID footprint used
// for collision, which is deliberately a little smaller than the visual
// roof overhang so eaves never feel like walls.
export const BUILDINGS = Object.freeze([
  {
    id: "commons-park-lobby", asset: null, entranceOnly: true, districtId: "mall",
    shopId: null, label: "The Grove Mall", npcId: null, npcLabel: null,
    sub: "The park entrance to all three levels.", accent: 0x759d79,
    center: { x: -14.1, z: 34.8 }, halfW: 2.7, halfD: 2.0, facing: Math.PI,
    entryTriggerDepth: 0.7,
    entryRadius: 0.5,
    returnPoint: { x: -14.1, z: 31.0, heading: 0 },
    interior: "grove-mall",
  },
  {
    id: "commons-pantry", asset: "shop_grocer", districtId: "mall",
    shopId: "grocery", label: "Pell's Pantry", npcId: "pell", npcLabel: "Pell",
    sub: "Everything small and edible.", accent: 0xb9a64a,
    center: { x: -12, z: 40 }, halfW: 4.0, halfD: 3.0, facing: Math.PI,
    interior: "grocery",
  },
  {
    id: "commons-homeworks", asset: "shop_furnish", districtId: "mall",
    shopId: "furniture", label: "Tansy's Homeworks", npcId: "tansy", npcLabel: "Tansy",
    sub: "Furniture for rooms that aren't finished yet.", accent: 0xc4744a,
    center: { x: 0, z: 43.5 }, halfW: 4.3, halfD: 3.2, facing: Math.PI,
    interior: "furniture",
  },
  {
    id: "commons-threadbare", asset: "shop_boutique", districtId: "mall",
    shopId: "boutique", label: "Juniper's Threadbare", npcId: "juniper", npcLabel: "Juniper",
    sub: "Clothes as sentences, not status.", accent: 0xa98bd1,
    center: { x: 12, z: 40 }, halfW: 3.5, halfD: 2.8, facing: Math.PI,
    interior: "boutique",
  },
  {
    id: "hearthlight", asset: "cafe_pavilion", districtId: "cafe",
    shopId: "eatery", label: "Hearthlight Cafe", npcId: "wren", npcLabel: "Wren",
    sub: "Whatever's in the pot.", accent: 0x5b9b8a,
    center: { x: 39.5, z: 8 }, halfW: 4.2, halfD: 3.5, facing: -HALF_PI,
    interior: "cafe", openSided: true,
  },
  {
    id: "makery", asset: "workshop_barn", districtId: "workshop",
    shopId: "workshop", label: "The Makery", npcId: "tansy", npcLabel: "Tansy",
    sub: "Sawdust, glue, second attempts.", accent: 0xa8663f,
    center: { x: -25, z: -31 }, halfW: 4.5, halfD: 3.5, facing: 0,
    interior: "makery",
  },
  {
    id: "home-cottage", asset: "home_cottage", districtId: "home",
    shopId: null, label: "Your Cottage", npcId: null, npcLabel: null,
    sub: "Yours. No optimal layout exists.", accent: 0xd9a94f,
    // Door faces +Z, back toward the bridge: you always arrive at the
    // FRONT of your own house, never at the back of it.
    center: { x: 0, z: -84 }, halfW: 3.7, halfD: 3.1, facing: 0,
    interior: "home",
  },
]);

// Landmarks with no interior: pure silhouette anchors.
export const SCENERY_LANDMARKS = Object.freeze([
  { asset: "kindred_tree", x: 0, z: 1.5, rotY: 0.4, scale: 0.93, district: "hub" },
  { asset: "glasshouse", x: -39.5, z: 8.5, rotY: HALF_PI, scale: 1.0, district: "garden" },
  { asset: "stage_bandstand", x: 25, z: -30, rotY: 0.25, scale: 1.0, district: "stage" },
  { asset: "dock_jetty", x: 11, z: -51.5, rotY: 0, scale: 1.0, district: "landing" },
]);

// ── Social geography ───────────────────────────────────────────────────
// Where two people can plausibly end up next to each other on purpose.
// `kind` drives what GroveScene builds there and what the InteractionSystem
// registers:
//   seat     - a bench/stool: sit, and anyone else may sit too
//   table    - a shared surface with seats all round
//   circle   - a ring gathering spot (breathing round, performance, fire)
//   vista    - a quiet corner facing OUT, deliberately away from the crowd
//   npcspot  - where a district's resident NPC stands
// `capacity` is only ever used to size the marker and to let the presence
// layer spread remote players out; it is never shown to a player, and
// nothing is ever "full".
export const SOCIAL_SPOTS = Object.freeze([
  // Hub: a ring of benches facing the tree, plus two facing outward for
  // anyone who wants to be present without being looked at.
  ...ringSpots("hub-bench", "seat", 0, 0, 9.2, 6, { facingIn: true, capacity: 2 }),
  { id: "hub-vista-w", kind: "vista", districtId: "hub", x: -11.5, z: -7.5, rotY: -2.3, capacity: 1,
    label: "A bench facing away from the plaza" },
  { id: "hub-vista-e", kind: "vista", districtId: "hub", x: 11.5, z: -7.5, rotY: 2.3, capacity: 1,
    label: "A bench facing away from the plaza" },

  // Commons courtyard: parasol tables, the natural "meet me there" spot.
  { id: "mall-table-a", kind: "table", districtId: "mall", x: -7, z: 29, rotY: 0.3, capacity: 4 },
  { id: "mall-table-b", kind: "table", districtId: "mall", x: 7, z: 29, rotY: -0.3, capacity: 4 },
  { id: "mall-table-c", kind: "table", districtId: "mall", x: 0, z: 33.5, rotY: 0, capacity: 4 },
  { id: "mall-bench-w", kind: "seat", districtId: "mall", x: -15, z: 34, rotY: HALF_PI, capacity: 2 },
  { id: "mall-bench-e", kind: "seat", districtId: "mall", x: 15, z: 34, rotY: -HALF_PI, capacity: 2 },
  { id: "mall-circle", kind: "circle", districtId: "mall", x: 0, z: 24.5, rotY: 0, capacity: 8,
    label: "The courtyard brazier" },
  { id: "mall-bench-sw", kind: "seat", districtId: "mall", x: -7.5, z: 21, rotY: 0.55, capacity: 2 },
  { id: "mall-bench-se", kind: "seat", districtId: "mall", x: 7.5, z: 21, rotY: -0.55, capacity: 2 },
  { id: "park-loop-seat", kind: "seat", districtId: "mall", x: -24.2, z: 28.8, rotY: HALF_PI, capacity: 2,
    label: "Sit beside the Canopy Park loop" },
  { id: "park-quiet-seat", kind: "vista", districtId: "mall", x: -17.2, z: 20.9, rotY: Math.PI, capacity: 1,
    label: "Sit beneath the blossom canopy" },

  // Cafe: tables under the pavilion eaves plus a fire bowl to stand round.
  { id: "cafe-table-a", kind: "table", districtId: "cafe", x: 31, z: 11.5, rotY: 0.4, capacity: 4 },
  { id: "cafe-table-b", kind: "table", districtId: "cafe", x: 30.5, z: 2.5, rotY: -0.5, capacity: 4 },
  { id: "cafe-circle", kind: "circle", districtId: "cafe", x: 35, z: 1, rotY: 0, capacity: 6,
    label: "The fire bowl" },
  { id: "cafe-vista", kind: "vista", districtId: "cafe", x: 40, z: 1.5, rotY: 1.1, capacity: 1,
    label: "A chair facing the water" },

  // Garden: a breathing circle, and two nooks with no sightline to it.
  { id: "garden-circle", kind: "circle", districtId: "garden", x: -32, z: 3, rotY: 0, capacity: 6,
    label: "The Quiet Round" },
  { id: "garden-nook-n", kind: "vista", districtId: "garden", x: -30, z: 13, rotY: 0.2, capacity: 1,
    label: "A bench behind the beds" },
  { id: "garden-nook-s", kind: "vista", districtId: "garden", x: -37, z: -1, rotY: 2.9, capacity: 1,
    label: "A bench by the pond" },

  // The Round: an arc of benches facing the bandstand.
  ...arcSpots("stage-seat", "seat", 22, -26, 8.4, 5, 2.3, 1.4, { capacity: 2 }),
  { id: "stage-circle", kind: "circle", districtId: "stage", x: 25, z: -30, rotY: 0, capacity: 8,
    label: "The bandstand floor" },

  // Makery: a shared workbench and an easel corner.
  { id: "workshop-bench", kind: "table", districtId: "workshop", x: -19, z: -22, rotY: 0.6, capacity: 4 },
  { id: "workshop-easel", kind: "vista", districtId: "workshop", x: -28, z: -20, rotY: -0.9, capacity: 1,
    label: "An easel nobody is using" },

  // Landing: a bench at the jetty head for people who just arrived.
  { id: "landing-bench", kind: "seat", districtId: "landing", x: -4, z: -46, rotY: 0.4, capacity: 2 },
  { id: "landing-vista", kind: "vista", districtId: "landing", x: 11, z: -55.5, rotY: Math.PI, capacity: 1,
    label: "The end of the jetty" },

  // Home isle: your own seat, and a second one, which is the point.
  { id: "home-porch", kind: "seat", districtId: "home", x: -4.5, z: -79, rotY: 0.5, capacity: 2 },
  { id: "home-fire", kind: "circle", districtId: "home", x: 0, z: -74, rotY: 0, capacity: 4,
    label: "Your fire bowl" },
]);

function ringSpots(prefix, kind, cx, cz, radius, count, opts = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.5;
    const x = cx + Math.sin(a) * radius;
    const z = cz + Math.cos(a) * radius;
    out.push({
      id: `${prefix}-${i}`, kind, districtId: "hub", x, z,
      rotY: opts.facingIn ? a + Math.PI : a,
      capacity: opts.capacity ?? 2,
    });
  }
  return out;
}

function arcSpots(prefix, kind, cx, cz, radius, count, centreAngle, spread, opts = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    const a = centreAngle + t * spread;
    out.push({
      id: `${prefix}-${i}`, kind, districtId: prefix.split("-")[0],
      x: cx + Math.sin(a) * radius, z: cz + Math.cos(a) * radius,
      rotY: a + Math.PI, capacity: opts.capacity ?? 2,
    });
  }
  return out;
}

/** Anchors a remote/NPC character can stand on so peers never pile up in
 * one spot. Derived from SOCIAL_SPOTS so adding a bench adds a place to
 * be, automatically. */
export function presenceAnchors(districtId) {
  return SOCIAL_SPOTS.filter((s) => s.districtId === districtId)
    .map((s) => ({ id: s.id, x: s.x, z: s.z, rotY: s.rotY }));
}

// ── Colliders ──────────────────────────────────────────────────────────
// Three kinds, all consumed by PlayerController._collides:
//   (default)  axis-aligned box  {minX,maxX,minZ,maxZ}
//   circle     keep-out disc     {kind:"circle", cx, cz, r}
//   walkable   keep-IN union     {kind:"walkable", regions:[...]}
export function buildColliders() {
  const colliders = [];

  // You cannot walk off the island, or off the bridge into the water.
  colliders.push({
    kind: "walkable",
    label: "shoreline",
    regions: [
      { kind: "circle", cx: ISLAND.center.x, cz: ISLAND.center.z, r: ISLAND.radius - 1.2 },
      { kind: "circle", cx: HOME_ISLE.center.x, cz: HOME_ISLE.center.z, r: HOME_ISLE.radius - 1.2 },
      { kind: "rect", minX: BRIDGE.minX, maxX: BRIDGE.maxX, minZ: BRIDGE.minZ, maxZ: BRIDGE.maxZ },
      // the jetty deck runs out past the shoreline, well clear of the
      // bridge corridor so arriving and leaving are two distinct walks
      { kind: "rect", minX: 9.4, maxX: 12.6, minZ: -57.5, maxZ: -44 },
    ],
  });

  // The Kindred Tree's basin: a solid disc you walk around, never through.
  colliders.push({ kind: "circle", cx: 0, cz: 1.5, r: 4.4, label: "landmark" });
  colliders.push({ kind: "circle", cx: MALL_PARK.hero.x, cz: MALL_PARK.hero.z, r: MALL_PARK.hero.radius, label: "landmark" });
  for (const post of MALL_PARK.portal.posts) {
    colliders.push({ kind: "circle", cx: post.x, cz: post.z, r: MALL_PARK.portal.postRadius, label: "park-portal-post" });
  }
  colliders.push({
    minX: MALL_EXTERIOR.center.x - MALL_EXTERIOR.width / 2,
    maxX: MALL_EXTERIOR.center.x + MALL_EXTERIOR.width / 2,
    minZ: MALL_EXTERIOR.center.z - MALL_EXTERIOR.depth / 2,
    maxZ: MALL_EXTERIOR.center.z + MALL_EXTERIOR.depth / 2,
    label: "building-wall",
  });

  for (const b of BUILDINGS) {
    colliders.push(...buildingColliders(b));
  }
  for (const l of SCENERY_LANDMARKS) {
    if (l.asset === "glasshouse") colliders.push({ kind: "circle", cx: l.x, cz: l.z, r: 3.5, label: "building-wall" });
    if (l.asset === "stage_bandstand") colliders.push({ kind: "circle", cx: l.x, cz: l.z, r: 4.4, label: "landmark" });
  }
  return colliders;
}

/** Wall colliders for one building: a box per side, with the door side
 * split into two stubs either side of a 2.4-unit opening. Facings are on
 * the cardinals so every box stays axis-aligned. */
export function buildingColliders(b) {
  const { x: cx, z: cz } = b.center;
  const { halfW: hw, halfD: hd } = b;
  const t = 0.45;
  const gap = 1.35; // half the doorway width
  const out = [];
  const push = (minX, maxX, minZ, maxZ) => out.push({ minX, maxX, minZ, maxZ, label: "building-wall" });
  // Door direction: 0=+Z, PI=-Z, HALF_PI=+X, -HALF_PI=-X
  const f = normaliseFacing(b.facing);
  if (b.openSided) {
    // A pavilion: only the back third is solid, the rest is walk-through.
    if (f === "-X") push(cx + hw - t * 2, cx + hw + t, cz - hd, cz + hd);
    else if (f === "+X") push(cx - hw - t, cx - hw + t * 2, cz - hd, cz + hd);
    else if (f === "-Z") push(cx - hw, cx + hw, cz + hd - t * 2, cz + hd + t);
    else push(cx - hw, cx + hw, cz - hd - t, cz - hd + t * 2);
    return out;
  }
  const sides = {
    "+Z": () => { push(cx - hw, cx - gap, cz + hd - t, cz + hd + t); push(cx + gap, cx + hw, cz + hd - t, cz + hd + t); },
    "-Z": () => { push(cx - hw, cx - gap, cz - hd - t, cz - hd + t); push(cx + gap, cx + hw, cz - hd - t, cz - hd + t); },
    "+X": () => { push(cx + hw - t, cx + hw + t, cz - hd, cz - gap); push(cx + hw - t, cx + hw + t, cz + gap, cz + hd); },
    "-X": () => { push(cx - hw - t, cx - hw + t, cz - hd, cz - gap); push(cx - hw - t, cx - hw + t, cz + gap, cz + hd); },
  };
  const solid = {
    "+Z": () => push(cx - hw, cx + hw, cz + hd - t, cz + hd + t),
    "-Z": () => push(cx - hw, cx + hw, cz - hd - t, cz - hd + t),
    "+X": () => push(cx + hw - t, cx + hw + t, cz - hd, cz + hd),
    "-X": () => push(cx - hw - t, cx - hw + t, cz - hd, cz + hd),
  };
  for (const side of ["+Z", "-Z", "+X", "-X"]) {
    if (side === f) sides[side]();
    else solid[side]();
  }
  return out;
}

function normaliseFacing(facing) {
  const a = ((facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (a < Math.PI / 4 || a >= Math.PI * 7 / 4) return "+Z";
  if (a < Math.PI * 3 / 4) return "+X";
  if (a < Math.PI * 5 / 4) return "-Z";
  return "-X";
}

/** The point just outside a building's door where the enter-trigger sits,
 * and the door itself — derived from the placement so a building can be
 * moved by editing one pair of numbers. */
export function doorPoints(b) {
  const dx = Math.sin(b.facing), dz = Math.cos(b.facing);
  const reach = (Math.abs(dz) > 0.5 ? b.halfD : b.halfW);
  const approachReach = Number.isFinite(b.entryTriggerDepth)
    ? Math.max(0.1, reach - b.entryTriggerDepth)
    : reach + 1.7;
  return {
    doorPoint: { x: b.center.x + dx * reach, z: b.center.z + dz * reach },
    approachPoint: { x: b.center.x + dx * approachReach, z: b.center.z + dz * approachReach },
  };
}

/** Which district a world position is in. Falls back to the hub for the
 * open turf between districts, so the HUD always has something to say. */
export function districtAt(x, z) {
  if (Math.hypot(x - MALL_PARK.center.x, z - MALL_PARK.center.z) <= MALL_PARK.radius + 3.5) {
    return DISTRICTS.find((d) => d.id === "mall") ?? DISTRICTS[0];
  }
  let best = null;
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dist = Math.hypot(x - d.center.x, z - d.center.z);
    if (dist <= d.radius + 1.5 && dist < bestD) { bestD = dist; best = d; }
  }
  return best ?? DISTRICTS[0];
}

/** True when (x,z) lies in the opening sightline down the world's spine —
 * Landing, causeway, Tree, Commons. Nothing tall may be placed here. */
export function inSpineCorridor(x, z) {
  // Widened past the Landing so the follow camera, which rests ~12m
  // behind the player on this exact line, never has a lamp post or a
  // tree standing in the first few metres of the opening frame.
  return Math.abs(x) < 7.5 && z > -58 && z < 26;
}
