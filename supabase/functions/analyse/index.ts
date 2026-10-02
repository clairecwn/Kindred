// supabase/functions/analyse/index.ts
//
// Hides the Groq API key server-side. Today VITE_GROQ_API_KEY ships inside
// the client bundle (see docs/backend/02-nlp-and-llm-strategy.md section 0,
// item 1 — "the single most urgent item in this document"), so any user can
// view-source the key and spend it. This function is the fix: the client
// calls this Edge Function with a Supabase auth JWT, never with a Groq key,
// and only structured, validated output goes back to the browser.
//
// Deploy: supabase functions deploy analyse
// Secrets: supabase secrets set GROQ_API_KEY=...
// (GROQ_API_KEY is a Supabase Edge Function secret, never a VITE_ variable.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.2";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_TEXT_LENGTH = 8000; // generous ceiling for a single journal entry
const MAX_MESSAGES = 12;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Minimal, dependency-free input validation. Reject early and specifically. */
function validateRequest(payload: unknown): { ok: true; text: string; context: Record<string, unknown> } | { ok: false; error: string } {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "request body must be a JSON object" };
  }
  const body = payload as Record<string, unknown>;

  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return { ok: false, error: "`text` is required and must be a non-empty string" };
  }
  if (body.text.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `\`text\` exceeds the maximum length of ${MAX_TEXT_LENGTH} characters` };
  }

  const context = (typeof body.context === "object" && body.context !== null ? body.context : {}) as Record<string, unknown>;

  // Soft signals only — never accept a declared ethnicity field, by design
  // (see src/lib/analysis/cultural-calibration.js).
  if ("ethnicity" in context || "race" in context) {
    return { ok: false, error: "ethnicity/race fields are not accepted; use locale/region/journalLanguageHint only" };
  }

  return { ok: true, text: body.text, context };
}

async function authenticate(req: Request): Promise<{ userId: string } | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return { userId: data.user.id };
}

async function callGroq(text: string, strategyBrief: string): Promise<string> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured on the server");

  const messages = [
    {
      role: "system",
      content:
        "You are Kindred's companion realisation layer. You receive a strategy " +
        "brief and must produce ONLY the reply text described by that brief. " +
        "Reflect one concrete detail before exploring. Prefer an accurate " +
        "reflection to generic reassurance; ask at most one specific question. " +
        "Do not give advice unless the brief says the user requested it. Avoid " +
        "therapy-speak, motivational slogans, exaggerated warmth, and canned " +
        "phrases such as 'thank you for sharing' or 'your feelings are valid'. " +
        "Understand dialect and cultural terms without imitating or stereotyping them. " +
        "Never invent facts about the user. Never give medical, legal, or " +
        "diagnostic advice. Never use clinical terms (depression, anxiety " +
        "disorder, trauma, PTSD, bipolar, diagnosis).",
    },
    { role: "user", content: `${strategyBrief}\n\nENTRY:\n${text}` },
  ];

  if (messages.length > MAX_MESSAGES) {
    throw new Error("too many messages constructed for this request");
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.45,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Groq API ${response.status}: ${body.error?.message ?? "unknown error"}`);
  }

  const data = await response.json();
  const out = data.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("empty completion from Groq");
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  const auth = await authenticate(req);
  if (!auth) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  const validated = validateRequest(payload);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }

  // The deterministic strategy-selection stage (doc 02 section 4, stage 1)
  // is expected to run before this function is called and to pass its
  // chosen brief through — this function only realises prose, it never
  // decides the strategy itself. A minimal default brief is used when none
  // is supplied so the function is still safely callable standalone.
  const body = payload as Record<string, unknown>;
  const strategyBrief =
    typeof body.strategyBrief === "string" && body.strategyBrief.trim().length > 0
      ? body.strategyBrief
      : "STRATEGY: reflective listening\nLENGTH: 2 sentences, 25-45 words\nVOICE: warm, plain, second person, present tense\nMUST NOT: give advice, ask a question, use clinical terms.";

  try {
    const reply = await callGroq(validated.text, strategyBrief);
    return jsonResponse({
      reply,
      model: GROQ_MODEL,
      userId: auth.userId,
    });
  } catch (err) {
    console.error("[analyse] Groq call failed:", err);
    return jsonResponse({ error: "analysis failed, please try again" }, 502);
  }
});
