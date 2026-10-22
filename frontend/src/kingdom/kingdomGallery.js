// src/kingdom/kingdomGallery.js
//
// "All assets": every model made for the Kingdom, set out in rows on one
// big lawn with its name on the ground in front of it, to walk past and
// judge in the game's own light. Looking only; nothing here is a rule of
// the game. What it shows, nearest the start first:
//   plants (every growth stage), trees and wild growth, the camp, creatures,
//   the decor kit, every item the Grove sells (and the furniture), the five
//   example rooms furnished, the parts of the house kit, the example houses.
// Example houses and rooms are put together the way Blender puts them
// together (k16_house_kit.py, k18_room_kit.py, k19_room_furnish.py), from the
// facts their kit files hold: sockets, parts, finishes, colours, furniture.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CollisionGrid, WALK_BLOCKED, WALL } from "../grove/player/collisionGrid.js";
import { Creature } from "./creatures.js";
import { Prop, Flame, Smoke } from "./props.js";
import { addWater } from "./water.js";

const KINGDOM = "models/env/kingdom/";
const ITEMS = "models/items/";
const MAX_LINE = 118;          // metres of pieces in one line before it wraps
const GAP = 1.4;               // between two pieces
const LABEL_DEPTH = 1.2;       // the strip in front of a line where the name boards stand
const LINE_GAP = 1.8;          // between a line and the next line's name boards
const ROW_GAP = 3.0;           // between two rows (kinds of thing)
const Q = Math.PI / 2;

function url(path) {
  const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : "http://localhost/";
  return new URL(path, base).href;
}
const json = (path) => fetch(url(path)).then((r) => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); });

/** The lighter or darker step of a colour, as ktone.shade() makes it in Blender. */
export function shade(hex, kind) {
  const c = new THREE.Color(hex);
  const r = c.r, g = c.g, b = c.b;                    // linear, so turn back to the sRGB the Blender numbers are in
  const toS = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  const [R, G, B] = [toS(r), toS(g), toS(b)];
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d > 0) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h = ((h / 6) % 1 + 1) % 1;
  let s = max ? d / max : 0, v = max;
  const toward = (t, k) => { const dd = ((t - h + 0.5) % 1 + 1) % 1 - 0.5; return ((h + Math.max(-k, Math.min(k, dd))) % 1 + 1) % 1; };
  if (kind === "lt") { h = toward(50 / 360, 0.035); s *= 0.8; v = v + (1 - v) * 0.5; }
  else { h = toward(265 / 360, 0.02); s = Math.min(1, s * 1.06 + 0.02); v *= 0.8; }
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [x, y, z] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  const hx = (n) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, "0");
  return `#${hx(x)}${hx(y)}${hx(z)}`;
}

/** Loads what the gallery needs beyond the island's own kit. The decor,
 * house and life kits may already be in `kit` (the developed view loads them). */
export async function loadGallery(kit, prepare) {
  const loader = new GLTFLoader();
  const glb = (path) => loader.loadAsync(url(path));
  const need = [];
  if (!kit.has("KD_Path_Brick")) need.push("kingdom_decor_kit.glb");
  if (!kit.has("KH_Body_Manor")) need.push("kingdom_house_kit.glb");
  if (!kit.has("KL_Pony")) need.push("kingdom_life_kit.glb");
  const [houseKit, roomKit, decorKit, lifeKit, itemsInfo, layout] = await Promise.all([
    json(KINGDOM + "kingdom_house_kit.json"), json(KINGDOM + "kingdom_room_kit.json"), json(KINGDOM + "kingdom_decor_kit.json"),
    json(KINGDOM + "kingdom_life_kit.json"), json(ITEMS + "items.json"), json(KINGDOM + "kingdom_layout.json"),
  ]);
  const files = [...new Set(Object.values(itemsInfo.items).map((item) => item.file))];
  const [kits, room, itemFiles] = await Promise.all([
    Promise.all(need.map((file) => glb(KINGDOM + file))),
    glb(KINGDOM + "kingdom_room_kit.glb"),
    Promise.all(files.map((file) => glb(ITEMS + file))),
  ]);
  const add = (map, gltf) => { gltf.scene.updateMatrixWorld(true); prepare(gltf.scene); addWater(gltf.scene); for (const node of [...gltf.scene.children]) map.set(node.name, node); };   // addWater: its water keeps moving (water.js)
  for (const gltf of kits) add(kit, gltf);
  const roomParts = new Map(); add(roomParts, room);
  const items = new Map(); for (const gltf of itemFiles) add(items, gltf);
  const roomMaterials = new Map();
  room.scene.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) if (m?.name) roomMaterials.set(m.name, m); });
  return { kit, roomParts, roomMaterials, items, houseKit, roomKit, decorKit, lifeKit, itemsInfo, layout };
}

