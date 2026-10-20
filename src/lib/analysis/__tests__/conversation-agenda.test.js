import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationResponsePlan, validateConversationReply } from "../conversation-response.js";

const ENTRY = "omg tdy the concert tickets for tate mcrae coming out i must get it if i dont im gonna cry omg also tdy i went out shopping with emily but idk why i was just like not really in the mood to talk/couldnt pick up the convo/no vibes then like it was kinda awkward its a bit bumm";

const TICKET_HISTORY = [
  { role: "ai", text: "Tate McRae tickets are going on sale today. That is exciting, and the shopping trip with Emily also sounded a bit awkward." },
  { role: "user", text: "if i get the ticket ig lol. but in all seriousness ive been the biggest fan so i would loveee to go for the concert" },
  { role: "ai", text: "Getting to see her live would mean a lot after following her for so long." },
];

test("entry topics stay distinct and enough prior coverage opens the unexplored concern", () => {
  const initial = buildConversationResponsePlan({ userMessage: ENTRY });
  assert.equal(initial.agenda.focusId, "liveEvent");
  assert.deepEqual(initial.agenda.topics.map((topic) => topic.id).sort(), ["liveEvent", "socialOuting"]);
  assert.match(initial.agenda.topics.find((topic) => topic.id === "socialOuting").evidence, /shopping with emily.*convo/i);

  const plan = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: TICKET_HISTORY, userMessage: "yeahhh" });
  assert.equal(plan.agenda.move, "bridge-to-unexplored-topic");
  assert.equal(plan.agenda.focusId, "socialOuting");
  assert.equal(plan.questionBudget, 1);
  assert.equal(plan.responseMove, "bridge-to-unexplored-topic");
  assert.equal(validateConversationReply("So, what was the other part you wanted to talk about?", plan).ok, false);
  assert.equal(validateConversationReply("Sounds like you are hoping the tickets will finally come through.", plan).ok, false);
  assert.equal(validateConversationReply("The shopping trip with Emily felt oddly quiet even though you usually talk easily. Was it just an off day together?", plan).ok, true);
});

test("an explicit request for the other part names the known topic", () => {
  const plan = buildConversationResponsePlan({
    originalEntry: ENTRY,
    chatHistory: [...TICKET_HISTORY, { role: "user", text: "js open many tabs and hope 1 lets me get the tickets" }, { role: "ai", text: "You can try that when sales open." }],
    userMessage: "chat its not available till they release it and thats not the only thing ive mentioned in my entry",
  });
  assert.equal(plan.intent, "other-topic-request");
  assert.equal(plan.agenda.focusId, "socialOuting");
  assert.equal(plan.agenda.move, "follow-requested-other-topic");
  assert.equal(validateConversationReply("Sure, what else would you like to explore?", plan).ok, false);
});

test("recall question requires both journal concerns", () => {
  const plan = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: TICKET_HISTORY, userMessage: "what do you remember about my journal entry" });
  assert.equal(plan.intent, "journal-recall-question");
  assert.equal(plan.questionBudget, 0);
  assert.equal(validateConversationReply("You wanted Tate McRae concert tickets.", plan).ok, false);
  assert.equal(validateConversationReply("You were excited about Tate McRae tickets, and shopping with Emily felt awkward because the conversation did not flow.", plan).ok, true);
});

test("a new concern in chat becomes the focus without erasing entry topics", () => {
  const plan = buildConversationResponsePlan({
    originalEntry: ENTRY,
    chatHistory: TICKET_HISTORY,
    userMessage: "Also my mum called and said she might move away next month, which is worrying me.",
  });
  assert.equal(plan.agenda.move, "follow-new-or-returned-topic");
  assert.ok(!["liveEvent", "socialOuting"].includes(plan.agenda.focusId));
  assert.match(plan.agenda.focusEvidence, /mum called|move away/i);
  assert.ok(plan.agenda.topics.some((topic) => topic.id === "liveEvent"));
  assert.ok(plan.agenda.topics.some((topic) => topic.id === "socialOuting"));
});

