import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Gamepad2, Hammer, Home, Sparkles, Trees } from "lucide-react";
import Animal3D from "./Animal3D.jsx";
import SceneViewport from "./SceneViewport.jsx";

const houseStyles = ["cottage", "round", "glass"];

export default function LandView({ emotion, character, land, setLand, coins, setCoins }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedHouse, setSelectedHouse] = useState(null);

  function moveCharacter(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const current = land.character || { x: 52, y: 58 };
    setLand((state) => ({
      ...state,
      character: {
        x: Math.min(88, Math.max(12, x)),
        y: Math.min(84, Math.max(24, y)),
        facing: x > current.x ? "right" : x < current.x ? "left" : y > current.y ? "down" : "up",
        walking: true
      }
    }));
    window.setTimeout(() => {
      setLand((state) => ({ ...state, character: { ...state.character, walking: false } }));
    }, 420);
  }

  function stepCharacter(dx, dy) {
    setLand((current) => ({
      ...current,
      character: {
        x: Math.min(86, Math.max(14, current.character.x + dx)),
        y: Math.min(82, Math.max(24, current.character.y + dy)),
        facing: dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up",
        walking: true
      }
    }));
    window.setTimeout(() => {
      setLand((current) => ({ ...current, character: { ...current.character, walking: false } }));
    }, 260);
  }

  function upgradeHouse(id) {
    const cost = 120;
    if (coins < cost) return;
    setCoins((value) => value - cost);
    setLand((current) => ({
      ...current,
      houses: current.houses.map((house) => (
        house.id === id ? { ...house, level: house.level + 1 } : house
      ))
    }));
  }

  function changeHouseStyle(id, style) {
    setLand((current) => ({
      ...current,
      houses: current.houses.map((house) => (
        house.id === id ? { ...house, style } : house
      ))
    }));
  }

  function toggleJoystick() {
    setLand((current) => ({
      ...current,
      settings: { ...(current.settings || {}), joystick: !(current.settings?.joystick ?? true) }
    }));
  }

  return (
    <div className="page-grid">
      <section className="hero-panel land-hero">
        <div>
          <p className="eyebrow">My World</p>
          <h1>A living home space you walk through.</h1>
          <p>Move your animal through layered rooms and garden paths, tap homes and decorations, then link into friends' worlds.</p>
        </div>
        <Animal3D emotion={emotion} {...character} />
      </section>

      <SceneViewport
        title="Homestead"
        subtitle="Tap the ground, move the camera, or use joystick mode"
        zoom={zoom}
        setZoom={setZoom}
        pan={pan}
        setPan={setPan}
      >
        <button className="land-click-layer" type="button" aria-label="Move character" onClick={moveCharacter} />
        <div className="homeworld-sky" />
        <div className="homeworld-ground" />
        <div className="homeworld-room room-left"><span>Tea room</span></div>
        <div className="homeworld-room room-right"><span>Studio</span></div>
        <div className="homeworld-path" />
        <div className="world-spark spark-one" />
        <div className="world-spark spark-two" />
        <Trees className="land-tree tree-a" size={48} />
        <Trees className="land-tree tree-b" size={42} />
        {land.houses.map((house) => (
          <button
            key={house.id}
            className={`land-house ${house.style}`}
            style={{ left: `${house.x}%`, top: `${house.y}%` }}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedHouse(house);
            }}
          >
            <Home size={34} />
            <span>Lv {house.level}</span>
          </button>
        ))}
        <div className={`land-character ${land.character.walking ? "walking" : ""} facing-${land.character.facing || "down"}`} style={{ left: `${land.character.x}%`, top: `${land.character.y}%` }}>
          <span className={`mini-avatar ${character.animal || "fox"}`} />
        </div>
        {(land.objects || []).map((object) => <div key={object.id} className={`home-object ${object.type}`} style={{ left: `${object.x}%`, top: `${object.y}%` }} />)}
        {(land.settings?.joystick ?? true) && (
          <div className="movement-pad">
            <button type="button" aria-label="Move up" onClick={() => stepCharacter(0, -6)}><ChevronUp size={18} /></button>
            <button type="button" aria-label="Move left" onClick={() => stepCharacter(-6, 0)}><ChevronLeft size={18} /></button>
            <button type="button" aria-label="Move right" onClick={() => stepCharacter(6, 0)}><ChevronRight size={18} /></button>
            <button type="button" aria-label="Move down" onClick={() => stepCharacter(0, 6)}><ChevronDown size={18} /></button>
          </div>
        )}
      </SceneViewport>

      <section className="wide-panel">
        <div className="section-heading">
          <div>
            <h2>World Settings</h2>
            <p>Linked homes and touch controls are saved with your world.</p>
          </div>
          <Gamepad2 size={22} />
        </div>
        <div className="choice-row">
          <button className={(land.settings?.joystick ?? true) ? "choice active" : "choice"} type="button" onClick={toggleJoystick}>
            Joystick mode
          </button>
          {(land.linkedWorlds || []).map((world) => <span className="friend-world" key={world}>{world}</span>)}
        </div>
      </section>

      <section className="wide-panel">
        <div className="section-heading">
          <div>
            <h2>Animated Spaces</h2>
            <p>Decorations have depth and small ambient movement.</p>
          </div>
          <Sparkles size={22} />
        </div>
        <div className="choice-row">
          <span className="friend-world">Pond ripple</span>
          <span className="friend-world">Firefly glow</span>
          <span className="friend-world">Room layering</span>
        </div>
      </section>

      {selectedHouse && (
        <section className="wide-panel">
          <div className="section-heading">
            <div>
              <h2>{selectedHouse.name}</h2>
              <p>Level {selectedHouse.level} house editor</p>
            </div>
            <Hammer size={22} />
          </div>
          <div className="choice-row">
            {houseStyles.map((style) => (
              <button
                key={style}
                className={selectedHouse.style === style ? "choice active" : "choice"}
                type="button"
                onClick={() => {
                  changeHouseStyle(selectedHouse.id, style);
                  setSelectedHouse((house) => ({ ...house, style }));
                }}
              >
                {style}
              </button>
            ))}
          </div>
          <button className="primary-button" type="button" onClick={() => upgradeHouse(selectedHouse.id)} disabled={coins < 120}>
            Upgrade for 120 coins
          </button>
        </section>
      )}
    </div>
  );
}
