/**
 * lexicon.js
 *
 * THE AFFECT LEXICON THE DETERMINISTIC TEXT MODEL RUNS ON.
 *
 * Why this file exists
 * -------------------
 * Before this, the only "text understanding" Kindred had was a bag of
 * emotion-keyword lists that voted for one of ten discrete labels, plus an
 * optional LLM call that silently overwrote the result. Neither produced a
 * number you could put into a filter: a label is not a measurement, and an
 * LLM's answer is not reproducible. This file is the measurement layer —
 * every word carries a fixed (valence, arousal, dominance) triple, so a
 * piece of text maps to a point in the same VAD space that emotion-space.js
 * already uses for check-ins, and the same text always maps to the same
 * point.
 *
 * Scale and provenance
 * --------------------
 * Each entry is { v, a, d } on [-1, 1], the affective-norm convention
 * rescaled from the 1-9 SAM rating scale used by Bradley & Lang's ANEW and
 * by Warriner, Kuperman & Brysbaert (2013) via
 *
 *     x_[-1,1] = (x_[1,9] - 5) / 4
 *
 * so 5 ("neutral" on the SAM scale) is 0, 9 is +1 and 1 is -1. Values here
 * are hand-placed to sit inside the published norm range for the closest
 * headword, rounded to 2 d.p. They are NOT a copy of any norm dataset — a
 * curated ~300-word subset chosen for the vocabulary that actually turns up
 * in wellbeing journalling, which those datasets cover unevenly. Treat them
 * as v1 priors: they are frozen, versioned (LEXICON_VERSION) and meant to be
 * refit against Kindred's own same-day (journal text, check-in score) pairs
 * once enough exist. Nothing downstream may mutate them at runtime.
 *
 * Dominance
 * ---------
 * Dominance is the axis most often dropped as "not worth the trouble". It is
 * kept because it is the axis that separates the two negative states this app
 * most needs to tell apart: anger/frustration (negative valence, high
 * arousal, HIGH dominance — the person still feels able to act) from
 * anxiety/helplessness (negative valence, high arousal, LOW dominance — the
 * person does not). A recommender that cannot tell those apart will offer
 * the same thing to both, which is exactly the failure the ventures layer is
 * supposed to avoid.
 *
 * Matching
 * --------
 * Entries are matched on a stemmed form (see stemToken) so "exhausted",
 * "exhausting" and "exhaustion" all reach one entry without carrying a full
 * morphological analyser. Multiword entries are matched as phrases before
 * single tokens, so "burnt out" is not read as "burnt" + "out".
 */

export const LEXICON_VERSION = "vad-lexicon-v1";

/**
 * Single-word affect norms, keyed by STEM (see stemToken below), so the key
 * "exhaust" covers exhausted/exhausting/exhaustion.
 *
 *   v: valence   -1 = maximally unpleasant, +1 = maximally pleasant
 *   a: arousal   -1 = maximally calm/deactivated, +1 = maximally activated
 *   d: dominance -1 = maximally controlled-by, +1 = maximally in-control
 */
