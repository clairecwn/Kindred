/**
 * personality.js — a short personality for each of the 8 Grove species,
 * surfaced in character select (CharacterView.jsx): a name (species.js's
 * SPECIES_NAME), a one-word temperament, a line of flavour text, the
 * emotion that drives that species' hero-preview idle pose (see
 * AnimationController.setEmotion / clips.js's IDLE_EMOTION_PROFILE), and
 * which social emote (AnimationController.EMOTE_CLIPS) plays once as a
 * "selected!" reaction.
 */
export const PERSONALITY = Object.freeze({
  fox: {
    temperament: "Spirited",
    line: "Quick-footed and quicker-witted, always chasing the next spark of an idea.",
    idleEmotion: "excited",
    reactionClip: "Cheer",
  },
  rabbit: {
    temperament: "Gentle",
    line: "Soft-spoken and endlessly kind, happiest curled up with good company.",
    idleEmotion: "content",
    reactionClip: "Wave",
  },
  bear: {
    temperament: "Steady",
    line: "Slow to rattle, quick to comfort. The friend who shows up and stays.",
    idleEmotion: "calm",
    reactionClip: "Wave",
  },
  cat: {
    temperament: "Composed",
    line: "Cool, curious, and quietly observant. Nothing gets past this one.",
    idleEmotion: "content",
    reactionClip: "Wave",
  },
  dog: {
    temperament: "Loyal",
    line: "Boundless warmth on four paws. Will always, always show up.",
    idleEmotion: "happy",
    reactionClip: "Cheer",
  },
  panda: {
    temperament: "Dreamy",
    line: "A sleepy genius who moves, and thinks, at their own unhurried pace.",
    idleEmotion: "tired",
    reactionClip: "Wave",
  },
  otter: {
    temperament: "Playful",
    line: "Never met a river, or a joke, it didn't want to play with.",
    idleEmotion: "happy",
    reactionClip: "Clap",
  },
  hedgehog: {
    temperament: "Careful",
    line: "Small, soft-hearted, and a little guarded until it knows you're safe.",
    idleEmotion: "anxious",
    reactionClip: "Wave",
  },
});

export function getPersonality(speciesId) {
  return PERSONALITY[speciesId] ?? PERSONALITY.bear;
}
