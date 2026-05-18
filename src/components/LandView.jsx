import { useState, useRef } from "react";
import { sfx } from "../lib/sound.js";

// ── Island SVG paths (viewBox 360×300) ────────────────────────────
const BEACH = "M190,22 C242,10 298,32 330,72 C362,112 364,162 344,202 C324,242 288,272 244,284 C200,296 150,294 112,276 C74,258 44,228 28,192 C12,156 14,110 38,76 C62,42 138,34 190,22 Z";
const GRASS = "M190,36 C238,24 290,46 318,82 C346,118 346,162 328,198 C310,234 276,260 236,272 C196,284 152,282 118,264 C84,246 58,218 44,184 C30,150 32,108 56,78 C80,48 142,48 190,36 Z";

const SKIN = { honey:"#F2B66D", ivory:"#F4DCC4", mint:"#82C9A0", berry:"#CF7AA4", sky:"#83AEE8", cocoa:"#9B7256", slate:"#738392" };

// ── Top-down chibi character ───────────────────────────────────────
function CharTopDown({ animal = "fox", color = "honey", x, y }) {
  const skin = SKIN[color] ?? SKIN.honey;
  const s = 16;
  return (
    <g transform={`translate(${x},${y})`} style={{ pointerEvents: "none" }}>
      <ellipse cx={0} cy={s * 0.68} rx={s * 0.55} ry={s * 0.2} fill="rgba(0,0,0,0.16)" />
      <circle cx={0} cy={s * 0.18} r={s * 0.48} fill={skin} stroke="rgba(0,0,0,0.12)" strokeWidth={0.8} />
      <circle cx={0} cy={-s * 0.18} r={s * 0.36} fill={skin} stroke="rgba(0,0,0,0.1)" strokeWidth={0.8} />
      {/* Ears */}
      {(animal === "fox" || animal === "cat") && <>
        <polygon points={`${-s*.3},${-s*.45} ${-s*.46},${-s*.74} ${-s*.1},${-s*.48}`} fill={skin} />
        <polygon points={`${s*.3},${-s*.45} ${s*.46},${-s*.74} ${s*.1},${-s*.48}`} fill={skin} />
        <polygon points={`${-s*.3},${-s*.48} ${-s*.42},${-s*.68} ${-s*.14},${-s*.5}`} fill="#F9A8C4" />
        <polygon points={`${s*.3},${-s*.48} ${s*.42},${-s*.68} ${s*.14},${-s*.5}`} fill="#F9A8C4" />
      </>}
      {animal === "rabbit" && <>
        <ellipse cx={-s*.18} cy={-s*.72} rx={s*.09} ry={s*.26} fill={skin} stroke="rgba(0,0,0,0.1)" strokeWidth={0.5} />
        <ellipse cx={s*.18} cy={-s*.72} rx={s*.09} ry={s*.26} fill={skin} stroke="rgba(0,0,0,0.1)" strokeWidth={0.5} />
        <ellipse cx={-s*.18} cy={-s*.72} rx={s*.05} ry={s*.18} fill="#F9A8C4" />
        <ellipse cx={s*.18} cy={-s*.72} rx={s*.05} ry={s*.18} fill="#F9A8C4" />
      </>}
      {(animal === "bear" || animal === "panda" || animal === "dog") && <>
        <circle cx={-s*.3} cy={-s*.44} r={s*.16} fill={skin} stroke="rgba(0,0,0,0.1)" strokeWidth={0.5} />
        <circle cx={s*.3} cy={-s*.44} r={s*.16} fill={skin} stroke="rgba(0,0,0,0.1)" strokeWidth={0.5} />
      </>}
      <circle cx={-s*.12} cy={-s*.2} r={s*.065} fill="#1A0A00" />
      <circle cx={s*.12} cy={-s*.2} r={s*.065} fill="#1A0A00" />
      <circle cx={-s*.1} cy={-s*.22} r={s*.022} fill="#fff" />
      <circle cx={s*.1} cy={-s*.22} r={s*.022} fill="#fff" />
    </g>
  );
}

