import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import fixture from './fixtures/shower-misread.json' with { type: 'json' };

test('a pushback turn repairs without an assessor call and keeps the user turn intact', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.VITE_GROQ_API_KEY;
  process.env.VITE_GROQ_API_KEY = 'synthetic-test-key';
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop',
      message: { content: 'my bad, i made the shower into a whole thing. the studying is what feels huge after that messy day.' } }] }) };
  };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { AIJournalist } = await vite.ssrLoadModule('/src/lib/journal-ai.js');
    const previous = { action: 'EXPLORE', focusIds: ['shower'], topics: [
      { id: 'shower', summary: 'the shower', facet: 'context', evidence: [{ source: 'journal', quote: 'shower first' }], priority: 1, incidental: false, state: 'open' },
      { id: 'study', summary: 'study pressure', facet: 'decision', evidence: [{ source: 'journal', quote: 'supposed to continue studying' }], priority: 2, incidental: false, state: 'open' },
    ] };
    const result = await new AIJournalist().generateChatReply('ok wtv', fixture.turns.slice(0, 3), fixture.journal,
      '', 'friend', [], { returnDetails: true, conversationState: previous });
    assert.equal(result.conversationState.action, 'REPAIR');
    assert.deepEqual(result.conversationState.focusIds, ['study']);
    assert.equal(calls.length, 1);
    assert.ok(!calls[0].response_format);
    assert.match(result.text, /my bad/);
  } finally {
    await vite.close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.VITE_GROQ_API_KEY;
    else process.env.VITE_GROQ_API_KEY = originalKey;
  }
});

test('a polished reply is rewritten into the established Singlish texting voice', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.VITE_GROQ_API_KEY;
  process.env.VITE_GROQ_API_KEY = 'synthetic-test-key';
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    const content = calls.length === 1
      ? 'you are supposed to continue studying, but the day has been a lot. it is understandable that you want a break now.'
      : 'my bad, i made the shower into a whole thing sia. you were saying studying still feels damn heavy after today.';
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content } }] }) };
  };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { AIJournalist } = await vite.ssrLoadModule('/src/lib/journal-ai.js');
    const previous = { action: 'EXPLORE', focusIds: ['shower'], topics: [
      { id: 'shower', summary: 'the shower', facet: 'context', evidence: [{ source: 'journal', quote: 'shower first' }], priority: 1, incidental: false, state: 'open' },
      { id: 'study', summary: 'study pressure', facet: 'decision', evidence: [{ source: 'journal', quote: 'supposed to continue studying' }], priority: 2, incidental: false, state: 'open' },
    ] };
    const result = await new AIJournalist().generateChatReply('ok wtv', fixture.turns.slice(0, 3), fixture.journal,
      '', 'friend', [], { returnDetails: true, conversationState: previous });
    assert.equal(calls.length, 2);
    assert.match(calls[0].messages[0].content, /VOICE REFERENCE FROM THIS USER.*tdy was damn suay sia/s);
    assert.match(calls[1].messages[1].content, /"failure":"(?:voice-drift-from-user|style-too-formal-for-user)"/, calls[1].messages[1].content);
    assert.match(result.text, /whole thing sia/);
  } finally {
    await vite.close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.VITE_GROQ_API_KEY;
    else process.env.VITE_GROQ_API_KEY = originalKey;
  }
});

test('an expressive non-regional texting voice is used without copied typos or added particles', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.VITE_GROQ_API_KEY;
  process.env.VITE_GROQ_API_KEY = 'synthetic-test-key';
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    const content = calls.length === 1
      ? 'you are frustrated by the change of plans and would like to be understood.'
      : "my bad, i jumped to fixing it. brah, they changed the plans AGAIN when you'd already sorted everything.";
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content } }] }) };
  };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { AIJournalist } = await vite.ssrLoadModule('/src/lib/journal-ai.js');
    const journal = 'omggg my friends changed the plans again?? that is so crazyyy HAHAHA brah wthelly, i had everything sorted already';
    const previous = { action: 'EXPLORE', focusIds: ['plans'], topics: [
      { id: 'plans', summary: 'annoyed that plans changed', facet: 'experience',
        evidence: [{ source: 'journal', quote: 'friends changed the plans again' }], priority: 1, incidental: false, state: 'open' },
    ] };
    const result = await new AIJournalist().generateChatReply('wtv', [{ role: 'ai', text: 'What step could you take to fix the plans?' }],
      journal, '', 'friend', [], { returnDetails: true, conversationState: previous });
    assert.equal(calls.length, 2);
    assert.match(calls[0].messages[0].content, /observed casual expressions.*"omg".*"brah"/s);
    assert.match(calls[1].messages[1].content, /"failure":"voice-drift-from-user"/);
    assert.match(result.text, /brah.*AGAIN/s);
    assert.doesNotMatch(result.text, /\b(?:sia|lah|lor|wthelly)\b/i);
  } finally {
    await vite.close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.VITE_GROQ_API_KEY;
    else process.env.VITE_GROQ_API_KEY = originalKey;
  }
});

