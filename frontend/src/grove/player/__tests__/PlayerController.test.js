import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PlayerController, MAX_SPEED, PLAYER_RADIUS, TURN_STANDING, TURN_TAP } from "../PlayerController.js";
import { CollisionGrid } from "../collisionGrid.js";

const listeners = new Map();
globalThis.window = {
  addEventListener(type, handler) { listeners.set(type, handler); },
  removeEventListener(type, handler) {
    if (listeners.get(type) === handler) listeners.delete(type);
  },
};

function controller(colliders = []) {
  return new PlayerController({
    camera: new THREE.PerspectiveCamera(50, 1, 0.1, 100),
    colliders,
    startPosition: { x: 0, z: 0 },
  });
}

/** Runs the game loop as GroveScene does: simulate, then move the camera. */
function play(player, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    player.fixedStep(1 / 60);
    player.updateCamera(1 / 60);
  }
}

/** A 20 m square room, 0.25 m cells, centred on the origin; `paint` marks cells, `mat` gives mat heights in cm. */
function room(paint = () => 0, mat = null) {
  const cell = 0.25, n = 80, min = -10;
  const cells = new Uint8Array(n * n), ground = new Uint8Array(n * n);
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const x = min + (ix + 0.5) * cell, z = min + (iz + 0.5) * cell;
      cells[iz * n + ix] = paint(x, z);
      if (mat) ground[iz * n + ix] = mat(x, z);
    }
  }
  return new CollisionGrid({ cell, minX: min, minZ: min, nx: n, nz: n, cells, ground });
}

test("Up walks the way the view looks, at the set pace, and the view stays put", () => {
  const player = controller();
  player._keys.add("ArrowUp");
  play(player, 1);
  assert.ok(Math.abs(player.velocity.z - MAX_SPEED) < 0.01, "full speed along the view");
  assert.ok(Math.abs(player.root.position.x) < 1e-6);
  assert.ok(player.root.position.z > MAX_SPEED * 0.85, "top speed is reached almost at once");
  assert.equal(player.cameraHeading, 0);
  player._keys.delete("ArrowUp");
  const from = player.root.position.z;
  play(player, 0.5);
  assert.equal(player.velocity.length(), 0);
  assert.ok(player.root.position.z - from < 0.45, "stops within half a metre");
  player.dispose();
});

test("walking straight ahead leaves the view alone; a tap of a side arrow does too", () => {
  const player = controller();
  player._keys.add("ArrowUp");
  play(player, 3);
  player._keys.delete("ArrowUp");
  play(player, 0.5);
  assert.equal(player.cameraHeading, 0, "Up: the view is already behind the character");
  player._keys.add("ArrowLeft");
  play(player, 0.2);
  player._keys.delete("ArrowLeft");
  play(player, 1);
  assert.equal(player.cameraHeading, 0, "a short step to the side does not start the pan");
  player.dispose();
});

test("walking to the side, the view pans slowly round behind the character, who keeps a straight line", () => {
  const player = controller();
  player._keys.add("ArrowLeft");            // the view looks +z, so left of the screen is +x
  play(player, 1);
  const early = player.cameraHeading;
  assert.ok(early > 0.2 && early < 1.0, `after a second it has begun to come round (${THREE.MathUtils.radToDeg(early).toFixed(0)} degrees)`);
  let fastest = 0, last = player.cameraHeading;
  for (let i = 0; i < 240; i++) {
    player.fixedStep(1 / 60); player.updateCamera(1 / 60);
    fastest = Math.max(fastest, (player.cameraHeading - last) * 60); last = player.cameraHeading;
  }
  assert.ok(fastest <= THREE.MathUtils.degToRad(61), "never faster than 60 degrees a second");
  assert.ok(Math.abs(player.cameraHeading - Math.PI / 2) < 0.12, "after five seconds the view is behind the character, looking the way it walks");
  assert.ok(Math.abs(player.root.position.z) < 1e-6 && player.root.position.x > 18, "and the character has walked a straight line the whole time, not a curve");
  // Let go: the pan stops. Press Up: that is now straight on, the way the view looks.
  player._keys.delete("ArrowLeft");
  play(player, 1);
  const settled = player.cameraHeading;
  play(player, 1);
  assert.equal(player.cameraHeading, settled, "standing still, the view stays where it is");
  const x = player.root.position.x;
  player._keys.add("ArrowUp");
  play(player, 1);
  assert.ok(player.root.position.x > x + 3, "Up now carries on the same way");
  player.dispose();
});