export const VAD_LEXICON = Object.freeze({
  // ── High-valence, high-arousal ────────────────────────────────────────
  ecstat:    { v: 0.90, a: 0.80, d: 0.55 },
  thrill:    { v: 0.80, a: 0.83, d: 0.50 },
  excit:     { v: 0.75, a: 0.80, d: 0.50 },
  delight:   { v: 0.82, a: 0.55, d: 0.50 },
  joy:       { v: 0.88, a: 0.60, d: 0.55 },
  overjoy:   { v: 0.90, a: 0.70, d: 0.55 },
  elat:      { v: 0.85, a: 0.70, d: 0.55 },
  celebrat:  { v: 0.78, a: 0.62, d: 0.60 },
  energis:   { v: 0.68, a: 0.72, d: 0.60 },
  energiz:   { v: 0.68, a: 0.72, d: 0.60 },
  buzz:      { v: 0.55, a: 0.75, d: 0.40 },
  pump:      { v: 0.60, a: 0.75, d: 0.55 },
  eager:     { v: 0.60, a: 0.62, d: 0.45 },
  hope:      { v: 0.62, a: 0.35, d: 0.35 },
  happi:     { v: 0.80, a: 0.45, d: 0.50 },
  glad:      { v: 0.62, a: 0.20, d: 0.35 },
  cheer:     { v: 0.68, a: 0.40, d: 0.40 },
  pleas:     { v: 0.62, a: 0.15, d: 0.35 },
  satisfi:   { v: 0.62, a: 0.05, d: 0.45 },
  enjoy:     { v: 0.70, a: 0.30, d: 0.40 },
  cope:      { v: 0.10, a: 0.10, d: 0.30 },
  optimist:  { v: 0.68, a: 0.35, d: 0.50 },

  // ── High-valence, low-arousal (ideal-affect states) ───────────────────
  calm:      { v: 0.60, a: -0.50, d: 0.45 },
  peac:      { v: 0.72, a: -0.55, d: 0.45 },
  serene:    { v: 0.70, a: -0.60, d: 0.45 },
  relax:     { v: 0.68, a: -0.55, d: 0.45 },
  rest:      { v: 0.50, a: -0.50, d: 0.30 },
  settl:     { v: 0.48, a: -0.35, d: 0.40 },
  ground:    { v: 0.50, a: -0.30, d: 0.55 },
  steadi:    { v: 0.42, a: -0.20, d: 0.50 },
  content:   { v: 0.62, a: -0.20, d: 0.45 },
  comfort:   { v: 0.62, a: -0.30, d: 0.40 },
  safe:      { v: 0.65, a: -0.35, d: 0.45 },
  cosi:      { v: 0.62, a: -0.45, d: 0.35 },
  gentl:     { v: 0.52, a: -0.40, d: 0.25 },
  quiet:     { v: 0.28, a: -0.55, d: 0.20 },
  still:     { v: 0.25, a: -0.60, d: 0.20 },
  ease:      { v: 0.58, a: -0.40, d: 0.40 },
  soothe:    { v: 0.58, a: -0.45, d: 0.30 },
  breath:    { v: 0.30, a: -0.35, d: 0.30 },

  // ── High-valence, social / meaning ────────────────────────────────────
  grate:     { v: 0.78, a: 0.15, d: 0.35 },
  thank:     { v: 0.75, a: 0.15, d: 0.35 },
  appreci:   { v: 0.70, a: 0.10, d: 0.35 },
  bless:     { v: 0.72, a: 0.10, d: 0.25 },
  love:      { v: 0.88, a: 0.45, d: 0.40 },
  care:      { v: 0.55, a: 0.10, d: 0.30 },
  kind:      { v: 0.65, a: 0.05, d: 0.35 },
  warm:      { v: 0.62, a: 0.05, d: 0.35 },
  support:   { v: 0.62, a: 0.05, d: 0.30 },
  connect:   { v: 0.62, a: 0.20, d: 0.35 },
  belong:    { v: 0.70, a: 0.10, d: 0.35 },
  understood:{ v: 0.68, a: 0.05, d: 0.35 },
  seen:      { v: 0.45, a: 0.10, d: 0.25 },
  heard:     { v: 0.48, a: 0.05, d: 0.30 },
  laugh:     { v: 0.72, a: 0.50, d: 0.45 },
  smil:      { v: 0.70, a: 0.30, d: 0.40 },
  fun:       { v: 0.72, a: 0.50, d: 0.45 },
  friend:    { v: 0.68, a: 0.20, d: 0.35 },
  famili:    { v: 0.50, a: 0.15, d: 0.25 },

  // ── High-valence, agency / accomplishment ─────────────────────────────
  proud:     { v: 0.75, a: 0.45, d: 0.70 },
  accomplish:{ v: 0.72, a: 0.40, d: 0.70 },
  achiev:    { v: 0.72, a: 0.45, d: 0.70 },
  manag:     { v: 0.35, a: 0.10, d: 0.55 },
  progress:  { v: 0.58, a: 0.30, d: 0.60 },
  capabl:    { v: 0.60, a: 0.20, d: 0.72 },
  confid:    { v: 0.65, a: 0.35, d: 0.75 },
  strong:    { v: 0.58, a: 0.35, d: 0.72 },
  focus:     { v: 0.40, a: 0.35, d: 0.62 },
  productiv: { v: 0.52, a: 0.35, d: 0.62 },
  finish:    { v: 0.45, a: 0.20, d: 0.60 },
  win:       { v: 0.72, a: 0.55, d: 0.68 },
  reliev:    { v: 0.55, a: -0.20, d: 0.35 },
  better:    { v: 0.50, a: 0.05, d: 0.40 },
  improv:    { v: 0.55, a: 0.15, d: 0.50 },
  good:      { v: 0.58, a: 0.10, d: 0.35 },
  great:     { v: 0.72, a: 0.35, d: 0.45 },
  nice:      { v: 0.55, a: 0.05, d: 0.30 },
  okay:      { v: 0.15, a: -0.05, d: 0.15 },
  fine:      { v: 0.18, a: -0.05, d: 0.15 },
  alright:   { v: 0.20, a: -0.05, d: 0.18 },
  decent:    { v: 0.32, a: 0.00, d: 0.25 },
  balanc:    { v: 0.45, a: -0.15, d: 0.45 },
  light:     { v: 0.48, a: 0.10, d: 0.30 },
  bright:    { v: 0.60, a: 0.30, d: 0.35 },
  beauti:    { v: 0.78, a: 0.25, d: 0.30 },
  wonder:    { v: 0.75, a: 0.35, d: 0.35 },
  lucki:     { v: 0.62, a: 0.25, d: 0.20 },
  amazing:   { v: 0.82, a: 0.58, d: 0.45 },
  amaz:      { v: 0.82, a: 0.58, d: 0.45 },
  awesome:   { v: 0.78, a: 0.55, d: 0.45 },
  fantastic: { v: 0.82, a: 0.58, d: 0.48 },
  brilliant: { v: 0.76, a: 0.42, d: 0.52 },
  perfect:   { v: 0.80, a: 0.38, d: 0.58 },

  // ── Low-valence, deactivated (depressive cluster) ─────────────────────
  sad:       { v: -0.72, a: -0.30, d: -0.45 },
  unhappi:   { v: -0.68, a: -0.20, d: -0.40 },
  depress:   { v: -0.82, a: -0.45, d: -0.70 },
  miser:     { v: -0.82, a: -0.15, d: -0.60 },
  down:      { v: -0.52, a: -0.35, d: -0.40 },
  low:       { v: -0.45, a: -0.35, d: -0.35 },
  blue:      { v: -0.48, a: -0.35, d: -0.35 },
  heavi:     { v: -0.55, a: -0.30, d: -0.45 },
  empti:     { v: -0.70, a: -0.40, d: -0.55 },
  hollow:    { v: -0.68, a: -0.40, d: -0.55 },
  numb:      { v: -0.58, a: -0.65, d: -0.55 },
  flat:      { v: -0.42, a: -0.60, d: -0.35 },
  bleak:     { v: -0.72, a: -0.30, d: -0.55 },
  hopeless:  { v: -0.88, a: -0.20, d: -0.85 },
  worthless: { v: -0.90, a: -0.15, d: -0.85 },
  useless:   { v: -0.78, a: -0.10, d: -0.75 },
  pointless: { v: -0.75, a: -0.25, d: -0.70 },
  meaningless:{v: -0.75, a: -0.30, d: -0.70 },
  cri:       { v: -0.62, a: 0.25, d: -0.55 },
  tear:      { v: -0.58, a: 0.15, d: -0.50 },
  grief:     { v: -0.82, a: 0.10, d: -0.60 },
  griev:     { v: -0.82, a: 0.10, d: -0.60 },
  mourn:     { v: -0.78, a: 0.00, d: -0.55 },
  loss:      { v: -0.68, a: 0.00, d: -0.55 },
  lone:      { v: -0.72, a: -0.20, d: -0.60 },
  loneli:    { v: -0.75, a: -0.20, d: -0.62 },
  isol:      { v: -0.70, a: -0.20, d: -0.60 },
  lonesom:   { v: -0.70, a: -0.20, d: -0.58 },
  abandon:   { v: -0.80, a: 0.15, d: -0.72 },
  reject:    { v: -0.72, a: 0.25, d: -0.62 },
  unwant:    { v: -0.75, a: 0.00, d: -0.68 },
  invisibl:  { v: -0.55, a: -0.25, d: -0.55 },
  disappoint:{ v: -0.58, a: -0.05, d: -0.40 },
  regret:    { v: -0.60, a: 0.05, d: -0.45 },
  guilti:    { v: -0.65, a: 0.25, d: -0.55 },
  asham:     { v: -0.72, a: 0.30, d: -0.68 },
  shame:     { v: -0.75, a: 0.30, d: -0.70 },
  embarrass: { v: -0.52, a: 0.40, d: -0.50 },
  failur:    { v: -0.78, a: 0.10, d: -0.70 },
  fail:      { v: -0.65, a: 0.10, d: -0.55 },
  lost:      { v: -0.55, a: 0.05, d: -0.55 },
  stuck:     { v: -0.55, a: 0.00, d: -0.60 },
  trap:      { v: -0.68, a: 0.30, d: -0.75 },
  helpless:  { v: -0.78, a: 0.20, d: -0.85 },
  powerless: { v: -0.75, a: 0.10, d: -0.88 },
  defeat:    { v: -0.70, a: -0.15, d: -0.68 },
  giv:       { v: -0.30, a: -0.15, d: -0.35 }, // "gave up", "giving up"
  broken:    { v: -0.72, a: 0.00, d: -0.62 },
  hurt:      { v: -0.65, a: 0.25, d: -0.50 },
  ach:       { v: -0.52, a: 0.00, d: -0.40 },
  ignor:     { v: -0.50, a: 0.10, d: -0.45 },
  upset:     { v: -0.60, a: 0.40, d: -0.40 },
  awfu:      { v: -0.72, a: 0.35, d: -0.45 },
  awful:     { v: -0.72, a: 0.35, d: -0.45 },
  terribl:   { v: -0.72, a: 0.40, d: -0.45 },
  horribl:   { v: -0.75, a: 0.45, d: -0.48 },
  dreadfu:   { v: -0.72, a: 0.40, d: -0.50 },
  dreadful:  { v: -0.72, a: 0.40, d: -0.50 },
  suck:      { v: -0.55, a: 0.32, d: -0.25 },
  lousi:     { v: -0.52, a: 0.05, d: -0.35 },
  worst:     { v: -0.75, a: 0.30, d: -0.45 },
  bad:       { v: -0.52, a: 0.15, d: -0.30 },
  struggl:   { v: -0.55, a: 0.35, d: -0.45 },
  difficult: { v: -0.45, a: 0.25, d: -0.35 },
  hard:      { v: -0.32, a: 0.30, d: -0.20 },
  uncomfort: { v: -0.45, a: 0.30, d: -0.35 },

  // ── Low-valence, deactivated (fatigue cluster) ────────────────────────
  tire:      { v: -0.35, a: -0.60, d: -0.25 },
  exhaust:   { v: -0.60, a: -0.55, d: -0.45 },
  drain:     { v: -0.58, a: -0.60, d: -0.45 },
  weari:     { v: -0.52, a: -0.55, d: -0.35 },
  deplet:    { v: -0.58, a: -0.62, d: -0.45 },
  sleepi:    { v: -0.10, a: -0.70, d: -0.10 },
  foggi:     { v: -0.35, a: -0.45, d: -0.40 },
  groggi:    { v: -0.35, a: -0.50, d: -0.30 },
  burnout:   { v: -0.72, a: -0.35, d: -0.60 },
  sluggish:  { v: -0.38, a: -0.58, d: -0.28 },
  lethargi:  { v: -0.45, a: -0.68, d: -0.40 },
  insomnia:  { v: -0.55, a: 0.35, d: -0.50 },

  // ── Low-valence, activated (anxiety cluster: LOW dominance) ───────────
  anxious:   { v: -0.60, a: 0.68, d: -0.55 },
  anxieti:   { v: -0.62, a: 0.68, d: -0.58 },
  worri:     { v: -0.55, a: 0.50, d: -0.45 },
  nervous:   { v: -0.45, a: 0.65, d: -0.42 },
  panic:     { v: -0.78, a: 0.88, d: -0.72 },
  dread:     { v: -0.72, a: 0.55, d: -0.62 },
  fear:      { v: -0.70, a: 0.70, d: -0.65 },
  afraid:    { v: -0.68, a: 0.65, d: -0.62 },
  scare:     { v: -0.65, a: 0.72, d: -0.62 },
  terrifi:   { v: -0.82, a: 0.88, d: -0.78 },
  tens:      { v: -0.48, a: 0.60, d: -0.30 },
  uneasi:    { v: -0.45, a: 0.42, d: -0.40 },
  restless:  { v: -0.35, a: 0.62, d: -0.30 },
  jitteri:   { v: -0.40, a: 0.70, d: -0.35 },
  spiral:    { v: -0.65, a: 0.65, d: -0.70 },
  overthink: { v: -0.48, a: 0.52, d: -0.50 },
  ruminat:   { v: -0.52, a: 0.40, d: -0.55 },
  overwhelm: { v: -0.70, a: 0.65, d: -0.70 },
  stress:    { v: -0.58, a: 0.65, d: -0.45 },
  pressur:   { v: -0.48, a: 0.55, d: -0.45 },
  rush:      { v: -0.25, a: 0.62, d: -0.20 },
  frantic:   { v: -0.55, a: 0.80, d: -0.50 },
  chaotic:   { v: -0.45, a: 0.70, d: -0.55 },
  uncertain: { v: -0.35, a: 0.30, d: -0.45 },
  confus:    { v: -0.38, a: 0.30, d: -0.45 },
  doubt:     { v: -0.42, a: 0.25, d: -0.45 },
  insecur:   { v: -0.55, a: 0.35, d: -0.60 },

  // ── Low-valence, activated (anger cluster: HIGH dominance) ────────────
  angri:     { v: -0.62, a: 0.68, d: 0.35 },
  anger:     { v: -0.62, a: 0.68, d: 0.35 },
  furious:   { v: -0.72, a: 0.85, d: 0.42 },
  rage:      { v: -0.75, a: 0.88, d: 0.45 },
  mad:       { v: -0.55, a: 0.65, d: 0.30 },
  irritat:   { v: -0.48, a: 0.50, d: 0.25 },
  annoy:     { v: -0.45, a: 0.48, d: 0.22 },
  frustrat:  { v: -0.58, a: 0.58, d: 0.10 },
  resent:    { v: -0.62, a: 0.42, d: 0.20 },
  bitter:    { v: -0.62, a: 0.30, d: 0.15 },
  fed:       { v: -0.50, a: 0.40, d: 0.10 }, // "fed up"
  sick:      { v: -0.55, a: 0.25, d: -0.20 },
  hate:      { v: -0.78, a: 0.70, d: 0.25 },
  unfair:    { v: -0.58, a: 0.45, d: -0.20 },

  // ── Body / somatic (see cultural-calibration.js for phrase-level) ─────
  pain:      { v: -0.70, a: 0.35, d: -0.55 },
  nausea:    { v: -0.62, a: 0.30, d: -0.50 },
  headach:   { v: -0.55, a: 0.20, d: -0.40 },
  dizzi:     { v: -0.45, a: 0.35, d: -0.50 },
  appetit:   { v: -0.15, a: -0.10, d: -0.15 },

  // ── Neutral-ish content that still carries mild affect ────────────────
  busi:      { v: -0.10, a: 0.45, d: 0.15 },
  normal:    { v: 0.10, a: -0.10, d: 0.15 },
  same:      { v: -0.05, a: -0.20, d: -0.05 },
  routin:    { v: 0.05, a: -0.25, d: 0.15 },
  slow:      { v: -0.05, a: -0.45, d: 0.00 },
  strang:    { v: -0.15, a: 0.25, d: -0.20 },
  weird:     { v: -0.12, a: 0.25, d: -0.15 },
  bore:      { v: -0.40, a: -0.50, d: -0.20 },
  meh:       { v: -0.25, a: -0.35, d: -0.15 },
});

