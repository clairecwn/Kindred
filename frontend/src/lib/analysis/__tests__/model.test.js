import test from "node:test";
import assert from "node:assert/strict";
import { analyseUser, dayToObservation, TEXT_MIN_CONFIDENCE, MODEL_VERSION } from "../index.js";
import { GATE_THRESHOLDS } from "../cold-start.js";
import { ITEM_WEIGHTS, SCORE_MID } from "../checkin-scoring.js";
import { steadyStateP, DEFAULT_KAPPA, DEFAULT_SIGMA, DEFAULT_R, DEFAULT_P0 } from "../state-filter.js";

const KEYS = Object.keys(ITEM_WEIGHTS);
const uniform = (v) => Object.fromEntries(KEYS.map((k) => [k, v]));
const dayKey = (i) => new Date(Date.UTC(2026, 0, 1) + (i - 1) * 86400000).toISOString().slice(0, 10);
const checkinDay = (i, v) => ({ date: dayKey(i), itemScores: uniform(v) });

function historyOf(n, value) {
  return Array.from({ length: n }, (_, i) => checkinDay(i + 1, typeof value === "function" ? value(i + 1) : value));
}

// ---------------------------------------------------------------------------
// Determinism.
// ---------------------------------------------------------------------------

test("analyseUser is deterministic: identical inputs give identical output, repeatedly", () => {
  const history = historyOf(29, (i) => (i < 15 ? 3 : 1));
  const entry = { ...checkinDay(30, 2), journalText: "Feeling a bit flat but I managed to get out for a walk." };
  const first = JSON.stringify(analyseUser(history, entry));
  for (let i = 0; i < 10; i += 1) {
    assert.equal(JSON.stringify(analyseUser(history, entry)), first, `run ${i} differed`);
  }
});

test("analyseUser never consults an LLM, a clock or a random source", () => {
  // A clock dependency would show up as a different result when Date.now
  // moves; a random dependency as a different result with Math.random stubbed.
  const history = historyOf(10, 2);
  const entry = checkinDay(11, 1);
  const baseline = JSON.stringify(analyseUser(history, entry));

  const realRandom = Math.random;
  const realNow = Date.now;
  try {
    Math.random = () => 0.999999;
    Date.now = () => 4102444800000; // 2100-01-01
    assert.equal(JSON.stringify(analyseUser(history, entry)), baseline);
  } finally {
    Math.random = realRandom;
    Date.now = realNow;
  }
});

// ---------------------------------------------------------------------------
// Degenerate and boundary inputs.
// ---------------------------------------------------------------------------

test("no history and no entry says nothing at all", () => {
  const r = analyseUser([], {});
  assert.equal(r.sayNothing, true);
  assert.equal(r.confidence, 0);
  assert.equal(r.gates.checkinCount, 0);
});

test("junk arguments do not throw", () => {
  for (const [h, e] of [[null, null], [undefined, undefined], ["x", 5], [[null, undefined], {}], [[{}], {}]]) {
    assert.doesNotThrow(() => analyseUser(h, e));
  }
});

test("a single check-in produces a state estimate but no trend claim of any kind", () => {
  const r = analyseUser([], checkinDay(1, 2));
  assert.equal(r.checkinCount, 1);
  assert.ok(Number.isFinite(r.latentState.theta));
  assert.equal(r.trend.window28.direction, "insufficient_data");
  assert.equal(r.trend.window28.suppressedByGate, true);
  assert.equal(r.trend.window90.direction, "insufficient_data");
  assert.ok(r.confidence < 0.4, `one check-in must not yield high confidence, got ${r.confidence}`);
});

test("an all-identical history reports a steady trend, not a direction", () => {
  const history = historyOf(29, 2);
  const r = analyseUser(history, checkinDay(30, 2));
  assert.equal(r.trend.window28.direction, "steady");
  assert.equal(r.trend.window28.slope, 0);
  assert.ok(r.latentState.P > 0, "posterior variance must stay strictly positive");
});

test("extreme constant scores stay on the scale and do not blow the filter up", () => {
  for (const v of [0, 3]) {
    const r = analyseUser(historyOf(39, v), checkinDay(40, v));
    assert.ok(r.latentState.theta >= 0 && r.latentState.theta <= 21, `theta escaped the scale: ${r.latentState.theta}`);
    assert.ok(Number.isFinite(r.latentState.P) && r.latentState.P > 0);
    assert.ok(Number.isFinite(r.confidence));
  }
});