test('repeated choice reaches a casual landing without treating old assistant prose as a voice example', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.VITE_GROQ_API_KEY;
  process.env.VITE_GROQ_API_KEY = 'synthetic-test-key';
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop',
      message: { content: 'ya lor, you said scroll later. i kept making it into a whole thing, sorry. go chill first.' } }] }) };
  };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { AIJournalist } = await vite.ssrLoadModule('/src/lib/journal-ai.js');
    const journal = 'wah tdy damn shag sia, quick errand became a side quest HAHAHA. now im home but got work left, maybe scroll later lor';
    const history = [
      { role: 'ai', text: "what's one thing you'd do to rest later?" },
      { role: 'user', text: 'scroll tiktok' },
      { role: 'ai', text: 'What mental cue would allow you to decompress after scrolling?' },
    ];
    const previous = { action: 'REPAIR', focusIds: ['rest'], topics: [
      { id: 'rest', summary: 'wants to rest before work', facet: 'decision',
        evidence: [{ source: 'journal', quote: 'maybe scroll later' }], incidental: false, state: 'open' },
    ] };
    const result = await new AIJournalist().generateChatReply('scroll tiktok', history, journal, '', 'friend', [],
      { returnDetails: true, conversationState: previous });
    assert.equal(result.conversationState.action, 'SOFT_CLOSE');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].messages.every(message => message.role !== 'assistant'));
    assert.match(calls[0].messages[0].content, /regional particles/);
    assert.match(calls[0].messages[0].content, /laughter forms/);
    assert.match(result.text, /ya lor/);
  } finally {
    await vite.close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.VITE_GROQ_API_KEY;
    else process.env.VITE_GROQ_API_KEY = originalKey;
  }
});

test('assessor can leave an open topic without forcing a filler question', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.VITE_GROQ_API_KEY;
  process.env.VITE_GROQ_API_KEY = 'synthetic-test-key';
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    const content = request.response_format?.type === 'json_object'
      ? JSON.stringify({ intent: 'explore', latestMeaning: 'tired after an errand with work left', latestFocusId: 'workRest',
        topics: [{ id: 'workRest', summary: 'tired and still has work left', evidence: [{ source: 'latest', quote: 'got work left' }],
          state: 'open', engagement: 'new', coverage: 'surface', importance: 'high', emotionalIntensity: 'medium',
          unresolved: 'medium', incidental: false, facet: 'decision' }], links: [], affect: [] })
      : "wah, that was a lot of travelling for nothing sia. you're home now but the work is still there, so wanting a bit of time to chill makes sense.";
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content } }] }) };
  };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { AIJournalist } = await vite.ssrLoadModule('/src/lib/journal-ai.js');
    const journal = 'wah tdy i went all the way to the library and it was closed sia. now im home and got work left but lowk need a break first';
    const result = await new AIJournalist().generateChatReply(journal, [], journal, '', 'friend', [], { returnDetails: true });
    assert.equal(calls.length, 2);
    assert.equal(result.conversationState.action, 'VALIDATE');
    assert.ok(!result.text.includes('?'));
  } finally {
    await vite.close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.VITE_GROQ_API_KEY;
    else process.env.VITE_GROQ_API_KEY = originalKey;
  }
});