test("walking towards the camera, the view comes right round, to one side and without changing its mind", () => {
  const player = controller();
  player._keys.add("ArrowDown");
  let last = 0, direction = 0, flipped = false;
  for (let i = 0; i < 420; i++) {
    player.fixedStep(1 / 60); player.updateCamera(1 / 60);
    const step = Math.sign(player.cameraHeading - last); last = player.cameraHeading;
    if (step !== 0) { if (direction && step !== direction) flipped = true; direction = direction || step; }
  }
  assert.ok(!flipped, "it goes round one way");
  assert.ok(Math.abs(Math.abs(player.cameraHeading) - Math.PI) < 0.15, "after seven seconds it is behind the character");
  assert.ok(Math.abs(player.root.position.x) < 1e-6 && player.root.position.z < -25, "the character walked straight towards where the camera was");
  player.dispose();
});

test("turning the view by hand holds the follow pan off for a moment", () => {
  const player = controller();
  player._keys.add("ArrowLeft");
  play(player, 0.2);
  player.lookBy(10);                        // a drag
  const after = player.cameraHeading;
  play(player, 1);
  assert.equal(player.cameraHeading, after, "left where the player put it");
  play(player, 1.5);
  assert.notEqual(player.cameraHeading, after, "then it follows again");
  player.dispose();
});

test("Left and Right walk to the left and right of the screen", () => {
  const player = controller();
  player._keys.add("ArrowRight");
  play(player, 1);
  // The view looks towards +z, so the right of the screen is -x.
  assert.ok(player.root.position.x < -MAX_SPEED * 0.85, "Right walks right, at full pace");
  assert.ok(Math.abs(player.root.position.z) < 1e-6, "in a straight line across the screen");
  assert.ok(Math.abs(player.heading + Math.PI / 2) < 0.05, "the character turns to face the way it walks");
  const left = controller();
  left._keys.add("ArrowLeft");
  play(left, 1);
  assert.ok(left.root.position.x > MAX_SPEED * 0.85 && Math.abs(left.root.position.z) < 1e-6, "Left walks left");
  const both = controller();
  both._keys.add("ArrowUp");
  both._keys.add("ArrowLeft");
  play(both, 1);
  const { x, z } = both.root.position;
  assert.ok(Math.abs(x - z) < 1e-6 && x > 2.5, "Up with Left is the diagonal between them");
  assert.ok(Math.abs(Math.hypot(both.velocity.x, both.velocity.z) - MAX_SPEED) < 0.05, "at the same pace, not faster");
  player.dispose(); left.dispose(); both.dispose();
});

test("a tap of an arrow is a small step", () => {
  const player = controller();
  player._keys.add("ArrowLeft");
  play(player, 0.1);
  player._keys.delete("ArrowLeft");
  play(player, 0.5);
  assert.ok(player.root.position.x > 0.1 && player.root.position.x < 0.6, `a tap moves ${player.root.position.x.toFixed(2)} m`);
  player.dispose();
});

test("A and D turn the view: held, a steady sweep that stops on release", () => {
  const player = controller();
  player._keys.add("KeyA");
  play(player, 1);
  assert.ok(player.cameraHeading > TURN_STANDING * 0.6 && player.cameraHeading <= TURN_STANDING, "about 105 degrees a second when held");
  assert.equal(player.root.position.x, 0);
  assert.equal(player.root.position.z, 0);
  assert.equal(player.heading, 0, "the character stays as it was; the view goes round it");
  player._keys.delete("KeyA");
  play(player, 1.3);
  const settled = player.cameraHeading;
  play(player, 0.5);
  assert.equal(player.cameraHeading, settled, "and stops when the key is let go");
  player._keys.add("KeyD");
  play(player, 0.5);
  assert.ok(player.cameraHeading < settled, "D turns the other way");
  player.dispose();
});

