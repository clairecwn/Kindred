import { useState, useEffect, useMemo } from "react";
import Animal3D from "./Animal3D.jsx";
import { analyzeEmotionAI, analyzeEmotionLocal } from "../lib/emotion-api.js";
import { EmotionDetector, AIJournalist, JournalMemory } from "../lib/journal-ai.js";
import { EMOTIONS } from "../utils/emotion.js";

// ── Evidence-based daily quiz ─────────────────────────────────────────────────
// Questions derived from PHQ-2, GAD-2, WHO-5 Well-Being Index, PSQI, and PANAS.
// Adapted to feel warm and conversational rather than clinical.
const QUIZ = [
  {
    id: "interest",
    q: "Over the last day or two, how often have you noticed little interest in things you'd normally enjoy?",
    dimension: "interest & pleasure",
    opts: [
      { label: "Not really",     desc: "I've felt present and engaged",    emotion: "content",  score: 3 },
      { label: "A little",       desc: "Some moments felt flat",           emotion: "neutral",  score: 2 },
      { label: "Quite often",    desc: "Hard to find things that matter",  emotion: "tired",    score: 1 },
      { label: "Almost always",  desc: "Nothing's been reaching me",       emotion: "sad",      score: 0 },
    ],
  },
  {
    id: "mood",
    q: "Have you been feeling down, heavy, or without much hope?",
    dimension: "mood & hope",
    opts: [
      { label: "Not at all",     desc: "I've felt okay",                   emotion: "content",  score: 3 },
      { label: "A couple times", desc: "A few low moments",                emotion: "neutral",  score: 2 },
      { label: "Quite a bit",    desc: "More often than not",              emotion: "sad",      score: 1 },
      { label: "Most of the time",desc: "Hard to shake",                   emotion: "sad",      score: 0 },
    ],
  },
  {
    id: "worry",
    q: "How much have anxious thoughts or worry taken up space in your mind?",
    dimension: "anxiety & worry",
    opts: [
      { label: "Very little",    desc: "Mind has felt clear",              emotion: "calm",     score: 3 },
      { label: "A bit",          desc: "Some background noise",            emotion: "neutral",  score: 2 },
      { label: "Quite a lot",    desc: "Hard to quiet it down",            emotion: "anxious",  score: 1 },
      { label: "Constantly",     desc: "It's been overwhelming",           emotion: "anxious",  score: 0 },
    ],
  },
  {
    id: "energy",
    q: "How would you describe your energy and vitality right now?",
    dimension: "energy & vitality",
    opts: [
      { label: "Drained",        desc: "Running on empty",                 emotion: "tired",    score: 0 },
      { label: "Low",            desc: "A little flat",                    emotion: "tired",    score: 1 },
      { label: "Steady",         desc: "Getting through it okay",          emotion: "neutral",  score: 2 },
      { label: "Alive",          desc: "Full and present",                 emotion: "excited",  score: 3 },
    ],
  },
  {
    id: "sleep",
    q: "How did you rest last night?",
    dimension: "sleep quality",
    opts: [
      { label: "Barely",         desc: "Very little sleep",                emotion: "tired",    score: 0 },
      { label: "Restlessly",     desc: "On and off all night",             emotion: "anxious",  score: 1 },
      { label: "Okay",           desc: "Well enough",                      emotion: "neutral",  score: 2 },
      { label: "Deeply",         desc: "Woke up restored",                 emotion: "calm",     score: 3 },
    ],
  },
  {
    id: "connection",
    q: "How connected do you feel to the people in your life right now?",
    dimension: "social connection",
    opts: [
      { label: "Very alone",     desc: "Quite cut off",                    emotion: "sad",      score: 0 },
      { label: "Distant",        desc: "A little disconnected",            emotion: "sad",      score: 1 },
      { label: "Okay",           desc: "Neither here nor there",           emotion: "neutral",  score: 2 },
      { label: "Seen",           desc: "Genuinely close to someone",       emotion: "grateful", score: 3 },
    ],
  },
  {
    id: "body",
    q: "What is your body telling you right now?",
    dimension: "somatic awareness",
    opts: [
      { label: "Heavy & tight",  desc: "Tension throughout",               emotion: "anxious",  score: 0 },
      { label: "A bit stiff",    desc: "Some discomfort",                  emotion: "tired",    score: 1 },
      { label: "Neutral",        desc: "Just here",                        emotion: "neutral",  score: 2 },
      { label: "Light & open",   desc: "Relaxed and grounded",             emotion: "calm",     score: 3 },
    ],
  },
  {
    id: "meaning",
    q: "Has today — even in small ways — felt like it matters?",
    dimension: "meaning & purpose",
    opts: [
      { label: "Hard to care",   desc: "Going through the motions",        emotion: "sad",      score: 0 },
      { label: "Not really",     desc: "Unclear",                          emotion: "neutral",  score: 1 },
      { label: "Sort of",        desc: "Some small moments",               emotion: "content",  score: 2 },
      { label: "Genuinely yes",  desc: "Something felt real today",        emotion: "grateful", score: 3 },
    ],
  },
];