/**
 * Multiword entries, matched as phrases BEFORE single tokens so their
 * component words are not double counted. Keyed by the literal lowercase
 * phrase; internal whitespace is matched flexibly.
 */
export const VAD_PHRASES = Object.freeze({
  "burnt out":        { v: -0.72, a: -0.35, d: -0.60 },
  "burned out":       { v: -0.72, a: -0.35, d: -0.60 },
  "worn out":         { v: -0.58, a: -0.55, d: -0.40 },
  "wiped out":        { v: -0.55, a: -0.60, d: -0.40 },
  "fed up":           { v: -0.55, a: 0.45, d: 0.10 },
  "gave up":          { v: -0.62, a: -0.20, d: -0.65 },
  "giving up":        { v: -0.65, a: -0.15, d: -0.70 },
  "give up":          { v: -0.55, a: -0.10, d: -0.60 },
  "let down":         { v: -0.58, a: 0.05, d: -0.45 },
  "on edge":          { v: -0.50, a: 0.70, d: -0.40 },
  "at peace":         { v: 0.72, a: -0.55, d: 0.45 },
  "small win":        { v: 0.55, a: 0.30, d: 0.55 },
  "proud of myself":  { v: 0.78, a: 0.45, d: 0.75 },
  "looking forward":  { v: 0.58, a: 0.35, d: 0.40 },
  "can't be bothered":{ v: -0.45, a: -0.50, d: -0.35 },
  "cant be bothered": { v: -0.45, a: -0.50, d: -0.35 },
  "no energy":        { v: -0.55, a: -0.65, d: -0.45 },
  "too much":         { v: -0.48, a: 0.45, d: -0.50 },
  "held it together": { v: 0.20, a: 0.25, d: 0.35 },
  "fell apart":       { v: -0.72, a: 0.50, d: -0.72 },
  "shut down":        { v: -0.58, a: -0.45, d: -0.55 },
  "keep going":       { v: 0.15, a: 0.25, d: 0.35 },
  "showed up":        { v: 0.35, a: 0.15, d: 0.45 },
  "got through":      { v: 0.30, a: 0.10, d: 0.45 },
  "finally passed":   { v: 0.64, a: 0.42, d: 0.62 },
  "failed again":     { v: -0.68, a: 0.30, d: -0.58 },
});

