import test from "node:test";
import assert from "node:assert/strict";
import { detectCrisisLanguage, CRISIS_RESPONSE } from "../crisis-detection.js";

test("flags explicit crisis phrases", () => {
  const r = detectCrisisLanguage("I just want to end my life, I can't do this anymore.");
  assert.equal(r.isCrisis, true);
  assert.ok(r.matched.includes("end my life"));
});

test("does not flag ordinary venting", () => {
  const r = detectCrisisLanguage("Work was so exhausting today, I feel dead tired.");
  assert.equal(r.isCrisis, false);
  assert.deepEqual(r.matched, []);
});

test("handles empty/undefined text safely", () => {
  for (const input of ["", undefined, null, 0, {}, []]) {
    const r = detectCrisisLanguage(input);
    assert.equal(r.isCrisis, false);
    assert.deepEqual(r.matched, []);
  }
});

test("CRISIS_RESPONSE contains no clinical terms and routes to human resources", () => {
  const clinicalTerms = ["disorder", "diagnosis", "depression", "clinical", "ideation"];
  const lower = CRISIS_RESPONSE.text.toLowerCase();
  for (const term of clinicalTerms) {
    assert.equal(lower.includes(term), false, `should not contain "${term}"`);
  }
  assert.ok(CRISIS_RESPONSE.resources.length > 0);
  assert.equal(CRISIS_RESPONSE.isCrisisResponse, true);
});
