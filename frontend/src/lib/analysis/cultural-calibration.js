/**
 * cultural-calibration.js
 *
 * Culture-aware calibration using soft signals ONLY. Kindred never asks a
 * user to declare ethnicity. Signals used: journaling language (detected
 * from the text itself), device locale, and an explicit opt-in coarse
 * region. See docs/backend/01-statistics-and-modelling.md and
 * docs/backend/02-nlp-and-llm-strategy.md section 2.1.
 *
 * Documented problems this module exists to handle:
 *  1. East Asian dialectical affect — positive and negative affect
 *     genuinely co-occur (Bagozzi, Wong & Yi 1999; Miyamoto et al.);
 *     collapsing them onto one bipolar valence axis erases the signal.
 *  2. Ideal affect — calm/low-arousal-positive states are the *most*
 *     positively valued state in many East Asian cultural contexts (Tsai's
 *     Affect Valuation Theory), not a lesser version of "excited".
 *  3. Somatic idioms of distress — "chest tightness", "can't sleep",
 *     "thinking too much" are how distress is often expressed and must be
 *     read as emotional signal, not filtered out as a physical complaint.
 *  4. High-context understatement — indirect, minimising language can
 *     carry as much distress as direct language.
 *  5. Code-switching — language mixed within an entry is itself a
 *     (soft) cultural signal, not noise to strip.
 */

// ---------------------------------------------------------------------------
// 1. Documented lexicon of somatic and idiom cues.
// ---------------------------------------------------------------------------

/**
 * Somatic idioms of distress. Each entry names the phrase, a plain-English
 * gloss of what it is commonly used to mean, and a distress weight in
 * [0, 1] used when folding this signal into an overall read. These are NOT
 * physical-health complaints to be filtered out — they are how distress is
 * often actually expressed, especially in high-context or somaticising
 * communication styles.
 */
export const SOMATIC_DISTRESS_LEXICON = Object.freeze([
  { phrase: "chest tightness", gloss: "anxiety/distress somatised as chest sensation", weight: 0.75 },
  { phrase: "chest feels tight", gloss: "anxiety/distress somatised as chest sensation", weight: 0.75 },
  { phrase: "chest is tight", gloss: "anxiety/distress somatised as chest sensation", weight: 0.75 },
  { phrase: "can't breathe", gloss: "acute distress/panic", weight: 0.85 },
  { phrase: "cant breathe", gloss: "acute distress/panic", weight: 0.85 },
  { phrase: "can't sleep", gloss: "sleep disruption as a distress marker", weight: 0.55 },
  { phrase: "cant sleep", gloss: "sleep disruption as a distress marker", weight: 0.55 },
  { phrase: "cannot sleep", gloss: "sleep disruption as a distress marker", weight: 0.55 },
  { phrase: "thinking too much", gloss: "rumination idiom, common cross-culturally", weight: 0.6 },
  { phrase: "overthinking everything", gloss: "rumination idiom", weight: 0.6 },
  { phrase: "head is heavy", gloss: "somatised cognitive/emotional load", weight: 0.5 },
  { phrase: "head feels heavy", gloss: "somatised cognitive/emotional load", weight: 0.5 },
  { phrase: "stomach in knots", gloss: "anxiety somatised as gastric sensation", weight: 0.6 },
  { phrase: "stomach is in knots", gloss: "anxiety somatised as gastric sensation", weight: 0.6 },
  { phrase: "heart racing", gloss: "anxiety/panic physiological marker", weight: 0.65 },
  { phrase: "heart is racing", gloss: "anxiety/panic physiological marker", weight: 0.65 },
  { phrase: "tired all the time", gloss: "possible depressive somatic marker", weight: 0.5 },
  { phrase: "no appetite", gloss: "possible depressive somatic marker", weight: 0.5 },
  { phrase: "everything hurts", gloss: "diffuse somatisation of distress", weight: 0.55 },
  { phrase: "body feels heavy", gloss: "somatised low mood", weight: 0.55 },
  { phrase: "can't think straight", gloss: "cognitive fog under distress", weight: 0.5 },
  { phrase: "cant think straight", gloss: "cognitive fog under distress", weight: 0.5 },
]);

