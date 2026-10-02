/**
 * gameCameraTest.mjs — real visual check from the actual game camera
 * framing (brief point 4: "Verify visually, not just numerically...
 * assert the eye pixels are present and high contrast against the head,
 * and that the torso and legs occupy a meaningful share of the
 * silhouette below the head").
 *
 * selfTest.mjs and silhouetteTest.mjs both passed while the character
 * rendered as an oversized single sphere with unreadable eyes, because
 * neither one looks at rendered pixels or colour. This test does: it
 * rasterizes every species' real built geometry through a genuine
 * perspective camera (distance ~6.5 world units, 32deg vertical FOV —
 * the real Grove/Kingdom framing), colours each pixel from the winning
 * triangle's own flat material colour with a per-pixel depth test (so
 * a pupil in front of a sclera in front of a head actually occludes
 * correctly), then checks the resulting image directly:
 *   1. Somewhere in the head region there are near-white AND near-black
 *      pixels (sclera + pupil) with real luminance contrast against the
 *      surrounding skin tone.
 *   2. Pixels below the head band (torso/arms/legs) make up a real share
 *      of the total silhouette — the head is not "essentially the whole
 *      character".
 *
 * Run with: node src/avatar/gameCameraTest.mjs
 */

import * as THREE from "three";
import { createAvatar } from "./AvatarRig.js";
import { SPECIES_LIST } from "./species.js";
import { preloadAvatarModels } from "./modelCache.js";

// Load the Blender-authored .glb cast BEFORE building anything, so this
// test rasterizes the real shipped meshes rather than the procedural
// fallback createAvatar() uses when the cache is still cold.
const loaded = await preloadAvatarModels();
if (loaded.some((m) => !m)) {
  console.error("FAIL - public/models/kindred_*.glb missing; run `npm run build:avatars`");
  process.exit(1);
}

const W = 90;
const H = 160;
const CAMERA_DISTANCE = 6.5;
const FOV_DEG = 32;
const MIN_EYE_PIXELS = 6; // per eye colour, in the head band
const MIN_EYE_CONTRAST = 60; // 0-255 luminance gap: sclera vs local skin, pupil vs sclera
const MIN_BODY_SHARE = 0.30; // fraction of total silhouette pixels below the head band

function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function collectTris(root) {
  root.updateMatrixWorld(true);
  const tris = [];
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.name?.endsWith("_outline")) return; // thin ink line, not the shape itself
    if (obj.name === "FacePlate") return;
    const mat = obj.material;
    if (mat && mat.transparent && (mat.opacity ?? 1) === 0) return;
    const color = mat?.color ? [mat.color.r * 255, mat.color.g * 255, mat.color.b * 255] : [128, 128, 128];
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
    // Eye parts are identified by MATERIAL name first (mat_eye_white /
    // mat_eye_pupil, which both the Blender exporter and the procedural
    // fallback set) and by object name second, so this test keeps
    // working across the two pipelines.
    const matName = mat?.name ?? "";
    const isEyeWhite = matName === "mat_eye_white" || obj.name === "Eyes" || obj.name?.startsWith("EyeWhite");
    const isEyePupil = matName === "mat_eye_pupil" || obj.name === "Pupils" || obj.name?.startsWith("EyePupil");
    const push = (a, b, c) => tris.push({ a, b, c, color, isEyeWhite, isEyePupil });
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        push(readVertex(index.getX(i)), readVertex(index.getX(i + 1)), readVertex(index.getX(i + 2)));
      }
    } else {
      for (let i = 0; i + 2 < pos.count; i += 3) {
        push(readVertex(i), readVertex(i + 1), readVertex(i + 2));
      }
    }
  });
  return tris;
}

/** Simple pinhole perspective camera looking down -Z at a fixed distance. */
function makeProjector(camDistance, fovDeg, aspect) {
  const halfFovV = (fovDeg / 2) * (Math.PI / 180);
  const tanHalfV = Math.tan(halfFovV);
  const tanHalfH = tanHalfV * aspect;
  return {
    project([x, y, z], camHeight) {
      const relX = x;
      const relY = y - camHeight;
      const depth = camDistance - z; // positive = in front of the camera
      if (depth <= 0.01) return null;
      const sx = relX / depth / tanHalfH; // -1..1
      const sy = relY / depth / tanHalfV; // -1..1
      return [sx, sy, depth];
    },
  };
}

