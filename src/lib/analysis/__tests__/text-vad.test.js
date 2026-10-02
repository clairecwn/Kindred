import test from "node:test";
import assert from "node:assert/strict";
import {
  textVAD, analyseText, temporalOrientation, agencyAdjustment, PRIOR_MASS,
} from "../text-features.js";

const inRange = (x) => x >= -1 && x <= 1;

// ---------------------------------------------------------------------------
// Determinism — the property the whole rewrite exists to provide.
// ---------------------------------------------------------------------------

test("the same text produces byte-identical output on repeated runs", () => {
  const samples = [
    "I feel drained and lonely, but I managed to go for a walk.",
    "Nvm lor, used to it already",
    "I'm fine lah, just a bit sian.",
    "My chest feels tight and I can't sleep, thinking too much.",
    "Had a genuinely good day, I felt proud of myself.",
    "",
  ];
  for (const s of samples) {
    const a = JSON.stringify(textVAD(s));
    for (let i = 0; i < 5; i += 1) {
      assert.equal(JSON.stringify(textVAD(s)), a, `non-deterministic for ${JSON.stringify(s)}`);
    }
    assert.equal(JSON.stringify(analyseText(s)), JSON.stringify(analyseText(s)));
  }
});

test("every axis stays inside [-1, 1] even for pathological input", () => {
  const nasty = [
    "sad ".repeat(200),
    "extremely incredibly absolutely utterly completely devastated hopeless worthless miserable",
    "happy joy love delighted wonderful ecstatic thrilled proud grateful".repeat(20),
    "lor lor lor sian sian sian shag shag paiseh paiseh jialat",
  ];
  for (const s of nasty) {
    const r = textVAD(s);
    assert.ok(inRange(r.valence) && inRange(r.arousal) && inRange(r.dominance), `out of range for ${s.slice(0, 30)}`);
    assert.ok(r.confidence >= 0 && r.confidence < 1);
  }
});

// ---------------------------------------------------------------------------
// Degenerate input.
// ---------------------------------------------------------------------------

test("empty, whitespace and non-string input read as no evidence, not as neutral affect", () => {
  for (const s of ["", "   \n\t ", null, undefined, 42, {}]) {
    const r = textVAD(s);
    assert.equal(r.valence, 0);
    assert.equal(r.confidence, 0, "confidence must be 0 (no reading), never a positive 'neutral' confidence");
    assert.equal(r.evidence, 0);
    assert.deepEqual(r.terms, []);
  }
});

test("text with no affect vocabulary produces zero evidence", () => {
  const r = textVAD("Ate lunch. Took the 174 bus. Did some laundry and read a chapter.");
  assert.equal(r.evidence, 0);
  assert.equal(r.confidence, 0);
  assert.equal(r.valence, 0);
});

// ---------------------------------------------------------------------------
// Monotonicity and shrinkage claims the model makes.
// ---------------------------------------------------------------------------

test("more of the same affect word moves valence further from zero, with diminishing returns", () => {
  const v = (n) => textVAD("I feel sad. ".repeat(n)).valence;
  const [one, two, four, eight] = [v(1), v(2), v(4), v(8)];
  assert.ok(two < one, "two mentions should be more negative than one");
  assert.ok(four < two, "four mentions should be more negative than two");
  assert.ok(eight < four, "eight mentions should be more negative than four");
  // Concavity: with W terms of equal value the reading is W·v/(W+kappa), so
  // each additional mention buys strictly less than the one before it once
  // W exceeds the pseudo-count.
  assert.ok(Math.abs(eight - four) < Math.abs(four - two), "shrinkage must give diminishing returns");
  assert.ok(Math.abs(eight) < 1, "and can never reach the raw lexicon value");
});

test("shrinkage: one affect word in a long neutral entry is attenuated, not reported at full strength", () => {
  const filler = "I took the bus to the office and then I went to the shop and then I came home. ";
  const short = textVAD("Sad.");
  const long = textVAD(`${filler}Sad.`);
  // Both have the same single term, so both are attenuated by the same
  // pseudo-count; the point is that neither reports the raw lexicon value.
  const rawSadValence = -0.72;
  assert.ok(Math.abs(short.valence) < Math.abs(rawSadValence), "a single word must not be reported at full lexicon strength");
  assert.ok(short.confidence < 0.5, `single-term confidence should be modest, got ${short.confidence}`);
  assert.equal(short.valence.toFixed(6), long.valence.toFixed(6));
});

