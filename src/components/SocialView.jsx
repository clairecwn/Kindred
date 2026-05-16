import { useState } from "react";
import { Gamepad2, HeartHandshake, MessageCircle, ShoppingBag, UserPlus } from "lucide-react";
import SceneViewport from "./SceneViewport.jsx";
import { EMOTIONS } from "../utils/emotion.js";
import { shops, streetPlayers } from "../data/seed.js";

export default function SocialView({ character, inventory, setInventory, friends, setFriends, coins, setCoins }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 52, y: 70 });
  const [activeShop, setActiveShop] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [shortfall, setShortfall] = useState(null);
  const [chatLog, setChatLog] = useState([]);

  function buyItem(item) {
    if (coins < item.price) {
      setShortfall(item);
      return;
    }
    setCoins((value) => value - item.price);
    setInventory((items) => [{ ...item, id: `${item.id}-${Date.now()}`, purchasedAt: new Date().toISOString() }, ...items]);
    setPreviewItem(null);
  }

  function moveAvatar(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    });
  }

  function playForCoins(mode = "bot") {
    setCoins((value) => value + (mode === "bot" ? 180 : 260));
    setShortfall(null);
  }

  function addFriend(player) {
    setFriends((items) => Array.from(new Set([...(items || []), player.name])));
  }

  function sendChat(player) {
    setChatLog((items) => [
      { id: crypto.randomUUID(), player: player.name, text: "Sent a warm hello", at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ...items
    ]);
    setCoins((value) => value + 35);
  }

  return (
    <div className="page-grid">
      <SceneViewport
        title="Social Mall"
        subtitle="Tap the mall floor to move, enter shops, meet players"
        zoom={zoom}
        setZoom={setZoom}
        pan={pan}
        setPan={setPan}
      >
        <button className="mall-click-layer" type="button" aria-label="Move through mall" onClick={moveAvatar} />
        <div className="mall-atrium" />
        <div className="mall-floor" />
        <div className="mall-sign sign-left">Arcade</div>
        <div className="mall-sign sign-right">Tailor</div>
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
        <div className="mall-user" style={{ left: `${position.x}%`, top: `${position.y}%` }}>
          <span className={`mini-avatar ${character?.animal || "fox"}`} />
          <strong>You</strong>
        </div>
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
            <p>Purchased items are stored in your Kindred database.</p>
          </div>
          <ShoppingBag size={22} />
        </div>
        <div className="inventory-list">
          {inventory.length ? inventory.map((item) => <span key={item.id}>{item.name}</span>) : <p>No items yet.</p>}
        </div>
      </section>

      <section className="wide-panel">
        <div className="section-heading">
          <div>
            <h2>Friends</h2>
            <p>Friend bridges keep worlds linked for visits.</p>
          </div>
          <HeartHandshake size={22} />
        </div>
        <div className="inventory-list">
          {(friends || []).length ? friends.map((name) => <span key={name}>{name}'s world</span>) : <p>No friends added yet.</p>}
        </div>
        {chatLog.length > 0 && (
          <div className="chat-strip">
            {chatLog.slice(0, 3).map((message) => <span key={message.id}>{message.at} {message.player}: {message.text}</span>)}
          </div>
        )}
      </section>

      {activeShop && (
        <div className="drawer" role="dialog" aria-modal="true">
          <div>
            <h2>{activeShop.name}</h2>
            <button type="button" onClick={() => setActiveShop(null)}>Close</button>
          </div>
          <div className="shop-room">
            {activeShop.items.map((item) => (
              <button key={item.id} className="shop-object" type="button" onClick={() => setPreviewItem(item)}>
                <span>{item.name}</span>
                <small>{item.price} coins</small>
              </button>
            ))}
          </div>
          {activeShop.items.map((item) => (
            <article key={item.id} className="shop-item">
              <div>
                <strong>{item.name}</strong>
                <span>{item.price} coins</span>
              </div>
              <button type="button" onClick={() => setPreviewItem(item)}>
                Preview
              </button>
            </article>
          ))}
        </div>
      )}

      {previewItem && (
        <div className="drawer compact" role="dialog" aria-modal="true">
          <div>
            <h2>{previewItem.name}</h2>
            <button type="button" onClick={() => setPreviewItem(null)}>Close</button>
          </div>
          <div className="item-preview">
            <ShoppingBag size={42} />
            <strong>{previewItem.price} coins</strong>
          </div>
          <p>{previewItem.description || "A polished collectible for your avatar, world, or shared social space."}</p>
          <button className="primary-button" type="button" onClick={() => buyItem(previewItem)}>
            Confirm purchase
          </button>
        </div>
      )}

      {activePlayer && (
        <div className="drawer compact" role="dialog" aria-modal="true">
          <div>
            <h2>{activePlayer.name}</h2>
            <button type="button" onClick={() => setActivePlayer(null)}>Close</button>
          </div>
          <p>{activePlayer.name} seems {EMOTIONS[activePlayer.mood].tone}. Status: {activePlayer.status || "wandering the district"}.</p>
          <div className="choice-row">
            <button className="primary-button" type="button" onClick={() => sendChat(activePlayer)}><MessageCircle size={17} /> Chat</button>
            <button className="choice" type="button" onClick={() => playForCoins("human")}><Gamepad2 size={17} /> Play</button>
            <button className="choice" type="button" onClick={() => addFriend(activePlayer)}><UserPlus size={17} /> Friend</button>
          </div>
        </div>
      )}

      {shortfall && (
        <div className="drawer compact" role="dialog" aria-modal="true">
          <div>
            <h2>Need more coins</h2>
            <button type="button" onClick={() => setShortfall(null)}>Close</button>
          </div>
          <p>{shortfall.name} costs {shortfall.price} coins. Play a quick match with someone nearby, or with a bot if no one joins.</p>
          <div className="choice-row">
            <button className="primary-button" type="button" onClick={() => playForCoins("human")}><Gamepad2 size={17} /> Match</button>
            <button className="choice" type="button" onClick={() => playForCoins("bot")}>Bot match</button>
          </div>
        </div>
      )}
    </div>
  );
}
