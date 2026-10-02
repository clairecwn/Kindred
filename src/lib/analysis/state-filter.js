/**
 * state-filter.js
 *
 * Latent mood state estimation via a continuous-time Ornstein-Uhlenbeck (OU)
 * process observed with noise, filtered with the matching continuous-time
 * Kalman filter. See docs/backend/01-statistics-and-modelling.md section 3.3.
 *
 * A plain discrete-time local-level Kalman filter (theta_t = theta_t-1 + w_t)
 * implicitly assumes a fixed time step. Kindred's users check in irregularly
 * (see doc section 5.3 — missed days are the norm), so instead of imputing
 * missing days or hand-widening Q per gap, the OU form handles an arbitrary
 * gap `dt` exactly:
 *
 *   theta_pred = mu + exp(-kappa*dt) * (theta_prev - mu)
 *   P_pred     = exp(-2*kappa*dt) * P_prev + (sigma^2 / (2*kappa)) * (1 - exp(-2*kappa*dt))
 *
 * followed by the standard Kalman update against observation noise R.
 *
 * ---------------------------------------------------------------------------
 * OBSERVATION NOISE IS NOW PER-OBSERVATION
 * ---------------------------------------------------------------------------
 * R used to be one constant for every check-in. It no longer has to be:
 * checkin-scoring.js fits a graded response model per response pattern and
 * reports that pattern's own measurement variance (`observationVariance`),
 * so a check-in the scale locates precisely moves the state more than one it
 * does not. Pass it as `params.R`; DEFAULT_R remains the fallback for an
 * observation that carries no variance of its own.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE POSTERIOR VARIANCE P IS AND IS NOT
 * ---------------------------------------------------------------------------
 * P_t is the filter's variance about theta_t given observations up to t. It
 * converges, for a fixed dt and R, to the steady state solved by
 * steadyStateP() below — typically within 4-6 daily observations. That means
 * P ALONE IS NOT A MEASURE OF HOW MUCH DATA A USER HAS: after a week it stops
 * falling, however long they keep journalling. Any confidence number built on
 * P alone therefore saturates almost immediately and overstates what the
 * system knows. index.js combines P with an explicit evidence count for
 * exactly this reason; see the model block there.
 */

// kappa: mean-reversion rate (1/days). Half-life of a deviation from the
// personal mean is ln(2)/kappa. kappa = 0.10 implies a ~6.9 day half-life —
// a bad day is expected to mostly resolve back toward baseline within about
// a week if nothing else changes, matching the intuitive scale of "a rough
// patch" rather than a single day or a multi-month drift.
export const DEFAULT_KAPPA = 0.10;

// sigma: OU process volatility. At stationarity the process variance is
// sigma^2 / (2*kappa); with sigma = 1.1 and kappa = 0.10 that's ~6.05,
// i.e. a stationary SD of ~2.5 points on the 0-21 scale, consistent with
// real between-day variation for a self-reported wellbeing measure.
export const DEFAULT_SIGMA = 1.1;

// R: observation variance. Doc section 3.3: a self-reported ordinal sum has
// substantial measurement noise, ~SD 2.45 on repeated same-day
// administration (consistent with test-retest figures for short wellbeing
// scales like SWEMWBS), so R = 2.45^2 ~= 6.0.
export const DEFAULT_R = 6.0;

// Initial uncertainty: wide, so the filter trusts real observations quickly
// in the first week rather than clinging to a population-mean prior.
export const DEFAULT_P0 = 10.0;

/** Fresh filter state, seeded from a prior mean (population or shrunk). */
export function initState(priorMean, p0 = DEFAULT_P0) {
  return { theta: priorMean, P: p0 };
}

/**
 * One OU-Kalman predict+update step.
 *
 * @param {object} state    - { theta, P } from the previous step.
 * @param {number} x        - today's observation (e.g. wellbeing score).
 * @param {object} params
 * @param {number} params.dt    - days since the previous observation (> 0).
 * @param {number} params.mu    - the long-run mean the process reverts to
 *                                 (population-shrunk baseline, see cold-start.js).
 * @param {number} [params.kappa]
 * @param {number} [params.sigma]
 * @param {number} [params.R]
 * @returns {{theta:number, P:number, K:number, innovation:number, thetaPred:number, pPred:number}}
 */
