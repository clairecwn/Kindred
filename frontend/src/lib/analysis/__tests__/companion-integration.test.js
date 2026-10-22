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
    assert.match(calls[0].messages[0].content, /Their own recent messages.*tdy was damn suay sia/s);
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
    assert.match(calls[0].messages[0].content, /Casual words they use:[^\n]*\bomg\b[^\n]*\bbrah\b/);
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
    assert.match(calls[0].messages[0].content, /Singlish particles they use/);
    assert.match(calls[0].messages[0].content, /How they laugh in text/);
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

test('the restless-but-unmotivated journal gets a processing move, not a made-up cause or a dead end', async () => {
  const journal = `tdy was damn sian sia idk why my mood so off since morning... woke up to like 20 messages in the grp chat cos apparently my friends planning some outing and everyone arguing over where to eat HAHAHA like bro its just dinner why yall planning like wedding liddat... then aftn i went gym thinking i could be productive but legit after 20min i already wanna go home sia, somemore got this guy keep hogging the machine while scrolling his phone like HELLO some of us got places to be leh. then later went to dabao dinner and the auntie gave me the wrong order but i only realise when i reach home... wah i was craving chicken rice the whole day then suddenly got fishball noodles staring at me instead 😭 hais i just eat la too lazy to go back. now supposed to start my assignment but i keep opening my laptop then closing it again like got commitment issues sia... lowk feel damn restless but also dw do anything, idk whats wrong w me tdy honestly`;
  const assessor = {
    intent: 'explore', latestMeaning: 'off all day, restless but unmotivated, avoiding the assignment, does not know why', latestFocusId: 'off-mood',
    topics: [
      { id: 'off-mood', summary: 'mood off all day; restless but unmotivated, unsure why', evidence: [{ source: 'latest', quote: 'lowk feel damn restless but also dw do anything' }, { source: 'latest', quote: 'idk why my mood so off since morning' }],
        state: 'open', engagement: 'new', coverage: 'untouched', importance: 'high', emotionalIntensity: 'medium', unresolved: 'high', facet: 'experience' },
      { id: 'assignment', summary: 'keeps opening and closing the laptop instead of starting the assignment', evidence: [{ source: 'latest', quote: 'i keep opening my laptop then closing it again' }],
        state: 'open', engagement: 'new', coverage: 'untouched', importance: 'medium', emotionalIntensity: 'medium', unresolved: 'high', facet: 'experience' },
      { id: 'gym', summary: 'gym felt pointless and a guy hogged the machine', evidence: [{ source: 'latest', quote: 'got this guy keep hogging the machine' }],
        state: 'open', engagement: 'new', coverage: 'untouched', importance: 'low', emotionalIntensity: 'low', unresolved: 'low', facet: 'context' },
    ],
    links: [], affect: [{ label: 'restless', strength: 'high', time: 'current', evidence: [{ source: 'latest', quote: 'lowk feel damn restless' }] },
      { label: 'unmotivated', strength: 'high', time: 'current', evidence: [{ source: 'latest', quote: 'dw do anything' }] }],
    interpretation: { gloss: 'felt off and restless all day for no clear reason, but also cannot get started on anything', mode: 'venting', need: 'make-sense',
      terms: [{ term: 'sian', senseId: 'fed-up', meaning: 'fed up', confidence: 'medium' }], valence: -0.4, valenceConfidence: 0.7, unknownTerms: [], followUps: [] },
  };
  const madeUpCause = "damn that's a lot of bad luck stacked on top of each other lol. no wonder u feel restless, ur brain is just fried from all the noise and wrong food.";
  const processing = "damn the whole day was just small annoying things piling up sia. but the restless yet dw do anything feeling, is it more like ur tired, or more like something's sitting at the back of ur mind?";
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.VITE_GROQ_API_KEY;
  process.env.VITE_GROQ_API_KEY = 'synthetic-test-key';
  const calls = [];
  let writerDrafts = [madeUpCause, processing];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    const system = body.messages[0].content;
    const content = /Assess a journaling conversation/.test(system) ? JSON.stringify(assessor)
      : /Write two different replies/.test(system) ? JSON.stringify({ drafts: writerDrafts }) : writerDrafts[1];
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content } }] }) };
  };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { AIJournalist } = await vite.ssrLoadModule('/src/lib/journal-ai.js');
    const journalist = new AIJournalist();
    const opening = await journalist.generateChatReply(journal, [], journal, '', 'friend', [], { returnDetails: true });
    const writer = calls.find(call => /Write two different replies/.test(call.messages[0].content));
    assert.ok(writer, 'writer was asked for move-specific drafts');
    assert.match(writer.messages[0].content, /Draft 1: (?:In one casual sentence, offer two concrete|Wonder out loud)/);
    assert.match(writer.messages[0].content, /don't tell them why/);
    assert.equal(opening.text, processing, 'the reply that wonders with them beats the one that invents a cause');
    assert.ok(opening.conversationState.movesUsed?.length === 1);
    assert.equal(opening.interpretation.need, 'make-sense');

    // "ya sia": a brief agreement must not get an echo with nothing to answer.
    const echo = 'i feel ya, all that noise just makes u wanna shut everything off lol';
    const nextStep = "ya the gym and the noodles were just noise i think. the laptop open close thing tho, is it the assignment itself or just no energy for anything rn?";
    writerDrafts = [echo, nextStep];
    calls.length = 0;
    const history = [{ role: 'user', text: journal, isJournal: true }, { role: 'ai', text: opening.text }];
    const second = await journalist.generateChatReply('ya sia', history, journal, '', 'friend', [], { returnDetails: true, conversationState: opening.conversationState });
    assert.equal(second.text, nextStep);
    assert.equal(second.conversationState.movesUsed.length, 2);
  } finally {
    await vite.close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.VITE_GROQ_API_KEY;
    else process.env.VITE_GROQ_API_KEY = originalKey;
  }
});
