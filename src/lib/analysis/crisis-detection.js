/**
 * crisis-detection.js
 *
 * A small, deterministic, client-side safety net. This is NOT a clinical
 * screening tool and must never be presented as one. Its only job: catch
 * language that plausibly signals acute risk to self or others, so the
 * caller can route to human resources (a crisis line, a "talk to a person"
 * prompt) INSTEAD OF sending the entry to the model, and so no clinical
 * term (diagnosis, disorder name, risk label) is ever generated for or
 * shown to the user.
 *
 * ===========================================================================
 * THE RULE, STATED IN FULL
 * ===========================================================================
 *   isCrisis = true  <=>  lowercase(text) contains any phrase in
 *                         CRISIS_PHRASES as a substring.
 *
 * That is the whole decision procedure. It is a fixed list, matched by
 * substring, with no scoring, no threshold, no context window, no negation
 * handling, and no model. Every property below follows from that and is
 * deliberate:
 *
 *  - DETERMINISTIC AND SYNCHRONOUS. It returns before any network call can
 *    start, so it GATES the LLM rather than racing it. An entry containing
 *    crisis language is never sent to a completion endpoint at all.
 *  - PHRASES, NEVER BARE WORDS. "die", "end", "hurt" and "cut" alone would
 *    fire on ordinary journalling ("I could die of embarrassment", "cut my
 *    hair"). Every entry is a multi-word phrase for that reason.
 *  - NO NEGATION OR QUOTATION HANDLING, ON PURPOSE. "I don't want to kill
 *    myself" and "she said she wanted to die" both match. Both are false
 *    positives in the strict sense. Both are also entries where routing a
 *    person to a human is not a harmful outcome. Adding negation handling
 *    here would create a way to write a genuine crisis entry that the
 *    detector skips, and that trade is not worth making.
 *
 * ===========================================================================
 * FALSE-POSITIVE / FALSE-NEGATIVE POSTURE
 * ===========================================================================
 * The two errors are not symmetric, so the detector is not balanced.
 *
 *   False positive (fires when it should not): the user sees fixed, reviewed,
 *   non-clinical copy offering a crisis line instead of a companion reply.
 *   Mildly jarring, entirely safe, and reversible — they simply keep writing.
 *
 *   False negative (misses a real crisis entry): the entry is sent to a
 *   general-purpose LLM, which answers in its own words, at temperature 0.9,
 *   to someone in acute distress. There is no recovery from that.
 *
 * The list is therefore tuned for recall and accepts a false-positive rate
 * that would be unacceptable in a classifier meant to measure anything. It
 * measures nothing. It is a routing switch.
 *
 * ===========================================================================
 * WHAT IT IS NOT
 * ===========================================================================
 * Not a screening instrument, not a risk score, not a triage tier. It has no
 * severity levels and never will: a severity level invites a threshold, a
 * threshold invites tuning it down, and there is no version of this app in
 * which suppressing a crisis response to reduce interruptions is the right
 * call. Its output is one boolean and the phrases that produced it.
 */

// Phrases only — never single ambiguous words like "die" or "end" alone,
// which would false-positive constantly on ordinary journaling.
const CRISIS_PHRASES = Object.freeze([
  "kill myself", "end my life", "end it all", "want to die", "wanted to die",
  "better off dead", "no reason to live", "no reason to go on",
  "suicide", "suicidal", "not want to be alive", "don't want to be alive",
  "dont want to be alive", "can't go on", "cant go on", "hurt myself",
  "harm myself", "cutting myself", "self harm", "self-harm",
  "planning to kill", "going to kill myself", "take my own life",
  // Additional spellings and phrasings, including the contraction-dropping
  // and clipped forms common in Singapore English / SMS register. Added to
  // the same flat list: the rule above does not change, only its coverage.
  "take my life", "end things for good", "no point living",
  "no point in living", "dont want to live", "don't want to live",
  "dun want to live", "dun wan to live", "dont wanna live", "don't wanna live",
  "wish i was dead", "wish i were dead", "wish i wasnt here",
  "wish i wasn't here", "better if i was gone", "better off without me",
  "everyone would be better off", "cannot go on anymore",
  "cant take it anymore", "can't take it anymore", "cannot take it anymore",
  "kill me", "want to disappear forever", "end my suffering",
  "hurting myself", "cut myself", "cutting again", "overdose",
]);

/** Bumped whenever CRISIS_PHRASES changes, so a stored verdict is traceable. */
export const CRISIS_DETECTION_VERSION = "crisis-phrases-v2";

/**
 * Scans free text for crisis-language cues. Pure and synchronous — no
 * network call, so it can gate an LLM call rather than race it.
 * @param {string} text
 * @returns {{ isCrisis: boolean, matched: string[], version: string }}
 */
export function detectCrisisLanguage(text) {
  if (!text || typeof text !== "string") {
    return { isCrisis: false, matched: [], version: CRISIS_DETECTION_VERSION };
  }
  // Curly apostrophes are normalised so "don’t want to live" matches the
  // straight-quote entry; nothing else about the text is altered.
  const lower = text.toLowerCase().replace(/[’‘]/g, "'");
  const matched = CRISIS_PHRASES.filter((phrase) => lower.includes(phrase));
  return { isCrisis: matched.length > 0, matched, version: CRISIS_DETECTION_VERSION };
}

/**
 * The ONLY response Kindred shows when crisis language is detected. Fixed,
 * reviewed copy — never model-generated, never containing a clinical term.
 * Routes to human resources, not back into the companion chat.
 */
export const CRISIS_RESPONSE = Object.freeze({
  text:
    "It sounds like things feel really heavy right now. You deserve to talk " +
    "to someone who can really help, not an app. If you're in immediate " +
    "danger, please contact your local emergency number. You can also reach " +
    "a crisis line to talk to a real person right now, any time of day.",
  resources: [
    { label: "Samaritans of Singapore (24/7)", contact: "1767" },
    { label: "988 Suicide & Crisis Lifeline (US, 24/7)", contact: "988" },
    { label: "International Association for Suicide Prevention, find a local line", contact: "https://www.iasp.info/resources/Crisis_Centres/" },
  ],
  isCrisisResponse: true,
});