/**
 * Intensifiers and downtoners, as MULTIPLIERS on the affect magnitude of the
 * term they modify. Values follow the standard valence-shifter convention
 * (Polanyi & Zaenen 2006; Taboada et al. 2011): intensifiers above 1,
 * downtoners below 1, applied to whichever lexicon term follows within
 * MODIFIER_WINDOW tokens.
 */
export const INTENSIFIERS = Object.freeze({
  extremely: 1.8, incredibly: 1.75, unbelievably: 1.75, insanely: 1.7,
  absolutely: 1.6, completely: 1.6, totally: 1.55, utterly: 1.6,
  really: 1.4, very: 1.45, so: 1.35, super: 1.45, deeply: 1.5, genuinely: 1.3,
  terribly: 1.55, awfully: 1.5, horribly: 1.6, incredibly_: 1.7,
  damn: 1.45, fucking: 1.65, freaking: 1.5, fcking: 1.6, fkn: 1.6,
  deadass: 1.45, highkey: 1.35, sibei: 1.55,
  quite: 1.15, pretty: 1.15, rather: 1.1, fairly: 1.05,
  slightly: 0.55, somewhat: 0.7, mildly: 0.6, marginally: 0.5,
  barely: 0.4, hardly: 0.4, kinda: 0.65, sorta: 0.65,
  little: 0.6, bit: 0.6, touch: 0.65, tad: 0.55,
});

