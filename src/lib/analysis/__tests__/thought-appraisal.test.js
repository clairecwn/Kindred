import test from "node:test";
import assert from "node:assert/strict";
import { appraiseThoughts, deriveInterpretiveEmotion, saturatingEvidence } from "../thought-appraisal.js";
import { analyseText } from "../text-features.js";
import { AIJournalist, EmotionDetector, reconcileEmotion } from "../../journal-ai.js";

const COMPOSITION_CASES = [
  "Walao, my break ending soon and I gotta catch up on assignments, but it is unbearably humid and I have no mood to start.",
  "Weekend over already; must finish the backlog, the room is too noisy, and I cannot bring myself to begin.",
  "Holiday finishing liao, bo bian need chiong homework; sibei hot and sian to begin.",
];

test("varied wording composes transition, workload, discomfort and activation resistance", () => {
  for (const text of COMPOSITION_CASES) {
    const result = appraiseThoughts(text);
    assert.ok(result.dimensions.futureThreat > 0.35, text);
    assert.ok(result.dimensions.anticipatedEffort > 0.45, text);
    assert.ok(result.dimensions.activationResistance > 0.4, text);
    assert.ok(result.dimensions.physicalDiscomfort > 0.4, text);
    assert.ok(result.dimensions.goalObstruction > 0.35, text);
    assert.ok(result.vadDelta.arousal > 0, text);
  }
});

test("paraphrases resolve to frustration, low motivation and dread—not generic sadness", () => {
  for (const text of COMPOSITION_CASES) {
    const features = analyseText(text);
    const result = deriveInterpretiveEmotion(features, "sad");
    assert.equal(result.family, "angry", text);
    assert.match(result.emotion, /frustrated/, text);
    assert.match(result.emotion, /unmotivated/, text);
    assert.match(result.emotion, /dreading/, text);
    assert.notEqual(result.emotion, "sad", text);
    assert.ok(features.vad.arousal > 0, text);
  }
});

test("exponential evidence is bounded, monotone and diminishing", () => {
  assert.equal(saturatingEvidence(0), 0);
  assert.ok(saturatingEvidence(1) < saturatingEvidence(2));
  assert.ok(saturatingEvidence(2) < 1);
  assert.ok(saturatingEvidence(2) - saturatingEvidence(1) < saturatingEvidence(1) - saturatingEvidence(0));
});

test("plain workload without emotional or appraisal language is not over-read", () => {
  const result = appraiseThoughts("I completed my work today");
  assert.equal(result.dimensions.activationResistance, 0);
  assert.equal(result.dimensions.futureThreat, 0);
});

test("journal analysis and local fallback turn the composed meaning into a processing reflection", () => {
  const text = COMPOSITION_CASES[0];
  const analysis = new EmotionDetector().analyze(text);
  assert.equal(analysis.emotion, "frustrated, unmotivated, and dreading the demands ahead");
  assert.equal(analysis.emotionFamily, "angry");
  const response = new AIJournalist()._templateResponse(text, analysis, []);
  assert.equal(response.source, "companion-appraisal");
  assert.match(response.text, /room to reset|settle|switch off|off-duty/i);
  assert.match(response.text, /responsibility|demand|work|amount/i);
  assert.match(response.text, /physical discomfort|environment|humid|heat/i);
  assert.match(response.text, /\?/);
  assert.doesNotMatch(response.text, /you sound|not simply|not just|sad/i);
  assert.doesNotMatch(response.text, /heavy without a clear reason/i);
});

test("a generic same-valence LLM label cannot erase a nuanced appraisal", () => {
  const reconciled = reconcileEmotion("sad", COMPOSITION_CASES[1]);
  assert.equal(reconciled.overruled, true);
  assert.equal(reconciled.source, "deterministic-appraisal-override");
  assert.match(reconciled.emotion, /frustrated/);
});

const OUTCOME_DISAPPOINTMENT_CASES = [
  "Training was really tough and I wasn't performing my best, hopefully the next session goes better.",
  "The match felt rough and I played poorly today, but I hope tomorrow will be better.",
  "That rehearsal was exhausting and did not go well; wish the next attempt is better.",
];

test("difficult performance shortfalls resolve to disappointment and frustration, not anger", () => {
  for (const text of OUTCOME_DISAPPOINTMENT_CASES) {
    const features = analyseText(text);
    const result = deriveInterpretiveEmotion(features, "angry");
    assert.ok(features.appraisal.dimensions.outcomeDiscrepancy >= 0.4, text);
    assert.ok(features.appraisal.dimensions.effortfulExperience >= 0.4, text);
    assert.ok(features.appraisal.dimensions.futureHope >= 0.4, text);
    assert.match(result.emotion, /disappointed/, text);
    assert.match(result.emotion, /frustrated/, text);
    assert.notEqual(result.family, "angry", text);
  }
});

test("outcome appraisal produces a specific processing response instead of an anger script", () => {
  const text = OUTCOME_DISAPPOINTMENT_CASES[0];
  const analysis = new EmotionDetector().analyze(text);
  const response = new AIJournalist()._templateResponse(text, analysis, []);
  assert.equal(response.source, "companion-appraisal");
  assert.match(response.text, /demanding|effort|perform/i);
  assert.match(response.text, /next|better|rough attempt/i);
  assert.doesNotMatch(response.text, /angry|hurt|disrespect|underneath it/i);
});
