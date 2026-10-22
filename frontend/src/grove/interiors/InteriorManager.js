// src/grove/interiors/InteriorManager.js
//
// Owns the exterior-vs-interior swap for the four mall buildings: a plain
// proximity trigger at each exterior door (walk close enough = go in), a
// matching trigger just inside each interior's own door (walk close
// enough = come back out), a 300-500ms fade the scene renders through on
// each swap, and lazy interior instantiation with only the current one
// ever mounted in the scene graph (dispose()d interiors are cached data,
// not GPU resources, until the player leaves them — see below).
//
// This class touches three.js only to add/remove whole groups and to
// hand PlayerController a different collider list; it never builds
// geometry itself (interiors.js does that) and never owns economy state
// (economy/worldState.js does).

import * as THREE from "three";
import { BUILDINGS, buildInterior, ROOM_SPAWN, ROOM_EXIT_TRIGGER } from "./interiors.js";
import { placeObject } from "../economy/worldState.js";
import { buildGroveMallInterior, GROVE_MALL_ENTRANCES } from "./GroveMallInterior.js";

// Shown under the level name: the two things a new player needs to know.
const MALL_HINT = "Arrows walk · A and D turn the view";
const FADE_MS = 380; // within the 300-500ms range the brief asks for
const ENTER_RADIUS = 1.6;

// Kept in step with PlayerController's own defaults, which are framed for
// the GLB avatars (mid-body look target so feet are never cropped).
const OUTDOOR_CAMERA = { distance: 8.5, height: 3.6, lookTargetY: 1.5, fov: 50, maxHeight: 7.5 };

/** A trigger is a rectangle {minX,maxX,minZ,maxZ} or a disc {x,z,radius}. */
function inTrigger(trigger, x, z) {
  if (typeof trigger.minX === "number") {
    return x >= trigger.minX && x <= trigger.maxX && z >= trigger.minZ && z <= trigger.maxZ;
  }
  return Math.hypot(x - trigger.x, z - trigger.z) <= trigger.radius;
}
const INDOOR_CAMERA = { distance: 6.5, height: 3.0, lookTargetY: 1.5, fov: 50 };

export class InteriorManager {
  constructor({ scene, worldGroup, player, plazaColliders, exteriorMallEntrance, exteriorMallReturn, interactionSystem, carry, worldState, showLegacyAffordances = false, playSfx, onFadeChange, onEnter, onExit, onTalk, onMallPresence, onShopBrowse }) {
    // (info | null) => void: the shop the player is standing at, for the shelf list.
    this.onShopBrowse = onShopBrowse ?? (() => {});
    // (inside: boolean) => void. The mall and the park are both always in
    // the world; this says which one the player is in, so the scene can
    // light the right one.
    this.onMallPresence = onMallPresence ?? (() => {});
    this._pending = new Map();      // interiors being built: cacheKey -> promise
    this._exteriorModel = null;
    this._exteriorShared = [];      // the park model's copies of the nodes the mall model also has
    this.scene = scene;
    this.worldGroup = worldGroup; // container holding every plaza/exterior object
    this.player = player;
    this.interactionSystem = interactionSystem;
    this.carry = carry;
    this.worldState = worldState;
    this.showLegacyAffordances = showLegacyAffordances;
    this.playSfx = playSfx ?? (() => {});
    this.onFadeChange = onFadeChange ?? (() => {}); // (opacity:number) => void, drives a CSS fade in GroveView
    this.onEnter = onEnter ?? (() => {});
    this.onExit = onExit ?? (() => {});
    this.onTalk = onTalk ?? (() => {});

    this.activeId = null; // building id, or null when in the plaza
    this._cache = new Map(); // buildingId -> { group, colliders, dispose, addPlacedProp, spec }
    this._transitioning = false;
    // A copy, not the live array `player.colliders` itself — that same
    // array is what gets emptied and refilled on every swap below.
    this._plazaColliders = (plazaColliders ?? player.colliders).slice();
    this._exteriorMallEntrance = exteriorMallEntrance ?? null;
    this._exteriorMallReturn = exteriorMallReturn ?? null;
  }

