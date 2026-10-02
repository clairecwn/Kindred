// src/grove/interiors/interiors.js
//
// The "dollhouse" interiors: the browsable rooms behind every door in the
// Commons, plus the player's own cottage. Exteriors are Blender-authored
// meshes placed by scene/worldBuilder.js; this module owns only what is
// INSIDE, and the door metadata that joins the two.
//
// Design (Design Bible s4, s7): a staged, over-lit-in-the-corners little
// room you look down into, not a corridor. Every room shares one shell
// recipe so "I am indoors now" always reads the same way, and then each
// THEME repaints it and re-furnishes it completely — a supermarket reads
// as aisles and crates, a furniture showroom as rugs and lamp pools, a
// boutique as rails and a mirror, the cottage as a place somebody sleeps.
//
// Everything reads economy/worldState.js as data and never owns it: a
// shelf displays what the catalog says is for sale, a purchase mutates
// worldState, the mesh only ever reflects the result.

import * as THREE from "three";
import { CATALOG, todaysPicks } from "../economy/catalog.js";
import { canAfford, purchaseItem, getPlacedObjects, removePlacedObject } from "../economy/worldState.js";
import { buildDisplayMesh } from "./props.js";
import { createInteractionRing } from "../interaction/InteractionSystem.js";
import { BUILDINGS as LAYOUT_BUILDINGS, doorPoints } from "../scene/worldLayout.js";
import { NPC_BY_ID } from "../story/cast.js";

// ── Door metadata ──────────────────────────────────────────────────────
// Derived from the placement data rather than hand-written, so moving a
// building in worldLayout.js moves its door and its trigger with it.
export const BUILDINGS = Object.freeze(LAYOUT_BUILDINGS.map((b) => ({
  ...b,
  ...doorPoints(b),
})));

const DOOR_GAP = 2.4;
const WALL_HEIGHT = 3.4;
const WALL_T = 0.4;

const ROOM_HALF_W = 7.0;
const ROOM_HALF_D = 7.0;
export const ROOM_SPAWN = { x: 0, z: -ROOM_HALF_D + 2.4 };
export const ROOM_EXIT_TRIGGER = { x: 0, z: -ROOM_HALF_D + 1.0, radius: 1.2 };

// ── Themes ─────────────────────────────────────────────────────────────
// One entry per `interior` id used in worldLayout.js BUILDINGS. Colours
// are warm and low-saturation throughout; there is no pure white and no
// pure black anywhere in this table (Design Bible s10).
const THEMES = {
  grocery: {
    floor: 0xcfb98c, wall: 0xe9dcc2, trim: 0x8a9a5e, accentLight: 0xffe9bd,
    fixtures: "aisles", rug: null,
    counterColor: 0xa8764a, name: "Pell's Pantry",
  },
  furniture: {
    floor: 0xbe9666, wall: 0xe7d8bf, trim: 0xc4744a, accentLight: 0xffdcae,
    fixtures: "showroom", rug: 0xb3644a,
    counterColor: 0x7a5233, name: "Tansy's Homeworks",
  },
  boutique: {
    floor: 0xd4c4b4, wall: 0xecdbe0, trim: 0xa98bd1, accentLight: 0xffe2ea,
    fixtures: "rails", rug: 0xc79ad1,
    counterColor: 0x8a6a9b, name: "Juniper's Threadbare",
  },
  cafe: {
    floor: 0xbe9c76, wall: 0xe9dcc4, trim: 0x5b9b8a, accentLight: 0xffd79a,
    fixtures: "tables", rug: 0x6faf9a,
    counterColor: 0x8a5a34, name: "Hearthlight",
  },
  makery: {
    floor: 0xb18e60, wall: 0xded2b6, trim: 0xa8663f, accentLight: 0xffd9a0,
    fixtures: "benches", rug: null,
    counterColor: 0x7a5233, name: "The Makery",
  },
  home: {
    floor: 0xb89668, wall: 0xeaddc3, trim: 0xd9a94f, accentLight: 0xffd9a0,
    fixtures: "living", rug: 0xc08a6a,
    counterColor: 0x9d7745, name: "Your Cottage",
  },
};

