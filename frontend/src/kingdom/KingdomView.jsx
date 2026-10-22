import { useEffect, useRef, useState } from "react";
import { KingdomScene } from "./KingdomScene.js";
import { HOUSE, PRODUCE_LABEL } from "./items.js";
import { adaptLegacyDescriptor } from "../avatar/index.js";
import { sfx } from "../lib/sound.js";
import "../grove/grove.css";
import "./kingdom.css";

// ── Kingdom: the player's own island ──────────────────────────────
// Mounts KingdomScene into a full-bleed canvas, the same way GroveView
// mounts the Grove, and floats a small HUD over it: the day and what has
// been harvested, a Build button, the bag while building, a prompt for the
// thing in front of you, and a short note when something happens.
// All the rules live in islandState.js; this component only shows state
// and passes on what the player chose.
//
// For now there is also a switch at the top: "Day 1" is the island as a new
// player finds it, "Developed" is the showcase island from Blender, to walk
// round and judge. It is for looking, before the Kingdom is made a game.
// Adding &view=developed to the address opens on the developed island.

const HOUSE_LABEL = { tent: "Tent", frame: "Cabin, being built", cabin: "Cabin" };

export default function KingdomView({ character }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const toastTimer = useRef(null);
  const [ui, setUi] = useState({ ready: false, bag: [], produce: {}, house: { stage: "tent" } });
  const [prompt, setPrompt] = useState(null);
  const [toast, setToast] = useState(null);
  const [roofAsk, setRoofAsk] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const scene = new KingdomScene(canvas, {
      avatarDescriptor: adaptLegacyDescriptor(character ?? {}),
      dev: Boolean(import.meta.env?.DEV),
      onChange: (next) => { if (sceneRef.current === scene) setUi(next); },
      onPrompt: (next) => { if (sceneRef.current === scene) setPrompt(next); },
      onToast: (text) => {
        if (sceneRef.current !== scene) return;
        setToast(text);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3200);
      },
      onAskRoof: (ask) => { if (sceneRef.current === scene) setRoofAsk(ask); },
    });
    sceneRef.current = scene;
    scene.start();
    if (typeof window !== "undefined") {
      window.__kingdom = scene;
      const view = new URLSearchParams(window.location.search).get("view");
      if (view === "developed" || view === "gallery") scene.loaded.then(() => scene.setView(view));
    }
    return () => {
      clearTimeout(toastTimer.current);
      scene.dispose();
      if (sceneRef.current === scene) sceneRef.current = null;
      if (typeof window !== "undefined" && window.__kingdom === scene) delete window.__kingdom;
    };
    // Built once per mount, like the Grove.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scene = () => sceneRef.current;
  const building = ui.buildMode;
  const developed = ui.view !== "day1";              // the developed island and the gallery: for looking at
  const produce = Object.entries(ui.produce ?? {}).filter(([, n]) => n > 0);

  return (
    <div className="grove-root kingdom-root anim-fade-in" style={{ height: "100%" }}>
      <canvas ref={canvasRef} className="grove-canvas" />

      {!ui.ready && (
        <div className="kingdom-loading">{ui.error ?? "Sailing to your island…"}</div>
      )}

      <div className="grove-hud">
        {ui.ready && (
          <div className="grove-chip kingdom-chip">
            <div className="grove-chip-district">My Island</div>
            <div className="grove-chip-meta">
              {ui.viewBusy ? "Loading…" : ui.view === "gallery" ? "Every model made for the Kingdom" : developed ? "A developed island, to look at" : HOUSE_LABEL[ui.house.stage]}
              {ui.view === "day1" && produce.map(([name, n]) => ` · ${PRODUCE_LABEL[name] ?? name} ${n}`)}
            </div>
          </div>
        )}

        {/* Which island to look at. */}
        {ui.ready && !building && (
          <div className="kingdom-views" role="group" aria-label="Which island to look at">
            {[["day1", "Day 1"], ["developed", "Developed"], ["gallery", "All assets"]].map(([id, label]) => (
              <button key={id} className={`kingdom-view${ui.view === id ? " kingdom-view--on" : ""}`} aria-pressed={ui.view === id} disabled={ui.viewBusy}
                onClick={() => { sfx.click?.(); scene()?.setView(id); }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {ui.ready && !developed && (
          <div className="grove-top-right">
            {ui.dev && !building && (
              <button className="grove-btn grove-btn--sm grove-btn--dark" title="Development only: throw this island away and start again from Day 1" onClick={() => scene()?.resetIsland()}>
                New island
              </button>
            )}
            {ui.dev && (
              <button className="grove-btn grove-btn--sm grove-btn--dark" title="Development only: move the island's calendar on one day" onClick={() => scene()?.skipDays(1)}>
                Next day{ui.dayOffset ? ` (+${ui.dayOffset})` : ""}
              </button>
            )}
            <button
              className={`grove-btn grove-btn--sm ${building ? "grove-btn--green" : "grove-btn--gold"}`}
              onClick={() => { sfx.click?.(); scene()?.setBuildMode(!building); }}
            >
              {building ? "Done" : "Build"}
            </button>
          </div>
        )}

        {/* What is in front of you. E where there is something to do. */}
        {prompt && !building && (
          <div className="kingdom-prompt">
            {prompt.key && <span className="grove-interact-key">{prompt.key}</span>}
            <span>{prompt.text}</span>
          </div>
        )}

        {toast && <div className="kingdom-toast" role="status">{toast}</div>}

        {/* The bag: what you own and have not put down yet. */}
        {building && (
          <div className="kingdom-bar">
            <div className="kingdom-bar-row">
            <button className={`kingdom-slot kingdom-slot--hand${ui.tool?.type === "hand" ? " kingdom-slot--active" : ""}`} onClick={() => scene()?.selectTool({ type: "hand" })}>
              <span className="kingdom-slot-key">X</span>
              <span className="kingdom-slot-icon kingdom-slot-icon--hand" aria-hidden="true" />
              <span className="kingdom-slot-name">Pick up</span>
            </button>
            <div className="kingdom-bar-items">
              {ui.bag.map((entry, index) => {
                const active = ui.tool?.type === "item" && ui.tool.id === entry.id;
                return (
                  <button key={entry.id} ref={active ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined} className={`kingdom-slot${active ? " kingdom-slot--active" : ""}`} onClick={() => scene()?.selectTool({ type: "item", id: entry.id })}>
                    {index < 9 && <span className="kingdom-slot-key">{index + 1}</span>}
                    <span className={`kingdom-slot-icon kingdom-slot-icon--${entry.kind} kingdom-slot-icon--${entry.id}`} aria-hidden="true" />
                    <span className="kingdom-slot-name">{entry.label}</span>
                    <span className="kingdom-slot-count">×{entry.free}</span>
                  </button>
                );
              })}
            </div>
            </div>
            {ui.variant && ui.variant.choices > 1 && (
              <button className="kingdom-colour" onClick={() => scene()?.nextVariant()} title="Next colour (C)">
                <span className="kingdom-colour-dot" style={{ background: `#${ui.variant.color.toString(16).padStart(6, "0")}` }} />
                {ui.variant.label} · C for the next colour
              </button>
            )}
            <div className="kingdom-bar-help">
              {ui.bag.length === 0
                ? "Your bag is empty. Seeds, saplings, fences, benches and wood are sold in the Grove."
                : "Click a spot to place · R turns · X or right-click picks up · B to finish"}
            </div>
          </div>
        )}

        {!building && ui.ready && (
          <div className="kingdom-keys">{developed ? "Arrows walk · A D look · Space jump · V first person" : "Arrows walk · A D look · Space jump · Shift sit · B build"}</div>
        )}
      </div>

      {/* Choosing a design when a build starts. */}
      {roofAsk && (
        <div className="kingdom-modal" onClick={(e) => { if (e.target === e.currentTarget) setRoofAsk(null); }}>
          <div className="kingdom-panel">
            <div className="kingdom-panel-title">Build a cabin</div>
            <div className="kingdom-panel-sub">Uses {roofAsk.need} wood of the {roofAsk.have} in your bag. Ready tomorrow. Pick a roof:</div>
            <div className="kingdom-roofs">
              {Object.entries(HOUSE.roofs).map(([id, roof]) => (
                <button key={id} className="kingdom-roof" onClick={() => { sfx.click?.(); if (scene()?.startCabin(id)) setRoofAsk(null); }}>
                  <span className="kingdom-roof-swatch" style={{ borderBottomColor: `#${roof.colors[0].toString(16).padStart(6, "0")}` }} />
                  {roof.label}
                </button>
              ))}
            </div>
            <button className="grove-btn grove-btn--sm grove-btn--dark" onClick={() => setRoofAsk(null)}>Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}
