// src/grove/scene/worldBuilder.js
//
// Turns scene/worldLayout.js (pure data) into the actual Grove scene
// graph. GroveScene owns the renderer, camera, loop and systems; this
// module owns *what the world looks like*, so the two can be reasoned
// about separately.
//
// Build order matters and is deliberate:
//   1. sea + island plates      (the diorama read: a board sitting in water)
//   2. district terraces        (raised plates, each its own floor colour)
//   3. causeways + bridge       (the paths that make the board a board)
//   4. landmark buildings       (one hero silhouette per district)
//   5. kit dressing             (instanced, deterministic, clustered)
//   6. social furniture         (benches/tables/circles from SOCIAL_SPOTS)
//
// Everything from step 4 onward comes out of the two Blender GLBs, drawn
// as InstancedMeshes off a single shared toon material — so the whole
// dressed world costs roughly one draw call per distinct kit piece.

import * as THREE from "three";
import {
  ISLAND, HOME_ISLE, BRIDGE, DISTRICTS, CAUSEWAYS, BUILDINGS,
  SCENERY_LANDMARKS, SOCIAL_SPOTS, MALL_PARK, MALL_EXTERIOR, inSpineCorridor,
} from "./worldLayout.js";
import { instanceProp } from "./assets.js";
import { createGroundStippleTexture } from "./groundTexture.js";
import { getBlobShadowTexture } from "./effects.js";

