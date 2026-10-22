/**
 * orb-icon.js
 *
 * Builds Leaflet divIcons that read as glowing orbs, coloured by the
 * activity's evidence category (activity-model.js). Kept separate from
 * RealWorldView.jsx so the colour map and markup are unit-testable and
 * reusable without dragging Leaflet's runtime into a test file.
 */

import L from "leaflet";
import { EVIDENCE_CATEGORY } from "./activity-model.js";

export const CATEGORY_COLOR = Object.freeze({
  [EVIDENCE_CATEGORY.EXERCISE]: "#FF7A45",
  [EVIDENCE_CATEGORY.GREEN_BLUE_SPACE]: "#4CAF7D",
  [EVIDENCE_CATEGORY.VOLUNTEERING]: "#E8A840",
  [EVIDENCE_CATEGORY.ARTS_CREATIVE]: "#9B72CF",
  [EVIDENCE_CATEGORY.SOCIAL_CONNECTION]: "#5AA9E8",
  [EVIDENCE_CATEGORY.BEHAVIOURAL_ACTIVATION]: "#3ECFC0",
});

export function categoryColor(evidenceCategory) {
  return CATEGORY_COLOR[evidenceCategory] ?? "#3A9B7A";
}

/**
 * @param {object} opts
 * @param {string} opts.color - hex colour for the halo/core.
 * @param {boolean} [opts.recommended] - stronger glow + slightly bigger.
 */
export function buildOrbIcon({ color, recommended = false }) {
  const size = recommended ? 42 : 34;
  const html = `
    <div class="venture-orb-wrap${recommended ? " is-reco" : ""}" style="--orb-color:${color}">
      <span class="venture-orb-halo"></span>
      <span class="venture-orb-core"></span>
    </div>
  `;
  return L.divIcon({
    className: "venture-orb-icon",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/** Marker used while the host picks a location for a new activity. */
export function buildPickerIcon() {
  const html = `
    <div class="venture-orb-wrap is-picking">
      <span class="venture-orb-halo"></span>
      <span class="venture-orb-core"></span>
    </div>
  `;
  return L.divIcon({
    className: "venture-orb-icon",
    html,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}
