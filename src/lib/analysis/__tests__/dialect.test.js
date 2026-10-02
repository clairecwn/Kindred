import test from "node:test";
import assert from "node:assert/strict";
import { identifyVariety, analyseDialect, recordDialectFeedback } from "../dialect/index.js";
import { analyseText } from "../text-features.js";
import { EmotionDetector } from "../../journal-ai.js";

test("identifies Singlish from distinctive particles", () => {
  const result = identifyVariety("Nvm lor, used to it already");
  assert.equal(result.variety, "singlish");
  assert.match(result.lexiconVersion, /^singlish-2026\.10-contextual-/);
  assert.ok(result.confidence > 0);
});

test("plain English text is not misidentified as a dialect", () => {
  const result = identifyVariety("I had a fine day at work today, nothing much happened.");
  assert.equal(result.variety, null);
});

test("empty text returns no variety", () => {
  assert.equal(identifyVariety("").variety, null);
  assert.equal(identifyVariety(null).variety, null);
});

// ---------------------------------------------------------------------------
// HIGH PRIORITY: "Nvm lor, used to it already" must be read as masked
// distress, NOT scored neutral.
// ---------------------------------------------------------------------------
test("'Nvm lor, used to it already' is flagged as masked distress and NOT neutral", () => {
  const result = analyseDialect("Nvm lor, used to it already");
  assert.equal(result.variety, "singlish");
  assert.equal(result.maskedDistress, true, "lor + used to it should mask real hurt, not read as neutral dismissal");
  assert.ok(result.valenceAdjustment < 0, `expected a negative valence adjustment, got ${result.valenceAdjustment}`);

  const tokens = result.matchedTokens.map((m) => m.token);
  assert.ok(tokens.includes("nvm lor"), "expected the context-specific 'nvm lor' construction to be matched");
  assert.ok(tokens.includes("used to it"), "expected 'used to it' to be matched");

  const lorEntry = result.matchedTokens.find((m) => m.token === "nvm lor");
  assert.equal(lorEntry.masksDistress, true);

  // Cross-check via the text-features composition layer: this must be a
  // first-class feature, not buried, and must not be scored neutral.
  const features = analyseText("Nvm lor, used to it already");
  assert.equal(features.maskedDistress, true);
  assert.equal(features.dialectVariety, "singlish");
  assert.ok(features.dialectValenceAdjustment < 0, "the entry's valence must not be read as neutral");
});

test("the journal detector preserves the deterministic Singlish reading", () => {
  const result = new EmotionDetector().analyze("Nvm lor, used to it already");
  assert.equal(result.source, "deterministic");
  assert.equal(result.emotion, "sad");
  assert.notEqual(result.emotion, "neutral");
  assert.equal(result.textFeatures.dialectVariety, "singlish");
  assert.equal(result.textFeatures.maskedDistress, true);
});

test("'Cannot make it today, sian ah' surfaces 'sian' as the real emotional payload", () => {
  const result = analyseDialect("Cannot make it today, sian ah");
  assert.equal(result.variety, "singlish");
  const tokens = result.matchedTokens.map((m) => m.token);
  assert.ok(tokens.includes("sian ah") || tokens.includes("sian"), "expected jadedness marker to be detected");
  assert.ok(result.valenceAdjustment < 0);
});

test("\"I'm fine lah\" reads as a resigned, drop-it fine, not simple reassurance", () => {
  const result = analyseDialect("I'm fine lah");
  const tokens = result.matchedTokens.map((m) => m.token);
  assert.ok(tokens.includes("fine lah"), "expected the resigned-closure 'fine lah' pattern to be detected");
  const fineLah = result.matchedTokens.find((m) => m.token === "fine lah");
  assert.equal(fineLah.masksDistress, true);
});

test("'So paiseh, I never reply you' reads paiseh as shame, not simple politeness, and 'never' as negative past", () => {
  const result = analyseDialect("So paiseh, I never reply you");
  const tokens = result.matchedTokens.map((m) => m.token);
  assert.ok(tokens.includes("paiseh"));
  const paisehEntry = result.matchedTokens.find((m) => m.token === "paiseh");
  assert.equal(paisehEntry.masksDistress, true);
  assert.ok(tokens.includes("never"), "expected the negative-past aspect marker 'never' to be detected");
});

test("'This project, very stress one' is read as a self-report of emotional strain", () => {
  const result = analyseDialect("This project, very stress one");
  const tokens = result.matchedTokens.map((m) => m.token);
  assert.ok(tokens.includes("stress one"), "expected the topic-prominent 'stress one' construction to be detected");
  assert.ok(result.valenceAdjustment < 0);
});

