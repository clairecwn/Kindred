import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConversationMemoryBank,
  retrieveConversationMemories,
} from "../conversation-memory.js";

const NOW = new Date("2026-10-02T12:00:00+08:00");

test("memory bank stores user-authored follow-ups but not assistant guesses", () => {
  const bank = buildConversationMemoryBank([{
    id: "one",
    date: "2026-10-01",
    text: "The group project keeps changing.",
    aiChat: [
      { role: "ai", text: "You are definitely anxious." },
      { role: "user", text: "It is more that nobody gives me time to prepare." },
    ],
  }]);
  assert.equal(bank.length, 1);
  assert.match(bank[0].userText, /nobody gives me time/);
  assert.doesNotMatch(bank[0].userText, /definitely anxious/);
});

test("retrieval prefers a relevant recent journal over an unrelated one", () => {
  const entries = [
    { id: "recent-school", date: "2026-09-29", text: "Classes cover too many topics together and I never get time to absorb them." },
    { id: "old-school", date: "2026-03-01", text: "Revision moved too quickly and several assignments were due together." },
    { id: "recent-unrelated", date: "2026-10-01", text: "Dinner with my cousins was relaxing and the food was great." },
  ];
  const result = retrieveConversationMemories(
    "School keeps teaching too many things at once and I cannot properly switch off.",
    entries,
    { now: NOW },
  );
  assert.equal(result.memories[0].id, "recent-school");
  assert.ok(result.memories.every((memory) => memory.id !== "recent-unrelated"));
});

test("older relevant context can be recalled but recency never dominates relevance", () => {
  const entries = [
    { id: "old-relevant", date: "2026-01-01", text: "My afternoon shift leaves me no break before studying again." },
    { id: "new-irrelevant", date: "2026-10-02", text: "I enjoyed drawing a landscape beside the lake." },
  ];
  const result = retrieveConversationMemories(
    "Going from work into studying means I never get to rest.",
    entries,
    { now: NOW },
  );
  assert.equal(result.memories[0]?.id, "old-relevant");
  assert.ok(result.influenceCap <= 0.30);
});

test("no topical or causal match returns no memory instead of inventing a pattern", () => {
  const result = retrieveConversationMemories(
    "I need to prepare for a difficult presentation.",
    [{ id: "unrelated", date: "2026-10-01", text: "The soup at lunch tasted comforting." }],
    { now: NOW },
  );
  assert.equal(result.memories.length, 0);
  assert.equal(result.influenceCap, 0);
});
