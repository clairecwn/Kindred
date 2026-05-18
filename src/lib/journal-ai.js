/**
 * journal-ai.js — The emotional heart of Kindred (FIXED)
 *
 * CHANGES:
 * - Removed the forced "INTERNAL CATEGORY" mapping to preset emotions
 * - Now allows Gemini to freely detect whatever emotions it finds
 * - Gemini output is now the actual nuanced emotion, not compressed to a category
 * - Increased temperature to 0.85 for more creative/honest emotion naming
 */

// ── Subtext Detection Patterns ────────────────────────────────────────────────

const MASKING = [
  /\bi'?m fine\b/i,
  /\bi'?m okay\b/i,
  /\bit'?s (okay|ok|fine|alright)\b/i,
  /\b(i )?guess (so|i'?m|it'?s)\b/i,
  /\bwhatever\b/i,
  /\bnot that bad\b/i,
  /\bcould (be|have been) worse\b/i,
  /\bnothing (special|much|really|new)\b/i,
  /\bsame (old|as (always|usual))\b/i,
  /\bdon'?t (really )?want to (talk|think) about it\b/i,
  /\bforget (it|about it)\b/i,
];

const HOPELESSNESS = [
  /\balways (like this|happens|this way|going to be)\b/i,
  /\bnothing (ever |will )?(changes?|works?|matters?|helps?|gets? better)\b/i,
  /\bwhat'?s the point\b/i,
  /\bdoesn'?t (even )?matter\b/i,
  /\bnever (gets?|going to|gonna|be able)\b/i,
  /\bforever (like this|alone|stuck|this way)\b/i,
  /\bgive up\b/i,
  /\bno point\b/i,
  /\bwhat'?s wrong with me\b/i,
  /\bcan'?t see (a way|any|anything) (out|forward|through)\b/i,
];

const ISOLATION = [
  /\b(all |completely |totally )alone\b/i,
  /\bno one (cares?|understands?|gets? it|is there|knows?)\b/i,
  /\bnobody (knows?|sees?|understands?|cares?)\b/i,
  /\bby (my)?self\b/i,
  /\bdon'?t belong\b/i,
  /\b(feel|am) invisible\b/i,
  /\bunheard\b/i,
  /\bmissed by nobody\b/i,
];

const PHYSICAL_STRUGGLE = [
  /\bcan'?t get out of bed\b/i,
  /\bno energy (to|for)\b/i,
  /\bcan'?t stop (crying|shaking|thinking)\b/i,
  /\bhaven'?t (eaten|slept|moved|left)\b/i,
  /\bstuck (in bed|at home|inside)\b/i,
  /\bweight (on|in) my (chest|body|heart)\b/i,
];

const EMOTIONAL_WEIGHT = {
  depression: [
    /\bempty\b/, /\bnumb\b/, /\bworthless\b/, /\bhopeless\b/,
    /\bcan'?t feel\b/, /\bcan'?t enjoy\b/, /\bcan'?t care\b/,
    /\bpoint(less)?\b/, /\bwhat'?s the use\b/,
  ],
  anxiety: [
    /\bcan'?t stop thinking\b/i, /\bwhat if\b/i,
    /\boverthink(ing)?\b/i, /\bspiral(ling)?\b/i,
    /\bscared that\b/i, /\bworry(ing)? about\b/i,
    /\bcan'?t calm (down|myself)\b/i, /\bpanic(king)?\b/i,
  ],
  grief: [
    /\bmiss (them|you|him|her|it|that)\b/i,
    /\bwish (things?|they|he|she|it|we)\b/i,
    /\bnot the same (without|anymore)\b/i,
    /\bleft (me|behind|alone)\b/i,
  ],
  overwhelm: [
    /\btoo much\b/i, /\bcan'?t handle\b/i, /\bfall apart\b/i,
    /\beverything at once\b/i, /\bcrumbling\b/i, /\bbreaking point\b/i,
    /\bdon'?t know (how|where) to start\b/i,
  ],
};

