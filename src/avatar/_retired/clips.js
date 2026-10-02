/**
 * clips.js — procedural animation clips for the Grove avatar rig
 * (CHARACTER-BIBLE.md section 6). Generates real THREE.AnimationClip
 * objects (quaternion/position/scale keyframe tracks per bone) from small
 * sinusoidal pose descriptions, so the avatar animates with zero baked
 * assets. AnimationController.js consumes these through the same
 * clip-name API a future baked-glTF clip set would use — see
 * AnimationController.registerClip() — so procedural clips can be
 * replaced one at a time later without touching any calling code.
 *
 * v1 covers the bible's minimum viable set: breathing idle (with a light
 * per-emotion posture/amplitude variant, plus a per-species asymmetric
 * tilt so a room full of avatars doesn't read as identical mannequins),
 * walk, run, wave, the sit sequence, and two social emotes (clap, cheer).
 * Walk/run also carry a squash-and-stretch body bob (position + scale
 * tracks on the torso), not rotation alone. Species-unique idle poses
 * (otter stand, hedgehog curl) are included since they gate directly off
 * archetype id with no extra machinery.
 */

import * as THREE from "three";
import { BONE_LIST, BONE_REST } from "./skeleton.js";

const DEG = Math.PI / 180;

function eulerQuat(x = 0, y = 0, z = 0) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
}

/**
 * Build one AnimationClip from a list of per-bone sinusoidal modulations.
 * @param {string} name
 * @param {number} duration seconds
 * @param {Array<{bone:string, track?:'quat'|'pos'|'scale', axis:'x'|'y'|'z', amp:number, freq?:number, phase?:number, base?:number}>} mods
 * @param {number} [sampleCount]
 */
export function buildProceduralClip(name, duration, mods, sampleCount = 12) {
  const tracks = [];
  const byBoneTrack = new Map();
  for (const m of mods) {
    const kind = m.track ?? "quat";
    const key = `${m.bone}::${kind}`;
    if (!byBoneTrack.has(key)) byBoneTrack.set(key, { bone: m.bone, kind, mods: [] });
    byBoneTrack.get(key).mods.push(m);
  }
  for (const { bone, kind, mods: boneMods } of byBoneTrack.values()) {
    const times = [];
    const values = [];
    for (let i = 0; i <= sampleCount; i += 1) {
      const t = (i / sampleCount) * duration;
      times.push(t);
      let vx = 0, vy = 0, vz = 1; // scale defaults to 1, pos/rot default to 0
      if (kind === "scale") vz = 1;
      let ex = 0, ey = 0, ez = 0;
      // Position tracks are authored as OFFSETS from the bone's rest
      // position, not as absolute coordinates. Seeding px/py/pz from the
      // rest pose is what stops a "Hips bobs 1.4cm" walk track from also
      // teleporting the hips to the world origin and collapsing the
      // character into the floor — the bug that made every walking and
      // idling avatar sink through its own legs.
      const rest = BONE_REST[bone] ?? [0, 0, 0];
      let px = rest[0], py = rest[1], pz = rest[2];
      let sx = 1, sy = 1, sz = 1;
      for (const m of boneMods) {
        const freq = m.freq ?? 1;
        const phase = m.phase ?? 0;
        const base = m.base ?? (kind === "scale" ? 1 : 0);
        const v = base + m.amp * Math.sin((2 * Math.PI * freq * t) / duration + phase);
        if (kind === "scale") {
          if (m.axis === "x") sx = v; else if (m.axis === "y") sy = v; else sz = v;
        } else if (kind === "pos") {
          if (m.axis === "x") px = rest[0] + v;
          else if (m.axis === "y") py = rest[1] + v;
          else pz = rest[2] + v;
        } else {
          if (m.axis === "x") ex += v; else if (m.axis === "y") ey += v; else ez += v;
        }
      }
      if (kind === "scale") {
        values.push(sx, sy, sz);
      } else if (kind === "pos") {
        values.push(px, py, pz);
      } else {
        const q = eulerQuat(ex, ey, ez);
        values.push(q.x, q.y, q.z, q.w);
      }
    }
    if (kind === "scale") tracks.push(new THREE.VectorKeyframeTrack(`${bone}.scale`, times, values));
    else if (kind === "pos") tracks.push(new THREE.VectorKeyframeTrack(`${bone}.position`, times, values));
    else tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }
  return new THREE.AnimationClip(name, duration, tracks);
}

