/**
 * text-features.js
 *
 * THE DETERMINISTIC TEXT MODEL. No LLM, no network, no randomness, no clock.
 * The same string always produces the same numbers, and every number here is
 * traceable to a stated rule in this comment block.
 *
 * ===========================================================================
 * 1. WHAT CHANGED AND WHY
 * ===========================================================================
 * This file used to be a bank of cue detectors only: it counted hedges,
 * minimisations, somatic idioms, absolutist words and first-person pronouns,
 * and it detected negations but never USED them for anything. There was no
 * valence, no arousal, no dominance — so the only thing that could turn a
 * journal entry into a number was an LLM call, and if the key was missing
 * the entry contributed nothing at all to the emotional state. That is the
 * defect this rewrite fixes: the lexicon layer now carries the load, and the
 * LLM (if present at all) is a separate, labelled, non-authoritative signal.
 *
 * ===========================================================================
 * 2. THE MODEL
 * ===========================================================================
 * A journal entry is mapped to one point (V, A, D) in [-1,1]^3 — the same
 * space check-ins map to (emotion-space.js), so the two are commensurable.
 *
 * Step 1 — tokenise. Lowercase, split on non-letters, keep byte offsets so
 *   every match can be shown back to the user or audited.
 *
 * Step 2 — phrase pass. Multiword entries (VAD_PHRASES, longest first) match
 *   before single tokens and CONSUME their tokens, so "burnt out" scores once
 *   as burnout rather than twice as "burnt" + "out".
 *
 * Step 3 — token pass. Every remaining token is looked up in VAD_LEXICON by
 *   surface form, then by stem (lexicon.js stemToken).
 *
 * Step 4 — valence shifters. For each hit at token index p, scan back up to
 *   MODIFIER_WINDOW = 3 tokens, stopping at a clause breaker (but, however,
 *   though, ...) so "I'm not tired, but I am sad" does not negate "sad":
 *
 *     m_p  = Π intensifier multipliers found in the window   (default 1,
 *            clamped to [0.3, 2.0] so stacked intensifiers cannot run away)
 *     neg_p = true if any negator is found in the window
 *
 *   Negation is SHIFTED, not mirrored (Polanyi & Zaenen 2006; Taboada et al.
 *   2011): "not happy" is a weak negative, not the equal-and-opposite of
 *   "happy". So
 *
 *     v'_p = neg_p ? NEGATION_FLIP · v_p : v_p        (NEGATION_FLIP = -0.7)
 *     a'_p = neg_p ? NEGATION_ATTENUATE · a_p : a_p   (NEGATION_ATTENUATE = 0.6)
 *     d'_p = neg_p ? NEGATION_ATTENUATE · d_p : d_p
 *
 *   Arousal and dominance are attenuated but never flipped: the negation of
 *   an activated state is a less activated state, not a deactivated one.
 *
 * Step 5 — aggregation with shrinkage toward neutral. With W = Σ m_p,
 *
 *     V_raw = Σ m_p·v'_p / (W + κ),   κ = PRIOR_MASS = 2
 *
 *   and likewise for A and D. The κ pseudo-count at (0,0,0) is the honesty
 *   term: one affect word in a 200-word entry yields |V| ≈ 0.3·v, not |v|.
 *   A plain mean would report full confidence off a single word, which is
 *   exactly the kind of invented precision this model is not allowed to have.
 *
 * Step 5a — non-lexical evidence enters the SAME sum, as pseudo-terms, so
 *   there is one denominator and every axis stays inside [-1,1] without
 *   needing a clamp to save it:
 *
 *   (a) Dialect. Each counted token from dialect/index.js contributes
 *       v = DIALECT_GAIN · valenceShift, a = DIALECT_GAIN · arousalShift,
 *       d = 0, with weight 1. A "lor"- or "sian"-marked entry is therefore
 *       negative even when every content word is neutral — the false-negative
 *       case this whole layer exists to catch. Dialect spans also CONSUME
 *       their tokens, so "fine lah" is not scored again as the English
 *       "fine".
 *
 *   (c) Minimisation idioms. "I'm fine", "it's not that bad", "no big deal"
 *       CONSUME their spans without contributing a value. They are speech
 *       acts, not literal reports; scoring them literally made an entry that
 *       did nothing but minimise distress come out mildly POSITIVE, because
 *       the negation rule read "not that bad" as a positive use of "bad".
 *       They are counted once, as masking evidence, in Step 6.
 *
 *   (b) Somatic idioms. Each matched SOMATIC_DISTRESS_LEXICON phrase
 *       contributes the fixed distress point SOMATIC_TERM = (-0.75, +0.45,
 *       -0.50) with weight = that phrase's documented weight. Body language
 *       IS emotional evidence here, not a physical complaint to be filtered
 *       out; giving it a weight rather than a raw offset means a long entry
 *       with one somatic phrase is not scored like an entry that is nothing
 *       but somatic phrases.
 *
 * Step 6 — documented adjustments, applied after aggregation:
 *
 *   (c) Masking. Two distinct effects, deliberately asymmetric:
 *         - an entry whose valence is POSITIVE and that hedges gets its
 *           positive valence discounted (understated good is still good, but
 *           less confidently so);
 *         - an entry that hedges WHILE carrying a distress marker (somatic
 *           idiom, self-discrepancy, dialect masked-distress, or already
 *           negative valence) gets a NEGATIVE offset. "I'm fine lah, just a
 *           bit sian" must not land near neutral.
 *       The asymmetry is intentional and is the safe direction: in a
 *       wellbeing app a false negative (missing distress) costs more than a
 *       false positive (over-reading a rough entry).
 *
 *   (d) Agency. AGENCY_MARKERS adjust DOMINANCE by ±AGENCY_STEP each, capped
 *       at ±AGENCY_CAP, because agency lives in the construction ("I decided
 *       to stop") rather than in any single affect-bearing word.
 *
 *   Finally each axis is clamped to [-1, 1].
 *
 * Step 7 — evidence and confidence. The reading's own confidence is
 *
 *     E    = W + 0.5·(somatic weight) + 0.5·(strong dialect hits)
 *     conf = E / (E + κ)                                (0 when nothing matched)
 *
 *   so confidence is a function of how much lexical evidence was actually
 *   found, and is 0 — not 0.5, not "neutral" — for an entry the model has
 *   nothing to say about. Callers must treat conf = 0 as "no reading", not
 *   as "reads neutral".
 *
 * ===========================================================================
 * 3. WHAT THIS MODEL DELIBERATELY DOES NOT DO
 * ===========================================================================
 *  - It does not do syntax, coreference, or sarcasm. A lexicon model cannot,
 *    and pretending otherwise would be the same hand-waving being removed.
 *  - It does not classify anything clinical. Counts are counts.
 *  - It does not consult an LLM, a clock, a random source, or the network.
 *    index.js may attach an LLM reading alongside this one, clearly labelled,
 *    and is forbidden from folding it into the deterministic score.
 */

