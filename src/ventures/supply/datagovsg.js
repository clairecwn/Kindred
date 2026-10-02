/**
 * datagovsg.js
 *
 * Singapore-specific open-data adapter: SportSG facilities, Community
 * Clubs (data.gov.sg GeoJSON) and NLB library events. Same
 * fetch-normalise-cache-fail-gracefully shape as supply/overpass.js so
 * recommender.js never has to care which adapter an activity came from.
 *
 * data.gov.sg's collection API is dataset-id based and changes over time;
 * this adapter takes the dataset's GeoJSON download URL as a parameter
 * rather than hardcoding an id that can go stale, and always degrades to
 * an empty list rather than throwing.
 */

import { createActivity, EVIDENCE_CATEGORY, ENERGY_DEMAND, SOCIAL_INTENSITY, STRUCTURE } from "../activity-model.js";
import { cacheGet, cacheSet } from "./cache.js";

const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

/**
 * Normalise one GeoJSON feature from a SportSG / Community Club dataset.
 * data.gov.sg GeoJSON typically carries a Description HTML blob in
 * properties -- we only pull a plain name out of it, never render raw HTML.
 */
function normaliseFeature(feature, { evidenceCategory, energyDemand, defaultTitle }) {
  const geom = feature?.geometry;
  if (!geom || geom.type !== "Point" || !Array.isArray(geom.coordinates)) return null;
  const [lng, lat] = geom.coordinates;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const props = feature.properties || {};
  const name =
    props.NAME || props.Name || props.name ||
    (typeof props.Description === "string" ? extractNameFromDescription(props.Description) : null) ||
    defaultTitle;

  return createActivity({
    id: `datagovsg-${lat.toFixed(5)}-${lng.toFixed(5)}-${name}`,
    title: name,
    description: "A public facility -- free to drop in, no booking needed for casual use.",
    sourceType: "datagovsg",
    evidenceCategory,
    energyDemand,
    socialIntensity: SOCIAL_INTENSITY.PARALLEL,
    durationMinutes: 30,
    structure: STRUCTURE.DROP_IN,
    noCommitment: true,
    cost: { amount: 0, currency: "SGD" },
    indoor: true,
    outdoor: false,
    country: "SG",
    location: { name, lat, lng, isPublicVenue: true, isDaytime: true, transitNearby: true },
    accessibility: { wheelchairAccessible: null, mobilityLevelRequired: "any", languageCodes: ["en"] },
    hostId: null,
    capacity: null,
    joined: 0,
    participants: [],
  });
}

function extractNameFromDescription(html) {
  const match = html.match(/<th>NAME<\/th>\s*<td>([^<]+)<\/td>/i);
  return match ? match[1].trim() : null;
}

async function fetchGeoJson(url, fetchImpl) {
  if (!url || !fetchImpl) return [];
  const cacheKey = `kindred.ventures.datagovsg.${url}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
    const res = await fetchImpl(url, { signal: controller?.signal });
    if (timeout) clearTimeout(timeout);
    if (!res || !res.ok) return [];
    const json = await res.json();
    const features = Array.isArray(json?.features) ? json.features : [];
    cacheSet(cacheKey, features, CACHE_TTL_MS);
    return features;
  } catch {
    return [];
  }
}

/**
 * @param {object} opts
 * @param {string} [opts.sportsgUrl] - GeoJSON download URL for a SportSG
 *   facilities dataset (data.gov.sg). Omit to skip.
 * @param {string} [opts.communityClubUrl] - GeoJSON download URL for
 *   Community Clubs. Omit to skip.
 * @param {Function} [opts.fetchImpl]
 * @returns {Promise<Array>} normalised activities; [] on any failure.
 */
export async function fetchDataGovSgActivities({ sportsgUrl, communityClubUrl, fetchImpl = globalThis.fetch } = {}) {
  const results = [];

  if (sportsgUrl) {
    const features = await fetchGeoJson(sportsgUrl, fetchImpl);
    for (const f of features) {
      const activity = normaliseFeature(f, {
        evidenceCategory: EVIDENCE_CATEGORY.EXERCISE,
        energyDemand: ENERGY_DEMAND.MODERATE,
        defaultTitle: "SportSG facility",
      });
      if (activity) results.push(activity);
    }
  }

  if (communityClubUrl) {
    const features = await fetchGeoJson(communityClubUrl, fetchImpl);
    for (const f of features) {
      const activity = normaliseFeature(f, {
        evidenceCategory: EVIDENCE_CATEGORY.SOCIAL_CONNECTION,
        energyDemand: ENERGY_DEMAND.LOW,
        defaultTitle: "Community Club",
      });
      if (activity) results.push(activity);
    }
  }

  return results;
}
