/** Conversation policy. Scores rank conversational needs, not people or diagnoses.
 * Values are bounded heuristics; relativePriority is a softmax over current topics,
 * not a calibrated probability of what the user feels. */
import { analyseQuestionPressure, analyseEngagement } from './conversation-guidance.js';
export const DIALOGUE_ACTIONS = Object.freeze(['VALIDATE', 'REFLECT', 'EXPLORE', 'DEEPEN', 'SHIFT', 'SUMMARISE', 'REPAIR', 'SOFT_CLOSE']);
const clamp = n => Math.max(0, Math.min(1, Number.isFinite(Number(n)) ? Number(n) : 0));
const rating = value => value === 'high' ? 1 : value === 'medium' ? .55 : value === 'low' ? .15 : clamp(value);
const same = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

export function updateDebriefState(semantic, previous = {}, latest = '', history = [], directQuestion = /\?\s*$/.test(String(latest))) {
  const old = new Map((previous.topics ?? []).map(topic => [topic.id, topic]));
  const userTurns = history.filter(turn => turn.role === 'user').length + 1;
  const assistantTurns = history.filter(turn => turn.role === 'ai').length;
  const latestWords = String(latest).trim().split(/\s+/).filter(Boolean).length;
  const previousUser = [...history].reverse().find(turn => turn.role === 'user' && !turn.isJournal);
  const previousUserWords = String(previousUser?.text ?? '').trim().split(/\s+/).filter(Boolean).length;
  const recentQuestions = history.filter(turn => turn.role === 'ai').slice(-4).reduce((sum, turn) => sum + (String(turn.text).match(/\?/g) ?? []).length, 0);
  const questionPressure = analyseQuestionPressure(history, latest);
  const engagementCue = analyseEngagement(history, latest);
  const priorUserCount = history.filter(turn => turn.role === 'user').length;
  const topics = semantic.topics.map(topic => {
    const before = old.get(topic.id) ?? {};
    const latestEvidence = topic.evidence.some(item => item.source === 'latest');
    const emotion = rating(topic.emotionalIntensity ?? topic.importance);
    const hasChatExploration = topic.evidence.some(item => item.source.startsWith('user-')
      || (item.source === 'latest' && latestWords > 3 && topic.engagement !== 'acknowledging'));
    // The journal introduces a topic; only subsequent substantive user turns
    // can deepen it. An assessor must not count assistant paraphrases as work
    // the user has done in the conversation.
    const depthObserved = hasChatExploration
      ? ({ untouched: 0, surface: .35, developed: .75 }[topic.coverage] ?? 0)
      : Math.min(.2, ({ untouched: 0, surface: .35, developed: .75 }[topic.coverage] ?? 0));
    const userExplored = hasChatExploration || before.userExplored === true;
    const depth = userExplored ? Math.max(clamp(before.explorationDepth), depthObserved) : depthObserved;
    const unresolvedness = topic.state === 'declined' ? 0 : topic.state === 'settled' ? .1 : rating(topic.unresolved);
    const engagement = latestEvidence ? (topic.engagement === 'elaborating' || topic.engagement === 'new' ? 1 : .25) : .1;
    const newInformation = latestEvidence && topic.engagement !== 'acknowledging' ? clamp(latestWords / 24) : 0;
    const salience = rating(topic.importance);
    const closureReadiness = topic.state === 'declined' ? 1 : topic.state === 'settled' ? .9 : clamp(.55 * depth + .25 * (1 - unresolvedness) + .2 * clamp(before.closureReadiness));
    const incidental = topic.incidental === true || (salience < .35 && emotion < .35 && unresolvedness < .35);
    const linked = (semantic.links ?? []).some(link => link.support === 'explicit' && (link.from === topic.id || link.to === topic.id));
    const recency = Math.max(0, ...topic.evidence.map(item => item.source === 'latest' ? 1
      : item.source.startsWith('user-') ? .8 * Math.exp(-.55 * Math.max(0, priorUserCount - 1 - Number(item.source.slice(5))))
        : item.source === 'journal' ? .12 : .04));
    const facet = topic.facet ?? 'experience';
    const narrowingPenalty = facet === 'task-content' && questionPressure.answerLimitReached && !semantic.planningAuthorized ? 1.7 : 0;
    const priority = 1.5 * salience + 1.25 * emotion + 1.15 * unresolvedness + .8 * engagement
      + .55 * newInformation + .35 * (1 - depth) + 1.1 * recency + (previous.focusIds?.includes(topic.id) ? .45 : 0)
      + (linked ? .3 : 0)
      - 1.2 * closureReadiness - (incidental ? 1.8 : 0) - narrowingPenalty - (topic.state === 'declined' ? 5 : 0);
    return { id: topic.id, summary: topic.summary, salience, emotionalIntensity: emotion, explorationDepth: depth, userExplored,
      unresolvedness, engagement, newInformation, closureReadiness, incidental, priority, recency, facet, state: topic.state,
      evidence: topic.evidence };
  }).sort((a, b) => b.priority - a.priority);
  const top = topics[0];
  const max = top?.priority ?? 0;
  const exp = topics.map(topic => Math.exp((topic.priority - max) / .8));
  const denominator = exp.reduce((a, b) => a + b, 0) || 1;
  topics.forEach((topic, index) => { topic.relativePriority = exp[index] / denominator; });
  const meaningful = topics.filter(topic => !topic.incidental && topic.state !== 'declined');
  const weighted = meaningful.reduce((sum, topic) => sum + topic.salience + topic.emotionalIntensity, 0) || 1;
  const completion = meaningful.reduce((sum, topic) => sum + (topic.salience + topic.emotionalIntensity)
    * (.55 * topic.explorationDepth + .45 * topic.closureReadiness), 0) / weighted;
  const previousFocus = topics.find(topic => previous.focusIds?.includes(topic.id));
  const latestFocus = topics.find(topic => same(topic.id, semantic.focusIds?.[0]));
  let focus = top;
  if (latestFocus?.evidence.some(item => item.source === 'latest') && latestFocus.engagement > .25) focus = latestFocus;
  else if (previousFocus && previousFocus.state !== 'settled' && previousFocus.state !== 'declined'
    && top && top.priority - previousFocus.priority < .65) focus = previousFocus;
  // When the current thread has been answered for now, use the remaining
  // agenda while the user is still engaged instead of waiting for filler.
  if (focus?.id === previousFocus?.id && focus.state === 'settled') {
    focus = topics.find(topic => topic.id !== focus.id && !topic.incidental
      && topic.state !== 'declined' && topic.state !== 'settled'
      && topic.unresolvedness > .35 && topic.salience + topic.emotionalIntensity >= .8) ?? focus;
  }
  if (focus?.id === previousFocus?.id && focus.explorationDepth >= .65 && focus.unresolvedness < .45
    && semantic.intent !== 'close' && !engagementCue.pushback) {
    focus = topics.find(topic => topic.id !== focus.id && !topic.incidental
      && topic.state !== 'declined' && topic.state !== 'settled'
      && topic.explorationDepth < .4 && topic.unresolvedness > .35
      && topic.salience + topic.emotionalIntensity >= .8) ?? focus;
  }
  const lastAssistantAsked = /\?/.test([...history].reverse().find(turn => turn.role === 'ai')?.text ?? '');
  const answeredBriefly = lastAssistantAsked && latestWords >= 2 && latestWords <= 6
    && !engagementCue.bare && !engagementCue.pushback && !directQuestion && semantic.intent !== 'close';
  if (answeredBriefly && focus?.id === previousFocus?.id && focus.unresolvedness <= .6) {
    focus = topics.find(topic => topic.id !== focus.id && !topic.incidental
      && topic.state !== 'declined' && topic.state !== 'settled'
      && topic.explorationDepth < .4 && topic.unresolvedness > .35
      && topic.priority >= focus.priority - 1.5) ?? focus;
  }
  if (questionPressure.answerLimitReached && focus?.facet === 'task-content' && !semantic.planningAuthorized) {
    focus = topics.find(topic => topic.facet !== 'task-content' && !topic.incidental && topic.recency >= .35) ?? focus;
  }
  if ((engagementCue.pushback || engagementCue.literalAnswer) && previousFocus && focus?.id === previousFocus.id) {
    focus = topics.find(topic => topic.id !== previousFocus.id && !topic.incidental
      && topic.facet !== 'context' && topic.state !== 'settled' && topic.state !== 'declined') ?? focus;
  }
  // A repeated choice or a correction of its timing is feedback on the
  // assistant's last move. Keep that answer in focus instead of digging up an
  // unrelated journal incident to satisfy topic coverage.
  if ((engagementCue.repeatedChoice || engagementCue.temporalCorrection || engagementCue.confusion) && previousFocus) focus = previousFocus;
  const currentHasFreshMeaning = Boolean(focus && (assistantTurns === 0 || (old.size > 0 && !old.has(focus.id))))
    || (focus?.newInformation ?? 0) > .25 || semantic.intent === 'repair';
  const coverageDebt = topic => (topic.salience + topic.emotionalIntensity) * topic.unresolvedness
    * (1 - topic.explorationDepth) * (1 - .5 * topic.closureReadiness);
  const remaining = topics.filter(topic => topic.id !== previousFocus?.id && (previousFocus || topic.id !== focus?.id)
    && !topic.incidental && topic.state !== 'declined' && topic.state !== 'settled'
    && topic.explorationDepth < .4 && topic.unresolvedness > .35
    && topic.salience + topic.emotionalIntensity >= .8);
  const linkedToPrevious = topic => (semantic.links ?? []).some(link => link.support === 'explicit'
    && ((link.from === previousFocus?.id && link.to === topic.id)
      || (link.to === previousFocus?.id && link.from === topic.id)));
  const unvisited = [...remaining].sort((a, b) =>
    (coverageDebt(b) + (linkedToPrevious(b) ? .25 : 0) + .15 * b.recency)
    - (coverageDebt(a) + (linkedToPrevious(a) ? .25 : 0) + .15 * a.recency))[0];
  // Repeated acknowledgements after a concrete answer signal that the
  // current conversational move is no longer adding much. This is not a mood
  // estimate, and one short reply by itself never causes a topic change.
  const lowProgressTurn = !directQuestion && !engagementCue.pushback && !engagementCue.confusion
    && !engagementCue.repeatedChoice && latestWords <= 6 && !currentHasFreshMeaning
    && (focus?.newInformation ?? 0) <= .25;
  const lowProgressStreak = lowProgressTurn ? Math.min(3, (previous.lowProgressStreak ?? 0) + 1) : 0;
  const stalledWithOther = lowProgressStreak >= 2 && assistantTurns >= 2 && Boolean(unvisited)
    && semantic.intent === 'explore';
  const briefClosureCue = engagementCue.repeatedBare
    || (latestWords <= 3 && previousUserWords <= 3 && recentQuestions >= 2 && assistantTurns >= 3 && !currentHasFreshMeaning)
    || (completion >= .55 && latestWords <= 6 && userTurns >= 4 && !currentHasFreshMeaning);
  // A brief answer can mean the current thread has run its course. Check the
  // remaining agenda before landing; do not equate covering one topic with
  // covering the entry. An explicit request to stop still takes precedence.
  if ((briefClosureCue || stalledWithOther) && semantic.intent !== 'close' && unvisited) focus = unvisited;
  const newThread = Boolean(focus && (assistantTurns === 0 || (old.size > 0 && !old.has(focus.id))));
  const joint = focus && (semantic.links ?? []).filter(link => link.support === 'explicit'
    && (link.from === focus.id || link.to === focus.id)).map(link => topics.find(topic =>
      topic.id === (link.from === focus.id ? link.to : link.from)))
    .find(topic => topic && !topic.incidental && topic.state !== 'declined' && focus.priority - topic.priority < 1.2);
  const redirected = Boolean(focus && previousFocus && focus.id !== previousFocus.id);
  const freshUserMeaning = newThread || (focus?.newInformation ?? 0) > .25 || semantic.intent === 'repair';
  const priorAction = previous.action;
  let action;
  if (engagementCue.repeatedChoice && priorAction === 'REPAIR') action = 'SOFT_CLOSE';
  else if (engagementCue.pushback || engagementCue.literalAnswer || engagementCue.repeatedChoice || engagementCue.confusion) action = 'REPAIR';
  else if (semantic.intent === 'close') action = 'SOFT_CLOSE';
  else if ((briefClosureCue || stalledWithOther) && unvisited) action = 'SHIFT';
  else if (engagementCue.repeatedBare) action = 'SOFT_CLOSE';
  else if (semantic.intent === 'answer' && directQuestion) action = 'REFLECT';
  else if (questionPressure.latestBroad && questionPressure.answerLimitReached && !semantic.planningAuthorized) action = 'REFLECT';
  else if (questionPressure.latestAversion && !semantic.planningAuthorized) action = redirected ? 'SHIFT' : 'REFLECT';
  else if (engagementCue.plannedActivity && !semantic.planningAuthorized) action = 'REFLECT';
  else if (semantic.intent === 'repair' || (freshUserMeaning && (!assistantTurns || priorAction === 'SOFT_CLOSE'))) action = 'VALIDATE';
  else if (redirected) action = 'SHIFT';
  else if (questionPressure.saturation >= .7 && !semantic.planningAuthorized) action = 'REFLECT';
  else if (briefClosureCue) action = 'SOFT_CLOSE';
  else if (!assistantTurns || priorAction === 'VALIDATE') action = 'EXPLORE';
  else if (focus?.explorationDepth >= .65 && focus?.unresolvedness < .45) action = 'SUMMARISE';
  else if (latestWords <= 4 && priorAction === 'DEEPEN') action = 'REFLECT';
  else action = 'DEEPEN';
  // A new user concern always reopens a landing; a short acknowledgement alone does not.
  if (priorAction === 'SOFT_CLOSE' && freshUserMeaning && semantic.intent !== 'close') action = 'VALIDATE';
  return { version: 'debrief-state-1', action, phase: action === 'SOFT_CLOSE' ? 'LANDING' : 'OPEN',
    focusIds: focus ? [focus.id, ...(joint ? [joint.id] : [])] : [], previousFocusId: redirected ? previousFocus.id : null,
    topics, completion: clamp(completion), remainingCoverageDebt: remaining.reduce((sum, topic) => sum + coverageDebt(topic), 0),
    lowProgressStreak, userTurns, assistantTurns, newThread, questionPressure, engagementCue,
    latestMeaning: semantic.latestMeaning, links: semantic.links ?? [], directQuestion };
}