test("saved journal and user chat add bounded topic-specific memory evidence", () => {
  const memoryEntries = [{
    id: "earlier-emily",
    date: "2026-10-01",
    text: "Shopping with Emily usually means talking about school for hours.",
    aiChat: [
      { role: "ai", text: "You two never run out of things to say." },
      { role: "user", text: "Sometimes we are both tired and the conversation gets quiet." },
    ],
  }];
  const plan = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: TICKET_HISTORY, userMessage: "yeahhh", memoryEntries });
  const social = plan.agenda.topics.find((topic) => topic.id === "socialOuting");
  assert.equal(plan.agenda.focusId, "socialOuting");
  assert.equal(social.memoryId, "earlier-emily");
  assert.ok(social.memoryScore > 0 && social.memoryScore <= 0.12);
  assert.equal(plan.memory.memories[0]?.id, "earlier-emily");
  assert.match(plan.memory.memories[0].userText, /both tired/);
  assert.doesNotMatch(plan.memory.memories[0].userText, /never run out/);
});

test("slang and spontaneous-flow corrections stay on the social concern", () => {
  const history = [...TICKET_HISTORY, { role: "user", text: "There wasn't a conversation flowing well with Emily." }, { role: "ai", text: "It felt off compared with how you usually talk." }];
  const tea = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: history, userMessage: "by tea i mean gossip and stories about our lives" });
  assert.equal(tea.intent, "correction");
  assert.equal(tea.agenda.focusId, "socialOuting");
  const flow = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: history, userMessage: "no need to go with the vibe lor" });
  assert.equal(flow.intent, "correction");
  assert.equal(flow.agenda.focusId, "socialOuting");
});

test("uncertainty about a flat conversation gets a contribution before another fix-it question", () => {
  const history = [
    ...TICKET_HISTORY,
    { role: "user", text: "There wasn't a conversation flowing well with Emily." },
    { role: "ai", text: "What do you think was missing for it to click?" },
  ];
  const plan = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: history, userMessage: "idk why it felt like that" });
  assert.equal(plan.agenda.focusId, "socialOuting");
  assert.equal(plan.responseMove, "offer-tentative-possibilities");
  assert.equal(plan.questionBudget, 0);
  assert.equal(validateConversationReply("What would help you feel more in sync with Emily next time?", plan).ok, false);
  assert.equal(validateConversationReply("Maybe you were both a bit tired and the chat had less momentum than usual. One quiet outing does not tell you much about the friendship.", plan).ok, true);
});

test("a short acknowledgement alone does not switch topics, and fresh detail keeps the current concern active", () => {
  const early = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: TICKET_HISTORY.slice(0, 1), userMessage: "yeahhh" });
  assert.equal(early.agenda.focusId, "liveEvent");
  assert.notEqual(early.agenda.move, "bridge-to-unexplored-topic");

  const continued = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: TICKET_HISTORY, userMessage: "yeah but the concert tickets release at noon and I really want to go" });
  assert.equal(continued.agenda.focusId, "liveEvent");
  assert.notEqual(continued.agenda.move, "bridge-to-unexplored-topic");

  const withoutAcknowledgement = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: TICKET_HISTORY, userMessage: "I can wait for now." });
  assert.equal(withoutAcknowledgement.agenda.focusId, "socialOuting");
  assert.equal(withoutAcknowledgement.agenda.move, "bridge-to-unexplored-topic");
});

test("each assistant turn changes coverage and relative priorities", () => {
  const before = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: TICKET_HISTORY.slice(0, 2), userMessage: "okay" }).agenda;
  const after = buildConversationResponsePlan({ originalEntry: ENTRY, chatHistory: TICKET_HISTORY, userMessage: "okay" }).agenda;
  assert.ok(after.topics.find((topic) => topic.id === "liveEvent").assistantTurns > before.topics.find((topic) => topic.id === "liveEvent").assistantTurns);
  assert.ok(after.topics.find((topic) => topic.id === "socialOuting").priorityProbability > before.topics.find((topic) => topic.id === "socialOuting").priorityProbability);
  assert.equal(after.trace.at(-2).role, "ai");
});

test("linked concerns can be developed together, while an unrelated addition stays separate", () => {
  const unrelated = buildConversationResponsePlan({ userMessage: "I want tickets for the concert, and shopping with Emily felt awkward." }).agenda;
  assert.equal(unrelated.focusIds.length, 1);
  assert.ok(unrelated.relations.every((relation) => relation.probability < 0.68));

  const linked = buildConversationResponsePlan({ userMessage: "I want tickets for the concert because Emily will be going with me and our last shopping trip felt awkward." }).agenda;
  assert.equal(linked.move, "develop-linked-topics");
  assert.deepEqual(linked.focusIds.sort(), ["liveEvent", "socialOuting"]);
  assert.ok(linked.relations.some((relation) => relation.probability >= 0.68));
});
