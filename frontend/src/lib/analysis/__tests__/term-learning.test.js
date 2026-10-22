import test from "node:test";
import assert from "node:assert/strict";
import { learnTerms, reactionTo, termReadingsFrom, LEARN_P } from "../term-learning.js";
import { buildPersonalMemory } from "../personal-memory.js";
import { updateJournalConversation } from "../journal-conversation-state.js";

const entry = (id, text, chat, observations) => ({ id, date: `2026-10-${id.padStart(2, "0")}`, text,
  aiChat: [{ role: "user", text, isJournal: true }, ...chat], termObservations: observations });

test("the next user message decides whether a reading was accepted", () => {
  const e = entry("1", "that test was so glorp", [{ role: "ai", text: "ugh rough" }, { role: "user", text: "ya fr" }], []);
  assert.equal(reactionTo({ userTurn: 0 }, e), "accepted");
  const corrected = entry("2", "so glorp", [{ role: "ai", text: "x" }, { role: "user", text: "no i meant it was fun" }], []);
  assert.equal(reactionTo({ userTurn: 0 }, corrected), "contradicted");
  assert.equal(reactionTo({ userTurn: 1 }, corrected), "pending");
});

test("a brand-new term is learned after accepted readings in two different entries", () => {
  const obs = { term: "glorp", meaning: "really bad, awful", confidence: "medium", userTurn: 0 };
  const entries = [
    entry("1", "that test was so glorp", [{ role: "ai", text: "oof" }, { role: "user", text: "ya fr" }], [obs]),
    entry("2", "lunch was glorp today", [{ role: "ai", text: "aw" }, { role: "user", text: "the rice was cold" }], [{ ...obs, meaning: "bad, awful food" }]),
  ];
  const { learned } = learnTerms(entries);
  assert.equal(learned.length, 1);
  assert.equal(learned[0].term, "glorp");
  assert.ok(learned[0].p >= LEARN_P);
});

test("one sighting stays a candidate, and a correction blocks learning", () => {
  const obs = { term: "glorp", meaning: "really bad", confidence: "high", userTurn: 0 };
  const once = learnTerms([entry("1", "so glorp", [{ role: "ai", text: "oof" }, { role: "user", text: "ya" }], [obs])]);
  assert.equal(once.learned.length, 0);
  assert.equal(once.candidates[0].term, "glorp");
  const wrong = learnTerms([
    entry("1", "so glorp", [{ role: "ai", text: "oof" }, { role: "user", text: "no i meant its good" }], [obs]),
    entry("2", "glorp again", [{ role: "ai", text: "oh no" }, { role: "user", text: "huh" }], [obs]),
  ]);
  assert.equal(wrong.learned.length, 0);
  assert.equal(wrong.candidates.length, 0);
});

test("accepted readings of a known multi-sense term become implicit sense counts", () => {
  const obs = { term: "ok lor", token: "ok lor", senseId: "easy-going", confidence: "high", userTurn: 0 };
  const { senseCounts } = learnTerms([entry("1", "ok lor see you", [{ role: "ai", text: "see ya" }, { role: "user", text: "haha ya" }], [obs])]);
  assert.equal(senseCounts["ok lor"]["easy-going"], 0.5);
});

test("observations flow from a reply into the entry and into personal memory", () => {
  const base = { id: "7", date: "2026-10-07", text: "school was glorp", aiChat: [] };
  const opened = updateJournalConversation(base, [{ role: "user", text: base.text, isJournal: true }, { role: "ai", text: "oof" }], [],
    { termReadings: termReadingsFrom({ terms: [{ term: "glorp", meaning: "awful", confidence: "medium" }] }, 0) });
  assert.equal(opened.termObservations.length, 1);
  const next = { ...opened, aiChat: [...opened.aiChat, { role: "user", text: "ya the teacher was mean" }] };
  const second = { id: "8", date: "2026-10-08", text: "maths was glorp", aiChat: [{ role: "user", text: "maths was glorp", isJournal: true }, { role: "ai", text: "aw" }, { role: "user", text: "so many questions" }],
    termObservations: [{ term: "glorp", meaning: "awful, bad", confidence: "medium", userTurn: 0 }] };
  const memory = buildPersonalMemory([second, next]);
  assert.equal(memory.learnedTerms[0]?.term, "glorp");
});

test("low-confidence readings are not recorded", () => {
  assert.equal(termReadingsFrom({ terms: [{ term: "x", meaning: "y", confidence: "low" }] }, 0).length, 0);
});
