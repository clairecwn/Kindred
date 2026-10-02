/**
 * Deterministic companion-response strategy selection.
 *
 * The language model realises prose; it does not decide what kind of support
 * to provide. This layer turns the measured VAD point and text features into
 * a small, inspectable brief inspired by EPITOME (reaction, interpretation,
 * exploration) and motivational interviewing (reflection before questions,
 * autonomy, no unsolicited fixing).
 */

const CLINICAL_OR_META = /\b(depress(?:ion|ed)?|anxiety disorder|diagnos(?:e|is)|ptsd|bipolar|trauma response|nervous system|vad|valence|arousal|dominance|deterministic|model|analysis)\b/i;
const GENERIC_OPENERS = /^(thank you for sharing|i understand how you feel|your feelings are valid|what i(?:'m| am) hearing is|it sounds like you(?:'re| are) going through a lot)\b/i;
const UNSOLICITED_ADVICE = /\b(you should|you need to|try to|have you tried|the best thing is|make sure you)\b/i;

function listOrNone(items) {
  return items.length ? items : ["none strongly supported"];
}

export function selectCompanionStrategy(hints = {}, analysis = {}) {
  const features = hints.textFeatures ?? analysis.textFeatures ?? {};
  const vad = hints.vad ?? features.vad ?? analysis.vad ?? { valence: 0, arousal: 0, dominance: 0 };
  const confidence = hints.vadConfidence ?? features.vadConfidence ?? analysis.vadConfidence ?? 0;
  const mixed = Boolean(hints.dialecticalAffect ?? features.dialecticalAffect?.dialectical);
  const masked = Boolean(hints.understatement || hints.dialectMaskedDistress || features.maskedDistress);
  const lowAgency = (features.agency?.adjustment ?? 0) < 0;
  const highAgency = (features.agency?.adjustment ?? 0) > 0;
  const appraisal = features.appraisal?.dimensions ?? {};
  const frustratedTaskAversion =
    appraisal.goalObstruction >= 0.35 &&
    appraisal.taskAversiveness >= 0.4 &&
    (appraisal.pressure >= 0.25 || appraisal.physicalDiscomfort >= 0.35);
  const disappointingOutcome = appraisal.outcomeDiscrepancy >= 0.4;

  let mode = "tentative-clarification";
  let reaction = "Stay tentative and curious; the language evidence is sparse.";
  let interpretation = "Reflect only the concrete situation or wording the user supplied.";
  let exploration = "Ask one specific, low-pressure clarifying question.";

  if (confidence > 0 && mixed) {
    mode = "double-sided-reflection";
    reaction = "Acknowledge that the positive and difficult parts coexist without cancelling each other.";
    interpretation = "Use a both/and reflection tied to the entry's concrete details.";
    exploration = "Invite the user to choose which side needs attention, without forcing a resolution.";
  } else if (confidence > 0 && disappointingOutcome) {
    mode = "outcome-disappointment";
    reaction = "Acknowledge that the activity or result did not go as well as the person hoped.";
    interpretation = "Reflect the gap between effort, expectation and perceived performance. Frustration here is not evidence of anger, hurt, disrespect or conflict.";
    exploration = "Help them separate one difficult attempt from what they want for the next attempt.";
  } else if (confidence > 0 && frustratedTaskAversion) {
    mode = "frustration-and-task-aversion";
    reaction = "Acknowledge the concrete demands and discomfort that are making it hard to get started.";
    interpretation = "Reflect frustration, reluctance and anticipatory dread; do not collapse them into sadness or morally label the person lazy.";
    exploration = "A question is optional; if used, ask which concrete pressure is most aggravating.";
  } else if (confidence > 0 && masked) {
    mode = "tentative-understatement-reflection";
    reaction = "Respond to the weight beneath the understated wording, but use tentative language.";
    interpretation = "Name the likely resignation, strain, shame, or tiredness as a possibility—not a fact.";
    exploration = "Offer one precise check-back such as whether the tentative reading fits.";
  } else if (vad.valence < -0.1 && vad.arousal > 0.1) {
    mode = "contain-and-clarify";
    reaction = "Meet the intensity with calm, plain language; do not mirror or amplify it.";
    interpretation = "Reflect the explicit pressure or conflict before discussing action.";
    exploration = "Ask about the most pressing part, not for the whole story at once.";
  } else if (vad.valence < -0.1 && vad.arousal <= 0.1) {
    mode = "low-demand-presence";
    reaction = "Use quiet acknowledgement without cheerleading or urgency.";
    interpretation = "Reflect the burden, depletion, hurt, or withdrawal supported by the entry.";
    exploration = "Make any question optional and easy to answer.";
  } else if (vad.valence > 0.1 && highAgency) {
    mode = "specific-affirmation";
    reaction = "Notice the concrete effort, choice, or success without exaggerating it.";
    interpretation = "Connect the positive feeling to what the user actually did or valued.";
    exploration = "Invite them to notice what helped, without turning the moment into homework.";
  } else if (vad.valence > 0.1) {
    mode = "savour-and-reflect";
    reaction = "Share the positive moment without hype or forced optimism.";
    interpretation = "Reflect the specific source of relief, calm, pride, connection, or enjoyment.";
    exploration = "A question is optional; a concise reflection may be enough.";
  }

  const thoughtCues = [];
  if ((features.selfDiscrepancyCount ?? 0) > 0) thoughtCues.push("self-discrepancy or should-thinking");
  if ((features.absolutistCount ?? 0) > 0) thoughtCues.push("all-or-nothing wording");
  if ((features.minimisationCount ?? 0) > 0) thoughtCues.push("minimisation");
  if ((features.hedgingCount ?? 0) > 0) thoughtCues.push("hedging");
  if (features.temporal?.dominant && features.temporal.dominant !== "none") thoughtCues.push(`${features.temporal.dominant}-oriented thinking`);
  const informalFunctions = new Set((features.informal?.markers ?? []).map((marker) => marker.function));
  if (informalFunctions.has("uncertainty")) thoughtCues.push("informal uncertainty marker");
  if (informalFunctions.has("candour")) thoughtCues.push("candid framing");
  if (informalFunctions.has("laughter")) thoughtCues.push("contextual laughter/softening marker");
  if (informalFunctions.has("exclamation")) thoughtCues.push("surprise or emphatic framing");

  const copingCues = [];
  if (lowAgency) copingCues.push("feeling constrained or reduced agency");
  if (highAgency) copingCues.push("active coping or expressed agency");
  if ((features.somaticCount ?? 0) > 0) copingCues.push("distress expressed through bodily language");
  if (features.informal?.maskedDistress) copingCues.push("distress softened or framed through laughter");

  return {
    mode,
    reaction,
    interpretation,
    exploration,
    thoughtCues: listOrNone(thoughtCues),
    copingCues: listOrNone(copingCues),
    advicePolicy: "Do not give advice or coping steps unless the user explicitly asks for them.",
    voice: "plain, warm, specific, non-clinical, and proportionate to the user's own intensity",
  };
}