/** A copy of a model with some of its materials recoloured or swapped:
 * table = { material name: colour "#rrggbb" | material }. */
function dressed(template, table, made) {
  const object = template.clone(true);
  object.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const swap = table[o.material.name];
    if (!swap) return;
    const key = `${o.material.uuid}:${typeof swap === "string" ? swap : swap.uuid}:${swap.tint ?? ""}`;
    if (!made.has(key)) {
      let m;
      if (typeof swap === "string") { m = o.material.clone(); m.color.set(swap); }
      else { m = swap.material.clone(); if (swap.tint) m.color.set(swap.tint); }
      made.set(key, m);
    }
    o.material = made.get(key);
  });
  return object;
}

/** Blender's local axes (Z up, front to -Y) to the game's (Y up, front to +Z). */
function at(object, x, y, z, rot = 0) {
  object.position.set(x, z, -y);
  object.rotation.set(0, rot, 0);
  return object;
}

function houseOf(a, example) {
  const size = a.houseKit.sizes[example.size], sk = size.sockets, col = example.col ?? {};
  const C = a.houseKit.colours, choose = { roof: col.roof ?? "red", wall: col.wall ?? "cream", trim: col.trim ?? "wood", door: col.door ?? "blue" };
  const table = {};
  C.roof[choose.roof].forEach((hex, i) => { table[["KI_roofA", "KI_roofB", "KI_roofC"][i]] = hex; });
  for (const [base, hex] of [["wallA", C.wall[choose.wall]], ["trimA", C.trim[choose.trim]], ["doorA", C.door[choose.door]]]) {
    table[`KI_${base}`] = hex; table[`KI_${base}_dk`] = shade(hex, "dk"); table[`KI_${base}_lt`] = shade(hex, "lt");
  }
  const group = new THREE.Group(), made = a.made;
  const add = (mesh, s) => { const t = a.kit.get(mesh); if (!t) return null; const o = at(dressed(t, table, made), s[0], s[1], s[2], s[3] ?? 0); group.add(o); return o; };
  add(size.meshes.body, [0, 0, 0, 0]);
  if (example.timber) add(size.meshes.timber, [0, 0, 0, 0]);
  const roof = size.roofs[example.roof];
  add(roof.mesh, sk.roof);
  add(`KH_Door_${example.door}`, sk.door);
  add(`KH_Porch_${example.porch}`, sk.porch);
  for (const w of sk.windows) add(`KH_Window_${example.window}`, w);
  if (example.chimney) {
    const chimney = add(`KH_Chimney_${example.chimney}`, [roof.chimney[0], roof.chimney[1], sk.roof[2] + roof.chimney[2], 0]);
    if (chimney) {                                                         // a home with a chimney has smoke rising from it
      chimney.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(chimney);
      group.add(new Smoke(new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2)).root);
    }
  }
  // the body only stops a walker: [x0, z0, x1, z1] in the house's own frame
  const [w, d] = size.body, back = size.back ?? 0;
  group.userData.body = [-w / 2, back - d / 2, w / 2, back + d / 2];
  return group;
}

