/** A compact, rebuildable index of user-authored history. The journal and chat
 * remain the source of truth; no assistant interpretation becomes a fact. */
import { buildVoiceProfile } from './conversation-guidance.js';

export const PERSONAL_MEMORY_VERSION = 5;
const MAX_ENTRIES = 200;
const STOP = new Set(['my', 'the', 'this', 'that', 'friend', 'bestie', 'boyfriend', 'girlfriend', 'partner', 'mum', 'mom', 'dad', 'class', 'school', 'work', 'home', 'today', 'tomorrow', 'later', 'some', 'other']);
const words = text => String(text ?? '').toLowerCase().match(/[a-z0-9']+/g) ?? [];
const key = text => words(text).filter(word => word.length > 2 && !STOP.has(word)).slice(0, 8).join(' ');

function sourceTexts(entry) {
  const journal = String(entry?.text ?? '').trim();
  const fields = [entry?.aiChat, entry?.chatHistory, entry?.pastAiChat, entry?.aiMessages];
  const turns = fields.flatMap(field => Array.isArray(field) ? field : [])
    .filter(turn => turn?.role === 'user' && !turn.isJournal)
    .map(turn => String(turn.text ?? turn.content ?? turn.message ?? '').trim()).filter(Boolean);
  return [...new Set([journal, ...turns].filter(Boolean))];
}

export function personalMemoryFingerprint(entries = []) {
  let hash = 2166136261;
  for (const entry of entries.filter(item => item && item.source !== 'checkin').slice(0, MAX_ENTRIES)) {
    const text = `${entry.id ?? ''}|${entry.date ?? ''}|${sourceTexts(entry).join('|')}`;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  }
  return `${PERSONAL_MEMORY_VERSION}:${(hash >>> 0).toString(16)}`;
}

function explicitStatements(text, sourceId, date) {
  const found = [];
  const chunks = String(text).split(/[.!?\n]+/).map(part => part.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const match = chunk.match(/\b(?:i|i'm|im)\s+(?:(?:really|lowk|kinda|kind of)\s+)?(?:love|like|enjoy|prefer|hate|dislike|don't like|dont like)\b.{2,100}/i);
    if (!match) continue;
    const quote = match[0].trim().slice(0, 130);
    if (words(quote).length < 4) continue;
    found.push({ kind: 'self-report', quote, sourceId, date });
  }
  return found;
}

function personMentions(text, sourceId, date) {
  const found = [];
  const pattern = /\b(?:with|meet|met|see|saw|talk(?:ed)? to|shopping with|dinner with|hang(?:ing)? out with)\s+(?:my\s+)?([a-z][a-z'-]{2,})\b/gi;
  for (const match of String(text).matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (STOP.has(name)) continue;
    found.push({ kind: 'person-mentioned', name, quote: match[0], sourceId, date });
  }
  return found;
}

function userDefinitions(text, sourceId, date) {
  const found = [];
  const pattern = /\bby\s+([a-z][a-z0-9'-]{1,23})\s+i mean\s+([^.!?\n]{3,100})/gi;
  for (const match of String(text).matchAll(pattern)) {
    if (STOP.has(match[1].toLowerCase())) continue;
    found.push({ kind: 'user-definition', term: match[1].toLowerCase(), quote: match[0].slice(0, 130), sourceId, date });
  }
  return found;
}

function communicationPreferences(text, sourceId, date) {
  return String(text).split(/[.!?\n]+/).map(chunk => chunk.trim()).filter(chunk =>
    /\b(?:please|pls|can you|could you|i (?:prefer|want|like)(?: it)? when you|don't|do not|stop|you should)\b/i.test(chunk)
    && /\b(?:talk(?:ing)?|speak(?:ing)?|reply|respond|text|write|sound|tone|emoji|jok(?:e|ing)|slang|formal|casual)\b/i.test(chunk)
  ).slice(0, 3).map(quote => ({ kind: 'communication-preference', quote: quote.slice(0, 160), sourceId, date }));
}

export function buildPersonalMemory(entries = []) {
  const eligible = (Array.isArray(entries) ? entries : []).filter(entry => entry && entry.source !== 'checkin' && String(entry.text ?? '').trim())
    .slice(0, MAX_ENTRIES).reverse();
  const source = eligible.flatMap(entry => sourceTexts(entry).map(text => ({ text, sourceId: entry.id ?? '', date: entry.date ?? '' })));
  const statements = source.flatMap(item => explicitStatements(item.text, item.sourceId, item.date));
  const people = source.flatMap(item => personMentions(item.text, item.sourceId, item.date));
  const definitions = source.flatMap(item => userDefinitions(item.text, item.sourceId, item.date));
  const preferences = source.flatMap(item => communicationPreferences(item.text, item.sourceId, item.date));
  const consolidate = (items, identity) => {
    const map = new Map();
    for (const item of items) {
      const id = identity(item);
      if (!id) continue;
      const prior = map.get(id);
      map.set(id, { ...item, count: (prior?.count ?? 0) + (prior?.sourceId === item.sourceId ? 0 : 1),
        sourceIds: [...new Set([...(prior?.sourceIds ?? []), item.sourceId])].filter(Boolean).slice(-5) });
    }
    return [...map.values()].slice(-30);
  };
  const styleText = source.slice(-20).map(item => item.text).join(' ').slice(-5000);
  const style = buildVoiceProfile(styleText, [], '');
  const humorExamples = source.filter(item => /\b(?:lol|lmao|haha+|hehe|bro|sia|like some|as if|joke|funny)\b/i.test(item.text))
    .slice(-3).map(item => ({ quote: item.text.slice(0, 130), sourceId: item.sourceId }));
  return { version: PERSONAL_MEMORY_VERSION, fingerprint: personalMemoryFingerprint(entries), sourceCount: eligible.length,
    style: { register: style.register, pace: style.pace, lowercaseShare: style.lowercaseShare,
      expressiveness: style.expressiveness, singlishParticleRate: style.singlishParticleRate,
      colloquialRate: style.colloquialRate, shorthandRate: style.shorthandRate,
      stretchRate: style.stretchRate, emphasisRate: style.emphasisRate, emojiRate: style.emojiRate,
      casualEvidenceRate: style.casualEvidenceRate, styleConfidence: style.styleConfidence,
      laughterRate: style.laughterRate, particles: style.particles,
      colloquialMarkers: style.colloquialMarkers,
      laughterMarkers: style.laughterMarkers, playfulComparisons: style.playfulComparisons },
    selfReports: consolidate(statements, item => key(item.quote)),
    people: consolidate(people, item => item.name),
    definitions: consolidate(definitions, item => item.term),
    communicationPreferences: consolidate(preferences, item => key(item.quote)).slice(-3), humorExamples };
}

export function resolvePersonalMemory(saved, entries = []) {
  return saved?.version === PERSONAL_MEMORY_VERSION && saved.fingerprint === personalMemoryFingerprint(entries)
    ? saved : buildPersonalMemory(entries);
}

/** Retrieve evidence tied to the present topic. A profile does not establish
 * the person's current feeling and cannot introduce an unrelated subject. */
export function retrievePersonalContext(query, profile, limit = 4, now = Date.now()) {
  const queryWords = new Set(words(query).filter(word => word.length > 2 && !STOP.has(word)));
  const candidates = [...(profile?.selfReports ?? []), ...(profile?.people ?? []), ...(profile?.definitions ?? [])].map(item => {
    const matchText = item.kind === 'person-mentioned' ? item.name : item.kind === 'user-definition' ? item.term : item.quote;
    const relevantWords = new Set(words(matchText).filter(word => word.length > 2 && !STOP.has(word)));
    const overlap = [...relevantWords].filter(word => queryWords.has(word)).length;
    const topical = relevantWords.size ? .7 * overlap / relevantWords.size
      + .3 * overlap / Math.sqrt(relevantWords.size * Math.max(1, queryWords.size)) : 0;
    const age = Number.isFinite(Date.parse(item.date)) ? Math.max(0, (now - Date.parse(item.date)) / 86_400_000) : 365;
    const recency = Math.exp(-Math.LN2 * age / 180);
    const repeated = 1 - Math.exp(-Math.max(1, item.count ?? 1) / 2);
    // Repetition and recency rank matching claims; neither can make an
    // unrelated memory eligible. These are ranking weights, not probabilities.
    const relevance = .72 * topical + .16 * recency + .12 * repeated;
    return { ...item, relevance, components: { topical, recency, repeated } };
  }).filter(item => item.components.topical >= .12).sort((a, b) => b.relevance - a.relevance);
  return candidates.slice(0, Math.max(0, Math.min(6, limit)));
}

export function formatPersonalContext(profile, matches = [], includeHumor = false) {
  if (!profile?.sourceCount) return 'No earlier user profile yet.';
  const style = `Historical writing cues from ${profile.sourceCount} entries: ${profile.style.register}, ${profile.style.pace}, lowercase ${profile.style.lowercaseShare}, shorthand ${profile.style.shorthandRate ?? 0}, expressive spelling ${profile.style.stretchRate ?? 0}, punctuation emphasis ${profile.style.emphasisRate ?? 0}, particles ${(profile.style.particles ?? []).join('/') || 'none'}, casual expressions ${(profile.style.colloquialMarkers ?? []).join('/') || 'none'}, laughter ${(profile.style.laughterMarkers ?? []).join('/') || 'none'}; current message takes precedence. These are writing habits, not personality or mood diagnoses.`;
  const label = kind => kind === 'person-mentioned' ? 'Mention' : kind === 'user-definition' ? 'User-defined term' : 'Self-report';
  const facts = matches.map(item => `${label(item.kind)} (${item.date || 'earlier'}, source ${item.sourceId}): "${item.quote}"`).join('\n');
  const humor = includeHumor && profile.humorExamples?.length
    ? `Past humor sample for rhythm only (never repeat its content): "${profile.humorExamples.at(-1).quote}"` : '';
  const preferences = profile.communicationPreferences?.length
    ? `User's explicit chat-style requests (latest wins if conflicting): ${profile.communicationPreferences.map(item => `"${item.quote}"`).join('; ')}` : '';
  return [style, preferences, facts || 'No older self-report or person mention is relevant to this turn.', humor].filter(Boolean).join('\n');
}
