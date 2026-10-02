/**
 * journal-ai.js — The emotional heart of Kindred
 *
 * The model is free to name whatever emotion it actually reads, rather than
 * being forced into a preset category. Every AI call goes through lib/groq.js;
 * when no API key is configured each entry point degrades to varied canned
 * text and logs a one-time warning explaining how to enable the real thing.
 */

import { groqChat, hasGroqKey, warnIfNoKey, parseJsonFromCompletion } from "./groq.js";
import { detectCrisisLanguage, CRISIS_RESPONSE } from "./analysis/crisis-detection.js";
import { analyseText } from "./analysis/text-features.js";
import { vadToEmotionDirectional } from "./analysis/emotion-space.js";
import { formatCompanionStrategy, selectCompanionStrategy, validateCompanionResponse } from "./analysis/response-strategy.js";
import { deriveInterpretiveEmotion } from "./analysis/thought-appraisal.js";
import {
  buildConversationResponsePlan,
  formatConversationResponsePlan,
  localInitialReflection,
  localConversationReply,
  scoreConversationReply,
  validateConversationReply,
} from "./analysis/conversation-response.js";
import { formatRetrievedMemories, retrieveConversationMemories } from "./analysis/conversation-memory.js";
import { buildExperienceProfile, formatExperienceProfile } from "./analysis/experience-profile.js";
import { normaliseCompanionStyle } from "./analysis/companion-style.js";

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

// ── Response Templates ─────────────────────────────────────────────────────────
// Used when Claude API is unavailable. Designed to feel like a real companion.

const COMPANION_RESPONSES = {
  _masking_sad: [
    "Something in how you wrote that made me pause. \"Fine\" can mean a lot of things — and sometimes it's the word we reach for when we don't quite have the energy to name the real thing. You don't have to.",
    "I noticed you said okay, but the rest of your words feel a little heavier than that. You don't have to perform being alright here.",
    "The word you used was fine, but I'm reading something else in the spaces between. That's okay. Sometimes language isn't enough for what we actually feel.",
  ],
  _masking_anxious: [
    "You said it's fine, but I can sense something underneath — a kind of low hum that hasn't quite settled. Does that feel closer to it?",
    "Something in your words feels like it's holding more than it's letting on. A kind of quiet tension. Am I reading that right?",
  ],
  _masking_default: [
    "I noticed the 'fine' — and I also noticed everything else you wrote. Those two things can both be true at once.",
    "There's more in what you wrote than you might realize. I'm here for all of it, not just the polished version.",
    "Something about the way you wrote that stayed with me. You don't have to explain — I just want you to know I caught it.",
  ],
  happy: [
    "There's something genuinely good in what you shared today. I don't want to rush past it — it matters.",
    "That sounds like a real moment. The good ones deserve to be noticed, and I'm noticing this one.",
    "Something lightened today. I'm glad.",
  ],
  excited: [
    "I can feel the energy in this. Hold onto that — it's yours.",
    "Something lit up for you today. That kind of spark is rare. I love seeing it in you.",
    "Whatever this is, it clearly means something to you. That matters.",
  ],
  calm: [
    "That stillness is rare and worth noticing. You found your footing today.",
    "Something settled for you. I'm curious what made it possible, if you want to sit with that.",
    "There's a quiet strength in what you described. Calm like this isn't passive — it's something earned.",
  ],
  content: [
    "Quietly okay is its own kind of good. The world doesn't always notice it, but I do.",
    "There's real steadiness in what you shared. That matters more than it might feel like.",
    "Content is underrated. It's the felt sense that things are, for now, okay — and that's actually profound.",
  ],
  grateful: [
    "Gratitude like this has a way of expanding. What you noticed — it's real, and it changes something.",
    "That's a beautiful thing to hold onto. What brought it up for you, do you think?",
    "I love when you write like this. Something in you opened today.",
  ],
  sad: [
    "I'm sitting with what you wrote. You don't have to be okay right now.",
    "Some days just feel like that. Heavy without a clear reason, or heavy with too many. Either way — I'm here.",
    "There's no rush through this. Whatever you're carrying — it's real, and you don't have to carry it alone.",
    "That sounds really hard. I'm not going to try to fix it or talk you out of it. I just want you to know I hear you.",
  ],
  anxious: [
    "That sounds like a lot to hold in your head at once. When everything feels urgent, nothing gets to be safe.",
    "Your nervous system is working overtime right now. That's exhausting in a way that's hard to explain to people who haven't felt it.",
    "Anxiety has a way of making everything feel like it needs to be solved immediately. You don't have to solve anything right now.",
    "I'm noticing the spin in your words. What would it feel like to just — not fix it for one minute?",
  ],
  tired: [
    "You've been going for a while, haven't you. Sometimes tired isn't just physical — it's the kind that settles in the bones.",
    "That kind of tired is different. Rest might help, but sometimes you also just need someone to acknowledge how much you've been carrying.",
    "Tiredness like this is your body asking for something real. You're allowed to listen.",
  ],
  angry: [
    "That frustration is telling you something. Anger often shows up when something that matters to us gets crossed.",
    "There's something real driving this. What does it feel like it's protecting?",
    "You're allowed to be angry. What I'm curious about is what's underneath it — what got hurt or disrespected?",
  ],
  neutral: [
    "Sometimes days just pass through, and that's okay. Not every day needs to mean something.",
    "Even in the in-between, you showed up. That counts for more than it might feel like.",
    "There's something to be said for just being present, even when nothing stands out. You're here.",
  ],
};