/**
 * Negators. A negator flips AND attenuates the following term's valence
 * (SHIFTED negation, Taboada et al. 2011): "not happy" is not as negative as
 * "miserable", it is a weakened negative. NEGATION_FLIP below is that
 * attenuation factor.
 */
export const NEGATORS = Object.freeze([
  "not", "no", "never", "none", "nobody", "nothing", "nowhere", "neither",
  "cannot", "cant", "couldnt", "didnt", "doesnt", "dont", "isnt", "wasnt",
  "arent", "werent", "wont", "wouldnt", "havent", "hasnt", "hadnt", "aint",
  "without", "lack", "lacking", "hardly", "barely", "scarcely",
]);

/** How far back from a lexicon hit a negator or intensifier may sit. */
export const MODIFIER_WINDOW = 3;

/** Valence multiplier applied to a negated term (sign flipped, magnitude cut). */
export const NEGATION_FLIP = -0.7;
/** Arousal/dominance are attenuated but NOT flipped by negation. */
export const NEGATION_ATTENUATE = 0.6;

/**
 * Clause boundaries that block a negator or intensifier from reaching across
 * them ("I'm not tired, but I am sad" must not negate "sad").
 */
export const CLAUSE_BREAKERS = Object.freeze(["but", "however", "though", "although", "yet", "still", "except", "while", "whereas"]);

