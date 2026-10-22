import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationResponsePlan } from "../conversation-response.js";
import { buildVoiceProfile } from "../conversation-guidance.js";
import { classifyTurnAct } from "../turn-act.js";
import { chooseMove } from "../processing-moves.js";
import { selectReply } from "../reply-selection.js";

/** Build a plan the way journal-ai.js does, then pick between drafts. */
export function judge(journal, chat, latest, drafts, extra = {}) {
  const history = [{ role: "user", text: journal, isJournal: true }, ...chat];
  const plan = buildConversationResponsePlan({ originalEntry: journal, userMessage: latest, chatHistory: history });
  plan.originalEntry = journal;
  plan.voice = buildVoiceProfile(journal, plan.history, latest);
  plan.turnAct = classifyTurnAct(latest, history, { playMass: extra.playMass ?? 0 });
  plan.questionBudget = 1;
  plan.processingMove = chooseMove({ focus: extra.focus ?? { explorationDepth: 0.3 }, latest, turnAct: plan.turnAct,
    userTexts: [journal, ...chat.filter((t) => t.role === "user").map((t) => t.text)],
    recentMoves: extra.recentMoves ?? ["choice"], untouchedThreads: extra.untouched ?? [], interpretation: { need: "be-heard" } });
  return { plan, move: plan.processingMove.move, act: plan.turnAct.act, ...selectReply(drafts, plan, null) };
}

const EMO = `tdy was actually quite nice at first sia but idk why end up feeling so emo HAHAHA... morning went out with my friends for brunch and we were laughing like mad over the stupidest things, then aftn we went shopping and i saw this damn cute top but it was like $60?? hello for one piece of cloth abit ridiculous leh... but now i lowk regret not buying it hais. then later while taking mrt home i was scrolling ig and saw everyone posting their internships and achievements, suddenly felt abit sian sia like how come everyone seems to have their life sorted out except me... i know shouldn't compare la but sometimes really cannot help it lor. then my mum ask me how my job applications going and i just said okay cos i dw explain that i've been getting ghosted left right centre 😭 now lying in bed thinking abt everything when i was literally so happy just a few hours ago... wah my mood swings damn power sia idk why i always overthink at night haisss`;
const Q1 = { role: "ai", text: "more like your brain's on overdrive from the day's highs, or more like the pressure of seeing everyone's wins got you stuck in a loop?" };
const A1 = "everyone winning the rat race lor like lowk i just wanna chill but i also dont want to fall behind the rest";
const GHOSTED = [{ summary: "job applications getting ghosted, didn't tell mum", quote: "i've been getting ghosted left right centre" }];

test("[user transcript] an answer with two pulls gets a double-sided reflection, not the same menu again", () => {
  const r = judge(EMO, [Q1], A1, [
    "more like you're stuck between wanting to keep up with the crowd, or just wanting to chill and not feel pressured?",
    "ya wanting to chill but also not wanting to fall behind is so tiring, esp when ig is just everyone's highlights",
  ], { untouched: GHOSTED });
  assert.equal(r.move, "double-sided");
  assert.match(r.best.text, /^ya wanting to chill/);
  assert.ok(r.ranked.find((d) => /stuck between/.test(d.text)).components.menuAfterAnswer);
});

test("[user transcript] 'huh' gets a short repair, never a meme or a new topic", () => {
  const chat = [Q1, { role: "user", text: A1 }, { role: "ai", text: "more like you're stuck between wanting to keep up with the crowd, or just wanting to chill and not feel pressured?" }];
  const r = judge(EMO, chat, "huh", [
    "got a meme for you: 'when you're just trying to relax but everyone's posting their winning pics', hit me up if you wanna see it",
    "my bad that was confusing. i meant it sounds tiring to wanna chill but still feel like u cant fall behind",
  ]);
  assert.equal(r.act, "repair");
  assert.equal(r.move, "repair");
  assert.match(r.best.text, /^my bad/);
});

test("[user transcript] a bare 'ya' moves to the untouched heavy thread instead of generic reassurance", () => {
  const chat = [Q1, { role: "user", text: A1 }, { role: "ai", text: "ya wanting to chill but also not wanting to fall behind is so tiring, esp when ig is just everyone's highlights" }];
  const r = judge(EMO, chat, "ya", [
    "or maybe it's just the brain's way of saying you're doing fine, don't stress, you got this, even if it feels like a rollercoaster right now",
    "and the ghosting from applications prob makes the falling behind part hit harder, esp when u had to tell ur mum it's okay",
  ], { untouched: GHOSTED, recentMoves: ["choice", "double-sided"] });
  assert.equal(r.move, "connect");
  assert.match(r.best.text, /ghosting/);
  assert.ok(r.ranked.find((d) => /you got this/.test(d.text)).components.genericReassurance);
});

