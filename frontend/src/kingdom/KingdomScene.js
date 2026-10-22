// src/kingdom/KingdomScene.js
//
// The Kingdom island in three.js: the player's own island, where things
// bought in the Grove are put down, planted and built.
//
// This file is a VIEW. The island itself is the plain data in
// islandState.js; every change goes through its rules and is then drawn
// here. The world and the kit pieces come from Blender
// (assets/kingdom/blender/passes/k20_export.py); nothing is modelled in code.
//
// Movement, camera and keys are the Grove's own PlayerController, so the two
// worlds handle the same way: arrows walk as seen on screen, A and D turn
// the view, Space jumps, Shift sits, E acts, V is first person.
//
// Build mode (B) is added here:
//   point with the mouse, or walk and the cell in front of you is used
//   click or E    put the chosen thing down / pick up with the hand tool
//   R             turn it a quarter
//   C             next colour, for flowers
//   X             pick up what is under the pointer
//   B or Esc      leave build mode
//
// Two views (setView), for looking at the island before it is a game:
//   "day1"       the player's own island with every section of wild land wild
//   "developed"  the showcase island from Blender, to walk round; no building
//   "gallery"    every model made for the Kingdom in rows on one lawn, named (kingdomGallery.js)
// kingdomPreview.js lists what each view draws and blocks.

import * as THREE from "three";
import { PlayerController, MAX_SPEED } from "../grove/player/PlayerController.js";
import { WALK_BLOCKED, WALL } from "../grove/player/collisionGrid.js";
import { createAvatar } from "../avatar/index.js";
import { createPostFX } from "../grove/scene/postfx.js";
import { loadKingdom, loadDeveloped, prepare } from "./kingdomAssets.js";
import { loadGallery, buildGallery } from "./kingdomGallery.js";
import { loadCreatures, Creature } from "./creatures.js";
import { loadProps, Prop, Smoke } from "./props.js";
import { tickWater } from "./water.js";
// The sun's direction (towards it) and two directions across its view, for keeping the gallery's shadow on its texel grid.
const SUN_DIR = new THREE.Vector3(-30, 82, 48).normalize();
const SUN_ACROSS = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_DIR).normalize();
const SUN_UP = new THREE.Vector3().crossVectors(SUN_DIR, SUN_ACROSS).normalize();
import { wildList, blocksOf, layoutStamp, NO_SHADOW } from "./kingdomPreview.js";
import { ITEMS, WILD, HOUSE, ROOF_MATERIALS, PETAL_MATERIALS } from "./items.js";
import * as Island from "./islandState.js";
import { readGroveSnapshot } from "./ownership.js";

const FIXED_STEP = 1 / 60;
const MAX_ACCUMULATED = 0.1;
const MAX_RENDER_PIXELS = 4_100_000;
const SKY = { horizon: 0xd8f3ff, mid: 0x4fb4f0, top: 0x2e8fe6 };
export const KINGDOM_LIGHT = Object.freeze({ key: 1.9, fill: 1.75 });   // the Grove's values: a lit face shows its own colour
const SHADOWS = true;

const RUN_FROM = MAX_SPEED * 0.55;
const WALK_FROM = 0.25;
const JUMP_CLIP_TAKEOFF = 0.5;
const JUMP_CLIP_RATE = 1.6;
const SIT_CLIP_SEAT = 0.2;

const REACH = 1.9;            // how near a thing must be for E to act on it
const AHEAD = 1.6;            // keyboard building: the cell this far in front of the character
const POP_TIME = 0.38;

const GHOST_OK = new THREE.MeshBasicMaterial({ color: 0x6be07a, transparent: true, opacity: 0.6, depthWrite: false });
const GHOST_NO = new THREE.MeshBasicMaterial({ color: 0xf0564a, transparent: true, opacity: 0.6, depthWrite: false });
const TILE_OK = new THREE.MeshBasicMaterial({ color: 0x8cf09a, transparent: true, opacity: 0.55, depthWrite: false });
const TILE_NO = new THREE.MeshBasicMaterial({ color: 0xf0564a, transparent: true, opacity: 0.55, depthWrite: false });
const TILE_HAND = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.6, depthWrite: false });

const REASON = {
  "not-buildable": "That spot is not open lawn",
  occupied: "Something is already there",
  "none-owned": "You have none left in your bag",
  standing: "You are standing there",
};