  setExteriorColliders(colliders, seats = []) {
    this._plazaColliders = (colliders ?? []).slice();
    this._plazaSeats = seats;
  }

  /** Call once per fixed/rendered step with the player's current world
   * position. Fires an enter or exit exactly once per crossing. */
  checkTriggers(x, z) {
    if (this._transitioning) return;
    if (this.activeId === null) {
      if (this._exteriorMallEntrance) {
        return inTrigger(this._exteriorMallEntrance, x, z) ? this.enterGroveMall() : null;
      }
      for (const spec of BUILDINGS) {
        const d = Math.hypot(x - spec.approachPoint.x, z - spec.approachPoint.z);
        if (d <= (spec.entryRadius ?? ENTER_RADIUS)) {
          return this._enter(spec.id);
        }
      }
    } else {
      const cacheKey = GROVE_MALL_ENTRANCES.has(this.activeId) ? "grove-mall" : this.activeId;
      const entry = this._cache.get(cacheKey);
      const exitTrigger = entry?.exitTrigger ?? ROOM_EXIT_TRIGGER;
      if (inTrigger(exitTrigger, x, z) && !entry?.inScene?.()) {
        return this._exit();
      }
    }
    return null;
  }

  /** Per-frame hook for interiors that animate or move the player
   * themselves (the Grove mall's escalators). */
  update(dt) {
    const mall = this._cache.get("grove-mall");
    const inMall = this.activeId !== null && GROVE_MALL_ENTRANCES.has(this.activeId);
    if (!inMall) mall?.idle?.(dt);              // seen from the park, the escalators and fountain still run
    // On an upper level the mall is drawn lowered around the player; the
    // park outside the windows is lowered with it.
    if (mall?.offsetY) this.worldGroup.position.y = inMall ? mall.offsetY() : 0;
    if (this.activeId === null || this._transitioning) return;
    const cacheKey = inMall ? "grove-mall" : this.activeId;
    this._cache.get(cacheKey)?.update?.(dt, this.player);
  }

  /** The park's loaded model: needed to tell which parts of the building
   * the two models share. */
  setExteriorModel(group) {
    this._exteriorModel = group;
    const mall = this._cache.get("grove-mall");
    if (!mall) return;
    // The mall was built first (the player went straight in): pair the two models up now.
    this._linkShared(mall);
    const inMall = this.activeId !== null && GROVE_MALL_ENTRANCES.has(this.activeId);
    for (const node of this._exteriorShared) node.visible = !inMall;
  }

  _linkShared(mall) {
    if (!this._exteriorModel || !mall.markShared || mall._sharedLinked) return;
    const names = new Set();
    this._exteriorModel.traverse((node) => { if (node.name) names.add(node.name); });
    const sharedNames = mall.markShared(names);
    this._exteriorShared = [];
    this._exteriorModel.traverse((node) => { if (sharedNames.has(node.name)) this._exteriorShared.push(node); });
    mall._sharedLinked = true;
  }

  /** Put the mall in the world (once) and say whether the player is in it. */
  _presentMall(mall, inside) {
    this._linkShared(mall);
    if (!mall.group.parent) this.scene.add(mall.group);
    mall.setPresence?.(inside);
    for (const node of this._exteriorShared) node.visible = !inside;
    if (!inside) this.worldGroup.position.y = 0;
    this.onMallPresence(inside);
  }

  /** Load the mall in the background while the player is still in the
   * park, so its inside can be seen through the glass. */
  async preloadMall() {
    const spec = BUILDINGS.find((b) => GROVE_MALL_ENTRANCES.has(b.id));
    if (!spec) return null;
    try {
      const mall = await this._getOrBuildInterior(spec);
      if (this.activeId === null && !this._transitioning) this._presentMall(mall, false);
      return mall;
    } catch (error) {
      console.warn("[grove] mall preload failed", error);
      return null;
    }
  }

