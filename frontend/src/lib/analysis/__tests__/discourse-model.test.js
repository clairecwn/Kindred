import test from "node:test";
import assert from "node:assert/strict";
import { buildDiscourseModel, discourseThreadCoverage } from "../discourse-model.js";
import {
  buildConversationResponsePlan,
  localConversationReply,
  localInitialReflection,
  validateConversationReply,
} from "../conversation-response.js";

const ENTRY = "tdys weather damn jialat so hot haisss but at least i got a lot of work done. need start studying for midterms but want go out also dilemma goes crazyy and sg lowk got nth do sia iw go out have fun tho";
const FOLLOW_UP = "i think the midterms coming soon and the fact that i have a lot to catch up on coz idw to fall behind. but since the next 2 days are the lasr days of the hols i also want to go out but sg got nothing much to do the activities are quite boring";

test("multi-part Singlish entry preserves study, leisure, achievement and weather threads", () => {
  const model = buildDiscourseModel({ originalEntry: ENTRY });
  const ids = new Set(model.threads.map((thread) => thread.id));
  assert.ok(ids.has("academic"));
  assert.ok(ids.has("leisure"));
  assert.ok(ids.has("weather"));
  assert.ok(ids.has("achievement"));
  assert.equal(model.academicLeisureConflict, true);
  assert.ok(model.relations.some((relation) => relation.type === "goal-conflict"));
  const leisure = model.threads.find((thread) => thread.id === "leisure");
  assert.equal(leisure.blocked, true);
  assert.match(leisure.summary, /limited|boring/i);
});

test("midterms and catching up stay grouped while leisure remains a separate thread", () => {
  const history = [{ role: "user", text: FOLLOW_UP }, { role: "ai", text: "Earlier reply" }];
  const plan = buildConversationResponsePlan({ originalEntry: ENTRY, userMessage: "wdym", chatHistory: history });
  const academic = plan.discourseModel.threads.find((thread) => thread.id === "academic");
  const leisure = plan.discourseModel.threads.find((thread) => thread.id === "leisure");
  assert.match(academic.summary, /assessments.*catching up|catching up.*assessments/i);
  assert.match(leisure.summary, /activities.*limited|limited.*activities/i);
  const reply = localConversationReply(plan);
  assert.match(reply, /midterms and catching up are one study problem/i);
  assert.match(reply, /options in Singapore feel boring/i);
  assert.equal(validateConversationReply(reply, plan).ok, true);
});

test("grouping corrections are accepted directly without defensiveness or another question", () => {
  const history = [{ role: "user", text: FOLLOW_UP }, { role: "ai", text: "Earlier reply" }];
  const plan = buildConversationResponsePlan({
    originalEntry: ENTRY,
    userMessage: "hmm but they are the same thing basically studying all day",
    chatHistory: history,
  });
  const reply = localConversationReply(plan);
  assert.equal(plan.intent, "grouping-correction");
  assert.equal(plan.questionBudget, 0);
  assert.match(reply, /belong together as one study pressure/i);
  assert.match(reply, /other part.*holiday time.*bored/i);
  assert.doesNotMatch(reply, /my mistake|i had the focus wrong|sorry|\?/i);
  assert.equal(validateConversationReply(reply, plan).ok, true);
});

test("repair after confusion restates all important threads instead of falling back to weather", () => {
  const history = [{ role: "user", text: FOLLOW_UP }, { role: "ai", text: "Earlier reply" }];
  const plan = buildConversationResponsePlan({ originalEntry: ENTRY, userMessage: "huhhh what u saying", chatHistory: history });
  const reply = localConversationReply(plan);
  assert.equal(plan.intent, "correction");
  assert.match(reply, /midterms and catching up/i);
  assert.match(reply, /Singapore feel boring/i);
  assert.doesNotMatch(reply, /weather|my mistake|i had the focus wrong|tell me more/i);
  assert.equal(validateConversationReply(reply, plan).ok, true);
});

test("response coverage rejects replies that drop the separate leisure concern", () => {
  const model = buildDiscourseModel({ originalEntry: ENTRY, history: [{ role: "user", text: FOLLOW_UP }] });
  const partial = discourseThreadCoverage("Catching up for midterms is stressful.", model, 2);
  const complete = discourseThreadCoverage("Catching up for midterms is stressful, and the activities for going out feel boring.", model, 2);
  assert.equal(partial.ratio, 0.5);
  assert.equal(complete.ratio, 1);
});

test("initial reflection covers the useful achievement, study pressure and leisure problem", () => {
  const plan = buildConversationResponsePlan({ userMessage: ENTRY });
  const reply = localInitialReflection(plan);
  assert.match(reply, /got meaningful work done/i);
  assert.match(reply, /midterms and catching up/i);
  assert.match(reply, /Singapore.*fun/i);
  assert.doesNotMatch(reply, /two study problems|simply sad|anger|[—–]/i);
});