function roomOf(a, example) {
  const kit = a.roomKit, room = kit.rooms[example.room], [W, D] = room.inside, T = kit.wall, f = example.finish;
  const floor = kit.finishes.floor[f.floor], wall = f.wall ? kit.finishes.wall[f.wall] : null;
  const table = {};
  if (floor && a.roomMaterials.get(floor.material)) table[kit.recolour.floor] = { material: a.roomMaterials.get(floor.material), tint: floor.tint ? (f.floor_tint ?? floor.tint) : null };
  if (wall && a.roomMaterials.get(wall.material)) table[kit.recolour.wall] = { material: a.roomMaterials.get(wall.material), tint: wall.tint ? (f.wall_tint ?? wall.tint) : null };
  else if (f.wall_tint) table[kit.recolour.wall] = f.wall_tint;
  if (f.trim) { table.KI_roomTrim = f.trim; table.KI_roomTrim_dk = shade(f.trim, "dk"); table.KI_roomTrim_lt = shade(f.trim, "lt"); }
  const group = new THREE.Group(), made = a.made;
  const part = (name) => a.roomParts.get(name);
  const wallPlace = (side, u, z) => (side === "back" ? [u, D / 2, z, 0] : side === "left" ? [-W / 2, u, z, Q] : side === "right" ? [W / 2, u, z, -Q] : [u, z, 0, 0]);
  const shell = part(room.mesh);
  if (shell) group.add(dressed(shell, table, made));
  for (const [name, side, u, z] of example.parts) {
    const t = part(`KR_${name}`); if (!t) continue;
    const [x, y, h, r] = wallPlace(side, u, z);
    const placed = at(dressed(t, table, made), x, y, h, r);
    if (name === "Fireplace" && a.props?.models.has("Flame")) {             // the fire in the hearth is the rigged flame too
      placed.traverse((o) => { if (o.isMesh && /^KI_flame/.test(o.material?.name ?? "")) o.visible = false; });
      const flame = new Flame(a.props, "Flame", { glowing: a.glowing, scale: 0.46 });
      flame.root.position.set(0, 0.16, 0.6); placed.add(flame.root);
    }
    group.add(placed);
  }
  const furniture = kit.furniture?.[example.room] ?? {};
  const item = (id) => a.items.get(id);
  for (const [id, x, y, q] of furniture.floor ?? []) { const t = item(id); if (t) group.add(at(t.clone(true), x, y, 0, q * Q)); }
  for (const [id, x, y, z] of furniture.on ?? []) { const t = item(id); if (t) group.add(at(t.clone(true), x, y, z, 0)); }
  for (const [id, side, u, z] of furniture.wall ?? []) { const t = item(id); if (!t) continue; const [x, y, h, r] = wallPlace(side, u, z); group.add(at(t.clone(true), x, y, h, r)); }
  // the three walls stop a walker; the open front and the floor do not
  group.userData.walls = [[-W / 2 - T, -D / 2 - T, -W / 2, D / 2 + T], [W / 2, -D / 2 - T, W / 2 + T, D / 2 + T], [-W / 2 - T, -D / 2 - T, W / 2 + T, -D / 2]];
  return group;
}

const words = (name) => name.replace(/^(KK|KD|KH|KL|KR)_/, "").replace(/_/g, " ");

/** The life kit's pieces. A creature that is rigged (creatures.js) is shown
 * once, alive, playing each of its clips in turn, in place of its stills. */
function lifePieces(a, piece) {
  const lib = a.creatures, shown = new Set(), out = [];
  for (const n of Object.values(a.lifeKit.groups).flat()) {
    const kind = lib?.standsFor.get(n);
    if (lib && (kind || /^KL_Butterfly_/.test(n) && lib.models.has("Butterfly"))) {
      const who = kind ?? "Butterfly";
      if (shown.has(who)) continue;
      shown.add(who);
      out.push({ label: `${who}: ${Object.keys(lib.doc.creatures[who].clips).join(", ").toLowerCase()}`, name: `creature-${who}`, make: () => new Creature(lib, who, { show: true }).root });
    } else out.push(piece(a.kit, n));
  }
  return out;
}

