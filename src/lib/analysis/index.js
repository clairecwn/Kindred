/**
 * index.js — KINDRED'S EMOTIONAL STATE MODEL, IN ONE PLACE.
 *
 * This is the composition root. Everything below is deterministic: same
 * history + same entry + same context => byte-identical output, on every run,
 * with or without an API key, online or offline. No module reachable from
 * here calls an LLM, reads the clock, or uses a random source.
 *
 * ===========================================================================
 * THE MODEL
 * ===========================================================================
 *
 * 1. STATE VARIABLES
 * ------------------
 *   theta_t   latent wellbeing, in POINTS on the 0-21 check-in scale.
 *             theta = 10.5 is the population mean (cold-start.js
 *             POPULATION_PRIOR.mean, which is also checkin-scoring.js's
 *             SCORE_MID, so the two priors sit at the same point).
 *   P_t       posterior variance of theta_t, in points².
 *   mu        the long-run mean theta reverts to, in points. Empirical-Bayes:
 *             the population prior shrunk toward this user's own observed
 *             mean (cold-start.js shrinkEstimate).
 *   (V,A,D)_t affect point in [-1,1]³, a SEPARATE object from theta. theta
 *             answers "how is this person doing"; VAD answers "what does
 *             today feel like". They are not collapsed into each other,
 *             because a calm low day and an agitated low day need the same
 *             theta and different handling.
 *   fast/slow EWMA baselines on the same points scale (baseline.js), used for
 *             drift and changepoint detection, NOT for the state estimate.
 *
 * 2. TRANSITION (state-filter.js)
 * -------------------------------
 * theta follows a mean-reverting Ornstein-Uhlenbeck process, integrated
 * exactly over the actual gap dt in days between observations — because
 * missed days are the norm, and a discrete-time local-level model would have
 * to pretend otherwise:
 *
 *     theta_pred = mu + e^(-kappa·dt)·(theta_prev - mu)
 *     P_pred     = e^(-2·kappa·dt)·P_prev + (sigma²/2kappa)·(1 - e^(-2·kappa·dt))
 *
 *   kappa = 0.10 /day   deviations from personal baseline half-life in
 *                       ln2/kappa ≈ 6.9 days: "a rough patch resolves in
 *                       about a week if nothing else changes". Chosen as the
 *                       scale of a bad patch rather than a bad day or a
 *                       bad quarter; NOT fitted.
 *   sigma = 1.1 points/√day   gives a stationary SD of
 *                       sqrt(sigma²/2kappa) ≈ 2.46 points, i.e. a typical
 *                       person ranges about ±2.5 points around their own
 *                       baseline day to day.
 *
 * 3. OBSERVATION
 * --------------
 * Two kinds of observation, both on the points scale, both with their own
 * measurement variance. This is the part that used to be missing: before,
 * only check-ins were observations and R was a single constant.
 *
 *   (a) CHECK-IN.  x_t = graded response score (checkin-scoring.js), a
 *       Samejima GRM MAP estimate mapped to points.
 *       R_t = SE(theta_GRM)²·3.5² + R_OCCASION_FLOOR — the response pattern's
 *       OWN measurement variance plus occasion noise. An all-same answer
 *       sheet is genuinely less informative than a differentiated one and now
 *       moves the state less.
 *
 *   (b) JOURNAL TEXT.  A journal-only day is now an observation too:
 *           x_t = 10.5 + TEXT_POINTS_PER_VALENCE · V_text
 *           R_t = TEXT_R_BASE / conf_text
 *       with V_text and conf_text from text-features.js's deterministic
 *       lexicon model. Entries whose text confidence is below
 *       TEXT_MIN_CONFIDENCE are NOT turned into observations at all — no
 *       evidence, no data point. This is what makes the app work with no API
 *       key: writing in the journal moves the state on its own.
 *
 *   Observation equation for both: x_t = theta_t + e_t, e_t ~ N(0, R_t), and
 *   the standard Kalman update
 *       K = P_pred/(P_pred+R_t),  theta = theta_pred + K(x - theta_pred),
 *       P = (1-K)·P_pred.
 *
 * 4. AFFECT (V, A, D)
 * -------------------
 * Two readings, blended by evidence weight (emotion-space.js blendVAD):
 *   - check-in:   checkinItemVAD(itemScores), weight 1 for a complete
 *                 check-in, scaled by the fraction of items answered.
 *   - text:       textVAD(journalText), weight = its own confidence.
 * Neither is allowed to invent a reading: if neither exists, vad is null and
 * downstream copy must say nothing about how today felt.
 *
 * An LLM emotion label, IF a caller supplies one, is attached under
 * `supplementary.llmReading` and is NEVER blended in. It is labelled,
 * inspectable, and cannot move a single number in this result. That is the
 * whole of the LLM's authority here.
 *
 * 5. CONFIDENCE (honest, and deliberately capped)
 * -----------------------------------------------
 * Two independent things have to be true before this system should assert
 * anything, so confidence is the geometric mean of two terms:
 *
 *   statePrecision      = 1 - sqrt(P_t)/sqrt(P_0)
 *       how much the filter has actually narrowed the state, relative to the
 *       prior. Saturates once P reaches its steady state (≈5 daily
 *       observations) — which is exactly why it cannot be used alone.
 *
 *   evidenceSufficiency = n_eff / (n_eff + EVIDENCE_HALF_SATURATION)
 *       n_eff = Σ_t (R_ref / R_t): the number of STANDARD-QUALITY
 *       observations the history is worth. A confident check-in counts near
 *       1, a vague journal line counts a fraction. EVIDENCE_HALF_SATURATION
 *       = 10, so ten good check-ins buy half of this term.
 *
 *   confidence = sqrt(statePrecision · evidenceSufficiency)
 *
 * The product form means a long history of weak evidence and a short history
 * of strong evidence are both held back, and because statePrecision is bounded
 * by the filter's steady state, confidence has a hard ceiling well below 1 no
 * matter how long someone journals. That ceiling is correct: seven self-report
 * items cannot pin down a latent mood state, and a number that crept toward
 * 1.0 would be lying.
 *
 * 6. GATES (cold-start.js)
 * ------------------------
 * Day-count gates are hard floors evaluated on the CHECK-IN count only, never
 * on journal entries — a week of journalling is not a week of measurement.
 * Below the `trend` gate (7) no direction is reported for any window, however
 * significant the regression says it is; below `fullFeatureSet` (30) the 90-day
 * window is suppressed the same way. Suppression replaces the direction with
 * "insufficient_data" and sets suppressedByGate, so a consumer cannot
 * accidentally read a gated trend as a steady one.
 *
 * 7. SAFETY
 * ---------
 * crisis-detection.js runs on the entry text and its verdict is surfaced at
 * the top level. It is not a score, never contributes to one, and is never
 * softened by anything else in this file.
 *
 * ===========================================================================
 * WHAT WAS WRONG BEFORE
 * ===========================================================================
 *  - The check-in half of the VAD blend required `entry.itemEmotions`, which
 *    no caller ever passed, and the index alignment in the mapping was wrong
 *    anyway. Result: vad was null on every real check-in.
 *  - `textVAD` was declared and never assigned. Journal text contributed
 *    nothing to the state, so with no API key the app had no emotional signal
 *    at all.
 *  - Dialectical affect read `entry.positiveLexiconScore`/`negativeLexiconScore`,
 *    fields nothing produced, so it was permanently false.
 *  - Confidence was 0.5·(1 - P/P0) + 0.5·(n/30): the first term saturates in
 *    under a week, the second is a bare linear ramp with no model behind it.
 *  - An LLM emotion label was blended into the VAD point at weight 0.8,
 *    silently changing the output depending on whether a key was configured.
 */

