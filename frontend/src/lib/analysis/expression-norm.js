/**
 * expression-norm.js — HOW DOES THIS PERSON'S WRITING MAP ONTO HOW THEY FEEL?
 *
 * The same inner state comes out differently on the page. A Singaporean
 * understater writes "ok lor, not bad" on a good day; a hyperbolic teenager
 * writes "i'm literally dying" about a quiz. Reading both through one fixed
 * text-to-mood line is the cultural error this module removes.
 *
 * ===========================================================================
 * MODEL (Bayesian linear regression, conjugate, two parameters)
 * ===========================================================================
 * On days with BOTH a check-in and a journal entry, centre both readings on
 * the scale midpoint:
 *     z = x_checkin - MID      (the better measurement of the latent state)
 *     y = x_text    - MID      (the text reading of the same day)
 * and model the text as a person-specific linear function of the state:
 *     y = tau + lambda * z + e,     e ~ N(0, SIGMA2)
 *   tau     offset: >0 writes brighter than they feel, <0 darker.
 *   lambda  gain:   <1 understates swings, >1 exaggerates them.
 *
 * Prior: (tau, lambda) ~ N(mu0, diag(TAU_VAR, LAMBDA_VAR)), mu0 = (tau_g, 1).
 *   tau_g is the group-level offset for the person's language variety when
 *   aggregate data supplies one (hierarchical step), else 0. So a new user
 *   starts from their group, and their own paired days pull them away from it.
 *
 * Posterior (standard conjugate result, X = [1, z]):
 *     Lambda_n = Lambda_0 + X'X / SIGMA2
 *     mu_n     = Lambda_n^{-1} (Lambda_0 mu0 + X'y / SIGMA2)
 *
 * Use: a text-only day's reading is mapped back to the latent scale,
 *     z_hat = (y - tau) / lambda,   R' = R / lambda^2
 * with lambda clamped to [LAMBDA_MIN, LAMBDA_MAX] so a few odd days cannot
 * blow up the correction.
 *
 * Deterministic and recomputed from history on every run: nothing to store.
 */

export const EXPRESSION_NORM_VERSION = "expression-norm-2026.10.1";
export const TAU_VAR = 4;          // points^2: a group offset is uncertain by about ±2 points
export const LAMBDA_VAR = 0.25;    // gain prior SD 0.5 around 1
export const SIGMA2 = 9;           // text residual variance, points^2 (matches TEXT_R_BASE)
export const LAMBDA_MIN = 0.4;
export const LAMBDA_MAX = 2.5;

export function fitExpressionNorm(pairs = [], { mid = 10.5, groupTau = 0 } = {}) {
  // Prior precision and precision-weighted mean.
  let a = 1 / TAU_VAR, b = 0, d = 1 / LAMBDA_VAR;          // Lambda = [[a, b], [b, d]]
  let h0 = groupTau / TAU_VAR, h1 = 1 / LAMBDA_VAR;          // Lambda_0 mu0
  let n = 0;
  for (const pair of pairs) {
    if (!Number.isFinite(pair?.text) || !Number.isFinite(pair?.checkin)) continue;
    const z = pair.checkin - mid;
    const y = pair.text - mid;
    a += 1 / SIGMA2; b += z / SIGMA2; d += (z * z) / SIGMA2;
    h0 += y / SIGMA2; h1 += (z * y) / SIGMA2;
    n += 1;
  }
  const det = a * d - b * b;
  const tau = (d * h0 - b * h1) / det;
  const lambdaRaw = (a * h1 - b * h0) / det;
  return {
    tau,
    lambda: Math.max(LAMBDA_MIN, Math.min(LAMBDA_MAX, lambdaRaw)),
    lambdaRaw,
    tauVar: d / det,
    lambdaVar: a / det,
    pairs: n,
    groupTau,
    version: EXPRESSION_NORM_VERSION,
  };
}

/** Map a text reading (points) back to the latent scale, with its noise. */
export function correctTextObservation(value, R, norm, mid = 10.5) {
  if (!norm || !norm.pairs) return { value, R };
  const lambda = norm.lambda;
  return { value: mid + (value - mid - norm.tau) / lambda, R: R / (lambda * lambda) };
}
