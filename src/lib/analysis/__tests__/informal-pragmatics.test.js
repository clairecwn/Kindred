import test from "node:test";
import assert from "node:assert/strict";
import {
  collapseExpressiveLengthening,
  normaliseInformalWriting,
  resolveInformalMarkers,
} from "../informal-pragmatics.js";
import { analyseText, textVAD } from "../text-features.js";

test("common short forms are normalized without discarding the original surface", () => {
  const result = normaliseInformalWriting("tdy idk abt ur work rn");
  assert.equal(result.normalizedText, "today idk about your work right now");
  assert.deepEqual(result.replacements.map((item) => item.surface), ["tdy", "rn", "abt", "ur"]);
});

test("expressive lengthening is normalized only after three repeated letters", () => {
  assert.equal(collapseExpressiveLengthening("soooo"), "so");
  assert.equal(collapseExpressiveLengthening("reallly"), "really");
  assert.equal(collapseExpressiveLengthening("cool"), "cool");
});

test("lmao follows the event and can soften distress instead of meaning happy", () => {
  const result = analyseText("lmao I failed again");
  const marker = result.informal.markers.find((item) => item.token === "lmao");
  assert.equal(marker.function, "laughter");
  assert.equal(marker.masksDistress, true);
  assert.ok(result.vad.valence < 0);
  assert.equal(result.maskedDistress, true);
});

test("wtf and omg inherit emotional direction while adding arousal", () => {
  const positive = textVAD("wtf this is amazing");
  const negative = textVAD("wtf this is awful");
  assert.ok(positive.valence > 0);
  assert.ok(negative.valence < 0);
  assert.ok(positive.arousal > textVAD("this is amazing").arousal);
  assert.ok(negative.arousal > textVAD("this is awful").arousal);
});

test("outcome shorthand distinguishes resigned closure from praise", () => {
  const defeated = textVAD("gg bro I missed the deadline");
  const praised = textVAD("ggwp that was amazing");
  assert.ok(defeated.valence < 0);
  assert.ok(defeated.dominance < 0);
  assert.ok(praised.valence > 0);
});

test("postfix and profanity intensifiers increase magnitude but remain bounded", () => {
  const plain = textVAD("I am tired");
  const postfix = textVAD("I am tired af");
  const profane = textVAD("I am fucking tired");
  assert.ok(postfix.valence < plain.valence);
  assert.ok(profane.valence < plain.valence);
  assert.ok(postfix.valence >= -1 && profane.valence >= -1);
});

test("contrast composition gives the clause after but greater weight", () => {
  assert.ok(textVAD("I was happy but now I am sad").valence < 0);
  assert.ok(textVAD("I was sad but now I am happy").valence > 0);
});

test("orthographic emphasis increases arousal only when affect evidence exists", () => {
  assert.ok(textVAD("I am angry!!!").arousal > textVAD("I am angry").arousal);
  assert.equal(textVAD("!!!").confidence, 0);
});

test("Filipino interjections remain contextual and do not imply identity", () => {
  const exasperated = resolveInformalMarkers("hay naku this failed again", -0.5);
  assert.ok(exasperated.markers.some((item) => item.token === "hay naku" && item.v < 0));
  const intensePositive = resolveInformalMarkers("grabe this is amazing", 0.5);
  assert.ok(intensePositive.markers.some((item) => item.token === "grabe" && item.v > 0));
});

test("discourse-only markers are reported without inventing emotion", () => {
  const result = analyseText("tbh idk");
  assert.ok(result.informal.markers.some((item) => item.function === "candour"));
  assert.ok(result.informal.markers.some((item) => item.function === "uncertainty"));
  assert.ok(result.vadConfidence > 0, "idk contributes bounded uncertainty/dominance evidence");
  assert.ok(Math.abs(result.vad.valence) < 0.1);
});
