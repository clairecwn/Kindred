/**
 * activity-model.js
 *
 * Shared attribute schema for a "venture" (a real-world activity Kindred can
 * recommend) plus the evidence weights that scoring.js and recommender.js
 * are built on. Pure data + small constructors, no side effects.
 *
 * Evidence summary (see task brief for the underlying research pass):
 *  - Exercise / movement:  strongest effect, SMD approx -0.6 to -0.7 on
 *    depression outcomes; benefit rises with dose up to ~150-300 min/week
 *    then plateaus; even a 10-20 minute bout shifts same-day mood.
 *  - Green / blue space:   real but modest effect size; low-cost, low-risk.
 *  - Volunteering:         good effect, but ONLY when it is chosen, not
 *    obligated -- framing matters as much as the activity.
 *  - Arts / creative:      legitimate but weakly evidenced; fine as a low
 *    demand option, should not crowd out stronger categories.
 *  - Social / connection:  behavioural activation works without requiring
 *    the activity to be social at all -- solo options are first class here,
 *    not a fallback.
 */

// ---------------------------------------------------------------------------
// Evidence categories and their relative weight in scoring (0..1). Higher
// weight = more evidence-backed for mood/depression outcomes generally.
// Weight is ONE input among several in scoring.js, not a ranking by itself.
// ---------------------------------------------------------------------------
export const EVIDENCE_CATEGORY = Object.freeze({
  EXERCISE: "exercise",
  GREEN_BLUE_SPACE: "green_blue_space",
  VOLUNTEERING: "volunteering",
  ARTS_CREATIVE: "arts_creative",
  SOCIAL_CONNECTION: "social_connection",
  BEHAVIOURAL_ACTIVATION: "behavioural_activation", // generic "do a small thing" solo option
});

// Source: meta-analytic ranges quoted in the research brief (exercise SMD
// ~-0.6 to -0.7 for depression, plateauing ~150-300 min/week; green/blue
// space and volunteering-when-chosen show smaller but real effects; arts
// interventions are consistently positive but with wide confidence
// intervals / weak evidence base).
export const EVIDENCE_WEIGHT = Object.freeze({
  [EVIDENCE_CATEGORY.EXERCISE]: 1.0,
  [EVIDENCE_CATEGORY.GREEN_BLUE_SPACE]: 0.7,
  [EVIDENCE_CATEGORY.VOLUNTEERING]: 0.65, // only when chosen -- see isVoluntary flag
  [EVIDENCE_CATEGORY.BEHAVIOURAL_ACTIVATION]: 0.6,
  [EVIDENCE_CATEGORY.SOCIAL_CONNECTION]: 0.55,
  [EVIDENCE_CATEGORY.ARTS_CREATIVE]: 0.45,
});

// Dose-response: minutes/week where benefit is still climbing vs plateaued.
// Used by scoring.js to give a small bonus to activities that help a user
// move toward, but not wildly past, the plateau.
export const EXERCISE_DOSE_PLATEAU_MIN_PER_WEEK = 150;
export const EXERCISE_DOSE_PLATEAU_MAX_PER_WEEK = 300;
// Even a short bout has same-day value -- never require a long session to
// count as worthwhile for a depleted user.
export const MIN_MEANINGFUL_BOUT_MINUTES = 10;

// ---------------------------------------------------------------------------
// Energy demand -- how much a depleted person "has to bring" to do this.
// ---------------------------------------------------------------------------
export const ENERGY_DEMAND = Object.freeze({
  MINIMAL: "minimal", // e.g. sit in a park, 10-min stretch at home
  LOW: "low", // e.g. slow solo walk, short craft session
  MODERATE: "moderate", // e.g. group walk, casual sport, volunteering shift
  HIGH: "high", // e.g. team sport, long hike, high-tempo class
});

export const ENERGY_DEMAND_ORDER = [
  ENERGY_DEMAND.MINIMAL,
  ENERGY_DEMAND.LOW,
  ENERGY_DEMAND.MODERATE,
  ENERGY_DEMAND.HIGH,
];

// ---------------------------------------------------------------------------
// Social intensity rungs -- the graded-exposure ladder. This is the load-
// bearing scale for the "never jump more than one rung" rule in scoring.js.
// ---------------------------------------------------------------------------
export const SOCIAL_INTENSITY = Object.freeze({
  SOLO: 0, // alone, nobody else present or expected
  PARALLEL: 1, // around strangers but no interaction required (public park, library)
  FAMILIAR_SMALL: 2, // small group of people you already know, or 1:1 with a friend
  NEW_SMALL: 3, // small group including strangers (a hosted meetup, a class)
  GROUP_EVENT: 4, // large group / event, mostly strangers, higher social demand
});

export const SOCIAL_INTENSITY_ORDER = [
  SOCIAL_INTENSITY.SOLO,
  SOCIAL_INTENSITY.PARALLEL,
  SOCIAL_INTENSITY.FAMILIAR_SMALL,
  SOCIAL_INTENSITY.NEW_SMALL,
  SOCIAL_INTENSITY.GROUP_EVENT,
];

export const STRUCTURE = Object.freeze({
  DROP_IN: "drop_in", // no commitment, show up whenever
  SCHEDULED: "scheduled", // fixed date/time, one-off
  ONGOING: "ongoing", // recurring series / membership
});

