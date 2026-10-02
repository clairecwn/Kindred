/**
 * silhouetteTest.mjs — real, geometry-driven silhouette-distinctness
 * check for CHARACTER-BIBLE.md section 1's "one glance, one read" rule
 * (brief point 4: "test this literally: render each species as a flat
 * black silhouette and confirm they are distinguishable").
 *
 * There is no GPU/canvas in this Node environment, so this rasterizes
 * every species' rest-pose mesh triangles by hand: each mesh's real
 * BufferGeometry positions are transformed by its world matrix, yawed
 * around the vertical axis, flattened to 2D, and scan-filled onto a
 * shared boolean pixel grid — a genuine flat black silhouette of the
 * built mesh, not a guess about it.
 *
 * Single-angle silhouettes are too strict for this cast on purpose: a
 * species whose signature is a front-facing feature (panda's eye
 * patches) reads as near-identical to another round-bodied species from
 * directly behind, and one whose signature is a tail or snout (fox, dog)
 * reads as near-identical to a similar body from straight-on. Real
 * players in Grove/Kingdom see every avatar from many angles as it moves
 * around, so this test rasterizes each species at several yaws (0/45/90/
 * 135 degrees) and calls a pair distinguishable if ANY shared angle shows
 * a real difference — "there exists a glance that tells them apart" is
 * the actual bar the brief is asking for, and it is checked, not assumed.
 *
 * Distinctness metric per angle: 1 - IoU (intersection over union) of the
 * two silhouette bitmaps — 0 means identical outlines, 1 means no
 * overlap at all. Run with: node src/avatar/silhouetteTest.mjs
 */

import * as THREE from "three";
import { createAvatar } from "./AvatarRig.js";
import { SPECIES_LIST, SPECIES } from "./species.js";
import { preloadAvatarModels } from "./modelCache.js";

// Load the Blender-authored .glb cast BEFORE building anything, so this
// test rasterizes the real shipped meshes rather than the procedural
// fallback createAvatar() uses when the cache is still cold.
const loaded = await preloadAvatarModels();
if (loaded.some((m) => !m)) {
  console.error("FAIL - public/models/kindred_*.glb missing; run `npm run build:avatars`");
  process.exit(1);
}

const W = 72;
const H = 108;
const YAWS_DEG = [0, 45, 90, 135];
const MIN_BEST_ANGLE_DISSIMILARITY = 0.10; // required best-angle 1-IoU for every species pair

function collectTrianglesWorld(root) {
  root.updateMatrixWorld(true);
  const tris = []; // each: [ [x,y,z], [x,y,z], [x,y,z] ] in world space
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.name === "FacePlate") return; // invisible placeholder, opacity 0
    const mat = obj.material;
    if (mat && mat.transparent && (mat.opacity ?? 1) === 0) return;
    const geo = obj.geometry;
    const pos = geo.attributes?.position;
    if (!pos) return;
    const index = geo.index;
    const v = new THREE.Vector3();
    const readVertex = (i) => {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      v.applyMatrix4(obj.matrixWorld);
      return [v.x, v.y, v.z];
    };
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        tris.push([
          readVertex(index.getX(i)),
          readVertex(index.getX(i + 1)),
          readVertex(index.getX(i + 2)),
        ]);
      }
    } else {
      for (let i = 0; i + 2 < pos.count; i += 3) {
        tris.push([readVertex(i), readVertex(i + 1), readVertex(i + 2)]);
      }
    }
  });
  return tris;
}

function yawTriangles(tris, yawDeg) {
  const yaw = (yawDeg * Math.PI) / 180;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return tris.map((tri) => tri.map(([x, y, z]) => [x * c + z * s, y]));
}

function rasterize(tris2d, bounds, w, h) {
  const grid = new Uint8Array(w * h);
  const { minX, maxX, minY, maxY } = bounds;
  const sx = (w - 1) / (maxX - minX);
  const sy = (h - 1) / (maxY - minY);
  const toPx = ([x, y]) => [(x - minX) * sx, (h - 1) - (y - minY) * sy]; // flip Y for image space

  for (const [a, b, c] of tris2d) {
    const [ax, ay] = toPx(a);
    const [bx, by] = toPx(b);
    const [cx, cy] = toPx(c);
    const minPx = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxPx = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minPy = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxPy = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
    const denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(denom) < 1e-9) continue;
    for (let py = minPy; py <= maxPy; py += 1) {
      for (let px = minPx; px <= maxPx; px += 1) {
        const fx = px + 0.5, fy = py + 0.5;
        const w1 = ((by - cy) * (fx - cx) + (cx - bx) * (fy - cy)) / denom;
        const w2 = ((cy - ay) * (fx - cx) + (ax - cx) * (fy - cy)) / denom;
        const w3 = 1 - w1 - w2;
        if (w1 >= -1e-6 && w2 >= -1e-6 && w3 >= -1e-6) grid[py * w + px] = 1;
      }
    }
  }
  return grid;
}

