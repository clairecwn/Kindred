/** Client retry policy for one saved turn ID. The transport already retries a
 * request and fails over models; this handles a whole turn when that fails. */
export function companionRetryDecision(error, failedAttempts = 1) {
  const count = Math.max(1, Number(failedAttempts) || 1);
  if (count >= 3 || error?.code === 'not_configured' || [400, 401, 403, 404].includes(error?.status)) {
    return { automatic: false, delayMs: 0 };
  }
  const retryable = error?.code === 'rate_limited' || error?.code === 'transient'
    || error?.status === 429
    || error?.status >= 500 || error?.name === 'AbortError' || error instanceof TypeError;
  if (!retryable) return { automatic: false, delayMs: 0 };
  const requested = Number(error?.retryAfterMs);
  const delayMs = Number.isFinite(requested) && requested > 0 ? requested
    : 900 * 2 ** (count - 1);
  return { automatic: delayMs <= 30_000, delayMs: Math.min(30_000, Math.max(250, delayMs)) };
}

export function companionFailureMessage(error, kind = 'message', automatic = false) {
  const saved = kind === 'entry' ? 'Your entry is saved.' : 'Your message is saved.';
  if (automatic) return `${saved} Trying the companion again…`;
  if (error?.code === 'not_configured') return `${saved} The companion service is not configured yet.`;
  if (error?.code === 'rate_limited' || error?.status === 429) {
    const minutes = Math.ceil((Number(error?.retryAfterMs) || 0) / 60000);
    return `${saved} The companion is rate-limited right now.${minutes > 0 ? ` Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.` : ' Try again shortly.'}`;
  }
  return `${saved} The companion couldn't respond yet. You can retry below.`;
}
