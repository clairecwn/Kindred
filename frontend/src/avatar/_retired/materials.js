/**
 * materials.js — shared toon material helpers for the Grove 3D avatar
 * system (CHARACTER-BIBLE.md section 1): a cheap Half-Lambert-driven CEL
 * shader (the Team Fortress 2 method) quantised into 3 hard, flat bands
 * (shadow / base / highlight — no continuous ramp between them), plus a
 * fake grazing-angle rim, and the mat_skin/mat_skin_shadow/mat_trim/
 * mat_main naming convention that AvatarRig's tint pass and the wardrobe
 * system both key off of.
 *
 * Half-Lambert (pow(dot(N,L)*0.5+0.5, 2)) is only the INPUT value — on
 * its own it is still a smooth gradient, and shipping it unquantised
 * produced a visible continuous colour ramp across every rounded part (a
 * "smooth orange-to-purple gradient" on the head) instead of a cel look.
 * The fix is a hard step on that value into 3 discrete bands, each a
 * flat, non-blended colour. The shadow band uses a SUBTLE cool
 * blue-violet tint (mixed at 16%, not swapped) so it reads as "this
 * colour, in shadow" rather than "a different, purple material" — an
 * earlier, stronger tint was the direct cause of that regression.
 */

import * as THREE from "three";

export const OUTLINE_COLOR = 0x241606;
// Outline thickness is expressed as a fraction of a part's own bounding
// radius (see outlineThicknessFor below) so small parts — eyes, pupils,
// pins — never get the same fat outline as the torso or head.
export const OUTLINE_THICKNESS_RATIO = 0.10;
export const OUTLINE_THICKNESS_MIN = 0.0022;
export const OUTLINE_THICKNESS_MAX = 0.018;
// Back-compat constant some callers may still reference.
export const OUTLINE_THICKNESS = 0.006;

export const MATERIAL_SLOTS = Object.freeze({
  SKIN: "mat_skin",
  SKIN_SHADOW: "mat_skin_shadow",
  TRIM: "mat_trim",
  MAIN: "mat_main",
  FIXED: "mat_fixed",
});

// Fixed "cozy afternoon" key light direction (world space), matching the
// warm rim already named in CHARACTER-BIBLE.md section 1. Baked into the
// shader rather than read from the live scene graph so every avatar
// reads consistently regardless of which scene (Grove or Kingdom) drops
// it in, or how that scene's own lights are set up.
const KEY_LIGHT_DIR = new THREE.Vector3(0.45, 0.82, 0.55).normalize();
const SHADOW_TINT = new THREE.Color(0x7a80a8); // subtle cool blue-violet, never black/grey or a hue swap
const RIM_COLOR = new THREE.Color(0xffcdb8); // warm rim, matches the bible's rim light
const INK_COLOR = new THREE.Color(OUTLINE_COLOR); // silhouette ink edge, warm near-black

