import { Save, Sparkles } from "lucide-react";
import { useState } from "react";
import Animal3D from "./Animal3D.jsx";
import { EMOTIONS, reflectEmotionWithLLM } from "../utils/emotion.js";

const quizQuestions = [
  { id: "mood", question: "How does today feel?", options: ["Heavy", "Even", "Bright", "Restless"] },
  { id: "sleep", question: "How did you sleep?", options: ["Poorly", "Okay", "Deeply", "Too little"] },
  { id: "energy", question: "Where is your energy?", options: ["Low", "Steady", "High", "Scattered"] },
  { id: "social", question: "How much company feels right?", options: ["Quiet", "One person", "A group", "Unsure"] }
];

export default function WellnessView({ emotion, setEmotion, journalEntries, setJournalEntries, character }) {
  const [latest] = journalEntries;
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [isReflecting, setIsReflecting] = useState(false);

  async function saveJournal(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get("entry") || "").trim();
    if (!text) return;
    setIsReflecting(true);
    const analysis = await reflectEmotionWithLLM(text);
    const entry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      text,
      emotion: analysis.emotion,
      confidence: analysis.confidence,
      language: analysis.language,
      behavior: analysis.behavior,
      reason: analysis.reason
    };
    setJournalEntries((entries) => [entry, ...entries]);
    setEmotion(analysis.emotion);
    setIsReflecting(false);
    event.currentTarget.reset();
  }

  function answerQuiz(answer) {
    const question = quizQuestions[quizIndex];
    const nextAnswers = { ...quizAnswers, [question.id]: answer };
    setQuizAnswers(nextAnswers);
    if (quizIndex < quizQuestions.length - 1) {
      setQuizIndex((index) => index + 1);
      return;
    }

    const joined = Object.values(nextAnswers).join(" ").toLowerCase();
    const nextEmotion = joined.includes("heavy")
      ? "sad"
      : joined.includes("restless") || joined.includes("scattered") || joined.includes("unsure")
        ? "anxious"
        : joined.includes("bright") || joined.includes("high")
          ? "excited"
          : joined.includes("deeply") || joined.includes("steady")
            ? "calm"
            : "neutral";

    setEmotion(nextEmotion);
    setJournalEntries((entries) => [{
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      text: `Quiz check-in: ${Object.entries(nextAnswers).map(([key, value]) => `${key} ${value}`).join(", ")}`,
      emotion: nextEmotion,
      confidence: 78,
      language: "Quiz",
      behavior: EMOTIONS[nextEmotion].behavior,
      reason: "Quiz pattern"
    }, ...entries]);
    setQuizIndex(0);
    setQuizAnswers({});
  }

  return (
    <div className="page-grid">
      <section className="hero-panel wellness-hero">
        <div>
          <p className="eyebrow">Wellness</p>
          <h1>Your words shape your companion.</h1>
          <p>Journal freely or take the check-in quiz. The emotion model reflects the mood on your animal in the rest of Kindred.</p>
        </div>
        <Animal3D emotion={emotion} {...character} />
      </section>

      <section className="wide-panel">
        <div className="section-heading">
          <div>
            <h2>Journal</h2>
            <p>Entries are saved to your Kindred database and update your character.</p>
          </div>
          <span className="emotion-pill" style={{ "--accent": EMOTIONS[emotion].color }}>
            {EMOTIONS[emotion].label}
          </span>
        </div>
        <form className="journal-form" onSubmit={saveJournal}>
          <textarea
            name="entry"
            placeholder="Write what is actually on your mind. For example: I feel cloudy today, like I cannot tell what I need."
            rows={6}
          />
          <button className="primary-button" type="submit">
            <Save size={18} /> {isReflecting ? "Reflecting" : "Save entry"}
          </button>
        </form>
      </section>

      <section className="wide-panel">
        <div className="section-heading">
          <div>
            <h2>Check-In Quiz</h2>
            <p>{quizIndex + 1} of {quizQuestions.length}</p>
          </div>
          <Sparkles size={22} />
        </div>
        <div className="quiz-panel">
          <strong>{quizQuestions[quizIndex].question}</strong>
          <div className="choice-row">
            {quizQuestions[quizIndex].options.map((option) => (
              <button className="choice" type="button" key={option} onClick={() => answerQuiz(option)}>
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="wide-panel">
        <h2>Saved Entries</h2>
        <div className="entry-list">
          {journalEntries.map((entry) => (
            <article key={entry.id} className="entry-card" style={{ "--accent": EMOTIONS[entry.emotion]?.color }}>
              <div>
                <strong>{entry.date}</strong>
                <span>{EMOTIONS[entry.emotion]?.label || "Neutral"}</span>
              </div>
              <p>{entry.text}</p>
              {entry.reason && (
                <small>
                  {entry.language || "Language"} - {entry.behavior || EMOTIONS[entry.emotion]?.behavior} - {entry.confidence || 78}% confidence
                </small>
              )}
            </article>
          ))}
        </div>
        {latest && <p className="microcopy">Latest entry: {latest.text.slice(0, 96)}</p>}
      </section>
    </div>
  );
}