const POSITIVE_SUBTEXT = [
  /\b(finished|completed|accomplished|achieved)\b/i,
  /\b(productive|made progress|got through)\b/i,
  /\b(proud of|happy with) (myself|how|that)\b/i,
  /\b(finally|actually) did\b/i,
  /\bsmall win\b/i,
];

// ── EmotionDetector ───────────────────────────────────────────────────────────

export class EmotionDetector {
  /**
   * Deep contextual analysis of a journal entry.
   * Returns enriched emotion data including subtext signals and trajectory.
   */
  analyze(text, pastEntries = []) {
    const signals   = this._extractSignals(text);
    const base      = this._baseKeywordScan(text);
    const resolved  = this._resolveEmotion(signals, text, base);
    const trajectory = this._computeTrajectory(pastEntries);

    return {
      emotion:           resolved.emotion,
      confidence:        resolved.confidence,
      signals,
      trajectory,
      maskingDetected:   signals.masking.length > 0,
      subtextSummary:    this._buildSubtextSummary(signals),
      overrideReason:    resolved.overrideReason,
      needsVerification: signals.masking.length > 0 || resolved.confidence < 68,
    };
  }

  _extractSignals(text) {
    const scan = (patterns) => patterns.filter(p => p.test(text));

    const signals = {
      masking:         scan(MASKING),
      hopelessness:    scan(HOPELESSNESS),
      isolation:       scan(ISOLATION),
      physicalStruggle: scan(PHYSICAL_STRUGGLE),
      emotionalWeight: {},
      positiveSubtext: POSITIVE_SUBTEXT.some(p => p.test(text)),
      contradiction:   false,
      minimizing:      /\b(just|only|a bit|kind of|sort of|slightly|a little)\b/i.test(text),
    };

    for (const [cat, patterns] of Object.entries(EMOTIONAL_WEIGHT)) {
      signals.emotionalWeight[cat] = patterns.filter(p => p.test(text)).length;
    }

    // Contradiction: positive self-report followed by a contradicting conjunction
    if (/\b(fine|okay|good|great|happy)\b/i.test(text) &&
        /\b(but|although|however|though|still|yet|except)\b/i.test(text)) {
      signals.contradiction = true;
    }

    return signals;
  }

  _resolveEmotion(signals, text, base) {
    let { emotion, confidence } = base;
    let overrideReason = null;

    const { emotionalWeight: ew, masking, hopelessness, isolation } = signals;
    const depScore  = ew.depression || 0;
    const anxScore  = ew.anxiety    || 0;
    const overwhelm = ew.overwhelm  || 0;
    const grief     = ew.grief      || 0;

    // Strong depression signals override positive/neutral self-report
    if (depScore >= 2 && ["calm", "content", "neutral"].includes(emotion)) {
      emotion = "sad"; confidence = 74; overrideReason = "deep sadness beneath the surface";
    }

    // Masking + hopelessness = understating how they feel
    if (masking.length >= 2 && hopelessness.length > 0) {
      emotion = "sad"; confidence = 80; overrideReason = "masking with hopeless undertones";
    } else if (masking.length >= 1 && hopelessness.length >= 1) {
      emotion = emotion === "content" ? "sad" : emotion;
      confidence = Math.max(confidence, 68);
      overrideReason = overrideReason || "possible masking";
    }

    // Anxiety/overwhelm overrides
    if (anxScore >= 2 || overwhelm >= 2) {
      emotion = "anxious"; confidence = 76; overrideReason = "anxiety and overwhelm signals";
    }

    // Isolation pushes toward sad
    if (isolation.length >= 2 && emotion === "neutral") {
      emotion = "sad"; confidence = 70; overrideReason = "feelings of isolation";
    }

    // Grief
    if (grief >= 2 && !["sad", "anxious"].includes(emotion)) {
      emotion = "sad"; confidence = 72; overrideReason = "grief undertones";
    }

    // Contradiction: "fine BUT..." — analyze what comes after the conjunction
    if (signals.contradiction && masking.length > 0) {
      const afterConj = text.match(/(?:but|although|however|though|still)\s+(.+)/i);
      if (afterConj) {
        const afterScan = this._baseKeywordScan(afterConj[1]);
        if (afterScan.confidence > 50 && afterScan.emotion !== "neutral") {
          emotion = afterScan.emotion;
          confidence = Math.max(confidence, 68);
          overrideReason = "contradiction between stated feeling and emotional truth";
        }
      }
    }

    // Positive subtext boost for undecided entries
    if (signals.positiveSubtext && confidence < 62) {
      emotion = emotion === "neutral" ? "content" : emotion;
      confidence = Math.max(confidence, 62);
    }

    return { emotion, confidence, overrideReason };
  }

