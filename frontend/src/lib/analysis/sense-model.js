/**
 * sense-model.js — WHAT DID THIS TERM MEAN, HERE, FROM THIS PERSON?
 *
 * Slang, Singlish particles, short forms and kids' meme phrases are not one
 * fixed emotion each. "sian" about a lecture is boredom; "sian" about life is
 * weary resignation. "6 7" is usually a playful bid, not a statement at all.
 * This module replaces one hand-set shift per term with a small Bayesian
 * model over that term's possible SENSES.
 *
 * ===========================================================================
 * THE MODEL
 * ===========================================================================
 * For term t with senses s = 1..K, each sense carries a VAD point
 * vad_s in [-1,1]^3, a global prior pi_s, an optional pragmatic strategy
 * (literal, play, hyperbole, understatement, irony, social-bid) and optional
 * context cues.
 *
 *   1. PRIOR (Dirichlet posterior mean). Counts come from three places:
 *        a_s = ALPHA0 * pi_s * decay_s(age)          global lexicon
 *            + COMMUNITY_WEIGHT * c_s                  other users' confirmations
 *            + u_s                                     this user's confirmations
 *      ALPHA0 = 5 pseudo-counts, so about five confirmed uses by one person
 *      outweigh the global prior for that person. That is how a term adapts
 *      to an individual without retraining anything.
 *
 *   2. AGE DECAY for dated slang. Meme senses fade:
 *        decay_s(age) = max(DECAY_FLOOR, 0.5^(max(0, age - grace) / halfLife))
 *      applied only to non-literal senses of a dated entry. Community counts
 *      are NOT decayed, so a meme that is still in use keeps its prior through
 *      real usage, and a dead one drifts back toward its literal reading.
 *
 *   3. CONTEXT LIKELIHOOD (log-linear). Within the clause around the match,
 *        L_s = exp( sum of weights of the sense's cues that fire )
 *      An interpreter (LLM) may also supply a likelihood per sense; it is
 *      multiplied in, clamped to [LIK_MIN, LIK_MAX] so it can sharpen but never
 *      delete a sense outright.
 *
 *   4. POSTERIOR.  p_s = a_s * L_s / sum_k a_k * L_k
 *      A sense marked requiresCue has a_s = 0 until some evidence supports it.
 *
 *   5. WHAT FLOWS DOWNSTREAM.
 *        E[vad]  = sum_s p_s * vad_s
 *        Var     = sum_s p_s * ||vad_s - E[vad]||^2     (meaning uncertainty)
 *        H       = -sum_s p_s log p_s / log K           (normalised entropy)
 *        P(mask) = sum_s p_s * [s masks distress]
 *      Var feeds the observation noise R in index.js, so an ambiguous message
 *      moves the wellbeing state less. Masked distress is ASYMMETRIC: it is
 *      flagged when P(mask) >= MASK_FLAG_P, a deliberately lower bar than 0.5, because a
 *      missed masked-distress reading is the costly error in a wellbeing app.
 *
 * Deterministic: no clock (age needs an explicit `asOf`), no randomness.
 */

export const SENSE_MODEL_VERSION = "sense-model-2026.10.1";
export const ALPHA0 = 5;
export const COMMUNITY_WEIGHT = 0.2;
export const DECAY_FLOOR = 0.15;
export const LIK_MIN = 0.05;
export const LIK_MAX = 20;
export const MASK_FLAG_P = 0.3;
export const STRATEGIES = Object.freeze(["literal", "play", "hyperbole", "understatement", "irony", "social-bid"]);

const DAY_MS = 86_400_000;

/** Old lexicon entries carry one valenceShift/arousalShift. Treat that as a single sense. */
export function sensesOf(entry) {
  if (Array.isArray(entry?.senses) && entry.senses.length) return entry.senses;
  return [{
    id: "default",
    gloss: entry?.gloss ?? "",
    vad: [entry?.valenceShift ?? 0, entry?.arousalShift ?? 0, entry?.dominanceShift ?? 0],
    prior: 1,
    masksDistress: Boolean(entry?.masksDistress),
    strategy: "literal",
  }];
}

export function ageDecay(entry, sense, asOf) {
  const dated = entry?.dated;
  if (!dated || !asOf || (sense.strategy ?? "literal") === "literal") return 1;
  const since = Date.parse(dated.since);
  const now = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf);
  if (!Number.isFinite(since) || !Number.isFinite(now)) return 1;
  const ageDays = (now - since) / DAY_MS - (dated.graceDays ?? 0);
  if (ageDays <= 0) return 1;
  const half = Math.max(1, dated.halfLifeDays ?? 365);
  return Math.max(DECAY_FLOOR, Math.pow(0.5, ageDays / half));
}

