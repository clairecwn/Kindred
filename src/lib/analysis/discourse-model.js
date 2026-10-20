/**
 * Multi-thread discourse model for journals and follow-up chat.
 *
 * A journal entry is not one bag of emotion words. It can contain several
 * discourse units, each with its own topic, goal and appraisal, plus relations
 * such as contrast, cause, elaboration and correction. This module keeps those
 * threads separate and records how the user groups them.
 */

export const DISCOURSE_MODEL_VERSION = "discourse-threads-2026.10.3";

const CONCEPTS = Object.freeze([
  {
    id: "energy",
    label: "energy level during the day",
    patterns: [/\b(?:low energy|not (?:a lot of|much) energy|no energy|drained|exhausted|tired|low fuel)\b/i],
    responseTerms: ["energy", "drained", "tired", "exhausted", "fuel"],
  },
  {
    id: "socialMeal",
    label: "a meal or catch-up with someone close",
    patterns: [/\b(?:dinner|lunch|meal|supper)\s+(?:with|together)\b/i, /\b(?:bestie|best friend).{0,70}\b(?:yap|talk|dinner|fun)\b|\b(?:yap|talk|dinner|fun).{0,70}\b(?:bestie|best friend)\b/i],
    responseTerms: ["dinner", "lunch", "meal", "bestie", "friend", "yapped", "talked", "fun"],
  },
  {
    id: "liveEvent",
    label: "a live event the user wants to attend",
    patterns: [
      /\b(?:concert|gig|festival|show|performance|tickets?|ticketing|presale|ticket drop)\b/i,
      /\b(?:biggest fan|longtime fan|sell(?:s|ing)? out|sold out|buy (?:them|it)|ticket release)\b/i,
    ],
    responseTerms: ["concert", "ticket", "tickets", "presale", "fan", "show", "release", "sold", "buy"],
  },
  {
    id: "socialOuting",
    label: "how a social outing felt",
    patterns: [
      /\b(?:shopping(?: with| together)?|out with|met up with|hung out with|spent time with|saw my friend)\b/i,
      /\b(?:convo|conversation|vibes?|awkward|wavelength|in sync|connect(?:ion)?|flow(?:ing)?|gossip|stories)\b|\b(?:talk|chat)(?:ing)?\s+(?:with|to)\s+\w+\b|\b(?:spill|share|tell)\s+(?:the\s+)?tea\b/i,
    ],
    responseTerms: ["shopping", "friend", "convo", "conversation", "talk", "chat", "vibe", "vibes", "awkward", "wavelength", "connection", "flow", "gossip", "tea", "stories"],
  },
  {
    id: "academic",
    label: "study pressure",
    patterns: [
      /\b(?:midterms?|exams?|tests?|quizzes?|lectures?|lecturers?|tutorials?|classes?|school|coursework|homework|assignments?|revision)\b/i,
      /\b(?:study|studying|revise|revising|catch(?:ing)? up|fall(?:ing)? behind)\b/i,
    ],
    responseTerms: ["study", "studying", "midterm", "midterms", "exam", "exams", "lecture", "lectures", "catch", "behind", "school", "revision"],
  },
  {
    id: "leisure",
    label: "enjoyable free time",
    patterns: [
      /\b(?:go(?:ing)? out|outing|hang out|have fun|fun|enjoy|explore|activities|activity|things? to do)\b/i,
      /\b(?:bored|boring|nothing (?:to )?do|nth (?:to )?do|no activities|no options?)\b/i,
    ],
    responseTerms: ["out", "outing", "fun", "enjoy", "activity", "activities", "boring", "bored", "options", "holiday", "holidays", "break"],
  },
  {
    id: "timeOff",
    label: "the remaining break",
    patterns: [/\b(?:holiday|holidays|hols|break|weekend|time off|last (?:day|days)|final (?:day|days))\b/i],
    responseTerms: ["holiday", "holidays", "break", "weekend", "days", "time"],
  },
  {
    id: "weather",
    label: "physical discomfort from the weather",
    patterns: [/\b(?:weather|hot|humid|heat|sweltering|stuffy|sweaty)\b/i],
    responseTerms: ["weather", "hot", "humid", "heat", "physical", "draining"],
  },
  {
    id: "achievement",
    label: "what the user managed to complete",
    patterns: [/\b(?:got .{0,25} done|finished|completed|productive|accomplished|achieved|made progress)\b/i],
    responseTerms: ["done", "finished", "completed", "productive", "progress", "managed"],
  },
  {
    id: "paidWork",
    label: "paid-work demands",
    patterns: [/\b(?:job|shift|office|boss|colleague|client|paid work|go work|at work)\b/i],
    responseTerms: ["job", "shift", "office", "work", "boss", "client"],
  },
  {
    id: "relationships",
    label: "a relationship or social concern",
    patterns: [/\b(?:friend|bestie|bf|boyfriend|girlfriend|partner|family|parent|teammate|classmate|left out|ignored|argument|conflict|lonely|alone)\b/i],
    responseTerms: ["friend", "partner", "family", "teammate", "left", "ignored", "alone", "relationship"],
  },
]);

