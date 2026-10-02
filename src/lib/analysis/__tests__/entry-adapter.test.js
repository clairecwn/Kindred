import test from "node:test";
import assert from "node:assert/strict";
import { buildHistoryFromEntries, analyseEntry } from "../entry-adapter.js";

const ITEM_SCORES = { mood: 2, meaning: 2, connection: 2, accomplishment: 2, energy: 2, resilience: 2, sleep: 2 };

test("buildHistoryFromEntries converts newest-first UI entries to oldest-first day records", () => {
  const entries = [
    { id: "3", date: "2026-01-03", source: "checkin", itemScores: ITEM_SCORES },
    { id: "2", date: "2026-01-02", source: "journal", text: "a decent day" },
    { id: "1", date: "2026-01-01", source: "checkin", itemScores: ITEM_SCORES },
  ];
  const history = buildHistoryFromEntries(entries);
  assert.equal(history.length, 3);
  assert.equal(history[0].date, "2026-01-01");
  assert.equal(history[2].date, "2026-01-03");
  assert.deepEqual(history[1].journalText, "a decent day");
});

test("excludeId drops the named entry from history", () => {
  const entries = [{ id: "1", date: "2026-01-01", source: "checkin", itemScores: ITEM_SCORES }];
  assert.equal(buildHistoryFromEntries(entries, "1").length, 0);
});

test("analyseEntry says nothing before the first check-in/journal entry", () => {
  const result = analyseEntry([], {});
  assert.equal(result.sayNothing, true);
});

test("analyseEntry runs the full pipeline once there is at least one entry", () => {
  const entries = Array.from({ length: 6 }, (_, i) => ({
    id: String(i),
    date: `2026-01-0${i + 1}`,
    source: "checkin",
    itemScores: ITEM_SCORES,
  }));
  const result = analyseEntry(entries, { date: "2026-01-07", itemScores: ITEM_SCORES });
  assert.equal(result.sayNothing, false);
  assert.ok(result.todayScore);
  assert.ok(result.gates);
  assert.ok(Number.isFinite(result.confidence));
});

test("buildCompanionHints flags somatic distress and understatement from text", async () => {
  const { buildCompanionHints } = await import("../entry-adapter.js");
  const hints = buildCompanionHints([], "chest feels tight and honestly it's fine, i guess");
  assert.equal(hints.somaticDistress, true);
  assert.equal(hints.understatement, true);
  assert.ok(hints.analysis);
  assert.equal(hints.responseStrategy.mode, "tentative-understatement-reflection");
});

test("buildCompanionHints says nothing about trend before the gate is met", async () => {
  const { buildCompanionHints } = await import("../entry-adapter.js");
  const hints = buildCompanionHints([], "just a normal day");
  assert.equal(hints.sayNothingAboutTrend, true);
});
