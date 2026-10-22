import test from "node:test";
import assert from "node:assert/strict";
import { resolveWhen, patternLoops, buildOpenLoops, dueLoops, validateFollowUps } from "../open-loops.js";
import { buildRelationship, describeRelationship } from "../relationship.js";
import { summariseWellbeing } from "../wellbeing-context.js";
import { replyUtility } from "../reply-selection.js";
import { buildWriterMessages } from "../writer-prompt.js";

test("'when' phrases resolve from the entry date, not the clock", () => {
  assert.equal(resolveWhen("tmr", "2026-10-20"), "2026-10-21");          // Tue -> Wed
  assert.equal(resolveWhen("fri", "2026-10-20"), "2026-10-23");
  assert.equal(resolveWhen("this weekend", "2026-10-20"), "2026-10-24");
  assert.equal(resolveWhen("next week", "2026-10-20"), "2026-10-27");
  assert.equal(resolveWhen("2026-11-02", "2026-10-20"), "2026-11-02");
});

test("messy upcoming events are found in the user's own words", () => {
  const loops = patternLoops("got prez fri and maths exam tmr sia", "2026-10-20", "e1");
  const whats = loops.map((l) => l.what).sort();
  assert.deepEqual(whats, ["exam", "prez"]);
});

test("a loop is due a few days after, and resolved once a later entry mentions it", () => {
  const entries = [
    { id: "a", date: "2026-10-20", text: "presentation fri, scared" },
    { id: "b", date: "2026-10-22", text: "random day" },
  ];
  const loops = buildOpenLoops(entries);
  assert.equal(loops.length, 1);
  assert.equal(dueLoops(loops, "2026-10-24")[0].what, "presentation");
  assert.equal(dueLoops(loops, "2026-11-10").length, 0, "too old to bring up");
  const resolved = buildOpenLoops([...entries, { id: "c", date: "2026-10-23", text: "the presentation went ok" }]);
  assert.equal(resolved[0].resolved, true);
});

test("interpreter follow-ups must quote the user", () => {
  const ok = validateFollowUps([{ what: "swim meet", when: "sat", quote: "swim thing on sat" }], "i have my swim thing on sat", "2026-10-20");
  assert.equal(ok[0].due, "2026-10-24");
  assert.equal(validateFollowUps([{ what: "x", when: "sat", quote: "not there" }], "hello", "2026-10-20").length, 0);
});

function chatWith(pairs) {
  return { id: "r", date: "2026-10-01", text: "j", aiChat: [{ role: "user", text: "j", isJournal: true },
    ...pairs.flatMap(([ai, user]) => [{ role: "ai", text: ai }, { role: "user", text: user }])] };
}

test("relationship stats learn that questions get one-word answers from this person", () => {
  const pairs = [
    ...Array.from({ length: 6 }, () => ["what was the worst part?", "idk"]),
    ...Array.from({ length: 6 }, () => ["ugh that sounds so annoying", "ya and then she just left without saying anything to me"]),
  ];
  const rel = buildRelationship([chatWith(pairs)]);
  assert.ok(rel.question.p < 0.3, `question p ${rel.question.p}`);
  assert.ok(rel.noQuestion.p > 0.7);
  assert.match(describeRelationship(rel), /Questions often get a one-word answer/);
  const plan = { currentMessage: "ya", history: [], anchorTerms: [], questionBudget: 1, voice: {} };
  const asked = replyUtility("what happened next?", plan, null, { relationship: rel });
  const reacted = replyUtility("what happened next", plan, null, { relationship: rel });
  assert.ok(asked.components.learned < 0 && reacted.components.learned === 0);
});

test("engagement is judged against this person's own typical length", () => {
  const brief = Array.from({ length: 6 }, () => ["haha nice", "ya so fun"]);
  const rel = buildRelationship([chatWith(brief)]);
  assert.ok(rel.noQuestion.p > 0.6, "a naturally brief writer replying briefly is still engaged");
});

test("wellbeing context speaks only with enough evidence and never in numbers", () => {
  assert.equal(summariseWellbeing({ latentState: { theta: 5 }, mu: 10.5, confidence: 0.1 }), "");
  const low = summariseWellbeing({ latentState: { theta: 7 }, mu: 10.5, confidence: 0.6, trend: { window28: { direction: "down" } } });
  assert.match(low, /lower than their usual/);
  assert.match(low, /trending down/);
  assert.doesNotMatch(low, /\d/);
});

test("the writer sees how they've been, what's due, and what has worked", () => {
  const plan = { voice: {}, history: [], currentMessage: "hi", agenda: {},
    wellbeingContext: "They have been a bit lower than their usual lately.",
    openLoops: [{ what: "presentation", quote: "presentation fri", daysFromDue: 1 }],
    relationship: { reactions: 10, typicalWords: 6, question: { n: 6, p: 0.2 }, playful: { n: 1, p: 0.5 }, long: { n: 2, p: 0.5 } } };
  const [system] = buildWriterMessages(plan, { userMessage: "hi" });
  assert.match(system.content, /lower than their usual/);
  assert.match(system.content, /presentation \(they said "presentation fri", 1 day ago\)/);
  assert.match(system.content, /one-word answer/);
});
