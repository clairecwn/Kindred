/**
 * emotion-profile.js — WHAT DID THIS PERSON FEEL: per entry, per day, per
 * week, and since they started. Output is one or two specific words from
 * emotion-taxonomy.js, chosen from a probability distribution, never a
 * nearest-of-ten guess.
 *
 * ===========================================================================
 * 1. ONE ENTRY -> A DISTRIBUTION OVER ~40 FEELINGS
 * ===========================================================================
 * Four evidence sources, each turned into its own distribution q_src:
 *
 *   self    the person naming a feeling in their own words ("restless",
 *           "dw do anything", "paiseh", "mood so off"). Each match gets
 *               c = 0.55 · intensity · statement · ending
 *           (intensity 1.25 for "so/damn/really", 0.75 for "lowk/kinda";
 *           statement 1.3 for a direct "i feel X"; ending 1.15 in the last
 *           quarter of a long entry, where people sum up how they feel now).
 *           Skipped when negated ("not sad"), hoped for or expected
 *           ("thinking i could be productive", "supposed to be happy"), or
 *           about someone else ("my friend was angry"). Matches combine per label by
 *           noisy-OR, e = 1 - Π(1 - c), so repetition helps with diminishing
 *           returns. Singlish and youth slang add self-reports through their
 *           resolved sense (sense-model.js): "sian" read as bored -> bored.
 *   semantic the assessor's grounded affect observations (each tied to an
 *           exact quote), already weighted by strength and recency.
 *   appraisal what the situation implies (thought-appraisal.js): avoiding a
 *           task -> unmotivated, blocked goal -> frustrated, pressure ->
 *           stressed, a worse-than-hoped outcome -> disappointed.
 *   vad     the continuous reading, softly assigned to nearby feelings:
 *               q(l) ∝ exp(-||vad - anchor_l||² / 2τ²),  τ = 0.3
 *
 *   p(l) = Σ_src W_src · q_src(l) / Σ_src W_src     over sources present
 *   W:  self 0.45, semantic 0.30, appraisal 0.15, vad 0.10
 *
 * Self-report is weighted highest because a person's own word for their
 * feeling is the reference standard in affect research; the others fill in
 * what they did not name.
 *
 * Evidence strength of the entry (how much to trust it in aggregates):
 *   conf = 1 - Π_src (1 - c_src)
 * Intensity: I = max(|vad|·1.2, strongest self-report, strongest semantic).
 *
 * ===========================================================================
 * 2. CHOOSING ONE OR TWO WORDS
 * ===========================================================================
 * Sort p. Take the top label. Add a second when p2 >= 0.6·p1 and it is a
 * genuinely different feeling (anchor distance >= 0.3 or a different
 * family) and both are single words: "restless & unmotivated". Two
 * near-synonyms keep only the stronger. If nothing stands out (p1 < 0.16),
 * use the strongest family's best label, or the strongest pleasant and
 * unpleasant labels when both families carry real mass.
 *
 * ===========================================================================
 * 3. DAYS, WEEKS, ALL TIME
 * ===========================================================================
 * Day:  D(l) = Σ_e w_e p_e(l) / Σ_e w_e,   w_e = conf_e · (0.5 + 0.5·I_e)
 *       plus a small extra 0.15 for the day's most intense and (when entries
 *       carry times) its latest entry if they are unpleasant. End-of-day
 *       memory tracks the day's average closely, with small extra weight on
 *       negative peaks and endings (Neubauer et al., JPSP 2020).
 * Range (week, all time): each day counts once, so a day with five entries
 *       does not outvote four quiet days, and feelings that keep coming back
 *       outrank one-off spikes:
 *          S(l) = mean_d D_d(l) · (0.6 + 0.4·r_l),
 *          r_l  = share of logged days with D_d(l) >= 0.12
 *
 * Pure and deterministic.
 */

import { EMOTIONS_TAXONOMY, TAXONOMY_BY_ID, normaliseLabel, familyOf } from "./emotion-taxonomy.js";
import { analyseText } from "./text-features.js";

