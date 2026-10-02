import test from "node:test";
import assert from "node:assert/strict";
import { ouKalmanStep, initState, filterSeries, DEFAULT_KAPPA, DEFAULT_SIGMA, DEFAULT_R } from "../state-filter.js";

test("OU-Kalman step moves toward the observation and shrinks P", () => {
  const state = initState(12, 10);
  const step = ouKalmanStep(state, 18, { mu: 12, dt: 1 });
  assert.ok(step.theta > 12 && step.theta < 18, "theta should move toward the observation, not jump to it");
  assert.ok(step.P < state.P, "posterior variance should shrink after an update");
  assert.ok(step.K > 0 && step.K < 1, "Kalman gain should be a proper fraction");
});

test("a longer gap between observations widens predicted uncertainty", () => {
  const state = initState(12, 2); // already fairly confident
  const shortGap = ouKalmanStep(state, 12, { mu: 12, dt: 1 });
  const longGap = ouKalmanStep(state, 12, { mu: 12, dt: 20 });
  assert.ok(longGap.pPred > shortGap.pPred, "a 20-day gap should predict more uncertainty than a 1-day gap");
});

test("with mu equal to the true mean and no noise, repeated identical observations converge P downward", () => {
  let state = initState(10, 10);
  const ps = [];
  for (let i = 0; i < 30; i += 1) {
    const step = ouKalmanStep(state, 15, { mu: 10, dt: 1 });
    state = { theta: step.theta, P: step.P };
    ps.push(step.P);
  }
  assert.ok(ps[ps.length - 1] < ps[0], "P should trend downward as observations accumulate");
  assert.ok(Math.abs(state.theta - 15) < 5, "theta should have moved substantially toward repeated observations of 15");
});

test("filterSeries handles an irregular date series without throwing and returns one result per observation", () => {
  const observations = [
    { date: "2026-01-01", value: 14 },
    { date: "2026-01-02", value: 13 },
    { date: "2026-01-20", value: 8 }, // 18-day gap
    { date: "2026-01-21", value: 9 },
  ];
  const results = filterSeries(observations, { priorMean: 14 });
  assert.equal(results.length, observations.length);
  for (const r of results) {
    assert.ok(Number.isFinite(r.theta));
    assert.ok(Number.isFinite(r.P) && r.P > 0);
  }
  // The step right after the 18-day gap should show elevated predicted uncertainty
  // relative to the tight daily steps before it.
  assert.ok(results[2].pPred > results[1].P, "uncertainty should widen across the long gap");
});

test("defaults are sane and documented", () => {
  assert.ok(DEFAULT_KAPPA > 0);
  assert.ok(DEFAULT_SIGMA > 0);
  assert.ok(DEFAULT_R > 0);
});