import { SOMATIC_DISTRESS_LEXICON } from "./cultural-calibration.js";
import { analyseDialect } from "./dialect/index.js";
import { appraiseThoughts } from "./thought-appraisal.js";
import { collapseExpressiveLengthening, resolveInformalMarkers } from "./informal-pragmatics.js";
import {
  VAD_PHRASES, PHRASE_KEYS, INTENSIFIERS, NEGATORS as VAD_NEGATORS,
  MODIFIER_WINDOW, NEGATION_FLIP, NEGATION_ATTENUATE, CLAUSE_BREAKERS,
  TEMPORAL_MARKERS, AGENCY_MARKERS, AGENCY_STEP, AGENCY_CAP,
  lookupToken, LEXICON_VERSION,
} from "./lexicon.js";

// Pseudo-count of neutral evidence. See Step 5 above.
export const PRIOR_MASS = 2;

// Dialect and somatic pseudo-term constants (Step 5a).
// DIALECT_GAIN converts a lexicon "shift" (authored on the same [-1,1] scale
// but as an offset) into a term VALUE. Polyfunctional particles have zero
// valence; context-specific constructions and affect words carry direction.
export const DIALECT_GAIN = 1.6;
export const SOMATIC_TERM = Object.freeze({ v: -0.75, a: 0.45, d: -0.50 });