/**
 * Build a normalised activity object. Every adapter (seed data, OSM,
 * data.gov.sg, user-hosted) should funnel through this so scoring.js and
 * recommender.js never need to know where an activity came from.
 */
export function createActivity(raw = {}) {
  return {
    id: raw.id ?? null,
    title: raw.title ?? "Untitled activity",
    description: raw.description ?? "",
    sourceType: raw.sourceType ?? "seed", // 'seed' | 'user' | 'osm' | 'datagovsg'
    evidenceCategory: raw.evidenceCategory ?? EVIDENCE_CATEGORY.BEHAVIOURAL_ACTIVATION,
    energyDemand: raw.energyDemand ?? ENERGY_DEMAND.LOW,
    socialIntensity: raw.socialIntensity ?? SOCIAL_INTENSITY.SOLO,
    durationMinutes: raw.durationMinutes ?? 30,
    isVoluntary: raw.isVoluntary !== false, // volunteering only "counts" fully when true
    structure: raw.structure ?? STRUCTURE.DROP_IN,
    noCommitment: raw.noCommitment ?? raw.structure === STRUCTURE.DROP_IN,
    cost: {
      amount: raw.cost?.amount ?? 0,
      currency: raw.cost?.currency ?? "SGD",
    },
    indoor: raw.indoor ?? false,
    outdoor: raw.outdoor ?? true,
    // Travel time in minutes from the user's usual starting point, when an
    // adapter can supply it. null (not 0) when unknown, so scoring.js can
    // score "unknown" differently from "next door" instead of silently
    // treating every unmapped activity as zero-effort to reach.
    travelMinutes: Number.isFinite(raw.travelMinutes) ? raw.travelMinutes : null,
    // Local 24h window the activity is available in, when known.
    // { startHour, endHour }; null for "no stated time".
    timeWindow: raw.timeWindow && Number.isFinite(raw.timeWindow.startHour)
      ? { startHour: raw.timeWindow.startHour, endHour: raw.timeWindow.endHour ?? raw.timeWindow.startHour + 1 }
      : null,
    country: raw.country ?? "SG",
    location: {
      name: raw.location?.name ?? raw.location ?? "",
      lat: raw.lat ?? raw.location?.lat ?? null,
      lng: raw.lng ?? raw.location?.lng ?? null,
      isPublicVenue: raw.location?.isPublicVenue ?? true,
      isDaytime: raw.location?.isDaytime ?? true,
      transitNearby: raw.location?.transitNearby ?? true,
    },
    accessibility: {
      wheelchairAccessible: raw.accessibility?.wheelchairAccessible ?? null, // null = unknown
      mobilityLevelRequired: raw.accessibility?.mobilityLevelRequired ?? "any", // 'any'|'low'|'moderate'|'high'
      languageCodes: raw.accessibility?.languageCodes ?? ["en"],
    },
    date: raw.date ?? null,
    hostId: raw.hostId ?? raw.host ?? null,
    capacity: raw.capacity ?? null,
    joined: raw.joined ?? 0,
    participants: raw.participants ?? [],
    raw,
  };
}

/** Capacity band the user is currently estimated to be in. */
export const CAPACITY_BAND = Object.freeze({
  DEPLETED: "depleted",
  LOW: "low",
  MODERATE: "moderate",
  HIGH: "high",
});

/**
 * Coarse mapping from Kindred's existing discrete emotion label (see
 * src/lib/analysis/emotion-space.js EMOTION_VAD_ANCHORS) to a capacity band,
 * used only when no richer check-in/state estimate is available. This is a
 * fallback, not the real model -- see src/ventures/user-context.js.
 */
export const EMOTION_TO_CAPACITY_BAND = Object.freeze({
  happy: CAPACITY_BAND.HIGH,
  excited: CAPACITY_BAND.HIGH,
  grateful: CAPACITY_BAND.MODERATE,
  content: CAPACITY_BAND.MODERATE,
  calm: CAPACITY_BAND.MODERATE,
  neutral: CAPACITY_BAND.LOW,
  tired: CAPACITY_BAND.LOW,
  anxious: CAPACITY_BAND.DEPLETED,
  angry: CAPACITY_BAND.LOW,
  sad: CAPACITY_BAND.DEPLETED,
});

/** Max social rung a capacity band may be offered on a FIRST recommendation. */
export const CAPACITY_BAND_MAX_STARTING_RUNG = Object.freeze({
  [CAPACITY_BAND.DEPLETED]: SOCIAL_INTENSITY.PARALLEL,
  [CAPACITY_BAND.LOW]: SOCIAL_INTENSITY.FAMILIAR_SMALL,
  [CAPACITY_BAND.MODERATE]: SOCIAL_INTENSITY.NEW_SMALL,
  [CAPACITY_BAND.HIGH]: SOCIAL_INTENSITY.GROUP_EVENT,
});

/** Max energy demand a capacity band may be offered. */
export const CAPACITY_BAND_MAX_ENERGY = Object.freeze({
  [CAPACITY_BAND.DEPLETED]: ENERGY_DEMAND.LOW,
  [CAPACITY_BAND.LOW]: ENERGY_DEMAND.MODERATE,
  [CAPACITY_BAND.MODERATE]: ENERGY_DEMAND.MODERATE,
  [CAPACITY_BAND.HIGH]: ENERGY_DEMAND.HIGH,
});
