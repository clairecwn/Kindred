/** Final style boundary for every user-visible companion response. */

export const COMPANION_STYLE_VERSION = "companion-style-2026.10.8c";

const LONG_DASH = /\s*[—–]\s*/g;

export function normaliseCompanionStyle(text) {
  return String(text ?? "")
    .replace(/^(?:it sounds like|it seems like)\s+/i, "Maybe ")
    .replace(LONG_DASH, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Wording-only cleanup when the user's own writing is strongly casual. */
export function softenCasualWording(text, voice = {}) {
  if (voice.register !== 'casual') return String(text ?? '');
  return String(text ?? '')
    .replace(/\bgroup dynamic\b/gi, 'group thing')
    .replace(/\binefficient\b/gi, 'slow')
    .replace(/\bperhaps\b/gi, 'maybe')
    .replace(/\btherefore\b/gi, 'so')
    .replace(/\bsubsequently\b/gi, 'then')
    .replace(/\bamid\b/gi, 'while')
    .replace(/\bthe situation\b/gi, 'that')
    .replace(/\bthe exchange\b/gi, 'that chat')
    .replace(/\bmishap\b/gi, 'mix-up')
    .replace(/\blingers\b/gi, 'sticks around')
    .replace(/\bpublic blunder\b/gi, 'awkward mistake')
    .replace(/\bweighing on you\b/gi, 'bothering you')
    .replace(/\b(?:it is|that is|you are|they are|do not|cannot)\b/gi, match => ({
      'it is': "it's", 'that is': "that's", 'you are': "you're",
      'they are': "they're", 'do not': "don't", cannot: "can't",
    })[match.toLowerCase()] ?? match)
    .replace(/(^|[.!?]\s+|\n\n)(Did|What|How|Why|When|Where|You|That|The|It|I|Maybe|Yeah|So|Oh|But|And|Still|Honestly|Right|Sounds|There|This|If|Because|Also|Actually)\b/g,
      (_, lead, first) => `${lead}${voice.lowercaseShare >= .86 ? first.toLowerCase() : first}`);
}

export function hasArtificialStyleTell(text) {
  const value = String(text ?? "");
  if (/(?:^|\n)\s*(?:\*\*)?\s*(?:shift|landing|soft[ _-]?close|validate|reflect|explore|deepen|summari[sz]e|repair)\s*(?:\*\*)?\s*[:,\-]/im.test(value)) return "internal-dialogue-label";
  if (/[—–]/.test(value)) return "long-dash";
  if (/\b(?:delve|unpack this|hold space|give yourself grace|healing journey|navigate these feelings)\b/i.test(value)) return "therapy-cliche";
  if (/\b(?:thank you for sharing|your feelings are valid|i hear you|i'?m here with you|tell me more|say more about that)\b/i.test(value)) return "canned-empathy";
  if (/\b(?:that stays with me|where does it go from here|i want to understand|frustration is telling you something|anger often shows up)\b/i.test(value)) return "generic-interpretation";
  if (/^(?:(?:it )?sounds like|it seems like|what i(?:'m| am) hearing is)\b/i.test(value)) return "formulaic-opener";
  if (/\b(?:oddly telling|little mismatch|chain reaction|gentler transition|your brain was (?:still )?trying to catch up|stuck in a foggy loop|sense that nothing(?:'s| is) clicking|mental clutter rather than actual tiredness)\b/i.test(value)) return "unsupported-or-posh-interpretation";
  if (/\b(?:energy (?:just )?got siphoned away|tiny spark of relief|perfect reset button|handle the overwhelm|just exist for a bit)\b/i.test(value)) return "stock-comfort-language";
  if (/\b(?:permission to stop performing|data points,? not active threats|active threats|the right kind of reset|no need to process (?:the|that|this))\b/i.test(value)) return "over-interpreted-or-meta-comfort";
  if (/\b(?:pulling the rug out|air (?:your|their)? ?opinions|everyone's voice lands|the takeaway|a smoother flow|tension easing|whenever you're ready to chat|just ping me)\b/i.test(value)) return "stiff-companion-language";
  if (/\b(?:it'?s normal for the mind|a signal that you need|which can leave you feeling|that must have been difficult)\b/i.test(value)) return "clinical-explanation";
  if (/\b(?:your body is (?:just )?asking for|your mind will thank you|you don'?t have to apologize for|do you mind if i ask)\b/i.test(value)) return "unsupported-or-formal-conversation-move";
  return null;
}

export function formalityPenalty(text, voice = {}) {
  const value = String(text ?? '');
  if (voice.register !== 'casual') return 0;
  const formal = (value.match(/\b(?:furthermore|nevertheless|therefore|indeed|perhaps|amid|intimidating|overwhelming|momentum|perspective|subsequently|reassuring|compelling|off.kilter|the exchange|the situation|lingering tension|productive discussion|voice concerns|a smoother way|back.and.forth|decompress|recharge|reset button|cascad(?:e|ing)|siphon(?:ed|ing)|inertia|shift the energy)\b/gi) ?? []).length;
  const jargon = (value.match(/\b(?:cognitive|emotional processing|self.regulation|mental clutter|narrative|framework|mechanism)\b/gi) ?? []).length;
  const longSentences = value.split(/[.!?]+/).filter(sentence => sentence.trim().split(/\s+/).length > 27).length;
  const capitalizedOpeners = voice.lowercaseShare >= .86
    ? (value.match(/(?:^|[.!?]\s+|\n\n)[A-Z][a-z]+/g) ?? []).length : 0;
  return Math.min(1, .45 * formal + .55 * jargon + .25 * longSentences + .18 * capitalizedOpeners);
}

/** A register check, not a reply template or identity classifier. Signals
 * come from user-authored text, across dialects and informal writing styles. */
export function styleAlignmentPenalty(text, voice = {}) {
  const value = String(text ?? '').replace(/[’‘]/g, "'");
  const confidence = Number(voice.styleConfidence ?? 1);
  if (voice.register === 'plain') {
    if (confidence < .18) return 0;
    return /\b(?:sia|lah|lor|leh|bruh|brah|omg+|lmao|lowk|wth[a-z]{0,8})\b/i.test(value) ? .55 : 0;
  }
  const evidence = Math.max(Number(voice.casualEvidenceRate ?? 0),
    Number(voice.colloquialRate ?? 0) + Number(voice.singlishParticleRate ?? 0)
    + .6 * Number(voice.stretchRate ?? 0) + .5 * Number(voice.laughterRate ?? 0));
  if (voice.register !== 'casual' || evidence < .025 || confidence < .18) return 0;
  const wordCount = (value.match(/[\p{L}\p{N}']+/gu) ?? []).length;
  const observed = [...(voice.particles ?? []), ...(voice.colloquialMarkers ?? []), ...(voice.laughterMarkers ?? [])]
    .filter(marker => /^[a-z]+$/i.test(marker));
  const observedPattern = observed.length ? new RegExp(`\\b(?:${observed.join('|')})\\b`, 'i') : null;
  const hasObservedCue = observedPattern?.test(value) ?? false;
  const hasNaturalTextingCue = /\b(?:ya|yeah|yep|nah|ugh|oof|fair|wait|honestly|my bad|i get why|i mean|got|gonna|wanna|kinda|tbh|lol|haha+|for real|no way|omg|wow|right\?|same here)\b/i.test(value)
    || /[!?]{2,}/.test(value);
  const counsellorFrame = /\b(?:you(?:'re| are) feeling|you(?:'re| are) noticing|you(?:'ve| have) been through a lot|it makes sense that|it'?s understandable|what would make|how does that feel|when you think back|what(?:'s| is) one small|let .{0,45} be your reset|a moment to (?:breathe|pause)|you can already picture)\b/i.test(value)
    || /^(?:that|this|it) sounds (?:like|really|so)\b/i.test(value);
  const interviewFrame = /\b(?:out of (?:all|everything).{0,100}which|which (?:moment|part|thing).{0,70}(?:hardest|worst|most)|what(?:'s| is) (?:the )?one (?:thing|part).{0,70}(?:most|hardest)|(?:what|which) (?:part|moment|thing|bit).{0,85}(?:heaviest|hardest|worst|biggest|most (?:important|overwhelming|upsetting)))\b/i.test(value);
  const unobservedParticle = (value.toLowerCase().match(/\b(?:sia|lah|lor|leh|mah|lorh)\b/g) ?? [])
    .some(marker => !(voice.particles ?? []).includes(marker));
  if (wordCount < 12) return counsellorFrame || interviewFrame || unobservedParticle ? .55 : 0;
  const noTextingCues = !hasObservedCue && !hasNaturalTextingCue;
  const observedCount = observedPattern ? (value.match(new RegExp(observedPattern.source, 'gi')) ?? []).length : 0;
  const naturalCount = (value.match(/\b(?:ya|yeah|nah|ugh|oof|wait|honestly|my bad|i mean|gonna|wanna|kinda|tbh|lol|haha+|for real|no way|omg|wow)\b/gi) ?? []).length;
  const cueDensity = (observedCount + naturalCount + (/[!?]{2,}/.test(value) ? 1 : 0)) / wordCount;
  const targetDensity = Math.min(.06, Math.max(.025, evidence * .5));
  const tokenVeneer = wordCount >= 25 && evidence >= .05 && cueDensity < targetDensity;
  return Math.min(1, (noTextingCues || tokenVeneer ? .55 : 0) + (counsellorFrame || interviewFrame ? .55 : 0)
    + (unobservedParticle ? .55 : 0));
}

export const casualVoicePenalty = styleAlignmentPenalty;
