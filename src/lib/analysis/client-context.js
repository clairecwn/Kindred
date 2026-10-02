/**
 * client-context.js
 *
 * Builds the soft, non-identity context object cultural-calibration.js and
 * index.js's analyseUser() expect, from signals the browser already has.
 * Kindred NEVER asks a user to declare ethnicity and never stores one —
 * every signal here is a proxy (device locale, coarse timezone-derived
 * region, journaling-language guess from the entry text itself), always
 * capped at low confidence by cultural-calibration.js's inferCluster().
 */

import { identifyVariety } from "./dialect/index.js";

// Coarse timezone -> region-hint string, used the same way an opt-in region
// field would be (cultural-calibration.js only pattern-matches on a few
// region names). This is a olson-zone continent/city bucket, not a country.
const TIMEZONE_REGION_HINTS = Object.freeze([
  { pattern: /^Asia\/(Tokyo)/, region: "japan" },
  { pattern: /^Asia\/(Seoul)/, region: "korea" },
  { pattern: /^Asia\/(Shanghai|Chongqing|Harbin|Urumqi|Hong_Kong|Macau)/, region: "china" },
  { pattern: /^Asia\/Taipei/, region: "taiwan" },
  { pattern: /^Asia\/(Singapore|Kuala_Lumpur|Jakarta|Bangkok|Ho_Chi_Minh|Vientiane|Phnom_Penh)/, region: "asia-east" },
  { pattern: /^Asia\/(Kolkata|Calcutta|Colombo|Dhaka|Kathmandu|Karachi)/, region: "south-asia" },
  { pattern: /^Europe\/(London|Dublin)/, region: "uk" },
  { pattern: /^Europe\//, region: "europe" },
  { pattern: /^(America|US)\//, region: "north-america" },
  { pattern: /^Africa\//, region: "africa" },
  { pattern: /^Australia\//, region: "oceania" },
]);

/** Very rough script-range check for CJK text, used only as a hint alongside locale. */
function detectJournalLanguageHint(text) {
  if (!text) return null;
  if (/[぀-ヿㇰ-ㇿ]/.test(text)) return "ja"; // hiragana/katakana
  if (/[가-힯]/.test(text)) return "ko"; // hangul
  if (/[一-鿿]/.test(text)) return "zh"; // han
  const variety = identifyVariety(text).variety;
  if (variety) return variety;
  return null;
}

/**
 * @param {string} [journalText] - today's entry text, if any, used only for
 *   a same-script language hint (never sent anywhere, never stored as an
 *   identity signal).
 * @returns {{ locale: string, region: string|null, journalLanguageHint: string|null }}
 */
export function buildClientCulturalContext(journalText = "") {
  let locale = "en";
  let region = null;
  try {
    locale = (typeof navigator !== "undefined" && navigator.language) || "en";
  } catch { /* non-browser environment (tests, SSR) */ }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const hit = TIMEZONE_REGION_HINTS.find((h) => h.pattern.test(tz));
    if (hit) region = hit.region;
  } catch { /* Intl unavailable */ }

  return {
    locale,
    region,
    journalLanguageHint: detectJournalLanguageHint(journalText),
  };
}


/**
 * The travelling problem.
 *
 * buildClientCulturalContext() above reads the timezone RIGHT NOW, which is
 * wrong the moment somebody goes on holiday: two weeks in London would quietly
 * recalibrate a Singaporean against British norms. residency.js keeps a rolling
 * window of daily observations and only treats a place as home once it has
 * actually accumulated, with hysteresis so a trip cannot displace it.
 *
 * Call observeToday() once per session, persist the returned state, and use
 * buildStableCulturalContext() everywhere the raw one was used before.
 */
import {
  recordObservation, resolveResidency, residencyToCulturalContext,
} from "./residency.js";

/**
 * Fold today's browser signals into the stored residency state.
 * @param {object} storedState previously persisted residency state, or {}
 * @param {string} [journalText] used only for a same-script writing hint
 */
export function observeToday(storedState = {}, journalText = "") {
  const raw = buildClientCulturalContext(journalText);
  const next = recordObservation(storedState, {
    region: raw.region,
    locale: raw.locale,
    variety: raw.journalLanguageHint,
  });
  const resolved = resolveResidency(next);
  // Persist the resolved home so the hysteresis has an incumbent to defend.
  return { ...next, homeRegion: resolved.homeRegion };
}

/**
 * The context cultural-calibration.js should actually be given: region from
 * where the user LIVES, not where their phone is today, plus a confidence the
 * caller widens its uncertainty against, and a travelling flag.
 */
export function buildStableCulturalContext(storedState = {}, journalText = "") {
  const raw = buildClientCulturalContext(journalText);
  const resolved = resolveResidency(storedState);
  return residencyToCulturalContext(resolved, raw);
}
