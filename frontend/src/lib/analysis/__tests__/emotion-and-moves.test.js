import test from "node:test";
import assert from "node:assert/strict";
import { entryEmotionProfile, dayEmotionProfile, rangeEmotionProfile, pickLabel } from "../emotion-profile.js";
import { dailyAffect, weeklyAffect, allTimeAffect, displayEntryEmotion, entryEmotionFamily } from "../journey-affect.js";
import { describeLabel, familyOf, TAXONOMY_IDS } from "../emotion-taxonomy.js";
import { chooseMove, hookStrength, unsupportedCause, questionQuality, processingStage } from "../processing-moves.js";

const TEST_JOURNAL = `tdy was damn sian sia idk why my mood so off since morning... woke up to like 20 messages in the grp chat cos apparently my friends planning some outing and everyone arguing over where to eat HAHAHA like bro its just dinner why yall planning like wedding liddat... then aftn i went gym thinking i could be productive but legit after 20min i already wanna go home sia, somemore got this guy keep hogging the machine while scrolling his phone like HELLO some of us got places to be leh. then later went to dabao dinner and the auntie gave me the wrong order but i only realise when i reach home... wah i was craving chicken rice the whole day then suddenly got fishball noodles staring at me instead 😭 hais i just eat la too lazy to go back. now supposed to start my assignment but i keep opening my laptop then closing it again like got commitment issues sia... lowk feel damn restless but also dw do anything, idk whats wrong w me tdy honestly`;
const e = (id, date, text, extra = {}) => ({ id, date, text, ...extra });

test("the restless-but-unmotivated journal is named in the user's own terms", () => {
  const p = entryEmotionProfile(e("1", "2026-10-21", TEST_JOURNAL));
  assert.deepEqual([...p.parts].sort(), ["restless", "unmotivated"]);
  assert.ok(!("motivated" in p.distribution), "'thinking i could be productive' is a hope, not a feeling");
});

test("specific feelings are not folded into broad families", () => {
  const cases = [
    ["ugh so frustrating, the group project keeps getting delayed", "frustrated"],
    ["feel damn paiseh, everyone saw me trip", "embarrassed"],
    ["i got my results and im so proud of myself!!", "proud"],
    ["i miss my grandma", "missing someone"],
    ["meh day", "flat"],
    ["not sad, just tired lol", "tired"],
    ["i was supposed to be happy at the party but i just felt left out", "lonely"],
    ["walao this cake so good sia", "happy"],
  ];
  for (const [text, want] of cases) assert.equal(entryEmotionProfile(e("x", "2026-10-21", text)).parts[0], want, text);
});

test("opposite feelings in one entry are both named, and the family is mixed", () => {
  const p = entryEmotionProfile(e("1", "2026-10-21", "finally done with exams, so relieved but kinda empty"));
  assert.deepEqual(p.parts, ["relieved", "empty"]);
  assert.equal(p.family, "mixed");
});

test("someone else's feeling is not the writer's", () => {
  const p = entryEmotionProfile(e("1", "2026-10-21", "my friend was so angry at me"));
  assert.notEqual(p.parts[0], "angry");
});

test("labels are always one or two words from the taxonomy", () => {
  for (const text of [TEST_JOURNAL, "happy", "so stressed and overwhelmed and tired and sad", "lol"]) {
    const p = entryEmotionProfile(e("x", "2026-10-21", text));
    assert.ok(p.label.split(/\s+/).filter((w) => w !== "&").length <= 2, p.label);
    for (const part of p.parts) assert.ok(TAXONOMY_IDS.includes(part), part);
  }
});

test("a day with several different entries keeps both feelings instead of averaging to neutral", () => {
  const day = dayEmotionProfile([
    e("a", "2026-10-21", "so stressed about the test later, kancheong sia"),
    e("b", "2026-10-21", "test done!! so relieved"),
  ]);
  assert.ok(day.parts.includes("stressed") || day.parts.includes("anxious"));
  assert.ok(day.parts.includes("relieved"));
  assert.equal(day.count, 2);
});

test("a feeling that recurs across the week outranks a one-day spike", () => {
  const days = ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
  const entries = [
    ...days.slice(0, 3).map((d, i) => e(`t${i}`, d, "so tired today, no energy")),
    e("x", days[3], "ANGRY ANGRY so mad at him, furious"),
  ];
  const week = weeklyAffect(entries, days);
  assert.ok(["drained", "tired"].includes(week.label.split(" & ")[0]), week.label);
  assert.equal(week.dayCount, 4);
});

