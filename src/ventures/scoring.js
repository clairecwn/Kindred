/**
 * scoring.js — THE VENTURES UTILITY MODEL.
 *
 * Pure functions over one (activity, userContext) pair. No I/O, no clock, no
 * randomness: the same pair always scores identically, and every term below
 * is inspectable in the returned `breakdown`.
 *
 * ===========================================================================
 * 0. WHAT THIS IS ALLOWED TO OPTIMISE FOR
 * ===========================================================================
 * The Design Bible's prohibitions are constraints on the objective function,
 * not decoration, so they are written into it:
 *
 *   - The objective is PREDICTED WELLBEING BENEFIT TO THIS USER TODAY. It is
 *     not engagement, not attendance, not retention, not time-in-app. No term
 *     below rewards a user for doing more, and no term is a function of how
 *     often they open the app.
 *   - No term is a function of ANY OTHER USER's behaviour. There is no
 *     popularity signal, no "people like you", no join count, no ranking of
 *     users against each other. The bandit in recommender.js is defined on
 *     the user's own mood delta for the same reason.
 *   - No term rewards streaks, punishes absence, or decays because a user was
 *     away. Taking a break is not a penalty; `recencyPenalty` penalises
 *     repeating the same ACTIVITY, never the user.
 *   - A low-capacity day must be able to score a genuinely no-effort option
 *     highest. Doing nothing demanding is a valid outcome, so `energyFit`
 *     peaks AT the user's capacity, not above it.
 *
 * ===========================================================================
 * 1. THE UTILITY FUNCTION
 * ===========================================================================
 * Hard filters run first (section 2). Anything that fails them is never
 * scored; a failed filter is not a low score, it is an absence. For anything
 * that survives:
 *
 *     U(a | s) = Σ_k w_k · f_k(a, s)  −  w_recency · recency(a, s)
 *                                     +  w_explore · explore(a, s)
 *
 * where s is the user state (capacity band, social rung, latent state and its
 * uncertainty, time of day, weather-ish preferences) and the seven feature
 * terms f_k are each in [0, 1]:
 *
 *   energyFit       1 when the activity's energy demand exactly matches what
 *                   the user's capacity band can bring, falling off in BOTH
 *                   directions. Asymmetric: overshooting capacity is
 *                   penalised twice as hard as undershooting it, because the
 *                   cost of recommending something too demanding to someone
 *                   depleted is a failure experience, and the cost of
 *                   recommending something too easy is mild boredom.
 *   socialFit       the graded-exposure term. Peak at exactly one rung above
 *                   the user's current comfortable rung (1.0), high at the
 *                   same rung (0.75), acceptable below (0.6), zero above +1
 *                   (already excluded by a hard filter; the zero is
 *                   defensive).
 *   evidenceFit     the activity category's evidence weight for mood
 *                   outcomes (activity-model.js EVIDENCE_WEIGHT), with the
 *                   documented adjustments for obligated volunteering and the
 *                   exercise dose-response curve.
 *   travelFit       exp(−travelMinutes / TRAVEL_TOLERANCE(s)), with the
 *                   tolerance itself shrinking as capacity falls: a depleted
 *                   person's 30-minute journey is a much bigger ask than a
 *                   flourishing person's. Unknown travel time scores
 *                   TRAVEL_UNKNOWN_FIT, deliberately below a known-short trip
 *                   and above a known-long one.
 *   timeOfDayFit    how well the activity's window matches the hours the user
 *                   is actually available and alert. Unknown windows score
 *                   TIME_UNKNOWN_FIT for the same reason.
 *   settingFit      indoor vs outdoor against the user's stated preference,
 *                   with one state-conditional rule: outdoor/green-space
 *                   options are favoured when arousal is HIGH and dominance
 *                   is LOW (the agitated, overwhelmed quadrant), which is the
 *                   state green space has the clearest evidence for.
 *   noveltyFit      whether this is a category the user has not done lately.
 *                   Bounded and small; it is a variety term, not a driver.
 *
 * ===========================================================================
 * 2. HARD FILTERS (structural, not weighted)
 * ===========================================================================
 * Accessibility (country, budget, transit, mobility, language), the
 * graded-exposure one-rung cap, the capacity energy cap, and safety.js's
 * venue risk. These are pass/fail because the failure mode being prevented —
 * a low-mood, isolated user being offered a large group event, or a first
 * meetup at a private address — must be structurally impossible rather than
 * merely unlikely. A weighted penalty can always be outvoted; a filter
 * cannot.
 *
 * ===========================================================================
 * 3. EXPLORATION VS EXPLOITATION — THE STATED RULE
 * ===========================================================================
 * The old code called a hash of the activity id "novelty" and added it at
 * weight 0.10. That is not exploration: it is a fixed, arbitrary per-activity
 * offset that never changes as the system learns, and it moves the ranking by
 * up to a tenth of the total score for no reason connected to the user.
 *
 * The rule now is explicit and state-dependent:
 *
 *     explore(a, s) = uncertaintyBonus(s) · categoryUnfamiliarity(a, s)
 *     uncertaintyBonus(s) = clamp(stateUncertainty(s), 0, 1) · (1 − depletion(s))
 *
 * in words: EXPLORE MORE WHEN WE KNOW LESS ABOUT THE USER, AND LESS WHEN THE
 * USER HAS LESS TO SPEND. stateUncertainty is 1 − the analysis layer's
 * `confidence` (index.js), so a brand new user — about whom the model has no
 * business being opinionated — gets variety, and a user with 60 check-ins
 * gets the thing that fits. depletion is 1 for a depleted capacity band and 0
 * for a high one, so exploration is throttled exactly when a misfire costs
 * the most. With no state information at all the term is the same for every
 * activity and therefore cannot reorder anything.
 *
 * Ties are broken by a deterministic hash of (activity id, salt) at weight
 * TIE_BREAK_WEIGHT — three orders of magnitude smaller than any feature
 * term, so it can only ever separate scores that are otherwise equal. That is
 * all the hash was ever fit to do.
 *
 * ===========================================================================
 * 4. WEIGHTS — WHERE THEY COME FROM
 * ===========================================================================
 * WEIGHTS below sum to 1 across the feature terms, so U is on [0, 1] before
 * the recency and exploration adjustments. They are JUDGEMENT, not fitted
 * values, and they are ordered by how badly getting each one wrong hurts:
 *
 *   energyFit 0.26   the top cause of a recommendation being ignored is that
 *                    the person did not have it in them.
 *   socialFit 0.22   the graded-exposure ladder is the intervention.
 *   evidenceFit 0.20 what the literature says actually shifts mood.
 *   travelFit 0.14   the most common practical blocker after energy.
 *   timeOfDayFit 0.10
 *   settingFit 0.05
 *   noveltyFit 0.03  variety, never a driver.
 *
 * They are exported and frozen. Anyone changing them is changing a stated
 * model, not tuning a magic number, and RECOMMENDER_WEIGHTS_VERSION records
 * which set produced a stored recommendation.
 *
 * ===========================================================================
 * 5. THIN SUPPLY
 * ===========================================================================
 * Nothing here degrades badly when supply is thin, because nothing here
 * assumes a large candidate pool: every term is computed per activity against
 * the user, with no normalisation across the candidate set, no percentile, no
 * softmax over competitors. One candidate scores exactly as it would among a
 * hundred. recommender.js owns what to do when the pool is empty.
 *
 * userContext shape: see src/ventures/user-context.js.
 */

