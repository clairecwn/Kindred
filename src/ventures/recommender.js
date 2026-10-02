/**
 * recommender.js
 *
 * Turns a scored candidate pool into at most three invitations.
 *
 * ===========================================================================
 * WHAT THIS FILE DECIDES (and what scoring.js decides)
 * ===========================================================================
 * scoring.js owns the utility function: what one activity is worth to one
 * user, given their state. This file owns everything about the SET — how many
 * to show, which must always be present, what to do when the pool is thin or
 * empty, and how the copy is framed. Keeping the two apart is what lets the
 * utility model be tested on its own numbers.
 *
 * ===========================================================================
 * EXPLORATION VS EXPLOITATION — THE RULE, IN ONE PLACE
 * ===========================================================================
 * There are two exploration mechanisms and they do different jobs:
 *
 *  1. THE DEFAULT, ALWAYS ON: scoring.js's explorationBonus. Deterministic,
 *     and scaled by how little the system knows about the user
 *     (1 - analysis confidence) and by how much they have to spend today
 *     (throttled to zero for a depleted capacity band). Formally this is
 *     optimism-under-uncertainty applied to the USER MODEL rather than to the
 *     arms: when the state estimate is vague, prefer variety; when it is
 *     sharp, prefer fit. It requires no outcome history, so it works on day
 *     one, and it converges to pure exploitation as the state estimate
 *     converges.
 *
 *  2. THE OPT-IN, OFF BY DEFAULT: LinUCB over activity arms (below), which is
 *     optimism-under-uncertainty applied to the ARMS. It needs
 *     BANDIT_MIN_OUTCOMES observed (context, action, reward) rows before it
 *     is allowed to reorder anything, and its reward is defined as the user's
 *     OWN mood delta at their next check-in — never a click, a join, or a
 *     dwell time. Engagement-as-reward is the mechanism that turns a
 *     wellbeing recommender into an attention product, and it is prohibited
 *     here on purpose.
 *
 * ===========================================================================
 * DEGRADING GRACEFULLY WHEN SUPPLY IS THIN
 * ===========================================================================
 * Real supply is patchy: live adapters fail, a neighbourhood has three
 * mapped places, a filter removes almost everything. The rule is a fixed
 * ladder, and `supplyState` in the result says which rung was used, so the UI
 * can word itself honestly instead of pretending a full set exists:
 *
 *   "ok"        - at least MIN_HEALTHY_POOL eligible candidates.
 *   "thin"      - between 1 and MIN_HEALTHY_POOL-1. Everything eligible is
 *                 returned, up to the cap. Nothing is padded, nothing is
 *                 invented, and no ineligible option is let through to make
 *                 up the numbers — a filter failure is a safety or
 *                 accessibility decision, not a nice-to-have.
 *   "none"      - nothing survived the filters. Returns an empty list, and
 *                 the caller is expected to say nothing rather than offer
 *                 something unsuitable. An empty recommendation set is a
 *                 valid, safe outcome in this app.
 *
 * ===========================================================================
 * DESIGN BIBLE CONSTRAINTS ENFORCED HERE
 * ===========================================================================
 *  - Copy is invitation-framed ("if you feel up to it"), never a prescription
 *    and never a guilt or streak reference.
 *  - At least one genuine no-commitment option is present whenever one is
 *    eligible, so "turn up to nothing" is always on the table.
 *  - No count of other users, no popularity ordering, no comparison of any
 *    kind appears in the returned objects.
 */

import { scoreActivity, isEligible } from "./scoring.js";

export const MAX_RECOMMENDATIONS = 3;

/** Below this many eligible candidates the set is reported as "thin". */
export const MIN_HEALTHY_POOL = 3;

/** Flip this on (or pass { enableBandit: true } to recommend()) once a
 * deployment has enough (context, action, reward) rows in
 * recommendation_outcomes to train on -- a few hundred per user cohort is a
 * reasonable floor. Off by default: cold start must never depend on it. */
export const ENABLE_BANDIT_DEFAULT = false;
export const BANDIT_MIN_OUTCOMES = 200;

