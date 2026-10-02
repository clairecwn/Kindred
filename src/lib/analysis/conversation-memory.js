/**
 * Selective long-term memory retrieval for journal conversations.
 *
 * Saved journals remain the source of truth. This module does not infer a
 * personality profile or train model weights; it retrieves a few relevant
 * user-authored memories for in-context reasoning. Assistant prose is excluded
 * so an earlier model guess cannot turn into a durable "fact" about the user.
 */

import { analyseText } from "./text-features.js";

export const CONVERSATION_MEMORY_VERSION = "conversation-memory-2026.10.1";

const STOP = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "being", "but", "can",
  "could", "did", "does", "doing", "for", "from", "had", "has", "have", "here", "how", "into",
  "its", "just", "like", "more", "much", "really", "that", "the", "their", "them", "then", "there",
  "they", "this", "too", "very", "was", "were", "what", "when", "where", "which", "with", "would",
  "you", "your", "feel", "felt", "feeling", "today", "yesterday",
]);

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function tokens(text) {
  return new Set((String(text ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? [])
    .filter((token) => token.length > 2 && !STOP.has(token)));
}

function symmetricOverlap(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return 0.5 * (intersection / a.size + intersection / b.size);
}

function causeTypes(features) {
  return new Set((features?.appraisal?.causes ?? []).map((cause) => cause.type));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function vadSimilarity(a, b) {
  const distance = Math.sqrt(
    (a.valence - b.valence) ** 2 +
    (a.arousal - b.arousal) ** 2 +
    (a.dominance - b.dominance) ** 2,
  );
  return clamp(1 - distance / Math.sqrt(12));
}

function userConversationText(entry) {
  const fields = [entry?.aiChat, entry?.chatHistory, entry?.pastAiChat, entry?.aiMessages];
  const messages = [];
  for (const field of fields) {
    if (!Array.isArray(field)) continue;
    for (const turn of field) {
      if (turn?.role !== "user") continue;
      const text = String(turn?.text ?? turn?.content ?? turn?.message ?? "").trim();
      if (text && !messages.includes(text)) messages.push(text);
    }
  }
  return messages;
}

function parseDate(value) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function ageDays(entry, index, now) {
  const timestamp = parseDate(entry?.date ?? entry?.createdAt ?? entry?.created_at);
  if (timestamp == null) return index * 7;
  return Math.max(0, (now - timestamp) / 86_400_000);
}

export function buildConversationMemoryBank(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && entry.source !== "checkin" && String(entry.text ?? "").trim())
    .map((entry, index) => {
      const followUps = userConversationText(entry);
      const userText = [String(entry.text).trim(), ...followUps].join("\n");
      const features = analyseText(userText);
      return {
        id: entry.id ?? `memory-${index}`,
        date: entry.date ?? "",
        entryText: String(entry.text).trim(),
        followUps,
        userText,
        features,
      };
    });
}

export function retrieveConversationMemories(queryText, entries = [], options = {}) {
  const now = options.now instanceof Date ? options.now.getTime() : Number(options.now ?? Date.now());
  const limit = Math.max(0, Math.min(4, options.limit ?? 3));
  const queryFeatures = analyseText(queryText);
  const queryTokens = tokens(queryText);
  const queryCauses = causeTypes(queryFeatures);
  const bank = buildConversationMemoryBank(entries);

  const ranked = bank.map((memory, index) => {
    const topic = symmetricOverlap(queryTokens, tokens(memory.userText));
    const cause = jaccard(queryCauses, causeTypes(memory.features));
    const affect = vadSimilarity(queryFeatures.vad, memory.features.vad);
    const recency = Math.exp(-Math.LN2 * ageDays(memory, index, now) / 45);
    const relevance = 0.50 * topic + 0.22 * cause + 0.13 * affect + 0.15 * recency;
    // Affect alone is not sufficient: many unrelated difficult days look
    // numerically similar. Require topical or causal evidence before recall.
    const eligible = topic >= 0.075 || cause >= 0.34;
    return { ...memory, score: relevance, components: { topic, cause, affect, recency }, eligible };
  }).filter((memory) => memory.eligible && memory.score >= 0.16)
    .sort((a, b) => b.score - a.score || String(b.date).localeCompare(String(a.date)))
    .slice(0, limit);

  const totalScore = ranked.reduce((sum, memory) => sum + memory.score, 0);
  const memoryVad = totalScore
    ? Object.fromEntries(["valence", "arousal", "dominance"].map((axis) => [
        axis,
        ranked.reduce((sum, memory) => sum + memory.score * memory.features.vad[axis], 0) / totalScore,
      ]))
    : { valence: 0, arousal: 0, dominance: 0 };

  return {
    version: CONVERSATION_MEMORY_VERSION,
    memories: ranked,
    memoryVad,
    // Historical context can nuance a response but never outweigh this turn.
    influenceCap: Math.min(0.30, 0.10 * ranked.length),
  };
}

export function formatRetrievedMemories(retrieval) {
  if (!retrieval?.memories?.length) return "No sufficiently relevant earlier memory was retrieved.";
  return retrieval.memories.map((memory, index) => {
    const followUp = memory.followUps.slice(-2).join(" / ");
    return `${index + 1}. ${memory.date || "Earlier entry"} (relevance ${memory.score.toFixed(2)}): journal="${memory.entryText.slice(0, 220)}"${followUp ? `; later user context="${followUp.slice(0, 220)}"` : ""}`;
  }).join("\n");
}
