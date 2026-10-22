/** Shared model transport. Retry transient failures, then try configured fallbacks.
 * Keys prefixed VITE_ are suitable for local testing only, not public deployment. */
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = import.meta.env?.VITE_GROQ_MODEL || 'openai/gpt-oss-120b';
const FALLBACK_MODEL = import.meta.env?.VITE_GROQ_FALLBACK_MODEL || 'openai/gpt-oss-20b';
const LAST_RESORT_MODEL = import.meta.env?.VITE_GROQ_LAST_RESORT_MODEL || 'qwen/qwen3.8-27b';
const GEMINI_MODEL = import.meta.env?.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
const TIMEOUT_MS = 15000;
const TURN_REQUEST_BUDGET_MS = 45000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const rateLimitedUntil = new Map();
// Token budget per model from Groq's x-ratelimit-* headers, so a request that
// would 429 goes to another model (separate bucket) or waits a few seconds
// instead of failing. { remaining, resetAt } where resetAt is ms epoch.
const tokenBudget = new Map();
const MAX_QUEUE_WAIT_MS = 12000;
// Free-tier output-tokens-per-minute caps: a request asking for more output
// than this is rejected outright ("Request too large"), so skip that route.
const OUTPUT_CAP = { 'qwen/qwen3.8-27b': 1000 };

/** "7.66s", "2m59.56s", "450ms" -> ms. */
export function parseResetDuration(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  let ms = 0;
  for (const [, n, unit] of text.matchAll(/([\d.]+)(ms|h|m|s)/g)) ms += Number(n) * ({ ms: 1, s: 1000, m: 60000, h: 3600000 })[unit];
  return Number.isFinite(ms) ? ms : 0;
}
/** Rough token estimate for a chat request (chars/3.6 plus the output allowance). */
export function estimateTokens(options) {
  const chars = (options.messages ?? []).reduce((n, m) => n + String(m.content ?? '').length, 0);
  return Math.ceil(chars / 3.6) + (options.maxTokens ?? 200);
}
function budgetWait(model, need) {
  const b = tokenBudget.get(model);
  if (!b || Date.now() >= b.resetAt || b.remaining >= need) return 0;
  return b.resetAt - Date.now();
}
function noteHeaders(model, response) {
  const remaining = Number(response.headers?.get?.('x-ratelimit-remaining-tokens'));
  if (!Number.isFinite(remaining)) return;
  tokenBudget.set(model, { remaining, resetAt: Date.now() + parseResetDuration(response.headers?.get?.('x-ratelimit-reset-tokens')) });
}

// Tests and scripts may inject settings through globalThis.__KINDRED_ENV__.
const env = () => ({ ...(import.meta.env ?? {}), ...(globalThis.__KINDRED_ENV__ ?? {}) });
export const getGroqKey = () => env().VITE_GROQ_API_KEY;
export const hasGroqKey = () => Boolean(getGroqKey() || env().VITE_GEMINI_API_KEY || env().VITE_LOCAL_LLM_URL || env().VITE_OPENROUTER_API_KEY);
let warned = false;
export function warnIfNoKey(feature) {
  if (hasGroqKey() || warned) return;
  warned = true;
  console.warn(`[Kindred] No model key is configured; ${feature} is unavailable. Set VITE_GROQ_API_KEY in .env and restart Vite.`);
}

function retryDelay(response, attempt) {
  const seconds = Number(response?.headers?.get?.('retry-after'));
  const retryAfter = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
  return Math.min(8000, Math.max(retryAfter, 350 * 2 ** attempt) + Math.random() * 160);
}

