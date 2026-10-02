// src/grove/story/taskBank.js
//
// The pre-authored task pool (Riedl-style player modelling: a tagged
// content bank selected against a state vector, NOT procedural
// generation). Every task is small, entirely optional, and framed as an
// invitation rather than an obligation — see questSelector.js for how
// today's 1-3 tasks get drawn from this bank, and story/README-adjacent
// comments there for why weighting beats a lookup table.
//
// Tags (a task may carry more than one, its dominant one first):
//   low-energy-gentle — asks almost nothing; safe on a depleted day
//   restorative        — quiet, solitary, replenishing
//   reflective          — a small prompt toward noticing something
//   social              — invites proximity to another real user or an NPC
//   playful             — a little silly, a little fun, no stakes
//
// `energy` is a rough floor for how much a task asks of someone (low /
// medium), used alongside tags by the selector so a low-capacity day never
// draws a medium-energy social task even if it were mistagged.

export const TASK_TAGS = Object.freeze([
  "low-energy-gentle",
  "restorative",
  "reflective",
  "social",
  "playful",
]);

export const TASK_BANK = Object.freeze([
  // ── low-energy-gentle ────────────────────────────────────────────────
  { id: "sit-fountain", tag: "low-energy-gentle", energy: "low", district: "hub",
    text: "Sit under the Kindred Tree for a minute. That's the whole task." },
  { id: "watch-lanterns", tag: "low-energy-gentle", energy: "low", district: "hub",
    text: "Watch the lanterns in the Tree catch the light. No need to do anything else." },
  { id: "walk-the-hedge", tag: "low-energy-gentle", energy: "low", district: "garden",
    text: "Take one slow lap of the Quiet Garden. Getting lost in it is allowed." },
  { id: "stand-in-garden", tag: "low-energy-gentle", energy: "low", district: "garden",
    text: "Stand in the Quiet Garden for a while. Bramble won't ask why." },
  { id: "open-the-gate", tag: "low-energy-gentle", energy: "low", district: "hub",
    text: "Just step off the jetty today. Showing up is the task." },
  { id: "look-at-the-sky", tag: "low-energy-gentle", energy: "low", district: "hub",
    text: "Find a bench and look at the water for a minute." },
  { id: "feed-nothing", tag: "low-energy-gentle", energy: "low", district: "garden",
    text: "Walk past the raised beds. You don't have to tend anything today." },
  { id: "quiet-round-solo", tag: "low-energy-gentle", energy: "low", district: "garden",
    text: "Join a Quiet Round, breathing optional, company optional." },

  // ── restorative ──────────────────────────────────────────────────────
  { id: "breathing-sync", tag: "restorative", energy: "low", district: "garden",
    text: "Sit for a Quiet Round and turn breathing on, just for you." },
  { id: "tend-one-plot", tag: "restorative", energy: "low", district: "home",
    text: "Tend one plot in your own Long Field. One is plenty." },
  { id: "warm-drink", tag: "restorative", energy: "low", district: "cafe",
    text: "Get whatever Wren's pouring today and sit with it a while." },
  { id: "rearrange-a-shelf", tag: "restorative", energy: "low", district: "home",
    text: "Move one thing in your cottage somewhere else. There is no correct layout." },
  { id: "workshop-alone", tag: "restorative", energy: "low", district: "workshop",
    text: "Visit the Workshop when it's quiet and just watch Tansy work." },
  { id: "harvest-one", tag: "restorative", energy: "low", district: "home",
    text: "Harvest whatever's ready in the Long Field. Keep it or give it away." },
  { id: "slow-lap-plaza", tag: "restorative", energy: "low", district: "hub",
    text: "Walk the whole island at the slowest pace it allows." },
  { id: "sit-with-corvin", tag: "restorative", energy: "low", district: "stage",
    text: "Sit in the empty Round for a minute before anyone else arrives." },

  // ── reflective ───────────────────────────────────────────────────────
  { id: "notice-one-thing", tag: "reflective", energy: "low", district: "garden",
    text: "Notice one thing in the Grove that's changed since you last looked." },
  { id: "name-the-day", tag: "reflective", energy: "low", district: "hub",
    text: "If today had a weather report, what would it say? No need to tell anyone." },
  { id: "ask-bramble", tag: "reflective", energy: "low", district: "garden",
    text: "Ask Bramble how the beds are doing. Listen to the answer." },
  { id: "look-back-at-plot", tag: "reflective", energy: "low", district: "home",
    text: "Look at how much your Long Field plot has grown since you started it." },
  { id: "revisit-first-district", tag: "reflective", energy: "low", district: "hub",
    text: "Go back to whichever district you first ever walked into." },
  { id: "corvin-memory", tag: "reflective", energy: "low", district: "stage",
    text: "Ask Old Corvin what he remembers about your last visit." },
  { id: "pick-an-outfit", tag: "reflective", energy: "low", district: "mall",
    text: "Pick out one thing at Threadbare that matches how today feels. Buying it is optional." },
  { id: "sit-and-list", tag: "reflective", energy: "low", district: "garden",
    text: "Sit on a bench and think of one small thing that went fine today." },

  // ── social ───────────────────────────────────────────────────────────
  { id: "wave-at-a-stranger", tag: "social", energy: "medium", district: "hub",
    text: "Wave at another Warden crossing the plaza. Nothing more required." },
  { id: "sit-near-someone", tag: "social", energy: "medium", district: "cafe",
    text: "Sit at a Hearthlight table near someone else, chat on or off, your call." },
  { id: "join-open-table", tag: "social", energy: "medium", district: "stage",
    text: "Look for an open table at Festival Games. Join if one's running." },
  { id: "cook-together", tag: "social", energy: "medium", district: "workshop",
    text: "Drop into Hearthfire Kitchen. An NPC apprentice covers for you if nobody else shows." },
  { id: "gift-a-crop", tag: "social", energy: "medium", district: "home",
    text: "Leave a surplus harvest on the bridge for whoever crosses next, anonymously if you like." },
  { id: "breathe-with-someone", tag: "social", energy: "medium", district: "garden",
    text: "Join a Quiet Round if someone else is already sitting there." },
  { id: "open-chat-briefly", tag: "social", energy: "medium", district: "cafe",
    text: "Open chat for five minutes. Close it whenever you want, no explanation owed." },
  { id: "compliment-outfit", tag: "social", energy: "medium", district: "hub",
    text: "Emote a thumbs-up at someone whose outfit you like." },

  // ── playful ──────────────────────────────────────────────────────────
  { id: "lantern-relay-round", tag: "playful", energy: "medium", district: "hub",
    text: "Run one round of Lantern Relay. Ninety seconds, no pressure." },
  { id: "try-a-new-recipe", tag: "playful", energy: "medium", district: "workshop",
    text: "Try whatever new recipe Tansy's excited about this week." },
  { id: "silly-emote-lap", tag: "playful", energy: "low", district: "hub",
    text: "Do a lap of the plaza using only the silliest emote you've got." },
  { id: "festival-for-fun", tag: "playful", energy: "medium", district: "stage",
    text: "Play a round of Festival Games purely for the confetti." },
  { id: "browse-without-buying", tag: "playful", energy: "low", district: "mall",
    text: "Browse Pell's whole Pantry and imagine buying all of it." },
  { id: "race-the-fountain", tag: "playful", energy: "medium", district: "hub",
    text: "See how many laps of the Kindred Tree you can do before you get bored." },
  { id: "decorate-a-corner", tag: "playful", energy: "medium", district: "mall",
    text: "Place one silly decoration somewhere it doesn't belong." },
  { id: "kitchen-chaos", tag: "playful", energy: "medium", district: "workshop",
    text: "Join Hearthfire Kitchen and just see what happens." },
]);

export function tasksByTag(tag) {
  return TASK_BANK.filter((t) => t.tag === tag);
}
