/**
 * Deterministic topic priority for a journal conversation. The model writes
 * the reply; this ledger only tracks user-authored concerns and turn history.
 */

import { analyseText } from "./text-features.js";
import { retrieveConversationMemories } from "./conversation-memory.js";

export const CONVERSATION_AGENDA_VERSION = "conversation-agenda-2026.10.6-turn-state";

const BACKCHANNEL = /^(?:yeah+|yep+|ya+|yaya+|mh+m+|mm+|okay+|ok+|sure+|right+|maybee+|yay+|lol+|haha+)[!?.\s]*$/i;
const OTHER_TOPIC = /\b(?:the other part|(?:talk|discuss|go) (?:about|to) another (?:part|thing)|second (?:thing|part|topic)|not (?:the )?only thing|not related to (?:that|tickets?)|something else (?:i mentioned|from my entry))\b/i;
const RECALL = /\b(?:what (?:do|did) you remember|what was (?:my|the) (?:journal )?entry about|summari[sz]e (?:my|the) (?:journal )?entry)\b/i;
const REPAIR_TURN = /\b(?:wdym|wym|what do you mean|what are you saying|affecting the rest of what|the rest of what|you misunderstood|are you ai|do you understand me)\b/i;
const UNCERTAINTY = /\b(?:idk|i don'?t know|not sure|unsure|couldn'?t|couldnt|awkward|weird|off|bumm?|worried|uneasy|hope|must|want|wish)\b/i;
const TIME_PRESSURE = /\b(?:deadline|due (?:today|tomorrow|soon)|before (?:it|they) sell out|tickets?.{0,80}(?:coming out|release|sell out)|(?:coming out|release|sell out).{0,80}tickets?)\b/i;
const IGNORE = new Set(["about", "after", "again", "also", "and", "are", "been", "but", "can", "could", "did", "does", "dont", "for", "from", "get", "got", "have", "here", "how", "its", "just", "like", "more", "much", "not", "really", "said", "that", "the", "their", "them", "there", "they", "this", "today", "tdy", "very", "was", "were", "what", "when", "which", "with", "would", "you", "your", "yeah", "yaya", "mhmm", "okay", "part", "thing"]);

