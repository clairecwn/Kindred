import { test } from "node:test";
import assert from "node:assert/strict";

import { createActivity, SOCIAL_INTENSITY, ENERGY_DEMAND, CAPACITY_BAND, EVIDENCE_CATEGORY } from "../activity-model.js";
import { passesGradedExposureCap, passesAccessibilityFilter, isEligible, scoreActivity } from "../scoring.js";
import { buildUserContext } from "../user-context.js";
import { recommend, MAX_RECOMMENDATIONS, selectWithNoCommitmentGuarantee, rankActivities } from "../recommender.js";
import {
  canHost,
  assessVenueRisk,
  isFirstMeetupWithHost,
  createBlock,
  createReport,
  isBlocked,
  filterBlockedHosts,
  HOST_COOLING_PERIOD_DAYS,
} from "../safety.js";

function makeActivity(overrides = {}) {
  return createActivity({
    id: overrides.id ?? "a-1",
    title: overrides.title ?? "Test activity",
    socialIntensity: overrides.socialIntensity ?? SOCIAL_INTENSITY.SOLO,
    energyDemand: overrides.energyDemand ?? ENERGY_DEMAND.LOW,
    country: overrides.country ?? "SG",
    cost: overrides.cost ?? { amount: 0, currency: "SGD" },
    noCommitment: overrides.noCommitment ?? true,
    location: overrides.location ?? { name: "Park", isPublicVenue: true, isDaytime: true, transitNearby: true },
    hostId: overrides.hostId ?? null,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Graded exposure cap: the core failure mode to guard against.
// ---------------------------------------------------------------------------

test("depleted user is never offered a high-social-intensity activity", () => {
  const ctx = buildUserContext({ emotion: "sad", currentSocialRung: 0 });
  assert.equal(ctx.capacityBand, CAPACITY_BAND.DEPLETED);

  const highSocial = makeActivity({ id: "group-event", socialIntensity: SOCIAL_INTENSITY.GROUP_EVENT });
  assert.equal(passesGradedExposureCap(highSocial, ctx), false);
  assert.equal(isEligible(highSocial, ctx).eligible, false);

  const result = scoreActivity(highSocial, ctx);
  assert.equal(result.eligible, false);
  assert.equal(result.score, null);
});

test("depleted user CAN be offered a one-rung stretch, not more", () => {
  const ctx = buildUserContext({ emotion: "sad", currentSocialRung: 0 }); // depleted, rung 0
  const oneRungUp = makeActivity({ id: "parallel", socialIntensity: SOCIAL_INTENSITY.PARALLEL });
  const twoRungUp = makeActivity({ id: "familiar-small", socialIntensity: SOCIAL_INTENSITY.FAMILIAR_SMALL });

  assert.equal(passesGradedExposureCap(oneRungUp, ctx), true);
  // Depleted band's own ceiling (PARALLEL) also blocks jumping further even
  // though currentRung+1 would allow it for a higher capacity band.
  assert.equal(passesGradedExposureCap(twoRungUp, ctx), false);
});

test("recommendation set for a depleted user never contains anything above the cap", () => {
  const ctx = buildUserContext({ emotion: "anxious", currentSocialRung: 0 });
  const pool = [
    makeActivity({ id: "solo", socialIntensity: SOCIAL_INTENSITY.SOLO, energyDemand: ENERGY_DEMAND.MINIMAL }),
    makeActivity({ id: "parallel", socialIntensity: SOCIAL_INTENSITY.PARALLEL, energyDemand: ENERGY_DEMAND.LOW }),
    makeActivity({ id: "group", socialIntensity: SOCIAL_INTENSITY.GROUP_EVENT, energyDemand: ENERGY_DEMAND.HIGH }),
    makeActivity({ id: "new-small", socialIntensity: SOCIAL_INTENSITY.NEW_SMALL, energyDemand: ENERGY_DEMAND.MODERATE }),
  ];
  const recs = recommend(pool, ctx);
  for (const r of recs) {
    assert.ok(r.activity.socialIntensity <= SOCIAL_INTENSITY.PARALLEL, `${r.activity.id} exceeded cap`);
  }
});

// ---------------------------------------------------------------------------
// Accessibility hard filter
// ---------------------------------------------------------------------------

test("accessibility filter rejects wrong country, over-budget, and language mismatch", () => {
  const ctx = buildUserContext({ country: "SG", budgetMax: 10, languageCodes: ["en"] });

  const wrongCountry = makeActivity({ id: "us-activity", country: "US" });
  assert.equal(passesAccessibilityFilter(wrongCountry, ctx).pass, false);

  const tooExpensive = makeActivity({ id: "pricey", cost: { amount: 50, currency: "SGD" } });
  assert.equal(passesAccessibilityFilter(tooExpensive, ctx).pass, false);

  const wrongLanguage = makeActivity({ id: "mandarin-only", accessibility: { languageCodes: ["zh"], mobilityLevelRequired: "any" } });
  assert.equal(passesAccessibilityFilter(wrongLanguage, ctx).pass, false);

  const fine = makeActivity({ id: "fine", country: "SG", cost: { amount: 0, currency: "SGD" } });
  assert.equal(passesAccessibilityFilter(fine, ctx).pass, true);
});

test("accessibility filter rejects mobility requirement above user's stated level", () => {
  const ctx = buildUserContext({ mobilityLevel: "low" });
  const demanding = makeActivity({ id: "hike", accessibility: { mobilityLevelRequired: "high", languageCodes: ["en"] } });
  assert.equal(passesAccessibilityFilter(demanding, ctx).pass, false);
});

test("ineligible activities never appear in recommend() output", () => {
  const ctx = buildUserContext({ country: "SG" });
  const pool = [
    makeActivity({ id: "wrong-country", country: "US" }),
    makeActivity({ id: "ok", country: "SG" }),
  ];
  const recs = recommend(pool, ctx);
  assert.ok(recs.every((r) => r.activity.id !== "wrong-country"));
});

// ---------------------------------------------------------------------------
// Max 3 rule + no-commitment guarantee
// ---------------------------------------------------------------------------

test("recommend() never returns more than MAX_RECOMMENDATIONS", () => {
  const ctx = buildUserContext({ emotion: "content", currentSocialRung: 2 });
  const pool = Array.from({ length: 20 }, (_, i) =>
    makeActivity({ id: `bulk-${i}`, socialIntensity: SOCIAL_INTENSITY.SOLO, noCommitment: false })
  );
  const recs = recommend(pool, ctx);
  assert.ok(recs.length <= MAX_RECOMMENDATIONS);
});

test("recommend() always includes at least one no-commitment option when one is eligible", () => {
  const ctx = buildUserContext({ emotion: "content", currentSocialRung: 2 });
  const pool = [
    makeActivity({ id: "committed-1", noCommitment: false, evidenceCategory: EVIDENCE_CATEGORY.EXERCISE }),
    makeActivity({ id: "committed-2", noCommitment: false, evidenceCategory: EVIDENCE_CATEGORY.EXERCISE }),
    makeActivity({ id: "committed-3", noCommitment: false, evidenceCategory: EVIDENCE_CATEGORY.EXERCISE }),
    makeActivity({ id: "drop-in", noCommitment: true, evidenceCategory: EVIDENCE_CATEGORY.ARTS_CREATIVE }),
  ];
  const recs = recommend(pool, ctx);
  assert.ok(recs.some((r) => r.isNoCommitment), "expected at least one no-commitment option");
});

test("selectWithNoCommitmentGuarantee returns [] for an empty ranked list", () => {
  assert.deepEqual(selectWithNoCommitmentGuarantee([]), []);
});

test("rankActivities sorts best score first", () => {
  const ctx = buildUserContext({ emotion: "content", currentSocialRung: 1 });
  const pool = [
    makeActivity({ id: "weak", evidenceCategory: EVIDENCE_CATEGORY.ARTS_CREATIVE }),
    makeActivity({ id: "strong", evidenceCategory: EVIDENCE_CATEGORY.EXERCISE, energyDemand: ENERGY_DEMAND.MODERATE }),
  ];
  const ranked = rankActivities(pool, ctx);
  assert.ok(ranked[0].score >= ranked[ranked.length - 1].score);
});

// ---------------------------------------------------------------------------
// Safety rules
// ---------------------------------------------------------------------------

test("new account cannot host until the cooling period has passed", () => {
  const now = new Date("2026-09-02T00:00:00Z");
  const brandNew = { accountCreatedAt: "2026-09-01T00:00:00Z" };
  const result = canHost(brandNew, now);
  assert.equal(result.canHost, false);

  const seasoned = { accountCreatedAt: "2026-08-01T00:00:00Z" };
  assert.equal(canHost(seasoned, now).canHost, true);

  // exactly at the boundary
  const boundary = { accountCreatedAt: new Date(now.getTime() - HOST_COOLING_PERIOD_DAYS * 86400000).toISOString() };
  assert.equal(canHost(boundary, now).canHost, true);
});

test("first meetup with a host must be public and daytime", () => {
  const ctx = { userId: "u1", pastParticipation: [] };
  const privateVenue = makeActivity({ id: "private", hostId: "host-1", location: { isPublicVenue: false, isDaytime: true } });
  const risk = assessVenueRisk(privateVenue, ctx);
  assert.equal(risk.suppress, true);

  const nighttime = makeActivity({ id: "night", hostId: "host-1", location: { isPublicVenue: true, isDaytime: false } });
  assert.equal(assessVenueRisk(nighttime, ctx).suppress, true);

  const safe = makeActivity({ id: "safe", hostId: "host-1", location: { isPublicVenue: true, isDaytime: true } });
  assert.equal(assessVenueRisk(safe, ctx).suppress, false);
});

test("a repeat meetup with a known host is not restricted to public/daytime", () => {
  const ctx = { userId: "u1", pastParticipation: [{ userId: "u1", hostId: "host-1", attended: true }] };
  const privateVenue = makeActivity({ id: "private", hostId: "host-1", location: { isPublicVenue: false, isDaytime: true } });
  assert.equal(assessVenueRisk(privateVenue, ctx).suppress, false);
});

test("isFirstMeetupWithHost is true with no history and false after an attended meetup", () => {
  assert.equal(isFirstMeetupWithHost("u1", "h1", []), true);
  assert.equal(isFirstMeetupWithHost("u1", "h1", [{ userId: "u1", hostId: "h1", attended: true }]), false);
});

test("block and report primitives validate required fields and are self-consistent", () => {
  const block = createBlock({ blockerId: "u1", blockedId: "u2", reason: "made me uncomfortable" });
  assert.equal(block.blockerId, "u1");
  assert.throws(() => createBlock({ blockerId: "u1", blockedId: "u1" }));

  const report = createReport({ reporterId: "u1", reportedId: "u2", category: "harassment" });
  assert.equal(report.status, "open");
  assert.throws(() => createReport({ reporterId: "u1", reportedId: "u2" }));

  const blocks = [block];
  assert.equal(isBlocked(blocks, "u1", "u2"), true);
  assert.equal(isBlocked(blocks, "u2", "u1"), true); // symmetric visibility
  assert.equal(isBlocked(blocks, "u1", "u3"), false);

  const activities = [makeActivity({ id: "a", hostId: "u2" }), makeActivity({ id: "b", hostId: "u3" })];
  const filtered = filterBlockedHosts(activities, blocks, "u1");
  assert.deepEqual(filtered.map((a) => a.id), ["b"]);
});