export class KingdomScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts
   * @param {object} [opts.avatarDescriptor]
   * @param {Storage} [opts.storage]  where the island and the Grove's bag are saved
   * @param {boolean} [opts.dev]      allows skipping a day, to see growth without waiting
   * @param {(ui:object) => void} [opts.onChange]
   * @param {(prompt:{text:string,key:string|null}|null) => void} [opts.onPrompt]
   * @param {(text:string) => void} [opts.onToast]
   * @param {(ask:{have:number,need:number}) => void} [opts.onAskRoof]
   */
  constructor(canvas, { avatarDescriptor, storage, dev = false, onChange, onPrompt, onToast, onAskRoof } = {}) {
    this.canvas = canvas;
    this.storage = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
    this.dev = dev;
    this._onChange = onChange ?? (() => {});
    this._onPrompt = onPrompt ?? (() => {});
    this._onToast = onToast ?? (() => {});
    this._onAskRoof = onAskRoof ?? (() => {});
    this.clock = new THREE.Clock();
    this._accumulator = 0;
    this._disposed = false;
    this.ready = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setClearColor(SKY.horizon, 1);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = SHADOWS;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(SKY.horizon, 170, 430);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.2, 900);
    this._buildSky();
    this._buildLighting();

    this.worldGroup = new THREE.Group(); this.worldGroup.name = "kingdom";
    this.thingsGroup = new THREE.Group(); this.thingsGroup.name = "kingdom-things";
    this.wildGroup = new THREE.Group(); this.wildGroup.name = "kingdom-wild";             // the growth on closed sections
    this.showGroup = new THREE.Group(); this.showGroup.name = "kingdom-showcase";         // the developed island, when it is looked at
    this.showGroup.visible = false;
    this.scene.add(this.worldGroup, this.thingsGroup, this.wildGroup, this.showGroup);
    this.view = "day1";
    this._blocks = { discs: [], rects: [] };

    this.colliders = [];
    this.player = new PlayerController({ camera: this.camera, colliders: this.colliders, startPosition: { x: 0, z: 21.4 } });
    this.player.moveTo(0, 21.4, Math.PI);
    this.scene.add(this.player.root);
    this.localAvatar = createAvatar(avatarDescriptor ?? {});
    this.player.root.add(this.localAvatar);
    this._animState = "idle";

    // What is drawn, by id: { object, sig }.
    this._drawn = new Map();
    this._pops = [];

    // Build mode.
    this.buildMode = false;
    this.tool = null;              // null | { type: "item", id } | { type: "hand" }
    this.rot = 0;
    this.variants = {};            // the colour last chosen for each item that has colours
    this._tints = new Map();
    this._herd = [];               // the living creatures of the developed island
    this._flames = [];             // campfire flames, flickering (when the rigged campfire is not loaded)
    this._props = [];              // rigged camp pieces playing their loops (props.js)
    this._pointer = null;          // where the pointer meets the lawn, or null
    this._aimWithPointer = false;
    this._target = null;
    this._buildGhost();

    this._bindInput();
    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(canvas.parentElement);
    }
    this._postfx = createPostFX(this.renderer, this.scene, this.camera, 1, 1);
    this.resize();
    this._rafHandle = null;

    this.loaded = loadKingdom().then((assets) => {
      if (this._disposed) return null;
      this._setup(assets);
      return assets;
    }).catch((error) => {
      console.warn("[kingdom] the island failed to load", error);
      this._emit({ error: "The island could not be loaded." });
      return null;
    });
  }

  // ── World ───────────────────────────────────────────────────────────────
  _buildSky() {
    const geometry = new THREE.SphereGeometry(700, 24, 12);
    const colors = [];
    const position = geometry.attributes.position;
    const horizon = new THREE.Color(SKY.horizon), mid = new THREE.Color(SKY.mid), top = new THREE.Color(SKY.top), c = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const h = Math.max(0, position.getY(i) / 700);
      if (h < 0.3) c.copy(horizon).lerp(mid, h / 0.3); else c.copy(mid).lerp(top, (h - 0.3) / 0.7);
      colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    sky.name = "sky"; sky.renderOrder = -10; sky.frustumCulled = false;
    this.scene.add(sky);
    this._sky = sky;
  }

  _buildLighting() {
    // The sun stands where it does in the Blender file: front-left of the
    // arrival view, so the house front and the great tree are lit.
    const key = new THREE.DirectionalLight(0xfffaf2, KINGDOM_LIGHT.key);
    key.position.set(-30, 82, 48);
    key.castShadow = SHADOWS;
    key.shadow.mapSize.set(2048, 2048);
    const cam = key.shadow.camera;
    cam.left = -85; cam.right = 85; cam.top = 85; cam.bottom = -85; cam.near = 10; cam.far = 380;      // the island is 110 m across with its beach, the pier reaches 55 m south
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.04;
    const fill = new THREE.HemisphereLight(0xf4f8ff, 0xe6ddd0, KINGDOM_LIGHT.fill);
    this.scene.add(key, key.target, fill);
    this._lights = [key, fill];
  }

  _setup(assets) {
    this.assets = assets;
    this.kit = assets.kit;
    this.layout = assets.layout;
    this.grid = assets.collision.grid;
    this.baseCells = assets.collision.base;
    this.env = { site: this.layout.site, buildable: assets.collision.buildable };
    this.worldGroup.add(assets.world);
    this.colliders.push(this.grid);
    const spawn = this.layout.spawn;
    this.player.moveTo(spawn.x, spawn.z, spawn.heading ?? Math.PI);

    this.land = assets.land;
    this.state = Island.loadIsland(this.storage, this.layout, layoutStamp(this.layout));
    this.day = Island.today(this.state);
    this.state = Island.settle(this.state, this.day);
    this.snapshot = this._readBag();
    this.ready = true;
    this._drawView();
    this._sync();
    this._emit();
    loadProps((root) => prepare(root)).then((lib) => {
      if (this._disposed) return;
      this._propLib = lib; {
        let stale = false;
        for (const drawn of this._drawn.values()) {
          let wants = false; drawn.object.traverse((o) => { if (o.userData.wantsProp) wants = true; });
          if (wants) { drawn.sig += ":static"; stale = true; }
        }
        if (stale) this._sync();
      }
    }).catch((error) => console.warn("[kingdom] the moving camp pieces failed to load", error));
  }

  // ── The two views ───────────────────────────────────────────────────────
  /** One InstancedMesh for each part of each kit mesh in `list`
   * ([{ mesh, matrix }]): a forest is a handful of draw calls, not a thousand. */
  _instances(list, group) {
    const by = new Map();
    for (const one of list) { if (!by.has(one.mesh)) by.set(one.mesh, []); by.get(one.mesh).push(one.matrix); }
    const inverse = new THREE.Matrix4(), local = new THREE.Matrix4(), m = new THREE.Matrix4();
    for (const [name, matrices] of by) {
      const template = this.kit.get(name);
      if (!template) { console.warn("[kingdom] no kit piece called", name); continue; }
      template.updateMatrixWorld(true);
      inverse.copy(template.matrixWorld).invert();
      template.traverse((part) => {
        if (!part.isMesh) return;
        local.multiplyMatrices(inverse, part.matrixWorld);
        const instanced = new THREE.InstancedMesh(part.geometry, part.material, matrices.length);
        matrices.forEach((matrix, i) => instanced.setMatrixAt(i, m.multiplyMatrices(matrix, local)));
        instanced.instanceMatrix.needsUpdate = true;
        instanced.computeBoundingSphere();
        instanced.name = name;
        instanced.castShadow = SHADOWS && !NO_SHADOW.test(name);
        instanced.receiveShadow = part.receiveShadow;
        instanced.renderOrder = part.renderOrder;                                 // see-through water draws after the solid world
        if (/^WATER_/.test(part.name)) instanced.castShadow = false;
        group.add(instanced);
      });
    }
  }

  _clearInstances(group) {
    for (const child of [...group.children]) { group.remove(child); child.dispose?.(); }      // the geometry is the kit's own: it stays
  }

  /** Draw what the view shows on top of the player's own things, and work
   * out what it blocks. */
  _drawView() {
    const developed = this.view === "developed" && this._developed;
    const opened = developed ? this._developed.view.opened : [];
    const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const pose = (x, y, z, rotY, scale) => new THREE.Matrix4().compose(p.set(x, y, z), q.setFromAxisAngle(up, rotY), s.setScalar(scale));
    this._clearInstances(this.wildGroup);
    this._instances(wildList(this.land, opened).map((one) => ({ mesh: one.mesh, matrix: pose(one.x, 0, one.z, one.rot ?? 0, one.scale ?? 1) })), this.wildGroup);
    if (developed && !this.showGroup.children.length) {
      const plain = [];
      for (const one of this._developed.view.showcase) {
        const matrix = one.q
          ? new THREE.Matrix4().compose(p.set(...one.p), q.set(...one.q), s.setScalar(one.s ?? 1))
          : pose(one.p[0], one.p[1], one.p[2], one.r ?? 0, one.s ?? 1);
        const kind = this._creatureLib?.standsFor.get(one.m);
        if (kind) {
          const rot = one.q ? new THREE.Euler().setFromQuaternion(q.set(...one.q), "YXZ").y : one.r ?? 0;
          const creature = new Creature(this._creatureLib, kind, { x: one.p[0], y: one.p[1], z: one.p[2], rot, still: one.m, colours: one.c });
          creature.root.scale.setScalar(one.s ?? 1);
          this._herd.push(creature); this.showGroup.add(creature.root);
          continue;
        }
        if (/^KL_Butterfly_/.test(one.m) && this._creatureLib?.models.has("Butterfly")) continue;
        const moves = one.m === "KK_Campfire" || one.m === "KK_Tent" || this._propLib?.standsFor.has(one.m);   // a rigged piece is drawn by itself
        if (!one.c && !moves) { plain.push({ mesh: one.m, matrix }); continue; }
        // A part with colours of its own (the house's roof, walls, trim, door) is drawn by itself.
        const object = this._spawn(one.m);
        object.traverse((part) => {
          if (!part.isMesh || !one.c?.[part.material?.name]) return;
          const key = `${part.material.uuid}:${one.c[part.material.name]}`;
          if (!this._tints.has(key)) { const made = part.material.clone(); made.color.set(one.c[part.material.name]); this._tints.set(key, made); }
          part.material = this._tints.get(key);
        });
        object.matrixAutoUpdate = false;
        object.matrix.copy(matrix);
        this.showGroup.add(object);
      }
      this._instances(plain, this.showGroup);
    }
    this.showGroup.visible = Boolean(developed);
    this.thingsGroup.visible = this.view === "day1";
    this._blocks = blocksOf({ land: this.land, opened, showcase: developed ? this._developed.showcase : null, houseSizes: developed ? this._developed.houseSizes : null });
  }

  /** Look at the island as a new player finds it ("day1") or as the showcase
   * ("developed"). Looking only: the developed island is not built on. */
  async setView(view) {
    if (!this.ready || this._viewBusy || view === this.view || !["day1", "developed", "gallery"].includes(view)) return;
    if (view === "gallery" && !this._gallery) {
      this._viewBusy = true;
      this._emit();
      try {
        const [parts, lib] = await Promise.all([loadGallery(this.kit, (root) => prepare(root)), this._creatureLib ?? loadCreatures((root) => prepare(root)).catch(() => null)]);
        this._creatureLib = lib; parts.creatures = lib; parts.props = this._propLib; parts.glowing = (m) => this._glowing(m);
        this._gallery = buildGallery(parts);
        this._gallery.group.visible = false;
        this.scene.add(this._gallery.group);
      } catch (error) { console.warn("[kingdom] the gallery failed to load", error); this._onToast("All assets could not be loaded"); }
      this._viewBusy = false;
      if (this._disposed) return;
      if (!this._gallery) { this._emit(); return; }
    }
    if (view === "developed" && !this._developed) {
      this._viewBusy = true;
      this._emit();
      try {
        [this._developed, this._creatureLib] = await Promise.all([loadDeveloped(this.kit), this._creatureLib ?? loadCreatures((root) => prepare(root)).catch((error) => { console.warn("[kingdom] creatures failed to load", error); return null; })]);
      }
      catch (error) { console.warn("[kingdom] the developed island failed to load", error); this._onToast("The developed island could not be loaded"); }
      this._viewBusy = false;
      if (this._disposed) return;
      if (!this._developed) { this._emit(); return; }
    }
    if (this.buildMode) this.setBuildMode(false);
    this.view = view;
    // The gallery is its own lawn with its own walk grid; the island is hidden while it is shown.
    const gallery = view === "gallery";
    this._islandGrid ??= { grid: this.grid, base: this.baseCells };
    const use = gallery ? { grid: this._gallery.grid, base: this._gallery.base } : this._islandGrid;
    const at = this.colliders.indexOf(this.grid);
    if (at >= 0) this.colliders[at] = use.grid;
    this.grid = use.grid; this.baseCells = use.base;
    if (this._gallery) this._gallery.group.visible = gallery;
    this.worldGroup.visible = !gallery; this.wildGroup.visible = !gallery;
    this._drawView();
    this._sync();
    const spawn = gallery ? this._gallery.spawn : this.layout.spawn;
    this.player.moveTo(spawn.x, spawn.z, spawn.heading ?? Math.PI);       // both views start from the pier, so they can be compared
    this._emit();
  }

  _readBag() {
    const read = readGroveSnapshot(this.storage);
    return read.ok ? read.snapshot : (this.snapshot ?? {});
  }

  _save() {
    if (!Island.saveIsland(this.storage, this.state)) this._onToast("Your island could not be saved on this device");
  }

  /** Apply a result from islandState: keep it, save it, draw it. */
  _commit(result, { pop = null } = {}) {
    if (!result?.ok) return false;
    this.state = result.state;
    this._save();
    this._sync(pop);
    this._emit();
    return true;
  }

  // ── Drawing the island from its state ───────────────────────────────────
  _spawn(mesh) {
    const template = this.kit.get(mesh);
    if (!template) { console.warn("[kingdom] no kit piece called", mesh); return new THREE.Group(); }
    const rigged = this._propLib?.standsFor.get(mesh);
    if (rigged) {
      const prop = new Prop(this._propLib, rigged, { glowing: (m) => this._glowing(m) });
      this._props.push(prop); return prop.root;
    }
    const object = template.clone(true);
    if (/^KH_Chimney_/.test(mesh)) {                                       // smoke rises from every chimney
      const box = new THREE.Box3().setFromObject(template);
      const smoke = new Smoke(new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2));
      object.add(smoke.root); this._props.push(smoke);
    }
    if (mesh === "KK_Campfire" || mesh === "KK_Tent") object.userData.wantsProp = true;      // drawn again once the rigged one has loaded
    if (mesh === "KK_Campfire" && this.kit.has("KK_Campfire_Flame")) {
      const flame = this.kit.get("KK_Campfire_Flame").clone(true);
      flame.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.material = this._glowing(o.material); } });
      flame.userData.phase = Math.random() * 10;
      object.add(flame); this._flames.push(flame);
    }
    return object;
  }

  /** A flame lights itself: the same colour, glowing, so shade never darkens it. */
  _glowing(material) {
    const key = `glow:${material.uuid}`;
    if (!this._tints.has(key)) { const m = material.clone(); m.emissive = m.color.clone(); m.emissiveIntensity = 0.85; this._tints.set(key, m); }
    return this._tints.get(key);
  }

  _updateFlames(dt) {
    this._flameT = (this._flameT ?? 0) + dt;
    for (let i = this._flames.length - 1; i >= 0; i--) {
      const flame = this._flames[i];
      if (!flame.parent) { this._flames.splice(i, 1); continue; }
      const t = this._flameT * 1.0 + flame.userData.phase;
      const up = 1 + 0.13 * Math.sin(t * 9.1) + 0.06 * Math.sin(t * 23.7);
      const wide = 1 - 0.05 * Math.sin(t * 9.1 + 0.6);
      flame.scale.set(wide, up, wide);
      flame.rotation.y = 0.15 * Math.sin(t * 2.3);
    }
  }

  /** Where a creature may not go: what the walk grid blocks, or (for one that swims) anywhere off its pond. */
  _creatureBlocked(creature) {
    if (creature.swimming) {
      const pond = this._pondCells ??= new Set((this._developed?.showcase.pond ?? []).map(([x, z]) => `${x},${z}`));
      return (x, z) => !pond.has(`${Math.floor(x)},${Math.floor(z)}`) || !pond.has(`${Math.floor(x + 0.3)},${Math.floor(z)}`) || !pond.has(`${Math.floor(x - 0.3)},${Math.floor(z)}`) || !pond.has(`${Math.floor(x)},${Math.floor(z + 0.3)}`) || !pond.has(`${Math.floor(x)},${Math.floor(z - 0.3)}`);
    }
    return (x, z) => this.grid.circleBlocked(x, z, 0.35);
  }

  _fenceMask() {
    const at = new Set(this.state.placed.filter((p) => ITEMS[p.item].connects).map((p) => `${p.cx},${p.cz}`));
    return (p) => (at.has(`${p.cx + 1},${p.cz}`) ? 1 : 0) | (at.has(`${p.cx - 1},${p.cz}`) ? 2 : 0) | (at.has(`${p.cx},${p.cz + 1}`) ? 4 : 0) | (at.has(`${p.cx},${p.cz - 1}`) ? 8 : 0);
  }

  _makeFence(item, placed, mask) {
    const group = new THREE.Group();
    group.add(this._spawn(item.mesh));
    // A rail reaches from the post to the +X edge of its cell. One is drawn
    // towards each neighbouring fence; a fence on its own gets one each side.
    const turns = [];
    if (mask === 0) turns.push(...(placed.rot % 2 === 0 ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2]));
    else {
      if (mask & 1) turns.push(0);
      if (mask & 2) turns.push(Math.PI);
      if (mask & 4) turns.push(-Math.PI / 2);
      if (mask & 8) turns.push(Math.PI / 2);
    }
    for (const turn of turns) { const rail = this._spawn(item.rail); rail.rotation.y = turn; group.add(rail); }
    return group;
  }

  /** A flower's colour repaints exactly its two petal materials. One
   * recoloured copy of each is made per colour and shared by every flower. */
  _tint(object, colors) {
    object.traverse((o) => {
      if (!o.isMesh) return;
      const index = PETAL_MATERIALS.indexOf(o.material?.name);
      if (index < 0) return;
      const key = `${o.material.uuid}:${colors[index]}`;
      if (!this._tints.has(key)) { const m = o.material.clone(); m.name = `${o.material.name}:${colors[index]}`; m.color.setHex(colors[index]); this._tints.set(key, m); }
      o.material = this._tints.get(key);
    });
  }

  _makePlant(item, placed, stage, wet) {
    const { mesh, scale } = Island.stageMesh(item, stage);
    const plant = this._spawn(mesh);
    plant.scale.setScalar(scale);
    if (item.variants) this._tint(plant, (item.variants[placed.variant] ?? Object.values(item.variants)[0]).colors);
    if (!wet) return plant;
    const group = new THREE.Group();
    group.add(plant, this._spawn("KK_Wet_Patch"));       // damp earth round a crop watered today
    return group;
  }

  _makeHouse(stage) {
    const object = this._spawn(HOUSE.stages[stage].mesh);
    if (stage === "cabin") {
      const colors = HOUSE.roofs[this.state.house.roof]?.colors ?? HOUSE.roofs.red.colors;
      const made = new Map();
      object.traverse((o) => {
        if (!o.isMesh) return;
        const index = ROOF_MATERIALS.indexOf(o.material?.name);
        if (index < 0) return;
        if (!made.has(index)) { const m = o.material.clone(); m.color.setHex(colors[index]); made.set(index, m); }
        o.material = made.get(index);
      });
    }
    return object;
  }

  /** Bring what is drawn in line with the state. `pop`: ids to bounce in. */
  _sync(pop = null) {
    if (!this.ready) return;
    const want = new Map();
    const mask = this._fenceMask();
    const stage = Island.houseStage(this.state, this.day);
    const site = this.layout.site;
    want.set("house", { sig: `house:${stage}:${this.state.house.roof}`, make: () => this._makeHouse(stage), x: site.x, z: site.z, rotY: 0, scale: 1 });
    for (const w of this.state.wild) {
      want.set(w.id, { sig: `wild:${w.mesh}`, make: () => this._spawn(w.mesh), x: w.x, z: w.z, rotY: w.rot, scale: w.scale });
    }
    for (const p of this.state.placed) {
      const item = ITEMS[p.item];
      const pose = Island.poseOf(item, p);
      if (item.connects) {
        const m = mask(p);
        want.set(p.id, { sig: `fence:${m}:${p.rot}`, make: () => this._makeFence(item, p, m), x: pose.x, z: pose.z, rotY: 0, scale: 1 });
      } else if (item.stages) {
        const s = Island.stageOf(p, this.day), wet = Island.isWet(p, this.day);
        // Each plant is turned a little differently, except those with a face (a sunflower looks at the dock).
        const turn = item.faces ? 0 : (p.cx * 7 + p.cz * 13) % 6;
        want.set(p.id, { sig: `plant:${item.id}:${s}:${p.variant ?? ""}:${wet ? 1 : 0}`, make: () => this._makePlant(item, p, s, wet), x: pose.x, z: pose.z, rotY: turn, scale: 1, grew: true });
      } else {
        want.set(p.id, { sig: `item:${item.id}`, make: () => this._spawn(item.mesh), x: pose.x, z: pose.z, rotY: pose.rotY, scale: 1 });
      }
    }
    for (const [id, drawn] of this._drawn) {
      if (!want.has(id)) { this.thingsGroup.remove(drawn.object); this._drawn.delete(id); }
    }
    for (const [id, w] of want) {
      let drawn = this._drawn.get(id);
      const changed = !drawn || drawn.sig !== w.sig;
      if (changed) {
        if (drawn) this.thingsGroup.remove(drawn.object);
        const object = w.make();
        object.userData.kingdomId = id;
        this.thingsGroup.add(object);
        const wasDrawn = Boolean(drawn);
        drawn = { object, sig: w.sig, scale: w.scale };
        this._drawn.set(id, drawn);
        if ((pop && pop.includes(id)) || (wasDrawn && (w.grew || id === "house"))) this._pops.push({ drawn, t: 0 });
      }
      drawn.scale = w.scale;
      drawn.object.position.set(w.x, 0, w.z);
      drawn.object.rotation.y = w.rotY;
      if (!this._pops.some((p) => p.drawn === drawn)) drawn.object.scale.setScalar(w.scale);
    }
    this._restamp(stage);
  }

  /** Write the things that stand on the island into the walk and camera
   * grid, on top of what the world itself blocks, and collect the seats. */
  _restamp(stage) {
    const g = this.grid, cells = g.cells, c = g.cell;
    cells.set(this.baseCells);
    const rect = (x0, z0, x1, z1, bits) => {
      const ix0 = Math.max(0, Math.floor((x0 - g.minX) / c)), ix1 = Math.min(g.nx - 1, Math.floor((x1 - g.minX) / c - 1e-6));
      const iz0 = Math.max(0, Math.floor((z0 - g.minZ) / c)), iz1 = Math.min(g.nz - 1, Math.floor((z1 - g.minZ) / c - 1e-6));
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) cells[iz * g.nx + ix] |= bits;
    };
    const overhead = (x, z, r, height) => {
      const code = Math.max(1, Math.min(31, Math.round((height - g.overBase) / g.overStep)));
      if (height > g.overBase + 31 * g.overStep) return;
      const ix0 = Math.max(0, Math.floor((x - r - g.minX) / c)), ix1 = Math.min(g.nx - 1, Math.floor((x + r - g.minX) / c));
      const iz0 = Math.max(0, Math.floor((z - r - g.minZ) / c)), iz1 = Math.min(g.nz - 1, Math.floor((z + r - g.minZ) / c));
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
        const px = g.minX + (ix + 0.5) * c - x, pz = g.minZ + (iz + 0.5) * c - z;
        if (px * px + pz * pz > r * r) continue;
        const i = iz * g.nx + ix, now = cells[i] >> 3;
        if (!now || now > code) cells[i] = (cells[i] & 7) | (code << 3);
      }
    };
    const seats = [];
    if (this.view === "gallery") { this.player.setSeats(seats); return; }      // its pieces are in its own grid already
    // What the view adds: the growth on closed land, and in the developed view the showcase.
    for (const [cx, cz] of this._blocks.closed ?? []) rect(cx, cz, cx + 1, cz + 1, WALK_BLOCKED);     // land not opened yet
    for (const disc of this._blocks.discs) {
      rect(disc.x - disc.r, disc.z - disc.r, disc.x + disc.r, disc.z + disc.r, WALK_BLOCKED);
      if (disc.crown) overhead(disc.x, disc.z, disc.crown, disc.crownAt);
    }
    for (const r of this._blocks.rects) rect(r.x0, r.z0, r.x1, r.z1, WALK_BLOCKED | (r.wall ? WALL : 0));
    if (this.view !== "day1") { this.player.setSeats(seats); return; }      // the player's own things are not shown in the developed view
    const site = this.layout.site, [bw, bd] = HOUSE.stages[stage].body;
    const bz = stage === "tent" ? site.z : site.z - 0.3;      // the cabin's body sits a little back on its plot
    rect(site.x - bw / 2, bz - bd / 2, site.x + bw / 2, bz + bd / 2, WALK_BLOCKED | (stage === "frame" ? 0 : WALL));
    for (const w of this.state.wild) {
      const kind = WILD[w.mesh];
      if (kind?.seat) seats.push({ name: w.id, x: w.x, z: w.z, y: kind.seat.y, heading: null, side: null, depth: kind.seat.depth, table: false });
      if (!kind?.solid) continue;
      if (kind.tall) {
        const r = kind.trunk * w.scale;
        rect(w.x - r, w.z - r, w.x + r, w.z + r, WALK_BLOCKED);
        overhead(w.x, w.z, kind.crown * w.scale, kind.crownAt * w.scale);
      } else {
        const r = 0.42 * Math.min(1.15, w.scale);
        rect(w.x - r, w.z - r, w.x + r, w.z + r, WALK_BLOCKED);
      }
    }
    for (const p of this.state.placed) {
      const item = ITEMS[p.item];
      const [w, d] = Island.footprint(item, p.rot);
      const pose = Island.poseOf(item, p);
      if (item.seat) seats.push({ name: p.id, x: pose.x, z: pose.z, y: item.seat.y, heading: pose.rotY, side: null, depth: item.seat.depth, table: false });
      if (item.stages) {
        const s = Island.stageOf(p, this.day);
        if (!Island.solidAt(item, s)) continue;                 // crops, flowers and seedlings are walked through
        const { scale } = Island.stageMesh(item, s);
        const grown = item.tall && s >= 2;                      // a sapling is a thin stem with no crown to duck
        const r = grown ? item.tall.trunk * scale : 0.14;
        rect(pose.x - r, pose.z - r, pose.x + r, pose.z + r, WALK_BLOCKED);
        if (grown) overhead(pose.x, pose.z, item.tall.crown * scale, item.tall.crownAt * scale);
        continue;
      }
      if (!item.solid) continue;
      const inset = item.connects ? 0.34 : 0.1;
      rect(p.cx + inset, p.cz + inset, p.cx + w - inset, p.cz + d - inset, WALK_BLOCKED);
      if (item.connects) {                                    // rails close the gap to a neighbouring fence
        const m = this._fenceMask()(p);
        if (m & 1) rect(p.cx + 0.5, p.cz + 0.38, p.cx + 1, p.cz + 0.62, WALK_BLOCKED);
        if (m & 2) rect(p.cx, p.cz + 0.38, p.cx + 0.5, p.cz + 0.62, WALK_BLOCKED);
        if (m & 4) rect(p.cx + 0.38, p.cz + 0.5, p.cx + 0.62, p.cz + 1, WALK_BLOCKED);
        if (m & 8) rect(p.cx + 0.38, p.cz, p.cx + 0.62, p.cz + 0.5, WALK_BLOCKED);
        if (m === 0) (p.rot % 2 === 0 ? rect(p.cx, p.cz + 0.38, p.cx + 1, p.cz + 0.62, WALK_BLOCKED) : rect(p.cx + 0.38, p.cz, p.cx + 0.62, p.cz + 1, WALK_BLOCKED));
      }
    }
    this.player.setSeats(seats);
  }

  // ── What the HUD shows ──────────────────────────────────────────────────
  _bag() {
    if (!this.ready) return [];
    return Island.placeable(this.state, this.snapshot).map(({ item, free }) => ({ id: item.id, label: item.label, free, kind: item.kind }));
  }

  _variantOf(item) {
    if (!item?.variants) return null;
    const keys = Object.keys(item.variants);
    return keys.includes(this.variants[item.id]) ? this.variants[item.id] : keys[0];
  }

  _emit(extra = {}) {
    const stage = this.ready ? Island.houseStage(this.state, this.day) : "tent";
    this._onChange({
      ready: this.ready,
      day: this.ready ? this.day : null,
      dayOffset: this.state?.dayOffset ?? 0,
      buildMode: this.buildMode,
      tool: this.tool,
      bag: this._bag(),
      // The colour the chosen flower will be planted in, and whether there are others to switch to.
      variant: (() => {
        const item = this.tool?.type === "item" ? ITEMS[this.tool.id] : null;
        const key = this._variantOf(item);
        return key ? { key, label: item.variants[key].label, color: item.variants[key].colors[0], choices: Object.keys(item.variants).length } : null;
      })(),
      canWater: this.ready ? Island.hasTool(this.snapshot, "wateringCan") : false,
      produce: { ...(this.state?.produce ?? {}) },
      house: { stage, roof: this.state?.house.roof ?? "red" },
      placed: this.state?.placed.length ?? 0,
      view: this.view,
      viewBusy: Boolean(this._viewBusy),
      dev: this.dev,
      ...extra,
    });
  }

  // ── Build mode ──────────────────────────────────────────────────────────
  setBuildMode(on) {
    if (!this.ready || this.buildMode === on) return;
    if (on && this.view !== "day1") return;                 // the developed island is for looking at
    this.buildMode = on;
    if (on) {
      this.snapshot = this._readBag();
      const bag = this._bag();
      this.tool = bag.length ? { type: "item", id: bag[0].id } : { type: "hand" };
      this._aimWithPointer = false;
    } else {
      this.tool = null;
    }
    this._refreshGhost();
    this._emit();
  }

  selectTool(tool) {
    if (!this.buildMode) return;
    this.tool = tool;
    this.rot = 0;
    this._refreshGhost();
    this._emit();
  }

  rotate() {
    if (!this.buildMode || this.tool?.type !== "item") return;
    this.rot = (this.rot + 1) % 4;
  }

  /** Next colour for the chosen flower. */
  nextVariant() {
    const item = this.buildMode && this.tool?.type === "item" ? ITEMS[this.tool.id] : null;
    if (!item?.variants) return;
    const keys = Object.keys(item.variants);
    this.variants[item.id] = keys[(keys.indexOf(this._variantOf(item)) + 1) % keys.length];
    this._refreshGhost();
    this._emit();
  }

  _buildGhost() {
    this.ghost = new THREE.Group(); this.ghost.name = "build-ghost"; this.ghost.visible = false;
    this._ghostModel = new THREE.Group();
    this.ghost.add(this._ghostModel);
    // Lines for the cells around the target, so the grid is seen where you
    // are working and nowhere else.
    const half = 4, points = [];
    for (let i = -half; i <= half + 1; i++) {
      points.push(-half, 0, i, half + 1, 0, i, i, 0, -half, i, 0, half + 1);
    }
    const lines = new THREE.BufferGeometry();
    lines.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    this._gridLines = new THREE.LineSegments(lines, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false, fog: false }));
    this._gridLines.position.y = 0.035;
    this._gridLines.visible = false;
    this._gridLines.renderOrder = 4;
    this._tiles = [];
    const tile = new THREE.PlaneGeometry(0.94, 0.94);
    tile.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(tile, TILE_OK);
      mesh.position.y = 0.04; mesh.visible = false; mesh.renderOrder = 5;
      this._tiles.push(mesh);
      this.scene.add(mesh);
    }
    this.scene.add(this.ghost, this._gridLines);
  }

  _refreshGhost() {
    this._ghostModel.clear();
    this._ghostFor = null;
    if (this.buildMode && this.tool?.type === "item") {
      const item = ITEMS[this.tool.id];
      const last = item.stages ? Island.stageMesh(item, item.stages.length - 1) : { mesh: item.mesh, scale: 1 };   // show what it will become
      const model = this._spawn(last.mesh);
      model.scale.setScalar(last.scale);
      model.traverse((o) => { if (o.isMesh) { o.material = GHOST_OK; o.castShadow = false; o.receiveShadow = false; } });
      this._ghostModel.add(model);
      this._ghostFor = item.id;
    }
  }

  /** Where the tool points now, and whether it can act there. */
  _aim() {
    if (!this.buildMode || !this.tool) return null;
    let x, z;
    if (this._aimWithPointer && this._pointer) { x = this._pointer.x; z = this._pointer.z; }
    else {
      const p = this.player.root.position, h = this.player.heading;
      x = p.x + Math.sin(h) * AHEAD; z = p.z + Math.cos(h) * AHEAD;
    }
    if (this.tool.type === "hand") {
      const cx = Math.floor(x), cz = Math.floor(z);
      const holder = Island.occupancy(this.state, null).get(`${cx},${cz}`) ?? this._looseAt(x, z);
      return { hand: true, cells: [[cx, cz]], holder, ok: Boolean(holder) };
    }
    const item = ITEMS[this.tool.id];
    const { cx, cz } = Island.cellFor(item, x, z, this.rot);
    const cells = Island.cellsOf(item, cx, cz, this.rot);
    let check = Island.canPlace(this.state, this.env, item.id, cx, cz, this.rot);
    if (check.ok && Island.available(this.state, this.snapshot, item.grove) < 1) check = { ok: false, reason: "none-owned" };
    const p = this.player.root.position;
    if (check.ok && item.solid && cells.some(([ax, az]) => p.x > ax - 0.3 && p.x < ax + 1.3 && p.z > az - 0.3 && p.z < az + 1.3)) check = { ok: false, reason: "standing" };
    return { item, cx, cz, cells, ok: check.ok, reason: check.reason };
  }

  /** Grass and the like take no cell: find one by where it stands. */
  _looseAt(x, z) {
    let best = null, bestD = 0.7;
    for (const w of this.state.wild) {
      if (WILD[w.mesh]?.cell !== false) continue;
      const d = Math.hypot(w.x - x, w.z - z);
      if (d < bestD) { best = { type: "wild", id: w.id }; bestD = d; }
    }
    return best;
  }

  _updateGhost() {
    const aim = this._aim();
    this._target = aim;
    for (const t of this._tiles) t.visible = false;
    if (!aim) { this.ghost.visible = false; this._gridLines.visible = false; return; }
    this._gridLines.visible = true;
    this._gridLines.position.set(aim.cells[0][0], 0.035, aim.cells[0][1]);
    aim.cells.forEach(([cx, cz], i) => {
      const t = this._tiles[i]; if (!t) return;
      t.visible = true; t.position.set(cx + 0.5, 0.04, cz + 0.5);
      t.material = aim.hand ? (aim.ok ? TILE_HAND : TILE_NO) : aim.ok ? TILE_OK : TILE_NO;
    });
    if (aim.hand) { this.ghost.visible = false; return; }
    const pose = Island.poseOf(aim.item, { cx: aim.cx, cz: aim.cz, rot: this.rot });
    this.ghost.visible = true;
    this.ghost.position.set(pose.x, 0, pose.z);
    this.ghost.rotation.y = aim.item.connects || aim.item.stages ? 0 : pose.rotY;
    const material = aim.ok ? GHOST_OK : GHOST_NO;
    if (this._ghostMaterial !== material) {
      this._ghostMaterial = material;
      this._ghostModel.traverse((o) => { if (o.isMesh) o.material = material; });
    }
  }

  /** Click, tap or E while building. */
  act() {
    const aim = this._target ?? this._aim();
    if (!aim) return;
    if (aim.hand) { if (aim.holder) this._pickUp(aim.holder); return; }
    if (!aim.ok) { this._onToast(REASON[aim.reason] ?? "It does not fit there"); return; }
    const result = Island.place(this.state, this.env, this.snapshot, aim.item.id, aim.cx, aim.cz, this.rot, this.day, this._variantOf(aim.item));
    if (!result.ok) { this._onToast(REASON[result.reason] ?? "It does not fit there"); return; }
    this._commit(result, { pop: [result.placed.id] });
    if (aim.item.stages) this._onToast(aim.item.kind === "tree" ? `${aim.item.label} planted. Trees take about a week to grow up.` : `${aim.item.label} planted. It grows day by day.`);
    // Out of that item: move on to the next thing in the bag, or to the hand.
    if (!this._bag().some((b) => b.id === aim.item.id)) {
      const bag = this._bag();
      this.selectTool(bag.length ? { type: "item", id: bag[0].id } : { type: "hand" });
    }
  }

  _pickUp(holder) {
    if (holder.type === "house") { this._onToast("The house stays where it is"); return; }
    if (holder.type === "wild") {
      const wild = this.state.wild.find((w) => w.id === holder.id);
      if (this._commit(Island.clearWild(this.state, holder.id))) this._onToast(`Cleared the ${WILD[wild.mesh]?.label ?? "thing"}`);
      return;
    }
    const placed = this.state.placed.find((p) => p.id === holder.id);
    if (!placed) return;
    if (this._commit(Island.store(this.state, holder.id))) this._onToast(`${ITEMS[placed.item].label} is back in your bag`);
  }

  pickUpUnderPointer() {
    if (!this.buildMode) return;
    const p = this._aimWithPointer && this._pointer ? this._pointer : null;
    const pos = this.player.root.position, h = this.player.heading;
    const x = p ? p.x : pos.x + Math.sin(h) * AHEAD, z = p ? p.z : pos.z + Math.cos(h) * AHEAD;
    const holder = Island.occupancy(this.state, null).get(`${Math.floor(x)},${Math.floor(z)}`) ?? this._looseAt(x, z);
    if (holder) this._pickUp(holder);
  }

  // ── Acting on the island outside build mode ─────────────────────────────
  /** The nearest thing the player could act on or would want to read about. */
  _nearest() {
    const p = this.player.root.position;
    let best = null, bestD = REACH;
    for (const placed of this.state.placed) {
      const item = ITEMS[placed.item];
      if (!item.stages) continue;
      const pose = Island.poseOf(item, placed);
      const d = Math.hypot(pose.x - p.x, pose.z - p.z);
      if (d < bestD) { best = { type: "plant", placed, item }; bestD = d; }
    }
    const site = this.layout.site, stage = Island.houseStage(this.state, this.day);
    const [bw, bd] = HOUSE.stages[stage].body;
    const dx = Math.max(0, Math.abs(p.x - site.x) - bw / 2), dz = Math.max(0, Math.abs(p.z - site.z) - bd / 2);
    const dh = Math.hypot(dx, dz);
    if (dh < 1.5 && dh < bestD) best = { type: "house", stage };
    return best;
  }

  _promptFor(near) {
    if (!near) return null;
    if (near.type === "plant") {
      const { placed, item } = near;
      if (Island.isRipe(placed, this.day)) return { key: "E", text: item.kind === "tree" ? `Pick the ${item.harvest.label}` : `Harvest the ${item.harvest.label}` };
      const stage = Island.stageOf(placed, this.day), left = Island.daysUntilNextStage(placed, this.day);
      const when = left === 0 ? "" : left === 1 ? ", next stage tomorrow" : `, next stage in ${left} days`;
      const about = `${item.label}: ${item.stageNames[stage]}${when}`;
      const check = Island.canWater(this.state, this.snapshot, placed.id, this.day);
      if (check.ok) return { key: "E", text: `Water it  ·  ${about}` };
      if (check.reason === "already-watered") return { key: null, text: `${about}. Watered today.` };
      if (check.reason === "watered-enough") return { key: null, text: `${about}. Well watered.` };
      return { key: null, text: about };
    }
    if (near.stage === "tent") {
      const check = Island.canStartCabin(this.state, this.snapshot);
      const { count, label } = HOUSE.cabin.cost;
      return check.ok
        ? { key: "E", text: `Build a cabin with ${count} ${label}` }
        : { key: null, text: `A cabin needs ${count} ${label}. You have ${check.have ?? 0}. Maker Meadow in the Grove sells it.` };
    }
    if (near.stage === "frame") return { key: null, text: "Your cabin will be finished tomorrow" };
    return { key: null, text: "Your cabin. Going inside comes in a later update." };
  }

  _interact() {
    const near = this._nearest();
    if (!near) return;
    if (near.type === "plant") {
      const result = Island.harvest(this.state, near.placed.id, this.day);
      if (result.ok) {
        if (this._commit(result, { pop: [near.placed.id] })) this._onToast(`+${result.count} ${near.item.harvest.label}. ${near.item.kind === "tree" ? "The tree will bear again." : "The plant will grow back."}`);
        return;
      }
      const watered = Island.water(this.state, this.snapshot, near.placed.id, this.day);
      if (watered.ok && this._commit(watered)) {
        const left = near.item.harvest.waterBonus - Island.yieldOf(this.state.placed.find((p) => p.id === near.placed.id)) + near.item.harvest.base;
        this._onToast(left > 0 ? "Watered. One more at harvest. It can take another watering tomorrow." : "Watered. This one is as full as it gets.");
      }
      return;
    }
    if (near.type === "house" && near.stage === "tent") {
      const check = Island.canStartCabin(this.state, this.snapshot);
      if (check.ok) this._onAskRoof({ have: check.have, need: check.need });
    }
  }

  /** The player has chosen a roof colour: start building. */
  startCabin(roof) {
    this.snapshot = this._readBag();
    const result = Island.startCabin(this.state, this.snapshot, roof, this.day);
    if (!result.ok) { this._onToast(result.reason === "need-wood" ? "Not enough wood" : "The cabin cannot be started"); return false; }
    this._commit(result);
    this._onToast("Building has begun. Your cabin will be ready tomorrow.");
    return true;
  }

  /** Development only: throw the saved island away and start again from
   * Day 1, to see the island as a new player finds it. */
  resetIsland() {
    if (!this.dev || !this.ready || this.view !== "day1") return;
    if (this.buildMode) this.setBuildMode(false);
    this.state = Island.createIsland(null, this.layout, layoutStamp(this.layout));
    this.day = Island.today(this.state);
    this._save();
    this._sync();
    this._emit();
    this._onToast("A new island, as on the first day");
  }

  /** Development only: move the island's calendar on, to see growth. */
  skipDays(n = 1) {
    if (!this.dev || !this.ready) return;
    this.state = { ...this.state, dayOffset: (this.state.dayOffset ?? 0) + n };
    this._newDay();
  }

  _newDay() {
    const before = this.day;
    this.day = Island.today(this.state);
    if (this.day === before) return;
    const grown = this.state.placed.filter((p) => ITEMS[p.item].stages && Island.stageOf(p, this.day) !== Island.stageOf(p, before)).length;
    const wasFrame = Island.houseStage(this.state, before) === "frame";
    this.state = Island.settle(this.state, this.day);
    this._save();
    this._sync();
    this._emit();
    if (wasFrame && this.state.house.stage === "cabin") this._onToast("Your cabin is finished!");
    else if (grown) this._onToast(grown === 1 ? "A new day. One plant has grown." : `A new day. ${grown} plants have grown.`);
  }

  // ── Input ───────────────────────────────────────────────────────────────
  _bindInput() {
    const canvas = this.canvas;
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    let drag = null;
    const toGround = (e) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      return ray.ray.intersectPlane(ground, hit) ? { x: hit.x, z: hit.z } : null;
    };
    const down = (e) => {
      if (e.button === 2) { if (this.buildMode) { this._pointer = toGround(e); this._aimWithPointer = true; this.pickUpUnderPointer(); } return; }
      if (e.button !== undefined && e.button !== 0) return;
      drag = { id: e.pointerId, x: e.clientX, moved: 0 };
      canvas.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (this.buildMode) { this._pointer = toGround(e); this._aimWithPointer = true; }
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      drag.moved += Math.abs(dx); drag.x = e.clientX;
      if (!this.buildMode || drag.moved > 8) this.player.lookBy(dx);      // a drag turns the view; a click builds
    };
    const up = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const clicked = drag.moved <= 8;
      drag = null;
      canvas.releasePointerCapture?.(e.pointerId);
      if (this.buildMode && clicked) { this._pointer = toGround(e); this._aimWithPointer = true; this._updateGhost(); this.act(); }
    };
    const menu = (e) => { if (this.buildMode) e.preventDefault(); };
    const key = (e) => {
      const el = e.target;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.repeat) return;
      if (e.code === "KeyB") this.setBuildMode(!this.buildMode);
      else if (e.code === "Escape" && this.buildMode) this.setBuildMode(false);
      else if (e.code === "KeyR") this.rotate();
      else if (e.code === "KeyC") this.nextVariant();
      else if (e.code === "KeyX") this.pickUpUnderPointer();
      else if (this.buildMode && /^Digit[1-9]$/.test(e.code)) {
        const bag = this._bag(), i = Number(e.code.slice(5)) - 1;
        if (i < bag.length) this.selectTool({ type: "item", id: bag[i].id });
        else if (i === bag.length) this.selectTool({ type: "hand" });
      }
      else if (this.dev && e.code === "BracketRight") this.skipDays(1);
    };
    const focus = () => { if (this.ready) { this.snapshot = this._readBag(); this._newDay(); this._emit(); } };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("contextmenu", menu);
    window.addEventListener("keydown", key);
    window.addEventListener("focus", focus);
    this._dayTimer = setInterval(() => { if (this.ready) this._newDay(); }, 30000);
    this._unbindInput = () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("contextmenu", menu);
      window.removeEventListener("keydown", key);
      window.removeEventListener("focus", focus);
      clearInterval(this._dayTimer);
    };
  }

  // ── Frame ───────────────────────────────────────────────────────────────
  _updateAnimation(dt) {
    const avatar = this.localAvatar;
    const anim = avatar?.userData.animation;
    if (!anim?.actions) return;
    if (this._animOwner !== anim) {
      this._animOwner = anim; this._animState = "idle";
      this._avatarOpacity = 1;                 // fresh materials start solid
      avatar.traverse((o) => { if (o.isMesh) { o.castShadow = SHADOWS; } });
    }
    const player = this.player;
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    const previous = this._animState;
    let state;
    if (player.sitting) state = player.sitting.kind === "chair" ? "sit_chair" : "sit_floor";
    else if (!player.onGround) state = "jump";
    else if (speed > (previous === "run" ? RUN_FROM * 0.8 : RUN_FROM)) state = "run";
    else if (speed > WALK_FROM) state = "walk";
    else state = "idle";
    if (state !== previous) {
      const fade = state === "jump" ? 0.07 : previous === "jump" ? 0.14 : state.startsWith("sit") || previous.startsWith("sit") ? 0.28 : 0.18;
      anim.play(state, fade);
      const action = anim.actions.get(state);
      if (action && state === "jump") { action.time = JUMP_CLIP_TAKEOFF; action.timeScale = JUMP_CLIP_RATE; }
      this._animState = state;
    }
    const action = anim.actions.get(state);
    if (action && state === "run") action.timeScale = 0.9 + 1.0 * Math.min(1, speed / MAX_SPEED);
    if (action && state === "walk") action.timeScale = 1.0 + 1.2 * Math.min(1, speed / RUN_FROM);
    anim.update(dt);
    const seatLift = player.sitting?.kind === "chair" ? player.sitting.y - SIT_CLIP_SEAT : 0;
    avatar.position.y += (seatLift - avatar.position.y) * Math.min(1, 14 * dt);
  }

  /** The Grove's rule: the character never blocks the view. When the camera
   * has come in close it turns see-through, and through its own eyes (V) it
   * is hidden altogether; otherwise the first-person camera is inside the head. */
  _updateAvatarFade(dt) {
    const close = this.player.cameraCloseness ?? 0;
    const target = 1 - 0.86 * THREE.MathUtils.smoothstep(close, 0.15, 0.85) - (close > 0.97 ? 0.14 : 0);
    const current = this._avatarOpacity ?? 1;
    const next = current + (target - current) * Math.min(1, 10 * dt);
    if (Math.abs(next - current) < 0.004 && Math.abs(target - current) > 0.004) return;
    const value = Math.abs(target - next) < 0.004 ? target : next;
    if (value === current) return;
    this._avatarOpacity = value;
    const solid = value > 0.99;
    this.localAvatar.visible = value > 0.03;
    this.localAvatar.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        if (m.userData._solidOpacity === undefined) { m.userData._solidOpacity = m.opacity ?? 1; m.userData._solidTransparent = m.transparent === true; }
        const transparent = !solid || m.userData._solidTransparent;
        if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
        m.opacity = m.userData._solidOpacity * value;
        m.depthWrite = value > 0.6;
      }
    });
  }

  _updatePops(dt) {
    for (let i = this._pops.length - 1; i >= 0; i--) {
      const pop = this._pops[i];
      pop.t += dt / POP_TIME;
      const u = Math.min(1, pop.t);
      // Out past full size and back: the squash-and-settle of a thing arriving.
      const s = u < 0.6 ? 0.55 + (1.16 - 0.55) * (u / 0.6) : 1.16 - 0.16 * ((u - 0.6) / 0.4);
      pop.drawn.object.scale.setScalar(pop.drawn.scale * s);
      if (u >= 1) { pop.drawn.object.scale.setScalar(pop.drawn.scale); this._pops.splice(i, 1); }
    }
  }

  _frame(dt) {
    if (!this.ready) return;
    const pressed = this.player.consumeInteractPress();
    this.player.consumeAltPress();
    if (Math.hypot(this.player.velocity.x, this.player.velocity.z) > 0.5) this._aimWithPointer = false;   // walking: build in front of you
    if (this.view !== "day1") {
      this._target = null;
      this._updateGhost();
      this._setPrompt(null);
    } else if (this.buildMode) {
      this._updateGhost();
      if (pressed) this.act();
      this._setPrompt(null);
    } else {
      this._target = null;
      this._updateGhost();
      const near = this._nearest();
      this._setPrompt(this._promptFor(near));
      if (pressed) this._interact();
    }
    this._updatePops(dt);
    this._updateFlames(dt);
    tickWater(dt);
    for (let i = this._props.length - 1; i >= 0; i--) {
      const prop = this._props[i];
      let attached = prop.root; while (attached.parent) attached = attached.parent;
      if (attached !== this.scene) { if (!prop.root.parent) { prop.dispose(); this._props.splice(i, 1); } continue; }
      prop.update(dt, this.camera);
    }
    if (this.view === "developed") for (const creature of this._herd) creature.update(dt, this._creatureBlocked(creature));
    if (this.view === "gallery") {
      for (const creature of this._gallery?.creatures ?? []) creature.update(dt);
      for (const prop of this._gallery?.props ?? []) prop.update(dt, this.camera);
    }
    this._sky.position.copy(this.camera.position);
    // On the island the sun's shadow covers the whole island. The gallery is
    // longer than that, so there the shadow follows the player.
    const [key] = this._lights, p = this.player.root.position;
    if (this.view === "gallery") {
      // Moved freely, the shadow map slides under the world by fractions of a texel and every shadow edge crawls as
      // the player walks. So its centre only moves in whole texels, measured across the sun's own view.
      const sun = SUN_DIR, across = SUN_ACROSS, up = SUN_UP, texel = (key.shadow.camera.right - key.shadow.camera.left) / key.shadow.mapSize.x;
      const u = Math.round((p.x * across.x + p.z * across.z) / texel) * texel, v = Math.round((p.x * up.x + p.y * 0 + p.z * up.z) / texel) * texel;
      const w = p.x * sun.x + p.z * sun.z;
      const c = this._sunCentre ?? (this._sunCentre = new THREE.Vector3());
      c.set(0, 0, 0).addScaledVector(across, u).addScaledVector(up, v).addScaledVector(sun, w);
      c.addScaledVector(sun, -c.y / sun.y);                              // back down to the ground along the sun's line, which keeps it on the texel grid
      key.target.position.copy(c); key.position.set(c.x - 30, c.y + 82, c.z + 48);
    }
    else if (key.target.position.lengthSq() > 0) { key.target.position.set(0, 0, 0); key.position.set(-30, 82, 48); }
  }

  _setPrompt(prompt) {
    const text = prompt ? `${prompt.key ?? ""}|${prompt.text}` : "";
    if (text === this._promptText) return;
    this._promptText = text;
    this._onPrompt(prompt);
  }

  resize() {
    const parent = this.canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;
    // Same rule as the Grove: render at the size shown on screen, not at the
    // fixed stage size the app is laid out on.
    const shown = this.canvas.getBoundingClientRect?.();
    const stretch = shown && shown.width > 0 && width > 0 ? shown.width / width : 1;
    const wanted = stretch * (window.devicePixelRatio || 1);
    const budget = Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, width * height));
    const ratio = Math.max(1, Math.min(wanted, budget, 3));
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this._postfx?.resize(width, height, ratio);
  }

  start() {
    const loop = () => {
      if (this._disposed) return;
      this._rafHandle = requestAnimationFrame(loop);
      const frameDt = Math.min(this.clock.getDelta(), MAX_ACCUMULATED);
      this._accumulator += frameDt;
      while (this._accumulator >= FIXED_STEP) { this.player.fixedStep(FIXED_STEP); this._accumulator -= FIXED_STEP; }
      this.player.updateCamera(frameDt);
      this._frame(frameDt);
      this._updateAnimation(frameDt);
      this._updateAvatarFade(frameDt);
      if (this._postfx) this._postfx.composer.render(); else this.renderer.render(this.scene, this.camera);
    };
    this._onVisibilityChange = () => {
      if (document.hidden) { if (this._rafHandle) cancelAnimationFrame(this._rafHandle); this._rafHandle = null; }
      else if (!this._disposed && this._rafHandle === null) { this.clock.getDelta(); if (this.ready) this._newDay(); this._rafHandle = requestAnimationFrame(loop); }
    };
    document.addEventListener("visibilitychange", this._onVisibilityChange);
    this._rafHandle = requestAnimationFrame(loop);
  }

  perfSnapshot() {
    const info = this.renderer.info.render;
    return { drawCalls: info.calls, triangles: info.triangles, things: this._drawn.size };
  }

  dispose() {
    this._disposed = true;
    if (this._rafHandle) cancelAnimationFrame(this._rafHandle);
    if (this._onVisibilityChange) document.removeEventListener("visibilitychange", this._onVisibilityChange);
    window.removeEventListener("resize", this._onResize);
    this._resizeObserver?.disconnect();
    this._unbindInput?.();
    this.player.dispose();
    this.localAvatar?.userData.animation?.dispose?.();
    this._postfx?.dispose();
    for (const one of [...this._herd, ...(this._gallery?.creatures ?? []), ...this._props, ...(this._gallery?.props ?? [])]) one.dispose();
    // Only what this scene loaded or made. The avatar's model is shared with
    // the other screens and is left alone.
    for (const root of [this.worldGroup, this.thingsGroup, this.wildGroup, this.showGroup, this._gallery?.group, this.ghost, this._sky, this._gridLines, ...this._tiles].filter(Boolean)) {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); });
      });
    }
    this.renderer.dispose();
  }
}
