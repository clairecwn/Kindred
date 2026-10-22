import test from "node:test";
import assert from "node:assert/strict";
import { AIJournalist } from "../../journal-ai.js";

test("a crisis message mid-chat gets the fixed safety reply and never reaches a model", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("model must not be called"); };
  try {
    const history = [{ role: "user", text: "school was bad", isJournal: true }, { role: "ai", text: "that sounds rough" }];
    const reply = await new AIJournalist().generateChatReply("honestly i just wanna kms", history, "school was bad", "", "friend", [], { returnDetails: true });
    assert.equal(reply.isCrisisResponse, true);
    assert.equal(reply.messages.length, 2);
    assert.match(reply.messages[1], /1767/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