test('a fresh journal rejects a token-casual recap and readiness prompt', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.VITE_GROQ_API_KEY;
  process.env.VITE_GROQ_API_KEY = 'synthetic-test-key';
  const calls = [];
  const journal = 'tdy was damn paiseh sia. the chair kept making fart sounds in the library and i sat there frozen cos everyone confirm thought it was me. now im home and supposed to revise but my brain feels gone already, lowk just wanna stare into space first haisss';
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    const content = request.response_format?.type === 'json_object'
      ? JSON.stringify({ intent: 'explore', latestMeaning: 'embarrassed in the library and worn out before revision', latestFocusId: 'publicEmbarrassment',
        topics: [{ id: 'publicEmbarrassment', summary: 'being embarrassed in the library', evidence: [{ source: 'journal', quote: 'the chair kept making fart sounds in the library and i sat there frozen' }],
          state: 'open', engagement: 'new', coverage: 'untouched', importance: 'high', emotionalIntensity: 'high', unresolved: 'high',
          incidental: false, facet: 'experience', questionStatus: 'novel', question: { dimension: 'how', purpose: 'experience',
            informationGap: 'whether the embarrassment is still bothering them now', groundingQuote: 'i sat there frozen',
            informationGain: 'high', relevance: 'high', userEffort: 'low', repetitionRisk: 'low', taskDirected: false } }], links: [], affect: [] })
      : calls.length === 2
        ? 'damn, all those little mishaps stacked up and turned your day sideways. what is the one tiny thing that could make you feel ready before you dive back into studying?'
        : 'wah the library chair one damn paiseh sia, especially when you had to sit so still. is that part still bugging you now, or are you mostly just shag from the whole day?';
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content } }] }) };
  };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { AIJournalist } = await vite.ssrLoadModule('/src/lib/journal-ai.js');
    const result = await new AIJournalist().generateChatReply(journal, [], journal, '', 'friend', [], { returnDetails: true });
    assert.equal(calls.length, 3);
    assert.match(calls[1].messages[0].content, /questionGoal.*whether the embarrassment is still bothering them now/s);
    assert.match(calls[2].messages[1].content, /low-value-comfort-or-meta-question|stock-companion-language/);
    assert.match(result.text, /library chair/);
    assert.doesNotMatch(result.text, /dive back|tiny thing|day sideways/);
  } finally {
    await vite.close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.VITE_GROQ_API_KEY;
    else process.env.VITE_GROQ_API_KEY = originalKey;
  }
});

test('the opening uses the modeled focus instead of a three-incident interview question', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.VITE_GROQ_API_KEY;
  process.env.VITE_GROQ_API_KEY = 'synthetic-test-key';
  const calls = [];
  const journal = 'tdy was damn messy sia, stomach made noise on the bus and someone looked. lunch was disappointing too. then my laptop updated right when everyone needed my project file brah. now im home and so shag but still got work to catch up on haisss';
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    const content = request.response_format?.type === 'json_object'
      ? JSON.stringify({ intent: 'explore', latestMeaning: 'project delay compounded an exhausting day', latestFocusId: 'project',
        topics: [
          { id: 'project', summary: 'laptop update delayed the group project', evidence: [{ source: 'journal', quote: 'my laptop updated right when everyone needed my project file' }],
            state: 'open', engagement: 'new', coverage: 'untouched', importance: 'high', emotionalIntensity: 'high', unresolved: 'high',
            incidental: false, facet: 'experience', questionStatus: 'novel', question: { dimension: 'what', purpose: 'clarification',
              informationGap: 'whether the file was sent after the update', groundingQuote: 'everyone needed my project file',
              informationGain: 'high', relevance: 'high', userEffort: 'low', repetitionRisk: 'low', taskDirected: false } },
          { id: 'tired', summary: 'still tired with catch-up work waiting at home', evidence: [{ source: 'journal', quote: 'now im home and so shag but still got work to catch up on' }],
            state: 'open', engagement: 'none', coverage: 'untouched', importance: 'high', emotionalIntensity: 'medium', unresolved: 'high', incidental: false, facet: 'decision' },
        ], links: [], affect: [] })
      : calls.length === 2
        ? 'bro, out of all that chaos, which moment hit you hardest, the bus, the lunch, or the laptop?'
        : 'brah that laptop picked the worst timing sia, with everyone waiting for your file. did it finish updating in time for you to send it?';
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content } }] }) };
  };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { AIJournalist } = await vite.ssrLoadModule('/src/lib/journal-ai.js');
    const result = await new AIJournalist().generateChatReply(journal, [], journal, '', 'friend', [], { returnDetails: true });
    assert.equal(calls.length, 3);
    assert.match(calls[2].messages[1].content, /outsources-journal-priority-to-user/);
    assert.match(result.text, /finish updating/);
    assert.doesNotMatch(result.text, /which moment|the bus, the lunch/);
  } finally {
    await vite.close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.VITE_GROQ_API_KEY;
    else process.env.VITE_GROQ_API_KEY = originalKey;
  }
});
