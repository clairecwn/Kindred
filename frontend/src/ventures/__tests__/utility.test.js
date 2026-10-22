import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createActivity, SOCIAL_INTENSITY, ENERGY_DEMAND, CAPACITY_BAND,
  EVIDENCE_CATEGORY, STRUCTURE,
} from "../activity-model.js";
import {
  scoreActivity, isEligible, WEIGHTS, RECENCY_WEIGHT, EXPLORATION_WEIGHT,
  TIE_BREAK_WEIGHT, energyFitScore, socialFitScore, travelFitScore,
  timeOfDayFitScore, settingFitScore, noveltyScore, explorationBonus,
  TRAVEL_TOLERANCE_MINUTES, TRAVEL_UNKNOWN_FIT, TIME_UNKNOWN_FIT,
  ENERGY_OVERSHOOT_PENALTY, ENERGY_UNDERSHOOT_PENALTY,
  RECOMMENDER_WEIGHTS_VERSION,
} from "../scoring.js";
import { buildUserContext, thetaToCapacityBand, CONFIDENCE_FOR_FULL_CAPACITY } from "../user-context.js";
import { recommend, rankActivities, supplyState, MIN_HEALTHY_POOL, MAX_RECOMMENDATIONS } from "../recommender.js";

function activity(overrides = {}) {
  return createActivity({
    id: "a1",
    title: "Test",
    socialIntensity: SOCIAL_INTENSITY.SOLO,
    energyDemand: ENERGY_DEMAND.LOW,
    evidenceCategory: EVIDENCE_CATEGORY.BEHAVIOURAL_ACTIVATION,
    country: "SG",
    cost: { amount: 0, currency: "SGD" },
    location: { name: "Park", isPublicVenue: true, isDaytime: true, transitNearby: true },
    ...overrides,
  });
}

const ctx = (over = {}) => buildUserContext({ stateConfidence: 0.8, ...over });

// ---------------------------------------------------------------------------
// The weights are a stated model.
// ---------------------------------------------------------------------------

