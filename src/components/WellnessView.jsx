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

// ── Quiz mini-game components ────────────────────────────────────────────────

// PowerBarGame — tap nodes to set charge level, confirm to submit
function PowerBarGame({ opts, disabled, onConfirm }) {
  const [level, setLevel] = useState(0);
  const color = getEmotionStyle(opts[level].emotion).color;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "10px 0 4px" }}>
      {/* Large battery SVG */}
      <svg width="200" height="62" viewBox="0 0 200 62" fill="none">
        <rect x="1" y="5" width="178" height="52" rx="10" stroke={color} strokeWidth="2.5"/>
        <rect x="179" y="22" width="18" height="18" rx="6" fill={color} opacity="0.45"/>
        {[0,1,2,3].map(i => (
          <rect key={i} x={8 + i * 43} y="12" width="36" height="38" rx="7"
            fill={i <= level ? color : "transparent"}
            stroke={color} strokeWidth="1.8"
            opacity={i <= level ? (level === 0 ? 0.55 : 1) : 0.15}/>
        ))}
      </svg>
      {/* Tap nodes */}
      <div style={{ display: "flex", gap: 14 }}>
        {opts.map((opt, i) => {
          const c = getEmotionStyle(opt.emotion).color;
          const active = i <= level;
          return (
            <button key={i} onClick={() => !disabled && setLevel(i)}
              style={{
                width: 52, height: 52, borderRadius: "50%",
                border: `2.5px solid ${active ? c : c + "40"}`,
                background: active ? c + "28" : "transparent",
                cursor: disabled ? "default" : "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 2, transition: "all 0.18s",
                boxShadow: active ? `0 0 12px ${c}50` : "none",
              }}>
              <span style={{ fontSize: "0.62rem", fontWeight: 800, color: active ? c : "var(--text-3)", lineHeight: 1.1, textAlign: "center" }}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
      <button className="btn-primary" disabled={disabled} onClick={() => onConfirm(opts[level])}
        style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, minWidth: 130 }}>
        That's it
      </button>
    </div>
  );
}

