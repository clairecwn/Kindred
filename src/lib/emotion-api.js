/**
 * emotion-api.js
 *
 * Emotion reading for a free-text entry.
 *
 * WHAT CHANGED: this used to be an LLM call and nothing else. With no
 * VITE_GROQ_API_KEY it returned null, so emotion detection simply did not
 * exist offline, and when it did fire it reported a flat `confidence: 75`
 * regardless of what the text actually contained — a number with no model
 * behind it.
 *
 * Now the deterministic lexicon model (src/lib/analysis/text-features.js) is
 * the primary reader. It always runs, never needs a key, and reports a
 * confidence computed from how much lexical evidence it actually found. The
 * LLM, when a key is configured, is asked as well and returned alongside
 * under `llm` — labelled, inspectable, and unable to change the deterministic
 * numbers. It is used as the surface wording only when it does not contradict
 * the deterministic reading's sign (journal-ai.js reconcileEmotion).
 *
 * Returns null only when there is genuinely nothing to say: no key, and no
 * lexical evidence in the text either. Callers must treat null as "no
 * reading", not as "neutral".
 */

import { groqChat, hasGroqKey, warnIfNoKey } from "./groq.js";
import { detectCrisisLanguage } from "./analysis/crisis-detection.js";
import { analyseText } from "./analysis/text-features.js";
import { vadToEmotionDirectional } from "./analysis/emotion-space.js";
import { deriveInterpretiveEmotion } from "./analysis/thought-appraisal.js";
import { informalGlossary } from "./analysis/informal-pragmatics.js";
import { buildExperienceProfile, formatExperienceProfile } from "./analysis/experience-profile.js";
import { normaliseCompanionStyle } from "./analysis/companion-style.js";

/** Map the model's [0,1] evidence confidence onto the 0-100 the UI expects. */
function toPercent(confidence) {
  return Math.round(45 + 50 * confidence);
}

export async function analyzeEmotionAI(text) {
  // Crisis-language entries never go to the model for emotion labelling
  // either -- that path is handled entirely by the fixed safety response.
  if (detectCrisisLanguage(text).isCrisis) return null;

  const features = analyseText(text ?? "");
  const reading = {
    ...features.vad,
    confidence: features.vadConfidence,
    evidence: features.vadEvidence,
    lexiconVersion: features.lexiconVersion,
  };
  const coarse = vadToEmotionDirectional(features.vad);
  const deterministic = deriveInterpretiveEmotion(features, coarse.emotion);
  const experienceProfile = buildExperienceProfile(features, text);
  const hasEvidence = features.vadConfidence > 0;

  const base = hasEvidence
    ? {
        emotion: deterministic.emotion,
        label: deterministic.emotion.charAt(0).toUpperCase() + deterministic.emotion.slice(1),
        confidence: toPercent(features.vadConfidence),
        source: "deterministic",
        vad: { valence: reading.valence, arousal: reading.arousal, dominance: reading.dominance },
        evidence: reading.evidence,
        lexiconVersion: reading.lexiconVersion,
        emotionFamily: deterministic.family,
        appraisal: features.appraisal,
        informal: features.informal,
        experienceProfile,
      }
    : null;

  if (!hasGroqKey()) {
    warnIfNoKey("emotion detection");
    return base;
  }

  try {
    const dialectGlossary = (features.matches?.dialect ?? [])
      .filter((m) => m.counted)
      .map((m) => `"${m.matchedText}": ${m.gloss}`)
      .join("; ");
    const pragmaticGlossary = informalGlossary(features.informal)
      .map((item) => `"${item.surface}": ${item.gloss} [${item.function}]`)
      .join("; ");
    const grounding = hasEvidence
      ? `Deterministic source-of-truth reading: ${deterministic.emotion} (coarse family ${deterministic.family}); VAD (${features.vad.valence.toFixed(3)}, ${features.vad.arousal.toFixed(3)}, ${features.vad.dominance.toFixed(3)}); language-evidence confidence ${(features.vadConfidence * 100).toFixed(0)}%. Appraisal: ${JSON.stringify(features.appraisal?.dimensions ?? {})}. Explicit causes: ${(features.appraisal?.causes ?? []).map((cause) => cause.label).join(", ") || "none"}. Compositional experience profile: ${formatExperienceProfile(experienceProfile)}`
      : "The deterministic model found no reliable affect evidence; stay tentative rather than asserting neutral.";

    const raw = await groqChat({
      messages: [
        {
          role: "system",
          content: `You provide a concise display phrase for a journal experience that has already been measured by a deterministic model. This is open-vocabulary description, not selection from a fixed emotion bank. Preserve blends, appraisals and the user's own feeling language when supported. Do not reverse the supplied valence or arousal direction, diagnose the person, or stereotype them from dialect. Treat laughter, profanity, surprise and outcome shorthand as contextual pragmatic markers rather than fixed emotion labels. Never use an em dash or en dash. Reply with the phrase only, with no punctuation or explanation.\n${grounding}${dialectGlossary ? `\nDialect glossary: ${dialectGlossary}` : ""}${pragmaticGlossary ? `\nInformal-language glossary: ${pragmaticGlossary}` : ""}`,
        },
        {
          role: "user",
          content: `Name the most specific emotional nuance supported by this entry while staying consistent with the deterministic direction.\n\n"${text}"`,
        },
      ],
      temperature: 0.45,
      maxTokens: 150,
    });

    const emotion = normaliseCompanionStyle(raw.toLowerCase().split("\n")[0]);
    if (!emotion) return base;

    // Supplementary only. The deterministic emotion and confidence above are
    // untouched; the LLM's word rides along for the companion's wording.
    return {
      ...(base ?? {
        emotion,
        label: emotion.charAt(0).toUpperCase() + emotion.slice(1),
        confidence: toPercent(0),
        vad: { valence: 0, arousal: 0, dominance: 0 },
        evidence: 0,
      }),
      source: base ? "deterministic+groq" : "groq-only",
      llm: { emotion, label: emotion.charAt(0).toUpperCase() + emotion.slice(1), influencedScore: false },
    };
  } catch (err) {
    console.warn("[Kindred] Emotion detection failed:", err.message);
    return base;
  }
}