import {
  ENERGY_DEMAND_ORDER,
  SOCIAL_INTENSITY_ORDER,
  EVIDENCE_WEIGHT,
  EVIDENCE_CATEGORY,
  CAPACITY_BAND,
  CAPACITY_BAND_MAX_STARTING_RUNG,
  CAPACITY_BAND_MAX_ENERGY,
  EXERCISE_DOSE_PLATEAU_MIN_PER_WEEK,
} from "./activity-model.js";
import { assessVenueRisk } from "./safety.js";

export const RECOMMENDER_WEIGHTS_VERSION = "ventures-utility-v2";

export const WEIGHTS = Object.freeze({
  energyFit: 0.26,
  socialFit: 0.22,
  evidence: 0.20,
  travelFit: 0.14,
  timeOfDayFit: 0.10,
  settingFit: 0.05,
  novelty: 0.03,
});

/** Subtracted, not part of the weighted sum. */
export const RECENCY_WEIGHT = 0.20;
/** Maximum size of the exploration bonus, at maximum uncertainty. */
export const EXPLORATION_WEIGHT = 0.12;
/** Deterministic tie-break only. Three orders of magnitude below any term. */
export const TIE_BREAK_WEIGHT = 0.0005;

/** Travel tolerance in minutes by capacity band: the journey length at which
 *  travelFit falls to 1/e. A depleted person's tolerance is a third of a
 *  flourishing person's, which is the point of conditioning on state at all. */