// ── Idle breathing (with per-emotion posture, section 3) ────────────────
const IDLE_EMOTION_PROFILE = {
  neutral: { amp: 1.0, speed: 1.0, chinTilt: 0, headDroop: 0 },
  happy: { amp: 1.15, speed: 1.05, chinTilt: 3 * DEG, headDroop: 0 },
  excited: { amp: 1.6, speed: 1.6, chinTilt: 4 * DEG, headDroop: 0 },
  calm: { amp: 0.7, speed: 0.7, chinTilt: 0, headDroop: 0 },
  content: { amp: 0.85, speed: 0.8, chinTilt: 1 * DEG, headDroop: 0 },
  grateful: { amp: 0.9, speed: 0.9, chinTilt: 0, headDroop: -4 * DEG },
  sad: { amp: 0.55, speed: 0.55, chinTilt: 0, headDroop: 10 * DEG },
  tired: { amp: 0.45, speed: 0.48, chinTilt: 0, headDroop: 14 * DEG },
  anxious: { amp: 1.3, speed: 1.3, chinTilt: 0, headDroop: 4 * DEG },
  angry: { amp: 1.1, speed: 1.2, chinTilt: -3 * DEG, headDroop: -2 * DEG },
};

export function idleClipName(emotion) {
  const key = emotion in IDLE_EMOTION_PROFILE ? emotion : "neutral";
  return `Idle_${key[0].toUpperCase()}${key.slice(1)}`;
}

/**
 * @param {string} emotion
 * @param {number} [bounceScale]
 * @param {number} [seed] 0..7 per-species seed (species.js's speciesSeed),
 *   used only to bake a small constant asymmetric tilt so idle avatars
 *   never look like identical mannequins standing at attention.
 */
export function buildIdleClip(emotion, bounceScale = 1, seed = 0) {
  const p = IDLE_EMOTION_PROFILE[emotion] ?? IDLE_EMOTION_PROFILE.neutral;
  const duration = 3.2 / p.speed;
  const amp = p.amp * bounceScale;
  // Deterministic per-species asymmetry (section 6 — "perfectly symmetric
  // primitives read as dead"): a real head tilt at rest (roll, not just
  // yaw), a weight shift onto one hip, and an uneven shoulder/hip line,
  // pushed to a size that actually reads at a glance rather than a
  // barely-there nudge.
  const hipTiltZ = (((seed % 4) - 1.5) / 1.5) * 4 * DEG;
  const headYaw = (((seed % 3) - 1) / 1) * 5 * DEG;
  const headTiltZ = (((seed % 5) - 2) / 2) * 6 * DEG;
  const weightShiftX = (((seed % 5) - 2) / 2) * 0.024;
  return buildProceduralClip(idleClipName(emotion), duration, [
    { bone: "Hips", axis: "z", amp: 0, base: hipTiltZ },
    { bone: "Hips", axis: "x", amp: 0, base: weightShiftX, track: "pos" },
    { bone: "Head", axis: "y", amp: 1.2 * DEG * amp, freq: 0.5, base: headYaw },
    { bone: "Head", axis: "z", amp: 0.8 * DEG * amp, freq: 0.5, phase: 0.6, base: headTiltZ },
    { bone: "Spine_01", axis: "x", amp: 2.5 * DEG * amp, freq: 1 },
    { bone: "Spine_02", axis: "x", amp: 2 * DEG * amp, freq: 1, base: p.chinTilt },
    // Gentle breathing squash on the chest — real inflate/deflate, not
    // just a rotation, per the "squash and stretch" bible note.
    { bone: "Spine_02", axis: "y", amp: 0.022 * amp, freq: 1, base: 1, track: "scale" },
    { bone: "Spine_02", axis: "x", amp: -0.012 * amp, freq: 1, base: 1, track: "scale" },
    { bone: "Spine_02", axis: "z", amp: -0.012 * amp, freq: 1, base: 1, track: "scale" },
    { bone: "Head", axis: "x", amp: 1.5 * DEG * amp, freq: 1, phase: 0.4, base: p.headDroop },
    { bone: "Shoulder_L", axis: "z", amp: 1.5 * DEG * amp, freq: 1 },
    { bone: "Shoulder_R", axis: "z", amp: -1.5 * DEG * amp, freq: 1 },
    { bone: "Tail_01", axis: "y", amp: 4 * DEG * amp, freq: 0.7 },
    { bone: "Tail_02", axis: "y", amp: 6 * DEG * amp, freq: 0.7, phase: 0.5 },
  ]);
}