test("feature weights sum to 1, so the base utility is on [0, 1]", () => {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`);
  for (const [k, w] of Object.entries(WEIGHTS)) {
    assert.ok(w > 0 && w < 1, `${k} weight ${w} is not a proper weight`);
  }
});

test("energy and social fit outrank every other term, and novelty is the smallest", () => {
  const ordered = Object.entries(WEIGHTS).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  assert.equal(ordered[0], "energyFit");
  assert.equal(ordered[1], "socialFit");
  assert.equal(ordered[ordered.length - 1], "novelty");
});

test("the tie-break term cannot outvote any real feature", () => {
  const smallestFeatureEffect = Math.min(...Object.values(WEIGHTS));
  assert.ok(TIE_BREAK_WEIGHT * 1 < smallestFeatureEffect / 10,
    "a hash must only separate otherwise-equal scores, never reorder them");
});

test("the weights version is recorded on every breakdown", () => {
  const r = scoreActivity(activity(), ctx());
  assert.equal(r.breakdown.weightsVersion, RECOMMENDER_WEIGHTS_VERSION);
  assert.deepEqual(r.breakdown.weights, WEIGHTS);
});

// ---------------------------------------------------------------------------
// Determinism.
// ---------------------------------------------------------------------------

test("scoring is deterministic for the same (activity, context, salt)", () => {
  const a = activity({ travelMinutes: 12, timeWindow: { startHour: 9, endHour: 17 } });
  const c = ctx({ availableHours: { startHour: 8, endHour: 12 } });
  const first = JSON.stringify(scoreActivity(a, c, { noveltySalt: "day-1" }));
  for (let i = 0; i < 10; i += 1) {
    assert.equal(JSON.stringify(scoreActivity(a, c, { noveltySalt: "day-1" })), first);
  }
});

test("recommend() is deterministic and unaffected by Math.random", () => {
  const pool = ["a", "b", "c", "d", "e"].map((id, i) =>
    activity({ id, travelMinutes: i * 5, evidenceCategory: EVIDENCE_CATEGORY.EXERCISE }));
  const c = ctx({ capacityBand: CAPACITY_BAND.MODERATE });
  const first = recommend(pool, c, { noveltySalt: "s" }).map((r) => r.activity.id);
  const realRandom = Math.random;
  try {
    Math.random = () => 0.0001;
    assert.deepEqual(recommend(pool, c, { noveltySalt: "s" }).map((r) => r.activity.id), first);
  } finally {
    Math.random = realRandom;
  }
});

// ---------------------------------------------------------------------------
// Feature terms: the monotonicity each one claims.
// ---------------------------------------------------------------------------

test("a depleted user's no-effort option is not penalised against a more demanding one", () => {
  // The old formula scored "minimal" at 0.5 and "low" at 1.0 for a depleted
  // user, i.e. it actively preferred the more demanding option on the worst
  // days. Doing nothing strenuous must be able to win.
  const c = ctx({ emotion: "sad", stateConfidence: 0.9 });
  assert.equal(c.capacityBand, CAPACITY_BAND.DEPLETED);
  const minimal = energyFitScore(activity({ energyDemand: ENERGY_DEMAND.MINIMAL }), c);
  const low = energyFitScore(activity({ energyDemand: ENERGY_DEMAND.LOW }), c);
  assert.ok(minimal > low, `on a depleted day the no-effort option must win: minimal ${minimal} vs low ${low}`);
  assert.ok(minimal > 0.6);
});

test("energy fit penalises overshooting capacity harder than undershooting it", () => {
  const c = ctx({ checkinBand: "flourishing", stateConfidence: 0.9 }); // high capacity
  const under = energyFitScore(activity({ energyDemand: ENERGY_DEMAND.MINIMAL }), c);
  const over = energyFitScore(activity({ energyDemand: ENERGY_DEMAND.HIGH }), c);
  const target = energyFitScore(activity({ energyDemand: ENERGY_DEMAND.MODERATE }), c);
  assert.ok(target > under && target > over, "fit must peak near, not at, the ceiling");
  assert.ok(ENERGY_OVERSHOOT_PENALTY === 2 * ENERGY_UNDERSHOOT_PENALTY,
    "overshooting someone's capacity must cost twice as much per step as undershooting it");
  assert.ok(over < target && under < target);
});

test("social fit peaks at exactly one rung above the user's current comfort", () => {
  const c = ctx({ currentSocialRung: 1 });
  const scores = [0, 1, 2, 3].map((r) => socialFitScore(activity({ socialIntensity: r }), c));
  assert.equal(scores[2], Math.max(...scores), "the one-rung stretch must be the peak");
  assert.ok(scores[1] > scores[0], "staying put beats going backwards");
  assert.equal(scores[3], 0, "two rungs up scores zero (and is filtered out anyway)");
});

test("travel fit decays with distance and is conditioned on capacity", () => {
  const depleted = ctx({ emotion: "sad", stateConfidence: 0.9 });
  const high = ctx({ checkinBand: "flourishing", stateConfidence: 0.9 });
  const far = activity({ travelMinutes: 35 });
  assert.ok(travelFitScore(far, depleted) < travelFitScore(far, high),
    "the same journey must be a bigger ask for a depleted user");

  for (const c of [depleted, high]) {
    let prev = Infinity;
    for (const minutes of [0, 5, 15, 30, 60]) {
      const fit = travelFitScore(activity({ travelMinutes: minutes }), c);
      assert.ok(fit <= prev, "travel fit must be non-increasing in journey length");
      assert.ok(fit >= 0 && fit <= 1);
      prev = fit;
    }
  }
  assert.ok(TRAVEL_TOLERANCE_MINUTES.depleted < TRAVEL_TOLERANCE_MINUTES.high);
});

test("unknown travel time scores between a known-short and a known-long trip", () => {
  const c = ctx({ checkinBand: "navigating", stateConfidence: 0.9 });
  const unknown = travelFitScore(activity({}), c);
  assert.equal(unknown, TRAVEL_UNKNOWN_FIT);
  assert.ok(unknown < travelFitScore(activity({ travelMinutes: 2 }), c));
  assert.ok(unknown > travelFitScore(activity({ travelMinutes: 90 }), c));
});

test("time-of-day fit is the overlap fraction, and unknown windows are not free", () => {
  const c = ctx({ availableHours: { startHour: 8, endHour: 12 } });
  const allDay = activity({ timeWindow: { startHour: 8, endHour: 12 } });
  const evening = activity({ timeWindow: { startHour: 19, endHour: 21 } });
  const half = activity({ timeWindow: { startHour: 10, endHour: 14 } });
  assert.equal(timeOfDayFitScore(allDay, c), 1);
  assert.equal(timeOfDayFitScore(evening, c), 0);
  assert.ok(Math.abs(timeOfDayFitScore(half, c) - 0.5) < 1e-9);
  assert.equal(timeOfDayFitScore(activity({}), c), TIME_UNKNOWN_FIT);
  assert.equal(timeOfDayFitScore(allDay, ctx()), TIME_UNKNOWN_FIT, "unknown availability is also unknown");
});

test("green space is favoured in the agitated quadrant, and the rule is inert without a reading", () => {
  const agitated = ctx({ vad: { valence: -0.4, arousal: 0.5, dominance: -0.3 } });
  const settled = ctx({ vad: { valence: -0.4, arousal: -0.5, dominance: 0.3 } });
  const none = ctx();
  const outdoors = activity({ outdoor: true, indoor: false, evidenceCategory: EVIDENCE_CATEGORY.GREEN_BLUE_SPACE });
  assert.ok(settingFitScore(outdoors, agitated) > settingFitScore(outdoors, settled));
  assert.equal(settingFitScore(outdoors, none), settingFitScore(outdoors, settled),
    "with no affect reading the state-conditional rule must not fire");
});

test("novelty is category-level and returns the neutral 0.5 when history is unknown", () => {
  const known = ctx({ recentCategories: [EVIDENCE_CATEGORY.EXERCISE] });
  assert.equal(noveltyScore(activity({ evidenceCategory: EVIDENCE_CATEGORY.EXERCISE }), known), 0);
  assert.equal(noveltyScore(activity({ evidenceCategory: EVIDENCE_CATEGORY.ARTS_CREATIVE }), known), 1);
  assert.equal(noveltyScore(activity(), ctx()), 0.5);
});

// ---------------------------------------------------------------------------
// The exploration rule.
// ---------------------------------------------------------------------------

test("exploration shrinks as confidence in the user's state grows", () => {
  const a = activity({ evidenceCategory: EVIDENCE_CATEGORY.ARTS_CREATIVE });
  const bonuses = [0.05, 0.3, 0.6, 0.95].map((confidence) =>
    explorationBonus(a, ctx({ checkinBand: "flourishing", stateConfidence: confidence, recentCategories: [] })));
  for (let i = 1; i < bonuses.length; i += 1) {
    assert.ok(bonuses[i] < bonuses[i - 1], `exploration did not fall with confidence: ${bonuses}`);
  }
});

test("exploration is throttled to zero when the user is depleted", () => {
  const a = activity({ evidenceCategory: EVIDENCE_CATEGORY.ARTS_CREATIVE });
  const depleted = buildUserContext({ emotion: "sad", stateConfidence: 0.05, recentCategories: [] });
  assert.equal(depleted.capacityBand, CAPACITY_BAND.DEPLETED);
  assert.equal(explorationBonus(a, depleted), 0,
    "a misfire costs most on the worst days, so exploration must switch off there");
});

test("exploration cannot reorder anything when no state information exists", () => {
  // With no recentCategories every activity gets the same unfamiliarity, so
  // the term is a constant and the ranking is decided by fit alone.
  const c = ctx({ stateConfidence: undefined });
  const bonuses = [EVIDENCE_CATEGORY.EXERCISE, EVIDENCE_CATEGORY.ARTS_CREATIVE, EVIDENCE_CATEGORY.SOCIAL_CONNECTION]
    .map((cat) => explorationBonus(activity({ evidenceCategory: cat }), c));
  assert.equal(new Set(bonuses.map((b) => b.toFixed(9))).size, 1);
});

test("the exploration bonus is bounded by its weight", () => {
  const a = activity({ evidenceCategory: EVIDENCE_CATEGORY.ARTS_CREATIVE });
  const c = ctx({ checkinBand: "flourishing", stateConfidence: 0, recentCategories: [] });
  assert.ok(explorationBonus(a, c) <= 1);
  assert.ok(EXPLORATION_WEIGHT < WEIGHTS.energyFit, "exploration must never outweigh the top fit term");
});

// ---------------------------------------------------------------------------
// State -> capacity, with uncertainty.
// ---------------------------------------------------------------------------

test("latent state maps to capacity bands at the check-in scale's own cut points", () => {
  assert.equal(thetaToCapacityBand(3), CAPACITY_BAND.DEPLETED);
  assert.equal(thetaToCapacityBand(8), CAPACITY_BAND.LOW);
  assert.equal(thetaToCapacityBand(12), CAPACITY_BAND.MODERATE);
  assert.equal(thetaToCapacityBand(18), CAPACITY_BAND.HIGH);
  assert.equal(thetaToCapacityBand(null), null);
  assert.equal(thetaToCapacityBand(NaN), null);
});

test("the analysis layer's latent state outranks the emotion label", () => {
  const c = buildUserContext({
    emotion: "happy",
    analysis: { latentState: { theta: 4 }, confidence: 0.9 },
  });
  assert.equal(c.capacityBandRaw, CAPACITY_BAND.DEPLETED, "theta must win over a stale emotion label");
});

test("low confidence steps capacity DOWN, never up, and says so", () => {
  const confident = buildUserContext({ analysis: { latentState: { theta: 18 }, confidence: 0.9 } });
  const unsure = buildUserContext({ analysis: { latentState: { theta: 18 }, confidence: 0.1 } });
  assert.equal(confident.capacityBand, CAPACITY_BAND.HIGH);
  assert.equal(unsure.capacityBand, CAPACITY_BAND.MODERATE);
  assert.equal(unsure.capacityDownshifted, true);
  assert.equal(confident.capacityDownshifted, false);

  const unsureLow = buildUserContext({ analysis: { latentState: { theta: 2 }, confidence: 0.1 } });
  assert.equal(unsureLow.capacityBand, CAPACITY_BAND.DEPLETED, "the downshift must not fall off the bottom");
});

test("a missing confidence is treated as low confidence, not as good news", () => {
  const c = buildUserContext({ analysis: { latentState: { theta: 18 } } });
  assert.equal(c.capacityDownshifted, true);
  assert.ok(CONFIDENCE_FOR_FULL_CAPACITY > 0 && CONFIDENCE_FOR_FULL_CAPACITY < 1);
});

test("a brand new user is never offered a social stretch on day one", () => {
  const fresh = buildUserContext({
    analysis: { latentState: { theta: 16 }, confidence: 0.12, todayScore: { band: "flourishing" } },
    currentSocialRung: 0,
  });
  const groupEvent = activity({ socialIntensity: SOCIAL_INTENSITY.GROUP_EVENT });
  const newSmall = activity({ socialIntensity: SOCIAL_INTENSITY.NEW_SMALL });
  assert.equal(isEligible(groupEvent, fresh).eligible, false);
  assert.equal(isEligible(newSmall, fresh).eligible, false);
});

// ---------------------------------------------------------------------------
// Hard filters remain structural.
// ---------------------------------------------------------------------------

test("a failed filter yields a null score, never a low one", () => {
  const c = ctx({ emotion: "sad", stateConfidence: 0.9, currentSocialRung: 0 });
  const r = scoreActivity(activity({ socialIntensity: SOCIAL_INTENSITY.GROUP_EVENT }), c);
  assert.equal(r.eligible, false);
  assert.equal(r.score, null);
  assert.ok(r.reasons.length > 0);
});

test("a stated travel limit is a hard filter, not a penalty", () => {
  const c = ctx({ maxTransitMinutes: 20 });
  assert.equal(isEligible(activity({ travelMinutes: 45 }), c).eligible, false);
  assert.equal(isEligible(activity({ travelMinutes: 15 }), c).eligible, true);
});

// ---------------------------------------------------------------------------
// Thin supply.
// ---------------------------------------------------------------------------

test("supplyState reports the rung honestly", () => {
  assert.equal(supplyState(0), "none");
  assert.equal(supplyState(1), "thin");
  assert.equal(supplyState(MIN_HEALTHY_POOL - 1), "thin");
  assert.equal(supplyState(MIN_HEALTHY_POOL), "ok");
});

test("one eligible candidate is returned as one, not padded", () => {
  const c = ctx();
  const recs = recommend([activity({ id: "only" })], c);
  assert.equal(recs.length, 1);
  assert.equal(recs.supplyState, "thin");
  assert.equal(recs.eligibleCount, 1);
});

test("an empty or wholly ineligible pool returns nothing rather than something unsuitable", () => {
  const c = ctx({ emotion: "sad", stateConfidence: 0.9 });
  assert.deepEqual(recommend([], c), []);
  const all = [activity({ id: "x", socialIntensity: SOCIAL_INTENSITY.GROUP_EVENT })];
  const recs = recommend(all, c);
  assert.equal(recs.length, 0);
  assert.equal(recs.supplyState, "none");
  assert.equal(recs.candidatesConsidered, 1);
});

test("scoring does not depend on the size of the candidate pool", () => {
  const target = activity({ id: "target", travelMinutes: 10 });
  const c = ctx();
  const alone = rankActivities([target], c, { noveltySalt: "s" })[0].score;
  const crowd = rankActivities(
    [target, ...Array.from({ length: 50 }, (_, i) => activity({ id: `f${i}`, travelMinutes: i }))],
    c, { noveltySalt: "s" },
  ).find((r) => r.activity.id === "target").score;
  assert.equal(alone, crowd, "no normalisation across the candidate set");
});

// ---------------------------------------------------------------------------
// Design Bible prohibitions, enforced as tests.
// ---------------------------------------------------------------------------

test("no term is a function of any other user's behaviour", () => {
  const c = ctx();
  const quiet = activity({ id: "p", joined: 0, participants: [] });
  const popular = createActivity({ ...quiet.raw, id: "p", joined: 500, participants: Array.from({ length: 500 }, (_, i) => ({ userId: `u${i}` })) });
  assert.equal(scoreActivity(quiet, c, { noveltySalt: "s" }).score, scoreActivity(popular, c, { noveltySalt: "s" }).score,
    "popularity must not affect the score in any way");
});

test("absence is never penalised — only repeating the same activity is", () => {
  const c = ctx();
  const away = ctx({ overrides: { daysSinceLastVisit: 90, streak: 0 } });
  assert.equal(scoreActivity(activity(), c, { noveltySalt: "s" }).score,
    scoreActivity(activity(), away, { noveltySalt: "s" }).score,
    "no term may reference how long the user has been away");

  const repeated = ctx({ recentActivityIds: ["a1"] });
  assert.ok(scoreActivity(activity(), repeated).score < scoreActivity(activity(), c).score);
  assert.ok(RECENCY_WEIGHT > 0);
});

test("a no-commitment option is always present when one is eligible", () => {
  const pool = [
    activity({ id: "committed", structure: STRUCTURE.ONGOING, noCommitment: false, evidenceCategory: EVIDENCE_CATEGORY.EXERCISE, travelMinutes: 2 }),
    activity({ id: "committed2", structure: STRUCTURE.SCHEDULED, noCommitment: false, evidenceCategory: EVIDENCE_CATEGORY.EXERCISE, travelMinutes: 3 }),
    activity({ id: "committed3", structure: STRUCTURE.SCHEDULED, noCommitment: false, evidenceCategory: EVIDENCE_CATEGORY.EXERCISE, travelMinutes: 4 }),
    activity({ id: "dropin", structure: STRUCTURE.DROP_IN, noCommitment: true, evidenceCategory: EVIDENCE_CATEGORY.ARTS_CREATIVE, travelMinutes: 55 }),
  ];
  const recs = recommend(pool, ctx());
  assert.ok(recs.length <= MAX_RECOMMENDATIONS);
  assert.ok(recs.some((r) => r.isNoCommitment), "turning up to nothing must always stay on the table");
});

test("copy is invitation-framed and contains no guilt, streak or comparison language", () => {
  const recs = recommend([activity({ id: "x" }), activity({ id: "y" }), activity({ id: "z" })], ctx());
  const forbidden = /streak|don't miss|you haven't|missed|others|everyone|more popular|keep it up|falling behind|day[s]? in a row/i;
  for (const r of recs) {
    assert.ok(typeof r.copy === "string" && r.copy.length > 0);
    assert.ok(!forbidden.test(r.copy), `forbidden framing in copy: "${r.copy}"`);
  }
});

test("the exploration rule in use is reported, and the bandit is off by default", () => {
  const recs = recommend([activity()], ctx());
  assert.equal(recs.explorationRule, "state-uncertainty");
});
