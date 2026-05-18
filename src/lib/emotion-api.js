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

/**
 * Local keyword fallback — used when no API key is present.
 */
export function analyzeEmotionLocal(text) {
  const t = text.toLowerCase();
  const scores = {
    happy: 0, excited: 0, calm: 0, anxious: 0, sad: 0,
    tired: 0, angry: 0, content: 0, grateful: 0,
  };

  const lexicon = {
    happy:    ["happy", "joy", "great", "wonderful", "smile", "laugh", "elated", "glad", "pleased"],
    excited:  ["excited", "thrilled", "electric", "pumped", "energized", "can't wait", "amazing"],
    calm:     ["calm", "peace", "peaceful", "relaxed", "serene", "quiet", "still", "steady", "ease"],
    anxious:  ["anxious", "worried", "nervous", "stress", "tense", "uneasy", "overwhelm", "panic"],
    sad:      ["sad", "cry", "tears", "unhappy", "grief", "loss", "lonely", "hurt", "broken"],
    tired:    ["tired", "exhausted", "sleepy", "drain", "weary", "fatigue", "sluggish", "worn"],
    angry:    ["angry", "furious", "rage", "frustrate", "annoyed", "irritate", "upset"],
    content:  ["content", "satisfied", "okay", "fine", "good", "decent", "alright"],
    grateful: ["grateful", "thankful", "appreciate", "blessed", "fortunate", "lucky"],
  };

  for (const [emotion, words] of Object.entries(lexicon)) {
    for (const word of words) {
      if (t.includes(word)) scores[emotion] += 1;
    }
  }

  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  if (!top || top[1] === 0) {
    return { emotion: "neutral", label: "Neutral", confidence: 50, source: "local" };
  }

  return {
    emotion: top[0],
    label: top[0].charAt(0).toUpperCase() + top[0].slice(1),
    confidence: 65,
    source: "local",
  };
}