/** Otter's unique meerkat-style stand-and-look idle (section 2). */
export function buildOtterStandClip() {
  return buildProceduralClip("Idle_Standalone_Otter", 3.5, [
    { bone: "Hips", axis: "x", amp: 2 * DEG, base: -10 * DEG },
    { bone: "Spine_01", axis: "x", amp: 2 * DEG, base: 15 * DEG },
    { bone: "Head", axis: "y", amp: 20 * DEG, freq: 0.6 },
    { bone: "UpperArm_L", axis: "z", amp: 3 * DEG, base: 60 * DEG },
    { bone: "UpperArm_R", axis: "z", amp: 3 * DEG, base: -60 * DEG },
  ]);
}

/** Hedgehog's non-punitive curl pose for sad/anxious only (section 2). */
export function buildHedgehogCurlClip() {
  return buildProceduralClip("Idle_Curl_Hedgehog", 4.0, [
    { bone: "Spine_01", axis: "x", amp: 1 * DEG, base: 35 * DEG },
    { bone: "Spine_02", axis: "x", amp: 1 * DEG, base: 30 * DEG },
    { bone: "Neck", axis: "x", amp: 1 * DEG, base: 25 * DEG },
    { bone: "Head", axis: "x", amp: 2 * DEG, base: 20 * DEG, freq: 0.3 },
    { bone: "Thigh_L", axis: "x", amp: 0, base: -30 * DEG },
    { bone: "Thigh_R", axis: "x", amp: 0, base: -30 * DEG },
  ]);
}

// ── Locomotion ────────────────────────────────────────────────────────
export function buildWalkClip() {
  const d = 0.8;
  return buildProceduralClip("Walk", d, [
    { bone: "Thigh_L", axis: "x", amp: 28 * DEG, freq: 1 },
    { bone: "Thigh_R", axis: "x", amp: 28 * DEG, freq: 1, phase: Math.PI },
    { bone: "Shin_L", axis: "x", amp: 22 * DEG, freq: 1, phase: Math.PI * 0.5, base: 12 * DEG },
    { bone: "Shin_R", axis: "x", amp: 22 * DEG, freq: 1, phase: Math.PI * 1.5, base: 12 * DEG },
    { bone: "UpperArm_L", axis: "x", amp: 22 * DEG, freq: 1, phase: Math.PI },
    { bone: "UpperArm_R", axis: "x", amp: 22 * DEG, freq: 1 },
    { bone: "Spine_01", axis: "y", amp: 4 * DEG, freq: 1 },
    { bone: "Spine_01", axis: "z", amp: 3 * DEG, freq: 1, phase: Math.PI / 2 },
    { bone: "Hips", axis: "y", amp: 3 * DEG, freq: 2 },
    { bone: "Hips", axis: "z", amp: 0.02, freq: 1 },
    // Vertical body bob + squash-and-stretch: the torso dips and widens
    // slightly on each footfall (2x step frequency) instead of only
    // rotating, which is what makes a walk cycle read as "alive".
    { bone: "Hips", axis: "y", amp: 0.014, freq: 2, phase: Math.PI / 2, track: "pos" },
    { bone: "Spine_02", axis: "y", amp: 0.05, freq: 2, phase: Math.PI / 2, base: 1, track: "scale" },
    { bone: "Spine_02", axis: "x", amp: -0.03, freq: 2, phase: Math.PI / 2, base: 1, track: "scale" },
    { bone: "Spine_02", axis: "z", amp: -0.03, freq: 2, phase: Math.PI / 2, base: 1, track: "scale" },
    { bone: "Tail_01", axis: "y", amp: 8 * DEG, freq: 1 },
  ]);
}

