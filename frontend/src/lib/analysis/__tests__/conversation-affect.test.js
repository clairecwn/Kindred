import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationResponsePlan, validateConversationReply } from "../conversation-response.js";

const ENTRY = "wahh i feel like got not a lot of energy tdy idk why sia, hais tdy class also sooo boring the lecturer just went on and on for no reason omggg ok but got to meet bf hehe then dinner with bestie was damn fun we yapped a lot";

test("a brief answer gets a specific continuation instead of a closing paraphrase", () => {
  const plan = buildConversationResponsePlan({
    originalEntry: ENTRY,
    chatHistory: [{ role: "ai", text: "The dinner with your bestie sounded fun. Did it help with the low energy?" }],
    userMessage: "yess it doesss",
  });
  assert.equal(plan.questionBudget, 1);
  assert.equal(plan.continuationRequired, true);
  assert.match(plan.answerContext, /dinner.*bestie/i);
  assert.equal(validateConversationReply("Glad dinner lifted your spirits a bit.", plan).reason, "reply-closes-after-brief-answer");
  assert.equal(validateConversationReply("Nice, what made dinner so fun for you two?", plan).ok, true);
});

test("chat affect updates with new evidence and ignores empty acknowledgements", () => {
  const first = buildConversationResponsePlan({ originalEntry: ENTRY, userMessage: "Dinner with my bestie was really fun." });
  const changed = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: [
    { role: "user", text: "Dinner with my bestie was really fun." },
    { role: "ai", text: "What was the rough part of the day?" },
  ], userMessage: "The lecture was boring and I felt drained." });
  const acknowledged = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: [
    { role: "user", text: "Dinner with my bestie was really fun." },
    { role: "ai", text: "What was the rough part of the day?" },
    { role: "user", text: "The lecture was boring and I felt drained." },
    { role: "ai", text: "That class went on for ages." },
  ], userMessage: "mhmm" });
  assert.ok(changed.affect.overallVad.valence < first.affect.overallVad.valence);
  assert.deepEqual(acknowledged.affect.overallVad, changed.affect.overallVad);
  assert.ok(changed.affect.topics.find((topic) => topic.id === "socialMeal").vad.valence > 0);
  assert.ok(changed.affect.topics.find((topic) => topic.id === "academic").vad.valence < 0);
});