export const EMOTION_PROFILE_VERSION = "emotion-profile-2026.10.1";
export const SOURCE_WEIGHTS = Object.freeze({ self: 0.45, semantic: 0.30, appraisal: 0.15, vad: 0.10, checkin: 1 });
export const VAD_TAU = 0.3;
export const PAIR_RATIO = 0.6;
export const PAIR_DISTANCE = 0.3;
export const DIFFUSE_TOP = 0.16;
export const RECURRENCE_FLOOR = 0.12;

const NEGATION = /\b(?:not|no|never|don'?t|dont|didn'?t|didnt|isn'?t|isnt|wasn'?t|wasnt|aren'?t|ain'?t|hardly|barely|no longer)\s+(?:\w+\s+){0,2}$/i;
const INTENSIFIER = /\b(?:so|damn|super|really|very|sibei|freaking|extremely|totally|legit|lowkey not)\s+(?:\w+\s+)?$/i;
// "thinking i could be productive", "supposed to feel happy": a hope or an
// expectation, not a feeling the person had.
const COUNTERFACTUAL = /\b(?:thought|thinking|think|supposed to|should(?: have)?|could(?: have)?|would|wanted to|want to|wanna|hoping to|hope to|trying to|try to|wish i (?:was|were|could)|if i|pretend(?:ing)? to|meant to)\s+(?:\w+\s+){0,3}$/i;
// "i feel X", "feeling X", "im so X" right before the word: a statement of
// the person's current state, the most direct self-report there is.
const STATE_STATEMENT = /\b(?:i\s+)?(?:feel|feeling|felt|i'?m|im|i am|am)\s+(?:\w+\s+){0,2}$/i;
const SOFTENER = /\b(?:lowk|lowkey|kinda|kind of|a bit|abit|slightly|a little|sort of|abit)\s+(?:\w+\s+)?$/i;
const THIRD_PERSON = /\b(?:he|she|they|his|her|their|my (?:mum|mom|dad|friend|friends|sister|brother|bf|gf|teacher|boss|classmate)s?|everyone|everybody|the (?:guy|girl|auntie|uncle))\b/i;
const FIRST_PERSON = /\b(?:i|i'?m|im|me|my mood|myself|i feel|i felt)\b/i;
const SAY = EMOTIONS_TAXONOMY.map((e) => ({ id: e.id, re: new RegExp(`(?:^|[^a-z])(?:${e.say})(?=$|[^a-z])`, "gi") }));

/** Slang/Singlish senses that are themselves a named feeling. */
const SENSE_LABELS = Object.freeze({
  sian: { bored: "bored", "fed-up": "fed up", resigned: "low" },
  "sian ah": { default: "fed up" }, "damn sian": { default: "fed up" }, "nvm lor": { default: "fed up" },
  "no choice lor": { default: "fed up" }, "bo bian": { default: "fed up" }, "ok lor": { resigned: "fed up" },
  "fine lah": { "drop-it": "fed up" }, paiseh: { default: "embarrassed" }, malu: { default: "embarrassed" },
  shiok: { default: "happy" }, song: { pleasure: "happy" }, kancheong: { default: "anxious" },
  "pek chek": { default: "irritated" }, geram: { default: "irritated" }, dulan: { default: "irritated" },
  walao: { exasperated: "irritated", amazed: "happy" }, "buay tahan": { default: "overwhelmed" },
  "damn shag": { default: "drained" }, shag: { default: "drained" }, haiz: { default: "fed up" },
  "die liao": { "in-trouble": "stressed" }, "stress one": { default: "stressed" }, heng: { default: "relieved" },
  cooked: { doomed: "stressed" }, crine: { laughing: "amused" }, "im crying": { laughing: "amused", sad: "sad" },
  aura: { "lost-aura": "embarrassed", cool: "proud" }, "took an l": { loss: "disappointed" }, "big w": { win: "proud" },
  "6 7": { meme: "playful" }, scuba: { meme: "playful", submerged: "unsettled" }, skibidi: { meme: "playful" },
  delulu: { "self-tease": "playful" },
});

const clamp01 = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const noisyOr = (cs) => 1 - cs.reduce((prod, c) => prod * (1 - clamp01(c)), 1);
const normalise = (scores) => {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  return total > 0 ? Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v / total])) : {};
};
const anchor = (id) => TAXONOMY_BY_ID.get(id)?.vad ?? [0, 0, 0];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const isUnpleasant = (id) => (anchor(id)[0] ?? 0) < -0.1;

