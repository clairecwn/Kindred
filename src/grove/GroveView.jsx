import { useEffect, useRef, useState } from "react";
import { sfx } from "../lib/sound.js";
import { useSession } from "../lib/SessionProvider.jsx";
import { GroveScene } from "./scene/GroveScene.js";
import { DISTRICTS, districtAt, SPAWN, presenceAnchors } from "./scene/districts.js";
import { createPresenceClient } from "./net/PresenceClient.js";
import { createSocialLadder, LadderState } from "./social/SocialLadder.js";
import { getModeFactory } from "./modes/index.js";
import StoryOverlay from "./story/StoryOverlay.jsx";
import TouchJoystick from "./ui/TouchJoystick.jsx";
import { adaptLegacyDescriptor } from "../avatar/index.js";
import { readKindredSettings } from "../lib/app-settings.js";
import {
  createStoryState, persistStoryState, raiseFriendship, markLineShown,
  visitDistrict, visitInterior, recordSit,
} from "./story/storyState.js";
import { getDialoguePool, pickLine } from "./story/npcDialogue.js";
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
export default function GroveView({ character, coins, analysis, previewMall = false, previewPark = false }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const presenceRef = useRef(null);
  const ladderRef = useRef(null);
  const userIdRef = useRef(null);
  const modeRef = useRef(null); // { instance, districtId } for the currently active district mode
  const { userId } = useSession?.() ?? {};

  const [ladderState, setLadderState] = useState(LadderState.AMBIENT);
  const [currentDistrict, setCurrentDistrict] = useState(DISTRICTS[0]);
  const [chatOpen, setChatOpen] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [modeSnapshot, setModeSnapshot] = useState(null);
  const [drawerTab, setDrawerTab] = useState(null); // null | "districts" | "mode"
  const [storyOpen, setStoryOpen] = useState(false);
  const [showJoystick, setShowJoystick] = useState(() => !!readKindredSettings().groveJoystick);
  const [npcBubble, setNpcBubble] = useState(null); // {npcLabel, line} | null
  const npcBubbleTimerRef = useRef(null);

  // ── The mall: interaction prompt, fade transition, interior/economy HUD ──
  const [prompt, setPrompt] = useState(null); // {text, screen:{x,y}} | null
  const [fadeOpacity, setFadeOpacity] = useState(0);
  const [interior, setInterior] = useState({ active: false, id: null, label: null, npcLabel: null, metaLabel: null });
  const [economy, setEconomy] = useState({ coins: 0, coinsProvided: false, inventory: [] });
  const [previewPerf, setPreviewPerf] = useState(null);
  const promptWorldRef = useRef(null); // {x,y,z} kept out of React state so re-projecting each frame is cheap
  const promptElRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ladder = createSocialLadder(LadderState.AMBIENT);
    ladderRef.current = ladder;
    const unsubscribe = ladder.subscribe((next) => setLadderState(next));

    // NPC dialogue: fired by GroveScene's proximity interaction system,
    // both outdoors (district NPCs) and indoors (a shop's counter NPC).
    // Reads/writes the same persisted story state StoryOverlay owns
    // (src/grove/story/storyState.js is plain data, safe to touch from
    // here) so a conversation nudges friendship exactly like a completed
    // task does.
    function onNpcInteract(npcId, npcLabel, context = "greeting") {
      const state = createStoryState();
      const pool = getDialoguePool(npcId, context) ?? getDialoguePool(npcId, "greeting");
      if (!pool) return;
      const line = pickLine(pool, state.lastLines?.[npcId]);
      if (!line) return;
      const withLine = markLineShown(state, npcId, line);
      const raised = raiseFriendship(withLine, npcId, 1);
      persistStoryState(raised);
      sfx.tap?.();
      setNpcBubble({ npcLabel, line });
      clearTimeout(npcBubbleTimerRef.current);
      npcBubbleTimerRef.current = setTimeout(() => setNpcBubble(null), 5200);
    }

    const scene = new GroveScene(canvas, {
      startPosition: previewPark ? { x: -10.5, z: 16.8 } : SPAWN,
      avatarDescriptor: adaptLegacyDescriptor(character ?? {}),
      coins,
      onFade: (opacity) => setFadeOpacity(opacity),
      onInteriorChange: (info) => {
        setInterior(info);
        // Stepping inside somewhere for the first time is real story
        // progress (see story/beats.js chapter II) — recorded here rather
        // than inside the scene so all persisted progress has one owner.
        if (info?.active && info.id) {
          persistStoryState(visitInterior(createStoryState(), info.id));
        }
      },
      onInteractionPrompt: (p) => { promptWorldRef.current = p; setPrompt(p ? { text: p.text } : null); },
      onEconomyChange: (s) => setEconomy(s),
      onNpcInteract,
    });
    scene.setSfx(sfx);
    sceneRef.current = scene;
    if (typeof window !== "undefined") window.__grove = scene;
    if (previewMall) {
      scene.enterGroveMallPreview().then(() => {
        if (sceneRef.current === scene) setPreviewPerf(scene.perfSnapshot());
      });
    } else if (previewPark) {
      scene.previewCanopyParkView("overview");
      scene._assetsReady.then(() => {
        if (sceneRef.current === scene) setPreviewPerf(scene.perfSnapshot());
      });
    }

    const localUserId = userId ?? `local-${Math.random().toString(36).slice(2, 10)}`;
    userIdRef.current = localUserId;
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
        const district = districtAt(pos.x, pos.z);
        if (district.id !== lastDistrictId) {
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
        const peers = presence.getPeers();
        const active = new Set(peers.keys());
        let anchorIndex = 0;
        for (const [id, peer] of peers.entries()) {
          const descriptor = adaptLegacyDescriptor(peer.character ?? {});
          const group = scene.ensureRemoteAvatar(id, peer.visibility.mode, descriptor);
          if (Number.isFinite(peer.x) && Number.isFinite(peer.z) && (peer.x !== 0 || peer.z !== 0)) {
            group.position.set(peer.x, 0, peer.z);
            group.rotation.y = peer.heading;
          } else {
            // A peer we have presence for but no position yet: put them on
            // a real seat in the current district rather than at the world
            // origin, so co-presence always reads as somebody being
            // somewhere on purpose.
            const anchors = presenceAnchors(lastDistrictId ?? "hub");
            const a = anchors.length ? anchors[anchorIndex++ % anchors.length] : { x: 0, z: 6, rotY: 0 };
            group.position.set(a.x, 0, a.z);
            group.rotation.y = a.rotY ?? 0;
          }
        }
        scene.pruneRemoteAvatars(active);

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
      clearInterval(modeUiTimer);
      clearTimeout(npcBubbleTimerRef.current);
      leaveActiveMode();
      unsubscribe();
      presence.disconnect();
      scene.dispose();
    };
    // Intentionally run once per mount: character/user changes mid-session
    // are pushed via presence.setDisplayInfo in the effect below, not by
    // tearing down and rebuilding the whole scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onSettingsChanged(e) {
      setShowJoystick(!!(e.detail?.groveJoystick ?? readKindredSettings().groveJoystick));
    }
    window.addEventListener("kindred-settings-changed", onSettingsChanged);
    return () => window.removeEventListener("kindred-settings-changed", onSettingsChanged);
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

  function onJoystickChange(x, z) {
    sceneRef.current?.player.setTouchVector(x, z);
  }

  function onInteractPress() {
    sceneRef.current?.player.triggerInteract();
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
        {/* Compact district/status chip, top-left. Swaps to the current
            shop's name + NPC while indoors. */}
        <div className="grove-chip">
          <div className="grove-chip-district">{interior.active ? interior.label : currentDistrict.label}</div>
          <div className="grove-chip-meta">
            {interior.active
              ? (interior.metaLabel ?? (interior.npcLabel ? `${interior.npcLabel} is behind the counter` : "Browsing"))
              : `${LADDER_LABEL[ladderState]} · ${peerCount} nearby`}
          </div>
        </div>

        {/* Coin balance + carried item, top-right — always visible so a
            purchase's cost and a carry's "hands full" state are legible
            without opening any menu. */}
        <div className="grove-top-right">
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
        </div>

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
                onClick={() => sceneRef.current?.previewGroveMallFloor(floor)}
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

        {chatOpen && (
          <div className="grove-chat-panel">
            Chat is open with anyone nearby who has also opted in.
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
        {!interior.active && (
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

        {/* Touch "Interact" button — the tap equivalent of the E key, for
            the same proximity system (browse a shelf, confirm a purchase,
            place a carried item). Sits beside the joystick so both thumbs
            stay in one comfortable reach. */}
        <button
          className="grove-interact-btn"
          onClick={onInteractPress}
          aria-label="Interact"
        >
          {prompt ? "●" : "○"}
        </button>

        {/* On-screen joystick for touch devices; off by default (see
            Settings > Controls > "On-screen joystick"). WASD/arrow keys
            always work regardless of this setting (see PlayerController). */}
        {showJoystick && <TouchJoystick onChange={onJoystickChange} />}

        {/* NPC dialogue bubble: a short line + the speaker's name,
            triggered by walking up to an NPC in a district or a shop
            interior and pressing Interact (see onNpcInteract above). */}
        {npcBubble && (
          <div className="grove-npc-bubble" role="status">
            <div className="grove-npc-bubble-name">{npcBubble.npcLabel}</div>
            <div className="grove-npc-bubble-line">{npcBubble.line}</div>
          </div>
        )}

        {/* The story thread's daily invitation panel + soft-glow streak
            chip + story-beat toast (see story/StoryOverlay.jsx). `analysis`
            is left undefined here until a caller wires the journal
            analysis layer through GroveView's props; the overlay and its
            selector already degrade to a gentle neutral pool without it. */}
        <StoryOverlay analysis={analysis} open={storyOpen} onToggle={() => setStoryOpen((v) => !v)} />

        {/* Dismissible slide-in drawer: districts list or the active
            district mode's controls, layered over the game rather than
            sitting below it. */}
        {drawerTab && (
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
