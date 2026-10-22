import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CATALOG } from "../economy/catalog.js";
import { purchaseItem } from "../economy/worldState.js";
import { createEscalatorSystem } from "./escalators.js";
import { loadGroveCollision } from "../player/collisionGrid.js";
import { createTransit, TRANSIT } from "./transit.js";
import { createWaterFlow } from "../scene/water.js";

const ASSET_ROOT = "models/env/grove/";

const MODULES = Object.freeze([
  { id: "architecture", file: "grove_architecture.glb" },
  { id: "grove-grocer", file: "grove_grocer.glb", floor: 0 },
  { id: "thread-and-thimble", file: "thread_and_thimble.glb", floor: 0 },
  { id: "home-nook", file: "home_nook.glb", floor: 0 },
  { id: "cafe-canopy", file: "cafe_canopy.glb", floor: 0 },
  { id: "sole-search", file: "sole_search.glb", floor: 1 },
  { id: "pixel-pantry", file: "pixel_pantry.glb", floor: 1 },
  { id: "maker-meadow", file: "maker_meadow.glb", floor: 1 },
  { id: "seasonal-pop-up", file: "seasonal_pop_up.glb", floor: 1 },
  { id: "book-burrow", file: "book_burrow.glb", floor: 2 },
  { id: "alltimefitness", file: "alltimefitness.glb", floor: 2 },
  { id: "food-hall", file: "food_hall.glb", floor: 2 },
  { id: "rooftop-garden", file: "rooftop_garden.glb", floor: 2 },
]);

export const GROVE_MALL_ENTRANCES = new Set([
  "commons-park-lobby",
  "commons-pantry",
  "commons-homeworks",
  "commons-threadbare",
]);

export const GROVE_MALL_SPAWN = Object.freeze({ x: 0, z: -12.8 });
// Leaving starts as soon as the player heads for the doors, well before
// the door frame, so nothing at the entrance gets between them and the
// camera on the way out.
export const GROVE_MALL_EXIT = Object.freeze({ minX: -3.4, maxX: 3.4, minZ: -30, maxZ: -18.2 });

const FLOOR_HEIGHT = 5;
// Camera framing by zone (PlayerController glides between them).
//   concourse  the open floors: a long boom, a little above head height. It
//              may crane up to just under the slab of the storey above
//              (floors are 5 m apart) when a wall leaves it no room behind.
//   room       inside a shop: a fixed view from the open front, high enough
//              to see over the fixtures, looking at the back wall. The view
//              does not turn in a room (see PlayerController.setRoom).
//   ride       on an escalator. Riding up, the camera is low behind the
//              character and aims up the run, at where they are going;
//              riding down it is high behind them and aims out over the
//              floor below. Either way the screen is not filled with steps.
//              eyeSlope and eyeHeight do the same for the first-person
//              view: the eyes are raised and tipped just enough that the
//              landing ahead is in the middle of the picture, with the
//              steps below it and the ceiling above (neither fills it).
const CAMERA_PROFILE = Object.freeze({ distance: 7.2, height: 2.8, lookTargetY: 1.5, fov: 50, maxHeight: 4.15 });
const ROOM_CAMERA = Object.freeze({ distance: 6.6, height: 4.1, lookTargetY: 1.15, fov: 50, maxHeight: 4.2 });
const RIDE_CAMERA = Object.freeze({ distance: 4.4, height: 1.75, lookTargetY: 1.5, fov: 58, lookAhead: 5, lookRise: 1.6, eyeSlope: 0.45, eyeHeight: 2.45, maxHeight: 4.15 });
const RIDE_DOWN_CAMERA = Object.freeze({ distance: 3.4, height: 3.6, lookTargetY: 1.4, fov: 58, lookAhead: 6, lookRise: -2.2, eyeSlope: -0.5, eyeHeight: 1.95, maxHeight: 4.15 });
// Every shop is the same block, mirrored: |x| 14.25..25.75, with its open
// front on the lane at |z| 10.55 and its back wall at |z| 17.45.
const SHOP_HALF_WIDTH = 5.75;
const SHOP_FRONT = 10.55;
const SHOP_BACK = 17.45;
// Going in and out of a shop is a short fade, like the mall's own doors,
// and it starts before the shopfront: by the time the awning and the sign
// would be between the camera and the player, the view is already the one
// inside (or the one out on the lane).
const SHOP_ENTER_AT = 0.45;     // metres in front of the shopfront line where walking in starts the fade
const SHOP_ENTER_TO = 1.7;      // and how far inside the player arrives
const SHOP_EXIT_AT = 0.5;       // metres inside the line where walking out starts it
const SHOP_EXIT_TO = 2.5;       // and how far out on the lane the player arrives
const DOOR_INTENT = 0.15;       // seconds of walking at a shop door before it is taken
const DOOR_COOL = 0.6;          // seconds after one door before the next can be taken
export const GROVE_MALL_TRANSIT = Object.freeze({
  lift: Object.freeze({ x: 21.7, z: 0, radius: 2.4 }),
});

