/**
 * deriveHomeState.js
 *
 * Turns real journal/check-in history into the two things Lanternfall
 * needs: which of the eleven lanterns are lit, and which of the three
 * scene states (steady / rough / flourishing) the sky should show.
 *
 * Honours the same cold-start gates as the rest of the app (src/lib/
 * analysis/cold-start.js) — with too little history this always reports
 * the neutral "steady" state rather than guessing at how the user is.
 */
import { analyseUser } from "../lib/analysis/index.js";

const UPBEAT_EMOTIONS = new Set(["happy", "excited", "grateful", "content"]);
const DOWN_EMOTIONS = new Set(["sad", "tired", "anxious", "angry"]);

function toHistoryDay(entry) {
  return {
    date: entry.date,
    itemScores: entry.source === "checkin" ? entry.itemScores : undefined,
    journalText: entry.source !== "checkin" ? entry.text : undefined,
  };
}

function fallbackFromEmotion(journalEntries) {
  const latest = journalEntries[journalEntries.length - 1];
  if (!latest?.emotion) return "steady";
  if (UPBEAT_EMOTIONS.has(latest.emotion)) return "flourishing";
  if (DOWN_EMOTIONS.has(latest.emotion)) return "rough";
  return "steady";
}

/**
 * @param {Array} journalEntries oldest-first or newest-first, either order
 *   (sorted internally by date).
 * @param {object|null} player
 * @returns {{ sky: "steady"|"rough"|"flourishing", lanternsLit: number,
 *   streak: number, confidence: number }}
 */
export function deriveHomeState(journalEntries = [], player = null) {
  const entries = Array.isArray(journalEntries) ? journalEntries : [];
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let sky = "steady";
  let confidence = 0;
  let gates = null;

  if (sorted.length) {
    const history = sorted.map(toHistoryDay);
    const today = history[history.length - 1];
    const past = history.slice(0, -1);
    let result = null;
    try {
      result = analyseUser(past, today, {});
    } catch {
      result = null;
    }

    if (result && !result.sayNothing) {
      gates = result.gates;
      confidence = result.confidence ?? 0;
      const band = result.todayScore?.band ?? null;
      if (band === "struggling") sky = "rough";
      else if (band === "flourishing") sky = "flourishing";
      else if (band === "navigating") sky = "steady";
      else if (gates?.trend && !result.trend?.window28?.suppressedByGate) {
        const dir = result.trend.window28?.direction;
        if (dir === "down") sky = "rough";
        else if (dir === "up") sky = "flourishing";
      } else {
        sky = fallbackFromEmotion(sorted);
      }
    }
  }

  const checkins = entries.filter((e) => e.source === "checkin").length;
  const journalOnly = entries.filter((e) => e.source !== "checkin").length;
  const goalSignals = (player?.goal ? 1 : 0) + (player?.goalAchieved ? 1 : 0);
  const lanternsLit = Math.max(0, Math.min(11, journalOnly + checkins + goalSignals));

  return { sky, lanternsLit, streak: computeStreak(entries), confidence, gates };
}

function computeStreak(journalEntries) {
  const days = new Set(journalEntries.map((e) => e.date));
  const cursor = new Date();
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
