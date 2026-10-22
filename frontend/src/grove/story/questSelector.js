// src/grove/story/questSelector.js
//
// Turns the analysis layer's output (src/lib/analysis/index.js,
// analyseUser()) into today's 1-3 Grove tasks. This is deliberately NOT
// procedural generation — it is weighted random selection over the
// pre-authored, hand-tagged pool in taskBank.js, following the tractable
// approach from Riedl's player-modelling work on dynamic difficulty: a
// small player-state vector selects against tagged content, with enough
// randomness that two days with the same state don't feel like a lookup
// table.
//
// Two hard rules, both load-bearing for the wellbeing constraint and both
// covered by tests in __tests__/questSelector.test.js:
//   1. Respect the analysis layer's own gates and sayNothing flag. With
//      too little history, or when confidence is low, fall back to a
//      gentle, neutral pool and never imply the game knows how the
//      player feels.
//   2. A low-capacity day must NEVER be able to draw a high-social or
//      high-energy task, regardless of the random draw — this is an
//      exclusion from the candidate pool, not just a lower weight, so no
//      unlucky roll can violate it.

import { TASK_BANK } from "./taskBank.js";

const SOCIAL_TAGS = new Set(["social", "playful"]);

/**
 * Derives a small, coarse player-state vector from one analyseUser()
 * result. Never reads raw journal text; only the already-computed,
 * already-gated numeric fields. Everything here degrades to neutral
 * defaults when a field is absent, since large parts of `analysis` are
 * legitimately undefined for a low-history user.
 *
 * @returns {{ capacity: 'low'|'medium'|'high', reliable: boolean, moodValence: number }}
 */
export function deriveStateVector(analysis) {
  if (!analysis || analysis.sayNothing) {
    return { capacity: "unknown", reliable: false, moodValence: 0 };
  }

  const reliable = !!(analysis.confidence >= 0.35 && analysis.gates?.personalBaseline);

  // todayScore.graded is on the same 0-21 "Navigating" scale used
  // throughout src/lib/analysis (see cold-start.js POPULATION_PRIOR).
  const graded = analysis.todayScore?.graded ?? analysis.coldStart?.estimate ?? 12.5;
  let capacity = "medium";
  if (graded < 8) capacity = "low";
  else if (graded > 15) capacity = "high";

  // Low arousal + negative valence is an additional, independent signal
  // that today calls for gentleness even if the check-in score alone
  // wouldn't say "low" — VAD comes from the blended quiz/text reading.
  const valence = analysis.vad?.valence ?? 0;
  const arousal = analysis.vad?.arousal ?? 0.5;
  if (capacity !== "low" && valence < -0.25 && arousal < 0.4) capacity = "low";

  return { capacity, reliable, moodValence: valence };
}

// Base tag weights per capacity band. A low day simply has zero weight
// (not just low weight) on the tags that ask for social or high-arousal
// engagement — see the hard-exclusion filter below, which is the actual
// enforcement; these weights only shape variety among what's left.
const TAG_WEIGHTS = Object.freeze({
  low:     { "low-energy-gentle": 5, restorative: 4, reflective: 2, social: 0, playful: 0 },
  medium:  { "low-energy-gentle": 2, restorative: 3, reflective: 3, social: 3, playful: 2 },
  high:    { "low-energy-gentle": 1, restorative: 2, reflective: 2, social: 3, playful: 3 },
  unknown: { "low-energy-gentle": 4, restorative: 3, reflective: 2, social: 0, playful: 0 },
});

/**
 * Filters the task bank down to tasks a given capacity band is allowed to
 * draw from at all. This is the hard exclusion, not a weighting — a
 * low-capacity or unknown-state day never even sees a social/playful
 * task as a candidate.
 */
function eligiblePool(capacity) {
  if (capacity === "low" || capacity === "unknown") {
    return TASK_BANK.filter((t) => !SOCIAL_TAGS.has(t.tag) && t.energy === "low");
  }
  return TASK_BANK;
}

function weightedPick(pool, weights, rng, excludeIds) {
  const candidates = pool.filter((t) => !excludeIds.has(t.id));
  const source = candidates.length ? candidates : pool;
  const total = source.reduce((sum, t) => sum + (weights[t.tag] ?? 1), 0);
  if (total <= 0) return source[Math.floor(rng() * source.length)];
  let roll = rng() * total;
  for (const t of source) {
    roll -= weights[t.tag] ?? 1;
    if (roll <= 0) return t;
  }
  return source[source.length - 1];
}

/**
 * Selects today's tasks.
 *
 * @param {object} analysis - the result of analyseUser(...) from
 *   src/lib/analysis/index.js, or null/undefined for a brand-new user.
 * @param {object} [opts]
 * @param {number} [opts.count=3] - how many tasks to return (1-3).
 * @param {string[]} [opts.recentTaskIds] - ids shown in roughly the last
 *   week, avoided where the pool allows it so today doesn't repeat
 *   yesterday.
 * @param {() => number} [opts.rng=Math.random] - injectable for tests.
 * @returns {{ tasks: object[], capacity: string, reliable: boolean }}
 */
export function selectDailyTasks(analysis, opts = {}) {
  const { count = 3, recentTaskIds = [], rng = Math.random } = opts;
  const state = deriveStateVector(analysis);
  const weights = TAG_WEIGHTS[state.capacity] ?? TAG_WEIGHTS.unknown;
  const pool = eligiblePool(state.capacity);
  const exclude = new Set(recentTaskIds);

  const chosen = [];
  const chosenIds = new Set();
  const n = Math.max(1, Math.min(3, count));
  for (let i = 0; i < n && chosen.length < pool.length; i++) {
    const combinedExclude = new Set([...exclude, ...chosenIds]);
    const pick = weightedPick(pool, weights, rng, combinedExclude);
    if (!pick || chosenIds.has(pick.id)) break;
    chosen.push(pick);
    chosenIds.add(pick.id);
  }

  return { tasks: chosen, capacity: state.capacity, reliable: state.reliable };
}
