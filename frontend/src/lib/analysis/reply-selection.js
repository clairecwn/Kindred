/**
 * reply-selection.js — CHOOSING THE REPLY, NOT TEMPLATING IT.
 *
 * The writer model drafts several genuinely different replies; this module
 * scores each against what the reading of the message says the person needs
 * and picks the highest expected utility. Nothing here writes or rewrites
 * user-facing text. It only measures.
 *
 *   U(reply) = 0.30·heard + 0.22·voice + 0.18·needFit + 0.10·novelty
 *            + 0.10·lengthFit + 0.10·ageFit          (each term in [0,1])
 *   gate:    validateConversationReply(reply).ok, the existing hard rules
 *
 *   heard     the reply is anchored in the person's own words and covers the
 *             concern in focus: 0.6·grounding + 0.4·thread coverage
 *   voice     1 - (artificial-tell + formality + register-mismatch penalties)
 *   needFit   per need (interpretation.js NEEDS): play gets play back and no
 *             feelings interview; vent gets no fixing; advice is only fit when
 *             asked; make-sense rewards offering a take over asking
 *   novelty   1 - overlap with Kindred's own earlier turns
 *   lengthFit penalises replies far longer than the person writes
 *   ageFit    child mode: short sentences and everyday words; teen-rated
 *             slang the user did not use scores 0
 *   hook      leaves them something to respond to (processing-moves.js
 *             hookStrength); 1 when the policy is wrapping up or repairing
 *   minus 0.3 when it asserts a cause they said they don't know, unhedged
 *
 * The weights are a starting point, exported so they can be refit from
 * implicit feedback (did the person keep talking, correct us, or leave) with
 * a pairwise (Bradley-Terry) model over logged draft choices.
 */

import { paraphraseSimilarity } from "./paraphrase.js";
import { TAXONOMY_IDS } from "./emotion-taxonomy.js";
import { scoreConversationReply, validateConversationReply } from "./conversation-response.js";
import { hasArtificialStyleTell, formalityPenalty, styleAlignmentPenalty } from "./companion-style.js";
import { YOUTH_SLANG } from "./youth-slang.js";
import { MIN_N } from "./relationship.js";
import { hookStrength, unsupportedCause, questionQuality, speaksAsUser, escalates } from "./processing-moves.js";

export const REPLY_SELECTION_VERSION = "reply-selection-2026.10.2";
export const UTILITY_WEIGHTS = Object.freeze({ heard: 0.18, uptake: 0.18, voice: 0.16, needFit: 0.12, hook: 0.12, novelty: 0.08, lengthFit: 0.08, ageFit: 0.08 });
export const UNSUPPORTED_CAUSE_PENALTY = 0.3;

