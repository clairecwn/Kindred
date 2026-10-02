// src/grove/net/PresenceClient.js
//
// Supabase Realtime presence + broadcast wrapper for Grove. Handles:
//   - tracking the local player's position/heading/ladder state as presence
//   - broadcasting frequent position updates on a fixed tick, separate from
//     presence (presence is for join/leave and metadata, broadcast is for
//     high-frequency movement, which is the standard Realtime pattern)
//   - interpolating remote players' positions between network updates so
//     movement looks smooth despite the tick rate being much lower than the
//     render frame rate
//   - applying the ghost-mode visibility filter from SocialLadder client
//     side, so a remote peer's exact position/appearance is still received
//     (Realtime has no server-side per-viewer filtering) but the renderer
//     is only ever given the filtered view
//
// This module imports the existing Supabase client from src/lib/supabase.js
// rather than creating a new one, so Grove shares the app's single
// connection and auth session.

import { supabase } from "../../lib/supabase.js";
import { effectiveVisibility, LadderState } from "../social/SocialLadder.js";

// Broadcast tick rate: how often we SEND our own position. 10 Hz keeps
// bandwidth low (a few dozen bytes per message) while staying well above
// the ~2-3 Hz that starts to look laggy once interpolated. Presence itself
// updates far less often (only on join/leave/ladder-state change).
export const TICK_RATE_HZ = 10;
const TICK_INTERVAL_MS = 1000 / TICK_RATE_HZ;

// How long we keep interpolating toward a remote peer's last known target
// before we consider them stalled (e.g. a dropped connection) and freeze
// them in place rather than extrapolating wildly off-screen.
const STALE_AFTER_MS = 2000;

/**
 * One remote peer's interpolation state. We keep both the last received
 * "from" snapshot and the newest "to" snapshot, and interpolate the
 * rendered position between them over the wall-clock gap between the two
 * updates, rather than snapping instantly on every tick.
 */
function makeRemotePeer(initial) {
  const now = performance.now();
  return {
    userId: initial.userId,
    displayName: initial.displayName ?? null,
    character: initial.character ?? null,
    ladderState: initial.ladderState ?? LadderState.AMBIENT,
    from: { x: initial.x, z: initial.z, heading: initial.heading, t: now },
    to: { x: initial.x, z: initial.z, heading: initial.heading, t: now },
    lastUpdateAt: now,
  };
}

/**
 * Creates a presence client for one Grove session.
 *
 * @param {object} opts
 * @param {string} opts.roomId - logical room/channel name, e.g. "grove-hub".
 *   Districts share one channel (the whole plaza is one social space); pass
 *   a distinct roomId only for isolated instances such as a GROUP activity.
 * @param {string} opts.userId - the local user's stable id.
 * @param {() => string} opts.getLadderState - returns the local user's
 *   current SocialLadder state, read fresh on every broadcast tick.
 * @param {(peers: Map<string, object>) => void} opts.onPeersChanged -
 *   called after any peer is added, updated, or removed, with the full
 *   filtered peer map keyed by userId. Values carry only what the renderer
 *   needs: { userId, displayName, character, x, z, heading, visibility }.
 */
