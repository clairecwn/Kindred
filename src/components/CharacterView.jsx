import { useState } from "react";
import Animal3D from "./Animal3D.jsx";

// ── Roster — each animal has a lore name, role and rarity ────────
const ROSTER = [
  { id: "fox",    name: "Ember Kit",    role: "Swift Trickster",  rarity: "rare",      desc: "Quick, bright, endlessly expressive." },
  { id: "rabbit", name: "Mochi Hop",    role: "Gentle Soul",      rarity: "common",    desc: "Alert, warm, and loves a good nap." },
  { id: "bear",   name: "Bramble Cub",  role: "Steady Guardian",  rarity: "rare",      desc: "Quiet strength wrapped in cozy fur." },
  { id: "cat",    name: "Nori",         role: "Curious Wanderer", rarity: "epic",      desc: "Stylish, composed, perpetually intrigued." },
  { id: "dog",    name: "Pip Pup",      role: "Loyal Companion",  rarity: "common",    desc: "Boundless warmth. Will always show up." },
  { id: "panda",  name: "Bamboo Bean",  role: "Dreamy Scholar",   rarity: "legendary", desc: "Sleepy genius. Moves at their own pace." },
];

const RARITY_COLOR = {
  common:    "#8A9BAA",
  rare:      "#5B9B8A",
  epic:      "#9B72CF",
  legendary: "#D4A853",
};

// ── Customisation options ────────────────────────────────────────
const SKINS = [
  { id: "honey",  label: "Honey",  color: "#F2B66D" },
  { id: "ivory",  label: "Ivory",  color: "#F4DCC4" },
  { id: "mint",   label: "Mint",   color: "#82C9A0" },
  { id: "berry",  label: "Berry",  color: "#CF7AA4" },
  { id: "sky",    label: "Sky",    color: "#83AEE8" },
  { id: "cocoa",  label: "Cocoa",  color: "#9B7256" },
  { id: "slate",  label: "Slate",  color: "#738392" },
];

const OUTFITS = [
  { id: "none",      label: "Default",   icon: "✦", premium: false },
  { id: "hoodie",    label: "Hoodie",    icon: "🧥", premium: false },
  { id: "jacket",    label: "Jacket",    icon: "🧣", premium: false },
  { id: "overalls",  label: "Overalls",  icon: "👕", premium: false },
  { id: "kimono",    label: "Kimono",    icon: "🩱", premium: false },
  { id: "explorer",  label: "Explorer",  icon: "🎒", premium: true  },
];

const HATS = [
  { id: "none",   label: "Bareheaded", icon: "○",  premium: false },
  { id: "beanie", label: "Beanie",     icon: "🎩", premium: false },
  { id: "hat",    label: "Felt Hat",   icon: "🎩", premium: false },
  { id: "crown",  label: "Crown",      icon: "👑", premium: true  },
];

const GLASSES = [
  { id: "none",  label: "None",   icon: "○",  premium: false },
  { id: "round", label: "Round",  icon: "🕶", premium: false },
  { id: "star",  label: "Star",   icon: "⭐", premium: true  },
];

const ACCESSORIES = [
  { id: "none",    label: "None",      icon: "○",  premium: false },
  { id: "scarf",   label: "Scarf",     icon: "🧣", premium: false },
  { id: "satchel", label: "Satchel",   icon: "👝", premium: false },
  { id: "heart",   label: "Heart Pin", icon: "♥",  premium: false },
];

const SHOES = [
  { id: "none",     label: "Barefoot", icon: "○",  premium: false },
  { id: "sneakers", label: "Sneakers", icon: "👟", premium: false },
  { id: "sandals",  label: "Sandals",  icon: "👡", premium: false },
  { id: "boots",    label: "Boots",    icon: "🥾", premium: true  },
];

const PATTERNS = [
  { id: "none",  label: "Plain",  icon: "○"  },
  { id: "blush", label: "Blush",  icon: "◡◡" },
  { id: "spots", label: "Spots",  icon: "···" },
];

const FUR = [
  { id: "soft",   label: "Soft",   icon: "〜" },
  { id: "spiky",  label: "Spiky",  icon: "↑↑" },
  { id: "tufted", label: "Tufted", icon: "ↈ"  },
];

const EMOTES = [
  { id: "wave",  label: "Wave",    icon: "◟" },
  { id: "heart", label: "Heart",   icon: "♥" },
  { id: "nod",   label: "Nod",     icon: "↕" },
];

const ANIM = [
  { id: "idle",  label: "Idle",  icon: "⊙" },
  { id: "dance", label: "Dance", icon: "♪" },
];

