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
import { DISTRICTS, SOCIAL_SPOTS, MALL_PARK, presenceAnchors } from "./worldLayout.js";
import { PlayerController, MAX_SPEED } from "../player/PlayerController.js";
import { loadGroveCollision } from "../player/collisionGrid.js";
import { createAvatar, applyDescriptor, disposeAvatar } from "../../avatar/index.js";
import { createToonGradientMap, createToonMaterial } from "./toon.js";
import { createBlobShadow, DustPuffs, CameraShake, ParticleBurst } from "./effects.js";
import { createPostFX } from "./postfx.js";
import { createWaterFlow } from "./water.js";
import { BUILDINGS } from "../interiors/interiors.js";
import { InteriorManager } from "../interiors/InteriorManager.js";
import { InteractionSystem, createInteractionRing } from "../interaction/InteractionSystem.js";
import { CarryController } from "../interaction/CarryController.js";
import { createWorldState, subscribe as subscribeWorldState } from "../economy/worldState.js";
import { NPC_BY_ID } from "../story/cast.js";
import {
  GROVE_EXTERIOR_ENTRANCE,
  GROVE_EXTERIOR_RETURN,
  GROVE_EXTERIOR_SPAWN,
  loadGroveExterior,
} from "./GroveExterior.js";

const FIXED_STEP = 1 / 60;
// A stalled frame should never replay a quarter-second of held movement in
// one visible burst after asset loading or a browser tab regain.
const MAX_ACCUMULATED = 0.1;
// Upper bound on rendered pixels per frame (about 2560 x 1600).
const MAX_RENDER_PIXELS = 4_100_000;

// Golden hour, held all day (Design Bible s9: "golden hour is the
// default; even midday feels gently warm"). The horizon stop IS the fog
// colour so distance fades into sky instead of a mismatched grey band.
const COLORS = {
  skyZenith:  0x2f8fe8,
  skyMid:     0x7cc4f5,
  skyHorizon: 0xd6eefc,
  sunGlow:    0xfff3cf,
  key:        0xfffaf0,
  fillSky:    0xeaf4ff,
  fillGround: 0xd8d2c4,
};

// Lighting follows the Mario rule: a near-white key and a bright, faintly
// cool fill, so a surface in the light shows its own authored colour and a
// surface in shade is the same hue a step darker. Warm-tinted lights and a
// filmic tone curve are what made the Grove read yellow and washed out.
// three.js divides a light's intensity by pi for matte surfaces, hence the
// size of these numbers: lit faces land at about 1.0x their colour.
export const GROVE_LIGHT = Object.freeze({ key: 1.9, fill: 1.75 });
const OCCLUDER_MAX_SPAN = 12.5;   // metres: wider than a shopfront is not one thing
const OCCLUDER_HOLD = 0.35;       // seconds something stays faded after it stops being in the way

// Animation pacing for the shared cast clips (see _updateLocalAnimation).
const RUN_FROM = MAX_SPEED * 0.55;
const WALK_FROM = 0.25;
const JUMP_CLIP_TAKEOFF = 0.5;   // seconds into the jump clip where the feet leave
const JUMP_CLIP_RATE = 1.6;      // the clip's long hang time squeezed to the real jump
// Height of the seat the sit_chair clip was posed on, measured from the
// seated mesh: the avatar is raised or lowered by the difference so it
// rests on whatever seat it is given.
const SIT_CLIP_SEAT = 0.2;

