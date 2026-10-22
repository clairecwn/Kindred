// src/grove/interiors/transit.js
//
// The lift and the stairs as short played-out scenes, the way a Mario Party
// board handles a pipe or a lift: the player picks it, control is taken for
// a few seconds, and the character is shown making the trip.
//
//   Lift    there is no prompt. Stand at the lift doors for a second and
//           the car comes, the doors open and the character walks in to the
//           button panel. The view is over their shoulder onto the panel:
//           a screen with the level the car is on and three buttons. The
//           number keys 1, 2 and 3 press the button for that level (it
//           lights up), the character turns to the doors, they close, and
//           the screen counts the levels as the car moves. E steps back out
//           on the same level. The ride ends with the doors opening and the
//           character walking out.
//   Stairs  the character walks the real flights, round the half landing,
//           and steps off on the next level, watched from the side across
//           the open well. Stairs are not chosen from a prompt: like an
//           escalator, walking onto the foot (or the head) of a flight
//           starts the trip (stairsAt).
//
// Like an escalator ride, a scene never changes the player's own height:
// the mall slides down or up past them instead (the caller sets the mall's
// offset from pose.y). The camera is the scene's own, handed to
// PlayerController through cameraOverride, placed where no floor slab can
// come between it and the character on the way.
//
// The lift rig comes from the model (p04_circulation.py): LIFT_Car and
// LIFT_L<level>_Door_A / _B. Without those nodes the lift still works; it
// simply has no moving parts to show.

import * as THREE from "three";

export const TRANSIT = Object.freeze({
  lift: Object.freeze({
    call: { x: 21.5, z: 0 },        // where you stand to call it
    callRadius: 1.2,                // stand within this of the call point...
    callAfter: 1.0,                 // ...for this long, and the lift comes
    inside: { x: 24.65, z: -0.15 }, // in front of the button panel
    // The car is a glass capsule, so the panel stands on its own post just
    // inside the doors, to one side, turned towards the middle of the car.
    panel: { x: 23.75, y: 1.6, z: 1.35, face: 2.55 },
    // Over the character's shoulder onto the panel, from the far side of the car.
    panelCamera: { x: 25.45, y: 2.5, z: 0.45, lookX: 23.8, lookY: 1.45, lookZ: 1.35, fov: 44 },
    press: 0.4,                     // the button lights, a beat, then the character turns to the doors
    // Out through the doors, then a step to the side: let go with the lift
    // off to one shoulder, so the camera behind has open floor to sit in
    // instead of being squeezed against the shaft.
    out: [{ x: 21.4, z: 0 }, { x: 20.5, z: 1.9 }],
    carPerFloor: 1.3,               // seconds for the empty car to come one floor
    ridePerFloor: 1.9,
    doorTime: 0.65,
    walkSpeed: 2.3,
    // Far enough back that the character is whole in the frame on the way in and on the way out.
    outsideCamera: { x: 18.4, y: 2.7, z: 4.6, lookX: 22.9, lookY: 1.3, lookZ: 0 },
    // At the back of the car, just under its roof, looking out over the
    // character's head towards the doors. A wide lens: the car is 3.6 m across.
    insideCamera: { x: 26.5, y: 2.45, z: 0, lookX: 22.2, lookY: 1.5, lookZ: 0, fov: 74 },
  }),
  stairs: Object.freeze({
    // Up one level, in game coordinates (x, z) with the height gained. The
    // flights are the ones built in p04_circulation.py: 14 risers each,
    // side by side, joined by a half landing against the north wall.
    path: Object.freeze([
      [-9.35, 15.2, 0], [-9.35, 16.3, 0], [-9.35, 19.81, 2.5], [-9.35, 20.75, 2.5],
      [-7.65, 20.75, 2.5], [-7.65, 19.81, 2.5], [-7.65, 16.3, 5], [-7.65, 15.2, 5],
    ]),
    flatSpeed: 2.4,
    flightSpeed: 2.1,
    // Where the two flights start on a level, as (x, z) lanes: stepping
    // into a lane walking north starts the trip. The up flight is the west
    // lane (levels 1 and 2); the flight coming up from below ends in the
    // east lane, which is the way down (levels 2 and 3).
    // The stairs are watched from the side, across the open well east of
    // them, the way a stair is drawn in elevation: both flights and the
    // landing are in the picture the whole time, nothing is between the
    // camera and the stair, and the picture does not move while the
    // character climbs through it. The camera keeps level with the climber
    // (y is height above their feet). A long lens, as it is 11 m away.
    camera: Object.freeze({ x: 2.6, y: 1.9, z: 18.45, lookX: -8.5, lookY: 1.5, lookZ: 18.45, fov: 36 }),
    lanes: Object.freeze({
      up: { minX: -9.95, maxX: -8.75, minZ: 15.45, maxZ: 16.6 },
      down: { minX: -8.25, maxX: -7.05, minZ: 15.45, maxZ: 16.6 },
    }),
  }),
});

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

