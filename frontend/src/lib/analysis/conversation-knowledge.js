import { TAXONOMY_IDS } from './emotion-taxonomy.js';
/** Preserve what was asked as well as what the user supplied in response.
 * These are evidence pairs, not assertions that the assistant's wording is true. */
export function buildConversationKnowledge(history = [], latest = '', replyTo = '') {
  const turns = [...history.filter(t => !t.isJournal), ...(latest ? [{ role: 'user', text: latest, replyTo }] : [])];
  const exchanges = [];
  let prompts = [];
  turns.forEach((turn, index) => {
    if (turn.role === 'ai') prompts.push({ id: `turn-${index}`, text: turn.text });
    else {
      if (prompts.length || turn.replyTo) exchanges.push({
        prompts: turn.replyTo ? [{ id: 'quoted-reply', text: turn.replyTo }] : prompts,
        response: { id: `turn-${index}`, text: turn.text },
      });
      prompts = [];
    }
  });
  return { exchanges, unanswered: prompts };
}

// The assessor names feelings from the full taxonomy (emotion-taxonomy.js),
// so "frustrated", "restless" or "embarrassed" survive instead of being
// folded into a broad family.
export const AFFECT_LABELS = [...TAXONOMY_IDS];

/** Aggregate grounded semantic observations; negative valence is not sadness.
 * Coefficients express evidence weighting, not calibrated emotion probabilities. */
export function evaluateSemanticAffect(observations, sources, evidenceFor) {
  const accepted = [];
  const scores = {};
  for (const observation of (Array.isArray(observations) ? observations : []).slice(0, 32)) {
    if (!AFFECT_LABELS.includes(observation.label) || !['current', 'earlier'].includes(observation.time)) continue;
    const evidence = evidenceFor(observation.evidence).filter(e => !/^(?:memory|profile)-/.test(e.source));
    if (!evidence.length) continue;
    const support = ({ low: .35, medium: .65, high: 1 }[observation.strength] ?? .35);
    let weight = 0;
    for (const item of evidence) {
      // Only the strongest citation per observation counts; repeated quotes
      // or verbosity cannot multiply support for an emotion.
      const index = sources.findIndex(s => s.id === item.source);
      const latestIndex = sources.findIndex(s => s.id === 'latest');
      const recency = item.source === 'latest' ? 1.6 : item.source === 'journal' ? 1.1 : Math.exp(-.08 * Math.max(0, latestIndex - index));
      weight = Math.max(weight, support * recency * (observation.time === 'current' ? 1 : .45));
    }
    scores[observation.label] = Math.max(scores[observation.label] ?? 0, weight);
    accepted.push({ label: observation.label, time: observation.time, evidence, weight });
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((n, [, weight]) => n + weight, 0);
  const labels = ranked.filter(([, weight]) => weight >= (ranked[0]?.[1] ?? 1) * .65).slice(0, 2).map(([label]) => label);
  return { label: labels.join(' and '), distribution: Object.fromEntries(ranked.map(([label, weight]) => [label, weight / total])), observations: accepted,
    hasLatestEvidence: accepted.some(o => o.evidence.some(e => e.source === 'latest')) };
}
