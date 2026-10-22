import test from "node:test";
import assert from "node:assert/strict";
import { sensePosterior, resolveSense, updateSenseCounts, ageDecay, sensesOf, ALPHA0 } from "../sense-model.js";
import { analyseDialect } from "../dialect/index.js";

const sian = { token: "sian", senses: [
  { id: "bored", vad: [-0.25, -0.35, 0], prior: 0.45, cues: [{ pattern: /\blecture\b/i, weight: 1.2 }] },
  { id: "resigned", vad: [-0.65, -0.4, -0.45], prior: 0.25, masksDistress: true, cues: [{ pattern: /\blife\b/i, weight: 1.3 }] },
] };

test("posterior is a proper distribution", () => {
  const post = sensePosterior(sian, { clause: "anything" });
  assert.ok(Math.abs(post.reduce((s, x) => s + x.p, 0) - 1) < 1e-12);
});

test("context cues move the reading in the right direction", () => {
  const lecture = resolveSense(sian, { clause: "lecture so long sian" });
  const life = resolveSense(sian, { clause: "sian life" });
  assert.equal(lecture.topSense.id, "bored");
  assert.equal(life.topSense.id, "resigned");
  assert.ok(life.mean[0] < lecture.mean[0]);
  assert.ok(life.maskP > lecture.maskP);
});

test("a person's confirmed meaning overrides the global prior after about ALPHA0 uses", () => {
  let counts = {};
  for (let i = 0; i < ALPHA0; i += 1) counts = updateSenseCounts(counts, "resigned");
  const personal = resolveSense(sian, { clause: "sian", userCounts: counts });
  assert.equal(personal.topSense.id, "resigned");
});

test("single-sense legacy entries reduce to their fixed shift exactly", () => {
  const legacy = { token: "shiok", valenceShift: 0.6, arousalShift: 0.3 };
  const r = resolveSense(legacy, { clause: "so shiok" });
  assert.equal(sensesOf(legacy).length, 1);
  assert.deepEqual(r.mean, [0.6, 0.3, 0]);
  assert.equal(r.variance, 0);
  assert.equal(r.entropy, 0);
});

test("ambiguity is reported as variance, which index.js turns into observation noise", () => {
  const vague = resolveSense(sian, {});
  const clear = resolveSense(sian, { clause: "life life life", userCounts: { resigned: 20 } });
  assert.ok(vague.variance > clear.variance);
});

test("dated meme senses decay toward floor while community use keeps them alive", () => {
  const meme = { token: "x", dated: { since: "2025-06-01", halfLifeDays: 180 }, senses: [
    { id: "literal", vad: [0, 0, 0], prior: 0.5 },
    { id: "meme", vad: [0.3, 0.4, 0], prior: 0.5, strategy: "play" },
  ] };
  const s = meme.senses[1];
  assert.equal(ageDecay(meme, s, "2025-06-01"), 1);
  assert.ok(ageDecay(meme, s, "2026-06-01") < 0.5);
  const faded = resolveSense(meme, { asOf: "2027-06-01" });
  const alive = resolveSense(meme, { asOf: "2027-06-01", communityCounts: { meme: 100 } });
  assert.equal(faded.topSense.id, "literal");
  assert.equal(alive.topSense.id, "meme");
});

test("Singlish senses resolve from context inside analyseDialect", () => {
  assert.equal(analyseDialect("lecture so long sian").matchedTokens[0].sense.id, "bored");
  assert.equal(analyseDialect("exam tmr die liao").matchedTokens[0].sense.id, "in-trouble");
  assert.equal(analyseDialect("ok lor no choice").maskedDistress, true);
  assert.equal(analyseDialect("ok lor see you then haha").maskedDistress, false);
  assert.ok(analyseDialect("walao this cake so good sia").matchedTokens[0].sense.id === "amazed");
});

test("a user's own counts for a Singlish term flow through analyseDialect", () => {
  const base = analyseDialect("sian");
  const personal = analyseDialect("sian", { senseCounts: { sian: { resigned: 10 } } });
  assert.ok(personal.valenceAdjustment < base.valenceAdjustment);
  assert.equal(personal.maskedDistress, true);
});
