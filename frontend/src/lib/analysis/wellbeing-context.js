/**
 * wellbeing-context.js — HOW HAVE THEY BEEN LATELY, in words a friend would hold
 * in mind (never said as numbers, never "the app has been tracking you").
 *
 * From analyseUser() (index.js):
 *   z = (theta - mu) / SD_STATIONARY,  SD_STATIONARY = sqrt(sigma^2 / 2 kappa) ≈ 2.46
 * how far the current latent state sits from this person's own baseline, in
 * units of their normal day-to-day swing. It is only described when
 *   |z| >= Z_NOTE  and  confidence >= MIN_CONFIDENCE
 * so a single odd day or thin history says nothing. A 28-day trend is added
 * only when its gate has passed (cold-start.js) and it is not "steady".
 * Recent entry emotions are listed as the person's own recent days.
 */

import { analyseUser } from "./index.js";
import { buildHistoryFromEntries } from "./entry-adapter.js";

export const WELLBEING_CONTEXT_VERSION = "wellbeing-context-2026.10.1";
export const SD_STATIONARY = Math.sqrt(1.1 ** 2 / (2 * 0.1));
export const Z_NOTE = 0.8;
export const MIN_CONFIDENCE = 0.35;

export function summariseWellbeing(analysis, recentEntries = []) {
  const parts = [];
  const latest = analysis?.latentState;
  if (latest && Number.isFinite(latest.theta) && Number.isFinite(analysis.mu) && (analysis.confidence ?? 0) >= MIN_CONFIDENCE) {
    const z = (latest.theta - analysis.mu) / SD_STATIONARY;
    if (z <= -Z_NOTE) parts.push(z <= -1.6 ? "They have been a lot lower than their usual lately." : "They have been a bit lower than their usual lately.");
    else if (z >= Z_NOTE) parts.push("They have been doing better than their usual lately.");
  }
  const dir = analysis?.trend?.window28?.direction;
  if (dir && !analysis.trend.window28.suppressedByGate && !["steady", "insufficient_data", "flat"].includes(dir)) {
    parts.push(/down|declin|wors/i.test(dir) ? "The last few weeks have been trending down." : /up|improv|better/i.test(dir) ? "The last few weeks have been trending up." : "");
  }
  const emotions = recentEntries.filter((e) => e && e.source !== "checkin" && e.emotion).slice(0, 4).map((e) => String(e.emotion).toLowerCase());
  if (emotions.length >= 2) parts.push(`Their last few entries felt: ${[...new Set(emotions)].join(", ")}.`);
  return parts.filter(Boolean).join(" ");
}

/** journalEntries are newest-first as stored by the app. */
export function wellbeingContextFor(journalEntries = [], context = {}) {
  try {
    const history = buildHistoryFromEntries(journalEntries);
    if (!history.length) return "";
    return summariseWellbeing(analyseUser(history, {}, context), journalEntries);
  } catch {
    return "";
  }
}
