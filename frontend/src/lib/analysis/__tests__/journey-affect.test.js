import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyAffect, weeklyAffect, displayEntryEmotion } from '../journey-affect.js';
import { updateJournalConversation } from '../journal-conversation-state.js';
import { buildVoiceProfile } from '../conversation-guidance.js';
import { softenCasualWording, formalityPenalty } from '../companion-style.js';

const entry = (date, emotion, id) => ({ id, date, source: 'checkin', emotion });

test('all entries on a date contribute equally regardless of array order', () => {
  const entries = [entry('2026-10-08', 'happy', 1), entry('2026-10-08', 'sad', 2)];
  const day = dailyAffect(entries, '2026-10-08');
  const reversed = dailyAffect([...entries].reverse(), '2026-10-08');
  assert.deepEqual(day, reversed);
  assert.equal(day.count, 2);
  assert.notEqual(day.emotion, 'happy');
  assert.notEqual(day.emotion, 'sad');
});

test('week averages day means rather than counting prolific days repeatedly', () => {
  const dates = ['2026-10-06', '2026-10-07'];
  const entries = [entry(dates[0], 'happy', 1), entry(dates[1], 'sad', 2)];
  const baseline = weeklyAffect(entries, dates);
  const repeated = weeklyAffect([...entries, ...Array.from({ length: 9 }, (_, i) => entry(dates[0], 'happy', i + 3))], dates);
  for (const axis of ['valence', 'arousal', 'dominance']) {
    assert.ok(Math.abs(repeated.vad[axis] - baseline.vad[axis]) < 1e-12);
  }
  assert.equal(repeated.dayCount, 2);
});

test('chat meaning produces a concise display emotion while a filler leaves affect unchanged', () => {
  const journal = { id: 1, date: '2026-10-08', text: 'i feel damn frustrated about today', emotion: 'frustrated and tired' };
  const first = updateJournalConversation(journal, [{ role: 'user', text: journal.text, isJournal: true }]);
  assert.match(first.emotion, /^[a-z]+$/);
  const withChat = updateJournalConversation(first, [
    { role: 'user', text: journal.text, isJournal: true },
    { role: 'ai', text: 'what happened?' },
    { role: 'user', text: 'i felt really happy when we met later' },
  ]);
  // `emotion` stays a family key for the avatar and world; the specific
  // words people see live in `emotionLabel`.
  assert.equal(withChat.emotionLabel, displayEntryEmotion(withChat));
  assert.match(withChat.emotionLabel, /happy/);
  const filler = updateJournalConversation(withChat, [
    { role: 'user', text: journal.text, isJournal: true },
    { role: 'ai', text: 'what happened?' },
    { role: 'user', text: 'i felt really happy when we met later' },
    { role: 'ai', text: 'got it' },
    { role: 'user', text: 'mhm' },
  ]);
  assert.deepEqual(filler.conversationAffect.vad, withChat.conversationAffect.vad);
});

test('historical multiword labels keep their specific words instead of collapsing to a family', () => {
  assert.equal(displayEntryEmotion({ emotion: 'frustrated and tired' }), 'frustrated & tired');
  assert.equal(displayEntryEmotion({ emotion: 'completely made up feeling' }), 'neutral');
});

test('casual voice survives a short follow-up and rejects polished phrasing', () => {
  const voice = buildVoiceProfile('wah tdy damn shag sia i just wanna go home after class',
    [{ role: 'user', text: 'idk lah today was a lot' }], 'mhm');
  assert.equal(voice.register, 'casual');
  assert.equal(softenCasualWording('That is annoying. Did they tell you earlier?', voice),
    "that's annoying. did they tell you earlier?");
  assert.ok(formalityPenalty('Perhaps this is an opportunity to decompress and shift the energy.', voice) >= .45);
});