export function ouKalmanStep(state, x, params) {
  const { mu, dt } = params;
  const kappa = params.kappa ?? DEFAULT_KAPPA;
  const sigma = params.sigma ?? DEFAULT_SIGMA;
  const R = params.R ?? DEFAULT_R;

  if (!Number.isFinite(dt) || dt <= 0) throw new Error("ouKalmanStep: dt must be a positive, finite number of days");
  if (!Number.isFinite(x)) throw new Error("ouKalmanStep: observation must be finite");
  if (!(kappa > 0) || !(sigma > 0) || !(R > 0)) throw new Error("ouKalmanStep: kappa, sigma and R must be positive");

  const decay = Math.exp(-kappa * dt);
  const decay2 = decay * decay;

  // Predict.
  const thetaPred = mu + decay * (state.theta - mu);
  const stationaryVar = (sigma * sigma) / (2 * kappa);
  const pPred = decay2 * state.P + stationaryVar * (1 - decay2);

  // Update (standard Kalman, observation model x = theta + noise(R)).
  const K = pPred / (pPred + R);
  const innovation = x - thetaPred;
  const theta = thetaPred + K * innovation;
  const P = (1 - K) * pPred;

  // Innovation variance S = P_pred + R. The standardised innovation
  // (innovation / sqrt(S)) is the filter's own surprise measure and is the
  // right quantity for "is today unusual for this person", because unlike a
  // raw z-score against a mean it accounts for how uncertain the state
  // estimate itself is.
  const S = pPred + R;
  return {
    theta, P, K, innovation, thetaPred, pPred,
    S,
    standardisedInnovation: innovation / Math.sqrt(S),
    sd: Math.sqrt(P),
    R,
  };
}

/**
 * The fixed point of the covariance recursion for a given step length, i.e.
 * the value P converges to under repeated observation at spacing `dt`.
 * Solving P = (1-K)·P_pred with P_pred = c·P + q and K = P_pred/(P_pred+R):
 *
 *     P_pred = c·P + q,   P = P_pred·R / (P_pred + R)
 *  => c·P² + (q + R - c·R)·P - q·R = 0
 *
 * with c = exp(-2·kappa·dt) and q = (sigma²/2kappa)(1 - c). Returned as the
 * positive root. Used to report how far a user's current P still is from the
 * best this filter can ever do, which is the honest denominator for a
 * precision-based confidence.
 */
export function steadyStateP({ dt = 1, kappa = DEFAULT_KAPPA, sigma = DEFAULT_SIGMA, R = DEFAULT_R } = {}) {
  const c = Math.exp(-2 * kappa * dt);
  const q = ((sigma * sigma) / (2 * kappa)) * (1 - c);
  const A = c;
  const B = q + R - c * R;
  const C = -q * R;
  if (A === 0) return -C / B;
  // Numerically stable quadratic root. The textbook (-B + sqrt(D)) / 2A form
  // loses all its precision when A is tiny -- which is exactly the long-gap
  // case, A = exp(-2*kappa*dt), where it returned 0 instead of the correct
  // positive root. Using the conjugate form q = -(B + sign(B)*sqrt(D))/2 and
  // root = C/q avoids the cancellation entirely.
  const disc = B * B - 4 * A * C;
  const sq = Math.sqrt(Math.max(disc, 0));
  const half = -0.5 * (B + (B >= 0 ? sq : -sq));
  if (half === 0) return 0;
  const r1 = half / A;
  const r2 = C / half;
  return Math.max(r1, r2);
}

/**
 * Runs the filter forward across a full history of observations.
 * `observations` is an array of { date: Date|string, value: number },
 * assumed sorted ascending by date. `priorMean` seeds theta_0 (typically the
 * population/cold-start-shrunk estimate, see cold-start.js). `mu` is the
 * long-run mean to revert to — pass a per-user updated baseline if you have
 * one (e.g. baseline.js's slow EWMA), else it can equal `priorMean`.
 *
 * Returns the array of per-step results, one per observation, in order.
 */
export function filterSeries(observations, { priorMean, mu, kappa, sigma, R } = {}) {
  if (!Array.isArray(observations) || observations.length === 0) return [];

  const results = [];
  let state = initState(priorMean ?? observations[0].value);
  let prevDate = toDate(observations[0].date);

  for (let i = 0; i < observations.length; i += 1) {
    const obs = observations[i];
    const date = toDate(obs.date);
    // Out-of-order or same-instant observations collapse to a minimum step
    // rather than throwing: a caller that sorts badly should get a slightly
    // pessimistic answer, not a crash in the middle of a user's journal.
    const raw = i === 0 ? 1 : daysBetween(prevDate, date);
    const dt = Number.isFinite(raw) && raw > 0 ? raw : 1e-6;
    const step = ouKalmanStep(state, obs.value, {
      mu: mu ?? priorMean ?? obs.value,
      dt,
      kappa,
      sigma,
      // Per-observation measurement variance when the caller has one.
      R: obs.R ?? R,
    });
    state = { theta: step.theta, P: step.P };
    results.push({ date, ...step });
    prevDate = date;
  }
  return results;
}

function toDate(d) {
  return d instanceof Date ? d : new Date(d);
}

function daysBetween(a, b) {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}
