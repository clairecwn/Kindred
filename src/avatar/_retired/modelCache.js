/**
 * modelCache.js — loads and caches the Blender-authored character and
 * wardrobe .glb files that live in public/models/ (authored by
 * tools/blender/build_characters.py).
 *
 * Works in BOTH environments on purpose:
 *   - browser: fetch() -> ArrayBuffer -> GLTFLoader.parse
 *   - node    : fs.readFileSync -> ArrayBuffer -> GLTFLoader.parse
 * The models carry no textures and no animations, so GLTFLoader.parse
 * needs no DOM — which means src/avatar/selfTest.mjs and friends exercise
 * the REAL asset pipeline instead of a stub.
 *
 * Loading is async, but createAvatar() is synchronous and is called from
 * places (src/grove/scene) that cannot await. The contract is therefore:
 *   - getSpeciesModel(id) returns a parsed model or null, synchronously.
 *   - preloadAvatarModels() resolves once everything is cached.
 *   - importing this module in a browser kicks the preload off
 *     immediately, so by the time any scene mounts the cache is warm.
 * AvatarRig.js handles the cold case by building a placeholder and
 * upgrading it in place when the model lands.
 */

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SPECIES_LIST } from "./species.js";

export const MODEL_BASE = "/models/";
export const WARDROBE_MODEL = "kindred_wardrobe";

const loader = new GLTFLoader();
const cache = new Map();      // key -> gltf
const inflight = new Map();   // key -> Promise
const listeners = new Set();

const isNode = typeof process !== "undefined" && process.versions?.node
  && typeof window === "undefined";

function modelKey(id) {
  return id === WARDROBE_MODEL ? WARDROBE_MODEL : `kindred_${id}`;
}

async function readBytes(key) {
  if (isNode) {
    const [{ readFile }, { fileURLToPath }] = await Promise.all([
      import("node:fs/promises"),
      import("node:url"),
    ]);
    const here = fileURLToPath(new URL(".", import.meta.url));
    const path = `${here}../../public/models/${key}.glb`;
    const buf = await readFile(path);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const res = await fetch(`${MODEL_BASE}${key}.glb`);
  if (!res.ok) throw new Error(`modelCache: ${key}.glb -> HTTP ${res.status}`);
  return res.arrayBuffer();
}

function parse(buffer) {
  return new Promise((resolve, reject) => {
    loader.parse(buffer, "", resolve, reject);
  });
}

/** Load one model by id ("fox", "kindred_wardrobe", ...). Cached. */
export function loadModel(id) {
  const key = modelKey(id);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (inflight.has(key)) return inflight.get(key);
  const p = readBytes(key)
    .then(parse)
    .then((gltf) => {
      cache.set(key, gltf);
      inflight.delete(key);
      listeners.forEach((fn) => { try { fn(id, gltf); } catch { /* listener errors never break loading */ } });
      return gltf;
    })
    .catch((err) => {
      inflight.delete(key);
      if (typeof console !== "undefined") console.warn(`[avatar] ${key}.glb unavailable, using procedural fallback`, err?.message ?? err);
      return null;
    });
  inflight.set(key, p);
  return p;
}

/** Synchronous cache read — null if the model is not loaded yet. */
export function getSpeciesModel(species) {
  return cache.get(modelKey(species)) ?? null;
}

/** Synchronous cache read for the shared wardrobe model. */
export function getWardrobeModel() {
  return cache.get(WARDROBE_MODEL) ?? null;
}

export function isModelReady(species) {
  return cache.has(modelKey(species));
}

/** Resolves once every character model + the wardrobe model are cached. */
export function preloadAvatarModels(list = SPECIES_LIST) {
  return Promise.all([...list.map(loadModel), loadModel(WARDROBE_MODEL)]);
}

/** Called with (id, gltf) each time a model finishes loading. */
export function onModelLoaded(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Warm the SHARED wardrobe model as early as possible in the browser —
// it is needed by every character and is the smallest file. Individual
// character models are ~350KB each, so all eight eagerly would be ~3MB of
// mostly-unused download; AvatarRig requests a species on first use
// instead and upgrades the placeholder when it lands.
if (!isNode && typeof fetch === "function") {
  loadModel(WARDROBE_MODEL);
}