const INVITATION_TEMPLATES = [
  "If you feel up to it, {title} is happening nearby.",
  "No pressure at all, but {title} might be worth a look.",
  "When you're ready: {title}.",
  "A gentle option, if it appeals: {title}.",
];

function invitationCopy(activity, index) {
  const template = INVITATION_TEMPLATES[index % INVITATION_TEMPLATES.length];
  return template.replace("{title}", activity.title);
}

/**
 * Rank all candidate activities for a user context. Returns every scored,
 * eligible activity sorted best-first (no truncation) -- recommend() below
 * is the one that applies the "max 3, one no-commitment" business rule.
 */
export function rankActivities(activities, userContext, { noveltySalt = "" } = {}) {
  return activities
    .map((activity) => scoreActivity(activity, userContext, { noveltySalt }))
    .filter((r) => r.eligible)
    .sort((a, b) => b.score - a.score);
}

/**
 * Pick at most MAX_RECOMMENDATIONS results, guaranteeing at least one
 * no-commitment (drop-in / noCommitment:true) option is included whenever
 * one is eligible, even if it would not otherwise make the top N by score.
 */
export function selectWithNoCommitmentGuarantee(ranked, maxCount = MAX_RECOMMENDATIONS) {
  if (ranked.length === 0) return [];

  const top = ranked.slice(0, maxCount);
  const hasNoCommitment = top.some((r) => r.activity.noCommitment);
  if (hasNoCommitment) return top;

  const bestNoCommitment = ranked.find((r) => r.activity.noCommitment);
  if (!bestNoCommitment) return top; // none exist among eligible candidates at all

  // Swap out the weakest slot for the best no-commitment option.
  const result = top.slice(0, maxCount - 1);
  result.push(bestNoCommitment);
  return result;
}

/**
 * Main entry point: build the final, at-most-3, invitation-framed
 * recommendation list for a user.
 *
 * @param {Array<object>} activities - normalised activities (activity-model.js)
 * @param {object} userContext - see scoring.js for shape
 * @param {object} [options]
 * @param {string} [options.noveltySalt] - vary per session/day for a little
 *   shuffling among near-ties without being random/untestable.
 * @param {boolean} [options.enableBandit] - opt in to LinUCB re-ranking.
 * @param {LinUCBBandit} [options.bandit] - a warmed bandit instance.
 * @returns {Array<{ activity, score, reasons, copy }>}
 */
export function recommend(activities, userContext, options = {}) {
  const { noveltySalt = "", enableBandit = ENABLE_BANDIT_DEFAULT, bandit = null, banditOutcomeCount = 0 } = options;

  const pool = Array.isArray(activities) ? activities : [];
  let ranked = rankActivities(pool, userContext, { noveltySalt });

  const banditApplied = Boolean(enableBandit && bandit && banditOutcomeCount >= BANDIT_MIN_OUTCOMES);
  if (banditApplied) {
    ranked = bandit.rerank(ranked, userContext);
  }

  const selected = selectWithNoCommitmentGuarantee(ranked, MAX_RECOMMENDATIONS);

  const items = selected.map((r, i) => ({
    activity: r.activity,
    score: r.score,
    breakdown: r.breakdown,
    copy: invitationCopy(r.activity, i),
    isNoCommitment: !!r.activity.noCommitment,
  }));

  // Backward compatible: the array itself is what callers map over, and the
  // supply diagnostics ride along as non-index properties so an existing
  // `recs.map(...)` / `recs.length` caller is unaffected.
  Object.defineProperties(items, {
    supplyState: { value: supplyState(ranked.length), enumerable: false },
    candidatesConsidered: { value: pool.length, enumerable: false },
    eligibleCount: { value: ranked.length, enumerable: false },
    explorationRule: { value: banditApplied ? "linucb-arms" : "state-uncertainty", enumerable: false },
  });
  return items;
}

/** See the "degrading gracefully" section at the top of this file. */
export function supplyState(eligibleCount) {
  if (eligibleCount <= 0) return "none";
  return eligibleCount < MIN_HEALTHY_POOL ? "thin" : "ok";
}

