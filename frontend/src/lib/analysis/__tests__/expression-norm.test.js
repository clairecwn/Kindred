import test from "node:test";
import assert from "node:assert/strict";
import { fitExpressionNorm, correctTextObservation, LAMBDA_MIN, LAMBDA_MAX } from "../expression-norm.js";
import { calibrateReaders, dayToObservation } from "../index.js";
import { ITEM_WEIGHTS } from "../checkin-scoring.js";
const ITEM_KEYS = Object.keys(ITEM_WEIGHTS);

const MID = 10.5;
const pairsFrom = (fn, zs) => zs.map((z) => ({ checkin: MID + z, text: MID + fn(z) }));
const zs = [-5, -3, -2, -1, 0, 1, 2, 3, 4, 5, -4, 2, -2, 3, 0, 1, -1, 4, -3, 2];

test("no paired days returns the prior: no offset, unit gain", () => {
  const norm = fitExpressionNorm([]);
  assert.equal(norm.pairs, 0);
  assert.ok(Math.abs(norm.tau) < 1e-12);
  assert.ok(Math.abs(norm.lambda - 1) < 1e-12);
});

test("an understater (dull swings, slightly dark writing) is learned", () => {
  const norm = fitExpressionNorm(pairsFrom((z) => 0.5 * z - 1, zs));
  assert.ok(norm.lambda < 0.75, `lambda ${norm.lambda}`);
  assert.ok(norm.tau < -0.5, `tau ${norm.tau}`);
});

test("an exaggerator (big swings) is learned", () => {
  const norm = fitExpressionNorm(pairsFrom((z) => 1.8 * z, zs));
  assert.ok(norm.lambda > 1.4, `lambda ${norm.lambda}`);
});

test("a correction maps an understater's mild text back to a stronger latent reading", () => {
  const norm = fitExpressionNorm(pairsFrom((z) => 0.5 * z, zs));
  const out = correctTextObservation(MID - 2, 9, norm, MID);
  assert.ok(out.value < MID - 3, `expected stronger low reading, got ${out.value}`);
  assert.ok(out.R > 9, "dividing by a small gain must also widen the noise");
});

test("gain is clamped so a few odd days cannot blow up the correction", () => {
  const wild = fitExpressionNorm([{ checkin: MID + 0.1, text: MID + 50 }, { checkin: MID - 0.1, text: MID - 50 }]);
  assert.ok(wild.lambda <= LAMBDA_MAX && wild.lambda >= LAMBDA_MIN);
});

test("the group prior seeds a new user's offset", () => {
  assert.ok(fitExpressionNorm([], { groupTau: -1.5 }).tau < -1.4);
});

test("a stored interpretation becomes an observation and its noise is learned from agreement", () => {
  const day = { date: "2026-10-01", journalText: "zxqv", interpretation: { valence: -0.5, confidence: 0.8 } };
  const obs = dayToObservation(day, null);
  assert.ok(obs, "a text the lexicon cannot read still yields an observation via the interpretation");
  assert.deepEqual(obs.readers, ["interpretation"]);
  const agreeing = Array.from({ length: 10 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    itemScores: Object.fromEntries(ITEM_KEYS.map((k) => [k, 1])),
    journalText: "meh",
    interpretation: { valence: -0.2, confidence: 1 },
  }));
  const cal = calibrateReaders(agreeing);
  assert.equal(cal.interpretationPairs, 10);
  assert.ok(Number.isFinite(cal.interpretationR));
});

test("separate check-in and journal records on the same day are paired", () => {
  const days = Array.from({ length: 6 }, (_, i) => {
    const date = `2026-09-${String(i + 1).padStart(2, "0")}`;
    return [
      { date, itemScores: Object.fromEntries(ITEM_KEYS.map((k) => [k, 2])) },
      { date, journalText: "ok lor, not bad", interpretation: { valence: 0.1, confidence: 0.8 } },
    ];
  }).flat();
  const cal = calibrateReaders(days);
  assert.equal(cal.interpretationPairs, 6);
});
