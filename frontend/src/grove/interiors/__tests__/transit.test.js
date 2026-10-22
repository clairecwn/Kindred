import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createTransit, TRANSIT } from "../transit.js";

/** A stand-in for the lift rig the model provides. */
function rig() {
  const root = new THREE.Group();
  const car = new THREE.Object3D(); car.name = "LIFT_Car"; car.position.set(25, 0, 0); root.add(car);
  const doors = [];
  for (let level = 1; level <= 3; level++) {
    for (const [tag, z] of [["A", 0.52], ["B", -0.52]]) {
      const door = new THREE.Object3D(); door.name = `LIFT_L${level}_Door_${tag}`; door.position.set(22.98, (level - 1) * 5 + 1.35, z);
      root.add(door); doors.push(door);
    }
  }
  return { root, car, doors };
}

function run(scene, watch = () => {}) {
  let pose, seconds = 0;
  do { pose = scene.advance(1 / 60); seconds += 1 / 60; watch(pose, seconds); } while (!pose.done && seconds < 60);
  return { pose, seconds };
}

test("the lift scene: car comes, doors open, the rider goes in, rides and walks out on the right level", () => {
  const { root, car, doors } = rig();
  const transit = createTransit(root);
  assert.ok(transit.hasLiftRig);
  // Leave the car on level 3 first, so the next call has to bring it down.
  run(transit.startLift(0, 2, { x: 21.5, z: 0 }));
  assert.equal(car.position.y, 10);
  assert.equal(transit.carFloor, 2);

  const seen = { carMoved: false, doorOpenAtStart: 0, insideAt: null, maxY: 0, wentInside: false };
  const scene = transit.startLift(0, 1, { x: 19, z: 1.5 });
  const { pose, seconds } = run(scene, (p) => {
    if (car.position.y > 0.1 && car.position.y < 9.9) seen.carMoved = true;
    if (Math.abs(p.x - TRANSIT.lift.inside.x) < 0.01) seen.wentInside = true;
    seen.maxY = Math.max(seen.maxY, p.y);
    // The doors of the level the rider is on never open while the car is elsewhere.
    if (doors[0].scale.z < 0.99) assert.ok(Math.abs(car.position.y) < 0.01, "level 1 doors only open with the car there");
  });
  assert.ok(seen.carMoved, "the car is shown coming to the caller");
  assert.ok(seen.wentInside);
  assert.equal(pose.y, 5, "arrives on level 2");
  assert.equal(car.position.y, 5);
  assert.equal(pose.exitFloor, 1);
  const out = TRANSIT.lift.out[TRANSIT.lift.out.length - 1];
  assert.ok(Math.abs(pose.x - out.x) < 0.01 && Math.abs(pose.z - out.z) < 0.01, "let go clear of the doors");
  assert.ok(Math.abs(pose.viewHeading - pose.heading) < 1e-6, "with the view behind the way they are facing");
  assert.ok(seconds > 6 && seconds < 16, `a short scene (${seconds.toFixed(1)} s)`);
  for (let i = 0; i < 120; i++) transit.update(1 / 60);
  for (const door of doors) assert.ok(Math.abs(door.scale.z - 1) < 1e-6, "every door ends shut");
});

test("the stair scene walks both flights and the landing, up and down", () => {
  const transit = createTransit(new THREE.Group());
  const up = run(transit.startStairs(0, 1, { x: -8.5, z: 14.5, heading: 0 }), (p) => {
    assert.ok(p.y >= -1e-9 && p.y <= 5 + 1e-9);
    if (Math.abs(p.z - 20.75) < 0.05) assert.ok(Math.abs(p.y - 2.5) < 1e-6, "the half landing is level");
  });
  assert.equal(up.pose.y, 5);
  assert.ok(Math.abs(up.pose.x + 7.65) < 1e-6 && Math.abs(up.pose.z - 15.2) < 1e-6, "steps off the upper flight");
  assert.ok(up.seconds > 4 && up.seconds < 9);

  const down = run(transit.startStairs(2, 0, { x: -7.6, z: 14.8, heading: 0 }));
  assert.equal(down.pose.y, 0, "two levels down in one go");
  assert.ok(Math.abs(down.pose.x + 9.35) < 1e-6 && Math.abs(down.pose.z - 15.2) < 1e-6, "steps off the lower flight");
  assert.equal(down.pose.exitFloor, 0);
});

test("the lift doors stay open until the rider is inside and facing out, with the game's own door update running", () => {
  const { root, doors } = rig();
  const transit = createTransit(root);
  const scene = transit.startLift(0, 1, { x: 21.5, z: 0 });
  const DOOR_X = 22.98;
  let pose, seconds = 0, sawInside = false, closedWhileCrossing = false, facedOutBeforeClosing = false, wasOpen = false;
  do {
    transit.update(1 / 60);              // the game calls this every frame, scene or not
    pose = scene.advance(1 / 60);
    seconds += 1 / 60;
    const openNow = doors[0].scale.z < 0.5;
    if (openNow) wasOpen = true;
    const riding = pose.y > 0.01;
    // Before the ride: is the character anywhere near the door line while the doors are not open?
    if (!riding && wasOpen && !sawInside && pose.x > DOOR_X - 0.7 && pose.x < DOOR_X + 0.9 && !openNow) closedWhileCrossing = true;
    if (Math.abs(pose.x - TRANSIT.lift.inside.x) < 0.01) {
      sawInside = true;
      if (openNow && Math.abs(Math.abs(pose.heading) - Math.PI / 2) < 0.05 && pose.heading < 0) facedOutBeforeClosing = true;
    }
  } while (!pose.done && seconds < 60);
  assert.ok(wasOpen && sawInside);
  assert.ok(!closedWhileCrossing, "the doors never close on the character");
  assert.ok(facedOutBeforeClosing, "they close only after the character has turned to face them");
  assert.ok(TRANSIT.lift.insideCamera.x - TRANSIT.lift.inside.x > 1.8, "the ride is seen from well behind the character, not in their face");
});

