import test from 'node:test';
import assert from 'node:assert/strict';
import { updateDebriefState, responseContract } from '../dialogue-policy.js';
import { formalityPenalty, hasArtificialStyleTell, softenCasualWording } from '../companion-style.js';
import { buildConversationResponsePlan, validateConversationReply } from '../conversation-response.js';
import fixture from './fixtures/write-journal-entry.json' with { type: 'json' };

const journal = 'tdy was damn blur sia. i ate some fries but now i just want to nap and the readings are waiting.';
const topic = (id, summary, quote, overrides = {}) => ({ id, summary,
  evidence: [{ source: 'journal', quote }], state: 'open', engagement: 'none',
  coverage: 'surface', importance: 'medium', emotionalIntensity: 'medium',
  unresolved: 'medium', ...overrides });

test('a comic detail cannot steal focus from the fatigue and unfinished work thread', () => {
  const semantic = { intent: 'explore', focusIds: ['fries'], latestMeaning: 'tired after getting home', links: [],
    topics: [topic('fries', 'ate some fries', 'ate some fries', { importance: 'low', emotionalIntensity: 'low', unresolved: 'low', incidental: true,
      evidence: [{ source: 'journal', quote: 'ate some fries' }] }),
      topic('fatigue', 'exhausted and guilty about resting', 'want to nap', { importance: 'high', emotionalIntensity: 'high', unresolved: 'high' }),
      topic('work', 'readings waiting', 'readings are waiting', { importance: 'medium', emotionalIntensity: 'medium', unresolved: 'high' })] };
  const state = updateDebriefState(semantic, {}, 'ye', [{ role: 'ai', text: 'A long day can leave you spent.' }]);
  assert.equal(state.focusIds[0], 'fatigue');
  assert.ok(state.topics.find(t => t.id === 'fries').relativePriority < .05);
  assert.equal(state.phase, 'OPEN');
  assert.equal(responseContract(state, semantic, {}).focus, 'exhausted and guilty about resting');
});

test('a landing reopens as soon as the user introduces a fresh concern', () => {
  const previous = { action: 'SOFT_CLOSE', phase: 'LANDING', focusIds: ['fatigue'], topics: [{ id: 'fatigue', explorationDepth: .75, closureReadiness: .7 }] };
  const semantic = { intent: 'explore', focusIds: ['friend'], latestMeaning: 'worries about friend', links: [],
    topics: [topic('fatigue', 'earlier tiredness', 'want to nap', { state: 'settled', coverage: 'developed', unresolved: 'low' }),
      topic('friend', 'awkward outing with a friend', 'friend was awkward', { evidence: [{ source: 'latest', quote: 'friend was awkward' }],
        engagement: 'new', importance: 'high', emotionalIntensity: 'high', unresolved: 'high', coverage: 'untouched' })] };
  const state = updateDebriefState(semantic, previous, 'my friend was awkward with me today', [{ role: 'ai', text: 'Rest if you want.' }]);
  assert.equal(state.action, 'VALIDATE');
  assert.equal(state.phase, 'OPEN');
  assert.equal(state.focusIds[0], 'friend');
});

test('low effort acknowledgement can land after meaningful coverage without selecting incidental details', () => {
  const previous = { action: 'DEEPEN', focusIds: ['fatigue'], topics: [{ id: 'fatigue', explorationDepth: .7, userExplored: true, closureReadiness: .6 }] };
  const semantic = { intent: 'explore', focusIds: ['fatigue'], latestMeaning: 'agreement', links: [],
    topics: [topic('fatigue', 'tired after a chaotic day', 'want to nap', { coverage: 'developed', unresolved: 'low', emotionalIntensity: 'high', importance: 'high' })] };
  const history = Array.from({ length: 6 }, (_, index) => ({ role: index % 2 ? 'ai' : 'user', text: 'message' }));
  const state = updateDebriefState(semantic, previous, 'ye', history);
  assert.equal(state.action, 'SOFT_CLOSE');
  assert.equal(state.phase, 'LANDING');
});

test('question fatigue plus two low-information turns can land even with imperfect coverage', () => {
  const semantic = { intent: 'explore', focusIds: ['fatigue'], latestMeaning: 'brief agreement', links: [],
    topics: [topic('fatigue', 'tired and wary of unproductive naps', 'want to nap', { coverage: 'surface', unresolved: 'high', importance: 'high' })] };
  const history = [{ role: 'user', text: 'i am tired' }, { role: 'ai', text: 'How was your day?' },
    { role: 'user', text: 'long day' }, { role: 'ai', text: 'What happened after?' },
    { role: 'user', text: 'hm' }, { role: 'ai', text: 'Rest can be tricky.' }];
  const state = updateDebriefState(semantic, { focusIds: ['fatigue'], topics: [{ id: 'fatigue', explorationDepth: .35 }] }, 'oh', history);
  assert.equal(state.action, 'SOFT_CLOSE');
  assert.equal(updateDebriefState(semantic, {}, 'oh', history).action, 'SOFT_CLOSE');
});

