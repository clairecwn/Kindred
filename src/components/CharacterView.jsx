import { useMemo, useState } from "react";
import AvatarStage from "../avatar/AvatarStage.jsx";
import { SPECIES_LIST, SPECIES_NAME, getPersonality, COLOURWAYS } from "../avatar/index.js";
import "../avatar/avatar.css";

// ── Customisation options (ids match src/avatar/adapter.js's legacy maps) ──
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

const BOTTOMS = [
  { id: "none",     label: "Bare",     icon: "○",  premium: false },
  { id: "shorts",   label: "Shorts",   icon: "▭",  premium: false },
  { id: "trousers", label: "Trousers", icon: "⌷",  premium: false },
  { id: "skirt",    label: "Skirt",    icon: "△",  premium: false },
  { id: "leggings", label: "Leggings", icon: "‖",  premium: false },
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
  { id: "bottoms",     label: "Bottoms" },
  { id: "colours",     label: "Colour" },
  { id: "hats",        label: "Headwear" },
  { id: "accessories", label: "Accessories" },
  { id: "shoes",       label: "Shoes" },
  { id: "markings",    label: "Markings" },
  { id: "emotes",      label: "Emotes" },
];

/** Item tile: a swatch/icon button that also previews live on hover. */
function ItemTile({ item, active, onSelect, onHover }) {
  return (
    <button
      className={`item-card${active ? " active" : ""}`}
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={() => onHover(null)}
      onFocus={onHover}
      onBlur={() => onHover(null)}
    >
      {item.premium && <span className="item-premium-badge">Coins</span>}
      <div className="item-card-icon">{item.icon}</div>
      <div className="item-card-name">{item.label}</div>
    </button>
  );
}

