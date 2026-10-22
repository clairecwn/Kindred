// src/kingdom/creatures.js
//
// The island's animals, alive. Blender rigs every creature
// (assets/kingdom/blender/passes/k33_creatures.py) and writes one model per
// creature into models/env/kingdom/creatures/, with its clips (Walk, Idle and
// what that animal does: Eat, Peck, Swim, Sit, Hop, Fly, Rest) and
// creatures.json (each creature's clips, how fast it walks so its feet do not
// slide, and which still life-kit meshes it stands in for).
//
// Where the island would draw a still (KL_Cow, KL_Chicken_Peck, KL_Duck_Swim,
// ...) the developed view puts the living creature instead, starting in what
// the still shows. Each then lives by a small routine, as farm animals do in
// Hay Day: rest a while doing its own thing, wander a few steps round where
// it lives, rest again. The routine is plain data (ROUTINE) and the choice of
// what to do next (nextPlan) is a pure function, so both are tested in node.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

const DIR = "models/env/kingdom/";
const FACE = /^KI_(eye|nose)/;

/** A soft round shadow on the ground under an animal, as Mario games put under everyone: it ties the feet to the
 * ground, which the sun's shadow alone does not do on thin legs. One shared texture, a radial fade. */
let blobTexture = null;
function blobShadow(radius) {
  if (!blobTexture && typeof document !== "undefined") {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(0,0,0,0.42)"); grad.addColorStop(0.55, "rgba(0,0,0,0.26)"); grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64); blobTexture = new THREE.CanvasTexture(c);
  }
  if (!blobTexture) return null;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.scale.set(radius[0] * 2, radius[1] * 2, 1); m.renderOrder = 1; m.name = "blob-shadow";
  return m;
}

/** How each creature lives. roam: how far from home it wanders (metres);
 * rest: what it does between walks, picked at random; restFor: how long a
 * rest lasts (seconds); swim: the clip it uses on water. */
export const ROUTINE = Object.freeze({
  Cow:       { roam: 2.6, rest: ["Idle", "Eat", "Eat"], restFor: [5, 11] },
  Pony:      { roam: 3.2, rest: ["Idle", "Eat"], restFor: [4, 9] },
  Sheep:     { roam: 2.2, rest: ["Eat", "Idle", "Eat"], restFor: [4, 9] },
  Chicken:   { roam: 1.8, rest: ["Peck", "Idle", "Peck"], restFor: [1.6, 4.8] },
  Chick:     { roam: 1.0, rest: ["Peck", "Idle"], restFor: [1.2, 3.6] },
  Duck:      { roam: 1.6, rest: ["Idle"], restFor: [3, 8], swim: "Swim", swimSpeed: 0.2 },
  Cat:       { roam: 1.2, rest: ["Sit", "Sit", "Idle"], restFor: [8, 18] },
  Bird:      { roam: 0, rest: ["Idle", "Idle", "Hop"], restFor: [2, 5] },
  Butterfly: { roam: 0, flutter: 1.3 },
});

/** The clip a creature starts in, from the still it replaces. */
export function startClip(still) {
  if (/_Graze$/.test(still)) return "Eat";
  if (/_Peck$/.test(still)) return "Peck";
  if (/_Swim$/.test(still)) return "Swim";
  if (/_Sit$/.test(still)) return "Sit";
  if (/_Fly$/.test(still) || /Butterfly/.test(still)) return "Fly";
  return "Idle";
}

/** What to do next. `random` is a function giving numbers in [0, 1);
 * `blocked(x, z)` says whether a point is out of bounds. Returns
 * { clip, secs } for a rest, or { clip: "Walk"|"Swim", to: { x, z } } for a walk. */
export function nextPlan(name, { home, at, swimming, random = Math.random, blocked = () => false, last = null }) {
  const r = ROUTINE[name];
  if (!r || r.flutter) return { clip: "Fly", secs: 1e9 };
  const restClip = swimming ? r.swim : r.rest[Math.floor(random() * r.rest.length)];
  const rest = { clip: restClip, secs: r.restFor[0] + random() * (r.restFor[1] - r.restFor[0]) };
  const walked = last && (last.clip === "Walk" || last.to);
  if (!r.roam || walked || random() < 0.35) return rest;
  for (let tries = 0; tries < 6; tries++) {
    const a = random() * Math.PI * 2, d = r.roam * (0.35 + 0.65 * random());
    const to = { x: home.x + Math.cos(a) * d, z: home.z + Math.sin(a) * d };
    const mid = { x: (at.x + to.x) / 2, z: (at.z + to.z) / 2 };
    if (!blocked(to.x, to.z) && !blocked(mid.x, mid.z)) return { clip: swimming ? r.swim : "Walk", to };
  }
  return rest;
}

const json = (path) => fetch(url(path)).then((r) => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); });
function url(path) {
  const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : "http://localhost/";
  return new URL(DIR + path, base).href;
}

/** Loads every creature: { doc, models: Map(name -> gltf), standsFor: Map(still -> name) }. */
export async function loadCreatures(prepare) {
  const doc = await json("creatures/creatures.json");
  const loader = new GLTFLoader();
  const names = Object.keys(doc.creatures);
  const files = await Promise.all(names.map((name) => loader.loadAsync(url(doc.creatures[name].file)).catch((error) => { console.warn("[kingdom] creature", name, error); return null; })));
  const models = new Map(), standsFor = new Map();
  names.forEach((name, i) => {
    if (!files[i]) return;
    prepare?.(files[i].scene);
    files[i].scene.traverse((o) => {
      if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; }
      // eyes and noses are flat decals painted just above the skin; pull them toward the camera in the depth test
      // so the skin never pokes through them when the head turns (z-fighting)
      if (o.isMesh && FACE.test(o.material?.name ?? "")) {
        o.material.polygonOffset = true; o.material.polygonOffsetFactor = -2; o.material.polygonOffsetUnits = -4; o.castShadow = false;
      }
    });
    models.set(name, files[i]);
    for (const still of doc.creatures[name].stands_for) standsFor.set(still, name);
  });
  if (models.has("Butterfly")) standsFor.set("KL_Butterfly", "Butterfly");
  return { doc, models, standsFor };
}