/** Convenience: does at least one activity survive the hard filters at all? */
export function hasAnyEligibleActivity(activities, userContext) {
  return activities.some((a) => isEligible(a, userContext).eligible);
}

// ---------------------------------------------------------------------------
// LinUCB contextual bandit (Li et al. 2010, "A Contextual-Bandit Approach to
// Personalized News Article Recommendation"). Reward for this app must be
// the mood delta observed at the user's NEXT check-in after the activity,
// not clicks/joins -- joins measure popularity, mood delta measures whether
// it actually helped, which is the whole point per the research brief.
// ---------------------------------------------------------------------------
export class LinUCBBandit {
  /**
   * @param {number} dimensions - length of the feature vector per arm.
   * @param {number} alpha - exploration parameter (higher = more exploration).
   */
  constructor(dimensions, alpha = 0.6) {
    this.d = dimensions;
    this.alpha = alpha;
    this.armState = new Map(); // armId -> { A: matrix, b: vector }
  }

  _identity() {
    const A = [];
    for (let i = 0; i < this.d; i++) {
      const row = new Array(this.d).fill(0);
      row[i] = 1;
      A.push(row);
    }
    return A;
  }

  _getArm(armId) {
    if (!this.armState.has(armId)) {
      this.armState.set(armId, { A: this._identity(), b: new Array(this.d).fill(0) });
    }
    return this.armState.get(armId);
  }

  /** Featurise (activity, userContext) into a fixed-length numeric vector. */
  static featurise(activity, userContext) {
    return [
      1, // bias term
      (activity.socialIntensity ?? 0) / 4,
      energyRank(activity.energyDemand) / 3,
      (activity.durationMinutes ?? 0) / 180,
      activity.cost?.amount ? 1 : 0,
      (userContext.currentSocialRung ?? 0) / 4,
      capacityRank(userContext.capacityBand) / 3,
    ];
  }

  /** Upper confidence bound score for one arm given a context vector x. */
  score(armId, x) {
    const { A, b } = this._getArm(armId);
    const Ainv = invert(A);
    const theta = matVec(Ainv, b);
    const mean = dot(theta, x);
    const variance = dot(x, matVec(Ainv, x));
    const ucb = mean + this.alpha * Math.sqrt(Math.max(variance, 0));
    return ucb;
  }

  /** Re-rank already-eligible scored results by LinUCB score, highest first. */
  rerank(rankedResults, userContext) {
    return [...rankedResults].sort((a, b) => {
      const xa = LinUCBBandit.featurise(a.activity, userContext);
      const xb = LinUCBBandit.featurise(b.activity, userContext);
      return this.score(b.activity.id, xb) - this.score(a.activity.id, xa);
    });
  }

  /**
   * Update the model with an observed outcome.
   * @param {string} armId - activity id (or activity category, if pooling).
   * @param {number[]} x - feature vector used at recommendation time.
   * @param {number} reward - mood delta at next check-in, typically clipped
   *   to a small range like [-1, 1] before being passed in here.
   */
  update(armId, x, reward) {
    const arm = this._getArm(armId);
    for (let i = 0; i < this.d; i++) {
      for (let j = 0; j < this.d; j++) {
        arm.A[i][j] += x[i] * x[j];
      }
      arm.b[i] += reward * x[i];
    }
  }
}

function energyRank(energy) {
  return { minimal: 0, low: 1, moderate: 2, high: 3 }[energy] ?? 1;
}
function capacityRank(band) {
  return { depleted: 0, low: 1, moderate: 2, high: 3 }[band] ?? 1;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function matVec(m, v) {
  return m.map((row) => dot(row, v));
}

/** Gauss-Jordan inversion; d is small (a handful of features) so O(d^3) is fine. */
function invert(matrix) {
  const n = matrix.length;
  const aug = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivotRow][col])) pivotRow = r;
    }
    [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];

    let pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-9) pivot = 1e-9; // regularise a near-singular matrix
    for (let k = 0; k < 2 * n; k++) aug[col][k] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      for (let k = 0; k < 2 * n; k++) aug[r][k] -= factor * aug[col][k];
    }
  }

  return aug.map((row) => row.slice(n));
}