export function buildRunClip() {
  const d = 0.45;
  return buildProceduralClip("Run", d, [
    { bone: "Thigh_L", axis: "x", amp: 42 * DEG, freq: 1 },
    { bone: "Thigh_R", axis: "x", amp: 42 * DEG, freq: 1, phase: Math.PI },
    { bone: "Shin_L", axis: "x", amp: 40 * DEG, freq: 1, phase: Math.PI * 0.5, base: 22 * DEG },
    { bone: "Shin_R", axis: "x", amp: 40 * DEG, freq: 1, phase: Math.PI * 1.5, base: 22 * DEG },
    { bone: "UpperArm_L", axis: "x", amp: 34 * DEG, freq: 1, phase: Math.PI },
    { bone: "UpperArm_R", axis: "x", amp: 34 * DEG, freq: 1 },
    { bone: "Spine_01", axis: "x", amp: 6 * DEG, freq: 2, base: 8 * DEG },
    { bone: "Hips", axis: "y", amp: 6 * DEG, freq: 2 },
    { bone: "Hips", axis: "y", amp: 0.026, freq: 2, phase: Math.PI / 2, track: "pos" },
    { bone: "Spine_02", axis: "y", amp: 0.08, freq: 2, phase: Math.PI / 2, base: 1, track: "scale" },
    { bone: "Spine_02", axis: "x", amp: -0.05, freq: 2, phase: Math.PI / 2, base: 1, track: "scale" },
    { bone: "Spine_02", axis: "z", amp: -0.05, freq: 2, phase: Math.PI / 2, base: 1, track: "scale" },
    { bone: "Tail_01", axis: "y", amp: 14 * DEG, freq: 2 },
  ]);
}

// ── Wave (one-shot, reused across emotion states per section 6) ────────
export function buildWaveClip() {
  return buildProceduralClip("Wave", 1.5, [
    { bone: "UpperArm_R", axis: "z", amp: 10 * DEG, freq: 2, base: -110 * DEG },
    { bone: "LowerArm_R", axis: "z", amp: 20 * DEG, freq: 2, base: -20 * DEG },
    { bone: "Hand_R", axis: "z", amp: 15 * DEG, freq: 2 },
    { bone: "Head", axis: "y", amp: 6 * DEG, freq: 1 },
  ], 16);
}

// ── Sit sequence ──────────────────────────────────────────────────────
export function buildSitDownClip() {
  return buildProceduralClip("Sit_Down", 0.65, [
    { bone: "Hips", axis: "x", amp: 0, base: -8 * DEG },
    { bone: "Thigh_L", axis: "x", amp: 0, base: -75 * DEG },
    { bone: "Thigh_R", axis: "x", amp: 0, base: -75 * DEG },
    { bone: "Shin_L", axis: "x", amp: 0, base: 85 * DEG },
    { bone: "Shin_R", axis: "x", amp: 0, base: 85 * DEG },
    { bone: "Spine_01", axis: "x", amp: 0, base: 6 * DEG },
  ], 6);
}

export function buildSitIdleClip() {
  return buildProceduralClip("Sit_Idle", 3.3, [
    { bone: "Hips", axis: "x", amp: 0.5 * DEG, base: -8 * DEG },
    { bone: "Thigh_L", axis: "x", amp: 0.5 * DEG, base: -75 * DEG },
    { bone: "Thigh_R", axis: "x", amp: 0.5 * DEG, base: -75 * DEG },
    { bone: "Shin_L", axis: "x", amp: 0.5 * DEG, base: 85 * DEG },
    { bone: "Shin_R", axis: "x", amp: 0.5 * DEG, base: 85 * DEG },
    { bone: "Spine_01", axis: "x", amp: 2 * DEG, base: 6 * DEG, freq: 1 },
    { bone: "Head", axis: "x", amp: 1.5 * DEG, freq: 1, phase: 0.5 },
  ]);
}

export function buildStandUpClip() {
  const down = buildSitDownClip();
  return THREE.AnimationClip.parse(
    Object.assign(THREE.AnimationClip.toJSON(down), { name: "Stand_Up" })
  );
}