function rasterizeScene(tris, camHeight) {
  const aspect = W / H;
  const projector = makeProjector(CAMERA_DISTANCE, FOV_DEG, aspect);
  const depthBuf = new Float32Array(W * H).fill(Infinity);
  const colorBuf = new Array(W * H).fill(null); // [r,g,b] or null
  const tagBuf = new Array(W * H).fill(null); // "white" | "pupil" | null

  const toPx = ([sx, sy]) => [((sx + 1) / 2) * (W - 1), ((1 - sy) / 2) * (H - 1)];

  for (const tri of tris) {
    const pa = projector.project(tri.a, camHeight);
    const pb = projector.project(tri.b, camHeight);
    const pc = projector.project(tri.c, camHeight);
    if (!pa || !pb || !pc) continue;
    const [ax, ay] = toPx(pa), [bx, by] = toPx(pb), [cx, cy] = toPx(pc);
    const da = pa[2], db = pb[2], dc = pc[2];
    const minPx = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxPx = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minPy = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxPy = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    const denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(denom) < 1e-9) continue;
    for (let py = minPy; py <= maxPy; py += 1) {
      for (let px = minPx; px <= maxPx; px += 1) {
        const fx = px + 0.5, fy = py + 0.5;
        const w1 = ((by - cy) * (fx - cx) + (cx - bx) * (fy - cy)) / denom;
        const w2 = ((cy - ay) * (fx - cx) + (ax - cx) * (fy - cy)) / denom;
        const w3 = 1 - w1 - w2;
        if (w1 < -1e-6 || w2 < -1e-6 || w3 < -1e-6) continue;
        const depth = w1 * da + w2 * db + w3 * dc;
        const idx = py * W + px;
        if (depth < depthBuf[idx]) {
          depthBuf[idx] = depth;
          colorBuf[idx] = tri.color;
          tagBuf[idx] = tri.isEyeWhite ? "white" : tri.isEyePupil ? "pupil" : null;
        }
      }
    }
  }
  return { colorBuf, tagBuf };
}

console.log("=== Grove avatar game-camera visual test ===\n");
console.log(`Camera: distance ${CAMERA_DISTANCE}, vertical FOV ${FOV_DEG}deg, frame ${W}x${H}\n`);

let allPass = true;

