import { useState } from "react";

// ── SVG icon set (no emoji, per design bible) ─────────────────────────────
function IconAccessibility() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="3" r="1.5" />
      <path d="M5 6.5h6M8 6.5v6M5.5 12.5l2.5-3 2.5 3" />
    </svg>
  );
}
function IconSound() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3.5L5.5 6.5H3v3h2.5L9 12.5V3.5z" fill="currentColor" fillOpacity="0.3" />
      <path d="M11.2 5.3a3.5 3.5 0 010 5.4" />
      <path d="M13 3.5a6 6 0 010 9" />
    </svg>
  );
}
function IconDisplay() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="9" rx="1.5" />
      <path d="M5.5 15h5M8 12v3" />
      <circle cx="8" cy="7.5" r="2" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}
function IconPrivacy() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L3 4v4.5c0 3 2.2 5.5 5 6 2.8-.5 5-3 5-6V4L8 1.5z" fill="currentColor" fillOpacity="0.15" />
      <path d="M5.5 8.5l1.5 1.5 3.5-3.5" />
    </svg>
  );
}
function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.5v4M8 5.5v.5" />
    </svg>
  );
}

// ── Reusable toggle component ─────────────────────────────────────────────
function Toggle({ id, checked, onChange, label, desc }) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-row-label">{label}</div>
        {desc && <div className="settings-row-desc">{desc}</div>}
      </div>
      <label className="toggle-wrap" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          className="toggle-input"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          aria-label={label}
        />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}

