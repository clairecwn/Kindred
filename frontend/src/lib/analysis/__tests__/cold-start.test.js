import test from "node:test";
import assert from "node:assert/strict";
import { shrinkEstimate, evaluateGates, GATE_THRESHOLDS, POPULATION_PRIOR } from "../cold-start.js";

test("n=0 returns the pure population prior with zero shrinkage weight", () => {
  const result = shrinkEstimate({ n: 0, sampleMean: 20 });
  assert.equal(result.estimate, POPULATION_PRIOR.mean);
  assert.equal(result.shrinkageWeight, 0);
});

test("shrinkage weight increases monotonically with n", () => {
  const weights = [1, 5, 14, 30, 90].map(
    (n) => shrinkEstimate({ n, sampleMean: 5 }).shrinkageWeight
  );
  for (let i = 1; i < weights.length; i += 1) {
    assert.ok(weights[i] > weights[i - 1], `shrinkage weight should increase with n: ${weights}`);
  }
});

test("a large-n user's estimate is dominated by their own sample mean, not the population prior", () => {
  const farFromPopMean = POPULATION_PRIOR.mean + 8;
  const result = shrinkEstimate({ n: 200, sampleMean: farFromPopMean });
  assert.ok(result.shrinkageWeight > 0.95);
  assert.ok(Math.abs(result.estimate - farFromPopMean) < 1);
});

test("gate thresholds are a hard floor: exactly at the threshold passes, one below does not", () => {
  const atThreshold = evaluateGates(GATE_THRESHOLDS.trend);
  const belowThreshold = evaluateGates(GATE_THRESHOLDS.trend - 1);
  assert.equal(atThreshold.trend, true);
  assert.equal(belowThreshold.trend, false);
});

test("no trend claims before 7 check-ins, no rough-patch language before 14", () => {
  assert.equal(evaluateGates(6).trend, false);
  assert.equal(evaluateGates(7).trend, true);
  assert.equal(evaluateGates(13).roughPatch, false);
  assert.equal(evaluateGates(14).roughPatch, true);
});

test("sayNothing is true only with zero check-ins", () => {
  assert.equal(evaluateGates(0).sayNothing, true);
  assert.equal(evaluateGates(1).sayNothing, false);
});

test("evaluateGates is pure data-driven — every GATE_THRESHOLDS key appears as a boolean flag", () => {
  const gates = evaluateGates(10);
  for (const key of Object.keys(GATE_THRESHOLDS)) {
    assert.equal(typeof gates[key], "boolean", `missing or non-boolean flag for gate "${key}"`);
  }
});
