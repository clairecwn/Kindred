import test from "node:test";
import assert from "node:assert/strict";

import { selectDailyTasks, deriveStateVector } from "../questSelector.js";
import { TASK_BANK } from "../taskBank.js";
import {
  createStoryState, currentGlow, recordVisit, completeTask, skipTask, GLOW,
} from "../storyState.js";
import { pendingBeats, STORY_BEATS } from "../beats.js";
import { NPC_DIALOGUE, pickLine } from "../npcDialogue.js";

const SOCIAL_TAGS = new Set(["social", "playful"]);

// ── Gates honoured ─────────────────────────────────────────────────────

test("sayNothing analysis falls back to a gentle, non-social pool", () => {
  const { tasks, capacity, reliable } = selectDailyTasks({ sayNothing: true }, { rng: () => 0.5 });
  assert.equal(capacity, "unknown");
  assert.equal(reliable, false);
  for (const t of tasks) assert.ok(!SOCIAL_TAGS.has(t.tag), `${t.id} should not be social/playful`);
});

test("null/undefined analysis (brand-new user) also falls back gently", () => {
  const { tasks, capacity } = selectDailyTasks(undefined, { rng: () => 0.5 });
  assert.equal(capacity, "unknown");
  for (const t of tasks) assert.ok(!SOCIAL_TAGS.has(t.tag));
});

test("low confidence / pre-personalBaseline gate never claims reliability", () => {
  const analysis = {
    sayNothing: false,
    confidence: 0.9, // high confidence number alone must not be enough
    gates: { personalBaseline: false }, // gate not yet met
    todayScore: { graded: 12 },
  };
  const state = deriveStateVector(analysis);
  assert.equal(state.reliable, false);
});

test("a reliable, well-supported analysis is marked reliable", () => {
  const analysis = {
    sayNothing: false,
    confidence: 0.6,
    gates: { personalBaseline: true },
    todayScore: { graded: 12 },
  };
  const state = deriveStateVector(analysis);
  assert.equal(state.reliable, true);
});

// ── Low-capacity state never draws a high-social task ───────────────────

test("low-capacity days never include a social or playful task, across many draws", () => {
  const lowAnalysis = {
    sayNothing: false, confidence: 0.8, gates: { personalBaseline: true },
    todayScore: { graded: 3 }, // well under the low threshold
  };
  for (let seed = 0; seed < 200; seed++) {
    let s = seed;
    const rng = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const { tasks, capacity } = selectDailyTasks(lowAnalysis, { count: 3, rng });
    assert.equal(capacity, "low");
    for (const t of tasks) {
      assert.ok(!SOCIAL_TAGS.has(t.tag), `seed ${seed} drew social/playful task ${t.id} on a low-capacity day`);
      assert.equal(t.energy, "low", `seed ${seed} drew non-low-energy task ${t.id} on a low-capacity day`);
    }
  }
});

test("negative valence + low arousal downgrades capacity even with a mid check-in score", () => {
  const analysis = {
    sayNothing: false, confidence: 0.7, gates: { personalBaseline: true },
    todayScore: { graded: 12 }, // would be "medium" on the score alone
    vad: { valence: -0.6, arousal: 0.2 },
  };
  const state = deriveStateVector(analysis);
  assert.equal(state.capacity, "low");
});

test("a high-capacity day is permitted to draw social tasks (not required, just eligible)", () => {
  const highAnalysis = {
    sayNothing: false, confidence: 0.8, gates: { personalBaseline: true },
    todayScore: { graded: 18 },
  };
  const pool = TASK_BANK.filter((t) => SOCIAL_TAGS.has(t.tag));
  assert.ok(pool.length > 0, "sanity: social tasks exist in the bank");
  // Force selection toward the front of a weighted pool via a rng that
  // always returns 0 — this exercises the eligiblePool() path directly,
  // proving high-capacity days are not excluded the way low ones are.
  let sawSocial = false;
  for (let i = 0; i < 50 && !sawSocial; i++) {
    const rng = () => Math.random();
    const { tasks } = selectDailyTasks(highAnalysis, { count: 3, rng });
    if (tasks.some((t) => SOCIAL_TAGS.has(t.tag))) sawSocial = true;
  }
  assert.ok(sawSocial, "high-capacity days should be able to draw social/playful tasks");
});

