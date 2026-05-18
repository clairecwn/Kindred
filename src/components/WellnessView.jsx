import { useState, useEffect, useMemo } from "react";
import Animal3D from "./Animal3D.jsx";
import { analyzeEmotionAI } from "../lib/emotion-api.js";
import { EmotionDetector, AIJournalist, JournalMemory } from "../lib/journal-ai.js";
import { EMOTIONS } from "../utils/emotion.js";

// ── Wellness quiz — 7 balanced dimensions ────────────────────────────────────
// Equal weight to positive and negative states across energy, mood, meaning,
// connection, accomplishment, sleep, and resilience. Not a depression screen.
const QUIZ = [
  {
    id: "energy",
    q: "How would you describe your energy level right now?",
    dimension: "energy & vitality",
    opts: [
      { label: "Drained",           desc: "Running on empty",              emotion: "tired",    score: 0 },
      { label: "Low but going",     desc: "Getting through, not much left", emotion: "tired",   score: 1 },
      { label: "Steady",            desc: "Present and okay",              emotion: "content",  score: 2 },
      { label: "Energized",         desc: "Full and alive",                emotion: "excited",  score: 3 },
    ],
  },
  {
    id: "mood",
    q: "How would you describe your overall mood today?",
    dimension: "mood & emotional state",
    opts: [
      { label: "Pretty low",        desc: "Heavy or hard to lift",         emotion: "sad",      score: 0 },
      { label: "Somewhere between", desc: "Mixed — up and down",           emotion: "neutral",  score: 1 },
      { label: "Mostly okay",       desc: "Calm or settled",               emotion: "calm",     score: 2 },
      { label: "Genuinely good",    desc: "Hopeful or happy",              emotion: "happy",    score: 3 },
    ],
  },
  {
    id: "meaning",
    q: "Has your day felt like it matters — even in small ways?",
    dimension: "meaning & purpose",
    opts: [
      { label: "Hard to care",      desc: "Going through the motions",     emotion: "sad",      score: 0 },
      { label: "Not really",        desc: "Feels unclear",                 emotion: "neutral",  score: 1 },
      { label: "Sort of",           desc: "Some small moments landed",     emotion: "content",  score: 2 },
      { label: "Yes, genuinely",    desc: "Something felt real today",     emotion: "grateful", score: 3 },
    ],
  },
  {
    id: "connection",
    q: "How connected do you feel to the people in your life right now?",
    dimension: "relationships & connection",
    opts: [
      { label: "Very alone",        desc: "Quite cut off or invisible",    emotion: "sad",      score: 0 },
      { label: "A bit distant",     desc: "Not quite reaching anyone",     emotion: "neutral",  score: 1 },
      { label: "Okay",              desc: "Fine, neither close nor far",   emotion: "content",  score: 2 },
      { label: "Genuinely seen",    desc: "Close to someone today",        emotion: "grateful", score: 3 },
    ],
  },
  {
    id: "accomplishment",
    q: "Have you been able to do the things that matter to you today?",
    dimension: "accomplishment & growth",
    opts: [
      { label: "Struggling to start", desc: "Couldn't get going",          emotion: "tired",    score: 0 },
      { label: "Basics only",         desc: "Getting through the minimum", emotion: "neutral",  score: 1 },
      { label: "Making progress",     desc: "Moving forward okay",         emotion: "content",  score: 2 },
      { label: "Proud of something",  desc: "Did something that counts",   emotion: "happy",    score: 3 },
    ],
  },
  {
    id: "sleep",
    q: "How did you rest last night?",
    dimension: "sleep & physical wellness",
    opts: [
      { label: "Very little",       desc: "Barely slept",                  emotion: "tired",    score: 0 },
      { label: "Restless",          desc: "On and off, not deep",          emotion: "anxious",  score: 1 },
      { label: "Okay",              desc: "Well enough",                   emotion: "neutral",  score: 2 },
      { label: "Deeply",            desc: "Woke feeling restored",         emotion: "calm",     score: 3 },
    ],
  },
  {
    id: "resilience",
    q: "When challenges came up today, how did handling them feel?",
    dimension: "resilience & coping",
    opts: [
      { label: "Completely overwhelmed", desc: "Too much at once",         emotion: "anxious",  score: 0 },
      { label: "Hard but pushed through",desc: "Got there with effort",    emotion: "tired",    score: 1 },
      { label: "Managed okay",           desc: "Handled it well enough",   emotion: "neutral",  score: 2 },
      { label: "Felt capable",           desc: "Steady and in control",    emotion: "calm",     score: 3 },
    ],
  },
];

// Wellbeing score ranges (0–21 from 7 questions × 0–3 each)
const WELLBEING_BANDS = [
  { max: 7,  label: "Struggling",   message: "I want to sit with this for a second. It's been a hard stretch — and I don't want to skip past that. How you've been feeling matters.", emotion: "sad" },
  { max: 14, label: "Navigating",   message: "You're navigating. Not soaring, not sinking — just moving through it. That's real and it counts.", emotion: "neutral" },
  { max: 21, label: "Flourishing",  message: "There's something quietly good happening for you right now. I don't want to rush past it — this is a good patch.", emotion: "happy" },
];

// ── Shared visual helpers ─────────────────────────────────────────────────────

const EMOTION_SYMBOL = {
  happy: "☀", excited: "✦", calm: "〜", anxious: "◌",
  sad: "▾", tired: "☽", angry: "▲", content: "♦", grateful: "♥", neutral: "○"
};

const WELLNESS_PROMPTS = {
  happy:    "Notice what's bringing this joy. Let yourself be fully in it — you deserve this.",
  excited:  "This energy is yours to use. What's one small thing you could do with it today?",
  calm:     "Calm is its own kind of strength. Rest here for a moment, you've earned this stillness.",
  anxious:  "Your nervous system is working hard right now. Try one slow breath — in for 4, out for 6.",
  sad:      "Sadness often holds something tender and real. You don't have to push it away.",
  tired:    "Tiredness is your body asking to be honored. Even a small rest counts.",
  angry:    "Anger often protects something that matters deeply to you. What does it need?",
  content:  "Contentment is one of the quietest and most profound forms of happiness.",
  grateful: "Gratitude has a way of expanding what we notice. What's one small good thing?",
  neutral:  "Feeling neutral can be a quiet reset. Sometimes steady is exactly what we need."
};

