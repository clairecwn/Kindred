// src/grove/interaction/CarryController.js
//
// Pick up / carry / place for world objects, built entirely on top of the
// existing avatar clip set (src/avatar/clips.js ABILITIES.carry:
// Pick_Up, Carry_Idle, Carry_Walk, Place) and AnimationController.play().
// A carried item is parented onto the avatar's right-hand socket so it is
// *visibly* attached — per the brief, a visible carry beats any inventory
// counter — and follows every walk/idle animation for free.
//
// AnimationController's own locomotion resolver (see
// _resolveLocomotionClip in src/avatar/AnimationController.js) has no idea
// carrying exists, so this controller drives the carry clips through the
// controller's "emote" layer, which the resolver leaves alone for as long
// as the current action is a *looping* one (see AnimationController.play/
// _applyPendingState). That gives us a stable "carry channel" the normal
// walk/idle state machine never fights with, and stopEmote() cleanly hands
// control back the moment the item is placed.

import * as THREE from "three";
import { buildDisplayMesh } from "../interiors/props.js";

const PICK_UP_MS = 450;
const PLACE_MS = 400;
const WALK_SPEED_THRESHOLD = 0.4;

export class CarryController {
  /**
   * @param {object} opts
   * @param {THREE.Object3D} opts.avatar the local avatar group (has
   *   userData.animation and userData.getSocket, see src/avatar/index.js)
   * @param {() => number} opts.getSpeed current player speed, m/s
   * @param {(sound:string) => void} [opts.playSfx]
   */
  constructor({ avatar, getSpeed, playSfx }) {
    this.avatar = avatar;
    this.getSpeed = getSpeed;
    this.playSfx = playSfx ?? (() => {});
    this.carrying = null; // { itemId, label, shape, mesh }
    this._busyUntil = 0;
    this._carryLoopName = null;
  }

  get isCarrying() {
    return !!this.carrying;
  }

  get isBusy() {
    return performance.now() < this._busyUntil;
  }

  /** Begin carrying a catalog-shaped item. Plays Pick_Up, then attaches a
   * small display mesh to the hand socket and switches to the looping
   * Carry_Idle/Carry_Walk channel. `onSettled` fires once the item is
   * actually visible in hand (used to time SFX/UI). */
  pickUp({ itemId, label, shape }, onSettled) {
    if (this.isCarrying || this.isBusy) return false;
    const anim = this.avatar?.userData?.animation;
    anim?.play?.("Pick_Up", { loop: false, layer: "emote" });
    this.playSfx("tap");
    this._busyUntil = performance.now() + PICK_UP_MS;
    setTimeout(() => {
      const socket = this.avatar?.userData?.getSocket?.("SOCKET_hand_R");
      const mesh = buildDisplayMesh(shape, 0.55);
      mesh.position.set(0, 0.05, 0.05);
      (socket ?? this.avatar).add(mesh);
      this.carrying = { itemId, label, shape, mesh };
      this._carryLoopName = "Carry_Idle";
      anim?.play?.("Carry_Idle", { loop: true, layer: "emote" });
      onSettled?.();
    }, PICK_UP_MS);
    return true;
  }

  /** Call once per rendered frame while carrying, so the carry channel
   * switches between the idle/walk carry clips as the player actually
   * moves — the same speed signal GroveScene already feeds the normal
   * locomotion animation with. */
  update() {
    if (!this.carrying || this.isBusy) return;
    const anim = this.avatar?.userData?.animation;
    if (!anim) return;
    const speed = this.getSpeed();
    const wantWalk = speed > WALK_SPEED_THRESHOLD;
    const wantName = wantWalk ? "Carry_Walk" : "Carry_Idle";
    if (wantName !== this._carryLoopName) {
      this._carryLoopName = wantName;
      anim.play(wantName, { loop: true, layer: "emote", crossfade: 0.15 });
    }
  }

  /** Put the carried item down at a world position. Plays Place, detaches
   * the hand mesh, and hands animation control back to normal locomotion.
   * Returns the dropped item's descriptor (for the caller to record in
   * worldState.placeObject), or null if nothing was being carried. */
  place(onSettled) {
    if (!this.carrying || this.isBusy) return null;
    const dropped = this.carrying;
    const anim = this.avatar?.userData?.animation;
    anim?.play?.("Place", { loop: false, layer: "emote" });
    this.playSfx("place");
    this._busyUntil = performance.now() + PLACE_MS;
    this.carrying = null;
    this._carryLoopName = null;
    setTimeout(() => {
      dropped.mesh.parent?.remove(dropped.mesh);
      dropped.mesh.geometry?.dispose?.();
      if (dropped.mesh.material) {
        (Array.isArray(dropped.mesh.material) ? dropped.mesh.material : [dropped.mesh.material])
          .forEach((m) => m.dispose());
      }
      anim?.stopEmote?.();
      onSettled?.();
    }, PLACE_MS);
    return dropped;
  }

  dispose() {
    if (this.carrying?.mesh) {
      this.carrying.mesh.parent?.remove(this.carrying.mesh);
    }
    this.carrying = null;
  }
}