import { blendVAD, emotionToVAD, checkinItemVAD, vadToEmotionDirectional } from "./emotion-space.js";
import { scoreCheckin, SCORE_MID, R_OCCASION_FLOOR } from "./checkin-scoring.js";
import {
  initState, ouKalmanStep, steadyStateP,
  DEFAULT_KAPPA, DEFAULT_SIGMA, DEFAULT_R, DEFAULT_P0,
} from "./state-filter.js";
import { createBaselineState, updateBaseline, trendSlope } from "./baseline.js";
import { shrinkEstimate, evaluateGates, POPULATION_PRIOR } from "./cold-start.js";
import {
  inferCluster, calibrateConfidence, detectDialecticalAffect,
  culturallyCalibratedPositivity,
} from "./cultural-calibration.js";
import { analyseText } from "./text-features.js";
import { detectCrisisLanguage } from "./crisis-detection.js";

/** Points on the 0-21 scale per unit of text valence. See section 3(b). */
export const TEXT_POINTS_PER_VALENCE = 8.0;
/** Observation variance of a maximally confident text reading, in points². */
export const TEXT_R_BASE = 9.0;
/** Below this text confidence, an entry is not an observation at all. */
export const TEXT_MIN_CONFIDENCE = 0.15;
/** Reference observation quality for the n_eff calculation (section 5). */
export const R_REFERENCE = DEFAULT_R;
/** n_eff at which evidenceSufficiency reaches 0.5. */
export const EVIDENCE_HALF_SATURATION = 10;