// Wellbeing score ranges (0–24 from 8 questions × 0–3 each)
const WELLBEING_BANDS = [
  { max: 8,  label: "Struggling",   message: "I want to sit with this for a second. It's been a hard stretch — and I don't want to skip past that. How you've been feeling matters.", emotion: "sad" },
  { max: 16, label: "Navigating",   message: "You're navigating. Not soaring, not sinking — just moving through it. That's real and it counts.", emotion: "neutral" },
  { max: 24, label: "Flourishing",  message: "There's something quietly good happening for you right now. I don't want to rush past it — this is a good patch.", emotion: "happy" },
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

function EmotionBadge({ emotion, size = "normal" }) {
  const e   = EMOTIONS[emotion] ?? EMOTIONS.neutral;
  const pad = size === "large" ? "8px 18px" : "5px 14px";
  const fs  = size === "large" ? "0.95rem" : "0.82rem";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: pad, borderRadius: 999,
      background: e.color + "22", color: e.color,
      fontSize: fs, fontWeight: 800, border: `1.5px solid ${e.color}40`,
    }}>
      <span style={{ fontSize: size === "large" ? "1.1rem" : "0.9rem" }}>
        {EMOTION_SYMBOL[emotion] ?? "○"}
      </span>
      {e.label}
    </span>
  );
}

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

  const memory   = useMemo(() => new JournalMemory(journalEntries), [journalEntries]);
  const timeline = useMemo(() => memory.getTimeline(14), [memory]);
  const summary  = useMemo(() => memory.getWeekSummary(), [memory]);

  const currentEmotion  = EMOTIONS[emotion] ?? EMOTIONS.neutral;
  const detectedEmotion = aiResult ? (EMOTIONS[aiResult.emotion] ?? EMOTIONS.neutral) : null;

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

    // Merge: EmotionDetector has subtext context, HuggingFace has neural signal
    let merged = mergeAnalysis(detectorResult, hfResult || analyzeEmotionLocal(text));

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
                    {(companionResponse.source === "gemini" || companionResponse.source === "claude") && (
                      <div style={{ fontSize: "0.68rem", color: "var(--text-3)", marginTop: 6 }}>
                        Powered by {companionResponse.source === "gemini" ? "Gemini" : "Claude"}
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
                      {companionResponse?.nuancedEmotion || detectedEmotion.label}
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
                  const em = EMOTIONS[entry.emotion] ?? EMOTIONS.neutral;
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
      {view === "checkin" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Daily Check-in</div>
              <div className="card-sub">{QUIZ.length} questions · evidence-based · +10 coins</div>
            </div>
          </div>

          {!quizDone ? (
            <>
              {/* Progress */}
              <div className="quiz-progress">
                {QUIZ.map((_, i) => (
                  <div
                    key={i}
                    className={`quiz-progress-dot${i <= quizIdx ? " done" : ""}`}
                    style={i <= quizIdx ? { background: currentEmotion.color } : undefined}
                  />
                ))}
              </div>

              <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {QUIZ[quizIdx].dimension}
              </div>
              <div className="quiz-question">{QUIZ[quizIdx].q}</div>

              <div className="quiz-options">
                {QUIZ[quizIdx].opts.map((opt) => (
                  <button
                    key={opt.label}
                    className="quiz-option"
                    onClick={() => answerQuiz(opt)}
                  >
                    <div style={{ fontWeight: 800 }}>{opt.label}</div>
                    {opt.desc && (
                      <div style={{ fontSize: "0.72rem", opacity: 0.62, marginTop: 2 }}>
                        {opt.desc}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Check-in complete */
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <div style={{
                width: 88, height: 88, borderRadius: "50%", margin: "0 auto 18px",
                background: (EMOTIONS[quizEmot]?.color ?? "#74B3CE") + "20",
                display: "grid", placeItems: "center", fontSize: "2.2rem",
                border: `3px solid ${EMOTIONS[quizEmot]?.color ?? "#74B3CE"}40`,
              }}>
                {EMOTION_SYMBOL[quizEmot] ?? "♦"}
              </div>

              <div style={{ fontSize: "1.3rem", fontWeight: 900, marginBottom: 8 }}>
                Check-in complete
              </div>

              {quizAnalyzing && (
                <div className="ai-analyzing" style={{ justifyContent: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>Reading your answers</span>
                  <div className="ai-dots"><span /><span /><span /></div>
                </div>
              )}

              {/* Wellbeing band label */}
              <div style={{
                display: "inline-block", padding: "4px 14px", borderRadius: 999,
                background: (EMOTIONS[wellbeingBand.emotion]?.color ?? "#888") + "20",
                color: EMOTIONS[wellbeingBand.emotion]?.color ?? "#888",
                fontSize: "0.78rem", fontWeight: 800, marginBottom: 12,
              }}>
                {wellbeingBand.label}
              </div>

              <p style={{
                color: "var(--text-2)", marginBottom: 8,
                maxWidth: 290, margin: "0 auto 10px", fontSize: "0.95rem",
              }}>
                You're feeling{" "}
                <strong style={{ color: EMOTIONS[quizEmot]?.color }}>
                  {EMOTIONS[quizEmot]?.label}
                </strong>{" "}today.
              </p>

              <p style={{
                color: "var(--text-2)", fontSize: "0.88rem",
                maxWidth: 300, margin: "0 auto 16px", lineHeight: 1.72,
                fontStyle: "italic",
                padding: "14px 18px",
                background: "rgba(0,0,0,0.03)",
                borderRadius: 14,
              }}>
                "{wellbeingBand.message}"
              </p>

              <p style={{
                fontSize: "0.77rem", color: "var(--text-3)",
                maxWidth: 260, margin: "0 auto 20px", lineHeight: 1.55,
              }}>
                Score {quizScore}/{QUIZ.length * 3} across {QUIZ.length} dimensions
              </p>

              <EmotionBadge emotion={quizEmot} size="large" />

              <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn-secondary" onClick={resetQuiz}>
                  Check in again
                </button>
                <button className="btn-primary" onClick={() => setView("journey")}>
                  See my journey
                </button>
              </div>
            </div>
          )}
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
                const em = entry ? (EMOTIONS[entry.emotion] ?? EMOTIONS.neutral) : null;
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
                  const em = EMOTIONS[entry.emotion] ?? EMOTIONS.neutral;
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