// ── SVG art for items placed on island / interior ──────────────────
function ItemArt({ type, x = 0, y = 0, size = 24 }) {
  const s = size;
  switch (type) {
    case "tree": return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx={0} cy={s*.55} rx={s*.52} ry={s*.18} fill="rgba(0,0,0,0.13)" />
        <circle cx={0} cy={s*.04} r={s*.58} fill="#4CAF50" />
        <circle cx={-s*.22} cy={-s*.22} r={s*.38} fill="#66BB6A" />
        <circle cx={s*.22} cy={-s*.22} r={s*.36} fill="#57A75D" />
        <circle cx={0} cy={-s*.44} r={s*.28} fill="#76C17A" />
        <circle cx={-s*.2} cy={0} r={s*.09} fill="#E53935" />
        <circle cx={s*.22} cy={-s*.18} r={s*.09} fill="#E53935" />
        <circle cx={s*.06} cy={s*.12} r={s*.07} fill="#E53935" />
      </g>
    );
    case "fern": return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx={0} cy={s*.32} rx={s*.36} ry={s*.12} fill="rgba(0,0,0,0.1)" />
        <path d={`M0,${s*.28} C-${s*.36},${-s*.08} -${s*.52},-${s*.36} -${s*.32},-${s*.58}`} fill="none" stroke="#4CAF50" strokeWidth={2.5} strokeLinecap="round" />
        <path d={`M0,${s*.28} C${s*.36},${-s*.08} ${s*.52},-${s*.36} ${s*.32},-${s*.58}`} fill="none" stroke="#57A75D" strokeWidth={2.5} strokeLinecap="round" />
        <path d={`M0,${s*.28} C0,${-s*.1} 0,-${s*.42} 0,-${s*.62}`} fill="none" stroke="#66BB6A" strokeWidth={2.5} strokeLinecap="round" />
        <path d={`M-${s*.26},-${s*.14} C-${s*.1},-${s*.22} ${s*.06},-${s*.18} ${s*.1},-${s*.08}`} fill="none" stroke="#4CAF50" strokeWidth={1.5} strokeLinecap="round" />
        <path d={`M${s*.22},-${s*.26} C${s*.06},-${s*.3} -${s*.06},-${s*.26} -${s*.08},-${s*.16}`} fill="none" stroke="#57A75D" strokeWidth={1.5} strokeLinecap="round" />
      </g>
    );
    case "pond": return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx={0} cy={0} rx={s*.88} ry={s*.52} fill="rgba(100,180,240,0.88)" stroke="rgba(70,150,210,0.55)" strokeWidth={1.5} />
        <ellipse cx={0} cy={0} rx={s*.62} ry={s*.34} fill="rgba(130,205,255,0.5)" />
        <ellipse cx={0} cy={0} rx={s*.32} ry={s*.16} fill="rgba(160,220,255,0.4)" />
        <ellipse cx={-s*.32} cy={s*.1} rx={s*.16} ry={s*.1} fill="#4CAF50" opacity={0.85} />
        <circle cx={-s*.32} cy={s*.1} r={s*.04} fill="#E91E63" opacity={0.9} />
        <ellipse cx={s*.3} cy={-s*.1} rx={s*.13} ry={s*.08} fill="#57A75D" opacity={0.85} />
        <path d={`M-${s*.6},${-s*.06} Q-${s*.46},-${s*.14} -${s*.32},-${s*.06}`} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
        <path d={`M${s*.1},${s*.2} Q${s*.24},${s*.12} ${s*.38},${s*.2}`} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
      </g>
    );
    case "sofa": return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx={0} cy={s*.52} rx={s*.72} ry={s*.2} fill="rgba(0,0,0,0.12)" />
        <rect x={-s*.66} y={-s*.52} width={s*1.32} height={s*.34} rx={5} fill="#7B5EA7" />
        <rect x={-s*.66} y={-s*.2} width={s*1.32} height={s*.46} rx={5} fill="#9B7FC7" />
        <rect x={-s*.62} y={-s*.18} width={s*.56} height={s*.42} rx={4} fill="#B09FD5" />
        <rect x={s*.06} y={-s*.18} width={s*.56} height={s*.42} rx={4} fill="#B09FD5" />
        <rect x={-s*.78} y={-s*.35} width={s*.18} height={s*.6} rx={5} fill="#6A4E96" />
        <rect x={s*.6} y={-s*.35} width={s*.18} height={s*.6} rx={5} fill="#6A4E96" />
        <rect x={-s*.62} y={-s*.5} width={s*.52} height={s*.06} rx={2} fill="#C0B0E0" opacity={0.5} />
        <rect x={s*.1} y={-s*.5} width={s*.52} height={s*.06} rx={2} fill="#C0B0E0" opacity={0.5} />
      </g>
    );
    case "lamp": return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx={0} cy={s*.52} rx={s*.28} ry={s*.1} fill="rgba(0,0,0,0.14)" />
        <ellipse cx={0} cy={s*.44} rx={s*.22} ry={s*.08} fill="#C9A96E" />
        <rect x={-s*.042} y={-s*.28} width={s*.084} height={s*.74} fill="#D4B478" rx={2} />
        <path d={`M-${s*.42},${-s*.28} L-${s*.26},-${s*.66} L${s*.26},-${s*.66} L${s*.42},-${s*.28} Z`} fill="#F4D580" stroke="#D4A050" strokeWidth={1.2} />
        <path d={`M-${s*.38},${-s*.28} L-${s*.23},-${s*.62} L${s*.23},-${s*.62} L${s*.38},-${s*.28} Z`} fill="rgba(255,240,160,0.35)" />
        <ellipse cx={0} cy={-s*.28} rx={s*.32} ry={s*.09} fill="rgba(255,220,100,0.4)" />
        <ellipse cx={0} cy={s*.08} rx={s*.18} ry={s*.06} fill="rgba(255,220,100,0.2)" />
      </g>
    );
    case "rug": return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx={0} cy={0} rx={s*.82} ry={s*.5} fill="#D32F2F" />
        <ellipse cx={0} cy={0} rx={s*.68} ry={s*.38} fill="#EF5350" />
        <ellipse cx={0} cy={0} rx={s*.52} ry={s*.28} fill="#D32F2F" />
        <ellipse cx={0} cy={0} rx={s*.34} ry={s*.16} fill="#FFCDD2" />
        <circle cx={0} cy={0} r={s*.07} fill="#D32F2F" />
        {[0,1,2,3].map(i => (
          <circle key={i} cx={Math.cos(i*Math.PI/2)*s*.58} cy={Math.sin(i*Math.PI/2)*s*.34} r={s*.055} fill="#B71C1C" />
        ))}
        {[0,1,2,3].map(i => (
          <circle key={i} cx={Math.cos(i*Math.PI/2+Math.PI/4)*s*.42} cy={Math.sin(i*Math.PI/2+Math.PI/4)*s*.24} r={s*.04} fill="#FFCDD2" />
        ))}
      </g>
    );
    case "token": return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx={0} cy={s*.1} rx={s*.52} ry={s*.16} fill="rgba(0,0,0,0.14)" />
        <circle cx={0} cy={0} r={s*.5} fill="#D4A853" stroke="#A8803A" strokeWidth={2} />
        <circle cx={0} cy={0} r={s*.38} fill="#F4D580" />
        <polygon points={[0,1,2,3,4,5,6,7,8,9].map(i => {
          const r = i%2===0 ? s*.24 : s*.1;
          const a = i*Math.PI/5 - Math.PI/2;
          return `${r*Math.cos(a)},${r*Math.sin(a)}`;
        }).join(" ")} fill="#D4A853" />
        <circle cx={0} cy={0} r={s*.06} fill="#A8803A" />
      </g>
    );
    case "banner": return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx={0} cy={s*.52} rx={s*.14} ry={s*.06} fill="rgba(0,0,0,0.14)" />
        <rect x={-s*.042} y={-s*.72} width={s*.084} height={s*1.14} fill="#8B5E3C" rx={2} />
        <polygon points={`${-s*.04},${-s*.72} ${-s*.04},${-s*.42} ${s*.32},${-s*.57}`} fill="#E8845A" />
        <polygon points={`${-s*.04},${-s*.36} ${-s*.04},${-s*.06} ${s*.32},${-s*.21}`} fill="#D4A853" />
        <polygon points={`${-s*.04},${s*.0} ${-s*.04},${s*.3} ${s*.32},${s*.15}`} fill="#5B9B8A" />
      </g>
    );
    case "trail": return (
      <g transform={`translate(${x},${y})`}>
        {[0,1,2,3,4,5].map(i => {
          const a = i * Math.PI * 2 / 6;
          const r = s * 0.38;
          const radius = s * (0.14 - i * 0.016);
          const opacity = 0.95 - i * 0.14;
          return <circle key={i} cx={Math.cos(a)*r} cy={Math.sin(a)*r} r={Math.max(2, radius)} fill={`rgba(232,132,90,${opacity})`} />;
        })}
        <circle cx={0} cy={0} r={s*.1} fill="rgba(212,168,83,0.9)" />
      </g>
    );
    case "house": return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx={0} cy={s*.68} rx={s*.68} ry={s*.2} fill="rgba(0,0,0,0.14)" />
        <rect x={-s*.54} y={-s*.08} width={s*1.08} height={s*.66} rx={5} fill="#F5DEB3" stroke="#DEB887" strokeWidth={1.2} />
        <polygon points={`${-s*.68},${-s*.08} 0,${-s*.72} ${s*.68},${-s*.08}`} fill="#C0392B" />
        <polygon points={`${-s*.54},${-s*.08} 0,${-s*.58} ${s*.54},${-s*.08}`} fill="#E53935" opacity={0.3} />
        <rect x={-s*.1} y={s*.22} width={s*.2} height={s*.36} rx={3} fill="#8B4513" />
        <rect x={-s*.42} y={s*.04} width={s*.18} height={s*.18} rx={3} fill="#87CEEB" stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
        <rect x={s*.24} y={s*.04} width={s*.18} height={s*.18} rx={3} fill="#87CEEB" stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
        <circle cx={s*.12} cy={s*.4} r={s*.04} fill="#D4A853" />
      </g>
    );
    default: return null;
  }
}

