import { useState, useMemo, useRef, useEffect } from "react";
import SpriteCharacter from "./SpriteCharacter.jsx";
import { analyzeEmotionAI } from "../lib/emotion-api.js";
import { EmotionDetector, AIJournalist, JournalMemory } from "../lib/journal-ai.js";
import { EMOTIONS } from "../utils/emotion.js";

// ── Quiz data ─────────────────────────────────────────────────────────────────
const QUIZ = [
  { id:"energy",        dimension:"Energy & Vitality",         q:"How would you describe your energy level right now?",               opts:[{label:"Energized",score:3,emotion:"excited",color:"#FF5722"},{label:"Steady",score:2,emotion:"content",color:"#4CAF50"},{label:"Low but going",score:1,emotion:"tired",color:"#FFB300"},{label:"Drained",score:0,emotion:"tired",color:"#9E9E9E"}] },
  { id:"mood",          dimension:"Mood & Emotional State",    q:"Which best describes your overall mood today?",                   opts:[{label:"Genuinely good",score:3,emotion:"happy",color:"#FFCA28"},{label:"Mostly okay",score:2,emotion:"calm",color:"#29B6F6"},{label:"Somewhere between",score:1,emotion:"neutral",color:"#BA68C8"},{label:"Pretty low",score:0,emotion:"sad",color:"#5C6BC0"}] },
  { id:"meaning",       dimension:"Meaning & Purpose",         q:"How much did today matter to you?",                               opts:[{label:"It didn't really matter",score:0,emotion:"sad",color:"#9E9E9E"},{label:"It barely mattered",score:1,emotion:"tired",color:"#FF7043"},{label:"It mattered a little",score:2,emotion:"neutral",color:"#FFB300"},{label:"It mostly mattered",score:3,emotion:"content",color:"#66BB6A"},{label:"It truly mattered",score:3,emotion:"grateful",color:"#F06292"}] },
  { id:"connection",    dimension:"Relationships & Connection",q:"How connected do you feel to those in your life right now?",   opts:[{label:"Genuinely seen",score:3,emotion:"grateful",color:"#E91E63"},{label:"Okay",score:2,emotion:"content",color:"#26A69A"},{label:"A bit distant",score:1,emotion:"neutral",color:"#7986CB"},{label:"Very alone",score:0,emotion:"sad",color:"#546E7A"}] },
  { id:"accomplishment",dimension:"Accomplishment & Growth",   q:"Have you been able to complete tasks that matter to you today?",    opts:[{label:"Proud of something",score:3,emotion:"happy",color:"#FFA000"},{label:"Making progress",score:2,emotion:"content",color:"#00897B"},{label:"Basics only",score:1,emotion:"neutral",color:"#FF7043"},{label:"Struggling to start",score:0,emotion:"tired",color:"#D32F2F"}] },
  { id:"sleep",         dimension:"Sleep & Physical Wellness", q:"How well did you rest last night?",                                      opts:[{label:"Deeply",score:3,emotion:"calm",color:"#1565C0"},{label:"Okay",score:2,emotion:"neutral",color:"#66BB6A"},{label:"Restless",score:1,emotion:"anxious",color:"#FF8A65"},{label:"Very little",score:0,emotion:"tired",color:"#6A1B9A"}] },
  { id:"resilience",    dimension:"Resilience & Coping",       q:"When challenges came up today, how did handling them feel?",        opts:[{label:"Felt capable",score:3,emotion:"calm",color:"#00BCD4"},{label:"Managed okay",score:2,emotion:"neutral",color:"#607D8B"},{label:"Hard but pushed through",score:1,emotion:"tired",color:"#E65100"},{label:"Completely overwhelmed",score:0,emotion:"anxious",color:"#880E4F"}] },
];
const QUIZ_META = { energy:"powerbar", mood:"skyscenes", meaning:"tree", connection:"ripple", accomplishment:"racetrack", sleep:"sleepbed", resilience:"mountain" };
const WELLBEING_BANDS = [
  { max:7,  label:"Struggling",  message:"It's been a hard stretch. How you've been feeling matters.", emotion:"sad" },
  { max:14, label:"Navigating",  message:"You're navigating; Not soaring, not sinking. That counts.", emotion:"neutral" },
  { max:21, label:"Flourishing", message:"There's something quietly good happening right now.", emotion:"happy" },
];
const EMOTION_SYMBOL = { happy:"☀",excited:"✦",calm:"〜",anxious:"◌",sad:"▾",tired:"☽",angry:"▲",content:"♦",grateful:"♥",neutral:"○" };

function CartoonEmotionFace({ emotion, color }) {
  const ink = "#1d1714";
  const accent = color || "#8b6030";
  const accentSoft = color ? `${color}42` : "rgba(139,96,48,0.28)";
  const blush = color ? `${color}30` : "rgba(255,130,150,0.24)";
  const sw = 3.4;

  const eye = (cx, cy, r = 5.8, dx = 0, dy = 0) => (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#fffdf6" stroke={ink} strokeWidth="2.8"/>
      <circle cx={cx+dx} cy={cy+dy} r={r * 0.42} fill={ink}/>
      <circle cx={cx+dx+1.9} cy={cy+dy-2.1} r={r * 0.14} fill="#fff"/>
    </g>
  );

  const closedEye = (d, width = 3.8) => (
    <path d={d} stroke={ink} strokeWidth={width} strokeLinecap="round" fill="none"/>
  );
  const brow = (d, width = 4.2) => (
    <path d={d} stroke={ink} strokeWidth={width} strokeLinecap="round" fill="none"/>
  );
  const mouth = (d, width = sw) => (
    <path d={d} stroke={ink} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  );
  const sparkle = (cx, cy, s = 1) => (
    <path
      d={`M${cx} ${cy - 5 * s}L${cx + 1.5 * s} ${cy - 1.5 * s}L${cx + 5 * s} ${cy}L${cx + 1.5 * s} ${cy + 1.5 * s}L${cx} ${cy + 5 * s}L${cx - 1.5 * s} ${cy + 1.5 * s}L${cx - 5 * s} ${cy}L${cx - 1.5 * s} ${cy - 1.5 * s}Z`}
      fill={accent}
      opacity="0.82"
    />
  );
  const tear = (cx, cy, scale = 1) => (
    <path
      d={`M${cx} ${cy - 6 * scale}C${cx + 5 * scale} ${cy - 1 * scale} ${cx + 5 * scale} ${cy + 5 * scale} ${cx} ${cy + 7 * scale}C${cx - 5 * scale} ${cy + 5 * scale} ${cx - 5 * scale} ${cy - 1 * scale} ${cx} ${cy - 6 * scale}Z`}
      fill="#62b5e8"
      stroke={ink}
      strokeWidth="1.2"
    />
  );
  const heart = (cx, cy, scale = 1) => (
    <path
      d={`M${cx} ${cy + 5 * scale}C${cx - 9 * scale} ${cy - 1 * scale} ${cx - 7 * scale} ${cy - 8 * scale} ${cx - 2 * scale} ${cy - 7 * scale}C${cx} ${cy - 7 * scale} ${cx + 1 * scale} ${cy - 5 * scale} ${cx} ${cy - 3 * scale}C${cx - 1 * scale} ${cy - 5 * scale} ${cx} ${cy - 7 * scale} ${cx + 2 * scale} ${cy - 7 * scale}C${cx + 7 * scale} ${cy - 8 * scale} ${cx + 9 * scale} ${cy - 1 * scale} ${cx} ${cy + 5 * scale}Z`}
      fill={accent}
      stroke={ink}
      strokeWidth="1.1"
      opacity="0.9"
    />
  );

  const details = {
    happy: (
      <>
        <path d="M12 17L8 13M20 12L18 6M32 10V4M44 12L46 6M52 17L56 13" stroke={accent} strokeWidth="2.6" strokeLinecap="round"/>
        {brow("M14 21Q21 15 28 20", 3.6)}{brow("M36 20Q43 15 50 21", 3.6)}
        {closedEye("M16 31Q22 26 28 31")}{closedEye("M36 31Q42 26 48 31")}
        <path d="M18 41Q32 55 46 41" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none"/>
        <ellipse cx="14" cy="39" rx="4.8" ry="2.6" fill={blush}/>
        <ellipse cx="50" cy="39" rx="4.8" ry="2.6" fill={blush}/>
      </>
    ),
    excited: (
      <>
        {sparkle(13, 17, 0.86)}{sparkle(51, 17, 0.72)}
        {brow("M13 22Q21 15 29 19", 3.8)}{brow("M35 19Q43 15 51 22", 3.8)}
        {eye(21, 30, 6.3, 0, -0.4)}{eye(43, 30, 6.3, 0, -0.4)}
        <path d="M18 42Q32 59 46 42Z" fill={ink} stroke={ink} strokeWidth="3" strokeLinejoin="round"/>
        <path d="M20 42Q32 49 44 42" fill="#fffdf6"/>
        <path d="M24 50Q32 54 40 50" stroke={accent} strokeWidth="3" strokeLinecap="round" fill="none"/>
      </>
    ),
    calm: (
      <>
        <path d="M13 17Q22 12 31 17T51 17" stroke={accent} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.68"/>
        {brow("M15 24H27", 3.2)}{brow("M37 24H49", 3.2)}
        <path d="M15 32Q22 35 29 32" stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none"/>
        <path d="M35 32Q42 35 49 32" stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none"/>
        {mouth("M24 43Q32 48 40 43", 3.2)}
        <path d="M21 53Q28 50 35 53T49 53" stroke={accent} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.78"/>
      </>
    ),
    anxious: (
      <>
        <path d="M9 25L5 21M10 36H5M55 20L59 16M55 35H60" stroke={accent} strokeWidth="2.4" strokeLinecap="round" opacity="0.72"/>
        {brow("M13 22Q21 13 29 22", 4)}{brow("M35 22Q43 13 51 22", 4)}
        {eye(22, 32, 6.2, 2.7, 0)}{eye(42, 32, 6.2, 2.7, 0)}
        {mouth("M18 47Q23 43 28 47Q33 51 38 47Q43 43 48 47", 3.2)}
        {tear(52, 30, 0.75)}
      </>
    ),
    sad: (
      <>
        <path d="M20 12V18M32 9V16M44 12V18" stroke={accent} strokeWidth="2.2" strokeLinecap="round" opacity="0.58"/>
        {brow("M12 23Q20 16 28 19", 4)}{brow("M36 19Q44 16 52 23", 4)}
        {eye(22, 33, 5.8, 0, 2.2)}{eye(42, 33, 5.8, 0, 2.2)}
        {mouth("M20 50Q32 42 44 50", 3.8)}
        {tear(50, 38, 0.78)}
      </>
    ),
    tired: (
      <>
        <path d="M47 10C39 12 36 22 44 27C37 27 34 17 40 11C42 9 45 9 47 10Z" fill={accentSoft} stroke={accent} strokeWidth="1.6"/>
        <path d="M12 22Q21 25 29 29" stroke={ink} strokeWidth="4" strokeLinecap="round"/>
        <path d="M35 29Q43 25 52 22" stroke={ink} strokeWidth="4" strokeLinecap="round"/>
        <path d="M15 36Q22 34 29 36" stroke={ink} strokeWidth="3.8" strokeLinecap="round"/>
        <path d="M35 36Q42 34 49 36" stroke={ink} strokeWidth="3.8" strokeLinecap="round"/>
        <ellipse cx="32" cy="49" rx="5.8" ry="4.4" fill="#fffdf6" stroke={ink} strokeWidth="2.6"/>
        <path d="M13 11H22L14 19H23" stroke={accent} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.78"/>
      </>
    ),
    angry: (
      <>
        <path d="M12 15L29 25" stroke={ink} strokeWidth="5.2" strokeLinecap="round"/>
        <path d="M52 15L35 25" stroke={ink} strokeWidth="5.2" strokeLinecap="round"/>
        <path d="M16 34Q22 29 29 34" stroke={ink} strokeWidth="3.8" strokeLinecap="round" fill="none"/>
        <path d="M35 34Q42 29 49 34" stroke={ink} strokeWidth="3.8" strokeLinecap="round" fill="none"/>
        <path d="M22 47H42" stroke={ink} strokeWidth="5" strokeLinecap="round"/>
        <path d="M24 47V52M32 47V52M40 47V52" stroke="#fffdf6" strokeWidth="1.7" strokeLinecap="round"/>
        <path d="M8 27L3 25M56 27L61 25" stroke={accent} strokeWidth="2.8" strokeLinecap="round"/>
      </>
    ),
    content: (
      <>
        <path d="M51 15C51 10 55 8 60 9C59 15 56 18 51 15Z" fill={accentSoft} stroke={accent} strokeWidth="1.8"/>
        <path d="M51 15L48 20" stroke={accent} strokeWidth="2" strokeLinecap="round"/>
        {brow("M14 24Q21 20 28 24", 3.2)}{brow("M36 24Q43 20 50 24", 3.2)}
        {closedEye("M15 34Q22 29 29 34", 3.6)}{closedEye("M35 34Q42 29 49 34", 3.6)}
        {mouth("M20 44Q32 53 44 44", 3.6)}
        <ellipse cx="14" cy="42" rx="4.6" ry="2.5" fill={blush}/>
        <ellipse cx="50" cy="42" rx="4.6" ry="2.5" fill={blush}/>
      </>
    ),
    grateful: (
      <>
        {heart(52, 17, 0.58)}
        {brow("M13 24Q21 17 29 22", 3.8)}{brow("M35 22Q43 17 51 24", 3.8)}
        {eye(22, 33, 6.5, 0, -0.2)}{eye(42, 33, 6.5, 0, -0.2)}
        <path d="M18 45Q32 55 46 45" stroke={ink} strokeWidth="3.7" strokeLinecap="round" fill="none"/>
        <ellipse cx="13" cy="42" rx="4.8" ry="2.7" fill={blush}/>
        <ellipse cx="51" cy="42" rx="4.8" ry="2.7" fill={blush}/>
        <path d="M28 52Q32 56 36 52" stroke={accent} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75"/>
      </>
    ),
    neutral: (
      <>
        <path d="M16 24H28M36 24H48" stroke={ink} strokeWidth="3.5" strokeLinecap="round"/>
        <rect x="17" y="31" width="10" height="8" rx="4" fill="#fffdf6" stroke={ink} strokeWidth="2.6"/>
        <rect x="37" y="31" width="10" height="8" rx="4" fill="#fffdf6" stroke={ink} strokeWidth="2.6"/>
        <circle cx="22" cy="35" r="2.2" fill={ink}/>
        <circle cx="42" cy="35" r="2.2" fill={ink}/>
        <path d="M22 48H42" stroke={ink} strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M28 16H36" stroke={accent} strokeWidth="2.2" strokeLinecap="round" opacity="0.55"/>
      </>
    ),
  };

  return (
    <svg className="emotion-face-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g>{details[emotion] || details.neutral}</g>
    </svg>
  );
}
const WEEKDAYS_SHORT = ["Sun","Mon","Tues","Weds","Thurs","Fri","Sat"];
const MOOD_CHART_MOODS = {
  upset: { label:"Upset", color:"#ff4d4d", text:"#23110e", border:"#c72626" },
  sad:   { label:"Sad",   color:"#2f9be6", text:"#071a2b", border:"#1f6ca5" },
  okay:  { label:"Okay",  color:"#ffd85a", text:"#3b2600", border:"#d09a1a" },
  tired: { label:"Tired", color:"#9d9d9d", text:"#151515", border:"#686868" },
  happy: { label:"Happy", color:"#a8f05a", text:"#183000", border:"#6db82f" },
  calm:  { label:"Calm",  color:"#65d5b0", text:"#073326", border:"#329875" },
};

