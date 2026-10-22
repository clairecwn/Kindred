/** Opt-in, blind A/B replay of the same journal turns and response contract.
 * Usage: node --env-file=.env scripts/compare-journal-models.mjs
 * This sends the fictional regression fixture to each configured provider. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { hasArtificialStyleTell, formalityPenalty } from '../src/lib/analysis/companion-style.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(await readFile(resolve(root, 'src/lib/analysis/__tests__/fixtures/write-journal-entry.json'), 'utf8'));
const groqKey = process.env.VITE_GROQ_API_KEY;
const geminiKey = process.env.VITE_GEMINI_API_KEY;
const models = [
  ...(groqKey ? [{ provider: 'Groq', model: process.env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b' },
    { provider: 'Groq', model: process.env.VITE_GROQ_FALLBACK_MODEL || 'qwen/qwen3.8-27b' }] : []),
  ...(geminiKey ? [{ provider: 'Gemini', model: process.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash' }] : []),
];
if (models.length < 2) {
  console.error('Configure at least two model routes in .env to run a comparison. No requests sent.');
  process.exit(1);
}
const cases = [
  { turnIndex: 5, action: 'VALIDATE', focus: 'nap feels unproductive and groggy afterward', maxQuestions: 1 },
  { turnIndex: 7, action: 'DEEPEN', focus: 'tired after a long day; guilt about resting and waiting readings', maxQuestions: 1 },
  { turnIndex: 9, action: 'SOFT_CLOSE', focus: 'tiredness, nap guilt and readings pressure; fries are incidental', maxQuestions: 0 },
];

async function complete(route, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  const started = Date.now();
  try {
    let response;
    if (route.provider === 'Groq') {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: route.model, temperature: .55, max_tokens: 280,
          messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }] }) });
    } else {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(route.model)}:generateContent`, {
        method: 'POST', signal: controller.signal,
        headers: { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
          generationConfig: { temperature: .55, maxOutputTokens: 280 } }) });
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${String(data.error?.message ?? 'unknown').slice(0, 100)}`);
    const text = route.provider === 'Groq' ? data.choices?.[0]?.message?.content?.trim()
      : data.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('').trim();
    if (!text) throw new Error('empty completion');
    return { text, latencyMs: Date.now() - started, error: null };
  } catch (error) { return { text: '', latencyMs: Date.now() - started, error: error.message }; }
  finally { clearTimeout(timeout); }
}

const blind = [];
const mapping = [];
for (const [caseIndex, current] of cases.entries()) {
  const turn = fixture.turns[current.turnIndex];
  const prompt = {
    system: `You are Kindred, a casual journaling companion. Policy action: ${current.action}. Focus: ${current.focus}. Validate before interpreting. Stay with the user's tiredness, nap guilt and readings; incidental comic details are context. Ask at most ${current.maxQuestions} useful question. If SOFT_CLOSE, offer a warm optional landing that can reopen. Match lowercase and light Singlish naturally, without parroting. Avoid invented psychological mechanisms, formal/clinical phrases, and unsupported causes. 1-3 short sentences.`,
    user: JSON.stringify({ journal: fixture.journal, conversation: fixture.turns.slice(0, current.turnIndex).filter((_, index) => !fixture.badAssistantTurnIndexes.includes(index)), latest: turn.text }),
  };
  const outputs = [];
  for (const route of models) {
    const result = await complete(route, prompt);
    outputs.push({ ...result, styleFlag: hasArtificialStyleTell(result.text),
      formalityPenalty: formalityPenalty(result.text, { register: 'casual' }),
      questionCount: (result.text.match(/\?/g) ?? []).length,
      friesFollowup: /\bfries\b[^?]*\?/i.test(result.text) });
  }
  const order = outputs.map((_, index) => index).sort((a, b) => ((a + caseIndex) % outputs.length) - ((b + caseIndex) % outputs.length));
  blind.push({ latest: turn.text, action: current.action, expectedFocus: current.focus,
    variants: order.map((index, rank) => ({ label: String.fromCharCode(65 + rank), ...outputs[index] })) });
  mapping.push({ latest: turn.text, variants: order.map((index, rank) => ({ label: String.fromCharCode(65 + rank), ...models[index] })) });
}
const out = resolve(root, 'tmp', 'journal-model-comparison');
await mkdir(out, { recursive: true });
await writeFile(resolve(out, 'blind.json'), JSON.stringify(blind, null, 2));
await writeFile(resolve(out, 'models.json'), JSON.stringify(mapping, null, 2));
console.log('Wrote blind replies and model mapping to tmp/journal-model-comparison/. Rate focus, validation, factual grounding, continuation and voice by hand before reading models.json.');
