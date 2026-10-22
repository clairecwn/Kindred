/**
 * rigSpec.js — GENERATED. Do not hand-edit.
 *
 * Source of truth is tools/blender/rig.py; `npm run build:avatars` writes
 * tools/blender/rig_spec.json and regenerates this file from it. Both the
 * Blender authoring pipeline and the runtime skeleton therefore describe
 * exactly the same 22-bone rig, which is what lets a garment authored in
 * Blender rebind onto a character built at runtime purely by bone name.
 *
 * All offsets are in three.js space (Y up, +Z forward), parent-relative.
 */

export const AVATAR_HEIGHT = 1.6;

export const BONE_LIST = Object.freeze(["Hips","Spine_01","Spine_02","Neck","Head","Shoulder_L","UpperArm_L","LowerArm_L","Hand_L","Shoulder_R","UpperArm_R","LowerArm_R","Hand_R","Back","Thigh_L","Shin_L","Foot_L","Thigh_R","Shin_R","Foot_R","Tail_01","Tail_02"]);

export const BONE_SPEC = Object.freeze({
  "Hips": {
    "parent": null,
    "offset": [
      0,
      0.48,
      0
    ]
  },
  "Spine_01": {
    "parent": "Hips",
    "offset": [
      0,
      0.12,
      0
    ]
  },
  "Spine_02": {
    "parent": "Spine_01",
    "offset": [
      0,
      0.14,
      0
    ]
  },
  "Neck": {
    "parent": "Spine_02",
    "offset": [
      0,
      0.12,
      0
    ]
  },
  "Head": {
    "parent": "Neck",
    "offset": [
      0,
      0.04,
      0
    ]
  },
  "Shoulder_L": {
    "parent": "Spine_02",
    "offset": [
      0.2,
      0.06,
      0
    ]
  },
  "UpperArm_L": {
    "parent": "Shoulder_L",
    "offset": [
      0.06,
      -0.02,
      0
    ]
  },
  "LowerArm_L": {
    "parent": "UpperArm_L",
    "offset": [
      0.05,
      -0.16,
      0
    ]
  },
  "Hand_L": {
    "parent": "LowerArm_L",
    "offset": [
      0.02,
      -0.14,
      0
    ]
  },
  "Shoulder_R": {
    "parent": "Spine_02",
    "offset": [
      -0.2,
      0.06,
      0
    ]
  },
  "UpperArm_R": {
    "parent": "Shoulder_R",
    "offset": [
      -0.06,
      -0.02,
      0
    ]
  },
  "LowerArm_R": {
    "parent": "UpperArm_R",
    "offset": [
      -0.05,
      -0.16,
      0
    ]
  },
  "Hand_R": {
    "parent": "LowerArm_R",
    "offset": [
      -0.02,
      -0.14,
      0
    ]
  },
  "Back": {
    "parent": "Spine_02",
    "offset": [
      0,
      0.06,
      -0.13
    ]
  },
  "Thigh_L": {
    "parent": "Hips",
    "offset": [
      0.115,
      -0.02,
      0
    ]
  },
  "Shin_L": {
    "parent": "Thigh_L",
    "offset": [
      0.005,
      -0.225,
      0
    ]
  },
  "Foot_L": {
    "parent": "Shin_L",
    "offset": [
      0,
      -0.16,
      0.02
    ]
  },
  "Thigh_R": {
    "parent": "Hips",
    "offset": [
      -0.115,
      -0.02,
      0
    ]
  },
  "Shin_R": {
    "parent": "Thigh_R",
    "offset": [
      -0.005,
      -0.225,
      0
    ]
  },
  "Foot_R": {
    "parent": "Shin_R",
    "offset": [
      0,
      -0.16,
      0.02
    ]
  },
  "Tail_01": {
    "parent": "Hips",
    "offset": [
      0,
      0.02,
      -0.15
    ]
  },
  "Tail_02": {
    "parent": "Tail_01",
    "offset": [
      0,
      0,
      -0.12
    ]
  }
});

export const SOCKET_SPEC = Object.freeze({
  "SOCKET_head": {
    "bone": "Head",
    "offset": [
      0,
      0.5,
      0
    ]
  },
  "SOCKET_face": {
    "bone": "Head",
    "offset": [
      0,
      0.31,
      0.23
    ]
  },
  "SOCKET_back": {
    "bone": "Back",
    "offset": [
      0,
      0,
      -0.02
    ]
  },
  "SOCKET_hand_L": {
    "bone": "Hand_L",
    "offset": [
      0,
      -0.05,
      0
    ]
  },
  "SOCKET_hand_R": {
    "bone": "Hand_R",
    "offset": [
      0,
      -0.05,
      0
    ]
  },
  "SOCKET_foot_L": {
    "bone": "Foot_L",
    "offset": [
      0,
      -0.04,
      0.03
    ]
  },
  "SOCKET_foot_R": {
    "bone": "Foot_R",
    "offset": [
      0,
      -0.04,
      0.03
    ]
  },
  "SOCKET_aura": {
    "bone": "Root",
    "offset": [
      0,
      0,
      0
    ]
  }
});

export const SOCKET_LIST = Object.freeze(Object.keys(SOCKET_SPEC));

/** World-space rest position of every bone, derived from BONE_SPEC. */
export const BONE_REST = (() => {
  const out = {};
  const resolve = (name) => {
    if (out[name]) return out[name];
    const { parent, offset } = BONE_SPEC[name];
    const base = parent ? resolve(parent) : [0, 0, 0];
    out[name] = [base[0] + offset[0], base[1] + offset[1], base[2] + offset[2]];
    return out[name];
  };
  BONE_LIST.forEach(resolve);
  return Object.freeze(out);
})();
