/**
 * species.js — the 8 Grove archetypes (CHARACTER-BIBLE.md section 2) as a
 * data table of silhouette/proportion parameters. Shared by body.js (the
 * procedural mesh builder) and clips.js (species-specific idle overrides),
 * so adding a species never means writing a new bespoke builder function.
 *
 * Plain data + tiny pure helpers, no THREE import — safe to read from
 * anywhere (UI roster lists, adapter.js) without pulling in three.js.
 */

// Standing height in world units (CHARACTER-BIBLE.md section 1).
export const AVATAR_HEIGHT = 1.6;

// Head-to-body ratio: head height ~38% of standing height (section 1).
export const HEAD_HEIGHT_RATIO = 0.38;

// defaultSkin values are kept in sync with tools/blender/species_defs.py —
// the authored .glb bakes no colour, so this table is what actually tints
// every character at runtime. Design Bible palette rules apply: warm and
// muted, never neon, never pure white or pure black.
export const SPECIES_LIST = Object.freeze([
  "fox", "rabbit", "bear", "cat", "dog", "panda", "otter", "hedgehog",
]);

export const SPECIES_NAME = Object.freeze({
  fox: "Ember Kit",
  rabbit: "Mochi Hop",
  bear: "Bramble Cub",
  cat: "Nori",
  dog: "Pip Pup",
  panda: "Bamboo Bean",
  otter: "Reed Otter",
  hedgehog: "Fen Hedgehog",
});

/**
 * @typedef {Object} SpeciesParams
 * @property {string} ear        "triangle" | "long_floppy" | "round_small" | "neat" | "floppy" | "round_patch" | "wide_round" | "quill"
 * @property {number} earSize    relative scale, 1 = default
 * @property {string} tail       "sweep" | "poof" | "stub" | "straight" | "curl" | "none"
 * @property {number} muzzleLen  relative muzzle protrusion, 1 = default
 * @property {number} bodyLow    0..1, how low-slung/wide the torso reads (bear/otter high, cat low)
 * @property {number} shoulderWidth  fraction of standing height
 * @property {number} hipWidth       fraction of standing height
 * @property {boolean} backTopper    hedgehog quill cluster on the Back socket
 * @property {number} defaultSkin    default mat_skin hex if no palette given
 * @property {number} idleBounce     relative idle bounce amplitude (dog highest)
 * @property {string} [signature]    doc-only: the one iconic silhouette element this species leans on
 * @property {number} [tailScale]    multiplies the shared tail geometry's base size, 1 = default
 * @property {boolean} [eyePatch]    draws an oversized dark eye-patch behind each eye (panda's signature)
 */

/**
 * One-iconic-element rule (CHARACTER-BIBLE.md section 1, Supercell's own
 * Chuck-Jones-quoting design rule for Brawl Stars: "work a subject down
 * to the simplest form possible and still have it believable" — their
 * example is Spike, a cactus body shape plus a smile and dark eye holes,
 * nothing else). Each species below leans on exactly ONE oversized,
 * unmistakable silhouette feature (`signature`, documentation only) and
 * is otherwise kept as plain as the shared rig allows — variety comes
 * from pushing that one feature further, not from adding more small
 * parts. `tailScale`/`earSize`/`muzzleLen`/body width multiply the
 * shared builder's base sizes in body.js; `eyePatch` and the "paddle"/
 * "whip" tail types are the two places a species gets one extra piece,
 * and only because that piece IS the signature.
 */

/** @type {Object<string, SpeciesParams>} */
export const SPECIES = Object.freeze({
  fox: {
    signature: "one huge sweeping tail",
    ear: "triangle", earSize: 1.0, tail: "sweep", tailScale: 2.0, muzzleLen: 1.1, bodyLow: 0.15,
    shoulderWidth: 0.56, hipWidth: 0.42, backTopper: false,
    defaultSkin: 0xE08A4A, idleBounce: 0.7,
  },
  rabbit: {
    signature: "two tall upright ears, taller than the head",
    ear: "long_floppy", earSize: 2.3, tail: "poof", tailScale: 0.8, muzzleLen: 0.7, bodyLow: 0.55,
    shoulderWidth: 0.56, hipWidth: 0.50, backTopper: false,
    defaultSkin: 0xF3DFC8, idleBounce: 0.9,
  },
  bear: {
    signature: "one huge round body mass",
    ear: "round_small", earSize: 0.6, tail: "stub", tailScale: 1.0, muzzleLen: 0.85, bodyLow: 1.25,
    shoulderWidth: 0.86, hipWidth: 0.76, backTopper: false,
    defaultSkin: 0xA06A3E, idleBounce: 0.45,
  },
  cat: {
    signature: "one long whip-thin tail with a curled tip",
    ear: "neat", earSize: 0.85, tail: "whip", tailScale: 2.4, muzzleLen: 0.5, bodyLow: 0.0,
    shoulderWidth: 0.42, hipWidth: 0.32, backTopper: false,
    defaultSkin: 0xD9A86A, idleBounce: 0.5,
  },
  dog: {
    signature: "one oversized snout",
    ear: "floppy", earSize: 1.0, tail: "curl", tailScale: 1.0, muzzleLen: 1.9, bodyLow: 0.45,
    shoulderWidth: 0.60, hipWidth: 0.50, backTopper: false,
    defaultSkin: 0xE0A557, idleBounce: 1.2,
  },
  panda: {
    signature: "big dark eye patches (Spike's 'dark eye holes')",
    ear: "round_patch", earSize: 0.8, tail: "stub", tailScale: 1.0, muzzleLen: 0.85, bodyLow: 0.9,
    shoulderWidth: 0.68, hipWidth: 0.60, backTopper: false, eyePatch: true,
    defaultSkin: 0xF6EEE0, idleBounce: 0.4,
  },
  otter: {
    signature: "one flat paddle tail",
    ear: "wide_round", earSize: 0.6, tail: "paddle", tailScale: 1.9, muzzleLen: 1.0, bodyLow: 0.55,
    shoulderWidth: 0.48, hipWidth: 0.44, backTopper: false,
    defaultSkin: 0xA9764A, idleBounce: 0.8,
  },
  hedgehog: {
    signature: "a full spike crown over the head",
    ear: "round_small", earSize: 0.5, tail: "none", tailScale: 1.0, muzzleLen: 1.0, bodyLow: 0.65,
    shoulderWidth: 0.50, hipWidth: 0.46, backTopper: true,
    defaultSkin: 0xD9A85C, idleBounce: 0.3,
  },
});

/**
 * A small deterministic per-species seed (0..7), used purely to give each
 * archetype a slightly different idle tilt/asymmetry so a room full of
 * avatars doesn't look like identical mannequins standing at attention
 * (CHARACTER-BIBLE.md section 1 "slight asymmetry" note).
 */
export function speciesSeed(id) {
  const i = SPECIES_LIST.indexOf(id);
  return i >= 0 ? i : 0;
}

export function getSpecies(id) {
  return SPECIES[id] ?? SPECIES.bear;
}

/** Species-unique idle-only poses, gated by archetype (section 2/3). */
export function speciesUniqueIdle(species, emotion) {
  if (species === "otter" && emotion === "neutral") return "Idle_Standalone_Otter";
  if (species === "hedgehog" && (emotion === "sad" || emotion === "anxious")) {
    return "Idle_Curl_Hedgehog";
  }
  return null;
}