function localDateKey(date=new Date()) {
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

function getMoodChartMood(rawEmotion) {
  const text = String(rawEmotion || "").toLowerCase();
  if (!text) return null;

  const keywordGroups = {
    tired: ["tired","exhaust","drained","depleted","burnt","burnout","weary","sleepy","foggy","flat"],
    upset: ["upset","angry","mad","furious","irritated","annoyed","frustrated","anxious","worried","overwhelm","stress","tense","trapped","restless","uneasy","panic"],
    sad: ["sad","lonely","alone","grief","hurt","low","empty","blue","hollow","numb","down","struggling"],
    happy: ["happy","joy","excited","proud","grateful","thankful","hope","relief","thriving","energized","engaged","accomplished"],
    calm: ["calm","peace","grounded","stable","settled","balanced","centered","safe"],
    okay: ["okay","ok","fine","content","neutral","alright","steady","normal","recovering"],
  };
  const priority = ["tired","upset","sad","happy","calm","okay"];
  const scores = Object.fromEntries(priority.map(key => [key, 0]));

  for (const key of priority) {
    for (const word of keywordGroups[key]) {
      if (text.includes(word)) scores[key] += 1;
    }
  }

  const best = priority
    .filter(key => scores[key] > 0)
    .sort((a,b) => scores[b] - scores[a] || priority.indexOf(a) - priority.indexOf(b))[0];

  return MOOD_CHART_MOODS[best || "okay"];
}

// Lifts a hex colour toward white so it stays legible as text/fill against a dark
// background (e.g. the night-sky sleep panel) without touching the original colour
// used elsewhere (journal history, light-background contexts).
function liftForContrast(hex, amt = 0.4) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  const mix = c => Math.round(c + (255 - c) * amt);
  return `#${[mix(r), mix(g), mix(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function getEmotionStyle(e) {
  if (!e) return EMOTIONS.neutral;
  if (EMOTIONS[e]) return EMOTIONS[e];
  const l=e.toLowerCase();
  if (l.includes("happy")||l.includes("joy")||l.includes("proud")||l.includes("delight")) return EMOTIONS.happy;
  if (l.includes("excit")||l.includes("energiz")||l.includes("thrill")||l.includes("buzz")) return EMOTIONS.excited;
  if (l.includes("calm")||l.includes("peace")||l.includes("relief")||l.includes("ground")||l.includes("settled")) return EMOTIONS.calm;
  if (l.includes("anxious")||l.includes("overwhelm")||l.includes("stress")||l.includes("worr")||l.includes("nervous")||l.includes("uneasy")||l.includes("panic")) return EMOTIONS.anxious;
  if (l.includes("sad")||l.includes("lone")||l.includes("grief")||l.includes("hurt")||l.includes("low")||l.includes("empty")||l.includes("numb")) return EMOTIONS.sad;
  if (l.includes("tired")||l.includes("drain")||l.includes("exhaust")||l.includes("weary")||l.includes("burn")||l.includes("foggy")) return EMOTIONS.tired;
  if (l.includes("angry")||l.includes("frustrat")||l.includes("irritat")||l.includes("annoy")||l.includes("resent")||l.includes("tense")) return EMOTIONS.angry;
  if (l.includes("content")||l.includes("okay")||l.includes("fine")||l.includes("steady")||l.includes("balanced")) return EMOTIONS.content;
  if (l.includes("grateful")||l.includes("thankful")||l.includes("appreciat")||l.includes("hope")) return EMOTIONS.grateful;

  const colors = ["#ee6f8f","#5dbb9d","#f49f58","#5d8edb","#8e7cc3","#e85d5d","#4fbf7f","#d76ba8","#f6c65b"];
  const hash = [...l].reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
  return { ...EMOTIONS.neutral, label:formatEmotionLabel(e), color:colors[hash%colors.length] };
}

function formatEmotionLabel(e) {
  const raw=String(e||"neutral").trim();
  if (!raw) return EMOTIONS.neutral.label;
  if (EMOTIONS[raw]) return EMOTIONS[raw].label;
  return raw.replace(/[-_]+/g," ").replace(/\s+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
}

// Always returns exactly one capitalised word — used for mood chips and Most Felt
function toOneWord(e) {
  if (!e) return "Neutral";
  const es = getEmotionStyle(e);
  // If getEmotionStyle matched a standard emotion, its label is already one word
  if (Object.values(EMOTIONS).some(em => em.label === es.label)) return es.label;
  // Unknown phrase — take just the first word
  const first = String(e).trim().split(/[\s,&]+/)[0] || "Neutral";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function normalizeAiChat(entry) {
  const chat = [];
  for (const field of [entry?.aiChat, entry?.chatHistory, entry?.pastAiChat, entry?.aiMessages]) {
    if (!Array.isArray(field)) continue;
    for (const m of field) {
      const text=String(m?.text ?? m?.content ?? m?.message ?? "").trim();
      if (text) chat.push({role:m?.role==="user"?"user":"ai",text});
    }
  }

  for (const msg of [entry?.companionResponse?.text, entry?.companionResponse, entry?.aiResponse, entry?.aiReply, entry?.reflection]) {
    const text=String(msg||"").trim();
    if (text&&!chat.some(m=>m.role==="ai"&&m.text===text)) chat.unshift({role:"ai",text});
  }

  if (!chat.length&&entry?.source!=="checkin") {
    chat.push({role:"ai",text:`I sensed ${formatEmotionLabel(entry.emotion)} in this journal entry.`});
  }
  return chat;
}

// ── Mini-game components (compact versions) ───────────────────────────────────

function PowerBarGame({ opts, disabled, onConfirm }) {
  const [level, setLevel] = useState(null);
  // Fixed colours per bar index: 0=Energized, 1=Steady, 2=Low but going, 3=Drained
  const BAR_COLORS = ["#df12df", "#ee9725", "#dfd221", "#2e65d1"];
  const color = level !== null ? BAR_COLORS[level] : "#8B6030";
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5,width:"100%"}}>
      {/* Battery cap */}
      <div style={{width:45,height:12,borderRadius:"7px 7px 0 0",background:"rgba(6,119,34,0.35)",border:"3px solid rgba(31,160,63,0.5)",borderBottom:"none"}}/>
      {/* Battery body */}
      <div style={{width:96,border:"3.5px solid rgba(31,160,63,0.7)",borderRadius:10,padding:0.5,display:"flex",flexDirection:"column",gap:4,background:"rgba(255,255,255,0.15)",marginTop:-6}}>
        {opts.map((opt,i)=>{
          const c = BAR_COLORS[i];
          const sc = level !== null ? BAR_COLORS[level] : c; // selected bar's colour
          const active = level === i;
          const filled = level !== null && i >= level;
          return (
            <button key={i} onClick={()=>!disabled&&setLevel(i)}
              style={{width:"100%",padding:"2.5px 1px",borderRadius:7,border:`3px solid ${filled?sc:c+"40"}`,background:filled?sc+"60":"rgb(191,245,180)",cursor:disabled?"default":"pointer",transition:"all 0.18s",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:active?`0 0 12px ${sc}88`:"none"}}>
              <span style={{fontFamily:"var(--font-game)",fontSize:"0.85rem",fontWeight:active?800:500,color:active?"#231c8a":"#25998f"}}>{opt.label}</span>
            </button>
          );
        })}
      </div>
      <button className="scroll-btn-primary" disabled={disabled||level===null}
        onClick={()=>level!==null&&onConfirm(opts[level])}
        style={{marginTop:-1.5,background:level!==null?`linear-gradient(135deg,${color},${color}bb)`:undefined,padding:"8px 20px",fontSize:"0.75rem",opacity:level===null?0.5:1,color:"#503111",fontWeight:"800",letterSpacing:"0.5px"}}>
        Next
      </button>
    </div>
  );
}

function SkyScenesGame({ opts, disabled, onPick }) {
  const SCENES=[
    {bg:"linear-gradient(160deg,#55B9F5 0%,#F8D86E 100%)",text:"#3A2C00"},
    {bg:"linear-gradient(160deg,#7FC8C8 0%,#D5E7CF 100%)",text:"#173C3D"},
    {bg:"linear-gradient(160deg,#83A9D2 0%,#D6C7B8 100%)",text:"#1F3342"},
    {bg:"linear-gradient(160deg,#3F556F 0%,#7E91A4 100%)",text:"rgba(255,255,255,0.92)"},
  ];
  const rows=[[0,1],[2,3]];
  const OPTION_TOP_OFFSET = 72;
  const OPTION_HEIGHT = 55;
  const OPTION_GAP = 6;
  const weather=(i)=>{
    if(i===0)return(
      <>
        <span style={{position:"absolute",top:8,right:24,width:28,height:28,borderRadius:"50%",background:"rgba(255,238,105,0.95)",boxShadow:"0 0 16px rgba(255,220,70,0.95)",animation:"sun-pulse 1.8s ease-in-out infinite"}}/>
        {[0,1,2,3].map(n=><span key={`ray-${n}`} style={{position:"absolute",top:21,right:38,width:34,height:2,background:"rgba(255,244,154,0.75)",transform:`rotate(${n*45}deg)`,transformOrigin:"center",animation:`sun-pulse 2s ease-in-out ${n*0.12}s infinite`}}/> )}
        {[0,1,2].map(n=><span key={n} style={{position:"absolute",top:12+n*9,left:`${18+n*18}%`,width:5,height:5,borderRadius:"50%",background:"rgba(255,255,255,0.72)",animation:`sparkle 2s ease-in-out ${n*0.35}s infinite`}}/> )}
      </>
    );
    if(i===1)return(
      <>
        {[0,1,2].map(n=><span key={n} style={{position:"absolute",left:28+n*22,top:15+n*6,width:40,height:2,background:"rgba(255,255,255,0.46)",boxShadow:"0 0 8px rgba(255,255,255,0.28)",animation:`cloud-drift ${4.8+n*0.5}s ease-in-out ${n*0.25}s infinite`}}/> )}
        <span style={{position:"absolute",top:13,right:27,width:18,height:18,transform:"rotate(45deg)",background:"rgba(255,246,188,0.42)",boxShadow:"0 0 12px rgba(255,246,188,0.35)",animation:"sun-pulse 3.6s ease-in-out infinite"}}/>
      </>
    );
    if(i===2)return(
      <>
        <span style={{position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(255,230,120,0.30) 0 46%,rgba(70,88,120,0.22) 48% 100%)"}}/>
        {[0,1,2].map(n=><span key={n} style={{position:"absolute",top:10+n*10,left:30+n*26,width:26,height:3,background:n%2?"rgba(65,82,110,0.34)":"rgba(255,238,154,0.40)",transform:"rotate(-18deg)",animation:`cloud-drift ${3.8+n*0.4}s ease-in-out ${n*0.2}s infinite`}}/> )}
      </>
    );
    return(
      <>
        <span style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(24,34,52,0.28),rgba(24,34,52,0.02))"}}/>
        {[0,1,2,3,4,5].map(n=><span key={n} style={{position:"absolute",top:10,left:`${16+n*12}%`,width:2,height:19,borderRadius:2,background:"rgba(185,225,255,0.66)",transform:"rotate(10deg)",animation:`rain-fall 1.25s linear ${n*0.15}s infinite`}}/> )}
        {[0,1].map(n=><span key={`dim-${n}`} style={{position:"absolute",top:13+n*13,left:32+n*40,width:34,height:2,background:"rgba(255,255,255,0.16)",transform:"rotate(-8deg)",animation:`cloud-drift ${4+n}s ease-in-out infinite`}}/> )}
      </>
    );
  };
  return (
    <div style={{display:"grid",gridTemplateRows:`repeat(2, ${OPTION_HEIGHT}px)`,gap:OPTION_GAP,width:"100%",flex:"0 0 auto",height:(OPTION_HEIGHT*2)+OPTION_GAP,marginTop:OPTION_TOP_OFFSET}}>
      {rows.map((pair,ri)=>(
        <div key={ri} style={{display:"grid",gridTemplateColumns:"repeat(2, minmax(0, 1fr))",gap:8,height:OPTION_HEIGHT,minHeight:0}}>
          {pair.map(i=>{
            const opt=opts[i]; const scene=SCENES[i];
            return (
              <button key={i} onClick={()=>!disabled&&onPick(opt)} disabled={disabled}
                className="sky-scene-btn"
                style={{width:"100%",height:OPTION_HEIGHT,borderRadius:12,border:"none",cursor:disabled?"default":"pointer",background:scene.bg,position:"relative",minHeight:0,overflow:"hidden"}}>
                {weather(i)}
                <div style={{position:"absolute",bottom:7,left:0,right:0,textAlign:"center",zIndex:1}}>
                  <span style={{fontWeight:900,fontSize:"0.68rem",color:scene.text}}>{opt.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function getCheckinVisualMode(rawEmotion) {
  const text=String(rawEmotion||"").toLowerCase();
  if (text.includes("search")||text.includes("seek")||text.includes("uncertain")||text.includes("adjust")||text.includes("restless")) return "seeking";
  if (text.includes("happy")||text.includes("joy")||text.includes("excited")||text.includes("energ")||text.includes("grateful")||text.includes("hope")) return "bright";
  if (text.includes("calm")||text.includes("content")||text.includes("peace")||text.includes("stable")||text.includes("ground")||text.includes("steady")||text.includes("resilien")) return "steady";
  if (text.includes("sad")||text.includes("low")||text.includes("tired")||text.includes("drain")||text.includes("exhaust")||text.includes("deplet")) return "heavy";
  if (text.includes("angry")||text.includes("frustrat")||text.includes("irritat")||text.includes("tense")) return "sharp";
  if (text.includes("anxious")||text.includes("overwhelm")||text.includes("worr")||text.includes("stress")) return "seeking";
  return "steady";
}

function CheckinResultAnimation({ emotion }) {
  const style=getEmotionStyle(emotion);
  const mode=getCheckinVisualMode(emotion);
  const color=style.color;
  const soft=color+"24";
  const faint=color+"14";

  if (mode==="bright") return (
    <div style={{position:"relative",width:82,height:82,margin:"0 auto 10px"}}>
      <div style={{position:"absolute",inset:13,borderRadius:"50%",background:`radial-gradient(circle, ${color}66, ${faint} 68%, transparent 70%)`,animation:"sun-pulse 1.8s ease-in-out infinite"}}/>
      {[0,1,2,3,4,5].map(i=><span key={i} style={{position:"absolute",left:38+Math.cos(i*Math.PI/3)*31,top:38+Math.sin(i*Math.PI/3)*31,width:6,height:6,borderRadius:"50%",background:color,boxShadow:`0 0 10px ${color}`,animation:`sparkle 2s ease-in-out ${i*0.18}s infinite`}}/> )}
      <div style={{position:"absolute",inset:22,borderRadius:"50%",display:"grid",placeItems:"center",background:soft,color,fontSize:"1.9rem",fontFamily:"var(--font-game)"}}>{EMOTION_SYMBOL[emotion]??"✦"}</div>
    </div>
  );

  if (mode==="seeking") return (
    <div style={{position:"relative",width:82,height:82,margin:"0 auto 10px"}}>
      <div style={{position:"absolute",inset:7,borderRadius:"50%",border:`2px dashed ${color}`,opacity:0.75,animation:"sun-rotate 8s linear infinite"}}/>
      <div style={{position:"absolute",inset:17,borderRadius:"50%",border:`2px solid ${color}66`,animation:"sun-pulse 2.8s ease-in-out infinite"}}/>
      <div style={{position:"absolute",inset:0,animation:"sun-rotate 3.8s linear infinite"}}>
        <span style={{position:"absolute",top:3,left:38,width:7,height:7,borderRadius:"50%",background:color,boxShadow:`0 0 10px ${color}`}}/>
      </div>
      <div style={{position:"absolute",inset:24,display:"grid",placeItems:"center",color,transform:"rotate(45deg)",fontSize:"1.8rem",fontFamily:"var(--font-game)"}}>◆</div>
    </div>
  );

  if (mode==="heavy") return (
    <div style={{position:"relative",width:82,height:82,margin:"0 auto 10px",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:17,borderRadius:"50%",background:`linear-gradient(160deg, ${soft}, ${color}18)`,border:`2px solid ${color}88`}}/>
      {[0,1,2,3,4].map(i=><span key={i} style={{position:"absolute",top:12,left:18+i*11,width:2,height:18,borderRadius:2,background:color,opacity:0.65,animation:`rain-fall 1.35s linear ${i*0.16}s infinite`}}/> )}
      <div style={{position:"absolute",inset:25,display:"grid",placeItems:"center",color,fontSize:"1.8rem",fontFamily:"var(--font-game)"}}>{EMOTION_SYMBOL[emotion]??"☽"}</div>
    </div>
  );

  if (mode==="sharp") return (
    <div style={{position:"relative",width:82,height:82,margin:"0 auto 10px"}}>
      {[0,1,2].map(i=><div key={i} style={{position:"absolute",inset:12+i*7,border:`2px solid ${color}`,clipPath:"polygon(50% 0, 100% 86%, 0 86%)",opacity:0.8-i*0.18,animation:`lightning-flash 2s linear ${i*0.2}s infinite`}}/> )}
      <div style={{position:"absolute",inset:25,display:"grid",placeItems:"center",color,fontSize:"1.9rem",fontFamily:"var(--font-game)"}}>▲</div>
    </div>
  );

  return (
    <div style={{position:"relative",width:82,height:82,margin:"0 auto 10px"}}>
      {[0,1,2].map(i=><span key={i} style={{position:"absolute",left:18,top:24+i*12,width:46,height:3,borderRadius:4,background:color,opacity:0.7-i*0.12,animation:`cloud-drift ${3.8+i*0.4}s ease-in-out ${i*0.2}s infinite`}}/> )}
      <div style={{position:"absolute",inset:20,borderRadius:"50%",background:soft,border:`2px solid ${color}88`,animation:"sun-pulse 3s ease-in-out infinite"}}/>
      <div style={{position:"absolute",inset:25,display:"grid",placeItems:"center",color,fontSize:"1.8rem",fontFamily:"var(--font-game)"}}>{EMOTION_SYMBOL[emotion]??"〜"}</div>
    </div>
  );
}

function StarTapGame({ opts, disabled, onConfirm }) {
  const [filled,setFilled]=useState(0);
  const color=getEmotionStyle(opts[Math.min(filled,opts.length-1)].emotion).color;
  const starPts=(cx,cy,r1=22,r2=9)=>{const pts=[];for(let i=0;i<10;i++){const a=(i*Math.PI)/5-Math.PI/2;const r=i%2===0?r1:r2;pts.push(`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`);}return pts.join(" ");};
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
      <svg width="190" height="58" viewBox="0 0 190 58" fill="none" style={{cursor:disabled?"default":"pointer"}} onClick={()=>!disabled&&setFilled(f=>(f+1)%4)}>
        {[0,1,2].map(i=>{const lit=i<filled;const c=lit?getEmotionStyle(opts[filled-1]?.emotion??opts[0].emotion).color:"#ccc";
          return <polygon key={i} points={starPts(31+i*64,29)} fill={lit?c:"transparent"} stroke={lit?c:"#bbb"} strokeWidth="1.8" style={{filter:lit?`drop-shadow(0 0 6px ${c}88)`:"none",transition:"all 0.2s"}}/>;
        })}
      </svg>
      <div style={{fontSize:"0.78rem",color:"var(--text-2)",fontWeight:700}}>{filled===0?"Tap to add stars":opts[Math.min(filled-1,opts.length-1)].label}</div>
      <button className="scroll-btn-primary" disabled={disabled} onClick={()=>onConfirm(opts[Math.min(filled,opts.length-1)])} style={{background:`linear-gradient(135deg,${color},${color}bb)`,padding:"8px 20px",fontSize:"0.75rem"}}>That's it</button>
    </div>
  );
}

function ShakeTreeGame({ opts, disabled, onConfirm }) {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EASY ADJUSTMENT CONSTANTS — edit these
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const TREE_W         = 490;   // tree image width in px
  const TREE_H         = 300;   // tree image height in px
  const TREE_OFFSET_X  = -50;    // shift tree left (negative) / right (positive) in px  ← EDIT THIS
  const TREE_OFFSET_Y  = -99;  // shift tree up (negative) / down (positive) in px     ← EDIT THIS
  const SCALE          = 1;    // reserved — don't touch
  const APPLE_W        = 90;   // apple width in px  ← EDIT THIS
  const APPLE_H        = 50;   // apple height in px ← EDIT THIS
  const FALLEN_W       = 90;   // fallen apple width in px  ← EDIT THIS
  const FALLEN_H       = 50;   // fallen apple height in px ← EDIT THIS
  const ROOT_GROUND_Y  = 252;  // y where the tree roots meet the ground, in the tree frame
  const GROUND_PADDING = 0;   // gap kept between the landed apple's bottom edge and the root ground
  const HINT_FONT      = "0.60rem";   // hint / sub-label text size
  const HINT_OFFSET_X  = 115;    // shift hint text left (negative) / right (positive) in px  ← EDIT THIS
  const HINT_OFFSET_Y  = -20    // shift hint text up (negative) / down (positive) in px     ← EDIT THIS
  const LABEL_FONT     = "0.92rem";   // "It barely mattered" text size
  const LABEL_OFFSET_X = 334;    // shift label left (negative) / right (positive) in px  ← EDIT THIS
  const LABEL_OFFSET_Y = 100;    // shift label up (negative) / down (positive) in px     ← EDIT THIS
  const BTN_FONT       = "0.75rem";   // "That's it!" button text size
  // Slight tilt per apple slot — keep values small (±15° max looks natural)
  const TILT_ANGLES = [-8, 5, -12, 3, -6];
  const BTN_PAD        = "7px 18px";  // button padding (top/bottom left/right)
  const MAX_APPLES = 5;
  const [shakesThisApple, setShakesThisApple] = useState(0);
  const [fallen, setFallen]           = useState(0);
  const [dropping, setDropping]       = useState(false);
  const [drop, setDrop]               = useState(null); // active fall path: { startX, startY, fallDist, restX, restY, rotate }
  const [landed, setLanded]           = useState([]); // apples resting directly below their branches: [{ x, y, rotate }]
  const [confirmRemove, setConfirmRemove] = useState(false);
  const treeRef = useRef(null);   // stable (non-rotating) frame — defines the ax/ay coordinate space
  const shakeRef = useRef(null);  // inner layer that visually wobbles when the tree is shaken
  const droppingRef = useRef(false); // synchronous guard so a rapid double-click can't start two drops at once
  const nextThreshold = useRef(Math.floor(Math.random() * 5) + 2); // random 2–6

  function makeDropPath(ax, ay, appleIndex) {
    const startX = ax * SCALE;
    const startY = ay * SCALE;
    const restY = ROOT_GROUND_Y - GROUND_PADDING - FALLEN_H / 2;

    return {
      startX,
      startY,
      restX: startX,
      restY,
      driftX: 0,
      fallDist: Math.max(20, restY - startY),
      rotate: TILT_ANGLES[appleIndex % TILT_ANGLES.length],
    };
  }

  const applesInTree = MAX_APPLES - fallen;
  const currentOpt   = fallen > 0 ? opts[fallen - 1] : null;
  const labelColor   = currentOpt?.color ?? "#6DB535";
  const shakesDone   = fallen > 0 || shakesThisApple > 0;

  // ← Apple positions [left, top] in px within the 450×270 tree img.
  const APPLE_POS = [[254,80],[187,107],[310,109],[178,138],[287,150]];

  // ← Decorative apples — all kept inside canopy (canopy ≈ ellipse cx=225 cy=100 rx=125 ry=95)
  const DECO_APPLES = [
    [280,115],[290,85],[220,94],
    [215,130],[248,129],[199,174],[317,168],
  ];

  function shake() {
    if (disabled || fallen >= MAX_APPLES || droppingRef.current) return;
    if (shakeRef.current) {
      shakeRef.current.style.animation = "none";
      void shakeRef.current.offsetWidth;
      shakeRef.current.style.animation = "tree-shake 0.42s ease-in-out";
    }
    const next = shakesThisApple + 1;
    if (next >= nextThreshold.current) {
      nextThreshold.current = Math.floor(Math.random() * 5) + 2;
      setShakesThisApple(0);
      const [ax, ay] = APPLE_POS[applesInTree - 1];
      const path = makeDropPath(ax, ay, fallen);
      setDrop(path);
      droppingRef.current = true;
      setDropping(true);
      setTimeout(() => {
        droppingRef.current = false;
        setDropping(false);
        setFallen(f => f + 1);
        setLanded(L => [...L, { x: path.restX, y: path.restY, rotate: path.rotate }]);
        setDrop(null);
      }, 700);
    } else {
      setShakesThisApple(next);
    }
  }

  function doRemove() {
    setFallen(f => Math.max(0, f - 1));
    setLanded(L => L.slice(0, -1));
    setShakesThisApple(0);
    nextThreshold.current = Math.floor(Math.random() * 5) + 2;
    setConfirmRemove(false);
  }

  const hintText = fallen >= MAX_APPLES
    ? "All apples fallen!"
    : !shakesDone
      ? "Shake the tree!"
      : "Keep shaking…";

  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center", width:"100%", userSelect:"none", gap:6 }}>

      {/* ── CONTROLS BAR ── */}
      <div style={{ width:"100%", display:"flex", alignItems:"center", gap:10,
        padding:"4px 0", flexShrink:0, minHeight:52, height:52, position:"relative", zIndex:30 }}>

        {/* Hint text — "Shake the tree!" / "Keep shaking…" */}
        {!currentOpt && (
          <div style={{ fontSize:HINT_FONT, color:"var(--text-3)", fontStyle:"italic",
            position:"relative", left:HINT_OFFSET_X, top:HINT_OFFSET_Y, flexShrink:0 }}>
            {hintText}
          </div>
        )}

        {/* Label — "1 apple means… / It didn't really matter" */}
        {currentOpt && (
          <div style={{ position:"relative", left:LABEL_OFFSET_X, top:LABEL_OFFSET_Y,
            lineHeight:1.3, flexShrink:0 }}>
            <div style={{ fontSize:HINT_FONT, color:"var(--text-3)" }}>
              {fallen} apple{fallen!==1?"s":""} means…
            </div>
            <div style={{ fontWeight:800, fontSize:LABEL_FONT, color:labelColor, transition:"color 0.3s" }}>
              {currentOpt.label}
            </div>
          </div>
        )}

        <div style={{ flex:1 }}/>{/* spacer pushes button to the right */}

        {/* That's it! button */}
        <button className="scroll-btn-primary" type="button" disabled={disabled || fallen===0}
          onClick={() => fallen > 0 && onConfirm(opts[fallen - 1])}
          style={{ background: fallen>0 ? `linear-gradient(135deg,${labelColor},${labelColor}bb)` : undefined,
            padding:BTN_PAD, fontSize:BTN_FONT, opacity: fallen>0 ? 1 : 0.42, flexShrink:0, position:"relative", zIndex:31, pointerEvents:"auto" }}>
          That's it!
        </button>
      </div>

      {/* ── TREE — can extend below the white box; trunk is decorative ──
          Stable (non-rotating) frame: defines the ax/ay coordinate space that
          the falling/landed apples are positioned in, so they never inherit
          the tree's shake wobble once they've left the branch. */}
      <div ref={treeRef}
        style={{ position:"relative", width:TREE_W, height:TREE_H, flexShrink:0,
          marginTop: TREE_OFFSET_Y, marginLeft: TREE_OFFSET_X, zIndex:1 }}>

        {/* Rotating layer — wobbles when shaken: tree art + apples still on the branch */}
        <div ref={shakeRef}
          style={{ position:"absolute", inset:0, transformOrigin:"50% 50%",
            cursor: fallen>=MAX_APPLES||dropping ? "default" : "pointer" }}
          onClick={shake} role="button" aria-label="Shake the tree" tabIndex={0}
          onKeyDown={e => (e.key==="Enter"||e.key===" ") && shake()}>

          <img src="/assets/tree-icon.png" alt="" aria-hidden="true"
            style={{ width:TREE_W, height:TREE_H, display:"block", pointerEvents:"none" }}/>

          {/* Decorative apples */}
          {DECO_APPLES.map(([ax, ay], i) => (
            <img key={`d${i}`} src="/assets/apple-icon.png" alt="" aria-hidden="true"
              style={{ position:"absolute", left:ax*SCALE, top:ay*SCALE, width:APPLE_W, height:APPLE_H,
                transform:"translate(-50%,-50%)", pointerEvents:"none", opacity:0.85 }}/>
          ))}

          {/* Interactive apples */}
          {APPLE_POS.slice(0, dropping ? applesInTree - 1 : applesInTree).map(([ax, ay], i) => (
            <img key={i} src="/assets/apple-icon.png" alt="" aria-hidden="true"
              style={{ position:"absolute", left:ax*SCALE, top:ay*SCALE, width:APPLE_W, height:APPLE_H,
                transform:"translate(-50%,-50%)", pointerEvents:"none" }}/>
          ))}
        </div>

        {/* Dropping apple falls straight down to the tree's root ground.
            Lives outside the rotating layer so it doesn't inherit the shake wobble. */}
        {dropping && drop && (() => {
          return (
            <img src="/assets/apple-icon.png" alt="" aria-hidden="true" className="apple-falling"
              style={{ position:"absolute", left:drop.startX, top:drop.startY, width:APPLE_W, height:APPLE_H,
                "--fall-dist":`${drop.fallDist}px`, "--fall-drift":`${drop.driftX}px`, "--fall-rotate":`${drop.rotate}deg`, pointerEvents:"none" }}/>
          );
        })()}

        {/* Landed apples — rest exactly where they fell, directly under their branch, at the ground */}
        {landed.map((spot, i) => (
          <button key={i} onClick={() => !disabled && setConfirmRemove(true)}
            style={{ position:"absolute", left:spot.x, top:spot.y, width:FALLEN_W, height:FALLEN_H,
              transform:`translate(-50%,-50%) rotate(${spot.rotate}deg)`,
              "--landed-rotate":`${spot.rotate}deg`,
              background:"none", border:"none", padding:0, cursor:disabled?"default":"pointer", zIndex:i+1,
              animation: i===landed.length-1 ? "apple-ground-pop 0.35s cubic-bezier(0.34,1.56,0.64,1)" : "none",
              filter: i===landed.length-1 ? "drop-shadow(0 2px 6px rgba(198,40,40,0.55))" : "none" }}
            aria-label={`Apple ${i+1} — click to remove`}>
            <img src="/assets/apple-icon.png" alt="" style={{ width:"100%", height:"100%", display:"block" }}/>
          </button>
        ))}
      </div>

      {/* Remove popup */}
      {confirmRemove && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"grid", placeItems:"center", zIndex:200 }}
          onClick={e => e.target===e.currentTarget && setConfirmRemove(false)}>
          <div style={{ background:"var(--panel-bg,#FDFAF4)", borderRadius:18, padding:"22px 26px",
            maxWidth:265, textAlign:"center", boxShadow:"0 8px 32px rgba(0,0,0,0.22)" }}>
            <img src="/assets/apple-icon.png" alt="" style={{ width:36, height:36, marginBottom:8 }}/>
            <p style={{ fontWeight:700, fontSize:"0.88rem", marginBottom:5 }}>Remove an apple?</p>
            <p style={{ fontSize:"0.76rem", color:"var(--text-2)", marginBottom:16 }}>
              Did your day matter a little less than you thought?
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button className="scroll-btn-secondary" onClick={() => setConfirmRemove(false)} style={{ flex:1 }}>Keep it</button>
              <button className="scroll-btn-primary" onClick={doRemove}
                style={{ flex:1, background:"linear-gradient(135deg,#C62828,#B71C1C)" }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RippleZoneGame({ opts, disabled, onPick }) {
  const [selected,setSelected]=useState(null);
  const NODES=[
    { idx:0, label:"Genuinely seen", x:50, y:16, delay:"0s" },
    { idx:1, label:"Okay", x:86, y:54, delay:"0.12s" },
    { idx:2, label:"A bit distant", x:50, y:88, delay:"0.24s" },
    { idx:3, label:"Very alone", x:14, y:54, delay:"0.36s" },
  ];

  function choose(node) {
    if (disabled) return;
    setSelected(node.idx);
    onPick(opts[node.idx]);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,width:"100%",paddingTop:2}}>
      <div style={{position:"relative",width:330,height:160,maxWidth:"100%",flexShrink:0}}>
        <svg width="330" height="160" viewBox="0 0 330 160" fill="none" style={{position:"absolute",inset:0,pointerEvents:"none"}}>
          <defs>
            <radialGradient id="connectionGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFE7A3" stopOpacity="0.95"/>
              <stop offset="100%" stopColor="#D4882A" stopOpacity="0.05"/>
            </radialGradient>
          </defs>
          <ellipse cx="165" cy="80" rx="54" ry="38" fill="url(#connectionGlow)" opacity="0.75"/>
          {NODES.map(node => {
            const opt=opts[node.idx]; const color=opt.color||getEmotionStyle(opt.emotion).color;
            const x=(node.x/100)*330, y=(node.y/100)*160;
            return <path key={node.idx} d={`M165 80 C ${165+(x-165)*0.34} ${80-26}, ${165+(x-165)*0.7} ${y+18}, ${x} ${y}`}
              stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeDasharray="5 7" opacity={selected===node.idx?0.78:0.34}
              style={{animation:`connection-spark 1.6s ease-in-out ${node.delay} infinite`}}/>;
          })}
        </svg>

        <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",width:48,height:48,borderRadius:"50%",
          display:"grid",placeItems:"center",background:"linear-gradient(180deg,#FFF4CC,#F3C24F)",border:"3px solid #B97718",
          boxShadow:"0 5px 0 rgba(98,55,8,0.35), 0 0 18px rgba(212,136,42,0.35)",fontFamily:"var(--font-game)",fontSize:"1.35rem",color:"#7B2A20",zIndex:1,pointerEvents:"none"}}>
          ♥
        </div>

        {NODES.map(node => {
          const opt=opts[node.idx]; const color=opt.color||getEmotionStyle(opt.emotion).color; const active=selected===node.idx;
          return (
            <button key={node.idx} type="button" disabled={disabled} onClick={()=>choose(node)}
              className="connection-node-btn"
              style={{position:"absolute",left:`${node.x}%`,top:`${node.y}%`,transform:"translate(-50%,-50%)",
                "--node-color":color, background:active?`${color}30`:"rgba(255,255,255,0.84)",
                border:`2px solid ${color}`, boxShadow:active?`0 0 0 5px ${color}22, 0 4px 0 rgba(60,30,8,0.20)`:"0 3px 0 rgba(80,40,8,0.16)"}}>
              <span className="connection-node-dot" style={{background:color}}/>
              <span>{node.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RaceTrackGame({ opts, disabled, onConfirm }) {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EASY ADJUSTMENT CONSTANTS — edit these
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const SCENE_W        = 300;   // width of the sky/road scene (and checkpoint row below it) at full size —
                                 // shrinks to fit narrower boxes via maxWidth:"100%" below (same pattern as
                                 // RippleZoneGame's width:330,maxWidth:"100%")                    ← EDIT THIS
  const SCENE_H        = 72;    // height of the sky/road scene. This height (plus the rows below it)
                                 // is tuned to fit the white box's vertical budget on short screens —
                                 // the box doesn't scroll or clip overflow, so grow this only if you've
                                 // re-measured against a short viewport (~560-640px tall) and confirmed
                                 // "That's it" still lands inside the box.                       ← EDIT THIS
  const SCENE_TOP      = 6;     // small gap below the sprite row. The sprite/speech-bubble row has a
                                 // -82px margin so it visually overlaps this game area — it's kept
                                 // above the scene via z-index (see .checkin-quiz-sprite-row in
                                 // styles.css) rather than by pushing the scene down to clear it,
                                 // which would eat too much of the box's vertical budget.          ← EDIT THIS
  const CAR_W          = 34;    // car svg width  ← EDIT THIS
  const CAR_H          = 22;    // car svg height ← EDIT THIS
  const ROAD_Y         = 36;    // road's y position within the scene (car/flags are derived from this) ← EDIT THIS
  const ROAD_H         = 14;    // road thickness                                                        ← EDIT THIS
  const LANE_FONT      = "0.72rem";  // checkpoint flavor-text size ("Stalled", "Cruising"...)  ← EDIT THIS
  const LABEL_FONT     = "0.88rem";  // selected-answer feedback text size                      ← EDIT THIS
  const BTN_PAD        = "7px 20px"; // "That's it" button padding  ← EDIT THIS
  const BTN_FONT       = "0.78rem";  // "That's it" button text size ← EDIT THIS
  const ROW_GAP        = 8;     // vertical gap between scene / checkpoints / label / button    ← EDIT THIS

  // Flavor labels for the track checkpoints, left (just starting) → right (finish line).
  // opts are ordered best(0)…worst(n-1), so the lane order is reversed from opts order.
  const LANE_LABELS = ["Stalled", "Idling", "Cruising", "Finish!"];
  const n = opts.length;
  const [selected, setSelected] = useState(null); // index into opts
  const current  = selected !== null ? opts[selected] : null;
  const color    = current ? (current.color || getEmotionStyle(current.emotion).color) : "#8B6030";
  const activeLane = selected !== null ? n - 1 - selected : 0;
  const carLeft  = `${((activeLane + 0.5) / n) * 100}%`;

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:ROW_GAP,width:"100%"}}>
      {/* Scene: sky + grass + road + car */}
      <div style={{position:"relative",width:SCENE_W,maxWidth:"100%",height:SCENE_H,borderRadius:14,marginTop:SCENE_TOP,
        overflow:"hidden",flexShrink:0,
        background:"linear-gradient(180deg,#BEE3F5 0%,#E7F3D8 62%,#8FC168 62%,#7AB258 100%)"}}>
        {/* sun + clouds */}
        <div style={{position:"absolute",top:8,right:16,width:20,height:20,borderRadius:"50%",
          background:"radial-gradient(circle,#FFE98A,#FFCF4D)",boxShadow:"0 0 14px rgba(255,207,77,0.7)"}}/>
        <div style={{position:"absolute",top:10,left:18,width:26,height:9,borderRadius:999,background:"rgba(255,255,255,0.85)"}}/>
        <div style={{position:"absolute",top:16,left:30,width:16,height:7,borderRadius:999,background:"rgba(255,255,255,0.75)"}}/>

        {/* road — sits at the sky/grass boundary (the CSS gradient breaks at 62% of SCENE_H).
            width="100%" (not a fixed px) so it shrinks together with the scene div above on narrow boxes;
            the viewBox stays in SCENE_W units so every shape below keeps its proportions. */}
        <svg width="100%" height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="none" style={{position:"absolute",inset:0}}>
          <rect x="4" y={ROAD_Y} width={SCENE_W-8} height={ROAD_H} rx={ROAD_H/2} fill="#6E7889"/>
          <rect x="4" y={ROAD_Y} width={SCENE_W-8} height={ROAD_H} rx={ROAD_H/2} fill="none" stroke="#4A5260" strokeWidth="1.6"/>
          {Array.from({length:11}).map((_,i)=>(
            <rect key={i} x={16+i*29} y={ROAD_Y+ROAD_H/2-1.5} width="12" height="3" rx="1.5" fill="#F4E7B8"/>
          ))}
          {[0,1].map(row=>Array.from({length:4}).map((_,col)=>(
            <rect key={`${row}-${col}`} x={SCENE_W-28+col*7} y={ROAD_Y+row*(ROAD_H/2)} width="7" height={ROAD_H/2}
              fill={(row+col)%2===0?"#1d1714":"#fff"}/>
          )))}
          {/* start flag */}
          <rect x="10" y={ROAD_Y-14} width="2" height="14" fill="#5A3A18"/>
          <path d={`M12 ${ROAD_Y-14} L24 ${ROAD_Y-10} L12 ${ROAD_Y-6} Z`} fill="#E85D4A"/>
        </svg>

        {/* Car */}
        <svg width={CAR_W} height={CAR_H} viewBox={`0 0 ${CAR_W} ${CAR_H}`} style={{position:"absolute",top:ROAD_Y-CAR_H+3,left:carLeft,
          transform:"translateX(-50%)",transition:"left 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          filter:"drop-shadow(0 3px 2px rgba(0,0,0,0.25))"}}>
          <rect x="2" y="10" width="30" height="9" rx="4.5" fill={color}/>
          <path d="M8 10 Q10 2 17 2 Q24 2 26 10 Z" fill={color} opacity="0.88"/>
          <rect x="11.5" y="4" width="6.5" height="5.5" rx="1.4" fill="#EAF4FF" opacity="0.92"/>
          <rect x="19" y="4" width="5.5" height="5.5" rx="1.4" fill="#EAF4FF" opacity="0.7"/>
          <circle cx="9" cy="20" r="3.4" fill="#1d1714"/>
          <circle cx="25" cy="20" r="3.4" fill="#1d1714"/>
          <circle cx="9" cy="20" r="1.3" fill="#7A8494"/>
          <circle cx="25" cy="20" r="1.3" fill="#7A8494"/>
        </svg>
      </div>

      {/* Checkpoints — same responsive width as the scene above, so each lane gets
          proportional room for its label instead of being squeezed on a narrow box.
          Each checkpoint gets real button chrome (pill background/border/shadow) to
          match the tappable-option styling used by every other check-in game
          (see .connection-node-btn in RippleZoneGame). Single-line, no dot icon —
          the box has a tight vertical budget (see SCENE_H note above) and a
          two-row dot+label button was tall enough to push "That's it" past the
          bottom of the box on shorter screens. */}
      <div style={{display:"flex",width:SCENE_W,maxWidth:"100%",gap:6}}>
        {Array.from({length:n}).map((_,i)=>{
          const optIdx = n-1-i; const opt = opts[optIdx]; const c = opt.color || getEmotionStyle(opt.emotion).color;
          const active = selected === optIdx;
          return (
            <button key={optIdx} type="button" disabled={disabled} onClick={()=>!disabled&&setSelected(optIdx)}
              aria-label={opt.label} aria-pressed={active}
              style={{flex:"1 1 0",minWidth:0,
                background:active?`${c}22`:"rgba(255,255,255,0.55)",
                border:`2px solid ${active?c:c+"55"}`,borderRadius:999,
                padding:"4px 2px",
                boxShadow:active?`0 3px 0 ${c}55, 0 0 10px ${c}55`:"0 2px 0 rgba(80,40,8,0.14)",
                cursor:disabled?"default":"pointer",transition:"all 0.15s"}}>
              <span style={{fontFamily:"var(--font-game)",fontSize:LANE_FONT,fontWeight:700,color:active?c:"var(--text-3)",
                textAlign:"center",lineHeight:1.15,whiteSpace:"nowrap"}}>
                {LANE_LABELS[i] ?? ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* Feedback label */}
      <div style={{fontFamily:"var(--font-game)",fontWeight:800,fontSize:LABEL_FONT,color:current?color:"var(--text-3)",minHeight:20,textAlign:"center"}}>
        {current?.label ?? "Tap a checkpoint"}
      </div>

      <button className="scroll-btn-primary" disabled={disabled||selected===null}
        onClick={()=>selected!==null&&onConfirm(opts[selected])}
        style={{background:current?`linear-gradient(135deg,${color},${color}bb)`:undefined,
          padding:BTN_PAD,fontSize:BTN_FONT,opacity:selected===null?0.5:1}}>
        That's it
      </button>
    </div>
  );
}

// Simple 4-lobe puffy cloud silhouette (one ellipse base + 3 overlapping circles).
function sleepCloudShape(s) {
  const w = 26*s, h = 16*s;
  return {
    w, h,
    parts: [
      { cx:13*s, cy:11*s, rx:11*s, ry:5.5*s, ellipse:true },
      { cx:7*s,  cy:8*s,  r:6*s   },
      { cx:14*s, cy:5*s,  r:7*s   },
      { cx:20*s, cy:8*s,  r:5.5*s },
    ],
  };
}

function SleepBedGame({ opts, disabled, onConfirm }) {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EASY ADJUSTMENT CONSTANTS — edit these
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Deliberately NOT a track/checkpoint-row layout (that's RaceTrackGame's shape).
  // The 4 answers are dream-clouds drifting in the corners of the night sky, each with
  // an always-visible label (unlabelled icons tested poorly — nobody could tell what
  // they meant before tapping). Size signals how "big" each option is: Deeply is the
  // biggest, brightest cloud; Very little is a thin wisp.
  // VB_W/VB_H is the fixed coordinate space every number below (clouds, bed, blanket,
  // face) is drawn in. SCENE_W/SCENE_H is the panel's actual on-screen size — the bed
  // SVG stretches VB_W×VB_H to fill it (preserveAspectRatio="none"), and the clouds are
  // positioned in %, so growing SCENE_W/SCENE_H scales EVERYTHING together without
  // needing to touch a single drawing coordinate.
  // The box itself now wears the night-sky palette for this question (see the
  // "checkin-quiz-box--night" class applied in the parent render), so this panel no
  // longer paints its own background/border — it's just the coordinate space the
  // clouds + bed are laid out in, sized to fill most of that box.
  const VB_W       = 260, VB_H = 90;
  const SCENE_W    = 420;   // on-screen panel width  — bump this to make the game bigger ← EDIT THIS
  const SCENE_H    = 90;    // on-screen panel height — re-check against a short viewport
                             // (~480-640px tall) before growing further — the box doesn't
                             // scroll or clip overflow (see RaceTrackGame's SCENE_H note a
                             // few functions up). The box itself is flex:1 inside a
                             // fixed-height column (progress header + box + Previous button),
                             // so it does NOT grow to fit taller content — anything added
                             // here has to fit inside the ~227px the box actually has to
                             // give the game area, or it visually bleeds into the Previous
                             // button below.                                               ← EDIT THIS
  const GROW       = SCENE_W / VB_W; // how much bigger this panel is than the original
                             // 260-wide design — the cloud icons (plain px SVGs, not part
                             // of the viewBox-stretched bed art) are scaled up by this so
                             // they grow in proportion instead of looking tiny on the
                             // bigger panel.                                              ← EDIT THIS
  const CLOUD_FONT = "0.72rem"; // always-on cloud label text size — matches RippleZoneGame's node text ← EDIT THIS
  const LABEL_FONT = "0.85rem"; // selected-answer feedback text size                                   ← EDIT THIS
  const BTN_PAD    = "7px 20px"; // "That's it" button padding                                          ← EDIT THIS
  const BTN_FONT   = "0.78rem"; // "That's it" button text size                                         ← EDIT THIS
  const ROW_GAP    = 8;     // vertical gap between scene panel / feedback / button                     ← EDIT THIS

  // Each cloud: position in the sky (in VB_W×VB_H units — converted to % below so it
  // scales with SCENE_W/SCENE_H), its size scale, and which side/edge its label anchors
  // to so labels stay clear of the bed AND the panel's edges instead of lining up in a row.
  // x is pulled in from the edges (24/244, not 32/228) so labels clear the blanket,
  // which is painted after the clouds and would otherwise sit on top of the text —
  // the blanket spans x 78–210, so the bottom-row labels need that extra margin.
  // Labels point OUTWARD, away from the bed (top row's label sits ABOVE its cloud,
  // bottom row's sits BELOW) — pointing them inward used to walk the text straight
  // into the character's face / the blanket. The panel now uses overflow:"visible"
  // (see the scene <div> below) so an outward label near the top/bottom edge never
  // gets clipped.
  const CLOUDS = [
    { x: 40,  y: 20, scale: 1.0,  labelSide: "above", labelAlign: "start" }, // Deeply — biggest, brightest
    { x: 244, y: 20, scale: 0.85, labelSide: "above", labelAlign: "end"   }, // Okay
    { x: 40,  y: 76, scale: 0.7,  labelSide: "below", labelAlign: "start" }, // Restless
    { x: 244, y: 76, scale: 0.5,  labelSide: "below", labelAlign: "end"   }, // Very little — a thin wisp
  ];

  // opts are already ordered Deeply → Okay → Restless → Very little, so the clouds
  // and the sleeping character's expression can both key off the raw index.
  const [selected, setSelected] = useState(null);
  const current  = selected !== null ? opts[selected] : null;
  // Raw option colour is kept for journal history (read against light backgrounds
  // elsewhere) — liftForContrast() brightens it just for on-screen use here, where
  // everything sits against the dark night-sky panel.
  const color    = current ? liftForContrast(current.color || getEmotionStyle(current.emotion).color) : "#C9B896";
  const zzzCount = selected === 0 ? 3 : selected === 1 ? 1 : 0; // Deeply dreams big, Okay dozes, Restless/Very little/undecided get none
  const restless = selected === 2;
  const awake    = selected === 3;

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:ROW_GAP,width:"100%"}}>
      {/* Panel: night sky scattered with tappable, always-labelled dream-clouds + bed + sleeping character.
          No background/border of its own — the parent box already wears the night palette
          (checkin-quiz-box--night), so this is purely a layout/coordinate space. */}
      <div style={{position:"relative",width:SCENE_W,maxWidth:"100%",height:SCENE_H,marginTop:8,marginBottom:6,
        overflow:"visible",flexShrink:0}}>
        {/* moon — decorative only, the clouds are the picker */}
        <div style={{position:"absolute",top:`${6/VB_H*100}%`,left:"50%",transform:"translateX(-50%)",width:13,height:13,borderRadius:"50%",
          background:"radial-gradient(circle at 35% 35%,#FFF8DC,#F3D98A)",boxShadow:"0 0 10px rgba(255,236,160,0.6)",
          animation:"sun-pulse 3s ease-in-out infinite"}}/>

        {/* the 4 answers, scattered as drifting clouds rather than lined up in a row —
            positioned in % (of VB_W/VB_H) so they scale exactly like the bed SVG below,
            which stretches the same VB_W×VB_H drawing to fill SCENE_W×SCENE_H. */}
        {CLOUDS.map((s,i) => {
          const opt = opts[i];
          const c = liftForContrast(opt.color || getEmotionStyle(opt.emotion).color);
          const active = selected===i;
          const { w, h, parts } = sleepCloudShape(s.scale * GROW);
          return (
            <button key={i} type="button" disabled={disabled} onClick={()=>!disabled&&setSelected(i)}
              aria-label={opt.label} aria-pressed={active}
              style={{position:"absolute",left:`${s.x/VB_W*100}%`,top:`${s.y/VB_H*100}%`,transform:"translate(-50%,-50%)",zIndex:2,
                width:w+10,height:h+10,display:"flex",alignItems:"center",justifyContent:"center",
                background:"none",border:"none",padding:0,cursor:disabled?"default":"pointer"}}>
              <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
                style={{animation:active
                    ? "cloud-pop 0.4s cubic-bezier(0.34,1.56,0.64,1), sun-pulse 1.6s ease-in-out 0.4s infinite"
                    : `cloud-drift ${4+i*0.4}s ease-in-out infinite`,
                  filter:active?`drop-shadow(0 0 6px ${c})`:"none",
                  transition:"filter 220ms ease"}}>
                {parts.map((p,pi)=> p.ellipse
                  ? <ellipse key={pi} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={active?c:"rgba(255,255,255,0.55)"} style={{transition:"fill 220ms ease"}}/>
                  : <circle key={pi} cx={p.cx} cy={p.cy} r={p.r} fill={active?c:"rgba(255,255,255,0.55)"} style={{transition:"fill 220ms ease"}}/>
                )}
              </svg>
              <span style={{position:"absolute",
                left:s.labelAlign==="start"?0:undefined,right:s.labelAlign==="end"?0:undefined,
                top:s.labelSide==="below"?"100%":undefined,bottom:s.labelSide==="above"?"100%":undefined,
                marginTop:s.labelSide==="below"?2:0,marginBottom:s.labelSide==="above"?2:0,
                fontFamily:"var(--font-game)",fontSize:CLOUD_FONT,fontWeight:700,whiteSpace:"nowrap",
                color:active?c:"rgba(255,252,230,0.65)",transition:"color 0.15s"}}>
                {opt.label}
              </span>
            </button>
          );
        })}

        <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" style={{position:"absolute",top:0,left:0,pointerEvents:"none"}}>
          {/* headboard */}
          <rect x="66" y="34" width="10" height="30" rx="4" fill="#3E2F22"/>
          {/* pillow */}
          <ellipse cx="104" cy="46" rx="20" ry="8" fill="#FFF8E7" stroke="#E4D8BC" strokeWidth="1.1"/>
          {/* character head + face — expression follows the tentative selection */}
          <g style={restless?{animation:"bed-toss 0.6s ease-in-out infinite",transformOrigin:"104px 44px"}:undefined}>
            <circle cx="104" cy="44" r="10" fill="#F4C9A0" stroke="#8B5E34" strokeWidth="1.3"/>
            {awake ? (
              <>
                <circle cx="99" cy="43" r="2.6" fill="#fff" stroke="#3a2a18" strokeWidth="1"/>
                <circle cx="109" cy="43" r="2.6" fill="#fff" stroke="#3a2a18" strokeWidth="1"/>
                <circle cx="99" cy="43" r="1.1" fill="#2a1c10"/>
                <circle cx="109" cy="43" r="1.1" fill="#2a1c10"/>
                <ellipse cx="104" cy="49" rx="2" ry="1.6" fill="#8B5E34" opacity="0.7"/>
              </>
            ) : restless ? (
              <>
                <path d="M96 42L99 44L96 46" stroke="#3a2a18" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M112 42L109 44L112 46" stroke="#3a2a18" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M101 50Q104 48.5 107 50" stroke="#3a2a18" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              </>
            ) : (
              <>
                <path d="M96 43Q99 45.5 102 43" stroke="#3a2a18" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                <path d="M106 43Q109 45.5 112 43" stroke="#3a2a18" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                <path d="M101 49.5Q104 51 107 49.5" stroke="#3a2a18" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              </>
            )}
          </g>
          {/* blanket — colour tracks the tentatively selected option, like the car in RaceTrackGame */}
          <rect x="78" y="52" width="132" height="14" rx="7" fill={color} opacity="0.88" style={{transition:"fill 220ms ease"}}/>
          <rect x="78" y="52" width="132" height="5" rx="2.5" fill="#fff" opacity="0.18"/>
        </svg>

        {/* floating Zzz — count scales with how deeply they slept */}
        {Array.from({length:zzzCount}).map((_,i)=>(
          <span key={i} style={{position:"absolute",right:`${(52-i*13)/VB_W*100}%`,top:`${(32-i*3)/VB_H*100}%`,
            fontFamily:"var(--font-game)",fontWeight:800,color,
            fontSize:`${0.56+i*0.14}rem`,opacity:0,
            animation:`zzz-float 2.6s ease-out ${i*0.5}s infinite`}}>Z</span>
        ))}
      </div>

      {/* Feedback label */}
      <div style={{fontFamily:"var(--font-game)",fontWeight:800,fontSize:LABEL_FONT,color:current?color:"var(--text-3)",minHeight:20,textAlign:"center"}}>
        {current?.label ?? "How did you sleep?"}
      </div>

      <button className="scroll-btn-primary" disabled={disabled||selected===null}
        onClick={()=>selected!==null&&onConfirm(opts[selected])}
        style={{background:current?`linear-gradient(135deg,${color},${color}bb)`:undefined,
          padding:BTN_PAD,fontSize:BTN_FONT,opacity:selected===null?0.5:1}}>
        That's it
      </button>
    </div>
  );
}

function MountainWaypointGame({ opts, disabled, onPick }) {
  const WPS=[{label:"Base",cx:110,cy:152,idx:0},{label:"Lower",cx:92,cy:122,idx:1},{label:"Near summit",cx:74,cy:90,idx:2},{label:"Peak",cx:66,cy:52,idx:3}];
  const [hovered,setHovered]=useState(null);
  return (
    <div style={{display:"flex",justifyContent:"center"}}>
      <svg width="170" height="172" viewBox="0 0 170 172" fill="none">
        <path d="M8 168 L66 30 L148 168 Z" fill="var(--bg-2)" stroke="var(--text-3)" strokeWidth="1.8" strokeLinejoin="round" opacity="0.65"/>
        <path d="M66 30 L52 70 L80 70 Z" fill="white" opacity="0.45"/>
        <path d="M110 152 L92 122 L74 90 L66 52" stroke="var(--text-3)" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.3" strokeLinecap="round"/>
        {WPS.map(({label,cx,cy,idx})=>{
          const opt=opts[idx]; const c=getEmotionStyle(opt.emotion).color; const isHov=hovered===idx;
          return (
            <g key={idx} style={{cursor:disabled?"default":"pointer"}} onClick={()=>!disabled&&onPick(opt)} onMouseEnter={()=>setHovered(idx)} onMouseLeave={()=>setHovered(null)}>
              <circle cx={cx} cy={cy} r={isHov?13:9} fill={isHov?c+"30":c+"18"} stroke={c} strokeWidth={isHov?2:1.5} style={{transition:"all 0.12s"}}/>
              <circle cx={cx} cy={cy} r="3.5" fill={c} opacity="0.9"/>
              <text x={cx+14} y={cy+4} style={{fontSize:"8px",fontWeight:700,fill:c,pointerEvents:"none"}}>{label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Journal tab switcher ──────────────────────────────────────────────────────
function JournalTabs({ view, setView }) {
  return (
    <div className="journal-view-tabs">
      {[{id:"journal",label:"Journal"},{id:"checkin",label:"Daily Check-In"},{id:"journey",label:"My Journey"}].map(t=>(
        <button key={t.id} className={`journal-view-tab${view===t.id?" active":""}`} onClick={()=>setView(t.id)} type="button">{t.label}</button>
      ))}
    </div>
  );
}

// ── Scroll content wrapper ────────────────────────────────────────────────────
function ScrollPage({ children }) {
  return (
    <div className="wellness-content">
      <img src="/assets/scroll-bg.png" alt="" aria-hidden="true" className="wellness-bg-img wellness-scroll-bg"
        onError={e=>e.currentTarget.style.display="none"}/>
      <div className="wellness-scroll-overlay">{children}</div>
    </div>
  );
}

// ── Book content wrapper ──────────────────────────────────────────────────────
function BookPage({ leftContent, rightContent }) {
  return (
    <div className="wellness-content">
      <img src="/assets/book-bg.png" alt="" aria-hidden="true" className="wellness-bg-img wellness-book-bg"
        onError={e=>e.currentTarget.style.display="none"}/>
      <div className="wellness-book-overlay">
        <div className="book-page-left">{leftContent}</div>
        <div className="book-page-right">{rightContent}</div>
      </div>
    </div>
  );
}

const detector = new EmotionDetector();
const journalist = new AIJournalist();

// ── WellnessView ──────────────────────────────────────────────────────────────
export default function WellnessView({
  emotion, setEmotion, journalEntries, setJournalEntries,
  character, coins, setCoins, player, setPlayer,
  muted, toggleMute, onOpenSettings, onOpenUser,
}) {
  const [view, setView]                 = useState("journal");
  const [draft, setDraft]               = useState("");
  const [analyzing, setAnalyzing]       = useState(false);
  const [aiResult, setAiResult]         = useState(null);
  const [companionResponse, setCompanion] = useState(null);
  const [confirmStage, setConfirmStage] = useState(null);
  const [pendingEntry, setPendingEntry] = useState(null);
  const [chatHistory, setChatHistory]   = useState([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatLoading, setChatLoading]   = useState(false);
  const [replyingTo, setReplyingTo]     = useState(null);
  const [hoveredMsg, setHoveredMsg]     = useState(null);
  const chatContainerRef = useRef(null);
  useEffect(()=>{
    const el = chatContainerRef.current;
    if(!el) return;
    el.scrollTop = el.scrollHeight;
  },[chatHistory,chatLoading]);
  useEffect(()=>{
    const main = document.querySelector(".main-content");
    if(main) main.scrollTop = 0;
  },[]);

  const [quizStarted, setQuizStarted]   = useState(false);
  const [quizIdx, setQuizIdx]           = useState(0);
  const [quizDone, setQuizDone]         = useState(false);
  const [quizScore, setQuizScore]       = useState(0);
  const [quizEmot, setQuizEmot]         = useState(null);
  const [quizVotes, setQuizVotes]       = useState({});
  const [quizAnalyzing, setQuizAnalyzing] = useState(false);
  const [quizReacting, setQuizReacting] = useState(false);
  const [lastReaction, setLastReaction] = useState(null);

  const [showGoalPrompt, setShowGoalPrompt] = useState(false);
  const [newGoalInput, setNewGoalInput]     = useState("");

  // My Journey — right page state
  const [rightTab, setRightTab]   = useState("journal"); // "journal" | "checkin"
  const [journalIdx, setJournalIdx] = useState(0);
  const [checkinIdx, setCheckinIdx] = useState(0);
  const [openChatEntryId, setOpenChatEntryId] = useState(null);

  const memory  = useMemo(()=>new JournalMemory(journalEntries),[journalEntries]);
  const summary = useMemo(()=>memory.getWeekSummary(),[memory]);
  const currentEmotion = getEmotionStyle(emotion);
  const journeyBookButtonStyle = {
    width:"170px",padding:"6px 0",borderRadius:10,fontFamily:"var(--font-game)",fontSize:"0.7rem",whiteSpace:"nowrap",
    color:"#582f25",background:"rgba(255,255,255,0.62)",border:"1.5px solid rgba(139,80,30,0.24)",
    boxShadow:"0 2px 0 rgba(80,40,8,0.18)",cursor:"pointer"
  };

  // Filtered entry lists
  const journalOnly  = useMemo(()=>journalEntries.filter(e=>e.source!=="checkin"),[journalEntries]);
  const checkinOnly  = useMemo(()=>journalEntries.filter(e=>e.source==="checkin"),[journalEntries]);
  const activeEntries = rightTab==="journal" ? journalOnly : checkinOnly;
  const activeIdx     = rightTab==="journal" ? journalIdx  : checkinIdx;
  const setActiveIdx  = rightTab==="journal" ? setJournalIdx : setCheckinIdx;
  const currentEntry  = activeEntries[activeIdx] ?? null;

  // ── Journal save ─────────────────────────────────────────────────────────────
  async function analyzeEntry(e) {
    if (e?.preventDefault) e.preventDefault();
    const text=draft.trim();
    if (analyzing) return;
    if (!text) { alert("Please write something first."); return; }
    setAnalyzing(true); setAiResult(null); setCompanion(null); setConfirmStage(null);
    try {
      const dr=detector.analyze(text,journalEntries);
      const [hf,resp]=await Promise.all([analyzeEmotionAI(text),journalist.generateResponse(text,dr,journalEntries,player?.name)]);
      let m=mergeAnalysis(dr,hf??{emotion:"neutral",confidence:50,source:"fallback"});
      if (resp?.emotion) m={...m,emotion:resp.emotion,confidence:Math.max(m.confidence,80)};
      const initialAiChat=resp?.text?[{role:"ai",text:resp.text}]:[];
      const entry={id:crypto.randomUUID(),date:localDateKey(),text,emotion:m.emotion,confidence:m.confidence,source:hf?"ai":"local",aiChat:initialAiChat,companionResponse:resp?.text??""};
      setAiResult(m); setCompanion(resp); setPendingEntry(entry); setConfirmStage("confirm");
    } catch(err) {
      console.warn("[Kindred] analyzeEntry failed, saving locally:", err);
      const dr=detector.analyze(text,journalEntries);
      const resp=journalist._templateResponse?.(text,dr,journalEntries);
      const entry={id:crypto.randomUUID(),date:localDateKey(),text,emotion:dr.emotion,confidence:dr.confidence??60,source:"local",aiChat:resp?.text?[{role:"ai",text:resp.text}]:[],companionResponse:resp?.text??""};
      setJournalEntries(p=>[entry,...p]); setEmotion(dr.emotion); setDraft("");
      if(setCoins) setCoins(c=>c+15);
    } finally {
      setAnalyzing(false);
    }
  }
  function mergeAnalysis(dr,hf){if(dr.overrideReason)return dr;if(hf.confidence>74&&hf.emotion===dr.emotion)return{...dr,confidence:Math.min(92,dr.confidence+8)};if(hf.emotion!==dr.emotion&&hf.confidence>68)return{...dr,confidence:Math.max(54,dr.confidence-8)};return dr;}
  function getSavedChatHistory(){
    const initialReply=String(companionResponse?.text||"").trim();
    const saved=chatHistory.map(m=>({role:m.role,text:String(m.text||"")})).filter(m=>m.text.trim());
    if(initialReply&&!saved.some(m=>m.role==="ai"&&m.text===initialReply))saved.unshift({role:"ai",text:initialReply});
    return saved;
  }
  function mergeEntryChat(entry){
    const chat=[...normalizeAiChat(entry)];
    for(const m of getSavedChatHistory()){
      if(!chat.some(existing=>existing.role===m.role&&existing.text===m.text))chat.push(m);
    }
    return chat;
  }
  function acceptEmotion(){if(!pendingEntry)return;const savedChat=mergeEntryChat(pendingEntry);const entry={...pendingEntry,aiChat:savedChat};setJournalEntries(p=>[entry,...p]);setEmotion(pendingEntry.emotion);setDraft("");setConfirmStage(null);setPendingEntry(null);setAiResult(null);setCompanion(null);setChatHistory([]);setChatInput("");if(setCoins)setCoins(c=>c+15);}
  function selectAlternativeEmotion(alt){if(!pendingEntry)return;const savedChat=mergeEntryChat(pendingEntry);const c2={...pendingEntry,emotion:alt,source:"manual",aiChat:savedChat};setJournalEntries(p=>[c2,...p]);setEmotion(alt);setDraft("");setConfirmStage(null);setPendingEntry(null);setAiResult(null);setCompanion(null);setChatHistory([]);setChatInput("");if(setCoins)setCoins(c=>c+15);}
  async function sendChatMessage(){
    const msg=chatInput.trim(); if(!msg||chatLoading) return;
    const userMsg=replyingTo?{role:"user",text:msg,replyTo:replyingTo.text}:{role:"user",text:msg};
    const newHistory=[...chatHistory,userMsg];
    setChatHistory(newHistory); setChatInput(""); setReplyingTo(null); setChatLoading(true);
    const reply=await journalist.generateChatReply(msg,newHistory,pendingEntry?.text??"",aiResult?.emotion??"",player?.name);
    setChatHistory(h=>[...h,{role:"ai",text:reply}]); setChatLoading(false);
  }

  // ── Quiz ─────────────────────────────────────────────────────────────────────
  async function answerQuiz(opt){
    const votes={...quizVotes,[QUIZ[quizIdx].id]:opt.emotion};
    const running=quizScore+opt.score; setQuizVotes(votes);
    if(quizIdx<QUIZ.length-1){setQuizIdx(i=>i+1);setQuizScore(running);return;}
    const counts={};Object.values(votes).forEach(em=>{counts[em]=(counts[em]??0)+1;});
    let fb=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
    if(running<=8&&!["sad","anxious","tired"].includes(fb))fb="tired";
    else if(running>=18&&["sad","tired"].includes(fb))fb="content";
    setQuizScore(running);setQuizDone(true);setQuizEmot(fb);
    const txt=QUIZ.map(q=>{const v=votes[q.id];const ch=q.opts.find(o=>o.emotion===v);return`${q.dimension}: "${ch?.label??v}"`;}).join("\n");
    setQuizAnalyzing(true);const gEm=await journalist.detectEmotion(txt,journalEntries);setQuizAnalyzing(false);
    const final=gEm??fb;setQuizEmot(final);setEmotion(final);
    // Build per-question answers for display later
    const answers=QUIZ.map(q=>{
      const emo=votes[q.id];
      const chosen=q.opts.find(o=>o.emotion===emo);
      return{dimension:q.dimension,question:q.q,answer:chosen?.label??emo,emotion:emo,color:chosen?.color};
    });
    setJournalEntries(p=>[{id:crypto.randomUUID(),date:localDateKey(),text:"Daily check-in completed.",emotion:final,confidence:gEm?85:76,source:"checkin",answers},...p]);
    if(setCoins)setCoins(c=>c+10);
  }
  async function handleQuizTap(opt){
    if(quizReacting)return;
    setQuizReacting(true);
    setLastReaction({text:"…",score:opt.score});
    const q=QUIZ[quizIdx];
    const text=await journalist.generateQuizReaction(q.q,opt.label,player?.name);
    setLastReaction({text,score:opt.score});
    setTimeout(()=>{setQuizReacting(false);setLastReaction(null);answerQuiz(opt);},1800);
  }
  function goBackQuiz(){if(quizIdx===0||quizReacting)return;const pi=quizIdx-1,pq=QUIZ[pi],pe=quizVotes[pq.id],po=pq.opts.find(o=>o.emotion===pe);setQuizIdx(pi);setQuizScore(s=>s-(po?.score??0));setQuizVotes(v=>{const n={...v};delete n[pq.id];return n;});setLastReaction(null);setQuizReacting(false);}
  function resetQuiz(){setQuizStarted(false);setQuizIdx(0);setQuizDone(false);setQuizEmot(null);setQuizVotes({});setQuizScore(0);setQuizAnalyzing(false);setQuizReacting(false);setLastReaction(null);}

  // ── Goal ─────────────────────────────────────────────────────────────────────
  function markGoalAchieved(){setPlayer(p=>({...p,goalAchieved:true,goalAchievedAt:new Date().toISOString().slice(0,10)}));setShowGoalPrompt(false);}
  function submitNewGoal(e){e.preventDefault();const g=newGoalInput.trim();if(!g)return;setPlayer(p=>({...p,goal:g,goalAchieved:false,goalAchievedAt:null}));setNewGoalInput("");setShowGoalPrompt(false);}
  function editGoal(){setNewGoalInput(player?.goal??"");setShowGoalPrompt(true);}
  function deleteGoal(){setPlayer(p=>({...p,goal:"",goalAchieved:false,goalAchievedAt:null}));setNewGoalInput("");setShowGoalPrompt(false);}
  function getGoalTextSize(goal){
    const text=String(goal||"").trim();
    const lineBreaks=(text.match(/\n/g)||[]).length;
    const effectiveLength=text.length+(lineBreaks*28);
    if(effectiveLength<=28)return{fontSize:"1.08rem",lineHeight:1.24};
    if(effectiveLength<=60)return{fontSize:"0.94rem",lineHeight:1.32};
    if(effectiveLength<=110)return{fontSize:"0.8rem",lineHeight:1.4};
    if(effectiveLength<=170)return{fontSize:"0.68rem",lineHeight:1.48};
    return{fontSize:"0.58rem",lineHeight:1.55};
  }

  // ── Delete entry ─────────────────────────────────────────────────────────────
  function deleteEntry(id){
    setJournalEntries(p=>p.filter(e=>e.id!==id));
    setOpenChatEntryId(openId=>openId===id?null:openId);
    setActiveIdx(i=>Math.max(0,i-1));
  }

  const wellbeingBand=WELLBEING_BANDS.find(b=>(quizScore||0)<=b.max)??WELLBEING_BANDS[2];

  // Most-felt emotion across all entries (raw AI word → single-word via getEmotionStyle)
  const dominantRawEmotion=useMemo(()=>{
    if(!journalEntries.length) return null;
    const counts={};
    journalEntries.forEach(e=>{if(e.emotion)counts[e.emotion]=(counts[e.emotion]||0)+1;});
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]??null;
  },[journalEntries]);

  // 7-day mood chart — uses raw AI emotion → getEmotionStyle for label + colour
  const moodWeek=useMemo(()=>{
    const today=new Date();
    return Array.from({length:7},(_,i)=>{
      const d=new Date(today);d.setDate(today.getDate()-(6-i));
      const ds=localDateKey(d);
      const entry=journalEntries.find(e=>e.date===ds);
      if(!entry) return{day:WEEKDAYS_SHORT[d.getDay()],ds,mood:null};
      const es=getEmotionStyle(entry.emotion);
      const hex=es.color.replace('#','');
      const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
      const lum=(0.2126*r+0.7152*g+0.0722*b)/255;
      return{day:WEEKDAYS_SHORT[d.getDay()],ds,mood:{label:toOneWord(entry.emotion),color:es.color,border:es.color,text:lum>0.45?'#1a1a1a':'#fff'}};
    });
  },[journalEntries]);

  // ── Topbar ────────────────────────────────────────────────────────────────────
  const Topbar=(
    <div className="wellness-topbar">
      <div className="wellness-hud">
        <div className="home-badge home-badge-fire" style={{fontSize:"0.68rem",padding:"3px 9px"}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 2c0 6-8 8-8 14a8 8 0 0016 0c0-6-8-8-8-14z" fill="#FF5820"/></svg>11
        </div>
        <div className="home-badge home-badge-coin" style={{fontSize:"0.68rem",padding:"3px 9px"}}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.5" fill="#C88A08"/><circle cx="7" cy="7" r="5" fill="#F0C030"/></svg>
          {(coins??0).toLocaleString()}
        </div>
      </div>
      <div className="wellness-topbar-right">
        <button className="journal-top-btn" onClick={onOpenUser} aria-label="My profile"
          style={{fontFamily:"var(--font-game)",fontSize:"0.56rem",color:"rgba(245,216,144,0.9)",minWidth:36,letterSpacing:"0.2px"}}>
          {player?.name?.slice(0,2).toUpperCase()||"ME"}
        </button>
        <button className="journal-top-btn" onClick={toggleMute} aria-label={muted?"Unmute":"Mute"}>
          {muted
            ?<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" opacity="0.5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            :<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" opacity="0.5"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
          }
        </button>
        <button className="journal-top-btn" onClick={onOpenSettings} aria-label="Settings">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="wellness-shell">
      {Topbar}
      <div className="wellness-body">
      <JournalTabs view={view} setView={setView}/>
      <div className="wellness-main">

      {/* ════ JOURNAL ════ */}
      {view==="journal"&&(
        <ScrollPage>
          <h2 className="scroll-title">JOURNAL</h2>
          <div className="scroll-subtitle-blue">Unravel your inner thoughts</div>
          <div className="scroll-subtitle-brown" style={{marginBottom:8}}>Your companion is here for you.</div>

          {/* ── White content box ── */}
          <div className="scroll-white-box">
            {/*Option 1: AI confirm*/}
            {confirmStage==="confirm"&&aiResult&&(
              <div style={{display:"flex",flexDirection:"column",gap:10,flex:1,minHeight:0}}>
                {companionResponse&&<p style={{fontSize:"0.76rem",lineHeight:1.6,color:"#3D2010",fontFamily:"'Poppins',Georgia,serif",margin:0,padding:"10px 12px",background:"rgba(212,136,42,0.08)",borderRadius:10,borderLeft:"3px solid #D4882A"}}>{companionResponse.text}</p>}
                <div style={{fontFamily:"var(--font-game)",fontSize:"0.74rem",color:"#503111"}}>
                  I'm sensing <span style={{color:getEmotionStyle(aiResult.emotion).color,fontWeight:700}}>{EMOTIONS[aiResult.emotion]?.label??aiResult.emotion}</span>. Does that feel right?
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <button className="scroll-btn-primary" onClick={acceptEmotion} style={{fontSize:"0.72rem",padding:"8px 14px",textAlign:"left"}}>Yes, that's right!</button>
                  <button className="scroll-btn-secondary" onClick={()=>{setChatHistory([{role:"ai",text:companionResponse?.text??"I'm here. Tell me more."}]);setConfirmStage("chat");}} style={{fontSize:"0.72rem",padding:"8px 12px",textAlign:"left"}}>Talk to me more about this</button>
                  <button className="scroll-btn-secondary" onClick={()=>setConfirmStage("pick")} style={{fontSize:"0.72rem",padding:"8px 12px",textAlign:"left"}}>No, but I would like to pick my own emotions</button>
                </div>
              </div>
            )}

            {/* ── Option 2: Chat with companion ── */}
            {confirmStage==="chat"&&aiResult&&(
              <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0,gap:8}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                  <span style={{fontFamily:"var(--font-game)",fontSize:"0.7rem",color:"#503111"}}>Talking with your companion</span>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <button className="scroll-btn-secondary" onClick={()=>setConfirmStage("pick")} style={{fontSize:"0.65rem",padding:"5px 10px"}}>Pick my own emotion</button>
                    <button className="scroll-btn-primary" onClick={acceptEmotion} style={{fontSize:"0.65rem",padding:"5px 10px"}}>Save entry</button>
                  </div>
                </div>
                {/* Chat messages */}
                <div ref={chatContainerRef} style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:7,minHeight:0,paddingRight:4}}>
                  {chatHistory.map((m,i)=>(
                    <div key={i}
                      style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:4,position:"relative"}}
                      onMouseEnter={()=>setHoveredMsg(i)}
                      onMouseLeave={()=>setHoveredMsg(null)}>
                      {/* Reply button — shown on hover, left of AI bubble, right of user bubble */}
                      {m.role==="ai"&&hoveredMsg===i&&(
                        <button onClick={()=>setReplyingTo({index:i,text:m.text})}
                          title="Reply to this message"
                          style={{flexShrink:0,background:"rgba(212,136,42,0.15)",border:"1px solid rgba(139,80,30,0.2)",borderRadius:6,padding:"3px 6px",fontSize:"0.7rem",cursor:"pointer",color:"#7B4A1A",lineHeight:1,order:2}}>↩</button>
                      )}
                      <div style={{maxWidth:"80%",padding:"8px 11px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.role==="user"?"rgba(24,0,173,0.12)":"rgba(212,136,42,0.12)",fontFamily:"'Times New Roman',Georgia,serif",fontSize:"0.8rem",color:"#3D2010",lineHeight:1.55,order:m.role==="ai"?1:0}}>
                        {/* Quoted message strip inside user bubble */}
                        {m.replyTo&&(
                          <div style={{borderLeft:"2px solid rgba(139,80,30,0.45)",paddingLeft:7,marginBottom:5,fontSize:"0.72rem",color:"#7B4A1A",opacity:0.85,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:220}}>
                            {m.replyTo.length>80?m.replyTo.slice(0,80)+"…":m.replyTo}
                          </div>
                        )}
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{padding:"8px 11px",borderRadius:"14px 14px 14px 4px",background:"rgba(212,136,42,0.1)",fontFamily:"var(--font-game)",fontSize:"0.7rem",color:"#8B5A20"}}>…</div></div>}
                </div>
                {/* Reply preview bar */}
                {replyingTo&&(
                  <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(212,136,42,0.1)",borderRadius:8,padding:"5px 10px",flexShrink:0,borderLeft:"3px solid #D4882A"}}>
                    <div style={{flex:1,fontSize:"0.72rem",color:"#7B4A1A",fontFamily:"'Times New Roman',Georgia,serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      ↩ {replyingTo.text.length>90?replyingTo.text.slice(0,90)+"…":replyingTo.text}
                    </div>
                    <button onClick={()=>setReplyingTo(null)}
                      style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.85rem",color:"#8B5A20",lineHeight:1,padding:"0 2px",flexShrink:0}}>✕</button>
                  </div>
                )}
                {/* Input row */}
                <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"flex-end"}}>
                  <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChatMessage();}}}
                    placeholder={replyingTo?"Replying…":"Reply to your companion…"}
                    rows={2}
                    style={{flex:1,padding:"8px 12px",borderRadius:10,border:"1.5px solid rgba(139,80,30,0.25)",fontFamily:"'Times New Roman',Georgia,serif",fontSize:"0.82rem",color:"#3D2010",background:"rgba(255,255,255,0.7)",outline:"none",resize:"none",overflowY:"auto",maxHeight:"96px",lineHeight:"1.4",wordBreak:"break-word"}}/>
                  <button className="scroll-btn-primary" onClick={sendChatMessage} disabled={!chatInput.trim()||chatLoading} style={{padding:"8px 14px",fontSize:"0.72rem",opacity:chatInput.trim()&&!chatLoading?1:0.5,flexShrink:0}}>Send</button>
                </div>
              </div>
            )}

            {/* ── Option 3: Pick emotion ── */}
            {confirmStage==="pick"&&(
              <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0,overflow:"hidden"}}>
                <div style={{fontFamily:"var(--font-game)",fontSize:"0.95rem",color:"#503111",marginBottom:6}}>How would you describe it?</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:6,padding:"1px"}}>
                  {Object.entries(EMOTIONS).map(([key,em])=>(
                    <button key={key} className="emotion-pick-btn" onClick={()=>selectAlternativeEmotion(key)} aria-label={`Choose ${em.label}`}
                      style={{
                        "--emotion-color": em.color,
                        background:`linear-gradient(180deg, ${em.color}1c, ${em.color}32)`,
                        border:`2px solid ${em.color}`,
                        boxShadow:`0 3px 0 ${em.color}66, 0 6px 14px ${em.color}24`,
                      }}>
                      <div className="emotion-face-wrap">
                        <CartoonEmotionFace emotion={key} color={em.color}/>
                      </div>
                      <span style={{fontFamily:"var(--font-game)",fontSize:"0.58rem",color:em.color,fontWeight:700,letterSpacing:"0.02em"}}>
                        {em.label}
                      </span>
                    </button>
                  ))}
                </div>
                <button className="scroll-btn-secondary" style={{marginTop:9,fontSize:"0.7rem",padding:"6px 12px",flexShrink:0}} onClick={()=>setConfirmStage("confirm")}>← Back</button>
              </div>
            )}

            {!confirmStage&&(
              <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
                <textarea className="journal-textarea" value={draft} onChange={e=>setDraft(e.target.value)}
                  placeholder="Journal entry..."
                  style={{fontFamily:"'Poppins'",fontSize:"0.9rem",background:"transparent",border:"none",outline:"none",flex:1,minHeight:0,resize:"none",overflowY:"auto",color:"#3D2010",lineHeight:1.6,padding:0}}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,flexShrink:0,borderTop:"1px solid rgba(139,80,30,0.14)",paddingTop:8}}>
                  <span style={{fontFamily:"var(--font-game)",fontSize:"0.58rem",color:"#8B5A20"}}>Saved privately. +15 coins per entry</span>
                  {analyzing
                    ?<div className="ai-analyzing"><span style={{fontSize:"0.68rem",color:"#8B5A20"}}>Reading...</span><div className="ai-dots"><span/><span/><span/></div></div>
                    :<button className="scroll-btn-primary" type="button" onClick={analyzeEntry} style={{fontSize:"0.72rem",padding:"8px 16px"}}>Save</button>
                  }
                </div>
              </div>
            )}
          </div>
        </ScrollPage>
      )}

      {/* DAILY CHECK-IN: landing */}
      {view==="checkin"&&!quizDone&&!quizStarted&&(
        <ScrollPage>
          <h2 className="scroll-title">DAILY CHECK-IN</h2>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:50,flex:1}}>
            {/* sprite + bubble side by side, centred */}
            <div style={{display:"flex",flexDirection:"row",alignItems:"center",justifyContent:"center",gap:18}}>
              <SpriteCharacter emotion={emotion} character={character} interactive={false} size={{width:175,height:260}}/>
              <div className="checkin-speech-bubble">Let's do our daily pop quiz!</div>
            </div>
            <div style={{textAlign:"center",flexShrink:0, marginTop: -50}}>
              <button className="checkin-quiz-btn" onClick={()=>setQuizStarted(true)}>Quiz me!</button>
            </div>
          </div>
        </ScrollPage>
      )}

      {/* ════ DAILY CHECK-IN: quiz ════ */}
      {view==="checkin"&&!quizDone&&quizStarted&&(
        <ScrollPage>
          {/* Progress header — outside white box */}
          <div style={{flexShrink:0,marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
              <span className="checkin-quiz-label">Quiz with me</span>
              <span className="checkin-counter">{quizIdx+1} / {QUIZ.length}</span>
            </div>
            <div className="checkin-progress-bar-outer">
              <div className="checkin-progress-bar-fill" style={{width:`${((quizIdx+1)/QUIZ.length)*100}%`}}/>
            </div>
            <span className="checkin-dimension-label">{QUIZ[quizIdx].dimension}</span>
          </div>

          {/* White content box: sprite + question + mini-game.
              Question 6 (sleep) swaps this to the night-sky palette so the bed/star
              scene isn't a small dark panel floating inside an otherwise white box —
              the bubble gets its own light variant so its text stays readable against
              the darker box. */}
          <div className={`checkin-quiz-box${QUIZ[quizIdx].id==="sleep"?" checkin-quiz-box--night":""}`}>
            <div className={`checkin-quiz-sprite-row${QUIZ[quizIdx].id==="sleep"?" checkin-quiz-sprite-row--night":""}`}>
              <div className="checkin-quiz-sprite">
                <SpriteCharacter emotion={emotion} character={character} interactive={false} size={{width:80,height:120}}/>
              </div>
              <div className={`checkin-quiz-bubble${QUIZ[quizIdx].id==="sleep"?" checkin-quiz-bubble--night":""}`}>{QUIZ[quizIdx].q}</div>
            </div>
            <div className="checkin-quiz-game-area">
              {(()=>{
                const q=QUIZ[quizIdx]; const t=QUIZ_META[q.id]; const c={opts:q.opts,disabled:quizReacting};
                if(t==="powerbar")  return <PowerBarGame      {...c} onConfirm={handleQuizTap}/>;
                if(t==="skyscenes") return <SkyScenesGame     {...c} onPick={handleQuizTap}/>;
                if(t==="stars")     return <StarTapGame       {...c} onConfirm={handleQuizTap}/>;
                if(t==="tree")      return <ShakeTreeGame     {...c} onConfirm={handleQuizTap}/>;
                if(t==="ripple")    return <RippleZoneGame    {...c} onPick={handleQuizTap}/>;
                if(t==="racetrack") return <RaceTrackGame     {...c} onConfirm={handleQuizTap}/>;
                if(t==="sleepbed")  return <SleepBedGame      {...c} onConfirm={handleQuizTap}/>;
                if(t==="mountain")  return <MountainWaypointGame {...c} onPick={handleQuizTap}/>;
              })()}
            </div>
            {quizReacting&&lastReaction&&<div className="checkin-reaction" style={{position:"absolute",bottom:8,left:8,right:8,zIndex:3}}>{lastReaction.text}</div>}
          </div>

          {/* Back button — below white box */}
          <div className="checkin-nav-row" style={{flexShrink:0,marginTop:6,position:"relative",zIndex:30}}>
            <button className="checkin-back-btn" type="button" onClick={goBackQuiz} disabled={quizIdx===0||quizReacting}>‹ Previous</button>
            <span/>
          </div>
        </ScrollPage>
      )}

      {/* DAILY CHECK-IN: complete */}
      {view==="checkin"&&quizDone&&(
        <ScrollPage>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,textAlign:"center"}}>
            <h2 className="scroll-title" style={{marginBottom:8}}>CHECK-IN COMPLETE</h2>
            <div style={{position:"relative",width:72,height:72,margin:"0 auto 10px"}}>
              {[0,1,2].map(i=><div key={i} style={{position:"absolute",inset:0,borderRadius:"50%",border:`2px solid ${EMOTIONS[quizEmot]?.color??"#74B3CE"}`,animation:`ring-expand 2s ease-out ${i*0.5}s infinite`}}/>)}
              <div style={{width:72,height:72,borderRadius:"50%",background:(EMOTIONS[quizEmot]?.color??"#74B3CE")+"22",display:"grid",placeItems:"center",fontSize:"1.8rem"}}>{EMOTION_SYMBOL[quizEmot]??"♦"}</div>
            </div>
            <div style={{fontFamily:"var(--font-game)",fontSize:"0.7rem",background:"linear-gradient(135deg,#F4D580,#D4A853)",color:"#5A3A08",padding:"3px 12px",borderRadius:999,marginBottom:8,display:"inline-block"}}>+10 coins earned</div>
            {quizAnalyzing&&<div className="ai-analyzing" style={{justifyContent:"center",marginBottom:6}}><span style={{fontSize:"0.7rem",color:"#8B5A20"}}>Reading the full picture</span><div className="ai-dots"><span/><span/><span/></div></div>}
            <p style={{fontFamily:"var(--font-game)",fontSize:"0.88rem",color:"#503111",marginBottom:5}}>You're feeling <strong style={{color:EMOTIONS[quizEmot]?.color}}>{EMOTIONS[quizEmot]?.label??quizEmot}</strong> today.</p>
            <p style={{fontSize:"0.78rem",color:"#503111",lineHeight:1.55,fontStyle:"italic",fontFamily:"'Lilita One'",maxWidth:220,margin:"0 auto 10px"}}>"{wellbeingBand.message}"</p>
            <div style={{display:"flex",gap:7,justifyContent:"center"}}>
              <button className="scroll-btn-secondary" onClick={resetQuiz} style={{fontSize:"0.72rem",padding:"7px 12px"}}>Check in again</button>
              <button className="scroll-btn-primary" onClick={()=>setView("journey")} style={{fontSize:"0.72rem",padding:"7px 12px"}}>See my journey</button>
            </div>
          </div>
        </ScrollPage>
      )}

      {/*MY JOURNEY*/}
      {view==="journey"&&(()=>{
        // Left page content
        const leftPage=(
          <>
            <div style={{fontFamily:"var(--font-game)",fontSize:"1.6rem",color:"#503111",fontWeight:800,letterSpacing:"1px",borderBottom:"1.5px solid rgba(139,80,30,0.25)",paddingBottom:5,marginBottom:10}}><span style={{display:"inline-block",transform:"translateY(10px)"}}>MY JOURNEY</span></div>

            {/* Stats */}
            <div style={{display:"flex",gap:6,marginBottom:9}}>
              <div className="journey-stat-box">
                <div className="journey-stat-num">{activeEntries.length}</div>
                <div className="journey-stat-label">Total Entries</div>
              </div>
              {dominantRawEmotion&&(
                <div className="journey-stat-box">
                  <div className="journey-stat-num" style={{color:getEmotionStyle(dominantRawEmotion).color}}>{toOneWord(dominantRawEmotion)}</div>
                  <div className="journey-stat-label">Most Felt</div>
                </div>
              )}
            </div>

            {/* Mood chart */}
            <div style={{marginBottom:8}}>
              <div style={{fontFamily:"var(--font-game)",fontSize:"1rem",color:"#7B2A20",marginBottom:-3,letterSpacing:"0.1px"}}>MY MOOD CHART</div>
              <div style={{fontFamily:"var(--font-game)",fontSize:"0.7rem",color:"#a03d30",marginBottom:4,letterSpacing:"0.1px"}}>From the past 7 days</div>
              <div className="journey-mood-chart">
                {moodWeek.map(({day,ds,mood})=>(
                  <div key={ds} className="journey-mood-day">
                    <div
                      className={`journey-mood-chip${mood?"":" journey-mood-chip-empty"}`}
                      style={mood?{background:mood.color,borderColor:mood.border}:undefined}
                    />
                    {mood&&(
                      <span className="journey-mood-hologram">{mood.label}</span>
                    )}
                    <span className="journey-mood-day-label">{day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Goals */}
            <div style={{marginTop:"10px"}}>
              <div style={{fontFamily:"var(--font-game)",fontSize:"1rem",color:"#7B2A20",marginBottom:-3,letterSpacing:"0.1px"}}>MY GOALS</div>
              {showGoalPrompt?(
                <form onSubmit={submitNewGoal}>
                  <textarea value={newGoalInput} onChange={e=>setNewGoalInput(e.target.value)} placeholder="Enter your new goal..."
                    style={{width:"100%",height:66,minHeight:66,maxHeight:66,padding:"7px 8px",borderRadius:8,border:"1.5px solid rgba(139,80,30,0.22)",background:"rgba(255,255,255,0.45)",fontSize:"0.72rem",fontFamily:"var(--font-game)",lineHeight:1.25,outline:"none",marginBottom:4,resize:"none",overflowY:"auto"}} autoFocus/>
                  <button className="scroll-btn-primary" type="submit" style={{width:"100%",fontSize:"0.8rem",padding:"6px 0"}}>Set goal</button>
                </form>
              ):player?.goal?(
                <div>
                  <div style={{height:60,minHeight:60,maxHeight:60,overflowY:"auto",background:"transparent",border:"none",borderRadius:8,padding:"0 1px",marginBottom:4,boxSizing:"border-box"}}>
                    <p style={{fontFamily:"var(--font-game)",...getGoalTextSize(player.goal),color:"#582f25",margin:0,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{player.goal}</p>
                  </div>
                  {player.goalAchieved
                    ?<div>
                        <div className="journey-achieved-badge" style={{fontSize:"0.58rem"}}>Achieved{player.goalAchievedAt&&` · ${player.goalAchievedAt}`}</div>
                        <button className="scroll-btn-primary" style={{width:"100%",marginTop:3,fontSize:"0.6rem",padding:"4px 0"}} onClick={()=>{setNewGoalInput("");setShowGoalPrompt(true);}}>Set new goal</button>
                      </div>
                    :<button className="journey-achieve-btn" onClick={markGoalAchieved} style={{width:"100%",marginTop:8,fontSize:"0.74rem",padding:"5px 0"}}>I have achieved it!</button>
                  }
                  <div style={{display:"flex",gap:5,marginTop:9}}>
                    <button type="button" onClick={editGoal} style={{flex:1,padding:"6px 0",borderRadius:10,fontFamily:"var(--font-game)",fontSize:"0.7rem",color:"#582f25",background:"rgba(255,255,255,0.62)",border:"1.5px solid rgba(139,80,30,0.24)",boxShadow:"0 2px 0 rgba(80,40,8,0.18)",cursor:"pointer"}}>Modify Goal</button>
                    <button type="button" onClick={deleteGoal} style={{flex:1,padding:"6px 0",borderRadius:10,fontFamily:"var(--font-game)",fontSize:"0.7rem",color:"#fff",background:"rgb(211, 48, 48)",border:"1.5px solid rgb(139, 35, 35)",boxShadow:"0 2px 0 rgba(107, 26, 26, 0.22)",cursor:"pointer"}}>Delete Goal</button>
                  </div>
                </div>
              ):(
                <div>
                  <p style={{fontSize:"0.75rem",color:"#A07840",fontStyle:"italic",fontFamily:"var(--font-family)",marginBottom:4}}>No goal set yet.</p>
                  <button className="scroll-btn-primary" style={{fontSize:"0.6rem",padding:"5px 10px"}} onClick={()=>{setNewGoalInput("");setShowGoalPrompt(true);}}>Set a goal</button>
                </div>
              )}
            </div>
          </>
        );

        // Right page content — single entry at a time
        const rightPage=(
          <>
            <div style={{fontFamily:"var(--font-game)",fontSize:"1.6rem",color:"#503111",fontWeight:800,letterSpacing:"1px",borderBottom:"1.5px solid rgba(139,80,30,0.25)",paddingBottom:5,marginBottom:6,flexShrink:0}}>
              <span style={{display:"inline-block",transform:"translateY(10px)"}}>{rightTab==="journal"?"JOURNAL ENTRIES":"CHECK-IN ENTRIES"}</span>
            </div>

            {/* Tab switcher: Journal Entries | Previous Daily Check-Ins */}
            <div style={{display:"flex",gap:20,marginBottom:7,flexShrink:0}}>
              <button
                onClick={()=>{setRightTab("journal");setJournalIdx(0);setOpenChatEntryId(null);}}
                style={{flex:1,padding:"6px 0",borderRadius:10,fontFamily:"var(--font-game)",fontSize:"0.6rem",color:"#582f25",background:rightTab==="journal"?"rgb(255, 184, 210)":"rgba(255, 184, 210, 0.58)",border:"1.5px solid rgba(190,80,120,0.28)",boxShadow:"0 2px 0 rgba(120,45,80,0.18)",cursor:"pointer",filter:rightTab==="journal"?"none":"saturate(0.85)"}}>
                Journal Entries
              </button>
              <button
                onClick={()=>{setRightTab("checkin");setCheckinIdx(0);setOpenChatEntryId(null);}}
                style={{flex:1,padding:"6px 0",borderRadius:10,fontFamily:"var(--font-game)",fontSize:"0.6rem",color:"#12443d",background:rightTab==="checkin"?"rgb(169, 232, 224)":"rgba(169, 232, 224, 0.58)",border:"1.5px solid rgba(48,130,118,0.28)",boxShadow:"0 2px 0 rgba(30,90,82,0.18)",cursor:"pointer",filter:rightTab==="checkin"?"none":"saturate(0.85)"}}>
                Previous Daily Check-Ins
              </button>
            </div>

            {/* ── Entry display ── */}
            {currentEntry?(
              <>
                {/* Date */}
                <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:8,marginBottom:4,flexShrink:0}}>
                  <span style={{fontFamily:"var(--font-game)",fontSize:"1rem",color:"#5c2905"}}>
                  {(()=>{const d=new Date(currentEntry.date);return`${d.toLocaleDateString("en-US",{weekday:"short"}).toUpperCase()}, ${d.getDate()} ${d.toLocaleDateString("en-US",{month:"short"}).toUpperCase()}`;})()}
                  </span>

                {/* Entry content — white box, scrollable */}
                  <span style={{fontFamily:"var(--font-game)",fontSize:"0.9rem",color:"#8B5A20",textAlign:"right"}}>
                  {activeEntries.length - activeIdx}/{activeEntries.length}
                  </span>
                </div>
                <div style={{flex:1,minHeight:0,overflow:"hidden",background:"rgba(255,255,255,0.72)",borderRadius:8,border:"1.5px solid rgba(139,80,30,0.15)",padding:"10px 6px",marginBottom:7,display:"flex",flexDirection:"column"}}>
                  {rightTab==="checkin"&&currentEntry.answers?.length?(
                    <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0,overflow:"hidden"}}>
                      <div style={{flex:1,minHeight:0,overflowY:"auto",paddingRight:3,display:"flex",flexDirection:"column",gap:9}}>
                        {currentEntry.answers.map((a,i)=>(
                          <div key={i} style={{borderBottom:i<currentEntry.answers.length-1?"1px solid rgba(139,80,30,0.12)":"none",paddingBottom:i<currentEntry.answers.length-1?8:0,flexShrink:0}}>
                            <div style={{fontFamily:"var(--font-game)",fontSize:"0.85rem",color:"#8B5A20",marginBottom:2,letterSpacing:"0.3px"}}>{a.dimension}</div>
                            <div style={{fontFamily:"var(--font-game)",fontSize:"0.8rem",color:"#1e3e96",lineHeight:1.4,marginBottom:3}}>{a.question}</div>
                            <div style={{fontFamily:"var(--font-game)",fontSize:"0.79rem",fontWeight:599}}>
                              <span style={{color:"#8B5A20"}}>Response: </span>
                              <span style={{color:a.color??getEmotionStyle(a.emotion).color}}>{a.answer}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{borderTop:"1.5px solid rgba(139,80,30,0.20)",paddingTop:6,marginTop:1,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{fontFamily:"var(--font-game)",fontSize:"0.7rem",color:"#8B5A20"}}>Overall Wellbeing:</div>
                        <div style={{fontFamily:"var(--font-game)",fontSize:"0.7rem",color:getEmotionStyle(currentEntry.emotion).color,fontWeight:599}}>{getEmotionStyle(currentEntry.emotion).label}</div>
                      </div>
                    </div>
                  ):rightTab==="checkin"?(
                    <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:6}}>
                      <p style={{fontFamily:"var(--font-game)",fontSize:"1rem",color:"#8B5A20",fontStyle:"italic",margin:0}}>Daily check-in completed.</p>
                      <div style={{fontFamily:"var(--font-game)",fontSize:"0.62rem",color:getEmotionStyle(currentEntry.emotion).color,fontWeight:700}}>Wellbeing: {getEmotionStyle(currentEntry.emotion).label}</div>
                    </div>
                  ):(
                    (()=>{const entryChat=normalizeAiChat(currentEntry);const chatOpen=openChatEntryId===currentEntry.id;return chatOpen?(
                      <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
                        <div style={{fontFamily:"var(--font-game)",fontSize:"0.68rem",color:"#8B5A20",marginBottom:7,flexShrink:0}}>Past Conversation</div>
                        <div style={{flex:1,minHeight:0,overflowY:"auto",display:"flex",flexDirection:"column",gap:7,paddingRight:3}}>
                          {entryChat.length?entryChat.map((m,i)=>(
                            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                              <div style={{maxWidth:"86%",padding:"7px 9px",borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",background:m.role==="user"?"rgba(24,0,173,0.10)":"rgba(212,136,42,0.12)",fontFamily:"'Times New Roman',Georgia,serif",fontSize:"0.74rem",color:"#3D2010",lineHeight:1.45}}>
                                {m.text}
                              </div>
                            </div>
                          )):(
                            <div style={{fontFamily:"Poppins",fontSize:"0.74rem",color:"#8B5A20",fontStyle:"italic"}}>
                              No chat history available.
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={()=>setOpenChatEntryId(null)} style={{...journeyBookButtonStyle,marginTop:8,flexShrink:0}}>
                          ← Back to Journal Entry
                        </button>
                      </div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0,overflow:"hidden"}}>
                        <div style={{flex:1,minHeight:0,overflowY:"auto",paddingRight:3}}>
                          <p style={{fontFamily:"'Times New Roman',serif",fontSize:"0.8rem",color:"#503111",lineHeight:1.6,margin:0}}>{currentEntry.text}</p>
                        </div>
                        <div style={{borderTop:"1px solid rgba(139,80,30,0.14)",marginTop:1,paddingTop:7,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
                          <div style={{fontFamily:"var(--font-game)",fontSize:"0.62rem",fontWeight:700}}>
                            <span style={{color:"#8B5A20"}}>Felt: </span>
                            <span style={{color:getEmotionStyle(currentEntry.emotion).color}}>{formatEmotionLabel(currentEntry.emotion)}</span>
                          </div>
                          <button type="button" onClick={()=>setOpenChatEntryId(currentEntry.id)} style={{...journeyBookButtonStyle,width:"auto",fontSize:"0.62rem",padding:"3px 8px",marginTop:0,flexShrink:0}}>
                            See past convo
                          </button>
                        </div>
                      </div>
                    );})()
                  )}
                </div>

                {/* Navigation: ← Previous Entry | Later Entry → | counter | Delete */}
                <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0,flexWrap:"wrap"}}>
                  <button
                    disabled={activeIdx>=activeEntries.length-1}
                    onClick={()=>{setOpenChatEntryId(null);setActiveIdx(i=>i+1);}}
                    style={{padding:"6px 9px",borderRadius:10,fontFamily:"var(--font-game)",fontSize:"0.5rem",color:"#582f25",background:"rgba(255,255,255,0.62)",border:"1.5px solid rgba(139,80,30,0.24)",boxShadow:"0 2px 0 rgba(80,40,8,0.18)",cursor:activeIdx>=activeEntries.length-1?"default":"pointer",opacity:activeIdx>=activeEntries.length-1?0.35:1}}>
                    ← Previous
                  </button>
                  <button
                    disabled={activeIdx===0}
                    onClick={()=>{setOpenChatEntryId(null);setActiveIdx(i=>i-1);}}
                    style={{padding:"6px 9px",borderRadius:10,fontFamily:"var(--font-game)",fontSize:"0.56rem",color:"#582f25",background:"rgba(255,255,255,0.62)",border:"1.5px solid rgba(139,80,30,0.24)",boxShadow:"0 2px 0 rgba(80,40,8,0.18)",cursor:activeIdx===0?"default":"pointer",opacity:activeIdx===0?0.35:1}}>
                    Newer→
                  </button>
                  <button
                    onClick={()=>deleteEntry(currentEntry.id)}
                    style={{padding:"6px 9px",borderRadius:10,fontFamily:"var(--font-game)",fontSize:"0.54rem",color:"#fff",background:"rgb(211, 48, 48)",border:"1.5px solid rgb(139, 35, 35)",boxShadow:"0 2px 0 rgba(107, 26, 26, 0.22)",cursor:"pointer"}}>
                    Delete
                  </button>
                </div>
              </>
            ):(
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
                <div style={{fontFamily:"var(--font-game)",fontSize:"0.7rem",color:"#8B5A20",marginBottom:6}}>
                  {rightTab==="journal"?"No journal entries yet.":"No check-ins recorded yet."}
                </div>
                <button className="scroll-btn-primary" style={{fontSize:"0.64rem",padding:"7px 12px"}} onClick={()=>setView(rightTab==="journal"?"journal":"checkin")}>
                  {rightTab==="journal"?"Write your first entry":"Start a check-in"}
                </button>
              </div>
            )}
          </>
        );

        return <BookPage leftContent={leftPage} rightContent={rightPage}/>;
      })()}
      </div>
      </div>
    </div>
  );
}
