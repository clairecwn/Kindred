/**
 * emotion-space.js
 *
 * Valence-Arousal-Dominance (VAD) representation of affect.
 * See docs/backend/01-statistics-and-modelling.md section 2.
 *
 * Kindred's existing discrete emotion labels (src/utils/emotion.js EMOTIONS)
 * are kept as a *derived, display-only* projection of a continuous VAD point.
 * VAD is the thing trends/blending/arithmetic are done on; the label is only
 * for UI copy and world-mood lookup.
 *
 * Every axis is in [-1, 1] unless noted. Anchors below are hand-placed from
 * the published Russell/Mehrabian circumplex quadrant structure and Warriner
 * et al. (2013) norm ranges for the closest English word — a v1 fixed table,
 * to be refit once >= 100 users have both a quiz answer and a same-day
 * journal VAD reading (see the doc, section 2.2).
 */

export const EMOTION_VAD_ANCHORS = Object.freeze({
  happy:    { valence: 0.85,  arousal: 0.55,  dominance: 0.60 },
  excited:  { valence: 0.75,  arousal: 0.85,  dominance: 0.55 },
  grateful: { valence: 0.80,  arousal: 0.35,  dominance: 0.45 },
  content:  { valence: 0.60,  arousal: 0.15,  dominance: 0.55 },
  calm:     { valence: 0.55,  arousal: -0.35, dominance: 0.55 },
  neutral:  { valence: 0.00,  arousal: 0.00,  dominance: 0.00 },
  tired:    { valence: -0.20, arousal: -0.65, dominance: -0.30 },
  anxious:  { valence: -0.55, arousal: 0.70,  dominance: -0.55 },
  angry:    { valence: -0.60, arousal: 0.65,  dominance: 0.35 },
  sad:      { valence: -0.70, arousal: -0.35, dominance: -0.50 },
});

const EMOTION_KEYS = Object.keys(EMOTION_VAD_ANCHORS);

/** Look up the fixed VAD anchor for one of Kindred's 10 discrete emotions. */
export function emotionToVAD(emotionKey) {
  const anchor = EMOTION_VAD_ANCHORS[emotionKey];
  if (!anchor) return { ...EMOTION_VAD_ANCHORS.neutral };
  return { ...anchor };
}

function euclideanDistance(a, b) {
  const dv = a.valence - b.valence;
  const da = a.arousal - b.arousal;
  const dd = (a.dominance ?? 0) - (b.dominance ?? 0);
  return Math.sqrt(dv * dv + da * da + dd * dd);
}

/**
 * Nearest discrete emotion label for a VAD point, by Euclidean distance in
 * VAD space. Used only for display/copy — never for storage or arithmetic.
 */
export function vadToEmotion(vad) {
  let best = EMOTION_KEYS[0];
  let bestDist = Infinity;
  for (const key of EMOTION_KEYS) {
    const dist = euclideanDistance(vad, EMOTION_VAD_ANCHORS[key]);
    if (dist < bestDist) {
      bestDist = dist;
      best = key;
    }
  }
  return { emotion: best, distance: bestDist };
}

/**
 * Blend multiple VAD readings into one point via a weighted mean.
 * `readings` is an array of { valence, arousal, dominance, weight? }.
 * A reading with no explicit weight is weighted 1.
 */
export function blendVAD(readings) {
  if (!Array.isArray(readings) || readings.length === 0) {
    return { valence: 0, arousal: 0, dominance: 0, weightTotal: 0 };
  }
  let vSum = 0, aSum = 0, dSum = 0, wSum = 0;
  for (const r of readings) {
    const w = r.weight ?? 1;
    vSum += (r.valence ?? 0) * w;
    aSum += (r.arousal ?? 0) * w;
    dSum += (r.dominance ?? 0) * w;
    wSum += w;
  }
  if (wSum === 0) return { valence: 0, arousal: 0, dominance: 0, weightTotal: 0 };
  return { valence: vSum / wSum, arousal: aSum / wSum, dominance: dSum / wSum, weightTotal: wSum };
}