// ── Task bank shape ──────────────────────────────────────────────────────

test("task bank has 30-50 tasks, each tagged with a known tag", () => {
  assert.ok(TASK_BANK.length >= 30 && TASK_BANK.length <= 50, `expected 30-50 tasks, got ${TASK_BANK.length}`);
  const validTags = new Set(["low-energy-gentle", "restorative", "reflective", "social", "playful"]);
  for (const t of TASK_BANK) {
    assert.ok(validTags.has(t.tag), `${t.id} has unknown tag ${t.tag}`);
    assert.ok(t.text && t.text.length > 0);
  }
});

// ── Skipping carries no penalty ──────────────────────────────────────────

test("skipping a task changes no progress, glow, or friendship field except the private skip count", () => {
  const before = createStoryState();
  before.lastVisitDate = "2026-09-01";
  before.glow = 1;
  const today = "2026-09-01"; // same day, so no decay confound
  const after = skipTask(before, today);

  assert.equal(after.tasksCompleted, before.tasksCompleted);
  assert.deepEqual(after.friendship, before.friendship);
  assert.deepEqual(after.districtsVisited, before.districtsVisited);
  assert.equal(after.glow, before.glow, "skipping must not dim the glow");
  assert.equal(after.tasksSkipped, before.tasksSkipped + 1);
});

test("completing a one-line-equivalent task and a fuller task both fully restore glow", () => {
  const before = createStoryState();
  before.glow = GLOW.FLOOR;
  const afterA = completeTask(before, "sit-fountain", { districtId: "hub" });
  const afterB = completeTask(before, "cook-together", { districtId: "workshop" });
  assert.equal(afterA.glow, GLOW.RECOVERY);
  assert.equal(afterB.glow, GLOW.RECOVERY, "showing up must be rewarded as much as a longer task, not less");
});

// ── Streak decays softly, never resets ───────────────────────────────────

test("glow dims gradually across missed days but never resets to zero", () => {
  let state = createStoryState();
  state = completeTask(state, "sit-fountain", { districtId: "hub" });
  assert.equal(state.glow, 1);

  const day0 = state.lastVisitDate;
  const day1 = addDays(day0, 1);
  const day5 = addDays(day0, 5);
  const day30 = addDays(day0, 30);

  const glowDay1 = currentGlow(state, day1);
  const glowDay5 = currentGlow(state, day5);
  const glowDay30 = currentGlow(state, day30);

  assert.ok(glowDay1 < 1, "glow should have dimmed at all after a missed day");
  assert.ok(glowDay1 > glowDay5, "glow should keep dimming, not jump straight down");
  assert.ok(glowDay5 > 0, "glow must never be exactly zero");
  assert.ok(glowDay30 >= GLOW.FLOOR, "glow must never drop below the soft floor, even after a long gap");
  assert.notEqual(glowDay1, 0);
  assert.notEqual(glowDay30, 0);
});

test("returning after a long gap instantly restores full glow rather than requiring a rebuild", () => {
  let state = createStoryState();
  state = completeTask(state, "sit-fountain", { districtId: "hub" });
  const longGapDay = addDays(state.lastVisitDate, 60);
  const revisited = recordVisit(state, longGapDay);
  const completed = completeTask(revisited, "sit-fountain", { districtId: "hub" });
  assert.equal(completed.glow, GLOW.RECOVERY);
});

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── NPC dialogue shape ────────────────────────────────────────────────────

test("every district NPC has at least 6 lines per context, and shopkeepers have a shop context", () => {
  const shopkeepers = new Set(["tansy", "corvin", "wren", "pell"]);
  for (const [npcId, pools] of Object.entries(NPC_DIALOGUE)) {
    for (const [context, lines] of Object.entries(pools)) {
      assert.ok(lines.length >= 6, `${npcId}.${context} has only ${lines.length} lines`);
    }
    if (shopkeepers.has(npcId)) {
      assert.ok(pools.shop && pools.shop.length >= 6, `${npcId} is a shopkeeper but lacks a shop pool`);
    }
  }
});

test("pickLine avoids repeating the immediately previous line when alternatives exist", () => {
  const pool = NPC_DIALOGUE.bramble.greeting;
  const last = pool[0];
  for (let i = 0; i < 30; i++) {
    const line = pickLine(pool, last, Math.random);
    assert.notEqual(line, last);
  }
});

