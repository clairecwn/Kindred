import test from "node:test";
import assert from "node:assert/strict";
import { analyseText } from "../text-features.js";
import {
  buildExperienceProfile,
  composeExperienceDescription,
  formatExperienceProfile,
} from "../experience-profile.js";

const profileFor = (text) => buildExperienceProfile(analyseText(text), text);

test("profile preserves user-chosen feeling language instead of forcing a bank label", () => {
  const profile = profileFor("I feel weirdly relieved but also empty now that the project is finally done.");
  assert.ok(profile.explicitLanguage.some((phrase) => /weirdly relieved/i.test(phrase)));
  assert.ok(profile.dimensions.relief > 0.4);
  assert.equal(profile.affect.valence !== undefined, true);
  assert.match(composeExperienceDescription(profile), /relieved|empty/i);
});

test("profile separates self-evaluation, social exposure and need for competence", () => {
  const profile = profileFor("Paiseh everyone waited because I was late. I feel like I let the team down and want to do better next time.");
  assert.ok(profile.dimensions.selfEvaluation > 0.4);
  assert.ok(profile.dimensions.socialExposure > 0.4);
  assert.ok(profile.needs.includes("competence"));
  assert.match(composeExperienceDescription(profile), /self-conscious|hard on yourself/i);
});

test("profile represents uncertainty and mixed motives as dimensions", () => {
  const profile = profileFor("Part of me is glad I said no, but idk why I still feel off about disappointing them.");
  assert.ok(profile.dimensions.ambivalence > 0.4);
  assert.ok(profile.dimensions.certainty < 0.5);
  assert.ok(profile.tensions.some((item) => /competing reactions/i.test(item)));
  assert.match(formatExperienceProfile(profile), /certainty|ambivalence|supported tensions/i);
});

test("different appraisal combinations remain distinct at similar negative valence", () => {
  const setback = profileFor("The audition was exhausting and I did not perform my best, but I hope next time goes better.");
  const unfair = profileFor("They blamed me for their mistake. It is completely unfair and I feel disrespected.");
  assert.ok(setback.dimensions.outcomeDiscrepancy > unfair.dimensions.outcomeDiscrepancy);
  assert.ok(unfair.dimensions.unfairness > setback.dimensions.unfairness);
  assert.ok(unfair.dimensions.otherAgency > setback.dimensions.otherAgency);
  assert.notEqual(composeExperienceDescription(setback), composeExperienceDescription(unfair));
});
