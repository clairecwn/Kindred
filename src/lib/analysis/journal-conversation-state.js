import { buildConversationResponsePlan } from './conversation-response.js';
import { vadToEmotionDirectional } from './emotion-space.js';
import { deriveInterpretiveEmotion } from './thought-appraisal.js';
import { displayEntryEmotion } from './journey-affect.js';

/** Persist chat and its user-derived affect without relabelling on fillers. */
export function updateJournalConversation(entry, chat, memoryEntries = [], response = {}) {
  const lastUser = [...chat].reverse().find(turn => turn.role === 'user' && !turn.isJournal);
  if (!lastUser) {
    const updated = { ...entry, aiChat: chat,
    conversationState: response.conversationState ?? entry.conversationState,
    conversationAffect: response.affect?.observations?.length ? { version: 2, semantic: response.affect, userTurns: 0 } : entry.conversationAffect };
    return { ...updated, emotion: displayEntryEmotion(updated) };
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
    emotion: nextEmotion || entry.emotion || family,
    conversationAffect: { version: 2, vad: plan.affect.overallVad, confidence: plan.affect.overallConfidence,
      topics: plan.affect.topics, semantic: semanticAffect?.observations?.length && (semanticAffect.hasLatestEvidence || !entry.conversationAffect?.semantic)
        ? semanticAffect : entry.conversationAffect?.semantic, userTurns: chat.filter(turn => turn.role === 'user' && !turn.isJournal).length } };
  return { ...updated, emotion: !hasNewEvidence && !semanticAffect?.hasLatestEvidence
    ? entry.emotion : displayEntryEmotion(updated) };
}
