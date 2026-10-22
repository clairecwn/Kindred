/**
 * emotion-taxonomy.js — the words Kindred is allowed to use for a feeling.
 *
 * About 40 specific feelings, each with:
 *   family  one of the 10 families the rest of the app (avatar, home island,
 *           world mood, colours) already understands. Families are for those
 *           systems and colour only; the SPECIFIC label is what people see.
 *   vad     [valence, arousal, dominance] in [-1,1], placed from Warriner et
 *           al. (2013) / NRC VAD norms for the word and its neighbours.
 *   say     how people actually say it, including Singlish, short forms and
 *           kids' phrasings. A match is a SELF-REPORT: the person naming their
 *           own feeling, which is the strongest evidence there is.
 *
 * Why specific words: people who can name feelings precisely (emotional
 * granularity) regulate better (Kashdan, Barrett & McKnight 2015). Folding
 * "frustrated" into "angry" or "disappointed" into "sad" is both less useful
 * and, often, simply wrong.
 */

export const EMOTION_TAXONOMY_VERSION = "emotion-taxonomy-2026.10.1";

const w = (s) => s; // readability: each `say` entry is a regex alternative list

export const EMOTIONS_TAXONOMY = Object.freeze([
  // ── pleasant, energised ────────────────────────────────────────────────
  { id: "happy", family: "happy", vad: [0.8, 0.5, 0.55], say: w("happy|glad|good mood|so good today|great day|yay|in a good mood|feeling good|feel good|best day|got (?:the|my|an?) (?:internship|job|offer|place|spot|role|scholarship)|got accepted|got in(?:to)?|i passed|passed (?:my|the)|we won|i won") },
  { id: "excited", family: "excited", vad: [0.75, 0.85, 0.55], say: w("excited|hyped|so hype|pumped|stoked|can'?t wait|cant wait|so ready|literally screamed|screamed when|can'?t believe (?:i|it|we)|cant believe (?:i|it|we)|guys i (?:got|did|won|passed)") },
  { id: "amused", family: "happy", vad: [0.6, 0.6, 0.45], say: w("amused|so funny|hilarious|cracked me up|dying of laughter|crine|cracking up|funniest") },
  { id: "proud", family: "happy", vad: [0.75, 0.5, 0.75], say: w("proud|nailed it|i did it|accomplished") },
  { id: "motivated", family: "excited", vad: [0.55, 0.55, 0.65], say: w("motivated|feeling productive|felt productive|so productive|energi[sz]ed|on a roll|i got this|feeling driven") },
  { id: "playful", family: "excited", vad: [0.5, 0.65, 0.5], say: w("playful|silly mood|goofy mood") },
  // ── pleasant, settled ──────────────────────────────────────────────────
  { id: "content", family: "content", vad: [0.55, 0.1, 0.55], say: w("content|satisfied|decent day|pretty good day|not bad today|good enough") },
  { id: "calm", family: "calm", vad: [0.5, -0.4, 0.5], say: w("calm|peaceful|relaxed|chill(?:ed)? day|at peace|chilling|chillax|zen") },
  { id: "relieved", family: "calm", vad: [0.6, -0.1, 0.5], say: w("relieved|relief|phew|weight off my|load off my") },
  { id: "grateful", family: "grateful", vad: [0.75, 0.3, 0.45], say: w("grateful|thankful|appreciate|blessed|so lucky") },
  { id: "hopeful", family: "content", vad: [0.55, 0.3, 0.4], say: w("hopeful|looking forward|optimistic|things will get better") },
  { id: "connected", family: "grateful", vad: [0.7, 0.35, 0.5], say: w("connected|loved|cared for|supported|close to (?:her|him|them)|felt seen|felt heard") },
  // ── neutral / unclear ──────────────────────────────────────────────────
  { id: "neutral", family: "neutral", vad: [0, 0, 0], say: w("normal day|nothing much|ordinary day|average day|so-so|okay day") },
  { id: "confused", family: "anxious", vad: [-0.25, 0.25, -0.35], say: w("confused|so lost|don'?t get it|dont get it|blur|cheem|mind blank") },
  { id: "unsettled", family: "anxious", vad: [-0.35, 0.3, -0.35], say: w("mood (?:so |damn |very )?off|feel(?:ing)? off|something feels off|weird mood|unsettled|idk what'?s wrong (?:w|with) me|dk what'?s wrong (?:w|with) me|not myself|out of sorts") },
  { id: "bored", family: "tired", vad: [-0.3, -0.55, -0.1], say: w("bored|so boring|nothing to do") },
  // ── unpleasant, activated ──────────────────────────────────────────────
  { id: "anxious", family: "anxious", vad: [-0.55, 0.7, -0.55], say: w("anxious|worried|worrying|scared|afraid|kancheong|panick(?:ed|ing)|freaking out|dreading") },
  { id: "nervous", family: "anxious", vad: [-0.45, 0.6, -0.45], say: w("nervous|butterflies|jittery|on edge") },
  { id: "stressed", family: "anxious", vad: [-0.55, 0.6, -0.35], say: w("stressed|stress(?:ful| one)?|so much pressure|under pressure|so much to do|chasing deadlines") },
  { id: "overwhelmed", family: "anxious", vad: [-0.6, 0.6, -0.65], say: w("overwhelm(?:ed|ing)|too much (?:for me|to handle)|drowning|can'?t cope|cannot cope|buay tahan") },
  { id: "restless", family: "anxious", vad: [-0.3, 0.55, -0.2], say: w("restless|fidgety|antsy|can'?t sit still|cant sit still|can'?t settle") },
  { id: "frustrated", family: "angry", vad: [-0.55, 0.55, 0.1], say: w("frustrat(?:ed|ing)|so frustrating") },
  { id: "irritated", family: "angry", vad: [-0.45, 0.45, 0.2], say: w("annoyed|annoying|irritat(?:ed|ing)|pek chek|geram|dulan|pissed off|so done with (?:him|her|them)") },
  { id: "angry", family: "angry", vad: [-0.65, 0.75, 0.4], say: w("angry|mad at|furious|raging|fuming|so mad|pissed") },
  { id: "fed up", family: "angry", vad: [-0.55, 0.2, -0.1], say: w("fed up|sick of|had enough|sian ah|damn sian|so sian") },
  { id: "embarrassed", family: "anxious", vad: [-0.5, 0.5, -0.55], say: w("embarrass(?:ed|ing)|paiseh|pai seh|cringe at myself|humiliat(?:ed|ing)|malu|so awkward") },
  { id: "guilty", family: "sad", vad: [-0.5, 0.3, -0.45], say: w("guilty|feel bad (?:that|for|about)|shouldn'?t have|regret") },
  { id: "jealous", family: "angry", vad: [-0.45, 0.45, -0.1], say: w("jealous|envious") },
  { id: "insecure", family: "anxious", vad: [-0.5, 0.3, -0.55], say: w("insecure|not good enough|compar(?:e|ing) myself|feel ugly|feel stupid|feel dumb|i'?m so stupid|im so stupid|i'?m (?:so )?dumb|im (?:so )?dumb|i (?:just )?suck at|i'?m useless|im useless|everyone else (?:can|passes|gets|is better)") },
  // ── unpleasant, deactivated ────────────────────────────────────────────
  { id: "sad", family: "sad", vad: [-0.7, -0.3, -0.5], say: w("sad|upset|cried|crying|heartbroken|tearing up|teared up") },
  { id: "low", family: "sad", vad: [-0.5, -0.35, -0.35], say: w("feeling low|feel low|so down|feeling down|feel down|moody|gloomy|emo today|rough (?:day|week|time)|bad (?:day|week)|terrible (?:day|week)|worst (?:day|week)|shitty (?:day|week)|everything (?:keeps |kept )?going wrong|nothing goes right") },
  { id: "lonely", family: "sad", vad: [-0.6, -0.3, -0.5], say: w("lonely|so alone|feel alone|felt alone|all alone|left out|no one to talk to|nobody cares|no friends") },
  { id: "hurt", family: "sad", vad: [-0.65, 0.2, -0.5], say: w("hurt(?:s)? my feelings|felt hurt|i'?m hurt|betrayed|stung|offended") },
  { id: "disappointed", family: "sad", vad: [-0.55, -0.1, -0.35], say: w("disappoint(?:ed|ing)|let down|sayang|expected (?:more|better)|such a letdown|failed (?:my|the|it|again)|didn'?t pass|didnt pass|didn'?t get in|didnt get in") },
  { id: "discouraged", family: "sad", vad: [-0.55, -0.25, -0.55], say: w("discouraged|demotivated|losing hope|no point trying|giving up on") },
  { id: "missing someone", family: "sad", vad: [-0.45, -0.1, -0.3], say: w("miss (?:her|him|them|my|you)|missing (?:her|him|them|my)|homesick") },
  { id: "unmotivated", family: "tired", vad: [-0.35, -0.5, -0.35], say: w("unmotivated|no motivation|zero motivation|lazy|dw do anything|don'?t (?:want|wanna|feel like) (?:to )?do anything|dont (?:want|wanna) do anything|can'?t be bothered|cant be bothered|procrastinat(?:e|ed|ing)|keep putting (?:it )?off|bo chup") },
  { id: "drained", family: "tired", vad: [-0.4, -0.65, -0.4], say: w("drained|exhausted|no energy|zero energy|dead tired|so shag|damn shag|shagged|wiped out|running on empty") },
  { id: "tired", family: "tired", vad: [-0.2, -0.65, -0.3], say: w("tired|sleepy|need sleep") },
  { id: "burnt out", family: "tired", vad: [-0.6, -0.5, -0.6], say: w("burn(?:t|ed) out|burnout|so done with everything") },
  { id: "empty", family: "sad", vad: [-0.35, -0.6, -0.35], say: w("numb|empty inside|feel(?:ing)? (?:so |kinda |a bit |abit )?empty|kinda empty|so empty|feel nothing") },
  { id: "flat", family: "tired", vad: [-0.2, -0.45, -0.15], say: w("meh|blah|flat today|feel(?:ing)? flat|so-so mood") },
]);

