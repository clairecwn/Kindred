/**
 * emotion-api.js
 *
 * Primary: Google Gemini 2.0 Flash (VITE_GEMINI_API_KEY)
 * Fallback: local keyword scan (no API required)
 *
 * Gemini has zero preset emotion categories — it detects whatever is actually
 * there using its training, same as asking web Gemini about an emotional state.
 */

const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

export async function analyzeEmotionAI(text) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const systemInstruction = `You are an expert at detecting emotions from text based on your training. Output whatever emotion you actually detect — no presets, no categories, complete freedom. If someone feels 'melancholic anticipation', 'frustrated resilience', 'numb yet hopeful' — name that. You have learned from millions of texts to understand emotions in their full complexity.`;

  const prompt = `What emotion is this person actually feeling? Use your full understanding of emotions, not a limited list. Output whatever you detect — it could be 2 words, 5 words, a phrase, whatever captures it.

Return ONLY valid JSON, no markdown, no extra text:
{"emotion": "whatever you actually detected"}

Text:
"${text}"`;

  try {
    const res = await fetch(GEMINI_URL(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 60, temperature: 0.9 },
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;

    const jsonMatch = raw.match(/\{[^}]+\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const emotion = parsed.emotion?.trim();
    if (!emotion) return null;

    console.info("[Kindred] Emotion API detected:", emotion);
    return {
      emotion,
      label: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      source: "gemini",
    };
  } catch {
    return null;
  }
}

