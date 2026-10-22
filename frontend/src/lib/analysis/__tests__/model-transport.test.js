import test from 'node:test';
import assert from 'node:assert/strict';
import { requestWithRetry } from '../../groq.js';

test('model transport retries a transient server error and returns only assistant text', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? { ok: false, status: 503, headers: { get: () => null }, json: async () => ({ error: { message: 'busy' } }) }
      : { ok: true, json: async () => ({ text: 'I am here' }) };
  };
  try {
    const result = await requestWithRetry('test', 'model', { url: 'https://example.test', headers: {}, body: {}, read: data => data.text });
    assert.equal(result, 'I am here');
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('model transport does not retry a permanent client error', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return { ok: false, status: 401, headers: { get: () => null }, json: async () => ({ error: { message: 'unauthorized' } }) }; };
  try {
    await assert.rejects(requestWithRetry('test', 'model', { url: 'https://example.test', headers: {}, body: {}, read: () => '' }), /401/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('daily 429 quota exhaustion fails over without retrying that model', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return { ok: false, status: 429,
    headers: { get: () => '1800' }, json: async () => ({ error: { message: 'Rate limit reached on tokens per day (TPD)' } }) }; };
  try {
    await assert.rejects(requestWithRetry('test', 'model', { url: 'https://example.test', headers: {}, body: {}, read: () => '' }), /429/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('minute-scale 429 also fails over immediately and exposes retry timing', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return { ok: false, status: 429,
    headers: { get: name => name === 'retry-after' ? '3' : null }, json: async () => ({ error: { message: 'TPM reached' } }) }; };
  try {
    await assert.rejects(requestWithRetry('Groq', 'test-minute-model', { url: 'https://example.test', headers: {}, body: {}, read: () => '' }), error => {
      assert.equal(error.status, 429);
      assert.equal(error.retryAfterMs, 3000);
      return true;
    });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('invalid completions and provider capacity errors fail over without repeating a doomed request', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return { ok: false, status: 498,
    headers: { get: () => null }, json: async () => ({ error: { message: 'capacity exceeded' } }) }; };
  try {
    await assert.rejects(requestWithRetry('Groq', 'capacity-model', { url: 'https://example.test', headers: {}, body: {}, read: () => '' }),
      error => error.code === 'transient' && error.status === 498);
    assert.equal(calls, 1);
    globalThis.fetch = async () => { calls += 1; return { ok: true, json: async () => ({ text: '' }) }; };
    await assert.rejects(requestWithRetry('Groq', 'empty-model', { url: 'https://example.test', headers: {}, body: {}, read: data => data.text }),
      error => error.code === 'empty_completion');
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});