// Masking constants (Step 6c).
export const MASK_DISCOUNT_PER_CUE = 0.12; // discount on positive valence
export const MASK_PENALTY_PER_CUE = 0.11;  // offset on masked distress
export const MASK_MAX_CUES = 3;

const NEGATORS = ["not", "never", "hardly", "barely", "isn't", "wasn't", "aren't", "don't", "doesn't", "didn't", "no", "n't"];

const HEDGING_CUES = [
  "kind of", "sort of", "i guess", "maybe", "a little", "not that big of a deal",
  "it's whatever", "probably overreacting", "i mean", "i don't know", "idk",
  "not a huge deal", "not the end of the world", "just a bit", "somewhat",
];

const MINIMISATION_CUES = [
  "i'm fine", "im fine", "it's fine", "its fine", "it's nothing", "its nothing",
  "don't worry about it", "dont worry about it", "no big deal", "it's okay, really",
  "i'm okay", "im okay", "it's not that bad", "its not that bad", "whatever, it's fine",
];

const SELF_DISCREPANCY_CUES = [
  "should be", "should have", "should've", "shouldn't be", "wish i",
  "used to be", "used to feel", "everyone else", "supposed to be",
  "supposed to feel", "meant to be", "by now i should",
];

const ABSOLUTIST_WORDS = [
  "always", "never", "everyone", "no one", "nobody", "everybody", "nothing",
  "everything", "completely", "totally", "entirely", "forever", "none",
  "every time", "constantly", "all the time", "no matter what",
];

const FIRST_PERSON_PRONOUNS = ["i", "me", "my", "mine", "myself"];

function findAllCues(text, cues) {
  const lower = text.toLowerCase();
  const matches = [];
  for (const cue of cues) {
    const escaped = cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    let m;
    while ((m = re.exec(lower)) !== null) {
      matches.push({ cue, index: m.index, length: m[0].length, text: text.slice(m.index, m.index + m[0].length) });
      if (m.index === re.lastIndex) re.lastIndex += 1; // guard against zero-width loops
    }
  }
  matches.sort((a, b) => a.index - b.index);
  return { matches, count: matches.length };
}

/** Hedging / minimisation cue detection with spans. */
export function detectHedging(text) {
  if (!text) return { matches: [], count: 0 };
  return findAllCues(text, HEDGING_CUES);
}

export function detectMinimisation(text) {
  if (!text) return { matches: [], count: 0 };
  return findAllCues(text, MINIMISATION_CUES);
}

/** Somatic idiom of distress detection (see cultural-calibration.js). */
export function detectSomaticIdioms(text) {
  if (!text) return { matches: [], count: 0, weightSum: 0 };
  const found = findAllCues(text, SOMATIC_DISTRESS_LEXICON.map((e) => e.phrase));
  const weightByPhrase = new Map(SOMATIC_DISTRESS_LEXICON.map((e) => [e.phrase, e.weight]));
  const weightSum = found.matches.reduce((s, m) => s + (weightByPhrase.get(m.cue) ?? 0.5), 0);
  return { ...found, weightSum };
}

/** Self-discrepancy cues: "should be", "wish I", "used to be", "everyone else". */
export function detectSelfDiscrepancy(text) {
  if (!text) return { matches: [], count: 0 };
  return findAllCues(text, SELF_DISCREPANCY_CUES);
}