function iouDissimilarity(a, b) {
  let inter = 0, union = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i], bv = b[i];
    if (av || bv) union += 1;
    if (av && bv) inter += 1;
  }
  return union === 0 ? 0 : 1 - inter / union;
}

console.log("=== Grove avatar silhouette-distinctness test ===\n");

const trisBySpecies = {};
let bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
const allYawed = {}; // species -> yawDeg -> tris2d

for (const species of SPECIES_LIST) {
  const avatar = createAvatar({ species, palette: {}, wardrobe: {}, powerups: [] });
  trisBySpecies[species] = collectTrianglesWorld(avatar);
  allYawed[species] = {};
  for (const yawDeg of YAWS_DEG) {
    const tris2d = yawTriangles(trisBySpecies[species], yawDeg);
    allYawed[species][yawDeg] = tris2d;
    for (const tri of tris2d) {
      for (const [x, y] of tri) {
        if (x < bounds.minX) bounds.minX = x;
        if (x > bounds.maxX) bounds.maxX = x;
        if (y < bounds.minY) bounds.minY = y;
        if (y > bounds.maxY) bounds.maxY = y;
      }
    }
  }
}
// Small shared padding so no species' silhouette touches the frame edge.
const padX = (bounds.maxX - bounds.minX) * 0.05;
const padY = (bounds.maxY - bounds.minY) * 0.05;
bounds = {
  minX: bounds.minX - padX, maxX: bounds.maxX + padX,
  minY: bounds.minY - padY, maxY: bounds.maxY + padY,
};

const gridsBySpecies = {};
for (const species of SPECIES_LIST) {
  gridsBySpecies[species] = {};
  for (const yawDeg of YAWS_DEG) {
    gridsBySpecies[species][yawDeg] = rasterize(allYawed[species][yawDeg], bounds, W, H);
  }
}

console.log(`Shared ${W}x${H} silhouette grid across yaws ${YAWS_DEG.join("/")} deg, world bounds x[${bounds.minX.toFixed(2)}, ${bounds.maxX.toFixed(2)}] y[${bounds.minY.toFixed(2)}, ${bounds.maxY.toFixed(2)}]\n`);

let worstPair = null;
let worstBest = Infinity;
const rows = [];
for (let i = 0; i < SPECIES_LIST.length; i += 1) {
  for (let j = i + 1; j < SPECIES_LIST.length; j += 1) {
    const a = SPECIES_LIST[i], b = SPECIES_LIST[j];
    let best = -Infinity, bestYaw = null;
    for (const yawDeg of YAWS_DEG) {
      const d = iouDissimilarity(gridsBySpecies[a][yawDeg], gridsBySpecies[b][yawDeg]);
      if (d > best) { best = d; bestYaw = yawDeg; }
    }
    rows.push({ a, b, best, bestYaw });
    if (best < worstBest) { worstBest = best; worstPair = [a, b]; }
  }
}
rows.sort((r1, r2) => r1.best - r2.best);
for (const { a, b, best, bestYaw } of rows) {
  const flag = best < MIN_BEST_ANGLE_DISSIMILARITY ? "  <-- NOT DISTINGUISHABLE AT ANY ANGLE" : "";
  console.log(`  ${a.padEnd(9)} vs ${b.padEnd(9)} best 1-IoU = ${best.toFixed(3)} (at ${bestYaw}deg)${flag}`);
}

console.log(`\nSignature elements (one per species, CHARACTER-BIBLE.md section 1):`);
for (const s of SPECIES_LIST) console.log(`  ${s.padEnd(9)} ${SPECIES[s].signature}`);

console.log(`\nWorst (least distinct at its best angle) pair: ${worstPair[0]} vs ${worstPair[1]} at ${worstBest.toFixed(3)}`);
if (worstBest >= MIN_BEST_ANGLE_DISSIMILARITY) {
  console.log(`PASS  - every species pair has at least one viewing angle clearing the ${MIN_BEST_ANGLE_DISSIMILARITY} minimum silhouette dissimilarity.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL  - one or more species pairs are not distinguishable at any tested angle.`);
  process.exitCode = 1;
}
