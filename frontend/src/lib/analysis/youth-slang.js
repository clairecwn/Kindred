/**
 * youth-slang.js — meme words, Gen Alpha / Gen Z slang and kids' jokes.
 *
 * Same multi-sense format as dialect/singlish-senses.js, read by
 * sense-model.js. Three extra fields matter here:
 *
 *   dated      { since, halfLifeDays } — memes fade. Non-literal senses decay
 *              toward a floor with age unless community use keeps them alive
 *              (sense-model.js ageDecay + communityCounts). A new meme is
 *              added as an entry; a dead one needs no deletion.
 *   ageRating  "all" | "teen". Recognition is always on (a word Kindred does
 *              not understand cannot be handled safely), but the writer is told
 *              never to echo a "teen" term to a child-mode user.
 *   strategy   "play" marks a social bid or joke with little propositional
 *              content ("6 7"). The right reply to play is to play back, not
 *              to interpret it as a feeling.
 *
 * Self-harm euphemisms ("kms", "unalive") are deliberately NOT here. They are
 * in crisis-detection.js, which is never softened by a joke reading.
 *
 * Entries are data, not reply templates: nothing in this file is shown to the
 * user. Sources for current meanings are listed in docs/research.
 */

export const YOUTH_SLANG_VERSION = "youth-slang-2026.10.1";

const re = (s) => new RegExp(`(?:${s})`, "i");
const LAUGH = "lol|lmao|lmfao|haha+|hehe+|bro|bruh|💀|😂|🤣|😭";

