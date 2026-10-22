/**
 * singlish-senses.js — multi-sense readings for the Singlish terms whose
 * meaning genuinely depends on context. Consumed by ../sense-model.js.
 *
 * Each sense: vad [valence, arousal, dominance] in [-1,1], a prior (relative
 * weight), an optional strategy (see sense-model STRATEGIES), masksDistress,
 * and cues: local-clause patterns whose weights add in log-likelihood space
 * (weight 1 ≈ e times more likely). Priors are set so the expected reading
 * with no cue matches the old single-shift value closely; cues then move it.
 *
 * Terms not listed here keep their single sense from singlish.js.
 */

const re = (s) => new RegExp(`\\b(?:${s})\\b`, "i");

export const SINGLISH_SENSES = Object.freeze({
  sian: [
    { id: "bored", gloss: "bored, tedious", vad: [-0.25, -0.35, 0], prior: 0.45,
      cues: [{ pattern: re("lecture|lect|class|lesson|tuition|meeting|waiting|queue|homework|hw|nothing to do|boring|bored|long day"), weight: 1.2 }] },
    { id: "fed-up", gloss: "fed up, frustrated", vad: [-0.5, 0.1, -0.1], prior: 0.3,
      cues: [{ pattern: re("again|always|every time|still|kena|deadline|project|group|sabo"), weight: 0.8 }] },
    { id: "resigned", gloss: "weary, drained, heavy", vad: [-0.65, -0.4, -0.45], prior: 0.25, masksDistress: true,
      cues: [{ pattern: re("life|everything|myself|tired of|no point|give up|whatever|cannot anymore|so done"), weight: 1.3 }] },
  ],
  lor: [
    { id: "matter-of-fact", gloss: "obvious or accepted outcome, neutral", vad: [0, 0, 0], prior: 0.88 },
    { id: "resigned", gloss: "resigned acceptance, nothing to be done", vad: [-0.3, -0.15, -0.25], prior: 0.12, masksDistress: true, requiresCue: true,
      cues: [{ pattern: re("no choice|what to do|anyhow|nvm|never mind|sian|bo bian|cannot|just do"), weight: 1.5 }] },
  ],
  "fine lah": [
    { id: "drop-it", gloss: "resigned 'fine', please drop it", vad: [-0.45, -0.15, -0.3], prior: 0.7, masksDistress: true },
    { id: "genuinely-fine", gloss: "actually fine, reassuring", vad: [0.2, -0.1, 0.2], prior: 0.3,
      cues: [{ pattern: re("really|actually|honestly|all good|no worries|haha|hehe|dont worry|don't worry"), weight: 1.0 }] },
  ],
  "can or not": [
    { id: "asking", gloss: "genuine question: is it possible?", vad: [0, 0.08, 0], prior: 0.75 },
    { id: "exasperated", gloss: "exasperated challenge: come on, seriously?", vad: [-0.35, 0.35, 0.1], prior: 0.25,
      cues: [{ pattern: /!{2,}|\b(?:seriously|wtf|bruh|walao|like that|so slow|still)\b/i, weight: 1.2 }] },
  ],
  steady: [
    { id: "approval", gloss: "cool, nice one, reliable", vad: [0.4, 0.15, 0.3], prior: 0.8 },
    { id: "literal", gloss: "stable, not moving", vad: [0.1, -0.2, 0.1], prior: 0.2,
      cues: [{ pattern: re("hand|hands|ground|pace|job|income|heartbeat|breathing"), weight: 1.5 }] },
  ],
  song: [
    { id: "pleasure", gloss: "feels great, satisfying", vad: [0.6, 0.25, 0.2], prior: 0.7,
      cues: [{ pattern: re("ah|sia|siol|so|damn|shiok|bath|massage|aircon|nap"), weight: 0.6 }] },
    { id: "music", gloss: "a piece of music", vad: [0, 0, 0], prior: 0.3,
      cues: [{ pattern: re("sing|sang|lyrics|play|playing|listen|listening|spotify|playlist|music|album|singer|new"), weight: 2.0 }] },
  ],
  walao: [
    { id: "exasperated", gloss: "exasperation, disbelief at something bad", vad: [-0.4, 0.4, -0.05], prior: 0.7 },
    { id: "amazed", gloss: "amazed, impressed", vad: [0.35, 0.5, 0], prior: 0.3,
      cues: [{ pattern: re("nice|best|so good|shiok|cool|wow|power|steady|pretty|cute|win|won"), weight: 1.2 }] },
  ],
  siao: [
    { id: "crazy-bad", gloss: "crazy, unreasonable, annoying", vad: [-0.4, 0.45, 0], prior: 0.6 },
    { id: "crazy-fun", gloss: "crazy in a fun or hype way", vad: [0.35, 0.55, 0.1], prior: 0.25,
      cues: [{ pattern: re("fun|best|haha|lol|shiok|power|hype|insane"), weight: 1.2 }] },
    { id: "teasing", gloss: "teasing a friend, affectionate", vad: [0.05, 0.3, 0.1], prior: 0.15, strategy: "play",
      cues: [{ pattern: re("you siao|u siao|siao ah you|siao one you"), weight: 1.8 }] },
  ],
  action: [
    { id: "show-off", gloss: "showing off, acting cool", vad: [-0.2, 0.15, 0.1], prior: 0.8 },
    { id: "literal", gloss: "an action or action genre", vad: [0, 0.1, 0], prior: 0.2,
      cues: [{ pattern: re("movie|film|take action|action plan|game|anime"), weight: 2.0 }] },
  ],
  "die liao": [
    { id: "in-trouble", gloss: "idiom: I'm in trouble, I'm screwed", vad: [-0.4, 0.45, -0.4], prior: 0.85, strategy: "hyperbole",
      cues: [{ pattern: re("exam|test|quiz|deadline|forgot|late|boss|teacher|mum|mom|dad|homework|marks|grade"), weight: 1.0 }] },
    { id: "literal", gloss: "literal reference to dying", vad: [-0.9, 0.3, -0.7], prior: 0.15, masksDistress: true },
  ],
  "ok lor": [
    { id: "resigned", gloss: "resigned acceptance", vad: [-0.3, -0.15, -0.25], prior: 0.55, masksDistress: true,
      cues: [{ pattern: re("no choice|what to do|whatever|nvm|cannot|sian|anyhow"), weight: 1.2 }] },
    { id: "easy-going", gloss: "easy-going agreement", vad: [0.1, -0.1, 0.1], prior: 0.45,
      cues: [{ pattern: re("haha|hehe|sure|see you|then|ya|yay|nice|lets|let's"), weight: 1.4 }] },
  ],
  "so free": [
    { id: "sarcastic", gloss: "sarcastic: you have too much time / why bother", vad: [-0.25, 0.25, 0.15], prior: 0.6, strategy: "irony",
      cues: [{ pattern: re("you|u|ur|they|he|she"), weight: 0.8 }] },
    { id: "literal", gloss: "has free time", vad: [0.15, -0.1, 0.1], prior: 0.4,
      cues: [{ pattern: re("i'm|im|i am|today|tmr|tomorrow|weekend|finally|after exams"), weight: 1.2 }] },
  ],
});

/** New Singlish phrases that the base lexicon did not have. */
export const SINGLISH_SENSE_ENTRIES = Object.freeze([
  { token: "die liao", variants: ["die liao", "die lor", "confirm die", "sure die", "dead liao", "die already"],
    category: "vocabulary", gloss: "idiom for being in trouble; rarely literal", stance: "hyperbolic-trouble" },
  { token: "ok lor", variants: ["ok lor", "okay lor", "k lor", "okok lor"],
    category: "particle", gloss: "acceptance; resigned or easy-going by context", stance: "acceptance" },
  { token: "so free", variants: ["so free ah", "very free ah", "u so free", "you so free", "so free meh"],
    category: "vocabulary", gloss: "usually sarcastic about someone's free time", stance: "ironic-jab" },
]);
