/**
 * supply/index.js
 *
 * Combines live supply adapters with seeded/user-hosted activities. Always
 * resolves (never rejects) and always returns at least the seeded/user
 * activities passed in, even if every live adapter fails or the device is
 * offline.
 */

import { fetchOverpassActivities } from "./overpass.js";
import { fetchDataGovSgActivities } from "./datagovsg.js";

/**
 * @param {object} opts
 * @param {Array} opts.seedActivities - already-normalised seed/user activities.
 * @param {{lat:number,lng:number}} [opts.center] - map centre to search around.
 * @param {string} [opts.country] - 'SG' enables the data.gov.sg adapter.
 * @param {object} [opts.datagovsgUrls] - { sportsgUrl, communityClubUrl }
 * @param {Function} [opts.fetchImpl]
 */
export async function loadSupply({ seedActivities = [], center = null, country = "SG", datagovsgUrls = {}, fetchImpl } = {}) {
  const live = [];

  if (center) {
    const [overpass, datagovsg] = await Promise.all([
      fetchOverpassActivities({ lat: center.lat, lng: center.lng, country, fetchImpl }).catch(() => []),
      country === "SG"
        ? fetchDataGovSgActivities({ ...datagovsgUrls, fetchImpl }).catch(() => [])
        : Promise.resolve([]),
    ]);
    live.push(...overpass, ...datagovsg);
  }

  return [...seedActivities, ...live];
}
