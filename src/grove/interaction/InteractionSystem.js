// src/grove/interaction/InteractionSystem.js
//
// Reusable proximity-interaction module — deliberately NOT camera-hover
// raycasting, because raycasting from a fixed screen point doesn't map to
// joystick/WASD movement (there is nothing under the reticle to hit-test
// against when the player never aims a cursor at all). Instead, every
// interactable is a point in world space with a radius; each frame this
// finds the single nearest one the player is inside of and exposes it —
// GroveScene/GroveView key that against keypress or a tap button, and a
// world-anchored prompt/glow so the feedback reads instantly (Animal
// Crossing / Stardew rule: appear within 1-2 frames, fade just as fast).
//
// This module owns no THREE objects itself beyond a couple of reusable
// vectors — it is pure bookkeeping. The bob/glow visuals live on whatever
// mesh the caller registers alongside an interactable (see
// interiors/interiors.js for the pattern), driven by `system.update`'s
// per-id "active" flag and a shared elapsed-time bob helper below.

import * as THREE from "three";

const DEFAULT_RADIUS = 2.2; // ~2 character widths, per the design brief

export class InteractionSystem {
  constructor() {
    this._items = new Map(); // id -> descriptor
    this._activeId = null;
    this._activePrompt = null;
    this._onChange = null;
    this._playerPos = new THREE.Vector3();
  }

  /** Fires whenever the nearest-in-range interactable changes (including
   * becoming null), so the HUD can show/hide a prompt within one frame. */
  onActiveChange(fn) {
    this._onChange = fn;
  }

  /**
   * @param {string} id unique id
   * @param {object} opts
   * @param {{x:number, z:number, y?:number}} opts.position world position
   * @param {number} [opts.radius] proximity radius, world units
   * @param {string|() => string} opts.prompt label shown when in range,
   *   e.g. "Pick up" or "Browse the stall" — may be a function for
   *   dynamic labels (out-of-stock, already-owned, etc).
   * @param {() => void} opts.onInteract fired on keypress/tap while nearest
   * @param {THREE.Object3D} [opts.bobMesh] mesh to apply the idle bob to
   * @param {THREE.Object3D} [opts.ringMesh] glow-ring mesh to brighten
   *   when this interactable is the active one
   */
  register(id, opts) {
    this._items.set(id, {
      id,
      position: opts.position,
      radius: opts.radius ?? DEFAULT_RADIUS,
      prompt: opts.prompt ?? "Interact",
      onInteract: opts.onInteract ?? (() => {}),
      bobMesh: opts.bobMesh ?? null,
      bobPhase: Math.random() * Math.PI * 2,
      bobBaseY: opts.bobMesh ? opts.bobMesh.position.y : 0,
      ringMesh: opts.ringMesh ?? null,
    });
  }

  update(id, patch) {
    const item = this._items.get(id);
    if (!item) return;
    Object.assign(item, patch);
  }

  unregister(id) {
    this._items.delete(id);
    if (this._activeId === id) {
      this._activeId = null;
      this._activePrompt = null;
      this._onChange?.(null, null);
    }
  }

  clear() {
    this._items.clear();
    this._activeId = null;
    this._activePrompt = null;
  }

  get activeId() {
    return this._activeId;
  }

  get activePrompt() {
    return this._activePrompt;
  }

  /** Call once per rendered frame with the player's current world x/z and
   * elapsed time (for the constant idle bob). Resolves the nearest
   * in-range interactable, updates bob/glow visuals, and fires the
   * onActiveChange callback the instant the answer changes. */
  update_frame(playerX, playerZ, elapsed, dt) {
    let bestId = null;
    let bestDist = Infinity;
    for (const item of this._items.values()) {
      const dx = playerX - item.position.x;
      const dz = playerZ - item.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= item.radius && dist < bestDist) {
        bestDist = dist;
        bestId = item.id;
      }
      // Constant idle bob, independent of proximity, so the world reads
      // alive even when nobody is nearby.
      if (item.bobMesh) {
        item.bobMesh.position.y = item.bobBaseY + Math.sin(elapsed * 1.8 + item.bobPhase) * 0.06;
      }
    }

    for (const item of this._items.values()) {
      const isActive = item.id === bestId;
      if (item.ringMesh) {
        const targetOpacity = isActive ? 0.75 : 0.22;
        const mat = item.ringMesh.material;
        mat.opacity += (targetOpacity - mat.opacity) * Math.min(1, dt * 14); // fast, ~1-2 frame settle
      }
    }

    if (bestId !== this._activeId) {
      this._activeId = bestId;
      const item = bestId ? this._items.get(bestId) : null;
      this._activePrompt = item ? (typeof item.prompt === "function" ? item.prompt() : item.prompt) : null;
      this._onChange?.(this._activeId, this._activePrompt);
    } else if (bestId) {
      // Prompt text can change while remaining the same target (e.g. price
      // updates, out-of-stock) — refresh it without re-firing the
      // show/hide transition.
      const item = this._items.get(bestId);
      const label = typeof item.prompt === "function" ? item.prompt() : item.prompt;
      if (label !== this._activePrompt) {
        this._activePrompt = label;
        this._onChange?.(this._activeId, this._activePrompt);
      }
    }
  }

  /** Fires the nearest in-range interactable's action, if any. Returns
   * true if something fired. */
  interact() {
    if (!this._activeId) return false;
    const item = this._items.get(this._activeId);
    if (!item) return false;
    item.onInteract();
    return true;
  }

  getPosition(id) {
    return this._items.get(id)?.position ?? null;
  }
}

/** Shared helper: a soft glow-ring mesh sized to ~2 character widths,
 * flat on the ground, additive-feeling but cheap (MeshBasicMaterial).
 * Starts dim; InteractionSystem brightens it when it becomes the active
 * interactable. */
export function createInteractionRing(color = 0xffe28a, radius = 0.9) {
  const geo = new THREE.RingGeometry(radius * 0.78, radius, 24);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  mesh.renderOrder = -1;
  return mesh;
}
