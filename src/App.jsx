import { useState, useEffect, useMemo } from "react";
import CharacterView from "./components/CharacterView.jsx";
import LandView from "./components/LandView.jsx";
import RealWorldView from "./components/RealWorldView.jsx";
import SocialView from "./components/SocialView.jsx";
import WellnessView from "./components/WellnessView.jsx";
import { initialActivities, initialJournalEntries } from "./data/seed.js";
import { useDatabaseState } from "./hooks/useDatabaseState.js";
import { EMOTIONS } from "./utils/emotion.js";
import { sfx } from "./lib/sound.js";
import { getWorldMood, getNPCBehavior } from "./lib/journal-ai.js";

// Nav tab definitions with SVG icons
const TABS = [
  {
    id: "wellness",
    label: "Reflect",
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20.94c-6.8-3.6-8-8.54-8-12.54C4 5.18 5.18 4 8 4c1.6 0 3.2.8 4 2 .8-1.2 2.4-2 4-2 2.82 0 4 1.18 4 4.4 0 4-1.2 8.94-8 12.54z"
          fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.25 : 0} />
      </svg>
    )
  },
  {
    id: "land",
    label: "My World",
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
          fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.2 : 0} />
        <path d="M9 21V12h6v9" />
      </svg>
    )
  },
  {
    id: "social",
    label: "The Grove",
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.2 : 0} />
        <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
        <path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.85" />
      </svg>
    )
  },
  {
    id: "realworld",
    label: "Ventures",
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
        <path d="M12 2a14.5 14.5 0 000 20M12 2a14.5 14.5 0 010 20M2 12h20" />
      </svg>
    )
  },
  {
    id: "character",
    label: "My Kin",
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.2 : 0} />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    )
  },
];

const initialLand = {
  character: { x: 52, y: 58, facing: "down", walking: false },
  settings: { joystick: true },
  houses: [
    { id: "h-1", name: "Chief Residence", x: 28, y: 42, level: 2, style: "cottage" },
    { id: "h-2", name: "Quiet Studio",    x: 60, y: 32, level: 1, style: "round" },
    { id: "h-3", name: "Friend Cabin",    x: 72, y: 60, level: 1, style: "glass" }
  ],
  objects: [
    { id: "pond-1",    type: "pond",      x: 42, y: 68 },
    { id: "bench-1",   type: "bench",     x: 64, y: 52 },
    { id: "tree-1",    type: "tree",      x: 18, y: 55 },
    { id: "tree-2",    type: "tree",      x: 78, y: 44 },
    { id: "flower-1",  type: "flower",    x: 35, y: 60 },
    { id: "flower-2",  type: "flower",    x: 50, y: 72 },
  ],
  linkedWorlds: ["Mia's Tea Garden", "Kai's Midnight Studio"]
};