const clamp01 = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const wordCount = (text) => (String(text ?? "").match(/[\p{L}\p{N}']+/gu) ?? []).length;
const ADVICE = /\b(?:you should|you need to|try to|have you tried|make sure you|maybe try|what if you|you could try|start by)\b/i;
const FEELINGS_PROBE = /\b(?:how (?:does|did) (?:that|it) (?:make you )?feel|what (?:are|were) you feeling|how are you feeling about)\b/i;
const NARRATED_FEELING = /\b(?:you(?:'re| are) feeling|it sounds like|that must (?:have been|be)|i can tell you)\b/i;
const TAKE = /\b(?:honestly|tbh|i think|i reckon|imo|ngl|fair|makes sense|no wonder|of course)\b/i;
const TEEN_PATTERNS = YOUTH_SLANG.filter((e) => e.ageRating === "teen").flatMap((e) => e.patterns);

export function needFit(text, need = "be-heard", plan = {}) {
  const value = String(text ?? "");
  const questions = (value.match(/\?/g) ?? []).length;
  const advice = ADVICE.test(value);
  switch (need) {
    case "play":
      return clamp01(1 - 0.5 * Number(FEELINGS_PROBE.test(value)) - 0.4 * Number(NARRATED_FEELING.test(value))
        - 0.3 * Number(advice) - 0.2 * Math.max(0, wordCount(value) - 25) / 25);
    case "vent":
    case "be-heard":
      return clamp01(1 - 0.6 * Number(advice && !plan.adviceRequested) - 0.25 * Math.max(0, questions - 1)
        - 0.2 * Number(NARRATED_FEELING.test(value)));
    case "make-sense":
      return clamp01(0.6 + 0.4 * Number(TAKE.test(value) || /\b(?:because|so|which is why|since)\b/i.test(value))
        - 0.4 * Number(advice && !plan.adviceRequested));
    case "advice":
      return plan.adviceRequested ? clamp01(0.5 + 0.5 * Number(advice || TAKE.test(value))) : clamp01(1 - 0.5 * Number(advice));
    case "celebrate":
      return clamp01(1 - 0.5 * Number(advice) - 0.3 * Number(NARRATED_FEELING.test(value)) - 0.3 * Number(/\b(?:but|however)\b/i.test(value)));
    case "distraction":
    case "company":
      return clamp01(1 - 0.4 * Number(FEELINGS_PROBE.test(value)) - 0.3 * Number(advice));
    case "answer":
      return clamp01(1 - 0.5 * Number(questions > 0 && !/[.!]/.test(value)));
    default:
      return 0.7;
  }
}

export function ageFit(text, ageBand = "adult", userText = "") {
  if (ageBand !== "child") return 1;
  const value = String(text ?? "");
  const usedTeen = TEEN_PATTERNS.some((p) => p.test(value) && !p.test(String(userText)));
  if (usedTeen) return 0;
  const sentences = value.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const avg = sentences.length ? sentences.reduce((sum, s) => sum + wordCount(s), 0) / sentences.length : 0;
  const words = value.match(/[a-z]+/gi) ?? [];
  const longShare = words.length ? words.filter((w) => w.length >= 9).length / words.length : 0;
  return clamp01(1 - Math.max(0, avg - 12) / 12 - 2 * longShare);
}

export function lengthFit(text, plan = {}) {
  // A two-word "ya sia" does not mean the reply must be two words: judge
  // against how this person usually writes and how much they wrote today.
  const userWords = Math.max(6, wordCount(plan.currentMessage ?? ""), Number(plan.typicalWords) || 0,
    Math.min(30, 0.25 * wordCount(plan.originalEntry ?? "")));
  const ratio = wordCount(text) / Math.max(10, 1.4 * userWords);
  return clamp01(ratio <= 1.2 ? 1 : 1 - (ratio - 1.2) / 2);
}

const CONTENT_STOP = new Set(["that", "this", "with", "just", "like", "what", "when", "then", "they", "them", "have", "been", "your", "about", "really", "still", "there", "were", "from", "into", "feel", "feeling", "thing", "things", "wanna", "gonna", "sia", "also", "much", "very", "some", "more"]);
const contentWords = (t) => new Set((String(t ?? "").toLowerCase().match(/[a-z']{4,}/g) ?? []).filter((w) => !CONTENT_STOP.has(w)));

/** Is the reply about what THEY said: the latest message, the thread in focus, the journal? */
export function groundedness(text, plan = {}) {
  const reply = contentWords(text);
  if (!reply.size) return 0;
  const near = contentWords([plan.currentMessage, plan.agenda?.focusEvidence, plan.agenda?.focusSummary].filter(Boolean).join(" "));
  const far = contentWords(plan.originalEntry ?? "");
  let score = 0;
  for (const w of reply) score += near.has(w) ? 1 : far.has(w) ? 0.6 : 0;
  return clamp01(score / Math.min(5, reply.size));
}

export function replyUtility(text, plan = {}, interpretation = null, opts = {}) {
  const base = scoreConversationReply(text, plan);
  const heard = clamp01(0.4 * base.grounding + 0.3 * base.threadCoverage + 0.5 * groundedness(text, plan));
  const voice = clamp01(1 - (hasArtificialStyleTell(text) ? 0.5 : 0) - formalityPenalty(text, plan.voice) - styleAlignmentPenalty(text, plan.voice));
  const need = interpretation?.need ?? "be-heard";
  const components = {
    heard,
    voice,
    needFit: needFit(text, need, plan),
    novelty: clamp01(base.novelty),
    lengthFit: lengthFit(text, plan),
    ageFit: ageFit(text, opts.ageBand ?? plan.ageBand, plan.currentMessage),
    uptake: uptake(text, plan),
    // A hook only counts if any question in it is specific to what they said.
    hook: ['SOFT_CLOSE', 'REPAIR'].includes(plan.debriefState?.action) || plan.processingMove?.move === 'repair' ? 1
      : hookStrength(text, [plan.originalEntry, plan.currentMessage].filter(Boolean).join(" "))
        * questionQuality(text, [plan.originalEntry, plan.currentMessage, ...(plan.history ?? []).filter((t) => t.role === "user").map((t) => t.text)].filter(Boolean).join(" ")),
  };
  // What has worked with this person (relationship.js): a move that usually
  // ends their replies costs utility in proportion to how often it does.
  const rel = opts.relationship;
  let learned = 0;
  if (rel) {
    if (/\?/.test(text) && rel.question?.n >= MIN_N && rel.question.p < 0.45) learned -= 0.5 * (0.45 - rel.question.p);
    if (wordCount(text) > 40 && rel.long?.n >= MIN_N && rel.long.p < 0.45) learned -= 0.5 * (0.45 - rel.long.p);
  }
  if (unsupportedCause(text, [plan.originalEntry, plan.currentMessage, ...(plan.history ?? []).filter((t) => t.role === "user").map((t) => t.text)].filter(Boolean).join(" "))) {
    learned -= UNSUPPORTED_CAUSE_PENALTY;
    components.unsupportedCause = true;
  }
  if (escalates(text, [plan.originalEntry, plan.currentMessage, ...(plan.history ?? []).filter((t) => t.role === "user").map((t) => t.text)].filter(Boolean).join(" "))) {
    learned -= 0.4;
    components.escalates = true;
  }
  // Conversation-flow failures from live tests (turn-act.js):
  const flow = flowPenalties(text, plan);
  learned -= flow.total;
  Object.assign(components, flow.flags);
  // After "both"/"idk"/"all of it", another X-or-Y question just re-asks it.
  if (plan.processingMove?.broadAnswer && /\?/.test(text) && /\bor\b/i.test(text.split(/(?<=[.!])\s+/).at(-1) ?? "")) {
    learned -= 0.35;
    components.menuAfterBroadAnswer = true;
  }
  components.learned = learned;
  const utility = Object.entries(UTILITY_WEIGHTS).reduce((sum, [k, w]) => sum + w * components[k], 0) + learned;
  return { utility, components, need };
}

/** Style judgements are already priced into utility (voice); they rank, they don't disqualify. */
export const SOFT_REASONS = new Set(["voice-drift-from-user", "style-too-formal-for-user"]);
/** Also only ranked: "no question after a short answer" is priced by the hook score, and the
 *  move model may deliberately choose a statement (double-sided, continue, take). */
const RANK_SOFT = new Set([...SOFT_REASONS, "reply-closes-after-brief-answer"]);

/** Rank drafts: eligible ones by utility first, then the rest (for revision). */
export function selectReply(drafts = [], plan = {}, interpretation = null, opts = {}) {
  const validate = opts.validate ?? validateConversationReply;
  const eligible = (check) => check.ok || RANK_SOFT.has(check.reason);
  const userText = [plan.originalEntry, plan.currentMessage, ...(plan.history ?? []).filter((t) => t.role === "user").map((t) => t.text)].filter(Boolean).join(" ");
  const ranked = drafts.map((raw, index) => ({ raw: String(raw ?? "").trim(), index })).filter((d) => d.raw).map(({ raw, index }) => {
    let text = raw;
    // Speaking as the user is never acceptable, whatever else the draft does.
    if (speaksAsUser(text, userText)) return { text, index, check: { ok: false, reason: "speaks-as-user" }, ...replyUtility(text, plan, interpretation, opts) };
    let check = validate(text, plan);
    // Two questions where one is allowed is a fixable draft, not a lost one:
    // keep the question most about what they said and drop the other.
    if (["question-budget", "stacked-questions"].includes(check.reason) && (plan.questionBudget ?? 1) >= 1) {
      const trimmed = trimToQuestionBudget(text, plan.questionBudget ?? 1, plan);
      const retry = trimmed !== text ? validate(trimmed, plan) : check;
      if (retry.ok || RANK_SOFT.has(retry.reason)) { text = trimmed; check = retry; }
    }
    return { text, index, check, ...replyUtility(text, plan, interpretation, opts) };
  }).sort((a, b) => Number(eligible(b.check)) - Number(eligible(a.check)) || b.utility - a.utility);
  return { best: ranked[0] ?? null, ranked, version: REPLY_SELECTION_VERSION };
}

/** Parse {"drafts":[...]} from the writer; plain text falls back to one draft. */
export function parseDrafts(raw) {
  const value = String(raw ?? "").trim();
  try {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(value.slice(start, end + 1));
      const drafts = Array.isArray(parsed?.drafts) ? parsed.drafts.map((d) => String(typeof d === "string" ? d : d?.text ?? "").trim()).filter(Boolean) : [];
      if (drafts.length) return drafts.slice(0, 3);
    }
  } catch { /* not JSON: treat as a single draft */ }
  return value ? [value] : [];
}

const CONTENT_STOP_2 = new Set(["that", "this", "with", "just", "like", "what", "when", "then", "they", "them", "have", "been", "your", "about", "really", "still", "there", "were", "from", "into", "also", "more", "sia", "lowk", "kinda", "wanna", "want", "dont", "don't", "feel", "feeling", "thing", "things", "you're", "youre"]);
const cw = (t) => (String(t ?? "").toLowerCase().replace(/[’‘]/g, "'").match(/[a-z']{4,}/g) ?? []).filter((w) => !CONTENT_STOP_2.has(w)).map((w) => w.replace(/(?:ing|ed|es|s)$/, ""));
const questionsOf = (t) => String(t ?? "").replace(/[’‘]/g, "'").split(/(?<=[.!?…])\s+/).filter((x) => x.includes("?"));
const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n += 1;
  return n / (A.size + B.size - n);
};

/**
 * Uptake: does the reply take up what their latest message added? Grounding
 * theory's strongest evidence of understanding is a relevant next turn.
 * 1 when there was nothing new to take up.
 */
const UPTAKE_STOP = new Set(["the", "and", "but", "you", "for", "not", "are", "was", "its", "cos", "lor", "lah", "leh", "sia", "one", "like", "just", "that", "this", "with", "what", "dont", "cant", "also", "the", "got", "abt", "u", "ur", "ya", "yeah"]);
const uw = (t) => (String(t ?? "").toLowerCase().replace(/[’‘]/g, "'").replace(/n'?t\b/g, " not").match(/[a-z0-9']{2,}/g) ?? [])
  .filter((w) => !UPTAKE_STOP.has(w) && (w.length >= 3 || w === "no")).map((w) => w.replace(/(?:ing|ed|es|s)$/, ""));
export function uptake(text, plan = {}) {
  const t = plan.turnAct;
  if (!t || !["option", "both", "neither", "answer", "elaboration", "broad"].includes(t.act)) return 1;
  const fresh = new Set((t.newContent ?? []).map((w) => w.replace(/(?:ing|ed|es|s)$/, "")));
  const reply = uw(text);
  // "both la" / "the first one": the content they confirmed lives in our options.
  if (["option", "both"].includes(t.act) && t.options) {
    const confirmed = t.act === "both" ? t.options.join(" ") : (t.selectedText ?? "");
    const ref = new Set(uw(confirmed));
    const hits = reply.filter((w) => ref.has(w)).length;
    return Math.min(1, hits / 2);
  }
  const latest = new Set(uw(plan.currentMessage));
  const hitsFresh = reply.filter((w) => fresh.has(w)).length;
  const hitsLatest = reply.filter((w) => latest.has(w)).length;
  if (!latest.size) return 1;
  return Math.min(1, 0.5 * Math.min(1, hitsFresh / 1) + 0.5 * Math.min(1, hitsLatest / 2));
}

const REASSURANCE = /\b(?:you got this|u got this|you'?re doing (?:fine|great|ok|okay|well)|ur doing (?:fine|great|ok)|don'?t stress|dont stress|it'?s (?:totally |completely )?normal|everyone feels|it'?ll be (?:fine|ok|okay)|you'?ll be (?:fine|ok|okay)|hang in there|just the brain'?s way|you'?re not alone|ur not alone|happens to everyone|we all (?:go through|feel))\b/i;

export function flowPenalties(text, plan = {}) {
  const flags = {};
  let total = 0;
  const t = plan.turnAct;
  const replyQs = questionsOf(text);
  // 1. Re-asking a question already asked in this chat (any earlier Kindred turn).
  const earlierQs = (plan.history ?? []).filter((x) => x.role === "ai").flatMap((x) => questionsOf(x.text));
  // Lexical overlap OR the same meaning in other words ("chill" vs "relax a bit").
  const reask = replyQs.some((q) => earlierQs.some((e) => jaccard(cw(q), cw(e)) >= 0.4 || paraphraseSimilarity(q, e) >= PARAPHRASE_THRESHOLD));
  if (reask) { total += 0.5; flags.reasksQuestion = true; }
  // 2. A menu built out of their own answer ("more like X or Y?" where X/Y are what they just said).
  const menu = replyQs.find((q) => /\bor\b/i.test(q));
  if (menu && t && ["option", "both", "answer", "elaboration", "ack", "broad"].includes(t.act)) {
    const shared = cw(menu).filter((w) => new Set(cw(plan.currentMessage)).has(w)).length;
    // After a bare "ya", a menu is only a problem if it re-offers the same
    // question; a menu about another thread is a fresh move.
    const reofferAfterAck = t.act === "ack" && t.lastQuestion && jaccard(cw(menu), cw(t.lastQuestion)) >= 0.25;
    if (shared >= 2 || t.act === "both" || reofferAfterAck || t.ambivalence) { total += 0.45; flags.menuAfterAnswer = true; }
  }
  // 2b. Re-summarising what Kindred already reflected in its last two replies.
  const lastAiTexts = (plan.history ?? []).filter((x) => x.role === "ai").slice(-2).map((x) => String(x.text ?? ""));
  const lastAis = lastAiTexts.map(cw);
  const firstRaw = String(text).split(/(?<=[.!?…])\s+/)[0];
  const firstSentence = cw(firstRaw);
  const priorSentences = lastAiTexts.flatMap((x) => x.split(/(?<=[.!?…])\s+/));
  if ((firstSentence.length >= 3 && lastAis.some((prev) => jaccard(firstSentence, prev) >= 0.3))
    || priorSentences.some((prev) => paraphraseSimilarity(firstRaw, prev) >= PARAPHRASE_THRESHOLD)) { total += 0.3; flags.restatesOwnReflection = true; }
  // 2c. Figurative language they never used (LLM default register, not a friend's text).
  const userText = [plan.originalEntry, plan.currentMessage, ...(plan.history ?? []).filter((x) => x.role === "user").map((x) => x.text)].filter(Boolean).join(" ");
  const fig = figurativeLanguage(text, userText);
  if (fig.length) { total += Math.min(0.45, 0.25 * fig.length); flags.figurative = fig; }
  // 2d. Over length: a reply far longer than how they write reads as a lecture.
  const over = overLength(text, plan);
  if (over > 0) { total += over; flags.overLength = Number(over.toFixed(2)); }
  // 2e. First reply: an emotion-word menu ("frustrated or regret?") or a reply
  // with none of their content is a form, not someone who read the entry.
  const firstReply = !(plan.history ?? []).some((x) => x.role === "ai") && plan.originalEntry
    && String(plan.currentMessage ?? "").trim() === String(plan.originalEntry).trim();
  if (firstReply) {
    if (emotionLabelMenu(text)) { total += 0.5; flags.labelMenuOpening = true; }
    if (groundedness(text, plan) < 0.2) { total += 0.3; flags.ungroundedOpening = true; }
  }
  // 3. Generic reassurance (the LLM default) unless celebrating.
  if (REASSURANCE.test(text) && plan.processingMove?.need !== "celebrate") { total += 0.3; flags.genericReassurance = true; }
  // 4. Repair must stay a repair: short, no new menu, no joke/meme.
  if (plan.processingMove?.move === "repair") {
    const words = (String(text).match(/[\p{L}\p{N}']+/gu) ?? []).length;
    if (words > 30) { total += 0.25; flags.longRepair = true; }
    if (/\bmeme|\bjoke\b|hit me up/i.test(text) || menu) { total += 0.5; flags.repairDrift = true; }
    // A repair restates or owns; it doesn't bring in new things.
    const context = new Set(cw([plan.originalEntry, plan.currentMessage, ...(plan.history ?? []).map((x) => x.text)].join(" ")));
    const novel = cw(text).filter((w) => !context.has(w)).length;
    if (novel >= 2) { total += 0.3; flags.repairNewContent = true; }
    if (/\b(?:sorry|my bad|oops|i meant|i mean|what i meant)\b/i.test(text)) { total -= 0.15; flags.ownsRepair = true; }
  }
  return { total, flags };
}

export const PARAPHRASE_THRESHOLD = 0.45;

/**
 * Figurative language the user did not use. Similes ("like a ...", "as if"),
 * and conventional metaphor vehicles LLMs reach for. Returns the matched
 * vehicles; a vehicle that appears in the user's own words is fine (mirroring).
 */
const SIMILE = /\b(?:(?:feels?|felt|sounds?|seems?|looks?) like (?:a|an|some kind of) (?!lot\b|bit\b|few\b|while\b|ton\b|mess\b|joke\b|waste\b|chore\b|drag\b|pain\b|big deal\b|thing\b|good\b|bad\b|fun\b|long\b|hard\b|rough\b|weird\b)[a-z]+(?: [a-z]+)?|like (?:a|an) (?:never[- ]ending|giant|huge|tiny|little|whole|endless) [a-z]+|as if (?:you|u|ur|it|the)\b|kind of like a)\b/i;
const VEHICLES = ["rollercoaster", "roller coaster", "tidal wave", "wave of", "storm", "whirlwind", "maze", "labyrinth", "mountain", "uphill", "tug of war", "tug-of-war", "hamster wheel", "treadmill", "pressure cooker", "rabbit hole", "spiral", "spiralling", "spiraling", "running on empty", "on autopilot", "weight on your shoulders", "weight on ur shoulders", "carrying the weight", "heavy backpack", "backpack", "battery", "batteries", "fog", "cloud over", "dark cloud", "silver lining", "light at the end", "tunnel", "journey", "seeds", "bloom", "puzzle", "juggling", "juggle", "balancing act", "tightrope", "domino", "snowball", "avalanche", "minefield", "battlefield", "battle", "armor", "armour", "anchor", "compass", "lighthouse", "spark", "flame", "drowning in", "sinking", "quicksand", "on repeat", "glitch", "reset button", "plot twist", "main character", "side quest", "boss level", "speedrun", "crash course", "brick wall", "knot", "knots", "tangled", "puppet", "finish line", "on your plate", "on ur plate", "plate full", "new chapter", "stuck in a loop", "on a loop"];
const VEHICLE_RES = VEHICLES.map((v) => [v, new RegExp(`\\b${v.replace(/[-\s]/g, "[-\\s]")}\\b`, "i")]);
export function figurativeLanguage(text, userText = "") {
  const reply = String(text ?? "");
  const user = String(userText ?? "");
  const hits = [];
  for (const [v, re] of VEHICLE_RES) if (re.test(reply) && !re.test(user)) hits.push(v);
  const simile = reply.match(SIMILE);
  // "it was like a mess" is still a simile; but a quoted "like" filler isn't.
  if (simile && !new RegExp(simile[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(user)) hits.push(`simile:${simile[0].toLowerCase()}`);
  return [...new Set(hits)];
}

/** Extra cost above lengthFit when a reply runs past ~2x their usual length (cap 0.35). */
export function overLength(text, plan = {}) {
  const userWords = Math.max(6, wordCount(plan.currentMessage ?? ""), Number(plan.typicalWords) || 0,
    Math.min(30, 0.25 * wordCount(plan.originalEntry ?? "")));
  const words = wordCount(text);
  const limit = Math.max(18, 2 * userWords, ["SOFT_CLOSE", "SHIFT"].includes(plan.debriefState?.action) ? 2.4 * userWords : 0);
  return words <= limit ? 0 : Math.min(0.35, 0.35 * (words - limit) / limit);
}

/**
 * Deterministic tightening with no extra model call (rate limits): drop
 * sentences carrying an image the user never used, then middle sentences
 * until the reply fits the cap. The first sentence (the reaction) and the
 * last (usually the move: question or statement) are kept when possible.
 */
export function tightenReply(text, plan = {}, userText = "", cap = 40) {
  const paragraphs = String(text ?? "").split(/\n\s*\n/);
  const split = (p) => p.split(/(?<=[.!?…])\s+/).filter(Boolean);
  let sentences = paragraphs.flatMap((p, pi) => split(p).map((s) => ({ s, pi })));
  if (sentences.length < 2) return String(text ?? "");
  const keep = sentences.filter((x) => !figurativeLanguage(x.s, userText).length);
  if (keep.length && keep.length < sentences.length) sentences = keep;
  while (sentences.length > 2 && wordCount(sentences.map((x) => x.s).join(" ")) > cap) {
    // Remove the longest middle sentence that carries no question.
    const middle = sentences.slice(1, -1).map((x, i) => ({ i: i + 1, w: wordCount(x.s), q: x.s.includes("?") })).filter((x) => !x.q);
    if (!middle.length) break;
    middle.sort((a, b) => b.w - a.w);
    sentences.splice(middle[0].i, 1);
  }
  const out = [];
  for (const x of sentences) (out[x.pi] ??= []).push(x.s);
  return out.filter(Boolean).map((p) => p.join(" ")).join("\n\n");
}

const LABEL_WORDS = new Set([...TAXONOMY_IDS.flatMap((id) => id.split(" ")), "regret", "regretful", "shame", "ashamed", "upset", "annoyed", "mad", "scared", "worried", "stressed", "sad", "guilt", "fear", "fomo", "envy", "envious", "anxiety", "frustration", "disappointment", "sadness", "anger"]);
/** "frustrated or regret, which one hits more?": a question whose either/or sides are bare emotion words. */
export function emotionLabelMenu(text) {
  for (const q of String(text ?? "").toLowerCase().split(/(?<=[.!?…])\s+/).filter((x) => x.includes("?") || /\bor\b/.test(x))) {
    const m = q.match(/\b([a-z]+)(?:,)?\s+or\s+(?:more\s+)?([a-z]+)\b/);
    if (m && LABEL_WORDS.has(m[1]) && LABEL_WORDS.has(m[2])) return true;
  }
  return false;
}

/** Keep at most `budget` question sentences: the ones most grounded in what they said (ties: the later). */
export function trimToQuestionBudget(text, budget = 1, plan = {}) {
  const sentences = String(text ?? "").split(/(?<=[.!?…])\s+/).filter(Boolean);
  const qs = sentences.map((s, i) => ({ s, i })).filter((x) => x.s.includes("?"));
  if (qs.length <= budget) return String(text ?? "");
  const keep = new Set(qs.map((x) => ({ ...x, g: groundedness(x.s, plan) + 0.01 * x.i }))
    .sort((a, b) => b.g - a.g).slice(0, budget).map((x) => x.i));
  return sentences.filter((s, i) => !s.includes("?") || keep.has(i)).join(" ");
}
