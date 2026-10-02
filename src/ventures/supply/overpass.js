/**
 * overpass.js
 *
 * OpenStreetMap Overpass API adapter -- free, no key, worldwide. Pulls
 * parks, libraries and sports facilities near a point and normalises them
 * into the activity-model schema as free, drop-in, no-commitment options
 * (the research brief's green/blue-space and low-demand categories).
 *
 * Meetup and Eventbrite killed their public search APIs, so this and
 * data.gov.sg (Singapore-specific) are the two viable free supply sources.
 */

import { createActivity, EVIDENCE_CATEGORY, ENERGY_DEMAND, SOCIAL_INTENSITY, STRUCTURE } from "../activity-model.js";
import { cacheGet, cacheSet } from "./cache.js";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours -- these facilities barely change

function buildQuery(lat, lng, radiusMeters) {
  return `
    [out:json][timeout:20];
    (
      node["leisure"="park"](around:${radiusMeters},${lat},${lng});
      way["leisure"="park"](around:${radiusMeters},${lat},${lng});
      node["amenity"="library"](around:${radiusMeters},${lat},${lng});
      node["leisure"="sports_centre"](around:${radiusMeters},${lat},${lng});
      node["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lng});
    );
    out center 40;
  `;
}

function categoriseTags(tags = {}) {
  if (tags.leisure === "park") {
    return { evidenceCategory: EVIDENCE_CATEGORY.GREEN_BLUE_SPACE, energyDemand: ENERGY_DEMAND.MINIMAL, indoor: false, outdoor: true, title: tags.name || "Local park" };
  }
  if (tags.amenity === "library") {
    return { evidenceCategory: EVIDENCE_CATEGORY.BEHAVIOURAL_ACTIVATION, energyDemand: ENERGY_DEMAND.MINIMAL, indoor: true, outdoor: false, title: tags.name || "Public library" };
  }
  return { evidenceCategory: EVIDENCE_CATEGORY.EXERCISE, energyDemand: ENERGY_DEMAND.MODERATE, indoor: true, outdoor: false, title: tags.name || "Sports facility" };
}

function normaliseElement(el, country) {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const tags = el.tags || {};
  const meta = categoriseTags(tags);

  return createActivity({
    id: `osm-${el.type}-${el.id}`,
    title: meta.title,
    description: "A public, free, drop-in spot -- go whenever suits you.",
    sourceType: "osm",
    evidenceCategory: meta.evidenceCategory,
    energyDemand: meta.energyDemand,
    socialIntensity: SOCIAL_INTENSITY.PARALLEL, // public place, strangers around, no interaction required
    durationMinutes: 30,
    structure: STRUCTURE.DROP_IN,
    noCommitment: true,
    cost: { amount: 0, currency: "SGD" },
    indoor: meta.indoor,
    outdoor: meta.outdoor,
    country,
    location: { name: tags.name || meta.title, lat, lng, isPublicVenue: true, isDaytime: true, transitNearby: true },
    accessibility: { wheelchairAccessible: tags.wheelchair === "yes" ? true : tags.wheelchair === "no" ? false : null, mobilityLevelRequired: "any", languageCodes: ["en"] },
    hostId: null,
    capacity: null,
    joined: 0,
    participants: [],
  });
}

/**
 * Fetch nearby free/public activities from OpenStreetMap. Fails gracefully:
 * returns [] (never throws) on network error, timeout, or malformed
 * response, so callers can fall back to seeded data unconditionally.
 */
export async function fetchOverpassActivities({ lat, lng, radiusMeters = 3000, country = "SG", fetchImpl = globalThis.fetch }) {
  if (typeof lat !== "number" || typeof lng !== "number" || !fetchImpl) return [];

  const cacheKey = `kindred.ventures.overpass.${lat.toFixed(3)}.${lng.toFixed(3)}.${radiusMeters}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const query = buildQuery(lat, lng, radiusMeters);
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;

    const res = await fetchImpl(OVERPASS_ENDPOINT, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller?.signal,
    });
    if (timeout) clearTimeout(timeout);

    if (!res || !res.ok) return [];
    const json = await res.json();
    const elements = Array.isArray(json?.elements) ? json.elements : [];
    const activities = elements
      .map((el) => normaliseElement(el, country))
      .filter(Boolean);

    cacheSet(cacheKey, activities, CACHE_TTL_MS);
    return activities;
  } catch {
    return []; // offline, timeout, CORS, malformed JSON -- all fall back silently
  }
}