function userTexts(entry) {
  const turns = (Array.isArray(entry?.aiChat) ? entry.aiChat : [])
    .filter((t) => t?.role === "user" && !t.isJournal).map((t) => String(t.text ?? ""));
  return [String(entry?.text ?? ""), ...turns].filter((t) => t.trim());
}

/** Self-reports in one text: label -> list of match strengths. */
export function selfReports(text, features = null) {
  const value = String(text ?? "");
  const found = {};
  const add = (id, c) => { (found[id] = found[id] ?? []).push(c); };
  const laughingSpans = (features?.matches?.informal ?? [])
    .filter((m) => m.token === "im crying" && m.sense?.id === "laughing").map((m) => [m.index, m.index + m.length]);
  for (const { id, re } of SAY) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(value)) !== null) {
      const start = m.index + (m[0].length - m[0].trimStart().length);
      if (id === "sad" && laughingSpans.some(([s, e]) => start >= s && start < e)) continue;
      const before = value.slice(Math.max(0, start - 40), start);
      if (NEGATION.test(before) || COUNTERFACTUAL.test(before)) continue;
      const clauseStart = Math.max(value.lastIndexOf(".", start), value.lastIndexOf(",", start), value.lastIndexOf("\n", start), 0);
      const clause = value.slice(clauseStart, start);
      // Someone else's feeling ("my friend was angry") is not the writer's.
      if (THIRD_PERSON.test(clause) && !FIRST_PERSON.test(clause)) continue;
      const intensity = INTENSIFIER.test(before) ? 1.25 : SOFTENER.test(before) ? 0.75 : 1;
      // A direct "i feel X" counts more, and so does the end of an entry,
      // where people usually sum up how they feel now.
      const statement = STATE_STATEMENT.test(before) || /\b(?:but also|and also)\s+$/i.test(before) ? 1.3 : 1;
      const ending = value.length > 120 && start >= 0.75 * value.length ? 1.15 : 1;
      // What follows "but"/"though" usually carries the weight of the sentence.
      const contrast = /\b(?:but|though|tho|however|yet)\b[^.!?,;]{0,40}$/i.test(before) ? 1.15 : 1;
      add(id, 0.55 * intensity * statement * ending * contrast);
    }
  }
  // Senses of Singlish and youth terms that name a feeling.
  const senseHits = [
    ...(features?.matches?.dialect ?? []).filter((t) => t.counted !== false),
    ...(features?.matches?.informal ?? []).filter((t) => String(t.function ?? "").startsWith("youth-")),
  ];
  for (const t of senseHits) {
    const map = SENSE_LABELS[t.token];
    const id = map?.[t.sense?.id ?? "default"];
    if (id) add(id, 0.5 * clamp01(t.sense?.p ?? 1));
  }
  return found;
}

function appraisalScores(features) {
  const d = features?.appraisal?.dimensions ?? {};
  const scores = {};
  const put = (id, v) => { if (v > 0.15) scores[id] = Math.max(scores[id] ?? 0, v); };
  put("unmotivated", Math.max(d.activationResistance ?? 0, d.taskAversiveness ?? 0));
  put("frustrated", d.goalObstruction ?? 0);
  put("stressed", d.pressure ?? 0);
  put("disappointed", d.outcomeDiscrepancy ?? 0);
  put("drained", 0.6 * (d.physicalDiscomfort ?? 0));
  put("hopeful", d.futureHope ?? 0);
  put("playful", features?.playMass ?? 0);
  const laughs = (features?.matches?.informal ?? []).filter((m) => m.function === "laughter" && (m.v ?? 0) > 0).length;
  if (laughs) put("amused", Math.min(0.6, 0.3 * laughs));
  return scores;
}

function vadScores(vad, confidence) {
  if (!vad || !(confidence > 0)) return {};
  const point = [vad.valence ?? 0, vad.arousal ?? 0, vad.dominance ?? 0];
  const scored = EMOTIONS_TAXONOMY.map((e) => [e.id, Math.exp(-(dist(point, e.vad) ** 2) / (2 * VAD_TAU ** 2))])
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  return Object.fromEntries(scored);
}