export function responseContract(state, semantic = {}, voice) {
  const focus = state.topics.find(topic => state.focusIds[0] === topic.id);
  const questionTopic = semantic.topics?.find(topic => topic.id === focus?.id);
  const questionGoal = semantic.openingMode === 'question' && questionTopic?.questionFit?.score >= .85
    ? { purpose: questionTopic.question.purpose ?? 'understanding',
      informationGap: questionTopic.question.informationGap ?? '',
      groundingQuote: questionTopic.question.groundingQuote ?? questionTopic.evidence?.[0]?.quote ?? '',
      dimension: questionTopic.question.dimension } : null;
  const companionFocus = state.topics.find(topic => state.focusIds[1] === topic.id);
  const previous = state.topics.find(topic => topic.id === state.previousFocusId);
  const otherMeaningfulThreads = state.topics.filter(topic => !state.focusIds.includes(topic.id) && !topic.incidental
    && !['declined', 'settled'].includes(topic.state) && topic.explorationDepth < .4)
    .slice(0, 2).map(topic => ({ summary: topic.summary, userQuote: topic.evidence?.[0]?.quote ?? '' }));
  const transition = state.action === 'SHIFT' ? {
    from: previous?.summary ?? '', fromQuote: previous?.evidence?.[0]?.quote ?? '',
    to: focus?.summary ?? '', toQuote: focus?.evidence?.[0]?.quote ?? '',
    explicitLink: state.links.some(link => link.support === 'explicit'
      && ((link.from === previous?.id && link.to === focus?.id)
        || (link.to === previous?.id && link.from === focus?.id))),
  } : null;
  return { action: state.action, phase: state.phase, focus: [focus?.summary, companionFocus?.summary].filter(Boolean).join(' and '), previousFocus: previous?.summary ?? '',
    otherMeaningfulThreads, transition, remainingCoverageDebt: state.remainingCoverageDebt ?? 0,
    questionPressure: state.questionPressure, engagementCue: state.engagementCue,
    evidence: focus?.evidence ?? [], completion: state.completion, linkedTopics: state.links.filter(link =>
      state.focusIds.includes(link.from) || state.focusIds.includes(link.to)),
    latestMeaning: state.latestMeaning, voice, planningAuthorized: semantic.planningAuthorized, questionGoal,
    instruction: state.action !== 'REPAIR' && state.directQuestion ? 'Answer the latest direct question plainly using known context; no follow-up is required.' : ({ VALIDATE: 'React to what happened and why it matters to them. If there is something useful to ask, make it easy to answer.',
      REFLECT: state.engagementCue.plannedActivity
        ? 'The user has named something they plan to do later. Treat it as an answer, not an event that already happened. Respond to the choice in their voice; do not ask how it felt or suggest another comfort activity.'
        : 'Respond to the specific thing they just added. Add a grounded thought or unresolved consequence they could reply to, without ending on a recap.',
      EXPLORE: 'Follow one relevant detail they have not answered already, like a friend who is actually listening.',
      DEEPEN: 'Use their answer to move the chat forward. If a useful question target exists, ask about that unknown; otherwise add a grounded thought about what remains open here or in a directly related thread. Do not finish with a recap or ask the same thing in new words.',
      SHIFT: 'Finish the current thought briefly, then use the transition evidence to bring up the next meaningful concern in a separate paragraph. If there is no explicit link, bridge through the shared day or current situation without claiming the events caused each other.',
      SUMMARISE: 'Say what has become clearer in ordinary words, leaving room for them to correct or add to it.',
      REPAIR: state.engagementCue.repeatedChoice || state.engagementCue.temporalCorrection || state.engagementCue.confusion
        ? 'The user is correcting or repeating a clear answer because the assistant missed it. Own that briefly, name the answer accurately, and stop probing or reinterpreting it. No question or alternative activity.'
        : 'The last reply missed the user. Own that briefly, stop analysing the small detail, and return to the meaningful concern without making new claims or demanding another answer.',
      SOFT_CLOSE: 'Offer a gentle landing with no demand to reply; the user may reopen immediately.' })[state.action] };
}

