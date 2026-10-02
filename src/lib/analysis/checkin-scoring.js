/**
 * checkin-scoring.js
 *
 * TURNING THE 7-QUESTION DAILY CHECK-IN INTO A NUMBER WITH A MODEL BEHIND IT.
 *
 * ===========================================================================
 * 0. THE BUG THIS FILE USED TO CONTAIN
 * ===========================================================================
 * The previous version advertised a "graded-response-style transform" next to
 * a plain weighted sum, as if they were two different views of the data. They
 * were not. With category thetas fixed at [-1.5, -0.5, 0.5, 1.5] the category
 * map is theta_k = k - 1.5, exactly linear in k, so
 *
 *   graded = 10.5 + 7·Σ a_j (x_j - 1.5) / Σ a_j
 *          = 7·Σ a_j x_j / Σ a_j
 *          = weighted
 *
 * identically, for every possible response pattern. Two names, one number,
 * and an IRT label on something that was not IRT. That is the "ad-hoc
 * heuristic dressed as a model" case, so it has been replaced with an actual
 * graded response model that is genuinely non-linear and, more usefully,
 * reports its own standard error.
 *
 * ===========================================================================
 * 1. THE MODEL
 * ===========================================================================
 * Samejima's (1969) Graded Response Model. Item j has C = 4 ordered
 * categories (the 0-3 answers), discrimination a_j, and C-1 = 3 category
 * boundaries b_j1 < b_j2 < b_j3. The probability of answering AT OR ABOVE
 * category k is a 2PL curve:
 *
 *     P*_jk(theta) = P(X_j >= k | theta) = 1 / (1 + exp(-a_j (theta - b_jk)))
 *     P*_j0 = 1,   P*_jC = 0
 *     P(X_j = k | theta) = P*_jk(theta) - P*_j,k+1(theta)
 *
 * theta is the latent wellbeing level, standardised so the population is mean
 * 0, SD 1. The estimator is the BAYES MODAL (MAP) one, not plain ML:
 *
 *     theta_hat = argmax_theta [ Σ_j log P(X_j = x_j | theta) - theta²/2 ]
 *
 * The -theta²/2 term is the log of the N(0,1) population prior. It is there
 * because the plain ML estimate is UNDEFINED (it diverges to ±∞) for the two
 * response patterns a daily check-in produces most often at the extremes —
 * all 0s and all 3s — since every category curve is still rising out there.
 * A model that returns ±∞ on "I answered everything the same" is not usable,
 * and clamping the divergence at an arbitrary bound (what the first attempt
 * here did) just hides it. MAP is the standard fix and is consistent with the
 * rest of this system: cold-start.js shrinks a user's MEAN toward the same
 * population prior, and this shrinks a single OBSERVATION toward it.
 *
 * The estimate is found by a fixed grid search over [THETA_MIN, THETA_MAX] at
 * GRID_STEP, refined by one parabolic interpolation on the three best grid
 * points. Grid search rather than Newton because it cannot diverge, cannot
 * depend on a starting value, and is bit-for-bit reproducible — the point of
 * the exercise.
 *
 * Standard error comes from the observed information of the log-posterior,
 * evaluated by a central second difference at theta_hat:
 *
 *     I(theta_hat) = -d²/dtheta² log posterior,   SE(theta_hat) = 1/sqrt(I)
 *
 * Because the prior contributes +1 to the information, SE <= 1 always, and
 * SE is largest exactly where the data is least informative — extreme
 * patterns and partial check-ins. That SE is what makes the observation
 * noise R below honest rather than a constant guess.
 *
 * The cost of MAP is a known shrinkage bias toward 0 on extreme patterns: an
 * all-3s day scores below the top of the display scale. That is deliberate.
 * A single perfect answer sheet is weak evidence of an extreme latent state,
 * and reporting it as 21/21 would be exactly the invented precision this
 * model exists to remove.
 *
 * Display scale. theta is mapped to the familiar 0-21 scale by
 *
 *     score = SCORE_MID + POINTS_PER_THETA · theta,   clamped to [0, 21]
 *
 * with POINTS_PER_THETA = 3.5, so ±3 SD spans the full scale. The same factor
 * converts SE(theta) into SE in points, which is what state-filter.js wants
 * as its observation noise R.
 *
 * Units. Raw items: integers 0-3, unitless ordinal categories. theta: latent
 * SD units. score/SE: points on the 0-21 wellbeing scale.
 *
 * ===========================================================================
 * 2. WHERE THE PARAMETERS COME FROM (AND WHAT IS STILL PROVISIONAL)
 * ===========================================================================
 * a_j (ITEM_WEIGHTS): provisional. A real GRM fit needs ~200-300 respondents.
 *   Until then a_j is the judged centrality of the item to hedonic wellbeing,
 *   used as a discrimination proxy — items judged most central are assumed
 *   most discriminating. Values are deliberately in a narrow band (0.7-1.1)
 *   so the provisional ordering cannot dominate the result.
 *
 * b_jk (CATEGORY_BOUNDARIES): provisional, shared across items, and
 *   deliberately ASYMMETRIC: [-1.35, -0.15, 1.15]. The gap between "bottom
 *   category" and "second category" is wider than between the top two,
 *   encoding the floor effect these scales have in practice — the distance
 *   between "drained" and "low but going" is a bigger move than between
 *   "steady" and "energized". A symmetric, evenly spaced set is exactly what
 *   collapsed the old model into a linear sum.
 *
 * Both are exported, frozen, and replaceable by a fitted set without touching
 * any calling code; scoringModelVersion in the result records which was used.
 *
 * ===========================================================================
 * 3. WHAT IS KEPT
 * ===========================================================================
 * weightedSum() stays, unchanged in meaning, and is still returned by
 * scoreCheckin() as `weighted`. It is the model-free number: no IRT
 * assumptions, no fitted parameters, trivially explainable to a user. When
 * the GRM and the weighted sum disagree materially that is information, not
 * noise, so both are always reported and the raw sum is never discarded.
 */

