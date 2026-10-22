/**
 * journal-ai.js — The emotional heart of Kindred
 *
 * The model is free to name whatever emotion it actually reads, rather than
 * being forced into a preset category. Every AI call goes through lib/groq.js;
 * when no API key is configured companion prose is unavailable rather than
 * presented as if a model had written it.
 */

import { groqChat, hasGroqKey, warnIfNoKey, parseJsonFromCompletion } from "./groq.js";
import { detectCrisisLanguage, detectCrisisInConversation, crisisResourcesText, CRISIS_RESPONSE } from "./analysis/crisis-detection.js";

/** Fixed, reviewed crisis copy plus the real resource numbers as a second message. */
function crisisReply(matched = [], conversationState) {
  const messages = [CRISIS_RESPONSE.text, crisisResourcesText()];
  return { text: messages.join("\n\n"), messages, source: "crisis-safety", emotion: "anxious",
    isCrisisResponse: true, resources: CRISIS_RESPONSE.resources, crisisMatched: matched, conversationState };
}
import { analyseText } from "./analysis/text-features.js";
import { vadToEmotionDirectional } from "./analysis/emotion-space.js";
import { formatCompanionStrategy, selectCompanionStrategy, validateCompanionResponse } from "./analysis/response-strategy.js";
import { deriveInterpretiveEmotion } from "./analysis/thought-appraisal.js";
import {
  buildConversationResponsePlan,
  formatConversationResponsePlan,
  localInitialReflection,
  validateConversationReply,
  simplifyStackedQuestion,
} from "./analysis/conversation-response.js";
import { formatRetrievedMemories, retrieveConversationMemories } from "./analysis/conversation-memory.js";
import { buildExperienceProfile, formatExperienceProfile } from "./analysis/experience-profile.js";
import { normaliseCompanionStyle, softenCasualWording, stripUnmatchedEmoji, narratesFeelingFormally } from "./analysis/companion-style.js";
import { discourseThreadCoverage } from "./analysis/discourse-model.js";
import { buildVoiceProfile, mergeHistoricalVoice, analyseEngagement } from "./analysis/conversation-guidance.js";
import { resolvePersonalMemory, retrievePersonalContext, formatPersonalContext } from "./analysis/personal-memory.js";
import { understandConversation, applySemanticConversation, reviewConversationalProgress, compactConversationKnowledge, compactJournalText } from "./analysis/semantic-conversation.js";
import { updateDebriefState, responseContract, fallbackDebriefState } from "./analysis/dialogue-policy.js";
import { lexiconReadings, storableInterpretation } from "./analysis/interpretation.js";
import { entryEmotionProfile } from "./analysis/emotion-profile.js";
import { termReadingsFrom } from "./analysis/term-learning.js";
import { dueLoops, validateFollowUps } from "./analysis/open-loops.js";
import { wellbeingContextFor } from "./analysis/wellbeing-context.js";
import { chooseMove, landingMove, QUESTION_MOVES, DESCRIBE, speaksAsUser } from "./analysis/processing-moves.js";
import { classifyTurnAct } from "./analysis/turn-act.js";
import { buildWriterMessages, wordCap } from "./analysis/writer-prompt.js";
import { selectReply, parseDrafts, SOFT_REASONS, tightenReply } from "./analysis/reply-selection.js";
const RANK_SOFT_REASONS = new Set([...SOFT_REASONS, 'reply-closes-after-brief-answer']);

// ── Subtext Detection Patterns ────────────────────────────────────────────────

const MASKING = [
  /\bi'?m fine\b/i,
  /\bi'?m okay\b/i,
  /\bit'?s (okay|ok|fine|alright)\b/i,
  /\b(i )?guess (so|i'?m|it'?s)\b/i,
  /\bwhatever\b/i,
  /\bnot that bad\b/i,
  /\bcould (be|have been) worse\b/i,
  /\bnothing (special|much|really|new)\b/i,
  /\bsame (old|as (always|usual))\b/i,
  /\bdon'?t (really )?want to (talk|think) about it\b/i,
  /\bforget (it|about it)\b/i,
];

const HOPELESSNESS = [
  /\balways (like this|happens|this way|going to be)\b/i,
  /\bnothing (ever |will )?(changes?|works?|matters?|helps?|gets? better)\b/i,
  /\bwhat'?s the point\b/i,
  /\bdoesn'?t (even )?matter\b/i,
  /\bnever (gets?|going to|gonna|be able)\b/i,
  /\bforever (like this|alone|stuck|this way)\b/i,
  /\bgive up\b/i,
  /\bno point\b/i,
  /\bwhat'?s wrong with me\b/i,
  /\bcan'?t see (a way|any|anything) (out|forward|through)\b/i,
];

const ISOLATION = [
  /\b(all |completely |totally )alone\b/i,
  /\bno one (cares?|understands?|gets? it|is there|knows?)\b/i,
  /\bnobody (knows?|sees?|understands?|cares?)\b/i,
  /\bby (my)?self\b/i,
  /\bdon'?t belong\b/i,
  /\b(feel|am) invisible\b/i,
  /\bunheard\b/i,
  /\bmissed by nobody\b/i,
];

const PHYSICAL_STRUGGLE = [
  /\bcan'?t get out of bed\b/i,
  /\bno energy (to|for)\b/i,
  /\bcan'?t stop (crying|shaking|thinking)\b/i,
  /\bhaven'?t (eaten|slept|moved|left)\b/i,
  /\bstuck (in bed|at home|inside)\b/i,
  /\bweight (on|in) my (chest|body|heart)\b/i,
];

const EMOTIONAL_WEIGHT = {
  depression: [
    /\bempty\b/, /\bnumb\b/, /\bworthless\b/, /\bhopeless\b/,
    /\bcan'?t feel\b/, /\bcan'?t enjoy\b/, /\bcan'?t care\b/,
    /\bpoint(less)?\b/, /\bwhat'?s the use\b/,
  ],
  anxiety: [
    /\bcan'?t stop thinking\b/i, /\bwhat if\b/i,
    /\boverthink(ing)?\b/i, /\bspiral(ling)?\b/i,
    /\bscared that\b/i, /\bworry(ing)? about\b/i,
    /\bcan'?t calm (down|myself)\b/i, /\bpanic(king)?\b/i,
  ],
  grief: [
    /\bmiss (them|you|him|her|it|that)\b/i,
    /\bwish (things?|they|he|she|it|we)\b/i,
    /\bnot the same (without|anymore)\b/i,
    /\bleft (me|behind|alone)\b/i,
  ],
  overwhelm: [
    /\btoo much\b/i, /\bcan'?t handle\b/i, /\bfall apart\b/i,
    /\beverything at once\b/i, /\bcrumbling\b/i, /\bbreaking point\b/i,
    /\bdon'?t know (how|where) to start\b/i,
  ],
};

const POSITIVE_SUBTEXT = [
  /\b(finished|completed|accomplished|achieved)\b/i,
  /\b(productive|made progress|got through)\b/i,
  /\b(proud of|happy with) (myself|how|that)\b/i,
  /\b(finally|actually) did\b/i,
  /\bsmall win\b/i,
];

// ── EmotionDetector ───────────────────────────────────────────────────────────

export class EmotionDetector {
  /**
   * Deep contextual analysis of a journal entry.
   * Returns enriched emotion data including subtext signals and trajectory.
   */
  analyze(text, pastEntries = []) {
    const signals   = this._extractSignals(text);
    const features  = analyseText(text);
    const projected = vadToEmotionDirectional(features.vad);
    const interpreted = deriveInterpretiveEmotion(features, projected.emotion);
    const experienceProfile = buildExperienceProfile(features, text);
    const hasDeterministicEvidence = features.vadConfidence > 0;

    // The mathematical VAD model is authoritative whenever it has evidence.
    // The legacy keyword/subtext rules remain only as a genuine no-evidence
    // fallback; otherwise they could erase dialect particles and culturally
    // encoded understatement that the deterministic model explicitly found.
    const fallback  = this._resolveEmotion(signals, text, this._baseKeywordScan(text));
    const resolved  = hasDeterministicEvidence
      ? {
          emotion: interpreted.emotion,
          emotionFamily: interpreted.family,
          confidence: Math.round(45 + 50 * features.vadConfidence),
          overrideReason: features.maskedDistress
            ? "deterministic masked-distress reading"
            : features.dialectVariety
              ? `deterministic ${features.dialectVariety} reading`
              : "deterministic VAD reading",
        }
      : fallback;
    const trajectory = this._computeTrajectory(pastEntries);

    return {
      emotion:           resolved.emotion,
      confidence:        resolved.confidence,
      signals,
      trajectory,
      maskingDetected:   signals.masking.length > 0,
      subtextSummary:    this._buildSubtextSummary(signals),
      overrideReason:    resolved.overrideReason,
      needsVerification: signals.masking.length > 0 || resolved.confidence < 68,
      source:             hasDeterministicEvidence ? "deterministic" : "keyword-fallback",
      vad:                features.vad,
      vadConfidence:      features.vadConfidence,
      textFeatures:       features,
      emotionFamily:      resolved.emotionFamily ?? projected.emotion,
      experienceProfile,
    };
  }