/** The clause containing [index, index+length): cues are judged on local context only. */
export function clauseAround(text, index = 0, length = 0) {
  const value = String(text ?? "");
  const before = value.slice(0, index);
  const start = Math.max(before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("?"), before.lastIndexOf("\n")) + 1;
  const rest = value.slice(index + length);
  const endRel = rest.search(/[.!?\n]/);
  const end = endRel === -1 ? value.length : index + length + endRel;
  return value.slice(start, end);
}

export function contextLikelihood(sense, clause) {
  let logL = 0;
  for (const cue of sense.cues ?? []) {
    const pattern = cue.pattern instanceof RegExp ? cue.pattern : new RegExp(cue.pattern, "i");
    if (pattern.test(clause)) logL += cue.weight ?? 1;
  }
  return Math.exp(Math.max(Math.log(LIK_MIN), Math.min(Math.log(LIK_MAX), logL)));
}

/**
 * @param {object} entry   lexicon entry (with or without `senses`)
 * @param {object} [opts]
 *   clause            local context string for cue matching
 *   userCounts        { senseId: n } this user's confirmations
 *   communityCounts   { senseId: n } confirmations across users
 *   interpreterLik    { senseId: likelihood } from an LLM reading, optional
 *   asOf              date for age decay of dated slang
 */
export function sensePosterior(entry, opts = {}) {
  const senses = sensesOf(entry);
  const priorTotal = senses.reduce((sum, s) => sum + (s.prior ?? 1), 0) || 1;
  const weights = senses.map((s) => {
    const pi = (s.prior ?? 1) / priorTotal;
    const prior = ALPHA0 * pi * ageDecay(entry, s, opts.asOf)
      + COMMUNITY_WEIGHT * Math.max(0, opts.communityCounts?.[s.id] ?? 0)
      + Math.max(0, opts.userCounts?.[s.id] ?? 0);
    const cueL = opts.clause ? contextLikelihood(s, opts.clause) : 1;
    const raw = opts.interpreterLik?.[s.id];
    const llmL = Number.isFinite(raw) ? Math.max(LIK_MIN, Math.min(LIK_MAX, raw)) : 1;
    // A `requiresCue` sense only exists when something points to it: a cue in
    // the clause, an interpreter reading, or a confirmed use. A bare "lor"
    // therefore stays neutral instead of carrying a sliver of resignation.
    if (s.requiresCue) {
      const supported = cueL > 1 || (Number.isFinite(raw) && raw > 1)
        || (opts.userCounts?.[s.id] ?? 0) > 0 || (opts.communityCounts?.[s.id] ?? 0) > 0;
      if (!supported) return 0;
    }
    return prior * cueL * llmL;
  });
  const z = weights.reduce((a, b) => a + b, 0) || 1;
  return senses.map((s, i) => ({ ...s, p: weights[i] / z }));
}

export function summarisePosterior(posterior) {
  const mean = [0, 1, 2].map((k) => posterior.reduce((sum, s) => sum + s.p * (s.vad?.[k] ?? 0), 0));
  const variance = posterior.reduce((sum, s) =>
    sum + s.p * [0, 1, 2].reduce((d, k) => d + ((s.vad?.[k] ?? 0) - mean[k]) ** 2, 0), 0);
  const K = posterior.length;
  const entropy = K > 1
    ? -posterior.reduce((sum, s) => sum + (s.p > 0 ? s.p * Math.log(s.p) : 0), 0) / Math.log(K)
    : 0;
  const maskP = posterior.reduce((sum, s) => sum + (s.masksDistress ? s.p : 0), 0);
  const top = posterior.reduce((best, s) => (s.p > best.p ? s : best), posterior[0]);
  const strategies = {};
  for (const s of posterior) {
    const key = s.strategy ?? "literal";
    strategies[key] = (strategies[key] ?? 0) + s.p;
  }
  return {
    mean, variance, entropy, maskP,
    masksDistress: maskP >= MASK_FLAG_P,
    topSense: top ? { id: top.id, gloss: top.gloss, p: top.p, strategy: top.strategy ?? "literal" } : null,
    strategies,
  };
}

export function resolveSense(entry, opts = {}) {
  const posterior = sensePosterior(entry, opts);
  return { posterior, ...summarisePosterior(posterior) };
}

/**
 * Pure count update after a confirmation ("ya that's what i meant") or a
 * correction ("no lah i meant X"). Returns new counts; the caller persists.
 */
export function updateSenseCounts(counts = {}, senseId, amount = 1) {
  if (!senseId) return { ...counts };
  return { ...counts, [senseId]: Math.max(0, (counts[senseId] ?? 0) + amount) };
}
