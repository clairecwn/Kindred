import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createAvatar, applyDescriptor, disposeAvatar, playClip, AVATAR_HEIGHT } from "./KindredRig.js";
import { preload as preloadAvatarModels, onLoaded as onModelLoaded } from "./kindredModels.js";
import { toAvatarDescriptor } from "./kindredAdapter.js";
import { getStageScale } from "../hooks/useStageScale.js";
import { CLIPS } from "./castData.js";

// The wellness screens talk in emotions; the rig speaks in authored clip
// names. Anything unmapped falls through to the clip name itself, then idle.
const IDLE_FOR = {
  neutral: "idle", calm: "idle", content: "idle", tired: "sit_floor",
  happy: "idle", excited: "idle", restless: "idle",
};
const REACT_FOR = {
  Wave: "wave", wave: "wave", happy: "cheer", excited: "cheer",
  celebrate: "cheer", clap: "clap", yes: "nod_yes", no: "shake_no", jump: "jump",
};

/**
 * AvatarStage — a small reusable three.js canvas that mounts exactly one
 * Grove avatar, for use anywhere OUTSIDE Grove itself (wardrobe hero/roster
 * previews, the Home Lanternfall scene, Kingdom). This is the one place
 * outside src/grove/scene that owns a THREE.WebGLRenderer for the avatar —
 * every other screen should render one of these rather than hand-rolling a
 * renderer, so contexts are created and torn down the same careful way
 * everywhere.
 *
 * Props:
 *  - character / descriptor: either the app's legacy {animal, skin, outfit,
 *    ...} shape or the new {species, palette, wardrobe, powerups} shape —
 *    both are accepted via adapter.js's toAvatarDescriptor.
 *  - clip: emotion name (e.g. "calm", "happy") to drive the idle pose, OR an
 *    explicit clip name understood by AnimationController.
 *  - reactKey: bump this (e.g. increment a counter) to fire `reactClip` once
 *    as a one-shot emote layered over the idle, then fall back to idle.
 *  - reactClip: clip name played on a reactKey change (default "Wave").
 *  - angle: fixed Y rotation in radians (ignored if turntable is true).
 *  - turntable: slowly auto-rotate the avatar for display.
 *  - spinnable: let the player drag left/right to turn the avatar a full 360
 *    degrees on its vertical axis (yaw only -- never pitch, so it cannot end
 *    up upside down), with a short inertial glide after the pointer lifts.
 *  - size: number (square) or {width, height} in CSS px.
 *  - static: render exactly one frame and stop — no rAF loop at all. Use
 *    this for grids of many simultaneous thumbnails so they cost a draw
 *    call, not a running loop, each.
 *  - background: CSS color for the canvas backdrop; default transparent.
 */