function shortest(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Walks a list of [x, z, height] points at a speed that may differ by leg. */
function pathWalker(points, speedFor) {
  const legs = [];
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, z0, y0] = points[i], [x1, z1, y1] = points[i + 1];
    const length = Math.hypot(x1 - x0, z1 - z0);
    const time = length / speedFor(y0 !== y1);
    legs.push({ x0, z0, y0, x1, z1, y1, time, start: total, heading: Math.atan2(x1 - x0, z1 - z0), vx: (x1 - x0) / time, vz: (z1 - z0) / time });
    total += time;
  }
  return {
    duration: total,
    at(t) {
      const leg = legs.find((l) => t < l.start + l.time) ?? legs[legs.length - 1];
      const f = clamp01((t - leg.start) / leg.time);
      return {
        x: leg.x0 + (leg.x1 - leg.x0) * f, z: leg.z0 + (leg.z1 - leg.z0) * f, y: leg.y0 + (leg.y1 - leg.y0) * f,
        heading: leg.heading, vx: t >= total ? 0 : leg.vx, vz: t >= total ? 0 : leg.vz,
      };
    },
  };
}

/** The lift's button panel: a screen showing the level the car is on and
 * three round buttons, 3 at the top. Drawn on canvases, so it is only built
 * where there is a document (not in the node tests). Rides with the car. */
function buildPanel(car) {
  if (typeof document === "undefined") return null;
  const L = TRANSIT.lift;
  const group = new THREE.Group();
  group.name = "LIFT_Panel";
  // Car-local: the car's origin is on its floor, under its middle.
  group.position.set(L.panel.x - car.position.x, L.panel.y, L.panel.z - car.position.z);
  group.rotation.y = L.panel.face;                      // turned towards the middle of the car
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, L.panel.y - 0.5, 0.1), new THREE.MeshBasicMaterial({ color: 0xd8a640 }));
  post.position.set(0, -(L.panel.y - 0.5) / 2 - 0.5, -0.06);
  group.add(post);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.12, 0.03), new THREE.MeshBasicMaterial({ color: 0xf3ead8 }));
  plate.position.z = -0.015;
  group.add(plate);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.16, 0.02), new THREE.MeshBasicMaterial({ color: 0xd8a640 }));
  rim.position.z = -0.03;
  group.add(rim);

  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const screenCanvas = canvas(256, 128);
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: screenTex }));
  screen.position.set(0, 0.38, 0.002);
  group.add(screen);

  const COLORS = ["#e7b928", "#3b86c6", "#d9578f"];       // the level colours of the mall (yellow, blue, pink)
  const buttons = [0, 1, 2].map((level) => {
    const c = canvas(128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.09, 32), new THREE.MeshBasicMaterial({ map: tex }));
    mesh.position.set(0, -0.4 + level * 0.23, 0.004);
    group.add(mesh);
    return { c, tex, level };
  });
  function drawButton(b, lit) {
    const g = b.c.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = lit ? "#fff3a6" : "#c9c2b4"; g.beginPath(); g.arc(64, 64, 63, 0, Math.PI * 2); g.fill();      // ring
    g.fillStyle = lit ? "#ffd84a" : COLORS[b.level]; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
    g.fillStyle = lit ? "#7a4a00" : "#ffffff";
    g.font = "bold 74px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(b.level + 1), 64, 70);
    b.tex.needsUpdate = true;
  }
  function drawScreen(level, going) {
    const g = screenCanvas.getContext("2d");
    g.fillStyle = "#1d2330"; g.fillRect(0, 0, 256, 128);
    g.fillStyle = COLORS[level] ?? "#ffffff";
    g.font = "bold 88px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(level + 1), going === null || going === level ? 128 : 150, 70);
    if (going !== null && going !== level) {             // an arrow the way the car is going
      g.fillStyle = "#ffffff"; g.beginPath();
      if (going > level) { g.moveTo(52, 38); g.lineTo(80, 82); g.lineTo(24, 82); } else { g.moveTo(52, 90); g.lineTo(80, 46); g.lineTo(24, 46); }
      g.fill();
    }
    screenTex.needsUpdate = true;
  }
  let last = "";
  function show(level, lit) {
    const key = `${level}:${lit}`;
    if (key === last) return;
    last = key;
    drawScreen(level, lit);
    for (const b of buttons) drawButton(b, b.level === lit);
  }
  show(Math.round(car.position.y / 5), null);
  car.add(group);
  return { group, show };
}

