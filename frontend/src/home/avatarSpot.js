/**
 * avatarSpot.js — where the 3D avatar sits in the Lanternfall scene for
 * each mood, shared between LanternfallScene.jsx (the shadow ellipse under
 * a flourishing-mood avatar) and HomeView.jsx (which positions the actual
 * AvatarStage overlay at this same point, in the 1280x605 design canvas's
 * own coordinate space).
 */
export function getAvatarSpot(sky) {
  if (sky === "rough") {
    // Seen through the lit window, small and backlit.
    return { x: 864, y: 385, scale: 0.34, silhouette: true, shadow: false, emotion: "sad" };
  }
  if (sky === "flourishing") {
    // Out on the path, further down toward the Grove.
    return { x: 700, y: 478, scale: 0.5, silhouette: false, shadow: true, emotion: "happy" };
  }
  // Steady: right at the doorstep.
  return { x: 878, y: 474, scale: 0.5, silhouette: false, shadow: false, emotion: "calm" };
}
