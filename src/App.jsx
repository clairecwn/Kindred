import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CharacterView from "./components/CharacterView.jsx";
import LandView from "./components/LandView.jsx";
import RealWorldView from "./components/RealWorldView.jsx";
import SocialView from "./components/SocialView.jsx";
import WellnessView from "./components/WellnessView.jsx";
import HomeView from "./components/HomeView.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import { initialActivities, initialJournalEntries } from "./data/seed.js";
import { useDatabaseState } from "./hooks/useDatabaseState.js";
import { isSupabaseConfigured, supabase } from "./lib/supabase.js";
import { useSession } from "./lib/SessionProvider.jsx";
import { sfx } from "./lib/sound.js";
import { getWorldMood, getNPCBehavior } from "./lib/journal-ai.js";
import { ambientPlayer } from "./lib/ambient-audio.js";

// ── Global nav pills — order: HOME, REFLECT, KINGDOM, GROVE, VENTURES ─────────
const NAV_PILLS = [
  {
    id: "home", label: "HOME", bg: "#5A8A30", shadow: "#2E5A10",
    imgSrc: "/assets/icon-home.png",
    icon: <svg width="70" height="70" viewBox="0 0 24 24" fill="none"><path d="M12 3L3 10v11h7v-6h4v6h7V10L12 3z" fill="rgba(255,255,255,0.35)"/><path d="M12 3L3 10v11h7v-6h4v6h7V10z" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinejoin="round" fill="none"/><path d="M9 21v-6h6v6" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5"/></svg>,
  },
  {
    id: "journal", label: "REFLECT", bg: "#C07828", shadow: "#7A4A10",
    imgSrc: "/assets/icon-journal.png",
    icon: <svg width="70" height="70" viewBox="0 0 26 30" fill="none"><rect x="4" y="2" width="18" height="26" rx="2" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4"/><rect x="6" y="4" width="14" height="22" rx="1" fill="rgba(255,255,200,0.35)"/><path d="M8 9h10M8 13h8M8 17h9M8 21h6" stroke="rgba(255,255,255,0.7)" strokeWidth="1.1"/><rect x="3" y="3" width="4" height="24" rx="1" fill="rgba(255,255,255,0.15)"/></svg>,
  },
  {
    id: "kingdom", label: "KINGDOM", bg: "#B82820", shadow: "#781210",
    imgSrc: "/assets/icon-kingdom.png",
    icon: <svg width="70" height="70" viewBox="0 0 32 30" fill="none"><rect x="3" y="15" width="26" height="13" rx="1.5" fill="rgba(255,255,255,0.25)"/><polygon points="1,16 16,4 31,16" fill="rgba(255,255,255,0.40)"/><polygon points="5,16 16,7 27,16" fill="rgba(255,255,255,0.55)"/><rect x="12" y="21" width="8" height="7" rx="1" fill="rgba(255,255,255,0.35)"/><rect x="4" y="12" width="2.5" height="5" fill="rgba(255,255,255,0.5)"/><rect x="8" y="9" width="2.5" height="8" fill="rgba(255,255,255,0.5)"/><rect x="25.5" y="12" width="2.5" height="5" fill="rgba(255,255,255,0.5)"/><rect x="21.5" y="9" width="2.5" height="8" fill="rgba(255,255,255,0.5)"/></svg>,
  },
  {
    id: "grove", label: "GROVE", bg: "#9A6020", shadow: "#5E3A08",
    imgSrc: "/assets/icon-grove.png",
    icon: <svg width="70" height="70" viewBox="0 0 30 28" fill="none"><path d="M2 8L6 3h18l4 5v17a2 2 0 01-2 2H4a2 2 0 01-2-2V8z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><line x1="2" y1="8" x2="28" y2="8" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><rect x="11" y="14" width="8" height="7" rx="1" fill="rgba(255,255,255,0.3)"/><line x1="9" y1="19" x2="9" y2="25" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/><line x1="21" y1="19" x2="21" y2="25" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/></svg>,
  },
  {
    id: "ventures", label: "VENTURES", bg: "#1E52A0", shadow: "#102870",
    imgSrc: "/assets/icon-ventures.png",
    icon: <svg width="70" height="70" viewBox="0 0 30 28" fill="none"><rect x="1" y="1" width="22" height="16" rx="2" fill="rgba(255,255,200,0.25)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><circle cx="12" cy="9" r="3" fill="none" stroke="rgba(255,80,80,0.9)" strokeWidth="1.5"/><line x1="12" y1="6" x2="12" y2="3" stroke="rgba(255,80,80,0.9)" strokeWidth="1.2"/><ellipse cx="19" cy="23" rx="5" ry="4" fill="rgba(100,150,255,0.7)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8"/><ellipse cx="28" cy="23" rx="5" ry="4" fill="rgba(100,150,255,0.7)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8"/><rect x="23" y="21" width="2.5" height="4" rx="1" fill="rgba(255,255,255,0.5)"/></svg>,
  },
];

