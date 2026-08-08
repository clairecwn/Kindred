import { useState, useEffect, useRef, useCallback } from "react";
import { shops } from "../data/seed.js";
import { sfx } from "../lib/sound.js";
import SpriteCharacter from "./SpriteCharacter.jsx";

// ── Color helpers ────────────────────────────────────────────────
const SKIN_COLORS = {
  honey:"#F2B66D", ivory:"#F4DCC4", mint:"#82C9A0",
  berry:"#CF7AA4", sky:"#83AEE8", cocoa:"#9B7256", slate:"#738392",
};
function darken(hex, t) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*(1-t))},${Math.round(g*(1-t))},${Math.round(b*(1-t))})`;
}
function lighten(hex, t) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r+(255-r)*t)},${Math.round(g+(255-g)*t)},${Math.round(b+(255-b)*t)})`;
}

// ── SVG character sprite ─────────────────────────────────────────
function CharSprite({ animal="fox", color="honey", x=0, y=0, size=36, isPlayer=false, name="" }) {
  const sc = SKIN_COLORS[color] || "#F2B66D";
  const dk = darken(sc, 0.28);
  const hR = size * 0.29;   // head radius
  const hY = y - size * 0.26; // head center Y
  const bY = y + size * 0.08; // body center Y

  return (
    <g>
      {/* Ground shadow */}
      <ellipse cx={x} cy={y + size * 0.46} rx={size * 0.18} ry={size * 0.05} fill="rgba(0,0,0,0.18)" />

      {/* Body */}
      <ellipse cx={x} cy={bY} rx={size * 0.19} ry={size * 0.22} fill={sc} />
      {/* Belly patch */}
      <ellipse cx={x} cy={bY + size*0.02} rx={size * 0.12} ry={size * 0.14} fill={lighten(sc, 0.25)} opacity="0.9" />

      {/* Arms */}
      <ellipse cx={x - size*0.22} cy={bY - size*0.02} rx={size*0.07} ry={size*0.11} fill={sc}
        transform={`rotate(-22 ${x - size*0.22} ${bY - size*0.02})`} />
      <ellipse cx={x + size*0.22} cy={bY - size*0.02} rx={size*0.07} ry={size*0.11} fill={sc}
        transform={`rotate(22 ${x + size*0.22} ${bY - size*0.02})`} />

      {/* Legs */}
      <ellipse cx={x - size*0.1} cy={bY + size*0.28} rx={size*0.07} ry={size*0.13} fill={sc} />
      <ellipse cx={x + size*0.1} cy={bY + size*0.28} rx={size*0.07} ry={size*0.13} fill={sc} />

      {/* Fox ears */}
      {animal === "fox" && <>
        <polygon fill={sc} points={`${x-hR*0.55},${hY-hR*0.62} ${x-hR*0.88},${hY-hR*1.35} ${x-hR*0.18},${hY-hR*0.78}`} />
        <polygon fill={sc} points={`${x+hR*0.55},${hY-hR*0.62} ${x+hR*0.88},${hY-hR*1.35} ${x+hR*0.18},${hY-hR*0.78}`} />
        <polygon fill="#FFB5A0" points={`${x-hR*0.52},${hY-hR*0.66} ${x-hR*0.78},${hY-hR*1.22} ${x-hR*0.22},${hY-hR*0.8}`} opacity="0.9" />
        <polygon fill="#FFB5A0" points={`${x+hR*0.52},${hY-hR*0.66} ${x+hR*0.78},${hY-hR*1.22} ${x+hR*0.22},${hY-hR*0.8}`} opacity="0.9" />
      </>}
      {/* Rabbit ears */}
      {animal === "rabbit" && <>
        <ellipse cx={x-hR*0.35} cy={hY-hR*1.15} rx={hR*0.19} ry={hR*0.54} fill={sc} />
        <ellipse cx={x+hR*0.35} cy={hY-hR*1.15} rx={hR*0.19} ry={hR*0.54} fill={sc} />
        <ellipse cx={x-hR*0.35} cy={hY-hR*1.15} rx={hR*0.1} ry={hR*0.38} fill="#FFB5C5" />
        <ellipse cx={x+hR*0.35} cy={hY-hR*1.15} rx={hR*0.1} ry={hR*0.38} fill="#FFB5C5" />
      </>}
      {/* Bear ears */}
      {(animal === "bear" || animal === "panda") && <>
        <circle cx={x-hR*0.64} cy={hY-hR*0.72} r={hR*0.3} fill={animal==="panda"?"#2A2020":sc} />
        <circle cx={x+hR*0.64} cy={hY-hR*0.72} r={hR*0.3} fill={animal==="panda"?"#2A2020":sc} />
        {animal!=="panda"&&<>
          <circle cx={x-hR*0.64} cy={hY-hR*0.72} r={hR*0.17} fill="#FFB5A0" />
          <circle cx={x+hR*0.64} cy={hY-hR*0.72} r={hR*0.17} fill="#FFB5A0" />
        </>}
      </>}
      {/* Cat ears */}
      {animal === "cat" && <>
        <polygon fill={sc} points={`${x-hR*0.5},${hY-hR*0.64} ${x-hR*0.76},${hY-hR*1.18} ${x-hR*0.2},${hY-hR*0.78}`} />
        <polygon fill={sc} points={`${x+hR*0.5},${hY-hR*0.64} ${x+hR*0.76},${hY-hR*1.18} ${x+hR*0.2},${hY-hR*0.78}`} />
        <polygon fill="#FFB5A8" points={`${x-hR*0.5},${hY-hR*0.68} ${x-hR*0.7},${hY-hR*1.1} ${x-hR*0.22},${hY-hR*0.8}`} opacity="0.8"/>
        <polygon fill="#FFB5A8" points={`${x+hR*0.5},${hY-hR*0.68} ${x+hR*0.7},${hY-hR*1.1} ${x+hR*0.22},${hY-hR*0.8}`} opacity="0.8"/>
      </>}
      {/* Dog floppy ears */}
      {animal === "dog" && <>
        <ellipse cx={x-hR*0.68} cy={hY+hR*0.12} rx={hR*0.23} ry={hR*0.42} fill={dk}
          transform={`rotate(-18 ${x-hR*0.68} ${hY})`} />
        <ellipse cx={x+hR*0.68} cy={hY+hR*0.12} rx={hR*0.23} ry={hR*0.42} fill={dk}
          transform={`rotate(18 ${x+hR*0.68} ${hY})`} />
      </>}

      {/* Head */}
      <circle cx={x} cy={hY} r={hR} fill={animal==="panda"?"#F5F0E8":sc} />
      {/* Panda eye patches */}
      {animal==="panda"&&<>
        <ellipse cx={x-hR*0.35} cy={hY+hR*0.02} rx={hR*0.26} ry={hR*0.22} fill="#2A2020" />
        <ellipse cx={x+hR*0.35} cy={hY+hR*0.02} rx={hR*0.26} ry={hR*0.22} fill="#2A2020" />
      </>}
      {/* Eyes */}
      <circle cx={x-hR*0.33} cy={hY}       r={hR*0.2}  fill="white" />
      <circle cx={x+hR*0.33} cy={hY}       r={hR*0.2}  fill="white" />
      <circle cx={x-hR*0.29} cy={hY+hR*0.04} r={hR*0.13} fill="#1a1028" />
      <circle cx={x+hR*0.29} cy={hY+hR*0.04} r={hR*0.13} fill="#1a1028" />
      {/* Sparkles */}
      <circle cx={x-hR*0.22} cy={hY-hR*0.04} r={hR*0.055} fill="white" />
      <circle cx={x+hR*0.4}  cy={hY-hR*0.04} r={hR*0.055} fill="white" />
      {/* Nose */}
      <ellipse cx={x} cy={hY+hR*0.3} rx={hR*0.13} ry={hR*0.09} fill="#2D1818" />
      {/* Smile */}
      <path d={`M ${x-hR*0.2} ${hY+hR*0.44} Q ${x} ${hY+hR*0.6} ${x+hR*0.2} ${hY+hR*0.44}`}
        stroke="#6C2828" strokeWidth={hR*0.07} fill="none" strokeLinecap="round" />
      {/* Cheeks */}
      <ellipse cx={x-hR*0.55} cy={hY+hR*0.22} rx={hR*0.22} ry={hR*0.11} fill="#F08098" opacity="0.48" />
      <ellipse cx={x+hR*0.55} cy={hY+hR*0.22} rx={hR*0.22} ry={hR*0.11} fill="#F08098" opacity="0.48" />

      {/* Player arrow indicator */}
      {isPlayer && <polygon fill="#E8845A" stroke="white" strokeWidth="1"
        points={`${x},${hY-hR*1.6} ${x-7},${hY-hR*2.0} ${x+7},${hY-hR*2.0}`} />}
      {/* Name */}
      {name && <text x={x} y={y+size*0.56} textAnchor="middle" fontSize={hR*0.56}
        fill="#3D2B1F" fontWeight="800" fontFamily="Nunito,sans-serif">{name}</text>}
    </g>
  );
}