// ── New scenarios in the same texting style ───────────────────────────────
const SHIFT = `ytd closing shift at work damn shag sia, manager keep pushing me to cover extra hours even tho i told him got exam next week. i said ok cos paiseh to say no but now i lowk regret. then reach home my sis was blasting music until 2am i cannot sleep at all. today in lecture literally blanking out the whole time haiz`;
test("[new] picking an option gets taken up, not offered again", () => {
  const q = { role: "ai", text: "damn that's a lot, is it more the manager pushing you or more the no sleep that's getting to you?" };
  const r = judge(SHIFT, [q], "the manager one la, i hate that i cant say no", [
    "so is it more the manager or more the sleep that's bugging you?",
    "ya not being able to say no to him when u literally have an exam next week is so frustrating, it's like ur being nice and paying for it",
  ]);
  assert.equal(r.act, "option");
  assert.match(r.best.text, /say no/);
  assert.ok(r.ranked.find((d) => /more the manager or more the sleep/.test(d.text)).components.reasksQuestion);
});

const BREAKUP = `ok i finally blocked him today. idk why i feel so empty tho when i was the one who ended it?? like i know its the right choice but i keep checking his ig anyway... my friends say im better off which i know but i just miss having someone to talk to at night`;
test("[new] ambivalence in an answer is reflected back, both sides true", () => {
  const q = { role: "ai", text: "is it more missing him, or more missing the routine of having someone?" };
  const r = judge(BREAKUP, [q], "i want to move on but i also keep wishing he would text first", [
    "is it more like you wanna move on or more like you want him to text?",
    "u want to move on but part of u is still waiting for that text, both can be true at the same time and that's what makes it so draining",
  ]);
  assert.equal(r.move, "double-sided");
  assert.match(r.best.text, /both can be true/);
});

const EXAMS = `promo exams in 2 weeks and i havent even started revising chem. everyone in my class seems so chill abt it but i feel like im drowning. mum keep saying i should be studying instead of using my phone but she doesnt get that i need a break also. idk la`;
test("[new] 'what?' after an off-topic reply is repaired in plain words", () => {
  const chat = [{ role: "ai", text: "lowkey the chem thing sounds like a whole mood, ever tried those study playlist vibes?" }];
  const r = judge(EXAMS, chat, "what?", [
    "haha like lofi beats, they slap for studying",
    "sorry that came out random. i meant it sounds like chem is the one stressing u most rn",
  ]);
  assert.equal(r.act, "repair");
  assert.match(r.best.text, /^sorry/);
});

test("[new] an answer with new detail is built on; a generic follow-up loses", () => {
  const q = { role: "ai", text: "what's the part that makes it feel like drowning?" };
  const r = judge(EXAMS, [q], "like i dont even know where to start, chem has like 8 chapters and i understand none of them", [
    "how does that make you feel?",
    "8 chapters u feel lost in is a lot to face with 2 weeks left, no wonder starting feels impossible",
  ]);
  assert.ok(["answer", "elaboration"].includes(r.act));
  assert.match(r.best.text, /8 chapters/);
});

test("turn acts for common short replies", () => {
  const h = [{ role: "user", text: "j", isJournal: true }, { role: "ai", text: "is it more x or more y?" }];
  assert.equal(classifyTurnAct("huh", h).act, "repair");
  assert.equal(classifyTurnAct("wdym", h).act, "repair");
  assert.equal(classifyTurnAct("ok lor", h).act, "ack");
  assert.equal(classifyTurnAct("prob both la", h).act, "both");
  assert.equal(classifyTurnAct("idk", h).act, "broad");
  assert.equal(classifyTurnAct("nvm forget it", h).act, "pushback");
  assert.equal(classifyTurnAct("neither tbh", h).act, "neither");
});

test("repairs that talk about Kindred's own last message are not 'speaking as the user'", async () => {
  const { speaksAsUser } = await import("../processing-moves.js");
  const u = "i just wanna chill but i also dont want to fall behind";
  assert.equal(speaksAsUser("sorry, i was just saying the chill vs keep up thing sounds exhausting", u), false);
  assert.equal(speaksAsUser("my bad lol i was trying to say the fall behind feeling is real", u), false);
  assert.equal(speaksAsUser("i just wanna chill but cant", u), true);
});

test("'both la' is taken up as both of the options just offered", () => {
  const q = { role: "ai", text: "are you worried the chapters will just pile up and you'll never catch up, or is it the idea of having to learn something completely new?" };
  const r = judge(EXAMS, [q], "both la", [
    "yeah that makes sense, when you're drowning and someone keeps telling you to swim harder it feels worse",
    "ya both is legit, the chapters piling up AND it all being new stuff is like two problems stacked on each other",
  ]);
  assert.equal(r.act, "both");
  assert.match(r.best.text, /chapters piling/);
});