const SHOPS = Object.freeze([
  { id: "grove-grocer", label: "Grove Grocer", floor: 0, x: -20, z: 14, catalog: "grocery" },
  { id: "thread-and-thimble", label: "Thread + Thimble", floor: 0, x: 20, z: 14, catalog: "boutique" },
  { id: "home-nook", label: "Home Nook", floor: 0, x: 20, z: -14, catalog: "furniture" },
  { id: "cafe-canopy", label: "Café Canopy", floor: 0, x: -20, z: -14, catalog: "eatery" },
  { id: "sole-search", label: "Sole Search", floor: 1, x: -20, z: 14, catalog: "shoes" },
  { id: "pixel-pantry", label: "Pixel Pantry", floor: 1, x: 20, z: 14, catalog: "games" },
  { id: "maker-meadow", label: "Maker Meadow", floor: 1, x: -20, z: -14, catalog: "maker" },
  { id: "seasonal-pop-up", label: "Seasonal Pop-Up", floor: 1, x: 20, z: -14, catalog: "seasonal" },
  { id: "book-burrow", label: "Book Burrow", floor: 2, x: -20, z: 14, catalog: "books" },
  { id: "alltimefitness", label: "AllTimeFitness", floor: 2, x: 20, z: 14, catalog: "wellness" },
  { id: "food-hall", label: "Food Hall", floor: 2, x: -20, z: -14, catalog: "foodhall" },
  { id: "rooftop-garden", label: "Rooftop Garden", floor: 2, x: 20, z: -14, catalog: "gardenShop" },
]);

let assetPromise = null;

function assetUrl(file) {
  const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : "http://localhost/";
  return new URL(`${ASSET_ROOT}${file}`, base).href;
}

function loadModule(loader, spec) {
  return new Promise((resolve, reject) => {
    loader.load(assetUrl(spec.file), (gltf) => resolve({ ...spec, scene: gltf.scene }), undefined, reject);
  });
}

export function loadGroveMallAssets() {
  if (!assetPromise) {
    const loader = new GLTFLoader();
    assetPromise = Promise.all(MODULES.map((spec) => loadModule(loader, spec)));
  }
  return assetPromise;
}

function prepareScene(scene) {
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = false;
    obj.receiveShadow = false;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!material) continue;
      if ("roughness" in material) {
        material.roughness = Math.max(0.62, material.roughness ?? 0.8);
      }
      if ("metalness" in material) {
        material.metalness = Math.min(0.12, material.metalness ?? 0);
      }
      // Sharper floor and wall patterns at a glancing angle (they shimmer less as you walk).
      if (material.map) material.map.anisotropy = 8;
      material.needsUpdate = true;
    }
  });
}

