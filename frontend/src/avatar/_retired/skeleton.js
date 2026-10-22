/**
 * skeleton.js — builds the 22-bone Grove rig from CHARACTER-BIBLE.md
 * section 5's hierarchy diagram, plus the SOCKET_* attachment empties.
 *
 * Audit note (see docs/grove/CHARACTER-BIBLE.md section 5): the bible's
 * prose says "20 deform bones" but its own hierarchy diagram lists 22
 * (Hips, Spine_01, Spine_02, Neck, Head, Shoulder/UpperArm/LowerArm/Hand
 * x2 = 8, Thigh/Shin/Foot x2 = 6, Back, Tail_01, Tail_02). This module
 * follows the diagram (more specific than the summary count) and BONE_LIST
 * below is the authoritative 22-name list for this codebase.
 *
 * Runtime attachment model: bones are real THREE.Bone objects forming a
 * real THREE.Skeleton, and every visible body-part mesh is parented
 * directly onto the bone that carries it (rigid attach) rather than GPU
 * vertex-skinned across multiple bones. This matches the chunky
 * Overcooked-style cast (rigid mitts/pads, no soft per-vertex deformation
 * needed) and means THREE.AnimationMixer can drive the whole rig by
 * animating bone.quaternion/.position directly, with zero IK solving at
 * runtime (IK, per the bible, is a Blender-authoring aid only — baked
 * bone transforms are what ships). This is a deliberate simplification
 * from a smooth-skinned rig, documented so a future baked-GLB import can
 * replace it without changing any calling code (createAvatar/applyDescriptor
 * keep returning the same Group/bone-map/socket-map shape).
 */

import * as THREE from "three";
import { AVATAR_HEIGHT, BONE_SPEC, SOCKET_SPEC, BONE_LIST as SPEC_BONE_LIST,
         SOCKET_LIST as SPEC_SOCKET_LIST, BONE_REST } from "./rigSpec.js";

export { BONE_REST };

export const BONE_LIST = SPEC_BONE_LIST;

export const SOCKET_LIST = SPEC_SOCKET_LIST;

const SOCKET_BONES = Object.fromEntries(
  Object.entries(SOCKET_SPEC).map(([n, v]) => [n, [v.bone, v.offset]])
);

/**
 * Local bone offsets (from parent bone origin), expressed as a fraction of
 * AVATAR_HEIGHT so the whole rig scales with one constant. Values are
 * tuned for the "big head, soft mass" proportions in section 1, shared by
 * every species (species-specific silhouette comes from mesh scale in
 * body.js, not from moving joints around).
 */
// CHARACTER-BIBLE.md section 1 proportion push (brief point 2): head is
// now ~0.26h in radius (body.js) against a much shorter body/limb chain
// below, landing head:body around 1:2, the aggressive end of the chibi
// 1:2-1:3 target — legs and arms are both roughly 30% shorter than a
// realistic chain would use, which is also what makes hands/feet read
// as stubby mitts and pads instead of articulated limbs.
function boneOffsets() {
  return Object.fromEntries(Object.entries(BONE_SPEC).map(([n, v]) => [n, v.offset]));
}

// parent bone name for each bone (Hips has no parent — attaches to Root group).
const BONE_PARENT = Object.fromEntries(
  Object.entries(BONE_SPEC).map(([n, v]) => [n, v.parent])
);

/**
 * Build the Root group + full bone hierarchy + socket empties.
 * @param {number} [height] standing height override (defaults to AVATAR_HEIGHT)
 * @returns {{root: THREE.Group, bones: Object<string, THREE.Bone>, skeleton: THREE.Skeleton, sockets: Object<string, THREE.Object3D>}}
 */
export function buildSkeleton(height = AVATAR_HEIGHT) {
  const root = new THREE.Group();
  root.name = "Root";

  const offsets = boneOffsets();
  const bones = {};
  for (const name of BONE_LIST) {
    const bone = new THREE.Bone();
    bone.name = name;
    const [x, y, z] = offsets[name];
    bone.position.set(x, y, z);
    bones[name] = bone;
  }
  for (const name of BONE_LIST) {
    const parentName = BONE_PARENT[name];
    if (parentName) bones[parentName].add(bones[name]);
    else root.add(bones[name]);
  }

  const skeleton = new THREE.Skeleton(BONE_LIST.map((n) => bones[n]));

  const sockets = {};
  for (const socketName of SOCKET_LIST) {
    const [boneName, offset] = SOCKET_BONES[socketName];
    const empty = new THREE.Object3D();
    empty.name = socketName;
    empty.position.set(offset[0], offset[1], offset[2]);
    const host = boneName === "Root" ? root : bones[boneName];
    host.add(empty);
    sockets[socketName] = empty;
  }

  return { root, bones, skeleton, sockets };
}
