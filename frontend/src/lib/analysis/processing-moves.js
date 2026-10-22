/**
 * processing-moves.js — HOW SHOULD THIS REPLY HELP THEM THINK IT THROUGH?
 *
 * A reply that only sympathises ("i feel ya") ends the conversation; a reply
 * that only asks questions feels like an interview. Good supporters mix moves
 * and favour reflections over questions (MI competency: reflections:questions
 * >= 1:1 fair, 2:1 good; >= 40-50% complex reflections). Follow-up questions
 * about what the person actually said increase how understood they feel
 * (Huang et al., JPSP 2017). LLMs left alone over-use reassurance and
 * suggestions and are weakest at exploration (Kang et al., ACL 2024), which
 * is why the move is chosen here, outside the model.
 *
 * ===========================================================================
 * STATE
 * ===========================================================================
 * For the focus thread, a processing ladder, from emotion-focused and
 * expressive-writing work: what happened -> what it felt like -> what it
 * means / why -> settled. Its position is
 *     progress = 0.55·depth + 0.2·[feeling named by them] + 0.25·[meaning voiced]
 * depth = how much THEY have explored it (dialogue-policy.js). Stage:
 *     told < 0.3 <= felt < 0.55 <= understood < 0.8 <= settled
 *
 * ===========================================================================
 * MOVES (the writer decides the words; nothing here is a template)
 * ===========================================================================
 *   follow-up    a specific question about something they said
 *   choice       "more X or more Y?": two concrete readings, easy to answer
 *   name-feeling offer two precise feeling words to choose from (granularity)
 *   wonder       a tentative guess at the why, open to correction, no "?"
 *   connect      link two things they said, tentatively
 *   continue     a complex reflection: say the next thing they haven't said yet
 *   take         an honest friend's take on the situation (on their side)
 *   reframe      a kinder, specific angle on a harsh self-judgment
 *   play         play back with their joke
 *   pick-thread  name two open threads briefly and let them choose
 *
 * ===========================================================================
 * UTILITY
 * ===========================================================================
 *   U(m) = progress gain G[stage][m] · P(engage | m)
 *        + 0.25 · information gain(m)
 *        - effort(m) · s                       s = 1 + 0.8·brief + 0.5·child
 *        - repetition(m) - question pressure(m)
 *        + need fit(m) + situational bonuses
 *   P(engage | m) starts at 0.6 and uses the person's own history
 *   (relationship.js): questions use P(engaged | question), others
 *   P(engaged | no question); playful moves use P(engaged | playful).
 *   Question pressure keeps the reflection:question ratio at or above 1:1
 *   over the last three replies.
 * The top move goes to draft 1, the runner-up to draft 2; reply-selection.js
 * then picks between the two drafts.
 */

import { selfReports } from "./emotion-profile.js";

export const PROCESSING_MOVES_VERSION = "processing-moves-2026.10.1";
export const MOVES = Object.freeze(["follow-up", "choice", "name-feeling", "wonder", "connect", "continue", "take", "reframe", "play", "pick-thread", "double-sided", "repair"]);
export const QUESTION_MOVES = new Set(["follow-up", "choice", "name-feeling", "pick-thread"]);
const MENU_MOVES = new Set(["choice", "pick-thread", "name-feeling"]);

