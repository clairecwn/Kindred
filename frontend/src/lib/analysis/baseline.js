/**
 * baseline.js
 *
 * THE DRIFT TRAP FIX (docs/backend/01-statistics-and-modelling.md, esp.
 * section 3.1 and the "smooth quarter-long decline" problem it implies).
 *
 * A single EWMA baseline used as its own reference point for a personal
 * z-score has a structural blind spot: because the baseline is updated with
 * every new observation, it continuously re-anchors to wherever the user
 * currently is. A slow, steady decline of a few hundredths of a point per
 * day produces a tiny residual (x_t - mu_{t-1}) at every single step, so the
 * z-score never crosses any reasonable threshold, even though the total
 * drift over a quarter can be large. See __tests__/baseline.test.js for a
 * simulation proving exactly this.
 *
 * The fix: maintain TWO EWMA baselines at different timescales and watch the
 * gap between them, which a single re-anchoring baseline cannot reveal.
 */

// Fast baseline: alpha = 0.20 -> half-life = ln(0.5)/ln(1-0.20) ~= 3.1 days.
// Tracks "where the user actually is right now", forgetting a single unusual
// day within about 3-4 days.
export const FAST_ALPHA = 0.20;
export const FAST_HALF_LIFE_DAYS = Math.log(0.5) / Math.log(1 - FAST_ALPHA);

// Slow baseline: alpha = 0.02 -> half-life = ln(0.5)/ln(1-0.02) ~= 34.3 days.
// Tracks "what has felt normal this quarter", intentionally sluggish so a
// multi-week decline shows up as a gap against it rather than being absorbed.
export const SLOW_ALPHA = 0.02;
export const SLOW_HALF_LIFE_DAYS = Math.log(0.5) / Math.log(1 - SLOW_ALPHA);

// Personal z-score denominator floor (doc section 3.2), on the 0-21 scale.
export const SIGMA_FLOOR = 1.5;

// A drift (fast - slow) beyond this many points is treated as a real,
// sustained separation between "now" and "this quarter's normal" — chosen as
// roughly one SIGMA_FLOOR unit, i.e. the smallest gap that would itself be
// z-score-significant if the two baselines were compared as if independent.
export const DRIFT_SIGNAL_THRESHOLD = 1.5;

// CUSUM allowance/limit as multiples of the running SD (doc section 3.5,
// Page 1954's standard SPC choice): k = 0.5*sigma avoids flagging pure
// noise, h = 4*sigma balances false-alarm rate against detection delay.
export const CUSUM_K_FACTOR = 0.5;
export const CUSUM_H_FACTOR = 4.0;

// When a changepoint fires, the fast baseline's effective history is reset:
// its variance is widened by this factor and its effective sample count
// drops to RESET_EFFECTIVE_N, so the next few observations are trusted
// close to fully (mimicking "starting a fresh EWMA") rather than being
// smoothed against a baseline that describes a regime that just ended.
export const RESET_VARIANCE_WIDEN_FACTOR = 4;
export const RESET_EFFECTIVE_N = 1;

/** Effective alpha for a gap of `dtDays` days, so a multi-day gap is treated
 * as that many compounded daily updates rather than one same-weight update. */
function effectiveAlpha(alpha, dtDays) {
  const dt = Math.max(dtDays, 0);
  return 1 - Math.pow(1 - alpha, dt);
}

/**
 * Fresh baseline state. `priorMean` seeds both baselines (population mean or
 * a cold-start shrunk estimate — see cold-start.js).
 */
export function createBaselineState(priorMean) {
  return {
    fastMean: priorMean,
    slowMean: priorMean,
    fastVar: 0,
    slowVar: 0,
    fastN: 0, // effective sample count since last reset, for adaptive alpha
    cusumPos: 0,
    cusumNeg: 0,
  };
}