export const TAXONOMY_IDS = Object.freeze(EMOTIONS_TAXONOMY.map((e) => e.id));
export const TAXONOMY_BY_ID = new Map(EMOTIONS_TAXONOMY.map((e) => [e.id, e]));
export const FAMILIES = Object.freeze(["happy", "excited", "grateful", "content", "calm", "neutral", "tired", "anxious", "angry", "sad", "mixed"]);

/** Old 17 assessor labels and old family words map straight onto the taxonomy. */
const ALIASES = Object.freeze({ annoyed: "irritated", worried: "anxious", exhausted: "drained", fedup: "fed up", "fed-up": "fed up",
  burnout: "burnt out", "burned out": "burnt out", scared: "anxious", upset: "sad", lazy: "unmotivated", numb: "empty" });

export function normaliseLabel(label) {
  const key = String(label ?? "").toLowerCase().trim();
  if (TAXONOMY_BY_ID.has(key)) return key;
  return ALIASES[key] ?? null;
}

export function familyOf(label) {
  const id = normaliseLabel(label);
  if (id) return TAXONOMY_BY_ID.get(id).family;
  return FAMILIES.includes(String(label)) ? String(label) : null;
}

/**
 * Display text for a label or a pair "restless & unmotivated", plus the
 * family of its first part for colour. Historical free-text labels
 * ("frustrated and tired") are parsed into taxonomy words where possible.
 */
export function describeLabel(raw) {
  const text = String(raw ?? "").toLowerCase().trim();
  if (!text) return null;
  const parts = text.split(/\s*(?:&|,|\band\b|\/)\s*/).map(normaliseLabel).filter(Boolean);
  const unique = [...new Set(parts)].slice(0, 2);
  if (!unique.length) {
    if (FAMILIES.includes(text)) return { label: text, display: text[0].toUpperCase() + text.slice(1), family: text, parts: [text] };
    return null;
  }
  const label = unique.length === 2 && unique.every((p) => !p.includes(" ")) ? unique.join(" & ") : unique[0];
  return { label, display: label[0].toUpperCase() + label.slice(1), family: TAXONOMY_BY_ID.get(unique[0]).family, parts: label.split(" & ") };
}