export async function requestWithRetry(provider, model, request, deadlineAt = Infinity) {
  let lastError;
  const requestId = globalThis.crypto?.randomUUID?.() ?? `request-${Date.now()}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) {
      const timeout = new Error(`${provider} request budget exhausted`);
      timeout.code = 'transient';
      throw timeout;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(request.timeoutMs ?? TIMEOUT_MS, remaining));
    const started = Date.now();
    try {
      const response = await fetch(request.url, { method: 'POST', headers: request.headers,
        body: JSON.stringify(request.body), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (provider === 'Groq') noteHeaders(model, response);
      if (!response.ok) {
        const fullMessage = String(data.error?.message ?? response.statusText ?? 'request failed');
        const message = fullMessage.slice(0, 180);
        const error = new Error(`${provider} ${model} HTTP ${response.status}: ${message}`);
        error.status = response.status;
        const dailyLimit = response.status === 429 && /\b(?:TPD|RPD|tokens per day|requests per day)\b/i.test(fullMessage);
        const retryAfter = Number(response.headers?.get?.('retry-after'));
        // Another configured model is preferable to waiting and charging
        // multiple attempts against the same rate-limited route.
        error.retryable = response.status === 408 || response.status >= 500;
        if ([422, 498].includes(response.status)) error.code = 'transient';
        if (response.status === 429 && provider !== 'Gemini') {
          const cooldown = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 86400000)
            : dailyLimit ? 900000 : 60000;
          rateLimitedUntil.set(request.limitKey ?? model, Date.now() + cooldown);
          error.retryAfterMs = cooldown;
        }
        error.response = response;
        throw error;
      }
      const value = request.read(data);
      if (!value) {
        const error = new Error(`${provider} ${model} returned an empty completion`);
        error.code = 'empty_completion';
        error.retryable = false;
        throw error;
      }
      console.info('[Kindred] Model request', { requestId, provider, model, latencyMs: Date.now() - started, attempt: attempt + 1,
        promptTokens: data.usage?.prompt_tokens, cachedTokens: data.usage?.prompt_tokens_details?.cached_tokens });
      return value;
    } catch (error) {
      lastError = error;
      const retryable = error.name === 'AbortError' || error instanceof TypeError || error.retryable;
      console.warn('[Kindred] Model request failed', { requestId, provider, model, attempt: attempt + 1,
        errorType: error.status === 429 ? 'rate-limit' : error.status === 498 ? 'capacity' : error.status >= 500 ? 'server'
          : error.name === 'AbortError' ? 'timeout' : error instanceof TypeError ? 'network' : error.code ?? 'request',
        status: error.status ?? error.code ?? (error.name === 'AbortError' ? 'timeout' : 'network'), latencyMs: Date.now() - started });
      if (!retryable || attempt === 1 || deadlineAt - Date.now() < 700) break;
      await sleep(Math.min(retryDelay(error.response, attempt), Math.max(0, deadlineAt - Date.now() - 500)));
    } finally { clearTimeout(timer); }
  }
  throw lastError;
}

function groqRequest(model, options, apiKey) {
  return { url: GROQ_ENDPOINT,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: { model, messages: options.messages, temperature: options.temperature,
      max_tokens: options.maxTokens,
      ...(model.startsWith('openai/gpt-oss-') ? { reasoning_effort: options.reasoningEffort } : {}),
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}) },
    read: data => {
      const value = data.choices?.[0]?.finish_reason === 'length' ? '' : data.choices?.[0]?.message?.content?.trim();
      if (value && options.responseFormat?.type === 'json_object') {
        try { parseJsonFromCompletion(value); }
        catch { const error = new Error(`${model} returned invalid JSON`); error.code = 'invalid_completion'; error.retryable = false; throw error; }
      }
      return value;
    } };
}

function geminiRequest(options, apiKey) {
  const instructions = options.messages.filter(message => message.role === 'system').map(message => message.content).join('\n');
  const contents = options.messages.filter(message => message.role !== 'system').map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
  return { url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: { ...(instructions ? { systemInstruction: { parts: [{ text: instructions }] } } : {}), contents,
      generationConfig: { temperature: options.temperature, maxOutputTokens: options.maxTokens,
        ...(options.responseFormat?.type === 'json_object' ? { responseMimeType: 'application/json' } : {}) } },
    read: data => data.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('').trim() };
}

/** Any OpenAI-compatible endpoint (local Ollama / LM Studio, OpenRouter). */
function openAICompatibleRequest({ url, apiKey, model, options, extraBody = {}, timeoutMs, limitKey }) {
  return { url, timeoutMs, limitKey,
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: { model, messages: options.messages, temperature: options.temperature, max_tokens: options.maxTokens,
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}), ...extraBody },
    read: data => {
      const value = data.choices?.[0]?.finish_reason === 'length' ? '' : data.choices?.[0]?.message?.content?.trim();
      if (value && options.responseFormat?.type === 'json_object') {
        try { parseJsonFromCompletion(value); }
        catch { const error = new Error(`${model} returned invalid JSON`); error.code = 'invalid_completion'; error.retryable = false; throw error; }
      }
      return value;
    } };
}

/**
 * Provider order. VITE_LLM_ORDER (comma list of local, groq, openrouter,
 * gemini) wins; otherwise a configured local model goes first, because
 * during development it has no rate limits and no cost.
 */
function providerOrder() {
  const explicit = String(env().VITE_LLM_ORDER ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (explicit.length) return explicit;
  return [...(env().VITE_LOCAL_LLM_URL ? ['local'] : []), 'groq', 'openrouter', 'gemini'];
}

/** Optional response cache for repeatable test runs (scripts set globalThis.__KINDRED_LLM_CACHE__). */
const llmCache = () => globalThis.__KINDRED_LLM_CACHE__;
function cacheKey(options, models) {
  const text = JSON.stringify([models[0], options.messages, options.temperature, options.maxTokens]);
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${(h >>> 0).toString(36)}-${text.length}`;
}