// ── Emotes ───────────────────────────────────────────────────────────
export function buildClapClip() {
  return buildProceduralClip("Clap", 0.6, [
    { bone: "UpperArm_L", axis: "z", amp: 12 * DEG, freq: 2, base: 70 * DEG },
    { bone: "UpperArm_R", axis: "z", amp: 12 * DEG, freq: 2, base: -70 * DEG },
    { bone: "LowerArm_L", axis: "y", amp: 20 * DEG, freq: 2, base: 30 * DEG },
    { bone: "LowerArm_R", axis: "y", amp: -20 * DEG, freq: 2, base: -30 * DEG },
  ], 12);
}

export function buildCheerClip() {
  return buildProceduralClip("Cheer", 1.6, [
    { bone: "UpperArm_L", axis: "z", amp: 8 * DEG, freq: 1, base: 150 * DEG },
    { bone: "UpperArm_R", axis: "z", amp: 8 * DEG, freq: 1, base: -150 * DEG },
    { bone: "Hips", axis: "x", amp: 4 * DEG, freq: 2 },
    { bone: "Spine_01", axis: "x", amp: 3 * DEG, freq: 2, base: -4 * DEG },
    { bone: "Head", axis: "x", amp: 3 * DEG, freq: 2, base: -6 * DEG },
  ], 16);
}


// ── Additional ability clips ──────────────────────────────────────────
// The set below covers the verbs a player actually reaches for in a social
// world game: moving through space, picking things up and carrying them,
// and the handful of expressive actions people use to talk without chat.
// All procedural, all replaceable by baked clips through the same names.

/** Crouch, reach down, and come back up. Drives the 200-500ms world response. */
export function buildPickUpClip() {
  return buildProceduralClip("Pick_Up", 0.75, [
    { bone: "Hips", axis: "y", amp: -0.10, freq: 0.5, phase: -Math.PI / 2, track: "pos" },
    { bone: "Thigh_L", axis: "x", amp: 26 * DEG, freq: 0.5, phase: -Math.PI / 2 },
    { bone: "Thigh_R", axis: "x", amp: 26 * DEG, freq: 0.5, phase: -Math.PI / 2 },
    { bone: "Shin_L", axis: "x", amp: -30 * DEG, freq: 0.5, phase: -Math.PI / 2 },
    { bone: "Shin_R", axis: "x", amp: -30 * DEG, freq: 0.5, phase: -Math.PI / 2 },
    { bone: "Spine_01", axis: "x", amp: 22 * DEG, freq: 0.5, phase: -Math.PI / 2 },
    { bone: "UpperArm_L", axis: "x", amp: 46 * DEG, freq: 0.5, phase: -Math.PI / 2 },
    { bone: "UpperArm_R", axis: "x", amp: 46 * DEG, freq: 0.5, phase: -Math.PI / 2 },
    { bone: "Head", axis: "x", amp: 16 * DEG, freq: 0.5, phase: -Math.PI / 2 },
  ], 20);
}

/** Held pose while carrying: arms forward, slight backward lean for the weight. */
export function buildCarryIdleClip() {
  return buildProceduralClip("Carry_Idle", 3.0, [
    { bone: "UpperArm_L", axis: "x", amp: 1.5 * DEG, base: 62 * DEG },
    { bone: "UpperArm_R", axis: "x", amp: 1.5 * DEG, base: 62 * DEG },
    { bone: "LowerArm_L", axis: "x", amp: 1 * DEG, base: 34 * DEG },
    { bone: "LowerArm_R", axis: "x", amp: 1 * DEG, base: 34 * DEG },
    { bone: "Spine_01", axis: "x", amp: 1 * DEG, base: -7 * DEG },
    { bone: "Spine_02", axis: "y", amp: 0.012, base: 1, track: "scale" },
  ]);
}