test('critic flags posh speculation in a casual exchange', () => {
  assert.equal(hasArtificialStyleTell('That little mismatch can feel oddly telling.'), 'unsupported-or-posh-interpretation');
  assert.ok(formalityPenalty('Perhaps that perspective is compelling and therefore reassuring.', { register: 'casual' }) >= .6);
  assert.equal(formalityPenalty('wah that sounds tiring sia', { register: 'casual' }), 0);
  assert.ok(journal.includes('fries'));
});

test('the saved transcript keeps the important thread and catches its worst replies', () => {
  assert.equal(fixture.turns.filter(turn => turn.role === 'user').at(-1).text, 'ye');
  assert.ok(fixture.journal.includes('supposed to do readings'));
  for (const index of fixture.badAssistantTurnIndexes) {
    assert.ok(hasArtificialStyleTell(fixture.turns[index].text), `bad turn ${index} escaped the style critic`);
  }
  assert.ok(fixture.expectedFocus.every(summary => !summary.includes('fries')));
});

test('landing critic rejects an invented tomorrow narrative', () => {
  const plan = buildConversationResponsePlan({ originalEntry: fixture.journal, userMessage: 'ye', chatHistory: fixture.turns.slice(0, 9) });
  plan.debriefState = { action: 'SOFT_CLOSE', focusIds: ['fatigue'], topics: [{ id: 'fatigue', incidental: false }] };
  plan.questionBudget = 0;
  assert.equal(validateConversationReply('Maybe tomorrow you will notice a small shift that eases the fog. Take care.', plan).reason,
    'unsupported-future-or-thought-narrative');
});

test('a brief acknowledgement bridges to an untouched meaningful thread before landing', () => {
  const previous = { action: 'DEEPEN', focusIds: ['project'], topics: [{ id: 'project', explorationDepth: .7, closureReadiness: .5 }] };
  const semantic = { intent: 'explore', focusIds: ['project'], latestMeaning: 'brief acknowledgement', links: [], topics: [
    topic('project', 'frustration with late group opinions', 'everyone got opinion', { coverage: 'developed', unresolved: 'medium', importance: 'high' }),
    topic('embarrassment', 'awkward breakfast queue', 'stand there digging my bag', { coverage: 'untouched', unresolved: 'medium' }),
    topic('commute', 'wet walk home and feeling worn out', 'my shoes got wet', { coverage: 'untouched', unresolved: 'medium' }),
  ] };
  const history = [{ role: 'user', text: 'people should voice up earlier' }, { role: 'ai', text: 'That meeting dragged. How did you feel after?' },
    { role: 'user', text: 'yeah' }, { role: 'ai', text: 'The project is sorted now.' }, { role: 'user', text: 'ok' }, { role: 'ai', text: 'Fair.' }];
  const state = updateDebriefState(semantic, previous, 'kk', history);
  assert.equal(state.action, 'SHIFT');
  assert.equal(state.phase, 'OPEN');
  assert.notEqual(state.focusIds[0], 'project');
  assert.equal(state.previousFocusId, 'project');
});