test("a tap of A or D is a small nudge of the view, not a swing", () => {
  const player = controller();
  player._keys.add("KeyD");
  play(player, 0.1);
  player._keys.delete("KeyD");
  play(player, 1);
  const nudge = THREE.MathUtils.radToDeg(-player.cameraHeading);
  assert.ok(nudge > 1.5 && nudge < 8, `a tap turns the view ${nudge.toFixed(1)} degrees`);
  // Held, the first moment is at the tap rate and only then does it speed up.
  const held = controller();
  held._keys.add("KeyD");
  play(held, 0.15);
  assert.ok(-held.cameraHeading < TURN_TAP * 0.15, "starts gently");
  player.dispose();
  held.dispose();
});

test("in a room the view is fixed: the arrows walk as usual, and the view cannot be turned", () => {
  const player = controller();
  player.moveTo(0, 0, 0);
  player.setRoom({ heading: Math.PI }, { snap: true });      // the view looks towards -z
  player._keys.add("ArrowUp");
  play(player, 1);
  player._keys.delete("ArrowUp");
  assert.ok(player.root.position.z < -3 && Math.abs(player.root.position.x) < 1e-6, "Up walks into the room");
  player._keys.add("ArrowRight");
  play(player, 1);
  player._keys.delete("ArrowRight");
  assert.ok(player.root.position.x > 3, "Right walks to the right of the screen (which is +x when looking towards -z)");
  assert.ok(Math.abs(Math.abs(player.cameraHeading) - Math.PI) < 1e-6, "and the view has not turned");
  assert.ok(Math.abs(player.heading - Math.PI / 2) < 0.1, "the character faces the way it walked");
  player._keys.add("ArrowDown");
  const z = player.root.position.z;
  play(player, 0.5);
  player._keys.delete("ArrowDown");
  assert.ok(player.root.position.z > z + 1, "Down walks back towards the viewer");
  player._keys.add("KeyA");
  play(player, 0.5);
  player._keys.delete("KeyA");
  assert.ok(Math.abs(Math.abs(player.cameraHeading) - Math.PI) < 1e-6, "A cannot turn a room's view");
  player.setRoom(null);
  player._keys.add("KeyA");
  play(player, 0.5);
  assert.ok(Math.abs(Math.abs(player.cameraHeading) - Math.PI) > 0.2, "outside a room, A turns the view again");
  player.dispose();
});

test("a ride profile aims the view ahead of the character, up or down the slope", () => {
  const player = controller();
  player.moveTo(0, 0, 0);
  player.setCameraProfile({ distance: 4.4, height: 1.75, lookAhead: 5, lookRise: 1.6 }, { snap: true });
  player.updateCamera(0);
  const dir = new THREE.Vector3();
  player.camera.getWorldDirection(dir);
  assert.ok(dir.y > 0.08, "looking up the escalator, not down at the steps");
  player.setCameraProfile({ distance: 3.4, height: 3.6, lookAhead: 6, lookRise: -2.2 }, { snap: true });
  player.updateCamera(0);
  player.camera.getWorldDirection(dir);
  assert.ok(dir.y < -0.3, "looking out and down on the way down");
  player.dispose();
});

test("turning the view while walking steers: Up with A is a curve", () => {
  const player = controller();
  player._keys.add("ArrowUp");
  player._keys.add("KeyA");
  play(player, 2);
  assert.ok(player.cameraHeading > 1.8, "turned about a third of the way round");
  assert.ok(Math.abs(player.heading - player.cameraHeading) < 0.2, "the character heads where the view looks");
  assert.ok(Math.abs(player.velocity.length() - MAX_SPEED) < 0.05);
  assert.ok(Math.hypot(player.root.position.x, player.root.position.z) > 3, "a curve with room in it, not a spin");
  player.dispose();
});

