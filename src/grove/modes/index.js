// src/grove/modes/index.js
//
// Registry mapping a district's `minigame` id (see scene/districts.js) to
// the factory that creates it. Only two of the five modes described in the
// design bible are implemented as real modules so far (Section 4.3 The
// Long Field and Section 4.5 The Quiet Round); Hearthfire Kitchen, Festival
// Games, and Lantern Relay are intentionally left out of this registry
// rather than stubbed, so a district whose mode isn't built yet simply has
// no "Play" affordance instead of a fake one — GroveView checks
// `getModeFactory(id)` for null before showing any mode UI.
//
// Adding a new mode later means: write modes/YourMode.js exporting
// createYourMode() that satisfies GameMode's contract, then add one line
// to MODE_FACTORIES below.

import { createQuietRoundMode } from "./QuietRoundMode.js";
import { createLongFieldMode } from "./LongFieldMode.js";

export const MODE_FACTORIES = Object.freeze({
  "quiet-round": createQuietRoundMode,
  "long-field": createLongFieldMode,
});

/** Returns the factory function for a mode id, or null if that mode is not
 * implemented yet. Never throws, since callers use this to decide whether
 * to render a "Play" affordance at all. */
export function getModeFactory(modeId) {
  return MODE_FACTORIES[modeId] ?? null;
}

export { createQuietRoundMode, createLongFieldMode };
export { validateMode, createParticipantRoster } from "./GameMode.js";