const CHECKIN_LABEL = { happy: "happy", excited: "excited", grateful: "grateful", content: "content", calm: "calm",
  neutral: "neutral", tired: "tired", anxious: "anxious", angry: "irritated", sad: "low", mixed: "neutral" };

/** One entry -> { distribution, label, family, confidence, intensity, sources }. */
export function entryEmotionProfile(entry) {
  if (!entry) return null;
  if (entry.source === "checkin") {
    const id = normaliseLabel(entry.emotionLabel) ?? CHECKIN_LABEL[familyOf(entry.emotion) ?? ""] ?? null;
    if (!id) return null;
    return finish({ [id]: 1 }, { confidence: 0.6, intensity: 0.5, sources: ["checkin"] });
  }
  const texts = userTexts(entry);
  if (!texts.length) {
    const id = normaliseLabel(entry.emotionLabel) ?? normaliseLabel(entry.emotion);
    return id ? finish({ [id]: 1 }, { confidence: 0.3, intensity: 0.4, sources: ["saved-label"] }) : null;
  }
  const featureList = texts.map((t) => analyseText(t));
  // Self-reports from every user-authored text (journal and chat turns).
  const selfRaw = {};
  featureList.forEach((f, i) => {
    for (const [id, cs] of Object.entries(selfReports(texts[i], f))) (selfRaw[id] = selfRaw[id] ?? []).push(...cs);
  });
  const self = Object.fromEntries(Object.entries(selfRaw).map(([id, cs]) => [id, noisyOr(cs)]));
  // Semantic: the assessor's grounded observations for this entry.
  const semantic = {};
  for (const [label, weight] of Object.entries(entry.conversationAffect?.semantic?.distribution ?? {})) {
    const id = normaliseLabel(label);
    if (id && Number.isFinite(weight) && weight > 0) semantic[id] = (semantic[id] ?? 0) + weight;
  }
  // Appraisal and VAD from the journal text (the main body of evidence).
  const main = featureList[0];
  const appraisal = appraisalScores(main);
  const vad = entry.conversationAffect?.vad ?? main?.vad;
  const vadConf = main?.vadConfidence ?? 0;
  const vadQ = vadScores(vad, vadConf);

  const sources = { self, semantic, appraisal, vad: vadQ };
  const present = Object.entries(sources).filter(([, q]) => Object.keys(q).length);
  const p = {};
  let totalW = 0;
  for (const [name, q] of present) {
    const n = normalise(q);
    const W = SOURCE_WEIGHTS[name];
    totalW += W;
    for (const [id, v] of Object.entries(n)) p[id] = (p[id] ?? 0) + W * v;
  }
  if (!totalW) return null;
  for (const id of Object.keys(p)) p[id] /= totalW;
  const confidence = noisyOr([
    Math.max(0, ...Object.values(self)),
    Object.keys(semantic).length ? 0.8 : 0,
    0.6 * Math.max(0, ...Object.values(appraisal)),
    0.5 * vadConf,
  ]);
  const vadMag = vad ? Math.hypot(vad.valence ?? 0, vad.arousal ?? 0, vad.dominance ?? 0) : 0;
  const intensity = clamp01(Math.max(1.2 * vadMag, Math.max(0, ...Object.values(self)), Math.max(0, ...Object.values(entry.conversationAffect?.semantic?.distribution ?? {}))));
  return finish(p, { confidence, intensity, sources: present.map(([n]) => n) });
}