const EFFORT = { "follow-up": 0.5, choice: 0.2, "name-feeling": 0.2, wonder: 0.25, connect: 0.3, continue: 0.15, take: 0.15, reframe: 0.3, play: 0.05, "pick-thread": 0.25, "double-sided": 0.15, repair: 0.05 };
// Progress gain per stage (rows) and move (columns), 0..1.
const GAIN = {
  told:       { "follow-up": 0.8, choice: 0.6, "name-feeling": 0.7, wonder: 0.4, connect: 0.3, continue: 0.6, take: 0.4, reframe: 0.1, play: 0.2, "pick-thread": 0.5, "double-sided": 0.5, repair: 0 },
  felt:       { "follow-up": 0.6, choice: 0.7, "name-feeling": 0.4, wonder: 0.8, connect: 0.6, continue: 0.6, take: 0.5, reframe: 0.45, play: 0.2, "pick-thread": 0.4, "double-sided": 0.7, repair: 0 },
  understood: { "follow-up": 0.4, choice: 0.4, "name-feeling": 0.2, wonder: 0.5, connect: 0.7, continue: 0.5, take: 0.7, reframe: 0.6, play: 0.3, "pick-thread": 0.5, "double-sided": 0.6, repair: 0 },
  settled:    { "follow-up": 0.2, choice: 0.2, "name-feeling": 0.1, wonder: 0.2, connect: 0.3, continue: 0.3, take: 0.5, reframe: 0.3, play: 0.4, "pick-thread": 0.6, "double-sided": 0.3, repair: 0 },
};
const INFO = { "follow-up": 0.8, choice: 0.6, "name-feeling": 0.6, wonder: 0.4, connect: 0.3, continue: 0.1, take: 0.05, reframe: 0.1, play: 0, "pick-thread": 0.5, "double-sided": 0.15, repair: 0 };

export const DESCRIBE = Object.freeze({
  "follow-up": "Ask one specific follow-up about a detail they actually mentioned in this thread (or the answer they just gave), something you'd genuinely want to know that would help them think it through. If it's good news, be properly happy for them first. Not a general 'how do you feel', and not a menu of options.",
  choice: "In one casual sentence, offer two concrete, different readings of what's going on for them in this thread and let them pick: 'more like X, or more like Y?'. Both options come from what they wrote. No numbering, no lists.",
  "name-feeling": "Offer two precise words for the feeling in this thread, drawn from what they described, and let them say which fits better. Light, not clinical.",
  wonder: "Wonder out loud, casually, about what might be underneath the focus thread, as one guess they can correct (e.g. starting with 'maybe'). Build it only from things they said; never state a cause as fact; don't recap the day.",
  connect: "Point out a link between what they just said and another thing they mentioned earlier but you haven't talked about yet (named below if there is one), tentatively, so they can confirm or push back.",
  continue: "Say to them (using 'you'), not as them, the next thing they're probably feeling or thinking about the focus but haven't said yet: one or two plain statements, then stop. No question, no suggestion. It should make them want to add to it, not just agree.",
  take: "Give your honest take as a friend on their side about the focus thread only: what you think of the situation or the people in it. Specific, a bit opinionated, not advice, not a list of the day's events.",
  reframe: "They were hard on themselves. Offer a kinder, specific way of seeing it based on what they actually described, without being overly positive or dismissing it.",
  play: "They're joking around. Play back with the joke in their style and keep it light; no feelings talk.",
  "pick-thread": "Briefly name two open things from what they wrote and ask which one is actually bugging them more, or if it's something else.",
  "double-sided": "They want two things that pull against each other. Say both back in one natural sentence where both are true (\"you wanna X, but you also Y\" in your own words), and what makes that tiring or hard. Don't make them choose, don't offer options, no advice.",
  land: "Wrap this up warmly for now: one short line that names something real from what they shared (in plain words), and leaves the door open without asking anything. No advice, no plan, no list, no joke, no question.",
  repair: "They didn't follow your last message, or it missed. In one short plain line, own it lightly and say what you meant more simply, or drop it and come back to what they actually said. No new topic, no joke, no meme, no options.",
});