  async _getOrBuildInterior(spec) {
    const cacheKey = GROVE_MALL_ENTRANCES.has(spec.id) ? "grove-mall" : spec.id;
    let entry = this._cache.get(cacheKey);
    if (!entry && this._pending.has(cacheKey)) return this._pending.get(cacheKey);
    if (!entry) {
      const options = {
        worldState: this.worldState,
        interactionSystem: this.interactionSystem,
        carry: this.carry,
        showLegacyAffordances: this.showLegacyAffordances,
        playSfx: this.playSfx,
        onPurchaseFeedback: (ok, item) => this._lastPurchaseFeedback = { ok, item },
        onShopBrowse: (info) => this.onShopBrowse(info),
        onTalk: this.onTalk,
        // Shop doors inside the mall use the same fade as the mall's own.
        fade: async (swap) => { await this._fadeOut(); swap(); await this._fadeIn(); },
        onRoomChange: (shop, floor) => {
          this.onEnter({ ...spec, label: shop ? `${shop.label} · Level ${floor}` : `The Grove · Level ${floor}`, npcLabel: null,
            metaLabel: shop ? "Arrows walk · Down takes you back out" : MALL_HINT });
        },
        onFloorChange: (floor, arrival) => {
          // An escalator ride ends exactly where the player already stands,
          // so there is nothing to teleport or re-frame.
          // Each level has its own solid world; hand the player the new one.
          const mall = this._cache.get("grove-mall");
          if (mall && this.activeId !== null) {
            this.player.colliders.length = 0;
            this.player.colliders.push(...mall.colliders);
          }
          this.player.setSeats(mall?.seats?.() ?? []);
          if (!arrival?.seamless) this.player.moveTo(arrival?.x ?? 0, arrival?.z ?? -13, arrival?.heading ?? 0);
          this.onEnter({ ...spec, label: `The Grove · Level ${floor}`, npcLabel: null, metaLabel: MALL_HINT });
        },
      };
      const building = (async () => {
        const built = GROVE_MALL_ENTRANCES.has(spec.id)
          ? await buildGroveMallInterior(options)
          : buildInterior(spec, options);
        const made = { ...built, spec };
        this._cache.set(cacheKey, made);
        return made;
      })();
      this._pending.set(cacheKey, building);
      try { entry = await building; } finally { this._pending.delete(cacheKey); }
    }
    return entry;
  }

  async _enter(buildingId) {
    const spec = BUILDINGS.find((b) => b.id === buildingId);
    if (!spec || this._transitioning) return;
    this._transitioning = true;
    await this._fadeOut();

    const isMall = GROVE_MALL_ENTRANCES.has(spec.id);
    // The park stays in view through the mall's glass; any other interior is a closed room.
    this.worldGroup.visible = isMall;
    this.interactionSystem.clear();
    let entry;
    try {
      entry = await this._getOrBuildInterior(spec);
    } catch (error) {
      console.error("[grove] Grove mall asset load failed", error);
      this.worldGroup.visible = true;
      this.onFadeChange(0);
      this._transitioning = false;
      return;
    }
    if (isMall) this._presentMall(entry, true);
    else {
      this.scene.add(entry.group);
      entry.activate?.();
    }
    this.player.colliders.length = 0;
    this.player.colliders.push(...entry.colliders);
    // Face INTO the room (+Z, toward the counter), not back out the door.
    const spawn = entry.spawn ?? ROOM_SPAWN;
    this.player.setRoom(null);
    this.player.setCameraProfile(entry.cameraProfile ?? INDOOR_CAMERA, { snap: true });
    this.player.setSeats(entry.seats?.() ?? []);
    this.player.moveTo(spawn.x, spawn.z, 0);
    this.activeId = buildingId;
    this.onEnter(GROVE_MALL_ENTRANCES.has(spec.id)
      ? { ...spec, label: "The Grove · Level 1", npcLabel: null, metaLabel: MALL_HINT }
      : spec);

    await this._fadeIn();
    this._transitioning = false;
  }

