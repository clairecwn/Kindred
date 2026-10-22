// src/grove/player/PlayerController.js
//
// Movement, jumping, sitting, collision and the camera for the Grove.
//
//   Keys      The arrows walk the character in the direction pressed, as
//             seen on screen: Up away from the camera, Down towards it,
//             Left and Right across. This is camera-relative movement, the
//             scheme every 3D Mario has used since Super Mario 64, and the
//             one players find natural; turning the character with Left
//             and Right ("tank controls") is the one they find stiff.
//   View      The view follows where the character is going. Walk to the
//             side, or towards the camera, and after a moment the camera
//             pans slowly round until it is behind the character again, so
//             what lies that way comes into view (the Mario 64 "Lakitu"
//             idea; cameras that leave the yaw alone while the player runs
//             are a known mistake). The pan is slow and eased, and it only
//             ever goes towards the direction of travel.
//             While the camera pans, the arrows that are held go on meaning
//             what they meant when they were pressed: the character keeps
//             its straight line and does not curl round with the view
//             (which is what makes a follow camera run you in circles).
//             Press a different arrow and it is read against the view as it
//             now is. The same holds when the view is changed for you at a
//             door or a shop's fixed view.
//             A and D turn the view by hand (as Left and Right do in
//             Roblox, or Q and E in Don't Starve), and so does dragging
//             across the scene; the follow pan waits a moment afterwards.
//             Walking towards the camera, the view lifts and looks at the
//             floor in front of the character, so the way ahead is on
//             screen and not behind the lens.
//             Space jumps (tap for a hop). Shift sits. V switches between
//             the view from behind and the character's own eyes; through
//             the eyes, Left and Right turn, as there is nothing to walk
//             "across".
//   Boom      The camera slides in along its boom rather than pass through
//             a wall or sit under an awning. When a wall leaves it no room
//             behind the character it does not press up against their head:
//             it cranes up and looks down over them, so the character and
//             the floor ahead stay in view. While the view is being turned,
//             the boom feels ahead in the direction it is sweeping and
//             starts shortening before it reaches a wall, so there is no
//             sudden jump.
//   Rooms     A shop is a room with a fixed view (setRoom): the camera looks
//             in from the open front and cannot be turned.
//   Profiles  Open floor, rooms and rides each have their own boom length
//             and height; changing zone glides between them. A scene (the
//             lift) can take the camera over entirely with cameraOverride.
//
// Collision is 2D. Zones baked from the models arrive as a CollisionGrid
// (see collisionGrid.js); the older box / circle / walkable-region
// colliders still work beside it and are what the escalators use. The grid
// also knows how tall each mat and rug is, so feet stand on top of them.
//
// The visible avatar is parented to `root` by GroveScene. This file never
// looks at its geometry; it only exposes state (velocity, onGround,
// sitting, cameraCloseness) for the scene to act on.

import * as THREE from "three";

// ── Movement ───────────────────────────────────────────────────────────────
// The cast stands about 2 m tall, so this is roughly 2.3 body heights a
// second: a Mario-style jog scaled for a mall you cross in about 12 seconds.
export const MAX_SPEED = 4.6;
const ACCELERATION = 24;      // m/s², top speed in ~0.19 s
const DECELERATION = 32;      // m/s², stops in ~0.14 s
const FACE_RATE = THREE.MathUtils.degToRad(540);   // how fast the character turns to face its travel
const FACE_GAIN = 16;
// Turning the view (A / D). A key press starts slow and speeds up if it is
// held, the way Doom's keyboard turning does (a slow rate for the first
// 0.17 s, then the full one): a tap is a nudge of about five degrees, a held
// key a steady sweep. Roblox turns its camera at 120 degrees a second on
// the arrow keys; this is a little gentler, and gentler again while walking.
export const TURN_STANDING = THREE.MathUtils.degToRad(105);
export const TURN_WALKING = THREE.MathUtils.degToRad(80);
export const TURN_TAP = THREE.MathUtils.degToRad(52);
const TURN_TAP_TIME = 0.18;   // how long a press counts as a tap
const TURN_RAMP = 7;          // eases the turn in
const TURN_STOP = 16;         // and stops it promptly on release
const ROOM_SPEED = 3.9;       // inside a shop: a little slower, the room is small
// The body stops a little short of what it walks into. 0.36 m is the widest
// that still fits every aisle in the twelve shops (at 0.42 a third of the
// grocer and the food hall can no longer be reached).
export const PLAYER_RADIUS = 0.36;

// ── Jump ───────────────────────────────────────────────────────────────────
export const JUMP_SPEED = 7.4;   // peaks about 1.1 m up, a little over half the character
const GRAVITY_RISING = 24;
const GRAVITY_FALLING = 34;      // falls faster than it rises, as Mario does
const GRAVITY_CUT = 58;          // Space released while still rising
const JUMP_BUFFER = 0.12;        // a press this long before landing still counts
const GROUND_FOLLOW = 22;        // stepping up onto a mat is quick but not a snap

