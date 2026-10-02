/**
 * AnimationController.js — animation state machine over a single
 * THREE.AnimationMixer for a Grove 3D avatar (CHARACTER-BIBLE.md
 * section 6), plus two lightweight per-frame effects that don't need a
 * full keyframe clip: irregular eye blinking and ear secondary-motion
 * lag (ears/head visually trail the body's rotation a little, section 1's
 * "secondary motion" note).
 *
 * v1 ships procedural clips (clips.js) for the bible's minimum set
 * (breathing idle w/ 10 emotion variants + 2 species-unique idles, walk,
 * run, wave, the sit sequence, and two social emotes). Every clip is
 * reached only through registerClip()/name lookups, never referenced
 * directly by callers, so a later Blender-baked GLB's AnimationClip[]
 * can replace any procedural clip one name at a time (useBakedClips)
 * without any caller of play()/setEmotion()/etc. changing at all.
 */

import * as THREE from "three";
import { buildAllProceduralClips, ONE_SHOT_CLIP_NAMES, idleClipName } from "./clips.js";
import { speciesUniqueIdle, speciesSeed } from "./species.js";

export const EMOTE_CLIPS = Object.freeze(["Wave", "Clap", "Cheer"]);
const LOOPING_EMOTES = new Set(["Clap"]);

const EMOTION_SPEED = Object.freeze({
  excited: 1.55, happy: 1.2, anxious: 1.3, angry: 1.2,
  sad: 0.55, tired: 0.48, calm: 0.88, neutral: 1.0, content: 0.92, grateful: 1.1,
});

const CROSSFADE_SECONDS = 0.28;

// Blink timing: irregular interval so a room of avatars never blinks in
// lockstep, plus a fast close/open so it never looks like the eyes are
// just going flat.
const BLINK_MIN_INTERVAL = 2.2;
const BLINK_MAX_INTERVAL = 6.0;
const BLINK_DURATION = 0.12;

// Ear secondary-motion lag: how quickly the ear pivot catches up to the
// head's current rotation. Lower = floatier/laggier.
const EAR_LAG_RATE = 10;

// Squash-and-stretch (section 7): landing squashes wide/short, a jump
// takeoff stretches tall/narrow — the classic ~1.1x/0.9x split — then a
// single lerp relaxes the scale back to neutral over this many seconds.
const SQUASH_LAND_SCALE = Object.freeze({ x: 1.1, y: 0.9, z: 1.1 });
const SQUASH_JUMP_SCALE = Object.freeze({ x: 0.9, y: 1.1, z: 0.9 });
const SQUASH_RECOVER_SECONDS = 0.22;

export class AnimationController {
  /**
   * @param {THREE.Object3D} root  the avatar's Root group (bones live under it)
   * @param {string} [species]
   * @param {Object} [parts]  optional visual-only refs for per-frame effects
   * @param {THREE.Mesh[]} [parts.eyeMeshes]  flat [white,pupil,white,pupil] pairs
   * @param {THREE.Object3D[]} [parts.earPivots]  ear pivot nodes to lag
   * @param {THREE.Bone} [parts.headBone]
   */
  constructor(root, species = "bear", parts = {}) {
    this.root = root;
    this.species = species;
    this.mixer = new THREE.AnimationMixer(root);
    this.clipMap = {};
    const seed = speciesSeed(species);
    for (const clip of Object.values(buildAllProceduralClips(species, seed))) {
      this.registerClip(clip.name, clip);
    }

    this.currentAction = null;
    this.currentClipName = null;
    this.currentLayer = "locomotion"; // "locomotion" | "emote"
    this._emoteIsLoop = false;

    this._emotion = "neutral";
    this._speed = 0;
    this._sitting = false;
    this._dirty = true;

    // ── Blinking ──
    this._eyeMeshes = parts.eyeMeshes ?? [];
    this._blinkTimer = BLINK_MIN_INTERVAL + Math.random() * (BLINK_MAX_INTERVAL - BLINK_MIN_INTERVAL);
    this._blinkPhase = 0; // 0 = open, >0 counts down through the blink
    this._eyeBaseScaleY = this._eyeMeshes.map((m) => m.scale.y);

    // ── Ear secondary motion ──
    this._earPivots = parts.earPivots ?? [];
    this._earBaseQuat = this._earPivots.map(() => new THREE.Quaternion());
    this._earLagQuat = this._earPivots.map(() => new THREE.Quaternion());
    this._headBone = parts.headBone ?? null;
    this._prevHeadQuat = this._headBone ? this._headBone.quaternion.clone() : null;

    // ── Squash and stretch (section 7) ──
    // A single lerp on the whole-character scale, applied to Root (never
    // keyframed by any procedural clip, so it can't fight the mixer):
    // instantly snap to a squashed/stretched pose, then relax back to
    // (1,1,1) over SQUASH_RECOVER_SECONDS.
    this._squashActive = false;
    this._squashOnes = new THREE.Vector3(1, 1, 1);

    this._applyPendingState();
  }