test("prolific writing on one day does not outvote quiet days", () => {
  const dates = ["2026-10-15", "2026-10-16"];
  const entries = [e("q", dates[1], "feeling calm and peaceful"),
    ...Array.from({ length: 6 }, (_, i) => e(`s${i}`, dates[0], "so stressed"))];
  const week = weeklyAffect(entries, dates);
  assert.ok(week.distribution.calm > 0.2, `calm ${week.distribution.calm}`);
});

test("all-time covers every logged day; daily and display carry specific words with family keys for the world", () => {
  const entries = [e("1", "2026-09-01", "so proud of myself today"), e("2", "2026-10-21", TEST_JOURNAL)];
  const all = allTimeAffect(entries);
  assert.equal(all.dayCount, 2);
  const day = dailyAffect(entries, "2026-10-21");
  assert.match(day.label, /restless|unmotivated/);
  assert.ok(["tired", "anxious", "mixed"].includes(day.emotion), "family key for avatar/world");
  assert.match(displayEntryEmotion(entries[1]), /restless|unmotivated/);
  assert.ok(familyOf(entryEmotionFamily(entries[1])));
});

test("display words parse historical labels", () => {
  assert.equal(describeLabel("frustrated and tired").display, "Frustrated & tired");
  assert.equal(describeLabel("happy").family, "happy");
  assert.equal(pickLabel({}).label, "neutral");
});

test("the move model wonders with someone who doesn't know why, and plays with a joke", () => {
  const focus = { explorationDepth: 0.1, evidence: [{ quote: "lowk feel damn restless but also dw do anything" }] };
  const opening = chooseMove({ focus, openThreads: [{ summary: "assignment" }, { summary: "gym" }], userTexts: [TEST_JOURNAL],
    latest: TEST_JOURNAL, interpretation: { need: "make-sense", mode: "venting" } });
  assert.ok(["choice", "wonder"].includes(opening.move), opening.move);
  assert.equal(opening.causeUnknown, true);
  assert.equal(chooseMove({ focus, latest: "6 7 lol", interpretation: { need: "play", mode: "play" } }).move, "play");
});

test("moves rotate and question pressure keeps reflections at least equal to questions", () => {
  const focus = { explorationDepth: 0.4, evidence: [{ quote: "test went badly" }] };
  const base = { focus, userTexts: ["test went badly"], latest: "ya it was bad", interpretation: { need: "be-heard" } };
  const first = chooseMove(base);
  const repeat = chooseMove({ ...base, recentMoves: [first.move, first.move] });
  assert.notEqual(repeat.move, first.move);
  const pressured = chooseMove({ ...base, recentQuestions: 2 });
  assert.equal(pressured.isQuestion, false);
});

test("a harsh self-judgment invites a reframe once they've said how it felt", () => {
  const focus = { explorationDepth: 0.5, evidence: [{ quote: "i feel so stupid, im so lazy" }] };
  const m = chooseMove({ focus, userTexts: ["failed the quiz, i feel so stupid", "im so lazy honestly"], latest: "im so lazy honestly", interpretation: { need: "be-heard" } });
  assert.ok(m.ranked.slice(0, 2).some((x) => x.move === "reframe"), JSON.stringify(m.ranked.slice(0, 3)));
});

test("hooks, made-up causes and generic questions are measured", () => {
  assert.ok(hookStrength("i feel ya, all that noise just makes u wanna shut everything off lol", "ya sia") <= 0.25);
  assert.equal(hookStrength("is it more like ur tired, or something at the back of ur mind?", ""), 1);
  assert.equal(unsupportedCause("ur brain is just fried from all the noise", "idk why my mood so off"), true);
  assert.equal(unsupportedCause("maybe it's all the small stuff piling up?", "idk why my mood so off"), false);
  assert.equal(questionQuality("how does that make you feel?", TEST_JOURNAL), 0);
  assert.ok(questionQuality("the laptop open close thing tho, is it the assignment or just no energy?", TEST_JOURNAL) >= 0.75);
  assert.equal(processingStage({ explorationDepth: 0 }, []).stage, "told");
});

test("the companion never narrates the user's feelings as its own", async () => {
  const { speaksAsUser } = await import("../processing-moves.js");
  const u = "my teacher got mad at us and i got scolded infront of evryone. i feel so embarased";
  assert.equal(speaksAsUser("i’m still cringing every time i think about that scold, and i wish i could just disappear.", u), true);
  assert.equal(speaksAsUser("i get it, getting scolded in front of everyone is the worst", u), false);
  assert.equal(speaksAsUser("you’re probably still cringing about it", u), false);
});

test("a short meme message is play even if the model read the entry as venting", () => {
  const m = chooseMove({ focus: { explorationDepth: 0.2 }, latest: "6 7 lol", userTexts: ["journal", "x"], recentMoves: ["continue"],
    interpretation: { need: "vent", mode: "venting" }, playMass: 0.86 });
  assert.equal(m.move, "play");
});
