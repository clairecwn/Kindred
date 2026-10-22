/**
 * interpretation.js — WHAT DID THE USER MEAN? (lexicon prior × model reading)
 *
 * The assessor model is good at reading context, new slang and messy
 * grammar; the lexicon is reproducible, explainable, and knows Singapore and
 * kids' usage the model may not. This module joins them by Bayes' rule
 * instead of letting either win outright.
 *
 *   1. lexiconReadings(text): every slang / Singlish / meme term the
 *      deterministic layer found, with its candidate senses and their prior
 *      posterior (sense-model.js), plus unknown slang-shaped words. This is
 *      shown to the model as candidates, never as instructions.
 *
 *   2. The model returns an `interpretation` block (schema below): a plain
 *      gloss, a sense choice per term with a confidence, the message's mode
 *      (play, hyperbole, venting...) and what the person seems to want (need).
 *
 *   3. evaluateInterpretation(): deterministic validation. A term must occur
 *      in the user's text; a sense id must be one of the candidates (else it
 *      is kept as a free-text meaning for a NEW term, never forced onto an
 *      old sense); enums are whitelisted; numbers are clamped.
 *
 *   4. The chosen sense becomes a likelihood ratio, not a verdict:
 *        L(chosen) = LR[confidence],  L(other senses) = 1
 *      and the posterior is recomputed with sense-model.js. A confident
 *      model reading moves the posterior a lot; a hesitant one a little;
 *      neither can erase a sense entirely (LIK_MIN floor in sense-model).
 *
 * Model readings never update a user's sense counts: only the user's own
 * confirmations and explanations do (personal-memory.js). Otherwise the model
 * would teach itself its own guesses.
 */

import { analyseText } from "./text-features.js";
import { analyseDialect } from "./dialect/index.js";
import { findYouthSlang } from "./youth-slang.js";
import { sensesOf } from "./sense-model.js";
import { detectCrisisLanguage } from "./crisis-detection.js";
import { SINGLISH_LEXICON } from "./dialect/singlish.js";

const SINGLISH_BY_TOKEN = new Map(SINGLISH_LEXICON.map((e) => [e.token, e]));

export const INTERPRETATION_VERSION = "interpretation-2026.10.1";
export const MODES = Object.freeze(["literal", "play", "hyperbole", "understatement", "irony", "venting", "mixed"]);
export const NEEDS = Object.freeze(["be-heard", "vent", "make-sense", "advice", "distraction", "celebrate", "play", "company", "answer"]);
export const CONFIDENCE_LR = Object.freeze({ low: 1.5, medium: 3, high: 6 });

export const INTERPRETATION_SCHEMA = `"interpretation":{"gloss":"plain-English paraphrase of the latest user message, keeping its tone","terms":[{"term":"exact slang/short form/Singlish/meme text from the user","senseId":"one candidate id, or null if none fits","meaning":"what it means here","confidence":"low|medium|high"}],"mode":"${MODES.join("|")}","need":"${NEEDS.join("|")}","valence":-1.0,"valenceConfidence":0.0,"unknownTerms":["terms you could not work out"],"followUps":[{"what":"short name of something coming up for them, e.g. maths exam","when":"today|tonight|tmr|this weekend|next week|mon..sun|YYYY-MM-DD","quote":"their exact words"}]}`;

export const INTERPRETATION_GUIDANCE = `Interpretation: read the latest message the way a close friend from the user's own culture and age group would. The gloss restates what they said and felt, in plain words; never add a cause they did not give, and if they said they don't know why, the gloss says that. Messy grammar, missing punctuation, short forms, kids' spellings, Singlish particles and meme words are normal; work out the meaning from context. lexiconReadings lists terms already recognised with candidate senses and prior probabilities: choose a candidate id when one fits, otherwise null with your own meaning. A meme call-out or joke with no feeling behind it is mode play and need play; a dramatic phrase about a small thing is hyperbole; "ok lor"-style flat wording over something heavy can be understatement. A joke never cancels a real sign of distress elsewhere in the message. Put a term in unknownTerms instead of guessing when context does not settle it. valence is the latest message's overall feeling from -1 to 1 with your confidence 0 to 1. followUps lists only real upcoming events or plans the user mentions (an exam, a match, seeing someone), so a friend could ask about them later; leave it empty otherwise.`;

