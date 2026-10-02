/**
 * residency.js
 *
 * Decides which cultural cluster to calibrate against, from signals that stay
 * stable when a user travels.
 *
 * The problem this solves: cultural-calibration.js infers a cluster partly from
 * the device timezone. A Singaporean on a two week holiday in London would be
 * recalibrated as British halfway through the trip, and their journal would
 * suddenly be read against the wrong norms. Somebody who has actually
 * emigrated, on the other hand, genuinely should drift over months.
 *
 * The rule, in one line: location only counts once you have been somewhere long
 * enough for it to be where you live, and how you write outranks where you are.
 *
 * Nothing here stores or infers an ethnicity. The observations are a coarse
 * region bucket, a device locale and a writing-variety tag, all of which the
 * user can override with a plain "where do you feel at home" choice.
 */

/** Days of observations kept. Older entries are dropped on write. */
export const WINDOW_DAYS = 180;

/**
 * A region has to be observed on at least this many distinct days inside the
 * window before it can be treated as home at all. Set above any normal holiday
 * or work trip, below a semester abroad.
 */
export const MIN_DAYS_TO_ESTABLISH = 45;

/**
 * To DISPLACE an established home region, a challenger needs both a run of
 * consecutive days and a clear margin over the incumbent. Two thresholds
 * rather than one, so a long trip with a gap in the middle does not qualify.
 */
export const MIN_CONSECUTIVE_DAYS_TO_DISPLACE = 60;
export const DISPLACE_MARGIN_DAYS = 20;

/**
 * An unbroken run this long is a relocation on its own terms, whatever the
 * day counts say. Without this, someone who moves abroad stays mislabelled
 * until the old country ages out of the window, which takes months longer
 * than it should.
 */
export const RUN_ALONE_DISPLACES = 90;

/** Below this many observed days in total, nothing is confident. */
export const MIN_DAYS_FOR_ANY_CLAIM = 14;

const DAY_MS = 86400000;

function dayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

/** @typedef {{day:string, region:string|null, locale:string|null, variety:string|null}} Observation */

/**
 * Record today's signals. One observation per calendar day; calling this
 * repeatedly in a day overwrites rather than inflating the counts, so an
 * enthusiastic journaller does not out-vote a quiet one.
 *
 * @param {{observations?: Observation[], homeRegion?: string|null, homeSince?: string|null, override?: string|null}} state
 * @param {{region?: string|null, locale?: string|null, variety?: string|null, now?: number}} signals
 */
export function recordObservation(state = {}, signals = {}) {
  const now = signals.now ?? Date.now();
  const day = dayKey(now);
  const prior = Array.isArray(state.observations) ? state.observations : [];
  const cutoff = dayKey(now - WINDOW_DAYS * DAY_MS);

  const kept = prior.filter((o) => o && o.day && o.day >= cutoff && o.day !== day);
  kept.push({
    day,
    region: signals.region ?? null,
    locale: signals.locale ?? null,
    variety: signals.variety ?? null,
  });
  kept.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  return { ...state, observations: kept };
}

function countDaysByRegion(observations) {
  const counts = new Map();
  for (const o of observations) {
    if (!o.region) continue;
    counts.set(o.region, (counts.get(o.region) ?? 0) + 1);
  }
  return counts;
}

/** Longest run of consecutive calendar days ending at the most recent observation. */
function trailingRun(observations, region) {
  let run = 0;
  for (let i = observations.length - 1; i >= 0; i -= 1) {
    if (observations[i].region !== region) break;
    run += 1;
  }
  return run;
}

function modeOf(values) {
  const counts = new Map();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = null;
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) { best = v; bestN = n; }
  }
  return best;
}

/**
 * Work out where the user actually lives, whether they are currently away, and
 * which signals should drive calibration.
 *
 * @param {{observations?: Observation[], homeRegion?: string|null, override?: string|null}} state
 * @returns {{
 *   homeRegion: string|null,
 *   currentRegion: string|null,
 *   travelling: boolean,
 *   daysObserved: number,
 *   confidence: number,
 *   writingVariety: string|null,
 *   homeLocale: string|null,
 *   source: 'override'|'residency'|'insufficient'
 * }}
 */