  _extractSignals(text) {
    const scan = (patterns) => patterns.filter(p => p.test(text));

    const signals = {
      masking:         scan(MASKING),
      hopelessness:    scan(HOPELESSNESS),
      isolation:       scan(ISOLATION),
      physicalStruggle: scan(PHYSICAL_STRUGGLE),
      emotionalWeight: {},
      positiveSubtext: POSITIVE_SUBTEXT.some(p => p.test(text)),
      contradiction:   false,
      minimizing:      /\b(just|only|a bit|kind of|sort of|slightly|a little)\b/i.test(text),
    };

    for (const [cat, patterns] of Object.entries(EMOTIONAL_WEIGHT)) {
      signals.emotionalWeight[cat] = patterns.filter(p => p.test(text)).length;
    }

    // Contradiction: positive self-report followed by a contradicting conjunction
    if (/\b(fine|okay|good|great|happy)\b/i.test(text) &&
        /\b(but|although|however|though|still|yet|except)\b/i.test(text)) {
      signals.contradiction = true;
    }

    return signals;
  }

  _resolveEmotion(signals, text, base) {
    let { emotion, confidence } = base;
    let overrideReason = null;

    const { emotionalWeight: ew, masking, hopelessness, isolation } = signals;
    const depScore  = ew.depression || 0;
    const anxScore  = ew.anxiety    || 0;
    const overwhelm = ew.overwhelm  || 0;
    const grief     = ew.grief      || 0;

    // Strong depression signals override positive/neutral self-report
    if (depScore >= 2 && ["calm", "content", "neutral"].includes(emotion)) {
      emotion = "sad"; confidence = 74; overrideReason = "deep sadness beneath the surface";
    }

    // Masking + hopelessness = understating how they feel
    if (masking.length >= 2 && hopelessness.length > 0) {
      emotion = "sad"; confidence = 80; overrideReason = "masking with hopeless undertones";
    } else if (masking.length >= 1 && hopelessness.length >= 1) {
      emotion = emotion === "content" ? "sad" : emotion;
      confidence = Math.max(confidence, 68);
      overrideReason = overrideReason || "possible masking";
    }

    // Anxiety/overwhelm overrides
    if (anxScore >= 2 || overwhelm >= 2) {
      emotion = "anxious"; confidence = 76; overrideReason = "anxiety and overwhelm signals";
    }

    // Isolation pushes toward sad
    if (isolation.length >= 2 && emotion === "neutral") {
      emotion = "sad"; confidence = 70; overrideReason = "feelings of isolation";
    }

    // Grief
    if (grief >= 2 && !["sad", "anxious"].includes(emotion)) {
      emotion = "sad"; confidence = 72; overrideReason = "grief undertones";
    }

    // Contradiction: "fine BUT..." — analyze what comes after the conjunction
    if (signals.contradiction && masking.length > 0) {
      const afterConj = text.match(/(?:but|although|however|though|still)\s+(.+)/i);
      if (afterConj) {
        const afterScan = this._baseKeywordScan(afterConj[1]);
        if (afterScan.confidence > 50 && afterScan.emotion !== "neutral") {
          emotion = afterScan.emotion;
          confidence = Math.max(confidence, 68);
          overrideReason = "contradiction between stated feeling and emotional truth";
        }
      }
    }

    // Positive subtext boost for undecided entries
    if (signals.positiveSubtext && confidence < 62) {
      emotion = emotion === "neutral" ? "content" : emotion;
      confidence = Math.max(confidence, 62);
    }

    return { emotion, confidence, overrideReason };
  }

  _baseKeywordScan(text) {
    const t     = text.toLowerCase();
    const words = t.split(/\s+/);
    const NEGATORS = new Set(["not", "never", "barely", "hardly", "isn't", "wasn't", "don't", "didn't", "can't", "no", "without"]);

    const LEXICON = {
      happy:    ["happy", "joyful", "wonderful", "love", "smile", "bright", "elated", "glad", "cheerful", "sunshine", "light", "beaming"],
      excited:  ["excited", "thrilled", "pumped", "energized", "electric", "spark", "alive", "buzzing", "can't wait", "stoked"],
      calm:     ["calm", "peaceful", "settled", "grounded", "quiet", "still", "ease", "gentle", "serene", "centered", "balanced"],
      anxious:  ["anxious", "worried", "nervous", "stress", "tense", "uneasy", "overwhelm", "panic", "dread", "spiral", "overthink", "restless"],
      sad:      ["sad", "cry", "tears", "unhappy", "grief", "lonely", "hurt", "broken", "heavy", "low", "empty", "blue", "lost", "hollow", "numb", "depressed"],
      tired:    ["tired", "exhausted", "drained", "foggy", "sleepy", "burnt out", "flat", "weary", "depleted", "done"],
      angry:    ["angry", "furious", "irritated", "annoyed", "frustrated", "resentful", "mad", "rage", "bitter"],
      content:  ["content", "satisfied", "okay", "fine", "alright", "comfortable", "decent", "steady"],
      grateful: ["grateful", "thankful", "appreciate", "blessed", "lucky", "fortunate", "touched", "moved"],
    };

    const scores = Object.fromEntries(Object.keys(LEXICON).map(k => [k, 0]));

    for (const [emotion, terms] of Object.entries(LEXICON)) {
      for (const term of terms) {
        if (!t.includes(term)) continue;
        const idx = words.findIndex(w => w.startsWith(term.split(" ")[0]));
        const negated = idx > 0 && NEGATORS.has(words[idx - 1]);
        scores[emotion] += negated ? -1 : (term.length > 7 ? 2 : 1);
      }
    }

    const sorted  = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [top]   = sorted;
    const emotion = top && top[1] > 0 ? top[0] : "neutral";
    const confidence = Math.min(88, Math.max(48, 48 + Math.round((top?.[1] || 0) * 10)));

    return { emotion, confidence };
  }

  _computeTrajectory(pastEntries) {
    if (!pastEntries || pastEntries.length < 2) {
      return { trend: "unknown", label: "Your story is just beginning" };
    }

    const recent = pastEntries.slice(0, 6);
    const scores = recent.map(e => getWellnessScore(e.emotion));

    // Recent entries come first — split into "now" and "then" halves
    const half      = Math.ceil(scores.length / 2);
    const nowScores  = scores.slice(0, half);
    const thenScores = scores.slice(half);
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const diff = avg(nowScores) - avg(thenScores);

    if (Math.abs(diff) < 1) return { trend: "stable",    label: "Holding steady",            nowAvg: avg(nowScores) };
    if (diff > 0)           return { trend: "improving",  label: "Finding your footing again", nowAvg: avg(nowScores) };
    return                         { trend: "declining",  label: "A harder stretch lately",    nowAvg: avg(nowScores) };
  }

  _buildSubtextSummary(signals) {
    const parts = [];
    if (signals.masking.length > 0)              parts.push("masking language");
    if (signals.hopelessness.length > 0)          parts.push("hopeless undertones");
    if (signals.isolation.length > 0)             parts.push("isolation signals");
    if (signals.contradiction)                    parts.push("contradiction between words and tone");
    if ((signals.emotionalWeight.grief || 0) > 0) parts.push("grief");
    if ((signals.emotionalWeight.overwhelm||0)>0) parts.push("overwhelm");
    if (signals.positiveSubtext)                  parts.push("accomplishment signals");
    return parts.join(", ") || "no strong subtext";
  }
}

// ── AIJournalist ──────────────────────────────────────────────────────────────

export class AIJournalist {
  async generateResponse(text, analysis, pastEntries = [], playerName = "friend", hints = {}) {
    // Safety first: crisis language routes to fixed, reviewed human-resources
    // copy and NEVER reaches the model — no clinical term is ever generated.
    const crisisCheck = detectCrisisLanguage(text);
    if (crisisCheck.isCrisis) return crisisReply(crisisCheck.matched);
    // Opening and follow-up now use the same contextual generation pipeline.
    // A failed opening is surfaced to the UI for an explicit retry.
    const result = await this.generateChatReply(text, [], text, analysis?.emotion, playerName, pastEntries, { returnDetails: true, personalMemory: hints.personalMemory, ageBand: hints.ageBand, senseOpts: hints.senseOpts });
    return { ...result, source: 'groq', emotion: result.affect?.label || analysis?.emotion || 'hard to name' };
  }

  /**
   * Cultural-calibration hints (from cultural-calibration.js + text-features.js
   * via src/lib/analysis) folded into the system prompt as grounding notes,
   * not instructions to fabricate anything — these only stop the model from
   * misreading culturally-specific signal the way a naive Western-normed
   * reader would.
   */
  _culturalNote(hints = {}) {
    const notes = [];
    if (hints.somaticDistress) {
      notes.push("This entry contains body-language phrases (e.g. tight chest, can't sleep, thinking too much). Read these as emotional distress signals, not physical-health complaints.");
    }
    if (hints.dialecticalAffect) {
      notes.push("This entry expresses positive and negative feelings at the same time. Do not force this into a single mood — both are real and can coexist.");
    }
    if (hints.calmIsPositive) {
      notes.push("For this person, a calm, quiet, low-energy positive state is just as good as an excited one — never treat calm as a lesser or less positive feeling than excitement.");
    }
    if (hints.understatement) {
      notes.push("This entry uses understated, minimising language (e.g. 'it's fine', 'could be better'). Take it at more than face value; understatement here can carry real weight.");
    }
    return notes.length ? `\nADDITIONAL CONTEXT:\n${notes.map((n) => `- ${n}`).join("\n")}\n` : "";
  }