export const TRAVEL_TOLERANCE_MINUTES = Object.freeze({
  [CAPACITY_BAND.DEPLETED]: 10,
  [CAPACITY_BAND.LOW]: 18,
  [CAPACITY_BAND.MODERATE]: 28,
  [CAPACITY_BAND.HIGH]: 40,
});

/** Score for an activity whose travel time is unknown. Between a known-short
 *  and a known-long trip: unknown is not free, and it is not a disqualifier. */
/** Fraction of the capacity ceiling that energyFitScore peaks at. */
export const ENERGY_TARGET_FRACTION = 0.6;
/** Penalty per energy step below / above the target. Overshoot costs double. */
export const ENERGY_UNDERSHOOT_PENALTY = 0.25;
export const ENERGY_OVERSHOOT_PENALTY = 0.5;

export const TRAVEL_UNKNOWN_FIT = 0.55;
/** Same reasoning for an activity with no stated time window. */
export const TIME_UNKNOWN_FIT = 0.6;

/** Depletion weight per capacity band, used to throttle exploration. */
const DEPLETION = Object.freeze({
  [CAPACITY_BAND.DEPLETED]: 1.0,
  [CAPACITY_BAND.LOW]: 0.65,
  [CAPACITY_BAND.MODERATE]: 0.3,
  [CAPACITY_BAND.HIGH]: 0.0,
});

