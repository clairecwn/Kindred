import test from "node:test";
import assert from "node:assert/strict";
import {
  EMOTION_VAD_ANCHORS, emotionToVAD, vadToEmotion, vadToEmotionDirectional,
  blendVAD, checkinVAD, checkinItemVAD, clampVADAxis,
  CHECKIN_ITEM_DIRECTIONS, CHECKIN_ITEM_WEIGHTS, NEUTRAL_RADIUS,
} from "../emotion-space.js";
import { ITEM_WEIGHTS } from "../checkin-scoring.js";

const KEYS = Object.keys(CHECKIN_ITEM_WEIGHTS);
const uniform = (v) => Object.fromEntries(KEYS.map((k) => [k, v]));

test("the local item-weight table cannot drift from checkin-scoring.js", () => {
  assert.deepEqual(CHECKIN_ITEM_WEIGHTS, ITEM_WEIGHTS);
});

test("every check-in item has a direction vector and vice versa", () => {
  assert.deepEqual(Object.keys(CHECKIN_ITEM_DIRECTIONS).sort(), KEYS.slice().sort());
  for (const [k, dir] of Object.entries(CHECKIN_ITEM_DIRECTIONS)) {
    for (const axis of ["v", "a", "d"]) {
      assert.ok(Number.isFinite(dir[axis]), `${k}.${axis} missing`);
      assert.ok(Math.abs(dir[axis]) <= 1, `${k}.${axis} out of range`);
    }
    assert.ok(dir.v > 0, `${k} must have positive valence direction — every question is worded so higher is better`);
  }
});

test("resilience is the item whose arousal direction is NEGATIVE", () => {
  // "Completely overwhelmed" (score 0) is a HIGH-arousal state and "felt
  // capable" (score 3) a settled one. A model that made arousal uniformly
  // increasing in score would read an overwhelmed day as deactivated.
  assert.ok(CHECKIN_ITEM_DIRECTIONS.resilience.a < 0);
  assert.ok(CHECKIN_ITEM_DIRECTIONS.energy.a > 0);
});

test("resilience and accomplishment carry the most dominance", () => {
  const byDominance = Object.entries(CHECKIN_ITEM_DIRECTIONS)
    .sort((a, b) => b[1].d - a[1].d)
    .map(([k]) => k);
  assert.deepEqual(byDominance.slice(0, 2).sort(), ["accomplishment", "resilience"]);
});

test("checkinItemVAD is monotone in every item on the valence axis", () => {
  for (const k of KEYS) {
    let prev = -Infinity;
    for (const v of [0, 1, 2, 3]) {
      const scores = { ...uniform(1), [k]: v };
      const val = checkinItemVAD(scores).valence;
      assert.ok(val > prev, `valence not increasing in ${k}`);
      prev = val;
    }
  }
});

test("checkinItemVAD is centred at the scale midpoint and symmetric about it", () => {
  const mid = checkinItemVAD(uniform(1.5));
  assert.ok(Math.abs(mid.valence) < 1e-9);
  assert.ok(Math.abs(mid.arousal) < 1e-9);
  assert.ok(Math.abs(mid.dominance) < 1e-9);

  const top = checkinItemVAD(uniform(3));
  const bottom = checkinItemVAD(uniform(0));
  assert.ok(Math.abs(top.valence + bottom.valence) < 1e-9, "the mapping must be symmetric about the midpoint");
});

test("checkinItemVAD needs no emotion labels — the old blend silently produced null without them", () => {
  const r = checkinItemVAD({ mood: 0, meaning: 0, connection: 0, accomplishment: 0, energy: 0, resilience: 0, sleep: 0 });
  assert.equal(r.itemsUsed, 7);
  assert.ok(r.valence < 0);
  assert.ok(r.dominance < 0);
});

test("an overwhelmed check-in reads as activated, not deactivated", () => {
  // Low resilience, low mood, but energy not at the floor: the classic
  // agitated-distress pattern.
  const overwhelmed = { mood: 0, meaning: 1, connection: 0, accomplishment: 0, energy: 2, resilience: 0, sleep: 1 };
  const flat = { mood: 0, meaning: 1, connection: 0, accomplishment: 0, energy: 0, resilience: 2, sleep: 1 };
  const a = checkinItemVAD(overwhelmed);
  const b = checkinItemVAD(flat);
  assert.ok(a.arousal > b.arousal, "the overwhelmed pattern must carry more arousal than the flat one");
  assert.ok(a.dominance < b.dominance, "and less dominance");
});