test("confidence is monotone increasing in the amount of lexical evidence", () => {
  const texts = [
    "Today.",
    "Today I was sad.",
    "Today I was sad and tired.",
    "Today I was sad, tired and lonely.",
    "Today I was sad, tired, lonely and hopeless.",
  ];
  const confs = texts.map((t) => textVAD(t).confidence);
  for (let i = 1; i < confs.length; i += 1) {
    assert.ok(confs[i] >= confs[i - 1], `confidence dropped as evidence grew: ${confs}`);
  }
  assert.ok(confs[confs.length - 1] > confs[0]);
});

// ---------------------------------------------------------------------------
// Valence shifters.
// ---------------------------------------------------------------------------

test("negation flips valence but is SHIFTED, not mirrored", () => {
  const positive = textVAD("I am happy.").valence;
  const negated = textVAD("I am not happy.").valence;
  const opposite = textVAD("I am sad.").valence;
  assert.ok(positive > 0);
  assert.ok(negated < 0, "negated positive must be negative");
  assert.ok(negated > opposite, "'not happy' must be weaker than 'sad', not equal and opposite");
  assert.ok(Math.abs(negated) < Math.abs(positive), "negation must attenuate as well as flip");
});

test("negation does not reach across a clause boundary", () => {
  // "but" must stop "not" from negating "sad".
  const crossed = textVAD("I am not tired, but I am sad.");
  const plain = textVAD("I am sad.");
  assert.ok(crossed.valence < 0, "the entry is negative overall");
  // If the negator had leaked across "but", "sad" would have been flipped
  // positive and the whole entry would read non-negative.
  assert.ok(crossed.valence < plain.valence / 4, `negation leaked across the clause boundary (${crossed.valence})`);
});

test("intensifiers scale magnitude, downtoners reduce it", () => {
  const plain = textVAD("I am exhausted.").valence;
  const intense = textVAD("I am extremely exhausted.").valence;
  const mild = textVAD("I am slightly exhausted.").valence;
  assert.ok(intense < plain, `"extremely exhausted" should be more negative than "exhausted" (${intense} vs ${plain})`);
  assert.ok(mild > plain, `"slightly exhausted" should be less negative than "exhausted" (${mild} vs ${plain})`);
});

test("multiword phrases are not double counted as their component words", () => {
  const r = textVAD("I am burnt out.");
  const phraseTerms = r.terms.filter((t) => t.kind === "phrase");
  assert.equal(phraseTerms.length, 1);
  assert.equal(phraseTerms[0].term, "burnt out");
  // "out" is not in the lexicon and "burnt" must not have been scored
  // separately, so the phrase is the only term.
  assert.equal(r.terms.length, 1);
});

// ---------------------------------------------------------------------------
// Dominance: the axis that separates anger from anxiety.
// ---------------------------------------------------------------------------

test("dominance separates anger (high) from anxiety (low) at similar valence and arousal", () => {
  const angry = textVAD("I am furious and fed up with all of this.");
  const anxious = textVAD("I am panicking and terrified, I feel helpless.");
  assert.ok(angry.valence < 0 && anxious.valence < 0);
  assert.ok(angry.arousal > 0 && anxious.arousal > 0);
  assert.ok(angry.dominance > anxious.dominance, `anger should carry more dominance than anxiety (${angry.dominance} vs ${anxious.dominance})`);
});

test("agency markers move dominance and only dominance", () => {
  const neutralText = "Today I had a meeting and then I ate.";
  const high = textVAD(`${neutralText} I decided to take a break and I set a boundary.`);
  const low = textVAD(`${neutralText} I had to keep going, there was no choice.`);
  assert.ok(high.dominance > low.dominance);
  assert.ok(high.adjustments.agency > 0);
  assert.ok(low.adjustments.agency < 0);
  assert.ok(Math.abs(high.adjustments.agency) <= 0.45, "agency adjustment must stay bounded");
});

// ---------------------------------------------------------------------------
// Masked distress: the false negative this layer exists to prevent.
// ---------------------------------------------------------------------------