/**
 * Temporal orientation markers. Journalling that is dominated by past
 * reference is associated with rumination; future reference with either
 * planning (with agency words) or anticipatory anxiety (with anxiety words).
 * The module reports the raw counts and a ratio; it does NOT itself claim
 * which of those two a future-heavy entry is.
 */
export const TEMPORAL_MARKERS = Object.freeze({
  past: [
    "yesterday", "last night", "last week", "last month", "last year",
    "used to", "back then", "before", "ago", "was", "were", "had", "did",
    "remember", "recalled", "childhood", "previously", "earlier",
  ],
  present: [
    "today", "right now", "currently", "this morning", "this afternoon",
    "this evening", "tonight", "at the moment", "these days", "now",
  ],
  future: [
    "tomorrow", "next week", "next month", "next year", "will", "going to",
    "gonna", "soon", "later", "upcoming", "plan to", "planning", "hope to",
    "afraid that", "what if", "eventually", "someday",
  ],
});

/**
 * Agency markers. These adjust DOMINANCE directly rather than through the
 * word lexicon, because the agency in "I decided to stop" lives in the
 * construction, not in any single affect-bearing word.
 */
export const AGENCY_MARKERS = Object.freeze({
  high: [
    "i decided", "i chose", "i managed", "i made myself", "i pushed through",
    "i handled", "i sorted", "i set a boundary", "i said no", "i asked for",
    "i took a break", "i reached out", "i got up", "i finished",
  ],
  low: [
    "i couldn't", "i couldnt", "i had to", "i have to", "i was forced",
    "nothing i can do", "nothing i could do", "out of my hands",
    "no choice", "no control", "it just happened", "i gave in",
  ],
});