/** A camp piece; the rigged one (props.js) when there is one, playing its loop. */
function campPiece(a, piece, n) {
  if (n === "KK_Campfire_Flame" && a.props?.standsFor.has("KK_Campfire")) return null;       // the rigged campfire has its flames
  const rigged = a.props?.standsFor.get(n);
  if (!rigged) return piece(a.kit, n);
  return { label: `${words(n)} (moving)`, name: n, make: () => new Prop(a.props, rigged, { glowing: a.glowing }).root };
}

/** A decor piece that is rigged (the fountain's water, the swing, the reeds...): the moving one, playing its loop. */
function movingPiece(a, n) {
  const rigged = a.props?.standsFor.get(n);
  return rigged ? { label: `${words(n)} (moving)`, name: n, make: () => new Prop(a.props, rigged, { glowing: a.glowing }).root } : null;
}

/** The rows: [{ title, pieces: [{ label, make }] }]. */
function rowsOf(a) {
  const piece = (map, name, label = words(name)) => (map.has(name) ? { label, make: () => map.get(name).clone(true), name } : null);
  const kitNames = [...new Set([...(a.layout.kit ?? []), ...[...a.kit.keys()].filter((n) => n.startsWith("KK_"))])];
  const plants = kitNames.filter((n) => /^KK_(Seedling|Crop_|Daisy|Tulip|Sunflower|Rose|Lavender|Flower_|Wet_Patch)/.test(n));
  const wild = kitNames.filter((n) => /^KK_(Tree_|Thicket|Bush|Fern|Mushrooms|Log$|Stump|Rock|Grass|Land_Sign)/.test(n));
  const camp = kitNames.filter((n) => !plants.includes(n) && !wild.includes(n) && n !== "KK_Cloud");
  const items = Object.entries(a.itemsInfo.items).sort(([, x], [, y]) => x.shop.localeCompare(y.shop))
    .map(([id, item]) => ({ label: item.label, make: () => a.items.get(id)?.clone(true) ?? new THREE.Group(), name: id }));
  const rows = [
    { title: "Plants, every stage", pieces: plants.map((n) => piece(a.kit, n)) },
    { title: "Trees and wild growth", pieces: wild.map((n) => piece(a.kit, n)) },
    { title: "Camp, first build, creatures", pieces: [...camp.map((n) => campPiece(a, piece, n)).filter(Boolean), ...lifePieces(a, piece)] },
    { title: "Decor kit", pieces: Object.values(a.decorKit.groups).flat().map((n) => movingPiece(a, n) ?? piece(a.kit, n)) },
    { title: "Grove items, shop by shop", pieces: items },
    { title: "Rooms, furnished", pieces: a.roomKit.examples.map((e) => ({ label: `${e.room} room, ${a.roomKit.rooms[e.room].inside.join(" x ")} m`, make: () => roomOf(a, e), name: `room-${e.room}` })) },
    { title: "Room parts and finishes", pieces: [...a.roomParts.keys()].filter((n) => !n.startsWith("KR_Room_") && n !== "KR_Display").map((n) => piece(a.roomParts, n)) },
    { title: "House kit parts", pieces: [...a.kit.keys()].filter((n) => n.startsWith("KH_")).sort().map((n) => piece(a.kit, n)) },
    { title: "Example houses", pieces: a.houseKit.examples.map((e) => ({ label: `${e.size}: ${e.roof} roof, ${e.door} door`, make: () => houseOf(a, e), name: `house-${e.size}` })) },
  ];
  for (const row of rows) row.pieces = row.pieces.filter(Boolean);
  return rows.filter((row) => row.pieces.length);
}

/** One mesh of name boards for the whole gallery: every label drawn into one
 * picture, so all the names cost a single draw call. A board stands upright
 * in front of its piece, facing the way a visitor walks in from (+z). */