// ── Friend island with bridge ──────────────────────────────────────
function FriendIsland({ name, side, onVisit }) {
  const left = side === "left";
  const bx = left ? [10, 30, 50, 70, 90] : [250, 270, 290, 310, 330];
  return (
    <g>
      {bx.map((x, i) => (
        <rect key={i} x={x} y={238} width={16} height={9} rx={2} fill={i%2===0 ? "#C49A6C" : "#A07840"} />
      ))}
      <line x1={left?10:250} y1={234} x2={left?106:360} y2={234} stroke="#8B6030" strokeWidth={2} />
      <line x1={left?10:250} y1={250} x2={left?106:360} y2={250} stroke="#8B6030" strokeWidth={2} />
      <ellipse cx={left?-22:382} cy={244} rx={36} ry={24} fill="#B8E0A0" stroke="#8AC060" strokeWidth={1.5} />
      <ellipse cx={left?-22:382} cy={244} rx={22} ry={14} fill="#7CBF58" />
      <text x={left?-22:382} y={248} textAnchor="middle" fill="#3D2B1F" fontSize={7} fontWeight="800" fontFamily="Nunito,sans-serif">{name}</text>
      <rect x={left?-50:360} y={258} width={56} height={16} rx={8} fill="#5B9B8A" style={{cursor:"pointer"}} onClick={onVisit} />
      <text x={left?-22:388} y={270} textAnchor="middle" fill="#fff" fontSize={7} fontWeight="800" fontFamily="Nunito,sans-serif" style={{pointerEvents:"none"}}>Visit</text>
    </g>
  );
}

