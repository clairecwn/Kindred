// src/grove/scene/postfx.js
//
// Toy-scale post-processing stack: a restrained UnrealBloomPass (glow on
// lamps and sparkle only), then, after tone mapping, a small display-space
// grade: a touch more saturation and a faint vignette. The scene itself is
// drawn into a multisampled target so edges are smooth, and at the real
// on-screen pixel density so nothing is stretched (see GroveScene.resize).
// Deliberately does NOT include SSAO - vertex-colour AO baked into the
// terrain already grounds objects, and screen-space AO reads gritty/
// realistic, fighting the toy-like read this whole pass exists to support.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// A tiny grade: nudges contrast and saturation up a little and warms the
// midtones slightly, then a soft radial vignette darkens the frame edges so
// the eye stays on the plaza centre - both single-pass, single-uniform-set
// shaders, cheap even at full resolution.
const GradeVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.03 },
    saturation: { value: 1.12 },
    vignetteStrength: { value: 0.1 },
    vignetteRadius: { value: 0.9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float contrast;
    uniform float saturation;
    uniform float vignetteStrength;
    uniform float vignetteRadius;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D( tDiffuse, vUv );
      vec3 c = color.rgb;
      c = ( c - 0.5 ) * contrast + 0.5;
      float luma = dot( c, vec3( 0.299, 0.587, 0.114 ) );
      c = mix( vec3( luma ), c, saturation );
      float d = distance( vUv, vec2( 0.5 ) );
      float vig = smoothstep( vignetteRadius, vignetteRadius - 0.55, d );
      c *= mix( 1.0 - vignetteStrength, 1.0, vig );
      gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), color.a );
    }
  `,
};

/** Builds the composer for Grove's toy-scale render. `width`/`height` should
 * already exclude devicePixelRatio (the composer/passes read the renderer's
 * own pixel ratio internally). Returns { composer, resize, dispose }. */
export function createPostFX(renderer, scene, camera, width, height) {
  // Half-float so highlights survive until tone mapping; 4x multisampling
  // because a composer bypasses the canvas's own antialiasing.
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  // Bloom rendered at a small fixed resolution regardless of viewport size
  // - a cheap glow, not a high-fidelity one - so it stays fast on a laptop
  // even at a large/hi-DPI viewport.
  // Kept deliberately tiny and high-threshold: only genuinely emissive
  // things (lamp bulbs, fountain sparkle - materials marked
  // toneMapped:false in GroveScene.js so they survive the ACES rolloff
  // below at full brightness) should bloom at all. Toon-shaded surfaces
  // are capped at luminance 1.0 by the gradient ramp and further
  // compressed by tone mapping, so they stay under this threshold and
  // never bloom - the previous 0.5/0.72 setting was blooming almost every
  // lit surface in the scene, washing the whole frame to a pastel haze.
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.12, 0.25, 1.05);
  bloom.threshold = 1.05;   // above any lit matte surface: only real glows bloom
  bloom.strength = 0.12;
  bloom.radius = 0.25;
  composer.addPass(bloom);

  // OutputPass performs the renderer's usual tone-mapping/colour-space
  // conversion, which EffectComposer otherwise bypasses.
  composer.addPass(new OutputPass());

  // Graded last, on the finished display colours, so "a little more
  // saturation" means exactly that rather than a push on raw light values.
  const grade = new ShaderPass(GradeVignetteShader);
  composer.addPass(grade);

  composer.setSize(width, height);

  return {
    composer,
    bloom,
    resize(w, h, pixelRatio = renderer.getPixelRatio()) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
    },
    dispose() {
      composer.passes.forEach((pass) => pass.dispose?.());
    },
  };
}
