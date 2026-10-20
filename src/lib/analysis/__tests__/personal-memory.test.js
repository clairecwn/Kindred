import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonalMemory, resolvePersonalMemory, retrievePersonalContext, formatPersonalContext } from '../personal-memory.js';
import { conversationSources, evaluateSemanticConversation } from '../semantic-conversation.js';

const entries = [
  { id: 'b', date: '2026-10-02', text: 'met emily for dinner hehe. i love when we gossip about our lives sia.',
    aiChat: [{ role: 'user', text: 'by tea i mean gossip/stories about my life', isJournal: false },
      { role: 'ai', text: 'You are anxious whenever you see Emily.' }] },
  { id: 'a', date: '2026-09-20', text: 'omg shopping with emily was fun lol, i like hearing her stories.',
    aiChat: [{ role: 'user', text: 'we got so much tea to share haha' }] },
];

test('personal memory builds from user evidence, including chats, and excludes assistant assertions', () => {
  const profile = buildPersonalMemory(entries);
  assert.equal(profile.sourceCount, 2);
  assert.equal(profile.style.register, 'casual');
  assert.ok(profile.style.particles.includes('sia'));
  assert.ok(profile.style.colloquialMarkers.includes('omg'));
  assert.ok(profile.people.some(person => person.name === 'emily'));
  assert.ok(profile.definitions.some(item => item.term === 'tea' && item.quote.includes('gossip')));
  assert.ok(profile.selfReports.some(item => item.quote.includes('hearing her stories')));
  assert.ok(profile.humorExamples.length);
  assert.doesNotMatch(JSON.stringify(profile), /You are anxious/);
});

test('only relevant old claims are retrieved; deletion invalidates the saved cache', () => {
  const profile = buildPersonalMemory(entries);
  const relevant = retrievePersonalContext('emily and our dinner', profile);
  assert.ok(relevant.some(item => item.name === 'emily'));
  assert.ok(retrievePersonalContext(`${'crowded train lecture assignment project '.repeat(25)} emily`, profile)
    .some(item => item.name === 'emily'));
  assert.ok(retrievePersonalContext('got any tea today', profile).some(item => item.term === 'tea'));
  assert.equal(retrievePersonalContext('exam deadline and lecturer', profile).length, 0);
  assert.equal(resolvePersonalMemory(profile, entries), profile);
  const afterDeletion = resolvePersonalMemory(profile, entries.filter(entry => entry.id !== 'b'));
  assert.notEqual(afterDeletion.fingerprint, profile.fingerprint);
  assert.equal(afterDeletion.sourceCount, 1);
  assert.ok(!afterDeletion.selfReports.some(item => item.quote.includes('love when')));
  assert.doesNotMatch(formatPersonalContext(profile, []), /emily/i);
});

test('historical profile evidence can support a current topic but cannot create one or set current affect', () => {
  const plan = { history: [], currentMessage: 'dinner with emily was awkward', memory: { memories: [] },
    personalContext: [{ quote: 'met emily for dinner', sourceId: 'b' }] };
  const sources = conversationSources(plan, 'dinner felt weird');
  assert.ok(sources.some(source => source.id === 'profile-0'));
  const raw = { intent: 'explore', latestFocusId: 'friend', topics: [
    { id: 'friend', summary: 'awkward dinner', evidence: [{ source: 'latest', quote: 'dinner with emily was awkward' },
      { source: 'profile-0', quote: 'met emily for dinner' }], state: 'open', engagement: 'new', importance: 'high' },
    { id: 'old', summary: 'old dinner', evidence: [{ source: 'profile-0', quote: 'met emily for dinner' }] },
  ], affect: [{ label: 'happy', strength: 'high', time: 'current', evidence: [{ source: 'profile-0', quote: 'met emily for dinner' }] }] };
  const result = evaluateSemanticConversation(raw, sources);
  assert.deepEqual(result.topics.map(topic => topic.id), ['friend']);
  assert.equal(result.affect.label, '');
});

test('explicit style requests survive into later entries without becoming a personality label', () => {
  const profile = buildPersonalMemory([{ id: 'old', date: '2026-09-30', text: 'Today was busy.',
    aiChat: [{ role: 'user', text: 'pls talk more like a friend and dont copy my typos' }] },
  { id: 'new', date: '2026-10-04', text: 'The lecture ran long.' }]);
  assert.ok(profile.communicationPreferences.some(item => item.quote.includes('talk more like a friend')));
  assert.match(formatPersonalContext(profile, []), /explicit chat-style requests/);
  assert.doesNotMatch(JSON.stringify(profile), /personalityType|genZ|ageGroup/);
});
