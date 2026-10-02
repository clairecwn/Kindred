/**
 * Turn-level context model for journal follow-up conversations.
 *
 * The language model writes the prose, but this module decides what the reply
 * needs to do.  Recent user turns receive exponentially more weight, new
 * information is measured against prior user language, and questions are
 * budgeted so the companion does not turn a reflection into an interview.
 */

import { analyseText } from "./text-features.js";
import { retrieveConversationMemories } from "./conversation-memory.js";
import { buildExperienceProfile, formatExperienceProfile } from "./experience-profile.js";
import { hasArtificialStyleTell } from "./companion-style.js";

export const CONVERSATION_MODEL_VERSION = "conversation-response-2026.10.3";
export const MAX_CONTEXT_TURNS = 80;
export const MAX_PROMPT_TURNS = 18;

const STOP_WORDS = new Set([
  "a", "about", "after", "again", "all", "also", "am", "an", "and", "are", "as", "at",
  "be", "because", "been", "before", "being", "but", "by", "can", "could", "did", "do",
  "does", "doing", "for", "from", "had", "has", "have", "he", "her", "here", "him", "his",
  "how", "i", "if", "in", "into", "is", "it", "its", "just", "me", "more", "my", "of",
  "on", "or", "our", "really", "she", "so", "some", "than", "that", "the", "their", "them",
  "then", "there", "they", "this", "to", "too", "up", "very", "was", "we", "were", "what",
  "when", "where", "which", "who", "why", "will", "with", "would", "you", "your",
]);

