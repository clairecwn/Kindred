import test from "node:test";
import assert from "node:assert/strict";
import {
  scoreCheckin, weightedSum, gradedResponseTheta, gradedResponseScore,
  categoryProbability, logLikelihood, logPosterior, scoreToBand,
  cronbachAlpha, ITEM_WEIGHTS, CATEGORY_BOUNDARIES, SCORE_MIN, SCORE_MAX,
  SCORE_MID, POINTS_PER_THETA, R_OCCASION_FLOOR, PROVISIONAL_BAND_CUTOFFS,
} from "../checkin-scoring.js";

const KEYS = Object.keys(ITEM_WEIGHTS);
const uniform = (v) => Object.fromEntries(KEYS.map((k) => [k, v]));

// ---------------------------------------------------------------------------
// The GRM itself.
// ---------------------------------------------------------------------------

test("category probabilities form a proper distribution at every theta", () => {
  for (const theta of [-3, -1.5, -0.4, 0, 0.6, 2, 3]) {
    for (const a of Object.values(ITEM_WEIGHTS)) {
      const ps = [0, 1, 2, 3].map((k) => categoryProbability(k, theta, a));
      const total = ps.reduce((x, y) => x + y, 0);
      assert.ok(Math.abs(total - 1) < 1e-6, `probabilities sum to ${total} at theta=${theta}, a=${a}`);
      for (const p of ps) assert.ok(p > 0 && p < 1);
    }
  }
});

test("higher categories become more likely as theta rises (the model is monotone)", () => {
  const a = 1.0;
  let prev = -Infinity;
  for (const theta of [-3, -2, -1, 0, 1, 2, 3]) {
    const pTop = categoryProbability(3, theta, a);
    assert.ok(pTop > prev, "P(top category) must increase with theta");
    prev = pTop;
  }
});

test("category boundaries are strictly increasing and deliberately asymmetric", () => {
  for (let i = 1; i < CATEGORY_BOUNDARIES.length; i += 1) {
    assert.ok(CATEGORY_BOUNDARIES[i] > CATEGORY_BOUNDARIES[i - 1], "boundaries must be ordered");
  }
  const lowGap = CATEGORY_BOUNDARIES[1] - CATEGORY_BOUNDARIES[0];
  const highGap = CATEGORY_BOUNDARIES[2] - CATEGORY_BOUNDARIES[1];
  assert.ok(Math.abs(lowGap - highGap) > 0.05,
    "evenly spaced boundaries collapse the GRM into a linear weighted sum — that was the original bug");
});

test("the graded score is NOT algebraically identical to the weighted sum", () => {
  // The regression this file exists for. Under the old parameters these were
  // equal for every possible response pattern.
  let differing = 0;
  for (const v of [0, 1, 2, 3]) {
    const s = scoreCheckin(uniform(v));
    if (Math.abs(s.graded - s.weighted) > 0.25) differing += 1;
  }
  assert.ok(differing >= 2, "the GRM must diverge from the weighted sum on at least some patterns");
});

// ---------------------------------------------------------------------------
// Determinism and monotonicity across the whole response space.
// ---------------------------------------------------------------------------

test("scoring is deterministic across repeated runs", () => {
  const pattern = { mood: 2, meaning: 1, connection: 3, accomplishment: 2, energy: 1, resilience: 2, sleep: 0 };
  const first = JSON.stringify(scoreCheckin(pattern));
  for (let i = 0; i < 20; i += 1) {
    assert.equal(JSON.stringify(scoreCheckin(pattern)), first);
  }
});

test("graded score is monotone non-decreasing in every item, over all 4^7 patterns", () => {
  const cache = new Map();
  const graded = (p) => {
    const key = KEYS.map((k) => p[k]).join("");
    if (!cache.has(key)) cache.set(key, gradedResponseScore(p));
    return cache.get(key);
  };
  let checked = 0;
  const walk = (i, acc) => {
    if (i === KEYS.length) {
      const base = graded(acc);
      for (const k of KEYS) {
        if (acc[k] >= 3) continue;
        const up = { ...acc, [k]: acc[k] + 1 };
        assert.ok(graded(up) >= base - 1e-9,
          `raising ${k} lowered the score: ${JSON.stringify(acc)}`);
        checked += 1;
      }
      return;
    }
    for (const v of [0, 1, 2, 3]) walk(i + 1, { ...acc, [KEYS[i]]: v });
  };
  walk(0, {});
  assert.ok(checked > 30000, `expected the full lattice to be checked, saw ${checked} comparisons`);
});

test("scores stay on the 0-21 scale for every uniform pattern", () => {
  for (const v of [0, 1, 2, 3]) {
    const s = scoreCheckin(uniform(v));
    assert.ok(s.graded >= SCORE_MIN && s.graded <= SCORE_MAX);
    assert.ok(s.weighted >= SCORE_MIN && s.weighted <= SCORE_MAX);
  }
});

// ---------------------------------------------------------------------------
// The MAP estimator: finite on extremes, shrunk toward the prior.
// ---------------------------------------------------------------------------

test("extreme response patterns produce a finite estimate (ML would diverge)", () => {
  for (const v of [0, 3]) {
    const fit = gradedResponseTheta(uniform(v));
    assert.ok(Number.isFinite(fit.theta), "theta must be finite for an all-same pattern");
    assert.ok(Math.abs(fit.theta) < 3, `MAP should shrink an extreme pattern inside +-3 SD, got ${fit.theta}`);
    assert.ok(fit.se > 0 && fit.se <= 1, "the N(0,1) prior bounds SE at 1");
  }
});

