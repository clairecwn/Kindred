export const EMOTIONS = {
  happy: { label: "Happy", color: "#f6c65b", tone: "bright and open", behavior: "smiling idle", speed: 1.08 },
  excited: { label: "Excited", color: "#ee6f8f", tone: "high energy", behavior: "energetic bounce", speed: 1.38 },
  calm: { label: "Calm", color: "#5dbb9d", tone: "settled and steady", behavior: "slow breathing", speed: 0.86 },
  anxious: { label: "Anxious", color: "#f49f58", tone: "uneasy or worried", behavior: "small nervous sway", speed: 1.12 },
  sad: { label: "Sad", color: "#5d8edb", tone: "heavy or low", behavior: "slower lowered idle", speed: 0.68 },
  tired: { label: "Tired", color: "#8e7cc3", tone: "drained or foggy", behavior: "soft sleepy sway", speed: 0.62 },
  angry: { label: "Angry", color: "#e85d5d", tone: "frustrated or tense", behavior: "tight stance", speed: 1 },
  content: { label: "Content", color: "#4fbf7f", tone: "quietly okay", behavior: "relaxed smile", speed: 0.92 },
  grateful: { label: "Grateful", color: "#d76ba8", tone: "appreciative", behavior: "warm nod", speed: 0.95 },
  neutral: { label: "Neutral", color: "#8b99a7", tone: "even or unclear", behavior: "neutral idle", speed: 0.9 }
};

const LEXICON = {
  happy: ["happy", "joy", "sunny", "great", "good", "delighted", "cheerful", "light", "smiling"],
  excited: ["excited", "buzzing", "pumped", "thrilled", "energized", "electric", "spark", "ready"],
  calm: ["calm", "peaceful", "settled", "safe", "quiet", "grounded", "gentle", "still"],
  anxious: ["anxious", "worried", "cloudy", "confused", "troubled", "uncertain", "spiral", "nervous", "tense", "uneasy", "overthinking", "lost"],
  sad: ["sad", "heavy", "down", "lonely", "hurt", "empty", "blue", "cry", "clouded", "low"],
  tired: ["tired", "exhausted", "drained", "foggy", "sleepy", "burnt out", "burnout", "flat"],
  angry: ["angry", "mad", "irritated", "annoyed", "furious", "resentful", "snappy", "frustrated"],
  content: ["content", "okay", "fine", "balanced", "alright", "comfortable", "soft", "normal"],
  grateful: ["grateful", "thankful", "lucky", "appreciate", "blessed", "held", "supported"]
};

const NEGATORS = ["not", "never", "hardly", "barely", "isn't", "wasn't", "dont", "don't"];

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

export function inferEmotion(text) {
  const normalized = text.toLowerCase().replace(/[^\w\s']/g, " ");
  const words = normalized.split(/\s+/).filter(Boolean);
  const scores = Object.fromEntries(Object.keys(EMOTIONS).map((emotion) => [emotion, 0]));
  const matches = [];

  for (const [emotion, terms] of Object.entries(LEXICON)) {
    for (const term of terms) {
      const re = new RegExp(`\\b${term.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (re.test(normalized)) {
        const termIndex = words.findIndex((word) => term.split(" ")[0] === word);
        const negated = termIndex > 0 && NEGATORS.includes(words[termIndex - 1]);
        const weight = term.length > 7 ? 2 : 1;
        scores[emotion] += negated ? -weight : weight;
        matches.push(term);
      }
    }
  }

  if (/i feel|i am|i'm|today|because|but|and/.test(normalized)) {
    scores.neutral += 0.15;
  }

  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const emotion = winner && winner[1] > 0 ? winner[0] : "neutral";
  const confidence = Math.min(96, Math.max(54, 54 + Math.round((winner?.[1] || 0) * 12)));

  return {
    emotion,
    confidence,
    language: detectLanguage(text),
    behavior: EMOTIONS[emotion].behavior,
    reason: matches.length ? `Matched ${matches.slice(0, 3).join(", ")}` : "No strong signal yet"
  };
}

function parseEmotionPayload(payload) {
  const text = typeof payload === "string" ? payload : payload?.emotion ? JSON.stringify(payload) : "";
  const parsed = typeof payload === "object" && payload?.emotion ? payload : JSON.parse(text);
  const emotion = EMOTIONS[parsed.emotion] ? parsed.emotion : "neutral";
  return {
    emotion,
    confidence: Number(parsed.confidence || 82),
    language: String(parsed.language || "Detected"),
    behavior: EMOTIONS[emotion].behavior,
    reason: String(parsed.reason || "Language model reflection")
  };
}

export async function reflectEmotionWithLLM(text) {
  const fallback = inferEmotion(text);
  const endpoint = import.meta.env.VITE_EMOTION_LLM_ENDPOINT;

  if (!endpoint) {
    return {
      ...fallback,
      source: "local-reflection"
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        instruction:
          "Detect language and primary reflected emotion. Return JSON only with emotion, confidence, language, and reason. Emotion must be one of: happy, excited, calm, anxious, sad, tired, angry, content, grateful, neutral. Keep the reflection subtle and non-clinical."
      })
    });

    if (!response.ok) throw new Error("Emotion model unavailable");
    const data = await response.json();
    return { ...parseEmotionPayload(data), source: "llm" };
  } catch {
    return {
      ...fallback,
      source: "local-reflection"
    };
  }
}
