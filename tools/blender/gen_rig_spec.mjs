/**
 * gen_rig_spec.mjs — regenerates src/avatar/rigSpec.js from the JSON the
 * Blender pipeline writes (tools/blender/rig_spec.json), so the runtime
 * skeleton and the authored .glb armature can never drift apart.
 * Run via `npm run build:avatars`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const spec = JSON.parse(readFileSync(`${here}rig_spec.json`, "utf8"));

const out = `/**
 * rigSpec.js — GENERATED. Do not hand-edit.
 *
 * Source of truth is tools/blender/rig.py; \`npm run build:avatars\` writes
 * tools/blender/rig_spec.json and regenerates this file from it. Both the
 * Blender authoring pipeline and the runtime skeleton therefore describe
 * exactly the same 22-bone rig, which is what lets a garment authored in
 * Blender rebind onto a character built at runtime purely by bone name.
 *
 * All offsets are in three.js space (Y up, +Z forward), parent-relative.
 */

export const AVATAR_HEIGHT = ${spec.avatarHeight};

export const BONE_LIST = Object.freeze(${JSON.stringify(spec.boneList)});

export const BONE_SPEC = Object.freeze(${JSON.stringify(spec.bones, null, 2)});

export const SOCKET_SPEC = Object.freeze(${JSON.stringify(spec.sockets, null, 2)});

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
`;
writeFileSync(`${here}../../src/avatar/rigSpec.js`, out);
console.log("wrote src/avatar/rigSpec.js");
