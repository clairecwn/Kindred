// src/grove/story/cast.js
//
// The residents of the Kindred Commons. Species is never decoration:
// each one is chosen for the emotional register that character holds in
// the world (Design Bible s3 — "the animal chosen for each character
// should reflect their emotional essence"), and every resident is tied to
// exactly one district so that "who do I want to see today" and "where do
// I want to be today" are the same question.
//
// `color` tints the standing figure GroveScene builds; `fur` and `ear`
// give each one a silhouette you can name from across a plaza. `holds`
// is the one thing that character is for — not a quest-giver role, a
// social one.

export const CAST = Object.freeze([
  {
    id: "marlow", name: "Marlow", species: "tortoise", district: "landing",
    color: 0x8a9a6a, fur: 0xcbbf96, ear: "round",
    holds: "Arrival. Nothing is expected of you in the first ten minutes.",
    blurb: "Ferried you in and never asked why you came.",
  },
  {
    id: "bramble", name: "Bramble", species: "badger", district: "garden",
    color: 0x7d8f7a, fur: 0xd8d2c4, ear: "round",
    holds: "Solitude without loneliness. Sitting near someone silently.",
    blurb: "Tends the beds. Talks in short sentences and long pauses.",
  },
  {
    id: "wren", name: "Wren", species: "sparrow", district: "cafe",
    color: 0x5b9b8a, fur: 0xc8a274, ear: "crest",
    holds: "Being fed without having to explain yourself.",
    blurb: "Pours before you ask. Deflects thanks every single time.",
  },
  {
    id: "tansy", name: "Tansy", species: "otter", district: "workshop",
    color: 0xc4744a, fur: 0xa3765a, ear: "round",
    holds: "Making a bad thing on purpose. Second attempts.",
    blurb: "Runs the Makery and the furniture shop. Sawdust everywhere.",
  },
  {
    id: "corvin", name: "Old Corvin", species: "heron", district: "stage",
    color: 0xa98bd1, fur: 0xd6d0e2, ear: "crest",
    holds: "Being witnessed. Memory — he remembers what you did last time.",
    blurb: "Keeps the Round. Has watched a great many people be nervous.",
  },
  {
    id: "pell", name: "Pell", species: "hedgehog", district: "mall",
    color: 0xb9a64a, fur: 0xc0a377, ear: "pointed",
    holds: "Ordinary errands. The dignity of small practical tasks.",
    blurb: "Keeps the Pantry stocked. Gives you more than you paid for.",
  },
  {
    id: "juniper", name: "Juniper", species: "fox", district: "mall",
    color: 0xd98a9b, fur: 0xd08a5a, ear: "pointed",
    holds: "Identity and self-presentation, without status.",
    blurb: "Runs Threadbare. Thinks clothes are sentences, not scores.",
  },
  {
    id: "nim", name: "Nim", species: "rabbit", district: "home",
    color: 0xd9c05a, fur: 0xe0d6bd, ear: "long",
    holds: "Mutual newness. Someone who is also figuring it out.",
    blurb: "Arrived a week before you and is still pretending to be settled.",
  },
]);

export const NPC_BY_ID = Object.freeze(Object.fromEntries(CAST.map((c) => [c.id, c])));
export const NPC_IDS = Object.freeze(CAST.map((c) => c.id));
export const NPC_LABELS = Object.freeze(Object.fromEntries(CAST.map((c) => [c.id, c.name])));