test('internal labels, uninvited emoji, stiff language and unsolicited plans cannot reach chat', () => {
  assert.equal(hasArtificialStyleTell('**shift**, the takeaway: a smoother flow.'), 'internal-dialogue-label');
  assert.equal(hasArtificialStyleTell('**landing**, keep an eye on next time.'), 'internal-dialogue-label');
  assert.equal(hasArtificialStyleTell('your energy just got siphoned away'), 'stock-comfort-language');
  assert.equal(hasArtificialStyleTell('i can reflect on that with you.'), null);
  const plan = buildConversationResponsePlan({ originalEntry: journal, userMessage: 'the group meeting was annoying', chatHistory: [] });
  plan.debriefState = { action: 'REFLECT', focusIds: ['project'], topics: [{ id: 'project', incidental: false }] };
  plan.voice = { register: 'casual' }; plan.questionBudget = 0; plan.continuationRequired = false;
  assert.equal(validateConversationReply('Yeah, that took ages. 🚀', plan).reason, 'unmatched-emoji');
  assert.equal(validateConversationReply('Maybe a quick check-in next time will keep things moving.', plan).reason, 'unsolicited-advice');
  plan.questionBudget = 1;
  assert.equal(validateConversationReply('what’s one low-key thing you could do right now?', plan).reason, 'low-value-comfort-or-meta-question');
  assert.equal(validateConversationReply('Waiting until the last minute to air opinions feels like pulling the rug out.', plan).reason, 'stiff-companion-language');
  assert.equal(softenCasualWording('That group dynamic was inefficient.', plan.voice), 'That group thing was slow.');
  assert.equal(softenCasualWording('Did that bother you?', { register: 'casual', lowercaseShare: .98 }), 'did that bother you?');
  assert.equal(validateConversationReply('Did that awkward wave feel like a reminder that social slips drain you?', plan).reason, 'leading-interpretive-question');
  assert.equal(validateConversationReply('the rest can wait for a bit.', plan).reason, 'unsupported-deadline-reassurance');
  assert.equal(validateConversationReply('what’s still on your mind from the day?', plan).reason, 'generic-follow-up');
  assert.equal(validateConversationReply('how did that hit you?', plan).reason, 'generic-follow-up');
  assert.equal(validateConversationReply('you’re safe, no more awkward mall waves.', plan).reason, 'unsupported-safety-assurance');
  assert.equal(validateConversationReply('Maybe they settled just to avoid more arguing.', plan).reason, 'invented-interpersonal-conflict');
  plan.questionBudget = 1;
  assert.equal(validateConversationReply('if you could knock out just one small part of the deck right now, which piece feels easiest to finish?', plan).reason, 'unrequested-task-breakdown');
});

test('answering the companion keeps conversation open; asking it a question gets a direct answer', () => {
  const previous = { action: 'EXPLORE', focusIds: ['recovery'], topics: [{ id: 'recovery', explorationDepth: .2 }] };
  const semantic = { intent: 'answer', focusIds: ['recovery'], latestMeaning: 'home is a relief', links: [], topics: [
    topic('recovery', 'relief at being home after a draining day', 'home', { evidence: [{ source: 'latest', quote: 'home' }], engagement: 'elaborating' }),
    topic('social', 'embarrassed and socially worn out', 'awkward wave', { coverage: 'untouched', unresolved: 'high' }),
  ] };
  const history = [{ role: 'ai', text: 'Was there any relief once you got home?' }];
  const answer = updateDebriefState(semantic, previous, 'that im home', history, false);
  assert.notEqual(answer.action, 'REFLECT');
  assert.doesNotMatch(responseContract(answer, semantic, {}).instruction, /no follow-up is required/);
  const question = updateDebriefState(semantic, previous, 'what do you remember?', history, true);
  assert.equal(question.action, 'REFLECT');
  assert.match(responseContract(question, semantic, {}).instruction, /Answer the latest direct question/);
});

test('settled current relief bridges to an unvisited concern before acknowledgements', () => {
  const previous = { action: 'DEEPEN', focusIds: ['recovery'], topics: [{ id: 'recovery', explorationDepth: .75 }] };
  const semantic = { intent: 'explore', focusIds: ['recovery'], latestMeaning: 'dinner and games sound good', links: [], topics: [
    topic('recovery', 'plans to rest at home', 'eat dinner', { state: 'settled', coverage: 'developed', unresolved: 'low', evidence: [{ source: 'latest', quote: 'eat dinner' }], engagement: 'elaborating' }),
    topic('social', 'awkward outing and low social energy', 'social battery is on 1%', { coverage: 'untouched', unresolved: 'high', importance: 'high' }),
  ] };
  const state = updateDebriefState(semantic, previous, 'eat dinner and play games', [{ role: 'ai', text: 'What helps you unwind at home?' }]);
  assert.equal(state.action, 'SHIFT');
  assert.equal(state.focusIds[0], 'social');
});

test('assistant discussion cannot mark a journal-only concern as explored', () => {
  const previous = { action: 'DEEPEN', focusIds: ['home'], topics: [
    { id: 'home', explorationDepth: .35, userExplored: true },
    { id: 'social', explorationDepth: .75 },
  ] };
  const semantic = { intent: 'explore', focusIds: ['home'], latestMeaning: 'dinner and games sound good', links: [], topics: [
    topic('home', 'home feels like relief', 'home', { coverage: 'developed', unresolved: 'low', evidence: [{ source: 'latest', quote: 'dinner and games' }], engagement: 'elaborating' }),
    topic('social', 'embarrassing outing and low social battery', 'low social battery', { coverage: 'developed', unresolved: 'high', importance: 'high' }),
  ] };
  const state = updateDebriefState(semantic, previous, 'dinner and games sound good', [{ role: 'ai', text: 'What sounds relaxing at home?' }]);
  assert.ok(state.topics.find(t => t.id === 'social').explorationDepth <= .2);
  assert.equal(state.action, 'SHIFT');
  assert.equal(state.focusIds[0], 'social');
});

