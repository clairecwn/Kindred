// src/grove/story/storyState.js
//
// Persisted progress for the story thread, the daily task draw, and the
// soft-decay streak. Plain data + pure functions, matching the rest of
// grove/ — no React, no THREE — so it is trivially unit-testable and so
// GroveView can treat it as a small state machine it drives, not a black
// box.
//
// THE WELLBEING CONSTRAINT (non-negotiable, see docs/grove and the task
// brief): streaks decay softly and never reset to zero from a miss, every
// daily task is explicitly skippable with no penalty and no shaming copy,
// there is no leaderboard, and showing up is worth nearly as much as
// performing — a task marked "done" and a task marked "done, briefly"
// earn the same warmth credit. Nothing in this file is capable of taking
// the glow to exactly zero or of punishing a skip.

const STORAGE_KEY = "kindred.grove.story.v2";
const GLOW_FLOOR = 0.08; // the streak glow never fully goes out
const GLOW_DECAY_PER_DAY = 0.14; // soft dim per calendar day with no visit
const GLOW_RECOVERY = 1.0; // showing up restores full warmth immediately

import { NPC_IDS } from "./cast.js";

/** A fresh friendship ledger: one counter per resident, starting at zero
 * and only ever going up. There is deliberately no decay — the Design
 * Bible's "neglected relationships cool naturally" is expressed in the
 * dialogue pools (a `returning` line that explicitly refuses to make a
 * gap into a debt), never as a number ticking down while you are away. */
function blankFriendship() {
  return Object.fromEntries(NPC_IDS.map((id) => [id, 0]));
}

export function createStoryState() {
  const persisted = loadPersisted();
  return persisted ?? createStoryStateShape();
}

function loadPersisted() {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage?.getItem(STORAGE_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Defend against a shape from an older version of this module, and
    // against a cast that has grown since the save was written.
    const base = createStoryStateShape();
    return { ...base, ...parsed, friendship: { ...base.friendship, ...(parsed.friendship ?? {}) } };
  } catch {
    return null;
  }
}

function createStoryStateShape() {
  return {
    tasksCompleted: 0,
    tasksSkipped: 0,   // private curiosity counter, never surfaced as a shortfall
    districtsVisited: [],   // district ids, first-visit order
    interiorsVisited: [],   // interior ids (shops, the cottage) ever stepped into
    timesSat: 0,            // how often the player has used a seat/gathering spot
    friendship: blankFriendship(),
    seenBeatIds: [], lastVisitDate: null, glow: GLOW_FLOOR, recentTaskIds: [], lastLines: {},
  };
}

export function persistStoryState(state) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // best-effort only; the story loop still works in-memory this session
  }
}

function isoDay(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

function daysBetweenIso(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}

/**
 * Computes today's glow WITHOUT mutating state, given how many calendar
 * days have passed since the last visit. Used both to render the glow on
 * load (before any action today) and inside recordVisit() below.
 */
export function currentGlow(state, today = isoDay(new Date())) {
  if (!state.lastVisitDate) return GLOW_FLOOR;
  const gap = daysBetweenIso(state.lastVisitDate, today);
  if (gap <= 0) return state.glow; // already visited today, or a clock oddity
  const dimmed = state.glow - GLOW_DECAY_PER_DAY * gap;
  return Math.max(GLOW_FLOOR, dimmed);
}

/** Call once per session/day when the player opens Grove at all, whether
 * or not they complete a task — arriving already counts as showing up. */
export function recordVisit(state, today = isoDay(new Date())) {
  const dimmed = currentGlow(state, today);
  return { ...state, glow: Math.max(dimmed, state.lastVisitDate === today ? state.glow : dimmed), lastVisitDate: today };
}

/**
 * Marks a task complete. `substantial` distinguishes a longer engagement
 * from a one-line one for internal tuning ONLY — per the brief, a
 * one-line entry must earn nearly as much as a long one, so the glow and
 * progress bump are the same regardless; `substantial` does not change
 * either. It exists solely so a caller could log richer analytics later
 * without this module ever surfacing a "you only did the small version"
 * message.
 */
export function completeTask(state, taskId, { districtId, today } = {}) {
  const day = today ?? isoDay(new Date());
  const visited = recordVisit(state, day);
  const recentTaskIds = [taskId, ...visited.recentTaskIds].slice(0, 7);
  const districtsVisited = districtId && !visited.districtsVisited.includes(districtId)
    ? [...visited.districtsVisited, districtId]
    : visited.districtsVisited;
  return {
    ...visited,
    tasksCompleted: visited.tasksCompleted + 1,
    glow: GLOW_RECOVERY,
    recentTaskIds,
    districtsVisited,
  };
}

/** Skipping a task is a completely ordinary, cost-free action: it changes
 * nothing about progress, glow, or friendship. The only field it touches
 * is a private counter kept for the player's own future reflection, never
 * surfaced as a shortfall, streak break, or anything resembling failure. */
export function skipTask(state, today) {
  const day = today ?? isoDay(new Date());
  const visited = recordVisit(state, day);
  return { ...visited, tasksSkipped: visited.tasksSkipped + 1 };
}

/** Records that the player has been somewhere, first time only. Pure
 * geography — it never implies they should have gone sooner. */
export function visitDistrict(state, districtId) {
  if (!districtId || state.districtsVisited.includes(districtId)) return state;
  return { ...state, districtsVisited: [...state.districtsVisited, districtId] };
}

/** Records stepping inside a shop or the cottage, first time only. */
export function visitInterior(state, interiorId) {
  if (!interiorId || (state.interiorsVisited ?? []).includes(interiorId)) return state;
  return { ...state, interiorsVisited: [...(state.interiorsVisited ?? []), interiorId] };
}

/** Sitting down on a bench or joining a gathering circle. Counted only so
 * a couple of story beats can notice that the player has spent time being
 * present rather than productive — it unlocks nothing else, and is never
 * displayed as a total. */
export function recordSit(state) {
  return { ...state, timesSat: (state.timesSat ?? 0) + 1 };
}

export function raiseFriendship(state, npcId, amount = 1) {
  if (!npcId || !(npcId in state.friendship)) return state;
  return { ...state, friendship: { ...state.friendship, [npcId]: state.friendship[npcId] + amount } };
}

export function markBeatSeen(state, beatId) {
  if (state.seenBeatIds.includes(beatId)) return state;
  return { ...state, seenBeatIds: [...state.seenBeatIds, beatId] };
}

export function markLineShown(state, npcId, line) {
  return { ...state, lastLines: { ...state.lastLines, [npcId]: line } };
}

export const GLOW = Object.freeze({ FLOOR: GLOW_FLOOR, DECAY_PER_DAY: GLOW_DECAY_PER_DAY, RECOVERY: GLOW_RECOVERY });
