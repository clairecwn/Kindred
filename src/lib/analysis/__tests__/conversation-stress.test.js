import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CONTEXT_TURNS,
  MAX_PROMPT_TURNS,
  buildConversationResponsePlan,
  localConversationReply,
  sanitiseConversationHistory,
  validateConversationReply,
} from "../conversation-response.js";
import { hasArtificialStyleTell } from "../companion-style.js";
import { normaliseCompanionStyle } from "../companion-style.js";

const USER_TURNS = [
  "Practice was rough and I did not play as well as I wanted, but I hope the next one is better.",
  "Mostly I kept losing the ball when the pace got faster.",
  "I know one bad session is not everything but it still got to me.",
  "No, I am not angry. I am more disappointed with myself.",
  "wdym by expectation",
  "I expected to keep up because I trained a lot this week.",
  "Then I started thinking maybe I am just not good enough for the team.",
  "Part of me wants to train harder but another part is already shag.",
  "The tired part is because school has also been piling work on us.",
  "I cannot properly rest because I keep thinking I should be improving.",
  "This happened last month too before a match.",
  "Back then I pushed through and played okay, but I was exhausted after.",
  "I do not want every hobby to become another performance test.",
  "Actually that is probably the part bothering me most.",
  "Soccer used to be where I could switch off.",
  "Now I am worried I am turning it into more homework.",
  "What can I do without giving up practice?",
  "Maybe I can keep one session each week where I do not track whether I played well.",
  "That idea feels less suffocating, like I can enjoy it again.",
  "Still not fully okay, but I think I understand why today hit me so hard.",
];

test("twenty-turn conversation keeps context, repairs, shifts strategy and avoids AI-style copy", () => {
  const originalEntry = USER_TURNS[0];
  const history = [];
  const moves = new Set();
  for (const userMessage of USER_TURNS.slice(1)) {
    const plan = buildConversationResponsePlan({ originalEntry, userMessage, chatHistory: history });
    const reply = localConversationReply(plan);
    moves.add(plan.responseMove);
    assert.equal(hasArtificialStyleTell(reply), null, `${userMessage}\n${reply}`);
    assert.ok((reply.match(/\?/g) ?? []).length <= plan.questionBudget, reply);
    assert.doesNotMatch(reply, /tell me more|say more about that|i'?m here with you/i);
    assert.equal(validateConversationReply(reply, plan).ok, true, `${userMessage}\n${reply}`);
    assert.ok(plan.promptHistory.length <= MAX_PROMPT_TURNS);
    history.push({ role: "user", text: userMessage }, { role: "ai", text: reply });
  }
  assert.ok(moves.has("repair-misattunement"));
  assert.ok(moves.has("clarify-own-meaning"));
  assert.ok(moves.has("separate-event-from-self-judgment"));
  assert.ok(moves.has("reflect-both-sides"));
  assert.ok(moves.has("collaborative-next-step"));
  const finalPlan = buildConversationResponsePlan({ originalEntry, userMessage: "I want to remember that soccer is also meant to be enjoyable.", chatHistory: history });
  assert.ok(finalPlan.threadState.userTurnCount >= 20);
  assert.ok(finalPlan.threadState.recurringTopics.some((item) => /soccer|practice|played|team/.test(item.topic)));
  assert.ok(finalPlan.threadState.rejectedEmotions.includes("angry"));
});

test("very long chats are bounded without collapsing to three prompts", () => {
  const history = Array.from({ length: 140 }, (_, index) => ({
    role: index % 2 ? "ai" : "user",
    text: index % 2 ? `Specific reflection ${index}` : `User context turn ${index} about school practice and rest`,
  }));
  const clean = sanitiseConversationHistory(history, "new turn");
  assert.equal(clean.length, MAX_CONTEXT_TURNS);
  const plan = buildConversationResponsePlan({ originalEntry: "School and practice keep colliding.", userMessage: "new turn about needing rest", chatHistory: history });
  assert.equal(plan.history.length, MAX_CONTEXT_TURNS);
  assert.equal(plan.promptHistory.length, MAX_PROMPT_TURNS);
  assert.ok(plan.threadState.userTurnCount > 20);
});

const DOMAIN_SCENARIOS = [
  ["My friend cancelled again and I do not know whether I can rely on them.", "I am less upset about tonight than about always having to keep my plans uncertain."],
  ["My colleague blamed me for a mistake they made.", "The unfair part is that I did the checking and still had to defend myself in front of everyone."],
  ["I miss my grandmother a lot this week.", "Cooking her recipe was comforting, but it also made the house feel emptier afterwards."],
  ["The group kept making plans without me.", "I do not need to join everything, but being forgotten without anyone asking still stings."],
  ["I have two good course offers and cannot decide.", "One gives me security and the other feels more meaningful, so neither choice is obviously wrong."],
  ["I finally submitted the project after months of work.", "I am proud that it is done and also strangely flat now that the pressure has disappeared."],
  ["My presentation went badly.", "I keep replaying the moment I froze and worrying that everyone now thinks I am incapable."],
  ["There is too much school work and I cannot rest.", "Even during a break I am counting what is unfinished, so it never feels like time off."],
  ["I want to improve at running, but training is taking over my week.", "Part of me wants to push harder and part of me misses moving without measuring everything."],
  ["The new role is exciting but I feel out of my depth.", "I want the opportunity and I am scared I will disappoint the people who trusted me."],
];

test("diverse life contexts produce grounded, non-formulaic local replies", () => {
  for (const [originalEntry, userMessage] of DOMAIN_SCENARIOS) {
    const plan = buildConversationResponsePlan({ originalEntry, userMessage, chatHistory: [] });
    const reply = localConversationReply(plan);
    assert.equal(hasArtificialStyleTell(reply), null, `${userMessage}\n${reply}`);
    assert.equal(validateConversationReply(reply, plan).ok, true, `${userMessage}\n${reply}`);
    assert.ok((reply.match(/\?/g) ?? []).length <= plan.questionBudget, reply);
  }
});

test("style boundary removes long dashes and detects canned companion language", () => {
  assert.equal(normaliseCompanionStyle("That was hard — and it mattered – a lot."), "That was hard, and it mattered, a lot.");
  assert.equal(hasArtificialStyleTell("I'm here with you. Tell me more."), "canned-empathy");
  assert.equal(hasArtificialStyleTell("It sounds like you are overwhelmed."), "formulaic-opener");
});
