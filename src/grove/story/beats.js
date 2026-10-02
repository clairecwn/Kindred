// src/grove/story/beats.js
//
// THE MAIN THREAD — "The Long Way Back".
//
// A five-chapter through-line about a place that emptied out and is
// filling again, and about the player being one of the people filling it.
// Beats surface AFTER something has already happened (a place first
// walked into, a small task finished, a resident spoken to enough times
// that they start volunteering things). They are never a cutscene, never
// block movement, and never require tapping through a tree to keep
// playing.
//
// ── The wellbeing constraints, which are load-bearing, not flavour ────
//  * Every gate counts REAL ACTIONS. Nothing here reads a clock, a date,
//    a streak, or a login count. A player who leaves for six months finds
//    the story exactly where they left it, with no catch-up copy.
//  * No beat is ever gated on doing something SOCIAL. Every chapter can
//    be completed solo; the social beats are alternates, not requirements
//    (see `requires` — visiting a district and talking to its resident
//    are OR'd, never AND'd, where a chapter would otherwise force it).
//  * No line compares the player to anyone, congratulates them for
//    consistency, or implies they were missed in a way that owes anyone
//    anything. Covered by a test in __tests__/story.test.js.
//
// Beat shape: { id, chapter, speaker, title, lines[1-3], requires(p) }
// where `p` is the persisted progress object from storyState.js.

export const CHAPTERS = Object.freeze({
  LANDFALL: "LANDFALL",
  COMMONS: "COMMONS",
  SLOWLY: "SLOWLY",
  OPEN_DOOR: "OPEN_DOOR",
  COMING_BACK: "COMING_BACK",
});

// Ordered, for progress display and for the "chapters unlock in order"
// guarantee the tests assert.
export const CHAPTER_ORDER = Object.freeze([
  CHAPTERS.LANDFALL, CHAPTERS.COMMONS, CHAPTERS.SLOWLY,
  CHAPTERS.OPEN_DOOR, CHAPTERS.COMING_BACK,
]);

export const CHAPTER_TITLES = Object.freeze({
  [CHAPTERS.LANDFALL]: "Landfall",
  [CHAPTERS.COMMONS]: "Lighting the Commons",
  [CHAPTERS.SLOWLY]: "What Grows Slowly",
  [CHAPTERS.OPEN_DOOR]: "The Door Left Open",
  [CHAPTERS.COMING_BACK]: "Somewhere To Come Back To",
});

// Back-compat alias: older callers imported STORY_STAGES.
export const STORY_STAGES = CHAPTERS;

// ── Small, defensive progress readers ─────────────────────────────────
// `districtsVisited` is an array in real state but a bare number in some
// older/minimal callers and in tests, so every reader copes with both.
const visited = (p) => (Array.isArray(p?.districtsVisited) ? p.districtsVisited : []);
const nVisited = (p) => (Array.isArray(p?.districtsVisited)
  ? p.districtsVisited.length
  : (typeof p?.districtsVisited === "number" ? p.districtsVisited : 0));
const been = (p, id) => visited(p).includes(id) || nVisited(p) >= 6;
const inside = (p, id) => (p?.interiorsVisited ?? []).includes(id);
const nInside = (p) => (p?.interiorsVisited ?? []).length;
const friend = (p, id) => p?.friendship?.[id] ?? 0;
const tasks = (p) => p?.tasksCompleted ?? 0;
const sat = (p) => p?.timesSat ?? 0;