function getEmotionStyle(emotionStr) {
  if (!emotionStr) return EMOTIONS.neutral;
  if (EMOTIONS[emotionStr]) return EMOTIONS[emotionStr];
  const lower = emotionStr.toLowerCase();
  if (lower.includes("happy") || lower.includes("joy") || lower.includes("bright") || lower.includes("elat")) return EMOTIONS.happy;
  if (lower.includes("excit") || lower.includes("thrill") || lower.includes("energiz") || lower.includes("buzzing")) return EMOTIONS.excited;
  if (lower.includes("calm") || lower.includes("peace") || lower.includes("settl") || lower.includes("ground") || lower.includes("still")) return EMOTIONS.calm;
  if (lower.includes("anxious") || lower.includes("worried") || lower.includes("overwhelm") || lower.includes("panic") || lower.includes("spiral")) return EMOTIONS.anxious;
  if (lower.includes("sad") || lower.includes("lone") || lower.includes("depress") || lower.includes("hollow") || lower.includes("griev")) return EMOTIONS.sad;
  if (lower.includes("tired") || lower.includes("exhaust") || lower.includes("drain") || lower.includes("foggy") || lower.includes("weary")) return EMOTIONS.tired;
  if (lower.includes("angry") || lower.includes("frustrat") || lower.includes("irritat") || lower.includes("annoy") || lower.includes("trap")) return EMOTIONS.angry;
  if (lower.includes("content") || lower.includes("okay") || lower.includes("fine") || lower.includes("steady") || lower.includes("stabl")) return EMOTIONS.content;
  if (lower.includes("grateful") || lower.includes("thankful") || lower.includes("appreciat") || lower.includes("hopeful")) return EMOTIONS.grateful;
  return EMOTIONS.neutral;
}

function EmotionBadge({ emotion, size = "normal" }) {
  const e     = getEmotionStyle(emotion);
  const label = EMOTIONS[emotion] ? e.label : emotion;
  const pad   = size === "large" ? "8px 18px" : "5px 14px";
  const fs    = size === "large" ? "0.95rem" : "0.82rem";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: pad, borderRadius: 999,
      background: e.color + "22", color: e.color,
      fontSize: fs, fontWeight: 800, border: `1.5px solid ${e.color}40`,
    }}>
      <span style={{ fontSize: size === "large" ? "1.1rem" : "0.9rem", flexShrink: 0 }}>
        {EMOTION_SYMBOL[emotion] ?? "○"}
      </span>
      {label}
    </span>
  );
}

// ── Quiz SVG visuals ─────────────────────────────────────────────────────────

function BatterySVG({ level, color }) {
  return (
    <svg width="62" height="30" viewBox="0 0 62 30" fill="none">
      <rect x="1" y="4" width="52" height="22" rx="5" stroke={color} strokeWidth="2.5"/>
      <rect x="53" y="11" width="8" height="8" rx="3" fill={color} opacity="0.5"/>
      {[0,1,2,3].map(i => (
        <rect key={i} x={5 + i * 12} y="8" width="9" height="14" rx="3"
          fill={i <= level ? color : "transparent"}
          stroke={color} strokeWidth="1.5"
          opacity={i <= level ? (level === 0 ? 0.5 : 1) : 0.18}/>
      ))}
    </svg>
  );
}

