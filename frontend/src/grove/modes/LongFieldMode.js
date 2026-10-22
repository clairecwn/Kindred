// src/grove/modes/LongFieldMode.js
//
// "The Long Field" — Market district, design bible section 4.3. Solo-first,
// ongoing, drop-in and drop-out, no session timer. Planting, growing,
// harvesting, and gifting surplus to a neighbour's stall. A plot left
// untended simply pauses in place: no wilting, no decay, matching the
// wider no-punish-absence rule.
//
// State persists per user in localStorage (`grove.longfield.<userId>`) since
// Grove has no dedicated backend table yet; swapping this for a Supabase
// row later only means replacing `_load`/`_save`, the public API is
// unaffected.

import { validateMode, createParticipantRoster } from "./GameMode.js";

export const PLOT_SIZE = 6; // a small 6-cell plot per player, deliberately
                              // modest so tending it never feels like a job

export const CROPS = Object.freeze({
  sunroot:   { id: "sunroot",   growMs: 60_000,  yield: 4 },  // ~1 minute
  moonberry: { id: "moonberry", growMs: 180_000, yield: 9 },  // ~3 minutes
  driftwheat:{ id: "driftwheat",growMs: 480_000, yield: 20 }, // ~8 minutes
});

function storageKey(userId) {
  return `grove.longfield.${userId}`;
}

function emptyPlot() {
  return Array.from({ length: PLOT_SIZE }, () => ({ cropId: null, plantedAt: null }));
}

function loadPlot(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyPlot();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== PLOT_SIZE) return emptyPlot();
    return parsed;
  } catch {
    return emptyPlot();
  }
}

function savePlot(userId, plot) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(plot)); }
  catch { /* private browsing or full storage — the session still works,
             it just won't persist across reloads */ }
}

export function createLongFieldMode({ districtId = "home" } = {}) {
  const roster = createParticipantRoster();
  const plots = new Map(); // userId -> plot array, loaded lazily on join

  function plotFor(userId) {
    if (!plots.has(userId)) plots.set(userId, loadPlot(userId));
    return plots.get(userId);
  }

  function growthStage(cell, now) {
    if (!cell.cropId) return "empty";
    const crop = CROPS[cell.cropId];
    if (!crop) return "empty";
    const elapsed = now - cell.plantedAt;
    if (elapsed >= crop.growMs) return "ready";
    if (elapsed >= crop.growMs * 0.5) return "growing";
    return "sprout";
  }

  const mode = {
    id: "long-field",
    districtId,

    join(userId) {
      roster.add(userId, {});
      plotFor(userId); // warm the plot from storage so getState is correct
                        // even before the first update() tick
    },

    leave(userId) {
      // Leaving never touches the plot itself — "a plot left untended
      // simply pauses in place, no wilting, no decay."
      roster.remove(userId);
    },

    /** Plant a crop in one cell of the caller's own plot. Fails quietly
     * (returns false) rather than throwing, since a stale UI click on an
     * already-occupied cell is an expected, harmless case, not an error. */
    plant(userId, cellIndex, cropId) {
      if (!CROPS[cropId]) return false;
      if (cellIndex < 0 || cellIndex >= PLOT_SIZE) return false;
      const plot = plotFor(userId);
      if (plot[cellIndex].cropId) return false; // already occupied
      plot[cellIndex] = { cropId, plantedAt: Date.now() };
      savePlot(userId, plot);
      return true;
    },

    /** Harvest one ready cell, returning the Petals yield (0 if not ready
     * or empty). Resets the cell so it can be replanted. */
    harvest(userId, cellIndex) {
      const plot = plotFor(userId);
      const cell = plot[cellIndex];
      if (!cell || growthStage(cell, Date.now()) !== "ready") return 0;
      const crop = CROPS[cell.cropId];
      plot[cellIndex] = { cropId: null, plantedAt: null };
      savePlot(userId, plot);
      return crop.yield;
    },

    /** Gift a whole ready cell's yield to a neighbour's stall in one tap,
     * anonymous-if-desired per the design bible. Returns the amount gifted
     * (0 on failure) so the caller can route it into the recipient's
     * currency without this module knowing anything about a wallet. */
    gift(fromUserId, cellIndex, toUserId) {
      const amount = mode.harvest(fromUserId, cellIndex);
      if (amount <= 0) return 0;
      return { toUserId, amount };
    },

    update() {
      // Growth is computed lazily from wall-clock time on read (see
      // getState/growthStage) rather than ticked here, since a plot must
      // keep growing correctly even while nobody is looking at it (no
      // decay, no need for the mode to be "running" for time to pass).
    },

    getState(userId) {
      const now = Date.now();
      const plot = plotFor(userId);
      return {
        id: "long-field",
        districtId,
        crops: CROPS,
        plot: plot.map((cell) => ({
          cropId: cell.cropId,
          plantedAt: cell.plantedAt,
          stage: growthStage(cell, now),
        })),
        neighbours: roster.ids().filter((id) => id !== userId),
      };
    },

    isActive() {
      return roster.size() > 0;
    },

    dispose() {
      roster.clear();
      plots.clear();
    },
  };

  return validateMode(mode, "LongFieldMode");
}
