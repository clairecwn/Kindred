import test from "node:test";
import assert from "node:assert/strict";
import {
  recordObservation, resolveResidency, residencyToCulturalContext,
  MIN_DAYS_TO_ESTABLISH, MIN_CONSECUTIVE_DAYS_TO_DISPLACE,
} from "../residency.js";

const DAY = 86400000;

function simulate(days) {
  // days: array of {region, locale, variety} applied one calendar day apart
  let state = {};
  const start = Date.UTC(2026, 0, 1);
  days.forEach((d, i) => {
    state = recordObservation(state, { ...d, now: start + i * DAY });
    const r = resolveResidency(state);
    state.homeRegion = r.homeRegion; // persist as the app would
  });
  return state;
}

test("says nothing until there is enough history", () => {
  const state = simulate(Array.from({ length: 5 }, () => ({ region: "asia-east", locale: "en-SG" })));
  const r = resolveResidency(state);
  assert.equal(r.homeRegion, null);
  assert.equal(r.source, "insufficient");
  assert.equal(r.confidence, 0);
});

test("establishes a home region after sustained residence", () => {
  const state = simulate(Array.from({ length: 60 }, () => ({ region: "asia-east", locale: "en-SG" })));
  const r = resolveResidency(state);
  assert.equal(r.homeRegion, "asia-east");
  assert.equal(r.travelling, false);
  assert.ok(r.confidence > 0.9);
});

test("a two week holiday does NOT change the home region", () => {
  const home = Array.from({ length: 90 }, () => ({ region: "asia-east", locale: "en-SG", variety: "singlish" }));
  const trip = Array.from({ length: 14 }, () => ({ region: "uk", locale: "en-GB" }));
  const state = simulate([...home, ...trip]);
  const r = resolveResidency(state);
  assert.equal(r.homeRegion, "asia-east", "home must survive a holiday");
  assert.equal(r.currentRegion, "uk");
  assert.equal(r.travelling, true, "should know they are away");
});

test("calibration context uses HOME, not where the phone is today", () => {
  const home = Array.from({ length: 90 }, () => ({ region: "asia-east", locale: "en-SG", variety: "singlish" }));
  const trip = Array.from({ length: 14 }, () => ({ region: "uk", locale: "en-GB" }));
  const ctx = residencyToCulturalContext(resolveResidency(simulate([...home, ...trip])));
  assert.equal(ctx.region, "asia-east");
  assert.equal(ctx.journalLanguageHint, "singlish", "writing variety outranks location");
  assert.equal(ctx.travelling, true);
});

test("an actual relocation does eventually move home", () => {
  const home = Array.from({ length: 90 }, () => ({ region: "asia-east", locale: "en-SG" }));
  const moved = Array.from({ length: MIN_CONSECUTIVE_DAYS_TO_DISPLACE + 30 }, () => ({ region: "uk", locale: "en-GB" }));
  const r = resolveResidency(simulate([...home, ...moved]));
  assert.equal(r.homeRegion, "uk");
  assert.equal(r.travelling, false);
});

test("a long trip broken by a week back home does not displace", () => {
  const home = Array.from({ length: 90 }, () => ({ region: "asia-east", locale: "en-SG" }));
  const leg1 = Array.from({ length: 40 }, () => ({ region: "uk", locale: "en-GB" }));
  const back = Array.from({ length: 7 }, () => ({ region: "asia-east", locale: "en-SG" }));
  const leg2 = Array.from({ length: 40 }, () => ({ region: "uk", locale: "en-GB" }));
  const r = resolveResidency(simulate([...home, ...leg1, ...back, ...leg2]));
  assert.equal(r.homeRegion, "asia-east", "the run was broken, so no displacement");
});

test("an explicit user choice always wins and never asks for ethnicity", () => {
  const state = simulate(Array.from({ length: 60 }, () => ({ region: "uk", locale: "en-GB" })));
  state.override = "asia-east";
  const r = resolveResidency(state);
  assert.equal(r.source, "override");
  assert.equal(r.homeRegion, "asia-east");
  assert.equal(r.confidence, 1);
});

test("one observation per calendar day, so heavy users do not out-vote quiet ones", () => {
  let state = {};
  const t = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 10; i += 1) state = recordObservation(state, { region: "uk", now: t });
  assert.equal(state.observations.length, 1);
});

test("observations older than the window are dropped", () => {
  let state = {};
  const t = Date.UTC(2026, 0, 1);
  state = recordObservation(state, { region: "uk", now: t });
  state = recordObservation(state, { region: "asia-east", now: t + 200 * DAY });
  assert.equal(state.observations.length, 1);
  assert.equal(state.observations[0].region, "asia-east");
});