test("an all-max answer sheet does not score a perfect 21 — deliberate shrinkage", () => {
  const s = scoreCheckin(uniform(3));
  assert.ok(s.graded < SCORE_MAX, "a single perfect sheet is weak evidence of an extreme state");
  assert.ok(s.graded > SCORE_MID, "but it must still read clearly positive");
});

test("the posterior mode sits at the maximum of the log-posterior", () => {
  const pattern = { mood: 3, meaning: 2, connection: 1, accomplishment: 2, energy: 3, resilience: 1, sleep: 2 };
  const fit = gradedResponseTheta(pattern);
  const at = logPosterior(pattern, fit.theta);
  for (const delta of [-0.5, -0.2, -0.05, 0.05, 0.2, 0.5]) {
    assert.ok(logPosterior(pattern, fit.theta + delta) <= at + 1e-9,
      `log-posterior is higher ${delta} away from the reported mode`);
  }
});

test("the likelihood alone (no prior) is what the prior is correcting", () => {
  // Sanity check that logPosterior really is logLikelihood plus the prior
  // term, so the two are not silently the same function.
  const p = uniform(2);
  for (const theta of [-1, 0, 1.5]) {
    const diff = logLikelihood(p, theta) - logPosterior(p, theta);
    assert.ok(Math.abs(diff - 0.5 * theta * theta) < 1e-9);
  }
});

test("measurement SE is larger for less informative response patterns", () => {
  const extreme = gradedResponseTheta(uniform(0)).se;
  const middling = gradedResponseTheta(uniform(2)).se;
  assert.ok(extreme > middling, `an extreme pattern should be located less precisely (${extreme} vs ${middling})`);
});

test("a partial check-in is less precise than a complete one", () => {
  const complete = scoreCheckin(uniform(2));
  const partial = scoreCheckin({ mood: 2, energy: 2 });
  assert.ok(partial.scoreSE > complete.scoreSE,
    "answering two items must not be reported as precisely as answering seven");
  assert.ok(partial.observationVariance > complete.observationVariance);
});

test("observation variance is the SE in points squared plus the occasion floor", () => {
  const s = scoreCheckin(uniform(1));
  assert.ok(Math.abs(s.observationVariance - (s.scoreSE ** 2 + R_OCCASION_FLOOR)) < 1e-9);
  assert.ok(s.observationVariance > R_OCCASION_FLOOR);
  assert.ok(Math.abs(s.scoreSE - POINTS_PER_THETA * s.thetaSE) < 1e-9);
});

// ---------------------------------------------------------------------------
// Degenerate input.
// ---------------------------------------------------------------------------

test("null, empty and junk itemScores return a null score rather than throwing", () => {
  for (const bad of [null, undefined, {}, 5, "x", []]) {
    const s = scoreCheckin(bad);
    assert.equal(s.graded, null);
    assert.equal(s.band, null);
    assert.equal(s.itemsAnswered, 0);
  }
  assert.equal(weightedSum(null), null);
  assert.equal(gradedResponseTheta({}), null);
  assert.equal(gradedResponseScore({}), null);
});

test("out-of-range raw answers are clamped, not propagated", () => {
  const high = scoreCheckin(uniform(99));
  const low = scoreCheckin(uniform(-5));
  assert.ok(high.graded <= SCORE_MAX && high.graded > SCORE_MID);
  assert.ok(low.graded >= SCORE_MIN && low.graded < SCORE_MID);
  assert.equal(high.raw, 21);
  assert.equal(low.raw, 0);
});

// ---------------------------------------------------------------------------
// Bands and reliability.
// ---------------------------------------------------------------------------

test("bands are derived from the scale range, ordered, and cover it", () => {
  assert.equal(scoreToBand(SCORE_MIN), "struggling");
  assert.equal(scoreToBand(SCORE_MAX), "flourishing");
  assert.equal(scoreToBand(PROVISIONAL_BAND_CUTOFFS.strugglingMax), "struggling");
  assert.equal(scoreToBand(PROVISIONAL_BAND_CUTOFFS.strugglingMax + 0.01), "navigating");
  assert.equal(scoreToBand(PROVISIONAL_BAND_CUTOFFS.navigatingMax), "navigating");
  assert.equal(scoreToBand(PROVISIONAL_BAND_CUTOFFS.navigatingMax + 0.01), "flourishing");
  assert.equal(scoreToBand(null), null);
  assert.equal(scoreToBand(NaN), null);
});

test("uniform answer patterns land in the expected bands", () => {
  assert.equal(scoreCheckin(uniform(0)).band, "struggling");
  assert.equal(scoreCheckin(uniform(3)).band, "flourishing");
  assert.equal(scoreCheckin(uniform(2)).band, "navigating");
});

test("cronbachAlpha returns null rather than a number it cannot support", () => {
  assert.equal(cronbachAlpha([]), null);
  assert.equal(cronbachAlpha([uniform(2)]), null);
  assert.equal(cronbachAlpha([uniform(2), uniform(2)]), null, "zero total variance is not an alpha of 1");
  const varied = cronbachAlpha([uniform(0), uniform(1), uniform(2), uniform(3)]);
  assert.ok(Number.isFinite(varied));
});
