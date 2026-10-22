import test from "node:test";
import assert from "node:assert/strict";
import fixture from "./fixtures/messy-messages.json" with { type: "json" };
import { analyseText } from "../text-features.js";
import { analyseDialect } from "../dialect/index.js";
import { detectCrisisLanguage } from "../crisis-detection.js";
import { lexiconReadings, evaluateInterpretation, storableInterpretation } from "../interpretation.js";
import { lookupMisspelling } from "../spelling.js";

function senseOf(text, term) {
  const dialect = analyseDialect(text).matchedTokens.find((t) => t.token === term);
  if (dialect) return { id: dialect.sense?.id, masked: dialect.masksDistress };
  const marker = (analyseText(text).matches.informal ?? []).find((m) => m.token === term);
  return marker ? { id: marker.sense?.id, masked: marker.masksDistress } : null;
}

for (const c of fixture.cases) {
  test(`[${c.group}] ${c.id}: ${c.text}`, () => {
    const f = analyseText(c.text);
    const e = c.expect;
    if (e.term) {
      const sense = senseOf(c.text, e.term);
      assert.ok(sense, `term "${e.term}" not recognised`);
      if (e.sense) assert.equal(sense.id, e.sense);
      if (e.masked !== undefined) {
        const masked = analyseDialect(c.text).maskedDistress || f.maskedDistress;
        assert.equal(masked, e.masked);
      }
    }
    if (e.valence === "neg") assert.ok(f.vad.valence < 0, `valence ${f.vad.valence}`);
    if (e.valence === "pos") assert.ok(f.vad.valence > 0, `valence ${f.vad.valence}`);
    if (e.play === true) assert.ok(f.playMass >= 0.5, `playMass ${f.playMass}`);
    if (e.play === false) assert.ok(f.playMass < 0.5, `playMass ${f.playMass}`);
    if (e.spelling) for (const s of e.spelling) assert.ok(f.spellingReadings.some((r) => r.surface === s), `spelling ${s} not read`);
    if (e.unknown) assert.deepEqual(f.unknownTerms, e.unknown);
    if (e.crisis !== undefined) assert.equal(detectCrisisLanguage(c.text).isCrisis, e.crisis);
  });
}

test("a joke reading never cancels a crisis match", () => {
  const text = "6 7 lol i wanna kms";
  const v = evaluateInterpretation({ mode: "play", need: "play", terms: [{ term: "6 7", senseId: "meme", confidence: "high" }] }, text);
  assert.equal(v.mode, "play");
  assert.equal(v.crisis, true);
});

test("interpreter terms must be the user's own words and senses must be real candidates", () => {
  const text = "exam tmr im so cooked lol";
  const v = evaluateInterpretation({ terms: [
    { term: "cooked", senseId: "doomed", confidence: "high" },
    { term: "invented", senseId: "x", confidence: "high" },
    { term: "cooked", senseId: "not-a-sense", confidence: "high" },
  ], mode: "nonsense", need: "nonsense", valence: 9 }, text);
  assert.equal(v.terms.length, 2);
  assert.deepEqual(v.interpreterSenses, { cooked: { doomed: 6 } });
  assert.equal(v.mode, "literal");
  assert.equal(v.need, "be-heard");
  assert.equal(v.valence, 1);
});

test("a model sense choice shifts the posterior but cannot delete the other reading", () => {
  const text = "ok lor";
  const base = analyseDialect(text).matchedTokens[0];
  const pushed = analyseDialect(text, { interpreterSenses: { "ok lor": { "easy-going": 6 } } }).matchedTokens[0];
  assert.equal(pushed.sense.id, "easy-going");
  assert.ok(pushed.sense.p < 1);
  assert.notEqual(base.sense.id, pushed.sense.id);
});

test("lexicon readings expose candidates for multi-sense Singlish and youth terms", () => {
  const r = lexiconReadings("sian ah ok lor 6 7");
  const okLor = r.terms.find((t) => t.token === "ok lor");
  const meme = r.terms.find((t) => t.token === "6 7");
  assert.deepEqual(okLor.candidates.map((c) => c.id), ["resigned", "easy-going"]);
  assert.ok(meme.candidates.length >= 2);
});

test("storable interpretation keeps only what the state model and UI need", () => {
  const s = storableInterpretation({ version: "v", valence: -0.2, confidence: 0.7, mode: "venting", need: "vent", gloss: "g", interpreterSenses: {}, terms: [] });
  assert.deepEqual(Object.keys(s).sort(), ["confidence", "gloss", "mode", "need", "valence", "version"]);
});

test("short words are never fuzzy-matched: 'years' does not become 'fears'", () => {
  assert.equal(lookupMisspelling("years"), null);
  assert.equal(lookupMisspelling("tierd")?.via, "phonetic");
});
