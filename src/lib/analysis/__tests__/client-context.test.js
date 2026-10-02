import test from "node:test";
import assert from "node:assert/strict";
import { buildClientCulturalContext } from "../client-context.js";

test("returns a soft-signal context object with no identity fields", () => {
  const ctx = buildClientCulturalContext("just a normal day");
  assert.ok("locale" in ctx);
  assert.ok("region" in ctx);
  assert.ok("journalLanguageHint" in ctx);
  assert.equal("ethnicity" in ctx, false);
  assert.equal("race" in ctx, false);
});

test("detects a CJK script hint from journal text without any declared identity", () => {
  const ja = buildClientCulturalContext("今日はとても疲れました");
  assert.equal(ja.journalLanguageHint, "ja");

  const zh = buildClientCulturalContext("我今天很累");
  assert.equal(zh.journalLanguageHint, "zh");

  const en = buildClientCulturalContext("I am tired today");
  assert.equal(en.journalLanguageHint, null);
});

test("detects Singlish from the journal itself as a soft language hint", () => {
  const ctx = buildClientCulturalContext("Nvm lor, used to it already");
  assert.equal(ctx.journalLanguageHint, "singlish");
});