/** Absolutist word counts, plus a ratio to total word count. */
export function countAbsolutist(text) {
  if (!text) return { matches: [], count: 0, ratio: 0 };
  const { matches, count } = findAllCues(text, ABSOLUTIST_WORDS);
  const totalWords = tokenize(text).length || 1;
  return { matches, count, ratio: count / totalWords };
}

/** First-person pronoun density: a well-documented depression-linguistics signal. */
export function firstPersonDensity(text) {
  if (!text) return { count: 0, totalWords: 0, density: 0 };
  const words = tokenize(text);
  const count = words.filter((w) => FIRST_PERSON_PRONOUNS.includes(w)).length;
  return { count, totalWords: words.length, density: words.length ? count / words.length : 0 };
}

/**
 * Negation handling: for each negator, flip the polarity of the nearest
 * following content word within a 3-token window. Returns spans describing
 * what was negated. Kept as a standalone reporting detector; the VAD model
 * below does its own backward-scanning negation (Step 4), which is the
 * version that actually moves a number.
 */
export function detectNegations(text) {
  if (!text) return { matches: [], count: 0 };
  const words = tokenizeWithOffsets(text);
  const matches = [];
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i].word;
    if (!NEGATORS.includes(w)) continue;
    for (let j = i + 1; j < Math.min(i + 4, words.length); j += 1) {
      if (isStopword(words[j].word)) continue;
      matches.push({
        negator: w,
        negatorIndex: words[i].index,
        target: words[j].word,
        targetIndex: words[j].index,
        distance: j - i,
      });
      break;
    }
  }
  return { matches, count: matches.length };
}

const STOPWORDS = new Set(["the", "a", "an", "and", "but", "or", "is", "was", "were", "am", "are", "to", "of", "in", "on", "for", "it", "that", "this", ...NEGATORS]);
function isStopword(w) {
  return STOPWORDS.has(w);
}