export class GroveScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts — see GroveView.jsx for the full wiring.
   */
  constructor(canvas, {
    startPosition, avatarDescriptor, coins, localUserId, showLegacyAffordances = false,
    onFade, onInteriorChange, onInteractionPrompt, onEconomyChange, onNpcInteract, onShopBrowse,
  } = {}) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this._accumulator = 0;
    this._disposed = false;
    this._remoteAvatars = new Map();
    this._localUserId = localUserId ?? null;
    this._occluders = [];
    this._showLegacyAffordances = showLegacyAffordances;

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: "high-performance",
    });
    this.renderer.setClearColor(COLORS.skyHorizon, 1);
    this.renderer.shadowMap.enabled = false;
    // Neutral keeps authored colours as they are and only eases off the
    // very brightest highlights. ACES (the previous setting) is a film
    // curve: it desaturates and lifts everything toward a pale yellow-grey.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    // Far enough out that the whole island reads crisply and only the open
    // sea and the far treeline haze — haze for depth, never for hiding.
    this.scene.fog = new THREE.Fog(COLORS.skyHorizon, 170, 430);

    this._worldGroup = new THREE.Group();
    this._worldGroup.name = "world-exterior";
    this.scene.add(this._worldGroup);

    // Long lens: a toy/diorama read rather than a wide action-cam one.
    // The near plane is as far out as the closest the camera ever comes to
    // anything. Depth precision is spent between near and far, so a near
    // plane twice as far away halves the shimmer where two surfaces lie
    // millimetres apart (floor insets, signs on boards) across the mall.
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.2, 700);
    this.camera.position.set(0, 4.2, 6.5);

    this.toonGradientMap = createToonGradientMap();
    this._buildSky();
    this._buildLighting();

    this.colliders = [];

    this._plazaColliders = this.colliders.slice();

    const spawn = startPosition ?? GROVE_EXTERIOR_SPAWN;
    this.player = new PlayerController({
      camera: this.camera,
      colliders: this.colliders,
      startPosition: spawn,
    });
    // Snap the camera to the authored spawn before the first rendered
    // frame. Otherwise it eases from the generic constructor camera and
    // briefly passes through the avatar while the exterior GLB loads.
    this.player.moveTo(spawn.x, spawn.z, spawn.heading ?? 0);
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
      exteriorMallEntrance: GROVE_EXTERIOR_ENTRANCE,
      exteriorMallReturn: GROVE_EXTERIOR_RETURN,
      showLegacyAffordances: this._showLegacyAffordances,
      playSfx: (name) => this._playSfx?.(name),
      onFadeChange: (opacity) => onFade?.(opacity),
      onEnter: (spec) => {
        const interior = this.scene.getObjectByName("interior:grove-mall");
        if (interior) this._autoRegisterOccluders(interior);
        this._onInteriorChange({ active: true, id: spec.interior, label: spec.label, npcLabel: spec.npcLabel, metaLabel: spec.metaLabel });
      },
      onExit: () => {
        this._onInteriorChange({ active: false, id: null, label: null, npcLabel: null, metaLabel: null });
      },
      onTalk: (npcId, npcLabel, context) => this._onNpcInteract(npcId, npcLabel, context),
      onShopBrowse: (info) => onShopBrowse?.(info),
      // Inside the mall its own lights do the work; the sun and sky fill
      // are for the park. Both models are always in view of each other, so
      // only one set of lights may be on at a time.
      onMallPresence: (inside) => {
        for (const light of this._outdoorLights ?? []) light.visible = !inside;
      },
    });

    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    // The app's stage is scaled with a CSS transform, which changes how big
    // the canvas is on screen without firing a window resize.
    if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(canvas.parentElement);
    }
    this._postfx = createPostFX(this.renderer, this.scene, this.camera, 1, 1);
    this.resize();
    this._bindLookDrag();
    this._rafHandle = null;

    // The normal game uses exactly the approved Blender mall-and-park
    // export. The old procedural island is intentionally not constructed.
    this._assetsReady = Promise.all([loadGroveExterior(), loadGroveCollision()]).then(([exterior, collision]) => {
      if (this._disposed) return null;
      this._worldGroup.add(exterior.group);
      // The baked grid knows every hedge, bench, lamp and planter in the
      // park. Without it, fall back to the plain boundary boxes.
      const park = collision?.park;
      const colliders = park ? [park.grid] : exterior.colliders;
      const seats = park?.seats ?? [];
      this._plazaColliders = colliders.slice();
      this.interiorManager.setExteriorColliders(this._plazaColliders, seats);
      if (this.interiorManager.activeId === null) {
        this.colliders.length = 0;
        this.colliders.push(...colliders);
        this.player.setSeats(seats);
        this.player.moveTo(this.player.root.position.x, this.player.root.position.z, this.player.heading);
      }
      this._autoRegisterOccluders();
      this._water = createWaterFlow(exterior.group);   // the park fountain
      // From the park the mall's shops and atrium show through its glass:
      // bring the inside in now, in the background.
      this.interiorManager.setExteriorModel(exterior.group);
      this.interiorManager.preloadMall().then((mall) => { if (mall && !this._disposed) this._autoRegisterOccluders(mall.group); });
      this._perf = exterior.stats;
      return exterior;
    }).catch((err) => {
      console.warn("[grove] authored mall-and-park exterior failed to load", err);
      return null;
    });
  }

  /** Dragging across the scene turns the view, for a look around without
   * walking. The camera still settles behind the player once they move. */
  _bindLookDrag() {
    const canvas = this.canvas;
    let active = null, lastX = 0;
    const down = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      active = e.pointerId;
      lastX = e.clientX;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (active !== e.pointerId) return;
      this.player.lookBy(e.clientX - lastX);
      lastX = e.clientX;
    };
    const up = (e) => {
      if (active !== e.pointerId) return;
      active = null;
      canvas.releasePointerCapture?.(e.pointerId);
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    this._unbindLookDrag = () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
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
    const key = new THREE.DirectionalLight(COLORS.key, GROVE_LIGHT.key);
    key.position.set(-40, 70, -60);
    key.name = "key-sun";
    this._worldGroup.add(key);

    const fill = new THREE.HemisphereLight(COLORS.fillSky, COLORS.fillGround, GROVE_LIGHT.fill);
    this._worldGroup.add(fill);
    this._outdoorLights = [key, fill];
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
      if (this._showLegacyAffordances && !this._seatRings.has(s.id) && this._worldGroup) {
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
      if (this._showLegacyAffordances && !this._parkRings.has(discovery.id) && this._worldGroup) {
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
      this.player.moveTo(-10.5, -39.5, 0);
      return true;
    }
    this.player.moveTo(0, -44, 0);
    return true;
  }

  /** Exercises the same threshold check used by normal walking. */
  previewParkMallDoorway() {
    this.player.moveTo(GROVE_EXTERIOR_ENTRANCE.x, GROVE_EXTERIOR_ENTRANCE.z, 0);
    return Promise.resolve(this.interiorManager.checkTriggers(GROVE_EXTERIOR_ENTRANCE.x, GROVE_EXTERIOR_ENTRANCE.z))
      .then(() => this.interiorManager.activeId !== null);
  }

  /** Sitting is entirely cosmetic and entirely reversible: the avatar
   * drops to seat height and faces the spot's facing, and one more press
   * stands back up. Nothing is earned, nothing is lost. */
  _toggleSeat(spot) {
    if (this._seated === spot.id) {
      this._seated = null;
      this.player.root.position.y = 0;
      this._playSfx?.("tap");
      return;
    }
    this._seated = spot.id;
    this.player.moveTo?.(spot.x, spot.z);
    this.player.root.position.set(spot.x, 0, spot.z);
    this.player.heading = spot.rotY ?? 0;
    this.player.targetHeading = spot.rotY ?? 0;
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
  // Walls never come between the camera and the player: the camera arm
  // shortens instead (PlayerController.updateCamera). What can still pass
  // in front are the slim or overhead things the arm ignores on purpose,
  // so it does not lurch every time one goes by: columns, tree crowns,
  // awnings and the like. Those fade while they are in the way.
  _autoRegisterOccluders(root = this._worldGroup) {
    // Slim or overhead things the camera looks past, and (M_) the shop
    // fixtures, which the fixed view inside a shop looks over: a tall unit
    // between that view and the player goes see-through.
    const slim = /(column|pilaster|canopy|awning|tree|totem|kiosk|lamp|planter|entrance.*(?:arch|pier|bloom)|bunting|pendant|^M_)/i;
    const box = new THREE.Box3();
    root.traverse((child) => {
      // The parts of a multi-material object are named after its mesh
      // ("GK_Bush"), so the object's own name is checked as well.
      const owner = child.parent?.isGroup ? child.parent.name : "";
      if (!child.isMesh || child.isInstancedMesh || !(slim.test(child.name) || slim.test(owner))) return;
      // Sized as the whole object when it is one of several parts (a tree's
      // crown bands are each short, the tree is not).
      const whole = child.parent?.isGroup && child.parent.children.length <= 10 && child.parent.children.every((c) => c.isMesh);
      box.setFromObject(whole ? child.parent : child);
      if (box.isEmpty() || box.max.y - box.min.y < 0.7) return;
      // One object that is really many things spread about (every pendant
      // and string of bunting in the atrium, say) is left solid: fading it
      // because one corner of it is in the way would blink the whole lot.
      if (Math.max(box.max.x - box.min.x, box.max.z - box.min.z) > OCCLUDER_MAX_SPAN) return;
      this._registerOccluder(child);
    });
  }

  _registerOccluder(mesh) {
    if (mesh.userData._occluderRegistered || !mesh.material || Array.isArray(mesh.material)) return;
    const clone = mesh.material.clone();
    clone.userData._occBaseOpacity = mesh.material.opacity ?? 1;
    clone.userData._occBaseTransparent = mesh.material.transparent === true;
    mesh.material = clone;
    mesh.userData._occluderRegistered = true;
    // A model object with several materials arrives as a group of meshes,
    // one per material. They are one thing and fade as one: fading only the
    // part the sight line happens to cross (the white of a sign but not its
    // colours) reads as the object breaking up.
    const parent = mesh.parent;
    const parts = parent && parent.isGroup && parent.name && parent.children.length > 1 && parent.children.length <= 10   // one object's materials, not a whole model
      && parent.children.every((sibling) => sibling.isMesh && !sibling.children.length);
    mesh.userData._occKey = parts ? parent.uuid : mesh.uuid;
    this._occluders.push(mesh);
  }

  _updateOcclusionFade(dt) {
    if (!this._occluders.length || !this.player) return;
    const camPos = this.camera.position;
    const target = this._occlusionTarget || (this._occlusionTarget = new THREE.Vector3());
    const toTarget = this._occlusionDir || (this._occlusionDir = new THREE.Vector3());
    const ray = this._occlusionRay || (this._occlusionRay = new THREE.Raycaster());
    const visible = this._occluders.filter((mesh) => {
      for (let node = mesh; node; node = node.parent) if (!node.visible) return false;
      return true;
    });
    const now = (this._occlusionClock = (this._occlusionClock ?? 0) + dt);
    const held = this._occlusionHeld || (this._occlusionHeld = new Map());   // key -> time it was last in the way
    // The character, not wherever the view happens to be aimed (which on a
    // ride or walking towards the camera is somewhere else): one sight line
    // to the head and one to the middle of the body, so a tree crown over
    // the head or a counter in front of the legs both count.
    for (const height of [1.45, 0.75]) {
      target.copy(this.player.root.position);
      target.y += height;
      toTarget.copy(target).sub(camPos);
      const dist = toTarget.length();
      if (dist < 0.05) continue;
      toTarget.divideScalar(dist);
      ray.set(camPos, toTarget);
      ray.near = 0.05;
      // Through the character's own eyes nothing is "in the way": what is
      // ahead is simply what they are looking at.
      ray.far = this.player.firstPerson ? 0.06 : Math.max(0.1, dist - 0.45);
      for (const hit of ray.intersectObjects(visible, false)) held.set(hit.object.userData._occKey, now);
    }
    const FADE_TO = 0.12;
    const FADE_RATE = 9;
    for (const mesh of this._occluders) {
      const mat = mesh.material;
      const base = mat.userData._occBaseOpacity ?? 1;
      // Stay faded for a moment after the sight line clears, so something
      // the line is only grazing does not flicker in and out.
      const last = held.get(mesh.userData._occKey);
      const inTheWay = last !== undefined && now - last < OCCLUDER_HOLD;
      const desired = inTheWay ? base * FADE_TO : base;
      if (Math.abs(mat.opacity - desired) < 0.004) {
        mat.opacity = desired;
      } else {
        mat.opacity += (desired - mat.opacity) * Math.min(1, FADE_RATE * dt);
      }
      // Only see-through while actually faded: a permanently transparent
      // wall sorts wrongly against everything behind it.
      const faded = mat.opacity < base - 0.004;
      const transparent = faded || mat.userData._occBaseTransparent;
      if (mat.transparent !== transparent) {
        mat.transparent = transparent;
        mat.needsUpdate = true;
      }
      mat.depthWrite = !faded;
    }
  }

  // ── Public API used by GroveView ───────────────────────────────────────
  goToDistrict(districtId) {
    const d = DISTRICTS.find((x) => x.id === districtId);
    if (!d || !this.player) return null;
    this._seated = null;
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
    if (!userId || userId === this._localUserId) return this.localAvatar;
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
    entry.setFloor?.(floor - 1, { x: 0, z: -13, heading: 0 });
    return true;
  }

  // ── Per-frame systems ──────────────────────────────────────────────────
  _updateMall(elapsed, dt) {
    const pos = this.player.getPosition();
    this.interactionSystem.update_frame(pos.x, pos.z, elapsed, dt);
    this.carry.update();
    this.interiorManager.checkTriggers(pos.x, pos.z);
    this.interiorManager.update(dt);
    if (this.player.consumeInteractPress()) {
      if (this.interiorManager.activeId && this.carry.isCarrying && !this.interactionSystem.activeId) {
        this.interiorManager.placeCarriedHere(pos.x, pos.z);
      } else {
        this.interactionSystem.interact();
      }
    }
    // Q: the second choice where there is one (the lift's other floor, the stairs down).
    if (this.player.consumeAltPress()) this.interactionSystem.interactAlt();
    // Any real movement stands you back up: sitting is never a state you
    // can get stuck in.
    if (this._seated && this.player.velocity.lengthSq() > 0.2) {
      this._seated = null;
    }
  }

  /** A click on the shelf list in the HUD. */
  selectShopItem(shopId, index) {
    this.interiorManager.selectShopItem(shopId, index);
  }

  projectToScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  _animateProps(elapsed, dt = 0.016) {
    this.world?.update(elapsed);
    if (this._worldGroup?.visible) this._water?.update(dt);
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
    // No puffs behind the feet while walking (round 8: they read as a trail
    // following the character). Only the contact shadow goes with them; a
    // single puff still marks landing from a jump.
    this._dust.update(dt);

    // Ordinary wall contact should feel like a smooth slide, not a camera
    // impact. The old shake made navigation around furniture look glitchy.
    this._wasColliding = this.player.collidedThisStep === true;
    this.camera.position.add(this._cameraShake.update(dt));
    this._burst.update(dt);

    // The contact shadow stays on the floor and tightens while airborne,
    // which is what makes a jump read as height rather than a hover.
    const lift = this.player.airHeight;
    this._localBlob.position.y = 0.02 - lift;
    this._localBlob.scale.setScalar(1 - 0.4 * Math.min(1, lift / 1.2));
    if (this.player.consumeLanding()) {
      const p = this.player.root.position;
      this._dust.spawn(p.x, 0.03, p.z);
    }
  }

  /**
   * The character must never block the view. When the camera has had to
   * come in close (a wall behind the player, a tight corner of a shop) the
   * avatar turns see-through, and in the first-person view it is hidden
   * altogether, so what is ahead is always visible.
   */
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
    this._localBlob.visible = true;
  }

  /**
   * Picks the cast clip that matches what the player is doing and keeps
   * its pace in step with the real ground speed, so feet neither skate nor
   * mark time: idle, walk, run, the jump (started at its take-off frame so
   * Space answers at once), and the two sitting poses.
   */
  _updateLocalAnimation(dt) {
    const avatar = this.localAvatar;
    const anim = avatar?.userData.animation;
    if (!anim?.actions) return;            // the model is still loading
    if (this._animOwner !== anim) {        // first frame, or the avatar was rebuilt
      this._animOwner = anim;
      this._avatarOpacity = 1;           // fresh materials start solid
      this._animState = "idle";
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
      if (action && state === "jump") {
        action.time = JUMP_CLIP_TAKEOFF;
        action.timeScale = JUMP_CLIP_RATE;
      }
      this._animState = state;
    }
    const action = anim.actions.get(state);
    if (action && state === "run") action.timeScale = 0.9 + 1.0 * Math.min(1, speed / MAX_SPEED);
    if (action && state === "walk") action.timeScale = 1.0 + 1.2 * Math.min(1, speed / RUN_FROM);
    anim.update(dt);

    // Seated: bring the pose down (or up) onto the seat it was given.
    const seatLift = player.sitting?.kind === "chair" ? player.sitting.y - SIT_CLIP_SEAT : 0;
    const rate = Math.min(1, 14 * dt);
    avatar.position.y += (seatLift - avatar.position.y) * rate;
  }

  resize() {
    const parent = this.canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;
    // The app lays itself out on a fixed 1280-wide stage and scales that
    // up with CSS to fill the window (hooks/useStageScale.js). clientWidth
    // is the stage size, not the size on screen, so rendering at that size
    // gets stretched: big soft pixels and stair-stepped edges. Measure the
    // canvas as actually shown and render that many real pixels (capped so
    // very large or 4K windows stay smooth).
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
      this._updateAvatarFade(frameDt);
      this._animateProps(this.clock.elapsedTime, frameDt);
      this._updateGameFeel(frameDt);
      this._updateMall(this.clock.elapsedTime, frameDt);

      this._updateLocalAnimation(frameDt);
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
    this._resizeObserver?.disconnect();
    this._unbindLookDrag?.();
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
