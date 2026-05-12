import { HeartPulse, Map, PawPrint, Store, Trees } from "lucide-react";
import CharacterView from "./components/CharacterView.jsx";
import LandView from "./components/LandView.jsx";
import RealWorldView from "./components/RealWorldView.jsx";
import SocialView from "./components/SocialView.jsx";
import WellnessView from "./components/WellnessView.jsx";
import { initialActivities, initialJournalEntries } from "./data/seed.js";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { EMOTIONS } from "./utils/emotion.js";

const tabs = [
  { id: "wellness", label: "Wellness", icon: HeartPulse },
  { id: "land", label: "My Land", icon: Trees },
  { id: "social", label: "Social", icon: Store },
  { id: "realworld", label: "Real World", icon: Map },
  { id: "character", label: "Character", icon: PawPrint }
];

const initialLand = {
  character: { x: 52, y: 58 },
  houses: [
    { id: "h-1", name: "Chief Residence", x: 28, y: 48, level: 2, style: "cottage" },
    { id: "h-2", name: "Quiet Studio", x: 58, y: 34, level: 1, style: "round" },
    { id: "h-3", name: "Friend Cabin", x: 70, y: 62, level: 1, style: "glass" }
  ]
};

export default function App() {
  const [tab, setTab] = useLocalStorage("kindred.activeTab", "wellness");
  const [emotion, setEmotion] = useLocalStorage("kindred.emotion", "calm");
  const [coins, setCoins] = useLocalStorage("kindred.coins", 2450);
  const [journalEntries, setJournalEntries] = useLocalStorage("kindred.journal", initialJournalEntries);
  const [character, setCharacter] = useLocalStorage("kindred.character", {
    animal: "fox",
    color: "honey",
    accessory: "scarf"
  });
  const [inventory, setInventory] = useLocalStorage("kindred.inventory", []);
  const [land, setLand] = useLocalStorage("kindred.land", initialLand);
  const [activities, setActivities] = useLocalStorage("kindred.activities", initialActivities);

  const CurrentIcon = tabs.find((item) => item.id === tab)?.icon || HeartPulse;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><PawPrint size={25} /></div>
          <div>
            <strong>Kindred</strong>
            <span>wellbeing world</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="status-card" style={{ "--accent": EMOTIONS[emotion].color }}>
          <span>Current mood</span>
          <strong>{EMOTIONS[emotion].label}</strong>
          <small>{coins.toLocaleString()} coins</small>
        </div>
      </aside>

      <main className="main-surface">
        <header className="topbar">
          <div>
            <p className="eyebrow">Expanded repository prototype</p>
            <h1><CurrentIcon size={26} /> {tabs.find((item) => item.id === tab)?.label}</h1>
          </div>
          <div className="coin-chip">{coins.toLocaleString()} coins</div>
        </header>

        {tab === "wellness" && (
          <WellnessView
            emotion={emotion}
            setEmotion={setEmotion}
            journalEntries={journalEntries}
            setJournalEntries={setJournalEntries}
            character={character}
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
          />
        )}
        {tab === "social" && (
          <SocialView
            inventory={inventory}
            setInventory={setInventory}
            coins={coins}
            setCoins={setCoins}
          />
        )}
        {tab === "realworld" && (
          <RealWorldView
            emotion={emotion}
            activities={activities}
            setActivities={setActivities}
          />
        )}
        {tab === "character" && (
          <CharacterView emotion={emotion} character={character} setCharacter={setCharacter} />
        )}
      </main>
    </div>
  );
}
