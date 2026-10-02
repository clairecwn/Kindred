import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConversationResponsePlan,
  localInitialReflection,
  localConversationReply,
  scoreConversationReply,
  sanitiseConversationHistory,
  validateConversationReply,
} from "../conversation-response.js";

test("removes a duplicated current user turn at the API boundary", () => {
  const history = [
    { role: "ai", text: "The deadline seems to be adding pressure. What feels most urgent?" },
    { role: "user", text: "The presentation tomorrow is the worst part." },
  ];
  const clean = sanitiseConversationHistory(history, "The presentation tomorrow is the worst part.");
  assert.equal(clean.length, 1);
  assert.equal(clean[0].role, "ai");
});

test("latest disclosure drives the plan instead of being drowned by the journal entry", () => {
  const plan = buildConversationResponsePlan({
    originalEntry: "The whole day was exhausting and my assignment backlog felt impossible.",
    chatHistory: [{ role: "ai", text: "The backlog sounds draining. Which part is weighing on you?" }],
    userMessage: "Actually I finished the assignment; now I am nervous about presenting it tomorrow.",
    detectedEmotion: "frustrated",
  });
  assert.equal(plan.intent, "correction");
  assert.match(plan.anchor, /finished|nervous|presenting/i);
  assert.ok(plan.affectShift.valence > -0.5);
  assert.equal(plan.questionBudget, 0);
  assert.equal(plan.repairNeeded, true);
});

test("answering a companion question produces reflection rather than another question", () => {
  const plan = buildConversationResponsePlan({
    originalEntry: "My holiday is ending and I have a pile of work.",
    chatHistory: [{ role: "ai", text: "Which part feels most aggravating right now?" }],
    userMessage: "Mostly that I wasted the week and now everything is due together.",
  });
  assert.equal(plan.questionBudget, 0);
  assert.match(plan.questionReason, /already been answering/);
  assert.equal((localConversationReply(plan).match(/\?/g) ?? []).length, 0);
});

test("links causes across journal context and a new disclosure", () => {
  const plan = buildConversationResponsePlan({
    originalEntry: "My teammate keeps changing our presentation slides at the last minute.",
    chatHistory: [{ role: "ai", text: "What is the hardest part of that?" }],
    userMessage: "I cannot prepare properly and I am scared I will freeze and disappoint the group.",
  });
  assert.ok(plan.causes.some((cause) => cause.type === "evaluationThreat"));
  assert.ok(plan.causes.some((cause) => cause.type === "interpersonalUnreliability"));
  const reply = localConversationReply(plan);
  assert.match(reply, /evaluated|letting people down|letting the group down/i);
  assert.match(reply, /depend(?:ing)? on someone|keep(?:s)? changing|keep shifting/i);
  assert.doesNotMatch(reply, /When you mention/);
});