/**
 * High-context understatement / minimisation idioms that in many contexts
 * carry MORE weight than their literal content, not less. Distinct from
 * text-features.js's generic MINIMISATION_CUES (which are language-agnostic
 * hedges) — these are specifically the understatement pattern that a naive
 * sentiment reader would score as neutral-to-mild but that often indicates
 * substantial distress.
 */
export const UNDERSTATEMENT_LEXICON = Object.freeze([
  { phrase: "it's a bit much", weight: 0.5 },
  { phrase: "a little tired of everything", weight: 0.6 },
  { phrase: "not my best day", weight: 0.4 },
  { phrase: "could be better", weight: 0.35 },
  { phrase: "managing, i guess", weight: 0.45 },
  { phrase: "it is what it is", weight: 0.4 },
]);

// ---------------------------------------------------------------------------
// 2. Soft-signal cluster inference (no declared ethnicity, ever).
// ---------------------------------------------------------------------------

// A cluster is a calibration bucket, not an ethnicity label. "general" is
// the always-available fallback with no cultural adjustment applied.
export const CLUSTERS = Object.freeze(["general", "high-context-indirect", "dialectical-affect"]);

const LOCALE_HINTS = Object.freeze({
  "high-context-indirect": ["ja", "ko", "zh", "vi", "th", "ms", "id", "singlish"],
  "dialectical-affect": ["zh", "ja", "ko"],
});

/**
 * Infers a soft calibration cluster from non-identity signals only:
 * device locale (e.g. "ja-JP"), an optional opt-in coarse region string,
 * and a journaling-language hint (e.g. from src/utils/emotion.js's
 * detectLanguage, or a script-range check on the entry text). Returns a
 * cluster plus a confidence — never a claimed ethnicity, and confidence is
 * deliberately capped well below 1 because every input here is a proxy.
 */
export function inferCluster({ locale, region, journalLanguageHint } = {}) {
  const localeLang = typeof locale === "string" ? locale.split(/[-_]/)[0].toLowerCase() : null;
  const hintLang = typeof journalLanguageHint === "string" ? journalLanguageHint.toLowerCase() : null;

  const votes = { "high-context-indirect": 0, "dialectical-affect": 0 };
  for (const [cluster, langs] of Object.entries(LOCALE_HINTS)) {
    if (localeLang && langs.includes(localeLang)) votes[cluster] += 0.4;
    if (hintLang && langs.some((l) => hintLang.includes(l))) votes[cluster] += 0.3;
  }
  if (typeof region === "string" && /east asia|asia-east|japan|korea|china|taiwan|hong kong|vietnam/i.test(region)) {
    votes["high-context-indirect"] += 0.3;
    votes["dialectical-affect"] += 0.3;
  }

  const [bestCluster, bestScore] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  if (bestScore <= 0) return { cluster: "general", confidence: 1 };

  return { cluster: bestCluster, confidence: Math.min(0.6, bestScore) };
}

// ---------------------------------------------------------------------------
// 3. Per-cluster calibration with a minimum-N gate.
// ---------------------------------------------------------------------------

// Below this many pooled observations for a cluster, fall back to the
// general model with widened uncertainty rather than trusting a
// under-supported per-cluster calibration.
export const MIN_CLUSTER_N = 30;

// Widening applied to confidence bounds when falling back (doc instruction:
// "wider uncertainty bounds and more conservative framing").
export const FALLBACK_WIDEN_FACTOR = 1.5;

/** Simple logistic temperature scaling: p' = sigmoid(logit(p) / T). */
export function temperatureScale(probability, temperature) {
  const p = Math.min(Math.max(probability, 1e-6), 1 - 1e-6);
  const logit = Math.log(p / (1 - p));
  const scaled = logit / temperature;
  return 1 / (1 + Math.exp(-scaled));
}

/**
 * Platt-style affine calibration: p' = sigmoid(a*logit(p) + b).
 * `params` = { a, b }, fit offline per cluster once enough labelled data
 * exists; identity ({a:1, b:0}) is a no-op.
 */
export function plattScale(probability, { a = 1, b = 0 } = {}) {
  const p = Math.min(Math.max(probability, 1e-6), 1 - 1e-6);
  const logit = Math.log(p / (1 - p));
  const scaled = a * logit + b;
  return 1 / (1 + Math.exp(-scaled));
}

