import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CATALOG } from "../economy/catalog.js";
import { purchaseItem } from "../economy/worldState.js";

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
  { id: "wellness-willow", file: "wellness_willow.glb", floor: 2 },
  { id: "food-hall", file: "food_hall.glb", floor: 2 },
  { id: "rooftop-garden", file: "rooftop_garden.glb", floor: 2 },
]);

export const GROVE_MALL_ENTRANCES = new Set([
  "commons-park-lobby",
  "commons-pantry",
  "commons-homeworks",
  "commons-threadbare",
]);

export const GROVE_MALL_SPAWN = Object.freeze({ x: 0, z: -19 });
export const GROVE_MALL_EXIT = Object.freeze({ x: 0, z: -20.6, radius: 1.4 });

const FLOOR_HEIGHT = 5;
// Keep the follow camera below the next storey's slab. The outdoor profile is
// intentionally taller, but that height placed the mall camera above the
// five-metre floor spacing and made upper decks cut across the view.
const CAMERA_PROFILE = Object.freeze({ distance: 10.5, height: 3.8, lookTargetY: 1.1, fov: 50 });
const FIXTURE_NAME = /(aisle|counter|table|bench|shelf|rack|pedestal|stall|planter|fitting_room|display_base)/i;
const FIXTURE_PART = /(top|board|panel|sign|floor|back|left|right|leg|handle|glass|inset)/i;

const SHOPS = Object.freeze([
  { id: "grove-grocer", label: "Grove Grocer", floor: 0, x: -14.2, z: 14, catalog: "grocery" },
  { id: "thread-and-thimble", label: "Thread + Thimble", floor: 0, x: 14.2, z: 14, catalog: "boutique" },
  { id: "home-nook", label: "Home Nook", floor: 0, x: 14.2, z: -14, catalog: "furniture" },
  { id: "cafe-canopy", label: "Café Canopy", floor: 0, x: -14.2, z: -14, catalog: "eatery" },
  { id: "sole-search", label: "Sole Search", floor: 1, x: -14.2, z: 14, catalog: "shoes" },
  { id: "pixel-pantry", label: "Pixel Pantry", floor: 1, x: 14.2, z: 14, catalog: "games" },
  { id: "maker-meadow", label: "Maker Meadow", floor: 1, x: -14.2, z: -14, catalog: "maker" },
  { id: "seasonal-pop-up", label: "Seasonal Pop-Up", floor: 1, x: 14.2, z: -14, catalog: "seasonal" },
  { id: "book-burrow", label: "Book Burrow", floor: 2, x: -14.2, z: 14, catalog: "books" },
  { id: "wellness-willow", label: "Wellness Willow", floor: 2, x: 14.2, z: 14, catalog: "wellness" },
  { id: "food-hall", label: "Food Hall", floor: 2, x: -14.2, z: -14, catalog: "foodhall" },
  { id: "rooftop-garden", label: "Rooftop Garden", floor: 2, x: 14.2, z: -14, catalog: "gardenShop" },
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
      material.roughness = Math.max(0.62, material.roughness ?? 0.8);
      material.metalness = Math.min(0.12, material.metalness ?? 0);
      material.needsUpdate = true;
    }
  });
}

function floorColliders(floor = 0, fixtureColliders = []) {
  const regions = floor === 0
    ? [{ minX: -29.2, maxX: 29.2, minZ: -21.2, maxZ: 21.2 }]
    : [
        { minX: -29.2, maxX: -10.4, minZ: -21.2, maxZ: 21.2 },
        { minX: 10.4, maxX: 29.2, minZ: -21.2, maxZ: 21.2 },
        { minX: -10.8, maxX: 10.8, minZ: 9.7, maxZ: 16.3 },
        { minX: -10.8, maxX: 10.8, minZ: -16.3, maxZ: -9.7 },
      ];
  const result = [{ kind: "walkable", label: `grove-mall-floor-${floor + 1}`, regions }];
  if (floor === 0) result.push({ kind: "circle", cx: 0, cz: 0, r: 2.7, label: "grove-mall-fountain" });
  return result.concat(fixtureColliders);
}

function collectFixtureColliders(scene, floor, into) {
  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    if (!obj.isMesh || !FIXTURE_NAME.test(obj.name) || FIXTURE_PART.test(obj.name)) return;
    const bounds = new THREE.Box3().setFromObject(obj);
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    const depth = bounds.max.z - bounds.min.z;
    if (width < 0.3 || height < 0.3 || depth < 0.3) return;
    into[floor].push({
      minX: bounds.min.x,
      maxX: bounds.max.x,
      minZ: bounds.min.z,
      maxZ: bounds.max.z,
      label: `grove-mall-fixture:${obj.name}`,
    });
  });
}