  _baseKeywordScan(text) {
    const t     = text.toLowerCase();
    const words = t.split(/\s+/);
    const NEGATORS = new Set(["not", "never", "barely", "hardly", "isn't", "wasn't", "don't", "didn't", "can't", "no", "without"]);

    const LEXICON = {
      happy:    ["happy", "joyful", "wonderful", "love", "smile", "bright", "elated", "glad", "cheerful", "sunshine", "light", "beaming"],
      excited:  ["excited", "thrilled", "pumped", "energized", "electric", "spark", "alive", "buzzing", "can't wait", "stoked"],
      calm:     ["calm", "peaceful", "settled", "grounded", "quiet", "still", "ease", "gentle", "serene", "centered", "balanced"],
      anxious:  ["anxious", "worried", "nervous", "stress", "tense", "uneasy", "overwhelm", "panic", "dread", "spiral", "overthink", "restless"],
      sad:      ["sad", "cry", "tears", "unhappy", "grief", "lonely", "hurt", "broken", "heavy", "low", "empty", "blue", "lost", "hollow", "numb", "depressed"],
      tired:    ["tired", "exhausted", "drained", "foggy", "sleepy", "burnt out", "flat", "weary", "depleted", "done"],
      angry:    ["angry", "furious", "irritated", "annoyed", "frustrated", "resentful", "mad", "rage", "bitter"],
      content:  ["content", "satisfied", "okay", "fine", "alright", "comfortable", "decent", "steady"],
      grateful: ["grateful", "thankful", "appreciate", "blessed", "lucky", "fortunate", "touched", "moved"],
    };

    const scores = Object.fromEntries(Object.keys(LEXICON).map(k => [k, 0]));

    for (const [emotion, terms] of Object.entries(LEXICON)) {
      for (const term of terms) {
        if (!t.includes(term)) continue;
        const idx = words.findIndex(w => w.startsWith(term.split(" ")[0]));
        const negated = idx > 0 && NEGATORS.has(words[idx - 1]);
        scores[emotion] += negated ? -1 : (term.length > 7 ? 2 : 1);
      }
    }

    const sorted  = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [top]   = sorted;
    const emotion = top && top[1] > 0 ? top[0] : "neutral";
    const confidence = Math.min(88, Math.max(48, 48 + Math.round((top?.[1] || 0) * 10)));

    return { emotion, confidence };
  }

  _computeTrajectory(pastEntries) {
    if (!pastEntries || pastEntries.length < 2) {
      return { trend: "unknown", label: "Your story is just beginning" };
    }

    const recent = pastEntries.slice(0, 6);
    const scores = recent.map(e => getWellnessScore(e.emotion));

    // Recent entries come first — split into "now" and "then" halves
    const half      = Math.ceil(scores.length / 2);
    const nowScores  = scores.slice(0, half);
    const thenScores = scores.slice(half);
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const diff = avg(nowScores) - avg(thenScores);

    if (Math.abs(diff) < 1) return { trend: "stable",    label: "Holding steady",            nowAvg: avg(nowScores) };
    if (diff > 0)           return { trend: "improving",  label: "Finding your footing again", nowAvg: avg(nowScores) };
    return                         { trend: "declining",  label: "A harder stretch lately",    nowAvg: avg(nowScores) };
  }