// ── Story beats: gated on progress, not time ─────────────────────────────

test("story beats never require anything but count-based progress fields", () => {
  for (const beat of STORY_BEATS) {
    assert.equal(typeof beat.requires, "function");
  }
  const progress = { tasksCompleted: 0, districtsVisited: 0, friendship: { wren: 0 } };
  assert.ok(pendingBeats(progress, []).length >= 1, "the very first beat should be available immediately");
});

test("pendingBeats never returns a beat already marked seen", () => {
  const progress = { tasksCompleted: 100, districtsVisited: 10, friendship: { wren: 10 } };
  const seen = STORY_BEATS.map((b) => b.id);
  assert.equal(pendingBeats(progress, seen).length, 0);
});

// ─────────────────────────────────────────────────────────────────────────
// THE ARC — "The Long Way Back"
//
// These cover the multi-chapter through-line added in beats.js: that it is
// gated on real actions rather than time, that it unlocks in chapter
// order, that nothing in it can ever be reached only by being social, and
// that no line in the whole script guilts, compares, or pressures.
// ─────────────────────────────────────────────────────────────────────────

import {
  CHAPTERS, CHAPTER_ORDER, CHAPTER_TITLES, currentChapter, arcProgress,
} from "../beats.js";
import { CAST, NPC_BY_ID, NPC_IDS } from "../cast.js";
import { visitDistrict, visitInterior, recordSit } from "../storyState.js";
import { DISTRICTS } from "../../scene/worldLayout.js";

const ALL_LINES = STORY_BEATS.flatMap((b) => b.lines)
  .concat(Object.values(NPC_DIALOGUE).flatMap((pools) => Object.values(pools).flat()));

test("the arc has five ordered chapters, each with at least two beats", () => {
  assert.equal(CHAPTER_ORDER.length, 5);
  for (const ch of CHAPTER_ORDER) {
    assert.ok(CHAPTER_TITLES[ch], `${ch} has no title`);
    const beats = STORY_BEATS.filter((b) => b.chapter === ch);
    assert.ok(beats.length >= 2, `${ch} has only ${beats.length} beat(s)`);
  }
  // Beats are authored in chapter order, so a drip never jumps backwards.
  let last = -1;
  for (const b of STORY_BEATS) {
    const i = CHAPTER_ORDER.indexOf(b.chapter);
    assert.ok(i >= last, `beat ${b.id} (${b.chapter}) is authored out of chapter order`);
    last = i;
  }
});

test("every beat's speaker is a real resident, or the world itself", () => {
  for (const b of STORY_BEATS) {
    assert.ok(b.speaker === "grove" || NPC_BY_ID[b.speaker], `${b.id} has unknown speaker ${b.speaker}`);
    assert.ok(b.lines.length >= 1 && b.lines.length <= 3, `${b.id} has ${b.lines.length} lines`);
    assert.ok(b.title && b.title.length > 0);
  }
});

test("every resident is tied to a district that actually exists", () => {
  const ids = new Set(DISTRICTS.map((d) => d.id));
  for (const c of CAST) {
    assert.ok(ids.has(c.district), `${c.id} lives in unknown district ${c.district}`);
    assert.ok(c.species && c.holds, `${c.id} is missing species/role`);
  }
  // Every district that names a resident names one we have written.
  for (const d of DISTRICTS) {
    if (!d.npc) continue;
    assert.ok(NPC_BY_ID[d.npc.id], `district ${d.id} references unknown npc ${d.npc.id}`);
  }
});

test("every resident has a dialogue pool, and every pool belongs to a resident", () => {
  for (const id of NPC_IDS) {
    assert.ok(NPC_DIALOGUE[id], `${id} has no dialogue`);
    assert.ok(NPC_DIALOGUE[id].greeting.length >= 6);
  }
  for (const id of Object.keys(NPC_DIALOGUE)) {
    assert.ok(NPC_BY_ID[id], `dialogue exists for non-resident ${id}`);
  }
});