const TOON_VERTEX = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vViewDirW;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDirW = normalize(cameraPosition - worldPosition.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const TOON_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLightDir;
uniform vec3 uShadowTint;
uniform vec3 uRimColor;
uniform vec3 uInkColor;
uniform float uOpacity;
varying vec3 vNormalW;
varying vec3 vViewDirW;

void main() {
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(uLightDir);

  // Half-Lambert (TF2 method) is only the INPUT: it wraps the light
  // around the form so the dark side of a round head never goes flat
  // black, but it is still a smooth continuous value. Quantise it to 3
  // hard bands (shadow / base / highlight) with a hard step, not
  // smoothstep — a continuous ramp is what produced the "smooth
  // orange-to-purple gradient" regression. No blending between bands.
  float halfLambert = pow(dot(N, L) * 0.5 + 0.5, 2.0);
  // Three flat bands, but with a HAIRLINE smoothstep at each boundary
  // (0.03 wide, ~1px on screen). A pure hard step reads as blotches on a
  // smooth organic mesh: wherever the surface normal wobbles slightly
  // around a band threshold, the boundary weaves back and forth and the
  // character grows dark patches on the torso and limbs. The bands are
  // still flat everywhere except that hairline, so this stays a cel look
  // rather than a gradient.
  float edgeLo = smoothstep(0.40 - 0.03, 0.40 + 0.03, halfLambert);
  float edgeHi = smoothstep(0.86 - 0.03, 0.86 + 0.03, halfLambert);

  // Shadow: a SUBTLE cool blue-violet tint, not a hue swap — this stays
  // recognisably the base colour, just cooler and a little darker, so it
  // reads as "in shadow" rather than "a different coloured material".
  vec3 shadowColor = mix(uColor, uShadowTint, 0.14) * 0.80;
  vec3 baseColor = uColor;
  // Highlight: a small warm lift toward white, not toward the rim hue,
  // so it can't accidentally wash out a near-black flat-shaded part.
  vec3 highColor = mix(uColor, vec3(1.0), 0.13);

  vec3 color = mix(shadowColor, baseColor, edgeLo);
  color = mix(color, highColor, edgeHi);

  float facing = max(dot(N, normalize(vViewDirW)), 0.0);

  // Warm rim at grazing angles — narrow, so it reads as light catching
  // the form rather than a second colour band.
  float rimFactor = pow(1.0 - facing, 4.0);
  color += uRimColor * rimFactor * 0.24;

  // Dark contact edge right at the silhouette. This is the project's
  // stand-in for an inked outline: an inverted-hull outline on a SKINNED
  // mesh renders as a detached duplicate unless its bind state is copied
  // exactly, and it costs a second draw call per part. Darkening the
  // last few degrees of grazing angle in the same pass gives the same
  // "chunky toy with an ink edge" read for free, and can never drift
  // away from the geometry it belongs to.
  float edge = smoothstep(0.34, 0.06, facing);
  color = mix(color, uInkColor, edge * 0.80);

  gl_FragColor = vec4(color, uOpacity);
  // A ShaderMaterial does NOT get the renderer's automatic linear->sRGB
  // output conversion, so without this include every toon colour is
  // written to an sRGB framebuffer as if it were already encoded: warm
  // ochre reads as dark red, mid brown reads as near-black. Including
  // the chunk puts the custom shader back on the same colour pipeline as
  // every built-in material in the scene.
  #include <colorspace_fragment>
}
`;

/**
 * Build a flat-shaded Half-Lambert toon material with a given
 * material-slot name (see MATERIAL_SLOTS). `material.color` is aliased
 * directly to the shader's uColor uniform (a live THREE.Color), so
 * existing retint call sites (`mat.color.setHex(...)`,
 * `mat.color.copy(...)`) keep working unchanged.
 */
export function toonMat(color, name) {
  const uColor = new THREE.Color(color);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: uColor },
      uLightDir: { value: KEY_LIGHT_DIR },
      uShadowTint: { value: SHADOW_TINT },
      uRimColor: { value: RIM_COLOR },
      uInkColor: { value: INK_COLOR },
      uOpacity: { value: 1 },
    },
    vertexShader: TOON_VERTEX,
    fragmentShader: TOON_FRAGMENT,
  });
  mat.color = uColor; // alias so callers can keep treating this like a standard material
  mat.name = name ?? "";
  return mat;
}

/** Darken a hex color by a factor, used for the fixed mat_skin_shadow companion. */
export function darken(hex, factor = 0.65) {
  return new THREE.Color(hex).multiplyScalar(factor).getHex();
}

/**
 * Derive an outline thickness for a mesh from its own geometry so small
 * parts (eyes, pins, glasses rims) get a thin line and big parts (torso,
 * head) get a visibly thicker one — CHARACTER-BIBLE.md section 1's
 * "thickness scales with the part".
 */
export function outlineThicknessFor(mesh) {
  mesh.geometry.computeBoundingSphere?.();
  const radius = mesh.geometry.boundingSphere?.radius ?? 0.1;
  const scale = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z) || 1;
  const t = radius * scale * OUTLINE_THICKNESS_RATIO;
  return Math.min(OUTLINE_THICKNESS_MAX, Math.max(OUTLINE_THICKNESS_MIN, t));
}

/**
 * Build an inverted-hull outline mesh sharing a body mesh's geometry
 * (section 1/7 — one extra draw call, no geometry duplication cost).
 * Works for both static Meshes and rigid-parented meshes; since this
 * avatar system rigid-attaches parts to bones rather than true GPU
 * skinning, the outline simply mirrors the same parent so it tracks pose.
 *
 * Thickness is fixed per-part (outlineThicknessFor), not distance-
 * compensated in view space — CHARACTER-BIBLE.md section 8 prefers
 * silhouette-through-shading (the Half-Lambert material above) over
 * outlines for exactly this reason: a fixed-width inverted-hull outline
 * is the fragile, lower-priority option, kept thin and per-part-scaled
 * so it reads as an ink accent rather than the thing carrying the form.
 */
export function buildOutlineMesh(mesh, thickness) {
  const outlineThickness = thickness ?? outlineThicknessFor(mesh);
  const mat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.outlineThickness = { value: outlineThickness };
    // The uniform has to be declared in the shader source as well as added to
    // shader.uniforms, otherwise the vertex shader fails to compile with
    // "undeclared identifier" and every outlined mesh renders black.
    shader.vertexShader =
      `uniform float outlineThickness;\n` +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n  transformed += normal * outlineThickness;`
      );
  };
  const outline = new THREE.Mesh(mesh.geometry, mat);
  outline.name = `${mesh.name || "mesh"}_outline`;
  outline.renderOrder = -1;
  outline.scale.copy(mesh.scale);
  outline.position.copy(mesh.position);
  outline.rotation.copy(mesh.rotation);
  return outline;
}

/** Attach an outline sibling for a mesh under the same parent, once. */
export function addOutline(mesh, thickness) {
  const outline = buildOutlineMesh(mesh, thickness);
  mesh.parent?.add(outline);
  mesh.userData.outline = outline;
  return outline;
}
