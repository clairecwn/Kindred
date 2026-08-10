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

// Emotion detection now runs through lib/groq.js (see lib/emotion-api.js). The
// old VITE_EMOTION_LLM_ENDPOINT path that used to live here pointed at a
// self-hosted endpoint that was never configured, and has been removed.
