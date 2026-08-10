/**
 * Single entry point for Groq chat completions.
 *
 * The endpoint, model and key used to be repeated at four call sites, which is
 * how the key name drifted out of sync with .env.example and left the whole
 * companion silently serving canned strings. Everything funnels through here.
 */

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.3-70b-versatile";

export const getGroqKey = () => import.meta.env.VITE_GROQ_API_KEY;
export const hasGroqKey = () => Boolean(getGroqKey());

// One warning per session, not one per keystroke.
let warned = false;
export function warnIfNoKey(feature) {
  if (hasGroqKey() || warned) return;
  warned = true;
  console.warn(
    `[Kindred] VITE_GROQ_API_KEY is not set — ${feature} and every other AI ` +
    `feature will fall back to canned text. Create a .env file in the project ` +
    `root with VITE_GROQ_API_KEY=your-key (see .env.example), then restart ` +
    `the dev server — Vite only reads .env at startup.`
  );
}

/**
 * Sends a chat completion and returns the assistant's message text.
 * Throws on a missing key, a non-2xx response, or an empty completion, so
 * callers can decide between retrying, falling back, or surfacing the error.
 */
export async function groqChat({ messages, temperature = 0.85, maxTokens = 200 }) {
  const apiKey = getGroqKey();
  if (!apiKey) throw new Error("VITE_GROQ_API_KEY not set");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Groq API ${response.status}: ${body.error?.message || "unknown error"}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty Groq response");
  return text;
}

/** Pulls the first JSON object out of a completion, tolerating prose around it. */
export function parseJsonFromCompletion(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Groq response");
  return JSON.parse(match[0]);
}