// ── Palette ────────────────────────────────────────────────────────────
// Warm golden-hour ground tones. Never pure white, never pure black
// (Design Bible s10). The greens are deliberately a touch yellow so the
// warm key light doesn't push them acid.
export const WORLD_COLORS = {
  grass:      0x8fbf63,
  grassWarm:  0xa8c96a,
  grassDeep:  0x6ea355,
  grassShade: 0x5c8f4d,
  sand:       0xe6d3a4,
  rock:       0xa8977c,
  rockDeep:   0x7d6e59,
  sea:        0x7fcbcb,
  seaDeep:    0x5fb0b6,
  foam:       0xd7f0ec,
  paveHub:    0xdcc79b,
  paveWay:    0xd2bf99,
  aoDecal:    0x3a2412,
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise2(x, z) {
  return Math.sin(x * 0.13) * Math.cos(z * 0.16) * 0.5
       + Math.sin((x + z) * 0.055) * 0.34
       + Math.sin(x * 0.29 - z * 0.21) * 0.16;
}

/** Gentle rolling height for the open turf, flattened to zero anywhere the
 * player actually walks on a built surface (collision assumes y=0). */
function turfHeight(x, z, radius) {
  const d = Math.hypot(x, z);
  const edge = THREE.MathUtils.smoothstep(d, radius * 0.55, radius * 0.98);
  return noise2(x * 0.9, z * 0.9) * 1.25 * edge;
}

/** A radially-subdivided disc: far better vertex distribution for a round
 * island than a square PlaneGeometry clipped to a circle, and it gives the
 * shoreline a clean edge loop to hand the cliff lathe. */
function discGeometry(radius, radial, rings) {
  const positions = [];
  const index = [];
  positions.push(0, 0, 0);
  for (let r = 1; r <= rings; r++) {
    const rad = radius * Math.pow(r / rings, 0.85);
    for (let a = 0; a < radial; a++) {
      const t = (a / radial) * Math.PI * 2;
      positions.push(Math.cos(t) * rad, 0, Math.sin(t) * rad);
    }
  }
  const idx = (r, a) => 1 + (r - 1) * radial + ((a % radial) + radial) % radial;
  for (let a = 0; a < radial; a++) index.push(0, idx(1, a + 1), idx(1, a));
  for (let r = 1; r < rings; r++) {
    for (let a = 0; a < radial; a++) {
      const a0 = idx(r, a), a1 = idx(r, a + 1), b0 = idx(r + 1, a), b1 = idx(r + 1, a + 1);
      index.push(a0, b1, b0, a0, a1, b1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  return g;
}

export class WorldBuilder {
  /**
   * @param {object} opts
   * @param {THREE.Group} opts.root everything built here is parented here
   * @param {(color:number, extra?:object) => THREE.Material} opts.makeToon
   * @param {object} opts.assets resolved result of loadEnvAssets()
   */
  constructor({ root, makeToon, assets }) {
    this.root = root;
    this.makeToon = makeToon;
    this.assets = assets;
    this.rand = mulberry32(0x4b1d);
    this.props = [];        // InstancedMesh list, for perf reporting
    this.landmarkMeshes = new Map(); // buildingId -> THREE.Mesh
    this.socialMarkers = [];
    this._aoPoints = [];
    // One material for every GLB-sourced surface in the world.
    this.kitMaterial = makeToon(0xffffff, { vertexColors: true });
  }

  /** Terrain, water and the two island plates. Synchronous: it needs no
   * loaded assets, so the world is never empty-grey while the GLBs land. */
  buildTerrain() {
    this._buildSea();
    this._buildPlate(ISLAND.center, ISLAND.radius, ISLAND.beach, 96, 30, true);
    this._buildPlate(HOME_ISLE.center, HOME_ISLE.radius, HOME_ISLE.beach, 56, 14, false);
    this._buildDistrictTerraces();
    this._buildCauseways();
    this._buildCommonsMallExterior();
    this._buildParkMallEntrance();
    this._buildMallPark();
    this._buildBridge();
  }

  /** The actual park-to-mall vestibule. Its south wall is built in three
   * structural pieces around a 2.7 m opening, so the visible doorway and
   * collision aperture are the same promise. */
  _buildParkMallEntrance() {
    const spec = BUILDINGS.find((building) => building.id === "commons-park-lobby");
    if (!spec) return;
    const group = new THREE.Group();
    group.name = "building:commons-park-lobby";
    const floorY = this.plateY(spec.center.x, spec.center.z);
    const wall = this.makeToon(0xeadbbd);
    const trim = this.makeToon(0x628f68);
    const glow = this.makeToon(0x7fc4c7, { emissive: 0x285e61, emissiveIntensity: 0.16 });
    const roof = this.makeToon(0xd8818f);
    const height = 4.15;
    const thickness = 0.34;
    const gap = 2.7;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(spec.halfW * 2, 0.22, spec.halfD * 2), this.makeToon(0xd8bd8d));
    floor.position.set(spec.center.x, floorY + 0.11, spec.center.z);
    group.add(floor);

    // Side and rear substrates.
    for (const x of [spec.center.x - spec.halfW, spec.center.x + spec.halfW]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, spec.halfD * 2), wall);
      side.position.set(x, floorY + height / 2, spec.center.z);
      group.add(side);
    }
    const rear = new THREE.Mesh(new THREE.BoxGeometry(spec.halfW * 2, height, thickness), wall);
    rear.position.set(spec.center.x, floorY + height / 2, spec.center.z + spec.halfD);
    group.add(rear);

    // South/front wall with a real opening: two jamb-bearing stubs plus lintel.
    const stubWidth = spec.halfW - gap / 2;
    for (const side of [-1, 1]) {
      const stub = new THREE.Mesh(new THREE.BoxGeometry(stubWidth, height, thickness), wall);
      stub.position.set(
        spec.center.x + side * (gap / 2 + stubWidth / 2),
        floorY + height / 2,
        spec.center.z - spec.halfD,
      );
      group.add(stub);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(gap, 0.82, thickness + 0.08), trim);
    lintel.position.set(spec.center.x, floorY + height - 0.41, spec.center.z - spec.halfD - 0.03);
    group.add(lintel);

    // Recessed luminous backing gives the entrance visible passage depth.
    const innerGlow = new THREE.Mesh(new THREE.PlaneGeometry(gap - 0.28, 2.75), glow);
    innerGlow.position.set(spec.center.x, floorY + 1.62, spec.center.z + spec.halfD - 0.2);
    innerGlow.rotation.y = Math.PI;
    group.add(innerGlow);

    const canopy = new THREE.Mesh(new THREE.ConeGeometry(3.75, 1.35, 8), roof);
    canopy.scale.z = 0.8;
    canopy.position.set(spec.center.x, floorY + height + 0.62, spec.center.z);
    canopy.rotation.y = Math.PI / 8;
    group.add(canopy);

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.11, 8, 18, Math.PI), this.makeToon(0xe3b953));
    handle.position.set(spec.center.x, floorY + 3.55, spec.center.z - spec.halfD - 0.24);
    group.add(handle);

    // Continuous apron from the approved flower arch through the doorway.
    const pathLength = (spec.center.z - spec.halfD) - MALL_PARK.portal.z + 0.8;
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(MALL_PARK.portal.clearWidth, pathLength),
      this.makeToon(0xe8d7ad, { map: createGroundStippleTexture(5) }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(MALL_PARK.portal.x, floorY + 0.025, MALL_PARK.portal.z + pathLength / 2 - 0.4);
    group.add(apron);

    this.mallParkEntrance = group;
    this.root.add(group);
    this._blob(spec.center.x, spec.center.z, 6.2, 0.22);
  }

  /** A readable three-storey outdoor silhouette for the authored mall.
   * The existing three shop pavilions remain the walk-in entrances; this
   * open-balcony backdrop makes it clear they belong to one destination. */
  _buildCommonsMallExterior() {
    const group = new THREE.Group();
    group.name = "landmark:commons-mall-exterior";

    const cream = this.makeToon(0xf0dfbd);
    const warmStone = this.makeToon(0xc69b72);
    const green = this.makeToon(0x65966b);
    const rose = this.makeToon(0xd8818f);
    const gold = this.makeToon(0xe3b953, { emissive: 0x785216, emissiveIntensity: 0.035 });
    const glass = this.makeToon(0x86bfd0, { transparent: true, opacity: 0.72, roughness: 0.35 });
    const baseY = this.plateY(MALL_EXTERIOR.center.x, MALL_EXTERIOR.center.z);

    const rear = new THREE.Mesh(
      new THREE.BoxGeometry(MALL_EXTERIOR.width, MALL_EXTERIOR.height, MALL_EXTERIOR.depth),
      cream,
    );
    rear.position.set(MALL_EXTERIOR.center.x, baseY + MALL_EXTERIOR.height / 2, MALL_EXTERIOR.center.z);
    group.add(rear);

    // Deep balcony shelves and warm horizontal bands break the mass into
    // three readable levels from the hub and from Canopy Park.
    for (const y of [3.55, 7.0, 10.35]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(30.8, 0.32, 3.2), warmStone);
      slab.position.set(0, baseY + y, 46.8);
      group.add(slab);
    }
    for (const y of [4.15, 7.6]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(29.4, 0.17, 0.15), gold);
      rail.position.set(0, baseY + y, 45.25);
      group.add(rail);
    }

    const columnGeometry = new THREE.CylinderGeometry(0.22, 0.29, 3.7, 10);
    const columns = new THREE.InstancedMesh(columnGeometry, green, 12);
    const matrix = new THREE.Matrix4();
    let columnIndex = 0;
    for (const y of [1.85, 5.3]) {
      for (const x of [-13.7, -8.2, -2.7, 2.7, 8.2, 13.7]) {
        matrix.makeTranslation(x, baseY + y, 45.45);
        columns.setMatrixAt(columnIndex++, matrix);
      }
    }
    columns.instanceMatrix.needsUpdate = true;
    group.add(columns);

    // Backed blue-green panes: readable windows with real depth rather
    // than dark decals pretending to be doors.
    const windowGeometry = new THREE.BoxGeometry(3.75, 2.25, 0.18);
    const windows = new THREE.InstancedMesh(windowGeometry, glass, 12);
    let windowIndex = 0;
    for (const y of [5.2, 8.65]) {
      for (const x of [-13, -7.8, -2.6, 2.6, 7.8, 13]) {
        matrix.makeTranslation(x, baseY + y, 48.3);
        windows.setMatrixAt(windowIndex++, matrix);
      }
    }
    windows.instanceMatrix.needsUpdate = true;
    group.add(windows);

    // Three coloured canopies visually bind the existing shop entrances
    // to this larger mall without replacing their authored geometry.
    const canopyColors = [0xd8818f, 0xe3b953, 0x759d79];
    for (let i = 0; i < 3; i++) {
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(7.2, 0.22, 2.2),
        this.makeToon(canopyColors[i]),
      );
      canopy.position.set([-12, 0, 12][i], baseY + 3.25, 39.1 + (i === 1 ? 2.6 : 0));
      canopy.rotation.x = -0.12;
      group.add(canopy);
    }

    // A large shopping-bag medallion is legible without relying on text.
    const badge = new THREE.Mesh(new THREE.BoxGeometry(2.45, 2.15, 0.34), rose);
    badge.position.set(0, baseY + 10.68, 48.18);
    group.add(badge);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.12, 8, 20, Math.PI), gold);
    handle.position.set(0, baseY + 11.78, 48.0);
    handle.rotation.y = Math.PI;
    group.add(handle);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 7), green);
    leaf.scale.set(1.5, 0.32, 0.28);
    leaf.rotation.z = 0.48;
    leaf.position.set(0.44, baseY + 10.71, 48.0);
    group.add(leaf);

    // Rooftop greenery softens the silhouette and visually hands the mall
    // off to Canopy Park rather than ending in a hard rectangular crown.
    const roofShrubGeometry = new THREE.SphereGeometry(0.72, 10, 7);
    const roofShrubs = new THREE.InstancedMesh(roofShrubGeometry, green, 7);
    [-13.2, -8.8, -4.5, 4.5, 8.8, 13.2, 0].forEach((x, index) => {
      const y = baseY + 10.78 + (index % 2) * 0.14;
      const scale = 0.82 + (index % 3) * 0.12;
      matrix.compose(
        new THREE.Vector3(x, y, 48.8),
        new THREE.Quaternion(),
        new THREE.Vector3(scale * 1.25, scale * 0.72, scale),
      );
      roofShrubs.setMatrixAt(index, matrix);
    });
    roofShrubs.instanceMatrix.needsUpdate = true;
    group.add(roofShrubs);

    // Three low pavilion crowns give the roof a friendly rhythm instead
    // of ending as one anonymous rectangular slab.
    const crownColors = [0xd8818f, 0xe3b953, 0x759d79];
    for (let i = 0; i < 3; i++) {
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(3.25, 1.45, 8),
        this.makeToon(crownColors[i]),
      );
      crown.scale.z = 0.72;
      crown.position.set([-9.6, 0, 9.6][i], baseY + 11.05, 48.9);
      crown.rotation.y = Math.PI / 8;
      group.add(crown);
    }

    for (const [x, material] of [[-14.2, rose], [14.2, green]]) {
      const banner = new THREE.Mesh(new THREE.BoxGeometry(0.72, 3.1, 0.16), material);
      banner.position.set(x, baseY + 7.1, 48.25);
      group.add(banner);
    }

    this.mallExterior = group;
    this.root.add(group);
    this._blob(0, 48.0, 29, 0.24);
  }

  /** Canopy Park is a compact side loop beside the mall approach. The
   * central bloom chimes establish one unmistakable silhouette; the loop
   * path and three coloured petal markers communicate the optional play
   * pattern without text or a minimap. */
  _buildMallPark() {
    const { x: cx, z: cz } = MALL_PARK.center;
    const group = new THREE.Group();
    group.name = "landmark:canopy-park";

    const lawn = new THREE.Mesh(
      new THREE.CircleGeometry(MALL_PARK.radius, 48),
      this.makeToon(0xa9c979, { map: createGroundStippleTexture(7) }),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = 0.045;
    group.add(lawn);

    const loop = new THREE.Mesh(
      new THREE.RingGeometry(4.65, 5.75, 48),
      this.makeToon(0xe5cf9f, { map: createGroundStippleTexture(8) }),
    );
    loop.rotation.x = -Math.PI / 2;
    loop.position.y = 0.075;
    group.add(loop);

    // A broad, unmistakable threshold from the Commons into the loop.
    // It is an open garden portal, not a decorative false doorway: the
    // path runs continuously below it and the Bloom Chimes stay visible.
    const thresholdMaterial = this.makeToon(0xe8d7ad, { map: createGroundStippleTexture(9) });
    const threshold = new THREE.Mesh(new THREE.PlaneGeometry(MALL_PARK.portal.clearWidth, 3.4), thresholdMaterial);
    threshold.rotation.x = -Math.PI / 2;
    threshold.position.set(MALL_PARK.portal.x - cx, 0.082, MALL_PARK.portal.z - cz);
    group.add(threshold);

    const portalGreen = this.makeToon(0x54865b);
    const portalBloom = this.makeToon(0xf4a2a7, { emissive: 0x8e343f, emissiveIntensity: 0.035 });
    for (const postWorld of MALL_PARK.portal.posts) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 2.45, 9), portalGreen);
      post.position.set(postWorld.x - cx, 1.225, postWorld.z - cz);
      group.add(post);

      const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), portalBloom);
      flower.position.set(postWorld.x - cx, 2.65, postWorld.z - cz);
      group.add(flower);
    }
    const garland = new THREE.Mesh(new THREE.TorusGeometry(1.66, 0.11, 7, 18, Math.PI), portalGreen);
    garland.position.set(MALL_PARK.portal.x - cx, 2.44, MALL_PARK.portal.z - cz);
    group.add(garland);

    // Three short radial cues keep the discoveries legible from the loop
    // without turning the garden into a checklist or a fenced attraction.
    const cueMaterial = this.makeToon(0xf0dfb6);
    for (const discovery of MALL_PARK.discoveries) {
      const dx = discovery.x - cx;
      const dz = discovery.z - cz;
      const angle = Math.atan2(dz, dx);
      for (let i = 0; i < 3; i++) {
        const r = 3.9 + i * 0.42;
        const paver = new THREE.Mesh(new THREE.CircleGeometry(0.21 - i * 0.025, 10), cueMaterial);
        paver.rotation.x = -Math.PI / 2;
        paver.position.set(Math.cos(angle) * r, 0.105, Math.sin(angle) * r);
        group.add(paver);
      }
    }

    const bedMaterial = this.makeToon(0x729a62);
    const beds = [
      { a: 0.55, r: 3.15, sx: 1.5, sy: 0.70, rot: 0.18 },
      { a: 1.92, r: 3.45, sx: 1.18, sy: 0.82, rot: -0.22 },
      { a: 3.18, r: 3.10, sx: 1.42, sy: 0.66, rot: 0.42 },
      { a: 4.55, r: 3.42, sx: 1.15, sy: 0.84, rot: -0.36 },
      { a: 5.58, r: 2.92, sx: 0.92, sy: 0.62, rot: 0.16 },
    ];
    for (const spec of beds) {
      const bed = new THREE.Mesh(new THREE.CircleGeometry(1.45, 24), bedMaterial);
      bed.rotation.x = -Math.PI / 2;
      bed.rotation.z = spec.rot;
      bed.scale.set(spec.sx, spec.sy, 1);
      bed.position.set(Math.sin(spec.a) * spec.r, 0.095, Math.cos(spec.a) * spec.r);
      group.add(bed);
    }

    const moundMaterial = this.makeToon(0x86ad69);
    for (const [x, z, sx] of [[-4.8, 1.2, 1.25], [-3.9, -3.5, 0.9], [3.8, 3.6, 1.05]]) {
      const mound = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 7), moundMaterial);
      mound.scale.set(sx, 0.28, 0.9 + sx * 0.12);
      mound.position.set(x, 0.12, z);
      group.add(mound);
    }

    const stemMaterial = this.makeToon(0x4f8158);
    const bloomMaterial = this.makeToon(0xef858c, { emissive: 0x7d2832, emissiveIntensity: 0.025 });
    const innerBloomMaterial = this.makeToon(0xf8afb0, { emissive: 0x8f3941, emissiveIntensity: 0.035 });
    const bellMaterial = this.makeToon(0xffd56b, { metalness: 0.18, roughness: 0.42, emissive: 0x7e5412, emissiveIntensity: 0.08 });
    const stemAnchors = [[-1.15, 0.35, 3.15], [1.15, 0.35, 3.15], [0, -0.65, 3.65]];
    for (const [x, z, h] of stemAnchors) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, h, 10), stemMaterial);
      stem.position.set(x, h / 2, z);
      group.add(stem);

      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 7), stemMaterial);
      leaf.scale.set(1.35, 0.18, 0.52);
      leaf.rotation.set(0.12, x < 0 ? -0.55 : 0.55, x < 0 ? -0.35 : 0.35);
      leaf.position.set(x + (x <= 0 ? -0.38 : 0.38), h * 0.5, z + 0.08);
      group.add(leaf);
    }
    const bloom = new THREE.Group();
    bloom.position.set(0, 3.5, 0);
    bloom.name = "canopy-park-bloom";
    const petalGeometry = new THREE.SphereGeometry(0.7, 12, 8);
    const petals = new THREE.InstancedMesh(petalGeometry, bloomMaterial, 6);
    const petalMatrix = new THREE.Matrix4();
    const petalQuat = new THREE.Quaternion();
    const petalScale = new THREE.Vector3(1.0, 0.26, 0.46);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      petalQuat.setFromEuler(new THREE.Euler(0, a - Math.PI / 2, -0.17 + (i % 2) * 0.035));
      petalMatrix.compose(new THREE.Vector3(Math.sin(a) * 1.02, 0.06, Math.cos(a) * 1.02), petalQuat, petalScale);
      petals.setMatrixAt(i, petalMatrix);
    }
    petals.instanceMatrix.needsUpdate = true;
    bloom.add(petals);

    const innerPetalGeometry = new THREE.SphereGeometry(0.52, 12, 8);
    const innerPetals = new THREE.InstancedMesh(innerPetalGeometry, innerBloomMaterial, 6);
    const innerScale = new THREE.Vector3(0.72, 0.22, 0.36);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      petalQuat.setFromEuler(new THREE.Euler(0, a - Math.PI / 2, 0.20 + (i % 2) * 0.035));
      petalMatrix.compose(new THREE.Vector3(Math.sin(a) * 0.61, 0.20, Math.cos(a) * 0.61), petalQuat, innerScale);
      innerPetals.setMatrixAt(i, petalMatrix);
    }
    innerPetals.instanceMatrix.needsUpdate = true;
    bloom.add(innerPetals);
    const calyxMaterial = this.makeToon(0x4f8158);
    const calyxGeometry = new THREE.SphereGeometry(0.46, 10, 7);
    const calyx = new THREE.InstancedMesh(calyxGeometry, calyxMaterial, 6);
    const calyxScale = new THREE.Vector3(0.88, 0.18, 0.34);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      petalQuat.setFromEuler(new THREE.Euler(0, a - Math.PI / 2, -0.20));
      petalMatrix.compose(new THREE.Vector3(Math.sin(a) * 0.55, -0.18, Math.cos(a) * 0.55), petalQuat, calyxScale);
      calyx.setMatrixAt(i, petalMatrix);
    }
    calyx.instanceMatrix.needsUpdate = true;
    bloom.add(calyx);
    const bloomHeart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 1), bellMaterial);
    bloomHeart.position.y = 0.43;
    bloomHeart.scale.set(1.08, 0.88, 1.08);
    bloom.add(bloomHeart);
    group.add(bloom);
    this.parkChimes = [];
    for (let i = 0; i < 3; i++) {
      const x = [-0.82, 0, 0.82][i];
      const chime = new THREE.Group();
      chime.position.set(x, 3.26, 0.15);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 6), stemMaterial);
      cord.position.y = -0.36;
      const bell = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.34, 10), bellMaterial);
      bell.position.y = -0.78;
      const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 5), bellMaterial);
      clapper.position.y = -1.0;
      chime.add(cord, bell, clapper);
      group.add(chime);
      this.parkChimes.push(chime);
    }

    const planterRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.52, 0.14, 8, 32),
      this.makeToon(0xc5aa7a),
    );
    planterRim.rotation.x = Math.PI / 2;
    planterRim.position.y = 0.16;
    group.add(planterRim);
    const planterSoil = new THREE.Mesh(new THREE.CircleGeometry(1.43, 32), this.makeToon(0x765840));
    planterSoil.rotation.x = -Math.PI / 2;
    planterSoil.position.y = 0.11;
    group.add(planterSoil);

    // One cheap point cloud gives the landmark life without competing
    // with the discovery petals or introducing extra dynamic lights.
    const motePositions = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = 1.55 + (i % 4) * 0.27;
      motePositions.push(Math.sin(a) * r, 1.0 + (i % 6) * 0.42, Math.cos(a) * r);
    }
    const moteGeometry = new THREE.BufferGeometry();
    moteGeometry.setAttribute("position", new THREE.Float32BufferAttribute(motePositions, 3));
    const motes = new THREE.Points(
      moteGeometry,
      new THREE.PointsMaterial({ color: 0xffe6a2, size: 0.085, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    group.add(motes);

    this.parkPetals = new Map();
    for (const discovery of MALL_PARK.discoveries) {
      const petal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.34, 0),
        this.makeToon(discovery.color, { emissive: discovery.color, emissiveIntensity: 0.12 }),
      );
      petal.position.set(discovery.x - cx, 0.48, discovery.z - cz);
      petal.rotation.y = 0.35;
      petal.name = `canopy-park-petal:${discovery.id}`;
      group.add(petal);
      this.parkPetals.set(discovery.id, petal);
    }

    group.position.set(cx, 0, cz);
    this.parkHero = bloom;
    this._parkMotion = { bloom, chimes: this.parkChimes, motes };
    this.root.add(group);
    this._blob(cx, cz, 4.8, 0.24);
  }

  _buildSea() {
    // A wide, calm disc a little below the island's beach. Two tones (a
    // lighter shallow ring nearer the shore) so the water reads as having
    // depth without a shader or a normal map.
    const deep = new THREE.Mesh(
      new THREE.CircleGeometry(190, 64),
      this.makeToon(WORLD_COLORS.seaDeep, { transparent: false }),
    );
    deep.rotation.x = -Math.PI / 2;
    deep.position.y = ISLAND.seaLevel - 0.4;
    deep.name = "sea-deep";
    this.root.add(deep);

    for (const isle of [ISLAND, HOME_ISLE]) {
      const shallow = new THREE.Mesh(
        new THREE.RingGeometry(isle.radius - 1, isle.radius + 11, 64),
        this.makeToon(WORLD_COLORS.sea, { transparent: true, opacity: 0.92 }),
      );
      shallow.rotation.x = -Math.PI / 2;
      shallow.position.set(isle.center.x, ISLAND.seaLevel - 0.25, isle.center.z);
      this.root.add(shallow);

      const foam = new THREE.Mesh(
        new THREE.RingGeometry(isle.radius - 0.4, isle.radius + 1.3, 72),
        new THREE.MeshBasicMaterial({ color: WORLD_COLORS.foam, transparent: true, opacity: 0.55, depthWrite: false }),
      );
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(isle.center.x, ISLAND.seaLevel + 0.06, isle.center.z);
      foam.renderOrder = 1;
      this.root.add(foam);
      this._foam = this._foam || [];
      this._foam.push(foam);
    }
  }

  /** One island: a vertex-coloured grass top with gentle relief, a sand
   * shoulder, and a lathed rock skirt dropping into the water. */
  _buildPlate(center, radius, beach, radial, rings, isMain) {
    const geo = discGeometry(radius + beach, radial, rings);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(WORLD_COLORS.grass);
    const warm = new THREE.Color(WORLD_COLORS.grassWarm);
    const deep = new THREE.Color(WORLD_COLORS.grassDeep);
    const shade = new THREE.Color(WORLD_COLORS.grassShade);
    const sand = new THREE.Color(WORLD_COLORS.sand);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i), lz = pos.getZ(i);
      const wx = lx + center.x, wz = lz + center.z;
      const d = Math.hypot(lx, lz);
      const h = d > radius * 0.5 ? turfHeight(wx, wz, radius) * (isMain ? 1 : 0.5) : 0;
      // Flatten the beach shoulder so the shoreline reads as one clean line.
      const beachT = THREE.MathUtils.smoothstep(d, radius - 1.5, radius + 1.2);
      pos.setY(i, h * (1 - beachT) - beachT * 0.55);

      const n = noise2(wx, wz);
      c.copy(grass).lerp(warm, THREE.MathUtils.clamp(n * 0.6 + 0.5, 0, 1));
      c.lerp(deep, THREE.MathUtils.clamp(Math.sin(wx * 0.07 + wz * 0.09) * 0.5 + 0.25, 0, 0.55));
      c.lerp(shade, THREE.MathUtils.clamp(Math.abs(h) * 0.35, 0, 0.5));
      c.lerp(sand, beachT);
      this._darkenNearProps(wx, wz, c);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = this.makeToon(0xffffff, { vertexColors: true, map: createGroundStippleTexture(1) });
    // The stipple map has no UVs on this custom disc, so give it planar
    // UVs derived from XZ — cheap, and it keeps the turf from reading as
    // one flat wash of colour up close.
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) + center.x) / 9;
      uv[i * 2 + 1] = (pos.getZ(i) + center.z) / 9;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    const top = new THREE.Mesh(geo, mat);
    top.position.set(center.x, 0, center.z);
    top.name = isMain ? "island-top" : "home-isle-top";
    this.root.add(top);

    // Rock skirt: a lathe profile from the beach edge down past the water.
    const R = radius + beach;
    const profile = [
      new THREE.Vector2(R, -0.55),
      new THREE.Vector2(R + 0.5, -1.5),
      new THREE.Vector2(R - 0.2, -3.2),
      new THREE.Vector2(R - 1.8, -5.4),
      new THREE.Vector2(R - 4.5, -7.6),
      new THREE.Vector2(R - 8.0, -8.6),
    ];
    const lathe = new THREE.LatheGeometry(profile, Math.round(radial * 0.6));
    const lpos = lathe.attributes.position;
    const lcol = new Float32Array(lpos.count * 3);
    const rock = new THREE.Color(WORLD_COLORS.rock);
    const rockDeep = new THREE.Color(WORLD_COLORS.rockDeep);
    const sandC = new THREE.Color(WORLD_COLORS.sand);
    for (let i = 0; i < lpos.count; i++) {
      const y = lpos.getY(i);
      const t = THREE.MathUtils.clamp((-y - 0.55) / 7.0, 0, 1);
      c.copy(sandC).lerp(rock, THREE.MathUtils.smoothstep(t, 0, 0.28));
      c.lerp(rockDeep, THREE.MathUtils.smoothstep(t, 0.35, 1));
      lcol[i * 3] = c.r; lcol[i * 3 + 1] = c.g; lcol[i * 3 + 2] = c.b;
    }
    lathe.setAttribute("color", new THREE.BufferAttribute(lcol, 3));
    lathe.computeVertexNormals();
    const skirt = new THREE.Mesh(lathe, this.makeToon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
    skirt.position.set(center.x, 0, center.z);
    skirt.name = isMain ? "island-cliff" : "home-isle-cliff";
    this.root.add(skirt);
  }

  _darkenNearProps(x, z, color) {
    // Fake contact AO baked into the turf under every terrace edge and
    // building footprint: the cheapest possible grounding cue, free at
    // runtime because it lives in vertex colours already being uploaded.
    let darken = 0;
    for (const d of DISTRICTS) {
      if (d.id === "hub") continue;
      const dist = Math.abs(Math.hypot(x - d.center.x, z - d.center.z) - d.radius);
      if (dist < 3.2) darken = Math.max(darken, THREE.MathUtils.mapLinear(dist, 0, 3.2, 0.30, 0));
    }
    for (const b of BUILDINGS) {
      const dx = Math.max(0, Math.abs(x - b.center.x) - b.halfW - 0.8);
      const dz = Math.max(0, Math.abs(z - b.center.z) - b.halfD - 0.8);
      const dist = Math.hypot(dx, dz);
      if (dist < 2.6) darken = Math.max(darken, THREE.MathUtils.mapLinear(dist, 0, 2.6, 0.38, 0));
    }
    if (darken > 0) color.multiplyScalar(1 - darken);
    return color;
  }

  /** Each district is a low plate: a chamfered drum in the district's trim
   * colour, a paved top in its floor colour, and a soft AO ring on the
   * turf. Colour alone never carries the meaning — the plate's raised
   * silhouette and its landmark do too (Design Bible s10 accessibility). */
  _buildDistrictTerraces() {
    for (const d of DISTRICTS) {
      const g = new THREE.Group();
      g.name = `district:${d.id}`;
      g.position.set(d.center.x, 0, d.center.z);
      const H = d.id === "hub" ? 0.34 : 0.26;

      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(d.radius, d.radius + 0.55, H, 64, 1, true),
        this.makeToon(d.trim, { side: THREE.DoubleSide }),
      );
      drum.position.y = H / 2;
      g.add(drum);

      const top = new THREE.Mesh(
        new THREE.CircleGeometry(d.radius, 64),
        this.makeToon(d.floor, { map: createGroundStippleTexture(Math.max(6, Math.round(d.radius / 1.1))) }),
      );
      top.rotation.x = -Math.PI / 2;
      top.position.y = H;
      g.add(top);

      // Inner ring inlay, a shade darker, so a big plate isn't one flat
      // wash — and it reads as deliberate paving, not a coloured decal.
      const inlay = new THREE.Mesh(
        new THREE.RingGeometry(d.radius * 0.52, d.radius * 0.62, 64),
        this.makeToon(d.trim, { transparent: true, opacity: 0.45 }),
      );
      inlay.rotation.x = -Math.PI / 2;
      inlay.position.y = H + 0.006;
      g.add(inlay);

      const ao = new THREE.Mesh(
        new THREE.RingGeometry(d.radius + 0.4, d.radius + 3.4, 64),
        new THREE.MeshBasicMaterial({
          color: WORLD_COLORS.aoDecal, transparent: true, opacity: 0.17,
          depthWrite: false, map: getBlobShadowTexture(),
        }),
      );
      ao.rotation.x = -Math.PI / 2;
      ao.position.y = 0.02;
      ao.renderOrder = -2;
      g.add(ao);

      this.root.add(g);
    }
  }

  _buildCauseways() {
    const mat = this.makeToon(WORLD_COLORS.paveWay, { map: createGroundStippleTexture(14) });
    for (const w of CAUSEWAYS) {
      const mid = { x: (w.from.x + w.to.x) / 2, z: (w.from.z + w.to.z) / 2 };
      const deck = new THREE.Mesh(new THREE.PlaneGeometry(w.width, w.length + 3), mat);
      deck.rotation.x = -Math.PI / 2;
      deck.rotation.z = -w.angle;
      deck.position.set(mid.x, 0.055, mid.z);
      deck.name = `causeway:${w.districtId}`;
      this.root.add(deck);
    }
    // Kerb stones down both sides of every causeway. Deliberately under
    // half a metre so they read as edging from the follow camera and never
    // become something the camera has to see past.
    const kerb = [];
    for (const w of CAUSEWAYS) {
      const dx = w.to.x - w.from.x, dz = w.to.z - w.from.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len, pz = dx / len;
      for (let t = 0; t <= 1.0001; t += 1.6 / len) {
        for (const side of [-1, 1]) {
          kerb.push({
            x: w.from.x + dx * t + px * side * (w.width / 2 + 0.25),
            z: w.from.z + dz * t + pz * side * (w.width / 2 + 0.25),
            rotY: this.rand() * 6.28, scale: 0.42 + this.rand() * 0.18,
          });
        }
      }
    }
    this._kerbStones = kerb;

    // The walk out to the jetty, past the Landing plate.
    // The short walk from the Landing plate out to Marlow's jetty.
    const pier = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.2), mat);
    pier.rotation.x = -Math.PI / 2;
    pier.position.set(6.5, 0.055, -47.5);
    this.root.add(pier);
  }

  _buildBridge() {
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(BRIDGE.maxX - BRIDGE.minX, 0.28, BRIDGE.maxZ - BRIDGE.minZ),
      this.makeToon(0xc0975f),
    );
    deck.position.set(0, -0.02, (BRIDGE.minZ + BRIDGE.maxZ) / 2);
    deck.name = "home-bridge";
    this.root.add(deck);
    // Plank lines, so a 12m deck isn't one flat slab.
    const plankMat = this.makeToon(0x9d7745);
    const plankGeo = new THREE.BoxGeometry(BRIDGE.maxX - BRIDGE.minX + 0.1, 0.06, 0.16);
    for (let z = BRIDGE.minZ + 0.6; z < BRIDGE.maxZ; z += 1.1) {
      const plank = new THREE.Mesh(plankGeo, plankMat);
      plank.position.set(0, 0.13, z);
      this.root.add(plank);
    }
  }

  // ── Landmarks and dressing (needs the loaded GLBs) ───────────────────
  buildFromAssets() {
    this._placeBuildings();
    this._placeSceneryLandmarks();
    this._placeWoods();
    this._placeDistrictDressing();
    this._placeLamps();
    this._placeSocialFurniture();
    this._placeCausewayEdging();
    this._placeBridgeRails();
    this._placeShoreDetail();
  }

  _mesh(assetName, x, z, rotY = 0, scale = 1) {
    const geo = this.assets.get(assetName);
    const mesh = new THREE.Mesh(geo, this.kitMaterial);
    mesh.position.set(x, this.plateY(x, z), z);
    mesh.rotation.y = rotY;
    mesh.scale.setScalar(scale);
    mesh.name = `landmark:${assetName}`;
    this.root.add(mesh);
    return mesh;
  }

  _placeBuildings() {
    for (const b of BUILDINGS) {
      if (b.entranceOnly) continue;
      const mesh = this._mesh(b.asset, b.center.x, b.center.z, b.facing);
      mesh.name = `building:${b.id}`;
      this.landmarkMeshes.set(b.id, mesh);
      this._blob(b.center.x, b.center.z, Math.max(b.halfW, b.halfD) * 2.3, 0.30);
    }
  }

  _placeSceneryLandmarks() {
    for (const l of SCENERY_LANDMARKS) {
      const m = this._mesh(l.asset, l.x, l.z, l.rotY, l.scale);
      this.landmarkMeshes.set(l.asset, m);
      if (l.asset !== "dock_jetty") this._blob(l.x, l.z, l.asset === "kindred_tree" ? 12 : 8, 0.3);
    }
  }

  /** A soft dark decal under a big object. One shared texture, one
   * material, drawn flat — cheaper and softer than any shadow map, and it
   * matches the storybook read the whole world is aiming at. */
  /** The y a ground decal has to sit at to be ON the surface at (x,z):
   * district plates are raised, so a blob left at y=0.03 would be buried
   * under the plate it is meant to ground a building onto. */
  _surfaceY(x, z) {
    return this.plateY(x, z) + 0.03;
  }

  /** Height of the built surface at (x,z): the top of a district terrace
   * if one is underneath, otherwise ground level. */
  plateY(x, z) {
    for (const d of DISTRICTS) {
      if (Math.hypot(x - d.center.x, z - d.center.z) <= d.radius) {
        return d.id === "hub" ? 0.34 : 0.26;
      }
    }
    return 0;
  }

  _blob(x, z, size, opacity) {
    if (!this._blobMat) {
      this._blobMat = new THREE.MeshBasicMaterial({
        map: getBlobShadowTexture(), color: WORLD_COLORS.aoDecal,
        transparent: true, opacity: 1, depthWrite: false, fog: true,
      });
      this._blobGeo = new THREE.PlaneGeometry(1, 1);
      this._blobs = [];
    }
    this._blobs.push({ x, z, size, opacity });
  }

  flushBlobs() {
    if (!this._blobs?.length) return;
    const mesh = new THREE.InstancedMesh(this._blobGeo, this._blobMat, this._blobs.length);
    mesh.name = "contact-shadows";
    mesh.renderOrder = -1;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const c = new THREE.Color();
    this._blobs.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, this._surfaceY(b.x, b.z), b.z), q, new THREE.Vector3(b.size, b.size, 1));
      mesh.setMatrixAt(i, m);
      c.setScalar(b.opacity);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this._blobMat.transparent = true;
    this._blobMat.opacity = 1;
    this._blobMat.blending = THREE.NormalBlending;
    this.root.add(mesh);
    this.props.push(mesh);
  }

  _add(assetName, placements, name = assetName) {
    if (!placements.length) return;
    // Snap every placement onto whatever surface is actually under it.
    // District terraces are raised plates, so a prop left at y=0 sinks a
    // quarter-metre into the paving it is standing on — which is exactly
    // what made the benches read as lying flat on the floor.
    for (const p of placements) {
      if (p.y === undefined) p.y = this.plateY(p.x, p.z);
      else p.y += this.plateY(p.x, p.z);
    }
    const mesh = instanceProp(this.assets.get(assetName), this.kitMaterial, placements, `kit:${name}`);
    if (!mesh) return;
    this.root.add(mesh);
    this.props.push(mesh);
  }

  /** Is (x,z) somewhere a prop must never stand: on a district plate, on a
   * causeway, in a building footprint, or in the opening sightline. */
  _blocked(x, z, pad = 0) {
    if (inSpineCorridor(x, z)) return true;
    if (Math.hypot(x - MALL_PARK.center.x, z - MALL_PARK.center.z) < MALL_PARK.radius + pad) return true;
    for (const d of DISTRICTS) {
      if (Math.hypot(x - d.center.x, z - d.center.z) < d.radius + pad) return true;
    }
    for (const w of CAUSEWAYS) {
      const dx = w.to.x - w.from.x, dz = w.to.z - w.from.z;
      const len2 = dx * dx + dz * dz;
      let t = ((x - w.from.x) * dx + (z - w.from.z) * dz) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = w.from.x + t * dx, pz = w.from.z + t * dz;
      if (Math.hypot(x - px, z - pz) < w.width / 2 + 1.6) return true;
    }
    return false;
  }

  /** The woods that ring the island. Clustered, not scattered: real
   * woodland clumps, and clumping is also what keeps the silhouette
   * interesting from the low follow camera. */
  _placeWoods() {
    const broad = [], pine = [], bushes = [], rocks = [];
    const R = ISLAND.radius;
    for (let i = 0; i < 190; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = 20 + Math.pow(this.rand(), 0.55) * (R - 22);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (this._blocked(x, z, 2.5)) continue;
      const roll = this.rand();
      const p = { x, z, rotY: this.rand() * Math.PI * 2, scale: 0.85 + this.rand() * 0.55 };
      if (roll < 0.42) { p.tint = this.rand() > 0.5 ? 0xf3ffe8 : 0xdcecc8; broad.push(p); }
      else if (roll < 0.70) { p.tint = 0xe8f2dc; pine.push(p); }
      else if (roll < 0.90) bushes.push(p);
      else rocks.push(p);
    }
    // The home isle gets its own small wood, hugging the shoreline so the
    // middle of your own island stays open — the space you are meant to
    // fill yourself, not one a tree got to first.
    for (let i = 0; i < 40; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = HOME_ISLE.radius + 0.5 + this.rand() * (HOME_ISLE.beach - 0.5);
      const x = HOME_ISLE.center.x + Math.sin(a) * r;
      const z = HOME_ISLE.center.z + Math.cos(a) * r;
      if (Math.hypot(x - 0, z - (-84)) < 9) continue;
      if (Math.abs(x) < 5 && z > -66) continue; // keep the bridge head clear
      const p = { x, z, rotY: this.rand() * Math.PI * 2, scale: 0.8 + this.rand() * 0.4 };
      if (this.rand() < 0.5) { p.tint = 0xeaf6dc; broad.push(p); }
      else if (this.rand() < 0.6) pine.push(p);
      else bushes.push(p);
    }
    this._add("tree_broad", broad);
    this._add("tree_pine", pine);
    this._add("bush", bushes);
    this._add("rock_a", rocks);
    for (const p of [...broad, ...pine]) this._blob(p.x, p.z, 2.6 * p.scale, 0.26);
  }

  /** Per-district dressing. Each list is authored, not random, because a
   * district's identity is exactly what a random scatter destroys. */
  _placeDistrictDressing() {
    const blossom = [], planters = [], flowers = [], stalls = [], crates = [],
      barrels = [], fences = [], signs = [], reeds = [], ponds = [], easels = [],
      rocks = [], bushes = [];

    // ── Lanternfall Plaza: planters and blossom ringing the paving, so
    // the biggest open surface in the world has something at its edges
    // without ever blocking the walk to the Tree.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.92;
      const r = 11.4;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (inSpineCorridor(x, z)) continue;
      planters.push({ x, z, scale: 1.05, rotY: a });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const x = Math.sin(a) * 15.5, z = Math.cos(a) * 15.5;
      if (inSpineCorridor(x, z)) continue;
      flowers.push({ x, z, rotY: a });
    }

    // ── The Commons: a market courtyard in front of the three shopfronts.
    stalls.push({ x: -6.5, z: 26.5, rotY: 0.12 }, { x: 6.5, z: 26.5, rotY: -0.12 });
    crates.push({ x: -9.5, z: 24.5 }, { x: -8.6, z: 25.4, y: 0.52, rotY: 0.4 }, { x: 9.4, z: 24.6, rotY: -0.3 });
    barrels.push({ x: 10.6, z: 25.4 }, { x: -10.8, z: 36 });
    planters.push({ x: -16, z: 28, scale: 1.1 }, { x: 16, z: 28, scale: 1.1 },
      { x: -6.5, z: 36.5 }, { x: 6.5, z: 36.5 }, { x: 0, z: 38.6, scale: 1.15 });
    signs.push({ x: -6.5, z: 20.5, rotY: Math.PI - 0.5 });
    planters.push({ x: -10.5, z: 23, scale: 1.1 }, { x: 10.5, z: 23, scale: 1.1 },
      { x: -13.5, z: 31 }, { x: 13.5, z: 31 });
    crates.push({ x: 12.5, z: 21.5, rotY: -0.5 });
    barrels.push({ x: -12.4, z: 21.2 });
    flowers.push({ x: -14, z: 40 }, { x: 14, z: 40 }, { x: -4, z: 21.5 }, { x: 4, z: 21.5 });

    // ── Canopy Park: low authored planting keeps the loop lively without
    // competing with the Bloom Chimes or blocking discovery sightlines.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.35;
      flowers.push({
        x: MALL_PARK.center.x + Math.sin(a) * 3.15,
        z: MALL_PARK.center.z + Math.cos(a) * 3.15,
        rotY: a,
        scale: 0.72 + (i % 3) * 0.08,
      });
    }
    bushes.push(
      { x: MALL_PARK.center.x - 6.2, z: MALL_PARK.center.z - 2.0, scale: 0.82 },
      { x: MALL_PARK.center.x - 5.7, z: MALL_PARK.center.z + 4.1, scale: 0.92 },
      { x: MALL_PARK.center.x - 3.1, z: MALL_PARK.center.z + 6.0, scale: 0.72 },
      { x: MALL_PARK.center.x + 1.8, z: MALL_PARK.center.z + 5.9, scale: 0.66 },
      { x: MALL_PARK.center.x + 5.9, z: MALL_PARK.center.z + 2.3, scale: 0.76 },
    );
    rocks.push(
      { x: MALL_PARK.center.x - 5.0, z: MALL_PARK.center.z + 1.2, scale: 0.64, rotY: 0.4 },
      { x: MALL_PARK.center.x - 3.8, z: MALL_PARK.center.z - 3.6, scale: 0.48, rotY: -0.8 },
      { x: MALL_PARK.center.x + 3.9, z: MALL_PARK.center.z + 3.7, scale: 0.52, rotY: 0.15 },
    );

    // ── The Quiet Garden: raised beds, a pond, blossom, and no through-path.
    const gx = -34, gz = 6;
    ponds.push({ x: gx - 3, z: gz - 6.5, rotY: 0.3, scale: 1.15 });
    reeds.push({ x: gx - 5.4, z: gz - 5.2 }, { x: gx - 0.8, z: gz - 8.2 }, { x: gx - 4.6, z: gz - 8.6 });
    for (let i = 0; i < 7; i++) {
      const a = 0.5 + i * 0.72;
      flowers.push({ x: gx + Math.sin(a) * (5 + (i % 3)), z: gz + Math.cos(a) * (5 + (i % 3)), rotY: a });
    }
    blossom.push({ x: gx + 6.5, z: gz + 5.5, rotY: 0.4 }, { x: gx - 6.8, z: gz + 4.2, rotY: 2.1, scale: 0.9 });
    planters.push({ x: gx + 4.5, z: gz - 4.5 }, { x: gx - 7.5, z: gz - 1.5 }, { x: gx + 7, z: gz - 6 });
    fences.push({ x: gx + 2, z: gz + 8.4, rotY: 0 }, { x: gx - 2, z: gz + 8.4, rotY: 0 });
    bushes.push({ x: gx + 8.2, z: gz - 6.5, scale: 1.2 }, { x: gx - 8.5, z: gz + 7, scale: 1.1 });

    // ── Hearthlight: parasol tables live in SOCIAL_SPOTS; here, the trim.
    const cx = 34, cz = 6;
    planters.push({ x: cx - 6.5, z: cz + 6.5 }, { x: cx - 6.5, z: cz - 6.5 }, { x: cx + 2, z: cz + 9 });
    blossom.push({ x: cx + 7.5, z: cz + 8, rotY: 1.1, scale: 0.95 });
    flowers.push({ x: cx - 8, z: cz + 2 }, { x: cx + 6, z: cz - 8 });
    barrels.push({ x: cx + 6.5, z: cz + 4.5 });

    // ── The Round: banners and lanterns round an open performance floor.
    const sx = 22, sz = -26;
    signs.push({ x: sx - 8, z: sz + 6, rotY: -0.9 });
    planters.push({ x: sx - 6, z: sz + 7.5 }, { x: sx + 8, z: sz + 5 });
    flowers.push({ x: sx - 9, z: sz - 3 }, { x: sx + 4, z: sz + 9 });
    rocks.push({ x: sx + 9.5, z: sz - 6, scale: 1.2, rotY: 0.8 });

    // ── The Makery: work in progress, deliberately untidy.
    const wx = -22, wz = -26;
    crates.push({ x: wx + 6, z: wz + 5.5 }, { x: wx + 6.9, z: wz + 6.3, y: 0.52, rotY: 0.5 },
      { x: wx - 7.5, z: wz + 3, rotY: -0.3 });
    barrels.push({ x: wx + 4.5, z: wz + 7 }, { x: wx - 5.5, z: wz - 6.5 });
    easels.push({ x: wx - 6.2, z: wz + 6.2, rotY: -0.9 });
    fences.push({ x: wx + 2, z: wz - 8.6, rotY: 0 }, { x: wx - 2, z: wz - 8.6, rotY: 0 });
    signs.push({ x: wx + 8, z: wz + 6, rotY: 0.9 });

    // ── The Landing: the state of somewhere people arrive.
    crates.push({ x: -5.5, z: -41.5, rotY: 0.2 }, { x: -4.7, z: -42.3, y: 0.52 }, { x: 5.8, z: -41 });
    barrels.push({ x: 6.6, z: -42 }, { x: -6.4, z: -46.5 });
    signs.push({ x: 3.5, z: -38.5, rotY: 0.2 });
    planters.push({ x: -7, z: -44 }, { x: 7, z: -45 });

    // ── Your island: a couple of beds and a fence, and room left empty.
    const hx = HOME_ISLE.center.x, hz = HOME_ISLE.center.z;
    planters.push({ x: hx - 5.5, z: hz + 3 }, { x: hx + 5.5, z: hz + 3 });
    flowers.push({ x: hx - 3.5, z: hz + 6 }, { x: hx + 3.5, z: hz + 6.5 }, { x: hx - 6.5, z: hz - 2 });
    fences.push({ x: hx - 6, z: hz + 8, rotY: 0 }, { x: hx + 6, z: hz + 8, rotY: 0 });
    blossom.push({ x: hx + 8.5, z: hz - 1, rotY: 0.6 });

    this._add("tree_blossom", blossom);
    this._add("planter", planters);
    this._add("flower_clump", flowers);
    this._add("market_stall", stalls);
    this._add("crate", crates);
    this._add("barrel", barrels);
    this._add("fence_panel", fences);
    this._add("signpost", signs);
    this._add("reeds", reeds);
    this._add("koi_pond", ponds);
    this._add("easel", easels);
    this._add("rock_b", rocks);
    this._add("bush", bushes, "bush-district");
    for (const p of [...stalls, ...blossom]) this._blob(p.x, p.z, 3.4, 0.24);
  }

  /** Lamps: paired along every causeway, ringing the hub, and one at each
   * district's entry. Light source storytelling (Design Bible s9): the lit
   * path is always the way back to the Tree. */
  _placeLamps() {
    const lamps = [];
    for (const w of CAUSEWAYS) {
      const dx = w.to.x - w.from.x, dz = w.to.z - w.from.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len, pz = dx / len;
      const steps = Math.max(1, Math.round(len / 11));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        for (const side of [-1, 1]) {
          lamps.push({
            x: w.from.x + dx * t + px * side * (w.width / 2 + 1.8),
            z: w.from.z + dz * t + pz * side * (w.width / 2 + 1.8),
          });
        }
      }
    }
    const hub = DISTRICTS[0];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      lamps.push({ x: Math.sin(a) * (hub.radius - 1.4), z: Math.cos(a) * (hub.radius - 1.4) });
    }
    for (const d of DISTRICTS) {
      if (d.id === "hub") continue;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.8;
        lamps.push({ x: d.center.x + Math.sin(a) * (d.radius - 1.2), z: d.center.z + Math.cos(a) * (d.radius - 1.2) });
      }
    }
    const kept = lamps.filter((p) => !inSpineCorridor(p.x, p.z));
    this._add("lamp_post", kept);
    this._lampPositions = kept;
    for (const p of kept) this._blob(p.x, p.z, 1.5, 0.18);
  }

  /** Benches, tables, parasols, stools, fire bowls — built straight off
   * SOCIAL_SPOTS so "somewhere for two people to end up next to each
   * other" is a layout decision, not set dressing added afterwards. */
  _placeSocialFurniture() {
    const benches = [], tables = [], parasols = [], stools = [], fires = [], rings = [];
    for (const s of SOCIAL_SPOTS) {
      if (s.kind === "seat" || s.kind === "vista") {
        benches.push({ x: s.x, z: s.z, rotY: s.rotY });
      } else if (s.kind === "table") {
        tables.push({ x: s.x, z: s.z, rotY: s.rotY });
        parasols.push({ x: s.x, z: s.z, rotY: s.rotY * 1.7 });
        for (let i = 0; i < 3; i++) {
          const a = s.rotY + i * 2.094 + 0.4;
          stools.push({ x: s.x + Math.sin(a) * 1.25, z: s.z + Math.cos(a) * 1.25, rotY: a });
        }
      } else if (s.kind === "circle") {
        fires.push({ x: s.x, z: s.z, rotY: s.rotY });
        rings.push(s);
        for (let i = 0; i < 4; i++) {
          const a = i * 1.5708 + 0.6;
          stools.push({ x: s.x + Math.sin(a) * 1.9, z: s.z + Math.cos(a) * 1.9, rotY: a + Math.PI });
        }
      }
    }
    this._add("bench", benches);
    this._add("table_round", tables);
    this._add("parasol", parasols);
    this._add("stool", stools);
    this._add("firebowl", fires);
    for (const p of [...benches, ...tables]) this._blob(p.x, p.z, 2.4, 0.22);

    // A warm paved disc under every gathering circle, so the spot reads as
    // "a place", not "a prop that happens to be here".
    for (const s of rings) {
      const pad = new THREE.Mesh(
        new THREE.CircleGeometry(2.9, 32),
        this.makeToon(0xd9c49a, { transparent: true, opacity: 0.85 }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(s.x, this.plateY(s.x, s.z) + 0.035, s.z);
      this.root.add(pad);
    }
  }

  _placeBridgeRails() {
    const rails = [];
    for (let z = BRIDGE.minZ + 1; z < BRIDGE.maxZ; z += 2) {
      rails.push({ x: BRIDGE.minX - 0.05, z, rotY: Math.PI / 2 });
      rails.push({ x: BRIDGE.maxX + 0.05, z, rotY: Math.PI / 2 });
    }
    this._add("fence_panel", rails, "bridge-rails");
  }

  /** Kerb stones + grass tufts framing every causeway, so the paths read
   * as laid rather than painted on. Placed here (not in _buildCauseways)
   * because they come from the Blender kit, which lands later. */
  _placeCausewayEdging() {
    if (this._kerbStones?.length) this._add("rock_b", this._kerbStones, "causeway-kerb");
    const tufts = [];
    for (const w of CAUSEWAYS) {
      const dx = w.to.x - w.from.x, dz = w.to.z - w.from.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len, pz = dx / len;
      for (let t = 0.1; t < 1; t += 2.6 / len) {
        for (const side of [-1, 1]) {
          if (this.rand() < 0.45) continue;
          const off = w.width / 2 + 1.0 + this.rand() * 0.8;
          tufts.push({
            x: w.from.x + dx * t + px * side * off,
            z: w.from.z + dz * t + pz * side * off,
            rotY: this.rand() * 6.28, scale: 0.7 + this.rand() * 0.5,
          });
        }
      }
    }
    this._add("flower_clump", tufts, "causeway-verge");
  }

  _placeShoreDetail() {
    const rocks = [], reeds = [];
    for (let i = 0; i < 30; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = ISLAND.radius + ISLAND.beach - 1.2 - this.rand() * 2.2;
      rocks.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, rotY: this.rand() * 6.28, scale: 0.8 + this.rand() });
      if (this.rand() < 0.4) reeds.push({ x: Math.sin(a + 0.1) * (r - 1.4), z: Math.cos(a + 0.1) * (r - 1.4) });
    }
    for (let i = 0; i < 12; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = HOME_ISLE.radius + HOME_ISLE.beach - 1.4;
      rocks.push({
        x: HOME_ISLE.center.x + Math.sin(a) * r, z: HOME_ISLE.center.z + Math.cos(a) * r,
        rotY: this.rand() * 6.28, scale: 0.7 + this.rand() * 0.7,
      });
    }
    this._add("rock_a", rocks, "shore-rocks");
    this._add("reeds", reeds, "shore-reeds");
  }

  /** Idle life: the foam ring breathes with the tide. Called per frame. */
  update(elapsed) {
    if (this._foam) {
      const s = 1 + Math.sin(elapsed * 0.5) * 0.004;
      for (const f of this._foam) {
        f.scale.set(s, s, 1);
        f.material.opacity = 0.45 + Math.sin(elapsed * 0.5) * 0.12;
      }
    }
    if (this._parkMotion) {
      const { bloom, chimes, motes } = this._parkMotion;
      bloom.rotation.y = Math.sin(elapsed * 0.34) * 0.035;
      chimes.forEach((chime, index) => {
        chime.rotation.z = Math.sin(elapsed * 1.05 + index * 1.9) * 0.045;
      });
      motes.rotation.y = elapsed * 0.09;
      motes.material.opacity = 0.46 + Math.sin(elapsed * 0.72) * 0.12;
    }
  }

  stats() {
    return {
      instancedMeshes: this.props.length,
      instances: this.props.reduce((n, m) => n + m.count, 0),
      triangles: this.props.reduce((n, m) => n + (m.geometry.index
        ? m.geometry.index.count / 3
        : m.geometry.attributes.position.count / 3) * m.count, 0),
    };
  }
}
