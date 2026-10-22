/**
 * cold-start.js
 *
 * Bayesian shrinkage toward population priors (docs/backend/01, section 4)
 * plus the explicit day-count gates from section 4.3, expressed as data
 * (one lookup table) rather than scattered if-statements.
 */

// Normal-normal hierarchy defaults (doc section 4.1).
export const POPULATION_PRIOR = Object.freeze({
  mean: 10.5,     // mu_0: the 0-21 scale midpoint, which is also where checkin-scoring.js
                  // places theta = 0 (SCORE_MID). Keeping the two priors at the same
                  // point is what stops a user who answers exactly at the population
                  // mean from being shrunk anywhere at all.
  tauUser: 2.5,   // real between-person variation in personal baseline
  sigma: 3,       // within-person day-to-day observation noise
});

/**
 * Closed-form normal-normal conjugate update: the posterior mean for a user
 * after `n` observations with sample mean `sampleMean` is a precision-
 * weighted average of the population prior and the user's own data.
 *
 *   mu_u_hat = ( (n/sigma^2)*xbar + (1/tauUser^2)*mu_pop )
 *              / ( n/sigma^2 + 1/tauUser^2 )
 *
 * Also returns `shrinkageWeight`, the fraction of the estimate coming from
 * the user's own data (0 = pure population prior, 1 = pure sample mean).
 * This is the number that goes into wellbeing_metrics.shrinkage_weight.
 */
export function shrinkEstimate({ n, sampleMean, prior = POPULATION_PRIOR }) {
  const { mean: muPop, tauUser, sigma } = prior;

  if (!Number.isFinite(n) || n <= 0) {
    return { estimate: muPop, shrinkageWeight: 0, n: 0 };
  }

  const ownPrecision = n / (sigma * sigma);
  const priorPrecision = 1 / (tauUser * tauUser);
  const totalPrecision = ownPrecision + priorPrecision;

  const estimate = (ownPrecision * sampleMean + priorPrecision * muPop) / totalPrecision;
  const shrinkageWeight = ownPrecision / totalPrecision;

  return { estimate, shrinkageWeight, n };
}

/**
 * The same shrinkage logic applied to any other per-user statistic with few
 * observations (doc section 4.2: volatility, trend slope, dimension scores).
 * Never report an unshrunk per-user statistic from < 5 observations under a
 * label that sounds like a measurement.
 */
export function shrinkStatistic({ n, sampleValue, populationValue, tauUser, sigma }) {
  return shrinkEstimate({
    n,
    sampleMean: sampleValue,
    prior: { mean: populationValue, tauUser, sigma },
  });
}

/**
 * The day-count gating table from doc section 4.3, as data. Every generated
 * insight that references trend, comparison, "usual", or change reads this
 * table rather than hand-rolled if/else chains — the single highest-leverage
 * fix in the source document for not being presumptuous in week one.
 *
 * `minCheckins` is a hard floor, not a suggestion (doc section 7, rule 3).
 */
export const GATE_THRESHOLDS = Object.freeze({
  anyAcknowledgement: 1,   // day 1: acknowledge today's entry only, no comparison of any kind
  provisionalBaseline: 2,  // 2-4: population-shrunk estimate, framed as provisional
  personalBaseline: 5,     // 5-6: "compared to how you've been" language becomes defensible
  trend: 7,                // one full week: weekly summary + CUSUM accumulation becomes honest
  weeklySummary: 7,
  roughPatch: 14,          // "rough patch" / regime language, per the task's explicit instruction
  regimeLanguage: 14,      // HMM regime claims (doc section 3.4) get 2 transition opportunities
  changepointTriggered: 7, // CUSUM can accumulate from day 1 but is calibrated not to fire before this
  fullFeatureSet: 30,      // trend slope + volatility + regime + changepoint all on person-specific stats
});

/**
 * Evaluates every gate against a single check-in count, returning a flat set
 * of booleans plus the count itself. This is the only place gate logic
 * lives — callers branch on the returned flags, they never re-derive a
 * threshold inline.
 */
export function evaluateGates(checkinCount) {
  const n = Number.isFinite(checkinCount) ? checkinCount : 0;
  const flags = {};
  for (const [key, threshold] of Object.entries(GATE_THRESHOLDS)) {
    flags[key] = n >= threshold;
  }
  return {
    checkinCount: n,
    ...flags,
    // No entry at all yet: the system has nothing to acknowledge either.
    sayNothing: n < GATE_THRESHOLDS.anyAcknowledgement,
  };
}