export default function CharacterView({ emotion, character, setCharacter }) {
  const [cat, setCat] = useState("roster");
  const [hoverPatch, setHoverPatch] = useState(null); // {key, value} | null
  const [reactKey, setReactKey] = useState(0);

  function patch(key, value) {
    setCharacter((c) => ({ ...c, [key]: value }));
    setReactKey((k) => k + 1);
  }

  function hover(key, value) {
    return (eOrNull) => {
      if (eOrNull === null) { setHoverPatch(null); return; }
      setHoverPatch({ key, value });
    };
  }

  const speciesId = SPECIES_LIST.includes(character.animal) ? character.animal : "bear";
  const personality = getPersonality(speciesId);
  const speciesName = SPECIES_NAME[speciesId] ?? speciesId;

  // The hero preview shows the live shared descriptor, with a hovered item's
  // effect temporarily overlaid — never a second copy of state, just a
  // display-only merge of the one source of truth.
  const previewCharacter = useMemo(
    () => (hoverPatch ? { ...character, [hoverPatch.key]: hoverPatch.value } : character),
    [character, hoverPatch]
  );

  return (
    <div className="page-container anim-fade-in">
      {/* ── Top preview section (large 3D hero + info) ──────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* Hero 3D stage — idles per personality, reacts on any change */}
        <div className="character-stage-wrap" style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AvatarStage
            character={previewCharacter}
            clip={personality.idleEmotion}
            reactKey={reactKey}
            reactClip={personality.reactionClip}
            angle={0.4}
            size={{ width: 240, height: 300 }}
          />
        </div>

        {/* Character info panel */}
        <div className="card" style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{
                background: "var(--brand)22", color: "var(--brand)",
                fontSize: "0.7rem", fontWeight: 800,
                padding: "3px 10px", borderRadius: 999,
              }}>
                {personality.temperament}
              </span>
            </div>
            <div style={{ fontSize: "1.55rem", fontWeight: 900, color: "var(--text)", lineHeight: 1.15, marginBottom: 4 }}>
              {speciesName}
            </div>
            <p style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.55 }}>
              {personality.line}
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

      {/* ── Roster tab: a live 3D thumbnail per species, Brawl-Stars-style ── */}
      {cat === "roster" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Choose Your Kin</div>
              <div className="card-sub">Each companion has their own spirit. Find your match.</div>
            </div>
          </div>
          <div className="roster-grid">
            {SPECIES_LIST.map((id) => {
              const p = getPersonality(id);
              const rosterDescriptor = { ...character, animal: id };
              return (
                <button
                  key={id}
                  className={`roster-card${speciesId === id ? " active" : ""}`}
                  onClick={() => patch("animal", id)}
                >
                  <div className="card-animal-preview">
                    <AvatarStage character={rosterDescriptor} clip={p.idleEmotion} angle={0.4} size={84} static />
                  </div>
                  <strong>{SPECIES_NAME[id]}</strong>
                  <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--brand)" }}>
                    {p.temperament}
                  </span>
                  <small>{p.line}</small>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Skin tab ─────────────────────────────────────────── */}
      {cat === "skins" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Fur Colour</div>
              <div className="card-sub">All tones are free. Hover to preview.</div>
            </div>
          </div>
          <div className="swatch-row">
            {SKINS.map((s) => (
              <button
                key={s.id}
                className={`swatch${(character.skin ?? character.color) === s.id ? " active" : ""}`}
                style={{ "--swatch-color": s.color }}
                onClick={() => patch("skin", s.id)}
                onMouseEnter={hover("skin", s.id)}
                onMouseLeave={hover("skin", null)}
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
              <div className="card-sub">Most pieces are free. Premium marked with a badge. Hover to preview.</div>
            </div>
          </div>
          <div className="item-grid">
            {OUTFITS.map((o) => (
              <ItemTile key={o.id} item={o} active={character.outfit === o.id}
                onSelect={() => patch("outfit", o.id)} onHover={hover("outfit", o.id)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Bottoms tab ──────────────────────────────────────── */}
      {cat === "bottoms" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Bottoms</div>
              <div className="card-sub">Real 3D garments, weighted to the same skeleton as your kin.</div>
            </div>
          </div>
          <div className="item-grid">
            {BOTTOMS.map((b) => (
              <ItemTile key={b.id} item={b} active={(character.bottoms ?? "none") === b.id}
                onSelect={() => patch("bottoms", b.id)} onHover={hover("bottoms", b.id)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Colourway tab ────────────────────────────────────── */}
      {cat === "colours" && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Colourway</div>
              <div className="card-sub">One colour set across everything you are wearing.</div>
            </div>
          </div>
          <div className="item-grid">
            {COLOURWAYS.map((cw) => (
              <ItemTile
                key={cw.id}
                item={{
                  id: cw.id,
                  label: cw.name,
                  icon: <span className="colourway-swatch" style={{
                    background: `#${cw.main.toString(16).padStart(6, "0")}`,
                    borderColor: `#${cw.trim.toString(16).padStart(6, "0")}`,
                  }} />,
                  premium: false,
                }}
                active={(character.colourway ?? "") === cw.id}
                onSelect={() => patch("colourway", cw.id)}
                onHover={hover("colourway", cw.id)}
              />
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
              <ItemTile key={h.id} item={h} active={character.hat === h.id}
                onSelect={() => patch("hat", h.id)} onHover={hover("hat", h.id)} />
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
              <ItemTile key={a.id} item={a} active={character.accessory === a.id}
                onSelect={() => patch("accessory", a.id)} onHover={hover("accessory", a.id)} />
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="section-label">Glasses</div>
            <div className="item-grid">
              {GLASSES.map((g) => (
                <ItemTile key={g.id} item={g} active={character.glasses === g.id}
                  onSelect={() => patch("glasses", g.id)} onHover={hover("glasses", g.id)} />
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
              <ItemTile key={s.id} item={s} active={character.shoes === s.id}
                onSelect={() => patch("shoes", s.id)} onHover={hover("shoes", s.id)} />
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
                <ItemTile key={e.id} item={e} active={character.emote === e.id}
                  onSelect={() => patch("emote", e.id)} onHover={() => {}} />
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