/**
 * @param {Array<object>} history - past days, oldest first. Each item may
 *   contain { date, itemScores, journalText }.
 * @param {object} entry - today's entry: { date, itemScores?, journalText? }.
 * @param {object} [context] - { locale, region, journalLanguageHint,
 *   clusterStats } soft, non-identity signals for cultural-calibration.js,
 *   plus optional { llmEmotion } (see section 4 — labelled, never blended).
 * @returns {object} one structured analysis result.
 */
export function analyseUser(history = [], entry = {}, context = {}) {
  const pastDays = Array.isArray(history) ? history : [];
  const today = entry && typeof entry === "object" ? entry : {};
  const hasToday = Boolean(today.itemScores || today.journalText);
  const allDays = hasToday ? [...pastDays, today] : pastDays;

  // Gates count CHECK-INS only. See section 6.
  const checkinCount = allDays.filter((d) => d && d.itemScores).length;
  const gates = evaluateGates(checkinCount);

  // Safety runs first and is never conditional on anything below it.
  const safety = detectCrisisLanguage(today.journalText ?? "");

  if (!hasToday && pastDays.length === 0) {
    return {
      sayNothing: true,
      reason: "no check-in or journal entry yet",
      confidence: 0,
      gates,
      safety,
    };
  }

  const todayScore = today.itemScores ? scoreCheckin(today.itemScores) : null;

  // --- Build the observation series ---------------------------------------
  // Every day that produced usable evidence becomes one observation with its
  // own measurement variance R. See section 3.
  const series = [];
  for (const day of allDays) {
    if (!day) continue;
    const obs = dayToObservation(day);
    if (obs) series.push(obs);
  }
  series.sort((a, b) => toDate(a.date) - toDate(b.date));

  const checkinSeries = series.filter((s) => s.kind === "checkin");

  // --- Cold-start shrinkage of the personal mean ---------------------------
  // Shrinkage uses CHECK-IN observations only: the population prior is
  // expressed in check-in units, and a text-derived point is a much weaker
  // measurement of the same quantity.
  const sampleMean = checkinSeries.length
    ? mean(checkinSeries.map((s) => s.value))
    : POPULATION_PRIOR.mean;
  const shrunk = shrinkEstimate({ n: checkinSeries.length, sampleMean });
  const mu = shrunk.estimate;

  // --- Baseline + drift + changepoints (points scale) ----------------------
  const baselineRun = runBaselineSeries(checkinSeries, mu);
  const trend28 = trendSlope(checkinSeries, 28);
  const trend90 = trendSlope(checkinSeries, 90);

  // --- OU-Kalman latent state ----------------------------------------------
  const kalman = runKalmanSeries(series, mu);
  const latest = kalman.length ? kalman[kalman.length - 1] : null;

  // --- Affect (VAD) ---------------------------------------------------------
  const cluster = inferCluster(context);
  const textResult = today.journalText ? analyseText(today.journalText) : null;

  const readings = [];
  if (today.itemScores) {
    const cv = checkinItemVAD(today.itemScores);
    if (cv.itemsUsed > 0) {
      readings.push({ ...cv, weight: cv.itemsUsed / 7, source: "checkin" });
    }
  }
  if (textResult && textResult.vadConfidence > 0) {
    readings.push({ ...textResult.vad, weight: textResult.vadConfidence, source: "text" });
  }
  const vad = readings.length ? blendVAD(readings) : null;
  const positivity = vad ? culturallyCalibratedPositivity(vad, cluster.cluster) : null;
  const emotionLabel = vad ? vadToEmotionDirectional(vad).emotion : null;

  // Dialectical affect, computed from the text's own independent positive and
  // negative mass rather than from fields no caller ever supplied.
  const dialectical = textResult
    ? detectDialecticalAffect(textResult.positiveMass, textResult.negativeMass)
    : null;
  if (textResult) textResult.dialecticalAffect = dialectical;

  // --- Confidence (section 5) ------------------------------------------------
  const P = latest ? latest.P : DEFAULT_P0;
  const statePrecision = clamp(1 - Math.sqrt(P) / Math.sqrt(DEFAULT_P0), 0, 1);
  const nEff = series.reduce((sum, s) => sum + R_REFERENCE / s.R, 0);
  const evidenceSufficiency = nEff / (nEff + EVIDENCE_HALF_SATURATION);
  const confidence = clamp(Math.sqrt(statePrecision * evidenceSufficiency), 0, 1);
  const clusterConfidence = calibrateConfidence(confidence, cluster.cluster, context.clusterStats);

  // --- The LLM's entire authority: a labelled passenger ---------------------
  const supplementary = {};
  const llmEmotion = context.llmEmotion ?? today.journalEmotion ?? null;
  if (llmEmotion) {
    supplementary.llmReading = {
      emotion: llmEmotion,
      vad: emotionToVAD(llmEmotion),
      source: context.llmSource ?? "llm",
      // Explicit contract for every consumer: this did not affect anything
      // above it, and must not be substituted for `vad` or `emotionLabel`.
      influencedScore: false,
      note: "supplementary only — not blended into vad, confidence or theta",
    };
    const det = vad ? vadToEmotionDirectional(vad).emotion : null;
    supplementary.llmReading.agreesWithDeterministic = det != null && det === llmEmotion;
  }

  return {
    sayNothing: gates.sayNothing && !today.journalText,
    checkinCount,
    observationCount: series.length,
    effectiveObservations: nEff,
    gates,
    safety,
    todayScore,
    coldStart: shrunk,
    mu,
    baseline: baselineRun.state,
    baselineSteps: gates.trend ? baselineRun.steps : undefined,
    trend: {
      window28: gates.trend ? trend28 : suppressedTrend(trend28),
      window90: gates.fullFeatureSet ? trend90 : suppressedTrend(trend90),
    },
    latentState: latest,
    latentSteadyStateP: steadyStateP({ dt: 1, kappa: DEFAULT_KAPPA, sigma: DEFAULT_SIGMA, R: DEFAULT_R }),
    vad,
    vadSources: readings.map((r) => r.source),
    emotionLabel,
    positivity,
    dialecticalAffect: dialectical,
    cluster,
    textFeatures: textResult,
    statePrecision,
    evidenceSufficiency,
    confidence,
    calibratedConfidence: clusterConfidence,
    supplementary,
    modelVersion: MODEL_VERSION,
  };
}

