/**
 * Clause-level cognitive appraisal for informal journal text.
 *
 * VAD tells us where affect points; appraisal explains WHY. The dimensions
 * below are adapted into a bounded, deterministic text model from appraisal
 * research (pleasantness/goal-conduciveness, anticipated effort, certainty,
 * control and attention). They are linguistic evidence, not mind-reading.
 *
 * For cue weights w_i >= 0, each dimension uses exponential saturation:
 *
 *   E = 1 - exp(-sum_i w_i)
 *
 * This is monotone, bounded in [0,1], has diminishing returns, and prevents a
 * repeated slang word from growing a score without limit. Appraisal-to-VAD
 * deltas are a fixed affine map followed by the caller's [-1,1] clamp.
 */

export const THOUGHT_APPRAISAL_VERSION = "appraisal-2026.10.3";

const NORMALISATIONS = Object.freeze([
  [/\btdy\b/gi, "today"],
  [/\btmr\b/gi, "tomorrow"],
  [/\btmrw\b/gi, "tomorrow"],
  [/\bhw\b/gi, "homework"],
  [/\bsch\b/gi, "school"],
  [/\bassign(?:ment)?s?\b/gi, "assignments"],
  [/\bsianz+\b/gi, "sian"],
  [/\bsiann+\b/gi, "sian"],
  [/\bcant\b/gi, "cannot"],
  [/\bdw\b/gi, "don't want"],
  [/\bidw\b/gi, "i don't want"],
  [/\bgna\b/gi, "gonna"],
  [/\bprac\b/gi, "practice"],
]);

