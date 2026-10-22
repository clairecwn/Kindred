// src/kingdom/props.js
//
// Camp pieces that move. Blender rigs them like the animals
// (assets/kingdom/blender/passes/k35_props.py): the campfire's tongues of
// flame bend and lick on their own bones, the tent's pennant ripples. Each is
// written to models/env/kingdom/props/ with props.json saying which kit mesh it
// takes the place of (KK_Campfire, KK_Tent) and which loop it plays.
//
// The flame is modelled and rigged in Blender as its own piece: three tongues of flame, each three flat layers (red
// rim, orange body, pale yellow heart) on chains of bones, so a wave runs up each tongue, the tips stretch and lick
// and small flicks break off the top. It is turned to face the camera every frame, the way cartoon game fire is. Here the flame and the embers light themselves (so
// shade never dulls them), and round the fire go a warm light that flickers, glowing embers that tumble up and go
// out, and soft puffs of smoke, each a few round lumps, that rise, swell, drift and fade.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

const DIR = "models/env/kingdom/";
function url(path) {
  const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : "http://localhost/";
  return new URL(DIR + path, base).href;
}

const FLAME = /^KI_(flameCore|flameMid|flameTip|glow)/;          // the flame and the embers light themselves

/** { doc, models: Map(name -> gltf), standsFor: Map(kit mesh -> name) } */
export async function loadProps(prepare) {
  const doc = await fetch(url("props/props.json")).then((r) => { if (!r.ok) throw new Error(`props.json: ${r.status}`); return r.json(); });
  const loader = new GLTFLoader();
  const names = Object.keys(doc.props);
  const files = await Promise.all(names.map((n) => loader.loadAsync(url(doc.props[n].file)).catch(() => null)));
  const models = new Map(), standsFor = new Map();
  names.forEach((n, i) => {
    if (!files[i]) return;
    prepare?.(files[i].scene);
    files[i].scene.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; } });
    models.set(n, files[i]); if (doc.props[n].stands_for) standsFor.set(doc.props[n].stands_for, n);
  });
  return { doc, models, standsFor };
}

/** Round the fire: the warm light that flickers, embers that rise and wink out, and puffs of smoke. */
class FireFX {
  constructor(random = Math.random) {
    this.group = new THREE.Group(); this.group.name = "fire-fx"; this.t = random() * 10; this.random = random;
    this.light = new THREE.PointLight(0xffa24a, 2.2, 7, 1.6);
    this.light.position.set(0, 0.7, 0); this.light.castShadow = false;
    this.group.add(this.light);
    // embers: little glowing chips, tumbling up in wavering lines, shrinking as they cool, going out
    this.sparks = Array.from({ length: 12 }, () => this._spark({}));
    this.embers = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.022, 0), new THREE.MeshBasicMaterial({ color: 0xffb43a, toneMapped: false }), this.sparks.length);
    this.embers.castShadow = false; this.embers.frustumCulled = false; this.group.add(this.embers);
    // smoke: soft puffs, each a few round lumps together (a cartoon puff, not one ball), that rise, swell, drift and fade
    const ball = new THREE.SphereGeometry(1, 12, 8);
    this.puffs = [0, 1, 2, 3].map((k) => {
      const g = new THREE.Group(); g.userData.age = k / 4; g.userData.drift = (random() - 0.5) * 0.6;
      const m = new THREE.MeshLambertMaterial({ color: 0xd8d2ca, transparent: true, opacity: 0, depthWrite: false });
      for (const [x, y, z, r] of [[0, 0, 0, 0.13], [0.1, 0.03, 0.02, 0.09], [-0.09, 0.02, -0.03, 0.1], [0.02, 0.1, 0.04, 0.08]]) {
        const lump = new THREE.Mesh(ball, m); lump.position.set(x, y, z); lump.scale.setScalar(r); lump.castShadow = false; g.add(lump);
      }
      g.userData.material = m; this.group.add(g); return g;
    });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
  }

  _spark(s) {
    const r = this.random;
    s.life = 0.9 + r() * 1.0; s.age = r() * s.life; s.x = (r() - 0.5) * 0.3; s.z = (r() - 0.5) * 0.3; s.vx = (r() - 0.5) * 0.3; s.vz = (r() - 0.5) * 0.3; s.wob = r() * 6; s.spin = r() * 6;
    return s;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    this.light.intensity = 2.2 * (0.82 + 0.1 * Math.sin(t * 9.3) + 0.06 * Math.sin(t * 23.1) + 0.04 * Math.sin(t * 3.7));
    this.sparks.forEach((s, i) => {
      s.age += dt;
      if (s.age > s.life) { this._spark(s); s.age = 0; }
      const u = s.age / s.life, size = (1 - u) * (0.6 + 0.4 * Math.sin(t * 20 + s.wob));
      this._p.set(s.x + s.vx * s.age + 0.05 * Math.sin(t * 6 + s.wob), 0.7 + 1.5 * u, s.z + s.vz * s.age);
      this._q.setFromEuler(this._e.set(t * 3 + s.spin, t * 2 + s.spin, 0));
      this.embers.setMatrixAt(i, this._m.compose(this._p, this._q, this._s.setScalar(Math.max(0.001, size))));
    });
    this.embers.instanceMatrix.needsUpdate = true;
    for (const p of this.puffs) {
      p.userData.age = (p.userData.age + dt / 5) % 1;
      const u = p.userData.age;
      p.position.set(p.userData.drift * u + 0.08 * Math.sin(u * 4 + t * 0.4), 1.35 + 2.0 * u, 0.06 * Math.cos(u * 3));
      p.scale.setScalar(0.7 + 1.5 * u);
      p.rotation.y = u * 1.5;
      p.userData.material.opacity = 0.38 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (u < 0.08 ? u / 0.08 : 1);
    }
  }

  dispose() { this.embers.geometry.dispose(); this.embers.material.dispose(); this.puffs[0].children[0].geometry.dispose(); for (const p of this.puffs) p.userData.material.dispose(); }
}

