import { buildConversationResponsePlan } from './conversation-response.js';
import { vadToEmotionDirectional } from './emotion-space.js';
import { deriveInterpretiveEmotion } from './thought-appraisal.js';
import { displayEntryEmotion, entryEmotionFamily } from './journey-affect.js';
import { MAX_OBSERVATIONS_PER_ENTRY } from './term-learning.js';

/** Persist chat and its user-derived affect without relabelling on fillers. */

/** Append this turn's upcoming events (open-loops.js) to the entry. */
function withFollowUps(entry, response) {
  const items = Array.isArray(response?.followUps) ? response.followUps : [];
  if (!items.length) return entry.followUps;
  const seen = new Set((entry.followUps ?? []).map(f => `${f.what}|${f.due}`));
  return [...(entry.followUps ?? []), ...items.filter(f => !seen.has(`${f.what}|${f.due}`))].slice(-12);
}

/** Append this turn's slang readings (term-learning.js) to the entry. */
function withTermObservations(entry, response) {
  const readings = Array.isArray(response?.termReadings) ? response.termReadings : [];
  if (!readings.length) return entry.termObservations;
  return [...(entry.termObservations ?? []), ...readings].slice(-MAX_OBSERVATIONS_PER_ENTRY);
}

export function updateJournalConversation(entry, chat, memoryEntries = [], response = {}) {
  const lastUser = [...chat].reverse().find(turn => turn.role === 'user' && !turn.isJournal);
  if (!lastUser) {
    const updated = { ...entry, aiChat: chat,
    conversationState: response.conversationState ?? entry.conversationState,
    // The opening reads the journal itself; that reading is replayed by the
    // state model (index.js) as an observation of the day.
    interpretation: response.interpretation ?? entry.interpretation,
    termObservations: withTermObservations(entry, response),
    followUps: withFollowUps(entry, response),
    conversationAffect: response.affect?.observations?.length ? { version: 2, semantic: response.affect, userTurns: 0 } : entry.conversationAffect };
    return { ...updated, emotion: entryEmotionFamily(updated), emotionLabel: displayEntryEmotion(updated) };
  }
  const lastIndex = chat.lastIndexOf(lastUser);
  const plan = buildConversationResponsePlan({ originalEntry: entry.text, userMessage: lastUser.text,
    chatHistory: chat.slice(0, lastIndex), memoryEntries: memoryEntries.filter(memory => memory.id !== entry.id) });
  const bareAcknowledgement = /^(?:ok|okay|kk|k|mhm|mm|ya|yeah|yep|sure)[.!\s]*$/i.test(lastUser.text.trim());
  const hasNewEvidence = !bareAcknowledgement && plan.latestFeatures.vadConfidence >= 0.12;
  const family = vadToEmotionDirectional(plan.affect.overallVad).emotion;
  const semanticAffect = response.affect;
  const semanticLabel = semanticAffect?.label && (semanticAffect.hasLatestEvidence || !entry.conversationAffect) ? semanticAffect.label : null;
  const nextEmotion = semanticLabel || (semanticAffect?.observations?.length ? entry.emotion : hasNewEvidence ? deriveInterpretiveEmotion(plan.latestFeatures, family).emotion : entry.emotion);
  const updated = { ...entry, aiChat: chat, conversationState: response.conversationState ?? entry.conversationState, initialEmotion: entry.initialEmotion || entry.emotion,
    termObservations: withTermObservations(entry, response),
    followUps: withFollowUps(entry, response),
    emotion: nextEmotion || entry.emotion || family,
    conversationAffect: { version: 2, vad: plan.affect.overallVad, confidence: plan.affect.overallConfidence,
      topics: plan.affect.topics, semantic: semanticAffect?.observations?.length && (semanticAffect.hasLatestEvidence || !entry.conversationAffect?.semantic)
        ? semanticAffect : entry.conversationAffect?.semantic, userTurns: chat.filter(turn => turn.role === 'user' && !turn.isJournal).length } };
  const unchanged = !hasNewEvidence && !semanticAffect?.hasLatestEvidence;
  return { ...updated, emotion: unchanged ? entry.emotion : entryEmotionFamily(updated),
    emotionLabel: unchanged ? entry.emotionLabel ?? displayEntryEmotion(updated) : displayEntryEmotion(updated) };
}