  /**
   * Dialect glossary injection (highest-payoff, lowest-effort fix per the
   * dialect research). When src/lib/analysis/dialect/ identifies a variety
   * (e.g. Singlish) and matches tokens in THIS entry, inject a compact
   * glossary of ONLY those matched tokens -- never the whole lexicon -- plus
   * an instruction to reason about particles/markers before judging
   * sentiment. In Singlish, HOW something is said (particle choice,
   * stacking, aspect marking) is often the actual emotional content while
   * the content words look neutral; a model scoring sentiment off content
   * words alone produces false negatives on masked distress, which is the
   * dangerous direction in a wellbeing app.
   */
  _dialectNote(hints = {}) {
    const matches = hints.dialectMatches;
    if (!hints.dialectVariety || !Array.isArray(matches) || matches.length === 0) return "";

    // De-duplicate by token so a repeated particle only appears once in the
    // glossary, in order of first appearance.
    const seen = new Set();
    const glossaryLines = [];
    for (const m of matches) {
      if (seen.has(m.token)) continue;
      seen.add(m.token);
      const maskFlag = m.masksDistress ? " [can mask real distress -- do not read as neutral]" : "";
      glossaryLines.push(`- "${m.matchedText}" (${m.token}): ${m.gloss}${maskFlag}`);
    }

    const distressWarning = hints.dialectMaskedDistress
      ? "\nAt least one marker above is a classic way this dialect expresses quiet distress using no negative-sentiment word (e.g. resigned acceptance, jadedness, shame). Do NOT score this entry as neutral or lightly dismissive just because the plain-English content words look mild.\n"
      : "";

    const prosodyWarning = hints.textFeatures?.dialectProsodyUnavailable
      ? "\nWritten text does not preserve particle intonation. Treat a particle as stance/context evidence, not a fixed emotion; let surrounding words and constructions determine emotional direction.\n"
      : "";
    return `\nDIALECT CONTEXT: this entry uses ${hints.dialectVariety === "singlish" ? "Singlish (Colloquial Singapore English)" : hints.dialectVariety}. Reason about the particles and markers below BEFORE judging sentiment -- in this dialect, HOW something is said often carries the real emotional content while the words themselves look neutral.\nGLOSSARY (only terms found in this entry):\n${glossaryLines.join("\n")}\n${prosodyWarning}${distressWarning}`;
  }

