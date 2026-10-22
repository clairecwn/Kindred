/**
 * Meaning-level similarity for short chat lines, so "u could just chill tonight"
 * and "maybe relax a bit tonight" count as the same move (lexical Jaccard misses it).
 *
 *   sim(a,b) = max( J(C(a), C(b)),  0.85 · cos(tri(a'), tri(b')) )
 *
 * C(·) maps each content word to a concept id (synonym groups below, then a
 * light stemmer), a' is the text rewritten in concept ids, tri(·) is the
 * character-trigram bag (robust to typos and shortforms: "relaxin", "stresssed").
 * The 0.85 factor keeps trigram overlap from beating real concept overlap.
 * Deterministic and tiny; a sentence-embedding model could replace C(·) later
 * (see docs/research/companion-voice-2026-10.md) without changing callers.
 */
export const PARAPHRASE_VERSION = "paraphrase-2026.10.1";

const GROUPS = {
  REST: "rest relax relaxing chill chilling chillin veg vegging unwind unwinding break breather lepak nap sleep recharge recover downtime",
  PRESSURE: "pressure stress stressed stressing stressful overwhelmed overwhelming swamped drowning keep catch behind falling heavy load much",
  TIRED: "tired exhausted drained shag shagged sian burnt burnout fried dead wiped sleepy zonked",
  SAD: "sad down low upset blue crying cry sian moody",
  ANGRY: "angry mad pissed annoyed irritated frustrated frustrating fed buay song",
  ANXIOUS: "anxious nervous worried worry worrying scared afraid panic panicking jittery uneasy",
  START: "start starting begin beginning kick kickstart first open",
  WORK: "work job shift intern internship office boss career",
  SCHOOL: "school exam exams test tests paper papers study studying revision revise homework assignment assignments project uni class lecture",
  FRIEND: "friend friends bestie bff buddy kaki gang squad",
  TALK: "talk talking tell telling say saying chat text texting message reply replying ask asking",
  IGNORE: "ghost ghosted ghosting ignore ignored ignoring blue tick seen unreplied",
  ENJOY: "fun enjoy enjoyed enjoying shiok nice good great happy",
  THINK: "think thinking thought mind head brain overthinking overthink",
  WANT: "want wanna need gotta hope wish",
  FEEL: "feel feeling felt feels emotion emotions",
  MONEY: "money cash spend spent spending price expensive cost broke",
  TODAY: "today tonight now later rn",
  HELP: "help helps helped support supporting",
  GOOD_NEWS: "won win passed pass got accepted promoted",
  BIT: "bit little abit slightly kinda sorta",
  BLAME: "blame blamed blaming fault faults scapegoat dumping dump channeling channelling accuse accused accusing pin pinned",
  UPSET: "upset upsetting hurt hurts hurting off weird awkward tension",
  GIVE_IN: "give giving gave bend bending cave caving pushover doormat",
};
const CONCEPT = new Map();
for (const [id, words] of Object.entries(GROUPS)) for (const w of words.split(" ")) if (!CONCEPT.has(w)) CONCEPT.set(w, id);

const STOP = new Set(["the", "a", "an", "and", "or", "but", "so", "to", "of", "in", "on", "at", "for", "it", "its", "is", "are", "was", "be", "been", "i", "you", "u", "ur", "your", "me", "my", "we", "they", "that", "this", "just", "like", "maybe", "do", "did", "does", "can", "could", "would", "will", "have", "has", "had", "with", "about", "abt", "what", "how", "lah", "lor", "leh", "sia", "ah", "eh", "ya", "yeah", "ok", "okay", "really", "very", "then", "there", "if", "not", "no", "any", "some", "all", "get", "got", "go", "going", "gonna", "still", "too", "also", "more", "one", "kind", "thing", "things"]);

const stem = (w) => w.length > 4 ? w.replace(/(?:ing|in|ed|es|s|ly)$/, "") : w;

export function concepts(text) {
  const words = String(text ?? "").toLowerCase().replace(/[’‘]/g, "'").replace(/n'?t\b/g, "").match(/[a-z]+/g) ?? [];
  const out = [];
  for (const raw of words) {
    const w = raw.replace(/(.)\1{2,}/g, "$1$1");
    if (STOP.has(w) || w.length < 2) continue;
    out.push(CONCEPT.get(w) ?? CONCEPT.get(stem(w)) ?? stem(w));
  }
  return out;
}

function trigrams(tokens) {
  const bag = new Map();
  for (const tok of tokens) {
    const s = ` ${tok} `;
    for (let i = 0; i + 3 <= s.length; i += 1) bag.set(s.slice(i, i + 3), (bag.get(s.slice(i, i + 3)) ?? 0) + 1);
  }
  return bag;
}
function cosine(A, B) {
  let dot = 0, a = 0, b = 0;
  for (const [k, v] of A) { a += v * v; if (B.has(k)) dot += v * B.get(k); }
  for (const v of B.values()) b += v * v;
  return a && b ? dot / Math.sqrt(a * b) : 0;
}
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n += 1;
  return n / (A.size + B.size - n);
}

/** Meaning similarity in [0,1]. Lines with under two content concepts score 0 (too little to compare). */
export function paraphraseSimilarity(a, b) {
  const ca = concepts(a), cb = concepts(b);
  if (ca.length < 2 || cb.length < 2) return 0;
  return Math.max(jaccard(ca, cb), 0.85 * cosine(trigrams(ca), trigrams(cb)));
}
