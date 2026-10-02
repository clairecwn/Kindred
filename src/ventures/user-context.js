/**
 * user-context.js
 *
 * Builds the userContext object scoring.js/recommender.js consume.
 *
 * ===========================================================================
 * WHAT CHANGED
 * ===========================================================================
 * This used to map a single discrete emotion word (or, at best, a check-in
 * band) onto a capacity band and stop there. Two problems:
 *
 *  1. It ignored the analysis layer entirely. src/lib/analysis produces a
 *     latent wellbeing state theta in points on the 0-21 scale, a posterior
 *     variance for it, a VAD affect point and a calibrated confidence — and
 *     none of it reached the recommender, which was reading an emotion label
 *     the UI happened to have lying around.
 *  2. It ignored uncertainty completely. A band derived from one check-in was
 *     treated exactly like a band derived from sixty, so a brand new user
 *     could be confidently placed in "moderate" and offered a one-rung social
 *     stretch on day one.
 *
 * ===========================================================================
 * THE CAPACITY MODEL
 * ===========================================================================
 * Capacity band comes from the best available signal, in this order:
 *
 *   1. latentState.theta  (points, 0-21)  — the filtered state estimate.
 *   2. checkinBand        — today's band from checkin-scoring.js.
 *   3. emotion label      — the legacy fallback, still supported.
 *   4. moderate           — the neutral default.
 *
 * From theta, bands are the check-in scale's own cut points, so "struggling"
 * on the wellbeing scale and "depleted" in the recommender mean the same
 * thing rather than two independently invented thresholds:
 *
 *     theta <  THETA_DEPLETED_MAX (6.93 = the struggling cutoff) -> depleted
 *     theta < THETA_LOW_MAX (10.5 = the scale midpoint)          -> low
 *     theta < THETA_MODERATE_MAX (14.70 = the navigating cutoff) -> moderate
 *     otherwise                                                  -> high
 *
 * UNCERTAINTY ADJUSTMENT. When confidence in the state is below
 * CONFIDENCE_FOR_FULL_CAPACITY, the band is stepped DOWN by one (never up).
 * The asymmetry is the safety argument: being wrong in the cautious direction
 * offers someone something gentler than they could have managed, which costs
 * nothing; being wrong in the confident direction offers a depleted person a
 * group event. `capacityBandRaw` and `capacityDownshifted` are both reported
 * so the adjustment is visible rather than baked in silently.
 *
 * The same confidence is passed through as `stateConfidence`, which is what
 * drives scoring.js's exploration term: less certainty about the user means
 * more variety in what is offered, not more conviction.
 */

import { EMOTION_TO_CAPACITY_BAND, CAPACITY_BAND } from "./activity-model.js";

/** checkin_scores.band -> capacity band. */
const CHECKIN_BAND_TO_CAPACITY = Object.freeze({
  struggling: CAPACITY_BAND.DEPLETED,
  navigating: CAPACITY_BAND.MODERATE,
  flourishing: CAPACITY_BAND.HIGH,
});

// Cut points on the 0-21 wellbeing scale. These mirror
// checkin-scoring.js PROVISIONAL_BAND_CUTOFFS (0.33 and 0.70 of the range)
// plus the scale midpoint, rather than being invented here.
export const THETA_DEPLETED_MAX = 6.93;
export const THETA_LOW_MAX = 10.5;
export const THETA_MODERATE_MAX = 14.7;

/** Below this confidence in the state estimate, the band is stepped down one. */
export const CONFIDENCE_FOR_FULL_CAPACITY = 0.45;

const BAND_ORDER = [
  CAPACITY_BAND.DEPLETED,
  CAPACITY_BAND.LOW,
  CAPACITY_BAND.MODERATE,
  CAPACITY_BAND.HIGH,
];

/** Capacity band implied by a latent state value in points. */
export function thetaToCapacityBand(theta) {
  if (!Number.isFinite(theta)) return null;
  if (theta < THETA_DEPLETED_MAX) return CAPACITY_BAND.DEPLETED;
  if (theta < THETA_LOW_MAX) return CAPACITY_BAND.LOW;
  if (theta < THETA_MODERATE_MAX) return CAPACITY_BAND.MODERATE;
  return CAPACITY_BAND.HIGH;
}

function stepDown(band) {
  const i = BAND_ORDER.indexOf(band);
  return i <= 0 ? BAND_ORDER[0] : BAND_ORDER[i - 1];
}

/**
 * @param {object} input
 * @param {object} [input.analysis] - a result from src/lib/analysis
 *   analyseUser()/analyseEntry(). When present, its latentState, vad and
 *   confidence take priority over every coarser signal below.
 * @param {string} [input.emotion] - discrete emotion label, legacy fallback.
 * @param {string} [input.checkinBand] - 'struggling'|'navigating'|'flourishing'.
 * @param {number} [input.currentSocialRung] - user's last comfortable rung.
 * @param {object} [input.overrides] - anything to force-merge on top.
 */
export function buildUserContext(input = {}) {
  const {
    analysis = null,
    emotion = "neutral",
    checkinBand = null,
    currentSocialRung = 0,
    userId = null,
    country = "SG",
    budgetMax = Infinity,
    currency = "SGD",
    maxTransitMinutes = null,
    mobilityLevel = "any",
    languageCodes = ["en"],
    recentActivityIds = [],
    recentCategories = null,
    pastParticipation = [],
    isNewAccount = false,
    weeklyExerciseMinutes = 0,
    settingPreference = "any",
    availableHours = null,
    overrides = {},
  } = input;

  const theta = analysis?.latentState?.theta ?? input.theta ?? null;
  const stateConfidence = Number.isFinite(analysis?.confidence)
    ? analysis.confidence
    : (Number.isFinite(input.stateConfidence) ? input.stateConfidence : null);
  const vad = analysis?.vad ?? input.vad ?? null;
  const resolvedCheckinBand = checkinBand ?? analysis?.todayScore?.band ?? null;

  const bandRaw =
    thetaToCapacityBand(theta) ||
    (resolvedCheckinBand && CHECKIN_BAND_TO_CAPACITY[resolvedCheckinBand]) ||
    EMOTION_TO_CAPACITY_BAND[emotion] ||
    CAPACITY_BAND.MODERATE;

  // Uncertainty adjustment: cautious direction only. A missing confidence is
  // treated as low confidence, because "we did not compute it" is not
  // evidence that the estimate is good.
  const confident = Number.isFinite(stateConfidence) && stateConfidence >= CONFIDENCE_FOR_FULL_CAPACITY;
  const capacityBand = confident ? bandRaw : stepDown(bandRaw);

  return {
    userId,
    capacityBand,
    capacityBandRaw: bandRaw,
    capacityDownshifted: capacityBand !== bandRaw,
    theta,
    stateConfidence,
    vad,
    currentSocialRung,
    country,
    budgetMax,
    currency,
    maxTransitMinutes,
    mobilityLevel,
    languageCodes,
    recentActivityIds,
    recentCategories,
    pastParticipation,
    isNewAccount,
    weeklyExerciseMinutes,
    settingPreference,
    availableHours,
    ...overrides,
  };
}