/** Build the authored three-storey mall as a lazy, reusable game interior. */
export async function buildGroveMallInterior({
  worldState,
  interactionSystem,
  carry,
  playSfx,
  onPurchaseFeedback,
  onFloorChange,
}) {
  const loaded = await loadGroveMallAssets();
  const group = new THREE.Group();
  group.name = "interior:grove-mall";

  const content = new THREE.Group();
  content.name = "grove-mall-authored-content";
  group.add(content);

  const fixtureCollidersByFloor = [[], [], []];
  const shopScenesByFloor = [[], [], []];
  for (const module of loaded) {
    prepareScene(module.scene);
    module.scene.name = `grove-module:${module.id}`;
    if (Number.isInteger(module.floor)) {
      collectFixtureColliders(module.scene, module.floor, fixtureCollidersByFloor);
      shopScenesByFloor[module.floor].push(module.scene);
    }
    content.add(module.scene);
  }

  // The authored side wings need a clear landing between them at both
  // ends of the atrium. These connector decks make the stairs/lift routes
  // functionally walkable while preserving the open centre sightline.
  const bridgeMaterial = new THREE.MeshStandardMaterial({ color: 0xe4d3ad, roughness: 0.9, metalness: 0 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x6f9475, roughness: 0.78, metalness: 0 });
  const connectorScenesByFloor = [[], [], []];
  for (const y of [4.8, 9.8]) {
    const floor = Math.round(y / FLOOR_HEIGHT);
    const connectorGroup = new THREE.Group();
    connectorGroup.name = `runtime-connectors-level-${floor + 1}`;
    connectorScenesByFloor[floor].push(connectorGroup);
    content.add(connectorGroup);

    const postMatrices = [];
    for (const z of [-13, 13]) {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(21.6, 0.4, 6.6), bridgeMaterial);
      bridge.position.set(0, y, z);
      bridge.name = `runtime-connector-level-${floor + 1}-${z < 0 ? "south" : "north"}`;
      connectorGroup.add(bridge);

      const innerEdgeZ = z < 0 ? -9.82 : 9.82;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(21.2, 0.18, 0.18), railMaterial);
      rail.position.set(0, y + 0.82, innerEdgeZ);
      rail.name = `${bridge.name}-atrium-rail`;
      connectorGroup.add(rail);
      for (const x of [-10.2, -5.1, 0, 5.1, 10.2]) {
        const matrix = new THREE.Matrix4();
        matrix.setPosition(x, y + 0.42, innerEdgeZ);
        postMatrices.push(matrix);
      }
    }
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.82, 0.16), railMaterial, postMatrices.length);
    postMatrices.forEach((matrix, index) => posts.setMatrixAt(index, matrix));
    posts.name = `runtime-connectors-level-${floor + 1}-rail-posts`;
    posts.instanceMatrix.needsUpdate = true;
    connectorGroup.add(posts);
  }

  const hemi = new THREE.HemisphereLight(0xfff0d8, 0x75634f, 1.35);
  const key = new THREE.DirectionalLight(0xffe1aa, 2.2);
  key.position.set(-18, 28, -24);
  const fill = new THREE.DirectionalLight(0xcbe4ff, 0.7);
  fill.position.set(20, 18, 16);
  group.add(hemi, key, fill);

  const colliders = floorColliders(0, fixtureCollidersByFloor[0]);
  const disposers = [];
  const shopState = new Map();
  let activeFloor = 0;
  let initialized = false;

  function clearRegistrations() {
    while (disposers.length) disposers.pop()();
  }

  function registerCurrentFloor() {
    clearRegistrations();

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
          if (state.confirm) {
            return worldState.coins >= item.price
              ? `Confirm ${item.label} — ${item.price} coins`
              : `Need ${item.price - worldState.coins} more coins`;
          }
          return `${shop.label}: ${item.label} — ${item.price} coins`;
        },
        onInteract: () => {
          if (carry.isCarrying) return;
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
          carry.pickUp({ itemId: item.id, label: item.label, shape: item.shape });
          onPurchaseFeedback?.(true, item);
          state.index = (state.index + 1) % items.length;
        },
      });
      disposers.push(() => interactionSystem.unregister(interactionId));
    }

    for (const [id, position] of [["lift", { x: 24.2, z: 0 }], ["stairs", { x: 0, z: 17.2 }]]) {
      const interactionId = `grove-mall:${id}`;
      interactionSystem.register(interactionId, {
        position,
        radius: 2.6,
        prompt: () => `Go to Level ${(activeFloor + 1) % 3 + 1}`,
        onInteract: () => setFloor((activeFloor + 1) % 3),
      });
      disposers.push(() => interactionSystem.unregister(interactionId));
    }
  }

  function setFloor(nextFloor) {
    activeFloor = THREE.MathUtils.clamp(Math.round(nextFloor), 0, 2);
    content.position.y = -activeFloor * FLOOR_HEIGHT;
    shopScenesByFloor.forEach((scenes, floor) => {
      for (const scene of scenes) scene.visible = floor === activeFloor;
    });
    connectorScenesByFloor.forEach((scenes, floor) => {
      for (const scene of scenes) scene.visible = floor === activeFloor;
    });
    colliders.splice(0, colliders.length, ...floorColliders(activeFloor, fixtureCollidersByFloor[activeFloor]));
    registerCurrentFloor();
    if (initialized) onFloorChange?.(activeFloor + 1);
    playSfx("click");
  }

  setFloor(0);
  initialized = true;

  function dispose() {
    clearRegistrations();
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
    renderedShopModulesPerFloor: shopScenesByFloor.map((items) => items.length),
    setFloor,
    activate: registerCurrentFloor,
  };
}