function finish(p, meta) {
  const distribution = Object.fromEntries(Object.entries(p).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  const pick = pickLabel(distribution);
  return { version: EMOTION_PROFILE_VERSION, distribution, ...pick, ...meta };
}

/** Choose one or two words from a distribution (section 2). */
export function pickLabel(distribution = {}) {
  const ranked = Object.entries(distribution).filter(([id]) => TAXONOMY_BY_ID.has(id)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!ranked.length) return { label: "neutral", family: "neutral", parts: ["neutral"] };
  let [top, p1] = ranked[0];
  if (p1 < DIFFUSE_TOP) {
    const families = {};
    for (const [id, p] of ranked) {
      const fam = TAXONOMY_BY_ID.get(id).family;
      families[fam] = (families[fam] ?? 0) + p;
    }
    const pleasant = ranked.filter(([id]) => anchor(id)[0] > 0.1);
    const unpleasant = ranked.filter(([id]) => anchor(id)[0] < -0.1);
    const pMass = pleasant.reduce((s, [, p]) => s + p, 0);
    const uMass = unpleasant.reduce((s, [, p]) => s + p, 0);
    if (pMass >= 0.3 && uMass >= 0.3 && !pleasant[0][0].includes(" ") && !unpleasant[0][0].includes(" ")) {
      return { label: `${unpleasant[0][0]} & ${pleasant[0][0]}`, family: "mixed", parts: [unpleasant[0][0], pleasant[0][0]] };
    }
    const [fam] = Object.entries(families).sort((a, b) => b[1] - a[1])[0];
    [top, p1] = ranked.find(([id]) => TAXONOMY_BY_ID.get(id).family === fam);
  }
  const second = top.includes(" ") ? null : ranked.slice(1).find(([id, p]) => p >= PAIR_RATIO * p1 && !id.includes(" ")
    && (dist(anchor(id), anchor(top)) >= PAIR_DISTANCE || TAXONOMY_BY_ID.get(id).family !== TAXONOMY_BY_ID.get(top).family));
  const pairable = Boolean(second);
  const parts = pairable ? [top, second[0]] : [top];
  const oppositeValence = pairable && Math.sign(anchor(top)[0]) !== Math.sign(anchor(second[0])[0])
    && Math.abs(anchor(top)[0]) > 0.1 && Math.abs(anchor(second[0])[0]) > 0.1;
  return { label: parts.join(" & "), family: oppositeValence ? "mixed" : TAXONOMY_BY_ID.get(top).family, parts };
}

function entryTime(entry) {
  const t = Date.parse(entry?.createdAt ?? entry?.timestamp ?? entry?.time ?? "");
  return Number.isFinite(t) ? t : null;
}

/** Combine entry profiles of one day (section 3). */
export function dayEmotionProfile(entries = []) {
  const profiles = entries.map((e) => ({ entry: e, profile: entryEmotionProfile(e) })).filter((x) => x.profile);
  if (!profiles.length) return null;
  const peak = profiles.reduce((best, x) => (x.profile.intensity > best.profile.intensity
    || (x.profile.intensity === best.profile.intensity && x.profile.label < best.profile.label) ? x : best), profiles[0]);
  const timed = profiles.filter((x) => entryTime(x.entry) !== null);
  const last = timed.length === profiles.length ? timed.reduce((a, b) => (entryTime(b.entry) > entryTime(a.entry) ? b : a)) : null;
  const D = {};
  let total = 0;
  for (const x of profiles) {
    let w = x.profile.confidence * (0.5 + 0.5 * x.profile.intensity);
    const unpleasant = isUnpleasant(x.profile.parts[0]);
    if (unpleasant && x === peak && profiles.length > 1) w += 0.15;
    if (unpleasant && x === last && profiles.length > 1) w += 0.15;
    total += w;
    for (const [id, p] of Object.entries(x.profile.distribution)) D[id] = (D[id] ?? 0) + w * p;
  }
  for (const id of Object.keys(D)) D[id] /= total || 1;
  return { ...finish(D, {}), count: profiles.length, confidence: noisyOr(profiles.map((x) => x.profile.confidence)) };
}

/** Combine days (week or all time): each day once, recurring feelings favoured. */
export function rangeEmotionProfile(dayProfiles = []) {
  const days = dayProfiles.filter(Boolean);
  if (!days.length) return null;
  const ids = new Set(days.flatMap((d) => Object.keys(d.distribution)));
  const S = {};
  for (const id of ids) {
    const values = days.map((d) => d.distribution[id] ?? 0);
    const mean = values.reduce((a, b) => a + b, 0) / days.length;
    const recurrence = values.filter((v) => v >= RECURRENCE_FLOOR).length / days.length;
    S[id] = mean * (0.6 + 0.4 * recurrence);
  }
  const total = Object.values(S).reduce((a, b) => a + b, 0) || 1;
  for (const id of Object.keys(S)) S[id] /= total;
  return { ...finish(S, {}), dayCount: days.length };
}