/** Smoke from a chimney: soft puffs, each a few round lumps, that rise, swell, lean with the breeze and fade, as
 * cartoon chimneys smoke in the Mario games and Hay Day. `top` is the chimney's mouth in the parent's space. */
export class Smoke {
  constructor(top, { random = Math.random, scale = 1 } = {}) {
    this.root = new THREE.Group(); this.root.name = "chimney-smoke"; this.root.position.copy(top); this.root.scale.setScalar(scale);
    this.root.userData.prop = this; this.t = random() * 10;
    const ball = new THREE.SphereGeometry(1, 10, 7); this._ball = ball;
    this.puffs = [0, 1, 2, 3, 4].map((k) => {
      const g = new THREE.Group(); g.userData.age = k / 5; g.userData.drift = 0.2 + random() * 0.3;
      const m = new THREE.MeshLambertMaterial({ color: 0xf2eee8, transparent: true, opacity: 0, depthWrite: false });
      for (const [x, y, z, r] of [[0, 0, 0, 0.16], [0.12, 0.04, 0.03, 0.11], [-0.11, 0.03, -0.04, 0.12], [0.02, 0.12, 0.05, 0.1]]) {
        const lump = new THREE.Mesh(ball, m); lump.position.set(x, y, z); lump.scale.setScalar(r); lump.castShadow = false; g.add(lump);
      }
      g.userData.material = m; this.root.add(g); return g;
    });
  }
  update(dt) {
    this.t += dt;
    for (const p of this.puffs) {
      p.userData.age = (p.userData.age + dt / 4.5) % 1;
      const u = p.userData.age;
      p.position.set(p.userData.drift * u * 1.6 + 0.06 * Math.sin(u * 5 + this.t * 0.5), 0.1 + 1.6 * u, 0.05 * Math.cos(u * 3));
      p.scale.setScalar(0.5 + 1.4 * u); p.rotation.y = u * 1.2;
      p.userData.material.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.05)) * (u < 0.1 ? u / 0.1 : 1);
    }
  }
  dispose() { this._ball.dispose(); for (const p of this.puffs) p.userData.material.dispose(); }
}

/** One rigged camp piece, playing its loop. */
export class Prop {
  constructor(lib, name, { glowing = null, random = Math.random } = {}) {
    const gltf = lib.models.get(name), spec = lib.doc.props[name];
    this.name = name; this.root = cloneSkinned(gltf.scene); this.root.name = `prop-${name}`; this.root.userData.prop = this;
    if (spec.fire) this.root.traverse((o) => { if (o.isMesh && FLAME.test(o.material?.name ?? "") && glowing) { o.material = glowing(o.material); o.castShadow = false; } });
    this.mixer = new THREE.AnimationMixer(this.root);
    const clip = gltf.animations.find((c) => c.name === spec.loop) ?? gltf.animations[0];
    if (clip) { const a = this.mixer.clipAction(clip).play(); a.time = random() * clip.duration; }
    if (spec.fire) { this.fx = new FireFX(random); this.root.add(this.fx.group); }
    // The flame itself is its own rigged piece (props/flame.glb): flat layered flame shapes, rim, body and heart, on
    // chains of bones that sway and stretch. It always turns to face the camera, so it is never seen edge on.
    if (spec.flame && lib.models.has(spec.flame)) { this.flame = new Flame(lib, spec.flame, { glowing, random }); this.root.add(this.flame.root); }
  }
  update(dt, camera) { this.mixer.update(dt); this.fx?.update(dt); this.flame?.update(dt, camera); }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); this.flame?.dispose(); this.fx?.dispose(); }
}

/** The rigged flame (props/flame.glb) on its own: playing its Burn loop and turned to face the camera every frame,
 * so it is never seen edge on. The campfire carries one; so does a fireplace, at a smaller size. */
export class Flame {
  constructor(lib, name = "Flame", { glowing = null, random = Math.random, scale = 1 } = {}) {
    const gltf = lib.models.get(name);
    this.root = cloneSkinned(gltf.scene); this.root.name = "flame"; this.root.scale.setScalar(scale); this.root.userData.prop = this;
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; if (glowing) o.material = glowing(o.material); } });
    this.mixer = new THREE.AnimationMixer(this.root);
    const burn = gltf.animations.find((c) => c.name === lib.doc.props[name]?.loop) ?? gltf.animations[0];
    if (burn) { const a = this.mixer.clipAction(burn).play(); a.time = random() * burn.duration; }
    this._eye = new THREE.Vector3();
  }
  update(dt, camera) {
    this.mixer.update(dt);
    const parent = this.root.parent;
    if (camera && parent) { const e = parent.worldToLocal(camera.getWorldPosition(this._eye)); this.root.rotation.y = Math.atan2(e.x - this.root.position.x, e.z - this.root.position.z); }
  }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); }
}