const SHORTFORM_NORMALISATIONS = Object.freeze([
  [/\btdy\b/gi, "today"],
  [/\bsg\b/gi, "singapore"],
  [/\bnth\b/gi, "nothing"],
  [/\biw\b/gi, "i want"],
  [/\bidw\b/gi, "i do not want"],
  [/\bcoz\b|\bcuz\b|\bbc\b/gi, "because"],
  [/\bhols\b/gi, "holidays"],
]);

const DESIRE = /\b(?:want|wish|hope|would like|feel like|i want)\b/i;
const OBLIGATION = /\b(?:need|must|have to|gotta|supposed to|cannot fall behind)\b/i;
const BLOCKAGE = /\b(?:nothing|none|no |cannot|can'?t|boring|bored|limited|stuck|dilemma|fall behind|too much|so much)\b/i;
const GROUPING_CORRECTION = /\b(?:they|those|these|both|it'?s|its)\b.{0,28}\b(?:same thing|the same|basically one|all just)\b|\b(?:same thing|basically)\b.{0,35}\b(?:study|studying|work(?:ing)?)\b/i;
const REPAIR_CHALLENGE = /\b(?:wdym|wym|huh+|what (?:are )?(?:you|u) saying|that makes no sense|i don'?t get it|i do not get it)\b/i;

function normalize(text) {
  let value = String(text ?? "").toLowerCase();
  for (const [pattern, replacement] of SHORTFORM_NORMALISATIONS) value = value.replace(pattern, replacement);
  return value.replace(/\s+/g, " ").trim();
}

function contentWords(text) {
  const stop = new Set(["about", "after", "also", "and", "because", "been", "but", "can", "fact", "for", "from", "got", "have", "like", "much", "need", "really", "since", "that", "the", "then", "there", "they", "this", "very", "want", "with"]);
  return (normalize(text).match(/[a-z0-9']+/g) ?? []).filter((word) => word.length > 2 && !stop.has(word));
}

function segmentTurn(text) {
  const normalized = normalize(text);
  if (!normalized) return [];
  const boundary = /[.!?;]+|\b(but|however|although|though|while|whereas|also|and|because)\b|(?=\b(?:need to|need start|want to|want go|have to)\b)/gi;
  const units = [];
  let start = 0;
  let relation = "continuation";
  let match;
  while ((match = boundary.exec(normalized)) !== null) {
    const textBefore = normalized.slice(start, match.index).trim();
    if (textBefore) units.push({ text: textBefore, relation });
    const marker = String(match[1] ?? match[0]).toLowerCase();
    relation = /but|however|although|though|while|whereas/.test(marker)
      ? "contrast"
      : marker === "because"
        ? "cause"
        : /and|also/.test(marker)
          ? "addition"
          : "continuation";
    start = match.index + match[0].length;
    if (match[0].length === 0) boundary.lastIndex += 1;
  }
  const tail = normalized.slice(start).trim();
  if (tail) units.push({ text: tail, relation });
  return units.filter((unit) => contentWords(unit.text).length > 0);
}

function conceptScores(text) {
  return CONCEPTS.map((concept) => ({
    ...concept,
    score: concept.patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0),
  })).filter((concept) => concept.score > 0);
}

function dynamicThreadId(unit) {
  return contentWords(unit.text).slice(0, 2).join("-") || "uncategorised";
}

function summariseThread(thread) {
  const text = thread.mentions.map((mention) => mention.text).join(" ");
  switch (thread.id) {
    case "academic":
      if (/midterm|exam|test/.test(text) && /catch|lecture|behind/.test(text)) return "preparing for assessments and catching up so you do not fall behind";
      if (/catch|behind/.test(text)) return "catching up with studying so you do not fall behind";
      return "keeping up with studying and academic demands";
    case "leisure":
      if (thread.desired && thread.blocked) return "wanting enjoyable time out while the available activities feel limited or boring";
      if (thread.blocked) return "finding the available leisure options unappealing or limited";
      return "wanting time for fun, activities or going out";
    case "timeOff": return "having only a little of the break left";
    case "weather": return "dealing with draining heat or uncomfortable weather";
    case "achievement": return "recognising that you still managed to get meaningful work done";
    case "paidWork": return "handling demands from paid work";
    case "relationships": return "making sense of a relationship or social concern";
    case "liveEvent": return "looking forward to an event and hoping to get tickets";
    case "socialOuting": return "making sense of how a social outing and conversation felt";
    case "energy": return "having less energy than usual during the day";
    case "socialMeal": return "enjoying a meal and conversation with someone close";
    default: return thread.mentions.at(-1)?.text ?? thread.label;
  }
}

export function buildDiscourseModel({ originalEntry = "", history = [], currentMessage = "" } = {}) {
  const priorUserTurns = (Array.isArray(history) ? history : []).filter((turn) => turn?.role === "user").map((turn) => String(turn.text ?? ""));
  const userTurns = [originalEntry, ...priorUserTurns, currentMessage].filter((text) => String(text).trim());
  const threads = new Map();
  const relations = [];
  const currentThreadIds = new Set();

  userTurns.forEach((turnText, turnIndex) => {
    const age = userTurns.length - 1 - turnIndex;
    const recency = Math.exp(-0.32 * age);
    const units = segmentTurn(turnText);
    let previousConcepts = [];
    units.forEach((unit, unitIndex) => {
      const foundConcepts = conceptScores(unit.text);
      let concepts = foundConcepts.some((concept) => ["socialOuting", "socialMeal"].includes(concept.id))
        ? foundConcepts.filter((concept) => !["relationships", "leisure"].includes(concept.id))
        : foundConcepts;
      if (!concepts.length && previousConcepts.length && /\b(?:it|one|them|those|that|this)\b/i.test(unit.text)) concepts = previousConcepts;
      const assigned = concepts.length ? concepts : [{ id: dynamicThreadId(unit), label: "user-defined topic", score: 0.55, responseTerms: contentWords(unit.text).slice(0, 8) }];
      previousConcepts = concepts;
      for (const concept of assigned) {
        if (turnIndex === userTurns.length - 1) currentThreadIds.add(concept.id);
        const existing = threads.get(concept.id) ?? {
          id: concept.id,
          label: concept.label,
          responseTerms: concept.responseTerms,
          weight: 0,
          mentions: [],
          desired: false,
          obligated: false,
          blocked: false,
          latestTurn: -1,
        };
        existing.weight += recency * concept.score;
        existing.mentions.push({ text: unit.text, relation: unit.relation, turnIndex, unitIndex });
        existing.desired ||= DESIRE.test(unit.text);
        existing.obligated ||= OBLIGATION.test(unit.text);
        existing.blocked ||= BLOCKAGE.test(unit.text);
        existing.latestTurn = Math.max(existing.latestTurn, turnIndex);
        threads.set(concept.id, existing);
      }
      if (unit.relation !== "continuation" && unitIndex > 0) {
        relations.push({ type: unit.relation, turnIndex, from: units[unitIndex - 1].text, to: unit.text });
      }
    });
  });

  const ranked = [...threads.values()]
    .map((thread) => ({ ...thread, summary: summariseThread(thread) }))
    .sort((a, b) => b.weight - a.weight || b.latestTurn - a.latestTurn || a.id.localeCompare(b.id));
  const byId = Object.fromEntries(ranked.map((thread) => [thread.id, thread]));
  const academicLeisureConflict = Boolean(byId.academic && byId.leisure && (
    byId.academic.obligated || byId.academic.blocked || byId.leisure.desired || relations.some((relation) => relation.type === "contrast")
  ));
  if (academicLeisureConflict) {
    relations.push({ type: "goal-conflict", from: "academic", to: "leisure" });
  }

  const current = normalize(currentMessage);
  const groupingCorrection = GROUPING_CORRECTION.test(current);
  const repairChallenge = REPAIR_CHALLENGE.test(current);
  const mergedThread = groupingCorrection
    ? (conceptScores(current).find((concept) => concept.id === "academic" || concept.id === "paidWork")?.id ?? null)
    : null;

  return {
    version: DISCOURSE_MODEL_VERSION,
    threads: ranked.slice(0, 8),
    activeThreads: ranked.filter((thread) => thread.latestTurn >= Math.max(0, userTurns.length - 2)).slice(0, 5),
    relations,
    academicLeisureConflict,
    groupingCorrection,
    mergedThread,
    repairChallenge,
    currentThreadIds: [...currentThreadIds],
    userTurnCount: userTurns.length,
  };
}

export function formatDiscourseModel(model) {
  if (!model?.threads?.length) return "no reliable discourse threads";
  return [
    `threads: ${model.threads.map((thread) => `${thread.id}=[${thread.summary}]`).join("; ")}`,
    `relations: ${model.relations.map((relation) => `${relation.type}:${relation.from}->${relation.to}`).join("; ") || "none"}`,
    `user grouping correction: ${model.groupingCorrection ? `yes${model.mergedThread ? `; merge into ${model.mergedThread}` : ""}` : "no"}`,
    `repair challenge: ${model.repairChallenge ? "yes" : "no"}`,
  ].join("\n");
}

export function discourseThreadCoverage(text, model, limit = 2) {
  const words = new Set(contentWords(text));
  const required = (model?.activeThreads ?? []).filter((thread) => !["weather", "achievement", "timeOff"].includes(thread.id)).slice(0, limit);
  const covered = required.filter((thread) => thread.responseTerms.some((term) => words.has(term)));
  return { required, covered, ratio: required.length ? covered.length / required.length : 1 };
}
