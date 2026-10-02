import test from "node:test";
import assert from "node:assert/strict";
import { createBaselineState, updateBaseline, runBaseline, trendSlope, SIGMA_FLOOR } from "../baseline.js";

/**
 * THE DRIFT TRAP TEST.
 *
 * Simulates a user declining 0.05 points/day (0-21 scale) for 60 days,
 * daily check-ins, no noise. This is deliberately smooth and slow so that a
 * naive single-EWMA z-score (comparing today to yesterday's re-anchored
 * baseline) sees almost nothing wrong at any single step, while the
 * fast-vs-slow baseline gap accumulates into a real, flagged drift signal.
 */
test("a smooth 60-day decline fires the two-baseline drift signal while a naive single-baseline z-score does not", () => {
  const n = 60;
  const start = 15;
  const dailyDecline = 0.05;
  const values = Array.from({ length: n }, (_, t) => start - dailyDecline * t);

  // --- Two-baseline (fast vs slow) machinery under test ---------------------
  let state = createBaselineState(values[0]);
  let maxAbsDrift = 0;
  let driftFiredAt = null;
  for (let t = 1; t < n; t += 1) {
    const result = updateBaseline(state, values[t], 1);
    state = result.state;
    maxAbsDrift = Math.max(maxAbsDrift, Math.abs(result.driftSignal));
    if (result.driftSignificant && driftFiredAt === null) driftFiredAt = t;
  }

  assert.ok(driftFiredAt !== null, "the fast-vs-slow drift signal should fire at some point during a 60-day decline");
  assert.ok(maxAbsDrift >= 1.0, `expected the drift gap to grow to at least 1 point over a quarter-long decline, got ${maxAbsDrift}`);

  // --- Naive single-EWMA z-score, replicated inline for comparison ----------
  // Uses the SAME alpha as the fast baseline (0.20) and the doc's own
  // sigma floor, comparing each day to the PRE-update baseline (doc 3.2's
  // t-1 rule) — the fair, best-case version of the naive approach.
  const naiveAlpha = 0.20;
  let naiveMean = values[0];
  let naiveVar = 0;
  let maxAbsZ = 0;
  for (let t = 1; t < n; t += 1) {
    const sigma = Math.max(Math.sqrt(naiveVar), SIGMA_FLOOR);
    const z = (values[t] - naiveMean) / sigma;
    maxAbsZ = Math.max(maxAbsZ, Math.abs(z));
    const dev = values[t] - naiveMean;
    naiveVar = naiveAlpha * dev * dev + (1 - naiveAlpha) * naiveVar;
    naiveMean = naiveAlpha * values[t] + (1 - naiveAlpha) * naiveMean;
  }

  assert.ok(maxAbsZ < 1.0, `expected the naive re-anchoring z-score to stay small (< 1.0) throughout, got ${maxAbsZ}`);

  // The point of the whole module: the drift signal sees something the naive
  // z-score structurally cannot, despite both looking at the same data.
  assert.ok(maxAbsDrift > maxAbsZ, "the drift signal should be more sensitive to sustained slow decline than a naive re-anchoring z-score");
});

test("a stable, noise-free series produces no changepoint and near-zero drift", () => {
  const values = Array.from({ length: 40 }, () => 15);
  let state = createBaselineState(15);
  let anyChangepoint = false;
  for (const v of values) {
    const result = updateBaseline(state, v, 1);
    state = result.state;
    if (result.changepointFlag) anyChangepoint = true;
  }
  assert.equal(anyChangepoint, false);
  assert.ok(Math.abs(state.fastMean - state.slowMean) < 0.01);
});

test("a sharp step change trips the CUSUM changepoint detector", () => {
  const before = Array.from({ length: 20 }, () => 15);
  const after = Array.from({ length: 20 }, () => 6); // a large, sustained drop
  const history = [...before, ...after].map((value, i) => ({ date: new Date(2026, 0, 1 + i), value }));
  const { steps } = runBaseline(history, 15);
  const flagged = steps.some((s) => s.changepointFlag === "down");
  assert.ok(flagged, "a sustained large drop should trip a 'down' changepoint flag");
});

test("trendSlope reports insufficient_data with too few points and a real direction with a clear trend", () => {
  const tooFew = [
    { date: "2026-02-01", value: 14 },
    { date: "2026-02-02", value: 13 },
  ];
  const insufficient = trendSlope(tooFew, 28);
  assert.equal(insufficient.direction, "insufficient_data");

  const decliningDates = Array.from({ length: 20 }, (_, i) => ({
    date: new Date(2026, 1, 1 + i),
    value: 18 - i * 0.4,
  }));
  const trend = trendSlope(decliningDates, 28);
  assert.equal(trend.direction, "down");
  assert.ok(trend.ci95[1] < 0, "a clear steady decline should produce a CI that excludes zero");
});
