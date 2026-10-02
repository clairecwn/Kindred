/**
 * kindredModels.js — loads and caches the Blender-authored cast and
 * wardrobe .glb files in public/models/.
 *
 * Works in the browser (fetch) and in node (fs), so the self-tests
 * exercise the real assets rather than a stub. Loading is async but
 * createAvatar() is synchronous, so the contract is:
 *   - getModel(key) returns a parsed gltf or null, synchronously;
 *   - preload() resolves once the requested keys are cached;
 *   - onLoaded(cb) fires per key so a placeholder can upgrade in place.
 */

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CAST, WARDROBE_MODEL, MODEL_BASE, getCharacter } from "./castData.js";

const loader = new GLTFLoader();
const cache = new Map();
const inflight = new Map();
const listeners = new Set();

const isNode =
  typeof process !== "undefined" && process.versions?.node && typeof window === "undefined";

async function readBytes(key) {
  if (isNode) {
    const [{ readFile }, { fileURLToPath }] = await Promise.all([
      import("node:fs/promises"),
      import("node:url"),
    ]);
    const here = fileURLToPath(new URL(".", import.meta.url));
    const buf = await readFile(`${here}../../public/models/${key}.glb`);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const res = await fetch(`${MODEL_BASE}${key}.glb`);
  if (!res.ok) throw new Error(`kindredModels: ${key}.glb -> HTTP ${res.status}`);
  return res.arrayBuffer();
}

function parse(buffer) {
  return new Promise((resolve, reject) => loader.parse(buffer, "", resolve, reject));
}

export function getModel(key) {
  return cache.get(key) ?? null;
}

/** Model key for a character id (falls back to the first cast member). */
export function modelKeyFor(characterId) {
  return getCharacter(characterId).model;
}

export function getCharacterModel(characterId) {
  return getModel(modelKeyFor(characterId));
}

export function getWardrobeModel() {
  return getModel(WARDROBE_MODEL);
}

export function isModelReady(key) {
  return cache.has(key);
}

export function onLoaded(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function loadModel(key) {
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (inflight.has(key)) return inflight.get(key);
  const p = readBytes(key)
    .then(parse)
    .then((gltf) => {
      cache.set(key, gltf);
      inflight.delete(key);
      listeners.forEach((cb) => {
        try { cb(key, gltf); } catch { /* a bad listener must not break loading */ }
      });
      return gltf;
    })
    .catch((err) => {
      inflight.delete(key);
      console.warn(`kindredModels: failed to load ${key}`, err);
      return null;
    });
  inflight.set(key, p);
  return p;
}

/** Warm the wardrobe plus whichever characters are named (default: all). */
export function preload(characterIds = CAST.map((c) => c.id)) {
  const keys = new Set([WARDROBE_MODEL, ...characterIds.map(modelKeyFor)]);
  return Promise.all([...keys].map(loadModel));
}

if (!isNode && typeof window !== "undefined") {
  // Warm the wardrobe and the default character immediately so the first
  // scene to mount finds a hot cache.
  preload([CAST[0].id]);
}
