import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from './fixtures/assignment-avoidance.json' with { type: 'json' };
import { analyseQuestionPressure, buildVoiceProfile, isNarrowingQuestion } from '../conversation-guidance.js';
import { updateDebriefState } from '../dialogue-policy.js';
import { buildConversationResponsePlan, validateConversationReply } from '../conversation-response.js';

const historyBefore = index => fixture.turns.slice(0, index);
const semantic = (latest, facet = 'experience') => ({ intent: 'explore', focusIds: ['pressure'],
  latestMeaning: latest, links: [], planningAuthorized: false,
  topics: [
    { id: 'incident', summary: 'chaotic morning', facet: 'context', state: 'open', engagement: 'none',
      coverage: 'surface', importance: 'low', emotionalIntensity: 'low', unresolved: 'low', incidental: false,
      evidence: [{ source: 'journal', quote: 'egg yolk explode on my shirt' }] },
    { id: 'math-content', summary: 'math topics are hard', facet: 'task-content', state: 'open', engagement: 'elaborating',
      coverage: 'surface', importance: 'high', emotionalIntensity: 'medium', unresolved: 'high', incidental: false,
      evidence: [{ source: 'user-1', quote: 'math assignment its like due tmr' }, { source: 'latest', quote: latest }] },
    { id: 'pressure', summary: 'deadline pressure and urge to escape', facet, state: 'open', engagement: 'elaborating',
      coverage: 'surface', importance: 'high', emotionalIntensity: 'high', unresolved: 'high', incidental: false,
      evidence: [{ source: 'user-1', quote: 'due tmr' }, { source: 'latest', quote: latest }] },
  ] });

test('short answers do not erase the journal voice', () => {
  for (const index of [5, 7, 9, 11, 13]) {
    const latest = fixture.turns[index].text;
    const voice = buildVoiceProfile(fixture.journal, historyBefore(index), latest);
    assert.equal(voice.register, 'casual', `lost the voice after ${latest}`);
    assert.ok(voice.lowercaseShare > .8);
  }
});

test('a global answer exhausts subpart probing, but a rest question is not a subpart probe', () => {
  assert.equal(isNarrowingQuestion('what part of the assignment feels the hardest right now?'), true);
  assert.equal(isNarrowingQuestion('is there one specific problem or concept?'), true);
  assert.equal(isNarrowingQuestion('what’s the one thing you want to do to decompress?'), false);
  for (const index of [5, 7, 9]) {
    const pressure = analyseQuestionPressure(historyBefore(index), fixture.turns[index].text);
    assert.equal(pressure.answerLimitReached, true, `missed global answer at ${index}`);
  }
});

test('topic priority stays with the recent pressure, not a comic journal incident', () => {
  const index = 9;
  const latest = fixture.turns[index].text;
  const state = updateDebriefState(semantic(latest), { focusIds: ['math-content'], topics: [{ id: 'math-content', explorationDepth: .35 }] }, latest, historyBefore(index));
  assert.equal(state.focusIds[0], 'pressure');
  assert.equal(state.action, 'REFLECT');
  assert.ok(state.topics.find(topic => topic.id === 'incident').priority < state.topics.find(topic => topic.id === 'pressure').priority);
  assert.equal(state.questionPressure.answerLimitReached, true);
});

test('an explicit wish to stop thinking about math can shift with a bridge', () => {
  const index = 11;
  const latest = fixture.turns[index].text;
  const assessed = semantic(latest);
  assessed.focusIds = ['rest'];
  assessed.topics[1].evidence = [{ source: 'user-1', quote: 'math assignment its like due tmr' }];
  assessed.topics[2].evidence = [{ source: 'user-1', quote: 'due tmr' }];
  assessed.topics.push({ id: 'rest', summary: 'wants to get away from assignment pressure for now', facet: 'decision',
    state: 'open', engagement: 'new', coverage: 'untouched', importance: 'high', emotionalIntensity: 'high',
    unresolved: 'high', incidental: false, evidence: [{ source: 'latest', quote: latest }] });
  const previous = { action: 'REFLECT', focusIds: ['pressure'], topics: [{ id: 'pressure', explorationDepth: .4 }] };
  const state = updateDebriefState(assessed, previous, latest, historyBefore(index));
  assert.equal(state.focusIds[0], 'rest');
  assert.equal(state.action, 'SHIFT');
  assert.equal(state.previousFocusId, 'pressure');
});

test('critic blocks repeated narrowing and irrelevant callbacks to the egg incident', () => {
  const index = 7;
  const latest = fixture.turns[index].text;
  const plan = buildConversationResponsePlan({ originalEntry: fixture.journal, userMessage: latest, chatHistory: historyBefore(index) });
  plan.debriefState = updateDebriefState(semantic(latest), {}, latest, plan.history);
  plan.semantic = semantic(latest);
  plan.voice = buildVoiceProfile(fixture.journal, plan.history, latest);
  plan.questionBudget = 1;
  plan.continuationRequired = false;
  plan.agenda = { ...plan.agenda, focusEvidence: 'math assignment due tmr; everything' };
  assert.equal(validateConversationReply('is there one specific problem or concept that is hard?', plan).reason,
    'narrowing-after-user-already-answered-globally');
  assert.equal(validateConversationReply('that egg explosion was brutal. having the assignment due tmr on top of everything sounds exhausting.', plan).reason,
    'unprompted-callback-to-unrelated-journal-incident');
});