const CUE_GROUPS = Object.freeze({
  transitionLoss: [
    { re: /\b(?:holiday|holidays|break|weekend|leave|vacation|time off|rest)\s+(?:is\s+|are\s+)?(?:gonna\s+|going\s+to\s+|will\s+)?(?:end|ending|over|finish|finishing)(?:\s+liao|\s+already|\s+soon)?\b/i, w: 1.0, label: "a restorative period ending", responsePhrase: "the restorative time ending" },
    { re: /\b(?:back|return(?:ing)?)\s+to\s+(?:school|work|class|classes|office|routine|responsibilities)\b/i, w: 0.85, label: "an upcoming return to obligations", responsePhrase: "the return to obligations" },
    { re: /\b(?:school|work|class|classes|term|routine)\s+(?:is\s+|are\s+)?(?:starting|starts|resuming|resumes)(?:\s+soon|\s+again)?\b/i, w: 0.8, label: "an upcoming return to routine", responsePhrase: "the routine starting again" },
  ],
  obligation: [
    { re: /\b(?:need(?:\s+to)?|have to|has to|had to|must|gotta|supposed to|required to|cannot avoid)\b/i, w: 0.8, label: "felt obligation", responsePhrase: "having to act despite the reluctance" },
    { re: /\b(?:no choice|bo bian|bo pian|cannot escape|can't escape)\b/i, w: 1.0, label: "lack of choice", responsePhrase: "feeling there is little choice" },
  ],
  workload: [
    { re: /\b(?:clear|clearing|finish|finishing|complete|completing|do|doing|start|starting|catch up(?: on)?|chiong|mug|study|studying)\s+(?:my\s+|the\s+|some\s+|all\s+)?(?:work|homework|assignments?|revision|tasks?|backlog|chores?|projects?|reports?)\b/i, w: 0.95, label: "unfinished demands requiring effort", responsePhrase: "the unfinished demands" },
    { re: /\b(?:homework|assignments?|revision|backlog|deadlines?|tasks? piling up|workload)\b/i, w: 0.55, label: "pending workload", responsePhrase: "the pending workload" },
    { re: /\b(?:so much|a lot of|pile of|tons of|too much|loads of)\s+(?:work|homework|assignments?|revision|tasks?|stuff to do)\b/i, w: 0.8, label: "heavy workload", responsePhrase: "the amount that needs doing" },
  ],
  activationResistance: [
    { re: /\b(?:damn\s+|very\s+|so\s+|sibei\s+)?sian\b/i, w: 0.9, label: "low motivation / fed-up resistance", responsePhrase: "the lack of motivation" },
    { re: /\b(?:lazy|no mood|don't feel like|do not feel like|cannot bring myself|can't bring myself|hard to start|struggling to start|drag myself|putting it off|procrastinat\w*)\b/i, w: 0.85, label: "difficulty getting started", responsePhrase: "the difficulty getting started" },
    { re: /\b(?:shag|shagged|drained|exhausted|worn out|no energy|low energy)\b/i, w: 0.6, label: "depleted energy", responsePhrase: "the depleted energy" },
  ],
  effortfulExperience: [
    { re: /\b(?:practice|training|session|match|game|workout|lesson|class|shift|rehearsal|attempt)\b.{0,45}\b(?:hard|tough|rough|intense|gruelling|grueling|shag|exhausting|draining)\b|\b(?:hard|tough|rough|intense|gruelling|grueling|shag|exhausting|draining)\b.{0,45}\b(?:practice|training|session|match|game|workout|lesson|class|shift|rehearsal|attempt)\b/i, w: 0.85, label: "a demanding experience", responsePhrase: "how demanding the experience was" },
    { re: /\b(?:struggled?|struggling|couldn'?t keep up|could not keep up|had a hard time)\b/i, w: 0.75, label: "difficulty during the activity", responsePhrase: "how difficult it felt in the moment" },
  ],
  outcomeShortfall: [
    { re: /\b(?:wasn'?t|was not|weren'?t|were not|didn'?t|did not|don'?t think i|do not think i)\b.{0,45}\b(?:play(?:ing|ed)?|perform(?:ing|ed)?|do|did|doing)\b.{0,30}\b(?:my |the )?(?:best|well|good)\b|\b(?:play(?:ing|ed)?|perform(?:ing|ed)?)\b.{0,35}\b(?:not (?:my |the )?best|not (?:very )?(?:well|good)|badly|poorly|off)\b/i, w: 1.0, label: "falling short of one's hoped-for performance", responsePhrase: "not playing or performing as well as hoped" },
    { re: /\b(?:practice|training|session|match|game|workout|lesson|class|shift|attempt|today|day)\b.{0,35}\b(?:not (?:very )?good|went (?:badly|poorly)|didn'?t go well|did not go well|was (?:bad|rough|jialat)|felt off)\b|\b(?:not (?:very )?good|went (?:badly|poorly)|didn'?t go well|did not go well|felt off)\b.{0,35}\b(?:practice|training|session|match|game|workout|lesson|class|shift|attempt|today|day)\b/i, w: 0.85, label: "an experience that did not go as hoped", responsePhrase: "the session not going as well as hoped" },
  ],
  futureHope: [
    { re: /\b(?:hope|hopefully|wish)\b.{0,35}\b(?:tomorrow|next time|next attempt|later|soon|the next (?:practice|session|match|game|rehearsal))\b.{0,20}\b(?:better|improve|easier|go well)|\b(?:hope|hopefully|wish)\s+(?:tomorrow|next time|next attempt|it|things?)\s+(?:will be|is|goes?|gets?)?\s*better\b/i, w: 0.85, label: "hope that the next attempt will go better", responsePhrase: "wanting the next attempt to go better" },
  ],
  discomfort: [
    { re: /\b(?:weather\s+)?(?:is\s+|feels?\s+)?(?:so|very|damn|too|super|sibei|unbearably)\s+(?:hot|humid|stuffy)\b/i, w: 0.95, label: "uncomfortable weather", responsePhrase: "the physical discomfort" },
    { re: /\b(?:humid|humidity|sweaty|sweltering|cannot tahan (?:the )?heat|buay tahan (?:the )?heat|heat is getting to me|weather is draining)\b/i, w: 0.85, label: "physical discomfort from the environment", responsePhrase: "the uncomfortable environment" },
    { re: /\b(?:too|so|very|damn)\s+(?:noisy|crowded|bright|cold|stuffy)\b/i, w: 0.7, label: "environmental discomfort", responsePhrase: "the uncomfortable surroundings" },
  ],
  urgency: [
    { re: /\b(?:by today|due today|by tonight|due tonight|right now|by tomorrow|due soon|deadline)\b/i, w: 0.5, label: "immediate time pressure" },
    { re: /\b(?:running out of time|last minute|need(?:\s+to)?\s+start|better start)\b/i, w: 0.75, label: "pressure to begin" },
  ],
  exasperation: [
    { re: /\b(?:wah|walao|walau|alamak|aiya|aiyah|haiz|pek chek|rabak)\b/i, w: 0.65, label: "exasperated stance" },
    { re: /\b(?:damn|bloody|really)\b/i, w: 0.35, label: "emphatic intensity" },
  ],
  activeIntent: [
    { re: /\b(?:i(?:'m| am)? going to|i(?:'m| am)? gonna|i will|i'll|need(?:\s+to)?\s+start|start clearing|start working|i decided)\b/i, w: 0.5, label: "intention to act despite reluctance" },
  ],
});

function normaliseInformalText(text) {
  let normalized = String(text ?? "").toLowerCase();
  const replacements = [];
  for (const [pattern, replacement] of NORMALISATIONS) {
    normalized = normalized.replace(pattern, (matched) => {
      replacements.push({ surface: matched, normalized: replacement });
      return replacement;
    });
  }
  return { normalized: normalized.replace(/\s+/g, " ").trim(), replacements };
}

function matchGroup(text, rules) {
  const matches = [];
  for (const rule of rules) {
    const match = text.match(rule.re);
    if (match) matches.push({ text: match[0], weight: rule.w, label: rule.label, responsePhrase: rule.responsePhrase ?? rule.label, index: match.index ?? -1 });
  }
  return matches;
}

export function saturatingEvidence(weightSum) {
  return weightSum > 0 ? 1 - Math.exp(-weightSum) : 0;
}

function score(matches) {
  return saturatingEvidence(matches.reduce((sum, match) => sum + match.weight, 0));
}

export function appraiseThoughts(text) {
  const { normalized, replacements } = normaliseInformalText(text);
  const matches = Object.fromEntries(
    Object.entries(CUE_GROUPS).map(([key, rules]) => [key, matchGroup(normalized, rules)])
  );
  const cue = Object.fromEntries(Object.entries(matches).map(([key, value]) => [key, score(value)]));

  // Derived appraisal dimensions. Each is itself saturated so overlapping
  // evidence combines sub-linearly rather than being double-counted.
  const anticipatedEffort = saturatingEvidence(cue.workload + 0.7 * cue.obligation + 0.45 * cue.urgency);
  const situationalConstraint = saturatingEvidence(cue.obligation + 0.7 * cue.transitionLoss - 0.35 * cue.activeIntent);
  const futureThreat = saturatingEvidence(cue.transitionLoss + 0.45 * cue.urgency);
  const taskAversiveness = saturatingEvidence(cue.activationResistance + 0.35 * cue.workload + 0.25 * cue.discomfort);
  const goalObstruction = saturatingEvidence(0.55 * cue.workload + 0.65 * cue.discomfort + 0.35 * cue.transitionLoss + 0.55 * cue.effortfulExperience + 0.7 * cue.outcomeShortfall);
  const pressure = saturatingEvidence(0.65 * anticipatedEffort + 0.55 * cue.urgency + 0.35 * cue.exasperation + 0.45 * cue.effortfulExperience);
  const outcomeDiscrepancy = saturatingEvidence(cue.outcomeShortfall + 0.35 * cue.effortfulExperience);

  const vadDelta = {
    valence: -0.14 * goalObstruction - 0.12 * taskAversiveness - 0.08 * futureThreat - 0.07 * cue.discomfort - 0.15 * outcomeDiscrepancy + 0.04 * cue.futureHope,
    arousal: 0.20 * pressure + 0.17 * cue.discomfort + 0.12 * futureThreat + 0.12 * cue.exasperation + 0.08 * cue.outcomeShortfall - 0.13 * cue.activationResistance,
    dominance: -0.18 * situationalConstraint - 0.08 * cue.workload - 0.12 * outcomeDiscrepancy + 0.10 * cue.activeIntent + 0.05 * cue.futureHope,
  };

  const causes = [];
  for (const key of ["outcomeShortfall", "effortfulExperience", "futureHope", "transitionLoss", "workload", "discomfort", "obligation", "activationResistance", "urgency"]) {
    for (const match of matches[key]) causes.push({ type: key, ...match });
  }
  causes.sort((a, b) => b.weight - a.weight || a.index - b.index);

  return {
    version: THOUGHT_APPRAISAL_VERSION,
    normalizedText: normalized,
    replacements,
    cues: cue,
    dimensions: {
      anticipatedEffort,
      situationalConstraint,
      futureThreat,
      taskAversiveness,
      goalObstruction,
      pressure,
      outcomeDiscrepancy,
      effortfulExperience: cue.effortfulExperience,
      futureHope: cue.futureHope,
      physicalDiscomfort: cue.discomfort,
      activationResistance: cue.activationResistance,
      activeIntent: cue.activeIntent,
    },
    vadDelta,
    causes: causes.slice(0, 5),
  };
}

/**
 * Convert appraisal structure to user-facing nuance while preserving a
 * separate coarse VAD family for arithmetic and UI colour mapping.
 */
export function deriveInterpretiveEmotion(features, coarseEmotion = "neutral") {
  const d = features?.appraisal?.dimensions;
  if (!d) return { emotion: coarseEmotion, family: coarseEmotion, components: [coarseEmotion] };

  const components = [];
  const disappointed = d.outcomeDiscrepancy >= 0.4;
  const frustrated = d.goalObstruction >= 0.35 && (d.pressure >= 0.25 || d.physicalDiscomfort >= 0.35 || d.effortfulExperience >= 0.4);
  if (disappointed) components.push("disappointed");
  if (frustrated) components.push("frustrated");
  if (d.activationResistance >= 0.45 && d.anticipatedEffort >= 0.35) components.push("unmotivated");
  if (d.futureThreat >= 0.4 && d.anticipatedEffort >= 0.35) components.push("dreading the demands ahead");
  if (!components.length && d.physicalDiscomfort >= 0.5) components.push("irritable from physical discomfort");
  if (!components.length && d.taskAversiveness >= 0.5) components.push("fed up and reluctant to start");
  if (!components.length) return { emotion: coarseEmotion, family: coarseEmotion, components: [coarseEmotion] };

  const emotion = components.length === 1
    ? components[0]
    : components.length === 2
      ? `${components[0]} and ${components[1]}`
      : `${components.slice(0, -1).join(", ")}, and ${components.at(-1)}`;
  // A blocked result can be frustrating without being interpersonal anger.
  // Outcome discrepancy takes precedence so anger-specific scripts are not
  // selected merely because an activity went worse than the person hoped.
  const family = disappointed ? "sad" : frustrated ? "angry" : d.futureThreat >= 0.4 ? "anxious" : "tired";
  return { emotion, family, components };
}