function orderIndex(order, value) {
  const i = order.indexOf(value);
  return i === -1 ? 0 : i;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

// ---------------------------------------------------------------------------
// 2. Hard filters.
// ---------------------------------------------------------------------------

/**
 * Hard accessibility filter. Returns { pass: boolean, reasons: string[] }.
 * Anything failing this NEVER appears in a recommendation, regardless of
 * score -- this runs before scoring, not as a score penalty.
 */
export function passesAccessibilityFilter(activity, userContext) {
  const reasons = [];

  if (userContext.country && activity.country && activity.country !== userContext.country) {
    reasons.push(`not available in ${userContext.country}`);
  }

  const budgetMax = userContext.budgetMax ?? Infinity;
  if (activity.cost.amount > budgetMax) {
    reasons.push("over budget");
  }

  if (
    userContext.maxTransitMinutes != null &&
    activity.location.transitNearby === false
  ) {
    reasons.push("not reachable within transit limit");
  }
  if (
    userContext.maxTransitMinutes != null &&
    Number.isFinite(activity.travelMinutes) &&
    activity.travelMinutes > userContext.maxTransitMinutes
  ) {
    reasons.push("travel time exceeds the user's stated limit");
  }

  const mobilityRank = { any: 0, low: 1, moderate: 2, high: 3 };
  const userMobility = mobilityRank[userContext.mobilityLevel ?? "any"] ?? 0;
  const requiredMobility = mobilityRank[activity.accessibility.mobilityLevelRequired ?? "any"] ?? 0;
  if (requiredMobility > userMobility) {
    reasons.push("mobility requirement exceeds user's stated mobility level");
  }
  if (
    userContext.mobilityLevel &&
    userContext.mobilityLevel !== "any" &&
    activity.accessibility.wheelchairAccessible === false &&
    userContext.requiresWheelchairAccess
  ) {
    reasons.push("not wheelchair accessible");
  }

  const userLangs = userContext.languageCodes ?? ["en"];
  const activityLangs = activity.accessibility.languageCodes ?? ["en"];
  if (!activityLangs.some((l) => userLangs.includes(l))) {
    reasons.push("no shared language");
  }

  return { pass: reasons.length === 0, reasons };
}

/**
 * Graded-exposure hard constraint: never offer something more than one
 * rung above the user's current comfortable social rung, and never above
 * what their capacity band would tolerate as a *starting* point either.
 */
export function passesGradedExposureCap(activity, userContext) {
  const currentRung = userContext.currentSocialRung ?? 0;
  const maxRungForCapacity =
    CAPACITY_BAND_MAX_STARTING_RUNG[userContext.capacityBand] ?? SOCIAL_INTENSITY_ORDER[0];
  const ceiling = Math.min(currentRung + 1, maxRungForCapacity);
  return activity.socialIntensity <= ceiling;
}

/** Hard cap on energy demand for the user's current capacity band. */
export function passesEnergyCap(activity, userContext) {
  const maxEnergy = CAPACITY_BAND_MAX_ENERGY[userContext.capacityBand];
  if (!maxEnergy) return true;
  return orderIndex(ENERGY_DEMAND_ORDER, activity.energyDemand) <= orderIndex(ENERGY_DEMAND_ORDER, maxEnergy);
}

/**
 * Runs every hard filter (accessibility, graded exposure, energy cap,
 * safety/risk). Returns { eligible, reasons }.
 */
export function isEligible(activity, userContext) {
  const reasons = [];
  const access = passesAccessibilityFilter(activity, userContext);
  if (!access.pass) reasons.push(...access.reasons);
  if (!passesGradedExposureCap(activity, userContext)) reasons.push("exceeds one-rung social exposure cap");
  if (!passesEnergyCap(activity, userContext)) reasons.push("exceeds energy capacity");

  const risk = assessVenueRisk(activity, userContext);
  if (risk.suppress) reasons.push(...risk.reasons);

  return { eligible: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// 1. Feature terms, each in [0, 1].
// ---------------------------------------------------------------------------

/**
 * Energy fit, peaked at the user's capacity and asymmetric around it.
 *
 * The previous version used 1 - |1 - activityIdx/maxIdx|·0.5, which is
 * maximised at exactly the capacity ceiling and, for a depleted user
 * (ceiling = "low"), scored a genuinely restful "minimal" option 0.5 against
 * "low" at 1.0. That is the wrong way round: on a depleted day the no-effort
 * option must be able to win.
 */
export function energyFitScore(activity, userContext) {
  const maxEnergy = CAPACITY_BAND_MAX_ENERGY[userContext.capacityBand] ?? ENERGY_DEMAND_ORDER[1];
  const activityIdx = orderIndex(ENERGY_DEMAND_ORDER, activity.energyDemand);
  const maxIdx = orderIndex(ENERGY_DEMAND_ORDER, maxEnergy);
  // Target sits well under the ceiling: use most of what you have, without
  // needing all of it. ENERGY_TARGET_FRACTION = 0.6 puts a depleted user's
  // target at 0.6 of one step, so a genuinely no-effort option scores ABOVE a
  // more demanding one on their worst days — the property the old formula got
  // backwards — while a high-capacity user peaks at "moderate".
  const target = maxIdx * ENERGY_TARGET_FRACTION;
  const over = activityIdx > target;
  const distance = Math.abs(activityIdx - target);
  const penaltyPerStep = over ? ENERGY_OVERSHOOT_PENALTY : ENERGY_UNDERSHOOT_PENALTY;
  return clamp(1 - distance * penaltyPerStep, 0, 1);
}

/** Graded exposure: reward the one-rung stretch, not stagnation or a jump. */
export function socialFitScore(activity, userContext) {
  const currentRung = userContext.currentSocialRung ?? 0;
  const delta = activity.socialIntensity - currentRung;
  if (delta < 0) return 0.6; // safe repeat, fine but not the point
  if (delta === 0) return 0.75; // comfortable, sustaining
  if (delta === 1) return 1.0; // the intended one-rung stretch
  return 0; // already filtered by the hard cap; defensive zero
}

/** Evidence weight, with the documented volunteering and dose-response rules. */
export function evidenceScore(activity, userContext) {
  const base = EVIDENCE_WEIGHT[activity.evidenceCategory] ?? 0.4;
  if (activity.evidenceCategory === EVIDENCE_CATEGORY.VOLUNTEERING && activity.isVoluntary === false) {
    // Obligated volunteering does not carry the same evidence.
    return base * 0.3;
  }
  if (activity.evidenceCategory === EVIDENCE_CATEGORY.EXERCISE) {
    const weeklyMinutesSoFar = userContext.weeklyExerciseMinutes ?? 0;
    const projected = weeklyMinutesSoFar + activity.durationMinutes;
    if (projected <= EXERCISE_DOSE_PLATEAU_MIN_PER_WEEK) {
      return Math.min(1, base * 1.1); // still climbing the dose-response curve
    }
  }
  return base;
}

/** exp(-travel / tolerance(capacity)). Unknown travel scores TRAVEL_UNKNOWN_FIT. */
export function travelFitScore(activity, userContext) {
  const minutes = Number.isFinite(activity.travelMinutes) ? activity.travelMinutes : null;
  if (minutes == null) return TRAVEL_UNKNOWN_FIT;
  const tolerance = TRAVEL_TOLERANCE_MINUTES[userContext.capacityBand] ?? TRAVEL_TOLERANCE_MINUTES.moderate;
  return clamp(Math.exp(-Math.max(0, minutes) / tolerance), 0, 1);
}

/**
 * Time-of-day fit. `activity.timeWindow` is { startHour, endHour } in local
 * 24h time; `userContext.availableHours` is the same shape. Overlap is scored
 * as the fraction of the activity's window that falls inside the user's, so a
 * drop-in open all day always fits and a fixed 19:00 class does not fit
 * someone only free in the morning.
 */
export function timeOfDayFitScore(activity, userContext) {
  const w = activity.timeWindow;
  const avail = userContext.availableHours;
  if (!w || !Number.isFinite(w.startHour) || !Number.isFinite(w.endHour)) return TIME_UNKNOWN_FIT;
  if (!avail || !Number.isFinite(avail.startHour) || !Number.isFinite(avail.endHour)) return TIME_UNKNOWN_FIT;
  const aStart = w.startHour;
  const aEnd = w.endHour > w.startHour ? w.endHour : w.startHour + 1;
  const uStart = avail.startHour;
  const uEnd = avail.endHour > avail.startHour ? avail.endHour : avail.startHour + 1;
  const overlap = Math.max(0, Math.min(aEnd, uEnd) - Math.max(aStart, uStart));
  const span = aEnd - aStart;
  return span <= 0 ? TIME_UNKNOWN_FIT : clamp(overlap / span, 0, 1);
}

/**
 * Indoor/outdoor fit.
 *
 * Base: match against the user's stated preference ('indoor' | 'outdoor' |
 * 'any'). One state-conditional rule on top: when the latent affect reading
 * puts the user in the AGITATED quadrant (arousal high, dominance low), an
 * outdoor/green-space option gets a bounded bonus, because that is the state
 * green and blue space have the clearest evidence for. The rule fires only
 * when there IS an affect reading; with none it is inert.
 */
export const AGITATION_AROUSAL_FLOOR = 0.2;
export const AGITATION_DOMINANCE_CEILING = -0.1;
export const GREEN_SPACE_BONUS = 0.25;

export function settingFitScore(activity, userContext) {
  const pref = userContext.settingPreference ?? "any";
  let base;
  if (pref === "indoor") base = activity.indoor ? 1 : 0.3;
  else if (pref === "outdoor") base = activity.outdoor ? 1 : 0.3;
  else base = 0.7;

  const vad = userContext.vad;
  const agitated = vad
    && Number.isFinite(vad.arousal) && Number.isFinite(vad.dominance)
    && vad.arousal >= AGITATION_AROUSAL_FLOOR
    && vad.dominance <= AGITATION_DOMINANCE_CEILING;
  if (agitated && (activity.outdoor || activity.evidenceCategory === EVIDENCE_CATEGORY.GREEN_BLUE_SPACE)) {
    base += GREEN_SPACE_BONUS;
  }
  return clamp(base, 0, 1);
}

/**
 * Category-level novelty: has the user done this CATEGORY recently? Category
 * rather than activity id, because "something different" means a different
 * kind of thing, not a different park.
 */
export function noveltyScore(activity, userContext) {
  const recentCategories = userContext.recentCategories;
  if (!recentCategories) return 0.5; // unknown: neither novel nor stale
  const list = recentCategories instanceof Set ? [...recentCategories] : recentCategories;
  return list.includes(activity.evidenceCategory) ? 0 : 1;
}

/** Recency penalty on the same ACTIVITY. Never a penalty on the user. */
export function recencyPenalty(activity, userContext) {
  const recent = userContext.recentActivityIds;
  const seenRecently = recent instanceof Set ? recent.has(activity.id) : Array.isArray(recent) && recent.includes(activity.id);
  return seenRecently ? 1 : 0;
}

/** Deterministic per-(activity, salt) value in [0,1), tie-break use only. */
export function tieBreak(activity, seedSalt = "") {
  const str = `${activity.id ?? ""}:${seedSalt}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

/**
 * The exploration bonus described in section 3.
 * `userContext.stateConfidence` is the analysis layer's `confidence`; when it
 * is absent the bonus falls back to a moderate uncertainty so a caller that
 * has not wired the state through still gets variety rather than false
 * certainty.
 */
export const DEFAULT_STATE_CONFIDENCE = 0.35;

export function explorationBonus(activity, userContext) {
  const confidence = Number.isFinite(userContext.stateConfidence)
    ? clamp(userContext.stateConfidence, 0, 1)
    : DEFAULT_STATE_CONFIDENCE;
  const uncertainty = 1 - confidence;
  const depletion = DEPLETION[userContext.capacityBand] ?? 0.3;
  const unfamiliarity = noveltyScore(activity, userContext);
  return clamp(uncertainty * (1 - depletion) * unfamiliarity, 0, 1);
}

/**
 * Full utility for one activity given a user context. Returns
 * { activity, eligible, reasons, score, breakdown }. `score` is null when the
 * activity failed a hard filter — callers must treat that as "never show
 * this", not as a low score.
 */
export function scoreActivity(activity, userContext, { noveltySalt = "" } = {}) {
  const elig = isEligible(activity, userContext);
  if (!elig.eligible) {
    return { activity, eligible: false, reasons: elig.reasons, score: null };
  }

  const features = {
    energyFit: energyFitScore(activity, userContext),
    socialFit: socialFitScore(activity, userContext),
    evidence: evidenceScore(activity, userContext),
    travelFit: travelFitScore(activity, userContext),
    timeOfDayFit: timeOfDayFitScore(activity, userContext),
    settingFit: settingFitScore(activity, userContext),
    novelty: noveltyScore(activity, userContext),
  };

  let base = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) base += weight * features[key];

  const recency = recencyPenalty(activity, userContext);
  const exploration = explorationBonus(activity, userContext);
  const tie = tieBreak(activity, noveltySalt);

  const score =
    base
    - RECENCY_WEIGHT * recency
    + EXPLORATION_WEIGHT * exploration
    + TIE_BREAK_WEIGHT * tie;

  return {
    activity,
    eligible: true,
    reasons: [],
    score,
    breakdown: {
      ...features,
      base,
      recencyPenalty: recency,
      exploration,
      tieBreak: tie,
      weights: WEIGHTS,
      weightsVersion: RECOMMENDER_WEIGHTS_VERSION,
    },
  };
}