const initialLand = {
  character: { x:52, y:58, facing:"down", walking:false },
  settings: { joystick:true },
  houses:[{id:"h-1",name:"Chief Residence",x:28,y:42,level:2,style:"cottage"},{id:"h-2",name:"Quiet Studio",x:60,y:32,level:1,style:"round"},{id:"h-3",name:"Friend Cabin",x:72,y:60,level:1,style:"glass"}],
  objects:[{id:"pond-1",type:"pond",x:42,y:68},{id:"bench-1",type:"bench",x:64,y:52},{id:"tree-1",type:"tree",x:18,y:55},{id:"tree-2",type:"tree",x:78,y:44},{id:"flower-1",type:"flower",x:35,y:60},{id:"flower-2",type:"flower",x:50,y:72}],
  linkedWorlds:["Mia's Tea Garden","Kai's Midnight Studio"]
};

export default function App() {
  const { session, loading: sessionLoading } = useSession();
  const [player, setPlayer]   = useDatabaseState("kindred.player", null);
  const [nameInput, setNameInput] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [tab, setTab]         = useDatabaseState("kindred.activeTab", "home");
  const [muted, setMuted]     = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);

  useEffect(() => { if (sfx?.setMuted) sfx.setMuted(muted); }, [muted]);
  useEffect(() => { if (musicOn) ambientPlayer.start(); else ambientPlayer.stop(); }, [musicOn]);

  // Ends the Supabase session where there is one; locally it just clears the
  // profile and drops back to onboarding, as it always did.
  async function signOut() {
    setShowUserDetails(false);
    if (isSupabaseConfigured) await supabase.auth.signOut();
    else setPlayer(null);
  }

  const toggleMute  = () => { setMuted(m => !m); if (!muted) sfx.click?.(); };
  const toggleMusic = () => setMusicOn(m => !m);

  const [emotion, setEmotion]               = useDatabaseState("kindred.emotion", "calm");
  const [coins, setCoins]                   = useDatabaseState("kindred.coins", 1000);
  const [journalEntries, setJournalEntries] = useDatabaseState("kindred.journal", initialJournalEntries);
  const [character, setCharacter]           = useDatabaseState("kindred.character", {
    animal:"fox",skin:"honey",color:"honey",outfit:"hoodie",hat:"none",accessory:"scarf",
    glasses:"none",shoes:"sneakers",pattern:"blush",furStyle:"soft",emote:"wave",animation:"idle"
  });
  const [inventory, setInventory]   = useDatabaseState("kindred.inventory", []);
  const [friends, setFriends]       = useDatabaseState("kindred.friends", ["Mia"]);
  const [land, setLand]             = useDatabaseState("kindred.land", initialLand);
  const [activities, setActivities] = useDatabaseState("kindred.activities", initialActivities);

  const worldMood       = useMemo(() => getWorldMood(emotion), [emotion]);

  // Publish the mood wash to the full-bleed backdrop (.viewport-fit::before) so
  // it covers the whole screen instead of stopping at the scaled stage's edge.
  useEffect(() => {
    document.documentElement.style.setProperty("--world-ambient", worldMood.ambient);
  }, [worldMood]);

  const todayStr        = new Date().toISOString().slice(0, 10);
  const journalledToday = journalEntries.some(e => e.date === todayStr);
  const npcBehavior     = useMemo(() => getNPCBehavior(emotion, journalledToday), [emotion, journalledToday]);

  function enterWorld(e) {
    e.preventDefault();
    const name = nameInput.trim() || "Wanderer";
    const goal = goalInput.trim();
    setPlayer({ id:session?.user?.id ?? crypto.randomUUID(), name, goal:goal||null, goalAchieved:false, goalAchievedAt:null, joinedAt:new Date().toISOString(), lastSeenAt:new Date().toISOString() });
  }

  // ── Auth gate ────────────────────────────────────────────────────────────
  // Only applies when Supabase is configured; local-only setups skip straight
  // to the name/goal onboarding exactly as before.
  if (sessionLoading) {
    return (
      <main className="login-world">
        <section className="login-panel">
          <h1 className="login-kindred-title">Kindred</h1>
          <p className="login-kindred-sub">Waking up your world…</p>
        </section>
      </main>
    );
  }

  if (isSupabaseConfigured && !session) return <AuthScreen />;

  // ── Onboarding ───────────────────────────────────────────────────────────
  if (!player) {
    return (
      <main className="login-world">
        <div className="login-sky" aria-hidden="true">
          <div className="login-cloud lc-1"/><div className="login-cloud lc-2"/>
          <div className="login-cloud lc-3"/><div className="login-cloud lc-4"/>
        </div>
        <section className="login-panel anim-pop-in">
          <h1 className="login-kindred-title">Kindred</h1>
          <p className="login-kindred-sub">Are you ready for today's adventures?</p>
          <form className="login-form" onSubmit={enterWorld}>
            <input className="login-input" value={nameInput} onChange={e=>setNameInput(e.target.value)} placeholder="What shall we call you?" aria-label="Your name" autoFocus/>
            <input className="login-input" value={goalInput} onChange={e=>setGoalInput(e.target.value)} placeholder="What's your goal right now?" aria-label="Your goal"/>
            <button className="login-btn" type="submit">Start my journey</button>
          </form>
        </section>
      </main>
    );
  }

  // ── Main shell ───────────────────────────────────────────────────────────
  return (
    <div className="app-shell" data-tab={tab}>

      {/* Settings overlay */}
      <AnimatePresence>
        {showSettings && (
          <motion.div className="settings-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
            <motion.div className="settings-overlay-panel" initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}} transition={{type:"spring",damping:22,stiffness:280}}>
              <SettingsPanel player={player} onClose={() => setShowSettings(false)}/>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User details overlay */}
      <AnimatePresence>
        {showUserDetails && (
          <motion.div className="settings-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={e => { if (e.target === e.currentTarget) setShowUserDetails(false); }}>
            <motion.div className="user-details-panel" initial={{scale:0.92,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.92,opacity:0}} transition={{type:"spring",damping:22}}>
              <div className="user-details-header">
                <div className="user-avatar-big">{player.name.slice(0,2).toUpperCase()}</div>
                <div>
                  <div className="user-details-name">{player.name}</div>
                  <div className="user-details-meta">Joined {new Date(player.joinedAt).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</div>
                </div>
                <button className="user-details-close" onClick={()=>setShowUserDetails(false)} aria-label="Close">✕</button>
              </div>
              {player.goal && (
                <div className="user-details-goal">
                  <div className="user-details-goal-label">Current goal</div>
                  <div className="user-details-goal-text">{player.goal}</div>
                  {player.goalAchieved && <div className="journey-achieved-badge" style={{marginTop:8}}>Achieved{player.goalAchievedAt&&` · ${player.goalAchievedAt}`}</div>}
                </div>
              )}
              <div style={{display:"flex",gap:10,marginTop:16}}>
                <button className="scroll-btn-secondary" style={{flex:1}} onClick={()=>setShowUserDetails(false)}>Close</button>
                <button className="scroll-btn-secondary" style={{flex:1,color:"#C04040",borderColor:"rgba(192,64,64,0.3)"}} onClick={signOut}>Sign out</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="main-content" style={{ filter:worldMood.filter!=="none"?worldMood.filter:undefined, transition:"filter 2s ease" }}>
        {tab==="home"     && <HomeView player={player} character={character} emotion={emotion} coins={coins} setTab={setTab} muted={muted} toggleMute={toggleMute} onOpenSettings={()=>setShowSettings(true)} onOpenUser={()=>setShowUserDetails(true)}/>}
        {tab==="journal"  && <WellnessView emotion={emotion} setEmotion={setEmotion} journalEntries={journalEntries} setJournalEntries={setJournalEntries} character={character} coins={coins} setCoins={setCoins} player={player} setPlayer={setPlayer} muted={muted} toggleMute={toggleMute} onOpenSettings={()=>setShowSettings(true)} onOpenUser={()=>setShowUserDetails(true)}/>}
        {tab==="grove"    && <SocialView character={character} inventory={inventory} setInventory={setInventory} friends={friends} setFriends={setFriends} coins={coins} setCoins={setCoins} emotion={emotion} npcBehavior={npcBehavior} journalledToday={journalledToday}/>}
        {tab==="ventures" && <RealWorldView emotion={emotion} character={character} activities={activities} setActivities={setActivities}/>}
        {tab==="kingdom"  && <LandView emotion={emotion} character={character} land={land} setLand={setLand} coins={coins} setCoins={setCoins} inventory={inventory} friends={friends}/>}
        {tab==="wardrobe" && <CharacterView emotion={emotion} character={character} setCharacter={setCharacter}/>}
      </main>

      {/* ── Global nav pills ── */}
      <div className="global-nav-pills">
        {NAV_PILLS.map((pill) => {
          const active = tab === pill.id;
          return (
            <motion.button
              key={pill.id}
              type="button"
              className={`global-nav-pill${active ? " active" : ""}`}
              style={{
                background: pill.bg,
                boxShadow: active
                  ? `0 2px 0 ${pill.shadow}, 0 4px 14px rgba(0,0,0,0.32)`
                  : `0 6px 0 ${pill.shadow}, 0 10px 20px rgba(0,0,0,0.35)`,
                transform: active ? "translateY(-8px)" : "translateY(0)",
              }}
              onClick={() => { sfx.click?.(); setTab(pill.id); }}
              whileTap={{ scale: 0.92, y: 4 }}
              aria-label={pill.label}
              aria-current={active ? "page" : undefined}
            >
              {/* Icon — pops out of button top */}
              <div className="global-pill-icon" aria-hidden="true">
                <img src={pill.imgSrc} alt="" className="global-pill-img"
                  onError={e => { e.currentTarget.style.display="none"; e.currentTarget.nextSibling.style.display="flex"; }}/>
                <span className="global-pill-svg-fallback">{pill.icon}</span>
              </div>
              <span className="global-pill-label">{pill.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