test("hedged distress does not read as neutral", () => {
  const r = textVAD("I'm fine, I guess. Just a bit tired, it's not that bad.");
  assert.ok(r.valence < -0.05, `hedged distress must not land at neutral (got ${r.valence})`);
  assert.ok(r.adjustments.masking < 0);
});

test("a Singlish entry with no negative content word is still read as negative", () => {
  const r = textVAD("Nvm lor, used to it already");
  assert.ok(r.valence < 0, `masked-distress dialect entry read as ${r.valence}`);
  assert.ok(r.terms.some((t) => t.kind === "dialect"));
});

test("somatic idioms are read as emotional evidence, not filtered out", () => {
  const r = textVAD("My chest feels tight and I can't sleep.");
  assert.ok(r.valence < 0);
  assert.ok(r.arousal > 0, "somatic anxiety markers should raise arousal");
  assert.ok(r.terms.some((t) => t.kind === "somatic"));
  assert.ok(r.confidence > 0, "a purely somatic entry still carries evidence");
});

test("understated positives are discounted but stay positive", () => {
  const plain = textVAD("It was a good day.").valence;
  const hedged = textVAD("It was a good day, I guess.").valence;
  assert.ok(plain > 0 && hedged > 0);
  assert.ok(hedged < plain, "hedging should discount a positive reading");
});

// ---------------------------------------------------------------------------
// Dialectical affect: independent positive and negative mass.
// ---------------------------------------------------------------------------

test("co-occurring positive and negative affect is not collapsed to 'neutral'", () => {
  const mixed = textVAD("I was grateful for the help but I still felt hopeless and exhausted.");
  assert.ok(mixed.positiveMass > 0, "positive mass must be recorded independently");
  assert.ok(mixed.negativeMass > 0, "negative mass must be recorded independently");
  const flat = textVAD("Nothing much happened today.");
  assert.equal(flat.positiveMass, 0);
  assert.equal(flat.negativeMass, 0);
});

// ---------------------------------------------------------------------------
// Temporal orientation and the composed feature object.
// ---------------------------------------------------------------------------

test("temporal orientation reports counts and a bounded balance, and claims nothing about mood", () => {
  const past = temporalOrientation("Yesterday I used to feel better, last week was easier, before it was fine.");
  assert.equal(past.dominant, "past");
  assert.ok(past.balance < 0);

  const future = temporalOrientation("Tomorrow I will try, next week I plan to start, what if it goes wrong.");
  assert.equal(future.dominant, "future");
  assert.ok(future.balance > 0);

  const none = temporalOrientation("Rain.");
  assert.equal(none.dominant, "none");
  assert.equal(none.balance, 0);

  for (const r of [past, future, none]) {
    assert.ok(r.balance >= -1 && r.balance <= 1);
  }
});

test("agencyAdjustment is bounded and symmetric in its inputs", () => {
  const many = "I decided. I chose. I managed. I handled. I finished. I asked for help.";
  assert.ok(agencyAdjustment(many).adjustment <= 0.45);
  const manyLow = "I couldn't. I had to. No choice. No control. Out of my hands.";
  assert.ok(agencyAdjustment(manyLow).adjustment >= -0.45);
  assert.equal(agencyAdjustment("").adjustment, 0);
});

test("analyseText keeps every field the previous version returned", () => {
  const r = analyseText("I'm fine, I guess. My chest feels tight and I can't sleep.");
  for (const key of [
    "hedgingCount", "minimisationCount", "somaticCount", "selfDiscrepancyCount",
    "absolutistCount", "absolutistRatio", "firstPersonDensity", "negationCount",
    "dialectVariety", "dialectConfidence", "maskedDistress",
    "dialectValenceAdjustment", "dialectArousalAdjustment", "matches",
  ]) {
    assert.ok(key in r, `analyseText lost the field "${key}"`);
  }
  // and the additions
  for (const key of ["vad", "vadConfidence", "temporal", "agency", "selfReferenceDensity", "positiveMass", "negativeMass"]) {
    assert.ok(key in r, `analyseText is missing the new field "${key}"`);
  }
});

test("PRIOR_MASS is the documented pseudo-count and is positive", () => {
  assert.ok(PRIOR_MASS > 0);
});