const matCache = new Map();
function mat(color, extra) {
  const key = `${color}:${JSON.stringify(extra ?? {})}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.02, ...extra });
  matCache.set(key, m);
  return m;
}

function wallSegments(halfW, halfD, doorSide, gap) {
  const t = WALL_T;
  const full = [
    { side: "north", minX: -halfW, maxX: halfW, minZ: halfD - t, maxZ: halfD + t },
    { side: "south", minX: -halfW, maxX: halfW, minZ: -halfD - t, maxZ: -halfD + t },
    { side: "east", minX: halfW - t, maxX: halfW + t, minZ: -halfD, maxZ: halfD },
    { side: "west", minX: -halfW - t, maxX: -halfW + t, minZ: -halfD, maxZ: halfD },
  ];
  const segs = [];
  for (const s of full) {
    if (s.side !== doorSide) { segs.push(s); continue; }
    if (s.side === "north" || s.side === "south") {
      segs.push({ minX: s.minX, maxX: -gap / 2, minZ: s.minZ, maxZ: s.maxZ });
      segs.push({ minX: gap / 2, maxX: s.maxX, minZ: s.minZ, maxZ: s.maxZ });
    } else {
      segs.push({ minX: s.minX, maxX: s.maxX, minZ: s.minZ, maxZ: -gap / 2 });
      segs.push({ minX: s.minX, maxX: s.maxX, minZ: gap / 2, maxZ: s.maxZ });
    }
  }
  return segs;
}

/**
 * Builds one interior. Returns { group, colliders, dispose, addPlacedProp }.
 * Registers every interactable (shelves, placed decor, the counter NPC)
 * on the given InteractionSystem; InteriorManager clears the whole system
 * on exit, and the returned disposers unregister individually as well.
 */
export function buildInterior(spec, { worldState, interactionSystem, carry, playSfx, onPurchaseFeedback, onTalk }) {
  const theme = THEMES[spec.interior] ?? THEMES.grocery;
  const group = new THREE.Group();
  group.name = `interior:${spec.id}`;
  const colliders = [];
  const disposers = [];

  // ── Shell: floor, skirting, walls with a door gap, dark ceiling ──────
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_HALF_W * 2, ROOM_HALF_D * 2), mat(theme.floor));
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // Floorboard / tile seams, so a 14m floor is never one flat wash.
  const seamMat = mat(theme.floor, { color: theme.floor });
  const seamGeo = new THREE.BoxGeometry(ROOM_HALF_W * 2, 0.02, 0.06);
  const seamDark = new THREE.MeshStandardMaterial({ color: 0x00000f, transparent: true, opacity: 0.10, roughness: 1 });
  void seamMat;
  for (let z = -ROOM_HALF_D + 1; z < ROOM_HALF_D; z += 1.4) {
    const seam = new THREE.Mesh(seamGeo, seamDark);
    seam.position.set(0, 0.012, z);
    group.add(seam);
  }

  const threshold = new THREE.Mesh(
    new THREE.PlaneGeometry(DOOR_GAP + 2.4, 3.2), mat(theme.counterColor),
  );
  threshold.rotation.x = -Math.PI / 2;
  threshold.position.set(0, -0.005, -ROOM_HALF_D - 1.5);
  group.add(threshold);

  if (theme.rug) {
    const rug = new THREE.Mesh(new THREE.CircleGeometry(3.0, 32), mat(theme.rug));
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.02;
    group.add(rug);
    const rugRing = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.0, 32), mat(0xf2e6cf));
    rugRing.rotation.x = -Math.PI / 2;
    rugRing.position.y = 0.025;
    group.add(rugRing);
  }

  // Walls. The door (south) wall is deliberately built waist-high: the
  // follow camera sits above and behind the player looking down into the
  // room, so a full-height front wall would be a slab across the frame.
  // This is the dollhouse cutaway every staged-interior game uses, and it
  // is the whole reason an interior reads as a room you are looking INTO
  // rather than a corridor you are stuck in.
  const segs = wallSegments(ROOM_HALF_W, ROOM_HALF_D, "south", DOOR_GAP);
  for (const seg of segs) {
    const w = seg.maxX - seg.minX;
    const d = seg.maxZ - seg.minZ;
    const isFront = (seg.minZ + seg.maxZ) / 2 < -ROOM_HALF_D + 0.5;
    const h = isFront ? 1.25 : WALL_HEIGHT;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(theme.wall));
    wall.position.set((seg.minX + seg.maxX) / 2, h / 2, (seg.minZ + seg.maxZ) / 2);
    group.add(wall);
    // A picture-rail band in the district trim colour: the single cheapest
    // way to make six rooms built from one shell feel like six rooms.
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.22, d + 0.04), mat(theme.trim));
    band.position.set((seg.minX + seg.maxX) / 2, h - 0.12, (seg.minZ + seg.maxZ) / 2);
    group.add(band);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.26, d + 0.06), mat(theme.counterColor));
    skirt.position.set((seg.minX + seg.maxX) / 2, 0.13, (seg.minZ + seg.maxZ) / 2);
    group.add(skirt);
    colliders.push({ ...seg, label: "interior-wall" });
  }

  // The diorama box: a big warm-dark enclosure so the space above the
  // walls is soft shadow rather than the empty clear colour. Never pure
  // black (Design Bible s10).
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(40, 22, 40),
    new THREE.MeshBasicMaterial({ color: 0x3b2e20, side: THREE.BackSide, fog: false }),
  );
  shell.position.y = 6;
  group.add(shell);

  // Two windows on the back wall throwing warm light pools on the floor —
  // "a cozy lamp in a home implies safety" (Design Bible s9).
  for (const wx of [-3.4, 3.4]) {
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.5, 0.2),
      new THREE.MeshBasicMaterial({ color: theme.accentLight }),
    );
    glass.position.set(wx, 2.0, ROOM_HALF_D - 0.35);
    group.add(glass);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.75, 0.14), mat(theme.counterColor));
    frame.position.set(wx, 2.0, ROOM_HALF_D - 0.45);
    group.add(frame);
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 3.2),
      new THREE.MeshBasicMaterial({ color: theme.accentLight, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(wx, 0.03, ROOM_HALF_D - 2.6);
    group.add(pool);
  }

  // ── Counter + resident ───────────────────────────────────────────────
  const counter = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.05, 1.0), mat(theme.counterColor));
  counter.position.set(0, 0.52, ROOM_HALF_D - 1.3);
  group.add(counter);
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(5.05, 0.12, 1.2), mat(theme.trim));
  counterTop.position.set(0, 1.09, ROOM_HALF_D - 1.3);
  group.add(counterTop);
  colliders.push({
    minX: -2.4, maxX: 2.4, minZ: ROOM_HALF_D - 1.85, maxZ: ROOM_HALF_D - 0.75,
    label: "interior-counter",
  });

  const npcPos = { x: 0, z: ROOM_HALF_D - 0.5 };
  if (spec.npcId) {
    const npc = buildResident(spec.npcId, spec.accent);
    npc.position.set(npcPos.x, 0, npcPos.z);
    npc.rotation.y = Math.PI;
    group.add(npc);
    const npcInteractId = `npc:${spec.id}`;
    interactionSystem.register(npcInteractId, {
      position: npcPos, radius: 2.2,
      prompt: `Talk to ${spec.npcLabel}`,
      onInteract: () => onTalk?.(spec.npcId, spec.npcLabel, "shop"),
    });
    disposers.push(() => interactionSystem.unregister(npcInteractId));
  }

  // ── Lighting: warm, soft, three sources max ──────────────────────────
  group.add(new THREE.AmbientLight(0xfff0dc, 0.72));
  group.add(new THREE.HemisphereLight(0xffe9c9, theme.floor, 0.30));
  for (const lx of [-3.0, 3.0]) {
    const lamp = new THREE.PointLight(theme.accentLight, 24, 16, 2);
    lamp.position.set(lx, 2.9, 0.6);
    group.add(lamp);
    // The lamp you can see, so the light in the room has a source.
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.4, 10), mat(theme.trim));
    shade.position.set(lx, 3.2, 0.6);
    group.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8),
      new THREE.MeshBasicMaterial({ color: theme.accentLight }));
    bulb.position.set(lx, 2.98, 0.6);
    group.add(bulb);
    const flex = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), mat(theme.counterColor));
    flex.position.set(lx, 3.45, 0.6);
    group.add(flex);
  }

  // ── Theme fixtures ───────────────────────────────────────────────────
  buildFixtures(group, theme, colliders);

  // ── Wares ────────────────────────────────────────────────────────────
  const items = spec.shopId ? (CATALOG[spec.shopId] ?? []) : [];
  const picks = spec.shopId ? todaysPicks(spec.shopId, 2) : new Set();
  const selection = { itemId: null };
  const perSide = Math.ceil(items.length / 2);
  items.forEach((item, i) => {
    const side = i < perSide ? -1 : 1;
    const slot = i < perSide ? i : i - perSide;
    const z = THREE.MathUtils.mapLinear(slot, 0, Math.max(1, perSide - 1), -2.9, 2.4);
    const x = side * (ROOM_HALF_W - 1.1);

    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.62, 0.8), mat(theme.counterColor));
    shelf.position.set(x, 0.31, z);
    group.add(shelf);
    const shelfTop = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.09, 0.95), mat(theme.counterColor));
    shelfTop.position.set(x, 0.66, z);
    group.add(shelfTop);

    const displayMesh = buildDisplayMesh(item.shape, 0.9);
    displayMesh.position.set(x, 0.70, z);
    group.add(displayMesh);
    disposers.push(() => disposeObject3D(displayMesh));

    const ring = createInteractionRing(spec.accent, 0.95);
    ring.position.set(x, 0.02, z);
    group.add(ring);

    const isNew = picks.has(item.id);
    const interactId = `shelf:${spec.id}:${item.id}`;
    interactionSystem.register(interactId, {
      position: { x, z }, radius: 2.2, bobMesh: displayMesh, ringMesh: ring,
      prompt: () => {
        if (carry.isCarrying) return null;
        const afford = canAfford(worldState, item.id);
        const tag = isNew ? " · New today" : "";
        if (selection.itemId === item.id) {
          return afford
            ? `Confirm — ${item.label}, ${item.price} coins`
            : `Need ${item.price - worldState.coins} more coins`;
        }
        return `${item.label} — ${item.price} coins${tag}`;
      },
      onInteract: () => {
        if (carry.isCarrying) return;
        if (selection.itemId !== item.id) {
          selection.itemId = item.id;
          playSfx("tap");
          return;
        }
        selection.itemId = null;
        const result = purchaseItem(worldState, item.id);
        if (!result.ok) {
          playSfx("error");
          onPurchaseFeedback?.(false, item);
          return;
        }
        playSfx("coin");
        setTimeout(() => playSfx("purchase"), 90);
        carry.pickUp({ itemId: item.id, label: item.label, shape: item.shape });
        onPurchaseFeedback?.(true, item);
      },
    });
    disposers.push(() => interactionSystem.unregister(interactId));
  });

  for (const placed of getPlacedObjects(worldState, spec.id)) addPlacedProp(placed);

  function addPlacedProp(placed) {
    const catalogItem = items.find((it) => it.id === placed.itemId) || flatFind(placed.itemId);
    if (!catalogItem) return;
    const mesh = buildDisplayMesh(catalogItem.shape, 0.75);
    mesh.position.set(placed.x, 0, placed.z);
    group.add(mesh);
    const ring = createInteractionRing(0xffe3a8, 0.65);
    ring.position.set(placed.x, 0.02, placed.z);
    group.add(ring);
    const interactId = `placed:${spec.id}:${placed.id}`;
    interactionSystem.register(interactId, {
      position: { x: placed.x, z: placed.z }, radius: 1.8, bobMesh: mesh, ringMesh: ring,
      prompt: () => (carry.isCarrying ? null : `Pick up — ${catalogItem.label}`),
      onInteract: () => {
        if (carry.isCarrying) return;
        removePlacedObject(worldState, spec.id, placed.id);
        interactionSystem.unregister(interactId);
        group.remove(mesh, ring);
        disposeObject3D(mesh);
        ring.geometry.dispose(); ring.material.dispose();
        carry.pickUp({ itemId: catalogItem.id, label: catalogItem.label, shape: catalogItem.shape });
      },
    });
    disposers.push(() => interactionSystem.unregister(interactId));
  }

  function dispose() {
    interactionSystem.clear();
    disposers.forEach((fn) => fn());
    group.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
  }

  return { group, colliders, dispose, addPlacedProp };
}

/** The furniture that makes a room a particular KIND of room. Adds solid
 * colliders for anything chest-height or taller so the player walks the
 * aisles rather than through them. */
function buildFixtures(group, theme, colliders) {
  const push = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ, label: "interior-fixture" });

  if (theme.fixtures === "aisles") {
    // Supermarket: two low island aisles stacked with crates of produce.
    for (const ax of [-2.3, 2.3]) {
      const aisle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 4.4), mat(theme.counterColor));
      aisle.position.set(ax, 0.48, -0.4);
      group.add(aisle);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 4.6), mat(0xc49a63));
      top.position.set(ax, 0.94, -0.4);
      group.add(top);
      push(ax - 0.7, ax + 0.7, -2.7, 1.9);
      const colors = [0xd06a5a, 0x8fbf63, 0xe8b45a, 0x9b72cf];
      for (let i = 0; i < 4; i++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.26, 0.8), mat(0xc49a63));
        crate.position.set(ax, 1.12, -2.1 + i * 1.1);
        group.add(crate);
        const pile = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(colors[i]));
        pile.position.set(ax, 1.3, -2.1 + i * 1.1);
        pile.scale.set(1.7, 0.7, 1.4);
        group.add(pile);
      }
    }
  } else if (theme.fixtures === "showroom") {
    // Furniture store: staged vignettes, deliberately a room-inside-a-room.
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.0), mat(0xc08a6a));
    sofa.position.set(0, 0.35, 0.4);
    group.add(sofa);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 0.3), mat(0xb3644a));
    back.position.set(0, 0.75, 0.95);
    group.add(back);
    push(-1.35, 1.35, -0.2, 1.15);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 14), mat(0x8a5f3c));
    table.position.set(0, 0.5, -1.4);
    group.add(table);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 8), mat(0x7a5233));
    leg.position.set(0, 0.25, -1.4);
    group.add(leg);
    const floorLamp = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 10), mat(theme.accentLight));
    floorLamp.position.set(2.0, 1.9, 1.5);
    group.add(floorLamp);
    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 6), mat(0x7a5233));
    lampPole.position.set(2.0, 0.85, 1.5);
    group.add(lampPole);
  } else if (theme.fixtures === "rails") {
    // Boutique: two clothing rails and a full-length mirror.
    for (const rx of [-2.6, 2.6]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.0, 8), mat(theme.trim));
      bar.rotation.x = Math.PI / 2;
      bar.position.set(rx, 1.6, -0.4);
      group.add(bar);
      for (const sy of [-1.9, 1.9]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.6, 8), mat(theme.trim));
        post.position.set(rx, 0.8, -0.4 + sy);
        group.add(post);
      }
      const garmentColors = [0xd98a9b, 0xa98bd1, 0xe8c87a, 0x8fb89a, 0xc4744a];
      for (let i = 0; i < 5; i++) {
        const g = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.0, 0.55), mat(garmentColors[i]));
        g.position.set(rx, 1.05, -2.0 + i * 0.8);
        group.add(g);
      }
      push(rx - 0.35, rx + 0.35, -2.4, 1.6);
    }
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xcfe0e4, roughness: 0.25, metalness: 0.3 }));
    mirror.position.set(0, 1.2, -1.2);
    group.add(mirror);
    const mFrame = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.45, 0.08), mat(theme.trim));
    mFrame.position.set(0, 1.2, -1.28);
    group.add(mFrame);
    push(-0.75, 0.75, -1.4, -1.0);
  } else if (theme.fixtures === "tables") {
    // Cafe: three small tables, each with two chairs — the smallest unit
    // of "somewhere two people could sit" there is.
    for (const [tx, tz] of [[-2.9, -1.4], [2.9, -1.4], [0, 1.6]]) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 14), mat(0xe8d8b6));
      top.position.set(tx, 0.74, tz);
      group.add(top);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.26, 0.7, 10), mat(theme.counterColor));
      stem.position.set(tx, 0.37, tz);
      group.add(stem);
      for (const sx of [-1.0, 1.0]) {
        const chair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), mat(theme.trim));
        chair.position.set(tx + sx, 0.46, tz);
        group.add(chair);
        const cback = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.5), mat(theme.trim));
        cback.position.set(tx + sx * 1.22, 0.74, tz);
        group.add(cback);
      }
    }
  } else if (theme.fixtures === "benches") {
    // Makery: a long workbench with tools and half-finished things.
    const bench = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.95, 1.2), mat(theme.counterColor));
    bench.position.set(0, 0.48, -0.6);
    group.add(bench);
    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.12, 1.4), mat(0xa8764a));
    benchTop.position.set(0, 1.0, -0.6);
    group.add(benchTop);
    push(-2.85, 2.85, -1.3, 0.1);
    const toolColors = [0x9aa3aa, 0xc4744a, 0x8fb89a, 0xd9a94f];
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), mat(toolColors[i % 4]));
      t.position.set(-2.2 + i * 0.9, 1.3, -1.0);
      group.add(t);
    }
    const sawdust = new THREE.Mesh(new THREE.CircleGeometry(1.5, 16),
      new THREE.MeshBasicMaterial({ color: 0xd9bb86, transparent: true, opacity: 0.35, depthWrite: false }));
    sawdust.rotation.x = -Math.PI / 2;
    sawdust.position.set(0.4, 0.03, 0.9);
    group.add(sawdust);
  } else if (theme.fixtures === "living") {
    // The cottage: a bed, a hearth, a desk. Minimalism is valid here —
    // the room is deliberately under-filled so the player's own placed
    // objects are what finishes it (Design Bible s4).
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 3.0), mat(0xb08a63));
    bed.position.set(-4.4, 0.25, 2.4);
    group.add(bed);
    const quilt = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.22, 2.2), mat(0xd98a9b));
    quilt.position.set(-4.4, 0.56, 2.0);
    group.add(quilt);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 0.6), mat(0xf2e8d2));
    pillow.position.set(-4.4, 0.58, 3.5);
    group.add(pillow);
    push(-5.5, -3.3, 0.8, 4.0);

    const hearth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.9), mat(0xa8977c));
    hearth.position.set(4.4, 0.75, 3.2);
    group.add(hearth);
    const fire = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffb964 }));
    fire.position.set(4.4, 0.55, 2.72);
    fire.scale.set(1.2, 0.8, 0.6);
    group.add(fire);
    const fireGlow = new THREE.PointLight(0xffb15a, 22, 12, 2);
    fireGlow.position.set(4.4, 1.0, 2.4);
    group.add(fireGlow);
    push(3.2, 5.6, 2.6, 3.8);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.9), mat(0x9d7745));
    desk.position.set(4.2, 0.4, -2.6);
    group.add(desk);
    const journal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.36), mat(0xc4744a));
    journal.position.set(4.2, 0.86, -2.6);
    group.add(journal);
    push(3.1, 5.3, -3.1, -2.1);
  }
}

function flatFind(itemId) {
  for (const list of Object.values(CATALOG)) {
    const f = list.find((i) => i.id === itemId);
    if (f) return f;
  }
  return null;
}

/** An indoor standing resident. Matches the outdoor figure GroveScene
 * builds (same species silhouette cues from story/cast.js) so walking in
 * on someone you met outside reads as the same person. */
function buildResident(npcId, accent) {
  const cast = NPC_BY_ID[npcId];
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.72, 4, 10), mat(cast?.color ?? accent));
  body.position.y = 0.78;
  g.add(body);
  const fur = cast?.fur ?? 0xe8c8a0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 10), mat(fur));
  head.position.y = 1.5;
  g.add(head);
  const ear = cast?.ear ?? "round";
  for (const side of [-1, 1]) {
    let m;
    if (ear === "long") m = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.4, 3, 6), mat(fur));
    else if (ear === "pointed") m = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 6), mat(fur));
    else if (ear === "crest") m = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 5), mat(fur));
    else m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(fur));
    m.position.set(side * (ear === "crest" ? 0.06 : 0.22), 1.73, ear === "crest" ? -0.08 : 0);
    if (ear === "crest") m.rotation.x = -0.5;
    g.add(m);
  }
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(fur));
  snout.position.set(0, 1.44, 0.25);
  snout.scale.set(0.9, 0.8, 1.3);
  g.add(snout);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.45, 14),
    new THREE.MeshBasicMaterial({ color: 0x3a2412, transparent: true, opacity: 0.22, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  g.add(blob);
  return g;
}

function disposeObject3D(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
  });
}
