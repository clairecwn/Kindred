import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from './fixtures/shower-misread.json' with { type: 'json' };
import { analyseEngagement, buildVoiceProfile } from '../conversation-guidance.js';
import { updateDebriefState, fallbackDebriefState } from '../dialogue-policy.js';
import { buildConversationResponsePlan, validateConversationReply } from '../conversation-response.js';

const topic = (id, summary, facet, evidence, importance = 'medium') => ({ id, summary, facet, evidence,
  importance, emotionalIntensity: importance, unresolved: importance, coverage: 'surface',
  state: 'open', engagement: evidence.some(item => item.source === 'latest') ? 'elaborating' : 'none' });
const semantic = latest => ({ intent: 'explore', latestMeaning: latest, focusIds: ['shower'], links: [], topics: [
  topic('shower', 'a shower after the day', 'context', [{ source: 'latest', quote: latest }], 'low'),
  topic('study', 'drained while a long study chapter remains', 'decision', [{ source: 'journal', quote: 'supposed to continue studying' }], 'high'),
  topic('morning', 'morning mishaps', 'context', [{ source: 'journal', quote: 'got 18 min to leave house' }], 'medium'),
] });
const previous = { action: 'EXPLORE', focusIds: ['shower'], topics: [
  { id: 'shower', explorationDepth: .35, closureReadiness: .2 },
  { id: 'study', explorationDepth: .15, closureReadiness: .1 },
  { id: 'morning', explorationDepth: .4, closureReadiness: .3 },
] };

test('journal voice persists through short and dismissive answers', () => {
  for (const index of [1, 3, 5, 7]) {
    const voice = buildVoiceProfile(fixture.journal, fixture.turns.slice(0, index), fixture.turns[index].text);
    assert.equal(voice.register, 'casual');
    assert.ok(voice.lowercaseShare > .9);
  }
});

test('literal answer, pushback and repeated acknowledgements are distinct engagement cues', () => {
  assert.equal(analyseEngagement(fixture.turns.slice(0, 1), 'the water').literalAnswer, true);
  assert.equal(analyseEngagement(fixture.turns.slice(0, 3), 'ok wtv').pushback, true);
  assert.equal(analyseEngagement(fixture.turns.slice(0, 5), 'kk').repeatedBare, true);
  assert.equal(analyseEngagement([{ role: 'ai', text: 'Which task is due?' }], 'math assignment').score, 0);
});

test('policy repairs a missed reply and returns to the meaningful thread', () => {
  const state = updateDebriefState(semantic('the water'), previous, 'the water', fixture.turns.slice(0, 1));
  assert.equal(state.action, 'REPAIR');
  assert.equal(state.focusIds[0], 'study');
  assert.equal(state.previousFocusId, 'shower');
  const pushback = updateDebriefState(semantic('ok wtv'), previous, 'ok wtv', fixture.turns.slice(0, 3));
  assert.equal(pushback.action, 'REPAIR');
  const bridge = updateDebriefState(semantic('kk'), { ...previous, action: 'REPAIR' }, 'kk', fixture.turns.slice(0, 5));
  assert.equal(bridge.action, 'SHIFT');
  assert.equal(bridge.focusIds[0], 'study');
});

test('assessor-free brief-turn fallback uses prior non-incidental concern', () => {
  const plan = buildConversationResponsePlan({ originalEntry: fixture.journal,
    userMessage: 'ok wtv', chatHistory: fixture.turns.slice(0, 3) });
  const state = fallbackDebriefState(plan, { ...previous, topics: [
    { ...previous.topics[0], facet: 'context', summary: 'shower', evidence: [{ source: 'journal', quote: 'shower first' }] },
    { ...previous.topics[1], facet: 'decision', summary: 'study pressure', evidence: [{ source: 'journal', quote: 'supposed to continue studying' }] },
  ] });
  assert.equal(state.action, 'REPAIR');
  assert.equal(state.focusIds[0], 'study');
});

test('the bad reply invents physiology unsupported by the user', () => {
  const plan = buildConversationResponsePlan({ originalEntry: fixture.journal,
    userMessage: 'the water', chatHistory: fixture.turns.slice(0, 1) });
  plan.questionBudget = 0;
  plan.continuationRequired = false;
  assert.equal(validateConversationReply(fixture.turns[2].text, plan).reason, 'invented-physical-or-internal-state');
});

test('curly apostrophes do not evade the premature micro-step question check', () => {
  const plan = buildConversationResponsePlan({ originalEntry: fixture.journal,
    userMessage: fixture.journal, chatHistory: [] });
  plan.semantic = { intent: 'explore', topics: [], links: [] };
  plan.questionBudget = 1;
  plan.continuationRequired = false;
  assert.equal(validateConversationReply(fixture.turns[0].text, plan).reason, 'unrequested-task-progress-question');
});