// Harsh verdicts about themselves. "idk whats wrong w me" is puzzlement, not
// a verdict, so it counts toward CAUSE_UNKNOWN instead.
const SELF_JUDGMENT = /\b(?:i (?:just )?suck at|i'?m (?:so )?bad at|im (?:so )?bad at|i'?m so (?:lazy|useless|stupid|dumb|annoying|pathetic)|im (?:so )?(?:lazy|useless|stupid|dumb)|i always (?:mess|screw|ruin)|i'?m the problem|i suck|i'?m a failure|im a failure)\b/i;
const CAUSE_UNKNOWN = /\b(?:idk|dk|don'?t know|dont know|dunno|not sure|no idea)\s+(?:why|what'?s wrong|whats wrong|how come)\b|\bwhat'?s wrong (?:w|with) me\b|\bwhats wrong (?:w|with) me\b|\bfor no reason\b|\bout of nowhere\b/i;
const MEANING_VOICED = /\b(?:because|cos|cuz|bc|i think|i guess|maybe it'?s|i realised|i realized|i feel like|probably cos|the thing is|actually it'?s)\b/i;
const BROAD_ANSWER = /\b(?:both|all of (?:it|them|the above)|everything|idk|dk|dunno|not sure|no idea|everything la|all la|both la)\b/i;
const words = (t) => (String(t ?? "").match(/[\p{L}\p{N}']+/gu) ?? []).length;

export function processingStage(topic, userTexts = []) {
  const depth = Math.max(0, Math.min(1, topic?.explorationDepth ?? 0));
  const quotes = (topic?.evidence ?? []).map((e) => e.quote).join(" ");
  const feelingNamed = Object.keys(selfReports(quotes)).length > 0;
  const meaning = userTexts.some((t) => MEANING_VOICED.test(t)) ? 1 : 0;
  const progress = 0.55 * depth + 0.2 * Number(feelingNamed) + 0.25 * meaning;
  const stage = progress < 0.3 ? "told" : progress < 0.55 ? "felt" : progress < 0.8 ? "understood" : "settled";
  return { stage, progress, feelingNamed, meaningVoiced: Boolean(meaning) };
}

/**
 * @param {object} ctx
 *   focus           focus topic from the debrief state
 *   openThreads     other meaningful unresolved threads
 *   userTexts       the person's texts in this conversation (journal first)
 *   latest          latest user message
 *   interpretation  validated interpretation (need, mode)
 *   relationship    relationship.js stats
 *   typicalWords    their usual message length
 *   ageBand
 *   recentMoves     moves used in Kindred's last replies, oldest first
 *   recentQuestions number of questions in Kindred's last three replies
 */
export function chooseMove(ctx = {}) {
  const stageInfo = processingStage(ctx.focus, ctx.userTexts ?? []);
  // A short message that the slang reader is confident is a meme or joke
  // ("6 7 lol") is play, whatever the model's reading of the wider entry said.
  const lexicalPlay = (ctx.playMass ?? 0) >= 0.5 && words(ctx.latest) <= 6;
  // Clear good news in their own words (excited / proud / happy leading the
  // emotion profile, positive reading): celebrate first, whatever else.
  // Anger or irritation in their own words while venting: be on their side
  // first (take / continue), don't open a menu about the other person.
  const venting = !lexicalPlay && !ctx.goodNews && ctx.interpretation?.need !== "make-sense"
    && (ctx.interpretation?.mode === "venting" || ["angry", "irritated", "frustrated", "fed up"].includes(ctx.latestLead));
  const need = lexicalPlay ? "play" : ctx.goodNews ? "celebrate" : venting ? "vent" : ctx.interpretation?.need ?? "be-heard";
  const mode = lexicalPlay ? "play" : ctx.interpretation?.mode ?? "literal";
  const latest = String(ctx.latest ?? "");
  const typical = Number(ctx.typicalWords) > 0 ? Number(ctx.typicalWords) : 12;
  // A short journal is not a short REPLY: brevity only signals low energy for
  // conversation once Kindred has already said something.
  const brief = (ctx.recentMoves ?? []).length > 0 && words(latest) <= Math.max(3, 0.5 * typical) ? 1 : 0;
  // A short, vague entry with few specifics: a friend asks what happened.
  const opening = !(ctx.recentMoves ?? []).length && (ctx.userTexts ?? []).length <= 1
    && (!(ctx.userTexts ?? []).length || String(ctx.userTexts[0]).trim() === latest.trim());
  const vagueOpening = opening && words(latest) <= 15;
  const s = 1 + 0.8 * brief + 0.5 * Number(ctx.ageBand === "child");
  const allText = [...(ctx.userTexts ?? []), latest].join(" ");
  const selfJudgment = SELF_JUDGMENT.test(allText);
  const causeUnknown = CAUSE_UNKNOWN.test(allText);
  const threads = (ctx.openThreads ?? []).length;
  const rel = ctx.relationship ?? {};
  const pQ = rel.question?.n >= 5 ? rel.question.p : 0.6;
  const pNoQ = rel.noQuestion?.n >= 5 ? rel.noQuestion.p : 0.6;
  const pPlay = rel.playful?.n >= 5 ? rel.playful.p : 0.6;
  const recent = ctx.recentMoves ?? [];
  const last = recent.at(-1);
  // They just answered an either/or, a feeling-word offer or a thread pick:
  // build on the answer (go deeper on it), don't offer another menu.
  const answeredOption = recent.slice(-2).some((m) => ["choice", "name-feeling", "pick-thread", "follow-up"].includes(m)) && words(latest) <= 12;
  // "both", "all of it", "idk", "everything": a broad answer. Another menu is
  // pointless; go with what they said and add something (Huang et al.: follow
  // the answer up, don't re-ask it).
  const broadAnswer = BROAD_ANSWER.test(latest) && words(latest) <= 10;

  // What their last message did to ours (turn-act.js). Repair is not a
  // scoring question: when they didn't follow, the only good move is to fix it.
  const turn = ctx.turnAct ?? null;
  if (turn && (turn.act === "repair" || turn.act === "pushback")) {
    return { version: PROCESSING_MOVES_VERSION, move: "repair", runnerUp: "repair", ranked: [{ move: "repair", utility: 1 }],
      stage: stageInfo.stage, progress: Number(stageInfo.progress.toFixed(2)), causeUnknown, selfJudgment, brief: true,
      isQuestion: false, answeredOption: false, broadAnswer: false, turnAct: turn.act, target: null };
  }
  const answered = Boolean(turn?.answeredQuestion) || turn?.act === "elaboration";
  const target = (ctx.untouchedThreads ?? [])[0] ?? null;
  // Stepwise topic movement: a link to another thread is natural when what
  // they just said shares something with it (Jefferson 1984); otherwise it
  // reads as changing the subject.
  const targetWords = new Set(String(`${target?.summary ?? ""} ${target?.quote ?? ""}`).toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const linkedToTarget = target ? (String(latest).toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => targetWords.has(w)).length > 0 : false;
  const scored = MOVES.filter((m) => m !== "repair").map((m) => {
    const engage = m === "play" ? pPlay : QUESTION_MOVES.has(m) ? pQ : pNoQ;
    let u = GAIN[stageInfo.stage][m] * engage + 0.25 * INFO[m] - EFFORT[m] * s * 0.5;
    // Harsh self-talk in THIS message: never extend it (continue/wonder can
    // amplify it); a fresh reframe is allowed even right after another.
    const latestSelfJudgment = SELF_JUDGMENT.test(latest);
    if (latestSelfJudgment && ["continue", "wonder"].includes(m)) u -= 0.5;
    if (m === last && !(latestSelfJudgment && m === "reframe")) u -= 0.25;
    if (recent.slice(-3).filter((x) => x === m).length >= 2) u -= 0.4;
    if (QUESTION_MOVES.has(m) && (ctx.recentQuestions ?? 0) >= 2) u -= 0.3;   // keep R:Q >= 1:1
    // Need fit.
    if (need === "play" || mode === "play") u += m === "play" ? 0.6 : QUESTION_MOVES.has(m) || m === "wonder" || m === "reframe" ? -0.3 : 0;
    else if (m === "play") u -= 0.5;
    if (need === "vent") u += m === "take" || m === "continue" ? 0.2 : m === "reframe" ? -0.2 : 0;
    if (need === "make-sense") u += ["wonder", "choice", "connect"].includes(m) ? 0.25 : 0;
    if (need === "celebrate") u += m === "follow-up" ? 0.35 : m === "take" ? 0.15 : ["reframe", "wonder", "choice", "name-feeling", "pick-thread"].includes(m) ? -0.35 : 0;
    // Situation.
    if (causeUnknown) u += m === "choice" || m === "wonder" ? 0.2 : 0;           // wonder WITH them, don't tell them why
    // Harsh self-talk ("im so lazy", "whats wrong w me") after the feeling is
    // out: a specific, empathic reframe (Sharma et al., ACL 2023).
    if (selfJudgment && stageInfo.stage !== "told") u += m === "reframe" ? 0.45 : 0;
    if (!selfJudgment && m === "reframe") u -= 0.5;
    if (threads >= 2 && stageInfo.stage === "told") u += m === "pick-thread" ? 0.15 : 0;
    if (threads === 0 && m === "pick-thread") u -= 0.6;
    if (m === "connect" && threads === 0 && (ctx.userTexts ?? []).length < 2) u -= 0.3;
    // They answered (or added something): take up THEIR answer. A new menu
    // right after an answer reads as not listening.
    if (answered && MENU_MOVES.has(m)) u -= 0.6;
    if (answered && turn?.substantive) u += m === "continue" || m === "follow-up" || m === "take" ? 0.2 : m === "connect" && linkedToTarget ? 0.25 : m === "connect" ? -0.15 : 0;
    // A bare "ya"/"ok" to a question: they didn't pick. Don't re-ask; offer something.
    if (turn?.act === "ack" && turn.lastQuestion && MENU_MOVES.has(m)) u -= 0.5;
    // A bare acknowledgement means this thread has given what it will for
    // now; a friend picks up the heavy thing they mentioned but nobody has
    // talked about yet (stepwise topic movement), else keeps it moving.
    if (turn?.act === "ack") u += m === "connect" && target ? 0.45 : m === "follow-up" && target ? 0.2 : m === "continue" || m === "take" ? 0.1 : 0;
    // Two pulls at once: the double-sided reflection is the MI move for ambivalence.
    if (m === "double-sided") u += turn?.ambivalence ? 0.6 : -0.6;
    if (m === "connect" && !target && (ctx.userTexts ?? []).length < 2) u -= 0.2;
    if (broadAnswer) u += ["choice", "pick-thread", "name-feeling"].includes(m) ? -0.6 : ["wonder", "continue", "take", "connect"].includes(m) ? 0.2 : 0;
    if (vagueOpening) u += m === "follow-up" ? 0.3 : ["wonder", "connect", "reframe", "take"].includes(m) ? -0.15 : 0;
    // First reply to a journal entry (troubles-telling, Jefferson 1988): the
    // listener first shows they took in the specific trouble, then lets the
    // teller develop it. Handing over emotion words or an either/or before
    // anything else reads as a form, not a friend.
    if (opening) u += m === "follow-up" ? 0.15 : m === "name-feeling" ? -0.5 : m === "choice" ? -0.1 : 0;
    if (answeredOption) u += m === "follow-up" || m === "continue" ? 0.25 : m === "take" ? 0.1 : ["choice", "pick-thread", "name-feeling"].includes(m) ? -0.3 : 0;
    if (!stageInfo.feelingNamed && m === "name-feeling") u += 0.1;
    if (stageInfo.feelingNamed && m === "name-feeling") u -= 0.3;
    // Children: concrete, easy moves; less speculation about inner states.
    if (ctx.ageBand === "child") u += ["choice", "name-feeling", "play", "follow-up", "take"].includes(m) ? 0.1 : ["continue", "wonder", "connect"].includes(m) ? -0.15 : 0;
    return { move: m, utility: Number(u.toFixed(3)) };
  }).sort((a, b) => b.utility - a.utility || MOVES.indexOf(a.move) - MOVES.indexOf(b.move));

  const [first, second] = scored;
  return {
    version: PROCESSING_MOVES_VERSION,
    move: first.move,
    runnerUp: second.move,
    ranked: scored,
    stage: stageInfo.stage,
    progress: Number(stageInfo.progress.toFixed(2)),
    causeUnknown,
    selfJudgment,
    brief: Boolean(brief),
    isQuestion: QUESTION_MOVES.has(first.move),
    answeredOption,
    broadAnswer,
    turnAct: turn?.act ?? null,
    target,
    need,
  };
}

/** A reply that leaves something to answer. Used to score drafts, never to write them. */
export function hookStrength(text, userText = "") {
  const value = String(text ?? "").trim();
  if (!value) return 0;
  if (/\?/.test(value)) return 1;
  const lastSentence = value.split(/(?<=[.!])\s+/).at(-1) ?? value;
  if (/\b(?:i wonder|or maybe|or is it|or more|could be|might be|maybe it'?s|kinda like|almost like|feels like it'?s|i bet|lowkey think|i think it'?s)\b/i.test(lastSentence)) return 0.85;
  if (/\bor\b/i.test(lastSentence) && /\b(?:more|like|just|the|it)\b/i.test(lastSentence)) return 0.7;
  // A statement about them that names something specific they said can still
  // invite a reply; generic sympathy ("i feel ya") does not.
  const userWords = new Set((String(userText).toLowerCase().match(/[a-z']{4,}/g) ?? []));
  const overlap = (lastSentence.toLowerCase().match(/[a-z']{4,}/g) ?? []).filter((w) => userWords.has(w)).length;
  if (/\b(?:you|u|ur|your)\b/i.test(lastSentence) && overlap >= 2) return 0.4;
  return overlap >= 2 ? 0.25 : 0.1;
}

/** Asserting a cause they said they don't know, without hedging. */
export function unsupportedCause(text, userText = "") {
  if (!CAUSE_UNKNOWN.test(String(userText))) return false;
  const value = String(text ?? "");
  const claims = /\b(?:because|cos|cuz|from all|that'?s why|no wonder|it'?s (?:just )?(?:the|cos|because)|is just|just fried|is fried|probably just)\b/i.test(value);
  const hedged = /\b(?:maybe|might|could|i wonder|or|not sure|idk|kinda|perhaps|my guess|i guess|guessing|wonder if)\b/i.test(value) || /\?/.test(value);
  return claims && !hedged;
}

const GENERIC_QUESTION = /\b(?:how (?:does|did) (?:that|it|this) (?:make you )?feel|how are you feeling|how do you feel about (?:that|it|this)|what'?s on your mind|anything else (?:on your mind|you want)|do you want to talk about it|wanna talk about it|what do you think|tell me more|how was your day|what happened)\b\??/i;

/**
 * Quality of the question in a reply, 0..1. A question earns its place when
 * it is anchored in the person's own words (it could only be asked of THIS
 * message); stock questions that fit any message score 0.
 *   no question -> 1 (nothing to judge)
 *   generic     -> 0
 *   anchored    -> 0.5 + 0.5 · min(1, shared content words / 2)
 */
export function questionQuality(text, userText = "") {
  const sentences = String(text ?? "").split(/(?<=[.!?])\s+/).filter((x) => x.includes("?"));
  if (!sentences.length) return 1;
  const userWords = new Set((String(userText).toLowerCase().match(/[a-z']{4,}/g) ?? []));
  return Math.min(...sentences.map((q) => {
    const shared = (q.toLowerCase().match(/[a-z']{4,}/g) ?? []).filter((w) => userWords.has(w)).length;
    if (GENERIC_QUESTION.test(q) && shared < 2) return 0;
    return shared ? 0.5 + 0.5 * Math.min(1, shared / 2) : 0.25;
  }));
}

/**
 * The companion must never take on the user's experience as its own ("i'm
 * still cringing about that scold", "i wish i could disappear"). Flags a
 * first-person feeling or experience statement that reuses the user's
 * details. Kindred may say "i get it" or share an opinion; it may not narrate
 * their life in the first person.
 */
export function speaksAsUser(text, userText = "") {
  // Quoted inner speech ("a loop of “I'm done” and “what if”") is a reflection
  // of their words, not Kindred speaking as them.
  const sentences = String(text ?? "").replace(/“[^”]*”|"[^"]*"/g, " ").replace(/[’‘]/g, "'").split(/(?<=[.!?…])\s+/);
  const userWords = new Set((String(userText).toLowerCase().match(/[a-z']{4,}/g) ?? []));
  return sentences.some((sentence) => {
    // Talking about its own last message ("i just meant", "i was trying to
    // say") is what a repair sounds like, not speaking as the user.
    if (/\bi (?:was (?:just )?(?:saying|asking|trying to say|talking about)|just meant|meant|mean|was gonna say|wanted to say)\b/i.test(sentence)
      && !/\b(?:i wish i|i'?m still|i keep (?:thinking|replaying|crying))\b/i.test(sentence)) return false;
    // Unmistakable first-person experience: never Kindred's to claim.
    if (/\b(?:i wish i|i'?m still|im still|i keep (?:thinking|replaying|feeling|crying)|i was so|i felt so|i feel so|i got scolded|i cried|i want to disappear|i could just disappear)\b/i.test(sentence)) return true;
    if (!/\b(?:i'?m|im|i am|i was|i feel|i felt|i wish|i keep|i can'?t|i just|my (?:teacher|mum|mom|dad|friend|group|assignment|laptop))\b/i.test(sentence)) return false;
    // An opinion or reaction opening the sentence is Kindred's own voice.
    if (/^\W*(?:\w+,?\s+)?(?:i (?:get|bet|think|reckon|guess|mean|love|hope|wonder|feel (?:that|u|you|ya|this|it))|i'?m (?:here|glad|sorry|curious|not sure))\b/i.test(sentence)) return false;
    const shared = (sentence.toLowerCase().match(/[a-z']{4,}/g) ?? []).filter((w) => userWords.has(w)).length;
    return shared >= 1 || /\b(?:disappear|cringing|crying|scolded|embarrass)/i.test(sentence);
  });
}

/**
 * Escalation: the reply adds absolute or hopeless claims about the person or
 * their situation that they did not make themselves ("you'll never get past
 * it", "a waste of time"). Supportive replies can co-ruminate; this catches
 * the most direct form.
 */
const ABSOLUTE_NEGATIVE = /\b(?:never (?:get|pass|be|going to|gonna|make)|always (?:fail|mess|screw)|waste of time|hopeless|pointless|no point|give up|can'?t do anything right|nothing will)\b/i;
export function escalates(text, userText = "") {
  const reply = String(text ?? "").replace(/[’‘]/g, "'");
  const match = reply.match(ABSOLUTE_NEGATIVE);
  if (!match) return false;
  return !String(userText).toLowerCase().includes(match[0].toLowerCase());
}

/** The wrap-up move used when the conversation policy decides to land. */
export function landingMove(stage = "understood") {
  return { version: PROCESSING_MOVES_VERSION, move: "land", runnerUp: "land", ranked: [{ move: "land", utility: 1 }], stage,
    progress: null, causeUnknown: false, selfJudgment: false, brief: true, isQuestion: false, answeredOption: false,
    broadAnswer: false, turnAct: null, target: null, need: "be-heard" };
}
