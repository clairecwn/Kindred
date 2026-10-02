/**
 * entry-adapter.js
 *
 * Adapts Kindred's existing journalEntries shape (as stored by
 * WellnessView.jsx / useDatabaseState) into the { date, itemScores?,
 * journalText? } day-records analyseUser() in ./index.js expects, and runs
 * the full analysis for a saved journal entry or check-in. Kept separate
 * from index.js so index.js stays a pure composition module with no
 * knowledge of any particular UI's entry shape.
 */

import { analyseUser } from "./index.js";
import { buildClientCulturalContext, buildStableCulturalContext } from "./client-context.js";
import { analyseText } from "./text-features.js";
import { inferCluster, detectDialecticalAffect, idealAffectArousalWeight } from "./cultural-calibration.js";
import { selectCompanionStrategy } from "./response-strategy.js";

// Dialectical affect (positive and negative affect genuinely co-occurring)
// used to be decided by a second, ad-hoc word list kept right here, scored by
// naive substring containment -- so "not happy" counted as a positive hit and
// "I am not stressed" as a negative one. It now comes from text-features.js's
// own positiveMass/negativeMass, which are produced by the same negation- and
// intensifier-aware pass that produces the valence score, so there is one
// lexicon and one set of rules rather than two that can disagree.

/**
 * @param {Array<object>} journalEntries - newest-first, as stored in state.
 * @param {string} [excludeId] - an entry (e.g. one being re-analysed) to
 *   drop from history so it isn't double counted against itself.
 * @returns {Array<object>} oldest-first day records for analyseUser.
 */
export function buildHistoryFromEntries(journalEntries = [], excludeId = null) {
  const rows = journalEntries
    .filter((e) => e && e.id !== excludeId)
    .map((e) => {
      if (e.source === "checkin" && e.itemScores) {
        return { date: e.date, itemScores: e.itemScores };
      }
      if (e.text && e.source !== "checkin") {
        return { date: e.date, journalText: e.text };
      }
      return null;
    })
    .filter(Boolean);

  // Stored newest-first; analyseUser wants oldest-first for trend/baseline math.
  return rows.slice().reverse();
}

/**
 * Runs the full analysis layer for a new/just-saved entry, given the rest
 * of the user's history. `today` is { date, itemScores?, journalText?,
 * journalEmotion?, itemEmotions? } — whatever of those fields the caller
 * has for the entry in question.
 */
export function analyseEntry(journalEntries, today, extraContext = {}) {
  const history = buildHistoryFromEntries(journalEntries);
  // Prefer the residency-stable context when the caller has the stored
  // observation window: it reads region from where the user LIVES, so a
  // holiday cannot silently recalibrate them. Falls back to the raw
  // snapshot for callers that have not wired the state through yet.
  const cultural = extraContext.residencyState
    ? buildStableCulturalContext(extraContext.residencyState, today?.journalText ?? "")
    : buildClientCulturalContext(today?.journalText ?? "");
  return analyseUser(history, today, { ...cultural, ...extraContext });
}


/**
 * Builds the hints object journal-ai.js's AIJournalist.generateResponse()
 * folds into its system prompt, plus the full structured analysis (for
 * persisting on the saved entry so My Journey can read it back later).
 * Nothing here calls an LLM -- purely the deterministic analysis layer.
 */
export function buildCompanionHints(journalEntries, text, extraContext = {}) {
  const textFeatures = analyseText(text);
  const cultural = extraContext.residencyState
    ? buildStableCulturalContext(extraContext.residencyState, text)
    : buildClientCulturalContext(text);
  const cluster = inferCluster(cultural);
  const dialectical = detectDialecticalAffect(textFeatures.positiveMass, textFeatures.negativeMass);
  const analysis = analyseEntry(journalEntries, { date: extraContext.date ?? new Date().toISOString(), journalText: text }, extraContext);

  const hints = {
    somaticDistress: textFeatures.somaticCount > 0,
    understatement: textFeatures.minimisationCount > 0 || textFeatures.hedgingCount > 0,
    dialecticalAffect: dialectical.dialectical,
    calmIsPositive: idealAffectArousalWeight(cluster.cluster) < 1,
    sayNothingAboutTrend: analysis.sayNothing || !(analysis.gates && analysis.gates.trend),
    // Dialect-aware understanding (src/lib/analysis/dialect/): when the
    // entry matches a known dialect variety, a "lor"-marked, "sian"-marked
    // etc. entry must NOT be read as neutral just because its content words
    // look neutral -- see journal-ai.js's glossary injection, which uses
    // these matched tokens directly.
    dialectVariety: textFeatures.dialectVariety,
    dialectMaskedDistress: textFeatures.maskedDistress,
    dialectMatches: textFeatures.matches.dialect,
    // The deterministic affect reading for this entry, available to the
    // companion whether or not any model key is configured.
    vad: textFeatures.vad,
    vadConfidence: textFeatures.vadConfidence,
    temporalOrientation: textFeatures.temporal.dominant,
    crisis: analysis.safety ?? { isCrisis: false, matched: [] },
    textFeatures,
    cluster,
    analysis,
  };
  return { ...hints, responseStrategy: selectCompanionStrategy(hints, analysis) };
}