  /**
   * Register (or override) one named clip. This is the seam a baked-GLB
   * import uses to swap a procedural clip for a real one without any
   * other method on this class changing behaviour.
   */
  registerClip(name, clip) {
    this.clipMap[name] = clip;
  }

  /** Bulk-replace clips by name from an externally loaded clip array. */
  useBakedClips(clips) {
    for (const clip of clips ?? []) this.registerClip(clip.name, clip);
  }

  setEmotion(emotion) {
    if (!(emotion in EMOTION_SPEED)) return;
    if (this._emotion === emotion) return;
    this._emotion = emotion;
    this._dirty = true;
  }

  setSpeed(speed, { walkThreshold = 0.05, runThreshold = 3.0 } = {}) {
    const clamped = Math.max(0, speed);
    this._walkThreshold = walkThreshold;
    this._runThreshold = runThreshold;
    if (this._speed === clamped) return;
    this._speed = clamped;
    this._dirty = true;
  }

  setSitting(sitting) {
    if (this._sitting === sitting) return;
    this._sitting = sitting;
    this._dirty = true;
  }

  /** Call the instant a jump/fall lands — squashes wide and short, then relaxes (section 7). */
  triggerLandSquash() {
    this.root.scale.set(SQUASH_LAND_SCALE.x, SQUASH_LAND_SCALE.y, SQUASH_LAND_SCALE.z);
    this._squashActive = true;
  }

  /** Call the instant a jump takes off — stretches tall and narrow, then relaxes (section 7). */
  triggerJumpStretch() {
    this.root.scale.set(SQUASH_JUMP_SCALE.x, SQUASH_JUMP_SCALE.y, SQUASH_JUMP_SCALE.z);
    this._squashActive = true;
  }

  /** Advance the squash/stretch relax-to-neutral lerp by dt seconds. */
  _updateSquash(dt) {
    if (!this._squashActive) return;
    const rate = Math.min(1, dt / SQUASH_RECOVER_SECONDS);
    this.root.scale.lerp(this._squashOnes, rate);
    if (Math.abs(this.root.scale.x - 1) < 0.002 && Math.abs(this.root.scale.y - 1) < 0.002) {
      this.root.scale.copy(this._squashOnes);
      this._squashActive = false;
    }
  }

  /** Trigger a named clip directly, bypassing the locomotion resolver. */
  play(name, { loop = false, crossfade = CROSSFADE_SECONDS, layer = "emote" } = {}) {
    const clip = this.clipMap[name];
    if (!clip) return false;
    const action = this.mixer.clipAction(clip);
    if (loop) {
      action.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    action.reset();
    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.crossFadeTo(action, crossfade, true);
    }
    action.play();
    this.currentAction = action;
    this.currentClipName = name;
    this.currentLayer = layer;
    this._emoteIsLoop = layer === "emote" && loop;
    return true;
  }

  /** Trigger one of the social-ladder emotes (section 6 emote layer). */
  playEmote(name) {
    if (!EMOTE_CLIPS.includes(name)) return false;
    return this.play(name, { loop: LOOPING_EMOTES.has(name), layer: "emote" });
  }

