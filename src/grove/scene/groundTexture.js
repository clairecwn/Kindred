// src/grove/scene/groundTexture.js
//
// A procedurally-generated (canvas, not a file on disk) blotchy speckle
// texture used to give the ground plane and every district floor visible
// surface structure — the flat single-colour district floors were the
// actual reason the plaza read as "one large flat beige field" even though
// the base grass terrain had per-vertex colour and height variation: the
// floors sit on top of it and are what the camera mostly frames. Applied
// as a `map` on top of each surface's existing colour/vertexColors, it
// multiplies in worn/patchy variation (Hay Day / Mario Party style) for
// almost no runtime cost — one small canvas generated once and reused
// (cloned per surface only to set an independent repeat/tiling amount).

import * as THREE from "three";

let sharedCanvas = null;

function buildCanvas() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // Layer 1: large soft blotches (worn patches / paving variation).
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 18 + Math.random() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const shade = Math.random() > 0.5 ? "0,0,0" : "255,255,255";
    const alpha = 0.05 + Math.random() * 0.07;
    g.addColorStop(0, `rgba(${shade},${alpha})`);
    g.addColorStop(1, `rgba(${shade},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Layer 2: fine speckle for close-up texture (small stones / grass
  // clumps) so the surface doesn't look smooth even near the camera.
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.6 + Math.random() * 1.4;
    const shade = Math.random() > 0.5 ? "0,0,0" : "255,255,255";
    ctx.fillStyle = `rgba(${shade},${0.05 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/** Returns a new Texture instance (independent repeat/offset) wrapping the
 * one shared procedural canvas, tiled `repeat` times across the surface it
 * is applied to. Call once per material at construction time. */
export function createGroundStippleTexture(repeat = 8) {
  if (!sharedCanvas) sharedCanvas = buildCanvas();
  const tex = new THREE.CanvasTexture(sharedCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.needsUpdate = true;
  return tex;
}

/** A square canvas texture, transparent at the centre and dark at the
 * edges — used to fake a contact-AO taper on rectangular district floors
 * (a ring geometry gives this for free on circular ones, but a flat plane
 * can't taper toward its own centre without a texture). Not tiled: stretch
 * it once across the whole footprint. */
export function createEdgeFadeTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  const inset = size * 0.18;
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fillRect(0, 0, size, size);
  // Build the fade on all four sides via four edge gradients composited
  // with "destination-out" so only a soft frame near the border remains.
  ctx.globalCompositeOperation = "destination-out";
  const fade = (x0, y0, x1, y1) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  };
  fade(inset, 0, size * 0.55, 0);
  ctx.globalCompositeOperation = "destination-out";
  fade(size - inset, 0, size * 0.45, 0);
  fade(0, inset, 0, size * 0.55);
  fade(0, size - inset, 0, size * 0.45);
  ctx.globalCompositeOperation = "source-over";
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
