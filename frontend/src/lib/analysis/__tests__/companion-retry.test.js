import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRetryDecision, companionFailureMessage } from '../companion-retry.js';

test('transient failures retry the same saved turn automatically, with a cap', () => {
  assert.deepEqual(companionRetryDecision({ code: 'transient' }, 1), { automatic: true, delayMs: 900 });
  assert.deepEqual(companionRetryDecision({ code: 'quality_rejected' }, 1), { automatic: false, delayMs: 0 });
  assert.equal(companionRetryDecision({ code: 'transient' }, 3).automatic, false);
});

test('configuration and long rate limits do not loop in the UI', () => {
  assert.equal(companionRetryDecision({ code: 'not_configured' }, 1).automatic, false);
  assert.equal(companionRetryDecision({ status: 401 }, 1).automatic, false);
  assert.equal(companionRetryDecision({ code: 'rate_limited', retryAfterMs: 5000 }, 1).delayMs, 5000);
  assert.equal(companionRetryDecision({ code: 'rate_limited', retryAfterMs: 60000 }, 1).automatic, false);
  assert.match(companionFailureMessage({ code: 'rate_limited', retryAfterMs: 60000 }), /about 1 minute/);
});