// ── SVG item art ─────────────────────────────────────────────────
function ItemArt({ type, size = 64 }) {
  const s = size;
  switch (type) {
    case "sofa": return (
      <svg viewBox="0 0 80 56" width={s} height={s*56/80} style={{display:"block"}}>
        <rect x="4" y="8" width="72" height="24" rx="9" fill="#8B6EC0"/>
        <rect x="9" y="28" width="62" height="19" rx="7" fill="#9B7ED0"/>
        <rect x="1" y="21" width="13" height="26" rx="5" fill="#7A5EB0"/>
        <rect x="66" y="21" width="13" height="26" rx="5" fill="#7A5EB0"/>
        <rect x="11" y="45" width="7" height="10" rx="3" fill="#5A3A20"/>
        <rect x="62" y="45" width="7" height="10" rx="3" fill="#5A3A20"/>
        <line x1="38" y1="28" x2="38" y2="46" stroke="#7A5EB0" strokeWidth="2" opacity="0.35"/>
        <rect x="14" y="10" width="18" height="6" rx="3" fill="rgba(255,255,255,0.15)"/>
        <rect x="34" y="10" width="18" height="6" rx="3" fill="rgba(255,255,255,0.15)"/>
        <rect x="54" y="10" width="18" height="6" rx="3" fill="rgba(255,255,255,0.15)"/>
      </svg>
    );
    case "lamp": return (
      <svg viewBox="0 0 50 88" width={s*50/88} height={s} style={{display:"block"}}>
        <path d="M9,31 L41,31 L36,8 L14,8 Z" fill="#F4D580" stroke="#D4A853" strokeWidth="1.5"/>
        <path d="M9,31 L14,8" stroke="#D4A853" strokeWidth="1" opacity="0.5"/>
        <path d="M41,31 L36,8" stroke="#D4A853" strokeWidth="1" opacity="0.5"/>
        <rect x="22" y="31" width="6" height="42" rx="3" fill="#A8803A"/>
        <ellipse cx="25" cy="76" rx="14" ry="5.5" fill="#8A6030"/>
        <ellipse cx="25" cy="32" rx="16" ry="4.5" fill="rgba(255,240,180,0.4)"/>
        <circle cx="25" cy="8" r="3" fill="#FFD54F"/>
      </svg>
    );
    case "rug": return (
      <svg viewBox="0 0 90 56" width={s} height={s*56/90} style={{display:"block"}}>
        <ellipse cx="45" cy="28" rx="43" ry="26" fill="#E07050"/>
        <ellipse cx="45" cy="28" rx="35" ry="20" fill="#C86040"/>
        <ellipse cx="45" cy="28" rx="26" ry="13" fill="#E07050"/>
        <circle cx="45" cy="28" r="5" fill="#C86040"/>
        {[-22,-10,0,10,22].map(dx => <circle key={dx+"t"} cx={45+dx} cy="16" r="2.5" fill="#FFCCAA"/>)}
        {[-22,-10,0,10,22].map(dx => <circle key={dx+"b"} cx={45+dx} cy="40" r="2.5" fill="#FFCCAA"/>)}
      </svg>
    );
    case "tree": return (
      <svg viewBox="0 0 60 90" width={s*60/90} height={s} style={{display:"block"}}>
        <rect x="24" y="63" width="12" height="27" rx="4" fill="#8B6050"/>
        <ellipse cx="30" cy="62" rx="26" ry="19" fill="#4CAF50"/>
        <ellipse cx="30" cy="46" rx="21" ry="17" fill="#5DBF61"/>
        <ellipse cx="30" cy="31" rx="15" ry="13" fill="#6DD071"/>
        <circle cx="17" cy="52" r="4.5" fill="#EF5350"/>
        <circle cx="43" cy="56" r="4.5" fill="#EF5350"/>
        <circle cx="30" cy="60" r="4" fill="#FFCDD2"/>
        <circle cx="30" cy="32" r="3" fill="#FFD54F"/>
      </svg>
    );
    case "pond": return (
      <svg viewBox="0 0 90 58" width={s} height={s*58/90} style={{display:"block"}}>
        <ellipse cx="45" cy="32" rx="43" ry="24" fill="#64B5F6"/>
        <ellipse cx="45" cy="32" rx="35" ry="18" fill="#42A5F5"/>
        <ellipse cx="24" cy="32" rx="10" ry="7.5" fill="#66BB6A"/>
        <ellipse cx="64" cy="37" rx="8" ry="6" fill="#66BB6A"/>
        <ellipse cx="45" cy="32" rx="22" ry="12" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"/>
        <ellipse cx="45" cy="32" rx="10" ry="6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
        <circle cx="24" cy="32" r="3.5" fill="#FF8A65"/>
        <circle cx="64" cy="37" r="3" fill="#FF8A65"/>
        <circle cx="42" cy="20" r="2" fill="white" opacity="0.8"/>
      </svg>
    );
    case "fern": return (
      <svg viewBox="0 0 60 80" width={s*60/80} height={s} style={{display:"block"}}>
        <rect x="24" y="60" width="12" height="20" rx="4" fill="#8B6050"/>
        <ellipse cx="30" cy="68" rx="16" ry="8" fill="#6B4A30"/>
        {[[-16,46,-35],[0,34,0],[16,46,35],[-10,55,-22],[10,55,22]].map(([dx,y,rot],i)=>(
          <ellipse key={i} cx={30+dx} cy={y} rx="9" ry="20" fill="#4CAF50"
            transform={`rotate(${rot} ${30+dx} ${y})`} opacity={0.85+i*0.02}/>
        ))}
        <ellipse cx="30" cy="56" rx="12" ry="8" fill="#5DBF61"/>
      </svg>
    );
    case "scarf": return (
      <svg viewBox="0 0 80 62" width={s} height={s*62/80} style={{display:"block"}}>
        <path d="M14,28 Q40,4 66,28 Q80,42 66,50 Q40,66 14,50 Q0,42 14,28Z" fill="#3D7C92"/>
        <path d="M22,48 Q16,62 28,70 Q36,76 28,64 Q24,54 24,48" fill="#3D7C92"/>
        <path d="M16,30 Q40,14 64,30" stroke="#5BA8C0" strokeWidth="3.5" fill="none" opacity="0.55"/>
        <path d="M13,40 Q40,28 67,40" stroke="#5BA8C0" strokeWidth="2.5" fill="none" opacity="0.4"/>
      </svg>
    );
    case "cap": return (
      <svg viewBox="0 0 80 62" width={s} height={s*62/80} style={{display:"block"}}>
        <ellipse cx="40" cy="50" rx="38" ry="11" fill="#2C3E50"/>
        <path d="M7,50 Q7,12 40,8 Q73,12 73,50Z" fill="#3A4D5E"/>
        <rect x="8" y="40" width="64" height="11" rx="0" fill="rgba(0,0,0,0.25)"/>
        <circle cx="40" cy="10" r="5.5" fill="#E07050"/>
        <rect x="7" y="38" width="64" height="4" rx="0" fill="#E07050" opacity="0.7"/>
      </svg>
    );
    case "satchel": return (
      <svg viewBox="0 0 75 82" width={s*75/82} height={s} style={{display:"block"}}>
        <rect x="7" y="28" width="61" height="50" rx="9" fill="#7B5138"/>
        <path d="M7,28 Q7,12 37.5,8 Q68,12 68,28Z" fill="#8B6148"/>
        <rect x="27" y="19" width="21" height="13" rx="4" fill="#D4A853"/>
        <rect x="29" y="21" width="17" height="9" rx="3" fill="#F4D580"/>
        <path d="M19,28 Q37.5,4 56,28" stroke="#6B4228" strokeWidth="5" fill="none" strokeLinecap="round"/>
        <rect x="18" y="44" width="39" height="24" rx="5" fill="rgba(0,0,0,0.09)" stroke="#6B4228" strokeWidth="1.5"/>
        <rect x="32" y="52" width="11" height="8" rx="3" fill="rgba(255,255,255,0.12)"/>
      </svg>
    );
    case "loft": case "lakehouse": case "tea-garden": return (
      <svg viewBox="0 0 80 72" width={s} height={s*72/80} style={{display:"block"}}>
        <rect x="7" y="34" width="66" height="38" rx="4" fill="#E8D5B0"/>
        <polygon points="40,5 77,37 3,37" fill={type==="lakehouse"?"#2980B9":type==="tea-garden"?"#4CAF50":"#C0392B"}/>
        <rect x="28" y="50" width="24" height="22" rx="4" fill="#8B4513"/>
        <rect x="11" y="42" width="16" height="14" rx="3" fill="#87CEEB"/>
        <rect x="53" y="42" width="16" height="14" rx="3" fill="#87CEEB"/>
        {type==="lakehouse"&&<ellipse cx="40" cy="72" rx="30" ry="6" fill="#64B5F6" opacity="0.7"/>}
      </svg>
    );
    case "arena-token": return (
      <svg viewBox="0 0 70 70" width={s} height={s} style={{display:"block"}}>
        <circle cx="35" cy="35" r="33" fill="#D4A853" stroke="#A8803A" strokeWidth="3"/>
        <circle cx="35" cy="35" r="25" fill="#F4D580"/>
        <polygon fill="#D4A853"
          points="35,14 40.5,28 55,28 43.6,37 48,51 35,42 22,51 26.4,37 15,28 29.5,28"/>
      </svg>
    );
    case "team-banner": return (
      <svg viewBox="0 0 55 90" width={s*55/90} height={s} style={{display:"block"}}>
        <rect x="25" y="4" width="6" height="86" rx="3" fill="#8B6050"/>
        <path d="M31,10 L55,24 L31,38Z" fill="#E8845A"/>
        <path d="M31,40 L55,54 L31,68Z" fill="#5B9B8A"/>
        <line x1="31" y1="10" x2="31" y2="68" stroke="#6B4030" strokeWidth="1" opacity="0.4"/>
      </svg>
    );
    case "spark-trail": return (
      <svg viewBox="0 0 70 70" width={s} height={s} style={{display:"block"}}>
        <circle cx="35" cy="35" r="30" fill="none" stroke="#F4D580" strokeWidth="3" opacity="0.5"/>
        {[0,45,90,135,180,225,270,315].map((a,i)=>{
          const rad = a*Math.PI/180;
          return <circle key={i} cx={35+22*Math.cos(rad)} cy={35+22*Math.sin(rad)} r={3+i%3} fill="#FFD54F" opacity={0.6+i*0.05}/>;
        })}
        <circle cx="35" cy="35" r="10" fill="#F4D580"/>
        <circle cx="35" cy="35" r="6" fill="#FFD54F"/>
      </svg>
    );
    default: return (
      <svg viewBox="0 0 60 60" width={s} height={s} style={{display:"block"}}>
        <rect x="4" y="4" width="52" height="52" rx="12" fill="#E8845A" opacity="0.7"/>
        <rect x="12" y="12" width="36" height="36" rx="8" fill="rgba(255,255,255,0.2)"/>
      </svg>
    );
  }
}

// ── World data ────────────────────────────────────────────────────
const ZONES = {
  atrium:  { id:"atrium",  cx:200, cy:148, label:"The Atrium",       sub:"Heart of the Grove",             color:"#5B9B8A" },
  bloom:   { id:"bloom",   cx:68,  cy:86,  label:"Bloom Quarter",    sub:"Garden & nature living shop",    color:"#6BAE82", shopId:"garden" },
  hearth:  { id:"hearth",  cx:332, cy:86,  label:"Hearthstone Row",  sub:"Home furnishings & cozy decor", color:"#E8845A", shopId:"home"   },
  arcade:  { id:"arcade",  cx:332, cy:213, label:"The Spark",        sub:"Mini-games & activities",        color:"#9B72CF", shopId:"arcade", gameAccess:true },
  style:   { id:"style",   cx:68,  cy:213, label:"Style Alley",      sub:"Wearables & accessories",        color:"#D4A853", shopId:"style"  },
  terrace: { id:"terrace", cx:200, cy:34,  label:"Sky Terrace",      sub:"A quiet observation deck",       color:"#74B3CE" },
};

const NPC_HOME = {
  n1: { x:88,  y:102 },
  n2: { x:314, y:204 },
  n3: { x:190, y:158 },
  n4: { x:316, y:102 },
};

const NPC_ZONE_ASSOC = {
  n1: "bloom",
  n2: "arcade",
  n3: "atrium",
  n4: "hearth",
};

const NPCS = [
  { id:"n1", name:"Mia",  animal:"rabbit", color:"ivory" },
  { id:"n2", name:"Kai",  animal:"bear",   color:"cocoa" },
  { id:"n3", name:"Zoe",  animal:"cat",    color:"mint"  },
  { id:"n4", name:"Noor", animal:"dog",    color:"honey" },
];

const NPC_CHAT = {
  n1: {
    name:"Mia", icon:"rabbit",
    opener:"Hey there! Love seeing new faces at the Grove! How are you feeling today?",
    replies:[
      { text:"I'm doing great, thanks!", npc:"That's wonderful! The Grove has that energy, right? Come find me next time you're shopping!" },
      { text:"A bit tired honestly...", npc:"I hear you. Sometimes I just come here to sit by the fountain. You're doing great just by showing up, seriously." },
      { text:"Just exploring around!", npc:"Best way to do it! If you're heading to the garden shop, the Fruit Trees just came in stock — so cute!" },
    ]
  },
  n2: {
    name:"Kai", icon:"bear",
    opener:"Yo! First time seeing you on this side of the board. Up for a game later?",
    replies:[
      { text:"Yeah, I'm up for it!", npc:"Let's go! I warn you though, I'm unbeatable at Memory Match. Well... mostly." },
      { text:"Maybe next turn!", npc:"Haha, fair enough. I'll be waiting. This spot by the fountain is my favourite — good luck out there!" },
      { text:"What games are available?", npc:"Memory Match, Star Grab, Coin Dash, and Trivia! Hit a Game space on the board to pick. Trivia's easy, Memory Match is the hard one." },
    ]
  },
  n3: {
    name:"Zoe", icon:"cat",
    opener:"*yawns* Oh hi! I've been here since the Flash Sale. Did you know the arcade items are half off today?",
    replies:[
      { text:"No way! I'm heading there now!", npc:"Quick quick! I already grabbed the Spark Trail, it's gorgeous on my character. You should get the Team Banner too!" },
      { text:"I just need the basics first.", npc:"Wise. Scarf from Pawprint Tailor is a freebie and goes with everything. Start there!" },
      { text:"Just saying hi!", npc:"*smiles softly* That's enough for me. Good energy, new friend. Hope you pick up something nice today." },
    ]
  },
  n4: {
    name:"Noor", icon:"dog",
    opener:"Heyyy! I love your character! Can I ask what skin tone that is? The customization here is so good!",
    replies:[
      { text:"Thanks! It's from My Kin tab.", npc:"Of COURSE! I spent an hour in there. My fur took three tries to get right. Worth it though, I feel so me!" },
      { text:"Still figuring out my look!", npc:"Take your time! That's the whole point. There's no wrong answer — whatever feels like you, go with that." },
      { text:"Want to be friends?", npc:"Yes!! Go to the My Kin tab and add me — Noor. I'll show you my island, it's still a work in progress but I love it." },
    ]
  },
};

