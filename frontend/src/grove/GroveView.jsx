import { useEffect, useRef, useState } from "react";
import { sfx } from "../lib/sound.js";
import { useSession } from "../lib/SessionProvider.jsx";
import { GroveScene } from "./scene/GroveScene.js";
import { DISTRICTS, districtAt } from "./scene/districts.js";
import { GROVE_EXTERIOR_SPAWN } from "./scene/GroveExterior.js";
import { createPresenceClient } from "./net/PresenceClient.js";
import { createSocialLadder, LadderState } from "./social/SocialLadder.js";
import { getModeFactory } from "./modes/index.js";
import { adaptLegacyDescriptor } from "../avatar/index.js";
import {
  createStoryState, persistStoryState,
  visitDistrict, visitInterior, recordSit,
} from "./story/storyState.js";
import { setExternalCoins } from "./economy/worldState.js";
import "./grove.css";

// ── Grove: the shared 3D plaza ────────────────────────────────────
// Mounts GroveScene into a full-bleed canvas and wires it to Supabase
// presence, the social exposure ladder, and the district-scoped game
// modes. The 3D view fills the entire stage edge to edge — every control
// is a floating HUD layer on top of it (a status chip, a controls
// cluster, an action cluster, a joystick, and a dismissible slide-in
// drawer for districts and mode UI), never a page card sitting beside
// the game. This component owns no gameplay math itself; it only bridges
// React state (settings the user can see and change) to the plain JS
// modules that do the actual work.

const LADDER_LABEL = {
  [LadderState.SOLO]:    "Solo",
  [LadderState.GHOST]:   "Ghost mode",
  [LadderState.AMBIENT]: "Ambient",
  [LadderState.EMOTE]:   "Emote only",
  [LadderState.CHAT]:    "Chat open",
  [LadderState.GROUP]:   "In a group",
};

const MODE_LABEL = {
  "quiet-round": "The Quiet Round",
  "long-field": "The Long Field",
};

const CROP_ORDER = ["sunroot", "moonberry", "driftwheat"];

/**
 * @param {object} props
 * @param {object} [props.character]
 * @param {number} [props.coins] the player's real coin balance, sourced
 *   from wherever the journaling/check-in reward economy lives outside
 *   Grove. Left undefined, the mall runs in a clearly-degraded demo purse
 *   (see scene/GroveScene.js / economy/worldState.js) rather than either
 *   crashing or inventing a real-looking number.
 */