const CATEGORIES = [
  { id: "roster",      label: "Character" },
  { id: "skins",       label: "Skin Tone" },
  { id: "outfits",     label: "Outfit" },
  { id: "hats",        label: "Headwear" },
  { id: "accessories", label: "Accessories" },
  { id: "shoes",       label: "Shoes" },
  { id: "markings",    label: "Markings" },
  { id: "emotes",      label: "Emotes" },
];

export default function CharacterView({ emotion, character, setCharacter }) {
  const [cat, setCat] = useState("roster");

  function patch(key, value) {
    setCharacter((c) => ({ ...c, [key]: value }));
  }

  const currentAnimal = ROSTER.find((r) => r.id === character.animal) ?? ROSTER[0];

  return (
    <div className="page-container anim-fade-in">
      {/* ── Top preview section (large 3D character + info) ──── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* 3D Character stage */}
        <div className="character-stage-wrap" style={{ height: 320 }}>
          <Animal3D emotion={emotion} {...character} interactive />
          <div className="stage-hint">Drag to rotate</div>
        </div>

        {/* Character info panel */}
        <div className="card" style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{
                background: RARITY_COLOR[currentAnimal.rarity] + "22",
                color: RARITY_COLOR[currentAnimal.rarity],
                fontSize: "0.7rem", fontWeight: 800,
                padding: "3px 10px", borderRadius: 999,
                textTransform: "capitalize"
              }}>
                {currentAnimal.rarity}
              </span>
            </div>
            <div style={{ fontSize: "1.55rem", fontWeight: 900, color: "var(--text)", lineHeight: 1.15, marginBottom: 4 }}>
              {currentAnimal.name}
            </div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--brand)", marginBottom: 12 }}>
              {currentAnimal.role}
            </div>
            <p style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.55 }}>
              {currentAnimal.desc}
            </p>
          </div>

          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {EMOTES.map((e) => (
                <button
                  key={e.id}
                  className={`chip${character.emote === e.id ? " active" : ""}`}
                  style={{ flex: 1, textAlign: "center" }}
                  onClick={() => patch("emote", e.id)}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {ANIM.map((a) => (
                <button
                  key={a.id}
                  className={`chip${character.animation === a.id ? " active" : ""}`}
                  style={{ flex: 1, textAlign: "center" }}
                  onClick={() => patch("animation", a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Category tab bar ──────────────────────────────────── */}
      <div className="cat-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`cat-tab${cat === c.id ? " active" : ""}`}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* ── Roster tab ───────────────────────────────────────── */}
      {cat === "roster" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Choose Your Kin</div>
              <div className="card-sub">Each companion has their own spirit. Find your match.</div>
            </div>
          </div>
          <div className="roster-grid">
            {ROSTER.map((r) => (
              <button
                key={r.id}
                className={`roster-card${character.animal === r.id ? " active" : ""}`}
                onClick={() => patch("animal", r.id)}
              >
                {/* Mini 3D preview would go here — using a styled placeholder */}
                <div className="card-animal-preview" style={{
                  background: `linear-gradient(135deg, ${RARITY_COLOR[r.rarity]}22, ${RARITY_COLOR[r.rarity]}11)`,
                  border: `2px solid ${RARITY_COLOR[r.rarity]}44`,
                  fontSize: "2rem"
                }}>
                  {r.id === "fox" ? "🦊" : r.id === "rabbit" ? "🐰" : r.id === "bear" ? "🐻" :
                   r.id === "cat" ? "🐱" : r.id === "dog" ? "🐶" : "🐼"}
                </div>
                <strong>{r.name}</strong>
                <span style={{
                  fontSize: "0.68rem", fontWeight: 800, color: RARITY_COLOR[r.rarity],
                  textTransform: "capitalize"
                }}>
                  {r.rarity}
                </span>
                <small>{r.role}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Skin tab ─────────────────────────────────────────── */}
      {cat === "skins" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Fur Colour</div>
              <div className="card-sub">All tones are free.</div>
            </div>
          </div>
          <div className="swatch-row">
            {SKINS.map((s) => (
              <button
                key={s.id}
                className={`swatch${(character.skin ?? character.color) === s.id ? " active" : ""}`}
                style={{ "--swatch-color": s.color }}
                onClick={() => patch("skin", s.id)}
                title={s.label}
                aria-label={s.label}
              />
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="section-label">Pattern</div>
            <div className="chip-row">
              {PATTERNS.map((p) => (
                <button
                  key={p.id}
                  className={`chip${character.pattern === p.id ? " active" : ""}`}
                  onClick={() => patch("pattern", p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="section-label">Fur Style</div>
            <div className="chip-row">
              {FUR.map((f) => (
                <button
                  key={f.id}
                  className={`chip${character.furStyle === f.id ? " active" : ""}`}
                  onClick={() => patch("furStyle", f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Outfit tab ───────────────────────────────────────── */}
      {cat === "outfits" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Wardrobe</div>
              <div className="card-sub">Most pieces are free. Premium marked with a badge.</div>
            </div>
          </div>
          <div className="item-grid">
            {OUTFITS.map((o) => (
              <button
                key={o.id}
                className={`item-card${character.outfit === o.id ? " active" : ""}`}
                onClick={() => patch("outfit", o.id)}
              >
                {o.premium && <span className="item-premium-badge">Coins</span>}
                <div className="item-card-icon">{o.icon}</div>
                <div className="item-card-name">{o.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Hats tab ─────────────────────────────────────────── */}
      {cat === "hats" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Headwear</div>
              <div className="card-sub">Express yourself from the top down.</div>
            </div>
          </div>
          <div className="item-grid">
            {HATS.map((h) => (
              <button
                key={h.id}
                className={`item-card${character.hat === h.id ? " active" : ""}`}
                onClick={() => patch("hat", h.id)}
              >
                {h.premium && <span className="item-premium-badge">Coins</span>}
                <div className="item-card-icon">{h.icon}</div>
                <div className="item-card-name">{h.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Accessories tab ──────────────────────────────────── */}
      {cat === "accessories" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Accessories</div>
              <div className="card-sub">Small details, big character.</div>
            </div>
          </div>
          <div className="item-grid">
            {ACCESSORIES.map((a) => (
              <button
                key={a.id}
                className={`item-card${character.accessory === a.id ? " active" : ""}`}
                onClick={() => patch("accessory", a.id)}
              >
                {a.premium && <span className="item-premium-badge">Coins</span>}
                <div className="item-card-icon">{a.icon}</div>
                <div className="item-card-name">{a.label}</div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="section-label">Glasses</div>
            <div className="item-grid">
              {GLASSES.map((g) => (
                <button
                  key={g.id}
                  className={`item-card${character.glasses === g.id ? " active" : ""}`}
                  onClick={() => patch("glasses", g.id)}
                >
                  {g.premium && <span className="item-premium-badge">Coins</span>}
                  <div className="item-card-icon">{g.icon}</div>
                  <div className="item-card-name">{g.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Shoes tab ────────────────────────────────────────── */}
      {cat === "shoes" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Footwear</div>
              <div className="card-sub">Every step counts.</div>
            </div>
          </div>
          <div className="item-grid">
            {SHOES.map((s) => (
              <button
                key={s.id}
                className={`item-card${character.shoes === s.id ? " active" : ""}`}
                onClick={() => patch("shoes", s.id)}
              >
                {s.premium && <span className="item-premium-badge">Coins</span>}
                <div className="item-card-icon">{s.icon}</div>
                <div className="item-card-name">{s.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Markings tab ─────────────────────────────────────── */}
      {cat === "markings" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Markings &amp; Style</div>
              <div className="card-sub">Make your companion unmistakably yours.</div>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div className="section-label">Fur Pattern</div>
            <div className="chip-row">
              {PATTERNS.map((p) => (
                <button
                  key={p.id}
                  className={`chip${character.pattern === p.id ? " active" : ""}`}
                  onClick={() => patch("pattern", p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="section-label">Fur Texture</div>
            <div className="chip-row">
              {FUR.map((f) => (
                <button
                  key={f.id}
                  className={`chip${character.furStyle === f.id ? " active" : ""}`}
                  onClick={() => patch("furStyle", f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Emotes tab ───────────────────────────────────────── */}
      {cat === "emotes" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Emotes &amp; Animations</div>
              <div className="card-sub">Express yourself in the world.</div>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div className="section-label">Emote</div>
            <div className="item-grid">
              {EMOTES.map((e) => (
                <button
                  key={e.id}
                  className={`item-card${character.emote === e.id ? " active" : ""}`}
                  onClick={() => patch("emote", e.id)}
                >
                  <div className="item-card-icon" style={{ fontSize: "1.4rem" }}>{e.icon}</div>
                  <div className="item-card-name">{e.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="section-label">Idle Animation</div>
            <div className="chip-row">
              {ANIM.map((a) => (
                <button
                  key={a.id}
                  className={`chip${character.animation === a.id ? " active" : ""}`}
                  onClick={() => patch("animation", a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
