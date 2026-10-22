/**
 * turn-act.js — WHAT DID THEIR LAST MESSAGE DO, RELATIVE TO OURS?
 *
 * Conversation is built turn by turn: each contribution is presented and
 * then accepted or repaired (Clark & Brennan 1991). A question sets up the
 * slot for an answer (adjacency pairs); "huh?"/"what?" are open-class repair
 * initiators that treat the whole previous turn as the problem, typically
 * after an abrupt topic shift or an off-key response (Drew 1997). And LLMs
 * lose track in multi-turn chat by over-weighting their own earlier turns and
 * the first/last messages (Laban et al. 2025). So before choosing a reply,
 * classify what the person's latest message did to Kindred's last one.
 *
 * Acts:
 *   repair        "huh", "what", "wdym": they didn't follow us
 *   pushback      "wtv", "nvm", "that's not what i meant": we missed
 *   ack           "ya", "ok lor": acceptance with nothing new
 *   option        picked one side of our either/or (selected = "a" | "b")
 *   both          "both", "kinda both"
 *   broad         "idk", "everything"
 *   answer        answered our question with new content
 *   elaboration   added new content without a question pending
 *   play          a meme/joke turn
 *   opening       first message (the journal)
 * plus `ambivalence` when they hold two pulls at once ("wanna chill but
 * also dont want to fall behind"), and `newContent`: their words not seen
 * earlier in the chat.
 */

export const TURN_ACT_VERSION = "turn-act-2026.10.2";
import { concepts, paraphraseSimilarity } from "./paraphrase.js";