/** One living creature. */
export class Creature {
  constructor(lib, name, { x = 0, y = 0, z = 0, rot = 0, still = null, colours = null, show = false, random = Math.random } = {}) {
    const gltf = lib.models.get(name);
    this.name = name; this.spec = lib.doc.creatures[name]; this.random = random;
    this.root = cloneSkinned(gltf.scene);
    this.root.name = `creature-${name}`;
    this.root.position.set(x, y, z); this.root.rotation.y = rot;
    this.root.userData.creature = this;
    if (colours) {
      this.root.traverse((o) => {
        if (!o.isMesh || !colours[o.material?.name]) return;
        o.material = o.material.clone(); o.material.color.set(colours[o.material.name]);
      });
    }
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = new Map(gltf.animations.map((clip) => [clip.name, this.mixer.clipAction(clip)]));
    this.home = { x, z }; this.heading = rot;
    this.swimming = /_Swim$/.test(still ?? "");
    this.flying = /_Fly$/.test(still ?? "") && name === "Bird";      // a bird drawn in flight circles the roofs
    this.show = show;                                  // in the gallery: stay put and play every clip in turn
    if (!this.flying && !this.swimming && !ROUTINE[name]?.flutter) {
      const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3());
      const blob = blobShadow([Math.max(0.08, size.x * 0.55), Math.max(0.08, size.z * 0.5)]);
      if (blob) { blob.position.x = (box.min.x + box.max.x) / 2; blob.position.z = (box.min.z + box.max.z) / 2; this.root.add(blob); this.blob = blob; }
    }
    this.t = 0; this.current = null;
    const first = startClip(still ?? "");
    this._play(this.actions.has(first) ? first : "Idle", 0);
    this.plan = this.show ? { clip: this.current, secs: 4 } : { clip: this.current, secs: 2 + random() * 4 };
    if (this.current && this.actions.get(this.current)) this.actions.get(this.current).time = random() * this.actions.get(this.current).getClip().duration;
  }

  _play(clip, fade = 0.35) {
    if (clip === this.current || !this.actions.has(clip)) return;
    const next = this.actions.get(clip).reset().play();
    const was = this.current && this.actions.get(this.current);
    if (was && fade > 0) was.crossFadeTo(next, fade, false); else if (was) was.stop();
    this.current = clip;
  }

  update(dt, blocked) {
    this.t += dt;
    const routine = ROUTINE[this.name] ?? {};
    if ((routine.flutter || this.flying) && !this.show) {   // a butterfly loops round its flowers; a flying bird round the roofs
      const w = this.flying ? 0.3 : 0.5, s = this.t * w, R = this.flying ? 4 : routine.flutter;
      const px = this.home.x + R * Math.sin(s), pz = this.home.z + R * 0.6 * Math.sin(2 * s);
      const dx = R * w * Math.cos(s), dz = R * 0.6 * 2 * w * Math.cos(2 * s);
      this.root.position.set(px, this.root.position.y, pz);
      this.root.position.y += Math.sin(this.t * 3.1) * 0.004;
      this.root.rotation.y = Math.atan2(dx, dz);
    } else if (this.show) {                                // the gallery: every clip in turn, in place
      this.plan.secs -= dt;
      if (this.plan.secs <= 0) {
        const clips = [...this.actions.keys()];
        const next = clips[(clips.indexOf(this.current) + 1) % clips.length];
        this._play(next); this.plan = { clip: next, secs: Math.max(3.5, this.actions.get(next).getClip().duration * 2) };
      }
    } else if (this.plan.to) {
      const p = this.root.position, dx = this.plan.to.x - p.x, dz = this.plan.to.z - p.z, dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let turn = ((want - this.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const step = Math.sign(turn) * Math.min(Math.abs(turn), 2.6 * dt);
      this.heading += step; this.root.rotation.y = this.heading;
      const speed = (this.swimming ? ROUTINE[this.name].swimSpeed : this.spec.speed) ?? 0.4;
      const go = Math.abs(turn) < 0.6 ? speed * dt : speed * dt * 0.3;
      const nx = p.x + Math.sin(this.heading) * go, nz = p.z + Math.cos(this.heading) * go;
      if (dist < 0.12 || blocked?.(nx, nz) || this.plan.secs !== undefined && (this.plan.secs -= dt) < 0) this._next(blocked);
      else { p.x = nx; p.z = nz; }
    } else {
      this.plan.secs -= dt;
      if (this.plan.secs <= 0) this._next(blocked);
    }
    this.mixer.update(dt);
  }

  _next(blocked) {
    const p = this.root.position;
    this.plan = nextPlan(this.name, { home: this.home, at: { x: p.x, z: p.z }, swimming: this.swimming, random: this.random, blocked, last: this.plan });
    if (this.plan.to) this.plan.secs = 12;                 // never walk for ever into something
    this._play(this.plan.clip);
  }

  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); if (this.blob) { this.blob.geometry.dispose(); this.blob.material.dispose(); } }
}