function labelMesh(labels) {
  const SLOT_W = 512, SLOT_H = 64, COLS = 4;
  const rows = Math.ceil(labels.length / COLS);
  const canvas = document.createElement("canvas");
  canvas.width = SLOT_W * COLS; canvas.height = Math.max(SLOT_H, THREE.MathUtils.ceilPowerOfTwo(rows * SLOT_H));
  const g = canvas.getContext("2d");
  g.textAlign = "center"; g.textBaseline = "middle";
  const positions = [], uvs = [], index = [];
  labels.forEach((label, i) => {
    const col = i % COLS, row = Math.floor(i / COLS), px = col * SLOT_W, py = row * SLOT_H;
    g.fillStyle = label.heading ? "rgba(255,247,223,0.96)" : "rgba(30,20,12,0.78)";
    g.beginPath(); g.roundRect(px + 4, py + 6, SLOT_W - 8, SLOT_H - 12, 26); g.fill();
    g.fillStyle = label.heading ? "#3d2010" : "#ffffff";
    let size = label.heading ? 34 : 30;
    g.font = `800 ${size}px system-ui, sans-serif`;
    while (g.measureText(label.text).width > SLOT_W - 40 && size > 14) { size -= 2; g.font = `800 ${size}px system-ui, sans-serif`; }
    g.fillText(label.text, px + SLOT_W / 2, py + SLOT_H / 2 + 1);
    const w = label.width, h = w * (SLOT_H / SLOT_W), x0 = label.x - w / 2, y0 = label.heading ? 0.9 : 0.12, z = label.z, k = positions.length / 3;
    positions.push(x0, y0, z, x0 + w, y0, z, x0 + w, y0 + h, z, x0, y0 + h, z);
    const u0 = px / canvas.width, u1 = (px + SLOT_W) / canvas.width, v1 = 1 - py / canvas.height, v0 = 1 - (py + SLOT_H) / canvas.height;
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    index.push(k, k + 1, k + 2, k, k + 2, k + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.name = "gallery-names"; mesh.renderOrder = 3;
  return mesh;
}

/** Puts the gallery together: { group, grid, base, spawn, count }. */
export function buildGallery(a) {
  a.made = new Map();
  const group = new THREE.Group(); group.name = "kingdom-gallery";
  const labels = [], blocks = [];
  const box = new THREE.Box3();
  let z = 0, count = 0;                                   // rows go north (towards -z) from the start
  for (const row of rowsOf(a)) {
    const made = row.pieces.map((p) => {
      const object = p.make();
      box.setFromObject(object);
      if (box.isEmpty()) box.set(new THREE.Vector3(-0.3, 0, -0.3), new THREE.Vector3(0.3, 0.3, 0.3));
      return { ...p, object, min: box.min.clone(), max: box.max.clone() };
    });
    const lines = [[]]; let width = 0;
    for (const m of made) {
      const w = Math.max(0.6, m.max.x - m.min.x);
      if (width + w > MAX_LINE && lines.at(-1).length) { lines.push([]); width = 0; }
      lines.at(-1).push(m); width += w + GAP;
    }
    labels.push({ text: row.title, x: 0, z: z - 0.4, width: 9, heading: true });
    z -= 1.6;
    for (const line of lines) {
      const depth = Math.max(...line.map((m) => m.max.z - m.min.z), 1);
      const total = line.reduce((s, m) => s + Math.max(0.6, m.max.x - m.min.x), 0) + GAP * (line.length - 1);
      let x = -total / 2;
      const front = z;                                     // the line's front edge; pieces stand behind it
      for (const m of line) {
        const w = Math.max(0.6, m.max.x - m.min.x), cx = x + w / 2;
        const ox = cx - (m.min.x + m.max.x) / 2, oz = front - LABEL_DEPTH - m.max.z;
        const lift = m.name === "KK_Cloud" ? 2.2 - m.min.y : /^(KH_Lantern|KH_Sign|KR_Sconce)$/.test(m.name) || (/^[a-z]{3}-/.test(m.name) && m.min.y < -0.01) ? 0.05 - m.min.y : 0;   // wall and hanging things hang below their origin   // a wall lamp hangs below its socket   // a kit piece stands on its own origin: a root below it goes into the ground, as on the island
        m.object.position.x += ox; m.object.position.z += oz; m.object.position.y += lift;
        group.add(m.object); count++;
        labels.push({ text: m.label, x: cx, z: front - 0.5, width: Math.min(Math.max(w, 1.6), 3.2) });
        // what stops a walker
        const tall = m.max.y - m.min.y > 0.32 && m.name !== "KK_Cloud";
        const toWorld = (r) => [r[0] + m.object.position.x, r[1] + m.object.position.z, r[2] + m.object.position.x, r[3] + m.object.position.z];
        if (m.object.userData.body) blocks.push({ rect: toWorld(m.object.userData.body), wall: true });
        else if (m.object.userData.walls) {
          for (const r of m.object.userData.walls) blocks.push({ rect: toWorld(r), wall: true });
          m.object.updateMatrixWorld(true);
          for (const child of m.object.children.slice(1)) {          // furniture and parts, by their own size
            box.setFromObject(child);
            if (!box.isEmpty() && box.max.y - box.min.y > 0.32 && box.min.y < 1.2) blocks.push({ rect: [box.min.x + 0.05, box.min.z + 0.05, box.max.x - 0.05, box.max.z - 0.05], wall: false });
          }
        } else if (tall) blocks.push({ rect: [m.min.x + ox + 0.08, m.min.z + oz + 0.08, m.max.x + ox - 0.08, m.max.z + oz - 0.08], wall: false });
        x += w + GAP;
      }
      z = front - LABEL_DEPTH - depth - LINE_GAP;
    }
    z -= ROW_GAP;
  }
  // the lawn under it all, with a margin
  const minZ = Math.floor(z - 6), maxZ = 14, minX = -MAX_LINE / 2 - 10, maxX = MAX_LINE / 2 + 10;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d");
  g.fillStyle = "#5CC83C"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#4CBA36"; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter; texture.repeat.set((maxX - minX) / 2, (maxZ - minZ) / 2); texture.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
  ground.position.set((minX + maxX) / 2, -0.012, (minZ + maxZ) / 2); ground.receiveShadow = true; ground.name = "gallery-lawn";   // a hair below the pieces, so nothing that stands on it fights it
  group.add(ground, labelMesh(labels));
  // the walk grid: open lawn, blocked where a piece stands; the edge of the lawn is the edge of the grid
  const cell = 0.25, nx = Math.ceil((maxX - minX) / cell), nz = Math.ceil((maxZ - minZ) / cell);
  const cells = new Uint8Array(nx * nz);
  for (const { rect: [x0, z0, x1, z1], wall } of blocks) {
    const ix0 = Math.max(0, Math.floor((Math.min(x0, x1) - minX) / cell)), ix1 = Math.min(nx - 1, Math.floor((Math.max(x0, x1) - minX) / cell));
    const iz0 = Math.max(0, Math.floor((Math.min(z0, z1) - minZ) / cell)), iz1 = Math.min(nz - 1, Math.floor((Math.max(z0, z1) - minZ) / cell));
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) cells[iz * nx + ix] |= WALK_BLOCKED | (wall ? WALL : 0);
  }
  const grid = new CollisionGrid({ cell, minX, minZ, nx, nz, cells });
  group.traverse((o) => { if (o.isMesh && o.name !== "gallery-lawn" && o.name !== "gallery-names" && !/^WATER_/.test(o.name)) { o.castShadow = true; } });
  const creatures = [];
  const props = [];
  group.traverse((o) => { if (o.userData.creature) creatures.push(o.userData.creature); if (o.userData.prop) props.push(o.userData.prop); });
  return { group, grid, base: cells.slice(), spawn: { x: 0, z: 8, heading: Math.PI }, count, rows: rowsOf(a).length, creatures, props };
}