/** Simple boundary used only if the baked collision file is missing. */
function fallbackFloorColliders(floor = 0, fixtureColliders = []) {
  const regions = floor === 0
    ? [{ minX: -29.2, maxX: 29.2, minZ: -21.2, maxZ: 21.2 }]
    : [
        { minX: -29.2, maxX: -10.4, minZ: -21.2, maxZ: 21.2 },
        { minX: 10.4, maxX: 29.2, minZ: -21.2, maxZ: 21.2 },
        { minX: -10.8, maxX: 10.8, minZ: 9.7, maxZ: 16.3 },
        { minX: -10.8, maxX: 10.8, minZ: -16.3, maxZ: -9.7 },
      ];
  const result = [{ kind: "walkable", label: `grove-mall-floor-${floor + 1}`, regions }];
  if (floor === 0) result.push({ kind: "circle", cx: 0, cz: 0, r: 2.1, label: "grove-mall-fountain" });
  return result.concat(fixtureColliders);
}

/** Build the authored three-storey mall as a lazy, reusable game interior. */
export async function buildGroveMallInterior({
  worldState,
  interactionSystem,
  carry,
  playSfx,
  onPurchaseFeedback,
  onShopBrowse,
  onFloorChange,
  onRoomChange,
  fade,
}) {
  const [loaded, collision] = await Promise.all([loadGroveMallAssets(), loadGroveCollision()]);
  // With the baked grid, every wall, railing, shelf, planter and the
  // atrium opening on each level blocks the player. The escalator boxes
  // stay as they are (their steps move, so they are not in the grid).
  const floorColliders = (floor, extra = []) => (collision?.mall?.[floor]
    ? [collision.mall[floor].grid, ...extra]
    : fallbackFloorColliders(floor, extra));
  const seatsOn = (floor) => collision?.mall?.[floor]?.seats ?? [];
  const group = new THREE.Group();
  group.name = "interior:grove-mall";

  const content = new THREE.Group();
  content.name = "grove-mall-authored-content";
  group.add(content);

  const fixtureCollidersByFloor = [[], [], []];
  const shopScenesByFloor = [[], [], []];
  const sceneById = new Map();
  for (const module of loaded) {
    prepareScene(module.scene);
    module.scene.name = `grove-module:${module.id}`;
    sceneById.set(module.id, module.scene);
    if (Number.isInteger(module.floor)) {
      shopScenesByFloor[module.floor].push(module.scene);
    }
    content.add(module.scene);
  }

  // Escalators: the steps are separate nodes in the architecture module
  // (see escalators.js). Their footprints become colliders on the levels
  // they touch; an export without the rig gives an empty system.
  const architecture = loaded.find((module) => module.id === "architecture");
  const escalators = createEscalatorSystem(architecture?.scene ?? content, { floorHeight: FLOOR_HEIGHT });
  // With the baked grid there is nothing to add: it already has the
  // escalators' bodies, piers and balustrades, and the openings they climb
  // through. The plain boxes are only for a game running without the grid.
  // (They cover the whole run of an escalator on each level it touches,
  // including the stretch where it is four metres overhead, and stood as
  // invisible walls on the floor beneath.)
  if (!collision?.mall) {
    for (let floor = 0; floor < 3; floor++) fixtureCollidersByFloor[floor].push(...escalators.colliders(floor));
  }
  let ride = null;
  const water = createWaterFlow(content);      // the atrium fountain
  // The lift and the stairs are played as short scenes (see transit.js).
  const transit = createTransit(architecture?.scene ?? content, { floorHeight: FLOOR_HEIGHT, playSfx });
  let scene = null;         // the lift or stair scene in progress
  let pendingScene = null;  // one the player has just asked for
  let room = null;          // the shop the player is inside (its fixed view is in use)
  let swap = false;         // a shop door fade is in flight
  let lastPlayer = null;
  let liftWait = 0;         // seconds the player has stood at the lift doors
  let doorIntent = 0;       // seconds the player has been walking at a shop door
  let doorCool = 0;         // seconds before a shop door can be taken again

  // Inside the lift, at the panel: 1, 2 and 3 press the button for that
  // level, E steps back out. Caught before the rest of the game sees the
  // key, so E does not also mean "interact" there.
  const onLiftKey = (event) => {
    if (!scene?.awaiting) return;
    const m = /^(?:Digit|Numpad)([1-3])$/.exec(event.code);
    let used = false;
    if (m) used = scene.choose(Number(m[1]) - 1);
    else if (event.code === "KeyE") used = scene.exit();
    if (used || m || event.code === "KeyE") { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  if (typeof window !== "undefined") window.addEventListener("keydown", onLiftKey, true);

  // Everything in the mall is authored in the Grove Blender scene,
  // including the connector decks and balustrades across the atrium on the
  // upper levels (they used to be built here at runtime).

  // Same rule as outdoors (see GROVE_LIGHT in GroveScene.js): near-white
  // light, so the mall shows the colours it was painted in Blender. The
  // bright ground term is what lights ceilings and the undersides of the
  // upper decks, which the camera now looks up at.
  const hemi = new THREE.HemisphereLight(0xf4f8ff, 0xe6ddd0, 1.75);
  const key = new THREE.DirectionalLight(0xfffaf2, 1.7);
  key.position.set(-14, 30, -20);
  const fill = new THREE.DirectionalLight(0xeef4ff, 0.45);
  fill.position.set(18, 16, 22);
  group.add(hemi, key, fill);

  const lights = [hemi, key, fill];
  // The building's shell (floors, walls, roof, glazing) is in this model and
  // in the park's model too, since each can be seen from the other. Only one
  // copy is ever drawn: ours while the player is inside, the park's while
  // they are outside (see setPresence).
  let shared = [];
  let live = false;         // the player is in the mall (prompts registered, our lights on)

  const colliders = floorColliders(0, fixtureCollidersByFloor[0]);
  const disposers = [];
  const shopState = new Map();
  let activeFloor = 0;
  let initialized = false;

  // What the shelf list in the HUD shows: the shop the player is standing
  // at, everything it sells and which item E would buy. Sent only when
  // something in it changes, and as null on walking away.
  let lastBrowse = null;
  function announce(shop, state, items) {
    const owned = (id) => worldState.inventory.find((row) => row.itemId === id)?.qty ?? 0;
    const index = state.index % items.length;
    const key = `${shop.id}:${index}:${state.confirm}:${worldState.coins}:${owned(items[index].id)}`;
    if (key === lastBrowse) return;
    lastBrowse = key;
    onShopBrowse?.({
      shopId: shop.id, label: shop.label, index, confirm: state.confirm, coins: worldState.coins,
      items: items.map((item) => ({ id: item.id, label: item.label, price: item.price, owned: owned(item.id) })),
    });
  }
  /** Point the shop at one of its items (a click on the shelf list). */
  function selectShopItem(shopId, index) {
    const state = shopState.get(shopId);
    if (!state || !Number.isInteger(index) || index < 0) return;
    state.index = index;
    state.confirm = false;
  }

  function clearRegistrations() {
    while (disposers.length) disposers.pop()();
    if (lastBrowse !== null) { lastBrowse = null; onShopBrowse?.(null); }   // changing level or leaving: no shop in front of you
  }

  function registerCurrentFloor() {
    clearRegistrations();
    if (!live) return;

    for (const shop of SHOPS.filter((entry) => entry.floor === activeFloor)) {
      const items = CATALOG[shop.catalog] ?? [];
      if (!items.length) continue;
      if (!shopState.has(shop.id)) shopState.set(shop.id, { index: 0, confirm: false });
      const state = shopState.get(shop.id);
      const interactionId = `grove-mall:shop:${shop.id}`;
      interactionSystem.register(interactionId, {
        position: { x: shop.x, z: shop.z },
        radius: 3.2,
        prompt: () => {
          const item = items[state.index % items.length];
          if (!item) return `Browse ${shop.label}`;
          announce(shop, state, items);
          if (state.confirm) {
            return worldState.coins >= item.price
              ? `Confirm ${item.label} — ${item.price} coins`
              : `Need ${item.price - worldState.coins} more coins`;
          }
          return `${shop.label}: ${item.label} — ${item.price} coins  (Q: next)`;
        },
        // Q: look at the next thing on sale without buying this one.
        onAlt: () => {
          state.index = (state.index + 1) % items.length;
          state.confirm = false;
          playSfx("tap");
        },
        onInteract: () => {
          const item = items[state.index % items.length];
          if (!state.confirm) {
            state.confirm = true;
            playSfx("tap");
            return;
          }
          state.confirm = false;
          const result = purchaseItem(worldState, item.id);
          if (!result.ok) {
            playSfx("error");
            onPurchaseFeedback?.(false, item);
            return;
          }
          playSfx("coin");
          // The first purchase is carried in the hand; with hands full, the
          // next goes straight in the bag (it is in the inventory either way).
          // The shop stays on the same item, so four bundles of wood are four
          // presses, not four trips round the shelf.
          if (!carry.isCarrying) carry.pickUp({ itemId: item.id, label: item.label, shape: item.shape });
          onPurchaseFeedback?.(true, item);
        },
      });
      disposers.push(() => interactionSystem.unregister(interactionId));
    }

    // The lift has no prompt: standing at its doors for a second calls it
    // (see update), and the level is picked on the panel inside.
  }

  // Every level's shops stay drawn: from a balcony or the atrium floor you
  // can see into the other storeys, and empty shops there would look broken.
  function showFloors() {
    shopScenesByFloor.forEach((scenes) => {
      for (const scene of scenes) scene.visible = true;
    });
  }

  // ── Shops as rooms ──────────────────────────────────────────────────────
  function shopAt(x, z) {
    const az = Math.abs(z);
    if (az < SHOP_FRONT - SHOP_ENTER_AT || az > SHOP_BACK) return null;
    return SHOPS.find((shop) => shop.floor === activeFloor && Math.sign(shop.z) === Math.sign(z) && Math.abs(x - shop.x) <= SHOP_HALF_WIDTH) ?? null;
  }
  /** The awning and sign over a shopfront are hidden while the player is
   * inside: the room's view looks in through that side. */
  function showShopfront(shop, visible) {
    sceneById.get(shop.id)?.traverse((node) => { if (/_Front_Canopy/.test(node.name)) node.visible = visible; });
  }
  const roomHeading = (shop) => (shop.z > 0 ? 0 : Math.PI);
  function settleInRoom(shop, player) {
    room = shop;
    showShopfront(shop, false);
    player.setRoom({ heading: roomHeading(shop) }, { snap: true });
    player.setCameraProfile(ROOM_CAMERA, { snap: true });
    onRoomChange?.(shop, activeFloor + 1);
  }
  function leaveRoom(player) {
    if (!room) return;
    showShopfront(room, true);
    room = null;
    player?.setRoom(null);
    player?.setCameraProfile(CAMERA_PROFILE, { snap: true });
    onRoomChange?.(null, activeFloor + 1);
  }
  // Through a shop door the player is held still for the length of the
  // fade: before, walking on during it could carry them straight back out
  // and the view would flick between the shop and the lane.
  function crossFade(run) {
    swap = true;
    doorIntent = 0;
    const player = lastPlayer;
    if (player) { player.inputLocked = true; player.velocity.set(0, 0, 0); }
    const done = () => {
      swap = false;
      doorCool = DOOR_COOL;
      if (player && !scene && !ride) { player.inputLocked = false; player.velocity.set(0, 0, 0); }
    };
    if (!fade) { run(); done(); return; }
    Promise.resolve(fade(run)).then(done, done);
  }
  function enterShop(shop, player) {
    crossFade(() => {
      const p = player.root.position;
      const x = THREE.MathUtils.clamp(p.x, shop.x - SHOP_HALF_WIDTH + 0.9, shop.x + SHOP_HALF_WIDTH - 0.9);
      settleInRoom(shop, player);
      player.moveTo(x, Math.sign(shop.z) * (SHOP_FRONT + SHOP_ENTER_TO), roomHeading(shop));
      playSfx("click");
    });
  }
  function exitShop(player) {
    const shop = room;
    crossFade(() => {
      const p = player.root.position;
      const view = roomHeading(shop);
      leaveRoom(player);
      // Out on the lane, facing away from the shop, with the view still
      // looking at it: the key that walked the player out (Down) goes on
      // meaning "away from the shop".
      player.moveTo(p.x, Math.sign(shop.z) * (SHOP_FRONT - SHOP_EXIT_TO), view + Math.PI, { keepCamera: true });
      player.cameraHeading = view;
      player.updateCamera(0);
      playSfx("click");
    });
  }

  function setFloor(nextFloor, arrival) {
    if (room) leaveRoom(lastPlayer);
    activeFloor = THREE.MathUtils.clamp(Math.round(nextFloor), 0, 2);
    content.position.y = -activeFloor * FLOOR_HEIGHT;
    showFloors(new Set([activeFloor]));
    colliders.splice(0, colliders.length, ...floorColliders(activeFloor, fixtureCollidersByFloor[activeFloor]));
    registerCurrentFloor();
    if (initialized) onFloorChange?.(activeFloor + 1, arrival);
    playSfx("click");
  }

  setFloor(0);
  initialized = true;

  function turnViewToward(player, heading, dt, rate = 4) {
    let d = (heading - player.cameraHeading) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    player.cameraHeading += d * Math.min(1, rate * dt);
  }

  /** Per-frame: escalators, the lift and stair scenes, and which camera
   * framing the player's position calls for. Rides and scenes carry the
   * player while the mall slides down (or up) past them, so the player's
   * own height never changes, and end by making the level they arrive on
   * the active one. */
  function update(dt, player) {
    if (lastBrowse !== null && !String(interactionSystem.activeId ?? "").startsWith("grove-mall:shop:")) {
      lastBrowse = null;
      onShopBrowse?.(null);
    }
    escalators.update(dt);
    transit.update(dt);
    water.update(dt);
    if (!player) return;
    lastPlayer = player;

    // ── a lift or stair scene ───────────────────────────────────────────
    if (!scene && pendingScene && !ride && !player.inputLocked) {
      const p = player.root.position;
      const start = { x: p.x, z: p.z, heading: player.heading };
      scene = pendingScene.id === "lift"
        ? transit.startLift(activeFloor, pendingScene.to ?? null, start)
        : transit.startStairs(activeFloor, pendingScene.to, start);
      player.stand();
      player.inputLocked = true;
      player.cameraIgnoresWalls = true;
      playSfx("tap");
    }
    pendingScene = null;
    if (scene) {
      const pose = scene.advance(dt);
      player.heading = pose.heading;
      player.targetHeading = pose.heading;
      player.root.position.x = pose.x;
      player.root.position.z = pose.z;
      player.root.rotation.y = pose.heading;
      player.velocity.set(pose.vx, 0, pose.vz);
      player.cameraOverride = pose.camera;
      turnViewToward(player, pose.viewHeading, dt, 3);
      content.position.y = -pose.y;
      if (pose.done) {
        const exitFloor = scene.exitFloor;
        scene = null;
        player.inputLocked = false;
        player.cameraIgnoresWalls = false;
        player.cameraOverride = null;
        player.cameraHeading = pose.viewHeading;
        player.velocity.set(0, 0, 0);
        setFloor(exitFloor, { x: pose.x, z: pose.z, heading: pose.heading, seamless: true });
      }
      return;
    }

    // ── an escalator ride ───────────────────────────────────────────────
    if (!ride) {
      if (!player.inputLocked) {
        const p = player.root.position;
        const chain = escalators.findBoarding({ x: p.x, z: p.z, vx: player.velocity.x, vz: player.velocity.z }, activeFloor);
        if (chain) {
          ride = escalators.startRide(chain, p.x, p.z);
          player.inputLocked = true;
          player.cameraIgnoresWalls = true;
          playSfx("tap");
        }
      }
    }
    if (ride) {
      const pose = escalators.advanceRide(ride, dt);
      let turn = (pose.heading - player.heading) % (Math.PI * 2);
      if (turn > Math.PI) turn -= Math.PI * 2;
      if (turn < -Math.PI) turn += Math.PI * 2;
      player.heading += turn * Math.min(1, 10 * dt);
      player.targetHeading = pose.heading;
      player.root.position.x = pose.x;
      player.root.position.z = pose.z;
      player.root.rotation.y = player.heading;
      player.velocity.set(pose.vx, 0, pose.vz);
      // Through the character's eyes, look at where the ride lets you off:
      // the landing stays near the middle of the picture all the way, with
      // the steps below it and the next floor above (not a view of treads
      // at the start, nor of ceiling in the middle).
      const profile = ride.chain.exitFloor < ride.chain.entryFloor ? RIDE_DOWN_CAMERA : RIDE_CAMERA;
      const rise = ride.chain.exitFloor * FLOOR_HEIGHT - pose.y;
      const run = Math.abs(rise) / Math.tan(THREE.MathUtils.degToRad(40)) + 2.7;      // the slope still to go, the flat at its end, and a pace beyond
      const eyeSlope = THREE.MathUtils.clamp((rise + 1.3 - profile.eyeHeight) / run, Math.min(profile.eyeSlope, 0), Math.max(profile.eyeSlope, 0));
      player.setCameraProfile({ ...profile, eyeSlope });
      // For the first metre the level the rider is leaving is still where
      // its collision grid says it is, and the camera behind them is over
      // that level: it must keep out of whatever stands there (the other
      // escalator, the fountain). After that the level is sliding away and
      // the camera is in the escalator's own opening.
      player.cameraIgnoresWalls = Math.abs(pose.y - ride.chain.entryFloor * FLOOR_HEIGHT) > 1.0;
      turnViewToward(player, pose.heading, dt);     // look up (or down) the escalator
      content.position.y = -pose.y;
      if (pose.done) {
        const { exitFloor } = ride.chain;
        ride = null;
        player.inputLocked = false;
        player.cameraIgnoresWalls = false;
        player.velocity.set(0, 0, 0);
        setFloor(exitFloor, { x: pose.x, z: pose.z, heading: pose.heading, seamless: true });
      }
      return;
    }

    // ── walking about ───────────────────────────────────────────────────
    if (swap) return;
    doorCool = Math.max(0, doorCool - dt);
    const p = player.root.position;
    const az = Math.abs(p.z);
    if (room) {
      player.setCameraProfile(ROOM_CAMERA);
      const outward = -Math.sign(room.z) * player.velocity.z;
      // Out of the room some other way than the door line: still leave
      // through the fade, never with a jump of the camera.
      if (shopAt(p.x, p.z) !== room) { exitShop(player); return; }
      // A door is only taken on purpose: walking at it for a moment, and not
      // straight after coming through the other way.
      doorIntent = az <= SHOP_FRONT + SHOP_EXIT_AT && outward > 0.4 ? doorIntent + dt : 0;
      if (doorIntent >= DOOR_INTENT && doorCool === 0) exitShop(player);
      return;
    }
    player.setCameraProfile(CAMERA_PROFILE);
    // The lift: stand at its doors for a second and it comes.
    const L = TRANSIT.lift;
    if (Math.hypot(p.x - L.call.x, p.z - L.call.z) < L.callRadius) {
      liftWait += dt;
      if (liftWait >= L.callAfter) { liftWait = 0; pendingScene = { id: "lift", to: null }; return; }
    } else liftWait = 0;
    // Stairs: walking into the mouth of a flight takes it.
    const way = transit.stairsAt(activeFloor, p.x, p.z, player.velocity.z);
    if (way) { pendingScene = { id: "stairs", to: activeFloor + (way === "up" ? 1 : -1) }; return; }
    // Shops: walking up to a shopfront goes in.
    const shop = shopAt(p.x, p.z);
    if (shop) {
      const inward = Math.sign(shop.z) * player.velocity.z;
      doorIntent = inward > 0.4 ? doorIntent + dt : 0;
      if (az > SHOP_FRONT + 0.8) settleInRoom(shop, player);                              // already inside (arrived there directly)
      else if (doorIntent >= DOOR_INTENT && doorCool === 0) enterShop(shop, player);
    } else doorIntent = 0;
  }

  /** Tell the model which of its nodes the park's model also has. Returns
   * their names, so the caller can find the park's copies. */
  function markShared(names) {
    shared = [];
    // Only whole objects (top-level nodes) count. three.js names the parts of
    // a multi-material object after its mesh ("GK_Bush"), and the park uses the
    // same meshes, so matching parts hid the atrium's plants from outside.
    for (const node of architecture?.scene.children ?? []) if (node.name && names.has(node.name)) shared.push(node);
    return new Set(shared.map((node) => node.name));
  }

  /** The mall stays in the world whether the player is in it or not: from
   * the park you see the shops through the glass, and from inside you see
   * the park. Inside, it is lit by its own lights and takes prompts;
   * outside, the park's light does the work and it only keeps its
   * escalators and fountain running (idle). */
  function setPresence(inside) {
    live = inside;
    for (const light of lights) light.visible = inside;
    for (const node of shared) node.visible = inside;
    if (inside) registerCurrentFloor();
    else {
      leaveRoom(lastPlayer);
      clearRegistrations();
      ride = null; scene = null; pendingScene = null;
      activeFloor = 0;
      content.position.y = 0;
      colliders.splice(0, colliders.length, ...floorColliders(0, fixtureCollidersByFloor[0]));
    }
  }

  function idle(dt) {
    escalators.update(dt);
    transit.update(dt);
    water.update(dt);
  }

  function dispose() {
    if (typeof window !== "undefined") window.removeEventListener("keydown", onLiftKey, true);
    leaveRoom(lastPlayer);
    clearRegistrations();
    ride = null;
    scene = null;
    pendingScene = null;
  }

  return {
    group,
    colliders,
    dispose,
    addPlacedProp: () => {},
    spawn: GROVE_MALL_SPAWN,
    exitTrigger: GROVE_MALL_EXIT,
    cameraProfile: CAMERA_PROFILE,
    roomHalfWidth: 29.2,
    roomHalfDepth: 21.2,
    fixtureColliderCounts: fixtureCollidersByFloor.map((items) => items.length),
    hasCollisionGrid: Boolean(collision?.mall),
    seats: () => seatsOn(activeFloor),
    renderedShopModulesPerFloor: shopScenesByFloor.map((items) => items.length),
    setFloor,
    selectShopItem,
    update,
    escalatorCount: escalators.chains.length,
    waterCount: water.count,
    hasLiftRig: transit.hasLiftRig,
    transitSpots: TRANSIT,
    inScene: () => Boolean(scene || ride),
    /** The lift is waiting at its panel for a level (number keys) or E. */
    liftChoosing: () => Boolean(scene?.awaiting),
    chooseLift: (level) => Boolean(scene?.choose?.(level)),
    inRoom: () => room?.id ?? null,
    leaveRoom: () => leaveRoom(lastPlayer),
    requestTransit: (id, to) => { pendingScene = { id, to }; },
    activate: () => setPresence(true),
    setPresence,
    markShared,
    idle,
    offsetY: () => content.position.y,
  };
}