test("out-of-order history is tolerated rather than throwing", () => {
  const history = [checkinDay(5, 2), checkinDay(1, 3), checkinDay(3, 1)];
  assert.doesNotThrow(() => analyseUser(history, checkinDay(2, 2)));
});

// ---------------------------------------------------------------------------
// Gates: the app must not assert what it cannot support.
// ---------------------------------------------------------------------------

test("trend direction is suppressed below the gate and available at it, across history lengths", () => {
  // A hard, sustained decline, so the regression would happily call a
  // direction at every length if the gate did not stop it.
  const declining = (n) => historyOf(n, (i) => (i <= Math.floor(n / 2) ? 3 : 0));
  for (let n = 1; n <= 12; n += 1) {
    const history = declining(n - 1);
    const r = analyseUser(history, checkinDay(n, 0));
    if (n < GATE_THRESHOLDS.trend) {
      assert.equal(r.trend.window28.direction, "insufficient_data", `n=${n} leaked a trend`);
      assert.equal(r.trend.window28.suppressedByGate, true);
      assert.equal(r.baselineSteps, undefined, `n=${n} exposed baseline steps before the trend gate`);
    } else {
      assert.notEqual(r.trend.window28.suppressedByGate, true, `n=${n} still suppressed after the gate`);
      assert.ok(Array.isArray(r.baselineSteps));
    }
  }
});

test("the 90-day window stays suppressed until the full-feature gate", () => {
  const r29 = analyseUser(historyOf(28, (i) => (i < 14 ? 3 : 1)), checkinDay(29, 1));
  assert.equal(r29.trend.window90.suppressedByGate, true);
  const r31 = analyseUser(historyOf(30, (i) => (i < 15 ? 3 : 1)), checkinDay(31, 1));
  assert.equal(r31.trend.window90.suppressedByGate, undefined);
});

test("journalling does not buy check-in gates", () => {
  const journalOnly = Array.from({ length: 20 }, (_, i) => ({
    date: dayKey(i + 1),
    journalText: "I felt quite low and drained today, it was hard.",
  }));
  const r = analyseUser(journalOnly, { date: dayKey(21), journalText: "Still tired." });
  assert.equal(r.checkinCount, 0);
  assert.equal(r.gates.trend, false);
  assert.equal(r.trend.window28.direction, "insufficient_data");
});

test("confidence rises with evidence and is capped well below certainty", () => {
  const confs = [1, 5, 10, 30, 90].map((n) => analyseUser(historyOf(n - 1, 2), checkinDay(n, 2)).confidence);
  for (let i = 1; i < confs.length; i += 1) {
    assert.ok(confs[i] > confs[i - 1], `confidence did not increase from n=${i}: ${confs}`);
  }
  assert.ok(confs[confs.length - 1] < 0.85,
    `confidence must never approach certainty from self-report items, got ${confs[confs.length - 1]}`);
});

// ---------------------------------------------------------------------------
// Filter convergence against known ground truth.
// ---------------------------------------------------------------------------

/**
 * Deterministic pseudo-noise, so a "noisy" trajectory is still reproducible.
 * A seeded LCG, not Math.random: a flaky convergence test is worse than none.
 */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Map a target latent value in points to the nearest uniform 0-3 pattern. */
function patternForTarget(points) {
  const v = Math.max(0, Math.min(3, Math.round((points / 21) * 3)));
  return uniform(v);
}

test("the filter converges on a constant ground-truth trajectory", () => {
  // Ground truth: the user genuinely sits at the "all 2s" level every day.
  const history = historyOf(59, 2);
  const r = analyseUser(history, checkinDay(60, 2));
  const target = r.todayScore.graded; // what a perfect observation of that day says
  assert.ok(Math.abs(r.latentState.theta - target) < 1.0,
    `theta ${r.latentState.theta} should sit near the observed level ${target}`);
});

test("the posterior variance converges to the analytic steady state", () => {
  const r = analyseUser(historyOf(59, 2), checkinDay(60, 2));
  const R = r.todayScore.observationVariance;
  const expected = steadyStateP({ dt: 1, kappa: DEFAULT_KAPPA, sigma: DEFAULT_SIGMA, R });
  assert.ok(Math.abs(r.latentState.P - expected) < 0.05,
    `P converged to ${r.latentState.P}, analytic steady state is ${expected}`);
  assert.ok(r.latentState.P < DEFAULT_P0, "P must fall below the prior");
});

