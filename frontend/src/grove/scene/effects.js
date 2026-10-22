// src/grove/scene/effects.js
//
// Small, cheap "game feel" systems shared by GroveScene: a soft blob-shadow
// decal factory (kills the floating-prop look for almost no cost), a
// recycled footstep dust-puff particle pool, a decaying camera shake, and a
// small burst-particle pool for positive actions / district transitions.
// Every system here is a fixed-size pool updated per frame - no per-frame
// allocation, no dynamic geometry rebuilds.

import * as THREE from "three";

// ── Blob shadow ─────────────────────────────────────────────────────────
// A soft-edged circular sprite (radial-gradient canvas texture, generated
// once and shared) rather than a hard-edged flat circle, so grounding reads
// as a soft contact shadow instead of a dark disc.
let sharedBlobTexture = null;
export function getBlobShadowTexture() {
  if (sharedBlobTexture) return sharedBlobTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(10,6,4,0.55)");
  g.addColorStop(0.6, "rgba(10,6,4,0.32)");
  g.addColorStop(1, "rgba(10,6,4,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  sharedBlobTexture = tex;
  return tex;
}

/** A single soft blob-shadow mesh, sized for one prop/avatar, positioned
 * flat on the ground. Cheap enough to use per-avatar (players are few);
 * repeated props should prefer an InstancedMesh sharing this texture
 * instead of one of these each. */
export function createBlobShadow(radius = 0.55, opacity = 0.85) {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  const mat = new THREE.MeshBasicMaterial({
    map: getBlobShadowTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.renderOrder = -1;
  return mesh;
}

// ── Footstep dust puffs ──────────────────────────────────────────────────
// A fixed pool of small billboarded sprites recycled round-robin; each
// puff expands slightly and fades out over its short lifetime.
export class DustPuffs {
  constructor(scene, count = 16) {
    this.scene = scene;
    this.count = count;
    this.life = new Float32Array(count).fill(0);
    this.maxLife = 0.45;
    this._cursor = 0;

    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: getBlobShadowTexture(),
      color: 0xe8dcc0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.name = "dust-puffs";
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    this._positions = new Array(count).fill(null).map(() => new THREE.Vector3());
    for (let i = 0; i < count; i++) {
      this._m.compose(this._positions[i], this._q, new THREE.Vector3(0.0001, 0.0001, 0.0001));
      this.mesh.setMatrixAt(i, this._m);
    }
    scene.add(this.mesh);
  }

  spawn(x, y, z) {
    const i = this._cursor;
    this._cursor = (this._cursor + 1) % this.count;
    this.life[i] = this.maxLife;
    this._positions[i].set(x, y, z);
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) {
        if (this.life[i] === 0) continue;
        this.life[i] = 0;
      }
      any = true;
      this.life[i] = Math.max(0, this.life[i] - dt);
      const t = 1 - this.life[i] / this.maxLife; // 0 -> 1 over lifetime
      const scale = THREE.MathUtils.lerp(0.25, 0.85, t);
      const opacity = this.life[i] > 0 ? (1 - t) * 0.55 : 0;
      this._m.compose(
        new THREE.Vector3(this._positions[i].x, this._positions[i].y + 0.01, this._positions[i].z),
        this._q,
        new THREE.Vector3(scale, scale, scale),
      );
      this.mesh.setMatrixAt(i, this._m);
      // All instances share one material, so opacity is approximated by
      // fading the whole pool's material toward the strongest active puff.
      // Cheap and visually fine at this tiny sprite size/count.
      if (opacity > this.mesh.material.opacity) this.mesh.material.opacity = opacity;
    }
    if (any) {
      this.mesh.instanceMatrix.needsUpdate = true;
      // Decay the shared opacity a little each frame so it doesn't stay
      // pinned to the single loudest puff forever.
      this.mesh.material.opacity = Math.max(0, this.mesh.material.opacity - dt * 0.9);
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// ── Camera shake ─────────────────────────────────────────────────────────
// A short decaying offset applied on top of the follow camera's own
// position/lookAt each frame - call `apply(camera)` after the normal
// camera update, and `trigger()` on landing/collision events.
export class CameraShake {
  constructor() {
    this._t = 0;
    this._duration = 0;
    this._magnitude = 0;
    this._offset = new THREE.Vector3();
  }

  trigger(magnitude = 0.12, durationMs = 150) {
    this._magnitude = Math.max(this._magnitude, magnitude);
    this._duration = Math.max(this._duration, durationMs / 1000);
    this._t = 0;
  }

  update(dt) {
    if (this._duration <= 0) {
      this._offset.set(0, 0, 0);
      return this._offset;
    }
    this._t += dt;
    const remaining = Math.max(0, 1 - this._t / this._duration);
    if (remaining <= 0) {
      this._duration = 0;
      this._offset.set(0, 0, 0);
      return this._offset;
    }
    const falloff = remaining * remaining; // decay fast, TF2-style punch
    const amp = this._magnitude * falloff;
    this._offset.set(
      (Math.random() * 2 - 1) * amp,
      (Math.random() * 2 - 1) * amp * 0.6,
      (Math.random() * 2 - 1) * amp,
    );
    return this._offset;
  }
}

// ── Positive-action particle burst ───────────────────────────────────────
// A small fixed pool of Points recycled per burst; call spawnBurst(pos)
// whenever something good happens (arriving somewhere new, an emote, a
// minigame win) for a satisfying, cheap payoff moment.
export class ParticleBurst {
  constructor(scene, count = 40) {
    this.scene = scene;
    this.count = count;
    this.life = new Float32Array(count).fill(0);
    this.velocities = new Array(count).fill(null).map(() => new THREE.Vector3());
    this.maxLife = 0.7;

    const geo = new THREE.BufferGeometry();
    this._positions = new Float32Array(count * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(this._positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe28a,
      size: 0.16,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = "positive-action-burst";
    scene.add(this.points);
    this._nextFree = 0;
  }

  spawnBurst(position, color = 0xffe28a, count = 14) {
    this.points.material.color.set(color);
    for (let n = 0; n < count; n++) {
      const i = this._nextFree;
      this._nextFree = (this._nextFree + 1) % this.count;
      this.life[i] = this.maxLife;
      const a = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 1.6;
      this.velocities[i].set(Math.cos(a) * speed, 2.2 + Math.random() * 1.4, Math.sin(a) * speed);
      this._positions[i * 3] = position.x;
      this._positions[i * 3 + 1] = position.y;
      this._positions[i * 3 + 2] = position.z;
    }
  }

  update(dt) {
    let maxRemaining = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] = Math.max(0, this.life[i] - dt);
      maxRemaining = Math.max(maxRemaining, this.life[i] / this.maxLife);
      this.velocities[i].y -= 4.5 * dt; // gravity
      this._positions[i * 3] += this.velocities[i].x * dt;
      this._positions[i * 3 + 1] += this.velocities[i].y * dt;
      this._positions[i * 3 + 2] += this.velocities[i].z * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.material.opacity = maxRemaining;
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
