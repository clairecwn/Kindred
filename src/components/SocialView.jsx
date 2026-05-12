import { useState } from "react";
import { MessageCircle, ShoppingBag } from "lucide-react";
import SceneViewport from "./SceneViewport.jsx";
import { EMOTIONS } from "../utils/emotion.js";
import { shops, streetPlayers } from "../data/seed.js";

export default function SocialView({ inventory, setInventory, coins, setCoins }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeShop, setActiveShop] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);

  function buyItem(item) {
    if (coins < item.price) return;
    setCoins((value) => value - item.price);
    setInventory((items) => [{ ...item, id: `${item.id}-${Date.now()}` }, ...items]);
  }

  return (
    <div className="page-grid">
      <SceneViewport
        title="Social Street"
        subtitle="Zoom, pan, enter shops, and tap other players."
        zoom={zoom}
        setZoom={setZoom}
        pan={pan}
        setPan={setPan}
      >
        <div className="street-sky" />
        <div className="street-road" />
        {shops.map((shop) => (
          <button
            key={shop.id}
            className="shop-building"
            style={{ left: `${shop.x}%`, top: `${shop.y}%`, "--shop": shop.color }}
            type="button"
            onClick={() => setActiveShop(shop)}
          >
            <span>{shop.name}</span>
            <small>{shop.category}</small>
          </button>
        ))}
        {streetPlayers.map((player) => (
          <button
            key={player.id}
            className="street-player"
            style={{ left: `${player.x}%`, top: `${player.y}%`, "--mood": EMOTIONS[player.mood].color }}
            type="button"
            onClick={() => setActivePlayer(player)}
          >
            <span />
            <strong>{player.name}</strong>
          </button>
        ))}
      </SceneViewport>

      <section className="wide-panel">
        <div className="section-heading">
          <div>
            <h2>Inventory</h2>
            <p>Purchased street items are saved locally.</p>
          </div>
          <ShoppingBag size={22} />
        </div>
        <div className="inventory-list">
          {inventory.length ? inventory.map((item) => <span key={item.id}>{item.name}</span>) : <p>No items yet.</p>}
        </div>
      </section>

      {activeShop && (
        <div className="drawer" role="dialog" aria-modal="true">
          <div>
            <h2>{activeShop.name}</h2>
            <button type="button" onClick={() => setActiveShop(null)}>Close</button>
          </div>
          {activeShop.items.map((item) => (
            <article key={item.id} className="shop-item">
              <div>
                <strong>{item.name}</strong>
                <span>{item.price} coins</span>
              </div>
              <button type="button" disabled={coins < item.price} onClick={() => buyItem(item)}>
                Buy
              </button>
            </article>
          ))}
        </div>
      )}

      {activePlayer && (
        <div className="drawer compact" role="dialog" aria-modal="true">
          <div>
            <h2>{activePlayer.name}</h2>
            <button type="button" onClick={() => setActivePlayer(null)}>Close</button>
          </div>
          <p>{activePlayer.name} seems {EMOTIONS[activePlayer.mood].tone}. Send a gentle hello or invite them to shop.</p>
          <div className="choice-row">
            <button className="primary-button" type="button"><MessageCircle size={17} /> Say hi</button>
            <button className="choice" type="button">Invite</button>
          </div>
        </div>
      )}
    </div>
  );
}
