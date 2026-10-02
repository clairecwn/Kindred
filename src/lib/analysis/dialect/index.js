/**
 * dialect/index.js
 *
 * Variety-ID-then-normalise pipeline for dialect-aware journal reading.
 * This is NOT a Singlish special case: identifyVariety() runs against a
 * registry of variety modules, so Manglish, Hinglish, AAE, Nigerian Pidgin
 * and others can be added later as sibling modules (./manglish.js,
 * ./hinglish.js, ...) without touching this file's shape or callers.
 *
 * The core insight this module exists to encode: in many English-lexified
 * dialects/creoles, HOW something is said (particle choice, aspect marking,
 * reduplication) carries the actual emotional content while the content
 * words look neutral. A sentiment reader that scores content words alone
 * produces false negatives on masked distress — the dangerous direction in
 * a wellbeing app. See ./singlish.js for the documented lexicon this file
 * runs against.
 */

import { SINGLISH_LEXICON, SINGLISH_LEXICON_VERSION, SINGLISH_SURFACE_FORMS, SINGLISH_AMBIGUOUS_SURFACE_FORMS, SINGLISH_SYNTACTIC_PATTERNS } from "./singlish.js";

/**
 * EVIDENCE RULES (added after the first version fired on plain English).
 *
 * A surface form listed in a variety's `ambiguousForms` is one that also
 * occurs in ordinary English with a different meaning ("got", "already",
 * "one", "never", "blur", ...). Two rules follow from that:
 *
 *   1. Ambiguous forms contribute ZERO evidence toward identifying the
 *      variety. Identification runs on distinctive forms only.
 *   2. A variety is only reported at all once its confidence reaches
 *      VARIETY_MIN_CONFIDENCE, which under the scoring below requires at
 *      least one strong signal ("lah", "sian", "lor", ...) or four or more
 *      distinctive non-strong hits.
 *   3. The valence/arousal shift attached to an ambiguous form is applied
 *      only once the variety has been identified on distinctive evidence.
 *      Ambiguous forms are always REPORTED in matchedTokens (flagged
 *      `ambiguous: true`) but never move a number on their own.
 *   4. SYNTACTIC signatures count as distinctive evidence even though every
 *      word in them is ordinary English, because the EVIDENCE IS THE
 *      PATTERN: "You got eat?" and "I try already" are ungrammatical in
 *      standard English, so the construction identifies the variety and
 *      unlocks the gloss for the token it confirms.
 *
 * The asymmetry is deliberate: over-detecting a dialect silently rewrites
 * every plain-English entry, which is invisible in testing and wrong all the
 * time; under-detecting one costs a modest adjustment on a short entry.
 *
 * Scoring, for one variety v:
 *
 *   conf(v) = min(0.9,  0.35·strongHits
 *                     + 0.20·syntacticHits
 *                     + 0.12·min(distinctiveSurfaceHits, 5))
 *
 * and v is reported only when conf(v) >= VARIETY_MIN_CONFIDENCE, i.e. only
 * when at least one distinctive surface form or syntactic signature fired.
 * The cap at 0.9 is there because this is a surface scan, not a trained
 * classifier, and must never claim certainty.
 */
export const STRONG_SIGNAL_WEIGHT = 0.35;
export const SYNTACTIC_HIT_WEIGHT = 0.20;
export const DISTINCTIVE_HIT_WEIGHT = 0.12;
export const MAX_COUNTED_HITS = 5;
export const VARIETY_MIN_CONFIDENCE = 0.10;

/**
 * The variety registry. Each entry names a variety id, the surface-form
 * lookup used to detect and match it, and a lightweight signature test used
 * only to decide WHICH variety a mixed-language entry is probably in before
 * normalising against its lexicon. Adding a new dialect module means adding
 * one entry here — nothing else in this file changes.
 */