const EVENT_MESSAGES = [
  { text: "A shooting star passed overhead! ✦ +25 coins", coins: 25 },
  { text: "Fountain is lucky today! +15 coins", coins: 15 },
  { text: "A warm breeze brings good tidings. +20 coins", coins: 20 },
  { text: "You helped a lost visitor. +10 coins", coins: 10 },
  { text: "A sale just ended. No bonus this turn.", coins: 0 },
  { text: "Bumped into someone — they gave you their spare! +30 coins", coins: 30 },
];

// ── Memory Match mini-game ────────────────────────────────────────
const MATCH_SYMBOLS = ["★","♥","♦","☀","♪","✿","▲","◆"];
function shuffle(arr) { return [...arr].sort(()=>Math.random()-0.5); }

function MemoryMatch({ onFinish }) {
  const symbols = shuffle([...MATCH_SYMBOLS.slice(0,6), ...MATCH_SYMBOLS.slice(0,6)]);
  const [cards, setCards] = useState(() => symbols.map((s,i)=>({id:i,sym:s,flipped:false,matched:false})));
  const [open, setOpen] = useState([]);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const locked = useRef(false);

  function flip(idx) {
    if (locked.current || cards[idx].flipped || cards[idx].matched) return;
    sfx.flip();
    const next = cards.map((c,i)=>i===idx?{...c,flipped:true}:c);
    const newOpen = [...open, idx];
    setCards(next); setOpen(newOpen); setMoves(m=>m+1);
    if (newOpen.length === 2) {
      locked.current = true;
      const [a,b] = newOpen;
      if (next[a].sym === next[b].sym) {
        sfx.match();
        const matched = next.map((c,i)=>newOpen.includes(i)?{...c,matched:true}:c);
        setCards(matched); setOpen([]);
        locked.current = false;
        if (matched.every(c=>c.matched)) { sfx.win(); setDone(true); }
      } else {
        setTimeout(() => {
          sfx.flip();
          setCards(cc=>cc.map((c,i)=>newOpen.includes(i)&&!c.matched?{...c,flipped:false}:c));
          setOpen([]); locked.current=false;
        }, 900);
      }
    }
  }

  if (done) return (
    <div style={{textAlign:"center",padding:"28px 20px"}}>
      <div style={{fontSize:"2.8rem",marginBottom:12}}>★</div>
      <div style={{fontSize:"1.3rem",fontWeight:900,marginBottom:8}}>All pairs found!</div>
      <p style={{color:"var(--text-2)",marginBottom:20}}>You matched all 6 pairs in {moves} moves.</p>
      <button className="btn-primary" onClick={()=>onFinish(80)}>Claim 80 coins</button>
    </div>
  );

  return (
    <div>
      <div style={{textAlign:"center",marginBottom:14}}>
        <span style={{fontWeight:700,color:"var(--text-2)"}}>Moves: {moves}</span>
        <span style={{marginLeft:16,fontSize:"0.82rem",color:"var(--text-3)"}}>Find all 6 pairs!</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {cards.map((card,i)=>(
          <button key={card.id} onClick={()=>flip(i)} style={{
            height:62,borderRadius:12,border:"2px solid var(--border)",cursor:"pointer",
            background:card.flipped||card.matched?"linear-gradient(135deg,var(--brand),#C86040)":"var(--panel)",
            fontSize:"1.6rem",transition:"all 0.2s",
            boxShadow:card.matched?"0 0 0 2px var(--gold)":undefined,
            transform:card.flipped?"scale(1.04)":"scale(1)",
          }}>
            {(card.flipped||card.matched)?card.sym:""}
          </button>
        ))}
      </div>
      <div style={{marginTop:16,textAlign:"center"}}>
        <button className="btn-secondary" style={{fontSize:"0.82rem"}} onClick={()=>onFinish(0)}>Skip</button>
      </div>
    </div>
  );
}

// ── Coin Dash mini-game ──────────────────────────────────────────
function CoinDash({ onFinish }) {
  const [pos, setPos] = useState({x:50,y:50});
  const [count, setCount] = useState(0);
  const [time, setTime] = useState(12);
  const [done, setDone] = useState(false);
  const ref = useRef(null);

  useEffect(()=>{
    if (done) return;
    const id = setInterval(()=>{
      setTime(t=>{
        if (t<=1){clearInterval(id);setDone(true);sfx.win();return 0;}
        return t-1;
      });
    },1000);
    return ()=>clearInterval(id);
  },[done]);

  const jump = () => {
    sfx.coin();
    setCount(c=>c+1);
    setPos({x:15+Math.random()*70,y:15+Math.random()*70});
  };

  if (done) return (
    <div style={{textAlign:"center",padding:"28px 20px"}}>
      <div style={{fontSize:"2.8rem",marginBottom:12}}>★</div>
      <div style={{fontSize:"1.3rem",fontWeight:900,marginBottom:8}}>Time's up!</div>
      <p style={{color:"var(--text-2)",marginBottom:20}}>You caught {count} coins! Earned {count*6} coins.</p>
      <button className="btn-primary" onClick={()=>onFinish(count*6)}>Claim reward</button>
    </div>
  );

  return (
    <div ref={ref} style={{position:"relative",height:220,background:"linear-gradient(135deg,rgba(74,179,206,0.12),rgba(91,155,138,0.1))",borderRadius:16,overflow:"hidden",userSelect:"none"}}>
      <div style={{position:"absolute",top:10,right:14,fontWeight:800,fontSize:"0.9rem",color:"var(--text-2)"}}>
        {time}s · {count} caught
      </div>
      <button
        onClick={jump}
        style={{
          position:"absolute",
          left:`${pos.x}%`,top:`${pos.y}%`,
          transform:"translate(-50%,-50%)",
          width:52,height:52,borderRadius:"50%",
          background:"linear-gradient(135deg,#F4D580,#D4A853)",
          border:"3px solid #A8803A",
          fontSize:"1.4rem",cursor:"pointer",
          boxShadow:"0 4px 20px rgba(212,168,83,0.55)",
          transition:"left 0.2s, top 0.2s",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontWeight:900,color:"#5A3A08",
        }}
      >
        ★
      </button>
      <div style={{position:"absolute",bottom:10,left:0,right:0,textAlign:"center",fontSize:"0.82rem",color:"var(--text-3)"}}>
        Tap the star before it moves!
      </div>
    </div>
  );
}

// ── Trivia mini-game ─────────────────────────────────────────────
const TRIVIA = [
  { q:"Which activity is most linked to improved mood in research?", opts:["Social connection","More screen time","Staying in bed longer"], a:0 },
  { q:"How many minutes of movement per day is recommended for wellbeing?", opts:["5 minutes","30 minutes","90 minutes"], a:1 },
  { q:"Which of these is a sign of healthy emotional regulation?", opts:["Never feeling sad","Recognising and naming your feelings","Ignoring difficult emotions"], a:1 },
  { q:"Journaling is known to help with:", opts:["Processing emotions and reducing stress","Making you feel worse","Nothing — it's just writing"], a:0 },
  { q:"Good sleep hygiene includes:", opts:["Screens until sleep time","Consistent wake/sleep schedule","Sleeping at random hours"], a:1 },
];