/** Walk with the carry arm pose held, so carrying reads while moving. */
export function buildCarryWalkClip() {
  return buildProceduralClip("Carry_Walk", 0.8, [
    { bone: "Thigh_L", axis: "x", amp: 24 * DEG, freq: 1 },
    { bone: "Thigh_R", axis: "x", amp: 24 * DEG, freq: 1, phase: Math.PI },
    { bone: "Shin_L", axis: "x", amp: 20 * DEG, freq: 1, phase: Math.PI * 0.5, base: 12 * DEG },
    { bone: "Shin_R", axis: "x", amp: 20 * DEG, freq: 1, phase: Math.PI * 1.5, base: 12 * DEG },
    { bone: "UpperArm_L", axis: "x", amp: 3 * DEG, freq: 1, base: 62 * DEG },
    { bone: "UpperArm_R", axis: "x", amp: 3 * DEG, freq: 1, base: 62 * DEG },
    { bone: "LowerArm_L", axis: "x", amp: 2 * DEG, freq: 1, base: 34 * DEG },
    { bone: "LowerArm_R", axis: "x", amp: 2 * DEG, freq: 1, base: 34 * DEG },
    { bone: "Spine_01", axis: "x", amp: 2 * DEG, freq: 1, base: -7 * DEG },
    { bone: "Hips", axis: "y", amp: 0.012, freq: 2, phase: Math.PI / 2, track: "pos" },
  ]);
}

/** Set an item down, mirroring Pick_Up so the pair reads as one gesture. */
export function buildPlaceClip() {
  const up = buildPickUpClip();
  return THREE.AnimationClip.parse(
    Object.assign(THREE.AnimationClip.toJSON(up), { name: "Place" })
  );
}

/** Anticipation crouch, launch, tuck, land. */
export function buildJumpClip() {
  return buildProceduralClip("Jump", 0.9, [
    { bone: "Hips", axis: "y", amp: 0.16, freq: 1, track: "pos" },
    { bone: "Thigh_L", axis: "x", amp: 30 * DEG, freq: 1, phase: Math.PI },
    { bone: "Thigh_R", axis: "x", amp: 30 * DEG, freq: 1, phase: Math.PI },
    { bone: "Shin_L", axis: "x", amp: 34 * DEG, freq: 1, phase: Math.PI, base: 14 * DEG },
    { bone: "Shin_R", axis: "x", amp: 34 * DEG, freq: 1, phase: Math.PI, base: 14 * DEG },
    { bone: "UpperArm_L", axis: "z", amp: 40 * DEG, freq: 1, base: -30 * DEG },
    { bone: "UpperArm_R", axis: "z", amp: -40 * DEG, freq: 1, base: 30 * DEG },
    { bone: "Spine_02", axis: "y", amp: 0.07, freq: 1, base: 1, track: "scale" },
    { bone: "Spine_02", axis: "x", amp: -0.05, freq: 1, base: 1, track: "scale" },
    { bone: "Tail_01", axis: "x", amp: 20 * DEG, freq: 1 },
  ], 24);
}

/** Point at something, the non-verbal "look at this" every social game needs. */
export function buildPointClip() {
  return buildProceduralClip("Point", 1.1, [
    { bone: "UpperArm_R", axis: "x", amp: 6 * DEG, freq: 1, base: 74 * DEG },
    { bone: "LowerArm_R", axis: "x", amp: 4 * DEG, freq: 1, base: 6 * DEG },
    { bone: "Spine_01", axis: "y", amp: 5 * DEG, freq: 1 },
    { bone: "Head", axis: "y", amp: 8 * DEG, freq: 1 },
  ], 14);
}

/** Nod yes. */
export function buildNodClip() {
  return buildProceduralClip("Nod", 0.9, [
    { bone: "Head", axis: "x", amp: 13 * DEG, freq: 2 },
    { bone: "Neck", axis: "x", amp: 5 * DEG, freq: 2 },
  ], 14);
}

/** Shake head no. */
export function buildShakeHeadClip() {
  return buildProceduralClip("Shake_Head", 1.0, [
    { bone: "Head", axis: "y", amp: 17 * DEG, freq: 2 },
    { bone: "Neck", axis: "y", amp: 6 * DEG, freq: 2 },
  ], 14);
}

/** A small celebratory bounce, distinct from Cheer's arms-up. */
export function buildDanceClip() {
  return buildProceduralClip("Dance", 1.8, [
    { bone: "Hips", axis: "y", amp: 0.05, freq: 4, track: "pos" },
    { bone: "Hips", axis: "z", amp: 9 * DEG, freq: 2 },
    { bone: "Spine_01", axis: "z", amp: -7 * DEG, freq: 2 },
    { bone: "UpperArm_L", axis: "z", amp: 34 * DEG, freq: 2, base: -50 * DEG },
    { bone: "UpperArm_R", axis: "z", amp: -34 * DEG, freq: 2, base: 50 * DEG },
    { bone: "Head", axis: "z", amp: 8 * DEG, freq: 2, phase: Math.PI },
    { bone: "Tail_01", axis: "y", amp: 22 * DEG, freq: 2 },
  ]);
}

