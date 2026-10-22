/** Conversation guidance uses user-authored language only. These are routing
 * heuristics, not estimates of psychological state or response templates. */
const words = text => String(text ?? '').match(/[\p{L}\p{N}']+/gu) ?? [];
const clamp = value => Math.max(0, Math.min(1, value));
const level = value => ({ low: 0, medium: .5, high: 1 }[value] ?? .5);

// A reading aid, never a replacement for the user's exact words or evidence.
// Unknown slang stays intact so the model can use its surrounding context.
const SHORTFORMS = new Map(Object.entries({ tdy: 'today', aftn: 'afternoon', js: 'just', idk: "I don't know",
  idek: "I don't even know", ig: 'I guess', rn: 'right now', alr: 'already', bfr: 'before',
  smth: 'something', sth: 'something', bc: 'because', coz: 'because', lowk: 'low key',
  wtv: 'whatever', omg: 'oh my god', wth: 'what the hell', tbh: 'to be honest',
  ngl: 'not gonna lie', fr: 'for real', bf: 'boyfriend', bruh: 'bro', brah: 'bro' }));
const STYLE_WORD = /\b(?:wah|omg+|wth[a-z]{0,8}|bruh|brah|bro|lowk|idk|idek|ig|haiss+|hais|aiyo|walao|wtv|liddat|alr|js|tdy|aftn|damn|legit|yap|yapping|lol|lmao|tbh|ngl|rn|fr|gonna|wanna|kinda|cos|cuz|btw|smth|sth|pls|sia|lah|lor|leh|mah|paiseh|shag)\b/gi;
const COLLOQUIAL_WORD = /\b(?:wah|omg+|wth[a-z]{0,8}|bruh|brah|bro|lowk|idk|idek|ig|haiss+|hais|aiyo|walao|wtv|liddat|alr|js|tdy|aftn|damn|legit|yap|yapping|lol|lmao|tbh|ngl|rn|fr|gonna|wanna|kinda)\b/gi;
const LAUGHTER = /\b(?:ha){2,}h*\b|\b(?:lol|lmao|hehe)\b/gi;
const STRETCH = /\b[\p{L}]*([\p{L}])\1{2,}[\p{L}]*\b/giu;
const count = (text, pattern) => [...String(text ?? '').matchAll(pattern)].length;
const canonical = word => word.toLowerCase().replace(/([a-z])\1{2,}/g, '$1');

export function normaliseUserTextForUnderstanding(text) {
  return String(text ?? '').replace(/\b[\p{L}]+\b/gu, token => {
    const base = canonical(token);
    if (SHORTFORMS.has(base)) return SHORTFORMS.get(base);
    if (/^wth[a-z]{1,8}$/.test(base)) return 'what the hell';
    // Unknown lengthening might belong to a name or a word with a legitimate
    // double letter. Only collapse patterns with an unambiguous common base.
    if (/y{3,}$/i.test(token)) return token.replace(/y{3,}$/i, 'y');
    if (/^so{3,}$/i.test(token)) return 'so';
    if (/^no{3,}$/i.test(token)) return 'no';
    return token;
  });
}

export function explicitlyRequestsPlanning(text) {
  return /\b(?:what (?:should|can|could|do) i (?:do|try|start)|how (?:should|can|do) i (?:start|plan|tackle|manage|fix)|(?:can|could) you (?:help me (?:plan|decide|figure out what to do)|suggest|give me (?:tips|advice))|(?:i need|give me|any) (?:a )?(?:plan|tips|advice|suggestions))\b/i.test(text);
}

/** Last user turns determine register; locale and name never determine it. */
export function buildVoiceProfile(originalEntry = '', history = [], latest = '') {
  const journal = String(originalEntry ?? '');
  const recent = [...history.filter(t => t.role === 'user' && !t.isJournal).slice(-5).map(t => t.text), latest].filter(Boolean);
  const samples = [journal, ...recent].filter(Boolean);
  const features = text => {
    const wordCount = words(text).length;
    const letters = text.match(/[A-Za-z]/g) ?? [];
    return { wordCount,
      informal: count(text, STYLE_WORD) + count(text, /\b(?:kk|bfr)\b/gi),
      contractions: (text.match(/\b\p{L}+'(?:m|re|s|t|ve|ll|d)\b/giu) ?? []).length,
      lowercaseShare: letters.length ? letters.filter(char => char === char.toLowerCase()).length / letters.length : .5,
      laughter: count(text, LAUGHTER),
      particles: count(text, /\b(?:sia|lah|lor|leh|mah|ah|lorh)\b/gi),
      colloquial: count(text, COLLOQUIAL_WORD),
      shorthand: count(text, /\b(?:idk|idek|ig|rn|js|alr|tdy|aftn|wtv|tbh|ngl|fr|smth|sth|pls|bfr)\b/gi),
      stretch: count(text, STRETCH),
      emphaticPunctuation: count(text, /[!?]{2,}/g),
      allCaps: count(text, /\b[A-Z]{3,}\b/g),
      emoji: count(text, /\p{Extended_Pictographic}/gu) };
  };
  const parts = samples.map(features);
  // A one-word answer is weak evidence of a style change. The journal stays
  // in the prior while substantive recent turns still get the most weight.
  const weights = parts.map((part, index) => index === 0 && journal ? .7 : Math.min(1, part.wordCount / 14) * Math.exp(-.28 * (parts.length - index - 1)));
  const weighted = key => parts.reduce((sum, part, index) => sum + weights[index] * part[key], 0);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const wordCount = weighted('wordCount');
  const informal = weighted('informal');
  const contractions = weighted('contractions');
  const score = clamp((informal * 2 + contractions * .5) / Math.max(8, wordCount / 8));
  const substantiveRecent = recent.filter(text => words(text).length >= 8);
  const typicalWords = (substantiveRecent.length ? substantiveRecent : journal ? [journal] : recent)
    .map(text => words(text).length).sort((a, b) => a - b);
  const averageWords = typicalWords.length ? typicalWords[Math.floor((typicalWords.length - 1) / 2)] : 0;
  const lowercaseShare = parts.reduce((sum, part, index) => sum + weights[index] * part.lowercaseShare, 0) / weightTotal;
  const sample = samples.join(' ');
  const particleRate = weighted('particles') / Math.max(1, wordCount);
  const colloquialRate = weighted('colloquial') / Math.max(1, wordCount);
  const shorthandRate = weighted('shorthand') / Math.max(1, wordCount);
  const stretchRate = weighted('stretch') / Math.max(1, wordCount);
  const emphasisRate = (weighted('emphaticPunctuation') + weighted('allCaps')) / Math.max(1, wordCount);
  const emojiRate = weighted('emoji') / Math.max(1, wordCount);
  const rankMarkers = pattern => {
    const counts = new Map();
    samples.forEach((text, index) => {
      for (const match of String(text).toLowerCase().matchAll(pattern)) {
        const token = match[0];
        counts.set(token, (counts.get(token) ?? 0) + weights[index]);
      }
    });
    return [...counts].sort((a, b) => b[1] - a[1]).map(([token]) => token);
  };
  const particles = rankMarkers(/\b(?:sia|lah|lor|leh|mah|ah|lorh)\b/gi).slice(0, 7);
  const colloquialMarkers = rankMarkers(COLLOQUIAL_WORD).map(canonical).filter((value, index, all) => all.indexOf(value) === index).slice(0, 6);
  const laughterMarkers = rankMarkers(LAUGHTER).slice(0, 2);
  const substantive = recent.filter(text => words(text).length >= 8);
  const journalExamples = journal.length > 230
    ? [journal.slice(0, 140), journal.slice(-140)] : [journal.slice(0, 230)];
  const expressiveRate = stretchRate + emphasisRate + weighted('laughter') / Math.max(1, wordCount);
  const casualEvidenceRate = informal / Math.max(1, wordCount) + .6 * expressiveRate + .3 * shorthandRate;
  const styleConfidence = 1 - Math.exp(-wordCount / 55);
  const casual = score >= .35 || casualEvidenceRate >= .055
    || ((particleRate >= .008 || colloquialRate >= .02) && lowercaseShare >= .8);
  return { register: casual ? 'casual' : score >= .1 ? 'conversational' : 'plain',
    pace: averageWords < 12 ? 'brief' : averageWords < 40 ? 'medium' : 'storytelling',
    expressiveness: expressiveRate >= .01 || laughterMarkers.length > 0 ? 'animated' : 'steady',
    lowercaseShare: Number(lowercaseShare.toFixed(2)), laughterRate: Number((weighted('laughter') / Math.max(1, wordCount)).toFixed(3)),
    singlishParticleRate: Number(particleRate.toFixed(3)), colloquialRate: Number(colloquialRate.toFixed(3)),
    shorthandRate: Number(shorthandRate.toFixed(3)), stretchRate: Number(stretchRate.toFixed(3)),
    emphasisRate: Number(emphasisRate.toFixed(3)), emojiRate: Number(emojiRate.toFixed(3)),
    casualEvidenceRate: Number(casualEvidenceRate.toFixed(3)), styleConfidence: Number(styleConfidence.toFixed(2)),
    particles, colloquialMarkers, laughterMarkers,
    playfulComparisons: /\b(?:like some|like a|as if|as though)\b/i.test(sample),
    ellipses: /\.{3,}/.test(sample), repeatedPunctuation: /[!?]{2,}/.test(sample),
    userExamples: [...journalExamples, ...substantive.slice(-2)].filter(Boolean).map(text => String(text).slice(0, 180)) };
}

/** Historical voice is a weak prior when the current conversation supplies
 * little style evidence. A substantive current entry always decides register. */
export function mergeHistoricalVoice(current, personalMemory, currentUserText = '') {
  const past = personalMemory?.style;
  const sourceCount = Number(personalMemory?.sourceCount ?? 0);
  const currentWords = words(currentUserText).length;
  if (!past || sourceCount < 2) return current;
  if (currentWords >= 18) return current.register === 'casual' && past.register === 'casual'
    ? { ...current, particles: current.particles?.length ? current.particles : (past.particles ?? []),
      colloquialMarkers: current.colloquialMarkers?.length ? current.colloquialMarkers : (past.colloquialMarkers ?? []),
      laughterMarkers: current.laughterMarkers?.length ? current.laughterMarkers : (past.laughterMarkers ?? []),
      playfulComparisons: current.playfulComparisons || Boolean(past.playfulComparisons) }
    : current;
  const weight = Math.min(.3, sourceCount / (sourceCount + 6) * (1 - currentWords / 18));
  const lowercaseShare = (1 - weight) * current.lowercaseShare + weight * (Number(past.lowercaseShare) || current.lowercaseShare);
  const singlishParticleRate = (1 - weight) * (current.singlishParticleRate ?? 0) + weight * (past.singlishParticleRate ?? 0);
  const colloquialRate = (1 - weight) * (current.colloquialRate ?? 0) + weight * (past.colloquialRate ?? 0);
  const shorthandRate = (1 - weight) * (current.shorthandRate ?? 0) + weight * (past.shorthandRate ?? 0);
  const stretchRate = (1 - weight) * (current.stretchRate ?? 0) + weight * (past.stretchRate ?? 0);
  const emphasisRate = (1 - weight) * (current.emphasisRate ?? 0) + weight * (past.emphasisRate ?? 0);
  const laughterRate = (1 - weight) * (current.laughterRate ?? 0) + weight * (past.laughterRate ?? 0);
  const casualEvidenceRate = (1 - weight) * (current.casualEvidenceRate ?? 0) + weight * (past.casualEvidenceRate ?? 0);
  const styleConfidence = clamp((current.styleConfidence ?? 0)
    + weight * (past.styleConfidence ?? 0) * (1 - (current.styleConfidence ?? 0)));
  const register = current.register === 'plain' && past.register === 'casual' && weight >= .12
    ? currentWords <= 4 && sourceCount >= 6 ? 'casual' : 'conversational' : current.register;
  return { ...current, register, lowercaseShare: Number(lowercaseShare.toFixed(2)),
    singlishParticleRate: Number(singlishParticleRate.toFixed(3)), colloquialRate: Number(colloquialRate.toFixed(3)),
    shorthandRate: Number(shorthandRate.toFixed(3)), stretchRate: Number(stretchRate.toFixed(3)),
    emphasisRate: Number(emphasisRate.toFixed(3)), laughterRate: Number(laughterRate.toFixed(3)),
    casualEvidenceRate: Number(casualEvidenceRate.toFixed(3)), styleConfidence: Number(styleConfidence.toFixed(2)),
    particles: current.particles?.length ? current.particles : (past.particles ?? []),
    colloquialMarkers: current.colloquialMarkers?.length ? current.colloquialMarkers : (past.colloquialMarkers ?? []),
    laughterMarkers: current.laughterMarkers?.length ? current.laughterMarkers : (past.laughterMarkers ?? []),
    expressiveness: current.expressiveness === 'steady' && currentWords <= 4 && past.expressiveness === 'animated'
      ? 'animated' : current.expressiveness,
    playfulComparisons: current.playfulComparisons || Boolean(past.playfulComparisons),
    historicalVoiceWeight: Number(weight.toFixed(2)) };
}

export function isBroadDifficultyAnswer(text) {
  return /\b(?:everything|all (?:of )?(?:it|them|the (?:topics?|questions?|chapters?|parts?))|the whole (?:thing|topic|assignment|subject)|not just one|no specific (?:part|topic|concept)|can'?t narrow|cannot narrow|none of (?:it|them))\b/i.test(String(text ?? ''));
}

export function isNarrowingQuestion(text) {
  const question = String(text ?? '').replace(/[’‘]/g, "'");
  return /\?/.test(question) && /\b(?:what|which|is there)\b.{0,100}\b(?:part|piece|bit|specific|concept|term|problem|topic|question)\b|\b(?:specific|one)\b.{0,75}\b(?:concept|term|problem|topic|question)\b/i.test(question);
}

export function analyseQuestionPressure(history = [], latest = '') {
  const recent = history.filter(turn => !turn.isJournal).slice(-14);
  const narrowingCount = recent.filter(turn => turn.role === 'ai' && isNarrowingQuestion(turn.text)).length;
  const broadAnswers = [...recent.filter(turn => turn.role === 'user').map(turn => turn.text), latest].filter(isBroadDifficultyAnswer).length;
  const latestBroad = isBroadDifficultyAnswer(latest);
  const latestAversion = /\b(?:want to do (?:something|smth) else|rather (?:sleep|scroll|rest|do something else)|don'?t want to (?:think|talk) about (?:it|this)|can'?t face (?:it|this)|just want to (?:sleep|scroll|rest)|need (?:a )?break from (?:it|this))\b/i.test(String(latest ?? ''));
  const saturation = clamp(.24 * narrowingCount + .22 * broadAnswers + (latestBroad ? .2 : 0) + (latestAversion ? .22 : 0));
  return { narrowingCount, broadAnswers, latestBroad, latestAversion, saturation,
    answerLimitReached: (latestBroad && narrowingCount > 0) || (broadAnswers >= 2 && narrowingCount >= 2) };
}

/** Interactional cues describe whether this reply is landing, not the user's
 * mood or personality. A short answer alone is never proof of disinterest. */
export function analyseEngagement(history = [], latest = '') {
  const message = String(latest ?? '').trim();
  const recentUsers = history.filter(turn => turn.role === 'user' && !turn.isJournal).slice(-5).map(turn => String(turn.text ?? '').trim());
  const lastAssistant = String([...history].reverse().find(turn => turn.role === 'ai')?.text ?? '').replace(/[’‘]/g, "'");
  // Acknowledgements with or without a particle ("ya lor", "ok lah", "ya sia")
  // are agreement, never a repeated choice.
  const ACK = /^(?:ok(?:ay)?|kk|k|mhm|mm|ya+|yah|yeah|yep|yup|sure|true|same|fair|ikr|right|ok ok|okok)(?:\s+(?:lor|lah|la|sia|leh|ah|lo|bro|ya))*[.!\s]*$/i;
  const choiceWords = text => new Set((String(text).toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter(word => !['i', 'me', 'my', 'the', 'a', 'an', 'on', 'to', 'for', 'just', 'js', 'lor', 'lah', 'la', 'leh', 'sia', 'ah', 'later', 'then',
      'ok', 'okay', 'ya', 'yah', 'yeah', 'yep', 'sure', 'true', 'same', 'fair', 'mhm', 'idk', 'maybe'].includes(word)));
  const latestChoice = choiceWords(message);
  const repeatedChoice = words(message).length <= 8 && latestChoice.size > 0
    && !ACK.test(message)
    && recentUsers.some(prior => {
      if (words(prior).length > 10) return false;
      const earlier = choiceWords(prior);
      const intersection = [...latestChoice].filter(word => [...earlier].some(other =>
        word === other || (Math.min(word.length, other.length) >= 5
          && (word.endsWith(other) || other.endsWith(word))))).length;
      return earlier.size > 0 && intersection / Math.max(latestChoice.size, earlier.size) >= .67;
    });
  const temporalCorrection = /\b(?:haven'?t|have not|hvnt|didn'?t|did not|not yet)\b.{0,45}\b(?:yet|later|then|[a-z]+ed|done|do|start|go|went|try|have|had)\b|\bi (?:said|meant) later\b/i.test(message);
  const confusion = /^(?:huh+|what|wdym|wym|huh what|what\?)[?!\s]*$/i.test(message);
  const prospectiveQuestion = /\?/.test(lastAssistant)
    && /\b(?:what(?:'s| is| would| could)|which|how)\b.{0,100}\b(?:next|later|after|tonight|want|would|could|comfort|rest|break|unwind|do)\b/i.test(lastAssistant);
  const plannedActivity = !confusion && !/\?/.test(message) && words(message).length <= 12
    && (prospectiveQuestion || /\b(?:later|gonna|going to|might|maybe|will|i'll|want to)\b/i.test(message));
  // Every cue below is a reaction to Kindred's previous message. With no
  // previous message (the journal itself) none of them can apply, and a
  // timing correction is a short reply, not "i havent even started" in a diary.
  const hasAssistant = Boolean(lastAssistant.trim());
  const pushback = hasAssistant && (/^(?:ok(?:ay)?\s+)?(?:wtv|whatever|nvm|never ?mind|forget it|stop|u(?:'re| are)? not (?:getting|listening)|you(?:'re| are)? not (?:getting|listening))\b/i.test(message)
    || /\b(?:that'?s not what i meant|you(?:'re| are) overthinking|why (?:are )?you (?:making|saying))\b/i.test(message)
    || (temporalCorrection && words(message).length <= 15));
  const bare = ACK.test(message);
  const priorBare = recentUsers.length ? /^(?:ok|okay|kk|k|mhm|mm|ya|yeah|yep|sure)[.!\s]*$/i.test(recentUsers.at(-1)) : false;
  const previousPushback = recentUsers.some(text => /\b(?:wtv|whatever|nvm|never ?mind|you(?:'re| are) overthinking)\b/i.test(text));
  const abstractProbe = /\?/.test(lastAssistant) && /\b(?:what(?:'s| is)? (?:the )?(?:smallest|tiniest|real|deeper)|what (?:would|could) make|what does .{0,40} mean|what makes .{0,40} feel)\b/i.test(lastAssistant);
  const literalAnswer = abstractProbe && words(message).length <= 3 && !/\b(?:sad|angry|happy|tired|scared|worried|love|hate|because)\b/i.test(message) && !bare && !pushback;
  if (!hasAssistant) return { pushback: false, bare: false, repeatedBare: false, literalAnswer: false, repeatedChoice: false,
    temporalCorrection: false, confusion: false, plannedActivity: false, score: 0 };
  const score = pushback || repeatedChoice || confusion ? 1 : bare && (priorBare || previousPushback) ? .85 : literalAnswer ? .6 : bare ? .25 : 0;
  return { pushback, bare, repeatedBare: bare && (priorBare || previousPushback), literalAnswer,
    repeatedChoice, temporalCorrection, confusion, plannedActivity, score };
}

export function questionDimensionsFromHistory(history = []) {
  return history.filter(turn => turn.role === 'ai').flatMap(turn =>
    [...String(turn.text ?? '').matchAll(/(?:^|[.!?]\s*|,\s*)(who|what|when|where|why|how)\b[^?]*\?/gim)]
      .map(match => match[1].toLowerCase())).slice(-4);
}

/** A question is chosen for expected conversational value, not word variety.
 * All inputs except past repetitions are semantic judgments grounded in the turn. */
export function questionUtility(topic, priorDimensions = [], planningAuthorized = false) {
  const question = topic?.question ?? {};
  const dimension = String(question.dimension ?? 'none').toLowerCase();
  if (!['who', 'what', 'when', 'where', 'why', 'how', 'none'].includes(dimension)) return { score: -1, dimension: 'none' };
  const gain = level(question.informationGain);
  const relevance = level(question.relevance);
  const effort = level(question.userEffort);
  const repeat = ['answered', 'unanswerable'].includes(topic?.questionStatus) ? 1 : level(question.repetitionRisk);
  const actionPenalty = question.taskDirected && !planningAuthorized ? 1 : 0;
  // The assessor must identify the conversational gap, not merely give its
  // own question high relevance. Coping and task prompts are a different move
  // from understanding the experience, even when they mention the same topic.
  const purpose = String(question.purpose ?? 'understanding');
  const purposePenalty = !planningAuthorized && ['task-action', 'coping-action', 'mood-lift', 'filler'].includes(purpose) ? 1 : 0;
  const gapPenalty = question.informationGap === '' || question.informationGap === 'none' ? 1 : 0;
  const recentCount = priorDimensions.slice(-3).filter(item => item === dimension).length;
  const varietyPenalty = recentCount ? Math.min(relevance === 1 ? .12 : .3, recentCount * .12) : 0;
  const score = .9 * gain + .8 * relevance - .65 * effort - 1.1 * repeat - 1.4 * actionPenalty
    - 1.4 * purposePenalty - 1.1 * gapPenalty - varietyPenalty;
  return { score, dimension, gain, relevance, effort, repeat, actionPenalty, purposePenalty, gapPenalty };
}