// SkyScenesGame — 4 weather scene cards, tap to advance
function SkyScenesGame({ opts, disabled, onPick }) {
  const SCENE_STYLES = [
    { bg: "linear-gradient(160deg, #2C3A52 0%, #3D4F6A 60%, #4A5A7A 100%)", label: "Storm" },
    { bg: "linear-gradient(160deg, #6B7A8D 0%, #8A97A8 60%, #9EAAB8 100%)", label: "Cloudy" },
    { bg: "linear-gradient(160deg, #4A8BBF 0%, #6AAED6 60%, #89C4E1 100%)", label: "Partly sunny" },
    { bg: "linear-gradient(160deg, #E8A830 0%, #F2C050 60%, #F8D878 100%)", label: "Sunny" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "4px 0" }}>
      {opts.map((opt, i) => {
        const scene = SCENE_STYLES[i];
        return (
          <button key={i} onClick={() => !disabled && onPick(opt)} disabled={disabled}
            style={{
              borderRadius: 18, border: "none", cursor: disabled ? "default" : "pointer",
              background: scene.bg, overflow: "hidden", position: "relative",
              height: 108, padding: 0, transition: "transform 0.18s, box-shadow 0.18s",
            }}
            onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)"; }}}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
            {/* Animated weather element */}
            {i === 0 && (
              <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                {[...Array(6)].map((_, r) => (
                  <div key={r} style={{
                    position: "absolute", width: 2, height: 10, borderRadius: 2,
                    background: "rgba(150,180,220,0.7)",
                    left: `${12 + r * 14}%`, top: "10%",
                    animation: `rain-fall 0.9s linear ${r * 0.12}s infinite`,
                  }}/>
                ))}
              </div>
            )}
            {i === 1 && (
              <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                {[0, 1].map(c => (
                  <div key={c} style={{
                    position: "absolute", width: 50, height: 18, borderRadius: 20,
                    background: "rgba(255,255,255,0.18)",
                    top: `${28 + c * 28}%`, left: `${5 + c * 30}%`,
                    animation: `cloud-drift 4s ease-in-out ${c * 1.5}s infinite alternate`,
                  }}/>
                ))}
              </div>
            )}
            {i === 3 && (
              <div style={{ position: "absolute", top: 12, right: 14 }}>
                <div style={{
                  width: 26, height: 26,
                  background: "rgba(255,240,160,0.85)",
                  borderRadius: "50%",
                  boxShadow: "0 0 14px rgba(255,220,80,0.8)",
                  animation: `sun-rotate 6s linear infinite`,
                }}/>
              </div>
            )}
            {/* Label */}
            <div style={{
              position: "absolute", bottom: 10, left: 0, right: 0, textAlign: "center",
            }}>
              <span style={{
                fontWeight: 900, fontSize: "0.82rem", color: i <= 1 ? "rgba(255,255,255,0.92)" : "#1a2030",
                textShadow: i <= 1 ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
              }}>{opt.label}</span>
              <div style={{ fontSize: "0.65rem", color: i <= 1 ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.5)", marginTop: 2 }}>
                {opt.desc}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// StarTapGame — 3 stars, tap to cycle 0→3 stars filled, confirm to submit
function StarTapGame({ opts, disabled, onConfirm }) {
  const [filled, setFilled] = useState(0);
  const color = getEmotionStyle(opts[Math.min(filled, opts.length - 1)].emotion).color;
  const starPts = (cx, cy, r1 = 28, r2 = 12) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? r1 : r2;
      pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return pts.join(" ");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "10px 0 4px" }}>
      <svg width="220" height="72" viewBox="0 0 220 72" fill="none"
        style={{ cursor: disabled ? "default" : "pointer" }}
        onClick={() => !disabled && setFilled(f => (f + 1) % 4)}>
        {[0, 1, 2].map(i => {
          const lit = i < filled;
          const c = lit ? getEmotionStyle(opts[filled - 1]?.emotion ?? opts[0].emotion).color : "#ccc";
          return (
            <g key={i}>
              <polygon points={starPts(36 + i * 74, 36)}
                fill={lit ? c : "transparent"}
                stroke={lit ? c : "#bbb"}
                strokeWidth="2"
                style={{ filter: lit ? `drop-shadow(0 0 8px ${c}99)` : "none", transition: "all 0.2s" }}/>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: "0.82rem", color: "var(--text-2)", fontWeight: 700 }}>
        {filled === 0 ? "Tap to add stars" : opts[Math.min(filled - 1, opts.length - 1)].label}
      </div>
      <button className="btn-primary" disabled={disabled} onClick={() => onConfirm(opts[Math.min(filled, opts.length - 1)])}
        style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, minWidth: 130 }}>
        That's it
      </button>
    </div>
  );
}

// RippleZoneGame — concentric rings, tap a zone to advance
function RippleZoneGame({ opts, disabled, onPick }) {
  const ZONES = [
    { r: 88, label: "Far away", idx: 0 },
    { r: 64, label: "Some distance", idx: 1 },
    { r: 40, label: "Close by", idx: 2 },
    { r: 20, label: "Right here", idx: 3 },
  ];
  const [hovered, setHovered] = useState(null);
  const cx = 100, cy = 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0 4px" }}>
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ overflow: "visible" }}>
        {ZONES.map(({ r, label, idx }) => {
          const opt = opts[idx];
          const c = getEmotionStyle(opt.emotion).color;
          const isHov = hovered === idx;
          return (
            <g key={idx} style={{ cursor: disabled ? "default" : "pointer" }}
              onClick={() => !disabled && onPick(opt)}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}>
              <circle cx={cx} cy={cy} r={r}
                fill={isHov ? c + "22" : c + "09"}
                stroke={c}
                strokeWidth={isHov ? 2.5 : 1.5}
                opacity={0.3 + idx * 0.18}
                style={{ transition: "all 0.15s" }}/>
              <text x={cx + r - 6} y={cy - 5} textAnchor="end"
                style={{ fontSize: "9px", fontWeight: 700, fill: c, opacity: 0.85, pointerEvents: "none" }}>
                {label}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="6" fill="#aaa" opacity="0.35"/>
      </svg>
    </div>
  );
}

// JarFillGame — large jar with +/- controls, confirm to submit
function JarFillGame({ opts, disabled, onConfirm }) {
  const [level, setLevel] = useState(0);
  const color = getEmotionStyle(opts[level].emotion).color;
  const fillFractions = [0, 0.25, 0.5, 1];
  const jarH = 110, jarW = 60, jarY = 14, jarX = 20, lidH = 12;
  const fillH = fillFractions[level] * jarH;
  const fillY = jarY + jarH - fillH;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "8px 0 4px" }}>
      <svg width="100" height="150" viewBox="0 0 100 150" fill="none">
        <defs>
          <clipPath id="jar-clip">
            <path d={`M${jarX} ${jarY + lidH} Q${jarX} ${jarY + lidH - 4} ${jarX + 6} ${jarY + lidH - 4} L${jarX + jarW - 6} ${jarY + lidH - 4} Q${jarX + jarW} ${jarY + lidH - 4} ${jarX + jarW} ${jarY + lidH} L${jarX + jarW} ${jarY + jarH + lidH - 6} Q${jarX + jarW} ${jarY + jarH + lidH} ${jarX + jarW - 6} ${jarY + jarH + lidH} L${jarX + 6} ${jarY + jarH + lidH} Q${jarX} ${jarY + jarH + lidH} ${jarX} ${jarY + jarH + lidH - 6} Z`}/>
          </clipPath>
        </defs>
        {/* Lid */}
        <rect x={jarX + 8} y={jarY} width={jarW - 16} height={lidH} rx="4" fill={color} opacity="0.5"/>
        {/* Jar body outline */}
        <path d={`M${jarX} ${jarY + lidH} Q${jarX} ${jarY + lidH - 4} ${jarX + 6} ${jarY + lidH - 4} L${jarX + jarW - 6} ${jarY + lidH - 4} Q${jarX + jarW} ${jarY + lidH - 4} ${jarX + jarW} ${jarY + lidH} L${jarX + jarW} ${jarY + jarH + lidH - 6} Q${jarX + jarW} ${jarY + jarH + lidH} ${jarX + jarW - 6} ${jarY + jarH + lidH} L${jarX + 6} ${jarY + jarH + lidH} Q${jarX} ${jarY + jarH + lidH} ${jarX} ${jarY + jarH + lidH - 6} Z`}
          fill="none" stroke={color} strokeWidth="2.5"/>
        {/* Fill */}
        {level > 0 && (
          <rect x={jarX} y={fillY + lidH} width={jarW} height={fillH}
            fill={color} opacity="0.35" clipPath="url(#jar-clip)"/>
        )}
        {/* Shine line */}
        <line x1={jarX + 8} y1={jarY + lidH + 8} x2={jarX + 8} y2={jarY + jarH + lidH - 8}
          stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.28"/>
      </svg>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <button onClick={() => !disabled && setLevel(l => Math.max(0, l - 1))} disabled={disabled || level === 0}
          style={{ width: 42, height: 42, borderRadius: "50%", border: `2px solid ${color}50`, background: color + "15",
            fontSize: "1.4rem", fontWeight: 700, cursor: level === 0 || disabled ? "default" : "pointer",
            color: color, opacity: level === 0 ? 0.3 : 1, display: "grid", placeItems: "center" }}>
          –
        </button>
        <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-2)", minWidth: 80, textAlign: "center" }}>
          {opts[level].label}
        </span>
        <button onClick={() => !disabled && setLevel(l => Math.min(opts.length - 1, l + 1))} disabled={disabled || level === opts.length - 1}
          style={{ width: 42, height: 42, borderRadius: "50%", border: `2px solid ${color}50`, background: color + "15",
            fontSize: "1.4rem", fontWeight: 700, cursor: level === opts.length - 1 || disabled ? "default" : "pointer",
            color: color, opacity: level === opts.length - 1 ? 0.3 : 1, display: "grid", placeItems: "center" }}>
          +
        </button>
      </div>
      <button className="btn-primary" disabled={disabled} onClick={() => onConfirm(opts[level])}
        style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, minWidth: 130 }}>
        That's it
      </button>
    </div>
  );
}