// ── Camera ─────────────────────────────────────────────────────────────────
export const CAMERA_DISTANCE = 8.5;
export const CAMERA_HEIGHT = 3.6;
const LOOK_TARGET_Y = 1.5;
const FOV_BASE = 50;
const PROFILE_GLIDE = 3.2;    // moving between zone profiles
const ARM_MARGIN = 0.4;       // keep this far in front of whatever blocks the boom
const ARM_MIN = 0.3;          // with a wall right behind, the camera is almost straight overhead
const ARM_EASE_IN = 9;        // shortening for a wall the boom is about to meet
const CRANE_DISTANCE = 3.5;   // the camera stays about this far from the character's chest; if the boom is shorter it rises instead
const CRANE_LOOK_AHEAD = 0.8; // craned up, it looks a little ahead of the character, so the way forward is on screen
const CRANE_FOV = 8;          // and widens its lens a touch, since it is close
const WHISKERS = [0.2, 0.42, 0.66];   // radians ahead of the turn the boom feels for walls
const WHISKER_SLACK = [0.7, 1.6, 2.6]; // and how much longer than what it finds there the boom may still be
const HEAD_HEIGHT = 1.45;
// The follow pan: the view coming round behind the direction of travel.
const PAN_DELAY = 0.3;                            // seconds of walking before it starts, so a tap of an arrow moves nothing
const PAN_MAX = THREE.MathUtils.degToRad(60);     // a quarter turn takes about two and a half seconds, a half turn about four
const PAN_MIN = THREE.MathUtils.degToRad(10);
const PAN_GAIN = 1.5;                             // slows as it arrives: rate = angle still to go x this
const PAN_DEADZONE = THREE.MathUtils.degToRad(5);
const PAN_BEHIND = THREE.MathUtils.degToRad(160); // nearer than this to straight towards the camera, it picks a side and keeps it
const PAN_EASE = 2.5;                             // eases in
const PAN_STOP = 6;                               // and stops gently when the character does
const PAN_AFTER_MANUAL = 1.2;                     // seconds it leaves the view alone after the player turns it themselves
const LEAD_RATE = 2.4;        // how quickly the view leans in when the character walks towards it
const LEAD_LIFT = 1.3;        // metres the camera rises
const LEAD_BACK = 2.4;        // metres towards the camera the view aims, so the floor ahead of the character is on screen
const LEAD_DROP = 0.7;
const SEATED_VIEW_ROOM = 3.2;   // metres of clear air the view wants behind a seated character
const SEATED_FRONT_CONE = 2.0;   // radians off the way the sitter faces: beyond this the view is from in front
const SEATED_VIEW_RATE = 3.5;   // how briskly the view swings round on sitting down
const ARM_RELEASE = 3.2;      // easing back out once the way is clear
const ARM_DUCK = 14;          // coming in for an awning or a tree crown
const ARM_NUDGE_MAX = 4.5;    // how far it will step in to get out of a tree crown or awning
const ARM_NUDGE_RATE = 9;
const LOOK_DRAG = 0.0055;     // radians of view turn per pixel of mouse drag
const ANCHOR_FOLLOW = 14;
const JUMP_FOLLOW = 0.35;     // the camera rises with only part of a jump
const OVERRIDE_GLIDE = 3.5;   // handing the camera to a scene and back
const EYE_HEIGHT = 1.55;      // first-person view: at the cast's eyes (the head bone is at 1.27 m and the big head's eyes sit about 0.3 m above it)
const EYE_PITCH = THREE.MathUtils.degToRad(14);   // first person looks a little down, as people do walking, so what is in the way at knee and waist height is in the picture
const EYE_FOV = 64;           // and a wider lens than the follow camera: the floor shows from about a metre ahead
const SEATED_EYE_ABOVE_SEAT = 1.0;   // first person on a seat: the eyes this far above the seat
const EYE_FORWARD = -0.15;    // a little behind the body's centre: walking up to a shelf stops half a metre short of it on screen, never inside it
const ROOM_GLIDE = 5;         // settling onto a room's fixed view

const SEAT_REACH = 1.7;       // how close to a seat Shift sits on it

const MOVEMENT_CODES = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function typingTarget(event) {
  const el = event.target;
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable === true;
}

/** True when (x,z) is inside at least one of a walkable collider's
 * regions, shrunk by the player's own radius. */
function insideAnyRegion(regions, x, z, radius) {
  for (const r of regions) {
    if (r.kind === "circle") {
      const dx = x - r.cx, dz = z - r.cz;
      const rr = Math.max(0.1, r.r - radius);
      if (dx * dx + dz * dz <= rr * rr) return true;
    } else if (x >= r.minX + radius && x <= r.maxX - radius
            && z >= r.minZ + radius && z <= r.maxZ - radius) {
      return true;
    }
  }
  return false;
}