test('short substantive answer to the companion can bridge to a comparable unvisited thread', () => {
  const previous = { action: 'EXPLORE', focusIds: ['home'], topics: [{ id: 'home', explorationDepth: .2 }, { id: 'social', explorationDepth: 0 }] };
  const semantic = { intent: 'explore', focusIds: ['home'], latestMeaning: 'being home is relief', links: [], topics: [
    topic('home', 'relief at getting home', 'home', { coverage: 'surface', unresolved: 'medium', importance: 'medium' }),
    topic('social', 'embarrassment and low social energy', 'social battery', { coverage: 'untouched', unresolved: 'medium', importance: 'medium' }),
  ] };
  const history = [{ role: 'ai', text: 'was there any part of today that felt like a relief?' }];
  const answer = updateDebriefState(semantic, previous, 'that im home', history, false);
  assert.equal(answer.action, 'SHIFT');
  assert.equal(answer.focusIds[0], 'social');
  const acknowledgement = updateDebriefState(semantic, previous, 'mhm', history, false);
  assert.notEqual(acknowledgement.action, 'SHIFT');
});

test('a last-straw answer stays in focus, then a stalled thread bridges before landing', () => {
  const entry = 'my stomach made a noise on the bus and someone looked. later my laptop updated while everyone waited for my file. now i am home but still need catch up on work and want a shower first.';
  const makeSemantic = (latest, engagement = 'acknowledging') => ({ intent: 'explore', focusIds: ['laptop'], latestMeaning: latest,
    links: [{ from: 'laptop', to: 'work', support: 'explicit', evidence: [{ source: 'journal', quote: 'still need catch up on work' }] }],
    topics: [
      topic('laptop', 'frustrated that the laptop update delayed the project while others waited', 'everyone waited for my file', {
        evidence: [{ source: 'journal', quote: 'everyone waited for my file' }, { source: 'latest', quote: latest }],
        coverage: 'surface', engagement, importance: 'high', emotionalIntensity: 'high', unresolved: 'medium' }),
      topic('work', 'worn out at home with unfinished work and wanting to pause', 'still need catch up on work', {
        coverage: 'untouched', importance: 'high', emotionalIntensity: 'medium', unresolved: 'high' }),
      topic('bus', 'embarrassment on the bus', 'my stomach made a noise', {
        coverage: 'untouched', importance: 'medium', emotionalIntensity: 'medium', unresolved: 'medium' }),
    ] });
  const answer = updateDebriefState(makeSemantic('the laptop was the last straw brah', 'elaborating'),
    { action: 'EXPLORE', focusIds: ['laptop'], topics: [{ id: 'laptop', explorationDepth: 0 }] },
    'the laptop was the last straw brah', [{ role: 'ai', text: 'What happened with the project?' }]);
  assert.equal(answer.focusIds[0], 'laptop');
  assert.equal(answer.lowProgressStreak, 0);
  const agreement = updateDebriefState(makeSemantic('exactly lor'), answer, 'exactly lor',
    [{ role: 'ai', text: 'What happened with the project?' }, { role: 'user', text: 'the laptop was the last straw brah' },
      { role: 'ai', text: 'The timing was awful with everyone waiting.' }]);
  assert.equal(agreement.focusIds[0], 'laptop');
  assert.equal(agreement.lowProgressStreak, 1);
  const stalled = updateDebriefState(makeSemantic('haiss so annoying eh'), agreement, 'haiss so annoying eh',
    [{ role: 'ai', text: 'What happened with the project?' }, { role: 'user', text: 'the laptop was the last straw brah' },
      { role: 'ai', text: 'The timing was awful with everyone waiting.' }, { role: 'user', text: 'exactly lor' },
      { role: 'ai', text: 'Yeah, that update really dragged.' }]);
  assert.equal(stalled.action, 'SHIFT');
  assert.equal(stalled.focusIds[0], 'work');
  assert.ok(stalled.remainingCoverageDebt > 0);
  assert.equal(responseContract(stalled, makeSemantic('haiss so annoying eh'), {}).transition.to,
    'worn out at home with unfinished work and wanting to pause');
});

test('a journal opening cannot outsource topic priority to a forced incident ranking', () => {
  const entry = 'i felt paiseh on the bus, later my project got delayed, and now i am too tired to do more work';
  const plan = buildConversationResponsePlan({ originalEntry: entry, userMessage: entry });
  plan.questionBudget = 1;
  assert.equal(validateConversationReply('bro, out of all that chaos, which moment hit you hardest, the bus, the project, or getting home?', plan).reason,
    'outsources-journal-priority-to-user');
});