for (const species of SPECIES_LIST) {
  const avatar = createAvatar({ species, palette: {}, wardrobe: {}, powerups: [] });
  const headRadius = avatar.userData.rig.headRadius;
  const headWorldY = avatar.userData.getBone("Head").getWorldPosition(new THREE.Vector3()).y;
  const tris = collectTris(avatar);

  // Whole-figure bounding box, to find the head band and total height.
  let minY = Infinity, maxY = -Infinity;
  for (const t of tris) for (const p of [t.a, t.b, t.c]) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  const totalHeight = maxY - minY;
  const headBandBottom = headWorldY - headRadius * 1.1; // just below the head sphere

  // Frame the camera on the figure's vertical center, as Grove/Kingdom's
  // over-the-shoulder camera roughly does.
  const camHeight = (minY + maxY) / 2;
  const { colorBuf, tagBuf } = rasterizeScene(tris, camHeight);

  // ── Check 1: eyes read as high-contrast white+dark against skin. ──
  // Contrast is measured LOCALLY, against the pixels immediately
  // surrounding the eyes, not against the whole-figure average. A
  // whole-figure average says a white sclera "reads" on a dark bear and
  // fails on a pale rabbit regardless of what is actually drawn next to
  // the eye; what matters is the light/dark/light read in the eye's own
  // neighbourhood. Pupil contrast is measured against the sclera it sits
  // in, for the same reason.
  let whitePixels = 0, pupilPixels = 0;
  let whiteSum = [0, 0, 0];
  let pupilSum = [0, 0, 0];
  let minEx = W, maxEx = 0, minEy = H, maxEy = 0;
  for (let py = 0; py < H; py += 1) {
    for (let px = 0; px < W; px += 1) {
      const i = py * W + px;
      const c = colorBuf[i];
      if (!c) continue;
      const tag = tagBuf[i];
      if (tag !== "white" && tag !== "pupil") continue;
      if (px < minEx) minEx = px; if (px > maxEx) maxEx = px;
      if (py < minEy) minEy = py; if (py > maxEy) maxEy = py;
      if (tag === "white") { whitePixels += 1; whiteSum[0] += c[0]; whiteSum[1] += c[1]; whiteSum[2] += c[2]; }
      else { pupilPixels += 1; pupilSum[0] += c[0]; pupilSum[1] += c[1]; pupilSum[2] += c[2]; }
    }
  }
  const PAD = 4;
  let skinSum = [0, 0, 0], skinCount = 0;
  for (let py = Math.max(0, minEy - PAD); py <= Math.min(H - 1, maxEy + PAD); py += 1) {
    for (let px = Math.max(0, minEx - PAD); px <= Math.min(W - 1, maxEx + PAD); px += 1) {
      const i = py * W + px;
      const c = colorBuf[i];
      if (!c || tagBuf[i]) continue;
      skinSum[0] += c[0]; skinSum[1] += c[1]; skinSum[2] += c[2]; skinCount += 1;
    }
  }
  const avg = (sum, n) => (n ? [sum[0] / n, sum[1] / n, sum[2] / n] : [0, 0, 0]);
  const skinAvg = avg(skinSum, skinCount);
  const whiteAvg = avg(whiteSum, whitePixels);
  const pupilAvg = avg(pupilSum, pupilPixels);
  const whiteContrast = Math.abs(luminance(whiteAvg) - luminance(skinAvg));
  const pupilContrast = Math.abs(luminance(whiteAvg) - luminance(pupilAvg));

  // ── Check 2: torso/limbs occupy a real share of the silhouette. ──
  let totalSilhouette = 0, belowHead = 0;
  const toPy = (worldY) => {
    // Re-derive pixel row for a world Y at screen center (x=0, z=camera plane center).
    const depth = CAMERA_DISTANCE; // approx, fine for a horizontal head-band cutoff
    const sy = (worldY - camHeight) / depth / Math.tan((FOV_DEG / 2) * (Math.PI / 180));
    return ((1 - sy) / 2) * (H - 1);
  };
  const headBandPy = toPy(headBandBottom);
  for (let py = 0; py < H; py += 1) {
    for (let px = 0; px < W; px += 1) {
      if (!colorBuf[py * W + px]) continue;
      totalSilhouette += 1;
      if (py > headBandPy) belowHead += 1;
    }
  }
  const bodyShare = totalSilhouette ? belowHead / totalSilhouette : 0;

  const eyesOk = whitePixels >= MIN_EYE_PIXELS && pupilPixels >= MIN_EYE_PIXELS
    && whiteContrast >= MIN_EYE_CONTRAST && pupilContrast >= MIN_EYE_CONTRAST;
  const bodyOk = bodyShare >= MIN_BODY_SHARE;
  const pass = eyesOk && bodyOk;
  if (!pass) allPass = false;

  console.log(`${species.padEnd(9)} eyes: white=${whitePixels}px(contrast ${whiteContrast.toFixed(0)}) pupil=${pupilPixels}px(vs sclera ${pupilContrast.toFixed(0)}) ${eyesOk ? "OK" : "FAIL"}   body-share=${(bodyShare * 100).toFixed(1)}% ${bodyOk ? "OK" : "FAIL"}   head=${((2 * headRadius / totalHeight) * 100).toFixed(1)}% of height`);
}

console.log();
if (allPass) {
  console.log("PASS - every species reads eyes with real contrast and shows a real body silhouette below the head at game-camera framing.");
  process.exitCode = 0;
} else {
  console.log("FAIL - one or more species failed the eye-contrast or body-share check above.");
  process.exitCode = 1;
}