export default function App() {
  const [player, setPlayer] = useDatabaseState("kindred.player", null);
  const [nameInput, setNameInput] = useState("");
  const [tab, setTab] = useDatabaseState("kindred.activeTab", "wellness");
  const [muted, setMuted] = useState(false);

  // Sync mute state to sound library
  useEffect(() => {
    if (sfx && typeof sfx.setMuted === "function") sfx.setMuted(muted);
  }, [muted]);

  function toggleMute() {
    setMuted(m => !m);
    if (!muted) sfx.click?.();
  }
  const [emotion, setEmotion] = useDatabaseState("kindred.emotion", "calm");
  const [coins, setCoins] = useDatabaseState("kindred.coins", 2450);
  const [journalEntries, setJournalEntries] = useDatabaseState("kindred.journal", initialJournalEntries);
  const [character, setCharacter] = useDatabaseState("kindred.character", {
    animal: "fox", skin: "honey", color: "honey",
    outfit: "hoodie", hat: "none", accessory: "scarf",
    glasses: "none", shoes: "sneakers", pattern: "blush",
    furStyle: "soft", emote: "wave", animation: "idle"
  });
  const [inventory, setInventory] = useDatabaseState("kindred.inventory", []);
  const [friends, setFriends] = useDatabaseState("kindred.friends", ["Mia"]);
  const [land, setLand] = useDatabaseState("kindred.land", initialLand);
  const [activities, setActivities] = useDatabaseState("kindred.activities", initialActivities);

  const currentEmotion  = EMOTIONS[emotion] || EMOTIONS.calm;

  // World mood — ambient color and filter applied to the entire game world
  const worldMood = useMemo(() => getWorldMood(emotion), [emotion]);

  // NPC behavior — driven by the player's emotional state + whether they journalled today
  const todayStr       = new Date().toISOString().slice(0, 10);
  const journalledToday = journalEntries.some(e => e.date === todayStr);
  const npcBehavior    = useMemo(
    () => getNPCBehavior(emotion, journalledToday),
    [emotion, journalledToday]
  );

  function enterWorld(event) {
    event.preventDefault();
    const name = nameInput.trim() || "Wanderer";
    setPlayer({
      id: crypto.randomUUID(),
      name,
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    });
  }

  // ── Login / Onboarding screen ──────────────────────────────────
  if (!player) {
    // Floating particles data
    const particles = [
      { size: 8,  top: "18%", left: "12%", color: "rgba(232,132,90,0.4)",  delay: "0s",   dur: "4s"  },
      { size: 5,  top: "35%", left: "88%", color: "rgba(91,155,138,0.5)",  delay: "1.2s", dur: "5s"  },
      { size: 12, top: "72%", left: "8%",  color: "rgba(212,168,83,0.35)", delay: "0.5s", dur: "6s"  },
      { size: 6,  top: "55%", left: "80%", color: "rgba(232,132,90,0.3)",  delay: "2s",   dur: "3.5s"},
      { size: 9,  top: "85%", left: "55%", color: "rgba(91,155,138,0.4)",  delay: "0.8s", dur: "4.5s"},
      { size: 4,  top: "25%", left: "65%", color: "rgba(212,168,83,0.5)",  delay: "1.8s", dur: "5.5s"},
    ];

    return (
      <main className="login-world">
        {/* Illustrated background scene */}
        <div className="login-scene" aria-hidden="true">
          <div className="login-cloud login-cloud-1" />
          <div className="login-cloud login-cloud-2" />
          <div className="login-hill login-hill-1" />
          <div className="login-hill login-hill-2" />

          {/* Floating particles */}
          {particles.map((p, i) => (
            <div
              key={i}
              className="login-particle"
              style={{
                width: p.size, height: p.size,
                top: p.top, left: p.left,
                background: p.color,
                animationDuration: p.dur,
                animationDelay: p.delay,
              }}
            />
          ))}
        </div>

        <section className="login-panel anim-pop-in">
          {/* Brand mark */}
          <div className="login-brand-mark" aria-hidden="true">
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
              <path d="M19 34C11 30 7 24 7 18c0-3.3 1.5-5 4.5-5 1.8 0 3.6.9 4.5 2.2.9-1.3 2.7-2.2 4.5-2.2 3 0 4.5 1.7 4.5 5 0 6-4 12-10.5 16z" fill="rgba(255,255,255,0.92)" />
              <circle cx="12" cy="10" r="3.5" fill="rgba(255,255,255,0.75)" />
              <circle cx="26" cy="10" r="3.5" fill="rgba(255,255,255,0.75)" />
              {/* Sparkle */}
              <circle cx="30" cy="4"  r="1.5" fill="rgba(255,255,255,0.5)" />
              <circle cx="8"  cy="6"  r="1"   fill="rgba(255,255,255,0.4)" />
            </svg>
          </div>

          <h1 className="login-title">Welcome to<br />Kindred</h1>
          <p className="login-sub">Your personal world, your companion, your story.</p>

          {/* Feature pills */}
          <div style={{
            display: "flex", gap: 8, justifyContent: "center",
            flexWrap: "wrap", marginBottom: 28,
          }}>
            {["Journal & reflect", "Build your world", "Connect in The Grove"].map(f => (
              <span key={f} style={{
                padding: "5px 12px", borderRadius: 999,
                background: "rgba(232,132,90,0.1)",
                border: "1px solid rgba(232,132,90,0.2)",
                fontSize: "0.78rem", fontWeight: 700,
                color: "var(--brand)",
              }}>{f}</span>
            ))}
          </div>

          <form className="login-form" onSubmit={enterWorld}>
            <div className="login-input-wrap">
              <input
                className="login-input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="What shall we call you?"
                aria-label="Your name"
                autoFocus
              />
            </div>
            <button className="login-btn" type="submit">
              Begin your journey
            </button>
          </form>

          <p className="login-disclaimer">
            Your world lives in this browser. Add Supabase credentials in <code>.env</code> to sync across devices.
          </p>
        </section>
      </main>
    );
  }

  // ── Main game shell ────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* Top header */}
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 19c-4.4-2.3-6-5.5-6-8 0-2.2 1-3.5 3-3.5 1.1 0 2.2.55 2.75 1.4.55-.85 1.65-1.4 2.75-1.4 2 0 3 1.3 3 3.5 0 2.5-1.6 5.7-6 8z" fill="#fff" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Kindred</div>
            <div className="brand-sub">wellbeing world</div>
          </div>
        </div>

        <div className="top-right">
          {/* Coin display */}
          <div className="coin-display" aria-label={`${coins} coins`}>
            <span className="coin-icon" aria-hidden="true" />
            {coins.toLocaleString()}
          </div>

          {/* Sound toggle */}
          <button
            type="button"
            onClick={toggleMute}
            title={muted ? "Unmute sounds" : "Mute sounds"}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: muted ? "rgba(61,43,31,0.12)" : "rgba(232,132,90,0.15)",
              border: "1.5px solid var(--border)",
              display: "grid", placeItems: "center",
              color: muted ? "var(--text-3)" : "var(--brand)",
              transition: "all 0.18s",
            }}
          >
            {muted ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M9 4L6 7H3v2h3l3 3V4z" fill="currentColor" opacity="0.4"/>
                <path d="M13 5l-4 4M13 9l-4-4"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M9 4L6 7H3v2h3l3 3V4z" fill="currentColor" opacity="0.4"/>
                <path d="M11 5.5a3 3 0 010 5"/>
                <path d="M13 3.5a6 6 0 010 9"/>
              </svg>
            )}
          </button>

          {/* Player chip */}
          <button
            className="player-chip"
            type="button"
            onClick={() => setPlayer(null)}
            title="Sign out"
          >
            <div className="player-avatar-small" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="5" r="3" fill="rgba(255,255,255,0.9)" />
                <path d="M2 12c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            {player.name}
          </button>
        </div>
      </header>

      {/* Main content — tinted by the player's current emotional world mood */}
      <main
        className="main-content"
        style={{
          background:  worldMood.ambient !== "transparent" ? worldMood.ambient : undefined,
          filter:      worldMood.filter  !== "none"        ? worldMood.filter  : undefined,
          transition:  "background 2s ease, filter 2s ease",
        }}
      >
        {tab === "wellness" && (
          <WellnessView
            emotion={emotion}
            setEmotion={setEmotion}
            journalEntries={journalEntries}
            setJournalEntries={setJournalEntries}
            character={character}
            coins={coins}
            setCoins={setCoins}
            player={player}
          />
        )}
        {tab === "land" && (
          <LandView
            emotion={emotion}
            character={character}
            land={land}
            setLand={setLand}
            coins={coins}
            setCoins={setCoins}
            inventory={inventory}
            friends={friends}
          />
        )}
        {tab === "social" && (
          <SocialView
            character={character}
            inventory={inventory}
            setInventory={setInventory}
            friends={friends}
            setFriends={setFriends}
            coins={coins}
            setCoins={setCoins}
            emotion={emotion}
            npcBehavior={npcBehavior}
            journalledToday={journalledToday}
          />
        )}
        {tab === "realworld" && (
          <RealWorldView
            emotion={emotion}
            character={character}
            activities={activities}
            setActivities={setActivities}
          />
        )}
        {tab === "character" && (
          <CharacterView
            emotion={emotion}
            character={character}
            setCharacter={setCharacter}
          />
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="bottom-nav" aria-label="Main navigation">
        {TABS.map(({ id, label, icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              className={`nav-tab${active ? " active" : ""}`}
              type="button"
              onClick={() => { if (!active) { sfx.click?.(); setTab(id); } }}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              {icon(active)}
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