const VARIETY_REGISTRY = Object.freeze([
  {
    id: "singlish",
    label: "Colloquial Singapore English (Singlish)",
    version: SINGLISH_LEXICON_VERSION,
    surfaceForms: SINGLISH_SURFACE_FORMS,
    lexicon: SINGLISH_LEXICON,
    ambiguousForms: new Set(SINGLISH_AMBIGUOUS_SURFACE_FORMS),
    syntacticPatterns: SINGLISH_SYNTACTIC_PATTERNS,
    // A handful of surface forms that are distinctive enough, on their own,
    // to be strong evidence of the variety (rather than shared/ambiguous
    // words like "already" or "one" that also occur in plain English).
    strongSignals: ["lah", "leh", "lor", "sian", "paiseh", "shiok", "walao", "kancheong", "kiasu", "sian ah", "nvm lor", "no choice lor", "buay tahan", "haiz", "pek chek", "rabak", "song", "sibei", "where got", "can or not", "damn shag", "bo bian", "lan lan", "dulan"],
  },
]);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(text, surfaceForms) {
  const lower = text.toLowerCase();
  const matches = [];
  for (const { surface, entry } of surfaceForms) {
    const re = new RegExp(`\\b${escapeRegExp(surface)}\\b`, "gi");
    let m;
    while ((m = re.exec(lower)) !== null) {
      matches.push({
        surface,
        matchedText: text.slice(m.index, m.index + m[0].length),
        index: m.index,
        length: m[0].length,
        entry,
      });
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }
  matches.sort((a, b) => a.index - b.index);
  return matches;
}

/**
 * Identifies the most likely dialect/variety an entry is written in, from a
 * lightweight surface-form scan — no ML model, deliberately cheap and
 * explainable like the rest of the analysis layer.
 *
 * @param {string} text
 * @returns {{ variety: string|null, confidence: number, candidates: Array<{variety:string, confidence:number}> }}
 */
export function identifyVariety(text) {
  if (!text) return { variety: null, confidence: 0, candidates: [] };

  const candidates = VARIETY_REGISTRY.map((v) => {
    const matches = findMatches(text, v.surfaceForms);
    // Rule 1: forms that also occur in plain English are not evidence.
    const distinctive = matches.filter((m) => !v.ambiguousForms.has(m.surface));
    const strongHits = distinctive.filter((m) => v.strongSignals.includes(m.entry.token)).length;
    const syntacticHits = (v.syntacticPatterns ?? []).filter((p) => p.pattern.test(text));
    const raw =
      strongHits * STRONG_SIGNAL_WEIGHT +
      syntacticHits.length * SYNTACTIC_HIT_WEIGHT +
      Math.min(distinctive.length, MAX_COUNTED_HITS) * DISTINCTIVE_HIT_WEIGHT;
    return {
      variety: v.id,
      lexiconVersion: v.version,
      confidence: Math.min(0.9, raw),
      strongHits,
      syntacticHits: syntacticHits.map((p) => p.id),
      confirmedTokens: syntacticHits.map((p) => p.token),
      distinctiveHits: distinctive.length,
      ambiguousHits: matches.length - distinctive.length,
    };
  }).sort((a, b) => b.confidence - a.confidence || a.variety.localeCompare(b.variety));

  const best = candidates[0];
  // Rule 2: below the floor, report nothing rather than a weak guess.
  if (!best || best.confidence < VARIETY_MIN_CONFIDENCE) {
    return { variety: null, confidence: 0, candidates };
  }
  return {
    variety: best.variety,
    lexiconVersion: best.lexiconVersion,
    confidence: best.confidence,
    syntacticHits: best.syntacticHits ?? [],
    confirmedTokens: best.confirmedTokens ?? [],
    candidates,
  };
}

/**
 * Runs the full dialect analysis for a journal entry: identifies the
 * variety, matches its lexicon against the text with spans, flags masked
 * distress, and returns the valence/arousal adjustments a caller should
 * fold into its VAD/sentiment read.
 *
 * @param {string} text
 * @returns {{
 *   variety: string|null,
 *   confidence: number,
 *   matchedTokens: Array<{ token, surface, matchedText, index, length, gloss, category, masksDistress }>,
 *   maskedDistress: boolean,
 *   valenceAdjustment: number,
 *   arousalAdjustment: number,
 * }}
 */
export function analyseDialect(text) {
  const id = identifyVariety(text);
  if (!id.variety) {
    return { variety: null, confidence: 0, lexiconVersion: null, matchedTokens: [], maskedDistress: false, valenceAdjustment: 0, arousalAdjustment: 0, prosodyUnavailable: false };
  }

  const registryEntry = VARIETY_REGISTRY.find((v) => v.id === id.variety);
  const matches = findMatches(text, registryEntry.surfaceForms);

  // Dedupe by OVERLAP, longest span first: "sian" sits inside "sian ah" and
  // "lah" inside "fine lah", and an exact-span check (what this used to do)
  // misses both, double counting the shorter form's valence shift on top of
  // the longer one's.
  const ordered = [...matches].sort((a, b) => a.index - b.index || b.length - a.length);
  const takenSpans = [];
  const matchedTokens = [];
  let valenceAdjustment = 0;
  let arousalAdjustment = 0;
  let maskedDistress = false;

  for (const m of ordered) {
    const start = m.index;
    const end = m.index + m.length;
    if (takenSpans.some(([s0, e0]) => start < e0 && end > s0)) continue;
    takenSpans.push([start, end]);

    const ambiguous = registryEntry.ambiguousForms.has(m.surface);
    // Rules 3-4: an ambiguous form is always reported, and counts because the
    // variety has already been identified on distinctive evidence above (a
    // null variety returned early), or because a syntactic signature
    // explicitly confirmed this very token.
    const counted = !ambiguous || id.confidence >= VARIETY_MIN_CONFIDENCE;

    matchedTokens.push({
      token: m.entry.token,
      surface: m.surface,
      matchedText: m.matchedText,
      index: m.index,
      length: m.length,
      gloss: m.entry.gloss,
      category: m.entry.category,
      valenceShift: m.entry.valenceShift,
      arousalShift: m.entry.arousalShift,
      masksDistress: m.entry.masksDistress && counted,
      ambiguous,
      counted,
    });

    if (!counted) continue;
    valenceAdjustment += m.entry.valenceShift;
    arousalAdjustment += m.entry.arousalShift;
    if (m.entry.masksDistress) maskedDistress = true;
  }

  // Clamp the accumulated adjustment so a run of particles can't blow past a
  // sane range -- this feeds into an existing VAD scale, not a raw score.
  valenceAdjustment = clamp(valenceAdjustment, -1, 1);
  arousalAdjustment = clamp(arousalAdjustment, -1, 1);

  return {
    variety: id.variety,
    confidence: id.confidence,
    lexiconVersion: registryEntry.version,
    matchedTokens,
    maskedDistress,
    valenceAdjustment,
    arousalAdjustment,
    // Written entries do not preserve the intonation that disambiguates many
    // particles. Callers should therefore treat particle glosses as stance
    // hypotheses, not a certain emotion label.
    prosodyUnavailable: matchedTokens.some((m) => m.category === "particle"),
  };
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

// ---------------------------------------------------------------------------
// Feedback seam.
//
// A user correction ("you got that wrong, I meant X") should be able to grow
// the lexicon over time. This function is the seam: it does NOT mutate the
// in-memory lexicon (which is frozen and shared across requests) and it does
// NOT persist anything itself -- persistence is the caller's job (e.g. a
// Supabase table of pending corrections a human/curation step reviews before
// it becomes a real lexicon entry). No UI is built against this; it exists
// so a future correction flow has a single, clearly-named place to call.
// ---------------------------------------------------------------------------

/**
 * Records a user's correction to a dialect read, e.g. "lor doesn't mean
 * resigned here, I meant X". Returns a plain, storable record; the caller
 * decides where it goes (a queue, a table, a log) and how/when a curated
 * lexicon entry gets derived from accumulated corrections.
 *
 * @param {{ text: string, variety?: string, token?: string, correction: string }} feedback
 * @returns {{ text: string, variety: string|null, token: string|null, correction: string, recordedAt: string }}
 */
export function recordDialectFeedback({ text, variety = null, token = null, correction }) {
  return {
    text: text ?? "",
    variety,
    token,
    correction: correction ?? "",
    recordedAt: new Date().toISOString(),
  };
}

export { VARIETY_REGISTRY };