export function formatCompanionStrategy(strategy) {
  return `RESPONSE STRATEGY (deterministically selected):
- Mode: ${strategy.mode}
- Emotional reaction: ${strategy.reaction}
- Interpretation: ${strategy.interpretation}
- Exploration: ${strategy.exploration}
- Thought-language cues: ${strategy.thoughtCues.join(", ")}
- Behaviour/coping cues: ${strategy.copingCues.join(", ")}
- Advice: ${strategy.advicePolicy}
- Voice: ${strategy.voice}`;
}

/** Reject common unsafe, robotic, or contract-breaking completions. */
export function validateCompanionResponse(text, context = {}) {
  const value = String(text ?? "").trim();
  const words = value.split(/\s+/).filter(Boolean);
  const questionCount = (value.match(/\?/g) ?? []).length;
  if (!value) return { ok: false, reason: "empty" };
  if (words.length < 8 || words.length > 75) return { ok: false, reason: "length" };
  if (questionCount > 1) return { ok: false, reason: "too-many-questions" };
  if (/^\s*[-*•]|\n\s*[-*•]/m.test(value)) return { ok: false, reason: "list-format" };
  if (CLINICAL_OR_META.test(value)) return { ok: false, reason: "clinical-or-meta-language" };
  if (GENERIC_OPENERS.test(value)) return { ok: false, reason: "generic-opener" };
  if (UNSOLICITED_ADVICE.test(value)) return { ok: false, reason: "unsolicited-advice" };
  if (/\b(?:not simply|not just|rather than)\s+(?:sad|anxious|angry|happy|tired)|\byou sound\s+(?:sad|anxious|angry|depressed|frustrated|unmotivated)\b/i.test(value)) {
    return { ok: false, reason: "diagnostic-or-comparative-emotion-verdict" };
  }
  if (/\byou(?:'re| are) allowed to be (?:angry|mad|sad|upset)|what(?:'s| is) underneath it.{0,40}(?:hurt|disrespect)/i.test(value)) {
    return { ok: false, reason: "unsupported-emotion-script" };
  }

  const d = context.features?.appraisal?.dimensions;
  const strongTaskAversion =
    d?.goalObstruction >= 0.35 &&
    d?.taskAversiveness >= 0.4 &&
    (d?.pressure >= 0.25 || d?.physicalDiscomfort >= 0.35);
  if (strongTaskAversion) {
    const grounded = /\b(work|workload|homework|task|assignment|backlog|deadline|demand|obligation|start|begin|routine|holiday|vacation|weekend|time off|break|ending|heat|hot|humid|weather|noise|noisy|discomfort|sian|fed up|frustrat|irritat|unmotivat|reluctan|dread|get moving|get started)\b/i.test(value);
    const genericSadness = /\b(sad|heavy without (?:a )?(?:clear )?reason|carry it alone|carrying alone)\b/i.test(value);
    if (!grounded) return { ok: false, reason: "missing-appraisal-grounding" };
    if (genericSadness) return { ok: false, reason: "misread-as-generic-sadness" };
  }
  return { ok: true, reason: null };
}