/**
 * @param {THREE.Object3D} root the mall's architecture scene
 * @param {{floorHeight?: number, playSfx?: (name: string) => void}} [opts]
 */
export function createTransit(root, { floorHeight = 5, playSfx = () => {} } = {}) {
  // ── The lift's moving parts ────────────────────────────────────────────
  let car = null;
  const doors = [[], [], []];   // per level: [{ node, base, sign }]
  root?.traverse?.((node) => {
    if (node.name === "LIFT_Car") car = node;
    const m = /^LIFT_L(\d)_Door_([AB])$/.exec(node.name);
    if (m && doors[Number(m[1]) - 1]) {
      doors[Number(m[1]) - 1].push({ node, base: node.position.clone(), sign: Math.sign(node.position.z) || 1 });
    }
  });
  const open = [0, 0, 0];       // how far each level's doors are open, 0..1
  const wanted = [0, 0, 0];     // where they are heading when no scene is driving them
  let carHeight = car ? car.position.y : 0;
  let carFloor = Math.round(carHeight / floorHeight);

  function poseDoors(level) {
    for (const door of doors[level]) {
      // Each leaf slides away from the middle and tucks in behind its post.
      door.node.position.z = door.base.z + door.sign * 0.7 * open[level];
      door.node.scale.z = 1 - 0.68 * open[level];
    }
  }
  function setCar(height) {
    carHeight = height;
    if (car) car.position.y = height;
  }

  const panel = car ? buildPanel(car) : null;

  let busy = false;             // a scene is driving the doors
  /** Doors left open by a finished scene close themselves. */
  function update(dt) {
    if (busy) return;
    for (let level = 0; level < 3; level++) {
      if (open[level] === wanted[level]) continue;
      const step = dt / TRANSIT.lift.doorTime;
      open[level] = wanted[level] > open[level] ? Math.min(wanted[level], open[level] + step) : Math.max(wanted[level], open[level] - step);
      poseDoors(level);
    }
  }

  // ── Lift ────────────────────────────────────────────────────────────────
  function startLift(from, to, start) {
    const L = TRANSIT.lift;
    const walkIn = pathWalker([[start.x, start.z, 0], [L.call.x, L.call.z, 0]], () => L.walkSpeed);
    const enter = pathWalker([[L.call.x, L.call.z, 0], [L.inside.x, L.inside.z, 0]], () => L.walkSpeed);
    const leaveFrom = (pts) => pathWalker([[L.inside.x, L.inside.z, 0], ...pts.map((p) => [p.x, p.z, 0])], () => L.walkSpeed);
    const leave = leaveFrom(L.out);
    const lastOut = L.out[L.out.length - 1], prevOut = L.out[L.out.length - 2];
    const outHeading = Math.atan2(lastOut.x - prevOut.x, lastOut.z - prevOut.z);
    const facePanel = Math.atan2(L.panel.x - L.inside.x, L.panel.z - L.inside.z);
    const carFrom = carHeight;
    const fromY = from * floorHeight;
    let dest = null;               // the level chosen on the panel
    let stepOut = false;           // E: get out again on this level
    let phases = [
      { name: "approach", time: Math.max(0.2, walkIn.duration) },
      { name: "arrive", time: 0.25 + Math.abs(carFrom - fromY) / floorHeight * L.carPerFloor },
      { name: "open", time: L.doorTime },
      { name: "enter", time: enter.duration },
      { name: "face", time: 0.4 },
      { name: "choose", time: Infinity },
    ];
    let index = 0, t = 0;
    wanted[from] = 0;
    busy = true;
    panel?.show(from, null);
    const pose = { x: start.x, z: start.z, heading: Math.PI / 2, viewHeading: outHeading, vx: 0, vz: 0, y: fromY, camera: null, done: false, exitFloor: from, awaiting: false };

    function go(level) {
      dest = level;
      panel?.show(from, level);
      playSfx("click");
      const rideTime = 0.3 + Math.abs(level - from) * L.ridePerFloor;
      phases = phases.slice(0, index + 1).concat([
        { name: "press", time: L.press },
        { name: "turn", time: 0.45 },
        { name: "close", time: L.doorTime },
        { name: "ride", time: rideTime },
        { name: "open-out", time: L.doorTime },
        { name: "leave", time: leave.duration },
      ]);
      phases[index].time = t;      // the wait is over
      scene.exitFloor = level;
      pose.exitFloor = level;
    }
    function out() {
      stepOut = true;
      panel?.show(from, null);
      phases = phases.slice(0, index + 1).concat([
        { name: "turn", time: 0.45 },
        { name: "leave", time: leave.duration },
      ]);
      phases[index].time = t;
    }

    const scene = {
      kind: "lift",
      exitFloor: from,
      /** True while the character stands at the panel waiting for a level. */
      get awaiting() { return phases[index].name === "choose" && dest === null && !stepOut; },
      /** A number key: the level to go to (0, 1, 2). The level the car is on gets the character out again. */
      choose(level) {
        if (!this.awaiting || level < 0 || level > 2) return false;
        if (level === from) out(); else go(level);
        return true;
      },
      /** E: step back out on this level. */
      exit() { if (!this.awaiting) return false; out(); return true; },
      advance(dt) {
        t += dt;
        while (index < phases.length - 1 && t >= phases[index].time) {
          t -= phases[index].time;
          index += 1;
          if (phases[index].name === "open" || phases[index].name === "open-out") playSfx("click");
        }
        const phase = phases[index];
        const f = Number.isFinite(phase.time) ? clamp01(t / phase.time) : 0;
        const toY = (dest ?? from) * floorHeight;
        pose.vx = 0; pose.vz = 0;
        let camera = L.outsideCamera;
        let inside = true;
        switch (phase.name) {
          case "approach": {
            inside = false;
            const p = walkIn.at(t);
            Object.assign(pose, { x: p.x, z: p.z, vx: p.vx, vz: p.vz });
            if (walkIn.duration > 0.05 && t < walkIn.duration) pose.heading = p.heading;
            else pose.heading += shortest(pose.heading, Math.PI / 2) * Math.min(1, 12 * dt);
            break;
          }
          case "arrive":
            inside = false;
            pose.heading += shortest(pose.heading, Math.PI / 2) * Math.min(1, 12 * dt);
            setCar(carFrom + (fromY - carFrom) * smooth(clamp01((t) / Math.max(0.01, phase.time - 0.25))));
            break;
          case "open":
            inside = false;
            setCar(fromY); open[from] = smooth(f); poseDoors(from);
            break;
          case "enter": {
            inside = false;
            const p = enter.at(t);
            Object.assign(pose, { x: p.x, z: p.z, vx: p.vx, vz: p.vz });
            pose.heading += shortest(pose.heading, p.heading) * Math.min(1, 12 * dt);
            break;
          }
          case "face":
            pose.heading += shortest(pose.heading, facePanel) * Math.min(1, 10 * dt);
            camera = L.panelCamera;
            break;
          case "choose":
            pose.heading = facePanel;
            camera = L.panelCamera;
            if (to !== undefined && to !== null && dest === null && !stepOut) scene.choose(to);   // a scripted ride (tests)
            break;
          case "press":
            camera = L.panelCamera;
            break;
          case "turn":
            pose.heading = facePanel + shortest(facePanel, -Math.PI / 2) * smooth(f);      // round to face the doors
            camera = stepOut ? L.outsideCamera : L.panelCamera;
            break;
          case "close":
            pose.heading = -Math.PI / 2;
            open[from] = 1 - smooth(f); poseDoors(from);
            camera = L.panelCamera;
            break;
          case "ride":
            open[from] = 0; poseDoors(from);
            pose.y = fromY + (toY - fromY) * smooth(f);
            setCar(pose.y);
            panel?.show(Math.round(pose.y / floorHeight), dest);
            camera = L.panelCamera;
            break;
          case "open-out":
            pose.y = toY; setCar(toY);
            panel?.show(dest, null);
            open[dest] = smooth(f); poseDoors(dest);
            camera = L.insideCamera;
            break;
          case "leave": {
            inside = false;
            const p = leave.at(t);
            Object.assign(pose, { x: p.x, z: p.z, vx: p.vx, vz: p.vz, y: toY });
            pose.heading += shortest(pose.heading, p.heading) * Math.min(1, 10 * dt);
            if (t >= phase.time) {
              const level = dest ?? from;
              pose.done = true;
              pose.heading = outHeading;
              pose.vx = 0; pose.vz = 0;
              carFloor = level;
              wanted[level] = 0;       // update() closes them behind the player
              busy = false;
            }
            break;
          }
          default: break;
        }
        if (inside) { pose.x = L.inside.x; pose.z = L.inside.z; }
        pose.awaiting = scene.awaiting;
        pose.camera = camera;
        return pose;
      },
    };
    return scene;
  }

  // ── Stairs ──────────────────────────────────────────────────────────────
  /** Which way the stairs would take a player at (x, z) on `floor` who is
   * walking with velocity (vx, vz): "up", "down" or null. Only someone
   * walking north into the mouth of a flight is taken. */
  function stairsAt(floor, x, z, vz) {
    if (vz < 0.6) return null;
    const { up, down } = TRANSIT.stairs.lanes;
    const inside = (r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
    if (floor < 2 && inside(up)) return "up";
    if (floor > 0 && inside(down)) return "down";
    return null;
  }

  function startStairs(from, to, start) {
    const S = TRANSIT.stairs;
    const up = to > from;
    const flights = Math.abs(to - from);
    const points = [[start.x, start.z, 0]];
    for (let k = 0; k < flights; k++) {
      const base = k * floorHeight * (up ? 1 : -1);
      const leg = up ? S.path : S.path.map(([x, z, h]) => [x, z, h - floorHeight]).reverse();
      // The first point of a flight is its run-up; someone already at the mouth of the flight skips it.
      for (const [x, z, h] of (k === 0 && start.z > leg[0][1] ? leg.slice(1) : leg)) points.push([x, z, base + h]);
    }
    const walker = pathWalker(points, (climbing) => (climbing ? S.flightSpeed : S.flatSpeed));
    const baseY = from * floorHeight;
    let t = 0;
    const pose = { x: start.x, z: start.z, heading: start.heading ?? 0, viewHeading: start.heading ?? 0, vx: 0, vz: 0, y: baseY, camera: S.camera, climbing: 0, landing: false, done: false, exitFloor: to };
    return {
      kind: "stairs",
      exitFloor: to,
      up,
      advance(dt) {
        t += dt;
        const p = walker.at(t);
        pose.climbing = Math.sign(p.y - (pose.y - baseY));          // +1 going up a flight, -1 down, 0 on the flat
        pose.x = p.x; pose.z = p.z; pose.y = baseY + p.y; pose.vx = p.vx; pose.vz = p.vz;
        pose.heading += shortest(pose.heading, p.heading) * Math.min(1, 10 * dt);
        pose.viewHeading = p.heading;                               // where the view will be when the scene hands it back
        const part = ((p.y % floorHeight) + floorHeight) % floorHeight;
        pose.landing = pose.climbing === 0 && Math.abs(part - floorHeight / 2) < 0.01;   // on the half landing between two flights
        if (t >= walker.duration) { pose.done = true; pose.vx = 0; pose.vz = 0; pose.heading = p.heading; }
        return pose;
      },
    };
  }

  return {
    hasLiftRig: Boolean(car) && doors.every((level) => level.length === 2),
    get carFloor() { return carFloor; },
    panel,
    update,
    startLift,
    startStairs,
    stairsAt,
  };
}
