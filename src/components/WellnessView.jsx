import { Save, Sparkles } from "lucide-react";
import Animal3D from "./Animal3D.jsx";
import { EMOTIONS, inferEmotion } from "../utils/emotion.js";

export default function WellnessView({ emotion, setEmotion, journalEntries, setJournalEntries, character }) {
  const [latest] = journalEntries;

  function saveJournal(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get("entry") || "").trim();
    if (!text) return;
    const analysis = inferEmotion(text);
    const entry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      text,
      emotion: analysis.emotion,
      confidence: analysis.confidence,
      reason: analysis.reason
    };
    setJournalEntries((entries) => [entry, ...entries]);
    setEmotion(analysis.emotion);
    event.currentTarget.reset();
  }

  return (
    <div className="page-grid">
      <section className="hero-panel wellness-hero">
        <div>
          <p className="eyebrow">Wellness check-in</p>
          <h1>Turn real journal language into a character mood.</h1>
          <p>
            The prototype now reads everyday phrasing, including indirect language like
            "cloudy", "foggy", "held", or "spiralling", then maps it to a clear emotion.
          </p>
        </div>
        <Animal3D emotion={emotion} {...character} />
      </section>

      <section className="wide-panel">
        <div className="section-heading">
          <div>
            <h2>Journal</h2>
            <p>Entries are saved locally and immediately update your character.</p>
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
            <Save size={18} /> Save entry
          </button>
        </form>
      </section>

      <section className="wide-panel">
        <div className="section-heading">
          <div>
            <h2>Emotion Model</h2>
            <p>Demo-safe local classifier now handles metaphor and softer phrasing.</p>
          </div>
          <Sparkles size={22} />
        </div>
        <div className="emotion-grid">
          {Object.entries(EMOTIONS).map(([key, value]) => (
            <button
              className={`emotion-card ${emotion === key ? "active" : ""}`}
              key={key}
              onClick={() => setEmotion(key)}
              style={{ "--accent": value.color }}
              type="button"
            >
              <strong>{value.label}</strong>
              <span>{value.tone}</span>
            </button>
          ))}
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
              {entry.reason && <small>{entry.reason} · {entry.confidence}% confidence</small>}
            </article>
          ))}
        </div>
        {latest && <p className="microcopy">Latest entry: {latest.text.slice(0, 96)}</p>}
      </section>
    </div>
  );
}