test("steadyStateP behaves correctly at the limits", () => {
  const tight = steadyStateP({ dt: 1, R: 0.01 });
  const loose = steadyStateP({ dt: 1, R: 1000 });
  assert.ok(tight < loose, "a noisier observation leaves more posterior uncertainty");
  const stationary = (DEFAULT_SIGMA ** 2) / (2 * DEFAULT_KAPPA);
  assert.ok(loose <= stationary * 1.01, "with useless observations P cannot exceed the stationary variance");
  const long = steadyStateP({ dt: 365, R: DEFAULT_R });
  const short = steadyStateP({ dt: 1, R: DEFAULT_R });
  assert.ok(long > short, "a longer gap between observations leaves more uncertainty");
});

test("the filter tracks a known step change and settles at the new level", () => {
  // 30 days at the top, then a hard step down to the bottom for 30 more.
  const history = historyOf(59, (i) => (i <= 30 ? 3 : 0));
  const r = analyseUser(history, checkinDay(60, 0));
  const lowLevel = analyseUser([], checkinDay(1, 0)).todayScore.graded;
  assert.ok(Math.abs(r.latentState.theta - lowLevel) < 2.0,
    `after 30 days at the new level theta should be near ${lowLevel}, got ${r.latentState.theta}`);
  assert.equal(r.trend.window28.direction, "steady",
    "the 28-day window sees only the post-step period, which is flat");
});

test("the filter smooths deterministic noise around a known constant level", () => {
  const rand = lcg(20260915);
  // Ground truth level ~14 points ("all 2s"); observations jitter by +-1 band.
  const history = Array.from({ length: 59 }, (_, i) => {
    const jitter = rand() < 0.5 ? 1 : 3;
    return checkinDay(i + 1, jitter);
  });
  const r = analyseUser(history, checkinDay(60, 2));
  const observations = history.map((d) => d.itemScores.mood);
  const observedSpread = Math.max(...observations) - Math.min(...observations);
  assert.ok(observedSpread === 2, "the synthetic observations really do swing across two categories");
  // The filtered state must sit between the two levels, not at either
  // extreme: that is what smoothing means.
  const low = analyseUser([], checkinDay(1, 1)).todayScore.graded;
  const high = analyseUser([], checkinDay(1, 3)).todayScore.graded;
  assert.ok(r.latentState.theta > low && r.latentState.theta < high,
    `theta ${r.latentState.theta} should lie between ${low} and ${high}`);
});

test("a long gap between check-ins widens uncertainty rather than pretending nothing happened", () => {
  const recent = analyseUser(historyOf(9, 2), checkinDay(10, 2));
  const gapped = analyseUser(historyOf(9, 2), { date: dayKey(400), itemScores: uniform(2) });
  assert.ok(gapped.latentState.pPred > recent.latentState.pPred,
    "a 13-month gap must leave the prediction less certain than a one-day gap");
});

// ---------------------------------------------------------------------------
// Observations from text: the no-API-key path.
// ---------------------------------------------------------------------------

test("a journal entry with real lexical evidence becomes an observation", () => {
  const obs = dayToObservation({ date: dayKey(1), journalText: "I feel hopeless and completely exhausted." });
  assert.ok(obs);
  assert.equal(obs.kind, "text");
  assert.ok(obs.value < SCORE_MID, "a clearly negative entry must pull the state down");
  assert.ok(obs.R > 0);
});

test("a journal entry with no lexical evidence is NOT an observation", () => {
  assert.equal(dayToObservation({ date: dayKey(1), journalText: "Took the bus. Bought milk." }), null);
  assert.equal(dayToObservation({ date: dayKey(1), journalText: "" }), null);
  assert.equal(dayToObservation(null), null);
  assert.equal(dayToObservation({ date: dayKey(1) }), null);
});

test("text observations are weaker evidence than check-ins", () => {
  const checkin = dayToObservation(checkinDay(1, 1));
  const text = dayToObservation({ date: dayKey(1), journalText: "I feel hopeless and completely exhausted." });
  assert.ok(text.R > checkin.R, "a journal line must not count as precisely as a completed check-in");
});

test("a day with both a check-in and a journal entry yields one observation, not two", () => {
  const obs = dayToObservation({ date: dayKey(1), itemScores: uniform(2), journalText: "I feel awful." });
  assert.equal(obs.kind, "checkin");
});

test("the app produces a full emotional reading from journalling alone", () => {
  const history = [
    { date: dayKey(1), journalText: "Everything feels heavy and I am exhausted." },
    { date: dayKey(2), journalText: "My chest feels tight and I can't sleep." },
  ];
  const r = analyseUser(history, { date: dayKey(3), journalText: "Nvm lor, used to it already" });
  assert.equal(r.checkinCount, 0);
  assert.equal(r.observationCount, 3);
  assert.ok(r.latentState.theta < SCORE_MID, "three distressed entries must move the state down");
  assert.ok(r.vad.valence < 0);
  assert.equal(r.emotionLabel, "sad");
  assert.equal(r.sayNothing, false);
  assert.ok(r.vadSources.includes("text"));
});

