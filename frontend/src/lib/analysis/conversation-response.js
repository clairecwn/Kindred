/**
 * Turn-level context model for journal follow-up conversations.
 *
 * The language model writes the prose, but this module decides what the reply
 * needs to do.  Recent user turns receive exponentially more weight, new
 * information is measured against prior user language, and questions are
 * budgeted so the companion does not turn a reflection into an interview.
 */

import { analyseText } from "./text-features.js";
import { buildConversationMemoryBank, retrieveConversationMemories } from "./conversation-memory.js";
import { buildExperienceProfile, formatExperienceProfile } from "./experience-profile.js";
import { hasArtificialStyleTell, formalityPenalty, styleAlignmentPenalty } from "./companion-style.js";
import { isNarrowingQuestion, analyseEngagement } from "./conversation-guidance.js";
import { buildDiscourseModel, discourseThreadCoverage, formatDiscourseModel } from "./discourse-model.js";
import { buildConversationAgenda, formatConversationAgenda } from "./conversation-agenda.js";
import { buildConversationAffect } from "./conversation-affect.js";

export const CONVERSATION_MODEL_VERSION = "conversation-response-2026.10.3";
export const MAX_CONTEXT_TURNS = 80;
export const MAX_PROMPT_TURNS = 18;

const STOP_WORDS = new Set([
  "a", "about", "after", "again", "all", "also", "am", "an", "and", "are", "as", "at",
  "be", "because", "been", "before", "being", "but", "by", "can", "could", "did", "do",
  "does", "doing", "for", "from", "had", "has", "have", "he", "her", "here", "him", "his",
  "how", "i", "if", "in", "into", "is", "it", "its", "just", "like", "me", "more", "my", "of",
  "on", "or", "our", "really", "she", "so", "some", "than", "that", "the", "their", "them",
  "then", "there", "they", "this", "to", "too", "up", "very", "was", "we", "were", "what",
  "when", "where", "which", "who", "why", "will", "with", "would", "you", "your", "today", "tdy", "thing", "part", "out",
]);