  async _exit() {
    const spec = BUILDINGS.find((b) => b.id === this.activeId);
    if (!spec || this._transitioning) return;
    this._transitioning = true;
    await this._fadeOut();

    const cacheKey = GROVE_MALL_ENTRANCES.has(this.activeId) ? "grove-mall" : this.activeId;
    const entry = this._cache.get(cacheKey);
    entry?.leaveRoom?.();
    this.player.setRoom(null);
    const isMall = cacheKey === "grove-mall";
    this.interactionSystem.clear();
    if (entry && isMall) this._presentMall(entry, false);   // stays in the world, seen through its glass
    else if (entry) this.scene.remove(entry.group); // cached, not disposed — cheap re-entry
    this.worldGroup.visible = true;
    this.player.colliders.length = 0;
    this.player.colliders.push(...this._plazaColliders);
    // Spawn well past the exterior entry trigger (3x its offset from the
    // door) so stepping back outside never immediately re-triggers entry.
    const returnPoint = GROVE_MALL_ENTRANCES.has(spec.id) && this._exteriorMallReturn
      ? this._exteriorMallReturn
      : spec.returnPoint;
    const outX = returnPoint?.x ?? spec.doorPoint.x + (spec.approachPoint.x - spec.doorPoint.x) * 3;
    const outZ = returnPoint?.z ?? spec.doorPoint.z + (spec.approachPoint.z - spec.doorPoint.z) * 3;
    this.player.setCameraProfile(OUTDOOR_CAMERA, { snap: true });
    this.player.setSeats(this._plazaSeats ?? []);
    // Step out facing the park, with the camera behind.
    this.player.moveTo(outX, outZ, Math.PI);
    this.activeId = null;
    this.onExit(spec);

    await this._fadeIn();
    this._transitioning = false;
  }

  /** Places whatever the carry controller is currently holding at the
   * player's own position inside the active interior, clamped to the
   * floor. No-op outdoors or with empty hands. */
  placeCarriedHere(playerX, playerZ) {
    if (!this.activeId || !this.carry.isCarrying) return false;
    const cacheKey = GROVE_MALL_ENTRANCES.has(this.activeId) ? "grove-mall" : this.activeId;
    const entry = this._cache.get(cacheKey);
    if (!entry) return false;
    const halfW = (entry.roomHalfWidth ?? 7.0) - 0.9;
    const halfD = (entry.roomHalfDepth ?? 7.0) - 0.9;
    const x = THREE.MathUtils.clamp(playerX, -halfW, halfW);
    const z = THREE.MathUtils.clamp(playerZ, -halfD, halfD - 1.6); // keep clear of the counter
    const dropped = this.carry.place();
    if (!dropped) return false;
    const id = `${dropped.itemId}-${Math.round(performance.now())}`;
    placeObject(this.worldState, this.activeId, { id, itemId: dropped.itemId, x, z });
    entry.addPlacedProp({ id, itemId: dropped.itemId, x, z });
    return true;
  }

  /** A click on the shelf list: point that shop at that item. */
  selectShopItem(shopId, index) {
    this._cache.get("grove-mall")?.selectShopItem?.(shopId, index);
  }

  get lastPurchaseFeedback() {
    const fb = this._lastPurchaseFeedback;
    this._lastPurchaseFeedback = null;
    return fb ?? null;
  }

  /** Enters the authored Grove mall through its primary Commons doorway. */
  enterGroveMall() {
    return this._enter("commons-pantry");
  }

  _fadeOut() {
    this.onFadeChange(1);
    return wait(FADE_MS / 2);
  }

  _fadeIn() {
    this.onFadeChange(0);
    return wait(FADE_MS / 2);
  }

  dispose() {
    for (const entry of this._cache.values()) {
      this.scene.remove(entry.group);
      entry.dispose();
    }
    this._cache.clear();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
