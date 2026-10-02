// src/grove/player/PlayerController.js
//
// Capsule-style movement, third-person follow camera, keyboard/touch input,
// and simple AABB collision against the box colliders from districts.js.
// This is plain Three.js math on a THREE.Group standing in for the player's
// capsule; the actual visible mesh is swapped in from the avatar system
// living under src/avatar/ (owned by another workstream), which can
// attach itself to controller.root without this file needing to know
// anything about its geometry.
//
// Movement is deliberately calm: a fixed walk speed, no sprint, no stamina,
// per the design bible ("no sprint, no stamina bar"). The camera is a long
// lens, low-FOV third-person follow (Brawl Stars / Mario Party toy-scale
// read, not a wide action-cam FOV) with a slight look-ahead in the
// movement direction and a small FOV kick while moving, damped toward its
// target each frame rather than snapping, so the plaza reads as an actual
// game camera.

import * as THREE from "three";

const WALK_SPEED = 3.2; // metres per second, a calm walking pace
// Pure left/right input (no forward held) no longer counts as a turn at
// all - see fixedStep(): it only reorients when there's a forward
// component, so tapping "right" alone strafes the player sideways while
// the camera (locked directly behind `heading`) holds still, instead of
// swinging the whole view around to face the new direction. When a turn
// DOES happen (forward+strafe, or forward direction changing), it eases in
// far more gently than before - was 10 (a ~90 degree flick in ~1 frame),
// now a fraction of that so a single tap reads as a lean, not a snap.
const TURN_SMOOTHING = 3.2; // higher = snappier heading interpolation
const PLAYER_RADIUS = 0.4; // capsule radius used for collision against AABBs

// Camera follow tuning: elevated third-person, matching the art direction's
// "slightly above isometric" feel (~55 degrees from horizontal).
// At a long-lens FOV (32 degrees, 16 degrees of vertical half-angle) the
// camera pitch (the angle between the view axis and true horizontal) must
// stay under ~16 degrees or the horizon sits outside the frustum and the
// top of the frame fills with foreground green/trees instead of sky.
// Pulled in from 12 to 9.5 and lowered from 5.0 to 3.9 so the avatar reads
// clearly (Mario Party / Brawl Stars framing) against the real 1280x605
// viewport instead of sitting small and low in frame: pitch at rest is
// atan((3.9-1.2)/9.5) =~ 15.9 degrees, still under the 16-degree ceiling,
// and the FOV kick while moving still widens the frustum to fully clear
// the horizon whenever the player is walking.
// Framed for the GLB avatars (AVATAR_HEIGHT 1.6, ~2.7 heads tall): the
// look target sits at MID-BODY, not head height, so the whole character
// - feet included - is centred in frame instead of hanging off the
// bottom edge. Pitch is atan((3.85-0.9)/10.5) = 15.7 degrees, still just
// under the 16-degree vertical half-FOV ceiling, so the horizon stays in
// shot and the world keeps its sky.
export const CAMERA_DISTANCE = 12.0;
export const CAMERA_HEIGHT = 4.4;
const LOOK_TARGET_Y = 1.0; // chest/shoulder height - centres the avatar rather than pinning it low
const CAMERA_LERP = 6; // ~0.08-0.1 damping per frame at 60fps
// Cheap camera-collision backstop (a "spring arm"): if a registered solid
// collider tall enough to reach the sightline's height sits between the
// player and the desired camera position, the camera is pulled in along
// that same line so it never ends up on the far side of (inside) the
// obstruction. This is deliberately NOT a full raycast against meshes -
// it reuses the AABB colliders PlayerController already has for movement,
// checked against a per-label height table, which is effectively free
// each frame. The separate, more expensive per-frame occluder raycast
// (camera-to-player against registered large props like the plaza arches)
// lives in GroveScene.js and handles fading those props see-through;
// this backstop only guards against the camera physically clipping into
// geometry that fade doesn't apply to (hedges, building walls).
const OCCLUDER_HEIGHTS = { hedge: 1.4, "hedge-gap": 1.4, landmark: 2.4, "building-wall": 3.2 };
const MIN_SPRING_DISTANCE = 4; // never pull the camera closer than this, even fully blocked