  _buildSubtextSummary(signals) {
    const parts = [];
    if (signals.masking.length > 0)              parts.push("masking language");
    if (signals.hopelessness.length > 0)          parts.push("hopeless undertones");
    if (signals.isolation.length > 0)             parts.push("isolation signals");
    if (signals.contradiction)                    parts.push("contradiction between words and tone");
    if ((signals.emotionalWeight.grief || 0) > 0) parts.push("grief");
    if ((signals.emotionalWeight.overwhelm||0)>0) parts.push("overwhelm");
    if (signals.positiveSubtext)                  parts.push("accomplishment signals");
    return parts.join(", ") || "no strong subtext";
  }
}

// ── Response Templates ─────────────────────────────────────────────────────────
// Used when Claude API is unavailable. Designed to feel like a real companion.

const COMPANION_RESPONSES = {
  _masking_sad: [
    "Something in how you wrote that made me pause. \"Fine\" can mean a lot of things — and sometimes it's the word we reach for when we don't quite have the energy to name the real thing. You don't have to.",
    "I noticed you said okay, but the rest of your words feel a little heavier than that. You don't have to perform being alright here.",
    "The word you used was fine, but I'm reading something else in the spaces between. That's okay. Sometimes language isn't enough for what we actually feel.",
  ],
  _masking_anxious: [
    "You said it's fine, but I can sense something underneath — a kind of low hum that hasn't quite settled. Does that feel closer to it?",
    "Something in your words feels like it's holding more than it's letting on. A kind of quiet tension. Am I reading that right?",
  ],
  _masking_default: [
    "I noticed the 'fine' — and I also noticed everything else you wrote. Those two things can both be true at once.",
    "There's more in what you wrote than you might realize. I'm here for all of it, not just the polished version.",
    "Something about the way you wrote that stayed with me. You don't have to explain — I just want you to know I caught it.",
  ],
  happy: [
    "There's something genuinely good in what you shared today. I don't want to rush past it — it matters.",
    "That sounds like a real moment. The good ones deserve to be noticed, and I'm noticing this one.",
    "Something lightened today. I'm glad.",
  ],
  excited: [
    "I can feel the energy in this. Hold onto that — it's yours.",
    "Something lit up for you today. That kind of spark is rare. I love seeing it in you.",
    "Whatever this is, it clearly means something to you. That matters.",
  ],
  calm: [
    "That stillness is rare and worth noticing. You found your footing today.",
    "Something settled for you. I'm curious what made it possible, if you want to sit with that.",
    "There's a quiet strength in what you described. Calm like this isn't passive — it's something earned.",
  ],
  content: [
    "Quietly okay is its own kind of good. The world doesn't always notice it, but I do.",
    "There's real steadiness in what you shared. That matters more than it might feel like.",
    "Content is underrated. It's the felt sense that things are, for now, okay — and that's actually profound.",
  ],
  grateful: [
    "Gratitude like this has a way of expanding. What you noticed — it's real, and it changes something.",
    "That's a beautiful thing to hold onto. What brought it up for you, do you think?",
    "I love when you write like this. Something in you opened today.",
  ],
  sad: [
    "I'm sitting with what you wrote. You don't have to be okay right now.",
    "Some days just feel like that. Heavy without a clear reason, or heavy with too many. Either way — I'm here.",
    "There's no rush through this. Whatever you're carrying — it's real, and you don't have to carry it alone.",
    "That sounds really hard. I'm not going to try to fix it or talk you out of it. I just want you to know I hear you.",
  ],
  anxious: [
    "That sounds like a lot to hold in your head at once. When everything feels urgent, nothing gets to be safe.",
    "Your nervous system is working overtime right now. That's exhausting in a way that's hard to explain to people who haven't felt it.",
    "Anxiety has a way of making everything feel like it needs to be solved immediately. You don't have to solve anything right now.",
    "I'm noticing the spin in your words. What would it feel like to just — not fix it for one minute?",
  ],
  tired: [
    "You've been going for a while, haven't you. Sometimes tired isn't just physical — it's the kind that settles in the bones.",
    "That kind of tired is different. Rest might help, but sometimes you also just need someone to acknowledge how much you've been carrying.",
    "Tiredness like this is your body asking for something real. You're allowed to listen.",
  ],
  angry: [
    "That frustration is telling you something. Anger often shows up when something that matters to us gets crossed.",
    "There's something real driving this. What does it feel like it's protecting?",
    "You're allowed to be angry. What I'm curious about is what's underneath it — what got hurt or disrespected?",
  ],
  neutral: [
    "Sometimes days just pass through, and that's okay. Not every day needs to mean something.",
    "Even in the in-between, you showed up. That counts for more than it might feel like.",
    "There's something to be said for just being present, even when nothing stands out. You're here.",
  ],
};

