export const EMOTIONS = {
  happy: { label: "Happy", color: "#f6c65b", tone: "bright and open" },
  excited: { label: "Excited", color: "#ee6f8f", tone: "high energy" },
  calm: { label: "Calm", color: "#5dbb9d", tone: "settled and steady" },
  anxious: { label: "Anxious", color: "#f49f58", tone: "uneasy or worried" },
  sad: { label: "Sad", color: "#5d8edb", tone: "heavy or low" },
  tired: { label: "Tired", color: "#8e7cc3", tone: "drained or foggy" },
  angry: { label: "Angry", color: "#e85d5d", tone: "frustrated or tense" },
  content: { label: "Content", color: "#4fbf7f", tone: "quietly okay" },
  grateful: { label: "Grateful", color: "#d76ba8", tone: "appreciative" },
  neutral: { label: "Neutral", color: "#8b99a7", tone: "even or unclear" }
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
    reason: matches.length ? `Matched ${matches.slice(0, 3).join(", ")}` : "No strong signal yet"
  };
}
