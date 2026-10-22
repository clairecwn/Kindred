// src/grove/social/SocialLadder.js
//
// The graduated social exposure ladder described in
// docs/grove/GROVE-DESIGN-BIBLE.md, section 3, expressed as an explicit
// state machine. This module owns no rendering and no network code; it is
// pure state plus transition rules, so it can be unit tested on its own and
// reused by both the 3D scene (visibility filtering) and any 2D UI (privacy
// settings panel) without duplication.
//
// The one invariant every other module must respect: from ANY state, calling
// stepBack() returns to SOLO immediately, synchronously, with no dialogue and
// no delay. That is the safe-exit guarantee the design bible promises.

export const LadderState = Object.freeze({
  SOLO: "SOLO",       // no other real users rendered at all
  GHOST: "GHOST",     // other users visible only as soft, unnamed silhouettes
  AMBIENT: "AMBIENT", // full avatars visible, movement visible, no chat channel
  EMOTE: "EMOTE",     // fixed-vocabulary gestures available, still no free text
  CHAT: "CHAT",       // free text, mutual opt-in only, proximity-scoped
  GROUP: "GROUP",     // a small-group activity room (a game mode instance)
});

// Order matters: index reflects how much a state exposes, low to high. Used
// only for display ("how far up the ladder am I") and for the isAtLeast
// helper below; it is never surfaced to the user as a score.
const ORDER = [
  LadderState.SOLO,
  LadderState.GHOST,
  LadderState.AMBIENT,
  LadderState.EMOTE,
  LadderState.CHAT,
  LadderState.GROUP,
];

// Legal upward transitions. Every state can also always move to SOLO
// (the safe-exit invariant), which is enforced in stepBack() rather than
// listed here so it can never be accidentally omitted by editing this table.
const UPWARD_TRANSITIONS = {
  [LadderState.SOLO]:    [LadderState.GHOST, LadderState.AMBIENT],
  [LadderState.GHOST]:   [LadderState.AMBIENT],
  [LadderState.AMBIENT]: [LadderState.EMOTE, LadderState.CHAT],
  [LadderState.EMOTE]:   [LadderState.CHAT],
  [LadderState.CHAT]:    [LadderState.GROUP],
  [LadderState.GROUP]:   [],
};

// Plain, ordinary downward moves (one rung at a time or further), always
// allowed, always instant. Distinct from stepBack() only in that stepBack()
// is the *emergency* one-tap action; moveDown can target any lower rung
// explicitly (e.g. dropping from CHAT to AMBIENT to keep emotes off too).
function isDownwardMove(from, to) {
  return ORDER.indexOf(to) < ORDER.indexOf(from);
}

/**
 * Requirements that must hold before an upward transition is allowed.
 * These are checked by the caller (GroveView / PresenceClient) and passed
 * in as `context`, keeping this module free of any dependency on Supabase,
 * the DOM, or React. Each requirement is documented next to its state.
 */
function checkUpwardRequirement(from, to, context) {
  switch (to) {
    case LadderState.AMBIENT:
      // No requirement: any user may always be seen at ambient co-presence.
      // The hub itself has a ladderFloor of AMBIENT (see districts.js) so a
      // user can never hide below ambient while standing in the plaza.
      return { ok: true };

    case LadderState.EMOTE:
      // No requirement beyond already being at least ambient; emotes carry
      // almost none of the disclosure risk of free text, so this rung is
      // cheap to enter.
      return { ok: true };

    case LadderState.CHAT:
      // Mutual opt-in only: chat activates for a pair of users only when
      // BOTH have independently enabled "open to chat" in their settings.
      // context.selfChatOpen and context.otherChatOpen are booleans the
      // caller must supply, sourced from each user's own persisted setting.
      if (!context || context.selfChatOpen !== true) {
        return { ok: false, reason: "You have not turned on chat yet. It stays off until you choose otherwise." };
      }
      if (!context || context.otherChatOpen !== true) {
        return { ok: false, reason: "The other person has not opted into chat right now." };
      }
      return { ok: true };

    case LadderState.GROUP:
      // Entry is always explicit invite-and-accept or a public open table a
      // user chooses to sit at, never automatic matchmaking.
      if (!context || context.explicitJoin !== true) {
        return { ok: false, reason: "Group activities need an explicit invite accept or an open-table join, never an automatic pull." };
      }
      return { ok: true };

    default:
      return { ok: true };
  }
}

/**
 * Creates a fresh ladder for one user's session. `initial` defaults to
 * AMBIENT, one notch above the safest state, per the design bible: a
 * returning user is never asked to reconfigure privacy from scratch, but
 * also never silently defaults into a more exposed state than they chose
 * last time. Pass the user's own persisted default here if one exists.
 */