const TRAJECTORY_ADDONS = {
  improving: [
    " And I've noticed — compared to a few days ago, something has shifted. You seem a little more grounded.",
    " For what it's worth: you seem to be finding your way back to something. I don't want to make too much of it, but I see it.",
  ],
  declining: [
    " This stretch has been harder than the last few. I've been noticing.",
    " Something's been heavier on you recently. You don't have to explain it — I just want you to know I've seen it.",
  ],
  stable: [
    " You've been steady. That takes more than people think.",
  ],
};

const WIN_CELEBRATIONS = [
  " That right there — that's something. I know it might not feel huge, but I'm marking it.",
  " I want to say clearly: what you just described took real courage, even if it felt ordinary.",
  " You did something hard. That deserves to be named.",
];

// ── AIJournalist ──────────────────────────────────────────────────────────────

export class AIJournalist {
  constructor() {
    this.groqKey = import.meta.env.VITE_GROQ_API_KEY;
  }

  async generateResponse(text, analysis, pastEntries = [], playerName = "friend") {
    if (this.groqKey) {
      try {
        return await this._groqResponse(text, analysis, pastEntries, playerName);
      } catch (err) {
        console.warn("[Kindred] Groq fallback activated:", err.message);
      }
    }
    return this._templateResponse(text, analysis, pastEntries);
  }

