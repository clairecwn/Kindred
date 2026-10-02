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

const FADE_MS = 380; // within the 300-500ms range the brief asks for
const ENTER_RADIUS = 1.6;

// Kept in step with PlayerController's own defaults, which are framed for
// the GLB avatars (mid-body look target so feet are never cropped).
const OUTDOOR_CAMERA = { distance: 12.0, height: 4.4, lookTargetY: 1.0, fov: 46 };
const INDOOR_CAMERA = { distance: 8.5, height: 5.9, lookTargetY: 1.0, fov: 46 };

export class InteriorManager {
  constructor({ scene, worldGroup, player, plazaColliders, interactionSystem, carry, worldState, playSfx, onFadeChange, onEnter, onExit, onTalk }) {
    this.scene = scene;
    this.worldGroup = worldGroup; // container holding every plaza/exterior object
    this.player = player;
    this.interactionSystem = interactionSystem;
    this.carry = carry;
    this.worldState = worldState;
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
  }

  /** Call once per fixed/rendered step with the player's current world
   * position. Fires an enter or exit exactly once per crossing. */
  checkTriggers(x, z) {
    if (this._transitioning) return;
    if (this.activeId === null) {
      for (const spec of BUILDINGS) {
        const d = Math.hypot(x - spec.approachPoint.x, z - spec.approachPoint.z);
        if (d <= ENTER_RADIUS) {
          return this._enter(spec.id);
        }
      }
    } else {
      const cacheKey = GROVE_MALL_ENTRANCES.has(this.activeId) ? "grove-mall" : this.activeId;
      const entry = this._cache.get(cacheKey);
      const exitTrigger = entry?.exitTrigger ?? ROOM_EXIT_TRIGGER;
      const d = Math.hypot(x - exitTrigger.x, z - exitTrigger.z);
      if (d <= exitTrigger.radius) {
        return this._exit();
      }
    }
    return null;
  }

  async _getOrBuildInterior(spec) {
    const cacheKey = GROVE_MALL_ENTRANCES.has(spec.id) ? "grove-mall" : spec.id;
    let entry = this._cache.get(cacheKey);
    if (!entry) {
      const options = {
        worldState: this.worldState,
        interactionSystem: this.interactionSystem,
        carry: this.carry,
        playSfx: this.playSfx,
        onPurchaseFeedback: (ok, item) => this._lastPurchaseFeedback = { ok, item },
        onTalk: this.onTalk,
        onFloorChange: (floor) => {
          this.player.moveTo(0, -13, 0);
          this.onEnter({ ...spec, label: `The Grove · Level ${floor}`, npcLabel: null, metaLabel: "4 shops open · lift and stairs available" });
        },
      };
      let built;
      if (GROVE_MALL_ENTRANCES.has(spec.id)) {
        try {
          built = await buildGroveMallInterior(options);
        } catch (error) {
          console.warn("[grove] authored mall failed to load; using the existing shop interior", error);
          built = buildInterior(spec, options);
        }
      } else {
        built = buildInterior(spec, options);
      }
      entry = { ...built, spec };
      this._cache.set(cacheKey, entry);
    }
    return entry;
  }

  async _enter(buildingId) {
    const spec = BUILDINGS.find((b) => b.id === buildingId);
    if (!spec || this._transitioning) return;
    this._transitioning = true;
    await this._fadeOut();

    this.worldGroup.visible = false;
    this.interactionSystem.clear();
    const entry = await this._getOrBuildInterior(spec);
    this.scene.add(entry.group);
    entry.activate?.();
    this.player.colliders.length = 0;
    this.player.colliders.push(...entry.colliders);
    // Face INTO the room (+Z, toward the counter), not back out the door.
    const spawn = entry.spawn ?? ROOM_SPAWN;
    this.player.moveTo(spawn.x, spawn.z, 0);
    this.player.setCameraProfile(entry.cameraProfile ?? INDOOR_CAMERA);
    this.activeId = buildingId;
    this.onEnter(GROVE_MALL_ENTRANCES.has(spec.id)
      ? { ...spec, label: "The Grove · Level 1", npcLabel: null, metaLabel: "4 shops open · lift and stairs available" }
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
    if (entry) this.scene.remove(entry.group); // cached, not disposed — cheap re-entry
    this.interactionSystem.clear();
    this.worldGroup.visible = true;
    this.player.colliders.length = 0;
    this.player.colliders.push(...this._plazaColliders);
    // Spawn well past the exterior entry trigger (3x its offset from the
    // door) so stepping back outside never immediately re-triggers entry.
    const outX = spec.returnPoint?.x ?? spec.doorPoint.x + (spec.approachPoint.x - spec.doorPoint.x) * 3;
    const outZ = spec.returnPoint?.z ?? spec.doorPoint.z + (spec.approachPoint.z - spec.doorPoint.z) * 3;
    this.player.moveTo(outX, outZ, spec.returnPoint?.heading ?? this.player.heading);
    this.player.setCameraProfile(OUTDOOR_CAMERA);
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
