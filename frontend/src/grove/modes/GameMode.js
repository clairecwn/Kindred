// src/grove/modes/GameMode.js
//
// The common interface every Grove game mode implements, per design bible
// section 4: "All five modes share three properties: they can be joined
// without giving anything up in the private-progression sense, a player can
// be idle or leave mid-round without punishing the remaining players, and
// none of them post a leaderboard visible outside the immediate table."
//
// This file has no Three.js and no Supabase dependency on purpose: game
// logic should be testable and reusable independent of rendering or
// networking, matching the pattern already used by SocialLadder.js.
//
// A mode module exports a single factory, `createXMode(opts)`, that returns
// an object satisfying this shape:
//
//   {
//     id: string,                 // matches districts.js `minigame` field
//     join(userId, meta),         // add a participant; never rejects a solo
//                                  // player (every mode is at least
//                                  // solo-playable per the design bible)
//     leave(userId),              // remove a participant; never voids the
//                                  // remaining participants' progress
//     update(dt, now),            // advance simulation by dt seconds;
//                                  // `now` is a monotonic ms timestamp
//                                  // (performance.now()) for phase-locked
//                                  // effects (e.g. synced breathing)
//     getState(),                 // plain-object snapshot for rendering/UI,
//                                  // never includes any competitive rank
//     isActive(),                 // true once at least one participant has
//                                  // joined
//     dispose(),                  // release timers/listeners
//   }
//
// `validateMode` is a light runtime check used by the mode registry so a
// mode missing part of the contract fails fast and obviously in dev rather
// than silently misbehaving once wired into GroveView.

const REQUIRED_METHODS = ["join", "leave", "update", "getState", "isActive", "dispose"];

export function validateMode(mode, sourceLabel = "unknown mode") {
  if (!mode || typeof mode !== "object") {
    throw new Error(`${sourceLabel}: createXMode() must return an object`);
  }
  if (typeof mode.id !== "string" || mode.id.length === 0) {
    throw new Error(`${sourceLabel}: mode must have a string 'id'`);
  }
  for (const method of REQUIRED_METHODS) {
    if (typeof mode[method] !== "function") {
      throw new Error(`${sourceLabel}: mode '${mode.id}' is missing required method '${method}'`);
    }
  }
  return mode;
}

/**
 * Small shared helper: every mode's participant map follows the same
 * shape (userId -> arbitrary per-mode meta plus a joinedAt timestamp), so
 * this is factored out rather than reimplemented per mode.
 */
export function createParticipantRoster() {
  const participants = new Map();
  return {
    add(userId, meta = {}) {
      if (participants.has(userId)) {
        participants.set(userId, { ...participants.get(userId), ...meta });
        return;
      }
      participants.set(userId, { joinedAt: Date.now(), ...meta });
    },
    remove(userId) {
      participants.delete(userId);
    },
    has(userId) {
      return participants.has(userId);
    },
    get(userId) {
      return participants.get(userId);
    },
    size() {
      return participants.size;
    },
    entries() {
      return participants.entries();
    },
    ids() {
      return Array.from(participants.keys());
    },
    clear() {
      participants.clear();
    },
  };
}