const ADVICE_REQUEST = /\b(?:what should i|what do i do|what can i do|(?:i )?(?:don'?t know|idk) what to do|any advice|help me (?:decide|figure|with)|how (?:can|do|should) i|suggest(?:ion|ions)?|recommend)\b/i;
const EMOTION_WORD = "(?:angry|mad|furious|sad|upset|anxious|worried|happy|fine|tired|frustrated|jealous|scared)";
const CORRECTION = new RegExp(`\\b(?:no(?:[,!.]|\\s+(?:that|i|you|not|need))|not really|that'?s not|i didn'?t mean|what i mean|by .{1,24} i mean|you misunderstood|rather than|actually[, ]+(?:no|not|i mean|i (?:finished|didn'?t|don'?t|wasn'?t|am not)|now)|where got|why (?:you|u) say|what (?:are )?(?:you|u) saying|not\\s+(?:saying\\s+)?(?:i(?:'m| am)?\\s+)?${EMOTION_WORD})\\b`, "i");
const EMOTION_SEARCH = /\b(?:i don'?t know (?:how|what) i feel|can'?t tell how i feel|what am i feeling|confused about how i feel|mixed feelings?)\b/i;
const CLARIFICATION_REQUEST = /\b(?:wdym|wym|what do you mean|what does that mean|huh+|what (?:are )?(?:you|u) saying|meaning\?|affecting the rest of what|the rest of what)\b/i;
const DIRECT_QUESTION = /\b(?:are (?:you|u) (?:an? )?(?:ai|bot|deterministic)|(?:do|can) (?:you|u) understand me|(?:do|can) (?:you|u) remember|what (?:are|is) (?:you|this)\??$)\b/i;
const ACTION_LANGUAGE = /\b(?:i(?:'m| am)? going to|i will|i'?ll|i decided|my plan|first i(?:'ll| will)|need to start|gonna start)\b/i;
const CAUSAL_LANGUAGE = /\b(?:because|since|when|after|before|so that|which means|that'?s why|due to|but|although|even though)\b/i;
const UNEXPLAINED_EXPERIENCE = /\b(?:idk|idek|i don'?t know|not sure|no idea)\b.{0,65}\b(?:why|what|issue|happened|cause|reason)\b|\b(?:why|what)\b.{0,65}\b(?:idk|idek|i don'?t know|not sure)\b/i;

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
    .map((turn) => ({ role: turn?.role === "ai" ? "ai" : "user", text: String(turn?.text ?? "").trim(), replyTo: turn?.replyTo, isJournal: turn?.isJournal }))
    .filter((turn) => turn.text && !turn.isJournal);
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

function inferIntent(text, discourseModel, agenda) {
  if (agenda?.recallRequested) return "journal-recall-question";
  if (agenda?.explicitOther) return "other-topic-request";
  if (DIRECT_QUESTION.test(text)) return "direct-question";
  if (discourseModel?.groupingCorrection) return "grouping-correction";
  if (ADVICE_REQUEST.test(text)) return "advice-request";
  if (CORRECTION.test(text)) return "correction";
  if (CLARIFICATION_REQUEST.test(text)) return "clarification-request";
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

function questionPolicy(intent, history, novelty, latestFeatures, latestText = "") {
  const recentAssistant = history.filter((turn) => turn.role === "ai").slice(-2);
  const recentQuestions = recentAssistant.reduce((n, turn) => n + ((turn.text.match(/\?/g) ?? []).length > 0 ? 1 : 0), 0);
  if (intent === "advice-request") return { budget: 0, reason: "answer the request before asking anything" };
  if (intent === "direct-question") return { budget: 0, reason: "answer the user's question directly" };
  if (intent === "journal-recall-question") return { budget: 0, reason: "recall the journal topics directly" };
  if (intent === "other-topic-request") return { budget: 1, reason: "name the known other topic and invite one specific follow-up" };
  if (intent === "grouping-correction") return { budget: 0, reason: "accept the user's grouping and restate the structure clearly" };
  if (intent === "correction") return { budget: 0, reason: "repair the misunderstanding without interrogating" };
  if (intent === "clarification-request") return { budget: 0, reason: "clarify the companion's meaning directly" };
  if (UNEXPLAINED_EXPERIENCE.test(latestText)) return { budget: 0, reason: "offer a tentative angle instead of making the user explain what they do not know" };
  if (recentQuestions >= 2) return { budget: 0, reason: "two recent questions; contribute an insight and leave a conversational opening" };
  if (history.at(-1)?.role === "ai" && history.at(-1).text.includes("?")) {
    return words(latestText).length <= 5
      ? { budget: 1, reason: "brief answer: follow with one specific new angle, not a repeated question" }
      : { budget: 0, reason: "substantive answer: add an insight and a natural conversational opening before asking again" };
  }
  if (intent === "brief-disclosure" && novelty < 0.35) return { budget: 1, reason: "one focused clarification may help" };
  if ((latestFeatures.vadConfidence ?? 0) < 0.2) return { budget: 1, reason: "language evidence is sparse; check rather than assume" };
  return { budget: 1, reason: "one relevant follow-up can give the user an easy way to continue" };
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
  const discourseModel = buildDiscourseModel({ originalEntry, history, currentMessage: userMessage });
  const memoryBank = buildConversationMemoryBank(memoryEntries);
  const agenda = buildConversationAgenda({ originalEntry, history, currentMessage: userMessage, discourseModel, memoryEntries, memoryBank });
  const affect = buildConversationAffect({ originalEntry, history, currentMessage: userMessage, discourseModel, agenda });
  const shortTermVad = affect.overallVad;
  const latestTokens = wordSet(userMessage);
  const priorTokens = wordSet(priorUserTexts.join(" "));
  const novelty = latestTokens.size ? clamp(1 - overlapRatio(latestTokens, priorTokens)) : 0;
  const affectShift = affect.shift;
  const intent = inferIntent(userMessage, discourseModel, agenda);
  const baseQuestion = questionPolicy(intent, history, novelty, latestFeatures, userMessage);
  const question = ["bridge-to-unexplored-topic", "follow-requested-other-topic"].includes(agenda.move)
    && !["direct-question", "correction", "clarification-request", "advice-request"].includes(intent)
    ? { budget: 1, reason: "one specific invitation can open the next user-authored topic" }
    : baseQuestion;
  const lastAssistantAsked = history.at(-1)?.role === "ai" && history.at(-1).text.includes("?");
  const continuationRequired = question.budget > 0 && lastAssistantAsked && words(userMessage).length <= 5
    && !agenda.recallRequested && !agenda.explicitOther;
  const answerContext = lastAssistantAsked ? history.at(-1).text : "";
  const causes = [...causeFocus(latestFeatures)];
  // A correction or clarification often contains no fresh event detail.
  // Recover causes from the user's own earlier words so the reply can repair
  // or explain itself without treating an assistant guess as evidence.
  if (intent === "correction" || intent === "clarification-request") {
    const recoveryTexts = intent === "clarification-request"
      ? [...priorUserTexts].reverse()
      : [priorUserTexts.join(" ")];
    for (const contextText of recoveryTexts) {
      for (const cause of causeFocus(analyseText(contextText))) {
        if (!causes.some((existing) => existing.type === cause.type)) causes.push(cause);
      }
      if (causes.length >= 4) break;
    }
  }
  for (const frame of conversationalFrames(userMessage, priorUserTexts.join(" "))) {
    if (!causes.some((cause) => cause.type === frame.type)) causes.push(frame);
  }
  const anchor = chooseAnchor(userMessage);
  const experienceProfile = buildExperienceProfile(latestFeatures, userMessage);
  const threadState = buildThreadState(originalEntry, history);
  const reflectionDepth = words(userMessage).length >= 14 || causes.length >= 2 ? "complex" : "simple";
  const memoryQuery = agenda.focusEvidence && !["journal-recall-question", "direct-question"].includes(intent)
    ? [agenda.focusEvidence, userMessage].join("\n")
    : [originalEntry, ...history.filter((turn) => turn.role === "user").slice(-2).map((turn) => turn.text), userMessage].join("\n");
  const memory = retrieveConversationMemories(memoryQuery, memoryEntries, { bank: memoryBank });
  const alpha = memory.influenceCap;
  const focusReading = affect.focusVad;
  const focusWeight = ["bridge-to-unexplored-topic", "follow-requested-other-topic", "develop-linked-topics"].includes(agenda.move) ? 0.75 : 0.45;
  const currentFocusVad = Object.fromEntries(["valence", "arousal", "dominance"].map((axis) => [
    axis,
    (1 - focusWeight) * shortTermVad[axis] + focusWeight * focusReading[axis],
  ]));
  const contextVad = Object.fromEntries(["valence", "arousal", "dominance"].map((axis) => [
    axis,
    (1 - alpha) * currentFocusVad[axis] + alpha * memory.memoryVad[axis],
  ]));
  const types = new Set(causes.map((cause) => cause.type));
  const recentUserTexts = history.filter((turn) => turn.role === "user").slice(-2).map((turn) => turn.text);
  const unresolvedUncertainty = UNEXPLAINED_EXPERIENCE.test(userMessage)
    || (agenda.isBackchannel && recentUserTexts.some((text) => UNEXPLAINED_EXPERIENCE.test(text)));
  const responseMove = intent === "grouping-correction"
    ? "accept-user-grouping"
    : intent === "journal-recall-question"
    ? "recall-all-user-topics"
    : agenda.move === "follow-requested-other-topic"
    ? "name-and-develop-other-topic"
    : agenda.move === "bridge-to-unexplored-topic"
    ? "bridge-to-unexplored-topic"
    : agenda.move === "develop-linked-topics"
    ? "develop-linked-topics"
    : unresolvedUncertainty
    ? "offer-tentative-possibilities"
    : agenda.move === "carry-conversation-forward"
    ? "contribute-without-repeating"
    : intent === "direct-question"
    ? "answer-directly"
    : intent === "correction"
    ? "repair-misattunement"
    : intent === "clarification-request"
      ? discourseModel.academicLeisureConflict ? "clarify-thread-relationship" : "clarify-own-meaning"
      : intent === "advice-request"
        ? "collaborative-next-step"
        : types.has("selfCriticism") || experienceProfile.dimensions.selfEvaluation >= 0.45
          ? "separate-event-from-self-judgment"
          : types.has("competingGoals") || experienceProfile.dimensions.ambivalence >= 0.4
            ? "reflect-both-sides"
            : discourseModel.academicLeisureConflict
              ? "reflect-distinct-thread-conflict"
            : experienceProfile.tensions.length
              ? "reflect-tension-and-meaning"
              : threadState.userTurnCount >= 6 && novelty < 0.4
                ? "synthesise-recurring-thread"
                : affectShift.valence > 0.2
                  ? "notice-shift-without-overclaiming"
                  : "specific-complex-reflection";

  return {
    version: CONVERSATION_MODEL_VERSION,
    currentMessage: userMessage,
    intent,
    anchor,
    anchorTerms: [...latestTokens].slice(0, 12),
    causes: causes.slice(0, 4),
    detectedEmotion,
    latestVad: latestFeatures.vad,
    contextVad,
    shortTermVad,
    affect,
    affectShift,
    novelty,
    reflectionDepth,
    responseMove,
    questionBudget: question.budget,
    questionReason: question.reason,
    continuationRequired,
    answerContext,
    adviceRequested: intent === "advice-request",
    repairNeeded: intent === "correction",
    clarificationNeeded: intent === "clarification-request",
    memory,
    history,
    promptHistory: history.slice(-MAX_PROMPT_TURNS),
    threadState,
    discourseModel,
    agenda,
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
  const latest = String(plan.latestFeatures?.originalText ?? plan.history?.at(-1)?.text ?? "");
  const current = String(plan.currentMessage ?? latest);
  if (plan.intent === "direct-question") {
    if (/understand me/i.test(current)) return "I understand that you are hot and uncomfortable, glad about your computing score, and still uneasy about yesterday's paper. I missed that mix when I kept asking about the heat. I don't know more than you've told me, but I can follow what you mean better than I did.";
    if (/remember/i.test(current)) return "I can use this journal and our chat while we talk, plus relevant saved entries. I got sidetracked by the heat earlier and missed the good score and the worry about yesterday's paper.";
    return "I'm an AI. The app uses rule-based scores to help read context, and an AI model normally writes my replies. Earlier I missed the mix of good news and worry in what you shared.";
  }
  const displayAnchor = String(plan.anchor ?? "").replace(/[?!.]+$/g, "");
  const quoted = displayAnchor ? `“${displayAnchor}”` : "what you just said";
  const types = new Set(plan.causes.map((cause) => cause.type));
  const phrases = plan.causes.map((cause) => cause.phrase).filter(Boolean).slice(0, 2);
  const causeText = phrases[0] ?? "";
  const layeredCause = phrases.length === 2
    ? `${phrases[0]} seems to connect with ${phrases[1]}`
    : causeText
      ? `${causeText} seems to be on your mind`
      : "";
  const academic = plan.discourseModel?.threads?.find((thread) => thread.id === "academic");
  const leisure = plan.discourseModel?.threads?.find((thread) => thread.id === "leisure");
  const timeOff = plan.discourseModel?.threads?.find((thread) => thread.id === "timeOff");
  const currentThreadIds = new Set(plan.discourseModel?.currentThreadIds ?? []);
  const isRepairTurn = ["grouping-correction", "correction", "clarification-request"].includes(plan.intent);
  const hasStudyLeisureConflict = Boolean(
    academic
    && leisure
    && plan.discourseModel?.academicLeisureConflict
    && (isRepairTurn || (currentThreadIds.has("academic") && currentThreadIds.has("leisure"))),
  );

  if (plan.intent === "grouping-correction" && hasStudyLeisureConflict) {
    return `Yes, the midterms and catching up belong together as one study pressure. The other part is wanting to enjoy the little holiday time left, but feeling bored by the options in Singapore. So the dilemma is studying all day versus going out without having anything you actually feel excited to do.`;
  }
  if (plan.clarificationNeeded) {
    if (/\b(?:affecting the rest of what|the rest of what)\b/i.test(current)) {
      return "I meant the rest of your day, but that was a weird leap. You said it's really hot; I should have left it there instead of making it sound like a bigger issue.";
    }
    if (hasStudyLeisureConflict) {
      return `I mean the midterms and catching up are one study problem. The separate part is that you want to enjoy the last couple of holiday days, but the options in Singapore feel boring. That leaves you choosing between studying all day and going out without anything you are keen to do.`;
    }
    const clarified = types.has("noRecovery") && types.has("overload")
      ? "whether having no time to recover makes the amount being thrown at you even harder to absorb"
      : types.has("workload")
        ? "there are two different problems that can get tangled together: not knowing which task to start first, and having more work than feels manageable"
      : types.has("roleSwitching") && types.has("discomfort")
        ? "whether moving from one demand to the next feels harder because the environment is already draining"
        : phrases.length >= 2
          ? `whether ${phrases[0]} and ${phrases[1]} are feeding into each other`
      : phrases.length === 1
        ? `how ${phrases[0]} is affecting the rest of your day`
        : "which part of the situation is taking up the most mental space";
    return `Sorry, I was vague. I meant ${clarified}.`;
  }
  if (plan.repairNeeded) {
    if (hasStudyLeisureConflict) {
      return "Got it. Midterms and catching up are the same study pressure. The separate frustration is wanting to use the last holiday days well when the things to do in Singapore feel boring. Neither studying all day nor forcing an outing sounds like the break you want.";
    }
    if (types.has("outcomeShortfall") || types.has("effortfulExperience")) {
      return "I read an emotion into it that you did not say, and that was my mistake. The clearer point is that the experience was hard and did not go as well as you wanted, while you were still hoping the next one would be better.";
    }
    return layeredCause
      ? `I had the focus wrong before. This sounds more like ${layeredCause}.`
      : `I had the focus wrong before. What you mean is ${quoted}, and I’ll stay with that rather than my earlier reading.`;
  }
  if (plan.adviceRequested) {
    if (types.has("workload") || types.has("urgency")) {
      return "The pile of work is landing as one undivided problem, which makes choosing a starting point harder. Put the tasks in deadline order and choose one small first action for the nearest one; the aim is to create a start, not solve the whole pile at once.";
    }
    return `What you are trying to protect in ${quoted} should shape the next step. Name that first, then change one controllable part instead of treating the whole situation as all or nothing.`;
  }
  const question = plan.questionBudget ? ` ${focusQuestion(plan)}` : "";
  if (types.has("noRecovery") && types.has("overload")) {
    return `The school pressure seems to follow you beyond the actual work: there is so much to absorb that even rest does not feel like a real break.${question}`;
  }
  if (hasStudyLeisureConflict) {
    return `${academic.summary.charAt(0).toUpperCase()}${academic.summary.slice(1)} is one side of this. The other is ${leisure.summary}${timeOff ? ` while ${timeOff.summary}` : ""}; the pressure comes from both options taking something you care about.${question}`;
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
  if (types.has("discomfort") && /\b(?:hot|humid|sweat)/i.test(current)) return "Yeah, that heat sounds miserable. Hard to enjoy the good news when you're sweating through the day, and the paper from yesterday is still on your mind.";
  if (layeredCause) return `${layeredCause.charAt(0).toUpperCase()}${layeredCause.slice(1)}.${question}`;
  return `That detail about ${displayAnchor} seems important to what happened.${question}`;
}

export function localInitialReflection(plan) {
  const entry = String(plan.currentMessage ?? "");
  if (/\b(?:hot|humid|sweat)/i.test(entry) && /\b(?:score|mark|grade|result)/i.test(entry) && /\b(?:test|exam|paper)/i.test(entry)) {
    return "The computing score is good news, yay. The heat sounds awful though, and yesterday's paper is still hanging over you. Is it more that you keep replaying an answer, or that you're waiting to find out how it went?";
  }
  const types = new Set(plan.causes.map((cause) => cause.type));
  const dimensions = plan.experienceProfile?.dimensions ?? {};
  let reflection;
  const academic = plan.discourseModel?.threads?.find((thread) => thread.id === "academic");
  const leisure = plan.discourseModel?.threads?.find((thread) => thread.id === "leisure");
  const timeOff = plan.discourseModel?.threads?.find((thread) => thread.id === "timeOff");
  const weather = plan.discourseModel?.threads?.find((thread) => thread.id === "weather");
  const achievement = plan.discourseModel?.threads?.find((thread) => thread.id === "achievement");
  if (academic && leisure && plan.discourseModel?.academicLeisureConflict) {
    const opening = achievement
      ? "You still got meaningful work done"
      : "You are trying to keep up with what needs doing";
    const conditions = weather ? " despite the draining weather" : "";
    const breakContext = timeOff ? ` while ${timeOff.summary}` : "";
    return `${opening}${conditions}. Now the midterms and catching up are pulling you toward studying, while you also want the last couple of holiday days to feel enjoyable and cannot find much in Singapore that sounds fun. If you protected one part of those two days, would it be feeling more prepared or having one proper break?`;
  }
  if (dimensions.achievement >= 0.45 && dimensions.selfEvaluation >= 0.45) {
    reflection = types.has("discomfort") || types.has("effortfulExperience")
      ? "There is real progress in what you wrote, but the physical strain and pressure to do better are making it hard to let that progress count. When does wanting to improve start turning into feeling that nothing you do is enough?"
      : "You can see that you improved, yet the demand to be better is making the progress difficult to take in. What would change if the improvement were allowed to count before you set the next target?";
    return reflection;
  }
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
  if (plan.semantic) return `RESPONSE CONSTRAINTS:
- Question budget: ${plan.questionBudget}; meaningful opening required: ${plan.continuationRequired}
- Chat-updated VAD: ${JSON.stringify(plan.contextVad)} (uncertain tone guidance, not a diagnosis)
- Relevant memories: ${plan.memory.memories.length}; bounded affect influence: ${plan.memory.influenceCap}
- User-rejected labels: ${plan.threadState.rejectedEmotions.join(", ") || "none"}
- Follow the semantic agenda for topic selection and the latest user meaning.`;
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
- Multi-thread discourse map:
${formatDiscourseModel(plan.discourseModel).split("\n").map((line) => `  ${line}`).join("\n")}
- Conversation agenda (internal only; never recite scores or labels):
${formatConversationAgenda(plan.agenda).split("\n").map((line) => `  ${line}`).join("\n")}
- Question budget: ${plan.questionBudget} (${plan.questionReason})
- Continuation: ${plan.continuationRequired ? "brief answer: add a specific, easy invitation grounded in the conversation" : "contribute a new angle; leave room to reply without repeating or interviewing"}
- Answered companion question: ${plan.answerContext ? plan.answerContext.slice(0, 200) : "none"}
- Advice requested: ${plan.adviceRequested ? "yes" : "no"}
- Repair needed: ${plan.repairNeeded ? "yes; explicitly correct the prior misunderstanding" : "no"}`;
}

/** Keep the first model-written question when it has joined a second
 * request behind one question mark. Revalidate the remaining prose. */
export function simplifyStackedQuestion(text) {
  return String(text ?? '').replace(/,?\s+and (?:is there|what|how|why|would you|do you|are you)\b[^?]*\?/i, '?').trim();
}

export function validateConversationReply(text, plan) {
  const value = String(text ?? "").trim().replace(/[’‘]/g, "'");
  const count = words(value).length;
  // Tag questions ("huh?", "right?", "no?") are rhetorical and ask nothing,
  // so they don't spend the question budget.
  const questions = (value.replace(/[,\s]+(?:huh|right|no|ya|yeah|eh|isn'?t it|is it|lah|leh|sia|ah|or not)\s*\?/gi, '.').match(/\?/g) ?? []).length;
  if (!value || value.split(/\s+/).length < 4 || count > (plan.semantic?.transitioning ? 110 : 85)) return { ok: false, reason: "length" };
  if (/\b(?:forcing it into a neat label|produce a bigger explanation|carrying much of the weight here|part you are trying to make sense of)\b/i.test(value)) return { ok: false, reason: "canned-meta-language" };
  if (plan.intent === "direct-question" && !/\b(?:ai|model|rules|understand|remember|missed|sorry)\b/i.test(value)) return { ok: false, reason: "did-not-answer-direct-question" };
  const styleTell = hasArtificialStyleTell(value);
  if (styleTell) return { ok: false, reason: styleTell };
  const turnCue = plan.engagementCue ?? analyseEngagement(plan.history ?? [], plan.currentMessage);
  if (!plan.adviceRequested && /\b(?:what(?:'s| is) (?:the )?(?:one|a) (?:small|tiny|little|low.key) (?:comfort|thing|reset)|what(?:'s| is) the vibe|mental cue|signal (?:you(?:'re| are) )?okay to pause|sip of water|slow breaths?|quick stretch)\b/i.test(value)) {
    return { ok: false, reason: 'low-value-comfort-or-meta-question' };
  }
  // On a fresh multi-part entry the policy already has a topic agenda. Asking
  // the user to rank a menu of incidents hands that work back to them and
  // tends to miss the feeling or obligation that ties the entry together.
  if (questions && !plan.history.some(turn => turn.role === 'ai')
    && (/\bout of (?:all|everything)\b.{0,105}\bwhich\b.{0,70}\b(?:moment|part|thing|incident|bit)\b|\bwhich\b.{0,70}\b(?:moment|incident)\b.{0,65}\b(?:hardest|worst|most|biggest|hit|bothered|affected)\b/i.test(value)
      || (plan.debriefState && /\b(?:what|which)\s+(?:part|moment|thing|bit)\b.{0,85}\b(?:feel(?:s|t)?\s+(?:the\s+)?|is\s+(?:the\s+)?)?(?:heaviest|hardest|worst|biggest|most\s+(?:important|overwhelming|upsetting))\b/i.test(value)))) {
    return { ok: false, reason: 'outsources-journal-priority-to-user' };
  }
  // A question about getting back to an obligation can be a productivity
  // prompt even when it omits "step" or "task". This catches the move, not
  // any particular journal incident or subject.
  if (!plan.adviceRequested && questions && /\b(?:before|so you can|to help you)\b.{0,75}\b(?:get back to|dive back into|return to|start|tackle|revise|study|work on)\b/i.test(value)
    && /\b(?:what|how|which|could|would)\b/i.test(value)) {
    return { ok: false, reason: 'unrequested-task-readiness-question' };
  }
  if (turnCue.plannedActivity && /\b(?:how(?:'s| is| was) it feeling after|how (?:did|does) (?:the|that) .{0,30} (?:feel|help)|now that you(?:'ve| have)|since you(?:'ve| have)|you(?:'ve| have) (?:already )?(?:done|started|had|tried|[a-z]+ed))\b/i.test(value)) {
    return { ok: false, reason: 'treats-future-plan-as-completed' };
  }
  if ((turnCue.repeatedChoice || turnCue.temporalCorrection || turnCue.confusion)
    && /\b(?:it'?s not even about|it'?s just the|maybe that pause itself|tiny win|notice how)\b/i.test(value)) {
    return { ok: false, reason: 'reinterprets-user-correction' };
  }
  if ((turnCue.plannedActivity || turnCue.repeatedChoice || turnCue.temporalCorrection || turnCue.confusion)
    && plan.debriefState?.action !== 'SHIFT' && words(plan.currentMessage).length <= 8) {
    const recent = wordSet([plan.currentMessage, ...(plan.history ?? []).filter(turn => turn.role === 'user').slice(-2).map(turn => turn.text)].join(' '));
    const journalEarlier = String(plan.originalEntry ?? '').slice(0, Math.floor(String(plan.originalEntry ?? '').length * .7));
    const oldDetails = [...wordSet(journalEarlier)].filter(word => !recent.has(word));
    const replyTerms = wordSet(value);
    const repeatedDetails = oldDetails.filter(word => replyTerms.has(word));
    if (repeatedDetails.length >= 4) return { ok: false, reason: 'recaps-journal-instead-of-answering' };
  }
  if (/\p{Extended_Pictographic}/u.test(value)
    && !/\p{Extended_Pictographic}/u.test([plan.originalEntry, plan.currentMessage,
      ...plan.history.filter(turn => turn.role === 'user').slice(-4).map(turn => turn.text)].join(' '))) {
    return { ok: false, reason: 'unmatched-emoji' };
  }
  if (plan.debriefState?.action === 'SOFT_CLOSE' && /\?/.test(value)) return { ok: false, reason: 'landing-demands-answer' };
  if (plan.debriefState?.action === 'SOFT_CLOSE' && !plan.adviceRequested && /\b(?:how to|tips|tweak|fix|solution|quick reset|next step)\b/i.test(value)) return { ok: false, reason: 'landing-pivots-to-advice' };
  const userEvidence = [plan.originalEntry, plan.currentMessage, ...plan.history.filter(turn => turn.role === 'user').map(turn => turn.text)].join(' ');
  if (/\b(?:arguing|fighting|fight|had an argument|in conflict)\b/i.test(value)
    && !/\b(?:argu(?:e|ed|ing|ment)|fight(?:ing)?|conflict)\b/i.test(userEvidence)) {
    return { ok: false, reason: 'invented-interpersonal-conflict' };
  }
  const ungroundedBodyClaims = [/(?:heart[- ]pounding|heart (?:still )?racing)/i, /\badrenaline\b/i,
    /\bpanic mode\b/i, /\bbody (?:is |was |still |finally )?(?:shaking|vibrating|trembling)\b/i,
    /\bfeel(?:ing)? (?:a bit )?hollow\b/i];
  if (ungroundedBodyClaims.some(pattern => pattern.test(value) && !pattern.test(userEvidence))) {
    return { ok: false, reason: 'invented-physical-or-internal-state' };
  }
  if (/\b(?:tomorrow|next week|what if)\b/i.test(value) && !/\b(?:tomorrow|next week|what if)\b/i.test(userEvidence)
    && /\b(?:you'?ll|maybe|kept you|stuck in|loop of)\b/i.test(value)) return { ok: false, reason: 'unsupported-future-or-thought-narrative' };
  if (plan.debriefState?.topics?.some(topic => topic.id === plan.debriefState.focusIds?.[0] && topic.incidental)) return { ok: false, reason: 'incidental-detail-selected-as-focus' };
  if ((plan.answerLimitReached || plan.debriefState?.questionPressure?.answerLimitReached)
    && !plan.adviceRequested && isNarrowingQuestion(value)) return { ok: false, reason: 'narrowing-after-user-already-answered-globally' };
  if (plan.semantic && !['SHIFT', 'SUMMARISE', 'SOFT_CLOSE'].includes(plan.debriefState?.action)) {
    const recentUser = [plan.currentMessage, ...plan.history.filter(turn => turn.role === 'user').slice(-2).map(turn => turn.text)].join(' ');
    const recentWords = wordSet(recentUser);
    const focusWords = wordSet(plan.agenda?.focusEvidence ?? '');
    const replyWords = wordSet(value);
    const focusIds = new Set(plan.debriefState?.focusIds ?? []);
    const linkedIds = new Set((plan.semantic.links ?? []).filter(link => link.support === 'explicit'
      && (focusIds.has(link.from) || focusIds.has(link.to))).flatMap(link => [link.from, link.to]));
    const journalWords = words(plan.originalEntry ?? '');
    for (const topic of plan.semantic.topics) {
      if (!['context'].includes(topic.facet) || focusIds.has(topic.id) || linkedIds.has(topic.id)) continue;
      const quote = topic.evidence.filter(item => item.source === 'journal').map(item => item.quote).join(' ');
      const distinctive = words(quote).filter(word => !recentWords.has(word) && !focusWords.has(word)
        && journalWords.filter(item => item === word).length <= 2);
      if (distinctive.some(word => replyWords.has(word))) return { ok: false, reason: 'unprompted-callback-to-unrelated-journal-incident' };
    }
  }
  if (questions > plan.questionBudget) return { ok: false, reason: "question-budget" };
  if (plan.continuationRequired && questions === 0) return { ok: false, reason: "reply-closes-after-brief-answer" };
  if (plan.semantic?.transitioning && !/\n\s*\n/.test(value)) return { ok: false, reason: "missing-topic-transition-takeaway-and-bridge" };
  const priorQuestions = plan.history.filter(turn => turn.role === 'ai').flatMap(turn => turn.text.match(/[^.!?]*\?/g) ?? []);
  const nextQuestions = value.match(/[^.!?]*\?/g) ?? [];
  if (plan.semantic && nextQuestions.some(next => priorQuestions.some(prior => words(next).length >= 3 && overlapRatio(wordSet(next), wordSet(prior)) > .65))) {
    return { ok: false, reason: 'reasks-earlier-question-use-known-answer-or-change-action' };
  }
  const previousReplies = plan.history.filter(turn => turn.role === "ai").slice(-3);
  if (plan.semantic && words(value).length >= 8 && previousReplies.some(turn => overlapRatio(wordSet(value), wordSet(turn.text)) > 0.78)) {
    return { ok: false, reason: "repeats-recent-reply-without-progress" };
  }
  if (/\b(?:tell me more|what else is on your mind|say more about that|i'?m here with you|i'?m listening|how did (?:that|it) hit you)\b/i.test(value)) {
    return { ok: false, reason: "generic-follow-up" };
  }
  if (/\bwhat(?:'s| is) still on your mind from (?:today|the day)\b/i.test(value)) {
    return { ok: false, reason: "generic-follow-up" };
  }
  if (/\bwhat(?:'s| is) (?:the )?one thing (?:that'?s|that is)? ?still (?:weighing on|bothering) you\b/i.test(value)) {
    return { ok: false, reason: "generic-follow-up" };
  }
  if (!/\b(?:can wait|could wait|no deadline|not due)\b/i.test(userEvidence)
    && /\b(?:the rest|the work|work|the deadline|your deadline) can wait\b/i.test(value)) {
    return { ok: false, reason: "unsupported-deadline-reassurance" };
  }
  if (/\b(?:you(?:'re| are) safe|you(?:'re| are) finally safe)\b/i.test(value)
    && !/\b(?:safe|unsafe|danger|scared|threat)\b/i.test(userEvidence)) {
    return { ok: false, reason: "unsupported-safety-assurance" };
  }
  if (/\b(?:not simply|not just|rather than)\s+(?:sad|anxious|angry|happy|tired)|\byou sound\s+(?:sad|anxious|angry|depressed|frustrated)\b/i.test(value)) {
    return { ok: false, reason: "diagnostic-or-comparative-emotion-verdict" };
  }
  if (plan.semantic && !plan.adviceRequested && /\b(?:does (?:that|it) feel doable|would (?:that|it) feel doable|are you up for (?:trying|doing)|could you (?:start|try|write|do)|maybe (?:try|start|write|sketch|pick|make)|(?:try|start|write|sketch|pick) (?:a|the|one|just|with))\b/i.test(value)) {
    return { ok: false, reason: "unrequested-task-coaching" };
  }
  if (plan.semantic && !plan.adviceRequested && /\b(?:(?:what(?:\'s| is) (?:the |one )?(?:smallest|tiniest|first) (?:thing|step|part|piece))|do you have (?:any|a|the) (?:parts?|pieces?|outlines?|drafts?|notes?)|could you (?:flesh|write|draft|finish|tackle|start|work)|what (?:can|could) you (?:finish|write|draft|do)|how much (?:have you|could you) (?:done|write|finish)|(?:before you rest|right now)\?)\b/i.test(value)) {
    return { ok: false, reason: "unrequested-task-progress-question" };
  }
  if (!plan.adviceRequested && /\?/.test(value)
    && /\b(?:easiest|smallest|tiniest|first|quickest|one small|one tiny|knock out|finish|complete|start)\b/i.test(value)
    && /\b(?:task|piece|part|step|slides?|deck|assignment|work|question|chapter|draft|report|project)\b/i.test(value)) {
    return { ok: false, reason: "unrequested-task-breakdown" };
  }
  if (!plan.adviceRequested && /\b(?:you should|you need to|try to|have you tried|make sure you|give yourself|take a (?:tiny |small |short )?break|pick one (?:small |tiny )?(?:piece|step)|start by)\b/i.test(value)) {
    return { ok: false, reason: "unsolicited-advice" };
  }
  // Structural advice: a sentence that opens with an instruction, or a
  // step-down plan. The model reaches for these with study/work stress.
  if (!plan.adviceRequested && (/(?:^|[.!?…]\s+)(?:just\s+|maybe\s+)?(?:think about|try|take (?:a|an|some|it easy|time|breaks?)|start|make|focus on|break|set|write|pick|grab|plan|schedule|remember to|go for|treat it)\b/i.test(value)
    || /\b(?:small win|tiny chunk|one tiny (?:thing|step|chunk|piece)|first page|bite-?sized|baby steps?|one step at a time|break it (?:down|into)|chip away)\b/i.test(value))) {
    return { ok: false, reason: "unsolicited-advice" };
  }
  if (!plan.adviceRequested && /\b(?:give (?:that|it) a try|maybe (?:a quick|you could|u could)|(?:you|u) could (?:just )?(?:start|try|do|ask|text|message|tell|send|drop|ping|split|set|make|go)|why not (?:just )?(?:start|try|ask|text|do)|maybe (?:just )?(?:tell|try|ask|text|start|set|go|talk|study|take|block|focus)\b|(?:just|try (?:to)?) (?:tell (?:her|him|them|ur|your)|set a timer)|spend a few minutes|jot a (?:quick )?note|keep an eye on|see how the vibe shifts)\b/i.test(value)) {
    return { ok: false, reason: "unsolicited-advice" };
  }
  if (plan.semantic && /\b(?:tired|exhausted|drained|stressed|stressful|overwhelmed|worried|hard|difficult)\b/i.test(plan.currentMessage)
    && /\bwhat (?:feels|is) (?:the )?(?:most )?(?:draining|stressful|hard|difficult|overwhelming|worrying) (?:about|for)\b/i.test(value)) {
    return { ok: false, reason: "asks-user-to-restate-known-feeling" };
  }
  if (plan.semantic && /\bhow does .{3,90} (?:shape|change) what .{3,90} means to you\b/i.test(value)) {
    return { ok: false, reason: "abstract-unsupported-cross-topic-link" };
  }
  if (/\bdid .{3,100} feel like (?:a|an|the) (?:reminder|sign|signal|symbol)\b/i.test(value)) {
    return { ok: false, reason: "leading-interpretive-question" };
  }
  if (plan.semantic && !plan.adviceRequested
    && /\b(?:hard|difficult|stressed|stressful|tired|exhausted|drained|overwhelmed|lazy|don'?t want|not in the mood)\b/i.test(plan.currentMessage)
    && /\b(?:what|which) (?:part|bit|piece|aspect) of (?:it|that|the\b)/i.test(value)) {
    return { ok: false, reason: "narrowing-task-difficulty-instead-of-processing" };
  }
  if (plan.semantic && !plan.adviceRequested && /\b(?:which|what(?:\'s| is)?) (?:the )?(?:(?:most|hardest|trickiest|toughest) )?(?:part|bit|piece|aspect|thing)\b.{0,70}\b(?:hard|hardest|tricky|trickiest|tough|toughest|challenging|confusing|unclear|stuck)\b|\bwhat (?:feels|is) (?:the )?(?:hardest|most challenging|most confusing)\b/i.test(value)) {
    return { ok: false, reason: "generic-task-probe-after-expressed-difficulty" };
  }
  if (!plan.adviceRequested && /\b(?:what(?:'s| is) one (?:small |easy )?step|what would (?:help|make|shift).{0,70}(?:next time|back to|usual flow)|what (?:can|could) you (?:do|try).{0,50}next time)\b/i.test(value)) {
    return { ok: false, reason: "premature-solution-question" };
  }
  if (!plan.adviceRequested && /\bwhat(?:'s| is) one (?:\w+[ -]){0,4}(?:thing|way) you (?:could|can) do\b/i.test(value)) {
    return { ok: false, reason: "premature-solution-question" };
  }
  if (!plan.adviceRequested && /\b(?:anything|something) you(?:'d| would) like to (?:try|do)|\bwhat (?:would|could) you (?:try|do) (?:about|to fix)\b/i.test(value)) {
    return { ok: false, reason: "premature-solution-question" };
  }
  if (plan.semantic && !plan.adviceRequested && /\?/.test(value)
    && /\bif you could (?:have )?(?:change|turn|make)|\bwhat would have made\b/i.test(value)) {
    return { ok: false, reason: "unrequested-hypothetical-remedy" };
  }
  if (plan.semantic && /\b(?:where do you feel (?:it|that)|tight spot|what does (?:that|the) .{0,35} feel like for you)\b/i.test(value)
    && !/\b(?:body|chest|stomach|muscle|physical sensation)\b/i.test(plan.currentMessage)) {
    return { ok: false, reason: "unrequested-somatic-or-abstract-probe" };
  }
  if (plan.semantic && /\?/.test(value) && /,?\s+and (?:is there|what|how|why|would you|do you|are you)\b/i.test(value)) {
    return { ok: false, reason: "stacked-questions" };
  }
  if (["bridge-to-unexplored-topic", "follow-requested-other-topic"].includes(plan.agenda?.move)) {
    if (/\b(?:what(?:'s| is| was) (?:the )?(?:other|second) (?:part|thing|topic)|what (?:else|other part) (?:do you|would you) (?:want|like)|what(?:'s| is) the other part you(?:'d| would) like)\b/i.test(value)) {
      return { ok: false, reason: "asked-user-to-repeat-known-topic" };
    }
    if (plan.agenda.focusEvidence && overlapRatio(wordSet(value), wordSet(plan.agenda.focusEvidence)) < 0.05) {
      return { ok: false, reason: "did-not-name-next-topic" };
    }
  }
  if (plan.agenda?.recallRequested && plan.agenda.topics.length > 1) {
    const recalled = plan.agenda.topics.filter((topic) => overlapRatio(wordSet(value), wordSet(topic.evidence)) >= 0.05);
    if (recalled.length < 2) return { ok: false, reason: "incomplete-journal-recall" };
  }
  const currentThreadIds = new Set(plan.discourseModel?.currentThreadIds ?? []);
  const repairTurn = ["grouping-correction", "correction", "clarification-request"].includes(plan.intent);
  // The turn-level policy may deliberately focus on one side of a conflict.
  // Only the older entry-only path lacks a selected focus and needs this gate.
  const requiresConflictCoverage = !plan.semantic && !plan.debriefState && plan.discourseModel?.academicLeisureConflict
    && (repairTurn || (currentThreadIds.has("academic") && currentThreadIds.has("leisure")));
  if (requiresConflictCoverage) {
    const coverage = discourseThreadCoverage(value, plan.discourseModel, 2);
    if (coverage.required.length >= 2 && coverage.ratio < 1) return { ok: false, reason: "dropped-active-thread" };
  }
  if (plan.debriefState && formalityPenalty(value, plan.voice) >= .45) return { ok: false, reason: 'style-too-formal-for-user' };
  if (plan.debriefState && styleAlignmentPenalty(value, plan.voice) >= .5) return { ok: false, reason: 'voice-drift-from-user' };
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
  const adviceFit = plan.adviceRequested || !/\b(?:you should|you need to|try to|have you tried|make sure you|give yourself|take a (?:tiny |small |short )?break|pick one (?:small |tiny )?(?:piece|step)|start by)\b/i.test(value) ? 1 : 0;
  const genericPenalty = /\b(?:tell me more|what else is on your mind|i'?m here with you|i'?m listening)\b/i.test(value) ? 0.45 : 0;
  const stylePenalty = (hasArtificialStyleTell(value) ? 0.35 : 0) + formalityPenalty(value, plan.voice) + styleAlignmentPenalty(value, plan.voice);
  const threadCoverage = discourseThreadCoverage(value, plan.discourseModel, 2).ratio;
  const score = clamp(0.28 * grounding + 0.18 * reflection + 0.16 * novelty + 0.13 * questionFit + 0.10 * adviceFit + 0.15 * threadCoverage - genericPenalty - stylePenalty);
  return { score, grounding, reflection, novelty, questionFit, adviceFit, threadCoverage, genericPenalty, stylePenalty };
}
