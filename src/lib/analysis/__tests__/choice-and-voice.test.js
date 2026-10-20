import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseEngagement, buildVoiceProfile, mergeHistoricalVoice } from '../conversation-guidance.js';
import { updateDebriefState, fallbackDebriefState, responseContract } from '../dialogue-policy.js';
import { buildConversationResponsePlan, validateConversationReply } from '../conversation-response.js';
import { evaluateSemanticConversation, applySemanticConversation } from '../semantic-conversation.js';

const journal = 'wah tdy was damn tiring sia, one quick errand became a whole side quest. now im home with work left but my brain already clocked out HAHAHA. i might just shower then scroll first lor';
const firstHistory = [{ role: 'ai', text: "what's one small comfort you'd enjoy next?" }];
const topic = (id, summary, source, quote, facet = 'decision') => ({ id, summary, facet,
  evidence: [{ source, quote }], importance: 'high', emotionalIntensity: 'medium', unresolved: 'medium',
  coverage: 'surface', state: 'open', engagement: source === 'latest' ? 'elaborating' : 'none' });
const semantic = latest => ({ intent: 'explore', latestMeaning: latest, focusIds: ['rest'], links: [], topics: [
  topic('rest', 'wants a break before work', 'latest', latest),
  topic('work', 'unfinished work still on their mind', 'journal', 'work left'),
] });
const previous = { action: 'EXPLORE', focusIds: ['rest'], topics: [
  { id: 'rest', explorationDepth: .4, closureReadiness: .2 },
  { id: 'work', explorationDepth: .1, closureReadiness: .1 },
] };

test('a proposed activity is not treated as an experience already completed', () => {
  const cue = analyseEngagement(firstHistory, 'doomscroll on tiktok lor');
  assert.equal(cue.plannedActivity, true);
  const state = updateDebriefState(semantic('doomscroll on tiktok lor'), previous, 'doomscroll on tiktok lor', firstHistory);
  assert.equal(state.action, 'REFLECT');
  assert.match(responseContract(state, semantic('doomscroll on tiktok lor'), {}).instruction, /answer, not an event/);
  const plan = buildConversationResponsePlan({ originalEntry: journal, chatHistory: firstHistory, userMessage: 'doomscroll on tiktok lor' });
  plan.originalEntry = journal;
  plan.debriefState = state; plan.questionBudget = 0; plan.continuationRequired = false;
  assert.equal(validateConversationReply("how's it feeling after the scroll, does it help unwind?", plan).reason,
    'treats-future-plan-as-completed');
  assert.equal(validateConversationReply("what's one small comfort that could help right now?", plan).reason,
    'low-value-comfort-or-meta-question');
  assert.equal(validateConversationReply('what small mental cue could signal you are okay to pause?', plan).reason,
    'low-value-comfort-or-meta-question');
  assert.equal(validateConversationReply('that quick errand became a whole side quest, and the work is still waiting.', plan).reason,
    'recaps-journal-instead-of-answering');
});

test('the opening cannot hand a multi-part journal back as a heaviest-part interview', () => {
  const plan = buildConversationResponsePlan({ originalEntry: journal, userMessage: journal });
  plan.debriefState = { action: 'VALIDATE', focusIds: ['work'], topics: [{ id: 'work', incidental: false }] };
  plan.questionBudget = 1;
  assert.equal(validateConversationReply("i get that feeling when everything piles up, but what part of today actually feels the heaviest on your mind right now?", plan).reason,
    'outsources-journal-priority-to-user');
});

test('a selected dialogue focus is not rejected by the older all-thread coverage gate', () => {
  const plan = buildConversationResponsePlan({ originalEntry: journal, userMessage: 'the studying part lor' });
  plan.discourseModel = { academicLeisureConflict: true, currentThreadIds: ['academic', 'leisure'],
    activeThreads: [
      { id: 'academic', responseTerms: ['study'] },
      { id: 'leisure', responseTerms: ['holiday'] },
    ] };
  plan.debriefState = { action: 'REFLECT', focusIds: ['academic'], topics: [
    { id: 'academic', summary: 'study pressure', incidental: false },
    { id: 'leisure', summary: 'holiday plans', incidental: false },
  ] };
  plan.questionBudget = 0;
  plan.continuationRequired = false;
  assert.notEqual(validateConversationReply('ya, the study pressure is still on your mind.', plan).reason,
    'dropped-active-thread');
});

