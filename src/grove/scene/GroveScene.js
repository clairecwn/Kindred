// src/grove/scene/GroveScene.js
//
// Owns the renderer, scene graph, lighting rig, toon material setup,
// resize handling, and a fixed-timestep game loop for the Kindred
// Commons. WHAT the world looks like lives in scene/worldLayout.js (data)
// and scene/worldBuilder.js (geometry); this file is the runtime.
//
// Art direction target (Design Bible s2, s9, s10): a premium-casual
// diorama — a warm island board floating in calm water, lit by a single
// golden-hour key, toon-banded with a cool-tinted shadow ramp and a warm
// rim, soft blob contact shadows, and no harsh dynamic shadow maps
// anywhere. Every repeated prop comes from one Blender-authored GLB and
// is drawn as an InstancedMesh, so the dressed world is a few dozen draw
// calls regardless of how dense it looks.
//
// GroveView.jsx owns the <canvas> and the React lifecycle; this class
// only needs a canvas element, plus one window resize listener.

import * as THREE from "three";
import { DISTRICTS, SPAWN, ISLAND, SOCIAL_SPOTS, MALL_PARK, buildColliders, presenceAnchors } from "./worldLayout.js";
import { PlayerController, CAMERA_DISTANCE } from "../player/PlayerController.js";
import { createAvatar, applyDescriptor, disposeAvatar } from "../../avatar/index.js";
import { createToonGradientMap, createToonMaterial } from "./toon.js";
import { createBlobShadow, DustPuffs, CameraShake, ParticleBurst } from "./effects.js";
import { createPostFX } from "./postfx.js";
import { WorldBuilder } from "./worldBuilder.js";
import { loadEnvAssets } from "./assets.js";
import { BUILDINGS } from "../interiors/interiors.js";
import { InteriorManager } from "../interiors/InteriorManager.js";
import { InteractionSystem, createInteractionRing } from "../interaction/InteractionSystem.js";
import { CarryController } from "../interaction/CarryController.js";
import { createWorldState, subscribe as subscribeWorldState } from "../economy/worldState.js";
import { NPC_BY_ID } from "../story/cast.js";

const FIXED_STEP = 1 / 60;
const MAX_ACCUMULATED = 0.25;

// Golden hour, held all day (Design Bible s9: "golden hour is the
// default; even midday feels gently warm"). The horizon stop IS the fog
// colour so distance fades into sky instead of a mismatched grey band.
const COLORS = {
  skyZenith:  0x5aa8e4,
  skyMid:     0x9fd2ee,
  skyHorizon: 0xf0dcbe,
  sunGlow:    0xffd9a0,
  key:        0xfff0cf,
  fillSky:    0xbfe0f5,
  fillGround: 0xc2a074,
};

