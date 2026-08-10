import { groqChat, hasGroqKey, warnIfNoKey } from "./groq.js";

/**
 * Reads a free-text entry and names the emotion behind it.
 * Returns null when unavailable so callers can fall back to local heuristics.
 */
export async function analyzeEmotionAI(text) {
  if (!hasGroqKey()) {
    warnIfNoKey("emotion detection");
    return null;
  }

  try {
    const raw = await groqChat({
      messages: [
        {
          role: "system",
          content: "You are reading text and detecting the person's emotional state. Be honest and specific about what emotion they're feeling. Reply with the emotion only — a word or short phrase, no punctuation or explanation.",
        },
        {
          role: "user",
          content: `What emotion is this person feeling? Be specific and honest.\n\n"${text}"`,
        },
      ],
      temperature: 0.85,
      maxTokens: 150,
    });

    const emotion = raw.toLowerCase().split("\n")[0].trim();
    if (!emotion) return null;

    return {
      emotion,
      label: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      confidence: 75,
      source: "groq",
    };
  } catch (err) {
    console.warn("[Kindred] Emotion detection failed:", err.message);
    return null;
  }
}
