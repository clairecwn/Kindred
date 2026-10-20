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

export const getGroqKey = () => import.meta.env?.VITE_GROQ_API_KEY;
export const hasGroqKey = () => Boolean(getGroqKey() || import.meta.env?.VITE_GEMINI_API_KEY);
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
    const timer = setTimeout(() => controller.abort(), Math.min(TIMEOUT_MS, remaining));
    const started = Date.now();
    try {
      const response = await fetch(request.url, { method: 'POST', headers: request.headers,
        body: JSON.stringify(request.body), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
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
        if (response.status === 429 && provider === 'Groq') {
          const cooldown = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 86400000)
            : dailyLimit ? 900000 : 60000;
          rateLimitedUntil.set(model, Date.now() + cooldown);
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
      console.info('[Kindred] Model request', { requestId, provider, model, latencyMs: Date.now() - started, attempt: attempt + 1 });
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
      max_tokens: model === LAST_RESORT_MODEL && options.responseFormat ? Math.max(options.maxTokens, 1600) : options.maxTokens,
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

export async function groqChat({ messages, temperature = .85, maxTokens = 200, responseFormat,
  reasoningEffort = 'low', modelOverride, fallbackModels } = {}) {
  const options = { messages, temperature, maxTokens, responseFormat, reasoningEffort };
  const groqKey = getGroqKey();
  const geminiKey = import.meta.env?.VITE_GEMINI_API_KEY;
  const groqModels = [...new Set([modelOverride || GROQ_MODEL, ...(fallbackModels ?? [FALLBACK_MODEL, LAST_RESORT_MODEL])].filter(Boolean))];
  const routes = [
    ...(groqKey ? groqModels.filter(model => (rateLimitedUntil.get(model) ?? 0) <= Date.now())
      .map(model => ({ provider: 'Groq', model, request: groqRequest(model, options, groqKey) })) : []),
    ...(geminiKey ? [{ provider: 'Gemini', model: GEMINI_MODEL, request: geminiRequest(options, geminiKey) }] : []),
  ];
  if (!routes.length) {
    const unavailable = new Error(groqKey || geminiKey ? 'All configured models are temporarily rate-limited' : 'Companion unavailable: AI service is not configured');
    unavailable.code = groqKey || geminiKey ? 'rate_limited' : 'not_configured';
    unavailable.retryAfterMs = groqKey ? Math.min(...groqModels.map(model => Math.max(0, (rateLimitedUntil.get(model) ?? Date.now()) - Date.now()))) : 0;
    throw unavailable;
  }
  let error;
  const deadlineAt = Date.now() + TURN_REQUEST_BUDGET_MS;
  for (const route of routes) {
    if (Date.now() >= deadlineAt) break;
    try { return await requestWithRetry(route.provider, route.model, route.request, deadlineAt); }
    catch (failure) { error = failure; }
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