test("a held key keeps its meaning when the view is changed for you, until it is let go", () => {
  const player = controller();
  player._keys.add("ArrowDown");                // walking towards the camera: -z
  play(player, 0.5);
  const z = player.root.position.z;
  assert.ok(z < -1);
  // A door: the player is put down somewhere else with the view turned right round.
  player.moveTo(10, 0, Math.PI);
  play(player, 0.5);
  assert.ok(player.root.position.z < -1.5 && Math.abs(player.root.position.x - 10) < 1e-6, "still walking the way it was going (-z), though that is now away from the camera");
  player._keys.delete("ArrowDown");
  play(player, 0.2);
  player._keys.add("ArrowDown");
  const from = player.root.position.z;
  play(player, 0.5);
  assert.ok(player.root.position.z > from + 1, "pressed afresh, Down is towards the camera again");
  // The same through a room's fixed view.
  const other = controller();
  other._keys.add("ArrowUp");
  play(other, 0.3);
  other.setRoom({ heading: Math.PI / 2 }, { snap: true });
  const before = other.root.position.clone();
  play(other, 0.5);
  assert.ok(other.root.position.z > before.z + 1 && Math.abs(other.root.position.x - before.x) < 1e-6, "Up goes on walking +z");
  player.dispose();
  other.dispose();
});

test("walking towards the camera, the view first lifts and looks at the floor in front of the character", () => {
  const player = controller();
  player.moveTo(0, 0, 0);
  play(player, 0.5);
  const restY = player.camera.position.y;
  const dir = new THREE.Vector3();
  player.camera.getWorldDirection(dir);
  const restPitch = dir.y;
  player._keys.add("ArrowDown");
  play(player, 0.8);                        // before the pan has taken the view far round
  player.camera.getWorldDirection(dir);
  assert.ok(player.camera.position.y > restY + 0.5, "the camera rises");
  assert.ok(dir.y < restPitch - 0.12, "and looks down at the floor on the near side");
  player._keys.delete("ArrowDown");
  play(player, 3);
  assert.ok(Math.abs(player.camera.position.y - restY) < 0.1, "and settles back when they stop");
  player.dispose();
});

test("Down walks back toward the viewer", () => {
  const player = controller();
  player._keys.add("ArrowDown");
  play(player, 1.5);
  assert.ok(player.root.position.z < -5, "toward the camera, at full pace");
  assert.ok(Math.abs(player.root.position.x) < 1e-6);
  assert.ok(Math.abs(Math.abs(player.heading) - Math.PI) < 0.05, "the character turns to face the way it walks");
  player.dispose();
});

test("Space jumps at once; letting go early makes a shorter hop", () => {
  const full = controller();
  full._keys.add("Space");
  full._onKeyDown({ code: "Space", repeat: false, preventDefault() {}, target: null });
  let peak = 0;
  for (let i = 0; i < 90; i++) {
    full.fixedStep(1 / 60);
    if (i === 0) assert.ok(full.root.position.y > 0, "airborne on the first step");
    peak = Math.max(peak, full.root.position.y);
  }
  assert.ok(peak > 1.0 && peak < 1.25, `full jump peaks near 1.1 m (got ${peak.toFixed(2)})`);
  assert.equal(full.root.position.y, 0);
  assert.ok(full.onGround);
  full.dispose();

  const tap = controller();
  tap._onKeyDown({ code: "Space", repeat: false, preventDefault() {}, target: null });
  tap._keys.delete("Space");
  let hop = 0;
  for (let i = 0; i < 90; i++) { tap.fixedStep(1 / 60); hop = Math.max(hop, tap.root.position.y); }
  assert.ok(hop > 0.3 && hop < peak * 0.75, `a tap is a hop (got ${hop.toFixed(2)})`);
  tap.dispose();
});