// Provisional discrimination parameters a_j. See section 2.
export const ITEM_WEIGHTS = Object.freeze({
  mood: 1.1,
  meaning: 1.0,
  connection: 1.0,
  accomplishment: 1.0,
  energy: 0.9,
  resilience: 0.8,
  sleep: 0.7,
});

const WEIGHT_SUM = Object.values(ITEM_WEIGHTS).reduce((a, b) => a + b, 0); // 6.5
const RAW_SCORE_MIN = 0;
const RAW_SCORE_MAX = 3;

export const SCORE_MIN = 0;
export const SCORE_MAX = 21;
export const SCORE_MID = (SCORE_MIN + SCORE_MAX) / 2; // 10.5

/** Category boundaries b_jk, shared across items for v1. See section 2. */
export const CATEGORY_BOUNDARIES = Object.freeze([-1.35, -0.15, 1.15]);

/** theta -> points on the 0-21 scale. +-3 SD spans the scale. */
export const POINTS_PER_THETA = SCORE_MAX / 2 / 3; // 3.5

// Grid search bounds. The N(0,1) prior makes the posterior mode finite well
// inside these, so they are a safety rail rather than a working constraint.
export const THETA_MIN = -3.5;
export const THETA_MAX = 3.5;
export const GRID_STEP = 0.01;

/**
 * Floor on the observation variance handed to the filter, in points².
 * The GRM SE captures only sampling error *given the model*: how precisely
 * this response pattern locates theta. It does not capture occasion noise —
 * the same person on the same day answering slightly differently depending on
 * when they were asked. Test-retest figures for short self-report wellbeing
 * scales put that at roughly SD 1.5 points, so the variance floor is 1.5².
 * R_t = SE_points² + R_OCCASION_FLOOR is what state-filter.js should use.
 */
export const R_OCCASION_FLOOR = 2.25;