const ADVICE_REQUEST = /\b(?:what should i|what do i do|what can i do|any advice|help me (?:decide|figure|with)|how (?:can|do|should) i|suggest(?:ion|ions)?|recommend)\b/i;
const EMOTION_WORD = "(?:angry|mad|furious|sad|upset|anxious|worried|happy|fine|tired|frustrated|jealous|scared)";
const CORRECTION = new RegExp(`\\b(?:no(?:[,!.]|\\s+(?:that|i|you|not))|not really|that'?s not|i didn'?t mean|what i mean|you misunderstood|rather than|actually[, ]+(?:no|not|i mean|i (?:finished|didn'?t|don'?t|wasn'?t|am not)|now)|where got|why (?:you|u) say|what (?:are )?(?:you|u) saying|not\\s+(?:saying\\s+)?(?:i(?:'m| am)?\\s+)?${EMOTION_WORD})\\b`, "i");
const EMOTION_SEARCH = /\b(?:i don'?t know (?:how|what) i feel|can'?t tell how i feel|what am i feeling|confused about how i feel|mixed feelings?)\b/i;
const CLARIFICATION_REQUEST = /\b(?:wdym|wym|what do you mean|what does that mean|huh|meaning\?)\b/i;
const ACTION_LANGUAGE = /\b(?:i(?:'m| am)? going to|i will|i'?ll|i decided|my plan|first i(?:'ll| will)|need to start|gonna start)\b/i;
const CAUSAL_LANGUAGE = /\b(?:because|since|when|after|before|so that|which means|that'?s why|due to|but|although|even though)\b/i;

const CONVERSATIONAL_FRAMES = Object.freeze([
  { type: "selfCriticism", re: /\b(?:i wasted|should(?:'ve| have)|could(?:'ve| have)|my fault|blame myself|why didn'?t i|i messed up)\b/i, phrase: "being hard on yourself about what has already happened" },
  { type: "evaluationThreat", re: /\b(?:present(?:ing|ation)?|pitch|exam|interview|audition|performance).{0,140}\b(?:freeze|fail|judge|embarrass|disappoint|mess up)|\b(?:freeze|fail|judge|embarrass|disappoint|mess up).{0,140}\b(?:present(?:ing|ation)?|pitch|exam|interview|audition|performance)|\b(?:freeze|disappoint (?:the|my) (?:group|team)|let (?:the|my) (?:group|team) down)\b/i, phrase: "the pressure of being evaluated and possibly letting people down" },
  { type: "interpersonalUnreliability", re: /\b(?:friend|partner|teammate|group|classmate|colleague|boss|parent|they|he|she).{0,50}\b(?:ignore|ignored|reply|respond|cancel|change|changing|unreliable|last minute|ghost)\b/i, phrase: "having to depend on someone whose actions keep shifting" },
  { type: "socialDisconnection", re: /\b(?:left out|excluded|ignored|forgotten|not invited|ghosted|no one listens|nobody listens|don'?t belong|alone in this)\b/i, phrase: "feeling left out or unsupported" },
  { type: "uncertainty", re: /\b(?:don'?t know what will happen|not sure what|uncertain|unpredictable|keeps changing|no idea whether|waiting to find out)\b/i, phrase: "not having a stable sense of what to expect" },
  { type: "loss", re: /\b(?:miss (?:them|him|her|you)|lost|breakup|broke up|passed away|not here anymore|without them)\b/i, phrase: "missing someone or something that mattered" },
  { type: "competingGoals", re: /\b(?:part of me|on one hand|torn between|want to .{0,35} but|don'?t want to .{0,35} but)\b/i, phrase: "being pulled between two things that both matter" },
  { type: "noRecovery", re: /\b(?:cannot|can'?t|don'?t|get no time to|hardly)\s+(?:relax|rest|switch off|wind down)|\bno (?:real )?(?:break|rest|downtime|time to myself)\b/i, phrase: "not getting a real chance to switch off and recover" },
  { type: "overload", re: /\b(?:so many|too many|many)\s+(?:things|topics|subjects|chapters|tasks)\s+(?:at once|together)|\beverything (?:at once|together)\b/i, phrase: "having too much to absorb or handle at once" },
  { type: "roleSwitching", re: /\b(?:in the morning|morning).{0,100}\b(?:afternoon|evening|night).{0,100}\b(?:continue|return|come back|more|again|work|assignment)|\b(?:one thing|one job|one task).{0,50}\b(?:then|straight into).{0,50}\b(?:another|next)\b/i, phrase: "moving from one demand straight into the next" },
]);

function words(text) {
  return (String(text ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? [])
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function wordSet(text) {
  return new Set(words(text));
}

function overlapRatio(a, b) {
  if (!a.size) return 0;
  let shared = 0;
  for (const value of a) if (b.has(value)) shared += 1;
  return shared / a.size;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function sameMessage(a, b) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

export function sanitiseConversationHistory(history = [], currentMessage = "", limit = MAX_CONTEXT_TURNS) {
  const clean = (Array.isArray(history) ? history : [])
    .map((turn) => ({ role: turn?.role === "ai" ? "ai" : "user", text: String(turn?.text ?? "").trim() }))
    .filter((turn) => turn.text);
  // The UI used to append the newest user message before calling the API and
  // generateChatReply appended it again.  Make the boundary safe regardless
  // of which caller shape is used.
  if (clean.at(-1)?.role === "user" && sameMessage(clean.at(-1).text, currentMessage)) clean.pop();
  return clean.slice(-Math.max(1, limit));
}

function rejectedEmotionLanguage(text) {
  const pattern = new RegExp(`\\bnot\\s+(?:saying\\s+)?(?:i(?:'m| am)?\\s+)?(${EMOTION_WORD.slice(3, -1)})\\b`, "gi");
  return [...String(text ?? "").matchAll(pattern)].map((match) => match[1].toLowerCase());
}

export function buildThreadState(originalEntry = "", history = []) {
  const userTurns = [originalEntry, ...history.filter((turn) => turn.role === "user").map((turn) => turn.text)].filter(Boolean);
  const frameCounts = new Map();
  const topicCounts = new Map();
  userTurns.forEach((text, index) => {
    const recency = Math.exp(-0.12 * (userTurns.length - 1 - index));
    for (const cause of causeFocus(analyseText(text))) frameCounts.set(cause.type, (frameCounts.get(cause.type) ?? 0) + recency);
    for (const frame of conversationalFrames(text)) frameCounts.set(frame.type, (frameCounts.get(frame.type) ?? 0) + recency);
    for (const token of wordSet(text)) topicCounts.set(token, (topicCounts.get(token) ?? 0) + recency);
  });
  const rank = (map, limit) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
  const rejectedEmotions = [...new Set(userTurns.flatMap(rejectedEmotionLanguage))];
  return {
    userTurnCount: userTurns.length,
    dominantFrames: rank(frameCounts, 5).map(([type, weight]) => ({ type, weight })),
    recurringTopics: rank(topicCounts, 8).map(([topic, weight]) => ({ topic, weight })),
    rejectedEmotions,
    recentUserTurns: userTurns.slice(-4),
  };
}

function weightedConversationVAD(userTexts) {
  const readings = userTexts.map((text) => analyseText(text));
  let denominator = 0;
  const sum = { valence: 0, arousal: 0, dominance: 0 };
  readings.forEach((reading, index) => {
    const age = readings.length - 1 - index;
    const recency = Math.exp(-0.55 * age);
    const evidence = 0.35 + 0.65 * (reading.vadConfidence ?? 0);
    const weight = recency * evidence;
    denominator += weight;
    for (const axis of Object.keys(sum)) sum[axis] += weight * (reading.vad?.[axis] ?? 0);
  });
  if (!denominator) return { valence: 0, arousal: 0, dominance: 0 };
  return Object.fromEntries(Object.entries(sum).map(([axis, value]) => [axis, value / denominator]));
}

function inferIntent(text) {
  if (CLARIFICATION_REQUEST.test(text)) return "clarification-request";
  if (ADVICE_REQUEST.test(text)) return "advice-request";
  if (CORRECTION.test(text)) return "correction";
  if (EMOTION_SEARCH.test(text)) return "emotion-clarification";
  if (ACTION_LANGUAGE.test(text)) return "planning";
  if (CAUSAL_LANGUAGE.test(text) || words(text).length >= 9) return "elaboration";
  return "brief-disclosure";
}

function chooseAnchor(text) {
  const clauses = String(text ?? "").split(/(?<=[.!?])\s+|\s+(?:but|although|though|because|and then)\s+/i);
  const ranked = clauses
    .map((clause, index) => ({ clause: clause.trim(), index, content: words(clause) }))
    .filter((item) => item.content.length)
    .sort((a, b) => b.content.length - a.content.length || b.index - a.index);
  const chosen = ranked[0]?.clause ?? String(text ?? "").trim();
  return chosen.replace(/^[,;:\s]+|[,;:\s]+$/g, "").split(/\s+/).slice(0, 18).join(" ");
}

function questionPolicy(intent, history, novelty, latestFeatures) {
  const recentAssistant = history.filter((turn) => turn.role === "ai").slice(-2);
  const recentQuestions = recentAssistant.reduce((n, turn) => n + ((turn.text.match(/\?/g) ?? []).length > 0 ? 1 : 0), 0);
  const userAnsweredQuestion = history.at(-1)?.role === "ai" && history.at(-1).text.includes("?");
  if (intent === "advice-request") return { budget: 0, reason: "answer the request before asking anything" };
  if (intent === "correction") return { budget: 0, reason: "repair the misunderstanding without interrogating" };
  if (intent === "clarification-request") return { budget: 0, reason: "clarify the companion's meaning directly" };
  if (userAnsweredQuestion || recentQuestions >= 2) return { budget: 0, reason: "the user has already been answering questions; reflect this turn" };
  if (intent === "brief-disclosure" && novelty < 0.35) return { budget: 1, reason: "one focused clarification may help" };
  if ((latestFeatures.vadConfidence ?? 0) < 0.2) return { budget: 1, reason: "language evidence is sparse; check rather than assume" };
  return { budget: 0, reason: "a specific reflection is more useful than another question" };
}

function causeFocus(features) {
  const causes = features.appraisal?.causes ?? [];
  const seen = new Set();
  return causes.filter((cause) => {
    if (seen.has(cause.type)) return false;
    seen.add(cause.type);
    return true;
  }).slice(0, 3).map((cause) => ({ type: cause.type, phrase: cause.responsePhrase ?? cause.label }));
}

function conversationalFrames(text, earlierContext = "") {
  const combined = `${earlierContext} ${text}`.trim();
  return CONVERSATIONAL_FRAMES
    .filter((frame) => frame.re.test(text) || frame.re.test(combined))
    .map(({ type, phrase }) => ({ type, phrase }));
}

export function buildConversationResponsePlan({ originalEntry = "", userMessage = "", chatHistory = [], detectedEmotion = "", memoryEntries = [] } = {}) {
  const history = sanitiseConversationHistory(chatHistory, userMessage);
  const priorUserTexts = [originalEntry, ...history.filter((turn) => turn.role === "user").map((turn) => turn.text)].filter(Boolean);
  const latestFeatures = analyseText(userMessage);
  const shortTermVad = weightedConversationVAD([...priorUserTexts, userMessage]);
  const previousVad = weightedConversationVAD(priorUserTexts);
  const latestTokens = wordSet(userMessage);
  const priorTokens = wordSet(priorUserTexts.join(" "));
  const novelty = latestTokens.size ? clamp(1 - overlapRatio(latestTokens, priorTokens)) : 0;
  const affectShift = {
    valence: latestFeatures.vad.valence - previousVad.valence,
    arousal: latestFeatures.vad.arousal - previousVad.arousal,
    dominance: latestFeatures.vad.dominance - previousVad.dominance,
  };
  const intent = inferIntent(userMessage);
  const question = questionPolicy(intent, history, novelty, latestFeatures);
  const causes = [...causeFocus(latestFeatures)];
  // A correction often contains only a rejected label ("I'm not angry"),
  // not a fresh description of the event. Recover the concrete causes from
  // the user's own earlier words so the repair can say what was misunderstood
  // without treating the assistant's previous guess as evidence.
  if (intent === "correction") {
    for (const cause of causeFocus(analyseText(priorUserTexts.join(" ")))) {
      if (!causes.some((existing) => existing.type === cause.type)) causes.push(cause);
    }
  }
  for (const frame of conversationalFrames(userMessage, priorUserTexts.join(" "))) {
    if (!causes.some((cause) => cause.type === frame.type)) causes.push(frame);
  }
  const anchor = chooseAnchor(userMessage);
  const experienceProfile = buildExperienceProfile(latestFeatures, userMessage);
  const threadState = buildThreadState(originalEntry, history);
  const reflectionDepth = words(userMessage).length >= 14 || causes.length >= 2 ? "complex" : "simple";
  const memory = retrieveConversationMemories(
    [originalEntry, ...history.filter((turn) => turn.role === "user").map((turn) => turn.text), userMessage].join("\n"),
    memoryEntries,
  );
  const alpha = memory.influenceCap;
  const contextVad = Object.fromEntries(["valence", "arousal", "dominance"].map((axis) => [
    axis,
    (1 - alpha) * shortTermVad[axis] + alpha * memory.memoryVad[axis],
  ]));
  const types = new Set(causes.map((cause) => cause.type));
  const responseMove = intent === "correction"
    ? "repair-misattunement"
    : intent === "clarification-request"
      ? "clarify-own-meaning"
      : intent === "advice-request"
        ? "collaborative-next-step"
        : types.has("selfCriticism") || experienceProfile.dimensions.selfEvaluation >= 0.45
          ? "separate-event-from-self-judgment"
          : types.has("competingGoals") || experienceProfile.dimensions.ambivalence >= 0.4
            ? "reflect-both-sides"
            : experienceProfile.tensions.length
              ? "reflect-tension-and-meaning"
              : threadState.userTurnCount >= 6 && novelty < 0.4
                ? "synthesise-recurring-thread"
                : affectShift.valence > 0.2
                  ? "notice-shift-without-overclaiming"
                  : "specific-complex-reflection";

  return {
    version: CONVERSATION_MODEL_VERSION,
    intent,
    anchor,
    anchorTerms: [...latestTokens].slice(0, 12),
    causes: causes.slice(0, 4),
    detectedEmotion,
    latestVad: latestFeatures.vad,
    contextVad,
    shortTermVad,
    affectShift,
    novelty,
    reflectionDepth,
    responseMove,
    questionBudget: question.budget,
    questionReason: question.reason,
    adviceRequested: intent === "advice-request",
    repairNeeded: intent === "correction",
    clarificationNeeded: intent === "clarification-request",
    memory,
    history,
    promptHistory: history.slice(-MAX_PROMPT_TURNS),
    threadState,
    experienceProfile,
    latestFeatures,
  };
}

function focusQuestion(plan) {
  const types = new Set(plan.causes.map((cause) => cause.type));
  if (types.has("outcomeShortfall")) return "Was the harder part how the session went, or what it made you expect from yourself next time?";
  if (types.has("noRecovery") || types.has("roleSwitching")) return "Is the harder part the amount you have to do, or never getting to properly switch off?";
  if (types.has("overload")) return "Does the pressure come more from the amount being taught, or from not having time to absorb one thing before the next arrives?";
  if (types.has("workload") || types.has("urgency")) return "Which part feels most pressing right now?";
  if (types.has("transitionLoss")) return "What about that change feels hardest to return to?";
  if (types.has("activationResistance")) return "Is it the task itself or getting started that feels worse?";
  if (types.has("discomfort")) return "How much is that discomfort affecting the rest of it?";
  return "Which part of that feels most important to untangle?";
}

export function localConversationReply(plan) {
  const displayAnchor = String(plan.anchor ?? "").replace(/[?!.]+$/g, "");
  const quoted = displayAnchor ? `“${displayAnchor}”` : "what you just said";
  const types = new Set(plan.causes.map((cause) => cause.type));
  const phrases = plan.causes.map((cause) => cause.phrase).filter(Boolean).slice(0, 2);
  const causeText = phrases[0] ?? "";
  const layeredCause = phrases.length === 2
    ? `${phrases[0]} is being made heavier by ${phrases[1]}`
    : causeText
      ? `${causeText} is carrying much of the weight here`
      : "";
  if (plan.clarificationNeeded) {
    const clarified = types.has("noRecovery") && types.has("overload")
      ? "whether having no time to recover makes the amount being thrown at you even harder to absorb"
      : types.has("roleSwitching") && types.has("discomfort")
        ? "whether moving from one demand to the next feels harder because the environment is already draining"
        : phrases.length >= 2
          ? `whether ${phrases[0]} and ${phrases[1]} are feeding into each other`
      : phrases.length === 1
        ? `how ${phrases[0]} is affecting the rest of your day`
        : "which part of the situation is taking up the most mental space";
    return `I phrased that too vaguely. I meant ${clarified}; I wasn't asking you to produce a bigger explanation.`;
  }
  if (plan.repairNeeded) {
    if (types.has("outcomeShortfall") || types.has("effortfulExperience")) {
      return "I read an emotion into it that you did not say, and that was my mistake. The clearer point is that the experience was hard and did not go as well as you wanted, while you were still hoping the next one would be better.";
    }
    return layeredCause
      ? `I had the focus wrong before. This sounds more like ${layeredCause}.`
      : `I had the focus wrong before. What you mean is ${quoted}, and I’ll stay with that rather than my earlier reading.`;
  }
  if (plan.adviceRequested) {
    return `What you are trying to protect in ${quoted} should shape the next step. Name that first, then change one controllable part instead of treating the whole situation as all or nothing.`;
  }
  const question = plan.questionBudget ? ` ${focusQuestion(plan)}` : "";
  if (types.has("noRecovery") && types.has("overload")) {
    return `The school pressure seems to follow you beyond the actual work: there is so much to absorb that even rest does not feel like a real break.${question}`;
  }
  if (types.has("evaluationThreat") && types.has("interpersonalUnreliability")) {
    return `Depending on someone who keeps changing things leaves you unable to prepare in the way you need, which makes the possibility of letting the group down feel more immediate.${question}`;
  }
  if (types.has("selfCriticism") && (types.has("urgency") || types.has("workload"))) {
    return `The unfinished work is pressing now, but being hard on yourself about the time already gone is adding a second burden that cannot change the deadline.${question}`;
  }
  if (plan.experienceProfile.dimensions.unfairness >= 0.45) {
    const publicCost = plan.experienceProfile.dimensions.socialExposure >= 0.45
      ? " Having to defend yourself in front of other people adds a public cost to something you already see as unfair."
      : " Being made to carry consequences you do not believe are yours can turn the event into a question of trust and respect.";
    return `The unfairness in ${quoted} is central here.${publicCost}${question}`;
  }
  if (plan.experienceProfile.dimensions.connection <= -0.35 || types.has("socialDisconnection")) {
    return `The sting in ${quoted} seems tied less to missing one activity and more to not being considered or included.${question}`;
  }
  if (plan.responseMove === "separate-event-from-self-judgment") {
    return `You are describing something that went badly, but you are also starting to use that moment as evidence about yourself. Those are not the same claim, and the second one deserves a closer look.${question}`;
  }
  if (plan.responseMove === "reflect-both-sides") {
    const tension = plan.experienceProfile.tensions[0];
    return tension
      ? `When you say ${quoted}, I can see ${tension}. Neither side has to cancel the other before you can understand what matters to you.${question}`
      : `${quoted} shows you being pulled in two directions that both make sense from where you are standing. The conflict itself may be the part worth staying with.${question}`;
  }
  if (types.has("outcomeShortfall") && types.has("effortfulExperience")) {
    return `The difficulty of the session seems tied to the gap between how you wanted to perform and how you felt you actually did; that can make one rough attempt linger even when you are already looking toward the next one.${question}`;
  }
  if (types.has("outcomeShortfall")) {
    return `It seems the result mattered because it fell short of what you expected from yourself, not because the whole activity means nothing to you.${question}`;
  }
  if (layeredCause) return `${layeredCause.charAt(0).toUpperCase()}${layeredCause.slice(1)}.${question}`;
  return `${quoted} is the part you are trying to make sense of right now. I will stay with what you actually said instead of forcing it into a neat label.${question}`;
}

export function localInitialReflection(plan) {
  const types = new Set(plan.causes.map((cause) => cause.type));
  let reflection;
  if (types.has("outcomeShortfall") && types.has("effortfulExperience")) {
    reflection = types.has("futureHope")
      ? "The session seems disappointing because it was demanding and you did not feel you performed as well as you wanted, but hoping the next one goes better shows you have not written yourself off after one rough attempt."
      : "The session seems disappointing because the effort was high while your performance felt below what you expected from yourself.";
  } else if (types.has("outcomeShortfall")) {
    reflection = "What seems to sting is the gap between how you hoped it would go and how it actually felt in the moment.";
  } else if ((types.has("roleSwitching") || types.has("workload")) && types.has("discomfort")) {
    reflection = "Your day sounds like it leaves very little room to reset: one responsibility runs into the next, and the physical discomfort makes that pace harder to carry.";
  } else if (types.has("noRecovery") && types.has("overload")) {
    reflection = "The pressure seems to continue even when the work pauses, because there is still too much to hold in your head and no real sense of being off-duty.";
  } else if (plan.causes.length >= 2) {
    reflection = `There seems to be a tension between ${plan.causes[0].phrase} and ${plan.causes[1].phrase}, which leaves little room for you to settle before the next demand.`;
  } else if (plan.causes.length === 1) {
    reflection = `The important part may be ${plan.causes[0].phrase}, especially what that leaves you with once the immediate task is over.`;
  } else {
    reflection = `There seems to be more underneath “${plan.anchor}” than a single emotion label would capture.`;
  }
  const question = focusQuestion(plan);
  return `${reflection} ${question}`;
}

export function formatConversationResponsePlan(plan) {
  const delta = plan.affectShift;
  return `FOLLOW-UP RESPONSE PLAN (authoritative):
- Latest-turn intent: ${plan.intent}
- Concrete latest-turn anchor: ${plan.anchor || "none"}
- Explicit cause frames: ${plan.causes.length ? plan.causes.map((cause) => `${cause.type}=${cause.phrase}`).join("; ") : "none; do not invent one"}
- Context VAD: (${plan.contextVad.valence.toFixed(3)}, ${plan.contextVad.arousal.toFixed(3)}, ${plan.contextVad.dominance.toFixed(3)})
- Long-term memory influence: ${(plan.memory.influenceCap * 100).toFixed(0)}% (${plan.memory.memories.length} relevant memories retrieved)
- Latest-vs-prior shift: (${delta.valence.toFixed(3)}, ${delta.arousal.toFixed(3)}, ${delta.dominance.toFixed(3)})
- New-information ratio: ${plan.novelty.toFixed(2)}
- Reflection: ${plan.reflectionDepth}; reflect meaning/cause, not merely the user's words
- Response move: ${plan.responseMove}
- Current experience profile:
${formatExperienceProfile(plan.experienceProfile).split("\n").map((line) => `  ${line}`).join("\n")}
- Current-thread continuity: ${plan.threadState.userTurnCount} user turns; recurring frames ${plan.threadState.dominantFrames.map((item) => item.type).join(", ") || "none"}; rejected labels ${plan.threadState.rejectedEmotions.join(", ") || "none"}
- Question budget: ${plan.questionBudget} (${plan.questionReason})
- Advice requested: ${plan.adviceRequested ? "yes" : "no"}
- Repair needed: ${plan.repairNeeded ? "yes; explicitly correct the prior misunderstanding" : "no"}`;
}

export function validateConversationReply(text, plan) {
  const value = String(text ?? "").trim();
  const count = words(value).length;
  const questions = (value.match(/\?/g) ?? []).length;
  if (!value || count < 5 || count > 85) return { ok: false, reason: "length" };
  const styleTell = hasArtificialStyleTell(value);
  if (styleTell) return { ok: false, reason: styleTell };
  if (questions > plan.questionBudget) return { ok: false, reason: "question-budget" };
  if (/\b(?:tell me more|what else is on your mind|say more about that|i'?m here with you|i'?m listening)\b/i.test(value)) {
    return { ok: false, reason: "generic-follow-up" };
  }
  if (/\b(?:not simply|not just|rather than)\s+(?:sad|anxious|angry|happy|tired)|\byou sound\s+(?:sad|anxious|angry|depressed|frustrated)\b/i.test(value)) {
    return { ok: false, reason: "diagnostic-or-comparative-emotion-verdict" };
  }
  if (!plan.adviceRequested && /\b(?:you should|you need to|try to|have you tried|make sure you)\b/i.test(value)) {
    return { ok: false, reason: "unsolicited-advice" };
  }
  const responseTerms = wordSet(value);
  const grounded = plan.anchorTerms.some((term) => responseTerms.has(term)) || plan.causes.some((cause) => responseTerms.has(cause.type.toLowerCase()));
  if (!plan.clarificationNeeded && plan.anchorTerms.length >= 2 && !grounded) return { ok: false, reason: "missing-latest-turn-grounding" };
  return { ok: true, reason: null };
}

export function scoreConversationReply(text, plan) {
  const value = String(text ?? "").trim();
  const responseTerms = wordSet(value);
  const anchor = new Set(plan.anchorTerms);
  const grounding = clamp(overlapRatio(anchor, responseTerms));
  const reflection = /\b(?:sounds?|seems?|might|because|while|which makes|suggests?|partly|underneath|on top of|carrying)\b/i.test(value) ? 1 : 0.35;
  const priorAssistant = plan.history.filter((turn) => turn.role === "ai");
  const repetition = priorAssistant.length
    ? Math.max(...priorAssistant.map((turn) => overlapRatio(responseTerms, wordSet(turn.text))))
    : 0;
  const novelty = 1 - repetition;
  const questions = (value.match(/\?/g) ?? []).length;
  const questionFit = questions <= plan.questionBudget ? 1 : 0;
  const adviceFit = plan.adviceRequested || !/\b(?:you should|you need to|try to|have you tried|make sure you)\b/i.test(value) ? 1 : 0;
  const genericPenalty = /\b(?:tell me more|what else is on your mind|i'?m here with you|i'?m listening)\b/i.test(value) ? 0.45 : 0;
  const stylePenalty = hasArtificialStyleTell(value) ? 0.35 : 0;
  const score = clamp(0.35 * grounding + 0.20 * reflection + 0.18 * novelty + 0.15 * questionFit + 0.12 * adviceFit - genericPenalty - stylePenalty);
  return { score, grounding, reflection, novelty, questionFit, adviceFit, genericPenalty, stylePenalty };
}