/**
 * Calibrates a raw model confidence for a given cluster. `clusterStats` is
 * an object keyed by cluster name, e.g.
 *   { "high-context-indirect": { n: 45, platt: { a: 0.8, b: -0.1 } } }
 * populated from pooled, anonymised outcome data once it exists. Below
 * MIN_CLUSTER_N, falls back to the general model and widens the reported
 * uncertainty band rather than trusting an under-supported calibration.
 */
export function calibrateConfidence(rawConfidence, cluster, clusterStats = {}) {
  const stats = clusterStats[cluster];
  const hasEnoughData = stats && stats.n >= MIN_CLUSTER_N;

  if (!hasEnoughData) {
    const halfWidth = (1 - rawConfidence) / 2 * FALLBACK_WIDEN_FACTOR;
    return {
      confidence: rawConfidence,
      lowerBound: Math.max(0, rawConfidence - halfWidth),
      upperBound: Math.min(1, rawConfidence + halfWidth),
      usedCluster: "general",
      conservativeFraming: true,
      clusterN: stats?.n ?? 0,
    };
  }

  const calibrated = plattScale(rawConfidence, stats.platt ?? { a: 1, b: 0 });
  const halfWidth = (1 - calibrated) / 2; // narrower band once the cluster is well-supported
  return {
    confidence: calibrated,
    lowerBound: Math.max(0, calibrated - halfWidth),
    upperBound: Math.min(1, calibrated + halfWidth),
    usedCluster: cluster,
    conservativeFraming: false,
    clusterN: stats.n,
  };
}

// ---------------------------------------------------------------------------
// 4. Dialectical affect and ideal affect handling.
// ---------------------------------------------------------------------------

/**
 * Detects co-occurring positive and negative affect language in the same
 * entry. When both are present at meaningful strength, the caller must NOT
 * collapse them onto a single bipolar valence score — report both
 * magnitudes and a `dialectical: true` flag instead of an average that
 * would land near zero and imply "neutral", which is wrong.
 *
 * `positiveScore`/`negativeScore` are independent, non-negative magnitudes
 * (e.g. summed lexicon hits or model probabilities) — NOT a single signed
 * valence value.
 */
export function detectDialecticalAffect(positiveScore, negativeScore, { threshold = 0.3 } = {}) {
  const dialectical = positiveScore >= threshold && negativeScore >= threshold;
  return {
    dialectical,
    positiveScore,
    negativeScore,
    // Only collapse to a single bipolar value when NOT dialectical — this is
    // the one place doing so is safe.
    bipolarValence: dialectical ? null : positiveScore - negativeScore,
  };
}

/**
 * Adjusts how a "calm" (low-arousal, positive-valence) reading is scored
 * relative to "excited" (high-arousal, positive-valence) for a cluster
 * where ideal affect theory (Tsai) predicts calm is valued as highly as or
 * above high-arousal positive states. Rather than re-deriving a "positivity"
 * scalar from VAD by penalising low arousal (the Western-normed default),
 * this returns a cluster-aware weight to apply to the arousal axis when
 * computing any single "how positive is this" summary score.
 *
 * `arousalPenaltyWeight` of 1 = full Western-normed penalty for low arousal
 * on an otherwise positive state; 0 = no penalty at all (calm counts exactly
 * as positive as excited, provided valence is equal).
 */
export function idealAffectArousalWeight(cluster) {
  if (cluster === "dialectical-affect" || cluster === "high-context-indirect") {
    return 0.2; // low-arousal positive states are not down-weighted much, if at all
  }
  return 1;
}

/**
 * Applies idealAffectArousalWeight to fold a VAD point into a single
 * "positivity" scalar in a cluster-aware way, instead of the naive
 * valence-only or valence-plus-full-arousal-bonus approaches.
 */
export function culturallyCalibratedPositivity(vad, cluster) {
  const arousalWeight = idealAffectArousalWeight(cluster);
  // Only reward positive arousal (excitement) proportionally to the cluster
  // weight; never penalise negative arousal (calm) when valence is positive.
  const arousalContribution = vad.valence > 0 ? Math.max(0, vad.arousal) * arousalWeight * 0.3 : 0;
  return vad.valence + arousalContribution;
}
