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

import { detectCrisisInConversation, crisisResourcesText, safetySkeleton } from "../crisis-detection.js";

test("disguised spellings are still caught", () => {
  for (const text of ["i want to kiiiill myself", "k m s", "k.m.s fr", "su1c1de thoughts", "thinking about suicde",
    "i wanna d1e", "kil myslef", "i just want to end my liiife", "I WANT TO DIE", "wanna unaliveee myself", "i wanna kms"]) {
    assert.equal(detectCrisisLanguage(text).isCrisis, true, text);
  }
});

test("everyday look-alikes are not flagged", () => {
  for (const text of ["kill time before class", "I could die of embarrassment lol", "dead tired", "ran 5 kms today",
    "this homework is killing me haha", "myself and my friends went out", "die liao exam tmr", "killer workout"]) {
    assert.equal(detectCrisisLanguage(text).isCrisis, false, text);
  }
});

test("a phrase split across two messages is caught", () => {
  const r = detectCrisisInConversation("die", [{ role: "user", text: "i just want to" }, { role: "ai", text: "?" }]);
  assert.equal(r.isCrisis, true);
  assert.equal(r.splitAcrossMessages, true);
  assert.equal(detectCrisisInConversation("lunch was nice", [{ role: "user", text: "ok" }]).isCrisis, false);
});

test("the skeleton only normalises; the resources text carries real numbers", () => {
  assert.equal(safetySkeleton("K.I.L.L   mysellf!!"), "kil myself");
  assert.match(crisisResourcesText(), /1767/);
});