// ── Chip selector ────────────────────────────────────────────────────────
function ChipGroup({ value, onChange, options, label, desc }) {
  return (
    <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
      <div>
        <div className="settings-row-label">{label}</div>
        {desc && <div className="settings-row-desc">{desc}</div>}
      </div>
      <div className="option-chips" role="group" aria-label={label}>
        {options.map(opt => (
          <button
            key={opt.value}
            className={`option-chip${value === opt.value ? " active" : ""}`}
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            type="button"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Volume slider ─────────────────────────────────────────────────────────
function VolumeRow({ id, value, onChange, label, desc }) {
  return (
    <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
        <div>
          <div className="settings-row-label">{label}</div>
          {desc && <div className="settings-row-desc">{desc}</div>}
        </div>
        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-3)", alignSelf: "center" }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="settings-slider"
        style={{ maxWidth: "100%", width: "100%" }}
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        aria-label={label}
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────
function Section({ icon, title, children }) {
  return (
    <section className="settings-section" aria-labelledby={`section-${title.replace(/\s/g, "-").toLowerCase()}`}>
      <div className="settings-section-title" id={`section-${title.replace(/\s/g, "-").toLowerCase()}`}>
        <span aria-hidden="true">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SettingsPanel — diegetic cork-board in the player's home
// ═══════════════════════════════════════════════════════════════════════════
export default function SettingsPanel({ player, onClose }) {
  // ── Accessibility ─────────────────────────────────────────────────────
  const [textSize, setTextSize]     = useState("100");
  const [colorblind, setColorblind] = useState("none");
  const [highContrast, setHigh]     = useState(false);
  const [reducedMotion, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [captions, setCaptions]     = useState(false);

  // ── Sound ─────────────────────────────────────────────────────────────
  const [musicVol, setMusicVol]     = useState(0.6);
  const [sfxVol, setSfxVol]         = useState(0.75);
  const [ambientOn, setAmbientOn]   = useState(true);

  // ── Display ───────────────────────────────────────────────────────────
  const [timeOverride, setTimeOverride] = useState("auto");
  const [seasonOverride, setSeasonOverride] = useState("auto");

  // ── Privacy ───────────────────────────────────────────────────────────
  const [sharePresence, setSharePresence]   = useState(true);
  const [showEmotion, setShowEmotion]       = useState(false);
  const [analyticsOn, setAnalyticsOn]       = useState(true);

  // Apply accessibility changes to document
  function applyTextSize(size) {
    setTextSize(size);
    document.documentElement.style.fontSize = size === "100" ? "" : `${parseInt(size) / 100}rem`;
  }

  function applyColorblind(mode) {
    setColorblind(mode);
    document.documentElement.dataset.colorblind = mode === "none" ? "" : mode;
  }

  function applyHighContrast(on) {
    setHigh(on);
    document.documentElement.dataset.contrast = on ? "high" : "";
  }

  function applyReducedMotion(on) {
    setReduced(on);
    document.documentElement.dataset.reducedMotion = on ? "true" : "";
  }

  function applyTimeOverride(val) {
    setTimeOverride(val);
    if (val !== "auto") {
      document.documentElement.dataset.time = val;
    } else {
      // Revert to real time — useDayNight will re-apply on next tick
      delete document.documentElement.dataset.time;
    }
  }

  return (
    <div className="settings-board page-enter" role="main" aria-label="Settings">
      {/* Header — felt like a home bulletin board */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 className="settings-title">Your Board</h1>
          <p className="settings-sub">
            Make Kindred feel like home. All settings are saved automatically.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: "var(--panel)", border: "1.5px solid var(--border)",
              display: "grid", placeItems: "center",
              color: "var(--text-2)", flexShrink: 0,
              transition: "background 150ms",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Accessibility ──────────────────────────────────────────────── */}
      <Section icon={<IconAccessibility />} title="Accessibility">
        <ChipGroup
          label="Text size"
          desc="Affects all text across Kindred"
          value={textSize}
          onChange={applyTextSize}
          options={[
            { label: "100%", value: "100" },
            { label: "125%", value: "125" },
            { label: "150%", value: "150" },
          ]}
        />

        <ChipGroup
          label="Color vision"
          desc="Adjusts palette for color vision differences"
          value={colorblind}
          onChange={applyColorblind}
          options={[
            { label: "Default",      value: "none"          },
            { label: "Deuteranopia", value: "deuteranopia"  },
            { label: "Protanopia",   value: "protanopia"    },
            { label: "Tritanopia",   value: "tritanopia"    },
          ]}
        />

        <Toggle
          id="high-contrast"
          label="High contrast"
          desc="Increases border and text contrast throughout"
          checked={highContrast}
          onChange={applyHighContrast}
        />

        <Toggle
          id="reduced-motion"
          label="Reduced motion"
          desc="Minimizes all animations and transitions"
          checked={reducedMotion}
          onChange={applyReducedMotion}
        />

        <Toggle
          id="captions"
          label="Captions & subtitles"
          desc="Shows text descriptions for ambient sounds and music"
          checked={captions}
          onChange={setCaptions}
        />
      </Section>

      {/* ── Sound ─────────────────────────────────────────────────────── */}
      <Section icon={<IconSound />} title="Sound">
        <Toggle
          id="ambient-on"
          label="Ambient music"
          desc="Soft looping music that matches your world's mood"
          checked={ambientOn}
          onChange={setAmbientOn}
        />

        <VolumeRow
          id="music-vol"
          label="Music volume"
          value={musicVol}
          onChange={setMusicVol}
        />

        <VolumeRow
          id="sfx-vol"
          label="Sound effects"
          desc="Gentle clicks, chimes, and world sounds"
          value={sfxVol}
          onChange={setSfxVol}
        />
      </Section>

      {/* ── Display ───────────────────────────────────────────────────── */}
      <Section icon={<IconDisplay />} title="Display">
        <ChipGroup
          label="Time of day"
          desc="Override the automatic day/night cycle"
          value={timeOverride}
          onChange={applyTimeOverride}
          options={[
            { label: "Auto",      value: "auto"      },
            { label: "Dawn",      value: "dawn"      },
            { label: "Morning",   value: "morning"   },
            { label: "Afternoon", value: "afternoon" },
            { label: "Evening",   value: "evening"   },
            { label: "Night",     value: "night"     },
          ]}
        />

        <ChipGroup
          label="Season"
          desc="The season shapes your world's palette and decorations"
          value={seasonOverride}
          onChange={val => {
            setSeasonOverride(val);
            if (val !== "auto") {
              document.documentElement.dataset.season = val;
            }
          }}
          options={[
            { label: "Auto",   value: "auto"   },
            { label: "Spring", value: "spring" },
            { label: "Summer", value: "summer" },
            { label: "Autumn", value: "autumn" },
            { label: "Winter", value: "winter" },
          ]}
        />
      </Section>

      {/* ── Privacy ───────────────────────────────────────────────────── */}
      <Section icon={<IconPrivacy />} title="Privacy">
        <Toggle
          id="share-presence"
          label="Show me as present"
          desc="Friends can see when you're exploring Kindred"
          checked={sharePresence}
          onChange={setSharePresence}
        />

        <Toggle
          id="show-emotion"
          label="Share current mood"
          desc="Your visible emotion orb in shared spaces. Only you see your journal."
          checked={showEmotion}
          onChange={setShowEmotion}
        />

        <Toggle
          id="analytics"
          label="Wellness insights"
          desc="Anonymised patterns help us improve Kindred's wellbeing features"
          checked={analyticsOn}
          onChange={setAnalyticsOn}
        />
      </Section>

      {/* ── About ─────────────────────────────────────────────────────── */}
      <Section icon={<IconInfo />} title="About">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Kindred</div>
            <div className="settings-row-desc">Version 1.0 · Built with care</div>
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-3)", fontWeight: 600 }}>
            v1.0.0
          </div>
        </div>

        <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
          <div className="settings-row-label">Design principles</div>
          <ul style={{
            listStyle: "none", display: "flex", flexDirection: "column", gap: 6,
            paddingLeft: 0, width: "100%",
          }}>
            {[
              "No FOMO mechanics — your absence is always okay",
              "No leaderboards or player comparisons",
              "Your journal is private and never shared",
              "Forgiveness built in — all actions are undoable",
              "No predatory monetisation, ever",
            ].map(principle => (
              <li key={principle} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                fontSize: "0.82rem", color: "var(--text-2)", fontWeight: 500,
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--brand-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M2.5 7.5l3 3 6-6" />
                </svg>
                {principle}
              </li>
            ))}
          </ul>
        </div>

        {player && (
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Signed in as</div>
              <div className="settings-row-desc">{player.name}</div>
            </div>
          </div>
        )}
      </Section>

      {/* Breathing room at bottom */}
      <div style={{ height: 16 }} aria-hidden="true" />
    </div>
  );
}
