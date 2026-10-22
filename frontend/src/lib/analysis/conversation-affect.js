/**
 * User-authored affect evidence accumulated across the journal and chat.
 * Assistant wording never becomes an observation. A turn with no measurable
 * affect preserves the previous state instead of pulling it toward neutral.
 */
import { analyseText } from "./text-features.js";

const AXES = ["valence", "arousal", "dominance"];
const zero = () => ({ valence: 0, arousal: 0, dominance: 0 });

function update(state, text, source) {
  if (source === 'chat' && /^(?:ok|okay|kk|k|mhm|mm|ya|yeah|yep|sure)[.!\s]*$/i.test(String(text ?? '').trim())) return state;
  const reading = analyseText(text);
  const confidence = reading.vadConfidence ?? 0;
  if (confidence < 0.12) return state;
  const gain = state.observations ? Math.min(0.78, 0.22 + 0.64 * confidence) : 1;
  const vad = Object.fromEntries(AXES.map((axis) => [axis,
    state.observations ? (1 - gain) * state.vad[axis] + gain * reading.vad[axis] : reading.vad[axis],
  ]));
  return { vad, confidence: state.observations ? Math.min(1, 0.75 * state.confidence + 0.25 * confidence) : confidence,
    observations: state.observations + 1, lastSource: source };
}

function emptyState() { return { vad: zero(), confidence: 0, observations: 0, lastSource: null }; }

export function buildConversationAffect({ originalEntry = "", history = [], currentMessage = "", discourseModel, agenda } = {}) {
  const userTurns = [originalEntry, ...history.filter((turn) => turn.role === "user").map((turn) => turn.text), currentMessage]
    .filter((text) => String(text ?? "").trim());
  const hasJournal = Boolean(String(originalEntry ?? "").trim());
  let overall = emptyState();
  const perTurn = [];
  userTurns.forEach((text, index) => {
    overall = update(overall, text, hasJournal && index === 0 ? "journal" : "chat");
    perTurn.push({ turnIndex: index, vad: { ...overall.vad }, confidence: overall.confidence, observations: overall.observations });
  });

  const topics = (discourseModel?.threads ?? []).map((thread) => {
    let state = emptyState();
    const byTurn = new Map();
    for (const mention of thread.mentions) byTurn.set(mention.turnIndex, [...(byTurn.get(mention.turnIndex) ?? []), mention.text]);
    for (const [turnIndex, mentions] of [...byTurn].sort((a, b) => a[0] - b[0])) {
      state = update(state, mentions.join(" "), hasJournal && turnIndex === 0 ? "journal" : "chat");
    }
    return { id: thread.id, ...state };
  });
  const selected = (agenda?.focusIds ?? []).map((id) => topics.find((topic) => topic.id === id)).filter((topic) => topic?.observations);
  const denominator = selected.reduce((sum, topic) => sum + topic.confidence, 0);
  const focusVad = denominator ? Object.fromEntries(AXES.map((axis) => [axis,
    selected.reduce((sum, topic) => sum + topic.vad[axis] * topic.confidence, 0) / denominator,
  ])) : overall.vad;
  const focusConfidence = selected.length ? selected.reduce((sum, topic) => sum + topic.confidence, 0) / selected.length : overall.confidence;
  const previous = perTurn.at(-2)?.vad ?? zero();
  const shift = Object.fromEntries(AXES.map((axis) => [axis, overall.vad[axis] - previous[axis]]));
  return { overallVad: overall.vad, overallConfidence: overall.confidence, focusVad, focusConfidence,
    shift, topics, perTurn };
}