test("stairs are taken by walking into a flight, like an escalator", () => {
  const transit = createTransit(new THREE.Group());
  assert.equal(transit.stairsAt(0, -9.35, 15.8, 3), "up");
  assert.equal(transit.stairsAt(1, -9.35, 15.8, 3), "up");
  assert.equal(transit.stairsAt(2, -9.35, 15.8, 3), null, "nothing above level 3");
  assert.equal(transit.stairsAt(1, -7.65, 15.8, 3), "down");
  assert.equal(transit.stairsAt(2, -7.65, 15.8, 3), "down");
  assert.equal(transit.stairsAt(0, -7.65, 15.8, 3), null, "nothing below level 1");
  assert.equal(transit.stairsAt(0, -9.35, 15.8, 0), null, "standing at the foot does nothing");
  assert.equal(transit.stairsAt(0, -9.35, 15.8, -3), null, "nor does walking away from it");
  assert.equal(transit.stairsAt(0, -9.35, 14.6, 3), null, "nor walking past, short of the flight");
  // Arriving at the top of a flight leaves the rider outside both lanes' triggers unless they turn round and walk back in.
  const up = transit.startStairs(0, 1, { x: -9.35, z: 15.8, heading: 0 });
  let pose; let n = 0;
  do { pose = up.advance(1 / 60); n++; } while (!pose.done && n < 3600);
  assert.equal(pose.y, 5);
  assert.equal(transit.stairsAt(1, pose.x, pose.z, pose.vz), null);
});

test("the stairs are watched from the side, across the open well, with nothing in between", () => {
  const transit = createTransit(new THREE.Group());
  const scene = transit.startStairs(0, 1, { x: -9.35, z: 15.8, heading: 0 });
  let pose, n = 0;
  do {
    pose = scene.advance(1 / 60); n++;
    const cam = pose.camera;
    assert.ok(cam, "the scene has its own camera all the way");
    assert.ok(cam.x > -6.7 && cam.x < 10 && cam.z > 16.3 && cam.z < 21.7, "in the open well east of the flights");
    assert.ok(cam.x - pose.x > 8, "well back from the climber");
    assert.ok(Math.abs(cam.lookZ - cam.z) < 0.01, "looking square on at the stair");
  } while (!pose.done && n < 3600);
  assert.ok(TRANSIT.stairs.camera.fov < 45, "a long lens, so both flights fit");
});

test("the lift waits at its panel: a number key picks the level, E or the same level steps back out", () => {
  const { root, car, doors } = rig();
  const transit = createTransit(root);
  const until = (scene, stop) => { let pose, s = 0; do { transit.update(1 / 60); pose = scene.advance(1 / 60); s += 1 / 60; } while (!stop(pose) && !pose.done && s < 60); return { pose, s }; };

  // Called from level 2: it waits at the panel with the doors open, as long as it takes.
  let scene = transit.startLift(1, null, { x: 21.5, z: 0 });
  let { pose } = until(scene, (p) => p.awaiting);
  assert.ok(pose.awaiting && scene.awaiting, "waits for a level");
  assert.equal(pose.camera, TRANSIT.lift.panelCamera, "looking at the panel");
  for (let i = 0; i < 300; i++) { transit.update(1 / 60); pose = scene.advance(1 / 60); }
  assert.ok(pose.awaiting && !pose.done && doors[2].scale.z < 0.5, "doors stay open while waiting");
  assert.ok(scene.choose(2), "3 is pressed");
  assert.ok(!scene.choose(0), "only one choice");
  ({ pose } = until(scene, () => false));
  assert.equal(pose.y, 10); assert.equal(pose.exitFloor, 2); assert.equal(car.position.y, 10);

  // E: back out on the same level, no ride.
  scene = transit.startLift(2, null, { x: 21.5, z: 0 });
  until(scene, (p) => p.awaiting);
  assert.ok(scene.exit());
  let maxY = 10;
  ({ pose } = until(scene, (p) => { maxY = Math.max(maxY, p.y); return false; }));
  assert.ok(pose.done && pose.exitFloor === 2 && pose.y === 10 && maxY === 10, "stepped out where they got in");

  // The button for the level the car is on does the same.
  scene = transit.startLift(2, null, { x: 21.5, z: 0 });
  until(scene, (p) => p.awaiting);
  assert.ok(scene.choose(2));
  ({ pose } = until(scene, () => false));
  assert.ok(pose.done && pose.exitFloor === 2 && pose.y === 10);
});