export default function GroveView({ character, coins, onCoinsChange, analysis, previewMall = false, previewPark = false }) {
  const onCoinsChangeRef = useRef(onCoinsChange);
  onCoinsChangeRef.current = onCoinsChange;
  const isReviewPreview = previewMall || previewPark;
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const presenceRef = useRef(null);
  const ladderRef = useRef(null);
  const userIdRef = useRef(null);
  const fallbackUserIdRef = useRef(`local-${Math.random().toString(36).slice(2, 10)}`);
  const modeRef = useRef(null); // { instance, districtId } for the currently active district mode
  const { userId } = useSession?.() ?? {};

  // The balance can change while the Grove is open (it loads from the
  // account a moment after the app starts): keep the mall's purse in step.
  useEffect(() => {
    const state = sceneRef.current?.worldState;
    if (state && typeof coins === "number" && state.coins !== coins) setExternalCoins(state, coins);
  }, [coins]);

  const [ladderState, setLadderState] = useState(LadderState.AMBIENT);
  const [currentDistrict, setCurrentDistrict] = useState(DISTRICTS[0]);
  const [chatOpen, setChatOpen] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [modeSnapshot, setModeSnapshot] = useState(null);
  const [drawerTab, setDrawerTab] = useState(null); // null | "districts" | "mode"

  // ── The mall: interaction prompt, fade transition, interior/economy HUD ──
  const [prompt, setPrompt] = useState(null); // {text, screen:{x,y}} | null
  const [fadeOpacity, setFadeOpacity] = useState(0);
  const [interior, setInterior] = useState({ active: false, id: null, label: null, npcLabel: null, metaLabel: null });
  const [economy, setEconomy] = useState({ coins: 0, coinsProvided: false, inventory: [] });
  const [shop, setShop] = useState(null); // the shop the player is standing at: {shopId, label, items, index, confirm, coins} | null
  const [previewPerf, setPreviewPerf] = useState(null);
  const promptWorldRef = useRef(null); // {x,y,z} kept out of React state so re-projecting each frame is cheap
  const promptElRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let cancelled = false;

    // React Fast Refresh preserves component state while recreating the
    // Three.js scene. Keep the HUD in step with that fresh outdoor scene
    // instead of leaving stale mall-floor controls over the park.
    setInterior({ active: false, id: null, label: null, npcLabel: null, metaLabel: null });

    const ladder = createSocialLadder(LadderState.AMBIENT);
    ladderRef.current = ladder;
    const unsubscribe = ladder.subscribe((next) => setLadderState(next));

    const localUserId = userId ?? fallbackUserIdRef.current;
    userIdRef.current = localUserId;

    let scene;
    scene = new GroveScene(canvas, {
      startPosition: GROVE_EXTERIOR_SPAWN,
      avatarDescriptor: adaptLegacyDescriptor(character ?? {}),
      localUserId,
      coins,
      showLegacyAffordances: isReviewPreview,
      onFade: (opacity) => {
        if (sceneRef.current === scene) setFadeOpacity(opacity);
      },
      onInteriorChange: (info) => {
        if (sceneRef.current !== scene) return;
        setInterior(info);
        if (!info?.active) setShop(null);
        // Stepping inside somewhere for the first time is real story
        // progress (see story/beats.js chapter II) — recorded here rather
        // than inside the scene so all persisted progress has one owner.
        if (info?.active && info.id) {
          persistStoryState(visitInterior(createStoryState(), info.id));
        }
      },
      onInteractionPrompt: (p) => {
        if (sceneRef.current !== scene) return;
        promptWorldRef.current = p;
        setPrompt(p ? { text: p.text } : null);
      },
      onShopBrowse: (info) => {
        if (sceneRef.current === scene) setShop(info);
      },
      onEconomyChange: (s) => {
        if (sceneRef.current === scene) setEconomy(s);
        // A purchase comes out of the one balance the whole app shares.
        if (s.coinsProvided) onCoinsChangeRef.current?.(s.coins);
      },
    });
    scene.setSfx(sfx);
    sceneRef.current = scene;
    if (typeof window !== "undefined") window.__grove = scene;
    if (previewMall) {
      scene.enterGroveMallPreview().then(() => {
        if (!cancelled && sceneRef.current === scene) {
          if (typeof window !== "undefined") window.__grove = scene;
          setPreviewPerf(scene.perfSnapshot());
        }
      });
    } else if (previewPark) {
      scene.previewCanopyParkView("overview");
      scene._assetsReady.then(() => {
        if (sceneRef.current === scene) setPreviewPerf(scene.perfSnapshot());
      });
    }

    const presence = createPresenceClient({
      roomId: "grove-hub",
      userId: localUserId,
      getLadderState: () => ladder.getState(),
      onPeersChanged: (peers) => setPeerCount(peers.size),
    });
    presenceRef.current = presence;
    presence.connect();
    presence.setDisplayInfo({
      displayName: character?.name ?? null,
      character: character ?? null,
      ladderState: ladder.getState(),
    });

    // Leaves whatever district-scoped game mode is currently active
    // (if any), disposing it. Modes persist their own progress (e.g. Long
    // Field plots) outside the mode instance itself, so disposing here
    // never loses anything — the design bible's "graceful mid-session
    // exit" rule for every mode.
    function leaveActiveMode() {
      const active = modeRef.current;
      if (!active) return;
      active.instance.leave(localUserId);
      active.instance.dispose();
      modeRef.current = null;
      setModeSnapshot(null);
    }

    // Enters the mode for a district if one is implemented (see
    // modes/index.js); a district with no implemented mode simply gets no
    // mode UI, never a stub.
    function enterDistrictMode(district) {
      leaveActiveMode();
      const factory = getModeFactory(district.minigame);
      if (!factory) return;
      const instance = factory({ districtId: district.id });
      instance.join(localUserId, { displayName: character?.name ?? null });
      modeRef.current = { instance, districtId: district.id };
      setModeSnapshot(instance.getState(localUserId));
    }

    let lastDistrictId = null;
    scene.start({
      onFixedStep: (_dt, pos) => {
        presence.updateLocalPosition(pos.x, pos.z, pos.heading);
        if (isReviewPreview) {
          const district = districtAt(pos.x, pos.z);
          if (district.id === lastDistrictId) return;
          lastDistrictId = district.id;
          setCurrentDistrict(district);
          sfx.click?.();
          enterDistrictMode(district);
          // A place can make you quieter; it can never make you louder.
          // See SocialLadder.applyPlaceFloor for why this is one-way.
          if (district.ladderFloor) ladder.applyPlaceFloor(district.ladderFloor);
          // First arrival anywhere is what advances the main thread. No
          // clock, no streak — you moved, so the story moved.
          const before = createStoryState();
          const after = visitDistrict(before, district.id);
          if (after !== before) {
            persistStoryState(after);
            scene.celebrateAt(pos.x, 1.4, pos.z, 0xffe3a8);
          }
        }
      },
      onFrame: (dt) => {
        // Grove currently has one player-controlled character by design.
        // Presence may still report other sessions, but they are not
        // rendered until multiplayer avatars are deliberately re-enabled.
        scene.pruneRemoteAvatars(new Set());

        if (modeRef.current) {
          modeRef.current.instance.update(dt, performance.now());
        }

        // Re-project the active interaction prompt's world anchor every
        // frame so it tracks the camera without React re-rendering for
        // every camera tick — only the DOM node's inline style moves.
        const el = promptElRef.current;
        if (el) {
          const w = promptWorldRef.current;
          if (w) {
            const screen = scene.projectToScreen(w.x, w.y, w.z);
            if (screen) {
              el.style.display = "";
              el.style.left = `${screen.x * 100}%`;
              el.style.top = `${screen.y * 100}%`;
            } else {
              el.style.display = "none";
            }
          }
        }
      },
    });

    // The active mode's UI (breathing phase, plot growth stages) is polled
    // on a slow timer rather than every render frame: the numbers it shows
    // change on the order of seconds, and re-rendering React at 60fps for
    // them would be pure waste.
    const modeUiTimer = setInterval(() => {
      if (modeRef.current) {
        setModeSnapshot(modeRef.current.instance.getState(localUserId));
      }
    }, 400);

    return () => {
      cancelled = true;
      clearInterval(modeUiTimer);
      leaveActiveMode();
      unsubscribe();
      presence.disconnect();
      scene.dispose();
      if (sceneRef.current === scene) sceneRef.current = null;
      if (typeof window !== "undefined" && window.__grove === scene) delete window.__grove;
    };
    // Intentionally run once per mount: character/user changes mid-session
    // are pushed via presence.setDisplayInfo in the effect below, not by
    // tearing down and rebuilding the whole scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    presenceRef.current?.setDisplayInfo({ character: character ?? null });
    // Live-update the local avatar mesh in place (no rebuild) whenever the
    // single shared character descriptor changes in CharacterView, so
    // wardrobe/palette/power-up changes show up in Grove immediately.
    if (sceneRef.current) {
      sceneRef.current.setLocalDescriptor(adaptLegacyDescriptor(character ?? {}));
    }
  }, [character]);

  function stepBack() {
    ladderRef.current?.stepBack();
    setChatOpen(false);
    sfx.click?.();
  }

  function toggleChat() {
    const ladder = ladderRef.current;
    if (!ladder) return;
    if (chatOpen) {
      ladder.transition(LadderState.AMBIENT);
      setChatOpen(false);
      sfx.click?.();
      return;
    }
    // Mutual opt-in is enforced by SocialLadder itself; this demo view
    // treats "otherChatOpen" as true only to illustrate the toggle. A real
    // integration reads each nearby peer's own chat-open setting from
    // their presence metadata before allowing the transition per peer.
    const result = ladder.transition(LadderState.CHAT, { selfChatOpen: true, otherChatOpen: true });
    if (result.ok) {
      setChatOpen(true);
      sfx.click?.();
    }
  }

  function onPlantOrHarvest(cellIndex) {
    const active = modeRef.current;
    const localUserId = userIdRef.current;
    if (!active || active.instance.id !== "long-field" || !localUserId) return;
    const cell = modeSnapshot?.plot?.[cellIndex];
    if (!cell) return;
    if (cell.stage === "ready") {
      active.instance.harvest(localUserId, cellIndex);
      sfx.coin?.();
    } else if (cell.stage === "empty") {
      const cropId = CROP_ORDER[cellIndex % CROP_ORDER.length];
      active.instance.plant(localUserId, cellIndex, cropId);
      sfx.click?.();
    }
    setModeSnapshot(active.instance.getState(localUserId));
  }

  function onToggleBreathing() {
    const active = modeRef.current;
    const localUserId = userIdRef.current;
    if (!active || active.instance.id !== "quiet-round" || !localUserId) return;
    const mine = modeSnapshot?.participants?.find((p) => p.userId === localUserId);
    active.instance.setBreathing(localUserId, !(mine?.breathingEnabled !== false));
    setModeSnapshot(active.instance.getState(localUserId));
  }

  function openDrawer(tab) {
    sfx.click?.();
    setDrawerTab((current) => (current === tab ? null : tab));
  }

  const hasMode = !!modeSnapshot;

  // The district pills were display-only. They now actually travel there.
  function goToDistrict(districtId) {
    const scene = sceneRef.current;
    if (!scene) return;
    const d = scene.goToDistrict(districtId);
    if (!d) return;
    setCurrentDistrict(d);
    setDrawerTab(null);
    sfx?.tap?.();
  }

  async function showMallFloor(floor) {
    const scene = sceneRef.current;
    if (!scene) return;
    let changed = scene.previewGroveMallFloor(floor);
    if (!changed) {
      await scene.enterGroveMallPreview();
      if (sceneRef.current !== scene) return;
      changed = scene.previewGroveMallFloor(floor);
    }
    if (changed && sceneRef.current === scene) {
      setPreviewPerf(scene.perfSnapshot());
    }
  }

  return (
    // The app renders into a fixed 1280x605 design canvas (see
    // hooks/useStageScale.js). Grove fills that canvas edge to edge with
    // the 3D view itself — no page container, no hero card, no card
    // chrome — and every control floats above it as HUD.
    <div className="grove-root anim-fade-in" style={{ height: "100%" }}>
      <canvas ref={canvasRef} className="grove-canvas" />

      {/* Interior transition fade — a flat scrim GroveScene drives to 1
          then back to 0 across each door crossing (see
          interiors/InteriorManager.js), so stepping between the plaza and
          a shop's interior reads as one deliberate cut, not a pop. */}
      <div
        className="grove-fade"
        style={{ opacity: fadeOpacity, pointerEvents: fadeOpacity > 0.05 ? "auto" : "none" }}
        aria-hidden="true"
      />

      <div className="grove-hud">
        {/* Compact district/status chip for the review preview. */}
        {isReviewPreview && <div className="grove-chip">
          <div className="grove-chip-district">{interior.active ? interior.label : currentDistrict.label}</div>
          <div className="grove-chip-meta">
            {interior.active
              ? (interior.metaLabel ?? "Browsing")
              : `${LADDER_LABEL[ladderState]} · ${peerCount} nearby`}
          </div>
        </div>}

        {/* Coin balance + carried item, top-right — always visible so a
            purchase's cost and a carry's "hands full" state are legible
            without opening any menu. */}
        {isReviewPreview && <div className="grove-top-right">
          <div className="grove-coin-chip" title={economy.coinsProvided ? "Coins" : "Demo purse — not yet wired to a real balance"}>
            <span className="grove-coin-dot" />
            {economy.coins}
            {!economy.coinsProvided && <span className="grove-coin-demo">demo</span>}
          </div>
          <button
            className={`grove-btn grove-btn--sm ${chatOpen ? "grove-btn--green" : "grove-btn--dark"}`}
            onClick={toggleChat}
          >
            {chatOpen ? "Chat open" : "Open chat"}
          </button>
        </div>}

        {((previewMall && interior.active) || previewPark) && (
          <div className="grove-actions" style={{ left: "50%", transform: "translateX(-50%)" }}>
            {previewPark && !interior.active && (
              <>
                <button
                  className="grove-btn grove-btn--sm grove-btn--dark"
                  onClick={() => sceneRef.current?.previewCanopyParkView("overview")}
                >
                  Mall + Park
                </button>
                <button
                  className="grove-btn grove-btn--sm grove-btn--dark"
                  onClick={() => sceneRef.current?.previewCanopyParkView("park")}
                >
                  Park view
                </button>
              </>
            )}
            {(previewMall || previewPark) && interior.active && [1, 2, 3].map((floor) => (
              <button
                key={floor}
                className="grove-btn grove-btn--sm grove-btn--gold"
                onClick={() => void showMallFloor(floor)}
              >
                Level {floor}
              </button>
            ))}
            {previewPark && !interior.active && ["Sun", "Mint", "Rose"].map((label, index) => (
              <button
                key={label}
                className="grove-btn grove-btn--sm grove-btn--gold"
                onClick={() => sceneRef.current?.previewCanopyParkPetal(index)}
              >
                Wake {label}
              </button>
            ))}
            {previewPark && !interior.active && (
              <button
                className="grove-btn grove-btn--sm grove-btn--green"
                onClick={async () => {
                  await sceneRef.current?.enterGroveMallPreview();
                  if (sceneRef.current) setPreviewPerf(sceneRef.current.perfSnapshot());
                }}
              >
                Enter mall
              </button>
            )}
            {previewPark && !interior.active && (
              <button
                className="grove-btn grove-btn--sm grove-btn--green"
                onClick={async () => {
                  await sceneRef.current?.previewParkMallDoorway();
                  if (sceneRef.current) setPreviewPerf(sceneRef.current.perfSnapshot());
                }}
              >
                Test doorway
              </button>
            )}
            {previewPark && interior.active && (
              <button
                className="grove-btn grove-btn--sm grove-btn--green"
                onClick={async () => {
                  await sceneRef.current?.exitGroveMallPreview();
                  if (sceneRef.current) {
                    setPreviewPerf(sceneRef.current.perfSnapshot());
                  }
                }}
              >
                Return to park
              </button>
            )}
            {previewPerf && (
              <span className="grove-btn grove-btn--sm grove-btn--dark" data-preview-perf>
                {previewPerf.drawCalls} calls · {previewPerf.triangles.toLocaleString()} tris
              </span>
            )}
          </div>
        )}

        {isReviewPreview && chatOpen && (
          <div className="grove-chat-panel">
            Chat is open with anyone nearby who has also opted in.
          </div>
        )}

        {/* The shelf list: everything the shop in front of you sells, with
            the item E would buy marked. Q moves down the list; a click picks
            a row. Shown only while standing at a shop. */}
        {shop && (
          <div className="grove-shop">
            <div className="grove-shop-head">
              <span className="grove-shop-name">{shop.label}</span>
              <span className="grove-shop-coins"><span className="grove-coin-dot" />{shop.coins}</span>
            </div>
            <div className="grove-shop-list">
              {shop.items.map((item, i) => (
                <button
                  key={item.id}
                  className={`grove-shop-row${i === shop.index ? " grove-shop-row--active" : ""}${item.price > shop.coins ? " grove-shop-row--dear" : ""}`}
                  onClick={() => sceneRef.current?.selectShopItem(shop.shopId, i)}
                  ref={i === shop.index ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                >
                  <span className="grove-shop-label">{item.label}</span>
                  {item.owned > 0 && <span className="grove-shop-owned">have {item.owned}</span>}
                  <span className="grove-shop-price">{item.price}</span>
                </button>
              ))}
            </div>
            <div className="grove-shop-help">{shop.confirm ? "E again to buy" : "E buy · Q next · click to choose"}</div>
          </div>
        )}

        {/* World-anchored interaction prompt: positioned every frame from
            GroveScene.projectToScreen() rather than React state, so it
            tracks the camera at 60fps without triggering a re-render —
            appears/fades within a couple of frames per the brief. */}
        <div
          ref={promptElRef}
          className={`grove-interact-prompt ${prompt ? "grove-interact-prompt--visible" : ""}`}
          style={{ display: prompt ? "" : "none" }}
        >
          <span className="grove-interact-key">E</span>
          <span>{prompt?.text}</span>
        </div>

        {/* Action cluster, bottom-left: the safe-exit action always in the
            same place, plus menu/mode entry points into the slide-in
            drawer. Hidden indoors, where "Step Back"/district travel don't
            apply — the door trigger is the only way in or out of a shop. */}
        {isReviewPreview && !interior.active && (
          <div className="grove-actions">
            <button className="grove-btn grove-btn--sm grove-btn--dark" onClick={stepBack}>
              Step Back
            </button>
            {hasMode && (
              <button
                className="grove-btn grove-btn--sm grove-btn--violet"
                onClick={() => openDrawer("mode")}
              >
                {MODE_LABEL[modeSnapshot.id] ?? "Activity"}
              </button>
            )}
            <button
              className="grove-btn grove-btn--sm grove-btn--gold"
              onClick={() => openDrawer("districts")}
            >
              Districts
            </button>
          </div>
        )}

        {/* Dismissible slide-in drawer: districts list or the active
            district mode's controls, layered over the game rather than
            sitting below it. */}
        {isReviewPreview && drawerTab && (
          <>
            <div className="grove-drawer-backdrop" onClick={() => setDrawerTab(null)} />
            <div className="grove-drawer">
              {drawerTab === "districts" && (
                <>
                  <div className="grove-drawer-header">
                    <div>
                      <div className="grove-drawer-title">Districts</div>
                      <div className="grove-drawer-sub">Walk through the hub to reach any of them.</div>
                    </div>
                    <button className="grove-drawer-close" onClick={() => setDrawerTab(null)} aria-label="Close">✕</button>
                  </div>
                  <div className="grove-district-pill-row">
                    {DISTRICTS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className="grove-district-pill"
                        aria-current={d.id === currentDistrict.id ? "true" : undefined}
                        onClick={() => goToDistrict(d.id)}
                        style={{
                          background: d.id === currentDistrict.id ? d.accent : "rgba(0,0,0,0.06)",
                          color: d.id === currentDistrict.id ? "#fff" : "var(--text-2)",
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {drawerTab === "mode" && modeSnapshot?.id === "quiet-round" && (
                <>
                  <div className="grove-drawer-header">
                    <div>
                      <div className="grove-drawer-title">The Quiet Round</div>
                      <div className="grove-drawer-sub">No chat, no objective. Just company, if you want it.</div>
                    </div>
                    <button className="grove-drawer-close" onClick={() => setDrawerTab(null)} aria-label="Close">✕</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      className="grove-breath-dot"
                      style={{ transform: `scale(${0.75 + modeSnapshot.breathScale * 0.5})`, transition: "transform 120ms linear" }}
                      aria-hidden="true"
                    />
                    <button
                      onClick={onToggleBreathing}
                      className="grove-btn grove-btn--sm grove-btn--green"
                    >
                      {modeSnapshot.participants.find((p) => p.userId === userIdRef.current)?.breathingEnabled !== false ? "Breathing on" : "Breathing off"}
                    </button>
                    <span style={{ fontSize: "0.76rem", color: "var(--text-2)", fontWeight: 700 }}>
                      {modeSnapshot.participants.length} sitting here
                    </span>
                  </div>
                </>
              )}

              {drawerTab === "mode" && modeSnapshot?.id === "long-field" && (
                <>
                  <div className="grove-drawer-header">
                    <div>
                      <div className="grove-drawer-title">The Long Field</div>
                      <div className="grove-drawer-sub">Plant, tend, harvest. Nothing here decays while you're away.</div>
                    </div>
                    <button className="grove-drawer-close" onClick={() => setDrawerTab(null)} aria-label="Close">✕</button>
                  </div>
                  <div className="grove-plot-grid">
                    {modeSnapshot.plot.map((cell, i) => (
                      <button
                        key={i}
                        onClick={() => onPlantOrHarvest(i)}
                        className="grove-plot-cell"
                        style={{
                          background: cell.stage === "ready" ? "#D4A853"
                            : cell.stage === "growing" ? "#A8C98A"
                            : cell.stage === "sprout" ? "#CFE3B8"
                            : "rgba(0,0,0,0.04)",
                          color: cell.stage === "empty" ? "var(--text-2)" : "#3D2010",
                        }}
                        title={cell.cropId ?? "empty plot"}
                      >
                        {cell.stage === "ready" ? "Harvest" : cell.stage === "empty" ? "Plant" : cell.stage}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
