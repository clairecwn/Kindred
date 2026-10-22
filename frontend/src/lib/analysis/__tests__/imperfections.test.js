import test from "node:test";
import assert from "node:assert/strict";
import { paraphraseSimilarity } from "../paraphrase.js";
import { figurativeLanguage, overLength, tightenReply, flowPenalties, PARAPHRASE_THRESHOLD } from "../reply-selection.js";
import { wordCap } from "../writer-prompt.js";

test("paraphrased repeats score high, related-but-new questions stay low", () => {
  for (const [a, b] of [["u could just chill tonight", "maybe relax a bit tonight"], ["what part is stressing u most", "which bit is the most pressure rn"], ["is it the exams or the internship", "are u more worried abt the papers or the intern"]])
    assert.ok(paraphraseSimilarity(a, b) >= PARAPHRASE_THRESHOLD, `${a} | ${b}`);
  for (const [a, b] of [["hows the exam prep going", "which exam is first"], ["did ur friend reply yet", "was it ur friend who ghosted or the recruiter"], ["u still tired from the shift", "did the shift end late"]])
    assert.ok(paraphraseSimilarity(a, b) < PARAPHRASE_THRESHOLD, `${a} | ${b}`);
});

test("re-asking in other words is flagged", () => {
  const plan = { currentMessage: "idk", history: [{ role: "ai", text: "oof. what part is stressing u most?" }, { role: "user", text: "idk" }] };
  assert.equal(flowPenalties("hmm which bit is the most pressure rn?", plan).flags.reasksQuestion, true);
});

test("figurative language is caught unless the user used the image", () => {
  assert.ok(figurativeLanguage("ngl that sounds like a rollercoaster of a day").length);
  assert.ok(figurativeLanguage("as if u needed more on ur plate").length);
  assert.deepEqual(figurativeLanguage("it feels like a lot rn"), []);
  assert.deepEqual(figurativeLanguage("chapter 5 is the worst"), []);
  assert.deepEqual(figurativeLanguage("ur social battery is dead", "my social battery is dead"), []);
});

test("length is capped relative to how they write", () => {
  assert.equal(overLength("ok that sucks", { currentMessage: "ya" }), 0);
  assert.ok(overLength("word ".repeat(45), { currentMessage: "ya sia so tired", typicalWords: 8 }) > 0);
  assert.equal(wordCap({ currentMessage: "ya" }), 15);
  assert.equal(wordCap({ currentMessage: "x ".repeat(60) }), 45);
});

test("tightening drops the image and long middle sentences but keeps the reaction and the question", () => {
  const draft = "oof that's rough. it's like a never ending storm of deadlines honestly. and the internship emails piling up on top of the exam stuff and the group project and everything else must be so much. which one is bugging u most tonight?";
  const out = tightenReply(draft, {}, "so many deadlines and internship emails", 25);
  assert.match(out, /^oof that's rough\./);
  assert.match(out, /\?$/);
  assert.doesNotMatch(out, /storm/);
});

import { chooseMove } from "../processing-moves.js";
import { emotionLabelMenu } from "../reply-selection.js";

test("first reply to an entry never opens with an emotion-word menu", () => {
  const entry = "today was so weird lol. went brunch w the girls n i spent like $60 on a top i dont even like that much. then scrolled ig n everyone posting their internships n im just here w nothing. applied to like 12 places n got ghosted by all. idk i feel so behind sia";
  const m = chooseMove({ userTexts: [entry], latest: entry, recentMoves: [], openThreads: [{ id: "a" }, { id: "b" }], interpretation: { need: "be-heard", mode: "literal" } });
  assert.ok(!["name-feeling", "choice"].includes(m.move), m.move);
  assert.ok(emotionLabelMenu("frustrated or regret, which one hits you more?"));
  assert.ok(!emotionLabelMenu("is it the internship or the brunch?"));
});

test("provider chain: local model first, then cache serves repeats", async () => {
  const { groqChat } = await import("../../groq.js");
  globalThis.__KINDRED_ENV__ = { VITE_LOCAL_LLM_URL: "http://127.0.0.1:11434/v1", VITE_LOCAL_LLM_MODEL: "gpt-oss:20b", VITE_GROQ_API_KEY: "x" };
  const store = new Map();
  globalThis.__KINDRED_LLM_CACHE__ = store;
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: "hey" }, finish_reason: "stop" }] }) }; };
  try {
    const messages = [{ role: "user", content: "hi" }];
    assert.equal(await groqChat({ messages }), "hey");
    assert.equal(calls[0].url, "http://127.0.0.1:11434/v1/chat/completions");
    assert.equal(calls[0].body.model, "gpt-oss:20b");
    assert.equal(await groqChat({ messages }), "hey");
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = realFetch; delete globalThis.__KINDRED_ENV__; delete globalThis.__KINDRED_LLM_CACHE__;
  }
});

test("an unreachable local model is skipped and Groq answers", async () => {
  const { groqChat } = await import("../../groq.js");
  globalThis.__KINDRED_ENV__ = { VITE_LOCAL_LLM_URL: "http://127.0.0.1:9/v1", VITE_GROQ_API_KEY: "x" };
  const urls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urls.push(url);
    if (String(url).includes("127.0.0.1")) throw new TypeError("fetch failed");
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: "from groq" }, finish_reason: "stop" }] }) };
  };
  try {
    assert.equal(await groqChat({ messages: [{ role: "user", content: "a" }] }), "from groq");
    const before = urls.length;
    assert.equal(await groqChat({ messages: [{ role: "user", content: "b" }] }), "from groq");
    assert.ok(urls.slice(before).every((u) => !String(u).includes("127.0.0.1")));
  } finally { globalThis.fetch = realFetch; delete globalThis.__KINDRED_ENV__; }
});
