import LanternfallScene from "../home/LanternfallScene.jsx";
import { deriveHomeState } from "../home/deriveHomeState.js";
import { getAvatarSpot } from "../home/avatarSpot.js";
import AvatarStage from "../avatar/AvatarStage.jsx";

export default function HomeView({
  player, character, emotion, coins, journalEntries,
  setTab, muted, toggleMute, onOpenSettings, onOpenUser,
}) {
  const { sky, lanternsLit, streak } = deriveHomeState(journalEntries ?? [], player);
  const spot = getAvatarSpot(sky);
  // Base render box for the avatar overlay, scaled by the mood's spot.scale
  // and expressed in the SAME 1280x605 design-canvas percentage space the
  // rest of Home is laid out in (see hooks/useStageScale.js), so it never
  // drifts from the SVG scene it sits on top of.
  const avatarW = 220 * spot.scale;
  const avatarH = 300 * spot.scale;

  return (
    <div className="home-world">
      {/* ── Lanternfall — one illustrated scene, no page scroll, fills the
          fixed 1280x605 design canvas edge to edge. ── */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <LanternfallScene sky={sky} lanternsLit={lanternsLit} />
      </div>

      {/* ── The real 3D Grove avatar, composited over the SVG scene at the
          doorstep / window / path spot for this mood. ── */}
      <div
        style={{
          position: "absolute",
          left: `${(spot.x / 1280) * 100}%`,
          top: `${(spot.y / 605) * 100}%`,
          transform: "translate(-50%, -100%)",
          zIndex: 1,
          pointerEvents: "none",
          filter: spot.silhouette ? "brightness(0) opacity(0.82)" : undefined,
        }}
      >
        <AvatarStage
          character={character}
          clip={spot.emotion}
          angle={sky === "flourishing" ? -0.5 : 0.3}
          size={{ width: avatarW, height: avatarH }}
        />
      </div>

      {/* ── HUD top-left: streak + coins ── */}
      <div className="home-hud-left">
        <div className="home-badge home-badge-fire">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2c0 6-8 8-8 14a8 8 0 0016 0c0-6-8-8-8-14z" fill="#FF5820"/>
            <path d="M12 8c0 4-4 5.5-4 8a4 4 0 008 0c0-2.5-4-4-4-8z" fill="#FFAA20"/>
          </svg>
          <span>{streak}</span>
        </div>
        <div className="home-badge home-badge-coin">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="6.5" fill="#C88A08"/>
            <circle cx="7" cy="7" r="5"   fill="#F0C030"/>
          </svg>
          <span>{(coins ?? 0).toLocaleString()}</span>
        </div>
      </div>

      {/* ── Top-right: user, language, sound, settings ── */}
      <div className="home-top-settings">
        <button type="button" className="home-top-btn" aria-label="My profile" onClick={onOpenUser} style={{fontFamily:"var(--font-game)",fontSize:"0.6rem",color:"#fff",letterSpacing:"0.3px"}}>
          {player?.name?.slice(0,2).toUpperCase() || "ME"}
        </button>
        <button type="button" className="home-top-btn" aria-label="Language">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 3a14.5 14.5 0 000 18M3 12h18"/>
          </svg>
        </button>
        <button type="button" className="home-top-btn" aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" opacity="0.5"/>
              <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" opacity="0.5"/>
              <path d="M15.54 8.46a5 5 0 010 7.07"/>
              <path d="M19.07 4.93a10 10 0 010 14.14"/>
            </svg>
          )}
        </button>
        <button type="button" className="home-top-btn" aria-label="Settings" onClick={onOpenSettings}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* ── Wardrobe + Characters ── */}
      <div className="home-char-side-btns">
        <button type="button" className="home-char-side-btn" onClick={() => setTab("wardrobe")} aria-label="Wardrobe">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.38 18H3.62a1 1 0 01-.84-1.54L12 4l9.22 12.46A1 1 0 0120.38 18z"/>
            <circle cx="12" cy="4" r="2" fill="currentColor" opacity="0.4"/>
          </svg>
          <span>WARDROBE</span>
        </button>
        <button type="button" className="home-char-side-btn" onClick={() => setTab("wardrobe")} aria-label="Characters">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="7" r="4" fill="currentColor" opacity="0.25"/>
            <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
            <path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.85"/>
          </svg>
          <span>CHARACTERS</span>
        </button>
      </div>
    </div>
  );
}