test("local fallback is grounded and never falls back to tell-me-more copy", () => {
  const plan = buildConversationResponsePlan({
    originalEntry: "I have too much schoolwork.",
    userMessage: "The group project is frustrating because nobody replies until midnight.",
  });
  const reply = localConversationReply(plan);
  assert.match(reply, /group project|nobody replies|midnight/i);
  assert.doesNotMatch(reply, /tell me more|what else is on your mind|i'?m listening/i);
  assert.equal(validateConversationReply(reply, plan).ok, true);
});

test("validator rejects generic exploration and questions above the plan budget", () => {
  const plan = buildConversationResponsePlan({
    originalEntry: "I am worried about tomorrow.",
    chatHistory: [{ role: "ai", text: "What about tomorrow feels difficult?" }],
    userMessage: "I might disappoint my teammates if I freeze during the pitch.",
  });
  assert.equal(plan.questionBudget, 0);
  assert.equal(validateConversationReply("I'm here with you. Tell me more.", plan).ok, false);
  assert.equal(validateConversationReply("Freezing during the pitch seems tied to letting your teammates down. Is that the main fear?", plan).ok, false);
  assert.equal(validateConversationReply("Freezing during the pitch seems frightening partly because you care about not letting your teammates down.", plan).ok, true);
});

test("explicit advice request changes the policy without adding an interrogation", () => {
  const plan = buildConversationResponsePlan({
    originalEntry: "I keep putting off revision.",
    userMessage: "What should I do if opening the notes already makes me want to avoid it?",
  });
  assert.equal(plan.intent, "advice-request");
  assert.equal(plan.adviceRequested, true);
  assert.equal(plan.questionBudget, 0);
});

test("contextual-fit score prefers a grounded reflection to a generic prompt", () => {
  const plan = buildConversationResponsePlan({
    originalEntry: "I am stressed about group work.",
    userMessage: "My teammate changes the slides at the last minute and I cannot prepare.",
  });
  const grounded = scoreConversationReply(
    "The last-minute slide changes sound unsettling because they leave you unable to prepare properly.",
    plan,
  );
  const generic = scoreConversationReply("I'm listening. Tell me more about how you feel.", plan);
  assert.ok(grounded.score > generic.score);
  assert.ok(grounded.grounding > generic.grounding);
  assert.ok(generic.genericPenalty > 0);
});

test("informal clarification request repairs vague companion language", () => {
  const plan = buildConversationResponsePlan({
    originalEntry: "School keeps covering too many things at once and I cannot relax.",
    chatHistory: [
      { role: "ai", text: "That stays with me. Where does it go from here?" },
      { role: "user", text: "It feels like there is never enough time to absorb anything." },
      { role: "ai", text: "What does that bring up for you?" },
    ],
    userMessage: "wdym lol",
  });
  assert.equal(plan.intent, "clarification-request");
  assert.equal(plan.questionBudget, 0);
  const reply = localConversationReply(plan);
  assert.match(reply, /phrased that too vaguely/i);
  assert.doesNotMatch(reply, /tell me more|where does it go/i);
});

test("initial reflection supports processing without announcing an emotion verdict", () => {
  const plan = buildConversationResponsePlan({
    userMessage: "Morning is coursework, afternoon is a paid shift, then I return to assignments, and the room is unbearably humid.",
  });
  const reply = localInitialReflection(plan);
  assert.match(reply, /little room to reset|one responsibility/i);
  assert.match(reply, /amount|switch off|rest/i);
  assert.doesNotMatch(reply, /you sound|not simply|not just|sad|diagnos/i);
});

test("rejecting the assistant's emotion label triggers an explicit repair", () => {
  const originalEntry = "Practice was exhausting and the session did not go well, though I hope the next one is better.";
  const plan = buildConversationResponsePlan({
    originalEntry,
    chatHistory: [{ role: "ai", text: "You're allowed to be angry. What got hurt or disrespected?" }],
    userMessage: "What are you saying? I am not angry.",
    detectedEmotion: "angry",
  });
  assert.equal(plan.intent, "correction");
  assert.equal(plan.repairNeeded, true);
  assert.equal(plan.questionBudget, 0);
  assert.ok(plan.causes.some((cause) => cause.type === "outcomeShortfall"));
  const reply = localConversationReply(plan);
  assert.match(reply, /my mistake|read an emotion/i);
  assert.match(reply, /hard|did not go as well|next one/i);
  assert.doesNotMatch(reply, /tell me more|say more|angry|hurt|disrespect/i);
});

test("new performance detail is integrated with the journal context", () => {
  const plan = buildConversationResponsePlan({
    originalEntry: "The session was rough, but I hope tomorrow is better.",
    chatHistory: [
      { role: "ai", text: "I misunderstood that." },
      { role: "user", text: "I was not saying I was angry." },
      { role: "ai", text: "You're right; I read that into it." },
    ],
    userMessage: "Training was very hard and I don't think I performed my best.",
  });
  const reply = localConversationReply(plan);
  assert.ok(plan.causes.some((cause) => cause.type === "outcomeShortfall"));
  assert.ok(plan.causes.some((cause) => cause.type === "effortfulExperience"));
  assert.match(reply, /session|perform|attempt/i);
  assert.doesNotMatch(reply, /tell me more|say more|angry/i);
});