// MoonCarouselGame — cycle through moon phases with arrows, confirm to submit
function MoonCarouselGame({ opts, disabled, onConfirm }) {
  const [phase, setPhase] = useState(0);
  const color = getEmotionStyle(opts[phase].emotion).color;
  // phase 0=thin crescent, 1=quarter, 2=half, 3=full
  const clipWidths = [12, 22, 34, 68];
  const cw = clipWidths[phase];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "8px 0 4px" }}>
      <svg width="130" height="130" viewBox="0 0 130 130" fill="none">
        <defs>
          <clipPath id={`moon-phase-${phase}`}>
            <rect x={65 - cw / 2} y="10" width={cw} height="110"/>
          </clipPath>
        </defs>
        {/* Star dots around */}
        {[[18,22],[110,18],[115,95],[20,100],[60,12],[100,50]].map(([x,y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 === 0 ? 1.5 : 2} fill={color} opacity={0.2 + i * 0.05}/>
        ))}
        {/* Moon outline */}
        <circle cx="65" cy="65" r="46" fill="transparent" stroke={color} strokeWidth="1.5" opacity="0.2"/>
        {/* Moon fill */}
        {phase < 3
          ? <circle cx="65" cy="65" r="46" fill={color} opacity="0.85" clipPath={`url(#moon-phase-${phase})`}/>
          : <circle cx="65" cy="65" r="46" fill={color} opacity="0.85"/>
        }
        {/* Craters on full moon */}
        {phase === 3 && <>
          <circle cx="52" cy="52" r="5" fill={color} opacity="0.5"/>
          <circle cx="78" cy="44" r="3.5" fill={color} opacity="0.4"/>
          <circle cx="72" cy="74" r="4" fill={color} opacity="0.45"/>
        </>}
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <button onClick={() => !disabled && setPhase(p => Math.max(0, p - 1))} disabled={disabled || phase === 0}
          style={{ width: 38, height: 38, borderRadius: "50%", border: `2px solid ${color}40`, background: color + "15",
            fontSize: "1.2rem", cursor: phase === 0 || disabled ? "default" : "pointer",
            color: color, opacity: phase === 0 ? 0.3 : 1, display: "grid", placeItems: "center" }}>
          ‹
        </button>
        <div style={{ textAlign: "center", minWidth: 120 }}>
          <div style={{ fontWeight: 800, fontSize: "0.9rem", color }}>
            {opts[phase].label}
          </div>
          <div style={{ fontSize: "0.67rem", color: "var(--text-3)", marginTop: 3 }}>
            {opts[phase].desc}
          </div>
        </div>
        <button onClick={() => !disabled && setPhase(p => Math.min(opts.length - 1, p + 1))} disabled={disabled || phase === opts.length - 1}
          style={{ width: 38, height: 38, borderRadius: "50%", border: `2px solid ${color}40`, background: color + "15",
            fontSize: "1.2rem", cursor: phase === opts.length - 1 || disabled ? "default" : "pointer",
            color: color, opacity: phase === opts.length - 1 ? 0.3 : 1, display: "grid", placeItems: "center" }}>
          ›
        </button>
      </div>
      <button className="btn-primary" disabled={disabled} onClick={() => onConfirm(opts[phase])}
        style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, minWidth: 130 }}>
        That's it
      </button>
    </div>
  );
}