export default function AvatarStage({
  character,
  descriptor,
  clip = "neutral",
  reactKey,
  reactClip = "wave",
  angle = 0.35,
  turntable = false,
  spinnable = false,
  size = 160,
  static: isStatic = false,
  background = "transparent",
  className,
}) {
  const mountRef = useRef(null);
  const liveRef = useRef({ clip, angle, turntable });
  const runtimeRef = useRef(null);
  // Drag-to-spin state. Yaw is kept here rather than in React state so a
  // drag never re-renders: the rAF loop reads it straight off the ref.
  const spinRef = useRef({ yaw: angle, vel: 0, dragging: false, lastX: 0, moved: false });

  const width = typeof size === "number" ? size : size.width;
  const height = typeof size === "number" ? size : size.height;

  const rawDescriptor = descriptor ?? character ?? {};
  const resolved = toAvatarDescriptor(rawDescriptor);
  const descriptorKey = JSON.stringify(resolved);

  liveRef.current.clip = clip;
  liveRef.current.angle = angle;
  liveRef.current.turntable = turntable;
  liveRef.current.spinnable = spinnable;

  // ── Mount: build renderer/scene/camera/avatar once per size+static ──────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * getStageScale(), isStatic ? 2 : 2.5));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral rolls highlights off without the warm desaturation ACES adds,
    // so the cast keeps its painted hues instead of drifting towards cream.
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Framing: the authored cast stands 1.6 units tall with ears reaching
    // ~1.75, so the frustum has to cover y 0 -> 1.8 or the preview crops
    // the feet and the ear tips (which are half of what makes a species
    // recognisable). tan(15deg) * 3.4 ~= 0.91 of half-height around a
    // 0.88 centre does exactly that.
    const camera = new THREE.PerspectiveCamera(30, width / Math.max(1, height), 0.1, 30);
    camera.position.set(0, AVATAR_HEIGHT * 0.62, AVATAR_HEIGHT * 2.13);
    camera.lookAt(0, AVATAR_HEIGHT * 0.55, 0);

    // Exposure budget. These four lights used to sum to ~4.75 of irradiance,
    // which drove every mid-tone albedo past 1.0 and clipped it to white --
    // Kai's orange tee and blue shorts both read as pale pastel. The total is
    // now ~1.6 with a filmic roll-off on top, so the authored colours survive.
    scene.add(new THREE.AmbientLight(0xfff8f0, 0.62));
    const key = new THREE.DirectionalLight(0xfff2d8, 0.95);
    key.position.set(2.2, 4, 3.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd0e0ff, 0.38);
    fill.position.set(-2.6, 1.4, 2.6);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffcdb8, 0.30);
    rim.position.set(0, 2, -3.4);
    scene.add(rim);

    const avatar = createAvatar(toAvatarDescriptor(rawDescriptor));
    avatar.rotation.y = liveRef.current.spinnable ? spinRef.current.yaw : liveRef.current.angle;
    scene.add(avatar);

    const clock = new THREE.Clock();
    let rafId = 0;
    let turntableT = 0;

    function renderOnce() {
      renderer.render(scene, camera);
    }

    function frame() {
      if (disposed) return;
      rafId = requestAnimationFrame(frame);
      if (document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      avatar.userData.animation?.update(dt);
      if (liveRef.current.spinnable) {
        const sp = spinRef.current;
        if (!sp.dragging && Math.abs(sp.vel) > 1e-4) {
          sp.yaw += sp.vel;
          sp.vel *= 0.92;            // glide to a stop, Brawl-Stars style
        }
        avatar.rotation.y = sp.yaw;
      } else if (liveRef.current.turntable) {
        turntableT += dt;
        avatar.rotation.y = liveRef.current.angle + turntableT * 0.5;
      } else {
        avatar.rotation.y = liveRef.current.angle;
      }
      renderOnce();
    }

    runtimeRef.current = { renderer, scene, camera, avatar, clock };

    // A `static` stage renders exactly one frame, so it would freeze on
    // the procedural placeholder if the .glb cache were still cold.
    // Re-render once more when the authored model lands.
    const stopWatching = onModelLoaded(() => {
      if (disposed || !isStatic) return;
      requestAnimationFrame(() => { if (!disposed) renderOnce(); });
    });
    preloadAvatarModels();

    if (isStatic) {
      renderOnce();
    } else {
      rafId = requestAnimationFrame(frame);
    }

    function onVisibility() {
      if (!document.hidden && !isStatic && !disposed && !rafId) {
        rafId = requestAnimationFrame(frame);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      stopWatching();
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafId) cancelAnimationFrame(rafId);
      disposeAvatar(avatar);
      scene.remove(avatar);
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      runtimeRef.current = null;
    };
    // Rebuilt only when the canvas size or render mode changes — descriptor,
    // clip and angle updates are applied in place below via applyDescriptor,
    // never by tearing the whole scene down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, isStatic]);

  // ── Descriptor changes: live-update the existing avatar in place ────────
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    applyDescriptor(rt.avatar, toAvatarDescriptor(rawDescriptor));
    if (isStatic) rt.renderer.render(rt.scene, rt.camera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptorKey]);

  // ── Emotion / idle clip changes ──────────────────────────────────────────
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    playClip(rt.avatar, IDLE_FOR[clip] ?? (CLIPS[clip] ? clip : "idle"));
    if (isStatic) rt.renderer.render(rt.scene, rt.camera);
  }, [clip, isStatic]);

  // ── One-shot reaction clip ────────────────────────────────────────────────
  useEffect(() => {
    if (reactKey == null) return;
    const rt = runtimeRef.current;
    if (!rt) return;
    const name = REACT_FOR[reactClip] ?? (CLIPS[reactClip] ? reactClip : "wave");
    playClip(rt.avatar, name, { once: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactKey]);

  // ── Drag to spin ────────────────────────────────────────────────────────
  // Yaw only, so the character never tips upside down or lies on its back --
  // the same single-axis turntable a shop screen in Brawl Stars gives you.
  // Vertical movement is ignored outright rather than clamped.
  function onPointerDown(e) {
    if (!spinnable) return;
    const sp = spinRef.current;
    sp.dragging = true;
    sp.lastX = e.clientX;
    sp.vel = 0;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    const sp = spinRef.current;
    if (!spinnable || !sp.dragging) return;
    const dx = e.clientX - sp.lastX;
    sp.lastX = e.clientX;
    const step = dx * 0.011;
    sp.yaw += step;
    sp.vel = step;
    e.preventDefault();
  }
  function onPointerUp(e) {
    const sp = spinRef.current;
    if (!sp.dragging) return;
    sp.dragging = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  return (
    <div
      ref={mountRef}
      className={className}
      style={{
        width, height, background, flexShrink: 0, overflow: "hidden",
        touchAction: spinnable ? "none" : undefined,
        cursor: spinnable ? "grab" : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-hidden="true"
    />
  );
}
