// src/grove/modes/QuietRoundMode.js
//
// "The Quiet Round" — Quiet Garden district, design bible section 4.5.
// 1 to 3 players, entirely optional shared silence. No chat, no objective,
// no win condition. Players who opt in get a slow breathing-guide phase
// that is loosely synced across everyone currently in the round (a shared
// clock, not a leader-follower handshake, so there is nothing to desync
// when someone leaves). Any participant standing up ends only their own
// animation; the others continue undisturbed, matching the "graceful
// mid-session exit" rule.

import { validateMode, createParticipantRoster } from "./GameMode.js";

const BREATH_CYCLE_MS = 8000; // inhale+exhale, slow and calm on purpose
const MIN_TOGETHER_MS = 2000; // below this we don't bother marking a
                                // "together" moment, avoids noise from a
                                // user who joins and immediately leaves

export function createQuietRoundMode({ districtId = "garden" } = {}) {
  const roster = createParticipantRoster();
  let startedAt = null;

  const mode = {
    id: "quiet-round",
    districtId,

    join(userId, meta = {}) {
      if (!startedAt) startedAt = Date.now();
      roster.add(userId, { breathingEnabled: true, ...meta });
    },

    leave(userId) {
      roster.remove(userId);
      if (roster.size() === 0) startedAt = null;
    },

    /** Toggle whether one participant's own avatar plays the breathing
     * animation, without affecting anyone else's. Standing up (false) never
     * removes them from the round; they can still sit quietly unsynced. */
    setBreathing(userId, enabled) {
      if (!roster.has(userId)) return;
      roster.add(userId, { breathingEnabled: enabled });
    },

    update(_dt, now = performance.now()) {
      // Pure phase-lock: every participant reads the same shared clock, so
      // there is no per-participant drift to correct and nothing breaks
      // when someone joins mid-cycle or leaves.
      this._phase = (now % BREATH_CYCLE_MS) / BREATH_CYCLE_MS; // 0..1
    },

    /** 0..1 sine-eased breathing scale, meant to drive a subtle avatar
     * scale-Y or chest-rise animation. 0.5 is neutral (resting) size. */
    getBreathScale() {
      const phase = this._phase ?? 0;
      return 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
    },

    getState() {
      return {
        id: "quiet-round",
        districtId,
        startedAt,
        breathPhase: this._phase ?? 0,
        breathScale: this.getBreathScale(),
        participants: roster.ids().map((id) => ({
          userId: id,
          breathingEnabled: roster.get(id)?.breathingEnabled !== false,
          togetherMs: startedAt ? Math.max(0, Date.now() - (roster.get(id)?.joinedAt ?? Date.now())) : 0,
        })),
      };
    },

    isActive() {
      return roster.size() > 0;
    },

    /** Whether it is even meaningful to show a "you sat with someone"
     * warm note in the UI — never a stat, never a score, just a fact. */
    hadCompanySince(userId) {
      const self = roster.get(userId);
      if (!self) return false;
      return roster.size() > 1 && (Date.now() - self.joinedAt) > MIN_TOGETHER_MS;
    },

    dispose() {
      roster.clear();
      startedAt = null;
    },
  };

  return validateMode(mode, "QuietRoundMode");
}