/**
 * A completed 7-question check-in's VAD as the score-weighted centroid of the
 * selected emotions (doc section 2.2):
 *
 *   V_checkin = sum_j (1 + score_j) * V_emotion_j / sum_j (1 + score_j)
 *
 * The `+1` prevents a 0-score answer from contributing zero weight — a 0 is
 * still an informative data point, just a negative one.
 *
 * `answers` is an array of { emotion, score } (score in 0..3).
 */
export function checkinVAD(answers) {
  if (!Array.isArray(answers) || answers.length === 0) {
    return { valence: 0, arousal: 0, dominance: 0, weightTotal: 0 };
  }
  const readings = answers.map(({ emotion, score }) => ({
    ...emotionToVAD(emotion),
    weight: 1 + (Number.isFinite(score) ? score : 0),
  }));
  return blendVAD(readings);
}

/**
 * Direction-aware nearest label.
 *
 * vadToEmotion() above compares raw Euclidean distance, which is wrong for a
 * reading that has been deliberately shrunk toward the origin. text-features.js
 * shrinks every text reading by a neutral pseudo-count, so a clearly
 * distressed entry can land at (-0.26, -0.13, 0) — a point whose nearest
 * ANCHOR is "neutral" purely because it is short, even though it points
 * squarely at "sad". Labelling masked distress as neutral is precisely the
 * false negative the dialect and masking layers exist to prevent, so the
 * label must not undo their work.
 *
 * This version compares DIRECTION: the reading is projected onto the unit
 * sphere before the nearest anchor is found, so magnitude affects only
 * whether a label is given at all. Inside NEUTRAL_RADIUS the reading is too
 * small to have a direction worth trusting and "neutral" is returned
 * honestly rather than by accident.
 */
export const NEUTRAL_RADIUS = 0.12;

export function vadToEmotionDirectional(vad, { neutralRadius = NEUTRAL_RADIUS } = {}) {
  const v = vad?.valence ?? 0;
  const a = vad?.arousal ?? 0;
  const d = vad?.dominance ?? 0;
  const magnitude = Math.sqrt(v * v + a * a + d * d);
  if (magnitude < neutralRadius) return { emotion: "neutral", magnitude, cosine: 1 };

  let best = "neutral";
  let bestCos = -Infinity;
  for (const key of EMOTION_KEYS) {
    if (key === "neutral") continue;
    const anchor = EMOTION_VAD_ANCHORS[key];
    const am = Math.sqrt(anchor.valence ** 2 + anchor.arousal ** 2 + anchor.dominance ** 2);
    if (am === 0) continue;
    const cos = (v * anchor.valence + a * anchor.arousal + d * anchor.dominance) / (magnitude * am);
    if (cos > bestCos) { bestCos = cos; best = key; }
  }
  return { emotion: best, magnitude, cosine: bestCos };
}

export function clampVADAxis(x) {
  return Math.max(-1, Math.min(1, x));
}