/** Curled up asleep, used by the day/night cycle and the quiet districts. */
export function buildSleepClip() {
  return buildProceduralClip("Sleep", 5.0, [
    { bone: "Hips", axis: "y", amp: 0, base: -0.22, track: "pos" },
    { bone: "Spine_01", axis: "x", amp: 1 * DEG, base: 34 * DEG },
    { bone: "Neck", axis: "x", amp: 1 * DEG, base: 22 * DEG },
    { bone: "Head", axis: "x", amp: 2 * DEG, base: 26 * DEG, freq: 0.5 },
    { bone: "Thigh_L", axis: "x", amp: 0, base: -74 * DEG },
    { bone: "Thigh_R", axis: "x", amp: 0, base: -74 * DEG },
    { bone: "Shin_L", axis: "x", amp: 0, base: 84 * DEG },
    { bone: "Shin_R", axis: "x", amp: 0, base: 84 * DEG },
    { bone: "Spine_02", axis: "y", amp: 0.03, base: 1, freq: 0.5, track: "scale" },
  ]);
}

// Clip names considered LoopOnce (everything else defaults to LoopRepeat),
// mirroring CHARACTER-BIBLE.md section 6's Loop/One-shot column.
export const ONE_SHOT_CLIP_NAMES = Object.freeze([
  "Wave", "Sit_Down", "Stand_Up", "Cheer",
  "Pick_Up", "Place", "Jump", "Point", "Nod", "Shake_Head",
]);

/**
 * Every ability the avatar can perform, grouped by how a caller reaches for it.
 * Locomotion is driven by speed, carry by whether the hands are full, and
 * emotes are fired explicitly. Exported so UI can build an emote wheel without
 * hardcoding a second copy of this list.
 */
export const ABILITIES = Object.freeze({
  locomotion: ["Idle", "Walk", "Run", "Jump"],
  carry: ["Pick_Up", "Carry_Idle", "Carry_Walk", "Place"],
  posture: ["Sit_Down", "Sit_Idle", "Stand_Up", "Sleep"],
  emote: ["Wave", "Point", "Nod", "Shake_Head", "Clap", "Cheer", "Dance"],
});

/**
 * Build the full v1 procedural clip set for one avatar.
 * @param {string} speciesId
 * @param {number} [seed] species asymmetry seed (species.js's speciesSeed)
 */
export function buildAllProceduralClips(speciesId, seed = 0) {
  const clips = {};
  for (const emotion of Object.keys(IDLE_EMOTION_PROFILE)) {
    const clip = buildIdleClip(emotion, 1, seed);
    clips[clip.name] = clip;
  }
  if (speciesId === "otter") {
    const c = buildOtterStandClip();
    clips[c.name] = c;
  }
  if (speciesId === "hedgehog") {
    const c = buildHedgehogCurlClip();
    clips[c.name] = c;
  }
  for (const c of [
    buildWalkClip(), buildRunClip(), buildWaveClip(),
    buildSitDownClip(), buildSitIdleClip(), buildStandUpClip(),
    buildClapClip(), buildCheerClip(),
    buildPickUpClip(), buildCarryIdleClip(), buildCarryWalkClip(), buildPlaceClip(),
    buildJumpClip(), buildPointClip(), buildNodClip(), buildShakeHeadClip(),
    buildDanceClip(), buildSleepClip(),
  ]) {
    clips[c.name] = c;
  }
  return clips;
}

// Sanity export used by the self-test: every bone name referenced above
// must exist in BONE_LIST, or a typo here would silently no-op at runtime.
export function assertClipBonesValid(clips) {
  const known = new Set(BONE_LIST);
  for (const clip of Object.values(clips)) {
    for (const track of clip.tracks) {
      const bone = track.name.split(".")[0];
      if (!known.has(bone)) {
        throw new Error(`clips.js: clip "${clip.name}" references unknown bone "${bone}"`);
      }
    }
  }
  return true;
}