test("solid cells stop the player and walls are slid along", () => {
  // A wall across the room at z = 4..4.5, and no floor beyond x = 6.
  const grid = room((x, z) => (z > 4 && z < 4.5 ? 3 : x > 6 ? 1 : 0));
  const player = controller([grid]);
  player._keys.add("ArrowUp");
  play(player, 3);
  assert.ok(player.root.position.z <= 4 - PLAYER_RADIUS + 1e-6, "stopped at the wall");
  assert.ok(player.root.position.z > 3.4);
  player._keys.delete("ArrowUp");
  play(player, 0.05);
  player.moveTo(0, 3, Math.PI / 4);   // now the view meets the wall at an angle
  player._keys.add("ArrowUp");
  play(player, 4);
  assert.ok(player.root.position.x > 3, "slides along the wall");
  assert.ok(player.root.position.x <= 6 - PLAYER_RADIUS + 1e-6, "and never steps off the floor");
  player.dispose();
});

test("feet stand on top of a mat, not in it", () => {
  // A 12 cm doormat across z = 2..3.
  const grid = room(() => 0, (x, z) => (z > 2 && z < 3 ? 12 : 0));
  const player = controller([grid]);
  assert.equal(player.root.position.y, 0);
  player._keys.add("ArrowUp");
  play(player, 0.62);                   // onto the mat
  assert.ok(player.root.position.z > 2.2 && player.root.position.z < 2.9);
  assert.ok(Math.abs(player.root.position.y - 0.12) < 0.01, `standing on the mat (y = ${player.root.position.y.toFixed(3)})`);
  play(player, 0.5);                    // and off the far side
  assert.ok(player.root.position.z > 3.3);
  assert.ok(player.root.position.y < 0.01);
  player.dispose();
});

test("a player dropped inside something solid steps out to open floor", () => {
  const grid = room((x, z) => (Math.hypot(x, z) < 1 ? 1 : 0));
  const player = controller([grid]);
  player.moveTo(0.2, 0);
  assert.ok(!player._collides(player.root.position.x, player.root.position.z));
  assert.ok(Math.hypot(player.root.position.x, player.root.position.z) < 1.7);
  player.dispose();
});

test("the camera shortens for a wall behind the player, and says the character is in the way", () => {
  const far = room((x, z) => (z < -5 && z > -5.5 ? 3 : 0));
  const player = controller([far]);
  player.moveTo(0, 0, 0);
  assert.ok(player.camera.position.z > -5, "in front of the wall");
  assert.ok(player.camera.position.z < -3.5, "but as far back as the wall allows");
  assert.equal(player.cameraCloseness, 0, "still a comfortable distance");

  // A wall right behind: the camera does not press against the back of the
  // head. It rises instead, and the character is not faded out.
  const near = room((x, z) => (z < -1.5 && z > -2 ? 3 : 0));
  const pinned = controller([near]);
  pinned.moveTo(0, 0, 0);
  assert.ok(pinned.camera.position.z > -1.5, "in front of the wall");
  assert.ok(pinned.camera.position.y > 4, `craned up over the character (y = ${pinned.camera.position.y.toFixed(2)})`);
  assert.equal(pinned.cameraCloseness, 0, "the character stays solid");
  const down = new THREE.Vector3();
  pinned.camera.getWorldDirection(down);
  assert.ok(down.y < -0.6 && down.z > 0.2, "looking down and a little ahead");
  player.dispose();
  pinned.dispose();
});

test("the camera ducks under an awning and looks past a column", () => {
  // An awning 2.6 m up across z = -5..-4 (overhead code 10), walkable beneath.
  const awning = room((x, z) => (z < -4 && z > -5 ? 10 << 3 : 0));
  const player = controller([awning]);
  player.moveTo(0, 0, 0);
  const cam = player.camera.position;
  assert.ok(cam.z > -4.1, "stays on the player's side of the awning");
  assert.ok(cam.y < 2.6, "and under it");

  // A column (slim, wall-height) directly behind the player does not pull the camera in.
  const column = room((x, z) => (Math.abs(x) < 0.4 && z < -3 && z > -3.8 ? 1 | 4 | (3 << 3) : 0));
  const other = controller([column]);
  other.moveTo(0, 0, 0);
  assert.ok(other.camera.position.z < -6, "the column is looked past");
  player.dispose();
  other.dispose();
});