export function resolveResidency(state = {}) {
  const observations = Array.isArray(state.observations) ? state.observations : [];
  const daysObserved = observations.length;
  const latest = observations[observations.length - 1] ?? null;
  const currentRegion = latest?.region ?? null;

  // How someone writes is a far more stable signal than where their phone is,
  // so it is resolved independently of location and reported alongside it.
  const writingVariety = modeOf(observations.map((o) => o.variety));
  const homeLocale = modeOf(observations.map((o) => o.locale));

  // An explicit user choice always wins. This asks where someone feels at
  // home, never what they are.
  if (state.override) {
    return {
      homeRegion: state.override,
      currentRegion,
      travelling: Boolean(currentRegion && currentRegion !== state.override),
      daysObserved,
      confidence: 1,
      writingVariety,
      homeLocale,
      source: "override",
    };
  }

  if (daysObserved < MIN_DAYS_FOR_ANY_CLAIM) {
    return {
      homeRegion: null,
      currentRegion,
      travelling: false,
      daysObserved,
      confidence: 0,
      writingVariety,
      homeLocale,
      source: "insufficient",
    };
  }

  const counts = countDaysByRegion(observations);
  // On a tie, the region the user is in MORE RECENTLY leads. Without this, a
  // relocation that lands exactly level with the old country never registers,
  // because the incumbent wins ties purely by map insertion order.
  let leader = null;
  let leaderN = 0;
  let leaderRun = -1;
  for (const [region, n] of counts) {
    const run = trailingRun(observations, region);
    if (n > leaderN || (n === leaderN && run > leaderRun)) {
      leader = region; leaderN = n; leaderRun = run;
    }
  }

  const incumbent = state.homeRegion ?? null;
  const incumbentN = incumbent ? (counts.get(incumbent) ?? 0) : 0;

  let homeRegion = incumbent;

  if (!incumbent) {
    // No home yet. Adopt the leader only once it has genuinely accumulated.
    homeRegion = leaderN >= MIN_DAYS_TO_ESTABLISH ? leader : null;
  } else if (leader && leader !== incumbent) {
    // Displacing an established home takes a sustained run AND a clear margin,
    // so a long holiday, or a trip broken by a week back home, does not qualify.
    const run = trailingRun(observations, leader);
    const margin = leaderN - incumbentN;
    const sustained = run >= MIN_CONSECUTIVE_DAYS_TO_DISPLACE && margin >= DISPLACE_MARGIN_DAYS;
    if (sustained || run >= RUN_ALONE_DISPLACES) {
      homeRegion = leader;
    }
  }

  const homeN = homeRegion ? (counts.get(homeRegion) ?? 0) : 0;
  const confidence = homeRegion
    ? Math.max(0, Math.min(1, homeN / MIN_DAYS_TO_ESTABLISH))
    : 0;

  return {
    homeRegion,
    currentRegion,
    travelling: Boolean(homeRegion && currentRegion && currentRegion !== homeRegion),
    daysObserved,
    confidence,
    writingVariety,
    homeLocale,
    source: homeRegion ? "residency" : "insufficient",
  };
}

/**
 * Turn a residency result into the context object cultural-calibration.js
 * consumes. Region comes from HOME, never from where the phone is today, and
 * the writing variety is passed through because it outranks location.
 */
export function residencyToCulturalContext(residency, fallback = {}) {
  return {
    locale: residency.homeLocale ?? fallback.locale ?? "en",
    region: residency.homeRegion ?? fallback.region ?? null,
    journalLanguageHint: residency.writingVariety ?? fallback.journalLanguageHint ?? null,
    // Callers widen their uncertainty when this is low, per
    // cultural-calibration.js's FALLBACK_WIDEN_FACTOR.
    residencyConfidence: residency.confidence,
    travelling: residency.travelling,
  };
}