  stopEmote() {
    if (this.currentLayer !== "emote") return;
    this.currentLayer = "locomotion";
    this._dirty = true;
  }

  _resolveLocomotionClip() {
    if (this._sitting) return this.clipMap["Sit_Idle"] ? "Sit_Idle" : idleClipName(this._emotion);
    if (this._speed > (this._runThreshold ?? 3.0) && this.clipMap["Run"]) return "Run";
    if (this._speed > (this._walkThreshold ?? 0.05) && this.clipMap["Walk"]) return "Walk";
    const unique = speciesUniqueIdle(this.species, this._emotion);
    if (unique && this.clipMap[unique]) return unique;
    const name = idleClipName(this._emotion);
    return this.clipMap[name] ? name : "Idle_Neutral";
  }

  /** Advance blink state by dt, driving the tracked eye meshes' Y scale. */
  _updateBlink(dt) {
    if (!this._eyeMeshes.length) return;
    if (this._blinkPhase > 0) {
      this._blinkPhase -= dt;
      // Triangle envelope: closes over the first half, opens over the
      // second half of BLINK_DURATION.
      const t = 1 - Math.max(0, this._blinkPhase) / BLINK_DURATION;
      const closeness = t < 0.5 ? t * 2 : (1 - t) * 2; // 0..1..0
      const scaleFactor = 1 - closeness * 0.92;
      this._eyeMeshes.forEach((m, i) => { m.scale.y = this._eyeBaseScaleY[i] * scaleFactor; });
      if (this._blinkPhase <= 0) {
        this._eyeMeshes.forEach((m, i) => { m.scale.y = this._eyeBaseScaleY[i]; });
        this._blinkTimer = BLINK_MIN_INTERVAL + Math.random() * (BLINK_MAX_INTERVAL - BLINK_MIN_INTERVAL);
      }
      return;
    }
    this._blinkTimer -= dt;
    if (this._blinkTimer <= 0) this._blinkPhase = BLINK_DURATION;
  }

  /** Ears lag a little behind the head's rotation each frame. */
  _updateEarLag(dt) {
    if (!this._earPivots.length || !this._headBone) return;
    // How much the head rotated this frame drives how far the ears get
    // dragged behind, then they spring back toward resting.
    const target = new THREE.Quaternion();
    const lerpAmt = Math.min(1, EAR_LAG_RATE * dt);
    this._earPivots.forEach((pivot, i) => {
      // Ears rest at identity local rotation and get nudged opposite the
      // head's angular delta, then relax back — a cheap spring, not a
      // full physics sim, but enough to read as trailing motion.
      const delta = this._prevHeadQuat.clone().invert().multiply(this._headBone.quaternion);
      const euler = new THREE.Euler().setFromQuaternion(delta);
      const drag = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-euler.x * 0.6, -euler.y * 0.6, -euler.z * 0.6)
      );
      target.copy(drag);
      pivot.quaternion.slerp(target, lerpAmt);
    });
    this._prevHeadQuat.copy(this._headBone.quaternion);
  }

  /** Advance the state machine and mixer. Call once per frame with dt seconds. */
  update(dt) {
    if (this._dirty) {
      this._applyPendingState();
      this._dirty = false;
    }

    if (
      this.currentLayer === "emote" &&
      !this._emoteIsLoop &&
      this.currentAction &&
      this.currentAction.time >= this.currentAction.getClip().duration - 0.05
    ) {
      this.currentLayer = "locomotion";
      this._applyPendingState();
    }

    if (this.currentAction && this.currentLayer === "locomotion") {
      this.currentAction.timeScale = EMOTION_SPEED[this._emotion] ?? 1.0;
    }
    this.mixer.update(dt);
    this._updateBlink(dt);
    this._updateEarLag(dt);
    this._updateSquash(dt);
  }

  _applyPendingState() {
    if (this.currentLayer === "emote") return;
    const targetName = this._resolveLocomotionClip();
    if (targetName === this.currentClipName) return;
    const loop = !ONE_SHOT_CLIP_NAMES.includes(targetName);
    this.play(targetName, { loop, layer: "locomotion" });
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}