test("'I try already' reads 'already' as completive aspect (past attempt), not future intent", () => {
  const result = analyseDialect("I try already");
  const already = result.matchedTokens.find((m) => m.token === "already");
  assert.ok(already, "expected 'already' to be matched");
  assert.equal(already.category, "aspect");
});

test("'You got eat?' reads 'got' as a perfective marker, not possession", () => {
  const result = analyseDialect("You got eat?");
  const got = result.matchedTokens.find((m) => m.token === "got");
  assert.ok(got, "expected 'got' to be matched");
  assert.equal(got.category, "aspect");
});

test("'Talk talk only lah' is read as a dismissive-minimising reduplication, not a disfluency", () => {
  const result = analyseDialect("Talk talk only lah");
  const tokens = result.matchedTokens.map((m) => m.token);
  assert.ok(tokens.includes("talk talk only"), "expected reduplication pattern to be detected");
  const entry = result.matchedTokens.find((m) => m.token === "talk talk only");
  assert.equal(entry.category, "reduplication");
  assert.equal(entry.masksDistress, true);
});

test("'Wah, today so shag sia' reads 'shag' as exhausted (not the vulgar sense) and 'sia' as intensifying toward overwhelm", () => {
  const result = analyseDialect("Wah, today so shag sia");
  const tokens = result.matchedTokens.map((m) => m.token);
  assert.ok(tokens.includes("shag") || tokens.includes("damn shag"), "expected Singlish 'shag' (exhausted) construction to be detected");
  const shag = result.matchedTokens.find((m) => m.token === "shag" || m.token === "damn shag");
  assert.equal(shag.masksDistress, true);
  assert.ok(tokens.includes("sia"), "expected the intensifier 'sia' to be detected");
  assert.ok(result.valenceAdjustment < 0);
});

test("spelling variants are matched (sian/siann, paiseh/pai seh, walao/wah lao)", () => {
  assert.ok(analyseDialect("so siann today").matchedTokens.some((m) => m.token === "sian"));
  assert.ok(analyseDialect("damn sianz today").matchedTokens.some((m) => m.token === "damn sian"));
  assert.ok(analyseDialect("pai seh about that").matchedTokens.some((m) => m.token === "paiseh"));
  assert.ok(analyseDialect("wah lao this is bad").matchedTokens.some((m) => m.token === "walao"));
});

test("broader Singlish constructions retain resignation, anger, and intensity", () => {
  const resigned = analyseDialect("bo bian lor, lan lan suck thumb");
  assert.ok(resigned.matchedTokens.some((m) => ["no choice lor", "bo bian", "lan lan"].includes(m.token)));
  assert.ok(resigned.valenceAdjustment < 0);
  assert.equal(resigned.maskedDistress, true);

  const angry = analyseDialect("damn dulan sia");
  assert.ok(angry.matchedTokens.some((m) => m.token === "dulan"));
  assert.ok(angry.valenceAdjustment < 0);
  assert.ok(angry.arousalAdjustment > 0);

  const intense = analyseDialect("sibei shiok");
  assert.ok(intense.matchedTokens.some((m) => m.token === "sibei"));
  assert.ok(intense.matchedTokens.some((m) => m.token === "shiok"));
});

test("polyfunctional particles do not impose a negative emotion without context", () => {
  const lor = analyseText("Can lor");
  assert.equal(lor.dialectVariety, "singlish");
  assert.equal(lor.vadEvidence, 0);
  assert.equal(lor.vad.valence, 0);

  const positive = analyseText("Very shiok sia");
  assert.ok(positive.vad.valence > 0, "intensifying sia must not reverse positive shiok");
  assert.ok(positive.vad.arousal > 0);
});

test("additional Singaporean affect terms retain their distinct directions", () => {
  assert.ok(analyseText("Haiz, no choice lor").vad.valence < 0);
  assert.ok(analyseText("So pek chek today").vad.arousal > 0);
  assert.ok(analyseText("This one really song sia").vad.valence > 0);
});

test("the feedback seam records a correction without throwing or requiring UI", () => {
  const record = recordDialectFeedback({
    text: "shiok can also mean relief, not just pleasure",
    variety: "singlish",
    token: "shiok",
    correction: "shiok can mean relief from pain, not only pleasure",
  });
  assert.equal(record.token, "shiok");
  assert.equal(record.variety, "singlish");
  assert.ok(record.recordedAt);
});
