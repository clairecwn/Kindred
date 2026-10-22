import test from "node:test";
import assert from "node:assert/strict";
import { needFit, ageFit, lengthFit, parseDrafts, selectReply } from "../reply-selection.js";
import { buildWriterMessages, styleCard, PERSONA } from "../writer-prompt.js";

test("drafts parse from JSON, and plain text falls back to one draft", () => {
  assert.deepEqual(parseDrafts('{"drafts":["a","b"]}'), ["a", "b"]);
  assert.deepEqual(parseDrafts('sure ```{"drafts":["x"]}```'), ["x"]);
  assert.deepEqual(parseDrafts("just text"), ["just text"]);
  assert.deepEqual(parseDrafts(""), []);
});

test("play gets play back: a feelings interview scores lower than a playful reply", () => {
  const playful = needFit("hahaha 6 7 again, you're unstoppable", "play");
  const interview = needFit("It sounds like you're feeling playful. How does that make you feel?", "play");
  assert.ok(playful > interview);
});

test("venting is not fixed unless advice was asked for", () => {
  assert.ok(needFit("ugh that's so unfair, of course you're annoyed", "vent") > needFit("you should try talking to your teacher", "vent"));
  assert.ok(needFit("you could try asking her first", "advice", { adviceRequested: true }) >= 0.5);
});

test("child mode prefers short everyday sentences", () => {
  const simple = ageFit("that sounds scary. i'm glad you told me.", "child");
  const complex = ageFit("Considering the circumstances, experiencing apprehension regarding interpersonal interactions is understandable.", "child");
  assert.ok(simple > complex);
  assert.equal(ageFit("anything at all", "adult"), 1);
});

test("replies far longer than the user writes are penalised", () => {
  const plan = { currentMessage: "sian" };
  assert.ok(lengthFit("same, so sian", plan) > lengthFit("word ".repeat(80), plan));
});

test("selection prefers a valid draft, then higher utility", () => {
  const plan = { currentMessage: "6 7 lol", history: [], anchorTerms: [], questionBudget: 1, voice: {} };
  const validate = (text) => ({ ok: !/INVALID/.test(text), reason: /INVALID/.test(text) ? "x" : null });
  const { best, ranked } = selectReply(["INVALID but long and great", "hahaha 6 7 again", "It sounds like you are feeling playful. How does that make you feel?"],
    plan, { need: "play" }, { validate });
  assert.equal(best.text, "hahaha 6 7 again");
  assert.equal(ranked.at(-1).check.ok, false);
});

test("writer prompt is persona + style card + user's own examples, not reply templates", () => {
  const plan = { voice: { register: "casual", pace: "brief", lowercaseShare: 0.95, particles: ["lor"], laughterMarkers: ["haha"] },
    history: [{ role: "user", text: "ya lor sian" }, { role: "ai", text: "AI TEXT SHOULD NOT BE A STYLE SAMPLE" }],
    currentMessage: "6 7 haha", agenda: {}, interpretation: { gloss: "joking around", mode: "play", need: "play", terms: [], unknownTerms: [] } };
  const [system] = buildWriterMessages(plan, { userMessage: "6 7 haha", ageBand: "child" });
  assert.ok(system.content.startsWith(PERSONA));
  assert.match(system.content, /ya lor sian/);
  assert.doesNotMatch(system.content.split("Their own recent messages")[1].split("\n")[0], /AI TEXT/);
  assert.match(system.content, /This person is a child/);
  assert.match(system.content, /What they seem to want: play/);
  assert.match(styleCard(plan.voice), /lowercase/);
});