test("TEXT_MIN_CONFIDENCE is a real threshold, not zero", () => {
  assert.ok(TEXT_MIN_CONFIDENCE > 0 && TEXT_MIN_CONFIDENCE < 1);
});

// ---------------------------------------------------------------------------
// Affect blending and the LLM's (absence of) authority.
// ---------------------------------------------------------------------------

test("a check-in produces a VAD reading without any emotion labels being supplied", () => {
  const r = analyseUser([], checkinDay(1, 0));
  assert.ok(r.vad, "the check-in VAD path used to be null on every real check-in");
  assert.ok(r.vad.valence < 0);
  assert.deepEqual(r.vadSources, ["checkin"]);
});

test("check-in and journal readings are blended by evidence weight", () => {
  const r = analyseUser([], { ...checkinDay(1, 3), journalText: "I feel hopeless, worthless and completely alone." });
  assert.deepEqual(r.vadSources, ["checkin", "text"]);
  const checkinOnly = analyseUser([], checkinDay(1, 3)).vad.valence;
  assert.ok(r.vad.valence < checkinOnly, "a distressed journal entry must pull a cheerful check-in down");
});

test("an LLM emotion label changes nothing and is labelled as such", () => {
  const history = historyOf(9, 2);
  const entry = { ...checkinDay(10, 2), journalText: "A fairly ordinary day, I felt calm." };
  const without = analyseUser(history, entry);
  const withLLM = analyseUser(history, entry, { llmEmotion: "angry" });

  for (const key of ["confidence", "statePrecision", "evidenceSufficiency", "positivity", "emotionLabel"]) {
    assert.deepEqual(withLLM[key], without[key], `the LLM label changed ${key}`);
  }
  assert.deepEqual(withLLM.vad, without.vad);
  assert.deepEqual(withLLM.latentState, without.latentState);
  assert.equal(withLLM.supplementary.llmReading.influencedScore, false);
  assert.equal(withLLM.supplementary.llmReading.emotion, "angry");
  assert.equal(withLLM.supplementary.llmReading.agreesWithDeterministic, false);
  assert.deepEqual(without.supplementary, {});
});

test("dialectical affect is computed from the text, not from fields nothing supplies", () => {
  const r = analyseUser([], {
    date: dayKey(1),
    journalText: "I was grateful for the help and proud of myself, but I still feel hopeless and exhausted.",
  });
  assert.ok(r.dialecticalAffect, "dialecticalAffect used to be permanently false");
  assert.ok(r.dialecticalAffect.positiveScore > 0);
  assert.ok(r.dialecticalAffect.negativeScore > 0);
  const flat = analyseUser([], { date: dayKey(1), journalText: "I feel hopeless and exhausted." });
  assert.equal(flat.dialecticalAffect.dialectical, false);
});

// ---------------------------------------------------------------------------
// Safety.
// ---------------------------------------------------------------------------

test("crisis language is surfaced at the top level and nothing softens it", () => {
  const history = historyOf(29, 3); // an otherwise excellent history
  const r = analyseUser(history, { ...checkinDay(30, 3), journalText: "I want to die." });
  assert.equal(r.safety.isCrisis, true);
  assert.ok(r.safety.matched.length > 0);
});

test("safety is reported even when there is nothing else to say", () => {
  const r = analyseUser([], { journalText: "I want to die." });
  assert.equal(r.safety.isCrisis, true);
});

test("ordinary entries are not flagged", () => {
  const r = analyseUser([], { date: dayKey(1), journalText: "Work was brutal and I was so tired I could have died." });
  assert.equal(r.safety.isCrisis, false);
});

// ---------------------------------------------------------------------------
// Result contract.
// ---------------------------------------------------------------------------

test("the fields WellnessView reads are present and correctly shaped", () => {
  const r = analyseUser(historyOf(20, 2), checkinDay(21, 1));
  assert.equal(typeof r.sayNothing, "boolean");
  assert.equal(typeof r.checkinCount, "number");
  assert.equal(typeof r.gates.trend, "boolean");
  assert.ok(Number.isFinite(r.todayScore.graded));
  assert.ok(["struggling", "navigating", "flourishing"].includes(r.todayScore.band));
  assert.equal(typeof r.modelVersion, "string");
  assert.equal(r.modelVersion, MODEL_VERSION);
});