function TriviaGame({ onFinish }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [done, setDone] = useState(false);

  function pick(i) {
    if (chosen !== null) return;
    setChosen(i);
    const correct = i === TRIVIA[idx].a;
    if (correct) { sfx.correct(); setScore(s=>s+20); }
    else sfx.wrong();
    setTimeout(()=>{
      if (idx+1 >= TRIVIA.length) { sfx.win(); setDone(true); }
      else { setIdx(i=>i+1); setChosen(null); }
    },1200);
  }

  if (done) return (
    <div style={{textAlign:"center",padding:"28px 20px"}}>
      <div style={{fontSize:"2.8rem",marginBottom:12}}>★</div>
      <div style={{fontSize:"1.3rem",fontWeight:900,marginBottom:8}}>Quiz complete!</div>
      <p style={{color:"var(--text-2)",marginBottom:20}}>{score/20} out of {TRIVIA.length} correct. Earned {score} coins!</p>
      <button className="btn-primary" onClick={()=>onFinish(score)}>Claim reward</button>
    </div>
  );

  const q = TRIVIA[idx];
  return (
    <div>
      <div style={{display:"flex",gap:4,marginBottom:18}}>
        {TRIVIA.map((_,i)=>(
          <div key={i} style={{flex:1,height:5,borderRadius:999,background:i<idx?"var(--brand)":i===idx?"var(--gold)":"var(--border)"}}/>
        ))}
      </div>
      <p style={{fontWeight:800,fontSize:"1rem",marginBottom:18,color:"var(--text)",lineHeight:1.4}}>{q.q}</p>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {q.opts.map((opt,i)=>{
          let bg = "var(--panel)";
          if (chosen===i) bg = i===q.a?"rgba(76,175,80,0.25)":"rgba(232,93,93,0.2)";
          else if (chosen!==null && i===q.a) bg="rgba(76,175,80,0.15)";
          return (
            <button key={i} onClick={()=>pick(i)} style={{
              padding:"13px 18px",borderRadius:14,border:"2px solid var(--border)",
              background:bg,textAlign:"left",fontWeight:700,fontSize:"0.9rem",
              cursor:chosen!==null?"default":"pointer",transition:"background 0.2s",
              borderColor:chosen===i&&i===q.a?"#4CAF50":chosen===i?"#E85D5D":chosen!==null&&i===q.a?"#4CAF50":"var(--border)",
            }}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
// ── NPC extended responses for free chat ────────────────────────
const NPC_RESPONSES = {
  n1: [
    "That's so sweet of you to share! The Grove has been extra lovely lately.",
    "I totally get that feeling. You know what helps me? A walk around the fountain.",
    "Honestly same… I've been journaling more and it's actually been helping.",
    "You're doing amazing, seriously. Just showing up for yourself counts for so much.",
    "I love our little chats! Come find me anytime you need a friendly face.",
  ],
  n2: [
    "That's real talk. I respect that.",
    "Honestly? Same. But we keep going, right?",
    "Yo that's a whole mood. Let me know if you ever want to vent more.",
    "I hear you. The Grove's always here when you need it.",
    "Respect for being honest about that. Not everyone can do that.",
  ],
  n3: [
    "*nods slowly* Yeah… I think a lot of us feel that way.",
    "Honestly that's kind of poetic? In a sad way.",
    "I was just thinking about something similar. Life is weird sometimes.",
    "That deserves to be said out loud more. Thank you for sharing.",
    "You know what, I think you're handling it better than you think.",
  ],
  n4: [
    "YESSS I feel this so deeply!!",
    "Okay but that's actually really important and I hope you know that.",
    "You deserve all the good things, just saying!!",
    "That's such a valid thing to feel! Don't let anyone tell you otherwise.",
    "I'm so glad you're here. The Grove is better with you in it.",
  ],
};

export default function SocialView({ character, inventory, setInventory, friends, setFriends, coins, setCoins, emotion, npcBehavior, journalledToday }) {
  const [view,         setView]         = useState("world");
  const [playerPos,    setPlayerPos]    = useState({ x: 200, y: 168 });
  const [navigating,   setNavigating]   = useState(false);
  const [arrivedZone,  setArrivedZone]  = useState("atrium");
  const [visitedZones, setVisitedZones] = useState(() => new Set(["atrium"]));
  const [tick,         setTick]         = useState(0);
  const [activeShop,   setActiveShop]   = useState(null);
  const [activeGame,   setActiveGame]   = useState(null);
  const [chatNpc,      setChatNpc]      = useState(null);
  const [chatStep,     setChatStep]     = useState("opener");
  const [chatLog,      setChatLog]      = useState([]);
  const [chatInput,    setChatInput]    = useState("");
  const [toast,        setToast]        = useState(null);
  const [previewItem,  setPreviewItem]  = useState(null);
  const [landingMsg,   setLandingMsg]   = useState(null);
  const [chatThreads,  setChatThreads]  = useState(() => {
    const threads = {};
    NPCS.forEach(npc => {
      threads[npc.id] = [{ from: "npc", text: NPC_CHAT[npc.id].opener, ts: Date.now() - 60000 * 5 }];
    });
    return threads;
  });
  const [activeThread, setActiveThread] = useState(null);
  const [npcTyping,    setNpcTyping]    = useState(false);
  const navTimer        = useRef(null);
  const playerTargetRef = useRef({ x: 200, y: 168 });
  const toastTimer      = useRef(null);
  const chatEndRef      = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => (t + 1) % 360);
      setPlayerPos(prev => {
        const target = playerTargetRef.current;
        const dx = target.x - prev.x;
        const dy = target.y - prev.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 1.5) return { x: target.x, y: target.y };
        const speed = Math.min(dist * 0.12, 6);
        return { x: prev.x + dx/dist*speed, y: prev.y + dy/dist*speed };
      });
    }, 80);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(msg, ms=2800) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(()=>setToast(null), ms);
  }

  function navigateTo(zoneId) {
    const zone = ZONES[zoneId];
    if (!zone || navigating) return;
    sfx.click();
    setArrivedZone(null);
    setLandingMsg(null);
    const tx = zone.cx;
    const ty = zone.cy + (zoneId === "terrace" ? 16 : 22);
    playerTargetRef.current = { x: tx, y: ty };
    setNavigating(true);
    const dx = tx - playerPos.x, dy = ty - playerPos.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const travelMs = Math.max(500, dist * 15);
    clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => {
      setNavigating(false);
      setArrivedZone(zoneId);
      if (!visitedZones.has(zoneId)) {
        setVisitedZones(v => new Set([...v, zoneId]));
        setCoins(c => c + 20);
        showToast(`Discovered ${zone.label}! +20 coins`);
      }
    }, travelMs);
  }

  function getNpcPos(npcId) {
    const home = NPC_HOME[npcId];
    const seed = npcId.charCodeAt(1);
    const t = tick * 0.022 + seed;
    return { x: home.x + Math.sin(t) * 13, y: home.y + Math.cos(t * 0.55) * 8 };
  }

  const npcRenderPositions = NPCS.map(npc => ({ ...npc, ...getNpcPos(npc.id) }));
  const nearbyNpcs = arrivedZone ? NPCS.filter(npc => NPC_ZONE_ASSOC[npc.id] === arrivedZone) : [];

  const fontRipples = [0, 120, 240].map(offset => {
    const phase = (tick + offset) % 240;
    return { r: 14 + phase * 0.25, opacity: Math.max(0, 0.5 - phase * 0.002) };
  });

  const chimSmokes = [0, 100, 200].map(offset => {
    const phase = (tick + offset) % 240;
    return { dy: -phase * 0.13, opacity: Math.max(0, 0.38 - phase * 0.0016), r: 3.5 + phase * 0.014 };
  });

  // ── Chat (world view quick chat) ─────────────────────────────────
  function openChat(npc) {
    setChatNpc(npc);
    setChatStep("opener");
    setChatLog([{from:"npc",text:NPC_CHAT[npc.id].opener}]);
    setChatInput("");
    setView("chat");
  }

  function pickReply(reply) {
    sfx.chat();
    const now = Date.now();
    setChatLog(log=>[...log,{from:"player",text:reply.text},{from:"npc",text:reply.npc}]);
    // Also persist to thread
    setChatThreads(prev => ({
      ...prev,
      [chatNpc.id]: [
        ...(prev[chatNpc.id] || []),
        { from:"player", text:reply.text, ts: now },
        { from:"npc",    text:reply.npc,  ts: now + 200 },
      ]
    }));
    setChatStep("done");
    setCoins(c=>c+35);
    showToast("+35 coins for connecting!");
  }

  function sendFreeChat(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sfx.chat();
    const msg = chatInput.trim();
    setChatInput("");
    const responses = NPC_RESPONSES[chatNpc.id] || ["Thanks for sharing!"];
    const npcLine = responses[Math.floor(Math.random() * responses.length)];
    const now = Date.now();
    setChatLog(log=>[...log,{from:"player",text:msg},{from:"npc",text:npcLine}]);
    setChatThreads(prev => ({
      ...prev,
      [chatNpc.id]: [
        ...(prev[chatNpc.id] || []),
        { from:"player", text:msg,     ts: now },
        { from:"npc",    text:npcLine, ts: now + 400 },
      ]
    }));
    setCoins(c=>c+10);
  }

  // ── Persistent message threads (Messages tab) ─────────────────────
  function openThread(npcId) {
    setActiveThread(npcId);
    setView("messages");
    setChatInput("");
  }

  function sendThreadMessage(e) {
    e.preventDefault();
    if (!chatInput.trim() || !activeThread) return;
    sfx.chat();
    const msg = chatInput.trim();
    setChatInput("");
    const now = Date.now();
    setChatThreads(prev => ({
      ...prev,
      [activeThread]: [
        ...(prev[activeThread] || []),
        { from: "player", text: msg, ts: now },
      ]
    }));
    setCoins(c => c + 5);
    // Simulate NPC typing then responding
    setNpcTyping(true);
    setTimeout(() => {
      const responses = NPC_RESPONSES[activeThread] || ["Thanks for sharing!"];
      const npcLine = responses[Math.floor(Math.random() * responses.length)];
      sfx.chat();
      setChatThreads(prev => ({
        ...prev,
        [activeThread]: [
          ...(prev[activeThread] || []),
          { from: "npc", text: npcLine, ts: Date.now() },
        ]
      }));
      setNpcTyping(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }, 1200 + Math.random() * 800);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function addFriend(npc) {
    sfx.purchase();
    const name = NPC_CHAT[npc.id].name;
    setFriends(f=>Array.from(new Set([...(f||[]),name])));
    setCoins(c=>c+50);
    showToast(`${name} added as friend! +50 coins`);
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ── Shop purchase ─────────────────────────────────────────────────
  function buyItem(item) {
    if (item.price > coins) { sfx.error(); showToast("Not enough coins!"); return; }
    sfx.purchase();
    setCoins(c=>c-item.price);
    setInventory(inv=>[{...item,purchasedAt:new Date().toISOString()},...inv]);
    setPreviewItem(null);
    showToast(`Purchased ${item.name}!`);
  }

  function onGameFinish(reward) {
    if (reward>0) {
      setCoins(c=>c+reward);
      sfx.win();
      showToast(`+${reward} coins earned!`);
    }
    setActiveGame(null);
    setView("world");
    setLandingMsg(null);
  }

  // ── World SVG ────────────────────────────────────────────────────
  const worldSVG = (
    <svg viewBox="0 0 400 270" style={{width:"100%",display:"block",borderRadius:20}}>
      <defs>
        <radialGradient id="bgGrad" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#FFF8F0"/>
          <stop offset="100%" stopColor="#F0E4CC"/>
        </radialGradient>
        <radialGradient id="atriumGrad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#E8F5E9"/>
          <stop offset="100%" stopColor="#C8E6C9"/>
        </radialGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.18"/></filter>
      </defs>

      {/* Layer 1 — Background */}
      <rect width="400" height="270" rx="20" fill="url(#bgGrad)"/>
      {Array.from({length:11},(_,r)=>Array.from({length:16},(_,c)=>(
        <rect key={`${r}-${c}`} x={c*26} y={r*26} width="25" height="25" rx="2"
          fill="none" stroke="rgba(0,0,0,0.025)" strokeWidth="1"/>
      )))}

      {/* Layer 2 — Zone floor glow */}
      <ellipse cx="68"  cy="86"  rx="54" ry="44" fill="#6BAE82" opacity="0.13"/>
      <ellipse cx="332" cy="86"  rx="54" ry="44" fill="#E8845A" opacity="0.13"/>
      <ellipse cx="332" cy="213" rx="54" ry="44" fill="#9B72CF" opacity="0.13"/>
      <ellipse cx="68"  cy="213" rx="54" ry="44" fill="#D4A853" opacity="0.13"/>
      <ellipse cx="200" cy="34"  rx="46" ry="30" fill="#74B3CE" opacity="0.16"/>

      {/* Layer 3 — Sandy paths */}
      {[[68,86],[332,86],[332,213],[68,213]].map(([x2,y2],i)=>(
        <g key={i}>
          <line x1="200" y1="148" x2={x2} y2={y2} stroke="#D4B896" strokeWidth="18" strokeLinecap="round" opacity="0.55"/>
          <line x1="200" y1="148" x2={x2} y2={y2} stroke="#EDD8BE" strokeWidth="14" strokeLinecap="round" opacity="0.8"/>
          <line x1="200" y1="148" x2={x2} y2={y2} stroke="rgba(180,140,90,0.3)" strokeWidth="3" strokeDasharray="6,8" strokeLinecap="round"/>
        </g>
      ))}
      {/* Path to Sky Terrace */}
      <line x1="200" y1="148" x2="200" y2="34" stroke="#D4B896" strokeWidth="14" strokeLinecap="round" opacity="0.5"/>
      <line x1="200" y1="148" x2="200" y2="34" stroke="#EDD8BE" strokeWidth="10" strokeLinecap="round" opacity="0.75"/>
      <line x1="200" y1="148" x2="200" y2="34" stroke="rgba(180,140,90,0.3)" strokeWidth="2.5" strokeDasharray="5,7" strokeLinecap="round"/>

      {/* Layer 4 — Atrium mosaic floor */}
      <circle cx="200" cy="148" r="52" fill="url(#atriumGrad)" opacity="0.9"/>
      {[40,32,24].map((r,i)=>(
        <circle key={i} cx="200" cy="148" r={r} fill="none" stroke="rgba(91,155,138,0.18)" strokeWidth="1.5"/>
      ))}
      {[0,60,120,180,240,300].map((a,i)=>{
        const rad = a*Math.PI/180;
        return <line key={i} x1={200+16*Math.cos(rad)} y1={148+16*Math.sin(rad)}
          x2={200+46*Math.cos(rad)} y2={148+46*Math.sin(rad)}
          stroke="rgba(91,155,138,0.14)" strokeWidth="1.5"/>;
      })}

      {/* Layer 5 — Background trees */}
      {[[-18,32],[22,14],[-32,14],[18,-24]].map(([dx,dy],i)=>(
        <g key={`btl${i}`}>
          <rect x={68+dx-2.5} y={86+dy+12} width="5" height="10" rx="2" fill="#8B6050"/>
          <circle cx={68+dx} cy={86+dy+8} r="9" fill="#4CAF50" opacity="0.7"/>
          <circle cx={68+dx} cy={86+dy+2} r="6.5" fill="#66BB6A" opacity="0.8"/>
        </g>
      ))}
      {[[18,32],[-22,14],[32,14],[-18,-24]].map(([dx,dy],i)=>(
        <g key={`btr${i}`}>
          <rect x={332+dx-2.5} y={86+dy+12} width="5" height="10" rx="2" fill="#8B6050"/>
          <circle cx={332+dx} cy={86+dy+8} r="9" fill="#5DBF61" opacity="0.7"/>
          <circle cx={332+dx} cy={86+dy+2} r="6.5" fill="#81C784" opacity="0.8"/>
        </g>
      ))}
      {[[18,-28],[-20,-18],[28,-14]].map(([dx,dy],i)=>(
        <g key={`bar${i}`}>
          <rect x={332+dx-2.5} y={213+dy+12} width="5" height="10" rx="2" fill="#8B6050"/>
          <circle cx={332+dx} cy={213+dy+8} r="8" fill="#6BAE82" opacity="0.7"/>
          <circle cx={332+dx} cy={213+dy+2} r="5.5" fill="#81C784" opacity="0.8"/>
        </g>
      ))}
      {[[-18,-28],[20,-18],[-28,-14]].map(([dx,dy],i)=>(
        <g key={`bsl${i}`}>
          <rect x={68+dx-2.5} y={213+dy+12} width="5" height="10" rx="2" fill="#8B6050"/>
          <circle cx={68+dx} cy={213+dy+8} r="8" fill="#66BB6A" opacity="0.7"/>
          <circle cx={68+dx} cy={213+dy+2} r="5.5" fill="#A5D6A7" opacity="0.8"/>
        </g>
      ))}

      {/* Layer 6 — Atrium trees */}
      {[[-44,0],[44,0],[0,-40],[0,36]].map(([dx,dy],i)=>(
        <g key={`at${i}`}>
          <rect x={200+dx-3} y={148+dy+14} width="6" height="12" rx="3" fill="#8B6050"/>
          <circle cx={200+dx} cy={148+dy+8} r="13" fill="#4CAF50"/>
          <circle cx={200+dx} cy={148+dy+2} r="9.5" fill="#66BB6A"/>
          <circle cx={200+dx} cy={148+dy-4} r="6.5" fill="#81C784"/>
          <circle cx={200+dx-6} cy={148+dy+10} r="3.2" fill="#EF5350"/>
          <circle cx={200+dx+6} cy={148+dy+12} r="3.2" fill="#EF5350"/>
        </g>
      ))}

      {/* Layer 7 — Atrium benches */}
      <g transform="translate(164 154)">
        <rect x="-16" y="-5" width="32" height="4" rx="2" fill="#D4A853" opacity="0.7"/>
        <rect x="-16" y="0" width="32" height="6" rx="3" fill="#C8A050"/>
        <rect x="-14" y="6" width="6" height="8" rx="2" fill="#A8803A"/>
        <rect x="8" y="6" width="6" height="8" rx="2" fill="#A8803A"/>
      </g>
      <g transform="translate(236 154)">
        <rect x="-16" y="-5" width="32" height="4" rx="2" fill="#D4A853" opacity="0.7"/>
        <rect x="-16" y="0" width="32" height="6" rx="3" fill="#C8A050"/>
        <rect x="-14" y="6" width="6" height="8" rx="2" fill="#A8803A"/>
        <rect x="8" y="6" width="6" height="8" rx="2" fill="#A8803A"/>
      </g>

      {/* Layer 8 — Lamp posts */}
      {[[-36,-36],[36,-36],[-36,32],[36,32]].map(([dx,dy],i)=>(
        <g key={`lp${i}`}>
          <rect x={200+dx-1.5} y={148+dy-14} width="3" height="22" rx="1.5" fill="#8B7050"/>
          <ellipse cx={200+dx} cy={148+dy-16} rx="5" ry="3.5" fill="#F4D580"/>
          <ellipse cx={200+dx} cy={148+dy-14} rx="7" ry="5" fill="none" stroke="rgba(244,213,128,0.4)" strokeWidth="3"/>
        </g>
      ))}

      {/* Layer 9 — Building facades */}

      {/* Bloom Quarter — sage green, garden shop */}
      <g transform="translate(28 54)">
        <rect x="0" y="0" width="82" height="60" rx="6" fill="#5F9E72"/>
        <rect x="0" y="0" width="82" height="60" rx="6" fill="none" stroke="#4A7D58" strokeWidth="1.5"/>
        {[0,12,24,36,48,60,72].map((x,i)=>(
          <rect key={i} x={x} y="0" width="11" height="14" fill={i%2===0?"#5F9E72":"#88C896"} opacity="0.85"/>
        ))}
        <rect x="0" y="12" width="82" height="3" fill="#4A7D58" opacity="0.4"/>
        <rect x="7" y="18" width="20" height="16" rx="3" fill="#B8E4C0" opacity="0.7"/>
        <line x1="17" y1="18" x2="17" y2="34" stroke="#4A7D58" strokeWidth="1" opacity="0.4"/>
        <rect x="55" y="18" width="20" height="16" rx="3" fill="#B8E4C0" opacity="0.7"/>
        <line x1="65" y1="18" x2="65" y2="34" stroke="#4A7D58" strokeWidth="1" opacity="0.4"/>
        <rect x="31" y="36" width="20" height="24" rx="3" fill="#3D6B48"/>
        <circle cx="41" cy="48" r="2.5" fill="#F4D580"/>
        <rect x="7" y="34" width="20" height="7" rx="3" fill="#8B6050"/>
        <circle cx="12" cy="32" r="4" fill="#EF5350"/>
        <circle cx="19" cy="30" r="4" fill="#FF9800"/>
        <circle cx="26" cy="32" r="4" fill="#FF87A0"/>
        <rect x="55" y="34" width="20" height="7" rx="3" fill="#8B6050"/>
        <circle cx="60" cy="32" r="4" fill="#FF87A0"/>
        <circle cx="67" cy="30" r="4" fill="#EF5350"/>
        <circle cx="74" cy="32" r="4" fill="#FFD700"/>
        <rect x="16" y="-11" width="50" height="13" rx="4" fill="#F5F0E0" stroke="#4A7D58" strokeWidth="1.5"/>
        <text x="41" y="-1" textAnchor="middle" fontSize="6.5" fill="#3D6B48" fontWeight="900" fontFamily="Nunito,sans-serif">BLOOM QUARTER</text>
        <path d="M0,10 Q-5,25 2,42 Q7,55 0,60" stroke="#4CAF50" strokeWidth="2" fill="none" opacity="0.5"/>
        <circle cx="-2" cy="28" r="4" fill="#66BB6A" opacity="0.7"/>
        <circle cx="2" cy="48" r="3.5" fill="#4CAF50" opacity="0.7"/>
      </g>

      {/* Hearthstone Row — amber/terracotta, home shop */}
      <g transform="translate(290 54)">
        <rect x="0" y="0" width="82" height="60" rx="6" fill="#E8845A"/>
        <rect x="0" y="0" width="82" height="60" rx="6" fill="none" stroke="#C86040" strokeWidth="1.5"/>
        <polygon points="0,0 41,-14 82,0" fill="#C86040"/>
        <rect x="55" y="-22" width="10" height="28" rx="3" fill="#B05030"/>
        {chimSmokes.map((s,i)=>(
          <ellipse key={i} cx={60} cy={-22+s.dy} rx={s.r} ry={s.r*0.7} fill="#D8C8BC" opacity={s.opacity}/>
        ))}
        <rect x="7" y="14" width="20" height="18" rx="3" fill="#FFD8A0" opacity="0.85"/>
        <line x1="17" y1="14" x2="17" y2="32" stroke="#C86040" strokeWidth="1" opacity="0.5"/>
        <line x1="7" y1="23" x2="27" y2="23" stroke="#C86040" strokeWidth="1" opacity="0.5"/>
        <rect x="55" y="14" width="20" height="18" rx="3" fill="#FFD8A0" opacity="0.85"/>
        <line x1="65" y1="14" x2="65" y2="32" stroke="#C86040" strokeWidth="1" opacity="0.5"/>
        <line x1="55" y1="23" x2="75" y2="23" stroke="#C86040" strokeWidth="1" opacity="0.5"/>
        <rect x="31" y="34" width="20" height="26" rx="10" fill="#8B4A28"/>
        <circle cx="41" cy="47" r="3" fill="#F4D580"/>
        <rect x="12" y="-10" width="58" height="13" rx="4" fill="#FFF8F0" stroke="#C86040" strokeWidth="1.5"/>
        <text x="41" y="-1" textAnchor="middle" fontSize="6" fill="#8B4A28" fontWeight="900" fontFamily="Nunito,sans-serif">HEARTHSTONE ROW</text>
      </g>

      {/* The Spark Arcade — purple, games */}
      <g transform="translate(290 181)">
        <rect x="0" y="0" width="82" height="56" rx="6" fill="#7B52AF"/>
        <rect x="0" y="0" width="82" height="56" rx="6" fill="none" stroke="#5A3A8A" strokeWidth="1.5"/>
        {[0,8,16,24,32,40,48,56,64,72].map(x=>(
          <rect key={x+"t"} x={x} y="0" width="7" height="4" rx="1" fill="#9B72CF" opacity="0.7"/>
        ))}
        {[0,8,16,24,32,40,48,56,64,72].map(x=>(
          <rect key={x+"b"} x={x} y="52" width="7" height="4" rx="1" fill="#9B72CF" opacity="0.7"/>
        ))}
        <rect x="8" y="8" width="30" height="22" rx="4" fill="#180838"/>
        {[[-8,-5],[0,-5],[8,-5],[-4,0],[4,0],[-8,5],[-4,5],[0,5],[4,5],[8,5]].map(([dx,dy],i)=>(
          <rect key={i} x={23+dx-2.5} y={19+dy-2.5} width="5" height="5" rx="1"
            fill={i%3===0?"#E040FB":i%3===1?"#40C4FF":"#69F0AE"} opacity="0.9"/>
        ))}
        <rect x="46" y="6" width="28" height="38" rx="5" fill="#1A0838"/>
        <rect x="50" y="9" width="20" height="14" rx="3" fill="#180048"/>
        <circle cx="57" cy="32" r="4" fill="#5A3A8A"/>
        <circle cx="57" cy="31" r="3" fill="#7B52AF"/>
        <circle cx="65" cy="28" r="3" fill="#E040FB" opacity="0.9"/>
        <circle cx="70" cy="32" r="3" fill="#40C4FF" opacity="0.9"/>
        <circle cx="66" cy="36" r="3" fill="#FF4081" opacity="0.9"/>
        <rect x="10" y="-11" width="62" height="13" rx="4" fill="#1A0838" stroke="#9B72CF" strokeWidth="1.5"/>
        <text x="41" y="-1" textAnchor="middle" fontSize="7.5" fill="#E040FB" fontWeight="900" fontFamily="Nunito,sans-serif">THE SPARK</text>
        {[[-10,-16],[78,-12],[80,30],[-14,28]].map(([dx,dy],i)=>(
          <text key={i} x={dx} y={dy+4} fontSize="9" fill="#FFD54F" opacity="0.65">★</text>
        ))}
      </g>

      {/* Style Alley — gold, fashion shop */}
      <g transform="translate(28 181)">
        <rect x="0" y="0" width="82" height="56" rx="6" fill="#C8943A"/>
        <rect x="0" y="0" width="82" height="56" rx="6" fill="none" stroke="#A87030" strokeWidth="1.5"/>
        <path d="M0,0 L82,0 L82,16 Q41,24 0,16Z" fill="#D4A853"/>
        <path d="M28,8 Q41,4 54,8 Q41,14 28,8Z" fill="#F0E0B0" stroke="#A87030" strokeWidth="1" opacity="0.9"/>
        <circle cx="41" cy="8" r="3.5" fill="#F4D580"/>
        <rect x="5" y="18" width="30" height="26" rx="3" fill="#FFF8DC" opacity="0.9" stroke="#A87030" strokeWidth="1"/>
        <circle cx="20" cy="24" r="5" fill="#D4A853"/>
        <rect x="17" y="29" width="6" height="10" rx="2" fill="#E8C870"/>
        <rect x="13" y="30" width="5" height="8" rx="2" fill="#D4A853"/>
        <rect x="22" y="30" width="5" height="8" rx="2" fill="#D4A853"/>
        <rect x="47" y="18" width="30" height="26" rx="3" fill="#FFF8DC" opacity="0.9" stroke="#A87030" strokeWidth="1"/>
        <circle cx="62" cy="24" r="5" fill="#CF7AA4"/>
        <rect x="59" y="29" width="6" height="10" rx="2" fill="#E0A0C0"/>
        <rect x="55" y="30" width="5" height="8" rx="2" fill="#CF7AA4"/>
        <rect x="64" y="30" width="5" height="8" rx="2" fill="#CF7AA4"/>
        <rect x="16" y="-11" width="50" height="13" rx="4" fill="#FFF8F0" stroke="#A87030" strokeWidth="1.5"/>
        <text x="41" y="-1" textAnchor="middle" fontSize="7" fill="#7A5020" fontWeight="900" fontFamily="Nunito,sans-serif">STYLE ALLEY</text>
      </g>

      {/* Layer 10 — Sky Terrace */}
      <g transform="translate(156 14)">
        <rect x="0" y="0" width="88" height="36" rx="8" fill="#74B3CE"/>
        <rect x="0" y="0" width="88" height="36" rx="8" fill="none" stroke="#5A9ABE" strokeWidth="1.5"/>
        {[0,11,22,33,44,55,66,77].map(x=>(
          <rect key={x} x={x+4} y="-7" width="3" height="11" rx="1.5" fill="#5A9ABE"/>
        ))}
        <rect x="4" y="-8" width="80" height="3" rx="1.5" fill="#5A9ABE"/>
        <rect x="4" y="4" width="80" height="20" rx="5" fill="#98CBE4" opacity="0.5"/>
        <rect x="20" y="14" width="48" height="8" rx="3" fill="#5A7EA0"/>
        <rect x="22" y="22" width="8" height="10" rx="2" fill="#4A6A8A"/>
        <rect x="58" y="22" width="8" height="10" rx="2" fill="#4A6A8A"/>
        <text x="44" y="11" textAnchor="middle" fontSize="7" fill="white" fontWeight="800" fontFamily="Nunito,sans-serif" opacity="0.9">SKY TERRACE</text>
        <text x="12" y="28" fontSize="9" fill="white" opacity="0.7">★</text>
        <text x="72" y="28" fontSize="9" fill="white" opacity="0.7">★</text>
      </g>

      {/* Layer 11 — Fountain with animated ripples */}
      <circle cx="200" cy="148" r="20" fill="#64B5F6" opacity="0.45"/>
      <circle cx="200" cy="148" r="15" fill="#42A5F5" opacity="0.4"/>
      {fontRipples.map((rpl,i)=>(
        <circle key={i} cx="200" cy="148" r={rpl.r} fill="none" stroke="rgba(100,181,246,0.7)" strokeWidth="1.5" opacity={rpl.opacity}/>
      ))}
      <circle cx="200" cy="148" r="10" fill="#90CAF9" opacity="0.7"/>
      <circle cx="200" cy="148" r="6" fill="white" opacity="0.35"/>
      <ellipse cx="193" cy="141" rx="3" ry="7" fill="rgba(100,181,246,0.75)" transform="rotate(-20 193 141)"/>
      <ellipse cx="207" cy="141" rx="3" ry="7" fill="rgba(100,181,246,0.75)" transform="rotate(20 207 141)"/>
      <ellipse cx="200" cy="137" rx="2.5" ry="8" fill="rgba(144,202,249,0.8)"/>
      <circle cx="196" cy="144" r="1.5" fill="white" opacity="0.8"/>
      <circle cx="204" cy="151" r="1.2" fill="white" opacity="0.7"/>

      {/* Layer 12 — "THE GROVE" label */}
      <text x="200" y="173" textAnchor="middle" fontSize="10" fill="#5B9B8A"
        fontWeight="900" fontFamily="Nunito,sans-serif" opacity="0.85">THE GROVE</text>
      <text x="200" y="183" textAnchor="middle" fontSize="7" fill="#5B9B8A"
        fontWeight="600" fontFamily="Nunito,sans-serif" opacity="0.6">Social Hub</text>

      {/* Layer 13 — Click targets */}
      {Object.values(ZONES).map(zone=>(
        <circle key={zone.id} cx={zone.cx} cy={zone.cy} r="42"
          fill="transparent" style={{cursor:"pointer"}}
          onClick={()=>navigateTo(zone.id)}/>
      ))}

      {/* Layer 14 — Arrived zone pulse ring */}
      {arrivedZone && ZONES[arrivedZone] && (()=>{
        const z = ZONES[arrivedZone];
        const pulse = 0.5 + 0.5*Math.sin(tick*0.12);
        return (
          <circle cx={z.cx} cy={z.cy} r={44+pulse*4}
            fill="none" stroke={z.color} strokeWidth="2.5"
            opacity={0.45+pulse*0.3} strokeDasharray="6,5"/>
        );
      })()}

      {/* Layer 15 — NPC characters */}
      {npcRenderPositions.map(npc=>(
        <g key={npc.id} style={{cursor:"pointer"}} onClick={()=>openChat(npc)}>
          <ellipse cx={npc.x} cy={npc.y+13} rx="9" ry="3.5" fill="rgba(0,0,0,0.14)"/>
          <CharSprite animal={npc.animal} color={npc.color} x={npc.x} y={npc.y} size={26} name={npc.name}/>
          <circle cx={npc.x+13} cy={npc.y-21} r="6" fill="white" opacity="0.92"/>
          {[-3,0,3].map(dx=>(
            <circle key={dx} cx={npc.x+13+dx} cy={npc.y-21} r="1.5" fill="#5B9B8A"/>
          ))}
        </g>
      ))}

      {/* Layer 16 — Player shadow + indicator (SpriteCharacter is overlaid via CSS) */}
      <g transform={`translate(${playerPos.x} ${playerPos.y})`}>
        <ellipse cx={0} cy={13} rx="12" ry="4.5" fill="rgba(0,0,0,0.26)"/>
        {/* Player arrow indicator */}
        <polygon fill="#E8845A" stroke="white" strokeWidth="1"
          points="0,-38 -7,-54 7,-54" />
      </g>
    </svg>
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{position:"relative"}}>

      {/* ── World view ──────────────────────────────────────────── */}
      {view === "world" && (
        <div className="page-container anim-fade-in">
          <div className="page-hero page-hero-purple">
            <div className="hero-text">
              <div className="hero-label">The Grove</div>
              <div className="hero-title" style={{fontSize:"1.4rem"}}>
                A living social world.
              </div>
              <p className="hero-desc" style={{marginTop:6}}>
                Tap any zone to explore. Chat with friends, browse shops, and play.
              </p>
              <div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <span style={{background:"rgba(255,255,255,0.2)",borderRadius:999,padding:"4px 14px",fontWeight:800,fontSize:"0.82rem"}}>
                  {visitedZones.size} / {Object.keys(ZONES).length} zones explored
                </span>
                <button onClick={()=>setView("messages")} style={{
                  background:"rgba(255,255,255,0.18)",borderRadius:999,
                  padding:"4px 14px",fontWeight:800,fontSize:"0.82rem",
                  color:"white",border:"1.5px solid rgba(255,255,255,0.3)",
                  cursor:"pointer",transition:"background 0.15s",
                }}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.28)"}
                  onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.18)"}
                >Messages</button>
              </div>
            </div>
            <div className="hero-character" style={{position:"relative"}}>
              <SpriteCharacter
                emotion={emotion}
                character={character}
                interactive={false}
                size={{ width: 160, height: 190 }}
              />
              {arrivedZone && ZONES[arrivedZone] && (
                <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",background:"rgba(255,255,255,0.22)",borderRadius:999,padding:"3px 12px",color:"white",fontSize:"0.62rem",fontWeight:800,whiteSpace:"nowrap"}}>
                  {ZONES[arrivedZone].label}
                </div>
              )}
            </div>
          </div>

          {/* NPC emotional response — shown when player has journalled and world is listening */}
          {journalledToday && npcBehavior && (
            <div className="card anim-fade-in" style={{
              padding: "12px 16px",
              background: "rgba(255,255,255,0.55)",
              borderColor: "rgba(0,0,0,0.06)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 12,
                background: "rgba(232,132,90,0.15)",
                border: "1.5px solid rgba(232,132,90,0.25)",
                display: "grid", placeItems: "center", flexShrink: 0,
                fontSize: "1.1rem",
              }}>
                {npcBehavior.type === "presence" ? "○" :
                 npcBehavior.type === "offer"    ? "♥" :
                 npcBehavior.type === "ground"   ? "〜" :
                 npcBehavior.type === "share"    ? "✦" : "♦"}
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                  The Grove senses something
                </div>
                <div style={{ fontSize: "0.86rem", color: "var(--text-2)", lineHeight: 1.5 }}>
                  Someone here {npcBehavior.action}.
                </div>
              </div>
            </div>
          )}

          {/* World SVG — SpriteCharacter overlaid at player position */}
          <div className="card" style={{padding:12}}>
            <div style={{ position: "relative" }}>
              {worldSVG}
              <div style={{
                position: "absolute",
                left: `${(playerPos.x / 400) * 100}%`,
                top: `${(playerPos.y / 270) * 100}%`,
                transform: "translate(-50%, -100%)",
                pointerEvents: "none",
                zIndex: 10,
                transition: "left 0.08s linear, top 0.08s linear",
                marginTop: -8,
              }}>
                <SpriteCharacter
                  emotion={emotion}
                  character={character}
                  interactive={false}
                  size={{ width: 56, height: 70 }}
                />
              </div>
            </div>
          </div>

          {/* Zone arrival panel */}
          {arrivedZone && ZONES[arrivedZone] && !navigating && (
            <div className="card anim-fade-in" style={{
              borderColor:`${ZONES[arrivedZone].color}55`,
              background:`${ZONES[arrivedZone].color}0A`,
            }}>
              <div className="card-header" style={{marginBottom:12}}>
                <div>
                  <div className="card-title">{ZONES[arrivedZone].label}</div>
                  <div className="card-sub">{ZONES[arrivedZone].sub}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {ZONES[arrivedZone].shopId && (() => {
                  const shop = shops.find(s=>s.id===ZONES[arrivedZone].shopId);
                  return shop ? (
                    <button className="btn-primary" onClick={()=>{setActiveShop(shop);setView("shop");sfx.click();}}>
                      Browse {shop.name}
                    </button>
                  ) : null;
                })()}
                {ZONES[arrivedZone].gameAccess && (
                  <button className="btn-secondary"
                    onClick={()=>{sfx.click();setLandingMsg(lm=>lm?.type==="game"?null:{type:"game"});}}>
                    {landingMsg?.type==="game"?"Hide games ↑":"Play mini-games"}
                  </button>
                )}
              </div>
              {landingMsg?.type==="game" && (
                <div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:8}}>
                  {[
                    {id:"memory",label:"Memory Match",sub:"Find all pairs"},
                    {id:"dash",  label:"Coin Dash",   sub:"Click the star!"},
                    {id:"trivia",label:"Trivia",       sub:"Wellness quiz"},
                  ].map(g=>(
                    <button key={g.id} className="btn-secondary" style={{flex:"1 1 120px"}}
                      onClick={()=>{sfx.click();setActiveGame(g.id);setView("game");}}>
                      <div style={{fontWeight:800}}>{g.label}</div>
                      <div style={{fontSize:"0.75rem",color:"var(--text-3)",marginTop:2}}>{g.sub}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Nearby NPCs */}
          {nearbyNpcs.length > 0 && !navigating && (
            <div className="card">
              <div className="card-header"><div><div className="card-title">Nearby</div><div className="card-sub">Tap to chat</div></div></div>
              <div style={{display:"flex",gap:10}}>
                {nearbyNpcs.map(npc=>{
                  const d = NPC_CHAT[npc.id];
                  return (
                    <button key={npc.id} onClick={()=>openChat(npc)} style={{
                      flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,
                      padding:"14px 8px",borderRadius:14,border:"1.5px solid var(--border)",
                      background:"var(--surface)",cursor:"pointer",
                    }}>
                      <svg width="44" height="44" viewBox="0 0 44 44" style={{flexShrink:0}}>
                        <CharSprite animal={npc.animal} color={npc.color} x={22} y={28} size={32}/>
                      </svg>
                      <div style={{fontWeight:800,fontSize:"0.88rem"}}>{d.name}</div>
                      <div style={{fontSize:"0.72rem",color:"var(--brand)",fontWeight:700}}>Chat</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grove Regulars */}
          <div className="card">
            <div className="card-header"><div><div className="card-title">Grove Regulars</div><div className="card-sub">Tap a character to chat</div></div></div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {NPCS.map(npc=>{
                const d = NPC_CHAT[npc.id];
                const zone = ZONES[NPC_ZONE_ASSOC[npc.id]];
                return (
                  <div key={npc.id} style={{
                    display:"flex",alignItems:"center",gap:14,
                    padding:"12px 14px",borderRadius:14,border:"1.5px solid var(--border)",
                    background:"var(--surface)",cursor:"pointer",
                  }} onClick={()=>openChat(npc)}>
                    <svg width="44" height="44" viewBox="0 0 44 44" style={{flexShrink:0}}>
                      <CharSprite animal={npc.animal} color={npc.color} x={22} y={28} size={32}/>
                    </svg>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800}}>{d.name}</div>
                      <div style={{fontSize:"0.8rem",color:"var(--text-3)",marginTop:1}}>
                        Usually near {zone?.label || "The Grove"}
                      </div>
                    </div>
                    <button className="btn-secondary" style={{fontSize:"0.78rem",padding:"6px 12px",flexShrink:0}}
                      onClick={e=>{e.stopPropagation();openChat(npc);}}>Chat</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Shop view ───────────────────────────────────────────── */}
      {view === "shop" && activeShop && (
        <div className="page-container anim-fade-in">
          <button className="btn-secondary" style={{alignSelf:"flex-start",marginBottom:-8}}
            onClick={()=>{setView("world");setActiveShop(null);setPreviewItem(null);sfx.click();}}>
            ← Back to the Grove
          </button>

          <div className="page-hero page-hero-alt">
            <div className="hero-text">
              <div className="hero-label">{activeShop.category}</div>
              <div className="hero-title" style={{fontSize:"1.4rem"}}>{activeShop.name}</div>
              <p className="hero-desc" style={{marginTop:6}}>Browse and purchase items for your island and character.</p>
            </div>
          </div>

          {/* Shelf display */}
          <div className="card">
            <div className="card-header">
              <div><div className="card-title">On Display</div><div className="card-sub">Tap an item to preview</div></div>
            </div>
            {/* Shelf unit */}
            <div style={{background:"linear-gradient(180deg,#C8A882,#A8886A)",borderRadius:16,padding:"0 16px 16px",boxShadow:"inset 0 4px 20px rgba(0,0,0,0.15)"}}>
              {/* Shelf back wall */}
              <div style={{background:"#D4B490",borderRadius:"12px 12px 0 0",padding:"12px 0 0",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-around",alignItems:"flex-end",minHeight:100,padding:"8px 8px 0"}}>
                  {activeShop.items.map(item=>(
                    <div key={item.id}
                      style={{
                        display:"flex",flexDirection:"column",alignItems:"center",gap:6,
                        cursor:"pointer",padding:"8px 12px",borderRadius:12,
                        background:previewItem?.id===item.id?"rgba(255,255,255,0.35)":"rgba(255,255,255,0.15)",
                        border:previewItem?.id===item.id?"2px solid rgba(255,255,255,0.7)":"2px solid transparent",
                        transition:"all 0.18s",
                      }}
                      onClick={()=>{sfx.click();setPreviewItem(item);}}>
                      <ItemArt type={item.type} size={62}/>
                    </div>
                  ))}
                </div>
                {/* Shelf plank */}
                <div style={{height:10,background:"linear-gradient(180deg,#B8926A,#9A7050)",borderRadius:"0 0 4px 4px",boxShadow:"0 3px 8px rgba(0,0,0,0.2)",margin:"0 -8px"}}/>
              </div>
              {/* Item labels */}
              <div style={{display:"flex",justifyContent:"space-around",paddingTop:8}}>
                {activeShop.items.map(item=>(
                  <div key={item.id} style={{textAlign:"center",flex:1}}>
                    <div style={{fontSize:"0.78rem",fontWeight:800,color:"white"}}>{item.name}</div>
                    <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.75)"}}>
                      {item.price===0?"Free":`${item.price} ★`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview card */}
          {previewItem && (
            <div className="card anim-fade-in">
              <div style={{display:"flex",gap:20,alignItems:"center"}}>
                <div style={{
                  width:90,height:90,borderRadius:20,
                  background:"linear-gradient(135deg,var(--bg-2),var(--bg))",
                  display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                  border:"1.5px solid var(--border)",
                }}>
                  <ItemArt type={previewItem.type} size={68}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:"1.1rem",fontWeight:900,marginBottom:4}}>{previewItem.name}</div>
                  <p style={{fontSize:"0.85rem",color:"var(--text-2)",lineHeight:1.5,marginBottom:10}}>
                    {previewItem.description}
                  </p>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{fontWeight:800,color:"var(--gold)",fontSize:"1rem"}}>
                      {previewItem.price===0?"FREE":`${previewItem.price} coins`}
                    </span>
                    <button className="btn-primary" onClick={()=>buyItem(previewItem)}
                      style={{padding:"8px 18px",fontSize:"0.88rem"}}>
                      {previewItem.price===0?"Pick up free":"Purchase"}
                    </button>
                  </div>
                  {inventory.some(i=>i.id===previewItem.id)&&(
                    <div style={{fontSize:"0.78rem",color:"var(--brand-2)",marginTop:6,fontWeight:700}}>
                      ✓ Already in inventory
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* All items list */}
          <div className="card">
            <div className="card-title" style={{marginBottom:14}}>All Items</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {activeShop.items.map(item=>(
                <div key={item.id} style={{
                  display:"flex",alignItems:"center",gap:14,
                  padding:"12px 14px",borderRadius:14,
                  border:"1.5px solid var(--border)",background:"var(--surface)",
                }}>
                  <div style={{
                    width:52,height:52,borderRadius:12,flexShrink:0,
                    background:"var(--bg-2)",display:"flex",alignItems:"center",justifyContent:"center",
                  }}>
                    <ItemArt type={item.type} size={40}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:"0.95rem"}}>{item.name}</div>
                    <div style={{fontSize:"0.8rem",color:"var(--text-2)",marginTop:1}}>{item.description}</div>
                  </div>
                  <button
                    className={item.price===0?"btn-secondary":"btn-primary"}
                    style={{flexShrink:0,padding:"8px 14px",fontSize:"0.82rem"}}
                    onClick={()=>buyItem(item)}>
                    {item.price===0?"Free":"Buy "+item.price}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Mini-game view ───────────────────────────────────────── */}
      {view === "game" && activeGame && (
        <div className="page-container anim-fade-in">
          <button className="btn-secondary" style={{alignSelf:"flex-start",marginBottom:-4}}
            onClick={()=>{setView("world");setActiveGame(null);sfx.click();}}>
            ← Back to the Grove
          </button>
          <div className="page-hero page-hero-purple">
            <div className="hero-text">
              <div className="hero-label">Mini-Game</div>
              <div className="hero-title" style={{fontSize:"1.4rem"}}>
                {activeGame==="memory"?"Memory Match":activeGame==="dash"?"Coin Dash":"Trivia Quiz"}
              </div>
              <p className="hero-desc" style={{marginTop:6}}>
                {activeGame==="memory"?"Find all 6 matching pairs!":activeGame==="dash"?"Click the star as fast as you can!":"Answer wellness questions correctly!"}
              </p>
            </div>
          </div>
          <div className="card">
            {activeGame==="memory" && <MemoryMatch onFinish={onGameFinish}/>}
            {activeGame==="dash"   && <CoinDash onFinish={onGameFinish}/>}
            {activeGame==="trivia" && <TriviaGame onFinish={onGameFinish}/>}
          </div>
        </div>
      )}

      {/* ── Chat view ────────────────────────────────────────────── */}
      {view === "chat" && chatNpc && (() => {
        const d = NPC_CHAT[chatNpc.id];
        return (
          <div className="page-container anim-fade-in">
            <button className="btn-secondary" style={{alignSelf:"flex-start",marginBottom:-4}}
              onClick={()=>{setView("world");setChatNpc(null);sfx.click();}}>
              ← Back to the Grove
            </button>

            {/* NPC header */}
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",
              background:"var(--panel)",borderRadius:20,border:"1.5px solid var(--border)"}}>
              <svg width="56" height="56" viewBox="0 0 56 56" style={{flexShrink:0}}>
                <CharSprite animal={chatNpc.animal} color={chatNpc.color} x={28} y={36} size={38}/>
              </svg>
              <div>
                <div style={{fontWeight:900,fontSize:"1.05rem"}}>{d.name}</div>
                <div style={{fontSize:"0.8rem",color:"var(--text-3)"}}>Grove regular · Tap to chat</div>
              </div>
              {!friends?.includes(d.name)&&(
                <button className="btn-secondary" style={{marginLeft:"auto",fontSize:"0.78rem",padding:"7px 12px"}}
                  onClick={()=>addFriend(chatNpc)}>
                  + Friend
                </button>
              )}
              {friends?.includes(d.name)&&(
                <span style={{marginLeft:"auto",fontSize:"0.78rem",color:"var(--brand-2)",fontWeight:700,
                  background:"rgba(91,155,138,0.12)",padding:"6px 12px",borderRadius:999}}>
                  ✓ Friends
                </span>
              )}
            </div>

            {/* Chat bubbles */}
            <div style={{
              background:"var(--bg-2)",borderRadius:20,padding:"16px",
              minHeight:200,display:"flex",flexDirection:"column",gap:10,
              border:"1.5px solid var(--border)",
            }}>
              {chatLog.map((msg,i)=>(
                <div key={i} style={{
                  display:"flex",justifyContent:msg.from==="player"?"flex-end":"flex-start",
                }}>
                  <div style={{
                    maxWidth:"78%",padding:"10px 16px",borderRadius:msg.from==="player"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                    background:msg.from==="player"?"linear-gradient(135deg,var(--brand),#C86040)":"var(--panel)",
                    color:msg.from==="player"?"white":"var(--text)",
                    fontSize:"0.9rem",fontWeight:600,lineHeight:1.5,
                    border:msg.from==="npc"?"1.5px solid var(--border)":undefined,
                    boxShadow:"0 2px 10px rgba(0,0,0,0.08)",
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick replies (first interaction) */}
            {chatStep === "opener" && (
              <div className="card">
                <div className="card-sub" style={{marginBottom:10}}>Choose a reply to start:</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {d.replies.map((r,i)=>(
                    <button key={i} onClick={()=>pickReply(r)} style={{
                      padding:"12px 16px",borderRadius:14,border:"1.5px solid var(--border)",
                      background:"var(--surface)",textAlign:"left",fontWeight:700,fontSize:"0.88rem",
                      cursor:"pointer",transition:"all 0.15s",color:"var(--text)",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(232,132,90,0.06)";e.currentTarget.style.borderColor="var(--brand)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="var(--surface)";e.currentTarget.style.borderColor="var(--border)";}}
                    >
                      {r.text}
                    </button>
                  ))}
                </div>
                <button
                  className="btn-secondary"
                  style={{marginTop:10,fontSize:"0.78rem"}}
                  onClick={() => { sfx.click(); setView("messages"); openThread(chatNpc.id); }}
                >
                  Open full conversation →
                </button>
              </div>
            )}
            {chatStep === "done" && (
              <div className="card">
                <form onSubmit={sendFreeChat} style={{display:"flex",gap:10}}>
                  <input
                    value={chatInput}
                    onChange={e=>setChatInput(e.target.value)}
                    placeholder="Say something…"
                    style={{
                      flex:1,padding:"11px 16px",borderRadius:14,
                      border:"1.5px solid var(--border)",background:"var(--surface)",
                      fontSize:"0.92rem",color:"var(--text)",outline:"none",fontFamily:"inherit",fontWeight:600,
                    }}
                  />
                  <button type="submit" className="btn-primary" style={{padding:"11px 18px"}}>Send</button>
                </form>
                <button
                  className="btn-secondary"
                  style={{marginTop:8,fontSize:"0.78rem",width:"100%"}}
                  onClick={() => { sfx.click(); setView("messages"); openThread(chatNpc.id); }}
                >
                  Open full conversation →
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Messages view (thread list) ─────────────────────────── */}
      {view === "messages" && !activeThread && (
        <div className="page-container anim-fade-in">
          <button className="btn-secondary" style={{alignSelf:"flex-start",marginBottom:-4}}
            onClick={()=>{setView("world");sfx.click();}}>
            ← Back to the Grove
          </button>

          <div style={{
            background:"linear-gradient(135deg,#2A1F5A,#3A2F7A)",
            borderRadius:24,padding:"24px 24px 20px",color:"white",
            boxShadow:"0 8px 32px rgba(42,31,90,0.4)",
          }}>
            <div style={{fontSize:"0.72rem",fontWeight:800,opacity:0.65,textTransform:"uppercase",letterSpacing:"1px",marginBottom:6}}>
              Messages
            </div>
            <div style={{fontSize:"1.5rem",fontWeight:900,lineHeight:1.2}}>
              Your Conversations
            </div>
            <p style={{fontSize:"0.85rem",opacity:0.72,marginTop:6,lineHeight:1.5}}>
              Chat with your friends in The Grove.
            </p>
          </div>

          {/* Thread list */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {NPCS.map(npc => {
              const d = NPC_CHAT[npc.id];
              const thread = chatThreads[npc.id] || [];
              const lastMsg = thread[thread.length - 1];
              const isFriend = friends?.includes(d.name);
              return (
                <button
                  key={npc.id}
                  onClick={() => { sfx.click(); openThread(npc.id); }}
                  style={{
                    display:"flex", alignItems:"center", gap:14,
                    padding:"14px 16px", borderRadius:18,
                    border:"1.5px solid var(--border)",
                    background:"var(--panel)",
                    cursor:"pointer", textAlign:"left",
                    transition:"all 0.18s",
                    boxShadow:"0 2px 12px var(--shadow)",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateX(3px)";e.currentTarget.style.boxShadow="0 6px 20px var(--shadow)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 2px 12px var(--shadow)";}}
                >
                  {/* Avatar */}
                  <div style={{position:"relative",flexShrink:0}}>
                    <svg width="52" height="52" viewBox="0 0 52 52">
                      <circle cx="26" cy="26" r="26" fill={isFriend?"rgba(91,155,138,0.15)":"rgba(232,132,90,0.12)"}/>
                      <CharSprite animal={npc.animal} color={npc.color} x={26} y={34} size={34}/>
                    </svg>
                    {isFriend && (
                      <div style={{
                        position:"absolute",bottom:0,right:0,
                        width:16,height:16,borderRadius:"50%",
                        background:"var(--brand-2)",border:"2px solid var(--panel)",
                        display:"grid",placeItems:"center",
                      }}>
                        <span style={{fontSize:"8px",color:"white",fontWeight:900}}>✓</span>
                      </div>
                    )}
                  </div>

                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontWeight:900,fontSize:"0.95rem"}}>{d.name}</span>
                      {lastMsg && <span style={{fontSize:"0.7rem",color:"var(--text-3)"}}>{formatTime(lastMsg.ts)}</span>}
                    </div>
                    <div style={{
                      fontSize:"0.83rem",color:"var(--text-2)",
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                      maxWidth:"100%",
                    }}>
                      {lastMsg ? (lastMsg.from === "player" ? `You: ${lastMsg.text}` : lastMsg.text) : "Say hello!"}
                    </div>
                  </div>

                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{flexShrink:0,opacity:0.35}}>
                    <path d="M6 3l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Messages view (open thread) ──────────────────────────── */}
      {view === "messages" && activeThread && (() => {
        const npc = NPCS.find(n => n.id === activeThread);
        const d   = NPC_CHAT[activeThread];
        const thread = chatThreads[activeThread] || [];
        const isFriend = friends?.includes(d.name);
        return (
          <div style={{display:"flex",flexDirection:"column",height:"calc(100dvh - 132px)"}}>
            {/* Thread header */}
            <div style={{
              display:"flex",alignItems:"center",gap:14,
              padding:"14px 20px",
              background:"var(--panel)",
              borderBottom:"1px solid var(--border)",
              flexShrink:0,
            }}>
              <button
                onClick={() => { setActiveThread(null); sfx.click(); }}
                style={{
                  width:36,height:36,borderRadius:12,border:"1.5px solid var(--border)",
                  background:"var(--bg-2)",display:"grid",placeItems:"center",cursor:"pointer",
                  color:"var(--text-2)",flexShrink:0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <svg width="44" height="44" viewBox="0 0 44 44" style={{flexShrink:0}}>
                <circle cx="22" cy="22" r="22" fill={isFriend?"rgba(91,155,138,0.15)":"rgba(232,132,90,0.1)"}/>
                <CharSprite animal={npc.animal} color={npc.color} x={22} y={30} size={30}/>
              </svg>
              <div style={{flex:1}}>
                <div style={{fontWeight:900,fontSize:"1rem"}}>{d.name}</div>
                <div style={{fontSize:"0.75rem",color:"var(--text-3)"}}>
                  {npcTyping ? "Typing…" : "Grove regular"}
                </div>
              </div>
              {!isFriend ? (
                <button
                  className="btn-secondary"
                  style={{fontSize:"0.78rem",padding:"6px 12px",flexShrink:0}}
                  onClick={() => addFriend(npc)}
                >
                  + Friend
                </button>
              ) : (
                <span style={{
                  fontSize:"0.78rem",color:"var(--brand-2)",fontWeight:700,
                  background:"rgba(91,155,138,0.1)",padding:"6px 12px",borderRadius:999,
                  border:"1px solid rgba(91,155,138,0.25)",
                }}>
                  ✓ Friends
                </span>
              )}
            </div>

            {/* Messages scroll area */}
            <div style={{
              flex:1,overflowY:"auto",
              padding:"16px 20px",
              display:"flex",flexDirection:"column",gap:10,
              background:"var(--bg)",
            }}>
              {thread.map((msg, i) => (
                <div key={i} style={{
                  display:"flex",
                  justifyContent: msg.from === "player" ? "flex-end" : "flex-start",
                  gap:8,
                  alignItems:"flex-end",
                }}>
                  {msg.from === "npc" && (
                    <svg width="28" height="28" viewBox="0 0 28 28" style={{flexShrink:0,marginBottom:2}}>
                      <circle cx="14" cy="14" r="14" fill="rgba(91,155,138,0.15)"/>
                      <CharSprite animal={npc.animal} color={npc.color} x={14} y={19} size={19}/>
                    </svg>
                  )}
                  <div style={{
                    maxWidth:"72%",
                    padding:"11px 15px",
                    borderRadius: msg.from === "player" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: msg.from === "player"
                      ? "linear-gradient(135deg,var(--brand),#C86040)"
                      : "var(--panel)",
                    color:  msg.from === "player" ? "white" : "var(--text)",
                    fontSize:"0.9rem",fontWeight:600,lineHeight:1.55,
                    border: msg.from === "npc" ? "1.5px solid var(--border)" : "none",
                    boxShadow:"0 2px 10px rgba(0,0,0,0.07)",
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {npcTyping && (
                <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
                  <svg width="28" height="28" viewBox="0 0 28 28" style={{flexShrink:0,marginBottom:2}}>
                    <circle cx="14" cy="14" r="14" fill="rgba(91,155,138,0.15)"/>
                    <CharSprite animal={npc.animal} color={npc.color} x={14} y={19} size={19}/>
                  </svg>
                  <div style={{
                    padding:"12px 16px",borderRadius:"18px 18px 18px 4px",
                    background:"var(--panel)",border:"1.5px solid var(--border)",
                    display:"flex",gap:5,alignItems:"center",
                  }}>
                    <span className="ai-dots">
                      <span style={{width:7,height:7}}/><span style={{width:7,height:7}}/><span style={{width:7,height:7}}/>
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Compose bar */}
            <form
              onSubmit={sendThreadMessage}
              style={{
                display:"flex",gap:10,padding:"12px 16px",
                background:"var(--panel)",
                borderTop:"1px solid var(--border)",
                flexShrink:0,
              }}
            >
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={`Message ${d.name}…`}
                style={{
                  flex:1,padding:"12px 16px",borderRadius:14,
                  border:"1.5px solid var(--border)",background:"var(--surface)",
                  fontSize:"0.92rem",color:"var(--text)",outline:"none",
                  fontFamily:"inherit",fontWeight:600,
                }}
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                style={{
                  width:46,height:46,borderRadius:14,
                  background: chatInput.trim() ? "linear-gradient(135deg,var(--brand),#C86040)" : "var(--bg-2)",
                  border:"none",cursor:chatInput.trim()?"pointer":"default",
                  display:"grid",placeItems:"center",
                  transition:"background 0.18s",flexShrink:0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 10L17 3l-4 7 4 7L3 10z" fill={chatInput.trim()?"white":"var(--text-3)"}/>
                </svg>
              </button>
            </form>
          </div>
        );
      })()}

      {/* ── Toast ──────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",
          background:"linear-gradient(135deg,var(--nav-bg),#4A3020)",
          color:"white",padding:"12px 24px",borderRadius:999,
          fontWeight:800,fontSize:"0.9rem",zIndex:300,
          boxShadow:"0 8px 32px rgba(0,0,0,0.35)",
          whiteSpace:"nowrap",pointerEvents:"none",
          animation:"fadeIn 0.25s ease",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