/**
 * Advance the baseline state by one observation.
 *
 * @param {object} state  - previous createBaselineState()/updateBaseline() result.
 * @param {number} x      - today's observation.
 * @param {number} dtDays - days since the previous observation (>= 0, use 1 for daily).
 * @returns {object} new state plus this step's signals: personalZ (using the
 *   PRE-update fast baseline, per doc 3.2's t-1 rule), driftSignal,
 *   changepointFlag ('up' | 'down' | null).
 */
export function updateBaseline(state, x, dtDays = 1) {
  const prevFastMean = state.fastMean;
  const prevFastVar = state.fastVar;

  // Personal z-score computed against the *pre-update* fast baseline so
  // today's score is compared to what was already known (doc section 3.2).
  const sigma = Math.max(Math.sqrt(prevFastVar), SIGMA_FLOOR);
  const personalZ = (x - prevFastMean) / sigma;

  // Adaptive alpha near a reset: early observations after a reset get close
  // to full weight (1/(n+1)) and converge to FAST_ALPHA as the effective
  // history grows, exactly the "widened initial variance" behaviour a fresh
  // EWMA would have.
  const nBasedAlpha = 1 / (state.fastN + 1);
  const fastAlphaEff = effectiveAlpha(Math.max(FAST_ALPHA, nBasedAlpha), dtDays);
  const slowAlphaEff = effectiveAlpha(SLOW_ALPHA, dtDays);

  const fastDev = x - prevFastMean;
  const fastMean = fastAlphaEff * x + (1 - fastAlphaEff) * prevFastMean;
  const fastVar = fastAlphaEff * fastDev * fastDev + (1 - fastAlphaEff) * prevFastVar;

  const slowDev = x - state.slowMean;
  const slowMean = slowAlphaEff * x + (1 - slowAlphaEff) * state.slowMean;
  const slowVar = slowAlphaEff * slowDev * slowDev + (1 - slowAlphaEff) * state.slowVar;

  const driftSignal = fastMean - slowMean;

  // CUSUM, run against the slow baseline (the "normal" the day is compared
  // to) using the fast baseline's SD as the process sigma estimate.
  //
  // The reference value mu_0 is the slow mean BEFORE this observation was
  // absorbed. Using the post-update slow mean (what this used to do) lets
  // each observation shift its own reference point by alpha_slow toward
  // itself, which cancels part of the very deviation the chart is trying to
  // accumulate and delays detection of exactly the slow drift this module
  // exists to catch.
  const cusumSigma = Math.max(Math.sqrt(fastVar), SIGMA_FLOOR);
  const k = CUSUM_K_FACTOR * cusumSigma;
  const h = CUSUM_H_FACTOR * cusumSigma;
  const referenceMean = state.slowMean;
  const cusumPos = Math.max(0, state.cusumPos + (x - referenceMean - k));
  const cusumNeg = Math.max(0, state.cusumNeg - (x - referenceMean + k));

  let changepointFlag = null;
  let nextCusumPos = cusumPos;
  let nextCusumNeg = cusumNeg;
  let nextFastMean = fastMean;
  let nextFastVar = fastVar;
  let nextFastN = state.fastN + 1;

  if (cusumPos > h) {
    changepointFlag = "up";
    nextCusumPos = 0;
    nextFastVar = fastVar * RESET_VARIANCE_WIDEN_FACTOR;
    nextFastN = RESET_EFFECTIVE_N;
  } else if (cusumNeg > h) {
    changepointFlag = "down";
    nextCusumNeg = 0;
    nextFastVar = fastVar * RESET_VARIANCE_WIDEN_FACTOR;
    nextFastN = RESET_EFFECTIVE_N;
  }

  return {
    state: {
      fastMean: nextFastMean,
      slowMean,
      fastVar: nextFastVar,
      slowVar,
      fastN: nextFastN,
      cusumPos: nextCusumPos,
      cusumNeg: nextCusumNeg,
    },
    personalZ,
    cusumH: h,
    cusumK: k,
    driftSignal,
    driftSignificant: Math.abs(driftSignal) >= DRIFT_SIGNAL_THRESHOLD,
    changepointFlag,
  };
}

