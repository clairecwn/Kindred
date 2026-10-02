import test from "node:test";
import assert from "node:assert/strict";
import { selectCompanionStrategy, validateCompanionResponse } from "../response-strategy.js";
import { analyseText } from "../text-features.js";

const TASK_AVERSION_CASES = [
  "Aiyo, time off is ending soon, I have to finish assignments, and this humid room makes it hard to start.",
  "The weekend is over already, my backlog is piling up, and I have no mood while this place is so noisy.",
];

test("masked Singlish gets tentative reflection rather than neutral reassurance", () => {
  const strategy = selectCompanionStrategy({
    vad: { valence: -0.3, arousal: -0.1, dominance: -0.1 },
    vadConfidence: 0.7,
    dialectMaskedDistress: true,
    textFeatures: { maskedDistress: true, agency: { adjustment: -0.18 } },
  });
  assert.equal(strategy.mode, "tentative-understatement-reflection");
  assert.match(strategy.interpretation, /possibility—not a fact/);
  assert.match(strategy.copingCues.join(" "), /constrained/);
});

test("mixed affect receives a both-and response strategy", () => {
  const strategy = selectCompanionStrategy({
    vad: { valence: 0.02, arousal: 0.2, dominance: 0 },
    vadConfidence: 0.6,
    dialecticalAffect: true,
    textFeatures: { agency: { adjustment: 0 } },
  });
  assert.equal(strategy.mode, "double-sided-reflection");
  assert.match(strategy.interpretation, /both\/and/);
});

test("high-arousal distress is met calmly before any exploration", () => {
  const strategy = selectCompanionStrategy({
    vad: { valence: -0.4, arousal: 0.5, dominance: -0.2 },
    vadConfidence: 0.8,
    textFeatures: { agency: { adjustment: 0 } },
  });
  assert.equal(strategy.mode, "contain-and-clarify");
  assert.match(strategy.reaction, /calm/);
});

test("response validator rejects robotic, clinical, and advice-first copy", () => {
  assert.equal(validateCompanionResponse("Thank you for sharing. Your feelings are valid and I understand.").ok, false);
  assert.equal(validateCompanionResponse("Your nervous system is dysregulated, so you should try to meditate now.").ok, false);
  assert.equal(validateCompanionResponse("That cancellation seems to have left you disappointed, especially after you had been looking forward to it. Does that fit?").ok, true);
  assert.equal(validateCompanionResponse("You sound fed up and frustrated—not simply sad.").ok, false);
  assert.equal(validateCompanionResponse("You're allowed to be angry. What is underneath it—what got hurt or disrespected?").ok, false);
});

test("performance disappointment does not select an anger-oriented strategy", () => {
  const features = analyseText("The rehearsal was tough and I did not perform my best, but I hope next time is better.");
  const strategy = selectCompanionStrategy({
    vad: features.vad,
    vadConfidence: features.vadConfidence,
    textFeatures: features,
  });
  assert.equal(strategy.mode, "outcome-disappointment");
  assert.match(strategy.interpretation, /not evidence of anger/i);
});

test("compound Singlish task aversion gets a frustration strategy, not generic sadness", () => {
  for (const text of TASK_AVERSION_CASES) {
    const features = analyseText(text);
    const strategy = selectCompanionStrategy({
      vad: features.vad,
      vadConfidence: features.vadConfidence,
      textFeatures: features,
    });
    assert.equal(strategy.mode, "frustration-and-task-aversion", text);
    assert.match(strategy.interpretation, /do not collapse them into sadness/, text);
  }
});

test("validator requires cause-grounded prose for strong task aversion", () => {
  const features = analyseText(TASK_AVERSION_CASES[0]);
  const context = { features };
  assert.equal(validateCompanionResponse(
    "Some days just feel heavy without a clear reason, but you do not have to carry it alone.",
    context,
  ).ok, false);
  assert.equal(validateCompanionResponse(
    "The shrinking time off and unfinished assignments feel frustrating, while the humid room makes getting started even harder.",
    context,
  ).ok, true);
});