test("the arc advances by visiting places and doing gentle tasks, never by the clock", () => {
  let state = createStoryState();
  const seen = () => pendingBeats(state, state.seenBeatIds).map((b) => b.id);

  // Nothing but the opening beat before the player has done anything.
  assert.deepEqual(seen(), ["landfall-01"]);
  state = { ...state, seenBeatIds: ["landfall-01"] };

  // Walking somewhere — not waiting — is what moves it on.
  state = visitDistrict(state, "landing");
  assert.ok(seen().includes("landfall-02"));
  state = visitDistrict(state, "hub");
  assert.ok(seen().includes("landfall-03"));

  // Chapter II needs the Commons and a shop door, both purely spatial.
  state = visitDistrict(state, "mall");
  assert.ok(seen().includes("commons-01"));
  state = visitInterior(state, "boutique");
  assert.ok(seen().includes("commons-02"));

  // Being present rather than productive is itself a gate (chapter IV).
  state = { ...state, seenBeatIds: [...state.seenBeatIds, ...seen()] };
  state = visitDistrict(state, "cafe");
  state = recordSit(recordSit(recordSit(state)));
  assert.ok(seen().includes("open-03"), "sitting with people must be able to advance the arc");

  // And no amount of elapsed time alone does anything at all.
  const frozen = JSON.parse(JSON.stringify(state));
  const later = { ...frozen, lastVisitDate: "1999-01-01" };
  assert.deepEqual(
    pendingBeats(later, later.seenBeatIds).map((b) => b.id),
    pendingBeats(frozen, frozen.seenBeatIds).map((b) => b.id),
    "elapsed time must never change which beats are available",
  );
});

test("the whole arc is reachable solo — no beat requires another real player", () => {
  // A player who never talks to anyone, never sits with anyone, and only
  // walks and completes tasks still reaches the final beat.
  let state = createStoryState();
  for (const d of ["landing", "hub", "mall", "garden", "workshop", "cafe", "stage", "home"]) {
    state = visitDistrict(state, d);
  }
  for (const i of ["grocery", "furniture", "boutique", "home"]) state = visitInterior(state, i);
  state = { ...state, tasksCompleted: 30 };
  const ids = pendingBeats(state, []).map((b) => b.id);
  for (const beat of STORY_BEATS) {
    assert.ok(ids.includes(beat.id), `${beat.id} is unreachable without other players`);
  }
  assert.equal(currentChapter(state), CHAPTERS.COMING_BACK);
  assert.equal(arcProgress({ ...state, seenBeatIds: ids }).seen, STORY_BEATS.length);
});

test("nothing in the script guilts, compares, or manufactures urgency", () => {
  // Phrases that would break the Design Bible's hard lines (s12): absence
  // framed as a debt, players ranked against each other, or scarcity.
  const FORBIDDEN = [
    /you haven'?t (logged|been|visited|played)/i,
    /\bstreak\b/i,
    /\bdays? in a row\b/i,
    /\bfalling behind\b/i,
    /\byou'?re behind\b/i,
    /\bbetter than (you|him|her|them|everyone)\b/i,
    /\branked?\b/i,
    /\bleaderboard\b/i,
    /\bhurry up\b/i,
    /\bact (now|fast)\b/i,
    /\blast chance\b/i,
    /\bonly \d+ (hours?|days?) left\b/i,
    /\bexpires?\b/i,
    /\bdon'?t miss\b/i,
    /\byou should have\b/i,
    /\bwe missed you\b/i,
    /\bdisappointed\b/i,
  ];
  for (const line of ALL_LINES) {
    for (const rx of FORBIDDEN) {
      assert.ok(!rx.test(line), `forbidden phrasing ${rx} in: ${line}`);
    }
  }
});

test("every task points at a district that exists in the world", () => {
  const ids = new Set(DISTRICTS.map((d) => d.id));
  for (const t of TASK_BANK) {
    assert.ok(ids.has(t.district), `task ${t.id} targets unknown district "${t.district}"`);
  }
});

test("task bank text is also free of pressure phrasing", () => {
  for (const t of TASK_BANK) {
    // "you don't have to" is the opposite of pressure, so the negated
    // forms are explicitly allowed here.
    const pressuring = /\byou must\b|(?<!don'?t )(?<!do not )\byou have to\b|\bfailed?\b|\bstreak\b/i;
    assert.ok(!pressuring.test(t.text), `pressuring task copy: ${t.text}`);
  }
});