const TRAJECTORY_ADDONS = {
  improving: [
    " And I've noticed — compared to a few days ago, something has shifted. You seem a little more grounded.",
    " For what it's worth: you seem to be finding your way back to something. I don't want to make too much of it, but I see it.",
  ],
  declining: [
    " This stretch has been harder than the last few. I've been noticing.",
    " Something's been heavier on you recently. You don't have to explain it — I just want you to know I've seen it.",
  ],
  stable: [
    " You've been steady. That takes more than people think.",
  ],
};

const WIN_CELEBRATIONS = [
  " That right there — that's something. I know it might not feel huge, but I'm marking it.",
  " I want to say clearly: what you just described took real courage, even if it felt ordinary.",
  " You did something hard. That deserves to be named.",
];

// ── AIJournalist ──────────────────────────────────────────────────────────────

export class AIJournalist {
  async generateResponse(text, analysis, pastEntries = [], playerName = "friend", hints = {}) {
    // Safety first: crisis language routes to fixed, reviewed human-resources
    // copy and NEVER reaches the model — no clinical term is ever generated.
    const crisisCheck = detectCrisisLanguage(text);
    if (crisisCheck.isCrisis) {
      return { text: normaliseCompanionStyle(CRISIS_RESPONSE.text), source: "crisis-safety", emotion: "anxious", isCrisisResponse: true, resources: CRISIS_RESPONSE.resources };
    }
    if (hasGroqKey()) {
      try {
        const result = await this._groqResponse(text, analysis, pastEntries, playerName, hints);
        return { ...result, text: normaliseCompanionStyle(result.text) };
      } catch (err) {
        console.warn("[Kindred] Groq fallback activated:", err.message);
      }
    } else {
      warnIfNoKey("journal responses");
    }
    const result = this._templateResponse(text, analysis, pastEntries);
    return { ...result, text: normaliseCompanionStyle(result.text) };
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

  async generateChatReply(userMessage, chatHistory = [], originalEntry = "", detectedEmotion = "", playerName = "friend", memoryEntries = []) {
    const plan = buildConversationResponsePlan({ originalEntry, userMessage, chatHistory, detectedEmotion, memoryEntries });
    const fallback = () => normaliseCompanionStyle(localConversationReply(plan));

    if (!hasGroqKey()) {
      warnIfNoKey("journal chat");
      return fallback();
    }
    try {
      // The latest turn leads the strategy. The original entry remains context,
      // but must not numerically drown out a clarification or emotional shift.
      const conversationFeatures = plan.latestFeatures;
      const strategy = selectCompanionStrategy({
        textFeatures: conversationFeatures,
        vad: plan.contextVad,
        vadConfidence: conversationFeatures.vadConfidence,
        dialectMaskedDistress: conversationFeatures.maskedDistress,
      });
      const messages = [
        { role: "system", content: `You are Kindred, a warm journaling companion, not a therapist. The deterministic context and response plans below are authoritative.

Respond to what changed or became clearer in the LATEST user turn. First make a specific reflection that connects their concrete situation to its possible emotional meaning. A complex reflection adds a careful inference; it does not just repeat their sentence. Preserve uncertainty with words such as "sounds", "seems", or "might" when the meaning is inferred. Do not repeatedly ask the user to explain more. Obey the exact question budget. If it is zero, use no question at all. Answer a direct request before exploring. Repair a misunderstanding explicitly. Never claim certainty about an unspoken feeling.

If the user rejects an emotion or interpretation, that correction overrides every earlier assistant statement, stored display label, and inferred emotion. Apologise briefly, do not defend the prior label, and rebuild the meaning from the user's descriptions. A difficult or disappointing performance is not evidence of anger unless the user supplies anger-specific conflict, blame, violation, hurt, or disrespect.

Avoid therapy-speak, motivational slogans, exaggerated warmth, clinical language, canned validation, and the user's name used unnaturally. Understand dialect without imitating it. Give advice only when the plan says it was requested. Keep the reply to 1-3 short sentences without bullets. Never use an em dash or en dash. Use normal punctuation and natural sentence rhythm.

Respond like a careful human conversation partner. Do not begin with "It sounds like", "It seems like", "I hear you", or "What I'm hearing is". Do not merely rename an emotion. Reflect the event, the person's interpretation of it, the need or expectation involved, and what became clearer in this turn. Exploration must be specific to their words, never "tell me more".

Relevant past memories are user-authored context, not proof of a personality trait or permanent pattern. Use one only when it genuinely clarifies the current turn. Never announce that you searched memory, never say "you always", and never let an older entry outweigh what the user says now. Do not give an emotion verdict or contrast the user with alternative emotion labels. Help them examine the pressure, conflict, need, expectation, or meaning in what they said.

${formatCompanionStrategy(strategy)}

${formatConversationResponsePlan(plan)}

RELEVANT USER-AUTHORED MEMORY:
${formatRetrievedMemories(plan.memory)}` },
        { role: "assistant", content: `Journal context: "${originalEntry.slice(0, 400)}${originalEntry.length > 400 ? "..." : ""}"` },
        { role: "assistant", content: `Current-thread summary: ${JSON.stringify(plan.threadState)}` },
        ...plan.promptHistory.map((turn) => ({ role: turn.role === "ai" ? "assistant" : "user", content: turn.text.slice(0, 700) })),
        { role: "user", content: userMessage },
      ];
      let reply = await groqChat({
        messages,
        temperature: 0.55,
        maxTokens: 150,
      });
      reply = normaliseCompanionStyle(reply);
      let check = validateConversationReply(reply, plan);
      let fit = scoreConversationReply(reply, plan);
      if (!check.ok || fit.score < 0.5) {
        reply = await groqChat({
          messages: [
            ...messages,
            { role: "assistant", content: reply },
            { role: "user", content: `Revise that reply. It failed the response contract because: ${check.reason ?? `contextual-fit score ${fit.score.toFixed(2)} is below 0.50`}. Ground it in the latest turn, add a careful interpretation rather than echoing it, obey the question budget, and return only the revised reply.` },
          ],
          temperature: 0.35,
          maxTokens: 150,
        });
        reply = normaliseCompanionStyle(reply);
        check = validateConversationReply(reply, plan);
        fit = scoreConversationReply(reply, plan);
      }
      return check.ok && fit.score >= 0.5 ? reply : fallback();
    } catch (err) {
      console.warn("[Kindred] Chat reply fallback:", err.message);
      return fallback();
    }
  }

  async _groqResponse(text, analysis, pastEntries, playerName, hints = {}) {
    const memory = retrieveConversationMemories(text, pastEntries);
    const relevantMemory = formatRetrievedMemories(memory);

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

BOTH POSITIVE AND NEGATIVE equally:
- Detect joy, contentment, hope, relief, pride equally as frustration, sadness, exhaustion
- A person saying "I finished that project and felt proud" is NOT neutral — it's pride
- Don't bias toward negative emotions just because someone is venting

You are NOT looking only for emotion words. Read the narrative like a thoughtful human while staying grounded in the supplied evidence. Never stereotype from locale or dialect, imitate the user's dialect performatively, diagnose them, give the user an emotion verdict, or claim certainty about thoughts they did not express. Never use an em dash or en dash in the response.

${this._deterministicNote(hints, analysis)}${this._responseStrategyNote(hints, analysis)}${this._culturalNote(hints)}${this._trendNote(hints)}${this._dialectNote(hints)}${this._informalNote(hints, analysis)}`;

    const userPrompt = `Read this journal entry like a thoughtful friend who wants to help the writer process what is happening.

TASK: Produce internal emotion metadata, then write a natural response that helps the user examine their own experience.

Instructions:
- Read the entire message for tone, sentiment, and narrative
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
    const { emotion, emotionFamily, maskingDetected, trajectory } = analysis;
    const appraisalResponse = this._appraisalTemplate(text, analysis, pastEntries);
    if (appraisalResponse) {
      return { text: normaliseCompanionStyle(appraisalResponse), source: "companion-appraisal", emotion };
    }

    let pool;
    if (maskingDetected) {
      pool = COMPANION_RESPONSES[`_masking_${emotionFamily ?? emotion}`] || COMPANION_RESPONSES._masking_default;
    } else {
      pool = COMPANION_RESPONSES[emotionFamily ?? emotion] || COMPANION_RESPONSES.neutral;
    }

    let response = pool[Math.floor(Math.random() * pool.length)];

    // Add trajectory context ~50% of the time when trend is known
    if (trajectory?.trend && trajectory.trend !== "unknown" && pastEntries.length >= 3 && Math.random() > 0.5) {
      const addons = TRAJECTORY_ADDONS[trajectory.trend];
      if (addons) response += addons[Math.floor(Math.random() * addons.length)];
    }

    // Celebrate wins
    if (POSITIVE_SUBTEXT.some(p => p.test(text)) && Math.random() > 0.4) {
      response += WIN_CELEBRATIONS[Math.floor(Math.random() * WIN_CELEBRATIONS.length)];
    }

    return { text: normaliseCompanionStyle(response), source: "companion" };
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
