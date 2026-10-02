import { textVAD } from "../lib/analysis/text-features.js";
import { vadToEmotionDirectional } from "../lib/analysis/emotion-space.js";

export const EMOTIONS = {
  happy:    { label: "Happy",    color: "#d8a011", tone: "bright and open",     behavior: "smiling idle",        speed: 1.08 },
  excited:  { label: "Excited",  color: "#bc22db", tone: "high energy",         behavior: "energetic bounce",    speed: 1.38 },
  calm:     { label: "Calm",     color: "#4a7d99", tone: "settled and steady",  behavior: "slow breathing",      speed: 0.86 },
  anxious:  { label: "Anxious",  color: "#fc6005", tone: "uneasy or worried",   behavior: "small nervous sway",  speed: 1.12 },
  sad:      { label: "Sad",      color: "#0062ff", tone: "heavy or low",        behavior: "slower lowered idle", speed: 0.68 },
  tired:    { label: "Tired",    color: "#546483", tone: "drained or foggy",    behavior: "soft sleepy sway",    speed: 0.62 },
  angry:    { label: "Angry",    color: "#f51414", tone: "frustrated or tense", behavior: "tight stance",        speed: 1    },
  content:  { label: "Content",  color: "#127938", tone: "quietly okay",        behavior: "relaxed smile",       speed: 0.92 },
  grateful: { label: "Grateful", color: "#da027c", tone: "appreciative",        behavior: "warm nod",            speed: 0.95 },
  neutral:  { label: "Neutral",  color: "#535253", tone: "even or unclear",     behavior: "neutral idle",        speed: 0.9  }
};

const LANGUAGE_HINTS = [
  { language: "Spanish", pattern: /\b(hola|triste|feliz|ansioso|cansado|gracias|preocupado)\b/i },
  { language: "French", pattern: /\b(bonjour|triste|heureux|anxieux|fatigue|merci|calme)\b/i },
  { language: "Malay", pattern: /\b(sedih|gembira|risau|letih|tenang|terima kasih)\b/i },
  { language: "Chinese", pattern: /[\u4e00-\u9fff]/ },
  { language: "Japanese", pattern: /[\u3040-\u30ff]/ },
  { language: "Korean", pattern: /[\uac00-\ud7af]/ }
];

export function detectLanguage(text) {
  const match = LANGUAGE_HINTS.find((item) => item.pattern.test(text));
  return match?.language || "English";
}

/**
 * inferEmotion — now a thin adapter over the deterministic model.
 *
 * This function used to carry its own emotion keyword lists, its own negator
 * list and its own confidence formula (54 + 12·votes, capped at 96). That was
 * the THIRD independent lexicon in the codebase, alongside journal-ai.js's and
 * entry-adapter.js's, and all three could — and did — disagree about the same
 * sentence. There is now one lexicon and one set of rules
 * (src/lib/analysis/lexicon.js + text-features.js); this is the adapter that
 * keeps the old call signature working.
 *
 * The return shape is unchanged: { emotion, confidence, language, behavior,
 * reason }, with `vad` added.
 */
export function inferEmotion(text) {
  const reading = textVAD(text ?? "");
  const { emotion } = vadToEmotionDirectional(reading);
  // Confidence is the model's own evidence confidence on a 0-100 display
  // scale, floored at 45 so the UI never shows a bare 0 for "no reading" —
  // callers that need to know there was no evidence read `evidence`.
  const confidence = Math.round(45 + 50 * reading.confidence);

  const named = reading.terms
    .filter((t) => t.kind !== "dialect")
    .slice(0, 3)
    .map((t) => t.term);

  return {
    emotion,
    confidence,
    language: detectLanguage(text ?? ""),
    behavior: EMOTIONS[emotion]?.behavior ?? EMOTIONS.neutral.behavior,
    vad: { valence: reading.valence, arousal: reading.arousal, dominance: reading.dominance },
    evidence: reading.evidence,
    reason: named.length ? `Matched ${named.join(", ")}` : "No strong signal yet",
  };
}

// Emotion detection now runs through lib/groq.js (see lib/emotion-api.js). The
// old VITE_EMOTION_LLM_ENDPOINT path that used to live here pointed at a
// self-hosted endpoint that was never configured, and has been removed.