export async function groqChat({ messages, temperature = .85, maxTokens = 200, responseFormat,
  reasoningEffort = 'low', modelOverride, fallbackModels } = {}) {
  const options = { messages, temperature, maxTokens, responseFormat, reasoningEffort };
  const groqKey = getGroqKey();
  const geminiKey = env().VITE_GEMINI_API_KEY;
  const localUrl = String(env().VITE_LOCAL_LLM_URL ?? '').replace(/\/+$/, '');
  const openRouterKey = env().VITE_OPENROUTER_API_KEY;
  const groqModels = [...new Set([modelOverride || GROQ_MODEL, ...(fallbackModels ?? [FALLBACK_MODEL, LAST_RESORT_MODEL])].filter(Boolean))];
  const cache = llmCache();
  const key = cache ? cacheKey(options, groqModels) : null;
  if (cache && cache.has(key)) return cache.get(key);

  const need = estimateTokens(options);
  const fits = model => !OUTPUT_CAP[model] || maxTokens <= OUTPUT_CAP[model];
  const cooled = limitKey => (rateLimitedUntil.get(limitKey) ?? 0) <= Date.now();
  const available = model => fits(model) && cooled(model) && budgetWait(model, need) === 0;
  let ready = groqKey ? groqModels.filter(available) : [];
  const others = () => (localUrl ? 1 : 0) + (openRouterKey && cooled('openrouter') ? 1 : 0) + (geminiKey ? 1 : 0);
  // Every Groq bucket is momentarily short but refills within a few seconds,
  // and nothing else is configured: wait for the soonest one rather than fail.
  if (groqKey && !ready.length && !others()) {
    const soonest = Math.min(...groqModels.filter(fits).map(model => Math.max((rateLimitedUntil.get(model) ?? 0) - Date.now(), budgetWait(model, need))));
    if (soonest > 0 && soonest <= MAX_QUEUE_WAIT_MS) {
      console.info('[Kindred] Waiting for model token budget', { waitMs: Math.round(soonest) });
      await sleep(soonest + 150);
      ready = groqModels.filter(model => fits(model) && cooled(model));
    }
  }
  const byProvider = {
    local: localUrl && cooled('local') ? [{ provider: 'Local', model: env().VITE_LOCAL_LLM_MODEL || 'gpt-oss:20b',
      request: openAICompatibleRequest({ url: `${localUrl}/chat/completions`, apiKey: env().VITE_LOCAL_LLM_KEY,
        model: env().VITE_LOCAL_LLM_MODEL || 'gpt-oss:20b', options, timeoutMs: 120000, limitKey: 'local',
        extraBody: { reasoning_effort: reasoningEffort } }) }] : [],
    groq: ready.map(model => ({ provider: 'Groq', model, request: groqRequest(model, options, groqKey) })),
    openrouter: openRouterKey && cooled('openrouter') ? [{ provider: 'OpenRouter', model: env().VITE_OPENROUTER_MODEL || 'openai/gpt-oss-120b:free',
      request: openAICompatibleRequest({ url: 'https://openrouter.ai/api/v1/chat/completions', apiKey: openRouterKey,
        model: env().VITE_OPENROUTER_MODEL || 'openai/gpt-oss-120b:free', options, limitKey: 'openrouter', timeoutMs: 30000,
        extraBody: { reasoning: { effort: reasoningEffort } } }) }] : [],
    gemini: geminiKey ? [{ provider: 'Gemini', model: GEMINI_MODEL, request: geminiRequest(options, geminiKey) }] : [],
  };
  const routes = providerOrder().flatMap(name => byProvider[name] ?? []);
  if (!routes.length) {
    const configured = groqKey || geminiKey || localUrl || openRouterKey;
    const unavailable = new Error(configured ? 'All configured models are temporarily rate-limited' : 'Companion unavailable: AI service is not configured');
    unavailable.code = configured ? 'rate_limited' : 'not_configured';
    unavailable.retryAfterMs = groqKey ? Math.min(...groqModels.map(model => Math.max(0, (rateLimitedUntil.get(model) ?? Date.now()) - Date.now(), budgetWait(model, need)))) : 0;
    throw unavailable;
  }
  let error;
  // A local model is slower than Groq: give the turn room when it is in the chain.
  const deadlineAt = Date.now() + (localUrl ? 150000 : TURN_REQUEST_BUDGET_MS);
  for (const route of routes) {
    if (Date.now() >= deadlineAt) break;
    try {
      const value = await requestWithRetry(route.provider, route.model, route.request, deadlineAt);
      if (cache) cache.set(key, value);
      return value;
    }
    catch (failure) {
      error = failure;
      // Ollama not running: stop trying it for a few minutes so every call
      // doesn't pay a failed connection before reaching Groq.
      if (route.provider === 'Local' && (failure instanceof TypeError || failure?.name === 'AbortError' || !failure?.status)) {
        rateLimitedUntil.set('local', Date.now() + 300000);
      }
    }
  }
  if (!error) { error = new Error('Model request budget exhausted'); error.code = 'transient'; }
  if (error?.status === 429) {
    error.code = 'rate_limited';
    const waits = groqModels.map(model => Math.max(0, (rateLimitedUntil.get(model) ?? 0) - Date.now())).filter(Boolean);
    if (waits.length) error.retryAfterMs = Math.min(...waits);
  }
  else if (error?.name === 'AbortError' || error instanceof TypeError || error?.status >= 500) error.code = 'transient';
  else if (['invalid_completion', 'empty_completion'].includes(error?.code)) error.code = 'transient';
  throw error;
}

export function parseJsonFromCompletion(raw) {
  const match = String(raw ?? '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in model response');
  return JSON.parse(match[0]);
}
