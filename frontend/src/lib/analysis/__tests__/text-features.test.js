import test from "node:test";
import assert from "node:assert/strict";
import {
  detectHedging,
  detectMinimisation,
  detectSomaticIdioms,
  detectSelfDiscrepancy,
  countAbsolutist,
  firstPersonDensity,
  detectNegations,
  analyseText,
} from "../text-features.js";

test("detects hedging cues with correct spans", () => {
  const text = "I guess it was kind of a rough day, sort of.";
  const result = detectHedging(text);
  assert.ok(result.count >= 2, `expected at least 2 hedges, got ${result.count}`);
  for (const m of result.matches) {
    assert.equal(text.slice(m.index, m.index + m.length).toLowerCase(), m.text.toLowerCase());
  }
});

test("detects minimisation cues", () => {
  const result = detectMinimisation("I'm fine, it's nothing, don't worry about it.");
  assert.ok(result.count >= 2);
});

test("detects somatic idioms of distress as their own category, not filtered as physical complaints", () => {
  const result = detectSomaticIdioms("My chest is tight and I can't sleep, thinking too much about everything.");
  assert.ok(result.count >= 2, `expected somatic cues to be detected, got ${result.count}`);
  const phrases = result.matches.map((m) => m.cue);
  assert.ok(phrases.includes("chest is tight") || phrases.includes("thinking too much") || phrases.includes("can't sleep") || phrases.includes("cant sleep"));
});

test("detects self-discrepancy cues", () => {
  const result = detectSelfDiscrepancy("I should be over this by now, I wish I felt like I used to.");
  assert.ok(result.count >= 2);
});

test("counts absolutist words and computes a ratio", () => {
  const result = countAbsolutist("Nothing ever works out and everyone always leaves eventually.");
  assert.ok(result.count >= 3);
  assert.ok(result.ratio > 0 && result.ratio <= 1);
});

test("first-person pronoun density is between 0 and 1 and counts correctly", () => {
  const result = firstPersonDensity("I told myself my plan was fine and I moved on.");
  assert.ok(result.density > 0 && result.density <= 1);
  assert.ok(result.count >= 3);
});

test("negation flips the nearest following content word within a small window", () => {
  const result = detectNegations("I am not happy about this at all.");
  assert.ok(result.count >= 1);
  assert.equal(result.matches[0].negator, "not");
  assert.notEqual(result.matches[0].target, "the");
});

test("empty and undefined text never throws and returns zeroed structures", () => {
  for (const bad of ["", null, undefined]) {
    assert.doesNotThrow(() => {
      detectHedging(bad);
      detectMinimisation(bad);
      detectSomaticIdioms(bad);
      detectSelfDiscrepancy(bad);
      countAbsolutist(bad);
      firstPersonDensity(bad);
      detectNegations(bad);
      analyseText(bad);
    });
  }
});

test("analyseText composes every detector into one structured object", () => {
  const result = analyseText("I guess my chest feels tight and I should be handling this better, but nothing ever changes.");
  assert.ok(result.hedgingCount >= 1);
  assert.ok(result.somaticCount >= 1);
  assert.ok(result.selfDiscrepancyCount >= 1);
  assert.ok(result.absolutistCount >= 1);
  assert.ok(typeof result.firstPersonDensity === "number");
});