/** True when (x,z) is inside at least one of a walkable collider's
 * regions, shrunk by the player's own radius so you can never stand with
 * half your body off a pier. */
function insideAnyRegion(regions, x, z, radius) {
  for (const r of regions) {
    if (r.kind === "circle") {
      const dx = x - r.cx, dz = z - r.cz;
      const rr = Math.max(0.1, r.r - radius);
      if (dx * dx + dz * dz <= rr * rr) return true;
    } else {
      if (x >= r.minX + radius && x <= r.maxX - radius
       && z >= r.minZ + radius && z <= r.maxZ - radius) return true;
    }
  }
  return false;
}

/** 2D slab-method segment/AABB test. Returns [tEnter, tExit] in [0,1] along
 * the segment (x0,z0)-(x1,z1), or null if the segment misses the box. */
function segmentBoxEntry(x0, z0, x1, z1, box) {
  let tmin = 0, tmax = 1;
  const dx = x1 - x0, dz = z1 - z0;
  const axes = [[x0, dx, box.minX, box.maxX], [z0, dz, box.minZ, box.maxZ]];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return [tmin, tmax];
}
const LOOK_AHEAD_MAX = 1.6; // metres the look target leads the player by at full speed
const LOOK_AHEAD_LERP = 4;
// Long lens: a low base FOV is what makes the world read as toy-scale
// rather than a wide, distorted action-cam framing.
const FOV_BASE = 46;
const FOV_KICK = 2.5; // extra degrees of FOV at full walking speed
const FOV_LERP = 6;

export class PlayerController {
  /**
   * @param {object} opts
   * @param {THREE.Camera} opts.camera
   * @param {Array<{minX:number,maxX:number,minZ:number,maxZ:number}>} opts.colliders
   * @param {{x:number, z:number}} [opts.startPosition]
   */
  constructor({ camera, colliders = [], startPosition = { x: 0, z: 6 } }) {
    this.camera = camera;
    this.colliders = colliders;
    // Camera "profile" (distance/height/look-target/base FOV) is mutable
    // so an indoor space (small interior room) can pull the follow camera
    // in tight without this file needing to know Grove has interiors at
    // all — see setCameraProfile(), used by interiors/InteriorManager.js.
    this._cameraDistance = CAMERA_DISTANCE;
    this._cameraHeight = CAMERA_HEIGHT;
    this._lookTargetY = LOOK_TARGET_Y;
    this._fovBase = FOV_BASE;
    if (this.camera && this.camera.isPerspectiveCamera) {
      this.camera.fov = this._fovBase;
    }

    // The player's root group; an avatar mesh can be parented to this by
    // whoever owns src/avatar/ without touching this file.
    this.root = new THREE.Group();
    this.root.position.set(startPosition.x, 0, startPosition.z);

    this.heading = 0; // radians, 0 = facing +Z (north, toward the districts)
    this.targetHeading = 0;
    this.velocity = new THREE.Vector3();
    // True for any fixed step in which the player's intended move was
    // clipped by a collider — GroveScene uses this (edge-triggered) to fire
    // a small decaying camera shake on contact.
    this.collidedThisStep = false;

    // Input state, updated by DOM listeners and read each fixed step.
    this._keys = new Set();
    this._touchVector = { x: 0, z: 0 }; // set by an optional on-screen stick

    // Edge-triggered interact press (KeyE): a discrete "fire once" signal
    // for the proximity interaction system, separate from the held-key
    // movement set above. consumeInteractPress() reads and clears it.
    this._interactPressed = false;

    this._onKeyDown = (e) => {
      this._keys.add(e.code);
      if (e.code === "KeyE" && !e.repeat) this._interactPressed = true;
    };
    this._onKeyUp = (e) => this._keys.delete(e.code);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);

