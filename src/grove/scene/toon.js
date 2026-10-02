// src/grove/scene/toon.js
//
// Illustrative ("TF2-style") toon shading for the Grove plaza.
//
// Two techniques from Valve's "Illustrative Rendering in Team Fortress 2"
// are applied on top of three.js's stock MeshToonMaterial:
//
//  1. Half-Lambert wrap lighting: pow(dot(N,L) * 0.5 + 0.5, 2) instead of a
//     hard saturate(dot(N,L)). This keeps the dark side of a round shape
//     legible (it never crushes to pure black) while still giving a crisp
//     toon band edge.
//  2. A gradient-map ramp sampled in *full colour*, not luminance, so the
//     shadow band can be deliberately tinted cool (blue-violet) while the
//     lit band stays warm/neutral - the single biggest lever for reading as
//     a stylised game world instead of a flat-lit asset dump.
//
// Stock MeshToonMaterial only reads the gradient map's RED channel and
// remaps dot(N,L) linearly (see three's gradientmap_pars_fragment chunk),
// so both of these need a small onBeforeCompile patch. The patch changes
// nothing about material.color, vertex colours, or instance colours -
// those still flow through the normal diffuseColor path - it only changes
// how the existing lighting bands are computed and adds a cheap
// view-dependent rim term at grazing angles.

import * as THREE from "three";

// ── Gradient ramp ─────────────────────────────────────────────────────
// A 5-pixel wide 1D texture, NearestFilter, no mipmaps: shadow / shadow-mid
// / mid / highlight-mid / highlight. The shadow end is tinted blue-violet
// (never grey/black), the highlight end warm white.
export function createToonGradientMap() {
  const stops = [
    [0.24, 0.22, 0.40], // deep shadow - cool blue-violet, genuinely dark
    [0.42, 0.40, 0.56], // shadow-mid - still cool, lifted off pure black
    [0.68, 0.66, 0.62], // mid - neutral, barely warm
    [0.88, 0.85, 0.74], // highlight-mid - warm lift
    [1.0, 0.95, 0.80],  // highlight - warm hot spot, CAPPED at 1.0 so lit
                         // surfaces never overshoot into bloom range
  ];
  const width = stops.length;
  const data = new Uint8Array(width * 4);
  for (let i = 0; i < width; i++) {
    data[i * 4 + 0] = Math.min(255, Math.round(stops[i][0] * 255));
    data[i * 4 + 1] = Math.min(255, Math.round(stops[i][1] * 255));
    data[i * 4 + 2] = Math.min(255, Math.round(stops[i][2] * 255));
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Shared rim-light tuning, cheap fresnel-style term added in the shader
// patch below. Not a real light (stays within the "max three lights"
// budget) - it is folded straight into reflectedLight.directDiffuse.
const RIM_COLOR = new THREE.Color(0xfff2c8); // warm, matches the key light
const RIM_POWER = 2.6;
const RIM_INTENSITY = 0.2; // was 0.35 - was adding brightness at every
// grazing edge, compounding the overall wash-out

/** Patches a MeshToonMaterial's fragment shader to use Half-Lambert wrap
 * lighting against a full-colour gradient ramp, plus a cheap rim term. Call
 * once per material right after construction. */
function applyIllustrativeShading(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.kRimColor = { value: RIM_COLOR };
    shader.uniforms.kRimPower = { value: RIM_POWER };
    shader.uniforms.kRimIntensity = { value: RIM_INTENSITY };

    shader.fragmentShader = shader.fragmentShader
      // Half-Lambert wrap + full-colour ramp sample (was: linear dotNL,
      // texture .r channel only).
      .replace(
        "vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {\n\n\t// dotNL will be from -1.0 to 1.0\n\tfloat dotNL = dot( normal, lightDirection );\n\tvec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );\n\n\t#ifdef USE_GRADIENTMAP\n\n\t\treturn vec3( texture2D( gradientMap, coord ).r );\n\n\t#else",
        "vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {\n\n\tfloat dotNL = dot( normal, lightDirection );\n\tfloat halfLambert = dotNL * 0.5 + 0.5;\n\thalfLambert = halfLambert * halfLambert;\n\tvec2 coord = vec2( halfLambert, 0.0 );\n\n\t#ifdef USE_GRADIENTMAP\n\n\t\treturn texture2D( gradientMap, coord ).rgb;\n\n\t#else",
      )
      // Cheap fresnel rim, added once lighting has accumulated. geometryNormal
      // and geometryViewDir are still in scope here (declared earlier in the
      // same main() by lights_fragment_begin).
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        {
          float rimFacing = 1.0 - saturate( dot( geometryNormal, geometryViewDir ) );
          float rim = pow( rimFacing, kRimPower ) * kRimIntensity;
          reflectedLight.directDiffuse += rim * kRimColor;
        }`,
      );

    shader.fragmentShader =
      "uniform vec3 kRimColor;\nuniform float kRimPower;\nuniform float kRimIntensity;\n" +
      shader.fragmentShader;
  };
  // Distinct onBeforeCompile identity per resulting shader variant so three
  // doesn't share a compiled program across materials with different
  // colour/vertexColors flags in a way that skips recompilation.
  material.customProgramCacheKey = () => "kindred-illustrative-toon";
}

/** Creates a MeshToonMaterial wired up with the shared gradient ramp and
 * the Half-Lambert + rim shading patch above. Use this everywhere in Grove
 * instead of `new THREE.MeshToonMaterial(...)` so every surface shades
 * consistently. */
export function createToonMaterial(gradientMap, color, extra = {}) {
  const material = new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
  applyIllustrativeShading(material);
  return material;
}
