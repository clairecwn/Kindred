import test from "node:test";
import assert from "node:assert/strict";
import {
  VAD_LEXICON, VAD_PHRASES, INTENSIFIERS, NEGATORS, CLAUSE_BREAKERS,
  stemToken, lookupToken, LEXICON_VERSION,
} from "../lexicon.js";

test("every lexicon entry is a well-formed VAD triple inside [-1, 1]", () => {
  for (const [key, e] of Object.entries(VAD_LEXICON)) {
    for (const axis of ["v", "a", "d"]) {
      assert.equal(typeof e[axis], "number", `${key}.${axis} is not a number`);
      assert.ok(e[axis] >= -1 && e[axis] <= 1, `${key}.${axis} = ${e[axis]} out of range`);
    }
  }
  for (const [key, e] of Object.entries(VAD_PHRASES)) {
    for (const axis of ["v", "a", "d"]) {
      assert.ok(e[axis] >= -1 && e[axis] <= 1, `phrase "${key}".${axis} out of range`);
    }
  }
});

test("the lexicon is frozen: a caller cannot mutate a shared norm at runtime", () => {
  assert.throws(() => { VAD_LEXICON.sad = { v: 1, a: 1, d: 1 }; }, TypeError);
  assert.equal(VAD_LEXICON.sad.v < 0, true);
});

test("inflected forms reach the same lexicon entry as their headword", () => {
  const cases = [
    ["tired", "tire"], ["tiring", "tire"],
    ["exhausted", "exhaust"], ["exhausting", "exhaust"], ["exhaustion", "exhaust"],
    ["drained", "drain"], ["worried", "worri"], ["worrying", "worri"],
    ["happy", "happi"], ["happier", "happi"],
    ["lonely", "lone"], ["loneliness", "loneli"], ["exhaustion", "exhaust"], ["depression", "depress"], ["relaxation", "relax"], ["crying", "cri"], ["cried", "cri"],
    ["stressed", "stress"], ["stressful", "stress"],
    ["grateful", "grate"], ["peaceful", "peac"],
    ["overwhelmed", "overwhelm"], ["overwhelming", "overwhelm"],
    ["angry", "angri"], ["guilty", "guilti"],
  ];
  for (const [surface, expectedKey] of cases) {
    const hit = lookupToken(surface);
    assert.ok(hit, `"${surface}" found no lexicon entry`);
    assert.equal(hit.key, expectedKey, `"${surface}" resolved to "${hit?.key}", expected "${expectedKey}"`);
  }
});

test("irregular surface forms are matched before the stemmer can wreck them", () => {
  // "anxious" ends in "s"; a naive -s rule would stem it to "anxiou".
  assert.equal(lookupToken("anxious").key, "anxious");
  assert.equal(lookupToken("hopeless").key, "hopeless");
  assert.equal(lookupToken("worthless").key, "worthless");
});

test("stemToken is deterministic and never returns an empty string", () => {
  const words = ["running", "was", "the", "a", "beautiful", "ies", "yyy", "stopped"];
  for (const w of words) {
    const first = stemToken(w);
    assert.equal(first, stemToken(w));
    assert.ok(first.length > 0, `stemToken("${w}") returned empty`);
  }
});

test("non-affective words return null rather than a neutral reading", () => {
  for (const w of ["bus", "laundry", "spreadsheet", "tuesday", "pencil"]) {
    assert.equal(lookupToken(w), null, `"${w}" should carry no affect norm`);
  }
});

test("intensifiers are multipliers on the right side of 1, downtoners on the other", () => {
  assert.ok(INTENSIFIERS.extremely > 1.5);
  assert.ok(INTENSIFIERS.really > 1);
  assert.ok(INTENSIFIERS.slightly < 1);
  assert.ok(INTENSIFIERS.barely < 1);
  for (const [w, m] of Object.entries(INTENSIFIERS)) {
    assert.ok(m > 0 && m < 3, `${w} multiplier ${m} is outside a sane range`);
  }
});

test("negators and clause breakers are disjoint", () => {
  for (const b of CLAUSE_BREAKERS) {
    assert.ok(!NEGATORS.includes(b), `"${b}" cannot be both a negator and a clause breaker`);
  }
});

test("the lexicon version is stated, so a stored reading is traceable", () => {
  assert.equal(typeof LEXICON_VERSION, "string");
  assert.ok(LEXICON_VERSION.length > 0);
});