function terms(text) {
  return new Set((String(text ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? [])
    .map((word) => word.endsWith("s") && word.length > 4 ? word.slice(0, -1) : word)
    .filter((word) => word.length > 2 && !IGNORE.has(word)));
}

function intersectCount(a, b) {
  let count = 0;
  for (const value of a) if (b.has(value)) count += 1;
  return count;
}

function topicTerms(thread) {
  const firstTurn = thread.mentions[0]?.turnIndex ?? 0;
  const evidence = thread.mentions.filter((mention) => mention.turnIndex === firstTurn).map((mention) => mention.text).join(" ");
  return new Set([...terms(evidence), ...terms(thread.responseTerms.join(" "))]);
}

function isSubstantive(text) {
  return terms(text).size >= 2 && !BACKCHANNEL.test(String(text).trim()) && !OTHER_TOPIC.test(text) && !RECALL.test(text);
}

function textMatchesThread(text, thread, topicTokens) {
  const tokens = terms(text);
  if (!tokens.size) return false;
  const overlap = intersectCount(tokens, topicTokens);
  return overlap >= (thread.label === "user-defined topic" && tokens.size >= 4 ? 2 : 1);
}

function threadEvidence(thread) {
  const firstTurn = thread.mentions[0]?.turnIndex ?? 0;
  const entry = thread.mentions.filter((mention) => mention.turnIndex === firstTurn).map((mention) => mention.text).join("; ");
  const followUps = thread.mentions.filter((mention) => mention.turnIndex > firstTurn).slice(-2).map((mention) => mention.text).join("; ");
  return [entry, followUps].filter(Boolean).join(" | ").slice(0, 340);
}

const clamp = (value) => Math.max(0, Math.min(1, value));
const sigmoid = (value) => 1 / (1 + Math.exp(-value));

function normalisePriorities(topics) {
  const max = Math.max(...topics.map((topic) => topic.score));
  const weights = topics.map((topic) => Math.exp((topic.score - max) / 0.45));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  topics.forEach((topic, index) => { topic.priorityProbability = weights[index] / total; });
}

function relationProbability(a, b, discourseModel) {
  let evidence = 0;
  const reasons = [];
  for (const relation of discourseModel?.relations ?? []) {
    if (!["cause", "contrast"].includes(relation.type)) continue;
    const forward = textMatchesThread(relation.from, a.thread, a.tokens) && textMatchesThread(relation.to, b.thread, b.tokens);
    const backward = textMatchesThread(relation.from, b.thread, b.tokens) && textMatchesThread(relation.to, a.thread, a.tokens);
    if (forward || backward) { evidence += relation.type === "cause" ? 3.2 : 2.9; reasons.push(relation.type); }
    else if (relation.type === "cause") {
      const aFrom = textMatchesThread(relation.from, a.thread, a.tokens);
      const bFrom = textMatchesThread(relation.from, b.thread, b.tokens);
      const aTo = textMatchesThread(relation.to, a.thread, a.tokens);
      const bTo = textMatchesThread(relation.to, b.thread, b.tokens);
      if ((aFrom && !bTo && intersectCount(terms(relation.to), b.tokens) >= 1)
        || (bFrom && !aTo && intersectCount(terms(relation.to), a.tokens) >= 1)) {
        evidence += 3.0;
        reasons.push("cause-with-shared-detail");
      }
    }
  }
  const allRelations = discourseModel?.relations ?? [];
  for (let i = 0; i < allRelations.length - 1; i += 1) {
    const cause = allRelations[i];
    const continuation = allRelations[i + 1];
    if (cause.type !== "cause" || continuation.type !== "addition" || cause.turnIndex !== continuation.turnIndex
      || cause.to !== continuation.from) continue;
    if ((textMatchesThread(cause.from, a.thread, a.tokens) && textMatchesThread(continuation.to, b.thread, b.tokens))
      || (textMatchesThread(cause.from, b.thread, b.tokens) && textMatchesThread(continuation.to, a.thread, a.tokens))) {
      evidence += 3;
      reasons.push("connected-causal-clause");
    }
  }
  const shared = intersectCount(a.tokens, b.tokens);
  if (shared >= 2) { evidence += Math.min(0.8, shared * 0.25); reasons.push("shared-details"); }
  // Co-mention alone (including "also") is not a meaningful relationship.
  return { probability: Number(sigmoid(-2.2 + evidence).toFixed(3)), reasons };
}

export function buildConversationAgenda({ originalEntry = "", history = [], currentMessage = "", discourseModel, memoryEntries = [], memoryBank } = {}) {
  const priorUser = history.filter((turn) => turn.role === "user").map((turn) => turn.text);
  const currentTurnIndex = (originalEntry ? 1 : 0) + priorUser.length;
  const threads = (discourseModel?.threads ?? []).filter((thread) => {
    const first = thread.mentions[0];
    if (thread.label === "user-defined topic" && first?.turnIndex === 0 && terms(first.text).size <= 2) return false;
    if (first?.turnIndex === currentTurnIndex && thread.label === "user-defined topic"
      && terms(first.text).size <= 4 && /\b(?:it|that|this)\b/i.test(first.text)) return false;
    return first && (first.turnIndex === 0 || (isSubstantive(first.text) && (thread.label !== "user-defined topic" || terms(first.text).size >= 3)));
  });
  const latest = String(currentMessage ?? "").trim();
  const isBackchannel = BACKCHANNEL.test(latest);
  const explicitOther = OTHER_TOPIC.test(latest);
  const recallRequested = RECALL.test(latest);
  const latestSubstantive = isSubstantive(latest);

  const ranked = threads.map((thread) => {
    const tokens = topicTerms(thread);
    const evidence = threadEvidence(thread);
    const firstTurn = thread.mentions[0]?.turnIndex ?? 0;
    const original = thread.mentions.filter((mention) => mention.turnIndex === firstTurn).map((mention) => mention.text).join(" ");
    const reading = analyseText(original);
    const uncertainty = UNCERTAINTY.test(original) ? 1 : 0;
    const timePressure = TIME_PRESSURE.test(original) ? 1 : 0;
    const affect = Math.min(1, Math.abs(reading.vad?.valence ?? 0) + Math.abs(reading.vad?.arousal ?? 0) * 0.3);
    const remembered = memoryEntries.length
      ? retrieveConversationMemories(evidence, memoryEntries, { limit: 1, bank: memoryBank }).memories[0]
      : null;
    const memoryScore = remembered ? Math.min(0.12, remembered.score * 0.25) : 0;
    const base = 0.35 + Math.min(0.2, original.length / 600) + 0.27 * uncertainty + 0.25 * timePressure + 0.18 * affect + memoryScore;
    return {
      id: thread.id,
      label: thread.label,
      summary: thread.summary,
      evidence,
      score: base,
      base,
      engagedTurns: 0,
      assistantTurns: 0,
      latestMatch: false,
      recentUserEvidence: 0,
      coverage: 0,
      openNeed: 0.7,
      memoryScore,
      memoryId: remembered?.id ?? null,
      introducedAt: firstTurn,
      uncertainty,
      timePressure,
      tokens,
      thread,
    };
  });
  const turns = [...(originalEntry ? [{ role: "user", text: originalEntry, entry: true }] : []), ...history, { role: "user", text: latest }];
  let previousFocusId = [...ranked].sort((a, b) => b.base - a.base || a.id.localeCompare(b.id))[0]?.id ?? null;
  const trace = [];
  let priorFocusId = previousFocusId;
  turns.forEach((turn, index) => {
    const text = String(turn.text ?? "");
    const entry = Boolean(turn.entry);
    const substantive = isSubstantive(text);
    const literalMatches = ranked.filter((topic) => textMatchesThread(text, topic.thread, topic.tokens));
    const matches = turn.role === "ai" && !literalMatches.length && previousFocusId
      ? ranked.filter((topic) => topic.id === previousFocusId)
      : literalMatches;
    ranked.forEach((topic) => {
      topic.recentUserEvidence *= 0.78;
      const matched = matches.some((match) => match.id === topic.id);
      if (entry) return;
      if (turn.role === "user" && substantive && matched) {
        topic.engagedTurns += 1;
        topic.recentUserEvidence = Math.min(2, topic.recentUserEvidence + (matches.length === 1 ? 1 : 0.7));
        topic.openNeed = clamp(topic.openNeed + 0.13);
      } else if (turn.role === "ai" && matched) {
        topic.assistantTurns += 1;
        topic.coverage = clamp(topic.coverage + 0.36);
        topic.openNeed = clamp(topic.openNeed - 0.17);
      }
      if (turn.role === "user" && !substantive && topic.id === previousFocusId) {
        // Acknowledgement is weak evidence: it does not independently close or switch a topic.
        topic.recentUserEvidence = Math.min(2, topic.recentUserEvidence + 0.05);
      }
    });
    if (index === turns.length - 1) priorFocusId = previousFocusId;
    if (!entry && turn.role === "user" && substantive && matches.length === 1) previousFocusId = matches[0].id;
    trace.push({ turn: index, role: turn.role, matchedTopicIds: matches.map((match) => match.id), focusId: previousFocusId });
  });
  ranked.forEach((topic) => {
    topic.latestMatch = latestSubstantive && textMatchesThread(latest, topic.thread, topic.tokens);
    topic.score = topic.base + 0.72 * topic.openNeed + 0.6 * topic.recentUserEvidence
      - 0.9 * topic.coverage - 0.5 * topic.engagedTurns + (topic.latestMatch ? 1.2 : 0)
      + (topic.id === priorFocusId ? 0.12 : 0);
  });
  normalisePriorities(ranked);
  const byPriority = [...ranked].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const previousFocus = ranked.find((topic) => topic.id === priorFocusId) ?? byPriority[0] ?? null;
  const latestFocus = ranked.filter((topic) => topic.latestMatch).sort((a, b) => b.score - a.score)[0] ?? null;
  const alternate = byPriority.find((topic) => topic.id !== previousFocus?.id && topic.engagedTurns === 0) ?? null;
  const strongestOther = byPriority.find((topic) => topic.id !== previousFocus?.id) ?? null;

  let focus = latestFocus ?? previousFocus;
  let move = "develop-current-topic";
  if (recallRequested) {
    move = "recall-all-topics";
  } else if (explicitOther && alternate) {
    focus = alternate;
    move = "follow-requested-other-topic";
  } else if (latestFocus && latestFocus.id !== previousFocus?.id) {
    move = "follow-new-or-returned-topic";
  } else if (!REPAIR_TURN.test(latest) && !latestFocus && alternate && previousFocus?.assistantTurns >= 2
    && alternate.score > previousFocus.score + 0.08) {
    focus = alternate;
    move = "bridge-to-unexplored-topic";
  } else if (!REPAIR_TURN.test(latest) && !latestFocus && strongestOther && previousFocus?.assistantTurns >= 2
    && strongestOther.score > previousFocus.score + 0.35) {
    focus = strongestOther;
    move = strongestOther.engagedTurns === 0 ? "bridge-to-unexplored-topic" : "follow-new-or-returned-topic";
  } else if (isBackchannel) {
    move = "carry-conversation-forward";
  }

  const relations = [];
  for (let i = 0; i < ranked.length; i += 1) for (let j = i + 1; j < ranked.length; j += 1) {
    const relation = relationProbability(ranked[i], ranked[j], discourseModel);
    relations.push({ topicIds: [ranked[i].id, ranked[j].id], ...relation });
  }
  const linked = relations.find((relation) => relation.probability >= 0.68 && relation.topicIds.includes(focus?.id)
    && relation.topicIds.some((id) => ranked.find((topic) => topic.id === id)?.recentUserEvidence >= 0.35));
  const linkedId = linked?.topicIds.find((id) => id !== focus?.id);
  if (linkedId && !recallRequested && !explicitOther) move = "develop-linked-topics";

  return {
    version: CONVERSATION_AGENDA_VERSION,
    focusId: focus?.id ?? null,
    focusSummary: focus?.summary ?? "",
    focusEvidence: focus?.evidence ?? "",
    focusIds: linkedId ? [focus.id, linkedId] : focus ? [focus.id] : [],
    nextId: ranked.filter((thread) => thread.id !== focus?.id && thread.engagedTurns === 0).sort((a, b) => b.score - a.score)[0]?.id ?? null,
    move,
    isBackchannel,
    explicitOther,
    recallRequested,
    relations,
    trace,
    topics: byPriority.map(({ tokens, thread, ...topic }) => ({ ...topic, score: Number(topic.score.toFixed(3)), priorityProbability: Number(topic.priorityProbability.toFixed(3)) })),
  };
}

export function formatConversationAgenda(agenda) {
  if (!agenda?.topics?.length) return "No reliable topic ledger; respond to the latest user turn.";
  const topics = agenda.topics.map((topic) => `${topic.id}: ${topic.summary}; user follow-ups ${topic.engagedTurns}; assistant turns ${topic.assistantTurns}; relative priority ${topic.priorityProbability.toFixed(2)}; open need ${topic.openNeed.toFixed(2)}; coverage ${topic.coverage.toFixed(2)}; entry evidence: ${topic.evidence.slice(0, 220)}`).join("\n");
  const linked = agenda.relations.filter((relation) => relation.probability >= 0.68).map((relation) => `${relation.topicIds.join("+")}: ${relation.probability.toFixed(2)} (${relation.reasons.join(", ")})`).join("; ");
  return `Focus: ${agenda.focusIds.join("+") || "none"}; move: ${agenda.move}; next unexplored: ${agenda.nextId ?? "none"}; linked: ${linked || "none"}\n${topics}`;
}