const RESCALE_FACTOR = SCORE_MAX / (WEIGHT_SUM * RAW_SCORE_MAX); // 21 / 19.5
export { RESCALE_FACTOR };

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function sigmoid(z) {
  // Numerically stable for large |z|.
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

/**
 * Model-free weighted sum on the 0-21 scale. `itemScores` is
 * { itemKey: rawScore0to3, ... }. Missing items are handled by rescaling
 * against the weight actually observed, so a partial check-in is not silently
 * scored as if the missing items were 0.
 */
export function weightedSum(itemScores) {
  if (!itemScores || typeof itemScores !== "object") return null;
  let sum = 0;
  let weightSeen = 0;
  for (const [key, weight] of Object.entries(ITEM_WEIGHTS)) {
    const raw = itemScores[key];
    if (!Number.isFinite(raw)) continue;
    sum += weight * clamp(raw, RAW_SCORE_MIN, RAW_SCORE_MAX);
    weightSeen += weight;
  }
  if (weightSeen === 0) return null;
  const observedMax = weightSeen * RAW_SCORE_MAX;
  return (sum * SCORE_MAX) / observedMax;
}

// ---------------------------------------------------------------------------
// The graded response model.
// ---------------------------------------------------------------------------

/**
 * P(X_j = k | theta) for one item under the GRM. `k` is 0..3.
 * Returns a probability floored at 1e-12 so log-likelihood never hits -Inf.
 */
export function categoryProbability(k, theta, a, boundaries = CATEGORY_BOUNDARIES) {
  const above = (kk) => {
    if (kk <= 0) return 1;
    if (kk > boundaries.length) return 0;
    return sigmoid(a * (theta - boundaries[kk - 1]));
  };
  return Math.max(above(k) - above(k + 1), 1e-12);
}

/** Population prior on theta: N(PRIOR_MEAN, PRIOR_SD²). See section 1. */
export const PRIOR_MEAN = 0;
export const PRIOR_SD = 1;

/** Log-likelihood of a whole response pattern at a given theta. */
export function logLikelihood(itemScores, theta, boundaries = CATEGORY_BOUNDARIES) {
  let ll = 0;
  for (const [key, a] of Object.entries(ITEM_WEIGHTS)) {
    const raw = itemScores[key];
    if (!Number.isFinite(raw)) continue;
    const k = clamp(Math.round(raw), 0, CATEGORY_BOUNDARIES.length);
    ll += Math.log(categoryProbability(k, theta, a, boundaries));
  }
  return ll;
}

/** Log-posterior = log-likelihood + log N(theta; PRIOR_MEAN, PRIOR_SD²), up
 *  to an additive constant that does not affect the argmax or the curvature. */
export function logPosterior(itemScores, theta, boundaries = CATEGORY_BOUNDARIES) {
  const z = (theta - PRIOR_MEAN) / PRIOR_SD;
  return logLikelihood(itemScores, theta, boundaries) - 0.5 * z * z;
}

/**
 * Bayes-modal (MAP) theta for a response pattern, plus its standard error.
 * Deterministic: fixed grid, fixed refinement, no starting value, no RNG.
 *
 * @returns {{theta:number, se:number, itemsUsed:number, atBound:boolean}|null}
 */
export function gradedResponseTheta(itemScores) {
  if (!itemScores || typeof itemScores !== "object") return null;
  const itemsUsed = Object.keys(ITEM_WEIGHTS).filter((k) => Number.isFinite(itemScores[k])).length;
  if (itemsUsed === 0) return null;

  // 1. Grid search.
  let bestTheta = THETA_MIN;
  let bestLL = -Infinity;
  const steps = Math.round((THETA_MAX - THETA_MIN) / GRID_STEP);
  for (let i = 0; i <= steps; i += 1) {
    const theta = THETA_MIN + i * GRID_STEP;
    const ll = logPosterior(itemScores, theta);
    if (ll > bestLL) { bestLL = ll; bestTheta = theta; }
  }

  // 2. One parabolic refinement through the three points around the maximum,
  //    which removes the grid's 0.005 quantisation without an iterative solve.
  const atBound = bestTheta <= THETA_MIN + GRID_STEP || bestTheta >= THETA_MAX - GRID_STEP;
  let theta = bestTheta;
  if (!atBound) {
    const l0 = logPosterior(itemScores, bestTheta - GRID_STEP);
    const l1 = bestLL;
    const l2 = logPosterior(itemScores, bestTheta + GRID_STEP);
    const denom = l0 - 2 * l1 + l2;
    if (denom < 0) {
      const shift = (0.5 * (l0 - l2)) / denom;
      if (Number.isFinite(shift) && Math.abs(shift) <= 1) theta = bestTheta + shift * GRID_STEP;
    }
  }

  // 3. Observed information by central second difference. h is large enough
  //    that the difference is numerically stable in double precision and
  //    small enough that the quadratic approximation holds.
  const h = 0.05;
  const lm = logPosterior(itemScores, theta - h);
  const l0 = logPosterior(itemScores, theta);
  const lp = logPosterior(itemScores, theta + h);
  const secondDeriv = (lp - 2 * l0 + lm) / (h * h);
  const information = -secondDeriv;
  const se = information > 1e-9 ? 1 / Math.sqrt(information) : (THETA_MAX - THETA_MIN) / 2;

  return { theta: clamp(theta, THETA_MIN, THETA_MAX), se, itemsUsed, atBound };
}

/** theta (and its SE) mapped onto the 0-21 display scale. */
export function gradedResponseScore(itemScores) {
  const fit = gradedResponseTheta(itemScores);
  if (!fit) return null;
  return clamp(SCORE_MID + POINTS_PER_THETA * fit.theta, SCORE_MIN, SCORE_MAX);
}

/**
 * Bands, derived from the scoring model's own [SCORE_MIN, SCORE_MAX] range
 * rather than hardcoded literals. The proportions themselves are a
 * provisional, hand-chosen placeholder (asymmetric on purpose: "Flourishing"
 * should be a real minority state early on, matching how PHQ-9's own
 * severity bands are not evenly spaced) — replace with empirical population
 * quantiles once >= 500 check-ins exist, recomputed quarterly so bands don't
 * silently drift week to week.
 */
export const PROVISIONAL_BAND_PROPORTIONS = Object.freeze({
  strugglingMax: 0.33, // provisional until n >= 500: replace with the empirical 20th percentile
  navigatingMax: 0.70, // provisional until n >= 500: replace with the empirical 70th percentile
});

export const PROVISIONAL_BAND_CUTOFFS = Object.freeze({
  strugglingMax: SCORE_MIN + PROVISIONAL_BAND_PROPORTIONS.strugglingMax * (SCORE_MAX - SCORE_MIN),
  navigatingMax: SCORE_MIN + PROVISIONAL_BAND_PROPORTIONS.navigatingMax * (SCORE_MAX - SCORE_MIN),
});

export function scoreToBand(score) {
  if (score == null || !Number.isFinite(score)) return null;
  if (score <= PROVISIONAL_BAND_CUTOFFS.strugglingMax) return "struggling";
  if (score <= PROVISIONAL_BAND_CUTOFFS.navigatingMax) return "navigating";
  return "flourishing";
}

/**
 * Cronbach's alpha across a matrix of historical check-ins. `itemMatrix` is
 * an array of itemScores objects (one per check-in). Assumes tau-equivalence
 * (every item loads equally); report it because it's expected, but prefer
 * McDonald's omega for actual decisions once a factor model is available.
 * Returns null when there isn't enough data to compute a meaningful variance.
 */
export function cronbachAlpha(itemMatrix) {
  const keys = Object.keys(ITEM_WEIGHTS);
  const rows = (itemMatrix ?? []).filter((row) => row && keys.every((k) => Number.isFinite(row[k])));
  const k = keys.length;
  if (rows.length < 2 || k < 2) return null;

  const itemVariances = keys.map((key) => variance(rows.map((r) => r[key])));
  const totalScores = rows.map((r) => keys.reduce((sum, key) => sum + r[key], 0));
  const totalVariance = variance(totalScores);
  if (totalVariance === 0) return null;

  const sumItemVar = itemVariances.reduce((a, b) => a + b, 0);
  return (k / (k - 1)) * (1 - sumItemVar / totalVariance);
}

function variance(values) {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
}

/**
 * The single entry point most callers want.
 *
 * Return shape is unchanged from the previous version — { raw, itemsAnswered,
 * itemsExpected, weighted, graded, band, scoringModelVersion } — with
 * `theta`, `thetaSE`, `scoreSE` and `observationVariance` added. Callers that
 * only read `graded` and `band` need no change.
 */
export function scoreCheckin(itemScores) {
  const keys = Object.keys(ITEM_WEIGHTS);
  if (!itemScores || typeof itemScores !== "object") {
    return {
      raw: 0, itemsAnswered: 0, itemsExpected: keys.length,
      weighted: null, graded: null, theta: null, thetaSE: null,
      scoreSE: null, observationVariance: null, band: null,
      scoringModelVersion: SCORING_MODEL_VERSION,
    };
  }
  const present = keys.filter((k) => Number.isFinite(itemScores[k]));
  const raw = present.reduce((sum, k) => sum + clamp(itemScores[k], RAW_SCORE_MIN, RAW_SCORE_MAX), 0);
  const weighted = weightedSum(itemScores);
  const fit = gradedResponseTheta(itemScores);
  const graded = fit ? clamp(SCORE_MID + POINTS_PER_THETA * fit.theta, SCORE_MIN, SCORE_MAX) : null;
  const scoreSE = fit ? POINTS_PER_THETA * fit.se : null;

  return {
    raw,
    itemsAnswered: present.length,
    itemsExpected: keys.length,
    weighted,
    graded,
    theta: fit ? fit.theta : null,
    thetaSE: fit ? fit.se : null,
    scoreSE,
    // What state-filter.js should use as R for this observation: the model's
    // own measurement variance plus the occasion-noise floor. See the
    // R_OCCASION_FLOOR note above.
    observationVariance: scoreSE == null ? null : scoreSE * scoreSE + R_OCCASION_FLOOR,
    band: scoreToBand(graded ?? weighted),
    scoringModelVersion: SCORING_MODEL_VERSION,
  };
}

export const SCORING_MODEL_VERSION = "grm-v1-provisional-params";