/** Safety net when semantic assessment is unavailable. It follows the user's
 * last substantive turn rather than mining a fresh random journal detail. */
export function fallbackDebriefState(plan, previous = {}) {
  previous = previous ?? {};
  const engagementCue = analyseEngagement(plan.history, plan.currentMessage);
  const priorUser = [...plan.history].reverse().find(turn => turn.role === 'user' && String(turn.text).trim().split(/\s+/).length > 4);
  const latest = String(plan.currentMessage ?? '').trim();
  const latestHasMeaning = latest.split(/\s+/).length > 4;
  const anchor = latestHasMeaning ? latest : priorUser?.text ?? plan.originalEntry ?? latest;
  const assistantTurns = plan.history.filter(turn => turn.role === 'ai').length;
  const userTurns = plan.history.filter(turn => turn.role === 'user').length + 1;
  const action = engagementCue.repeatedChoice && previous.action === 'REPAIR' ? 'SOFT_CLOSE'
    : engagementCue.pushback || engagementCue.literalAnswer || engagementCue.repeatedChoice || engagementCue.confusion ? 'REPAIR'
    : engagementCue.repeatedBare || (!latestHasMeaning && assistantTurns >= 3 && userTurns >= 4) ? 'SOFT_CLOSE'
      : engagementCue.plannedActivity ? 'REFLECT' : latestHasMeaning ? 'VALIDATE' : 'REFLECT';
  const topic = { id: 'recent-user-thread', summary: anchor.slice(0, 260), evidence: [{ source: latestHasMeaning ? 'latest' : 'prior-user', quote: anchor.slice(0, 260) }],
    salience: .65, emotionalIntensity: .5, explorationDepth: .45, unresolvedness: .6,
    engagement: latestHasMeaning ? 1 : .1, newInformation: latestHasMeaning ? .6 : 0,
    closureReadiness: action === 'SOFT_CLOSE' ? .7 : .3, incidental: false, priority: 1, relativePriority: 1, state: 'exploring' };
  const journalEnding = String(plan.originalEntry ?? '').trim().slice(-220);
  const contextualTopic = journalEnding && !anchor.includes(journalEnding) ? [{ id: 'journal-ending', summary: journalEnding,
    evidence: [{ source: 'journal', quote: journalEnding }], salience: .45, emotionalIntensity: .4,
    explorationDepth: .2, unresolvedness: .5, engagement: .1, newInformation: 0,
    closureReadiness: .3, incidental: false, priority: .5, relativePriority: 0, state: 'open' }] : [];
  const priorTopics = (previous?.topics ?? []).filter(item => !item.incidental && item.state !== 'declined');
  const alternate = priorTopics.find(item => item.id !== previous.focusIds?.[0] && item.facet !== 'context') ?? priorTopics[0];
  const retained = priorTopics.find(item => item.id === previous.focusIds?.[0]);
  const selected = (engagementCue.repeatedChoice || engagementCue.temporalCorrection || engagementCue.confusion) && retained ? retained
    : ['REPAIR', 'SOFT_CLOSE'].includes(action) && alternate ? alternate : topic;
  return { version: 'debrief-fallback-1', action, phase: action === 'SOFT_CLOSE' ? 'LANDING' : 'OPEN',
    focusIds: [selected.id], previousFocusId: action === 'REPAIR' ? previous.focusIds?.[0] ?? null : null,
    topics: [selected, ...[topic, ...contextualTopic, ...priorTopics].filter(item => item.id !== selected.id)],
    completion: action === 'SOFT_CLOSE' ? .7 : .3, engagementCue,
    userTurns, assistantTurns, latestMeaning: latest, links: [], previousAction: previous.action };
}