// ── Main component ─────────────────────────────────────────────────
export default function LandView({ emotion, character, land, setLand, coins, setCoins, inventory = [], friends = [] }) {
  const [buildMode, setBuildMode]       = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [view, setView]                 = useState("island");
  const [toast, setToast]               = useState(null);
  const svgRef = useRef(null);

  const placedItems   = land.placedItems   ?? [];
  const linkedWorlds  = land.linkedWorlds  ?? [];
  const charPos       = land.character?.svgX != null
    ? { x: land.character.svgX, y: land.character.svgY }
    : { x: 195, y: 175 };

  const placeableTypes = new Set(["tree","fern","pond","sofa","lamp","rug","token","banner","trail","house"]);
  const interiorTypes  = new Set(["sofa","lamp","rug"]);
  const placeableInv   = inventory.filter(i => placeableTypes.has(i.type));
  const interiorInv    = inventory.filter(i => interiorTypes.has(i.type));
  const unlinked       = friends.filter(f => !linkedWorlds.some(w => w === f || w === `${f}'s world`));

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  function handleIslandClick(e) {
    if (!buildMode || !selectedItem) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = Math.round(((e.clientX - rect.left)  / rect.width)  * 360);
    const svgY = Math.round(((e.clientY - rect.top)   / rect.height) * 300);
    setLand(s => ({ ...s, placedItems: [...(s.placedItems ?? []), { id: crypto.randomUUID(), type: selectedItem.type, x: svgX, y: svgY }] }));
    sfx.place?.();
    showToast(`${selectedItem.name} placed!`);
  }

  function removeItem(id) {
    setLand(s => ({ ...s, placedItems: (s.placedItems ?? []).filter(i => i.id !== id) }));
    sfx.click?.();
  }

  function stepChar(dx, dy) {
    setLand(s => {
      const cx = s.character?.svgX ?? 195;
      const cy = s.character?.svgY ?? 175;
      return { ...s, character: { ...s.character, svgX: Math.max(80, Math.min(280, cx+dx)), svgY: Math.max(60, Math.min(252, cy+dy)) } };
    });
  }

  function buildBridge(name) {
    setLand(s => ({ ...s, linkedWorlds: [...(s.linkedWorlds ?? []), name] }));
    sfx.place?.();
    showToast(`Bridge to ${name} built!`);
  }

  return (
    <div className="page-container anim-fade-in">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="page-hero page-hero-alt">
        <div className="hero-text">
          <div className="hero-label">Burrow</div>
          <div className="hero-title" style={{ fontSize: "1.45rem" }}>Your island,<br />your world.</div>
          <p className="hero-desc" style={{ marginTop: 6 }}>
            Place items from your inventory and bridge to friends' islands.
          </p>
        </div>
      </div>

      {/* ── View tabs ─────────────────────────────────────────── */}
      <div className="cat-tabs">
        <button className={`cat-tab ${view === "island" ? "active" : ""}`} onClick={() => setView("island")}>Island</button>
        <button className={`cat-tab ${view === "interior" ? "active" : ""}`} onClick={() => setView("interior")}>Home Interior</button>
      </div>

      {/* ══════ ISLAND VIEW ══════════════════════════════════════ */}
      {view === "island" && (<>

        {/* ── Island SVG map ────────────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>

          {/* Build-mode toolbar */}
          {buildMode && (
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
              background: "rgba(30,15,5,0.88)", backdropFilter: "blur(8px)",
              padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, overflowX: "auto", scrollbarWidth: "none",
            }}>
              <span style={{ color: "#fff", fontSize: "0.76rem", fontWeight: 800, flexShrink: 0 }}>
                {selectedItem ? `Placing: ${selectedItem.name}` : "Pick an item →"}
              </span>
              {placeableInv.map(item => (
                <button key={item.id} onClick={() => setSelectedItem(item)} style={{
                  padding: "5px 11px", borderRadius: 9, flexShrink: 0, cursor: "pointer",
                  background: selectedItem?.id === item.id ? "var(--brand)" : "rgba(255,255,255,0.14)",
                  color: "#fff", fontSize: "0.72rem", fontWeight: 800, border: "none",
                }}>{item.name}</button>
              ))}
              {placeableInv.length === 0 && (
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem" }}>No placeable items yet — buy from the mall!</span>
              )}
              <button onClick={() => { setBuildMode(false); setSelectedItem(null); }} style={{
                marginLeft: "auto", padding: "5px 13px", borderRadius: 9, background: "#E53935",
                color: "#fff", fontSize: "0.72rem", fontWeight: 800, border: "none", flexShrink: 0, cursor: "pointer",
              }}>Done</button>
            </div>
          )}

          <svg
            ref={svgRef}
            viewBox="0 0 360 300"
            style={{ width: "100%", display: "block", cursor: buildMode && selectedItem ? "crosshair" : "default" }}
            onClick={handleIslandClick}
          >
            <defs>
              <radialGradient id="oceanG" cx="45%" cy="45%">
                <stop offset="0%" stopColor="#4FC3F7" />
                <stop offset="100%" stopColor="#0277BD" />
              </radialGradient>
              <pattern id="waves" x="0" y="0" width="50" height="22" patternUnits="userSpaceOnUse">
                <path d="M0,11 Q12.5,5 25,11 Q37.5,17 50,11" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
              </pattern>
              <radialGradient id="grassG" cx="45%" cy="40%">
                <stop offset="0%" stopColor="#8FCF82" />
                <stop offset="100%" stopColor="#5BAA5E" />
              </radialGradient>
            </defs>

            {/* Ocean */}
            <rect width={360} height={300} fill="url(#oceanG)" />
            <rect width={360} height={300} fill="url(#waves)" />

            {/* Friend islands */}
            {linkedWorlds.slice(0,1).map(w => (
              <FriendIsland key={w} name={w.replace("'s world","")} side="left"  onVisit={() => showToast(`Visiting ${w}…`)} />
            ))}
            {linkedWorlds.slice(1,2).map(w => (
              <FriendIsland key={w} name={w.replace("'s world","")} side="right" onVisit={() => showToast(`Visiting ${w}…`)} />
            ))}

            {/* Sandy beach ring */}
            <path d={BEACH} fill="#F5DEB3" />

            {/* Grass */}
            <path d={GRASS} fill="url(#grassG)" />
            {/* Grass texture specks */}
            {[{x:130,y:80},{x:170,y:60},{x:240,y:72},{x:280,y:110},{x:260,y:220},{x:140,y:235},{x:100,y:180}].map((p,i)=>(
              <circle key={i} cx={p.x} cy={p.y} r={3} fill="rgba(100,180,80,0.35)" />
            ))}

            {/* House plot */}
            <rect x={155} y={82} width={88} height={68} rx={10}
              fill="rgba(245,222,179,0.45)" stroke="rgba(200,160,100,0.5)" strokeWidth={1.2} strokeDasharray={buildMode?"0":"0"} />

            {/* Zone hints in build mode */}
            {buildMode && (<>
              <ellipse cx={200} cy={215} rx={62} ry={40}
                fill="rgba(91,155,138,0.16)" stroke="rgba(91,155,138,0.55)" strokeWidth={1.2} strokeDasharray="5 4" />
              <text x={200} y={219} textAnchor="middle" fill="rgba(91,155,138,0.9)" fontSize={8} fontWeight="800" fontFamily="Nunito,sans-serif">Garden</text>
              <rect x={152} y={79} width={94} height={74} rx={11}
                fill="rgba(232,132,90,0.12)" stroke="rgba(232,132,90,0.5)" strokeWidth={1.2} strokeDasharray="5 4" />
              <text x={199} y={118} textAnchor="middle" fill="rgba(232,132,90,0.9)" fontSize={8} fontWeight="800" fontFamily="Nunito,sans-serif">Home</text>
            </>)}

            {/* Fixed natural decorations */}
            <ellipse cx={96} cy={210} rx={7} ry={4} fill="#B0A090" />
            <ellipse cx={100} cy={215} rx={4.5} ry={3} fill="#C2B0A2" />
            <ellipse cx={272} cy={195} rx={5.5} ry={3.5} fill="#B0A090" />
            {/* Flowers */}
            {[{cx:138,cy:230,c:"#FF9EBB"},{cx:150,cy:222,c:"#FFD580"},{cx:256,cy:225,c:"#B5D8FF"},{cx:268,cy:234,c:"#FF9EBB"},{cx:168,cy:248,c:"#D9A0FF"}].map((f,i)=>(
              <g key={i}>
                <circle cx={f.cx} cy={f.cy} r={5} fill={f.c} opacity={0.9} />
                <circle cx={f.cx} cy={f.cy} r={2.5} fill="#fff" opacity={0.6} />
              </g>
            ))}

            {/* Default house in home plot */}
            <ItemArt type="house" x={199} y={115} size={22} />

            {/* Placed items */}
            {placedItems.map(item => (
              <g key={item.id} style={{ cursor: buildMode ? "pointer" : "default" }}
                onClick={e => { if (buildMode) { e.stopPropagation(); removeItem(item.id); showToast("Removed"); }}}>
                <ItemArt type={item.type} x={item.x} y={item.y} size={24} />
                {buildMode && (
                  <circle cx={item.x} cy={item.y} r={16}
                    fill="rgba(229,57,53,0.2)" stroke="#E53935" strokeWidth={1.5} />
                )}
              </g>
            ))}

            {/* Player character */}
            <CharTopDown animal={character?.animal ?? "fox"} color={character?.color ?? "honey"} x={charPos.x} y={charPos.y} />
            <polygon points={`${charPos.x},${charPos.y-30} ${charPos.x-5},${charPos.y-22} ${charPos.x+5},${charPos.y-22}`} fill="#E8845A" />

            {/* D-pad */}
            <g>
              {[
                {x:319,y:242,label:"↑",dx:0,dy:-16},
                {x:319,y:270,label:"↓",dx:0,dy:16},
                {x:289,y:256,label:"←",dx:-16,dy:0},
                {x:349,y:256,label:"→",dx:16,dy:0},
              ].map(btn => (
                <g key={btn.label} style={{ cursor:"pointer" }} onClick={e => { e.stopPropagation(); stepChar(btn.dx, btn.dy); }}>
                  <rect x={btn.x} y={btn.y} width={26} height={20} rx={6} fill="rgba(0,0,0,0.44)" />
                  <text x={btn.x+13} y={btn.y+14} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="800" fontFamily="Nunito,sans-serif" style={{pointerEvents:"none"}}>{btn.label}</text>
                </g>
              ))}
            </g>
          </svg>

          {/* Build mode toggle button */}
          <button
            onClick={() => { setBuildMode(b => !b); setSelectedItem(null); sfx.click?.(); }}
            style={{
              position: "absolute", bottom: 12, left: 12,
              padding: "8px 16px", borderRadius: 12,
              background: buildMode ? "var(--brand)" : "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)", color: "#fff",
              fontSize: "0.78rem", fontWeight: 800,
              border: `1.5px solid ${buildMode ? "#fff" : "rgba(255,255,255,0.22)"}`,
            }}
          >
            {buildMode ? "● Building" : "Build Mode"}
          </button>
        </div>

        {/* ── Inventory panel ───────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Inventory</div>
              <div className="card-sub">
                {placeableInv.length > 0
                  ? "Select Build Mode, pick an item, then tap the island to place it."
                  : "Buy items in the Social World mall to unlock placing."}
              </div>
            </div>
            {placeableInv.length > 0 && (
              <button className="btn-primary" style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                onClick={() => { setBuildMode(true); sfx.click?.(); }}>
                Build
              </button>
            )}
          </div>

          {placeableInv.length > 0 ? (
            <div className="inventory-grid">
              {placeableInv.map(item => (
                <button key={item.id} className="inventory-item" style={{
                  border: selectedItem?.id === item.id ? "2px solid var(--brand)" : undefined,
                  background: selectedItem?.id === item.id ? "rgba(232,132,90,0.08)" : undefined,
                  cursor: "pointer",
                }}
                  onClick={() => { setBuildMode(true); setSelectedItem(item); sfx.click?.(); }}>
                  <div className="inventory-item-icon" style={{ background: "transparent" }}>
                    <svg viewBox="-30 -30 60 60" width={44} height={44}>
                      <ItemArt type={item.type} x={0} y={0} size={24} />
                    </svg>
                  </div>
                  <div className="inventory-item-name">{item.name}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "20px 0" }}>
              <div className="empty-state-text">Visit the Social World → shop to buy items.</div>
            </div>
          )}

          {buildMode && placedItems.length > 0 && (
            <p style={{ fontSize: "0.74rem", color: "var(--text-3)", marginTop: 10, textAlign: "center" }}>
              Tap a placed item while in Build Mode to remove it.
            </p>
          )}
        </div>

        {/* ── Island Bridges ────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Island Bridges</div>
              <div className="card-sub">Each friend's world is a separate island.</div>
            </div>
          </div>

          {linkedWorlds.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: unlinked.length ? 12 : 0 }}>
              {linkedWorlds.map(w => (
                <div key={w} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 14,
                  background: "rgba(91,155,138,0.08)", border: "1.5px solid rgba(91,155,138,0.28)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.2rem" }}>🏝</span>
                    <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>{w}</span>
                  </div>
                  <button className="visit-btn" onClick={() => showToast(`Visiting ${w}…`)}>Visit</button>
                </div>
              ))}
            </div>
          )}

          {unlinked.map(f => (
            <div key={f} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderRadius: 14, marginTop: 8,
              background: "rgba(245,235,215,0.5)", border: "1.5px dashed rgba(200,168,100,0.4)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.1rem" }}>🌱</span>
                <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-2)" }}>{f}'s island</span>
              </div>
              <button className="btn-secondary" style={{ fontSize: "0.78rem", padding: "6px 12px" }}
                onClick={() => buildBridge(`${f}'s world`)}>
                Build bridge
              </button>
            </div>
          ))}

          {linkedWorlds.length === 0 && unlinked.length === 0 && (
            <p style={{ color: "var(--text-3)", fontSize: "0.85rem", textAlign: "center", padding: "12px 0" }}>
              Add friends in the Social World to link islands here.
            </p>
          )}
        </div>
      </>)}

      {/* ══════ HOME INTERIOR ════════════════════════════════════ */}
      {view === "interior" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px 14px", background: "var(--panel)" }}>
            <div className="card-title">Home Interior</div>
            <div className="card-sub">Your furniture from the Nest & Nook shop.</div>
          </div>

          <svg viewBox="0 0 360 260" style={{ width: "100%", display: "block" }}>
            {/* Room shell */}
            <rect width={360} height={260} fill="#FFF8F2" />
            {/* Ceiling / wall */}
            <rect x={0} y={0} width={360} height={160} fill="#FDF0DC" />
            {/* Wallpaper dots */}
            {[60,120,180,240,300].flatMap(xi => [50,90,130].map(yi => (
              <circle key={`${xi}-${yi}`} cx={xi} cy={yi} r={2.8} fill="rgba(232,132,90,0.1)" />
            )))}
            {/* Skirting board */}
            <rect x={0} y={153} width={360} height={8} fill="#DEB887" />
            {/* Floor planks */}
            <rect x={0} y={160} width={360} height={100} fill="#D2B48C" />
            {[0,1,2,3,4,5,6,7,8].map(i => (
              <rect key={i} x={i*40} y={160} width={38} height={100} fill="none" stroke="#C9A96E" strokeWidth={0.7} />
            ))}
            {[160,195,230].map(y => (
              <line key={y} x1={0} y1={y} x2={360} y2={y} stroke="#C9A96E" strokeWidth={0.5} />
            ))}
            {/* Window */}
            <rect x={138} y={30} width={84} height={68} rx={5} fill="#B8D4F0" stroke="#8BA8C8" strokeWidth={2} />
            <line x1={180} y1={30} x2={180} y2={98} stroke="#8BA8C8" strokeWidth={1.5} />
            <line x1={138} y1={64} x2={222} y2={64} stroke="#8BA8C8" strokeWidth={1.5} />
            <rect x={138} y={30} width={84} height={16} rx={5} fill="rgba(255,255,255,0.3)" />
            {/* Curtains */}
            <path d="M128,22 C140,50 130,80 142,98" fill="#FBBF9A" stroke="#E8845A" strokeWidth={1.2} />
            <path d="M232,22 C220,50 230,80 218,98" fill="#FBBF9A" stroke="#E8845A" strokeWidth={1.2} />
            <rect x={120} y={18} width={120} height={9} rx={4} fill="#E8845A" />
            {/* Picture frame */}
            <rect x={48} y={38} width={52} height={42} rx={4} fill="#F5DEB3" stroke="#DEB887" strokeWidth={2} />
            <rect x={54} y={44} width={40} height={30} rx={2} fill="#B8D4F0" />
            <ellipse cx={74} cy={59} rx={10} ry={8} fill="#87CEEB" />
            <ellipse cx={74} cy={68} rx={16} ry={6} fill="#A8D8A8" />
            {/* Second frame */}
            <rect x={258} y={42} width={44} height={36} rx={4} fill="#F5DEB3" stroke="#DEB887" strokeWidth={2} />
            <rect x={264} y={48} width={32} height={24} rx={2} fill="#FFCDD2" />
            <circle cx={280} cy={60} r={7} fill="#FF9EBB" />

            {/* Furniture from inventory */}
            {interiorInv.length > 0 ? (
              interiorInv.slice(0,4).map((item, i) => {
                const slots = [{x:180,y:205},{x:80,y:192},{x:292,y:196},{x:180,y:175}];
                const pos = slots[i] ?? {x:180,y:205};
                return <ItemArt key={item.id} type={item.type} x={pos.x} y={pos.y} size={28} />;
              })
            ) : (
              <>
                {/* Placeholder ghost sofa */}
                <g opacity={0.2}>
                  <ItemArt type="sofa" x={180} y={205} size={28} />
                </g>
                <text x={180} y={248} textAnchor="middle" fill="rgba(61,43,31,0.35)" fontSize={9} fontWeight="700" fontFamily="Nunito,sans-serif">
                  Your furniture will appear here
                </text>
              </>
            )}

            {/* Plant in corner */}
            <ItemArt type="fern" x={40} y={168} size={18} />
            <ItemArt type="fern" x={320} y={170} size={16} />
          </svg>

          {/* Furniture list */}
          <div style={{ padding: "14px 22px 22px" }}>
            {interiorInv.length > 0 ? (
              <div className="inventory-grid">
                {interiorInv.map(item => (
                  <div key={item.id} className="inventory-item">
                    <div className="inventory-item-icon" style={{ background: "transparent" }}>
                      <svg viewBox="-30 -30 60 60" width={44} height={44}>
                        <ItemArt type={item.type} x={0} y={0} size={24} />
                      </svg>
                    </div>
                    <div className="inventory-item-name">{item.name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "16px 0" }}>
                <div className="empty-state-text">
                  Buy furniture from <strong>Nest & Nook</strong> in the Social World to furnish your home.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