  _informalNote(hints = {}, analysis = {}) {
    const features = hints.textFeatures ?? analysis.textFeatures;
    const markers = features?.informal?.markers ?? [];
    if (!markers.length) return "";
    const seen = new Set();
    const lines = [];
    for (const marker of markers) {
      const key = `${marker.token}:${marker.function}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`- "${marker.matchedText}": ${marker.gloss} [function: ${marker.function}]`);
    }
    return `\nINFORMAL-LANGUAGE CONTEXT:
${lines.join("\n")}
These are pragmatic markers, not one-to-one emotion labels. Resolve laughter, profanity, surprise and outcome markers against the event and surrounding clause. Never assume "lol/lmao" means happiness, or that "omg/wtf/gg" has one fixed polarity.\n`;
  }

  /**
   * Give the language model the output of the deterministic model as grounded
   * evidence. The LLM may add nuance and write the response, but it may not
   * replace the measured VAD direction or invent unsupported mental states.
   */
  _deterministicNote(hints = {}, analysis = {}) {
    const features = hints.textFeatures ?? analysis.textFeatures;
    const vad = hints.vad ?? features?.vad ?? analysis.vad;
    const confidence = hints.vadConfidence ?? features?.vadConfidence ?? analysis.vadConfidence ?? 0;
    if (!vad || confidence <= 0) {
      return "\nDETERMINISTIC READING: no reliable affect evidence was found. Stay tentative, do not call this 'neutral' as if neutrality were measured, and ask a gentle clarifying question.\n";
    }

    const coarseEmotion = hints.analysis?.emotionLabel ?? vadToEmotionDirectional(vad).emotion;
    const interpretation = deriveInterpretiveEmotion(features, coarseEmotion);
    const experienceProfile = buildExperienceProfile(features, features?.appraisal?.normalizedText ?? "");
    const emotion = analysis.emotion ?? interpretation.emotion;
    const emotionEvidence = [];
    const thoughtEvidence = [];
    const behaviourEvidence = [];
    if (features?.maskedDistress) emotionEvidence.push("masked or understated distress");
    if (features?.somaticCount > 0) emotionEvidence.push("somatic distress language");
    if (features?.minimisationCount > 0) thoughtEvidence.push("minimisation");
    if (features?.hedgingCount > 0) thoughtEvidence.push("hedging");
    if (features?.selfDiscrepancyCount > 0) thoughtEvidence.push("self-discrepancy / 'should' thinking");
    if (features?.absolutistCount > 0) thoughtEvidence.push("absolutist framing");
    if ((features?.agency?.adjustment ?? 0) > 0) behaviourEvidence.push("expressed agency or active coping");
    if ((features?.agency?.adjustment ?? 0) < 0) behaviourEvidence.push("reduced agency or feeling constrained");
    if (features?.temporal?.dominant && features.temporal.dominant !== "none") {
      thoughtEvidence.push(`${features.temporal.dominant}-oriented thoughts`);
    }

    return `\nDETERMINISTIC READING (source of truth):
- Display emotion: ${emotion}
- VAD: valence ${vad.valence.toFixed(3)}, arousal ${vad.arousal.toFixed(3)}, dominance ${vad.dominance.toFixed(3)}
- Evidence confidence: ${(confidence * 100).toFixed(0)}% (confidence in available language evidence, not diagnostic certainty)
- Emotion cues: ${emotionEvidence.length ? emotionEvidence.join(", ") : "affect-bearing words or constructions"}
- Thought-language cues: ${thoughtEvidence.length ? thoughtEvidence.join(", ") : "none strongly supported"}
- Behaviour/coping cues: ${behaviourEvidence.length ? behaviourEvidence.join(", ") : "none strongly supported"}
- Appraisal dimensions: ${features?.appraisal ? `anticipated effort ${features.appraisal.dimensions.anticipatedEffort.toFixed(2)}, constraint ${features.appraisal.dimensions.situationalConstraint.toFixed(2)}, future threat ${features.appraisal.dimensions.futureThreat.toFixed(2)}, task aversiveness ${features.appraisal.dimensions.taskAversiveness.toFixed(2)}, goal obstruction ${features.appraisal.dimensions.goalObstruction.toFixed(2)}, outcome discrepancy ${(features.appraisal.dimensions.outcomeDiscrepancy ?? 0).toFixed(2)}, effortful experience ${(features.appraisal.dimensions.effortfulExperience ?? 0).toFixed(2)}, future hope ${(features.appraisal.dimensions.futureHope ?? 0).toFixed(2)}, physical discomfort ${features.appraisal.dimensions.physicalDiscomfort.toFixed(2)}` : "none"}
- Explicit cause frames: ${features?.appraisal?.causes?.length ? features.appraisal.causes.map((cause) => cause.label).join(", ") : "none found; do not invent one"}
- Informal pragmatic markers: ${features?.informal?.markers?.length ? features.informal.markers.map((marker) => `${marker.matchedText}=${marker.function}`).join(", ") : "none"}
EXPERIENCE PROFILE (continuous and compositional, not a fixed emotion class):
${formatExperienceProfile(analysis.experienceProfile ?? experienceProfile)}
Use this reading to ground the response. You may describe mixed feelings or nuance, but do not reverse its valence/arousal direction and do not diagnose the user.\n`;
  }

  /** Cold-start gate note: never let the model claim a trend before it's earned. */
  _trendNote(hints = {}) {
    if (hints.sayNothingAboutTrend) {
      return "\nDo NOT reference any trend, pattern, change over time, or comparison to how they 'usually' feel — there isn't enough history yet to say that honestly. Respond only to this entry.\n";
    }
    return "";
  }

  _responseStrategyNote(hints = {}, analysis = {}) {
    const strategy = hints.responseStrategy ?? selectCompanionStrategy(hints, analysis);
    return `\n${formatCompanionStrategy(strategy)}\n`;
  }

  async generateQuizReaction(question, answer, playerName = "friend") {
    const FALLBACKS = [
      "Every step counts.",
      "That's real. I hear you.",
      "Moving through it matters.",
      "Something good is alive in you.",
    ];
    const pickFallback = () => normaliseCompanionStyle(FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]);

    if (!hasGroqKey()) {
      warnIfNoKey("check-in reactions");
      return pickFallback();
    }
    try {
      return normaliseCompanionStyle(await groqChat({
        messages: [
          { role: "system", content: `You are a warm, empathetic companion responding to ${playerName}'s wellness check-in. Give ONE short, natural, human reaction (max 10 words). No quotes. No emojis. Respond directly to their answer with warmth.` },
          { role: "user", content: `Question: "${question}". They answered: "${answer}".` }
        ],
        temperature: 0.9,
        maxTokens: 40,
      }));
    } catch (err) {
      console.warn("[Kindred] Quiz reaction fallback:", err.message);
      return pickFallback();
    }
  }

  async generateChatReply(userMessage, chatHistory = [], originalEntry = "", detectedEmotion = "", playerName = "friend", memoryEntries = [], options = {}) {
    // Safety on EVERY turn, before any planning or model call: the latest
    // message alone and joined with the previous one. A joke or slang reading
    // elsewhere in the pipeline can never reach or soften this.
    const crisisCheck = detectCrisisInConversation(userMessage, chatHistory);
    if (crisisCheck.isCrisis) {
      const reply = crisisReply(crisisCheck.matched, options.conversationState);
      return options.returnDetails ? reply : reply.text;
    }
    const plan = buildConversationResponsePlan({ originalEntry, userMessage, chatHistory, detectedEmotion, memoryEntries });
    plan.originalEntry = originalEntry;
    plan.voice = buildVoiceProfile(originalEntry, plan.history, userMessage);
    plan.personalMemory = resolvePersonalMemory(options.personalMemory, memoryEntries);
    plan.voice = mergeHistoricalVoice(plan.voice, plan.personalMemory, originalEntry || userMessage);
    plan.personalContext = retrievePersonalContext([...(plan.history.length ? [] : [originalEntry]), ...plan.history.filter(turn => turn.role === 'user').slice(-2).map(turn => turn.text), userMessage].join('\n'), plan.personalMemory);
    plan.previousConversation = options.conversationState ?? null;
    plan.replyTo = options.replyTo ?? "";
    plan.engagementCue = analyseEngagement(plan.history, userMessage);
    // Who we are talking to (child/teen/adult/unknown) and what their slang,
    // Singlish and short forms most likely mean, before any model call.
    plan.ageBand = options.ageBand ?? 'unknown';
    plan.senseOpts = options.senseOpts ?? plan.personalMemory?.senseOpts;
    plan.lexiconReadings = lexiconReadings(userMessage, plan.senseOpts);
    // What a friend would already have in mind: how they've been lately, what
    // they said was coming up, and what kinds of replies work with them.
    plan.today = options.today ?? new Date().toISOString().slice(0, 10);
    const talkingAboutNow = loop => [originalEntry, userMessage].some(text =>
      String(text ?? '').toLowerCase().includes(loop.what.split(/\s+/).find(word => word.length > 2) ?? loop.what));
    plan.openLoops = dueLoops(plan.personalMemory?.openLoops ?? [], plan.today).filter(loop => !talkingAboutNow(loop));
    plan.wellbeingContext = options.wellbeingContext ?? wellbeingContextFor(memoryEntries);
    plan.relationship = plan.personalMemory?.relationship ?? null;
    // This person's usual message length: from past chats once there is enough,
    // otherwise from this conversation, otherwise unknown (no scaling).
    const turnLengths = plan.history.filter(turn => turn.role === 'user' && !turn.isJournal)
      .map(turn => String(turn.text ?? '').trim().split(/\s+/).filter(Boolean).length).sort((a, b) => a - b);
    plan.typicalWords = (plan.relationship?.reactions ?? 0) >= 5 ? plan.relationship.typicalWords
      : turnLengths.length >= 3 ? turnLengths[Math.floor((turnLengths.length - 1) / 2)] : undefined;
    // Words this person has explained ("by zoggy i mean my brother") or that
    // Kindred has learned from their reactions (term-learning.js), and words
    // it has a tentative reading for. Learned terms are no longer "unknown".
    const lowerMessage = String(userMessage).toLowerCase();
    const inMessage = item => item.term && new RegExp(`(?:^|[^a-z0-9])${item.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`).test(lowerMessage);
    plan.lexiconReadings.personalTerms = [
      ...(plan.personalMemory?.definitions ?? []).filter(item => item.meaning && inMessage(item))
        .map(item => ({ term: item.term, meaning: item.meaning, source: 'explained' })),
      ...(plan.personalMemory?.learnedTerms ?? []).filter(inMessage)
        .map(item => ({ term: item.term, meaning: item.meaning, source: 'learned' })),
    ].slice(0, 6);
    plan.lexiconReadings.tentativeTerms = (plan.personalMemory?.candidateTerms ?? []).filter(inMessage)
      .map(item => ({ term: item.term, meaning: item.meaning })).slice(0, 4);
    const known = new Set(plan.lexiconReadings.personalTerms.map(item => item.term));
    plan.lexiconReadings.unknownTerms = plan.lexiconReadings.unknownTerms.filter(term => !known.has(term.toLowerCase()));
    const widerMemory = retrieveConversationMemories([originalEntry, ...plan.history.filter(turn => turn.role === "user").slice(-2).map(turn => turn.text), userMessage].join("\n"), memoryEntries);
    plan.memory.memories = [...new Map([...plan.memory.memories, ...widerMemory.memories].map(memory => [memory.id, memory])).values()].slice(0, 4);

    if (!hasGroqKey()) {
      warnIfNoKey("journal chat");
      throw new Error("Companion unavailable: AI service is not configured");
    }
    let generationStage = 'assessment';
    try {
      try {
        if (options.conversationState && plan.engagementCue.score >= .6) {
          plan.debriefState = fallbackDebriefState(plan, options.conversationState);
        } else {
          applySemanticConversation(plan, await understandConversation(plan, originalEntry));
        }
      } catch (error) {
        console.warn("[Kindred] Semantic planning unavailable; using local context:", error.message);
        plan.debriefState = fallbackDebriefState(plan, options.conversationState);
      }
      if (!plan.semantic && plan.debriefState) {
        const focusedTopics = plan.debriefState.topics.filter(topic => plan.debriefState.focusIds.includes(topic.id));
        plan.questionBudget = 0;
        plan.continuationRequired = false;
        plan.agenda = { ...plan.agenda, focusId: plan.debriefState.focusIds[0],
          focusIds: plan.debriefState.focusIds, focusSummary: focusedTopics.map(topic => topic.summary).join('; '),
          focusEvidence: focusedTopics.flatMap(topic => topic.evidence?.map(item => item.quote) ?? []).join('; ') };
      }
      if (plan.semantic) {
        plan.debriefState = updateDebriefState(plan.semantic, options.conversationState, userMessage, plan.history,
          ['direct-question', 'journal-recall-question'].includes(plan.intent), { ...(plan.typicalWords === undefined ? {} : { typicalWords: plan.typicalWords }), journal: originalEntry });
        const focusId = plan.debriefState.focusIds[0];
        if (focusId && plan.semantic.topics.some(topic => topic.id === focusId)) {
          plan.semantic.focusIds = plan.debriefState.focusIds;
          const focusedTopics = plan.semantic.topics.filter(topic => plan.debriefState.focusIds.includes(topic.id));
          // Policy can move the focus after semantic assessment. Rebind the
          // question decision to that topic instead of carrying the old
          // topic's question score into the new turn.
          plan.semantic.questionFit = focusedTopics.find(topic => topic.id === focusId)?.questionFit ?? null;
          plan.semantic.questionStatus = focusedTopics.find(topic => topic.id === focusId)?.questionStatus ?? 'none';
          plan.answerLimitReached = ['answered', 'unanswerable'].includes(plan.semantic.questionStatus)
            || plan.questionPressure.answerLimitReached;
          plan.agenda = { ...plan.agenda, focusId, focusIds: plan.debriefState.focusIds,
            focusSummary: focusedTopics.map(topic => topic.summary).join('; '),
            focusEvidence: focusedTopics.flatMap(topic => topic.evidence.map(item => item.quote)).join('; ') };
        }
        plan.semantic.transitioning = plan.debriefState.action === 'SHIFT';
        plan.semantic.closing = '';
        plan.personalContext = retrievePersonalContext([plan.agenda.focusEvidence, userMessage].filter(Boolean).join('\n'), plan.personalMemory);
        plan.questionBudget = plan.semantic.intent === 'explore'
          && (plan.semantic.questionFit?.score ?? -1) >= .85 && !plan.answerLimitReached
          && ['EXPLORE', 'DEEPEN', 'SHIFT', 'VALIDATE'].includes(plan.debriefState.action)
          && !(plan.debriefState.action === 'SHIFT' && plan.engagementCue.repeatedBare) ? 1 : 0;
        plan.continuationRequired = plan.questionBudget === 1;
        plan.semantic.openingMode = plan.questionBudget ? 'question' : 'reflection';
      }
      plan.interpretation = plan.semantic?.interpretation ?? null;
      // The latest turn leads the strategy. The original entry remains context,
      // but must not numerically drown out a clarification or emotional shift.
      const conversationFeatures = plan.latestFeatures;
      const strategy = selectCompanionStrategy({
        textFeatures: conversationFeatures,
        vad: plan.contextVad,
        vadConfidence: Math.max(conversationFeatures.vadConfidence, plan.affect.focusConfidence),
        dialectMaskedDistress: conversationFeatures.maskedDistress,
      });
      // What their latest message did to our last one (turn-act.js). If they
      // just answered us with substance, they're engaged with THIS thread:
      // stay on it rather than shifting away (adjacency: an answer's next turn
      // takes the answer up).
      plan.turnAct = classifyTurnAct(userMessage, plan.history, { playMass: plan.lexiconReadings?.playMass ?? 0 });
      if (plan.debriefState?.action === 'SHIFT' && plan.turnAct.substantive
        && ['answer', 'option', 'both', 'elaboration'].includes(plan.turnAct.act)) {
        plan.debriefState.action = 'DEEPEN';
        if (plan.debriefState.previousFocusId) plan.debriefState.focusIds = [plan.debriefState.previousFocusId];
        plan.debriefState.previousFocusId = null;
        if (plan.semantic) plan.semantic.transitioning = false;
        plan.stayedOnAnsweredThread = true;
      }
      // When they picked one of our options or said "both", what they just
      // confirmed IS the focus now; a broader thread summary pulls the writer
      // elsewhere (seen live: "both la" answered with the mum thread).
      if (['option', 'both'].includes(plan.turnAct.act) && plan.turnAct.options) {
        const confirmed = plan.turnAct.act === 'both' ? plan.turnAct.options.join(' AND ') : plan.turnAct.selectedText;
        plan.agenda = { ...plan.agenda, focusSummary: `what they just confirmed: ${confirmed}`, focusEvidence: `${userMessage} (to: ${plan.turnAct.lastQuestion})` };
      }
      const replyGuidance = plan.debriefState ? responseContract(plan.debriefState, plan.semantic, plan.voice) : null;
      // How this reply helps them process (processing-moves.js): chosen here,
      // not left to the model, except when repairing, wrapping up, or
      // answering a direct question.
      const policyAction = plan.debriefState?.action;
      const repairTurn = ['repair', 'pushback'].includes(plan.turnAct.act);
      if ((!['REPAIR', 'SOFT_CLOSE'].includes(policyAction) || repairTurn) && (!plan.debriefState?.directQuestion || repairTurn)) {
        const focusTopic = plan.debriefState?.topics?.find(topic => topic.id === plan.debriefState.focusIds?.[0]);
        const aiTurns = plan.history.filter(turn => turn.role === 'ai');
        // Threads they raised that nobody has talked about yet, heaviest first.
        const aiWords = new Set(aiTurns.map(turn => String(turn.text ?? '').toLowerCase()).join(' ').match(/[a-z']{4,}/g) ?? []);
        const untouchedThreads = (plan.debriefState?.topics ?? [])
          .filter(topic => topic.id !== focusTopic?.id && !topic.incidental && !['declined', 'settled'].includes(topic.state)
            // 0.35 is what a journal-only mention scores; chat exploration goes higher.
            && (topic.explorationDepth ?? 0) < 0.45 && (topic.salience ?? 0) + (topic.emotionalIntensity ?? 0) >= 0.8)
          .filter(topic => {
            const quoteWords = (topic.evidence ?? []).map(e => e.quote).join(' ').toLowerCase().match(/[a-z']{5,}/g) ?? [];
            return quoteWords.filter(word => aiWords.has(word)).length < 2;
          })
          .sort((a, b) => ((b.salience ?? 0) + (b.emotionalIntensity ?? 0)) - ((a.salience ?? 0) + (a.emotionalIntensity ?? 0)))
          .map(topic => ({ summary: topic.summary, quote: topic.evidence?.[0]?.quote ?? '' })).slice(0, 2);
        plan.processingMove = chooseMove({
          focus: focusTopic,
          openThreads: replyGuidance?.otherMeaningfulThreads ?? [],
          userTexts: [originalEntry, ...plan.history.filter(turn => turn.role === 'user' && !turn.isJournal).map(turn => turn.text)].filter(Boolean),
          latest: userMessage,
          interpretation: plan.interpretation,
          playMass: plan.lexiconReadings?.playMass ?? 0,
          ...(() => {
            const profile = entryEmotionProfile({ id: 'latest', date: plan.today, text: userMessage });
            const lead = profile?.parts?.[0];
            return { latestLead: lead, goodNews: ['excited', 'proud', 'happy', 'relieved', 'grateful'].includes(lead)
              && (profile.distribution?.[lead] ?? 0) >= 0.2 };
          })(),
          relationship: plan.relationship,
          typicalWords: plan.typicalWords,
          ageBand: plan.ageBand,
          recentMoves: options.conversationState?.movesUsed ?? [],
          recentQuestions: aiTurns.slice(-3).reduce((sum, turn) => sum + (String(turn.text).match(/\?/g) ?? []).length, 0),
          turnAct: plan.turnAct,
          untouchedThreads,
        });
        // One question is always allowed: a statement move may still end on a
        // tentative "maybe it's X?". Question pressure and quality are handled
        // by the move model and reply-selection, not by a zero budget.
        plan.questionBudget = Math.max(plan.questionBudget ?? 0, 1);
        if (replyGuidance) replyGuidance.processingStage = plan.processingMove.stage;
      }
      // Landing gets its own explicit move; left open, the writer improvises
      // plans, lists and jokes (seen in live tests).
      if (policyAction === 'SOFT_CLOSE' && !repairTurn) plan.processingMove = landingMove();
      if (replyGuidance) { delete replyGuidance.action; delete replyGuidance.phase; }
      // Writer: persona + this person's style card and own messages + the
      // reading of what they meant (writer-prompt.js). It drafts two different
      // replies; reply-selection.js picks by expected utility behind the same
      // hard validators. No reply text is templated anywhere in this path.
      const messages = buildWriterMessages(plan, {
        replyGuidance,
        localPlanText: `${formatConversationResponsePlan(plan)}\n${formatCompanionStrategy(strategy)}`,
        originalEntry, userMessage, ageBand: plan.ageBand,
      });
      generationStage = 'writer';
      const rawDrafts = await groqChat({
        messages,
        temperature: 0.55,
        maxTokens: 600,
        reasoningEffort: "low",
        // No strict JSON mode: if a model answers in plain text, that text is
        // still a usable single draft (parseDrafts) instead of a failed turn.
      });
      const userWritten = [originalEntry, userMessage, ...plan.history.filter(turn => turn.role === 'user').slice(-4).map(turn => turn.text)].join(' ');
      const drafts = parseDrafts(rawDrafts).map(draft => draft.split(/\n\s*\n/)
        .map(text => softenCasualWording(normaliseCompanionStyle(stripUnmatchedEmoji(text, userWritten)), plan.voice)).filter(Boolean).join("\n\n"));
      const selection = selectReply(drafts, plan, plan.interpretation, { ageBand: plan.ageBand, relationship: plan.relationship });
      plan.draftSelection = selection.ranked.map(({ text, utility, components, check: c }) => ({ text, utility, components, ok: c.ok, reason: c.reason }));
      let reply = selection.best?.text ?? "";
      // Images they never used, or a reply far past their length: tighten in
      // code rather than spend another rate-limited call on a rewrite.
      if (selection.best?.components?.figurative || selection.best?.components?.overLength) {
        const tightened = tightenReply(reply, plan, userWritten, wordCap(plan));
        const tightCheck = tightened && tightened !== reply ? validateConversationReply(tightened, plan) : null;
        if (tightCheck && (tightCheck.ok || tightCheck.reason === selection.best.check?.reason || SOFT_REASONS.has(tightCheck.reason))) {
          plan.tightenedFrom = reply;
          const pick = selection.best;
          reply = tightened;
          pick.text = tightened;
        }
      }
      if (plan.processingMove && plan.debriefState) {
        const chosenIndex = selection.best?.index ?? drafts.indexOf(reply);
        const used = chosenIndex === 1 ? plan.processingMove.runnerUp : plan.processingMove.move;
        plan.draftMoveUsed = used;
        plan.debriefState.movesUsed = [...(options.conversationState?.movesUsed ?? []), used].slice(-6);
      }
      let check = selection.best?.check ?? validateConversationReply(reply, plan);
      if (check.reason === "stacked-questions") {
        reply = simplifyStackedQuestion(reply);
        check = validateConversationReply(reply, plan);
      }
      // A draft whose only problem is register has already paid for it in
      // utility (reply-selection.js voice). Live tests showed voice rewrites
      // costing a rate-limited call and often swapping the move for a coping
      // question, so accept it rather than rewrite.
      if (!check.ok && SOFT_REASONS.has(check.reason) && (selection.best?.components?.voice ?? 0) >= 0.4
        && !narratesFeelingFormally(reply)) {
        check = { ok: true, reason: null, softReason: check.reason };
      }
      // The move model chose a statement (double-sided, continue, take,
      // reframe, repair...): not ending on a question is the point, so the
      // old "always continue after a brief answer" rule doesn't apply.
      const statementMove = plan.processingMove && !QUESTION_MOVES.has(plan.draftMoveUsed ?? plan.processingMove.move);
      if (!check.ok && check.reason === 'reply-closes-after-brief-answer' && statementMove) {
        plan.continuationRequired = false;
        check = validateConversationReply(reply, plan);
      }
      // A topic switch without a full bridge is still better than a rewrite
      // that loses the move: accept when the content itself is fine.
      if (!check.ok && check.reason === 'missing-topic-transition-takeaway-and-bridge') {
        const contentCheck = validateConversationReply(reply, { ...plan, semantic: { ...plan.semantic, transitioning: false } });
        if (contentCheck.ok || RANK_SOFT_REASONS.has(contentCheck.reason)) check = { ok: true, reason: null, softReason: 'no-bridge' };
      }
      const originalDraft = reply;
      const originalCheck = check;
      const taskProbeFailure = new Set(['unrequested-task-breakdown', 'unrequested-task-progress-question',
        'unrequested-task-readiness-question', 'low-value-comfort-or-meta-question',
        'unrequested-task-coaching', 'narrowing-task-difficulty-instead-of-processing']);
      if (taskProbeFailure.has(check.reason) && !plan.adviceRequested) {
        // The model keeps filling a compulsory question slot with work steps.
        // Make a question optional before revision. A relevant question about
        // the experience may still help, but another task probe may not.
        plan.continuationRequired = false;
      }
      for (let revision = 0; revision < 1 && !check.ok; revision += 1) {
        generationStage = 'revision';
        try { reply = await groqChat({
          messages: [
            { role: "system", content: `${['voice-drift-from-user', 'style-too-formal-for-user'].includes(check.reason) ? 'The draft sounds polished or therapeutic compared with this user. Rewrite it from scratch in their observed personal texting style. Use fitting vocabulary and rhythm from THEIR examples, without copying phrases, echoing typos, or adding regional slang they have not used. ' : ''}${plan.processingMove ? `Keep the reply doing this: ${DESCRIBE[plan.draftMoveUsed ?? plan.processingMove.move]} ` : ''}Revise this companion reply to meet the stated constraint. Match the user's texting voice throughout the reply, not merely in an opener or in lowercase; use short everyday clauses and the expressions they actually use when natural. Do not become a therapist or a narrator recapping the journal. On an opening, do not ask the user to rank a menu of incidents; use the selected concern. A reply to a planned activity must keep future tense; never imply they already did it. If they repeat a choice or correct your timing, own the miss briefly and stop offering alternatives or questions. No generic comfort, vibe, mental-cue, or tiny-step questions. No generic task probing, unsolicited planning, invented actions or diagnostic language. A broad answer has already answered a subpart question: do not ask for a specific part again. Do not revisit an old comic incident unless the user raised it now or it directly explains the selected focus. Without a request for advice, do not suggest a process or step for school, work, or social situations. A named task step remains a proposal, not an achievement. For a gentle stopping point, use no question or advice. For a reflection, give a concrete thought the user can respond to. For an invitation, ask one relevant question that adds understanding. If changing topics, close the prior topic and bridge to the next in two short paragraphs without inventing a link. Never print private policy labels, Markdown headings, or an emoji the user has not used. Return only the reply, at most ${wordCap(plan)} words, in plain literal words (no metaphors or imagery they did not use).` },
            { role: "user", content: JSON.stringify({ failure: check.reason, latest: userMessage, journal: originalEntry.slice(0, 450),
              focus: plan.agenda.focusSummary, evidence: plan.agenda.focusEvidence,
              priorQuestion: plan.history.filter(turn => turn.role === "ai").at(-1)?.text?.slice(0, 200),
              planningAuthorized: plan.adviceRequested, answerLimitReached: plan.answerLimitReached || plan.debriefState?.questionPressure?.answerLimitReached, openingMode: plan.semantic?.openingMode,
              transitioning: plan.semantic?.transitioning, guidance: replyGuidance?.instruction,
              turnSignals: plan.engagementCue, voice: plan.voice, draft: reply }) },
          ],
          temperature: ['voice-drift-from-user', 'style-too-formal-for-user'].includes(check.reason) ? 0.65 : 0.3,
          maxTokens: 300,
          reasoningEffort: "low",
        }); } catch (revisionError) {
          console.warn('[Kindred] Reply revision unavailable; checking the original draft:', revisionError.message);
          break;
        }
        reply = reply.split(/\n\s*\n/).map(text => softenCasualWording(normaliseCompanionStyle(text), plan.voice)).filter(Boolean).join("\n\n");
        check = validateConversationReply(reply, plan);
        if (check.reason === "stacked-questions") {
          reply = simplifyStackedQuestion(reply);
          check = validateConversationReply(reply, plan);
        }
      }

      if (!check.ok && (['question-budget', 'landing-demands-answer'].includes(check.reason)
        || taskProbeFailure.has(check.reason)) && !plan.continuationRequired) {
        const withoutTrailingQuestion = reply.replace(/(?:^|[.!]\s+)[^.!?]*\?\s*$/, '').trim();
        const shorterCheck = validateConversationReply(withoutTrailingQuestion, plan);
        if (shorterCheck.ok) { reply = withoutTrailingQuestion; check = shorterCheck; }
      }
      if (!check.ok && check.reason === 'reply-closes-after-brief-answer' && plan.continuationRequired
        && plan.debriefState?.action !== 'SOFT_CLOSE') {
        try {
          generationStage = 'continuation';
          const nextQuestion = (await groqChat({
            messages: [
              { role: 'system', content: 'Write only one short, natural question to continue this journaling chat after the companion has made a statement. The user has just answered the companion. Use that answer and the unresolved concerns provided. Ask about one concrete earlier moment or what is still on their mind, in the user’s observed register. Do not turn an incident into a symbol, reminder, lesson, or theory about the user. No task steps, coping ideas, generic "what else", repeated questions, formal therapy language, emojis, or assumed feelings. A fitting expression from their own vocabulary is okay; do not copy their full phrasing, reproduce typos, or invent slang. If their writing is mostly lowercase, keep the question lowercase. Do not include an explanation.' },
              { role: 'user', content: JSON.stringify({ latest: userMessage, companionStatement: reply.slice(-500),
                focus: plan.agenda.focusSummary, otherConcerns: plan.debriefState.topics
                  .filter(topic => !plan.debriefState.focusIds.includes(topic.id) && !topic.incidental && topic.state !== 'declined')
                  .slice(0, 3).map(topic => ({ summary: topic.summary, evidence: topic.evidence?.[0]?.quote?.slice(0, 140) })),
                priorQuestion: plan.history.filter(turn => turn.role === 'ai').at(-1)?.text?.slice(-200), voice: plan.voice }) },
            ], temperature: .45, maxTokens: 180, reasoningEffort: 'low',
            modelOverride: import.meta.env?.VITE_GROQ_ASSESSOR_MODEL || 'openai/gpt-oss-20b',
            fallbackModels: [import.meta.env?.VITE_GROQ_FALLBACK_MODEL || 'qwen/qwen3.8-27b'],
          })).trim();
          if (nextQuestion.endsWith('?')) {
            const candidate = `${reply}\n\n${softenCasualWording(normaliseCompanionStyle(nextQuestion), plan.voice)}`;
            const candidateCheck = validateConversationReply(candidate, plan);
            if (candidateCheck.ok) { reply = candidate; check = candidateCheck; }
          }
        } catch (continuationError) {
          console.warn('[Kindred] Optional continuation unavailable:', { code: continuationError.code ?? null,
            status: continuationError.status ?? null });
        }
      }
      if (!check.ok && check.reason === 'reply-closes-after-brief-answer') {
        // A missing question after a revision is less harmful than dropping
        // the user's saved turn. Other content checks still have to pass.
        plan.continuationRequired = false;
        check = validateConversationReply(reply, plan);
      }
      // A style rewrite can fail or time out. Keep a content-safe draft instead
      // of turning a saved user message into an unavailable companion turn.
      if (!check.ok && ['voice-drift-from-user', 'style-too-formal-for-user'].includes(originalCheck.reason)) {
        reply = originalDraft;
        check = { ok: true, reason: null };
      }
      // Last resort before failing the turn: any original draft whose only
      // problem was its closing question, minus that question. A plain,
      // grounded statement is better than an error.
      if (!check.ok) {
        for (const candidate of selection.ranked) {
          const trimmed = candidate.text.replace(/(?:^|[.!…]\s*)[^.!?…]*\?\s*$/, (m) => (/^[.!…]/.test(m) ? m[0] : '')).trim();
          const trimmedCheck = trimmed && trimmed !== candidate.text ? validateConversationReply(trimmed, { ...plan, continuationRequired: false }) : null;
          if (trimmedCheck?.ok) { reply = trimmed; check = trimmedCheck; break; }
        }
      }
      if (check.ok && speaksAsUser(reply, [originalEntry, userMessage, ...plan.history.filter(turn => turn.role === 'user').map(turn => turn.text)].join(' '))) {
        check = { ok: false, reason: 'speaks-as-user' };
      }
      if (!check.ok) {
        generationStage = 'validation';
        const qualityError = new Error(`Companion reply did not pass validation: ${check.reason}`);
        qualityError.code = 'quality_rejected';
        qualityError.draftSelection = plan.draftSelection;
        qualityError.lastDraft = reply;
        throw qualityError;
      }
      if (plan.debriefState?.action === 'SHIFT' && plan.semantic && plan.history.some(turn => turn.role === 'ai')) {
        try {
          generationStage = 'transition-review';
          const reviewed = (await reviewConversationalProgress(reply, plan)).split(/\n\s*\n/)
            .map(text => softenCasualWording(normaliseCompanionStyle(text), plan.voice)).filter(Boolean).join('\n\n');
          const reviewedCheck = validateConversationReply(reviewed, plan);
          if (reviewedCheck.ok) reply = reviewed;
        } catch (reviewError) {
          console.warn('[Kindred] Transition review unavailable:', { code: reviewError.code ?? null,
            status: reviewError.status ?? null });
        }
      }
      const messagesOut = reply.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);
      if (!options.returnDetails) return reply;
      return { text: reply, messages: messagesOut, affect: plan.semantic?.affect,
        conversationState: plan.debriefState ?? options.conversationState,
        interpretation: storableInterpretation(plan.interpretation),
        // Turn 0 is the journal itself; chat turns count from 1.
        followUps: validateFollowUps(plan.interpretation?.followUpsRaw, userMessage, plan.today, options.entryId ?? null),
        termReadings: termReadingsFrom(plan.interpretation,
          chatHistory.length ? chatHistory.filter(turn => turn.role === 'user' && !turn.isJournal).length + 1 : 0),
        draftSelection: plan.draftSelection, tightenedFrom: plan.tightenedFrom, turnAct: plan.turnAct?.act, focus: plan.agenda?.focusSummary,
        moveDebug: plan.processingMove ? { ranked: plan.processingMove.ranked?.slice(0, 4), target: plan.processingMove.target?.summary ?? null }
          : { skipped: true, action: plan.debriefState?.action ?? null, directQuestion: plan.debriefState?.directQuestion ?? null, intent: plan.intent, semantic: Boolean(plan.semantic) } };
    } catch (err) {
      console.warn("[Kindred] Chat reply unavailable:", { stage: generationStage, code: err.code ?? null,
        status: err.status ?? null, reason: err.code === 'quality_rejected' ? err.message : undefined });
      throw err;
    }
  }

  async _groqResponse(text, analysis, pastEntries, playerName, hints = {}) {
    const memory = retrieveConversationMemories(text, pastEntries);
    const relevantMemory = formatRetrievedMemories(memory);
    const responsePlan = buildConversationResponsePlan({
      userMessage: text,
      detectedEmotion: analysis?.emotion,
      memoryEntries: pastEntries,
    });

    const systemPrompt = `You are Kindred, a warm, culturally attentive journaling companion. A deterministic linguistic and mathematical model has already analysed the entry. Your job is to interpret its evidence in context and write a helpful response, not replace its measurements.

You will encounter:
- Colloquial language ("idk", "lol", "ugh", "tbh")
- Broken English, short forms, sentence fragments
- Metaphors and symbolic language ("cloudy" = mental fog, "stagnant" = stuck/frustrated, "weight" = burden)
- Subtext (what's unsaid but implied by tone)
- Mixed emotions (frustrated yet hopeful, exhausted but trying)
- Positive emotions expressed simply ("had a good day", "felt better", "things improving")

Read for:
1. TONE & VOICE: What emotional tone? Frustrated? Weary? Excited? Content?
2. NARRATIVE: What's the story? What happened? What's their situation?
3. SUBTEXT: What pressures, expectations, conflicts, needs or meanings are implied?
4. METAPHORS: "Cloudy" = mental fog. "Heavy" = burden. "Light" = relief. "Flowing" = ease.
5. SENTIMENT: Overall positive, negative, or mixed? Growing? Struggling? Accepting?

First divide the entry into meaning units and preserve each important thread. Group clauses that describe the same problem, such as an assessment and catching up with lectures, while keeping separate goals or obstacles separate, such as study pressure versus wanting enjoyable free time. Use contrast, cause and goal-conflict relations from the discourse map. Do not answer only the first or most negative clause.

Use the conversation agenda to acknowledge all meaningful concerns, then develop the highest-priority one. If another concern is still unexplored, leave a natural opening to return to it rather than making the user remind you. A time-sensitive happy event can be exciting without needing to be made less urgent; a socially awkward outing can be worth discussing even if it is less dramatic.

BOTH POSITIVE AND NEGATIVE equally:
- Detect joy, contentment, hope, relief, pride equally as frustration, sadness, exhaustion
- A person saying "I finished that project and felt proud" is NOT neutral — it's pride
- Don't bias toward negative emotions just because someone is venting

You are NOT looking only for emotion words. Read the narrative like a thoughtful human while staying grounded in the supplied evidence. Never stereotype from locale or dialect, imitate the user's dialect performatively, diagnose them, give the user an emotion verdict, or claim certainty about thoughts they did not express. Never use an em dash or en dash in the response.

${this._deterministicNote(hints, analysis)}${this._responseStrategyNote(hints, analysis)}
${formatConversationResponsePlan(responsePlan)}
${this._culturalNote(hints)}${this._trendNote(hints)}${this._dialectNote(hints)}${this._informalNote(hints, analysis)}`;

    const userPrompt = `Read this journal entry like a thoughtful friend who wants to help the writer process what is happening.

TASK: Produce internal emotion metadata, then write a natural response that helps the user examine their own experience.

Instructions:
- Read the entire message for tone, sentiment, and narrative
- Cover every high-salience unresolved thread in the supplied discourse map. Do not collapse different goals into one problem or split one user-defined category into several problems
- Look for subtext, metaphor, implied meanings
- Treat colloquial language as valid emotional signals
- Understand metaphors: "cloudy" = mental fog, "stagnant" = stuck, "weight" = burden, "flowing" = ease
- Don't just look for emotion words — read the narrative and tone
- Recognize positive emotions equally: pride, relief, contentment, peace, excitement, gratitude, hope
- Recognize negative emotions: frustration, exhaustion, overwhelm, dissatisfaction, sadness, anxiety
- Recognize mixed emotions: "tired but grateful", "frustrated yet hopeful"
- Treat the deterministic reading above as the primary emotion direction
- Preserve compound appraisal internally, but never explain a previous classification bug or contrast the user with another label
- Describe difficulty starting as reluctance or low motivation; never morally label the person "lazy"
- Identify one explicit situation or emotion cause from the entry; if none is stated, leave emotionCause empty rather than inventing one
- In companionResponse, do not list or announce emotions, write "you sound [emotion]", or contrast the user against alternative emotion labels
- Go one level beyond paraphrase: reflect the tension, expectation, lack of recovery, blocked need, personal meaning, or trade-off supported by the entry
- Follow the supplied response strategy. Usually write 2 concise sentences (20-55 words): a meaning-focused reflection, then one focused processing question or quiet acknowledgement
- Ask at most one question. A question is not mandatory, and advice is forbidden unless the entry explicitly asks for it
- Match the user's level of directness. Understand Singlish and cultural meaning, but do not caricature or overuse particles
- Avoid canned phrases such as "thank you for sharing", "your feelings are valid", "I understand how you feel", "I'm here for you", and "healing journey"
- Do not begin with "It sounds like", "It seems like", "I hear you", or "What I'm hearing is"
- Never use an em dash or en dash
- Avoid overdramatic metaphors, motivational slogans, clinical/therapy language, and claims of certainty about hidden feelings
- Earlier memories below are optional context. Use them only when clearly relevant, never as proof of "how the user is", and never let them outweigh the current entry

Examples of what to detect:
- "The day feels long, so much work, don't like my 9-6, feel cloudy/stagnant" → frustrated, exhausted, drained, trapped
- "Finally finished that project, felt proud" → pride, accomplishment, relief
- "Things settling down, feeling more at peace" → calm, relief, contentment

Return ONLY valid JSON:
{"detectedEmotion": "concise nuanced emotion", "emotionCause": "explicit situation from the entry or empty string", "companionResponse": "specific natural response matching the strategy"}

Relevant earlier user-authored memory:
${relevantMemory}

Journal entry:
"${text}"`;

    try {
      const raw = await groqChat({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.45,
        maxTokens: 500,
        responseFormat: { type: "json_object" },
      });

      const parsed = parseJsonFromCompletion(raw);
      const detectedEmotion = normaliseCompanionStyle(parsed.detectedEmotion?.trim());
      const emotionCause = parsed.emotionCause?.trim() ?? "";
      const companionResponse = normaliseCompanionStyle(parsed.companionResponse?.trim());

      if (!detectedEmotion) throw new Error("No detectedEmotion in response");
      if (!companionResponse) throw new Error("No companionResponse in response");
      const responseCheck = validateCompanionResponse(companionResponse, { features: hints.textFeatures ?? analysis.textFeatures });
      if (!responseCheck.ok) throw new Error(`Companion response rejected: ${responseCheck.reason}`);
      if (responsePlan.discourseModel?.academicLeisureConflict) {
        const coverage = discourseThreadCoverage(companionResponse, responsePlan.discourseModel, 2);
        if (coverage.required.length >= 2 && coverage.ratio < 1) {
          throw new Error("Companion response rejected: dropped-active-thread");
        }
      }

      console.info("[Kindred] Groq detected:", detectedEmotion);
      // The model's word is kept for its nuance ("tired but held"), but it is
      // NOT allowed to contradict the deterministic reading. See
      // reconcileEmotion below: an LLM that returns a positive word for an
      // entry the lexicon model reads as clearly negative is overruled, and
      // the substitution is reported rather than done silently. No number in
      // src/lib/analysis is affected either way.
      const reconciled = reconcileEmotion(detectedEmotion, text);
      return {
        text: companionResponse,
        source: "groq",
        emotion: reconciled.emotion,
        llmEmotion: detectedEmotion,
        deterministicEmotion: reconciled.deterministicEmotion,
        emotionSource: reconciled.source,
        emotionOverruled: reconciled.overruled,
        emotionCause,
      };

    } catch (err) {
      console.error("[Kindred] Groq error:", err.message);
      throw err;
    }
  }

  async detectEmotion(summaryText, pastEntries = []) {
    if (!hasGroqKey()) {
      warnIfNoKey("check-in emotion detection");
      return null;
    }

    const recentContext = pastEntries.slice(0, 3).map(e =>
      `${e.date}: ${e.emotion}`
    ).join(", ");

    const systemPrompt = `You are a mental wellness expert analyzing wellbeing check-in data. Understand the person's overall emotional and mental state from the quiz results.

Read the FULL PICTURE:
- High energy + meaningful work + good sleep = energized, capable, engaged
- Low energy + difficulty with tasks + good relationships = tired but supported, content
- Mixed scores = complex state ("balanced but uncertain", "growing", "adjusting")
- Don't assume low scores = depression; might be "recovering", "tired but hopeful"
- High scores might not mean "happy"; might mean "anxious energy", "overwhelmed busyness"

Look at the whole story, not individual low numbers.`;

    const userPrompt = `Someone completed a mental wellbeing check-in. Read ALL dimensions together to understand their actual emotional and mental state.

${summaryText}
${recentContext ? `\nRecent emotional history: ${recentContext}` : ""}

Read the full wellness picture:
- If energy is high but meaning is low → "busy but unfulfilled" or "restless"
- If energy is low but relationships are strong → "tired but held" or "depleted but supported"
- If everything is balanced → "grounded", "stable", "in equilibrium"
- If mood is low but purpose is high → "struggling but driven" or "exhausted but committed"
- If everything is high → "thriving", "energized", "in flow"
- If everything is low → "depleted", "burnt out", "struggling"

Name the actual emotional state. Examples:
- "energized and engaged"
- "tired but supported"
- "overwhelmed and isolated"
- "recovering and rebuilding"
- "stable and content"

Return ONLY valid JSON:
{"emotion": "your honest read of their wellness state"}`;

    try {
      const raw = await groqChat({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.75,
        maxTokens: 200,
        responseFormat: { type: "json_object" },
      });

      const emotion = normaliseCompanionStyle(parseJsonFromCompletion(raw).emotion?.trim());
      console.info("[Kindred] Quiz Groq detected:", emotion);
      return emotion || null;
    } catch (err) {
      console.warn("[Kindred] Quiz emotion detection failed:", err.message);
      return null;
    }
  }

  _templateResponse(text, analysis, pastEntries) {
    const plan = buildConversationResponsePlan({ userMessage: text, detectedEmotion: analysis?.emotion, memoryEntries: pastEntries });
    return {
      text: normaliseCompanionStyle(localInitialReflection(plan)),
      source: "companion-appraisal",
      emotion: analysis?.emotion ?? "hard to name",
    };
  }

  _appraisalTemplate(text, analysis, pastEntries = []) {
    const appraisal = analysis?.textFeatures?.appraisal;
    const d = appraisal?.dimensions;
    if (!d) return null;
    const strongTaskAversion =
      d.goalObstruction >= 0.35 &&
      d.taskAversiveness >= 0.4 &&
      (d.pressure >= 0.25 || d.physicalDiscomfort >= 0.35);
    const meaningfulOutcome = d.outcomeDiscrepancy >= 0.4 || d.effortfulExperience >= 0.4;
    if (!strongTaskAversion && !meaningfulOutcome) return null;

    const plan = buildConversationResponsePlan({ userMessage: text, memoryEntries: pastEntries });
    return localInitialReflection(plan);
  }
}

/**
 * CONTRADICTION GUARD BETWEEN THE MODEL AND THE LEXICON.
 *
 * The companion may name an emotion in its own words — that nuance is the
 * point of having it. What it may not do is reverse the sign of the reading
 * the deterministic layer produced: an entry that text-features.js scores at
 * valence -0.4 is not "content", whatever the completion says, and letting a
 * non-reproducible call flip it would make the stored emotion depend on
 * whether an API key happened to be set.
 *
 * The rule, deliberately narrow so it only fires on real contradictions:
 *   - the deterministic reading must have actual evidence
 *     (|valence| >= VALENCE_CONTRADICTION_FLOOR), and
 *   - the LLM's word must map to the OPPOSITE side of neutral on the same
 *     0-10 wellness scale used elsewhere in this file.
 * A second narrow guard prevents a cause-rich task-aversion reading from
 * being flattened to generic same-valence sadness. Any replacement is
 * reported in the result rather than hidden.
 */
export const VALENCE_CONTRADICTION_FLOOR = 0.15;

export function reconcileEmotion(llmEmotion, text) {
  const features = analyseText(text ?? "");
  const reading = { ...features.vad, confidence: features.vadConfidence };
  // Full VAD, not valence alone: valence cannot tell sad (low arousal, low
  // dominance) from anxious (high arousal, low dominance), and those two need
  // different responses.
  const coarseEmotion = vadToEmotionDirectional(reading).emotion;
  const interpretation = deriveInterpretiveEmotion(features, coarseEmotion);
  const deterministicEmotion = interpretation.emotion;
  if (!llmEmotion) {
    return { emotion: deterministicEmotion, deterministicEmotion, source: "deterministic", overruled: false };
  }
  const llmLower = llmEmotion.toLowerCase();
  const nuancedTaskReading = interpretation.components.some((part) =>
    /\b(frustrated|unmotivated|dreading|fed up|reluctant|irritable)\b/i.test(part)
  );
  const genericSadnessOnly =
    /\b(sad|down|low|heavy|blue)\b/i.test(llmLower) &&
    !/\b(frustrat|irritat|unmotivat|reluctan|dread|fed up|annoy|task|work)\b/i.test(llmLower);
  if (nuancedTaskReading && genericSadnessOnly) {
    return { emotion: deterministicEmotion, deterministicEmotion, source: "deterministic-appraisal-override", overruled: true };
  }
  if (Math.abs(reading.valence) < VALENCE_CONTRADICTION_FLOOR) {
    return { emotion: llmEmotion, deterministicEmotion, source: "llm", overruled: false };
  }
  const llmSide = Math.sign(getWellnessScore(llmEmotion) - 5);
  const lexSide = Math.sign(reading.valence);
  if (llmSide !== 0 && llmSide !== lexSide) {
    return { emotion: deterministicEmotion, deterministicEmotion, source: "deterministic-override", overruled: true };
  }
  return { emotion: llmEmotion, deterministicEmotion, source: "llm", overruled: false };
}

function getWellnessScore(emotion) {
  if (!emotion) return 5;
  const PRESET = { happy: 9, excited: 9, grateful: 8, content: 7, calm: 7, neutral: 5, tired: 3, anxious: 3, angry: 3, sad: 2 };
  if (PRESET[emotion] !== undefined) return PRESET[emotion];
  const lower = emotion.toLowerCase();
  if (lower.includes("happy") || lower.includes("joy") || lower.includes("thrill") || lower.includes("elat")) return 9;
  if (lower.includes("excit") || lower.includes("energiz") || lower.includes("buzzing")) return 9;
  if (lower.includes("grateful") || lower.includes("thankful") || lower.includes("hopeful") || lower.includes("appreciat")) return 8;
  if (lower.includes("calm") || lower.includes("peace") || lower.includes("ground") || lower.includes("settl")) return 7;
  if (lower.includes("content") || lower.includes("okay") || lower.includes("fine") || lower.includes("steady")) return 7;
  if (lower.includes("tired") || lower.includes("exhaust") || lower.includes("drain") || lower.includes("weary")) return 3;
  if (lower.includes("anxious") || lower.includes("worried") || lower.includes("overwhelm") || lower.includes("panic")) return 3;
  if (lower.includes("angry") || lower.includes("frustrat") || lower.includes("irritat") || lower.includes("trap")) return 3;
  if (lower.includes("sad") || lower.includes("lone") || lower.includes("depress") || lower.includes("hollow")) return 2;
  return 5;
}

// ── JournalMemory ─────────────────────────────────────────────────────────────

export class JournalMemory {
  constructor(entries = []) {
    this.entries = entries;
  }

  /** Returns last `days` days as a slot array, each with the entry or null. */
  getTimeline(days = 14) {
    const today  = new Date();
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const entry   = this.entries.find(e => e.date === dateStr) ?? null;
      result.push({
        date:    dateStr,
        weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
        entry,
      });
    }
    return result;
  }

  getStreak() {
    if (!this.entries.length) return 0;
    const today = new Date().toISOString().slice(0, 10);
    const dates  = [...new Set(this.entries.map(e => e.date))].sort((a, b) => b.localeCompare(a));
    let streak   = 0;
    let expected = today;
    for (const date of dates) {
      if (date === expected) {
        streak++;
        const d = new Date(expected);
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().slice(0, 10);
      } else break;
    }
    return streak;
  }

  /** Returns moments where emotional wellbeing jumped significantly. */
  getGrowthMoments() {
    const moments  = [];
    for (let i = 1; i < this.entries.length; i++) {
      const prev = this.entries[i];
      const curr = this.entries[i - 1];
      const diff = getWellnessScore(curr.emotion) - getWellnessScore(prev.emotion);
      if (diff >= 3) moments.push({ date: curr.date, from: prev.emotion, to: curr.emotion });
    }
    return moments.slice(0, 3);
  }

  getDominantEmotion(lastN = 7) {
    const recent = this.entries.slice(0, lastN);
    if (!recent.length) return null;
    const counts = {};
    for (const e of recent) counts[e.emotion] = (counts[e.emotion] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  getWeekSummary() {
    return {
      dominant:      this.getDominantEmotion(7),
      streak:        this.getStreak(),
      growthMoments: this.getGrowthMoments(),
      totalEntries:  this.entries.length,
    };
  }
}

// ── World Mood Integration ────────────────────────────────────────────────────

const WORLD_MOODS = {
  happy:    { ambient: "rgba(255,248,220,0.45)", filter: "brightness(1.03) saturate(1.07)", label: "golden hour" },
  excited:  { ambient: "rgba(255,235,220,0.4)",  filter: "brightness(1.04) saturate(1.1)",  label: "vibrant" },
  calm:     { ambient: "rgba(224,245,235,0.3)",  filter: "brightness(1.00) saturate(0.98)", label: "still" },
  content:  { ambient: "rgba(245,245,235,0.3)",  filter: "brightness(1.01)",                label: "warm" },
  grateful: { ambient: "rgba(255,232,245,0.35)", filter: "brightness(1.02) saturate(1.03)", label: "rose" },
  neutral:  { ambient: "transparent",            filter: "none",                            label: "clear" },
  anxious:  { ambient: "rgba(235,230,255,0.3)",  filter: "brightness(0.99) saturate(0.93)", label: "tense" },
  tired:    { ambient: "rgba(220,225,245,0.35)", filter: "brightness(0.97) saturate(0.88)", label: "muted" },
  sad:      { ambient: "rgba(215,228,248,0.4)",  filter: "brightness(0.96) saturate(0.82)", label: "blue-hour" },
  angry:    { ambient: "rgba(255,230,225,0.3)",  filter: "brightness(0.98) saturate(1.02)", label: "warm-tense" },
};

export function getWorldMood(emotion) {
  return WORLD_MOODS[emotion] ?? WORLD_MOODS.neutral;
}

const NPC_RESPONSES = {
  sad:     [
    { type: "presence", action: "settles quietly near you, no words needed" },
    { type: "offer",    action: "offers something warm to hold without asking why" },
  ],
  anxious: [
    { type: "ground",  action: "walks alongside you, matching your pace" },
    { type: "notice",  action: "points out something small and beautiful nearby" },
  ],
  tired:   [{ type: "space", action: "finds you a quiet spot and sits without fuss" }],
  angry:   [{ type: "space", action: "gives you room, checking in gently from a distance" }],
  happy:   [{ type: "share", action: "catches your energy and grins" }],
  excited: [{ type: "join",  action: "wants to hear everything about it" }],
  calm:    [{ type: "peace", action: "sits in comfortable silence beside you" }],
  grateful:[{ type: "warm",  action: "notices something's different about you today" }],
};

export function getNPCBehavior(emotion, journalledToday) {
  if (!journalledToday) return null;
  const options = NPC_RESPONSES[emotion];
  if (!options) return null;
  return options[Math.floor(Math.random() * options.length)];
}