  async _groqResponse(text, analysis, pastEntries, playerName) {
    const recentContext = pastEntries.slice(0, 4).map(e =>
      `${e.date}: Felt ${e.emotion}. "${e.text.slice(0, 100)}${e.text.length > 100 ? "..." : ""}"`
    ).join("\n");

    const systemPrompt = `You are an emotional intelligence expert reading journal entries. Your job is NOT to match keywords. Your job is to READ THE WHOLE MESSAGE like a human friend would — understanding tone, subtext, metaphor, narrative, and emotional context.

You will encounter:
- Colloquial language ("idk", "lol", "ugh", "tbh")
- Broken English, short forms, sentence fragments
- Metaphors and symbolic language ("cloudy" = mental fog, "stagnant" = stuck/frustrated, "weight" = burden)
- Subtext (what's unsaid but implied by tone)
- Mixed emotions (frustrated yet hopeful, exhausted but trying)
- Positive emotions expressed simply ("had a good day", "felt better", "things improving")

Read for:
1. TONE & VOICE: What emotional tone? Frustrated? Weary? Excited? Content?
2. NARRATIVE: What's the story? What happened? What's their situation?
3. SUBTEXT: What emotions are underneath? What are they really saying?
4. METAPHORS: "Cloudy" = mental fog. "Heavy" = burden. "Light" = relief. "Flowing" = ease.
5. SENTIMENT: Overall positive, negative, or mixed? Growing? Struggling? Accepting?

BOTH POSITIVE AND NEGATIVE equally:
- Detect joy, contentment, hope, relief, pride equally as frustration, sadness, exhaustion
- A person saying "I finished that project and felt proud" is NOT neutral — it's pride
- Don't bias toward negative emotions just because someone is venting

You are NOT looking for specific emotion words. You are reading what a human would read.`;

    const userPrompt = `Read this journal entry like a friend understanding their friend's actual emotional state.

TASK: What is this person's ACTUAL emotional state right now?

Instructions:
- Read the entire message for tone, sentiment, and narrative
- Look for subtext, metaphor, implied meanings
- Treat colloquial language as valid emotional signals
- Understand metaphors: "cloudy" = mental fog, "stagnant" = stuck, "weight" = burden, "flowing" = ease
- Don't just look for emotion words — read the narrative and tone
- Recognize positive emotions equally: pride, relief, contentment, peace, excitement, gratitude, hope
- Recognize negative emotions: frustration, exhaustion, overwhelm, dissatisfaction, sadness, anxiety
- Recognize mixed emotions: "tired but grateful", "frustrated yet hopeful"

Examples of what to detect:
- "The day feels long, so much work, don't like my 9-6, feel cloudy/stagnant" → frustrated, exhausted, drained, trapped
- "Finally finished that project, felt proud" → pride, accomplishment, relief
- "Things settling down, feeling more at peace" → calm, relief, contentment

Return ONLY valid JSON:
{"detectedEmotion": "honest read of their emotional state", "companionResponse": "warm response matching their tone"}

Journal entry:
"${text}"`;

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) throw new Error("VITE_GROQ_API_KEY not set");

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.9,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Groq API ${response.status}: ${error.error?.message || "unknown error"}`);
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content;

      if (!raw) throw new Error("Empty Groq response");

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in Groq response");

      const parsed = JSON.parse(jsonMatch[0]);
      const detectedEmotion = parsed.detectedEmotion?.trim();
      const companionResponse = parsed.companionResponse?.trim();

      if (!detectedEmotion) throw new Error("No detectedEmotion in response");
      if (!companionResponse) throw new Error("No companionResponse in response");

      console.info("[Kindred] Groq detected:", detectedEmotion);
      return { text: companionResponse, source: "groq", emotion: detectedEmotion };

    } catch (err) {
      console.error("[Kindred] Groq error:", err.message);
      throw err;
    }
  }

  async detectEmotion(summaryText, pastEntries = []) {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) return null;

    const recentContext = pastEntries.slice(0, 3).map(e =>
      `${e.date}: ${e.emotion}`
    ).join(", ");

    const systemPrompt = `You are a mental wellness expert analyzing wellbeing check-in data. Understand the person's overall emotional and mental state from the quiz results.

Read the FULL PICTURE:
- High energy + meaningful work + good sleep = energized, capable, engaged
- Low energy + difficulty with tasks + good relationships = tired but supported, content
- Mixed scores = complex state ("balanced but uncertain", "growing", "adjusting")
- Don't assume low scores = depression; might be "recovering", "tired but hopeful"
- High scores might not mean "happy"; might mean "anxious energy", "overwhelmed busyness"

Look at the whole story, not individual low numbers.`;

    const userPrompt = `Someone completed a mental wellbeing check-in. Read ALL dimensions together to understand their actual emotional and mental state.

${summaryText}
${recentContext ? `\nRecent emotional history: ${recentContext}` : ""}

Read the full wellness picture:
- If energy is high but meaning is low → "busy but unfulfilled" or "restless"
- If energy is low but relationships are strong → "tired but held" or "depleted but supported"
- If everything is balanced → "grounded", "stable", "in equilibrium"
- If mood is low but purpose is high → "struggling but driven" or "exhausted but committed"
- If everything is high → "thriving", "energized", "in flow"
- If everything is low → "depleted", "burnt out", "struggling"

Name the actual emotional state. Examples:
- "energized and engaged"
- "tired but supported"
- "overwhelmed and isolated"
- "recovering and rebuilding"
- "stable and content"

Return ONLY valid JSON:
{"emotion": "your honest read of their wellness state"}`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.75,
          max_tokens: 200
        })
      });

      if (!response.ok) throw new Error(`Groq API ${response.status}`);

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content;
      if (!raw) return null;

      const jsonMatch = raw.match(/\{[^}]+\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      const emotion = parsed.emotion?.trim();

      console.info("[Kindred] Quiz Groq detected:", emotion);
      return emotion;
    } catch (err) {
      console.warn("[Kindred] Quiz emotion detection failed:", err.message);
      return null;
    }
  }

  _templateResponse(text, analysis, pastEntries) {
    const { emotion, maskingDetected, trajectory } = analysis;

    let pool;
    if (maskingDetected) {
      pool = COMPANION_RESPONSES[`_masking_${emotion}`] || COMPANION_RESPONSES._masking_default;
    } else {
      pool = COMPANION_RESPONSES[emotion] || COMPANION_RESPONSES.neutral;
    }

    let response = pool[Math.floor(Math.random() * pool.length)];

    // Add trajectory context ~50% of the time when trend is known
    if (trajectory?.trend && trajectory.trend !== "unknown" && pastEntries.length >= 3 && Math.random() > 0.5) {
      const addons = TRAJECTORY_ADDONS[trajectory.trend];
      if (addons) response += addons[Math.floor(Math.random() * addons.length)];
    }

    // Celebrate wins
    if (POSITIVE_SUBTEXT.some(p => p.test(text)) && Math.random() > 0.4) {
      response += WIN_CELEBRATIONS[Math.floor(Math.random() * WIN_CELEBRATIONS.length)];
    }

    return { text: response, source: "companion" };
  }
}

function getWellnessScore(emotion) {
  if (!emotion) return 5;
  const PRESET = { happy: 9, excited: 9, grateful: 8, content: 7, calm: 7, neutral: 5, tired: 3, anxious: 3, angry: 3, sad: 2 };
  if (PRESET[emotion] !== undefined) return PRESET[emotion];
  const lower = emotion.toLowerCase();
  if (lower.includes("happy") || lower.includes("joy") || lower.includes("thrill") || lower.includes("elat")) return 9;
  if (lower.includes("excit") || lower.includes("energiz") || lower.includes("buzzing")) return 9;
  if (lower.includes("grateful") || lower.includes("thankful") || lower.includes("hopeful") || lower.includes("appreciat")) return 8;
  if (lower.includes("calm") || lower.includes("peace") || lower.includes("ground") || lower.includes("settl")) return 7;
  if (lower.includes("content") || lower.includes("okay") || lower.includes("fine") || lower.includes("steady")) return 7;
  if (lower.includes("tired") || lower.includes("exhaust") || lower.includes("drain") || lower.includes("weary")) return 3;
  if (lower.includes("anxious") || lower.includes("worried") || lower.includes("overwhelm") || lower.includes("panic")) return 3;
  if (lower.includes("angry") || lower.includes("frustrat") || lower.includes("irritat") || lower.includes("trap")) return 3;
  if (lower.includes("sad") || lower.includes("lone") || lower.includes("depress") || lower.includes("hollow")) return 2;
  return 5;
}

// ── JournalMemory ─────────────────────────────────────────────────────────────

export class JournalMemory {
  constructor(entries = []) {
    this.entries = entries;
  }

  /** Returns last `days` days as a slot array, each with the entry or null. */
  getTimeline(days = 14) {
    const today  = new Date();
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const entry   = this.entries.find(e => e.date === dateStr) ?? null;
      result.push({
        date:    dateStr,
        weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
        entry,
      });
    }
    return result;
  }

  getStreak() {
    if (!this.entries.length) return 0;
    const today = new Date().toISOString().slice(0, 10);
    const dates  = [...new Set(this.entries.map(e => e.date))].sort((a, b) => b.localeCompare(a));
    let streak   = 0;
    let expected = today;
    for (const date of dates) {
      if (date === expected) {
        streak++;
        const d = new Date(expected);
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().slice(0, 10);
      } else break;
    }
    return streak;
  }

  /** Returns moments where emotional wellbeing jumped significantly. */
  getGrowthMoments() {
    const moments  = [];
    for (let i = 1; i < this.entries.length; i++) {
      const prev = this.entries[i];
      const curr = this.entries[i - 1];
      const diff = getWellnessScore(curr.emotion) - getWellnessScore(prev.emotion);
      if (diff >= 3) moments.push({ date: curr.date, from: prev.emotion, to: curr.emotion });
    }
    return moments.slice(0, 3);
  }

  getDominantEmotion(lastN = 7) {
    const recent = this.entries.slice(0, lastN);
    if (!recent.length) return null;
    const counts = {};
    for (const e of recent) counts[e.emotion] = (counts[e.emotion] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  getWeekSummary() {
    return {
      dominant:      this.getDominantEmotion(7),
      streak:        this.getStreak(),
      growthMoments: this.getGrowthMoments(),
      totalEntries:  this.entries.length,
    };
  }
}

// ── World Mood Integration ────────────────────────────────────────────────────

const WORLD_MOODS = {
  happy:    { ambient: "rgba(255,248,220,0.45)", filter: "brightness(1.03) saturate(1.07)", label: "golden hour" },
  excited:  { ambient: "rgba(255,235,220,0.4)",  filter: "brightness(1.04) saturate(1.1)",  label: "vibrant" },
  calm:     { ambient: "rgba(224,245,235,0.3)",  filter: "brightness(1.00) saturate(0.98)", label: "still" },
  content:  { ambient: "rgba(245,245,235,0.3)",  filter: "brightness(1.01)",                label: "warm" },
  grateful: { ambient: "rgba(255,232,245,0.35)", filter: "brightness(1.02) saturate(1.03)", label: "rose" },
  neutral:  { ambient: "transparent",            filter: "none",                            label: "clear" },
  anxious:  { ambient: "rgba(235,230,255,0.3)",  filter: "brightness(0.99) saturate(0.93)", label: "tense" },
  tired:    { ambient: "rgba(220,225,245,0.35)", filter: "brightness(0.97) saturate(0.88)", label: "muted" },
  sad:      { ambient: "rgba(215,228,248,0.4)",  filter: "brightness(0.96) saturate(0.82)", label: "blue-hour" },
  angry:    { ambient: "rgba(255,230,225,0.3)",  filter: "brightness(0.98) saturate(1.02)", label: "warm-tense" },
};

export function getWorldMood(emotion) {
  return WORLD_MOODS[emotion] ?? WORLD_MOODS.neutral;
}

const NPC_RESPONSES = {
  sad:     [
    { type: "presence", action: "settles quietly near you, no words needed" },
    { type: "offer",    action: "offers something warm to hold without asking why" },
  ],
  anxious: [
    { type: "ground",  action: "walks alongside you, matching your pace" },
    { type: "notice",  action: "points out something small and beautiful nearby" },
  ],
  tired:   [{ type: "space", action: "finds you a quiet spot and sits without fuss" }],
  angry:   [{ type: "space", action: "gives you room, checking in gently from a distance" }],
  happy:   [{ type: "share", action: "catches your energy and grins" }],
  excited: [{ type: "join",  action: "wants to hear everything about it" }],
  calm:    [{ type: "peace", action: "sits in comfortable silence beside you" }],
  grateful:[{ type: "warm",  action: "notices something's different about you today" }],
};

export function getNPCBehavior(emotion, journalledToday) {
  if (!journalledToday) return null;
  const options = NPC_RESPONSES[emotion];
  if (!options) return null;
  return options[Math.floor(Math.random() * options.length)];
}