export const YOUTH_SLANG = Object.freeze([
  { token: "6 7", ageRating: "all", dated: { since: "2025-03-01", halfLifeDays: 300 },
    patterns: [/\b6(?:\s+|\s*[-–]\s*)7\b/i, /\bsix\s*[-–]?\s*seven\b/i, /\bsixseven\b/i],
    senses: [
      { id: "meme", gloss: "the '6 7' meme: a playful nonsense call-out, a bid to joke around", vad: [0.25, 0.45, 0.1], prior: 0.7, strategy: "play",
        cues: [{ pattern: re(`${LAUGH}|!{1,}|six seven|6 7 6 7|mango|skrilla`), weight: 1 }] },
      { id: "so-so", gloss: "so-so, meh (the hand-weighing gesture)", vad: [-0.05, 0, 0], prior: 0.15,
        cues: [{ pattern: re("how was|how's|hows|how did|rate|kinda|ok ok|okok"), weight: 1.2 }] },
      { id: "number", gloss: "literal numbers six and seven", vad: [0, 0, 0], prior: 0.15,
        cues: [{ pattern: re("\\b(?:marks?|points?|percent|page|minutes?|mins|years?|yrs|am|pm|dollars|out of|score|grade|chapter|bus|room|level|primary|p[1-6]|sec)\\b|\\$|%|\\b5\\s*6\\s*7|7\\s*8\\b"), weight: 2.5 }] },
    ] },
  { token: "67", ageRating: "all", dated: { since: "2025-03-01", halfLifeDays: 300 },
    patterns: [/\b67\b/],
    senses: [
      { id: "number", gloss: "the number 67", vad: [0, 0, 0], prior: 0.75,
        cues: [{ pattern: re("\\b(?:marks?|points?|percent|page|minutes?|years?|out of|score|grade|bus|room|level|dollars)\\b|\\$|%"), weight: 2.5 }] },
      { id: "meme", gloss: "the '6 7' meme written as 67", vad: [0.25, 0.45, 0.1], prior: 0.25, strategy: "play",
        cues: [{ pattern: re(`${LAUGH}|!|67 67`), weight: 1.6 }] },
    ] },
  { token: "scuba", ageRating: "all", dated: { since: "2026-06-01", halfLifeDays: 240 },
    patterns: [/\bs+c+u+b+a+\b/i],
    senses: [
      { id: "meme", gloss: "the 'scuba' meme or dance (hold nose, wave hand)", vad: [0.25, 0.45, 0.05], prior: 0.5, strategy: "play",
        cues: [{ pattern: re(`${LAUGH}|!{1,}|juke|dance|scubaa`), weight: 1 }] },
      { id: "submerged", gloss: "deep in it, overthinking, stuck in your head", vad: [-0.2, 0.15, -0.2], prior: 0.25,
        cues: [{ pattern: re("think|thinking|overthink|deep|stuck|cannot stop|can't stop|in my head|spiral"), weight: 1.4 }] },
      { id: "stinks", gloss: "something stinks", vad: [-0.2, 0.15, 0], prior: 0.1,
        cues: [{ pattern: re("smell|smelly|stink|stinky|toilet|fart"), weight: 1.6 }] },
      { id: "diving", gloss: "literal scuba diving", vad: [0.1, 0.1, 0], prior: 0.15,
        cues: [{ pattern: re("diving|dive|ocean|sea|tank|snorkel|mask|fins|lesson|trip"), weight: 2 }] },
    ] },
  { token: "crine", ageRating: "all", dated: { since: "2026-03-01", halfLifeDays: 300 },
    patterns: [/\bc+r+i+n+e+\b/i, /\bcrine+ing\b/i],
    senses: [
      { id: "laughing", gloss: "'crying' spelled on purpose: dying of laughter", vad: [0.5, 0.5, 0.1], prior: 1, strategy: "play" },
    ] },
  { token: "im crying", ageRating: "all",
    patterns: [/\bi'?m\s+(?:literally\s+)?crying\b/i, /\bim\s+crying\b/i, /\bcrying\s+rn\b/i],
    senses: [
      { id: "sad", gloss: "actually crying", vad: [-0.6, 0.3, -0.35], prior: 0.6,
        cues: [{ pattern: re("sad|hurt|alone|miss|why|can't stop|cannot stop|so bad|scared"), weight: 1 }] },
      { id: "laughing", gloss: "laughing hard ('I'm crying' as in dying of laughter)", vad: [0.5, 0.5, 0.1], prior: 0.4, strategy: "hyperbole",
        cues: [{ pattern: re(`${LAUGH}|so funny|funniest|💀`), weight: 1.8 }] },
    ] },
  { token: "cooked", ageRating: "all", dated: { since: "2023-06-01", halfLifeDays: 900 },
    patterns: [/\bc+o+k+e+d+\b/i, /\bso\s+cooked\b/i],
    senses: [
      { id: "doomed", gloss: "doomed, in trouble, done for", vad: [-0.45, 0.35, -0.45], prior: 0.65, strategy: "hyperbole",
        cues: [{ pattern: re("i'm|im|i am|we're|were|we are|exam|test|quiz|homework|deadline|teacher|so"), weight: 0.8 }] },
      { id: "literal", gloss: "food was cooked", vad: [0.05, 0, 0], prior: 0.35,
        cues: [{ pattern: re("dinner|lunch|rice|food|chicken|noodles|egg|recipe|meal|for us|mum cooked|mom cooked|dad cooked"), weight: 2 }] },
    ] },
  { token: "aura", ageRating: "all", dated: { since: "2024-03-01", halfLifeDays: 600 },
    patterns: [/\baura\b/i, /[-+]?\d+\s*aura\b/i],
    senses: [
      { id: "cool", gloss: "cool factor, respect points", vad: [0.4, 0.3, 0.35], prior: 0.6, strategy: "play" },
      { id: "lost-aura", gloss: "embarrassed, lost cool points", vad: [-0.35, 0.3, -0.3], prior: 0.4, strategy: "play",
        cues: [{ pattern: /(?:^|\s)-\d+|minus|lost|negative|no aura|zero aura/i, weight: 2 }] },
    ] },
  { token: "rizz", ageRating: "all", dated: { since: "2022-06-01", halfLifeDays: 1200 },
    patterns: [/\br+i+z+\b/i, /\brizzler\b/i],
    senses: [{ id: "charm", gloss: "charm, being smooth", vad: [0.35, 0.3, 0.3], prior: 1, strategy: "play" }] },
  { token: "skibidi", ageRating: "all", dated: { since: "2023-02-01", halfLifeDays: 500 },
    patterns: [/\bskibidi\b/i],
    senses: [
      { id: "meme", gloss: "skibidi meme word, silly nonsense", vad: [0.2, 0.4, 0], prior: 0.7, strategy: "play" },
      { id: "weird", gloss: "weird or bad ('so skibidi')", vad: [-0.2, 0.2, 0], prior: 0.3, cues: [{ pattern: re("so skibidi|that's skibidi|thats skibidi|ew|weird"), weight: 1.2 }] },
    ] },
  { token: "brainrot", ageRating: "all", dated: { since: "2024-03-01", halfLifeDays: 700 },
    patterns: [/\bbrain\s*rot(?:ted)?\b/i],
    senses: [
      { id: "meme-content", gloss: "silly meme content, or feeling mushy from too much of it", vad: [-0.05, 0.1, -0.05], prior: 1, strategy: "play" },
    ] },
  { token: "ohio", ageRating: "all", dated: { since: "2022-09-01", halfLifeDays: 500 },
    patterns: [/\bonly in ohio\b/i, /\bso ohio\b/i, /\bohio\b/i],
    senses: [
      { id: "weird", gloss: "weird, cursed (meme)", vad: [-0.15, 0.25, 0], prior: 0.6, strategy: "play",
        cues: [{ pattern: re("only in ohio|so ohio|that's ohio|thats ohio"), weight: 2 }] },
      { id: "place", gloss: "the US state", vad: [0, 0, 0], prior: 0.4,
        cues: [{ pattern: re("live|lived|moved|visit|trip|family|in ohio"), weight: 1.2 }] },
    ] },
  { token: "chopped", ageRating: "all", dated: { since: "2024-06-01", halfLifeDays: 500 },
    patterns: [/\bchopped\b/i],
    senses: [
      { id: "ugly-bad", gloss: "ugly or bad", vad: [-0.35, 0.2, -0.05], prior: 0.6 },
      { id: "literal", gloss: "cut up", vad: [0, 0, 0], prior: 0.4, cues: [{ pattern: re("onion|vegetable|food|wood|hair|cut|knife"), weight: 2 }] },
    ] },
  { token: "delulu", ageRating: "all", dated: { since: "2023-01-01", halfLifeDays: 900 },
    patterns: [/\bdelulu\b/i],
    senses: [{ id: "self-tease", gloss: "delusional, often lovingly self-teasing", vad: [-0.05, 0.2, 0], prior: 1, strategy: "play" }] },
  { token: "sus", ageRating: "all", dated: { since: "2020-10-01", halfLifeDays: 1500 },
    patterns: [/\bs+u+s+\b/i, /\bsuspicious\b/i],
    senses: [{ id: "suspicious", gloss: "suspicious, shady", vad: [-0.2, 0.25, 0], prior: 1 }] },
  { token: "npc", ageRating: "all", dated: { since: "2022-01-01", halfLifeDays: 1200 },
    patterns: [/\bnpc\b/i],
    senses: [
      { id: "mindless", gloss: "acting like a background character, no thoughts", vad: [-0.2, -0.1, -0.1], prior: 0.7 },
      { id: "game", gloss: "a non-player character in a game", vad: [0, 0, 0], prior: 0.3, cues: [{ pattern: re("game|quest|minecraft|roblox|level|talk to the"), weight: 2 }] },
    ] },
  { token: "took an l", ageRating: "all",
    patterns: [/\b(?:took|take|taking|big|huge|massive|another|such an?)\s+l\b/i, /\bthat'?s an l\b/i],
    senses: [{ id: "loss", gloss: "a loss, a fail", vad: [-0.35, 0.15, -0.3], prior: 1 }] },
  { token: "big w", ageRating: "all",
    patterns: [/\b(?:big|huge|massive|another|such an?|took the|take the)\s+w\b/i, /\bthat'?s a w\b/i],
    senses: [{ id: "win", gloss: "a win", vad: [0.5, 0.35, 0.4], prior: 1 }] },
  { token: "bet", ageRating: "all",
    patterns: [/^\s*bet\b/i, /\bbet\s*(?:!|$)/i],
    senses: [
      { id: "agree", gloss: "okay, deal, sounds good", vad: [0.2, 0.1, 0.2], prior: 0.7 },
      { id: "wager", gloss: "a wager", vad: [0, 0.1, 0], prior: 0.3, cues: [{ pattern: re("i bet|bet you|bet that|\\$"), weight: 2 }] },
    ] },
  { token: "lowkey", ageRating: "all",
    patterns: [/\blow\s*key\b/i, /\blowk\b/i],
    senses: [{ id: "hedge", gloss: "kind of, quietly (softens what follows)", vad: [0, -0.05, 0], prior: 1 }] },
  { token: "highkey", ageRating: "all",
    patterns: [/\bhigh\s*key\b/i],
    senses: [{ id: "emphasis", gloss: "really, openly (strengthens what follows)", vad: [0, 0.15, 0], prior: 1 }] },
]);

/** Find youth slang spans. Longest span wins on overlap. Pure. */
export function findYouthSlang(text) {
  const value = String(text ?? "");
  const hits = [];
  for (const entry of YOUTH_SLANG) {
    for (const pattern of entry.patterns) {
      const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
      let m;
      while ((m = global.exec(value)) !== null) {
        hits.push({ entry, index: m.index, length: m[0].length, matchedText: m[0] });
        if (m.index === global.lastIndex) global.lastIndex += 1;
      }
    }
  }
  hits.sort((a, b) => a.index - b.index || b.length - a.length);
  const accepted = [];
  for (const hit of hits) {
    const end = hit.index + hit.length;
    if (accepted.some((h) => hit.index < h.index + h.length && end > h.index)) continue;
    accepted.push(hit);
  }
  return accepted;
}