// "i dont blame her", "not like that", "nah she's not": a negated clause.
const NEGATED = /\b(?:i\s+)?(?:don'?t|dont|didn'?t|didnt|do not|never|not|isn'?t|isnt|wasn'?t|wasnt|nah|no)\s+((?:[a-z']+\s*){1,5})/i;
const NOT_CORRECTION = /^(?:know|sure|really know|think so|wanna|want|mind|care|have|got|see|get it)\b/i;

/**
 * Correction: they negate something Kindred STATED (not asked) last turn.
 * People correct a misreading by negating its key content ("i dont blame
 * her" after "she's dumping it on you"); the grounding fix is to accept the
 * correction, not to restate the claim (Clark & Brennan; sycophancy work shows
 * the opposite failure too, so we only flip on what they actually negate).
 */
export function correctionOf(text, lastAi) {
  const m = String(text ?? "").toLowerCase().replace(/[’‘]/g, "'").match(NEGATED);
  if (!m || NOT_CORRECTION.test(m[1])) return null;
  const negated = new Set(concepts(m[1]));
  if (!negated.size) return null;
  const statements = String(lastAi ?? "").split(/(?<=[.!?…])\s+/).filter((x) => !x.includes("?") || /\b(?:huh|right|no)\?\s*$/i.test(x));
  const claimed = new Set(statements.flatMap((x) => concepts(x)));
  const hit = [...negated].filter((c) => claimed.has(c));
  return hit.length ? { clause: m[0].trim(), concepts: hit } : null;
}

/** They said (nearly) the same thing again: the reply to it missed (Drew 1997, repeats as repair). */
export function repeatOf(text, priorUser = []) {
  const recent = priorUser.slice(-2);
  const neg = String(text ?? "").toLowerCase().match(NEGATED);
  for (const prev of recent) {
    if (paraphraseSimilarity(text, prev) >= 0.5) return { previous: prev };
    if (neg) {
      const a = concepts(neg[1]);
      const pm = String(prev ?? "").toLowerCase().match(NEGATED);
      if (pm && a.length && a.every((c) => concepts(pm[1]).includes(c))) return { previous: prev };
    }
  }
  return null;
}

const STOP = new Set(["that", "this", "with", "just", "like", "what", "when", "then", "they", "them", "have", "been", "your", "about", "really",
  "still", "there", "were", "from", "into", "also", "much", "very", "some", "more", "lowk", "lowkey", "sia", "lah", "leh", "lor", "tbh", "honestly",
  "kinda", "abit", "dont", "don't", "cant", "can't", "want", "wanna", "would", "could", "maybe", "more", "less", "it's", "that's", "you're", "youre"]);
const content = (t) => (String(t ?? "").toLowerCase().replace(/[’‘]/g, "'").match(/[a-z']{4,}/g) ?? []).filter((w) => !STOP.has(w));
const stem = (w) => w.replace(/(?:ing|ed|es|s)$/, "");
const words = (t) => (String(t ?? "").match(/[\p{L}\p{N}']+/gu) ?? []).length;

const REPAIR = /^(?:huh+|hah+\??|what+|wat|wut|wdym|wym|what do (?:you|u) mean|huh what|what\?+|\?+|eh\?+|ha\?+)[?!.\s]*$/i;
const PUSHBACK = /^(?:ok(?:ay)?\s+)?(?:wtv|whatever|nvm|never ?mind|forget it|stop)\b|\b(?:not what i (?:said|meant|mean)|you(?:'re| are)? not (?:getting|listening)|u not getting|that'?s not it|no+\s+(?:lah|la)?\s*i (?:meant|mean)|i didn'?t say that|why (?:are|r) (?:you|u) asking)\b/i;
const ACK = /^(?:ok(?:ay)?|kk|k|mhm|mm|ya+|yah|yeah|yep|yup|sure|true|same|fair|ikr|right|ok ok|okok|ya lor|ok lor|ya la|ya sia)(?:\s+(?:lor|lah|la|sia|leh|ah|lo|bro|ya))*[.!\s]*$/i;
const BOTH = /\b(?:both|bit of both|abit of both|kinda both|prob both|maybe both|a mix)\b/i;
const BROAD = /^(?:idk|dk|dunno|not sure|no idea|everything|all of (?:it|them)|idk la|idk leh)\b/i;
const NEITHER = /^(?:neither|none of (?:those|them|the above)|not really either|nah not really|nah neither)\b/i;
const AMBIVALENCE = /\b(?:wanna|want to|want|like to|should|need to|have to|gotta)\b[^.!?]{2,80}\bbut\b[^.!?]{0,30}\b(?:also|i (?:also|still|dont|don'?t|cant|can'?t)|dont|don'?t|cant|can'?t|scared|afraid|worried)\b/i;

/** The last question Kindred asked, and its two options if it was an either/or. */
export function lastQuestionOf(aiText) {
  const sentences = String(aiText ?? "").replace(/[’‘]/g, "'").split(/(?<=[.!?…])\s+/);
  const question = [...sentences].reverse().find((s) => s.includes("?")) ?? null;
  if (!question) return { question: null, options: null };
  const parts = question.split(/\s*,?\s+\bor\b\s+/i);
  const options = parts.length >= 2
    ? [parts[0].replace(/^.*?\bmore like\b\s*/i, ""), parts.slice(1).join(" or ").replace(/^\s*more like\s*/i, "")].map((s) => s.replace(/[?.]+$/, "").trim())
    : null;
  return { question, options };
}

function overlap(a, b) {
  const sa = new Set(content(a).map(stem));
  return content(b).map(stem).filter((w) => sa.has(w)).length;
}

/**
 * @param {string} latest   the person's latest message
 * @param {Array} history   chat so far (journal first), roles user/ai
 * @param {object} [opts]   { playMass }
 */
export function classifyTurnAct(latest, history = [], opts = {}) {
  const text = String(latest ?? "").trim();
  const aiTurns = history.filter((t) => t?.role === "ai");
  const lastAi = aiTurns.at(-1)?.text ?? "";
  const priorUser = history.filter((t) => t?.role === "user").map((t) => t.text ?? "");
  const seen = new Set(priorUser.flatMap((t) => content(t)).map(stem));
  const newContent = [...new Set(content(text).filter((w) => !seen.has(stem(w))))];
  const { question, options } = lastQuestionOf(lastAi);
  const ambivalenceMatch = text.match(AMBIVALENCE);
  let ambivalence = null;
  if (ambivalenceMatch) {
    const start = ambivalenceMatch.index;
    const endRel = text.slice(start + ambivalenceMatch[0].length).search(/[.!?\n]/);
    const clause = text.slice(start, endRel === -1 ? text.length : start + ambivalenceMatch[0].length + endRel);
    ambivalence = { quote: clause.trim(), sides: clause.split(/\bbut\b/i).map((s) => s.trim()).filter(Boolean).slice(0, 2) };
  }

  const correction = aiTurns.length ? correctionOf(text, lastAi) : null;
  const repeated = aiTurns.length ? repeatOf(text, priorUser.slice(1)) : null;
  let act = "elaboration";
  let selected = null;
  if (!aiTurns.length) act = "opening";
  else if (REPAIR.test(text)) act = "repair";
  else if (PUSHBACK.test(text)) act = "pushback";
  else if (!ACK.test(text) && (correction || repeated)) act = "correction";
  else if (ACK.test(text)) act = "ack";
  else if ((opts.playMass ?? 0) >= 0.5 && words(text) <= 6) act = "play";
  else if (question) {
    if (BOTH.test(text)) act = "both";
    else if (NEITHER.test(text)) act = "neither";
    else if (BROAD.test(text) && words(text) <= 8) act = "broad";
    else if (options) {
      const a = overlap(options[0], text);
      const b = overlap(options[1], text);
      if (a > 0 && b > 0 && ambivalence) act = "both";
      else if (a > b) { act = "option"; selected = "a"; }
      else if (b > a) { act = "option"; selected = "b"; }
      else act = "answer";
    } else act = "answer";
  } else if (BROAD.test(text) && words(text) <= 8) act = "broad";

  return {
    version: TURN_ACT_VERSION,
    act,
    selected,
    selectedText: selected && options ? options[selected === "a" ? 0 : 1] : null,
    options,
    lastQuestion: question,
    lastAi,
    answeredQuestion: Boolean(question) && ["option", "both", "neither", "broad", "answer"].includes(act),
    substantive: newContent.length >= 2 && words(text) >= 5,
    newContent,
    ambivalence,
    correction,
    repeated,
  };
}

/** Plain description for the writer of what their message did. */
export function describeTurnAct(t) {
  if (!t || t.act === "opening") return "";
  const said = t.newContent?.length ? ` New in it: ${t.newContent.slice(0, 8).join(", ")}.` : "";
  switch (t.act) {
    case "repair": return "They didn't follow your last message (\"huh\"/\"what\"). Your last message was confusing or off; don't move on.";
    case "correction": return `${t.repeated ? `They've now said this twice ("${String(t.repeated.previous).slice(0, 80)}" and now this), so your last reply missed it. ` : ""}They corrected you${t.correction ? ` ("${t.correction.clause}")` : ""}: your last message said something they don't agree with. Take their view as right, show it in a few plain words (no big apology, don't restate your claim), then respond to what they actually think and feel about it.`;
    case "pushback": return "They pushed back: your last message missed. Don't defend or repeat it.";
    case "ack": return t.lastQuestion
      ? "They only said yes/ok to your question, without picking or adding anything. Don't repeat the question; offer something concrete instead."
      : "They agreed with what you said and added nothing. Move it forward with something new.";
    case "option": return `They answered your question and picked: "${t.selectedText}".${said} Take that as the answer and go deeper into it.`;
    case "both": return t.options
      ? `They said it's both of the things you just offered: "${t.options[0]}" AND "${t.options[1]}".${said} Take both as true and go from there; don't offer options again.`
      : `They said it's both.${said} Don't offer options again.`;
    case "neither": return "Neither of your options fit. Drop them; go with what they actually said.";
    case "broad": return "They answered broadly (idk / everything). Don't narrow it again with another question of the same kind.";
    case "answer": return `They answered your question.${said} Respond to their answer itself.`;
    case "play": return "They're joking around.";
    default: return `They added something new.${said} Respond to that.`;
  }
}