export function createSocialLadder(initial = LadderState.AMBIENT, listeners = []) {
  if (!ORDER.includes(initial)) {
    throw new Error(`Unknown initial ladder state: ${initial}`);
  }

  let state = initial;
  const subscribers = new Set(listeners);

  function notify(prev, next, reason) {
    for (const fn of subscribers) {
      try { fn(next, prev, reason); } catch (err) {
        // A subscriber's own error must never break the ladder itself.
        console.error("SocialLadder subscriber error:", err);
      }
    }
  }

  return {
    getState() { return state; },

    isAtLeast(target) {
      return ORDER.indexOf(state) >= ORDER.indexOf(target);
    },

    /**
     * Applies a PLACE's social floor (see each district's `ladderFloor` in
     * scene/worldLayout.js): walking into the Quiet Garden drops you to
     * GHOST, walking onto your own island drops you to SOLO.
     *
     * This can only ever move DOWN. A district may make you less exposed
     * by being there; no district may ever make you more exposed, because
     * that would be the game consenting on the player's behalf — exactly
     * the thing the ladder exists to prevent. Moving back up is always a
     * deliberate act by the player, wherever they happen to be standing.
     *
     * @returns {{ok: boolean, moved: boolean, from: string, to: string}}
     */
    applyPlaceFloor(floor) {
      if (!ORDER.includes(floor)) return { ok: false, moved: false, from: state, to: state };
      if (!isDownwardMove(state, floor)) return { ok: true, moved: false, from: state, to: state };
      const from = state;
      const result = this.transition(floor);
      return { ok: result.ok, moved: result.ok, from, to: state };
    },

    /**
     * Attempt to move to `target`. Returns { ok, reason? }. On success, the
     * internal state updates and subscribers are notified synchronously.
     * Downward moves (including to the current state) always succeed.
     */
    transition(target, context) {
      if (!ORDER.includes(target)) {
        return { ok: false, reason: `Unknown state: ${target}` };
      }
      if (target === state) {
        return { ok: true }; // no-op, already there
      }
      if (isDownwardMove(state, target)) {
        const prev = state;
        state = target;
        notify(prev, state, "down");
        return { ok: true };
      }
      // Upward move: must be a listed legal step (no skipping rungs, except
      // the explicit SOLO->AMBIENT convenience for a returning user's saved
      // default) and must satisfy that rung's requirement.
      const legalTargets = UPWARD_TRANSITIONS[state] ?? [];
      if (!legalTargets.includes(target)) {
        return { ok: false, reason: `Cannot move from ${state} directly to ${target}.` };
      }
      const requirement = checkUpwardRequirement(state, target, context);
      if (!requirement.ok) {
        return requirement;
      }
      const prev = state;
      state = target;
      notify(prev, state, "up");
      return { ok: true };
    },

    /**
     * The safe-exit invariant: always available, always instant, always
     * succeeds, from any state. No confirmation, no delay long enough for
     * another user to notice and comment on the exit.
     */
    stepBack() {
      const prev = state;
      state = LadderState.SOLO;
      notify(prev, state, "step-back");
      return { ok: true };
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

/**
 * Visibility filter applied to a remote user's presence record before it is
 * ever handed to the renderer. This is the client-side half of ghost mode:
 * PresenceClient calls this for every remote peer on every tick, and the
 * renderer only ever sees the filtered result, never the raw record. Ghost
 * mode is symmetric by construction: if either party's effective ladder
 * state (the lower of the two, since visibility can never exceed what the
 * more private party allows) is GHOST or below, both sides render each
 * other as ghosts, never as full avatars.
 */
export function effectiveVisibility(selfState, otherState) {
  const selfIdx = ORDER.indexOf(selfState);
  const otherIdx = ORDER.indexOf(otherState);
  const lower = ORDER[Math.min(selfIdx, otherIdx)];

  if (lower === LadderState.SOLO) {
    return { render: false, mode: "hidden", chatEnabled: false, emotesEnabled: false };
  }
  if (lower === LadderState.GHOST) {
    return { render: true, mode: "ghost", chatEnabled: false, emotesEnabled: false };
  }
  if (lower === LadderState.AMBIENT) {
    return { render: true, mode: "full", chatEnabled: false, emotesEnabled: false };
  }
  if (lower === LadderState.EMOTE) {
    return { render: true, mode: "full", chatEnabled: false, emotesEnabled: true };
  }
  // CHAT or GROUP
  return { render: true, mode: "full", chatEnabled: true, emotesEnabled: true };
}
