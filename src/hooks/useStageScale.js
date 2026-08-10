import { useEffect, useState } from "react";

/**
 * Reference design canvas — the CSS pixel viewport the UI was originally laid
 * out on.
 *
 * Origin: 1920x1080 Windows laptop at 150% display scaling (= 1280x720 CSS px),
 * viewed in a maximized browser window:
 *   720 CSS px screen - 32 (taskbar) - 84 (tab strip + omnibox) = 605
 */
export const DESIGN_W = 1280;
export const DESIGN_H = 605;

/**
 * The reference canvas is 1280x605 — aspect 2.12, far wider than a typical
 * laptop screen. Fitting that rigid shape inside a 1.66 viewport would band the
 * screen with dead space and unstick everything anchored to an edge, so instead:
 *
 *   scale  = min(vw/W, vh/H)   uniform, so nothing distorts and every element
 *                              keeps the exact size and spacing it had
 *   canvas = vw/scale x vh/scale   grows past the reference in whichever axis
 *                                  is not the limiting one
 *
 * Scaled up, that canvas covers the viewport exactly — no letterbox. The
 * limiting axis matches the original layout precisely; the other axis gains
 * room, which the flex column absorbs (nav stays welded to the bottom, HUD to
 * the top corners, centred content stays centred). On a screen with the
 * original aspect ratio it collapses back to exactly 1280x605.
 */
function computeStage() {
  const vw = window.visualViewport?.width  ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const scale = Math.min(vw / DESIGN_W, vh / DESIGN_H);
  return { scale, width: vw / scale, height: vh / scale };
}

// Mirrored outside React so non-React consumers (e.g. the Three.js renderer)
// can read the live scale without threading props through.
let currentScale = 1;
export const getStageScale = () => currentScale;

export function useStageScale() {
  const [stage, setStage] = useState(() =>
    typeof window === "undefined"
      ? { scale: 1, width: DESIGN_W, height: DESIGN_H }
      : computeStage()
  );

  useEffect(() => {
    const update = () => {
      const next = computeStage();
      currentScale = next.scale;
      document.documentElement.style.setProperty("--stage-scale", String(next.scale));
      setStage(next);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return stage;
}