export const MODEL_VERSION = "kindred-state-model-v2";

/**
 * One day record -> one observation { date, value, R, kind }, or null when
 * the day carries no usable evidence. A day with BOTH a check-in and a
 * journal entry yields the check-in only: they measure the same latent state
 * on the same day, and treating them as independent would double-count.
 */
export function dayToObservation(day) {
  if (!day) return null;
  const date = day.date ?? null;
  if (day.itemScores) {
    const s = scoreCheckin(day.itemScores);
    const value = s.graded ?? s.weighted;
    if (!Number.isFinite(value)) return null;
    return {
      date,
      value,
      R: Number.isFinite(s.observationVariance) ? s.observationVariance : DEFAULT_R + R_OCCASION_FLOOR,
      kind: "checkin",
    };
  }
  if (day.journalText) {
    const t = analyseText(day.journalText);
    if (t.vadConfidence < TEXT_MIN_CONFIDENCE) return null;
    return {
      date,
      value: SCORE_MID + TEXT_POINTS_PER_VALENCE * t.vad.valence,
      R: TEXT_R_BASE / t.vadConfidence,
      kind: "text",
    };
  }
  return null;
}

function suppressedTrend(t) {
  // Gate not yet met: never surface a direction, regardless of what the math says.
  return { ...t, direction: "insufficient_data", suppressedByGate: true };
}

function runBaselineSeries(series, priorMean) {
  let state = createBaselineState(priorMean);
  const steps = [];
  let prevDate = series.length ? toDate(series[0].date) : null;
  series.forEach((point, i) => {
    const date = toDate(point.date);
    const raw = i === 0 ? 1 : daysBetween(prevDate, date);
    const dt = Number.isFinite(raw) && raw > 0 ? raw : 1e-6;
    const result = updateBaseline(state, point.value, dt);
    state = result.state;
    steps.push({ date, ...result });
    prevDate = date;
  });
  return { state, steps };
}

function runKalmanSeries(series, mu) {
  if (!series.length) return [];
  let state = initState(mu, DEFAULT_P0);
  let prevDate = toDate(series[0].date);
  const out = [];
  series.forEach((point, i) => {
    const date = toDate(point.date);
    const raw = i === 0 ? 1 : daysBetween(prevDate, date);
    const dt = Number.isFinite(raw) && raw > 0 ? raw : 1e-6;
    const step = ouKalmanStep(state, point.value, {
      mu,
      dt,
      kappa: DEFAULT_KAPPA,
      sigma: DEFAULT_SIGMA,
      R: point.R ?? DEFAULT_R,
    });
    state = { theta: step.theta, P: step.P };
    out.push({ date, kind: point.kind, ...step });
    prevDate = date;
  });
  return out;
}

function toDate(d) {
  if (d instanceof Date) return d;
  const parsed = new Date(d ?? 0);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}
function daysBetween(a, b) {
  return (b.getTime() - a.getTime()) / 86400000;
}
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}