/** Dominance nudge per matched agency marker, capped by AGENCY_CAP. */
export const AGENCY_STEP = 0.18;
export const AGENCY_CAP = 0.45;

const PHRASE_KEYS = Object.freeze(Object.keys(VAD_PHRASES).sort((a, b) => b.length - a.length));
export { PHRASE_KEYS };

/**
 * A deliberately small, rule-based suffix stripper. This is NOT Porter: a
 * full stemmer over-stems ("caring" -> "care" is wanted, but "during" ->
 * "dure" is not) and every mis-stem here silently changes a score. The rules
 * below are the ones needed by the vocabulary actually in VAD_LEXICON, and
 * the function is exported so tests can pin its behaviour.
 */
export function stemToken(word) {
  let w = word.toLowerCase().replace(/['’]/g, "");
  if (w.length <= 3) return w;
  // Order matters: longest, most specific suffixes first.
  const rules = [
    [/ness$/, ""], [/ments$/, ""], [/ment$/, ""],
    [/ingly$/, ""], [/edly$/, ""],
    [/ations?$/, ""], [/ions?$/, ""],
    [/iness$/, "i"], [/ies$/, "i"], [/ied$/, "i"], [/ily$/, "i"],
    [/ously$/, "ous"], [/ally$/, "al"],
    [/fully$/, ""], [/ful$/, ""],
    [/ing$/, ""], [/ed$/, ""], [/es$/, ""], [/s$/, ""],
    [/ly$/, ""], [/er$/, ""], [/est$/, ""],
  ];
  for (const [re, rep] of rules) {
    if (re.test(w) && w.replace(re, rep).length >= 3) {
      w = w.replace(re, rep);
      break;
    }
  }
  // Undo doubled final consonants left by -ing/-ed stripping ("stopp" -> "stop").
  w = w.replace(/([bdgklmnprt])\1$/, "$1");
  // Final y -> i, applied unconditionally so "cry" and "crying" both reach
  // the same key ("cri"). Harmless on non-lexicon words.
  w = w.replace(/y$/, "i");
  return w;
}

/**
 * Look a token up in VAD_LEXICON, trying the surface form first and the stem
 * second. Returns null when the word carries no affect norm.
 */
export function lookupToken(word) {
  const raw = word.toLowerCase().replace(/['’]/g, "");
  const stem = stemToken(raw);
  // Tried in order: the surface form (so irregulars like "anxious", which the
  // -s rule would wreck, win before stemming), then the stem, then the stem
  // with a restored or removed final "e" ("tired" -> "tir" -> "tire";
  // "peaceful" -> "peace" -> "peac").
  const candidates = [raw, stem, `${stem}e`, stem.replace(/e$/, ""), `${stem}at`];
  for (const key of candidates) {
    if (key.length >= 3 && VAD_LEXICON[key]) return { key, ...VAD_LEXICON[key] };
  }
  return null;
}
