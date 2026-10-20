/** Display affect for Journey. Average vectors, never emotion words or entry order. */
import { analyseText } from './text-features.js';
import { blendVAD, emotionToVAD, vadToEmotionDirectional } from './emotion-space.js';

const LABEL_FAMILY = {
  frustrated: 'angry', annoyed: 'angry', irritated: 'angry',
  overwhelmed: 'anxious', worried: 'anxious', confused: 'anxious',
  lonely: 'sad', disappointed: 'sad',
  relieved: 'calm', hopeful: 'content', proud: 'happy',
  exhausted: 'tired', drained: 'tired',
};
const CANONICAL = new Set(['happy', 'excited', 'grateful', 'content', 'calm', 'neutral', 'tired', 'anxious', 'angry', 'sad']);
const axes = ['valence', 'arousal', 'dominance'];
const validVAD = vad => vad && axes.every(axis => Number.isFinite(vad[axis]));
const family = label => {
  const words = String(label ?? '').toLowerCase().match(/[a-z]+/g) ?? [];
  return words.map(word => CANONICAL.has(word) ? word : LABEL_FAMILY[word]).find(Boolean) ?? null;
};
const length = vad => Math.hypot(...axes.map(axis => vad[axis]));

function semanticVAD(semantic) {
  const distribution = semantic?.distribution;
  if (!distribution || typeof distribution !== 'object') return null;
  const readings = Object.entries(distribution).flatMap(([label, weight]) => {
    const key = family(label);
    return key && Number.isFinite(weight) && weight > 0 ? [{ ...emotionToVAD(key), weight }] : [];
  });
  return readings.length ? blendVAD(readings) : null;
}

/** Prefer user language and grounded chat evidence; old entries use their saved label. */
export function entryAffect(entry) {
  if (!entry) return null;
  if (entry.source === 'checkin' && family(entry.emotion)) return emotionToVAD(family(entry.emotion));
  const language = entry.text ? analyseText(entry.text) : null;
  const userVad = validVAD(entry.conversationAffect?.vad) ? entry.conversationAffect.vad
    : validVAD(language?.vad) && language.vadConfidence >= .12 ? language.vad : null;
  const semantic = semanticVAD(entry.conversationAffect?.semantic);
  if (userVad && semantic) return blendVAD([{ ...userVad, weight: .65 }, { ...semantic, weight: .35 }]);
  if (semantic) return semantic;
  if (userVad) return userVad;
  return family(entry.emotion) ? emotionToVAD(family(entry.emotion)) : null;
}

/** A near-zero mean caused by opposite readings is mixed, not neutral. */
export function summarizeAffect(readings) {
  const valid = readings.filter(validVAD);
  if (!valid.length) return null;
  const vad = blendVAD(valid);
  const spread = valid.reduce((sum, item) => sum + Math.hypot(...axes.map(axis => item[axis] - vad[axis])), 0) / valid.length;
  const contradictory = valid.some(item => item.valence > .15) && valid.some(item => item.valence < -.15);
  const emotion = contradictory && length(vad) < .22 && spread > .35
    ? 'mixed' : vadToEmotionDirectional(vad).emotion;
  return { emotion, vad: { valence: vad.valence, arousal: vad.arousal, dominance: vad.dominance },
    spread, count: valid.length };
}

export function dailyAffect(entries, date) {
  const dated = (entries ?? []).filter(entry => entry.date === date);
  const summary = summarizeAffect(dated.map(entryAffect));
  return summary && dated.length === 1 ? { ...summary, emotion: displayEntryEmotion(dated[0]) } : summary;
}

/** Each calendar day contributes once, so prolific writing does not dominate the week. */
export function weeklyAffect(entries, dates) {
  const days = (dates ?? []).map(date => dailyAffect(entries, date)).filter(Boolean);
  const summary = summarizeAffect(days.map(day => day.vad));
  return summary ? { ...summary, dayCount: days.length } : null;
}

export function displayEntryEmotion(entry) {
  const ranked = Object.entries(entry?.conversationAffect?.semantic?.distribution ?? {})
    .map(([label, weight]) => ({ family: family(label), weight }))
    .filter(item => item.family && Number.isFinite(item.weight) && item.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  if (ranked[0]?.weight >= .55) return ranked[0].family;
  if (ranked.length > 1 && ranked[0].weight >= .25 && ranked[1].weight >= .25
    && ranked[0].family !== ranked[1].family) return 'mixed';
  const affect = entryAffect(entry);
  return affect ? vadToEmotionDirectional(affect).emotion : family(entry?.emotion) ?? 'neutral';
}