test('timing correction and repeated choice repair instead of reopening the same question', () => {
  const history = [...firstHistory, { role: 'user', text: 'doomscroll on tiktok lor' },
    { role: 'ai', text: "how's it feeling after the scroll?" }];
  const correction = analyseEngagement(history, 'i hvnt done it yet later then scroll');
  assert.equal(correction.temporalCorrection, true);
  const state = updateDebriefState(semantic('i hvnt done it yet later then scroll'), previous,
    'i hvnt done it yet later then scroll', history);
  assert.equal(state.action, 'REPAIR');
  assert.deepEqual(state.focusIds, ['rest']);
  assert.match(responseContract(state, semantic('i hvnt done it yet later then scroll'), {}).instruction, /No question/);
  const repeatedHistory = [...history, { role: 'user', text: 'i hvnt done it yet later then scroll' },
    { role: 'ai', text: 'sorry, you meant later. what else would help?' }];
  assert.equal(analyseEngagement(repeatedHistory, 'scroll tiktok').repeatedChoice, true);
  const fallback = fallbackDebriefState({ history: repeatedHistory, currentMessage: 'scroll tiktok', originalEntry: journal },
    { ...previous, action: 'REPAIR', topics: [
      { ...previous.topics[0], summary: 'rest later', incidental: false, state: 'open' },
      { ...previous.topics[1], summary: 'work pressure', incidental: false, state: 'open' },
    ] });
  assert.equal(fallback.action, 'SOFT_CLOSE');
  assert.deepEqual(fallback.focusIds, ['rest']);
});

test('confusion rejects another journal recap and unsupported interpretation', () => {
  const history = [...firstHistory, { role: 'user', text: 'doomscroll on tiktok lor' },
    { role: 'ai', text: 'notice how your quick errand became a marathon of little setbacks.' }];
  assert.equal(analyseEngagement(history, 'huh what').confusion, true);
  const plan = buildConversationResponsePlan({ originalEntry: journal, chatHistory: history, userMessage: 'huh what' });
  plan.debriefState = { action: 'REPAIR', focusIds: ['rest'], topics: [{ id: 'rest', incidental: false }] };
  plan.questionBudget = 0; plan.continuationRequired = false;
  assert.equal(validateConversationReply("maybe that pause itself is a tiny win. it's not even about the videos, right?", plan).reason,
    'reinterprets-user-correction');
});

test('voice remembers the user’s particles, laughter and substantial wording after terse turns', () => {
  const voice = buildVoiceProfile(journal, [{ role: 'user', text: 'wah the whole day really damn shag sia HAHAHA' }], 'huh');
  assert.equal(voice.register, 'casual');
  assert.ok(voice.particles.includes('sia'));
  assert.ok(voice.laughterMarkers.some(marker => marker.startsWith('haha')));
  assert.ok(voice.userExamples.some(example => example.includes('brain already clocked out')));
  assert.ok(!voice.userExamples.includes('huh'));
  const historical = mergeHistoricalVoice(buildVoiceProfile('i had a long day but am fine', [], 'okay'),
    { sourceCount: 10, style: { register: 'casual', lowercaseShare: .99, particles: ['lah'], laughterMarkers: ['lol'] } }, 'okay');
  assert.ok(historical.particles.includes('lah'));
  assert.ok(historical.laughterMarkers.includes('lol'));
});

test('an open topic does not create a compulsory question without marginal value', () => {
  const sources = [{ id: 'journal', text: journal }, { id: 'latest', text: 'i might scroll later' }];
  const raw = { intent: 'explore', topics: [topic('rest', 'wants a break before work', 'latest', 'i might scroll later')] };
  const assessed = evaluateSemanticConversation(raw, sources);
  assert.equal(assessed.openingMode, 'reflection');
  const plan = buildConversationResponsePlan({ originalEntry: journal, chatHistory: firstHistory, userMessage: 'i might scroll later' });
  applySemanticConversation(plan, assessed);
  assert.equal(plan.questionBudget, 0);
  assert.equal(plan.continuationRequired, false);
  const lowValue = evaluateSemanticConversation({ ...raw, topics: [{ ...raw.topics[0],
    question: { dimension: 'what', informationGain: 'low', relevance: 'low', userEffort: 'high', repetitionRisk: 'high', taskDirected: false },
  }] }, sources);
  assert.equal(lowValue.openingMode, 'reflection');
});