export function createPresenceClient({ roomId, userId, getLadderState, onPeersChanged }) {
  if (!supabase) {
    // Local-only / offline mode (see isLocalOnly in lib/supabase.js): return
    // a no-op client so GroveView can run single-player without branching
    // its own code on whether Supabase is configured.
    return {
      connect() {},
      disconnect() {},
      updateLocalPosition() {},
      setDisplayInfo() {},
      getPeers: () => new Map(),
    };
  }

  const channel = supabase.channel(`grove:${roomId}`, {
    config: { presence: { key: userId }, broadcast: { self: false, ack: false } },
  });

  /** @type {Map<string, ReturnType<typeof makeRemotePeer>>} */
  const remotePeers = new Map();

  let localX = 0, localZ = 0, localHeading = 0;
  let localDisplayName = null;
  let localCharacter = null;
  let tickHandle = null;
  let connected = false;

  function emitPeers() {
    const filtered = new Map();
    const selfState = getLadderState();
    for (const [id, peer] of remotePeers.entries()) {
      const visibility = effectiveVisibility(selfState, peer.ladderState);
      if (!visibility.render) continue;

      // Interpolate between the last two received snapshots based on
      // wall-clock progress, clamped to [0,1] so a stale peer just holds
      // their last position rather than sliding forever.
      const now = performance.now();
      const span = Math.max(1, peer.to.t - peer.from.t);
      const raw = (now - peer.from.t) / span;
      const alpha = Math.max(0, Math.min(1, raw));
      const stale = now - peer.lastUpdateAt > STALE_AFTER_MS;

      const x = stale ? peer.to.x : lerp(peer.from.x, peer.to.x, alpha);
      const z = stale ? peer.to.z : lerp(peer.from.z, peer.to.z, alpha);
      const heading = stale ? peer.to.heading : lerpAngle(peer.from.heading, peer.to.heading, alpha);

      filtered.set(id, {
        userId: id,
        displayName: visibility.mode === "ghost" ? null : peer.displayName,
        character: visibility.mode === "ghost" ? null : peer.character,
        x, z, heading,
        visibility, // { render, mode: "ghost"|"full", chatEnabled, emotesEnabled }
        stale,
      });
    }
    onPeersChanged(filtered);
  }

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      // Reconcile: presence gives us metadata (ladder state, display name,
      // character) but not high-frequency position, which arrives via
      // broadcast separately. A peer can appear in presence before their
      // first broadcast lands; we seed them at (0,0) until then.
      const seenIds = new Set();
      for (const key of Object.keys(state)) {
        if (key === userId) continue;
        const entries = state[key];
        const meta = entries?.[0];
        if (!meta) continue;
        seenIds.add(key);
        const existing = remotePeers.get(key);
        if (existing) {
          existing.displayName = meta.displayName ?? existing.displayName;
          existing.character = meta.character ?? existing.character;
          existing.ladderState = meta.ladderState ?? existing.ladderState;
        } else {
          remotePeers.set(key, makeRemotePeer({
            userId: key,
            displayName: meta.displayName,
            character: meta.character,
            ladderState: meta.ladderState,
            x: 0, z: 0, heading: 0,
          }));
        }
      }
      // Remove anyone no longer present at all (they closed the app/tab).
      for (const key of Array.from(remotePeers.keys())) {
        if (!seenIds.has(key)) remotePeers.delete(key);
      }
      emitPeers();
    })
    .on("broadcast", { event: "move" }, ({ payload }) => {
      if (!payload || payload.userId === userId) return;
      const peer = remotePeers.get(payload.userId);
      if (!peer) return; // presence sync should have created it first
      const now = performance.now();
      peer.from = { x: peer.to.x, z: peer.to.z, heading: peer.to.heading, t: peer.lastUpdateAt || now };
      peer.to = { x: payload.x, z: payload.z, heading: payload.heading, t: now };
      peer.lastUpdateAt = now;
      // Position updates are far more frequent than we want to re-render
      // the peer list for; the render loop reads interpolated positions
      // every frame via getPeers() rather than us calling emitPeers() here
      // on every single broadcast. See GroveScene's render loop.
    });

  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpAngle(a, b, t) {
    // Shortest-path angle interpolation so a peer turning from, say, 350deg
    // to 10deg spins the short way (through 360/0) rather than the long way.
    let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  return {
    async connect() {
      await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          connected = true;
          await channel.track({
            displayName: localDisplayName,
            character: localCharacter,
            ladderState: getLadderState(),
          });
          tickHandle = setInterval(() => {
            if (!connected) return;
            channel.send({
              type: "broadcast",
              event: "move",
              payload: { userId, x: localX, z: localZ, heading: localHeading },
            });
          }, TICK_INTERVAL_MS);
        }
      });
    },

    disconnect() {
      connected = false;
      if (tickHandle) clearInterval(tickHandle);
      tickHandle = null;
      supabase.removeChannel(channel);
      remotePeers.clear();
    },

    /** Called every render frame by PlayerController; cheap, no network I/O
     * happens here directly, it only updates the values the tick interval
     * reads on its own schedule. */
    updateLocalPosition(x, z, heading) {
      localX = x; localZ = z; localHeading = heading;
    },

    /** Call when display name, character appearance, or ladder state
     * changes, so peers see updated metadata via presence (not broadcast,
     * since these change rarely compared to position). */
    async setDisplayInfo({ displayName, character, ladderState } = {}) {
      if (displayName !== undefined) localDisplayName = displayName;
      if (character !== undefined) localCharacter = character;
      if (!connected) return;
      await channel.track({
        displayName: localDisplayName,
        character: localCharacter,
        ladderState: ladderState ?? getLadderState(),
      });
    },

    /** Returns the current interpolated, visibility-filtered peer map.
     * Call this from the render loop (every frame) rather than relying only
     * on emitPeers, since interpolation progresses continuously with time
     * even between network messages. */
    getPeers() {
      const now = performance.now();
      const result = new Map();
      const selfState = getLadderState();
      for (const [id, peer] of remotePeers.entries()) {
        const visibility = effectiveVisibility(selfState, peer.ladderState);
        if (!visibility.render) continue;
        const span = Math.max(1, peer.to.t - peer.from.t);
        const alpha = Math.max(0, Math.min(1, (now - peer.from.t) / span));
        const stale = now - peer.lastUpdateAt > STALE_AFTER_MS;
        result.set(id, {
          userId: id,
          displayName: visibility.mode === "ghost" ? null : peer.displayName,
          character: visibility.mode === "ghost" ? null : peer.character,
          x: stale ? peer.to.x : lerp(peer.from.x, peer.to.x, alpha),
          z: stale ? peer.to.z : lerp(peer.from.z, peer.to.z, alpha),
          heading: stale ? peer.to.heading : lerpAngle(peer.from.heading, peer.to.heading, alpha),
          visibility,
          stale,
        });
      }
      return result;
    },
  };
}