export class GroveScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts — see GroveView.jsx for the full wiring.
   */
  constructor(canvas, {
    startPosition, avatarDescriptor, coins,
    onFade, onInteriorChange, onInteractionPrompt, onEconomyChange, onNpcInteract,
  } = {}) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this._accumulator = 0;
    this._disposed = false;
    this._remoteAvatars = new Map();
    this._occluders = [];

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: "high-performance",
    });
    this.renderer.setClearColor(COLORS.skyHorizon, 1);
    this.renderer.shadowMap.enabled = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    // Far enough out that the whole island reads crisply and only the open
    // sea and the far treeline haze — haze for depth, never for hiding.
    this.scene.fog = new THREE.Fog(COLORS.skyHorizon, 170, 430);

    this._worldGroup = new THREE.Group();
    this._worldGroup.name = "world-exterior";
    this.scene.add(this._worldGroup);

    // Long lens: a toy/diorama read rather than a wide action-cam one.
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 700);
    this.camera.position.set(0, 4.2, 6.5);

    this.toonGradientMap = createToonGradientMap();
    this._buildSky();
    this._buildLighting();

    this.colliders = buildColliders();

    // ── Terrain first (synchronous), dressing when the GLBs land ────────
    this.world = new WorldBuilder({
      root: this._worldGroup,
      makeToon: (c, extra) => this.makeToonMaterial(c, extra),
      assets: null,
    });
    this.world.buildTerrain();

    this._plazaColliders = this.colliders.slice();

    const spawn = startPosition ?? SPAWN;
    this.player = new PlayerController({
      camera: this.camera,
      colliders: this.colliders,
      startPosition: spawn,
    });
    this.scene.add(this.player.root);
    this.localAvatar = createAvatar(avatarDescriptor ?? {});
    this.player.root.add(this.localAvatar);
    this._localDescriptorKey = JSON.stringify(avatarDescriptor ?? {});
    this._localBlob = createBlobShadow(0.55, 0.8);
    this.player.root.add(this._localBlob);

    this._dust = new DustPuffs(this.scene, 16);
    this._cameraShake = new CameraShake();
    this._burst = new ParticleBurst(this.scene, 48);
    this._dustTimer = 0;
    this._wasColliding = false;

    // ── Economy, interaction, carry, interiors ─────────────────────────
    this._onEconomyChange = onEconomyChange ?? (() => {});
    this.worldState = createWorldState({ coins });
    this._unsubscribeEconomy = subscribeWorldState(this.worldState, (s) => {
      this._onEconomyChange({ coins: s.coins, coinsProvided: s.coinsProvided, inventory: s.inventory });
    });
    this._onEconomyChange({ coins: this.worldState.coins, coinsProvided: this.worldState.coinsProvided, inventory: this.worldState.inventory });

    this.interactionSystem = new InteractionSystem();
    this._onInteractionPrompt = onInteractionPrompt ?? (() => {});
    this.interactionSystem.onActiveChange((id, prompt) => {
      if (!id || !prompt) { this._onInteractionPrompt(null); return; }
      const pos = this.interactionSystem.getPosition(id);
      this._onInteractionPrompt({ text: prompt, x: pos.x, y: 1.7, z: pos.z });
    });

    this.carry = new CarryController({
      avatar: this.localAvatar,
      getSpeed: () => this.player.velocity.length(),
      playSfx: (name) => this._playSfx?.(name),
    });

    this._onInteriorChange = onInteriorChange ?? (() => {});
    this._onNpcInteract = onNpcInteract ?? (() => {});
    this.interiorManager = new InteriorManager({
      scene: this.scene,
      worldGroup: this._worldGroup,
      player: this.player,
      plazaColliders: this._plazaColliders,
      interactionSystem: this.interactionSystem,
      carry: this.carry,
      worldState: this.worldState,
      playSfx: (name) => this._playSfx?.(name),
      onFadeChange: (opacity) => onFade?.(opacity),
      onEnter: (spec) => this._onInteriorChange({ active: true, id: spec.interior, label: spec.label, npcLabel: spec.npcLabel, metaLabel: spec.metaLabel }),
      onExit: () => {
        this._onInteriorChange({ active: false, id: null, label: null, npcLabel: null });
        this._registerOutdoorInteractions();
      },
      onTalk: (npcId, npcLabel, context) => this._onNpcInteract(npcId, npcLabel, context),
    });

    this._registerOutdoorInteractions();

    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    this._postfx = createPostFX(this.renderer, this.scene, this.camera, 1, 1);
    this.resize();
    this._rafHandle = null;

    // Kick off the authored geometry. The world is already standing
    // (terrain, plates, paths, water) before this resolves, so there is
    // never a grey empty frame — just a world that finishes dressing
    // itself a beat after you arrive.
    this._assetsReady = loadEnvAssets().then((assets) => {
      if (this._disposed) return null;
      this.world.assets = assets;
      this.world.buildFromAssets();
      this._buildNpcStands();
      this.world.flushBlobs();
      this._autoRegisterOccluders();
      this._perf = this.world.stats();
      return assets;
    }).catch((err) => {
      console.warn("[grove] environment assets failed to load", err);
      return null;
    });
  }

  setSfx(sfx) {
    this._playSfx = (name) => sfx?.[name]?.();
  }

  makeToonMaterial(color, extra = {}) {
    return createToonMaterial(this.toonGradientMap, color, extra);
  }

  // ── Sky ───────────────────────────────────────────────────────────────
  _buildSky() {
    // A vertex-coloured dome: three stops (zenith / mid / warm horizon)
    // plus a soft warm bloom low in the key light's direction, so the sky
    // itself says where the sun is without a second light or a texture.
    const radius = 300;
    const geo = new THREE.SphereGeometry(radius, 32, 20);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const zenith = new THREE.Color(COLORS.skyZenith);
    const mid = new THREE.Color(COLORS.skyMid);
    const horizon = new THREE.Color(COLORS.skyHorizon);
    const glow = new THREE.Color(COLORS.sunGlow);
    const sunDir = new THREE.Vector3(-0.55, 0.30, -0.78).normalize();
    const v = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = THREE.MathUtils.clamp(v.y / radius, 0, 1);
      c.copy(horizon).lerp(mid, THREE.MathUtils.smoothstep(t, 0.0, 0.045));
      c.lerp(zenith, THREE.MathUtils.smoothstep(t, 0.04, 0.45));
      const facing = Math.max(0, v.clone().normalize().dot(sunDir));
      c.lerp(glow, Math.pow(facing, 6) * 0.55);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
    }));
    sky.name = "sky-dome";
    sky.renderOrder = -10;
    this._worldGroup.add(sky);

    // A handful of slow, fat clouds — the "breathing world" rule applied
    // to the one part of the frame that is otherwise completely still.
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xfff6e6, transparent: true, opacity: 0.75, fog: false, depthWrite: false });
    const cloudGeo = new THREE.IcosahedronGeometry(1, 1);
    this._clouds = [];
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const m = new THREE.Mesh(cloudGeo, cloudMat);
        m.position.set((j - 1) * 7 + Math.random() * 3, Math.random() * 2, Math.random() * 4);
        const s = 6 + Math.random() * 6;
        m.scale.set(s, s * 0.5, s * 0.8);
        g.add(m);
      }
      const a = (i / 14) * Math.PI * 2;
      const r = 110 + Math.random() * 70;
      g.position.set(Math.sin(a) * r, 42 + Math.random() * 26, Math.cos(a) * r);
      g.rotation.y = -a;
      this._worldGroup.add(g);
      this._clouds.push({ mesh: g, angle: a, radius: r, speed: 0.006 + Math.random() * 0.006, y: g.position.y });
    }
  }

  // ── Lighting rig ───────────────────────────────────────────────────────
  _buildLighting() {
    // One warm golden-hour key, low and raking so every chunky form casts
    // a readable light/shadow split across itself; one large hemisphere
    // fill lifting the shadow side with cool sky above and warm bounced
    // ground below. Never more than two real lights — the rim is a shader
    // term in toon.js, not a third light. No shadow maps: contact is sold
    // by blob decals and baked vertex AO instead.
    const key = new THREE.DirectionalLight(COLORS.key, 1.45);
    key.position.set(-58, 34, -82);
    key.name = "key-sun";
    this._worldGroup.add(key);

    const fill = new THREE.HemisphereLight(COLORS.fillSky, COLORS.fillGround, 0.72);
    this._worldGroup.add(fill);
  }

  // ── NPC stands and outdoor interactions ───────────────────────────────
  /** Every district's resident stands somewhere specific and stays there.
   * A standing figure is a destination; a wandering one is a chore. */
  _buildNpcStands() {
    this._npcMeshes = this._npcMeshes ?? [];
    for (const d of DISTRICTS) {
      if (!d.npc) continue;
      const { id: npcId, homeOffset } = d.npc;
      const x = d.center.x + (homeOffset?.x ?? 0);
      const z = d.center.z + (homeOffset?.z ?? 0);
      if (this._npcMeshes.some((n) => n.npcId === npcId)) continue;
      const mesh = this._buildNpcFigure(npcId, d.accent);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = Math.atan2(-(x - d.center.x), -(z - d.center.z));
      this._worldGroup.add(mesh);
      this._npcMeshes.push({ npcId, mesh, x, z });
    }
  }

  /** A stylised standing resident: chunky body in the district accent, a
   * warm head, ears cut from the species in story/cast.js, and a soft
   * ground decal. Placeholder geometry for a real rigged cast — but
   * silhouette-distinct per species, which is the part that matters for
   * "who is that over there" from across a plaza. */
  _buildNpcFigure(npcId, accentHex) {
    const cast = NPC_BY_ID[npcId];
    const accent = cast?.color ?? accentHex;
    const g = new THREE.Group();
    g.name = `npc:${npcId}`;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.74, 4, 10), this.makeToonMaterial(accent));
    body.position.y = 0.8;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.30, 14, 10), this.makeToonMaterial(cast?.fur ?? 0xe8c8a0));
    head.position.y = 1.52;
    g.add(head);
    const earMat = this.makeToonMaterial(cast?.fur ?? 0xe8c8a0);
    const ear = cast?.ear ?? "round";
    for (const side of [-1, 1]) {
      let m;
      if (ear === "long") m = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 3, 6), earMat);
      else if (ear === "pointed") m = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 6), earMat);
      else if (ear === "crest") m = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.34, 5), earMat);
      else m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), earMat);
      m.position.set(side * (ear === "crest" ? 0.06 : 0.23), 1.76, ear === "crest" ? -0.08 : 0);
      if (ear === "crest") m.rotation.x = -0.5;
      g.add(m);
    }
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), earMat);
    snout.position.set(0, 1.46, 0.26);
    snout.scale.set(0.9, 0.8, 1.3);
    g.add(snout);
    g.add(createBlobShadow(0.55, 0.8));
    return g;
  }

  /** Re-registers every outdoor proximity affordance. Called on first
   * build and again every time leaving an interior clears the system. */
  _registerOutdoorInteractions() {
    if (!this.interactionSystem) return;
    for (const d of DISTRICTS) {
      if (!d.npc) continue;
      const cast = NPC_BY_ID[d.npc.id];
      const label = cast?.name ?? d.npc.id;
      const x = d.center.x + (d.npc.homeOffset?.x ?? 0);
      const z = d.center.z + (d.npc.homeOffset?.z ?? 0);
      this.interactionSystem.register(`outdoor-npc:${d.npc.id}`, {
        position: { x, z },
        radius: 2.4,
        prompt: `Talk to ${label}`,
        onInteract: () => this._onNpcInteract(d.npc.id, label, "greeting"),
      });
    }
    // Seating and gathering spots: sitting down is a real, registered
    // action so being present without doing anything is a thing the world
    // acknowledges (Design Bible s8: passive presence is participation).
    this._seatRings = this._seatRings ?? new Map();
    for (const s of SOCIAL_SPOTS) {
      const label = s.label
        ?? (s.kind === "table" ? "Sit at the table"
          : s.kind === "circle" ? "Join the circle"
          : s.kind === "vista" ? "Sit a while, facing out"
          : "Sit down");
      if (!this._seatRings.has(s.id) && this._worldGroup) {
        const ring = createInteractionRing(0xffe3a8, s.kind === "circle" ? 2.4 : 1.0);
        ring.position.set(s.x, (this.world?.plateY(s.x, s.z) ?? 0) + 0.05, s.z);
        this._worldGroup.add(ring);
        this._seatRings.set(s.id, ring);
      }
      this.interactionSystem.register(`spot:${s.id}`, {
        position: { x: s.x, z: s.z },
        radius: s.kind === "circle" ? 3.0 : 1.7,
        ringMesh: this._seatRings.get(s.id),
        prompt: () => (this._seated === s.id ? "Stand up" : label),
        onInteract: () => this._toggleSeat(s),
      });
    }

    // Canopy Park's optional discovery loop: each petal is readable from
    // the path and harmless to ignore. Finding all three wakes the central
    // bloom chimes with a larger visual response; no currency or progress
    // is gated behind it.
    this._parkDiscoveries = this._parkDiscoveries ?? new Set();
    this._parkRings = this._parkRings ?? new Map();
    for (const discovery of MALL_PARK.discoveries) {
      if (!this._parkRings.has(discovery.id) && this._worldGroup) {
        const ring = createInteractionRing(discovery.color, 0.72);
        ring.position.set(discovery.x, 0.055, discovery.z);
        this._worldGroup.add(ring);
        this._parkRings.set(discovery.id, ring);
      }
      this.interactionSystem.register(`park-petal:${discovery.id}`, {
        position: { x: discovery.x, z: discovery.z },
        radius: 1.55,
        ringMesh: this._parkRings.get(discovery.id),
        bobMesh: this.world?.parkPetals?.get(discovery.id),
        prompt: () => this._parkDiscoveries.has(discovery.id) ? "This petal is glowing" : "Wake the petal",
        onInteract: () => this._wakeParkPetal(discovery),
      });
    }
  }

  _wakeParkPetal(discovery) {
    const alreadyAwake = this._parkDiscoveries.has(discovery.id);
    if (!alreadyAwake) this._parkDiscoveries.add(discovery.id);
    const petal = this.world?.parkPetals?.get(discovery.id);
    if (petal) {
      petal.scale.setScalar(alreadyAwake ? 1.18 : 1.38);
      if (petal.material) petal.material.emissiveIntensity = 0.62;
    }
    this.celebrateAt(discovery.x, 0.9, discovery.z, discovery.color);
    this._playSfx?.(alreadyAwake ? "tap" : "coin");

    if (this._parkDiscoveries.size === MALL_PARK.discoveries.length && !this._parkWonderAwake) {
      this._parkWonderAwake = true;
      if (this.world?.parkHero) {
        this.world.parkHero.scale.multiplyScalar(1.12);
        this.world.parkHero.traverse?.((node) => {
          if (node.material?.emissive) node.material.emissiveIntensity = Math.max(node.material.emissiveIntensity ?? 0, 0.48);
        });
      }
      this.celebrateAt(MALL_PARK.hero.x, 3.6, MALL_PARK.hero.z, 0xffd56b);
      this._playSfx?.("purchase");
    }
  }

  /** Preview-only convenience used by the Canopy Park review route. */
  previewCanopyParkPetal(index) {
    const discovery = MALL_PARK.discoveries[index];
    if (!discovery) return false;
    this._wakeParkPetal(discovery);
    return true;
  }

  /** Review-route camera positions only; normal Grove play keeps the
   * standard production camera profile. */
  previewCanopyParkView(mode = "overview") {
    if (mode === "park") {
      this.player.moveTo(-18, 18.4, 0);
      this.player.setCameraProfile({ distance: 12, height: 4.4, lookTargetY: 1, fov: 46 });
      return true;
    }
    this.player.moveTo(-12, 18.2, 0);
    this.player.setCameraProfile({ distance: 16, height: 5.35, lookTargetY: 1.15, fov: 58 });
    return true;
  }

  /** Exercises the same threshold check used by normal walking. */
  previewParkMallDoorway() {
    const lobby = BUILDINGS.find((building) => building.id === "commons-park-lobby");
    if (!lobby) return Promise.resolve(false);
    this.player.moveTo(lobby.approachPoint.x, lobby.approachPoint.z, 0);
    return Promise.resolve(this.interiorManager.checkTriggers(lobby.approachPoint.x, lobby.approachPoint.z))
      .then(() => this.interiorManager.activeId === lobby.id);
  }

  /** Sitting is entirely cosmetic and entirely reversible: the avatar
   * drops to seat height and faces the spot's facing, and one more press
   * stands back up. Nothing is earned, nothing is lost. */
  _toggleSeat(spot) {
    if (this._seated === spot.id) {
      this._seated = null;
      this.player.root.position.y = 0;
      this.localAvatar.position.y = 0;
      this._playSfx?.("tap");
      return;
    }
    this._seated = spot.id;
    this.player.moveTo?.(spot.x, spot.z);
    this.player.root.position.set(spot.x, 0, spot.z);
    this.player.heading = spot.rotY ?? 0;
    this.player.targetHeading = spot.rotY ?? 0;
    this.localAvatar.position.y = spot.kind === "circle" ? 0 : 0.44;
    this._playSfx?.("tap");
    this.celebrateAt(spot.x, 1.1, spot.z, 0xffe3a8);
  }

  /** Where a remote peer can plausibly be standing in a district — used by
   * GroveView when a peer has no position yet, so the world never has
   * someone standing in a hedge. */
  anchorsFor(districtId) {
    return presenceAnchors(districtId);
  }

  // ── Occlusion fade ─────────────────────────────────────────────────────
  _autoRegisterOccluders() {
    const THRESHOLD = 2.0;
    const box = new THREE.Box3();
    for (const child of this._worldGroup.children) {
      if (child.isInstancedMesh || child.isLight || child.isPoints) continue;
      if (!child.isMesh && !child.isGroup) continue;
      if (child.name === "sky-dome") continue;
      if (!child.name.startsWith("building:") && !child.name.startsWith("landmark:") && !child.name.startsWith("npc:")) continue;
      box.setFromObject(child);
      if (box.isEmpty() || box.max.y - box.min.y < THRESHOLD) continue;
      this._registerOccluder(child);
    }
  }

  _registerOccluder(object3D) {
    if (object3D.userData._occluderRegistered) return;
    object3D.traverse((child) => {
      if (child.isMesh && child.material) {
        const clone = child.material.clone();
        clone.transparent = true;
        clone.userData._occBaseOpacity = child.material.opacity ?? 1;
        child.material = clone;
      }
    });
    object3D.userData._occluderRegistered = true;
    this._occluders.push(object3D);
  }

  _updateOcclusionFade(dt) {
    if (!this._occluders.length || !this.player) return;
    const camPos = this.camera.position;
    const p = this.player.root.position;
    const target = this._occlusionTarget || (this._occlusionTarget = new THREE.Vector3());
    target.set(p.x, this.player._lookTargetY ?? 1.2, p.z);
    const toTarget = target.clone().sub(camPos);
    const dist = toTarget.length();
    if (dist < 0.05) return;
    toTarget.normalize();
    const ray = this._occlusionRay || (this._occlusionRay = new THREE.Raycaster());
    ray.set(camPos, toTarget);
    ray.near = 0.05;
    ray.far = Math.max(0.1, dist - 0.6);
    const hits = ray.intersectObjects(this._occluders, true);
    const hitMeshes = new Set(hits.map((h) => h.object));
    const FADE_FACTOR = 0.5;
    const FADE_RATE = 10;
    for (const occluder of this._occluders) {
      occluder.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const mat = child.material;
        const base = mat.userData._occBaseOpacity ?? 1;
        const desired = hitMeshes.has(child) ? base * FADE_FACTOR : base;
        mat.opacity += (desired - mat.opacity) * Math.min(1, FADE_RATE * dt);
        mat.depthWrite = mat.opacity > base - 0.05;
      });
    }
  }

  // ── Public API used by GroveView ───────────────────────────────────────
  goToDistrict(districtId) {
    const d = DISTRICTS.find((x) => x.id === districtId);
    if (!d || !this.player) return null;
    this._seated = null;
    this.localAvatar.position.y = 0;
    // Arrive from the hub side, facing in: you always walk INTO a
    // district looking at its landmark, never at the back of it.
    const len = Math.hypot(d.center.x, d.center.z) || 1;
    const inward = d.id === "hub"
      ? { x: 0, z: -1 }
      : { x: -d.center.x / len, z: -d.center.z / len };
    this.player.moveTo(
      d.center.x + inward.x * d.radius * 0.72,
      d.center.z + inward.z * d.radius * 0.72,
      Math.atan2(-inward.x, -inward.z),
    );
    return d;
  }

  setLocalDescriptor(descriptor) {
    const key = JSON.stringify(descriptor ?? {});
    if (key === this._localDescriptorKey) return;
    this._localDescriptorKey = key;
    applyDescriptor(this.localAvatar, descriptor ?? {});
  }

  _setGhostMode(avatar, ghost) {
    avatar.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        m.transparent = true;
        m.opacity = ghost ? 0.35 : 1;
        m.needsUpdate = true;
      });
    });
  }

  ensureRemoteAvatar(userId, mode, descriptor) {
    const key = JSON.stringify(descriptor ?? {});
    let entry = this._remoteAvatars.get(userId);
    if (!entry) {
      const avatar = createAvatar(descriptor ?? {});
      const blob = createBlobShadow(0.5, 0.7);
      avatar.add(blob);
      this.scene.add(avatar);
      entry = { avatar, descriptorKey: key, blob };
      this._remoteAvatars.set(userId, entry);
    } else if (key !== entry.descriptorKey) {
      applyDescriptor(entry.avatar, descriptor ?? {});
      entry.descriptorKey = key;
    }
    this._setGhostMode(entry.avatar, mode === "ghost");
    return entry.avatar;
  }

  removeRemoteAvatar(userId) {
    const entry = this._remoteAvatars.get(userId);
    if (!entry) return;
    this.scene.remove(entry.avatar);
    disposeAvatar(entry.avatar);
    this._remoteAvatars.delete(userId);
  }

  pruneRemoteAvatars(activeIds) {
    for (const id of Array.from(this._remoteAvatars.keys())) {
      if (!activeIds.has(id)) this.removeRemoteAvatar(id);
    }
  }

  celebrateAt(x, y, z, color) {
    this._burst.spawnBurst(new THREE.Vector3(x, y, z), color);
  }

  /** Rough, measured-not-guessed frame cost, for the perf budget. */
  perfSnapshot() {
    // Measured, not guessed: render one plain frame straight to the
    // renderer (bypassing the composer, whose own passes would otherwise
    // be the only thing left in the counter) and read the counters back.
    this.renderer.info.autoReset = true;
    this.renderer.render(this.scene, this.camera);
    const info = this.renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      programs: info.programs?.length ?? 0,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      instanced: this._perf ?? null,
    };
  }

  /** Development-only preview entry used by the local Grove review route. */
  enterGroveMallPreview() {
    return this.interiorManager.enterGroveMall();
  }

  exitGroveMallPreview() {
    return this.interiorManager._exit();
  }

  previewGroveMallFloor(floor) {
    const entry = this.interiorManager._cache.get("grove-mall");
    if (!entry) return false;
    entry.setFloor?.(floor - 1);
    this.player.moveTo(0, -13, 0);
    return true;
  }

  // ── Per-frame systems ──────────────────────────────────────────────────
  _updateMall(elapsed, dt) {
    const pos = this.player.getPosition();
    this.interactionSystem.update_frame(pos.x, pos.z, elapsed, dt);
    this.carry.update();
    this.interiorManager.checkTriggers(pos.x, pos.z);
    if (this.player.consumeInteractPress()) {
      if (this.interiorManager.activeId && this.carry.isCarrying) {
        this.interiorManager.placeCarriedHere(pos.x, pos.z);
      } else {
        this.interactionSystem.interact();
      }
    }
    // Any real movement stands you back up: sitting is never a state you
    // can get stuck in.
    if (this._seated && this.player.velocity.lengthSq() > 0.2) {
      this._seated = null;
      this.localAvatar.position.y = 0;
    }
  }

  projectToScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  _animateProps(elapsed) {
    this.world?.update(elapsed);
    if (this._clouds) {
      for (const c of this._clouds) {
        c.angle += c.speed * 0.016;
        c.mesh.position.set(Math.sin(c.angle) * c.radius, c.y, Math.cos(c.angle) * c.radius);
        c.mesh.rotation.y = -c.angle;
      }
    }
    if (this._npcMeshes) {
      // Breathing world: residents rock almost imperceptibly. Nothing here
      // is snappy (Design Bible s5: ease-out, subtlety over spectacle).
      for (let i = 0; i < this._npcMeshes.length; i++) {
        const m = this._npcMeshes[i].mesh;
        m.position.y = Math.sin(elapsed * 1.1 + i * 1.7) * 0.035;
        m.rotation.z = Math.sin(elapsed * 0.7 + i) * 0.012;
      }
    }
  }

  _updateGameFeel(dt) {
    const speed = this.player.velocity.length();
    if (speed > 0.15) {
      this._dustTimer -= dt;
      if (this._dustTimer <= 0) {
        this._dustTimer = THREE.MathUtils.mapLinear(Math.min(speed, 3.2), 0, 3.2, 0.42, 0.22);
        const p = this.player.root.position;
        const behind = this.player.heading + Math.PI;
        this._dust.spawn(p.x + Math.sin(behind) * 0.25, 0.03, p.z + Math.cos(behind) * 0.25);
      }
    } else {
      this._dustTimer = 0;
    }
    this._dust.update(dt);

    const isColliding = this.player.collidedThisStep === true;
    if (isColliding && !this._wasColliding) this._cameraShake.trigger(0.04, 120);
    this._wasColliding = isColliding;
    this.camera.position.add(this._cameraShake.update(dt));
    this._burst.update(dt);
  }

  resize() {
    const parent = this.canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this._postfx?.resize(width, height);
  }

  start({ onFixedStep, onFrame } = {}) {
    const loop = () => {
      if (this._disposed) return;
      this._rafHandle = requestAnimationFrame(loop);

      const frameDt = Math.min(this.clock.getDelta(), MAX_ACCUMULATED);
      this._accumulator += frameDt;
      while (this._accumulator >= FIXED_STEP) {
        this.player.fixedStep(FIXED_STEP);
        if (onFixedStep) onFixedStep(FIXED_STEP, this.player.getPosition());
        this._accumulator -= FIXED_STEP;
      }

      this.player.updateCamera(frameDt);
      this._updateOcclusionFade(frameDt);
      this._animateProps(this.clock.elapsedTime, frameDt);
      this._updateGameFeel(frameDt);
      this._updateMall(this.clock.elapsedTime, frameDt);

      const localAnim = this.localAvatar?.userData.animation;
      if (localAnim) {
        localAnim.setSpeed?.(this.player.velocity.length());
        localAnim.update?.(frameDt);
      }
      for (const entry of this._remoteAvatars.values()) {
        entry.avatar.userData.animation?.update?.(frameDt);
      }

      if (onFrame) onFrame(frameDt);
      if (this._postfx) this._postfx.composer.render();
      else this.renderer.render(this.scene, this.camera);
    };

    this._onVisibilityChange = () => {
      if (document.hidden) {
        if (this._rafHandle) cancelAnimationFrame(this._rafHandle);
        this._rafHandle = null;
      } else if (!this._disposed && this._rafHandle === null) {
        this.clock.getDelta();
        this._rafHandle = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", this._onVisibilityChange);
    this._rafHandle = requestAnimationFrame(loop);
  }

  dispose() {
    this._disposed = true;
    if (this._rafHandle) cancelAnimationFrame(this._rafHandle);
    if (this._onVisibilityChange) document.removeEventListener("visibilitychange", this._onVisibilityChange);
    window.removeEventListener("resize", this._onResize);
    this._unsubscribeEconomy?.();
    this.interiorManager?.dispose();
    this.carry?.dispose();
    this.player.dispose();
    this.localAvatar?.userData.animation?.dispose();
    for (const entry of this._remoteAvatars.values()) entry.avatar.userData.animation?.dispose();
    this._remoteAvatars.clear();
    this._dust?.dispose();
    this._burst?.dispose();
    this._postfx?.dispose();
    this.renderer.dispose();
    this.toonGradientMap.dispose();
    // Kit geometries are module-cached across mounts (see assets.js), so
    // dispose only what this scene actually created.
    this.scene.traverse((obj) => {
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}

export { BUILDINGS };
