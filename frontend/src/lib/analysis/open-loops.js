/**
 * open-loops.js — THINGS A FRIEND WOULD ASK ABOUT LATER.
 *
 * "presentation fri", "exam tmr", "going to see my grandma this weekend".
 * A friend remembers and asks how it went. Each loop is
 *   { what, quote, entryDate, due, sourceId, source: "interpreter"|"pattern" }
 * built from the user's own text: the interpreter's followUps (any wording,
 * validated against the user's text) plus a pattern fallback for common
 * forms. A loop is RESOLVED once a later entry mentions it on or after its
 * due date, or the person already talked about it in that conversation.
 *
 * Dates come from the entry's own date, never the clock, so this is
 * deterministic; the caller passes `today` when asking what is due.
 */

export const OPEN_LOOPS_VERSION = "open-loops-2026.10.1";
const DAY = 86_400_000;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const EVENT = "exams?|tests?|quiz(?:zes)?|presentations?|prez|pres|interviews?|match(?:es)?|games?|recitals?|concerts?|performances?|auditions?|competitions?|comps?|appointments?|deadlines?|submissions?|parties|party|birthday|trip|outing|camp|race|tryouts?|try-outs?|results?|orals?|spelling bee|sports day|speech|show and tell|first day|date|meeting";
const WHEN = "tmr|tmrw|tomorrow|tonight|later|today|this (?:weekend|week|afternoon|evening)|next (?:week|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)|on (?:mon|tue|wed|thu|fri|sat|sun)[a-z]*|(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day)?";
const PATTERN = new RegExp(`\\b(?:(?:my|the|got|have|has|a|an|our)\\s+)?(${EVENT})\\b[^.!?\\n]{0,30}?\\b(${WHEN})\\b|\\b(${WHEN})\\b[^.!?\\n]{0,20}?\\b(?:got|have|has|is|my|the)?\\s*(${EVENT})\\b`, "gi");

function toTime(date) {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : NaN;
}
const iso = (t) => new Date(t).toISOString().slice(0, 10);

/** Resolve a "when" phrase relative to the entry date. Unknown -> +3 days. */
export function resolveWhen(when, entryDate) {
  const base = toTime(entryDate);
  if (!Number.isFinite(base)) return null;
  const w = String(when ?? "").toLowerCase().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w;
  if (/^(?:today|tonight|later|this (?:afternoon|evening))$/.test(w)) return iso(base);
  if (/^(?:tmr|tmrw|tomorrow)$/.test(w)) return iso(base + DAY);
  if (w === "this week") return iso(base + 3 * DAY);
  if (w === "next week") return iso(base + 7 * DAY);
  if (w === "this weekend") {
    const dow = new Date(base).getUTCDay();
    return iso(base + ((6 - dow + 7) % 7 || 7) * DAY);
  }
  const day = WEEKDAYS.findIndex((d) => w.replace(/^(?:on|next)\s+/, "").startsWith(d));
  if (day !== -1) {
    const dow = new Date(base).getUTCDay();
    const ahead = ((day - dow + 7) % 7) || 7;
    return iso(base + (ahead + (w.startsWith("next ") && ahead < 7 ? 7 : 0)) * DAY);
  }
  return iso(base + 3 * DAY);
}

/** Pattern fallback over one user-authored text. */
export function patternLoops(text, entryDate, sourceId) {
  const out = [];
  for (const m of String(text ?? "").matchAll(PATTERN)) {
    const what = (m[1] ?? m[4] ?? "").toLowerCase();
    const when = (m[2] ?? m[3] ?? "").toLowerCase();
    if (!what || !when) continue;
    const due = resolveWhen(when, entryDate);
    if (due) out.push({ what, when, quote: m[0].trim().slice(0, 120), entryDate, due, sourceId, source: "pattern" });
  }
  return out;
}

/** Validate interpreter followUps: the quote must be the user's own words. */
export function validateFollowUps(raw, text, entryDate, sourceId) {
  const lower = String(text ?? "").toLowerCase();
  return (Array.isArray(raw) ? raw : []).slice(0, 4).flatMap((item) => {
    const quote = String(item?.quote ?? "").toLowerCase().trim();
    const what = String(item?.what ?? "").toLowerCase().trim().slice(0, 60);
    if (!quote || !what || !lower.includes(quote)) return [];
    const due = resolveWhen(item?.when, entryDate);
    return due ? [{ what, when: String(item?.when ?? ""), quote: quote.slice(0, 120), entryDate, due, sourceId, source: "interpreter" }] : [];
  });
}

const userTextsOf = (entry) => [String(entry?.text ?? ""), ...(Array.isArray(entry?.aiChat) ? entry.aiChat : [])
  .filter((t) => t?.role === "user" && !t.isJournal).map((t) => String(t.text ?? ""))];

function mentions(texts, what) {
  const key = what.split(/\s+/).filter((w) => w.length > 2)[0] ?? what;
  const stem = key.replace(/(?:es|s)$/, "");
  return texts.some((t) => t.toLowerCase().includes(stem));
}

/** All loops from saved entries, each marked resolved or open. */
export function buildOpenLoops(entries = []) {
  const sorted = [...entries].filter((e) => e && e.source !== "checkin" && e.date).sort((a, b) => toTime(a.date) - toTime(b.date));
  const loops = [];
  for (const entry of sorted) {
    const found = [...(entry.followUps ?? []), ...userTextsOf(entry).flatMap((t) => patternLoops(t, entry.date, entry.id))];
    const seen = new Set();
    for (const loop of found) {
      const key = `${loop.what}|${loop.due}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const later = sorted.filter((e) => toTime(e.date) >= toTime(loop.due) && e.id !== entry.id);
      const resolved = later.some((e) => mentions(userTextsOf(e), loop.what));
      loops.push({ ...loop, resolved });
    }
  }
  return loops.slice(-40);
}

/** Loops worth raising today: due in the last few days (how did it go?) or very soon. */
export function dueLoops(loops = [], today, { pastDays = 4, aheadDays = 1 } = {}) {
  const now = toTime(today);
  if (!Number.isFinite(now)) return [];
  return loops.filter((loop) => !loop.resolved).map((loop) => ({ ...loop, daysFromDue: Math.round((now - toTime(loop.due)) / DAY) }))
    .filter((loop) => loop.daysFromDue <= pastDays && loop.daysFromDue >= -aheadDays)
    .sort((a, b) => Math.abs(a.daysFromDue) - Math.abs(b.daysFromDue)).slice(0, 2);
}