/**
 * Replays a full history through updateBaseline, returning the final state
 * plus the per-step signal series. `history` is an array of
 * { date: Date|string, value: number }, sorted ascending.
 */
export function runBaseline(history, priorMean) {
  if (!Array.isArray(history) || history.length === 0) {
    return { state: createBaselineState(priorMean ?? 0), steps: [] };
  }
  let state = createBaselineState(priorMean ?? history[0].value);
  let prevDate = toDate(history[0].date);
  const steps = [];

  history.forEach((point, i) => {
    const date = toDate(point.date);
    const rawDt = i === 0 ? 1 : daysBetween(prevDate, date);
    const dtDays = Number.isFinite(rawDt) && rawDt > 0 ? rawDt : 1e-6;
    const result = updateBaseline(state, point.value, dtDays);
    state = result.state;
    steps.push({ date, ...result });
    prevDate = date;
  });

  return { state, steps };
}

/**
 * OLS trend slope with a 95% confidence interval over a trailing calendar
 * window (doc section 6.3). `history` is [{ date, value }], `windowDays` is
 * the trailing window (28 or 90 — call twice for both, per doc section 4).
 * `asOf` defaults to the last history date.
 *
 * Display rule enforced by the caller (index.js / cold-start.js gates): only
 * treat this as a directional claim when the CI excludes zero.
 */
export function trendSlope(history, windowDays, asOf) {
  if (!Array.isArray(history) || history.length === 0) return insufficientTrend();

  const asOfDate = toDate(asOf ?? history[history.length - 1].date);
  const windowStart = new Date(asOfDate.getTime() - windowDays * 86400000);
  const points = history
    .map((p) => ({ date: toDate(p.date), value: p.value }))
    .filter((p) => p.date >= windowStart && p.date <= asOfDate)
    .sort((a, b) => a.date - b.date);

  const n = points.length;
  if (n < 3) return insufficientTrend(n);

  const t = points.map((p) => daysBetween(windowStart, p.date));
  const y = points.map((p) => p.value);
  const tBar = mean(t);
  const yBar = mean(y);

  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i += 1) {
    sxx += (t[i] - tBar) ** 2;
    sxy += (t[i] - tBar) * (y[i] - yBar);
  }
  if (sxx === 0) return insufficientTrend(n);

  const slope = sxy / sxx;
  const intercept = yBar - slope * tBar;
  let ssRes = 0;
  for (let i = 0; i < n; i += 1) {
    const resid = y[i] - (intercept + slope * t[i]);
    ssRes += resid * resid;
  }
  const dof = n - 2;
  if (dof <= 0) return insufficientTrend(n);

  const sigmaResidSq = ssRes / dof;
  const se = Math.sqrt(sigmaResidSq / sxx);
  const tCrit = studentTCritical95(dof);
  const ci = [slope - tCrit * se, slope + tCrit * se];
  const excludesZero = ci[0] > 0 || ci[1] < 0;

  return {
    windowDays,
    n,
    slope,
    se,
    ci95: ci,
    direction: excludesZero ? (slope > 0 ? "up" : "down") : "steady",
    sufficientData: true,
  };
}

function insufficientTrend(n = 0) {
  return { n, slope: null, se: null, ci95: null, direction: "insufficient_data", sufficientData: false };
}

// 95% two-tailed critical values for small degrees of freedom, falling back
// to the normal approximation (1.96) once dof is large (n >= ~30, per doc).
const T_TABLE_95 = { 1: 12.71, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 15: 2.131, 20: 2.086, 25: 2.060, 30: 2.042 };
function studentTCritical95(dof) {
  if (dof >= 30) return 1.96;
  const keys = Object.keys(T_TABLE_95).map(Number).sort((a, b) => a - b);
  for (const k of keys) if (dof <= k) return T_TABLE_95[k];
  return 1.96;
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function toDate(d) {
  return d instanceof Date ? d : new Date(d);
}

function daysBetween(a, b) {
  return (b.getTime() - a.getTime()) / 86400000;
}
