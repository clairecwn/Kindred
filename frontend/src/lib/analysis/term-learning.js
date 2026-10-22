/**
 * term-learning.js — LEARNING NEW SLANG, SHORT FORMS AND MEMES WITHOUT A DEVELOPER.
 *
 * Understanding a never-seen term in the moment is the interpreter's job: it
 * reads the term from context. This module makes that understanding STICK,
 * per person, from evidence in their own conversations:
 *
 *   1. Each turn, the interpreter's readings are saved on the entry
 *      (termObservations): term, meaning or sense id, confidence, and which
 *      user turn it was read from.
 *   2. The person's NEXT message is the test. If they push back or correct
 *      ("no i meant...", "huh", "wdym", "thats not what"), the reading is
 *      contradicted; if they carry on, it is (weakly) accepted.
 *   3. Readings of the same term are grouped into senses: by sense id for a
 *      known term, by meaning-word overlap (Jaccard >= SAME_MEANING) for a new
 *      one. Each sense keeps a Beta posterior on "this reading is right":
 *          p = (1 + accepted) / (2 + accepted + contradicted)
 *   4. A new term is LEARNED for this person when p >= LEARN_P and it was seen
 *      in at least MIN_ENTRIES different entries, or straight away when the
 *      person explains it themselves (personal-memory.js definitions).
 *      Learned meanings go back to the interpreter as this person's own
 *      vocabulary, and stop being flagged as unknown.
 *   5. For a known multi-sense term, an accepted reading adds IMPLICIT_WEIGHT
 *      to that sense's count (sense-model.js), half of an explicit explanation.
 *
 * Everything is rebuilt from saved entries, so deleting an entry forgets its
 * evidence. Model readings on their own never teach anything: the person's
 * reaction is what turns a guess into knowledge.
 */

export const TERM_LEARNING_VERSION = "term-learning-2026.10.1";
export const SAME_MEANING = 0.3;
export const LEARN_P = 0.7;
export const MIN_ENTRIES = 2;
export const IMPLICIT_WEIGHT = 0.5;
export const MAX_OBSERVATIONS_PER_ENTRY = 60;

const CORRECTION = /\b(?:no+\s*(?:lah|la)?\s*i\s*mean[t]?|not what i mean[t]?|thats? not (?:what|it)|that's not (?:what|it)|you got it wrong|i didn'?t mean|wdym|wym|huh+|what\?+|nope|nah that'?s not)\b/i;
const STOP = new Set(["the", "a", "an", "or", "and", "of", "to", "it", "is", "in", "on", "be", "you", "your", "i", "im", "like", "just", "really", "very", "so", "with", "about", "for", "something", "someone", "when", "that", "this", "means", "mean"]);
const meaningWords = (text) => new Set((String(text ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)));
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  return inter / (a.size + b.size - inter);
};

/** Readings worth recording from a validated interpretation (interpretation.js). */
export function termReadingsFrom(interpretation, userTurn) {
  return (interpretation?.terms ?? [])
    .filter((t) => t.confidence !== "low" && (t.senseId || t.meaning))
    .map((t) => ({ term: t.term, token: t.token ?? null, senseId: t.senseId ?? null, meaning: t.meaning ?? "",
      confidence: t.confidence, userTurn }))
    .slice(0, 8);
}

/** Non-journal user turns of an entry's chat, in order. Turn 0 is the journal itself. */
function userTurns(entry) {
  return [String(entry?.text ?? ""), ...(Array.isArray(entry?.aiChat) ? entry.aiChat : [])
    .filter((t) => t?.role === "user" && !t.isJournal).map((t) => String(t.text ?? ""))];
}

/** accepted | contradicted | pending, judged from the user's next message. */
export function reactionTo(observation, entry) {
  const turns = userTurns(entry);
  const next = turns[(observation.userTurn ?? 0) + 1];
  if (next === undefined) return "pending";
  return CORRECTION.test(next) ? "contradicted" : "accepted";
}

export function learnTerms(entries = []) {
  const groups = new Map(); // term -> senses[]
  for (const entry of entries) {
    for (const obs of Array.isArray(entry?.termObservations) ? entry.termObservations : []) {
      const term = String(obs.term ?? "").toLowerCase().trim();
      if (!term) continue;
      const reaction = reactionTo(obs, entry);
      const senses = groups.get(term) ?? [];
      const words = meaningWords(obs.meaning);
      let sense = obs.senseId
        ? senses.find((s) => s.senseId === obs.senseId)
        : senses.find((s) => !s.senseId && jaccard(s.words, words) >= SAME_MEANING);
      if (!sense) {
        sense = { term, token: obs.token ?? null, senseId: obs.senseId ?? null, meaning: obs.meaning, words: new Set(words),
          accepted: 0, contradicted: 0, pending: 0, entries: new Set() };
        senses.push(sense);
      }
      for (const w of words) sense.words.add(w);
      sense[reaction] += 1;
      if (entry.id) sense.entries.add(entry.id);
      groups.set(term, senses);
    }
  }
  const learned = [];
  const candidates = [];
  const senseCounts = {};
  for (const senses of groups.values()) {
    for (const s of senses) {
      const p = (1 + s.accepted) / (2 + s.accepted + s.contradicted);
      const item = { term: s.term, token: s.token, senseId: s.senseId, meaning: s.meaning, p: Number(p.toFixed(2)),
        accepted: s.accepted, contradicted: s.contradicted, entries: s.entries.size };
      if (s.token && s.senseId) {
        if (s.accepted > 0) {
          senseCounts[s.token] = senseCounts[s.token] ?? {};
          senseCounts[s.token][s.senseId] = (senseCounts[s.token][s.senseId] ?? 0) + IMPLICIT_WEIGHT * s.accepted;
        }
        continue;
      }
      if (p >= LEARN_P && s.entries.size >= MIN_ENTRIES) learned.push(item);
      else if (s.contradicted === 0) candidates.push(item);
    }
  }
  // One meaning per term: the most supported.
  const best = (items) => [...items.reduce((map, item) => {
    const prior = map.get(item.term);
    if (!prior || item.p * item.entries > prior.p * prior.entries) map.set(item.term, item);
    return map;
  }, new Map()).values()];
  return { version: TERM_LEARNING_VERSION, learned: best(learned).slice(0, 60), candidates: best(candidates).slice(0, 30), senseCounts };
}

/** Merge implicit sense counts into explicit ones (explicit stay at full weight). */
export function mergeSenseCounts(...sources) {
  const out = {};
  for (const counts of sources) {
    for (const [token, senses] of Object.entries(counts ?? {})) {
      out[token] = out[token] ?? {};
      for (const [id, n] of Object.entries(senses)) out[token][id] = (out[token][id] ?? 0) + n;
    }
  }
  return out;
}
