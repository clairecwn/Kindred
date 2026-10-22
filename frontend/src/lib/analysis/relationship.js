/**
 * relationship.js — WHAT HAS WORKED WITH THIS PERSON.
 *
 * Not a personality profile. A record of how they responded to Kindred's own
 * moves, from saved chats. For each Kindred reply followed by a user message:
 *   features of the reply:  asked a question, playful, long (> LONG_WORDS)
 *   reaction:               engaged  = substantive reply for THIS person
 *                                      (>= ENGAGED_RATIO x their median length,
 *                                      at least 3 words) and no pushback
 *                           pushback = correction or "huh"/"wdym"
 *                           brief    = anything else
 * Each feature keeps a Beta(1 + engaged, 1 + not engaged) posterior, so
 *   P(engaged | feature) = (1 + e) / (2 + n)
 * with n reactions seen. A feature only influences replies once n >= MIN_N.
 * Used by reply-selection.js (penalise moves that tend to end their replies)
 * and shown to the writer in plain words.
 */

export const RELATIONSHIP_VERSION = "relationship-2026.10.1";
export const LONG_WORDS = 40;
export const ENGAGED_RATIO = 0.6;
export const MIN_N = 5;

const PUSHBACK = /\b(?:no+\s*(?:lah|la)?\s*i\s*mean[t]?|not what i mean[t]?|thats? not (?:what|it)|you got it wrong|wdym|wym|huh+|stop asking|why (?:are|r) (?:you|u) asking)\b/i;
const PLAYFUL = /\b(?:haha+|hehe+|lol|lmao)\b|!{1,}|😂|🤣|💀/i;
const words = (t) => (String(t ?? "").match(/[\p{L}\p{N}']+/gu) ?? []).length;
const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
};

export function replyFeatures(text) {
  return { question: /\?/.test(String(text ?? "")), playful: PLAYFUL.test(String(text ?? "")), long: words(text) > LONG_WORDS };
}

export function buildRelationship(entries = []) {
  const userLengths = [];
  const pairs = [];
  for (const entry of entries) {
    const chat = Array.isArray(entry?.aiChat) ? entry.aiChat : [];
    for (let i = 0; i < chat.length; i += 1) {
      const turn = chat[i];
      if (turn?.role === "user" && !turn.isJournal) userLengths.push(words(turn.text));
      if (turn?.role !== "ai") continue;
      const next = chat.slice(i + 1).find((t) => t?.role === "user");
      const between = chat.slice(i + 1, next ? chat.indexOf(next) : i + 1);
      if (!next || between.some((t) => t?.role === "ai")) continue; // only the last ai bubble before a reply
      pairs.push({ ai: turn.text, user: next.text });
    }
  }
  const typical = Math.max(3, median(userLengths));
  const stats = { question: { e: 0, n: 0 }, noQuestion: { e: 0, n: 0 }, playful: { e: 0, n: 0 }, long: { e: 0, n: 0 }, short: { e: 0, n: 0 } };
  let pushbacks = 0;
  for (const { ai, user } of pairs) {
    const f = replyFeatures(ai);
    const pushback = PUSHBACK.test(String(user ?? ""));
    if (pushback) pushbacks += 1;
    const engaged = !pushback && words(user) >= Math.max(3, ENGAGED_RATIO * typical);
    const add = (key) => { stats[key].n += 1; stats[key].e += engaged ? 1 : 0; };
    add(f.question ? "question" : "noQuestion");
    if (f.playful) add("playful");
    add(f.long ? "long" : "short");
  }
  const posterior = Object.fromEntries(Object.entries(stats).map(([k, { e, n }]) => [k, { n, p: Number(((1 + e) / (2 + n)).toFixed(2)) }]));
  return { version: RELATIONSHIP_VERSION, typicalWords: typical, reactions: pairs.length, pushbackRate: pairs.length ? Number((pushbacks / pairs.length).toFixed(2)) : 0, ...posterior };
}

/** Plain-language summary for the writer, only from features with enough evidence. */
export function describeRelationship(rel) {
  if (!rel?.reactions) return "";
  const lines = [];
  const say = (key, good, bad) => {
    const s = rel[key];
    if (!s || s.n < MIN_N) return;
    if (s.p >= 0.65) lines.push(good);
    else if (s.p <= 0.35) lines.push(bad);
  };
  say("question", "They usually open up when asked a real question.", "Questions often get a one-word answer from them; a reaction or a thought tends to work better.");
  say("playful", "Light, playful replies keep them talking.", "Jokey replies tend to fall flat with them.");
  say("long", "They are fine with longer replies.", "Long replies tend to lose them; keep it short.");
  lines.push(`Their messages are usually about ${rel.typicalWords} words.`);
  return lines.join(" ");
}