/** Deterministic readings handed to the model as candidates. Pure. */
export function lexiconReadings(text, senseOpts = {}) {
  const value = String(text ?? "");
  const features = analyseText(value, { senseOpts });
  const dialect = analyseDialect(value, senseOpts);
  const youth = findYouthSlang(value);
  const terms = [];
  for (const t of dialect.matchedTokens ?? []) {
    if (!t.counted) continue;
    terms.push({ term: t.matchedText, token: t.token, source: "singlish", sense: t.sense });
  }
  for (const marker of features.matches?.informal ?? []) {
    if (!String(marker.function ?? "").startsWith("youth-")) continue;
    terms.push({ term: marker.matchedText, token: marker.token, source: "youth", sense: marker.sense, ageRating: marker.ageRating });
  }
  // Attach full candidate lists so the model can choose among them.
  const byToken = new Map(youth.map((h) => [h.entry.token, h.entry]));
  return {
    version: INTERPRETATION_VERSION,
    terms: terms.map((t) => {
      const entry = t.source === "youth" ? byToken.get(t.token) : SINGLISH_BY_TOKEN.get(t.token);
      const senses = entry ? sensesOf(entry) : [];
      const candidates = senses.length > 1 ? senses.map((s) => ({ id: s.id, gloss: s.gloss })) : undefined;
      return { term: t.term, token: t.token, source: t.source, likely: t.sense ? { id: t.sense.id, gloss: t.sense.gloss, p: Number(t.sense.p.toFixed(2)) } : null, candidates, ageRating: t.ageRating };
    }),
    unknownTerms: features.unknownTerms ?? [],
    spellingReadings: features.spellingReadings ?? [],
    playMass: Number((features.playMass ?? 0).toFixed(2)),
    crisis: detectCrisisLanguage(value).isCrisis,
  };
}

/** Candidate sense ids per token, for validation. Includes Singlish entries. */
function candidateIndex(text, senseOpts) {
  const index = new Map();
  for (const h of findYouthSlang(text)) index.set(h.entry.token, { matched: h.matchedText.toLowerCase(), ids: sensesOf(h.entry).map((s) => s.id) });
  for (const t of analyseDialect(text, senseOpts).matchedTokens ?? []) {
    if (!t.counted) continue;
    const entry = SINGLISH_BY_TOKEN.get(t.token);
    index.set(t.token, { matched: t.matchedText.toLowerCase(), ids: entry ? sensesOf(entry).map((s) => s.id) : null });
  }
  return index;
}

const norm = (v) => String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * @param {object} raw     model output's `interpretation` block
 * @param {string} text    the user text the interpretation is about
 * @param {object} [opts]  { senseOpts }
 * @returns validated interpretation + interpreterSenses for sense-model.js
 */
export function evaluateInterpretation(raw, text, opts = {}) {
  const value = String(text ?? "");
  const lower = norm(value);
  const index = candidateIndex(value, opts.senseOpts);
  const terms = [];
  const interpreterSenses = {};
  for (const item of Array.isArray(raw?.terms) ? raw.terms.slice(0, 12) : []) {
    const term = norm(item?.term);
    if (term.length < 1 || !lower.includes(term)) continue;            // must be the user's own text
    const confidence = ["low", "medium", "high"].includes(item?.confidence) ? item.confidence : "low";
    const hit = [...index.entries()].find(([token, info]) => info.matched === term || token === term || term.includes(info.matched));
    const ids = hit ? hit[1].ids : null;
    const senseId = ids && ids.includes(item?.senseId) ? item.senseId : null;
    if (hit && senseId) {
      interpreterSenses[hit[0]] = { ...(interpreterSenses[hit[0]] ?? {}), [senseId]: CONFIDENCE_LR[confidence] };
    }
    terms.push({ term, token: hit?.[0] ?? null, senseId, meaning: String(item?.meaning ?? "").slice(0, 140), confidence, known: Boolean(hit) });
  }
  const valence = Number(raw?.valence);
  const valenceConfidence = Number(raw?.valenceConfidence);
  return {
    version: INTERPRETATION_VERSION,
    gloss: String(raw?.gloss ?? "").slice(0, 400),
    mode: MODES.includes(raw?.mode) ? raw.mode : "literal",
    need: NEEDS.includes(raw?.need) ? raw.need : "be-heard",
    terms,
    newTerms: terms.filter((t) => !t.known && t.meaning),
    unknownTerms: (Array.isArray(raw?.unknownTerms) ? raw.unknownTerms : []).map(norm).filter((t) => t && lower.includes(t)).slice(0, 5),
    valence: Number.isFinite(valence) ? Math.max(-1, Math.min(1, valence)) : null,
    confidence: Number.isFinite(valenceConfidence) ? Math.max(0, Math.min(1, valenceConfidence)) : null,
    interpreterSenses,
    followUpsRaw: Array.isArray(raw?.followUps) ? raw.followUps.slice(0, 4) : [],
    // Safety is never decided here. If the raw text matched crisis language,
    // that stands regardless of a play/hyperbole reading.
    crisis: detectCrisisLanguage(value).isCrisis,
  };
}

/**
 * The fused reading of the text after the model's sense evidence is applied.
 * Returned for display/debug and for storing on the entry (index.js reads
 * entry.interpretation.valence/confidence as an observation).
 */
export function fusedReading(text, interpretation, senseOpts = {}) {
  const features = analyseText(text, { senseOpts: { ...senseOpts, interpreterSenses: interpretation?.interpreterSenses } });
  return {
    lexiconValence: features.vad.valence,
    lexiconConfidence: features.vadConfidence,
    senseVariance: features.senseVariance,
    playMass: features.playMass,
    maskedDistress: features.maskedDistress,
  };
}

/** What gets saved on a journal entry for the state model to replay. */
export function storableInterpretation(interpretation) {
  if (!interpretation) return null;
  return {
    version: interpretation.version,
    valence: interpretation.valence,
    confidence: interpretation.confidence,
    mode: interpretation.mode,
    need: interpretation.need,
    gloss: interpretation.gloss,
  };
}