// MountainWaypointGame — mountain SVG with labeled tap zones, tap to advance
function MountainWaypointGame({ opts, disabled, onPick }) {
  const WAYPOINTS = [
    { label: "Base",         cx: 130, cy: 178, idx: 0 },
    { label: "Lower slope",  cx: 108, cy: 148, idx: 1 },
    { label: "Near summit",  cx:  88, cy: 110, idx: 2 },
    { label: "Peak",         cx:  80, cy:  64, idx: 3 },
  ];
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0 4px" }}>
      <svg width="200" height="210" viewBox="0 0 200 210" fill="none">
        {/* Mountain body */}
        <path d="M10 200 L80 40 L180 200 Z"
          fill="var(--bg-2)" stroke="var(--text-3)" strokeWidth="2" strokeLinejoin="round" opacity="0.7"/>
        {/* Snow cap */}
        <path d="M80 40 L64 88 L96 88 Z" fill="white" opacity="0.55"/>
        {/* Trail dashes */}
        <path d="M130 178 L108 148 L88 110 L80 64"
          stroke="var(--text-3)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.35" strokeLinecap="round"/>
        {/* Tap zones */}
        {WAYPOINTS.map(({ label, cx, cy, idx }) => {
          const opt = opts[idx];
          const c = getEmotionStyle(opt.emotion).color;
          const isHov = hovered === idx;
          return (
            <g key={idx} style={{ cursor: disabled ? "default" : "pointer" }}
              onClick={() => !disabled && onPick(opt)}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}>
              <circle cx={cx} cy={cy} r={isHov ? 16 : 12}
                fill={isHov ? c + "35" : c + "20"}
                stroke={c} strokeWidth={isHov ? 2.5 : 1.8}
                style={{ transition: "all 0.15s" }}/>
              <circle cx={cx} cy={cy} r="5" fill={c} opacity="0.9"/>
              <text x={cx + 18} y={cy + 4} style={{ fontSize: "9.5px", fontWeight: 800, fill: c, pointerEvents: "none" }}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Quiz metadata ─────────────────────────────────────────────────────────────
const QUIZ_META = {
  energy:         { type: "powerbar",  reactions: [
    "Even a dim light is still a light.",
    "Running low but still running. That counts.",
    "Steady is more than it sounds.",
    "This energy is real. Carry it with you.",
  ]},
  mood:           { type: "skyscenes", reactions: [
    "Heavy days deserve space. I'm here.",
    "Up and down is still movement.",
    "Calm is its own kind of okay.",
    "Something genuinely good is alive in you.",
  ]},
  meaning:        { type: "stars",     reactions: [
    "Going through the motions still takes strength.",
    "Unclear days are part of it too.",
    "Small moments are real moments.",
    "Something real touched you today.",
  ]},
  connection:     { type: "ripple",    reactions: [
    "Loneliness is loud. You showed up here.",
    "Distance is temporary.",
    "In-between is a real place to be.",
    "Being seen is rare. Notice it.",
  ]},
  accomplishment: { type: "jarfill",   reactions: [
    "Starting is sometimes the whole victory.",
    "The basics are the foundation.",
    "Forward is forward, no matter the speed.",
    "That pride is yours. Nobody can take it.",
  ]},
  sleep:          { type: "mooncycle", reactions: [
    "Your body is asking for rest. Be gentle.",
    "Restless nights are heavy. You carried it.",
    "Good enough sleep is genuinely good.",
    "Deep rest is a gift.",
  ]},
  resilience:     { type: "mountain",  reactions: [
    "Too much at once is real. You're still here.",
    "Pushing through is its own kind of strength.",
    "Handling it is more than it sounds.",
    "Steady and capable — that's the whole thing.",
  ]},
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
            {QUIZ[quizIdx].q}
          </div>

          {/* Mini-game */}
          {(() => {
            const q = QUIZ[quizIdx];
            const t = QUIZ_META[q.id]?.type;
            const common = { opts: q.opts, disabled: quizReacting };
            if (t === "powerbar")  return <PowerBarGame      {...common} onConfirm={handleQuizTap} />;
            if (t === "skyscenes") return <SkyScenesGame     {...common} onPick={handleQuizTap} />;
            if (t === "stars")     return <StarTapGame       {...common} onConfirm={handleQuizTap} />;
            if (t === "ripple")    return <RippleZoneGame    {...common} onPick={handleQuizTap} />;
            if (t === "jarfill")   return <JarFillGame       {...common} onConfirm={handleQuizTap} />;
            if (t === "mooncycle") return <MoonCarouselGame  {...common} onConfirm={handleQuizTap} />;
            if (t === "mountain")  return <MountainWaypointGame {...common} onPick={handleQuizTap} />;
            return null;
          })()}
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