// ---------------------------------------------------------------------------
// CHECK-IN SCORES -> VAD, WITHOUT NEEDING THE UI'S EMOTION LABELS
// ---------------------------------------------------------------------------
/**
 * checkinVAD() above needs (emotion, score) pairs, i.e. it needs the UI to
 * hand over which option the user picked on each question. In practice no
 * caller did, so the check-in half of the VAD blend was silently null on
 * every real check-in and only the journal text ever contributed. This
 * function removes the dependency: it maps the 0-3 item scores THEMSELVES
 * into VAD, so any caller holding an itemScores object gets a reading.
 *
 * The model. Each item has a fixed direction in VAD space — the direction the
 * user's state moves as that item's score goes up — and the item's score
 * positions them along it:
 *
 *     s_j  = raw_j / 3                         in [0, 1]
 *     u_j  = 2·s_j - 1                         in [-1, 1], 0 at the midpoint
 *     V    = Σ_j a_j · u_j · dir_j.v / Σ_j a_j    (and likewise A, D)
 *
 * with a_j the same ITEM_WEIGHTS checkin-scoring.js uses, so one set of item
 * weights drives both the wellbeing score and the affect point.
 *
 * The direction vectors below are the only new judgement calls, and each is
 * stated rather than tuned:
 *  - valence is positive in every item: every question is worded so that a
 *    higher answer is a better day.
 *  - AROUSAL IS NOT MONOTONE ACROSS ITEMS, and getting this wrong is the
 *    classic failure. Energy and sleep raise arousal as they improve.
 *    Resilience does the OPPOSITE: "completely overwhelmed" (score 0) is a
 *    high-arousal state and "felt capable" (score 3) is a settled one, so its
 *    arousal component is negative. A model that made arousal uniformly
 *    increasing in score would read an overwhelmed day as deactivated, and
 *    would then hand the ventures layer the wrong capacity estimate.
 *  - dominance is dominated by resilience and accomplishment — the two items
 *    that actually ask about agency — with meaning contributing and mood,
 *    connection and sleep contributing little.
 */
export const CHECKIN_ITEM_DIRECTIONS = Object.freeze({
  mood:           { v: 1.00, a: 0.15, d: 0.25 },
  meaning:        { v: 0.75, a: 0.10, d: 0.45 },
  connection:     { v: 0.80, a: 0.05, d: 0.25 },
  accomplishment: { v: 0.60, a: 0.20, d: 0.70 },
  energy:         { v: 0.45, a: 0.75, d: 0.30 },
  resilience:     { v: 0.55, a: -0.45, d: 0.80 },
  sleep:          { v: 0.35, a: 0.15, d: 0.20 },
});

// Kept local rather than imported from checkin-scoring.js so emotion-space.js
// stays a leaf module with no dependencies; the two tables are asserted equal
// in __tests__/emotion-space.test.js so they cannot drift apart.
export const CHECKIN_ITEM_WEIGHTS = Object.freeze({
  mood: 1.1, meaning: 1.0, connection: 1.0, accomplishment: 1.0,
  energy: 0.9, resilience: 0.8, sleep: 0.7,
});

export const CHECKIN_RAW_MAX = 3;

/**
 * VAD point for a set of 0-3 item scores. Missing items are skipped and the
 * weighted mean is taken over the items actually answered, so a partial
 * check-in is not read as if the unanswered items were 0.
 *
 * @param {object} itemScores { mood: 0..3, ... }
 * @returns {{valence:number, arousal:number, dominance:number, itemsUsed:number, weightTotal:number}}
 */
export function checkinItemVAD(itemScores) {
  const zero = { valence: 0, arousal: 0, dominance: 0, itemsUsed: 0, weightTotal: 0 };
  if (!itemScores || typeof itemScores !== "object") return zero;

  let v = 0, a = 0, d = 0, w = 0, used = 0;
  for (const [key, weight] of Object.entries(CHECKIN_ITEM_WEIGHTS)) {
    const raw = itemScores[key];
    if (!Number.isFinite(raw)) continue;
    const dir = CHECKIN_ITEM_DIRECTIONS[key];
    const u = 2 * (Math.max(0, Math.min(CHECKIN_RAW_MAX, raw)) / CHECKIN_RAW_MAX) - 1;
    v += weight * u * dir.v;
    a += weight * u * dir.a;
    d += weight * u * dir.d;
    w += weight;
    used += 1;
  }
  if (w === 0) return zero;
  return {
    valence: clampVADAxis(v / w),
    arousal: clampVADAxis(a / w),
    dominance: clampVADAxis(d / w),
    itemsUsed: used,
    weightTotal: w,
  };
}