export const STORY_BEATS = Object.freeze([
  // ── I. LANDFALL ─────────────────────────────────────────────────────
  {
    id: "landfall-01", chapter: CHAPTERS.LANDFALL, speaker: "grove", title: "The jetty",
    lines: [
      "The boat pulls away without ceremony, the way boats do.",
      "There is a plate of land here, a tree in the middle of it, and a light already on.",
    ],
    requires: () => true,
  },
  {
    id: "landfall-02", chapter: CHAPTERS.LANDFALL, speaker: "marlow", title: "No hurry",
    lines: [
      "Marlow doesn't get up. \"Path goes to the tree. Tree goes everywhere else.\"",
      "\"You don't have to go anywhere today, mind. Jetty's a fine place to stand.\"",
    ],
    requires: (p) => been(p, "landing") || tasks(p) >= 1,
  },
  {
    id: "landfall-03", chapter: CHAPTERS.LANDFALL, speaker: "grove", title: "Lanternfall",
    lines: [
      "Up close, the tree has lanterns strung through it — most lit, a few not.",
      "Somebody has been keeping this going. It isn't obvious who.",
    ],
    requires: (p) => been(p, "hub"),
  },

  // ── II. LIGHTING THE COMMONS ────────────────────────────────────────
  {
    id: "commons-01", chapter: CHAPTERS.COMMONS, speaker: "pell", title: "Three shopfronts",
    lines: [
      "Pell is restacking something that did not need restacking.",
      "\"Three shops on this row. Two of us open most days. Juniper opens when Juniper opens.\"",
    ],
    requires: (p) => been(p, "mall"),
  },
  {
    id: "commons-02", chapter: CHAPTERS.COMMONS, speaker: "juniper", title: "Threadbare",
    lines: [
      "Juniper holds a coat up to you without asking, then puts it back.",
      "\"Not that one. I'll know it when I see it. Come back whenever — nothing here sells out.\"",
    ],
    requires: (p) => inside(p, "boutique") || friend(p, "juniper") >= 1,
  },
  {
    id: "commons-03", chapter: CHAPTERS.COMMONS, speaker: "grove", title: "A courtyard, used",
    lines: [
      "Somebody has dragged a second chair to one of the courtyard tables and left it there.",
      "It isn't an invitation exactly. It's an option, which is a gentler thing.",
    ],
    requires: (p) => nInside(p) >= 2 || (been(p, "mall") && tasks(p) >= 4),
  },

  // ── III. WHAT GROWS SLOWLY ──────────────────────────────────────────
  {
    id: "slowly-01", chapter: CHAPTERS.SLOWLY, speaker: "bramble", title: "The beds",
    lines: [
      "Bramble doesn't look up from the soil. \"Half of this was dead when I got here.\"",
      "\"Wasn't clever. Just came back to it. That's most of gardening, really.\"",
    ],
    requires: (p) => been(p, "garden"),
  },
  {
    id: "slowly-02", chapter: CHAPTERS.SLOWLY, speaker: "tansy", title: "Second attempts",
    lines: [
      "Tansy shoves a wonky stool toward you with her foot.",
      "\"Fourth one I made. First three were worse. I kept them. Nobody's sitting on my best work.\"",
    ],
    requires: (p) => been(p, "workshop"),
  },
  {
    id: "slowly-03", chapter: CHAPTERS.SLOWLY, speaker: "grove", title: "Green at the root",
    lines: [
      "The hedge along the garden's west side, brown all season, has gone green at the root.",
      "Nobody replanted it. It just remembered how.",
    ],
    requires: (p) => tasks(p) >= 8 && (been(p, "garden") || been(p, "workshop")),
  },

  // ── IV. THE DOOR LEFT OPEN ──────────────────────────────────────────
  {
    id: "open-01", chapter: CHAPTERS.OPEN_DOOR, speaker: "wren", title: "Made too much",
    lines: [
      "Wren slides a cup across before you ask for one.",
      "\"Didn't make it for you specifically. Made too much. Don't read into it.\"",
    ],
    requires: (p) => been(p, "cafe"),
  },
  {
    id: "open-02", chapter: CHAPTERS.OPEN_DOOR, speaker: "corvin", title: "The Round",
    lines: [
      "Old Corvin is testing the bandstand boards for creaks, one at a time.",
      "\"Someone'll get up here eventually. Doesn't have to be good. Has to be someone, trying.\"",
    ],
    requires: (p) => been(p, "stage"),
  },
  {
    id: "open-03", chapter: CHAPTERS.OPEN_DOOR, speaker: "grove", title: "Two chairs",
    lines: [
      "Two of Hearthlight's chairs are occupied at once, which hasn't happened in a while.",
      "Nobody is saying much. Both of them stayed anyway.",
    ],
    requires: (p) => sat(p) >= 3 || (been(p, "cafe") && tasks(p) >= 12),
  },

  // ── V. SOMEWHERE TO COME BACK TO ────────────────────────────────────
  {
    id: "back-01", chapter: CHAPTERS.COMING_BACK, speaker: "nim", title: "The other newcomer",
    lines: [
      "There's a rabbit on your bridge, pretending she wasn't waiting.",
      "\"Oh — hi. I got here a week before you. I'm not, like, established. I want that on record.\"",
    ],
    requires: (p) => been(p, "home"),
  },
  {
    id: "back-02", chapter: CHAPTERS.COMING_BACK, speaker: "grove", title: "Your own light",
    lines: [
      "The cottage lamp is on, and you're fairly sure you're the one who left it that way.",
      "That's the whole difference between a place you're staying and a place you live.",
    ],
    requires: (p) => inside(p, "home") || (been(p, "home") && tasks(p) >= 16),
  },
  {
    id: "back-03", chapter: CHAPTERS.COMING_BACK, speaker: "grove", title: "The Commons, awake",
    lines: [
      "Nothing about the island looks finished. It looks lived-in, which was always the actual goal.",
      "The lanterns are all lit now. Some of them are lit because of you.",
      "The jetty is still there, in both directions. That's on purpose too.",
    ],
    requires: (p) => tasks(p) >= 24 && nVisited(p) >= 6,
  },
]);

/** Every beat whose gate is satisfied and which hasn't been shown, in
 * authored order. The caller presents at most one at a time, so several
 * unlocking at once is still a drip and never a dump. */
export function pendingBeats(progress, seenIds) {
  const seen = new Set(seenIds ?? []);
  return STORY_BEATS.filter((b) => !seen.has(b.id) && b.requires(progress));
}

/** The furthest chapter the player has actually reached. Never used to
 * pressure ("you're only on chapter 2") — only to title the journal page. */
export function currentChapter(progress) {
  let chapter = CHAPTERS.LANDFALL;
  for (const beat of STORY_BEATS) {
    if (beat.requires(progress)) chapter = beat.chapter;
  }
  return chapter;
}

export const currentStage = currentChapter; // back-compat alias

/** Progress through the arc as seen-beats over total, for a quiet, purely
 * informational marker in the journal. Not a score, never compared. */
export function arcProgress(progress) {
  const seen = new Set(progress?.seenBeatIds ?? []);
  const done = STORY_BEATS.filter((b) => seen.has(b.id)).length;
  return { seen: done, total: STORY_BEATS.length, chapter: currentChapter(progress) };
}