function shortestAngleDiff(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function approach(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export class PlayerController {
  /**
   * @param {object} opts
   * @param {THREE.Camera} opts.camera
   * @param {Array<object>} opts.colliders  see _collides()
   * @param {{x:number, z:number}} [opts.startPosition]
   */
  constructor({ camera, colliders = [], startPosition = { x: 0, z: 6 } }) {
    this.camera = camera;
    this.colliders = colliders;
    this.seats = [];

    // The profile the zone asks for, and the one in use (which glides to it).
    this._want = { distance: CAMERA_DISTANCE, height: CAMERA_HEIGHT, lookTargetY: LOOK_TARGET_Y, fov: FOV_BASE, lookAhead: 0, lookRise: 0, eyeSlope: 0, eyeHeight: EYE_HEIGHT, maxHeight: 7.5 };
    this._eyeHeight = EYE_HEIGHT;
    this._lead = 0;            // 0..1: how much the character is walking towards the camera
    // The heading the movement keys are read against while a key that was
    // already down when the view was changed is still held; null otherwise
    // (the keys are then read against the view as it is).
    this._moveFrame = null;
    this._moveKeys = null;     // which arrows that frame was set for
    this._panRate = 0;         // the follow pan's turn rate, rad/s
    this._panHeld = 0;         // how long the character has been walking
    this._panSide = 0;         // which way round it goes when the character walks straight at the camera
    this._panWait = 0;
    this._lookAhead = 0;       // the view aims this far in front of the character (rides: up or down the slope)
    this._lookRise = 0;        // and this much above or below chest height
    this._eyeSlope = 0;        // first person: how steeply the eyes look up (+) or down (-)
    this._maxHeight = 7.5;     // the highest the camera may crane (below the ceiling indoors)
    /** null, or { heading } while the player is in a room with a fixed view. */
    this.room = null;
    this._cameraDistance = CAMERA_DISTANCE;
    this._cameraHeight = CAMERA_HEIGHT;
    this._lookTargetY = LOOK_TARGET_Y;
    this._fovBase = FOV_BASE;
    this._applyFov();

    // The player's root group; GroveScene parents the avatar to it.
    this.root = new THREE.Group();
    this.root.position.set(startPosition.x, 0, startPosition.z);

    this.heading = 0;          // radians, 0 = facing +Z: the way the character faces
    this.targetHeading = 0;
    this.cameraHeading = 0;    // the way the view looks, same convention
    this.velocity = new THREE.Vector3();
    this.verticalSpeed = 0;
    this.onGround = true;
    this.collidedThisStep = false;
    // While true, something else is carrying the player (an escalator
    // ride, a lift or stair scene): fixedStep leaves position, heading and
    // velocity to that system.
    this.inputLocked = false;
    /** null, or { kind: "chair"|"floor", y, heading } while seated. */
    this.sitting = null;
    this._seatedView = null;
    /** First-person view: the camera sits at the character's eyes. */
    this.firstPerson = false;
    /** A scene's own camera: { x, y, z, lookX, lookY, lookZ } in world
     * space, or null for the normal view. Glided into and out of. */
    this.cameraOverride = null;
    /** 0 when the camera is at a comfortable distance, 1 when it is right
     * up against the character. GroveScene fades the avatar by this. */
    this.cameraCloseness = 0;
    /** Set during rides and scenes, where the level the collision grid
     * describes is sliding past and its walls mean nothing to the camera. */
    this.cameraIgnoresWalls = false;
    this._standSpot = null;

    this._keys = new Set();
    this._touchVector = { x: 0, z: 0 };
    this._interactPressed = false;
    this._altPressed = false;
    this._jumpBuffer = 0;
    this._sitPressed = false;
    this._jumpStarted = false;
    this._landed = false;
    this._programmaticJump = false;
    this._turnRate = 0;
    this._turnHeld = 0;
    this._turnSign = 0;
    this._air = 0;             // height above whatever is underfoot
    this._ground = 0;          // height of the mat or rug underfoot

    this._onKeyDown = (e) => {
      if (typingTarget(e)) return;
      if (MOVEMENT_CODES.has(e.code) || e.code === "Space") e.preventDefault();
      this._keys.add(e.code);
      if (e.repeat) return;
      if (e.code === "KeyE") this._interactPressed = true;
      if (e.code === "KeyQ") this._altPressed = true;
      if (e.code === "KeyV") {
        this.firstPerson = !this.firstPerson;
        // Seated, the eyes look the way the seat faces; back behind, the
        // view finds the clearest side as it does on sitting down.
        if (this.sitting) this._seatedView = this.firstPerson ? this.sitting.heading : this._pickSeatedView();
      }
      if (e.code === "Space") this._jumpBuffer = JUMP_BUFFER;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this._sitPressed = true;
    };
    this._onKeyUp = (e) => {
      this._keys.delete(e.code);
      // Every arrow up: the next press starts afresh, read against the view as it is then.
      if (![...MOVEMENT_CODES].some((code) => this._keys.has(code))) { this._moveFrame = null; this._moveKeys = null; }
    };
    this._onBlur = () => {
      this._keys.clear();
      this.setTouchVector(0, 0);
    };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);

    this._moveDir = new THREE.Vector3();
    this._desiredCamPos = new THREE.Vector3();
    this._camLookTarget = new THREE.Vector3();
    this._anchor = new THREE.Vector3(startPosition.x, 0, startPosition.z);
    this._arm = this._cameraDistance;
    this._armNudge = 0;
    this._lift = 0;            // how far the camera has craned up above its boom
    this._overrideFov = FOV_BASE;
    this._eye = 0;             // 0 = behind the character, 1 = through its eyes
    this._override = 0;        // how far a scene camera has taken over
    this._overridePos = new THREE.Vector3();
    this._overrideLook = new THREE.Vector3();
  }

  // ── Camera profile ───────────────────────────────────────────────────────
  /** Ask for a different framing (the mall is tighter than the park, a
   * shop tighter still). The camera glides to it; pass snap to jump. Any
   * field left out keeps its current value. */
  setCameraProfile({ distance, height, lookTargetY, fov, lookAhead = 0, lookRise = 0, eyeSlope = 0, eyeHeight = EYE_HEIGHT, maxHeight } = {}, { snap = false } = {}) {
    if (typeof distance === "number") this._want.distance = distance;
    if (typeof height === "number") this._want.height = height;
    if (typeof lookTargetY === "number") this._want.lookTargetY = lookTargetY;
    if (typeof fov === "number") this._want.fov = fov;
    if (typeof maxHeight === "number") this._want.maxHeight = maxHeight;
    this._want.lookAhead = lookAhead;
    this._want.lookRise = lookRise;
    this._want.eyeSlope = eyeSlope;
    this._want.eyeHeight = eyeHeight;
    if (snap) this._glideProfile(0, true);
  }

  /** Enter or leave a room with a fixed view. In a room the view looks
   * along `heading` and does not turn, and the arrows move the character
   * directly on screen. Pass null to go back to the turning view. */
  setRoom(room, { snap = false } = {}) {
    const frame = this._frame();
    this.room = room ? { heading: room.heading } : null;
    if (room && snap && !this.firstPerson) this.cameraHeading = room.heading;
    this._keepFrame(frame);
    this._turnRate = 0;
    this._seatedView = null;
  }

  _glideProfile(dt, snap = false) {
    const k = snap ? 1 : 1 - Math.exp(-PROFILE_GLIDE * dt);
    this._cameraDistance += (this._want.distance - this._cameraDistance) * k;
    this._cameraHeight += (this._want.height - this._cameraHeight) * k;
    this._lookTargetY += (this._want.lookTargetY - this._lookTargetY) * k;
    this._fovBase += (this._want.fov - this._fovBase) * k;
    this._lookAhead += (this._want.lookAhead - this._lookAhead) * k;
    this._lookRise += (this._want.lookRise - this._lookRise) * k;
    this._eyeSlope += (this._want.eyeSlope - this._eyeSlope) * k;
    this._eyeHeight += (this._want.eyeHeight - this._eyeHeight) * k;
    this._maxHeight += (this._want.maxHeight - this._maxHeight) * k;
    if (snap) this._arm = this._cameraDistance;
  }

  _applyFov(fov = this._fovBase) {
    if (this.camera?.isPerspectiveCamera && Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  // ── Input ────────────────────────────────────────────────────────────────
  /** Normalised {x, z} from a touch stick; (0,0) is idle. x turns, positive
   * z is "toward the viewer". The keyboard wins when both are active. */
  setTouchVector(x, z) {
    this._touchVector.x = x;
    this._touchVector.z = z;
  }

  /** {forward, strafe, view}, each in [-1, 1]: walk away from the camera,
   * walk to the right of the screen, turn the view to the right. */
  _readInput() {
    const k = this._keys;
    let forward = 0, strafe = 0, view = 0;
    if (k.has("KeyW") || k.has("ArrowUp"))    forward += 1;
    if (k.has("KeyS") || k.has("ArrowDown"))  forward -= 1;
    if (k.has("ArrowLeft"))  strafe -= 1;
    if (k.has("ArrowRight")) strafe += 1;
    if (k.has("KeyA")) view -= 1;
    if (k.has("KeyD")) view += 1;
    if (forward === 0 && strafe === 0 && (this._touchVector.x !== 0 || this._touchVector.z !== 0)) {
      strafe = THREE.MathUtils.clamp(this._touchVector.x, -1, 1);
      forward = THREE.MathUtils.clamp(-this._touchVector.z, -1, 1);
    }
    if (this.firstPerson) {      // through the eyes there is no "across": Left and Right turn
      view = THREE.MathUtils.clamp(view + strafe, -1, 1);
      strafe = 0;
    }
    return { forward, strafe, view };
  }

  /** The heading the movement keys are read against right now. */
  _frame() {
    if (this._moveFrame !== null) return this._moveFrame;
    return this._fixedView() ? this.room.heading : this.cameraHeading;
  }

  /** Called when the view is about to be changed from outside (a door
   * fade, a room's fixed view): if a movement key is down, it goes on
   * meaning what it meant, until every movement key is released. */
  _keepFrame(frame) {
    const input = this._readInput();
    if ((input.forward !== 0 || input.strafe !== 0) && this._moveFrame === null) this._moveFrame = frame;
  }

  /** Programmatic jump (same as tapping Space). */
  triggerJump() { this._jumpBuffer = JUMP_BUFFER; this._programmaticJump = true; }
  /** Programmatic sit / stand toggle (same as tapping Shift). */
  triggerSit() { this._sitPressed = true; }

  // ── Collision ────────────────────────────────────────────────────────────
  /** Collider kinds, all consumed here:
   *   "grid"     CollisionGrid baked from the models   keep out of blocked cells
   *   (default)  axis-aligned box {minX,maxX,minZ,maxZ} keep out
   *   "circle"   disc {cx,cz,r}                         keep out
   *   "walkable" union of regions {regions:[...]}       keep IN */
  _collides(x, z) {
    for (const c of this.colliders) {
      if (c.kind === "grid") {
        if (c.circleBlocked(x, z, PLAYER_RADIUS)) return true;
        continue;
      }
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
      if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return true;
    }
    return false;
  }

  /** Move on X, then on Z, keeping whichever part is free, so walking into
   * a wall at an angle slides along it. */
  _resolveCollision(fromX, fromZ, toX, toZ) {
    let blocked = false;
    if (!this._collides(toX, fromZ)) fromX = toX;
    else if (toX !== fromX) blocked = true;
    if (!this._collides(fromX, toZ)) fromZ = toZ;
    else if (toZ !== fromZ) blocked = true;
    return { x: fromX, z: fromZ, blocked };
  }

  _grid() {
    for (const c of this.colliders) if (c.kind === "grid") return c;
    return null;
  }

  /** If the player has ended up inside something solid (a teleport that
   * lands a hair inside a wall, a level whose layout changed), step out to
   * the nearest open floor instead of being stuck there. */
  _unstick() {
    const p = this.root.position;
    if (!this._collides(p.x, p.z)) return;
    const spot = this._grid()?.nearestOpen(p.x, p.z, PLAYER_RADIUS + 0.02);
    if (spot && !this._collides(spot.x, spot.z)) {
      p.x = spot.x;
      p.z = spot.z;
    }
  }

  // ── Sitting ──────────────────────────────────────────────────────────────
  /** Seats for the current zone: [{x, z, y, heading|null, side|null, depth, table}]. */
  setSeats(seats) {
    this.seats = seats ?? [];
  }

  nearestSeat(maxDistance = SEAT_REACH) {
    const p = this.root.position;
    let best = null, bestD = maxDistance;
    for (const seat of this.seats) {
      const d = Math.hypot(seat.x - p.x, seat.z - p.z);
      if (d < bestD) { best = seat; bestD = d; }
    }
    return best;
  }

  /**
   * Sit on the nearest seat within reach, or on the floor where you are.
   * Which way the character faces is decided seat by seat (the bake works
   * it out, see assets/grove/bake_collision.py):
   *   a seat with a back       faces away from the back
   *   a seat at a table or bar faces the table, wherever you walked up from
   *   a free-standing bench    faces out over whichever long side you are on
   *   a lone stool             faces the way you came from
   */
  sit() {
    if (this.sitting || !this.onGround || this.inputLocked) return false;
    const p = this.root.position;
    const seat = this.nearestSeat();
    this.velocity.set(0, 0, 0);
    if (seat) {
      this._standSpot = { x: p.x, z: p.z };
      const toward = Math.atan2(p.x - seat.x, p.z - seat.z);
      let heading = toward;
      if (typeof seat.heading === "number") {
        heading = seat.heading;
      } else if (typeof seat.side === "number") {
        heading = Math.abs(shortestAngleDiff(seat.side, toward)) <= Math.PI / 2 ? seat.side : seat.side + Math.PI;
      }
      // Sit at the front edge so the knees bend over it and the legs hang
      // clear, rather than the shins passing through the seat.
      const forward = Math.max(0, (seat.depth ?? 0) / 2 - 0.1);
      p.x = seat.x + Math.sin(heading) * forward;
      p.z = seat.z + Math.cos(heading) * forward;
      this.sitting = { kind: "chair", y: seat.y, heading };
      this.heading = heading;
    } else {
      this._standSpot = null;
      this.sitting = { kind: "floor", y: 0, heading: this.heading };
    }
    this.targetHeading = this.heading;
    this.root.rotation.y = this.heading;
    this._seatedView = this.firstPerson ? this.heading : this._pickSeatedView();
    return true;
  }

  /**
   * Sitting down with a wall, a table or a planter right behind would leave
   * the camera with nowhere to go. If the view as it stands has room, it
   * stays; otherwise it swings once to the clearest side (the nearest such
   * side to where it already was), so the seated character is always in
   * shot. Returns the heading to ease to, or null to leave the view alone.
   */
  _pickSeatedView() {
    const grid = this._grid();
    if (!grid || this.firstPerson || this.room) return null;
    const p = this.root.position;
    const full = this._cameraDistance;
    const need = Math.min(SEATED_VIEW_ROOM, full);
    const farY = this._lookTargetY + (this._cameraHeight - this._lookTargetY) * ((full + ARM_MARGIN) / full);
    const room = (view) => Math.min(need, grid.cameraReach(p.x, p.z, -Math.sin(view), -Math.cos(view), full + ARM_MARGIN, this._lookTargetY, farY) - ARM_MARGIN);
    // On a proper seat, a view from straight in front puts the table (or
    // the screen) between the camera and the character.
    const fromFront = (view) => (this.sitting?.kind === "chair" && Math.abs(shortestAngleDiff(this.heading, view)) > SEATED_FRONT_CONE ? 1 : 0);
    if (room(this.cameraHeading) >= need - 0.01 && !fromFront(this.cameraHeading)) return null;
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 16; i++) {
      const view = this.cameraHeading + (i / 16) * Math.PI * 2;
      const turn = Math.abs(shortestAngleDiff(this.cameraHeading, view));
      const score = Math.min(room(view - 0.2), room(view), room(view + 0.2)) - turn * 0.12 - fromFront(view) * 1.2;
      if (score > bestScore) { bestScore = score; best = view; }
    }
    return best;
  }

  stand() {
    if (!this.sitting) return false;
    this.sitting = null;
    this._seatedView = null;
    const p = this.root.position;
    if (this._standSpot && !this._collides(this._standSpot.x, this._standSpot.z)) {
      p.x = this._standSpot.x;
      p.z = this._standSpot.z;
    }
    this._standSpot = null;
    this._unstick();
    return true;
  }

  // ── Simulation ───────────────────────────────────────────────────────────
  /** Advance by a fixed timestep (seconds); called from GroveScene's
   * accumulator so speed does not depend on frame rate. */
  fixedStep(dt) {
    this._jumpBuffer = Math.max(0, this._jumpBuffer - dt);
    if (this.inputLocked) {
      this.collidedThisStep = false;
      this._sitPressed = false;
      this._jumpBuffer = 0;
      this._turnRate = 0;
      this._panRate = 0;
      this._panHeld = 0;
      this._settleVertical(dt, 0);
      this.root.rotation.y = this.heading;
      return;
    }

    const input = this._readInput();
    const fixed = this._fixedView();
    const moving = Math.abs(input.forward) > 0.01 || Math.abs(input.strafe) > 0.01;
    // The arrows are read against the view as it was when this set of
    // arrows went down, and stay that way while they are held: the camera
    // can pan, or be cut to another view at a door, and the character keeps
    // its line. A different set of arrows is read against the view as it is.
    const keys = moving ? `${input.forward},${input.strafe}` : null;
    if (!moving) { this._moveFrame = null; this._moveKeys = null; }
    else if (keys !== this._moveKeys) {
      if (this._moveKeys !== null || this._moveFrame === null) this._moveFrame = fixed ? this.room.heading : this.cameraHeading;
      this._moveKeys = keys;
    }

    if (this._sitPressed) {
      this._sitPressed = false;
      if (this.sitting) this.stand(); else this.sit();
    }
    if (this.sitting) {
      // Walking, or a jump, stands the character up first. Turning the
      // view does not: you can look around from a bench.
      if (moving || this._jumpBuffer > 0) {
        this.stand();
        this._jumpBuffer = 0;
      } else {
        if (input.view) this._seatedView = null;          // the player has taken the view
        else if (this._seatedView !== null && this._seatedView !== undefined) {
          const left = shortestAngleDiff(this.cameraHeading, this._seatedView);
          if (Math.abs(left) < 0.01) this._seatedView = null;
          else this.cameraHeading += left * Math.min(1, SEATED_VIEW_RATE * dt);
        }
        if (fixed) this._holdRoomView(dt); else this._turnView(input.view, false, dt);
        this.velocity.set(0, 0, 0);
        this.collidedThisStep = false;
        this.root.position.y = 0;
        this.root.rotation.y = this.heading;
        return;
      }
    }

    if (fixed) this._holdRoomView(dt); else this._turnView(input.view, moving, dt);

    // The arrows are directions on screen: forward is the way the view
    // looks, right is the right of the screen.
    const frame = this._frame();
    const sin = Math.sin(frame), cos = Math.cos(frame);
    this._moveDir.set(input.forward * sin - input.strafe * cos, 0, input.forward * cos + input.strafe * sin);
    if (this._moveDir.lengthSq() > 1) this._moveDir.normalize();
    if (moving) this.targetHeading = Math.atan2(this._moveDir.x, this._moveDir.z);
    this._followPan(moving && !fixed && !this.firstPerson, input.view !== 0, dt);
    const top = this.room ? ROOM_SPEED : MAX_SPEED;
    const headingDiff = shortestAngleDiff(this.heading, this.targetHeading);
    const turn = THREE.MathUtils.clamp(headingDiff * FACE_GAIN * dt, -FACE_RATE * dt, FACE_RATE * dt);
    this.heading += Math.abs(turn) > Math.abs(headingDiff) ? headingDiff : turn;

    const targetVX = this._moveDir.x * top;
    const targetVZ = this._moveDir.z * top;
    const maxDelta = (moving ? ACCELERATION : DECELERATION) * dt;
    const remainingX = targetVX - this.velocity.x;
    const remainingZ = targetVZ - this.velocity.z;
    const remaining = Math.hypot(remainingX, remainingZ);
    const blend = remaining > 0 ? Math.min(1, maxDelta / remaining) : 1;
    this.velocity.x += remainingX * blend;
    this.velocity.z += remainingZ * blend;

    this._unstick();
    const from = this.root.position;
    const resolved = this._resolveCollision(from.x, from.z, from.x + this.velocity.x * dt, from.z + this.velocity.z * dt);
    this.collidedThisStep = resolved.blocked;
    // Velocity reports what actually happened, so the walk animation never
    // plays for a move a wall just refused.
    this.velocity.x = (resolved.x - from.x) / dt;
    this.velocity.z = (resolved.z - from.z) / dt;
    from.x = resolved.x;
    from.z = resolved.z;

    if (this._jumpBuffer > 0 && this.onGround) {
      this._jumpBuffer = 0;
      this.verticalSpeed = JUMP_SPEED;
      this.onGround = false;
      this._jumpStarted = true;
    }
    this._settleVertical(dt, this._grid()?.groundAt(from.x, from.z) ?? 0);
    this.root.rotation.y = this.heading;
  }

  /** True while the view is the fixed one of a room (the character's own
   * eyes are never fixed: in first person the arrows turn as usual). */
  _fixedView() { return Boolean(this.room) && !this.firstPerson; }

  _holdRoomView(dt) {
    this._turnRate = 0;
    this.cameraHeading += shortestAngleDiff(this.cameraHeading, this.room.heading) * Math.min(1, ROOM_GLIDE * dt);
  }

  /** The view comes slowly round behind the direction of travel. */
  _followPan(walking, manual, dt) {
    if (manual) this._panWait = PAN_AFTER_MANUAL;
    else this._panWait = Math.max(0, this._panWait - dt);
    let wanted = 0;
    if (walking && this._panWait === 0) {
      this._panHeld += dt;
      let diff = shortestAngleDiff(this.cameraHeading, Math.atan2(this._moveDir.x, this._moveDir.z));
      if (Math.abs(diff) > PAN_BEHIND) {
        if (!this._panSide) this._panSide = this._roomierSide();
        diff = this._panSide * Math.abs(diff);
      } else this._panSide = 0;
      if (this._panHeld > PAN_DELAY && Math.abs(diff) > PAN_DEADZONE) {
        wanted = Math.sign(diff) * Math.min(PAN_MAX, Math.max(PAN_MIN, Math.abs(diff) * PAN_GAIN));
      }
    } else if (!walking) {
      this._panHeld = 0;
      this._panSide = 0;
    }
    this._panRate = approach(this._panRate, wanted, wanted === 0 ? PAN_STOP : PAN_EASE, dt);
    if (Math.abs(this._panRate) < 1e-4 && wanted === 0) this._panRate = 0;
    this.cameraHeading += this._panRate * dt;
  }

  /** +1 or -1: the way round with more open floor for the camera to sweep
   * through, for a character walking straight at it. */
  _roomierSide() {
    const grid = this._grid();
    if (!grid) return 1;
    const p = this.root.position;
    const reach = (view) => grid.cameraReach(p.x, p.z, -Math.sin(view), -Math.cos(view), this._cameraDistance, this._lookTargetY, this._cameraHeight);
    return reach(this.cameraHeading + Math.PI / 2) >= reach(this.cameraHeading - Math.PI / 2) ? 1 : -1;
  }

  /** A / D turn the view: gently for the first moment of a press, then at
   * the full rate. */
  _turnView(turn, moving, dt) {
    const sign = Math.sign(turn);
    if (sign !== this._turnSign) { this._turnSign = sign; this._turnHeld = 0; }
    if (sign !== 0) this._turnHeld += dt;
    const full = moving ? TURN_WALKING : TURN_STANDING;
    const wanted = -turn * (this._turnHeld < TURN_TAP_TIME ? Math.min(TURN_TAP, full) : full);   // heading grows to the left
    this._turnRate = approach(this._turnRate, wanted, wanted === 0 ? TURN_STOP : TURN_RAMP, dt);
    if (Math.abs(this._turnRate) < 1e-4 && wanted === 0) this._turnRate = 0;
    this.cameraHeading += this._turnRate * dt;
    if (this._moveFrame !== null) this._moveFrame += this._turnRate * dt;   // turning the view steers, whatever frame the keys are in
  }

  /** Height: whatever is underfoot (a mat, a rug), plus the jump. */
  _settleVertical(dt, ground) {
    this._ground = approach(this._ground, ground, GROUND_FOLLOW, dt);
    if (Math.abs(this._ground - ground) < 0.002) this._ground = ground;
    if (!this.onGround) {
      const rising = this.verticalSpeed > 0;
      const gravity = !rising ? GRAVITY_FALLING : this._keys.has("Space") || this._programmaticJump ? GRAVITY_RISING : GRAVITY_CUT;
      this.verticalSpeed -= gravity * dt;
      this._air += this.verticalSpeed * dt;
      if (this._air <= 0) {
        this._air = 0;
        this.verticalSpeed = 0;
        this.onGround = true;
        this._landed = true;
        this._programmaticJump = false;
      }
    } else {
      this._air = 0;
      this.verticalSpeed = 0;
    }
    this.root.position.y = this._ground + this._air;
  }

  /** Height of the jump alone, without the mat underfoot. */
  get airHeight() { return this._air; }

  /** One-shot flags for the animation layer. */
  consumeJumpStart() { const v = this._jumpStarted; this._jumpStarted = false; return v; }
  consumeLanding() { const v = this._landed; this._landed = false; return v; }

  // ── Camera ───────────────────────────────────────────────────────────────
  /** Called every rendered frame with the render delta. */
  updateCamera(dt) {
    const p = this.root.position;
    this._glideProfile(dt);

    // 1. Follow the player's position with a touch of give.
    this._anchor.x = approach(this._anchor.x, p.x, ANCHOR_FOLLOW, dt);
    this._anchor.z = approach(this._anchor.z, p.z, ANCHOR_FOLLOW, dt);
    this._anchor.y = approach(this._anchor.y, this._ground + this._air * JUMP_FOLLOW, ANCHOR_FOLLOW, dt);

    // 2. The boom: a straight line from the player's shoulders up and back
    // to where the camera would like to be. The camera slides in along it
    // rather than pass through a wall or sit under an awning, and is let
    // back out gently once the way is clear.
    const backX = -Math.sin(this.cameraHeading), backZ = -Math.cos(this.cameraHeading);
    const full = this._cameraDistance;
    const floorArm = Math.min(ARM_MIN, full);
    const boomY = (arm) => this._lookTargetY + (this._cameraHeight - this._lookTargetY) * (arm / full);
    const grid = this.cameraIgnoresWalls || this._fixedView() ? null : this._grid();
    const ax = this._anchor.x, az = this._anchor.z;
    let hard = full, want = full, hitWall = false;
    if (grid) {
      const far = full + ARM_MARGIN, farY = boomY(far);
      const reachAt = (view) => grid.cameraReach(ax, az, -Math.sin(view), -Math.cos(view), far, this._lookTargetY, farY) - ARM_MARGIN;
      hard = THREE.MathUtils.clamp(reachAt(this.cameraHeading), floorArm, full);
      hitWall = grid.reachHitWall;
      want = hard;
      // While the view is turning, feel ahead in the direction the boom is
      // sweeping. A wall it is about to swing into shortens it now, a
      // little at a time, instead of all at once when it arrives.
      const turning = this._turnRate + this._panRate;
      const sweep = Math.abs(turning) > 0.08 ? Math.sign(turning) : 0;
      if (sweep) {
        for (let i = 0; i < WHISKERS.length; i++) {
          want = Math.min(want, Math.max(floorArm, reachAt(this.cameraHeading + sweep * WHISKERS[i])) + WHISKER_SLACK[i]);
        }
      }
    }
    if (dt <= 0) this._arm = want;
    else {
      this._arm = approach(this._arm, want, want >= this._arm ? ARM_RELEASE : ARM_EASE_IN, dt);
      // Whatever the easing says, never behind a wall; an awning gets a quick glide rather than a cut.
      if (this._arm > hard) this._arm = hitWall ? hard : Math.max(hard, approach(this._arm, hard, ARM_DUCK, dt));
    }

    // The camera may look past a column, but must not come to rest inside
    // one: step in until it is in clear air (eased, so passing a column is
    // a small breath rather than a jolt).
    let nudge = 0;
    if (grid) {
      const limit = Math.min(ARM_NUDGE_MAX, this._arm - floorArm);
      while (nudge < limit) {
        const a = this._arm - nudge;
        if (!grid.cameraSpotBlocked(ax + backX * a, az + backZ * a, boomY(a))) break;
        nudge += grid.cell;
      }
    }
    this._armNudge = dt > 0 ? approach(this._armNudge, nudge, ARM_NUDGE_RATE, dt) : nudge;
    const arm = Math.max(floorArm, this._arm - this._armNudge);

    // 3. The crane. With no room behind (the player's back is to a wall),
    // the camera does not close in on the back of their head: it keeps its
    // distance by rising, and looks down and a little ahead. The character
    // stays whole and the floor in front of them stays on screen.
    let camX = ax + backX * arm, camZ = az + backZ * arm;
    const need = Math.min(CRANE_DISTANCE, Math.hypot(full, this._cameraHeight - this._lookTargetY));
    let lift = 0;
    if (Math.hypot(arm, boomY(arm) - this._lookTargetY) < need) {
      let top = this._maxHeight;
      if (grid) top = Math.min(top, grid.ceilingAt(camX, camZ) - 0.4);
      lift = Math.max(0, Math.min(this._lookTargetY + Math.sqrt(Math.max(0, need * need - arm * arm)), top) - boomY(arm));
    }
    // Walking towards the camera: lean in. The camera rises and aims at the
    // floor on the near side of the character, so what they are walking
    // into is on screen.
    const towards = this.inputLocked || this._eye > 0.5 ? 0
      : THREE.MathUtils.clamp((this.velocity.x * backX + this.velocity.z * backZ) / MAX_SPEED, 0, 1);
    this._lead = dt > 0 ? approach(this._lead, towards, LEAD_RATE, dt) : 0;
    {
      let top = this._maxHeight;
      if (grid) top = Math.min(top, grid.ceilingAt(camX, camZ) - 0.4);
      lift = Math.max(lift, Math.min(LEAD_LIFT * this._lead, Math.max(0, top - boomY(arm))));
    }
    this._lift = dt > 0 ? approach(this._lift ?? 0, lift, lift > (this._lift ?? 0) ? 9 : 4, dt) : lift;
    let height = boomY(arm) + this._lift;
    if (grid) height = Math.max(Math.min(height, grid.ceilingAt(camX, camZ) - 0.35), Math.min(1.4, boomY(arm)));
    const craned = THREE.MathUtils.clamp((this._lift - LEAD_LIFT * this._lead) / 1.6, 0, 1);
    const leaning = this._lead * (1 - craned);
    const ahead = this._lookAhead + CRANE_LOOK_AHEAD * craned - LEAD_BACK * leaning;
    let lookX = ax - backX * ahead, lookZ = az - backZ * ahead;
    let lookY = this._lookTargetY + this._lookRise - 0.4 * craned - LEAD_DROP * leaning;

    // 4. Through the character's eyes: the camera moves to the face and
    // looks where the view looks (up the slope on an escalator).
    this._eye = approach(this._eye, this.firstPerson ? 1 : 0, 8, dt);
    if (dt <= 0) this._eye = this.firstPerson ? 1 : 0;
    // Seated, the eyes are lower: on the seat plus the body above the hips.
    const seatedEye = this.sitting ? (this.sitting.kind === "chair" ? this.sitting.y : 0.08) + SEATED_EYE_ABOVE_SEAT : null;
    this._eyeNow = approach(this._eyeNow ?? this._eyeHeight, seatedEye ?? this._eyeHeight, 2.5, dt);
    if (dt <= 0) this._eyeNow = seatedEye ?? this._eyeHeight;
    if (this._eye > 0.001) {
      const e = this._eye;
      const eyeY = this._eyeNow;
      camX = THREE.MathUtils.lerp(camX, ax - backX * EYE_FORWARD, e);
      camZ = THREE.MathUtils.lerp(camZ, az - backZ * EYE_FORWARD, e);
      height = THREE.MathUtils.lerp(height, eyeY, e);
      lookX = THREE.MathUtils.lerp(lookX, ax - backX * 6, e);
      lookZ = THREE.MathUtils.lerp(lookZ, az - backZ * 6, e);
      // Level ground: tipped down by EYE_PITCH. On a ride the slope of the escalator decides instead.
      const tilt = this._eyeSlope !== 0 ? this._eyeSlope : -Math.tan(EYE_PITCH);
      lookY = THREE.MathUtils.lerp(lookY, eyeY + 6 * tilt, e);
    }
    // How much the character is in the camera's face: 1 hides it entirely.
    // With the crane this only happens where a low ceiling stops the camera
    // rising (under a stair, say). A seated character is never hidden.
    const squeezed = 1 - THREE.MathUtils.smoothstep(Math.hypot(arm, height - HEAD_HEIGHT), 1.1, 1.8);
    this.cameraCloseness = Math.max(this._eye, this.sitting ? Math.min(squeezed, 0.3) : squeezed);

    this._desiredCamPos.set(camX, this._anchor.y + height, camZ);
    this._camLookTarget.set(lookX, this._anchor.y + lookY, lookZ);

    // 5. A scene (lift, stairs) may take the camera for a while.
    const o = this.cameraOverride;
    this._override = dt > 0 ? approach(this._override, o ? 1 : 0, OVERRIDE_GLIDE, dt) : (o ? 1 : 0);
    if (o) {
      this._overridePos.set(o.x, o.y, o.z);
      this._overrideLook.set(o.lookX, o.lookY, o.lookZ);
      this._overrideFov = o.fov ?? this._fovBase;
      if (o.cut) this._override = 1;
    }
    let fov = this._fovBase + CRANE_FOV * craned * (1 - this._eye);
    if (this._eyeSlope === 0) fov = THREE.MathUtils.lerp(fov, Math.max(fov, EYE_FOV), this._eye);
    if (this._override > 0.001) {
      const t = THREE.MathUtils.smoothstep(this._override, 0, 1);
      this._desiredCamPos.lerp(this._overridePos, t);
      this._camLookTarget.lerp(this._overrideLook, t);
      this.cameraCloseness *= 1 - t;
      fov = THREE.MathUtils.lerp(fov, this._overrideFov ?? fov, t);
    }

    this.camera.position.copy(this._desiredCamPos);
    this.camera.lookAt(this._camLookTarget);
    this._applyFov(fov);
  }

  /** Turn the view by hand (a mouse or finger drag across the scene).
   * Dragging right looks right. */
  lookBy(pixels) {
    this._seatedView = null;
    if (this._fixedView()) return;            // a room's view is fixed
    this._panWait = PAN_AFTER_MANUAL;
    this.cameraHeading -= pixels * LOOK_DRAG;
    if (this._moveFrame !== null) this._moveFrame -= pixels * LOOK_DRAG;
  }

  /**
   * Put the player somewhere at once, standing, with the view straight
   * behind them (pass keepCamera to leave the view as it is).
   */
  moveTo(x, z, heading = this.heading, { keepCamera = false } = {}) {
    const frame = this._frame();
    this.sitting = null;
    this._standSpot = null;
    this.root.position.set(x, 0, z);
    this.heading = heading;
    this.targetHeading = heading;
    this.velocity.set(0, 0, 0);
    this.verticalSpeed = 0;
    this.onGround = true;
    this._air = 0;
    this._turnRate = 0;
    this.root.rotation.y = heading;
    this._unstick();
    this._ground = this._grid()?.groundAt(this.root.position.x, this.root.position.z) ?? 0;
    this.root.position.y = this._ground;
    if (!keepCamera) {
      this.cameraHeading = heading;
      this._keepFrame(frame);
    }
    this._lead = 0;
    this._panRate = 0;
    this._panSide = 0;
    this._anchor.set(this.root.position.x, this._ground, this.root.position.z);
    this._arm = this._cameraDistance;
    this._lift = 0;
    this._armNudge = 0;
    this.updateCamera(0);
  }

  getPosition() {
    return { x: this.root.position.x, z: this.root.position.z, heading: this.heading };
  }

  /** Reads and clears the one-shot interact press (KeyE). */
  consumeInteractPress() {
    if (!this._interactPressed) return false;
    this._interactPressed = false;
    return true;
  }

  /** Reads and clears the one-shot second-choice press (KeyQ). */
  consumeAltPress() {
    if (!this._altPressed) return false;
    this._altPressed = false;
    return true;
  }

  /** Same signal as pressing E. */
  triggerInteract() {
    this._interactPressed = true;
  }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
  }
}