test("zone profiles glide, the first-person view sits at the eyes, and a scene can take the camera", () => {
  const player = controller();
  player.moveTo(0, 0, 0);
  const start = player.camera.position.z;
  player.setCameraProfile({ distance: 4.4, height: 2.35 });
  play(player, 0.2);
  assert.ok(player.camera.position.z > start + 0.5 && player.camera.position.z < -4.5, "on its way, not there yet");
  play(player, 2.5);
  assert.ok(Math.abs(player.camera.position.z + 4.4) < 0.05);

  player.firstPerson = true;
  play(player, 1);
  assert.ok(Math.abs(player.camera.position.z) < PLAYER_RADIUS && Math.abs(player.camera.position.y - 1.55) < 0.02, "at the eyes, inside the body's own footprint");
  assert.ok(player.cameraCloseness > 0.99, "the character is hidden");
  player.firstPerson = false;
  play(player, 1.5);

  player.cameraOverride = { x: 6, y: 2, z: 6, lookX: 0, lookY: 1, lookZ: 0 };
  play(player, 3);
  assert.ok(player.camera.position.distanceTo(new THREE.Vector3(6, 2, 6)) < 0.02);
  player.cameraOverride = null;
  play(player, 3);
  assert.ok(Math.abs(player.camera.position.z + 4.4) < 0.05, "and gives it back");
  player.dispose();
});

test("Shift sits: facing by the seat's rule, at its front edge; walking stands back up", () => {
  const player = controller();
  // A chair with a back: faces away from the back, whatever side you came from.
  player.setSeats([{ x: 1, z: 0, y: 0.42, heading: Math.PI / 2, depth: 0.5 }]);
  player.triggerSit();
  player.fixedStep(1 / 60);
  assert.equal(player.sitting.kind, "chair");
  assert.ok(Math.abs(player.heading - Math.PI / 2) < 1e-6);
  assert.ok(Math.abs(player.root.position.x - 1.15) < 1e-6, "sits at the front edge of the seat");
  player.triggerSit();
  player.fixedStep(1 / 60);
  assert.equal(player.sitting, null);
  assert.ok(Math.abs(player.root.position.x) < 1e-6, "stands back where they were");

  // A bench at a table (the table is on its -z side): faces the table even though the player is on the other side.
  player.moveTo(0, 1.2, Math.PI);
  player.setSeats([{ x: 0, z: 0, y: 0.42, heading: Math.PI, table: true, side: null, depth: 0.4 }]);
  player.triggerSit();
  player.fixedStep(1 / 60);
  assert.ok(Math.abs(Math.abs(player.heading) - Math.PI) < 1e-6, "turned to the table");
  assert.ok(player.root.position.z < 0, "and sat on the table side of the bench");

  // Turning the view does not stand you up; walking does.
  player._keys.add("KeyA");
  play(player, 0.3);
  assert.equal(player.sitting.kind, "chair");
  player._keys.delete("KeyA");

  player.setSeats([]);
  player.triggerSit(); player.fixedStep(1 / 60);     // stand
  player.triggerSit(); player.fixedStep(1 / 60);     // nothing near: sit on the floor
  assert.equal(player.sitting.kind, "floor");
  player._keys.add("ArrowUp");
  play(player, 0.3);
  assert.equal(player.sitting, null);
  player.dispose();
});

