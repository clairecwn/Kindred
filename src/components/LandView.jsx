import { useState } from "react";
import { Hammer, Home, Trees } from "lucide-react";
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
    setLand((current) => ({ ...current, character: { x, y } }));
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

  return (
    <div className="page-grid">
      <section className="hero-panel land-hero">
        <div>
          <p className="eyebrow">My land</p>
          <h1>Walk, zoom, edit, and upgrade your space.</h1>
          <p>Tap anywhere on the island to move your character. Select a house to edit its style or upgrade it.</p>
        </div>
        <Animal3D emotion={emotion} {...character} />
      </section>

      <SceneViewport
        title="Tranquil Isle"
        subtitle="Interactive land editor"
        zoom={zoom}
        setZoom={setZoom}
        pan={pan}
        setPan={setPan}
      >
        <button className="land-click-layer" type="button" aria-label="Move character" onClick={moveCharacter} />
        <div className="island-water" />
        <div className="island-grass" />
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
        <div className="land-character" style={{ left: `${land.character.x}%`, top: `${land.character.y}%` }}>
          <span />
        </div>
      </SceneViewport>

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