function WeatherSVG({ level, color }) {
  if (level === 3) return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="26" r="11" fill={color}/>
      {[0,45,90,135,180,225,270,315].map((deg, i) => {
        const r = deg * Math.PI / 180;
        return <line key={i} x1={26+15*Math.cos(r)} y1={26+15*Math.sin(r)} x2={26+21*Math.cos(r)} y2={26+21*Math.sin(r)} stroke={color} strokeWidth="2.5" strokeLinecap="round"/>;
      })}
    </svg>
  );
  if (level === 2) return (
    <svg width="54" height="48" viewBox="0 0 54 48" fill="none">
      <circle cx="36" cy="17" r="8" fill={color} opacity="0.75"/>
      {[0,45,90,135,180].map((deg, i) => {
        const r = deg * Math.PI / 180;
        return <line key={i} x1={36+11*Math.cos(r)} y1={17+11*Math.sin(r)} x2={36+15*Math.cos(r)} y2={17+15*Math.sin(r)} stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.7"/>;
      })}
      <ellipse cx="22" cy="34" rx="16" ry="10" fill="white" stroke={color} strokeWidth="1.5"/>
      <circle cx="14" cy="31" r="9" fill="white" stroke={color} strokeWidth="1.5"/>
      <circle cx="30" cy="29" r="8" fill="white" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
  if (level === 1) return (
    <svg width="54" height="42" viewBox="0 0 54 42" fill="none">
      <ellipse cx="27" cy="28" rx="20" ry="11" fill="white" stroke={color} strokeWidth="2" opacity="0.6"/>
      <circle cx="17" cy="25" r="10" fill="white" stroke={color} strokeWidth="2" opacity="0.7"/>
      <circle cx="36" cy="24" r="9" fill="white" stroke={color} strokeWidth="2" opacity="0.7"/>
      <ellipse cx="27" cy="32" rx="18" ry="9" fill="white" stroke={color} strokeWidth="2"/>
      <circle cx="17" cy="29" r="9" fill="white" stroke={color} strokeWidth="2"/>
      <circle cx="36" cy="28" r="8" fill="white" stroke={color} strokeWidth="2"/>
    </svg>
  );
  return (
    <svg width="54" height="52" viewBox="0 0 54 52" fill="none">
      <ellipse cx="27" cy="24" rx="21" ry="13" fill="white" stroke={color} strokeWidth="2" opacity="0.5"/>
      <circle cx="16" cy="21" r="10" fill="white" stroke={color} strokeWidth="2" opacity="0.6"/>
      <circle cx="37" cy="20" r="9" fill="white" stroke={color} strokeWidth="2" opacity="0.6"/>
      <path d="M28 34 L21 45 L27 43 L20 52" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function StarsSVG({ level, color }) {
  const pts = (cx) => `${cx},4 ${cx+3.5},12 ${cx+12},12 ${cx+5},17 ${cx+8},26 ${cx},21 ${cx-8},26 ${cx-5},17 ${cx-12},12 ${cx-3.5},12`;
  return (
    <svg width="76" height="30" viewBox="0 0 76 30" fill="none">
      {[0,1,2].map(i => (
        <polygon key={i} points={pts(13 + i * 25)}
          fill={i < level ? color : "transparent"}
          stroke={color} strokeWidth="1.5"
          opacity={i < level ? 1 : 0.25}/>
      ))}
    </svg>
  );
}

function RippleSVG({ level, color }) {
  const dots = [{ x:44, y:38 },{ x:37, y:30 },{ x:30, y:24 },{ x:26, y:26 }];
  const p = dots[level];
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="26" r="22" stroke={color} strokeWidth="1.5" opacity="0.18"/>
      <circle cx="26" cy="26" r="15" stroke={color} strokeWidth="1.5" opacity="0.32"/>
      <circle cx="26" cy="26" r="8"  stroke={color} strokeWidth="1.5" opacity="0.52"/>
      <circle cx="26" cy="26" r="3"  fill={color} opacity="0.6"/>
      <circle cx={p.x} cy={p.y} r="5"   fill={color}/>
      <circle cx={p.x} cy={p.y} r="8.5" stroke={color} strokeWidth="1.5" opacity="0.35"/>
    </svg>
  );
}

function JarSVG({ level, color }) {
  const fillY = [48, 38, 28, 14][level];
  return (
    <svg width="36" height="52" viewBox="0 0 36 52" fill="none">
      <defs>
        <clipPath id={`jc${level}`}>
          <path d="M4 13 Q4 9 9 9 L27 9 Q32 9 32 13 L32 46 Q32 50 27 50 L9 50 Q4 50 4 46 Z"/>
        </clipPath>
      </defs>
      <rect x="9" y="2" width="18" height="8" rx="3" fill={color} opacity="0.55"/>
      <path d="M4 13 Q4 9 9 9 L27 9 Q32 9 32 13 L32 46 Q32 50 27 50 L9 50 Q4 50 4 46 Z" fill="none" stroke={color} strokeWidth="2.2"/>
      {level > 0 && <rect x="4" y={fillY} width="28" height={52} fill={color} opacity="0.35" clipPath={`url(#jc${level})`}/>}
      <line x1="10" y1="15" x2="10" y2="44" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.35"/>
    </svg>
  );
}

function MoonSVG({ level, color }) {
  if (level === 3) return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="17" fill={color} opacity="0.85"/>
      <circle cx="7"  cy="11" r="2"   fill={color} opacity="0.45"/>
      <circle cx="40" cy="9"  r="1.5" fill={color} opacity="0.4"/>
      <circle cx="41" cy="35" r="2"   fill={color} opacity="0.45"/>
      <circle cx="6"  cy="38" r="1.5" fill={color} opacity="0.35"/>
    </svg>
  );
  const clipW = [7, 14, 22, 34][level];
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <defs>
        <clipPath id={`mc${level}`}>
          <rect x={24 - clipW/2} y="6" width={clipW} height="36"/>
        </clipPath>
      </defs>
      <circle cx="24" cy="24" r="17" fill="transparent" stroke={color} strokeWidth="1.5" opacity="0.25"/>
      <circle cx="24" cy="24" r="17" fill={color} opacity="0.82" clipPath={`url(#mc${level})`}/>
      <circle cx="9"  cy="13" r="1.5" fill={color} opacity="0.38"/>
      <circle cx="38" cy="11" r="2"   fill={color} opacity="0.32"/>
    </svg>
  );
}

function MountainSVG({ level, color }) {
  const dots = [{ x:26, y:44 },{ x:25, y:34 },{ x:24, y:22 },{ x:24, y:11 }];
  const p = dots[level];
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <path d="M2 48 L24 4 L46 48 Z" fill={color} opacity="0.15" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
      <path d="M25 46 L24 34 L24 12" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" strokeLinecap="round"/>
      {level === 3 && <>
        <line x1="24" y1="4" x2="24" y2="0" stroke={color} strokeWidth="1.5"/>
        <polygon points="24,0 30,3 24,6" fill={color}/>
      </>}
      <circle cx={p.x} cy={p.y} r="5.5" fill={color}/>
      <circle cx={p.x} cy={p.y} r="9"   stroke={color} strokeWidth="1.5" opacity="0.32"/>
    </svg>
  );
}

// ── Quiz metadata: playful questions + companion reactions + SVG visuals ───────
const QUIZ_META = {
  energy: {
    friendlyQ: "What's your battery at right now?",
    visual: (score, color) => <BatterySVG level={score} color={color} />,
    reactions: [
      "Even a dim light is still a light.",
      "Running low but still running. That counts.",
      "Steady is more than it sounds.",
      "This energy is real. Carry it with you.",
    ],
  },
  mood: {
    friendlyQ: "Today's weather report?",
    visual: (score, color) => <WeatherSVG level={score} color={color} />,
    reactions: [
      "Heavy days deserve space. I'm here.",
      "Up and down is still movement.",
      "Calm is its own kind of okay.",
      "Something genuinely good is alive in you.",
    ],
  },
  meaning: {
    friendlyQ: "How many stars lit up today?",
    visual: (score, color) => <StarsSVG level={score} color={color} />,
    reactions: [
      "Going through the motions still takes strength.",
      "Unclear days are part of it too.",
      "Small moments are real moments.",
      "Something real touched you today.",
    ],
  },
  connection: {
    friendlyQ: "How close do you feel to the people you love?",
    visual: (score, color) => <RippleSVG level={score} color={color} />,
    reactions: [
      "Loneliness is loud. You showed up here.",
      "Distance is temporary.",
      "In-between is a real place to be.",
      "Being seen is rare. Notice it.",
    ],
  },
  accomplishment: {
    friendlyQ: "How full is today's jar?",
    visual: (score, color) => <JarSVG level={score} color={color} />,
    reactions: [
      "Starting is sometimes the whole victory.",
      "The basics are the foundation.",
      "Forward is forward, no matter the speed.",
      "That pride is yours. Nobody can take it.",
    ],
  },
  sleep: {
    friendlyQ: "Last night's moon?",
    visual: (score, color) => <MoonSVG level={score} color={color} />,
    reactions: [
      "Your body is asking for rest. Be gentle.",
      "Restless nights are heavy. You carried it.",
      "Good enough sleep is genuinely good.",
      "Deep rest is a gift.",
    ],
  },
  resilience: {
    friendlyQ: "Where are you on the mountain today?",
    visual: (score, color) => <MountainSVG level={score} color={color} />,
    reactions: [
      "Too much at once is real. You're still here.",
      "Pushing through is its own kind of strength.",
      "Handling it is more than it sounds.",
      "Steady and capable — that's the whole thing.",
    ],
  },
};