test("sitting with a wall right behind swings the view to a clear side, and never hides the sitter", () => {
  const WALL = 3;
  const player = controller([room((x, z) => (z < -1 ? WALL : 0))]);
  player.setSeats([{ name: "Bench", x: 0, z: -0.5, y: 0.42, heading: 0, side: null, depth: 0.5, table: false }]);
  player.moveTo(0, 0.3, 0);
  play(player, 0.5);
  assert.ok(player.sit());
  play(player, 2);
  assert.equal(player.heading, 0, "faces away from the wall, as the seat says");
  const off = Math.abs(Math.atan2(Math.sin(player.cameraHeading), Math.cos(player.cameraHeading)));
  assert.ok(off > 0.9 && off < 2.0, `the view has swung to a side (${off.toFixed(2)} rad)`);
  assert.ok(Math.hypot(player.camera.position.x - player.root.position.x, player.camera.position.z - player.root.position.z) > 2.5, "with room to see the character");
  assert.ok(player.cameraCloseness <= 0.3);
  player.dispose();
});

test("sitting in the open leaves the view alone", () => {
  const player = controller([room()]);
  player.setSeats([{ name: "Bench", x: 0, z: 0.5, y: 0.42, heading: 0, side: null, depth: 0.5, table: false }]);
  player.moveTo(0, 0, 0);
  assert.ok(player.sit());
  play(player, 1);
  assert.equal(player.cameraHeading, 0);
  player.dispose();
});

test("turning the view towards a wall shortens the boom before it gets there, without a jump", () => {
  // A wall along x = -4 (to the player's left when the view looks +z): swinging the view to the right sweeps the boom into it.
  const player = controller([room((x) => (x < -4 ? 3 : 0))]);
  player.moveTo(0, 0, 0);
  play(player, 0.5);
  player._keys.add("KeyD");
  let worst = 0, last = Math.hypot(player.camera.position.x, player.camera.position.z);
  for (let i = 0; i < 90; i++) {
    player.fixedStep(1 / 60);
    player.updateCamera(1 / 60);
    const arm = Math.hypot(player.camera.position.x, player.camera.position.z);
    worst = Math.max(worst, last - arm);
    last = arm;
    assert.ok(player.camera.position.x > -4, "never behind the wall");
  }
  assert.ok(worst < 0.2, `the boom shortens smoothly (largest step ${worst.toFixed(2)} m)`);
  player.dispose();
});

test("through the eyes, sitting lowers the eyes to seat height and looks the way the seat faces", () => {
  const player = controller();
  player.setSeats([{ x: 1, z: 0, y: 0.42, heading: Math.PI / 2, depth: 0.5 }]);
  player.firstPerson = true;
  play(player, 0.5);
  const standing = player.camera.position.y;
  player.triggerSit();
  play(player, 2.5);
  assert.equal(player.sitting.kind, "chair");
  assert.ok(Math.abs(player.camera.position.y - (0.42 + 1.0)) < 0.03, `eyes at seat height (${player.camera.position.y.toFixed(2)})`);
  assert.ok(player.camera.position.y < standing - 0.1);
  assert.ok(Math.abs(Math.sin(player.cameraHeading - Math.PI / 2)) < 0.05 && Math.cos(player.cameraHeading - Math.PI / 2) > 0, "looking the way the seat faces");
  // Back behind and in again while seated: the eyes still look along the seat, not at whatever was behind.
  player.cameraHeading = -Math.PI / 2;
  player._onKeyDown({ code: "KeyV", repeat: false }); play(player, 0.5);
  player._onKeyDown({ code: "KeyV", repeat: false }); play(player, 2.5);
  assert.ok(player.firstPerson);
  assert.ok(Math.cos(player.cameraHeading - Math.PI / 2) > 0.99, "turned back to the seat's way");
  player.dispose();
});

test("through the eyes, a knee-high thing a metre and a bit ahead is in the picture", () => {
  const player = controller();
  player.firstPerson = true;
  play(player, 1);
  player.camera.updateMatrixWorld(true);
  for (const [ahead, height] of [[1.2, 0.45], [1.0, 0.9], [3, 0]]) {
    const p = new THREE.Vector3(0, height, ahead).project(player.camera);
    assert.ok(p.y > -1 && p.y < 1 && Math.abs(p.x) < 1, `${height} m up, ${ahead} m ahead is on screen (y ${p.y.toFixed(2)})`);
  }
  player.dispose();
});