    // Reused vectors to avoid per-frame allocation in the hot path.
    this._moveDir = new THREE.Vector3();
    this._desiredCamPos = new THREE.Vector3();
    this._camLookTarget = new THREE.Vector3();
    this._lookAheadCurrent = new THREE.Vector3();
    this._currentFov = FOV_BASE;
  }

  /** Swap the follow camera's distance/height/look-target/base-FOV, e.g.
   * pulling the camera in tight for a small interior room versus the
   * open plaza. Any field left out keeps its current value. */
  setCameraProfile({ distance, height, lookTargetY, fov } = {}) {
    if (typeof distance === "number") this._cameraDistance = distance;
    if (typeof height === "number") this._cameraHeight = height;
    if (typeof lookTargetY === "number") this._lookTargetY = lookTargetY;
    if (typeof fov === "number") this._fovBase = fov;
  }

  /** Optional: feed normalized {x, z} from an on-screen joystick for touch
   * devices. Values expected in [-1, 1] on each axis; (0,0) means idle. */
  setTouchVector(x, z) {
    this._touchVector.x = x;
    this._touchVector.z = z;
  }

  /**
   * Reads camera-relative input as {right, forward} in [-1, 1] on each
   * axis — forward/back and strafe left/right relative to the follow
   * camera, NOT raw world axes. Up/W = forward (away from the camera),
   * Down/S = the opposite (toward the camera), A/Left = camera-left,
   * D/Right = camera-right. This is deliberately in the camera's local
   * frame; fixedStep() below rotates it into world space using the
   * player's current heading, since the follow camera is always locked
   * directly behind that heading (no independent camera yaw).
   */
  _readLocalInput() {
    let right = 0, forward = 0;
    if (this._keys.has("KeyW") || this._keys.has("ArrowUp"))    forward += 1;
    if (this._keys.has("KeyS") || this._keys.has("ArrowDown"))  forward -= 1;
    if (this._keys.has("KeyA") || this._keys.has("ArrowLeft"))  right -= 1;
    if (this._keys.has("KeyD") || this._keys.has("ArrowRight")) right += 1;

    // Touch stick takes over when keyboard is idle, rather than summing
    // (summing could double speed if both happened to be active at once).
    // The stick's z is "screen down = world +Z (south)" in its own old
    // convention (see TouchJoystick.jsx), i.e. positive z means pulling
    // the knob toward the player = backward, so it flips sign here to
    // become local "forward".
    if (right === 0 && forward === 0 && (this._touchVector.x !== 0 || this._touchVector.z !== 0)) {
      right = this._touchVector.x;
      forward = -this._touchVector.z;
    }

    const len = Math.hypot(right, forward);
    if (len > 1) { right /= len; forward /= len; }
    return { right, forward };
  }

  /**
   * Resolve an intended world-space move against the box colliders using
   * simple axis-separated AABB resolution (move on X, clamp if blocked;
   * move on Z, clamp if blocked). This is deliberately simple: Grove's
   * colliders are axis-aligned hedges and a fountain, not complex geometry,
   * so a full physics engine would be overkill.
   */
  _resolveCollision(fromX, fromZ, toX, toZ) {
    let x = toX, z = fromZ;
    let blocked = false;
    if (!this._collides(x, z)) {
      fromX = x;
    } else if (toX !== fromX) {
      blocked = true;
    }
    z = toZ;
    if (!this._collides(fromX, z)) {
      fromZ = z;
    } else if (toZ !== fromZ) {
      blocked = true;
    }
    return { x: fromX, z: fromZ, blocked };
  }

  /** Three collider kinds, all consumed here (see scene/worldLayout.js):
   *   (default)  axis-aligned box   {minX,maxX,minZ,maxZ}   — keep out
   *   "circle"   disc               {cx,cz,r}               — keep out
   *   "walkable" union of regions   {regions:[...]}         — keep IN
   * The keep-IN kind is what makes an island world possible without
   * ringing the entire shoreline with hundreds of boxes: one collider
   * says "the ground is these shapes and nothing else". */
  _collides(x, z) {
    for (const c of this.colliders) {
      if (c.kind === "walkable") {
        if (!insideAnyRegion(c.regions, x, z, PLAYER_RADIUS)) return true;
        continue;
      }
      if (c.kind === "circle") {
        const r = c.r + PLAYER_RADIUS;
        const dx = x - c.cx, dz = z - c.cz;
        if (dx * dx + dz * dz < r * r) return true;
        continue;
      }
      const nearestX = Math.max(c.minX, Math.min(x, c.maxX));
      const nearestZ = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nearestX;
      const dz = z - nearestZ;
      if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) {
        return true;
      }
    }
    return false;
  }

  /**
   * Advance the simulation by a fixed timestep (seconds). Call this from
   * GroveScene's fixed-timestep accumulator loop, not directly from
   * requestAnimationFrame, so movement speed is independent of frame rate.
   */
  fixedStep(dt) {
    const local = this._readLocalInput();
    // Rotate the camera-relative {right, forward} input into world space
    // using the player's CURRENT heading — this is exactly the heading
    // the follow camera is locked to (see updateCamera below), so "camera
    // forward" and "player heading forward" are the same direction. At
    // heading 0 the camera sits behind the player along -Z looking toward
    // +Z, so forward (h=0) must map to world +Z, and right (h=0) maps to
    // world -X — verified against the camera offset math in
    // updateCamera(): camera = player - (sin h, cos h) * distance, so
    // (sin h, cos h) IS the forward vector, and (-cos h, sin h) is the
    // vector 90 degrees clockwise from it (screen-right for a camera
    // looking along that forward direction).
    const h = this.heading;
    const worldX = local.forward * Math.sin(h) - local.right * Math.cos(h);
    const worldZ = local.forward * Math.cos(h) + local.right * Math.sin(h);
    this._moveDir.set(worldX, 0, worldZ);

    // Only chase a new facing direction when there's a forward component.
    // A pure strafe (right/left with no forward held) translates the
    // player sideways without touching heading/targetHeading at all, so
    // the follow camera - which is locked directly behind `heading` - does
    // not swing around. That swing was the "just shifting the view" bug:
    // tapping the right button alone used to snap the character (and thus
    // the camera) a full 90 degrees to face sideways instead of stepping
    // sideways in place.
    if (Math.abs(local.forward) > 0.001 && this._moveDir.lengthSq() > 0.0001) {
      this.targetHeading = Math.atan2(this._moveDir.x, this._moveDir.z);
    }

    // Smoothly rotate toward the target heading rather than snapping, for a
    // softer, calmer feel consistent with the rest of Grove's motion.
    const headingDiff = shortestAngleDiff(this.heading, this.targetHeading);
    this.heading += headingDiff * Math.min(1, TURN_SMOOTHING * dt);

    const dx = this._moveDir.x * WALK_SPEED * dt;
    const dz = this._moveDir.z * WALK_SPEED * dt;

    const from = this.root.position;
    const resolved = this._resolveCollision(from.x, from.z, from.x + dx, from.z + dz);
    this.collidedThisStep = resolved.blocked;
    // Actual resolved displacement this step, not the raw intended move —
    // so velocity (and anything driven by it, like the follow camera's
    // look-ahead and FOV kick, or the avatar's walk animation) reflects
    // real motion rather than input that a wall just blocked.
    const actualDx = resolved.x - from.x;
    const actualDz = resolved.z - from.z;
    this.velocity.set(actualDx / dt, 0, actualDz / dt);
    this.root.position.x = resolved.x;
    this.root.position.z = resolved.z;
    this.root.rotation.y = this.heading;
  }

  /** Backstop spring arm: pulls _desiredCamPos toward the player along its
   * own sightline whenever a tall-enough registered collider sits between
   * them, so the camera can never end up embedded in solid geometry. See
   * OCCLUDER_HEIGHTS above for what counts as "tall enough" and why this
   * is a cheap AABB check rather than a mesh raycast. */
  _applySpringArm(p) {
    const cam = this._desiredCamPos;
    let bestT = 1;
    for (const c of this.colliders) {
      const h = OCCLUDER_HEIGHTS[c.label];
      if (h == null) continue;
      const hit = segmentBoxEntry(p.x, p.z, cam.x, cam.z, c);
      if (!hit) continue;
      const [tEnter] = hit;
      if (tEnter <= 0.02) continue; // ignore geometry right at the player's feet
      const yAtEnter = this._lookTargetY + tEnter * (cam.y - this._lookTargetY);
      if (yAtEnter < h) bestT = Math.min(bestT, tEnter);
    }
    if (bestT < 1) {
      const minT = Math.min(1, MIN_SPRING_DISTANCE / Math.max(0.001, this._cameraDistance));
      const t = Math.max(minT, bestT - 0.05);
      cam.x = p.x + (cam.x - p.x) * t;
      cam.z = p.z + (cam.z - p.z) * t;
      cam.y = this._lookTargetY + (cam.y - this._lookTargetY) * t;
    }
  }

  /**
   * Update the camera every rendered frame (not the fixed step) so the
   * follow motion stays smooth at whatever frame rate the browser is
   * actually achieving. `dt` here is the render-frame delta, used only for
   * the camera's own smoothing, never for movement.
   */
  updateCamera(dt) {
    const p = this.root.position;
    const speedRatio = THREE.MathUtils.clamp(this.velocity.length() / WALK_SPEED, 0, 1);

    // Fixed third-person follow: camera sits behind-and-above the player
    // along the player's current heading, matching the art direction's
    // constant-elevation isometric-leaning view rather than a free orbit.
    this._desiredCamPos.set(
      p.x - Math.sin(this.heading) * this._cameraDistance,
      this._cameraHeight,
      p.z - Math.cos(this.heading) * this._cameraDistance,
    );
    this._applySpringArm(p);
    // Damped follow: lerp toward the target each frame (~0.08-0.1 at
    // 60fps) rather than snapping straight to it, so the camera trails
    // smoothly instead of rigidly locking to the avatar.
    this.camera.position.lerp(this._desiredCamPos, Math.min(1, CAMERA_LERP * dt));

    // A slight look-ahead in the current facing direction, eased in and
    // out rather than snapping, so the camera leans into a turn instead of
    // just trailing the avatar dead-centre — the small polish that makes a
    // follow camera feel alive rather than mechanical.
    const desiredLookAheadX = Math.sin(this.heading) * LOOK_AHEAD_MAX * speedRatio;
    const desiredLookAheadZ = Math.cos(this.heading) * LOOK_AHEAD_MAX * speedRatio;
    this._lookAheadCurrent.x += (desiredLookAheadX - this._lookAheadCurrent.x) * Math.min(1, LOOK_AHEAD_LERP * dt);
    this._lookAheadCurrent.z += (desiredLookAheadZ - this._lookAheadCurrent.z) * Math.min(1, LOOK_AHEAD_LERP * dt);

    // Aim at the avatar's mid-height, not above its head, or it sits at the
    // very bottom of the frame and falls out of a short viewport entirely.
    this._camLookTarget.set(p.x + this._lookAheadCurrent.x, this._lookTargetY, p.z + this._lookAheadCurrent.z);
    this.camera.lookAt(this._camLookTarget);

    // A small FOV kick while moving reads as momentum, Mario-Kart style,
    // without ever being a literal sprint mechanic.
    if (this.camera.isPerspectiveCamera) {
      const desiredFov = this._fovBase + FOV_KICK * speedRatio;
      this._currentFov += (desiredFov - this._currentFov) * Math.min(1, FOV_LERP * dt);
      if (Math.abs(this.camera.fov - this._currentFov) > 0.01) {
        this.camera.fov = this._currentFov;
        this.camera.updateProjectionMatrix();
      }
    }
  }

  /**
   * Move the player straight to a world position and snap the follow camera
   * with them, so a fast-travel does not sweep the camera across the whole
   * plaza. Used by the district buttons in the drawer.
   */
  moveTo(x, z, heading = this.heading) {
    this.root.position.set(x, 0, z);
    this.heading = heading;
    this.targetHeading = heading;
    this.velocity.set(0, 0, 0);
    this.root.rotation.y = heading;
    // Place the camera at its resting offset immediately rather than letting
    // it lerp there from wherever it was.
    this.updateCamera(1);
    if (this._desiredCamPos) this.camera.position.copy(this._desiredCamPos);
  }

  getPosition() {
    return { x: this.root.position.x, z: this.root.position.z, heading: this.heading };
  }

  /** Reads and clears the one-shot interact-key press flag (KeyE). A
   * touch "Interact" button can call `triggerInteract()` for the same
   * effect. */
  consumeInteractPress() {
    if (!this._interactPressed) return false;
    this._interactPressed = false;
    return true;
  }

  /** Fires the same discrete interact signal as pressing E — used by the
   * touch/tap "Interact" HUD button. */
  triggerInteract() {
    this._interactPressed = true;
  }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
  }
}

function shortestAngleDiff(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