// Singletons — created once per module load
const detector  = new EmotionDetector();
const journalist = new AIJournalist();

// ── WellnessView ──────────────────────────────────────────────────────────────

export default function WellnessView({
  emotion, setEmotion,
  journalEntries, setJournalEntries,
  character, coins, setCoins,
  player,
}) {
  const [view, setView]                   = useState("journal");
  const [draft, setDraft]                 = useState("");
  const [analyzing, setAnalyzing]         = useState(false);
  const [aiResult, setAiResult]           = useState(null);
  const [companionResponse, setCompanion] = useState(null);
  const [confirmStage, setConfirmStage]   = useState(null); // null | "confirm" | "pick"
  const [pendingEntry, setPendingEntry]   = useState(null);

  const [quizIdx, setQuizIdx]         = useState(0);
  const [quizDone, setQuizDone]       = useState(false);
  const [quizScore, setQuizScore]     = useState(0);
  const [quizEmot, setQuizEmot]       = useState(null);
  const [quizVotes, setQuizVotes]     = useState({});
  const [quizAnalyzing, setQuizAnalyzing] = useState(false);
  const [quizReacting, setQuizReacting]     = useState(false);
  const [lastReaction, setLastReaction]     = useState(null);
  const [selectedOptIdx, setSelectedOptIdx] = useState(null);

  const memory   = useMemo(() => new JournalMemory(journalEntries), [journalEntries]);
  const timeline = useMemo(() => memory.getTimeline(14), [memory]);
  const summary  = useMemo(() => memory.getWeekSummary(), [memory]);

  const currentEmotion  = getEmotionStyle(emotion);
  const detectedEmotion = aiResult ? getEmotionStyle(aiResult.emotion) : null;

  // ── Journal: submit and analyse ─────────────────────────────────────────────
  async function analyzeEntry(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || analyzing) return;

    setAnalyzing(true);
    setAiResult(null);
    setCompanion(null);
    setConfirmStage(null);

    // Deep subtext analysis (synchronous)
    const detectorResult = detector.analyze(text, journalEntries);

    // Neural emotion signal (HuggingFace) + conversational response (Gemini/fallback)
    const [hfResult, response] = await Promise.all([
      analyzeEmotionAI(text),
      journalist.generateResponse(text, detectorResult, journalEntries, player?.name),
    ]);

    // Merge: EmotionDetector provides subtext context, Gemini provides neural signal
    let merged = mergeAnalysis(detectorResult, hfResult ?? { emotion: "neutral", confidence: 50, source: "fallback" });

    // Gemini read the raw text itself — if it detected an emotion, it takes priority
    if (response?.emotion) {
      merged = { ...merged, emotion: response.emotion, confidence: Math.max(merged.confidence, 80) };
    }

    const entry = {
      id:         crypto.randomUUID(),
      date:       new Date().toISOString().slice(0, 10),
      text,
      emotion:    merged.emotion,
      confidence: merged.confidence,
      source:     hfResult ? "ai" : "local",
      trajectory: merged.trajectory?.trend,
    };

    setAiResult(merged);
    setCompanion(response);
    setPendingEntry(entry);
    setConfirmStage("confirm");
    setAnalyzing(false);
  }

  function mergeAnalysis(detectorResult, hfResult) {
    // If EmotionDetector found subtext that overrode the base scan, trust it
    if (detectorResult.overrideReason) return detectorResult;
    // Both agree with high confidence → boost
    if (hfResult.confidence > 74 && hfResult.emotion === detectorResult.emotion) {
      return { ...detectorResult, confidence: Math.min(92, detectorResult.confidence + 8) };
    }
    // They disagree → lower confidence, note for verification
    if (hfResult.emotion !== detectorResult.emotion && hfResult.confidence > 68) {
      return { ...detectorResult, confidence: Math.max(54, detectorResult.confidence - 8), needsVerification: true };
    }
    return detectorResult;
  }

  function acceptEmotion() {
    if (!pendingEntry) return;
    setJournalEntries((prev) => [pendingEntry, ...prev]);
    setEmotion(pendingEntry.emotion);
    setDraft("");
    setConfirmStage(null);
    setPendingEntry(null);
    setAiResult(null);
    setCompanion(null);
    if (setCoins) setCoins((c) => c + 15);
  }

  function rejectEmotion() {
    setConfirmStage("pick");
  }

  function selectAlternativeEmotion(alt) {
    if (!pendingEntry) return;
    const corrected = { ...pendingEntry, emotion: alt, source: "manual" };
    setJournalEntries((prev) => [corrected, ...prev]);
    setEmotion(alt);
    setDraft("");
    setConfirmStage(null);
    setPendingEntry(null);
    setAiResult(null);
    setCompanion(null);
    if (setCoins) setCoins((c) => c + 15);
  }

  // ── Quiz: answer question ────────────────────────────────────────────────────
  async function answerQuiz(opt) {
    const votes = { ...quizVotes, [QUIZ[quizIdx].id]: opt.emotion };
    const running = quizScore + opt.score;
    setQuizVotes(votes);

    if (quizIdx < QUIZ.length - 1) {
      setQuizIdx((i) => i + 1);
      setQuizScore(running);
      return;
    }

    // Fallback: most voted emotion, adjusted by wellbeing score
    const counts = {};
    Object.values(votes).forEach((em) => { counts[em] = (counts[em] ?? 0) + 1; });
    let fallbackEmotion = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    if (running <= 8 && !["sad", "anxious", "tired"].includes(fallbackEmotion)) {
      fallbackEmotion = "tired";
    } else if (running >= 18 && ["sad", "tired"].includes(fallbackEmotion)) {
      fallbackEmotion = "content";
    }

    setQuizScore(running);
    setQuizDone(true);
    setQuizEmot(fallbackEmotion); // Show immediately while Gemini runs

    // Build a human-readable summary of the quiz answers for Gemini
    const quizLines = QUIZ.map((q) => {
      const votedEm = votes[q.id];
      const chosen = q.opts.find((o) => o.emotion === votedEm);
      return `${q.dimension}: "${chosen?.label ?? votedEm}" — ${chosen?.desc ?? ""}`;
    }).join("\n");
    const summaryText = `Wellbeing score: ${running}/${QUIZ.length * 3}\n\n${quizLines}`;

    setQuizAnalyzing(true);
    const geminiEmotion = await journalist.detectEmotion(summaryText, journalEntries);
    setQuizAnalyzing(false);

    const finalEmotion = geminiEmotion ?? fallbackEmotion;
    setQuizEmot(finalEmotion);
    setEmotion(finalEmotion);

    setJournalEntries((prev) => [{
      id:         crypto.randomUUID(),
      date:       new Date().toISOString().slice(0, 10),
      text:       "Daily check-in completed.",
      emotion:    finalEmotion,
      confidence: geminiEmotion ? 85 : 76,
      source:     "checkin",
    }, ...prev]);
    if (setCoins) setCoins((c) => c + 10);
  }

  function resetQuiz() {
    setQuizIdx(0);
    setQuizDone(false);
    setQuizEmot(null);
    setQuizVotes({});
    setQuizScore(0);
    setQuizAnalyzing(false);
    setQuizReacting(false);
    setLastReaction(null);
    setSelectedOptIdx(null);
  }

  function handleQuizTap(opt) {
    if (quizReacting) return;
    const meta = QUIZ_META[QUIZ[quizIdx].id];
    setSelectedOptIdx(opt.score);
    setLastReaction({ text: meta?.reactions?.[opt.score] ?? "", score: opt.score });
    setQuizReacting(true);
    setTimeout(() => {
      setQuizReacting(false);
      setSelectedOptIdx(null);
      setLastReaction(null);
      answerQuiz(opt);
    }, 1150);
  }

  const wellbeingBand = WELLBEING_BANDS.find(b => (quizScore || 0) <= b.max) ?? WELLBEING_BANDS[2];
  const todayJournalled = journalEntries.some(e => e.date === new Date().toISOString().slice(0, 10));

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="page-container anim-fade-in">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="page-hero" style={{ "--hero-color": currentEmotion.color }}>
        <div className="hero-text">
          <div className="hero-label">Reflect</div>
          <div className="hero-title" style={{ fontSize: "1.45rem" }}>
            Your companion<br />listens with you.
          </div>
          <p className="hero-desc" style={{ marginTop: 6 }}>
            Write freely. Your companion reads between the lines — gently, without judgment.
          </p>
          <div style={{ marginTop: 14 }}>
            <EmotionBadge emotion={emotion} />
            {summary.streak > 1 && (
              <span style={{
                marginLeft: 10, fontSize: "0.78rem", fontWeight: 700,
                color: currentEmotion.color, opacity: 0.85,
              }}>
                {summary.streak}-day streak
              </span>
            )}
          </div>
        </div>
        <div className="hero-character">
          <Animal3D emotion={emotion} {...character} />
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="cat-tabs">
        <button
          className={`cat-tab${view === "journal" ? " active" : ""}`}
          onClick={() => { setView("journal"); setConfirmStage(null); }}
        >Journal</button>
        <button
          className={`cat-tab${view === "checkin" ? " active" : ""}`}
          onClick={() => setView("checkin")}
        >Daily Check-in</button>
        <button
          className={`cat-tab${view === "journey" ? " active" : ""}`}
          onClick={() => setView("journey")}
        >My Journey</button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          JOURNAL VIEW
      ════════════════════════════════════════════════════════════════════════ */}
      {view === "journal" && (
        <>
          {/* ── AI companion response + emotion confirmation ──────────────── */}
          {confirmStage === "confirm" && detectedEmotion && aiResult && (
            <div
              className="card anim-pop-in"
              style={{
                background:  `linear-gradient(135deg, ${detectedEmotion.color}16, ${detectedEmotion.color}05)`,
                borderColor: detectedEmotion.color + "40",
                borderWidth:  2,
              }}
            >
              {/* Companion message */}
              {companionResponse && (
                <div style={{
                  display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18,
                  paddingBottom: 18,
                  borderBottom: `1px solid ${detectedEmotion.color}20`,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 15, flexShrink: 0,
                    background: detectedEmotion.color + "22",
                    border: `2px solid ${detectedEmotion.color}40`,
                    display: "grid", placeItems: "center", fontSize: "1.3rem",
                  }}>
                    {EMOTION_SYMBOL[aiResult.emotion] ?? "○"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Your companion
                    </div>
                    <p style={{
                      fontSize: "0.94rem", lineHeight: 1.72,
                      color: "var(--text-1)", margin: 0,
                      fontStyle: "normal",
                    }}>
                      {companionResponse.text}
                    </p>
                    {(companionResponse.source === "gemini" || companionResponse.source === "groq" || companionResponse.source === "claude") && (
                      <div style={{ fontSize: "0.68rem", color: "var(--text-3)", marginTop: 6 }}>
                        Powered by {companionResponse.source === "gemini" ? "Gemini" : companionResponse.source === "groq" ? "Groq" : "Claude"}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Emotion confirmation */}
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: "1rem", marginBottom: 6, lineHeight: 1.3 }}>
                    I'm sensing{" "}
                    <span style={{ color: detectedEmotion.color }}>
                      {aiResult?.emotion && !EMOTIONS[aiResult.emotion]
                        ? aiResult.emotion
                        : detectedEmotion.label}
                    </span>.
                    {" "}Does that land right?
                  </div>

                  {aiResult.maskingDetected && (
                    <p style={{
                      fontSize: "0.82rem", color: "var(--text-2)", marginBottom: 10,
                      lineHeight: 1.58, padding: "9px 13px",
                      background: "rgba(255,255,255,0.55)",
                      borderRadius: 10,
                      borderLeft: `3px solid ${detectedEmotion.color}60`,
                    }}>
                      I noticed some 'fine' language in there — just want to check in. Sometimes we say we're okay before we've had a chance to feel what's actually there.
                    </p>
                  )}

                  {aiResult.trajectory?.trend && aiResult.trajectory.trend !== "unknown" && journalEntries.length >= 3 && (
                    <p style={{ fontSize: "0.79rem", color: "var(--text-3)", marginBottom: 10 }}>
                      Trajectory: {aiResult.trajectory.label}
                    </p>
                  )}

                  <div style={{ fontSize: "0.74rem", color: "var(--text-3)", marginBottom: 14 }}>
                    {aiResult.confidence}% confidence
                    {aiResult.confidence < 65 && " · Not fully certain — let me know if I'm off."}
                    {aiResult.overrideReason && ` · ${aiResult.overrideReason}`}
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="btn-primary"
                      onClick={acceptEmotion}
                      style={{ background: `linear-gradient(135deg, ${detectedEmotion.color}, ${detectedEmotion.color}bb)` }}
                    >
                      Yes, that's right
                    </button>
                    <button className="btn-secondary" onClick={rejectEmotion}>
                      Not quite
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Emotion picker (when user rejects AI read) ────────────────── */}
          {confirmStage === "pick" && (
            <div className="card anim-pop-in">
              <div className="card-header">
                <div>
                  <div className="card-title">How would you describe it?</div>
                  <div className="card-sub">Choose what feels most true right now.</div>
                </div>
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 10,
              }}>
                {Object.entries(EMOTIONS).map(([key, em]) => (
                  <button
                    key={key}
                    onClick={() => selectAlternativeEmotion(key)}
                    style={{
                      padding: "14px 12px", borderRadius: 16,
                      border: `2px solid ${em.color}30`,
                      background: em.color + "12", cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                      transition: "all 0.18s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background   = em.color + "28";
                      e.currentTarget.style.borderColor  = em.color;
                      e.currentTarget.style.transform    = "translateY(-3px)";
                      e.currentTarget.style.boxShadow    = `0 6px 20px ${em.color}30`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background   = em.color + "12";
                      e.currentTarget.style.borderColor  = em.color + "30";
                      e.currentTarget.style.transform    = "";
                      e.currentTarget.style.boxShadow    = "";
                    }}
                  >
                    <span style={{ fontSize: "1.6rem" }}>{EMOTION_SYMBOL[key] ?? "○"}</span>
                    <span style={{ fontWeight: 800, fontSize: "0.88rem", color: em.color }}>{em.label}</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-3)", textAlign: "center", lineHeight: 1.3 }}>
                      {WELLNESS_PROMPTS[key]?.split(".")[0] ?? ""}
                    </span>
                  </button>
                ))}
              </div>
              <button className="btn-secondary" style={{ marginTop: 14 }} onClick={() => setConfirmStage("confirm")}>
                ← Back
              </button>
            </div>
          )}

          {/* ── Journal form ──────────────────────────────────────────────── */}
          {!confirmStage && (
            <div className="card anim-fade-in">
              <div className="card-header">
                <div>
                  <div className="card-title">Today's Entry</div>
                  <div className="card-sub">Saved privately · +15 coins per entry</div>
                </div>
                <EmotionBadge emotion={emotion} />
              </div>

              <form onSubmit={analyzeEntry}>
                <textarea
                  className="journal-textarea"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write what's on your mind. Your companion will read between the lines, not just the surface..."
                  rows={6}
                />
                <div className="journal-form-footer">
                  {analyzing && (
                    <div className="ai-analyzing">
                      <span>Your companion is listening</span>
                      <div className="ai-dots"><span /><span /><span /></div>
                    </div>
                  )}
                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={!draft.trim() || analyzing}
                    style={{ opacity: (!draft.trim() || analyzing) ? 0.6 : 1 }}
                  >
                    {analyzing ? "Reading..." : "Share with companion"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Recent entries (last 5 in journal tab) ───────────────────── */}
          {journalEntries.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Recent Entries</div>
                  <div className="card-sub">{journalEntries.length} total · see all in My Journey</div>
                </div>
              </div>
              <div className="entry-list">
                {journalEntries.slice(0, 5).map((entry) => {
                  const em = getEmotionStyle(entry.emotion);
                  return (
                    <article
                      key={entry.id}
                      className="entry-card"
                      style={{ "--accent-color": em.color }}
                    >
                      <div className="entry-card-top">
                        <span className="entry-date">{entry.date}</span>
                        <span className="entry-emotion-tag">{em.label}</span>
                      </div>
                      {entry.source !== "checkin" && (
                        <p className="entry-text">{entry.text}</p>
                      )}
                      <div className="entry-meta">
                        {entry.source === "ai"       && "AI-analysed"}
                        {entry.source === "checkin"  && "Daily check-in"}
                        {entry.source === "manual"   && "You corrected this"}
                        {entry.source === "local"    && "Local analysis"}
                        {entry.confidence != null && ` · ${entry.confidence}% confidence`}
                        {entry.trajectory === "improving" && " · trajectory improving"}
                        {entry.trajectory === "declining" && " · harder stretch"}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          DAILY CHECK-IN VIEW
      ════════════════════════════════════════════════════════════════════════ */}
      {view === "checkin" && !quizDone && (
        <div className="card anim-fade-in" style={{ padding: "22px 20px 24px" }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {quizIdx + 1} / {QUIZ.length}
            </span>
            <span style={{
              fontSize: "0.7rem", fontWeight: 700,
              color: currentEmotion.color,
              background: currentEmotion.color + "18",
              padding: "3px 12px", borderRadius: 999,
              border: `1px solid ${currentEmotion.color}30`,
            }}>
              {QUIZ[quizIdx].dimension}
            </span>
          </div>

          {/* Segmented progress bar */}
          <div style={{ display: "flex", gap: 5, marginBottom: 24 }}>
            {QUIZ.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 7, borderRadius: 999,
                background: i < quizIdx
                  ? currentEmotion.color
                  : i === quizIdx
                  ? currentEmotion.color + "50"
                  : "var(--bg-2)",
                transition: "background 0.4s cubic-bezier(0.22,1,0.36,1)",
              }}/>
            ))}
          </div>

          {/* Question */}
          <div style={{ fontSize: "1.28rem", fontWeight: 900, color: "var(--text)", marginBottom: 22, lineHeight: 1.25 }}>
            {QUIZ_META[QUIZ[quizIdx].id]?.friendlyQ ?? QUIZ[quizIdx].q}
          </div>

          {/* 2×2 visual option cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
            {QUIZ[quizIdx].opts.map((opt) => {
              const meta   = QUIZ_META[QUIZ[quizIdx].id];
              const oColor = getEmotionStyle(opt.emotion).color;
              const isSel  = selectedOptIdx === opt.score;
              return (
                <button
                  key={opt.label}
                  className={`quiz-visual-card${isSel ? " selected" : ""}`}
                  onClick={() => handleQuizTap(opt)}
                  disabled={quizReacting}
                  style={isSel ? {
                    borderColor: oColor,
                    background: oColor + "1a",
                    boxShadow: `0 0 0 3px ${oColor}28`,
                  } : {}}
                >
                  <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {meta?.visual(opt.score, oColor)}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "0.88rem", color: isSel ? oColor : "var(--text)", lineHeight: 1.2 }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: "0.67rem", color: "var(--text-3)", lineHeight: 1.3 }}>
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Micro-reaction panel — slides up from bottom after each answer */}
      {view === "checkin" && !quizDone && quizReacting && lastReaction && (
        <div
          className="quiz-reaction-panel"
          style={{
            background: lastReaction.score >= 2
              ? `linear-gradient(135deg, ${currentEmotion.color}f2, ${currentEmotion.color}cc)`
              : lastReaction.score === 1
              ? "linear-gradient(135deg, #6B7A8D, #4E5D6C)"
              : "linear-gradient(135deg, #5E6470, #404550)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, maxWidth: 560, margin: "0 auto" }}>
            <div style={{ fontSize: "1.45rem", flexShrink: 0, opacity: 0.9 }}>
              {lastReaction.score === 3 ? "✦" : lastReaction.score === 2 ? "♦" : lastReaction.score === 1 ? "〜" : "○"}
            </div>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: "0.94rem", lineHeight: 1.5, margin: 0 }}>
              {lastReaction.text}
            </p>
          </div>
        </div>
      )}

      {/* ── Check-in complete — celebration screen ────────────────────── */}
      {view === "checkin" && quizDone && (
        <div className="card anim-pop-in" style={{ textAlign: "center", padding: "32px 22px 28px", position: "relative", overflow: "hidden" }}>
          {/* Background confetti dots */}
          {[...Array(7)].map((_, i) => (
            <div key={i} style={{
              position: "absolute", borderRadius: "50%",
              width: 8 + (i % 3) * 5, height: 8 + (i % 3) * 5,
              background: EMOTIONS[quizEmot]?.color ?? "#74B3CE",
              opacity: 0.08 + i * 0.025,
              top: `${8 + (i * 14) % 78}%`,
              left: `${4 + (i * 27) % 88}%`,
              animation: `breathe ${2.5 + i * 0.35}s ease-in-out ${i * 0.18}s infinite`,
              pointerEvents: "none",
            }}/>
          ))}

          {/* Radiating rings + emotion symbol */}
          <div style={{ position: "relative", width: 112, height: 112, margin: "0 auto 22px" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: `2px solid ${EMOTIONS[quizEmot]?.color ?? "#74B3CE"}`,
                animation: `ring-expand 2s ease-out ${i * 0.5}s infinite`,
              }}/>
            ))}
            <div style={{
              width: 112, height: 112, borderRadius: "50%",
              background: (EMOTIONS[quizEmot]?.color ?? "#74B3CE") + "20",
              border: `3px solid ${EMOTIONS[quizEmot]?.color ?? "#74B3CE"}55`,
              display: "grid", placeItems: "center",
              fontSize: "3rem",
              animation: "breathe 3s ease-in-out infinite",
            }}>
              {EMOTION_SYMBOL[quizEmot] ?? "♦"}
            </div>
          </div>

          <div style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: 10, color: "var(--text)", animation: "celebration-bounce 0.55s cubic-bezier(0.22,1,0.36,1) forwards" }}>
            Check-in complete
          </div>

          {/* Coin reward badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "linear-gradient(135deg, #F4D580, #D4A853)",
            color: "#5A3A08", fontWeight: 800, fontSize: "0.88rem",
            padding: "5px 18px", borderRadius: 999, marginBottom: 18,
            boxShadow: "0 3px 12px rgba(212,168,83,0.4)",
          }}>
            <span style={{ width: 13, height: 13, borderRadius: "50%", background: "#A8803A", display: "inline-block", boxShadow: "inset 0 -1px 3px rgba(0,0,0,0.2)" }}/>
            +10 coins earned
          </div>

          {quizAnalyzing && (
            <div className="ai-analyzing" style={{ justifyContent: "center", marginBottom: 12 }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>Reading the full picture</span>
              <div className="ai-dots"><span /><span /><span /></div>
            </div>
          )}

          {/* Wellbeing band pill */}
          <div style={{ marginBottom: 14 }}>
            <span style={{
              display: "inline-block", padding: "5px 20px", borderRadius: 999,
              background: (EMOTIONS[wellbeingBand.emotion]?.color ?? "#888") + "20",
              color: EMOTIONS[wellbeingBand.emotion]?.color ?? "#888",
              fontSize: "0.8rem", fontWeight: 900,
              border: `1.5px solid ${EMOTIONS[wellbeingBand.emotion]?.color ?? "#888"}40`,
            }}>
              {wellbeingBand.label}
            </span>
          </div>

          <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 14 }}>
            You're feeling{" "}
            <strong style={{ color: EMOTIONS[quizEmot]?.color ?? "var(--text-1)" }}>
              {EMOTIONS[quizEmot]?.label ?? quizEmot}
            </strong>{" "}today.
          </p>

          <div style={{
            background: (EMOTIONS[quizEmot]?.color ?? "#74B3CE") + "12",
            border: `1.5px solid ${EMOTIONS[quizEmot]?.color ?? "#74B3CE"}30`,
            borderRadius: 16, padding: "14px 18px",
            maxWidth: 300, margin: "0 auto 16px",
          }}>
            <p style={{ color: "var(--text-2)", fontSize: "0.88rem", lineHeight: 1.72, fontStyle: "italic", margin: 0 }}>
              "{wellbeingBand.message}"
            </p>
          </div>

          <p style={{ fontSize: "0.74rem", color: "var(--text-3)", marginBottom: 18 }}>
            {quizScore}/{QUIZ.length * 3} across {QUIZ.length} dimensions
          </p>

          <EmotionBadge emotion={quizEmot} size="large" />

          <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-secondary" onClick={resetQuiz}>Check in again</button>
            <button className="btn-primary" onClick={() => setView("journey")}>See my journey</button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MY JOURNEY VIEW
      ════════════════════════════════════════════════════════════════════════ */}
      {view === "journey" && (
        <>
          {/* Streak + week summary */}
          <div className="card anim-pop-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="card-title">Your Streak</div>
                <div className="card-sub">
                  {summary.streak > 0
                    ? `${summary.streak} day${summary.streak !== 1 ? "s" : ""} in a row`
                    : "Start today to build your streak"}
                </div>
              </div>
              <div style={{
                width: 58, height: 58, borderRadius: 18,
                background: currentEmotion.color + "20",
                border: `2px solid ${currentEmotion.color}40`,
                display: "grid", placeItems: "center",
                fontSize: "1.55rem", fontWeight: 900, color: currentEmotion.color,
              }}>
                {summary.streak}
              </div>
            </div>

            {summary.dominant && (
              <div style={{
                marginTop: 14, padding: "12px 14px", borderRadius: 12,
                background: (EMOTIONS[summary.dominant]?.color ?? "#888") + "12",
              }}>
                <div style={{ fontSize: "0.78rem", color: "var(--text-2)", marginBottom: 3 }}>
                  Most felt this week
                </div>
                <EmotionBadge emotion={summary.dominant} />
              </div>
            )}
          </div>

          {/* 14-day dot timeline */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Last 14 Days</div>
                <div className="card-sub">
                  {summary.totalEntries} total {summary.totalEntries === 1 ? "entry" : "entries"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
              {timeline.map(({ date, weekday, entry }) => {
                const em = entry ? getEmotionStyle(entry.emotion) : null;
                return (
                  <div
                    key={date}
                    title={entry ? `${date}: ${em?.label}` : date}
                    style={{ textAlign: "center", width: 38 }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%",
                      background: em ? em.color + "35" : "var(--border)",
                      border: `2px solid ${em ? em.color + "80" : "transparent"}`,
                      display: "grid", placeItems: "center",
                      fontSize: "0.75rem", color: em ? em.color : "var(--text-3)",
                      margin: "0 auto 4px",
                      transition: "all 0.2s",
                    }}>
                      {em ? (EMOTION_SYMBOL[entry.emotion] ?? "○") : ""}
                    </div>
                    <div style={{ fontSize: "0.58rem", color: "var(--text-3)", letterSpacing: "0.01em" }}>
                      {weekday}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              {Object.entries(EMOTIONS).slice(0, 5).map(([key, em]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: em.color }} />
                  <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{em.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Growth moments */}
          {summary.growthMoments.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Growth Moments</div>
                  <div className="card-sub">Times you found your way back</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                {summary.growthMoments.map((m, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 12,
                    background: "rgba(0,0,0,0.02)",
                  }}>
                    <EmotionBadge emotion={m.from} />
                    <span style={{ color: "var(--text-3)", fontSize: "0.9rem" }}>→</span>
                    <EmotionBadge emotion={m.to} />
                    <span style={{ fontSize: "0.75rem", color: "var(--text-3)", marginLeft: "auto" }}>
                      {m.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All entries */}
          {journalEntries.length > 0 ? (
            <div className="card">
              <div className="card-header">
                <div className="card-title">All Entries</div>
              </div>
              <div className="entry-list">
                {journalEntries.map((entry) => {
                  const em = getEmotionStyle(entry.emotion);
                  return (
                    <article
                      key={entry.id}
                      className="entry-card"
                      style={{ "--accent-color": em.color }}
                    >
                      <div className="entry-card-top">
                        <span className="entry-date">{entry.date}</span>
                        <EmotionBadge emotion={entry.emotion} />
                      </div>
                      {entry.source !== "checkin" && entry.text && (
                        <p className="entry-text">{entry.text}</p>
                      )}
                      {entry.source === "checkin" && (
                        <p className="entry-text" style={{ opacity: 0.55, fontStyle: "italic" }}>
                          Daily check-in
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>○</div>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>No entries yet</div>
              <p style={{ color: "var(--text-2)", fontSize: "0.88rem" }}>
                Write your first journal entry or complete a daily check-in to begin your journey.
              </p>
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setView("journal")}>
                Write your first entry
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Companion tip card ──────────────────────────────────────────────── */}
      {!confirmStage && (
        <div
          className="card"
          style={{
            background:  `linear-gradient(135deg, ${currentEmotion.color}14, ${currentEmotion.color}05)`,
            borderColor: currentEmotion.color + "30",
          }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{
              width: 48, height: 48, borderRadius: 15,
              background: currentEmotion.color + "22",
              border: `2px solid ${currentEmotion.color}30`,
              display: "grid", placeItems: "center", flexShrink: 0,
              fontSize: "1.4rem",
            }}>
              {EMOTION_SYMBOL[emotion] ?? "○"}
            </div>
            <div>
              <div style={{ fontWeight: 800, marginBottom: 5, fontSize: "0.95rem" }}>
                Your companion senses
              </div>
              <p style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>
                {WELLNESS_PROMPTS[emotion] ?? "Every feeling is valid. Notice it, name it, let your companion hold it with you."}
              </p>
              {todayJournalled && (
                <p style={{
                  fontSize: "0.8rem", color: "var(--text-3)", marginTop: 8,
                  fontStyle: "italic",
                }}>
                  You journalled today. The world knows something shifted.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