test("partial check-ins use only the items answered", () => {
  const partial = checkinItemVAD({ mood: 3 });
  assert.equal(partial.itemsUsed, 1);
  assert.ok(partial.valence > 0);
  assert.equal(checkinItemVAD({}).itemsUsed, 0);
  assert.equal(checkinItemVAD(null).valence, 0);
});

test("all axes stay inside [-1, 1] for every uniform pattern", () => {
  for (const v of [0, 1, 2, 3]) {
    const r = checkinItemVAD(uniform(v));
    for (const axis of ["valence", "arousal", "dominance"]) {
      assert.ok(r[axis] >= -1 && r[axis] <= 1);
    }
  }
});

// ---------------------------------------------------------------------------
// Labelling.
// ---------------------------------------------------------------------------

test("directional labelling does not read a shrunk distressed point as neutral", () => {
  // The exact failure mode: a text reading shrunk toward the origin whose
  // nearest Euclidean anchor is "neutral" purely because it is short.
  const shrunkSad = { valence: -0.26, arousal: -0.13, dominance: -0.18 };
  assert.equal(vadToEmotion(shrunkSad).emotion, "neutral", "Euclidean matching is the behaviour being corrected");
  assert.equal(vadToEmotionDirectional(shrunkSad).emotion, "sad");
});

test("directional labelling returns neutral honestly when there is no direction", () => {
  assert.equal(vadToEmotionDirectional({ valence: 0, arousal: 0, dominance: 0 }).emotion, "neutral");
  assert.equal(vadToEmotionDirectional({ valence: NEUTRAL_RADIUS / 4, arousal: 0, dominance: 0 }).emotion, "neutral");
  assert.equal(vadToEmotionDirectional(null).emotion, "neutral");
});

test("directional labelling is scale-invariant", () => {
  const base = { valence: -0.5, arousal: 0.6, dominance: -0.5 };
  const scaled = { valence: -0.05, arousal: 0.06, dominance: -0.05 };
  assert.equal(vadToEmotionDirectional(base).emotion, vadToEmotionDirectional({ ...base, valence: base.valence * 2, arousal: base.arousal * 2, dominance: base.dominance * 2 }).emotion);
  // Below the neutral radius the reading has no usable direction.
  assert.equal(vadToEmotionDirectional(scaled).emotion, "neutral");
});

test("each anchor labels itself", () => {
  for (const key of Object.keys(EMOTION_VAD_ANCHORS)) {
    assert.equal(vadToEmotion(emotionToVAD(key)).emotion, key);
    if (key !== "neutral") {
      assert.equal(vadToEmotionDirectional(emotionToVAD(key)).emotion, key);
    }
  }
});

test("emotionToVAD returns a copy, so callers cannot mutate the anchor table", () => {
  const v = emotionToVAD("sad");
  v.valence = 1;
  assert.ok(EMOTION_VAD_ANCHORS.sad.valence < 0);
  assert.deepEqual(emotionToVAD("not-an-emotion"), { ...EMOTION_VAD_ANCHORS.neutral });
});

test("blendVAD is a weighted mean and handles degenerate inputs", () => {
  const blended = blendVAD([
    { valence: 1, arousal: 0, dominance: 0, weight: 3 },
    { valence: -1, arousal: 0, dominance: 0, weight: 1 },
  ]);
  assert.ok(Math.abs(blended.valence - 0.5) < 1e-9);
  assert.equal(blended.weightTotal, 4);
  assert.equal(blendVAD([]).weightTotal, 0);
  assert.equal(blendVAD(null).valence, 0);
  assert.equal(blendVAD([{ valence: 1, weight: 0 }]).valence, 0);
});

test("checkinVAD (label-based path) still works for callers that do have labels", () => {
  const r = checkinVAD([{ emotion: "sad", score: 0 }, { emotion: "happy", score: 3 }]);
  assert.ok(r.valence > 0, "the higher-scored answer should dominate the centroid");
  assert.equal(checkinVAD([]).weightTotal, 0);
});

test("clampVADAxis bounds the axis", () => {
  assert.equal(clampVADAxis(5), 1);
  assert.equal(clampVADAxis(-5), -1);
  assert.equal(clampVADAxis(0.3), 0.3);
});