function tokenize(text) {
  return text.toLowerCase().match(/[a-z']+/g) || [];
}

function tokenizeWithOffsets(text) {
  const lower = text.toLowerCase();
  const re = /[a-z']+/g;
  const out = [];
  let m;
  while ((m = re.exec(lower)) !== null) {
    out.push({ word: m[0], index: m.index });
  }
  return out;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function normaliseWord(w) {
  return w.replace(/['’]/g, "");
}

// ---------------------------------------------------------------------------
// Temporal orientation (Step 2 of the feature set, reported not folded).
// ---------------------------------------------------------------------------

/**
 * Counts past/present/future markers and reports the dominant orientation
 * plus a past-vs-future balance in [-1, 1] (-1 = wholly past-oriented,
 * +1 = wholly future-oriented, 0 = balanced or no markers at all).
 *
 * This is REPORTED, never folded into valence. Past-heavy journalling is
 * associated with rumination and future-heavy with either planning or
 * anticipatory anxiety — which of those it is depends on the arousal and
 * dominance of the same entry, so the decision belongs to the caller, not
 * here.
 */
export function temporalOrientation(text) {
  if (!text) return { past: 0, present: 0, future: 0, dominant: "none", balance: 0 };
  const counts = {};
  for (const [bucket, cues] of Object.entries(TEMPORAL_MARKERS)) {
    counts[bucket] = findAllCues(text, cues).count;
  }
  const total = counts.past + counts.present + counts.future;
  const dominant = total === 0
    ? "none"
    : Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const pf = counts.past + counts.future;
  return {
    past: counts.past,
    present: counts.present,
    future: counts.future,
    dominant,
    balance: pf === 0 ? 0 : (counts.future - counts.past) / pf,
  };
}

/** Agency markers -> a bounded dominance adjustment. */
export function agencyAdjustment(text) {
  if (!text) return { high: 0, low: 0, adjustment: 0 };
  const high = findAllCues(text, AGENCY_MARKERS.high).count;
  const low = findAllCues(text, AGENCY_MARKERS.low).count;
  const raw = (high - low) * AGENCY_STEP;
  return { high, low, adjustment: clamp(raw, -AGENCY_CAP, AGENCY_CAP) };
}

// ---------------------------------------------------------------------------
// The VAD model itself (Steps 2-7 of the comment block at the top).
// ---------------------------------------------------------------------------

function phrasePass(lowerText) {
  const hits = [];
  const covered = [];
  for (const phrase of PHRASE_KEYS) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(`\\b${escaped}\\b`, "g");
    let m;
    while ((m = re.exec(lowerText)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (covered.some(([s, e]) => start < e && end > s)) continue;
      covered.push([start, end]);
      hits.push({ term: phrase, start, end, ...VAD_PHRASES[phrase] });
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }
  return { hits, covered };
}

/**
 * Scan backwards from token index p for valence shifters, stopping at a
 * clause breaker. Returns { multiplier, negated, cues }.
 */
function shiftersBefore(tokens, p) {
  let multiplier = 1;
  let negated = false;
  const cues = [];
  for (let k = p - 1; k >= 0 && k >= p - MODIFIER_WINDOW; k -= 1) {
    const raw = normaliseWord(tokens[k].word);
    const w = collapseExpressiveLengthening(raw);
    if (CLAUSE_BREAKERS.includes(w)) break;
    if (VAD_NEGATORS.includes(w)) { negated = true; cues.push({ type: "negator", word: w, index: tokens[k].index }); continue; }
    if (INTENSIFIERS[w] != null) { multiplier *= INTENSIFIERS[w]; cues.push({ type: "intensifier", word: w, factor: INTENSIFIERS[w], index: tokens[k].index }); }
  }
  const postfix = normaliseWord(tokens[p + 1]?.word ?? "");
  if (postfix === "af" || postfix === "asf") {
    multiplier *= 1.55;
    cues.push({ type: "postfix-intensifier", word: postfix, factor: 1.55, index: tokens[p + 1].index });
  }
  return { multiplier: clamp(multiplier, 0.3, 2.0), negated, cues };
}

function discourseWeight(index, lowerText) {
  const matches = [...lowerText.matchAll(/\b(?:but|however|although|though|yet|whereas)\b/g)];
  if (!matches.length) return 1;
  const pivot = matches.at(-1);
  const start = pivot.index ?? 0;
  const end = start + pivot[0].length;
  if (index < start) return 0.82;
  if (index >= end) return 1.18;
  return 1;
}

/**
 * The deterministic VAD reading for one piece of text.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {object} [opts.dialect] - a precomputed analyseDialect() result, so
 *   analyseText() does not run the dialect scan twice.
 * @returns {{
 *   valence:number, arousal:number, dominance:number,
 *   evidence:number, confidence:number,
 *   terms:Array<{term:string,index:number,v:number,a:number,d:number,multiplier:number,negated:boolean}>,
 *   adjustments:object, lexiconVersion:string
 * }}
 */
export function textVAD(text, opts = {}) {
  const empty = {
    valence: 0, arousal: 0, dominance: 0, evidence: 0, confidence: 0,
    positiveMass: 0, negativeMass: 0,
    terms: [], adjustments: { dialectTermCount: 0, somaticWeight: 0, masking: 0, agency: 0 },
    lexiconVersion: LEXICON_VERSION,
  };
  if (!text || typeof text !== "string" || !text.trim()) return empty;

  const lower = text.toLowerCase();
  const tokens = tokenizeWithOffsets(text);
  const appraisal = appraiseThoughts(text);

  // Step 2: phrases first, and remember which character spans they consumed.
  const { hits: phraseHits, covered } = phrasePass(lower);
  const isCovered = (idx, len) => covered.some(([s, e]) => idx < e && idx + len > s);

  const terms = [];
  let vSum = 0, aSum = 0, dSum = 0, wSum = 0;

  // Phrase hits: find the token index where the phrase starts so the same
  // backward shifter scan applies to them too.
  for (const hit of phraseHits) {
    const p = tokens.findIndex((t) => t.index >= hit.start);
    const shifted = p === -1 ? { multiplier: 1, negated: false } : shiftersBefore(tokens, p);
    const multiplier = shifted.multiplier * discourseWeight(hit.start, lower);
    const { negated } = shifted;
    const v = negated ? NEGATION_FLIP * hit.v : hit.v;
    const a = negated ? NEGATION_ATTENUATE * hit.a : hit.a;
    const d = negated ? NEGATION_ATTENUATE * hit.d : hit.d;
    vSum += multiplier * v; aSum += multiplier * a; dSum += multiplier * d; wSum += multiplier;
    terms.push({ term: hit.term, index: hit.start, v, a, d, multiplier, negated, kind: "phrase" });
  }

  // Step 5a(a): dialect tokens are pseudo-terms AND consume their spans, so
  // "fine lah" cannot also be counted as the English adjective "fine".
  const dialect = opts.dialect ?? analyseDialect(text);
  for (const dt of dialect.matchedTokens ?? []) {
    covered.push([dt.index, dt.index + dt.length]);
    if (!dt.counted) continue;
    const v = clamp(DIALECT_GAIN * (dt.valenceShift ?? 0), -1, 1);
    const a = clamp(DIALECT_GAIN * (dt.arousalShift ?? 0), -1, 1);
    if (v === 0 && a === 0) continue; // a pure discourse particle carries no affect
    const multiplier = discourseWeight(dt.index, lower);
    vSum += multiplier * v; aSum += multiplier * a; wSum += multiplier;
    terms.push({ term: dt.token, index: dt.index, v, a, d: 0, multiplier, negated: false, kind: "dialect" });
  }

  // Informal markers consume their spans before ordinary token lookup. Their
  // contextual values are resolved after the ordinary proposition supplies
  // a direction, so "lmao" is not automatically happiness and "omg" can
  // intensify either delight or distress.
  const informalEarly = resolveInformalMarkers(text, 0);
  for (const marker of informalEarly.markers) {
    covered.push([marker.index, marker.index + marker.length]);
  }

  // Step 5a(c): MINIMISATION IDIOMS CONSUME THEIR SPANS.
  //
  // "I'm fine", "it's not that bad", "no big deal" are speech acts, not
  // literal reports, and scoring them literally is actively wrong: the
  // negation rule turns "it's not that bad" into a POSITIVE reading of the
  // word "bad", so an entry doing nothing but minimising distress came out
  // mildly positive. The phrase is evidence of masking (Step 6c), which is
  // where it is counted; its component words are excluded here so it cannot
  // also be counted as a cheerful self-report.
  const minimisationEarly = detectMinimisation(text);
  for (const m of minimisationEarly.matches) {
    covered.push([m.index, m.index + m.length]);
  }

  // Step 5a(b): somatic idioms as weighted pseudo-terms.
  const somatic = detectSomaticIdioms(text);
  const somaticWeightByPhrase = new Map(SOMATIC_DISTRESS_LEXICON.map((e) => [e.phrase, e.weight]));
  for (const m of somatic.matches) {
    const w = (somaticWeightByPhrase.get(m.cue) ?? 0.5) * discourseWeight(m.index, lower);
    covered.push([m.index, m.index + m.length]);
    vSum += w * SOMATIC_TERM.v; aSum += w * SOMATIC_TERM.a; dSum += w * SOMATIC_TERM.d; wSum += w;
    terms.push({ term: m.cue, index: m.index, v: SOMATIC_TERM.v, a: SOMATIC_TERM.a, d: SOMATIC_TERM.d, multiplier: w, negated: false, kind: "somatic" });
  }

  // Step 3-4: single tokens not already consumed by a phrase, dialect token
  // or somatic idiom.
  for (let p = 0; p < tokens.length; p += 1) {
    const tok = tokens[p];
    if (isCovered(tok.index, tok.word.length)) continue;
    const entry = lookupToken(tok.word);
    if (!entry) continue;
    const shifted = shiftersBefore(tokens, p);
    const multiplier = shifted.multiplier * discourseWeight(tok.index, lower);
    const { negated } = shifted;
    const v = negated ? NEGATION_FLIP * entry.v : entry.v;
    const a = negated ? NEGATION_ATTENUATE * entry.a : entry.a;
    const d = negated ? NEGATION_ATTENUATE * entry.d : entry.d;
    vSum += multiplier * v; aSum += multiplier * a; dSum += multiplier * d; wSum += multiplier;
    terms.push({ term: entry.key, index: tok.index, v, a, d, multiplier, negated, kind: "token" });
  }

  const propositionValence = wSum > 0 ? vSum / wSum : 0;
  const informal = resolveInformalMarkers(text, propositionValence);
  for (const marker of informal.markers) {
    if (marker.v === 0 && marker.a === 0 && marker.d === 0) continue;
    const contextual = ["exclamation", "address-exasperation", "laughter", "outcome", "uncertainty", "agreement-intensifier"].includes(marker.function);
    const multiplier = (contextual ? 0.7 : 1) * discourseWeight(marker.index, lower);
    vSum += multiplier * marker.v;
    aSum += multiplier * marker.a;
    dSum += multiplier * marker.d;
    wSum += multiplier;
    terms.push({
      term: marker.token,
      index: marker.index,
      v: marker.v,
      a: marker.a,
      d: marker.d,
      multiplier,
      negated: false,
      kind: "informal",
      function: marker.function,
    });
  }

  terms.sort((x, y) => x.index - y.index);

  // Step 5: shrinkage toward neutral.
  const denom = wSum + PRIOR_MASS;
  let V = vSum / denom;
  let A = aSum / denom;
  let D = dSum / denom;

  // Step 6c: masking, asymmetric by design.
  const hedging = detectHedging(text);
  const minimisation = minimisationEarly;
  const selfDiscrepancy = detectSelfDiscrepancy(text);
  const maskCues = Math.min(MASK_MAX_CUES, hedging.count + minimisation.count);
  const distressPresent =
    somatic.count > 0 || selfDiscrepancy.count > 0 || dialect.maskedDistress || informal.maskedDistress || V < 0;
  let maskingAdj = 0;
  if (maskCues > 0) {
    if (V > 0) {
      maskingAdj += -V * MASK_DISCOUNT_PER_CUE * maskCues;
    }
    if (distressPresent) {
      maskingAdj += -MASK_PENALTY_PER_CUE * maskCues;
    }
  }
  V += maskingAdj;

  // Step 6d: agency -> dominance.
  const agency = agencyAdjustment(text);
  D += agency.adjustment;

  // Step 6e: bounded clause-level appraisal. This distinguishes, for
  // example, passive sadness from anticipatory workload dread and irritated
  // task aversion even when all three contain the word "sian".
  V += appraisal.vadDelta.valence;
  A += appraisal.vadDelta.arousal + (wSum > 0 ? informal.orthography.arousalDelta : 0);
  D += appraisal.vadDelta.dominance;

  // Independent positive and negative mass, on the same shrunk scale as V.
  // These are what dialectical affect must be judged on: a bipolar valence
  // near zero can mean "nothing much happened" or "a lot of good AND a lot of
  // bad in the same day", and collapsing the second case to "neutral" is the
  // documented error cultural-calibration.js exists to prevent.
  let posMass = 0, negMass = 0;
  for (const t of terms) {
    const contribution = t.multiplier * t.v;
    if (contribution > 0) posMass += contribution; else negMass -= contribution;
  }
  const positiveMass = posMass / denom + Math.max(0, appraisal.vadDelta.valence);
  const negativeMass = negMass / denom + Math.max(0, -appraisal.vadDelta.valence);

  // Step 7: evidence and confidence.
  const strongDialectHits = (dialect.matchedTokens ?? []).filter((t) => t.masksDistress).length;
  const appraisalEvidence = 1.2 * Math.max(
    appraisal.dimensions.pressure,
    appraisal.dimensions.taskAversiveness,
    appraisal.dimensions.goalObstruction,
    appraisal.dimensions.futureThreat,
  );
  const evidence = wSum + 0.5 * somatic.weightSum + 0.5 * strongDialectHits + appraisalEvidence;
  const confidence = evidence > 0 ? evidence / (evidence + PRIOR_MASS) : 0;

  return {
    valence: clamp(V, -1, 1),
    arousal: clamp(A, -1, 1),
    dominance: clamp(D, -1, 1),
    evidence,
    confidence,
    positiveMass,
    negativeMass,
    terms,
    adjustments: {
      dialectTermCount: terms.filter((t) => t.kind === "dialect").length,
      informalTermCount: terms.filter((t) => t.kind === "informal").length,
      somaticWeight: somatic.weightSum,
      masking: maskingAdj,
      agency: agency.adjustment,
      appraisal: appraisal.vadDelta,
      informalOrthography: informal.orthography.arousalDelta,
    },
    appraisal,
    informal,
    lexiconVersion: LEXICON_VERSION,
  };
}

/**
 * Runs every detector and returns one structured object. Backward compatible:
 * every field the previous version returned is still present and still means
 * the same thing; `vad`, `temporal`, `agency` and `selfReferenceDensity` are
 * additive.
 */
export function analyseText(text) {
  const hedging = detectHedging(text);
  const minimisation = detectMinimisation(text);
  const somatic = detectSomaticIdioms(text);
  const selfDiscrepancy = detectSelfDiscrepancy(text);
  const absolutist = countAbsolutist(text);
  const pronouns = firstPersonDensity(text);
  const negations = detectNegations(text);
  const dialect = analyseDialect(text);
  const vad = textVAD(text, { dialect });
  const temporal = temporalOrientation(text);
  const agency = agencyAdjustment(text);

  return {
    hedgingCount: hedging.count,
    minimisationCount: minimisation.count,
    somaticCount: somatic.count,
    somaticWeight: somatic.weightSum,
    selfDiscrepancyCount: selfDiscrepancy.count,
    absolutistCount: absolutist.count,
    absolutistRatio: absolutist.ratio,
    firstPersonDensity: pronouns.density,
    // Alias under the name the model spec uses; same number, clearer label.
    selfReferenceDensity: pronouns.density,
    wordCount: pronouns.totalWords,
    negationCount: negations.count,

    // The deterministic affect reading. Callers that need a number use this.
    vad: { valence: vad.valence, arousal: vad.arousal, dominance: vad.dominance },
    vadEvidence: vad.evidence,
    vadConfidence: vad.confidence,
    positiveMass: vad.positiveMass,
    negativeMass: vad.negativeMass,
    vadTerms: vad.terms,
    vadAdjustments: vad.adjustments,
    appraisal: vad.appraisal,
    informal: vad.informal,
    lexiconVersion: vad.lexiconVersion,

    temporal,
    agency,

    // Dialect-aware masked-distress signal: true when a matched dialect
    // token (e.g. Singlish "lor", "sian", "shag") is a classic vehicle for
    // understating real distress behind neutral-looking content words. A
    // caller must NOT treat an entry as neutral just because this is true
    // and no other negative-sentiment word is present.
    dialectVariety: dialect.variety,
    dialectConfidence: dialect.confidence,
    dialectLexiconVersion: dialect.lexiconVersion,
    maskedDistress: dialect.maskedDistress || Boolean(vad.informal?.maskedDistress),
    dialectValenceAdjustment: dialect.valenceAdjustment,
    dialectArousalAdjustment: dialect.arousalAdjustment,
    dialectProsodyUnavailable: Boolean(dialect.prosodyUnavailable),
    matches: { hedging: hedging.matches, minimisation: minimisation.matches, somatic: somatic.matches, selfDiscrepancy: selfDiscrepancy.matches, negations: negations.matches, dialect: dialect.matchedTokens, informal: vad.informal?.markers ?? [] },
  };
}
