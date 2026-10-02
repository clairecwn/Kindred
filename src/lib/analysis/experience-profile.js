/**
 * A compositional description of emotional experience.
 *
 * This is deliberately not another finite emotion dictionary. It preserves
 * emotion language the user chose, then combines continuous VAD coordinates
 * with appraisal, attribution, certainty, social meaning, needs and tensions.
 * The resulting profile can describe many blends without pretending that one
 * canonical label is the whole experience.
 */

export const EXPERIENCE_PROFILE_VERSION = "experience-profile-2026.10.2";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const sat = (value) => value > 0 ? 1 - Math.exp(-value) : 0;

const SIGNALS = Object.freeze({
  selfEvaluation: /\b(?:my fault|i messed up|i failed|i (?:(?:am|'m|was) )?(?:just )?not good enough|i wasn'?t good enough|not my best|should have|should'?ve|let myself down|disappointed in myself|embarrassed|paiseh)\b/i,
  otherAgency: /\b(?:they|he|she|my (?:friend|boss|teacher|parent|partner|teammate|classmate|colleague))\b.{0,70}\b(?:made|forced|ignored|blamed|changed|cancelled|canceled|lied|shouted|disrespected|excluded|ghosted)\b/i,
  unfairness: /\b(?:unfair|not fair|double standard|blamed for|taken advantage|used me|disrespect|no right to|why should i)\b/i,
  uncertainty: /\b(?:i don'?t know|idk|not sure|maybe|perhaps|might|confused|can'?t tell|cannot tell|hard to say|somehow|weirdly)\b/i,
  certainty: /\b(?:definitely|clearly|for sure|i know|certainly|without a doubt|really is|really was)\b/i,
  socialExposure: /\b(?:judged|watching me|everyone saw|in front of everyone|embarrass|paiseh|lose face|look stupid|let (?:them|the team|everyone) down)\b/i,
  connection: /\b(?:supported|understood|included|welcomed|cared for|checked on me|had my back|not alone|together)\b/i,
  disconnection: /\b(?:ignored|left out|excluded|forgotten|not invited|ghosted|alone|lonely|nobody|no one understands|don'?t belong|do not belong)\b/i,
  loss: /\b(?:miss|missing|lost|gone|ended|over now|broke up|breakup|passed away|not coming back)\b/i,
  achievement: /\b(?:proud|accomplished|achieved|finally finished|pulled it off|did it|made progress|small win)\b/i,
  relief: /\b(?:relieved|relief|weight off|glad .* over|can breathe|finally done|pressure is off)\b/i,
  hope: /\b(?:hope|hopefully|looking forward|maybe .* better|next time .* better|tomorrow .* better)\b/i,
  ambivalence: /\b(?:part of me|on one hand|torn|mixed feelings|but at the same time|want to .{0,45} but|glad .{0,45} but)\b/i,
});

const NEEDS = Object.freeze([
  ["rest", /\b(?:rest|sleep|relax|switch off|break|downtime|recover|breathe)\b/i],
  ["competence", /\b(?:do well|do better|perform|improve|better at|capable|good enough|my best|succeed|pass)\b/i],
  ["autonomy", /\b(?:no choice|forced|have to|must|control|decide for myself|my own choice|bo bian)\b/i],
  ["connection", /\b(?:understand me|listen|support|include|belong|close to|with me|reply)\b/i],
  ["fairness", /\b(?:fair|unfair|equal|blamed|credit|respect|double standard)\b/i],
  ["certainty", /\b(?:know what|not sure|uncertain|clear answer|what will happen|keeps changing|predict)\b/i],
  ["safety", /\b(?:safe|unsafe|scared|threat|afraid|danger|protect)\b/i],
  ["meaning", /\b(?:matter|meaning|point of|worth it|purpose|why am i doing)\b/i],
]);

function evidence(pattern, text, weight = 1) {
  return pattern.test(text) ? sat(weight) : 0;
}

function explicitFeelingLanguage(text) {
  const claims = [];
  const patterns = [
    /\b(?:i feel|i felt|i'?m feeling|im feeling)\s+([^.!?,;]{2,55})/gi,
    /\b(?:i am|i'?m|im)\s+([^.!?,;]{2,38})/gi,
  ];
  for (const pattern of patterns) {
    for (const match of String(text ?? "").matchAll(pattern)) {
      const phrase = match[1].trim().replace(/\s+/g, " ").split(/\b(?:because|when|about|that)\b/i)[0].trim();
      if (phrase && phrase.split(/\s+/).length <= 7 && !claims.includes(phrase)) claims.push(phrase);
    }
  }
  return claims.slice(0, 3);
}

function band(value, low, high, labels) {
  if (value <= low) return labels[0];
  if (value >= high) return labels[2];
  return labels[1];
}

function inferTensions(dimensions, needs) {
  const tensions = [];
  if (dimensions.outcomeDiscrepancy >= 0.4 && dimensions.effort >= 0.35) tensions.push("high effort versus a result that felt below expectation");
  if (dimensions.constraint >= 0.4 && needs.includes("rest")) tensions.push("obligation versus the need to recover");
  if (dimensions.hope >= 0.4 && dimensions.goalCongruence < -0.2) tensions.push("a difficult present experience alongside hope for what comes next");
  if (dimensions.connection <= -0.35 && needs.includes("connection")) tensions.push("wanting connection while feeling unsupported or left out");
  if (dimensions.selfEvaluation >= 0.45 && dimensions.control < 0) tensions.push("holding yourself responsible while feeling short on control");
  if (dimensions.ambivalence >= 0.4) tensions.push("two competing reactions that both matter");
  return tensions.slice(0, 3);
}

export function buildExperienceProfile(features = {}, text = "") {
  const source = String(text ?? "");
  const appraisal = features.appraisal?.dimensions ?? {};
  const vad = features.vad ?? { valence: 0, arousal: 0, dominance: 0 };
  const selfEvaluation = evidence(SIGNALS.selfEvaluation, source, 1.0);
  const otherAgency = evidence(SIGNALS.otherAgency, source, 0.9);
  const circumstanceAgency = clamp(1 - Math.max(selfEvaluation, otherAgency));
  const uncertainty = evidence(SIGNALS.uncertainty, source, 0.9);
  const certaintyCue = evidence(SIGNALS.certainty, source, 0.8);
  const connection = evidence(SIGNALS.connection, source, 0.9) - evidence(SIGNALS.disconnection, source, 1.0);
  const socialExposure = evidence(SIGNALS.socialExposure, source, 0.95);
  const unfairness = evidence(SIGNALS.unfairness, source, 1.0);
  const hope = Math.max(appraisal.futureHope ?? 0, evidence(SIGNALS.hope, source, 0.8));
  const dimensions = {
    valence: vad.valence ?? 0,
    activation: vad.arousal ?? 0,
    control: vad.dominance ?? 0,
    certainty: clamp(0.5 + 0.5 * certaintyCue - 0.7 * uncertainty),
    goalCongruence: clamp(1 - 2 * (appraisal.goalObstruction ?? 0), -1, 1),
    effort: clamp(Math.max(appraisal.anticipatedEffort ?? 0, appraisal.effortfulExperience ?? 0)),
    constraint: clamp(appraisal.situationalConstraint ?? 0),
    outcomeDiscrepancy: clamp(appraisal.outcomeDiscrepancy ?? 0),
    selfEvaluation,
    otherAgency,
    circumstanceAgency,
    socialExposure,
    unfairness,
    connection: clamp(connection, -1, 1),
    loss: evidence(SIGNALS.loss, source, 0.9),
    achievement: evidence(SIGNALS.achievement, source, 0.9),
    relief: evidence(SIGNALS.relief, source, 0.9),
    hope,
    ambivalence: Math.max(evidence(SIGNALS.ambivalence, source, 0.9), features.dialecticalAffect?.dialectical ? 0.65 : 0),
  };
  const needs = NEEDS.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
  const explicitLanguage = explicitFeelingLanguage(source);
  const tensions = inferTensions(dimensions, needs);
  return {
    version: EXPERIENCE_PROFILE_VERSION,
    explicitLanguage,
    affect: {
      valence: band(dimensions.valence, -0.12, 0.12, ["unpleasant", "mixed or muted", "pleasant"]),
      activation: band(dimensions.activation, -0.1, 0.16, ["low activation", "moderate activation", "high activation"]),
      agency: band(dimensions.control, -0.12, 0.12, ["low control", "mixed control", "high control"]),
    },
    dimensions,
    needs,
    tensions,
    confidence: clamp(features.vadConfidence ?? 0),
  };
}

export function formatExperienceProfile(profile) {
  if (!profile) return "no experience profile available";
  const d = profile.dimensions;
  return [
    `user-chosen feeling language: ${profile.explicitLanguage.length ? profile.explicitLanguage.join("; ") : "none"}`,
    `continuous affect: ${profile.affect.valence}, ${profile.affect.activation}, ${profile.affect.agency}`,
    `appraisal: goal fit ${d.goalCongruence.toFixed(2)}, effort ${d.effort.toFixed(2)}, control ${d.control.toFixed(2)}, certainty ${d.certainty.toFixed(2)}, outcome discrepancy ${d.outcomeDiscrepancy.toFixed(2)}`,
    `attribution/social: self-evaluation ${d.selfEvaluation.toFixed(2)}, other agency ${d.otherAgency.toFixed(2)}, unfairness ${d.unfairness.toFixed(2)}, social exposure ${d.socialExposure.toFixed(2)}, connection ${d.connection.toFixed(2)}`,
    `forward/mixed: hope ${d.hope.toFixed(2)}, relief ${d.relief.toFixed(2)}, achievement ${d.achievement.toFixed(2)}, ambivalence ${d.ambivalence.toFixed(2)}`,
    `possible needs: ${profile.needs.length ? profile.needs.join(", ") : "none stated"}`,
    `supported tensions: ${profile.tensions.length ? profile.tensions.join("; ") : "none strongly supported"}`,
  ].join("\n");
}

/**
 * Create a compact open-vocabulary display phrase from a profile. The phrase
 * is compositional: user language, dimensional state and appraisal features
 * can combine, instead of forcing the whole profile into one winning class.
 */
export function composeExperienceDescription(profile, seedComponents = []) {
  if (!profile) return seedComponents.filter(Boolean).join(" and ") || "hard to name";
  const d = profile.dimensions;
  const parts = [...seedComponents.filter(Boolean)];
  const add = (value) => { if (value && !parts.includes(value)) parts.push(value); };
  const explicit = profile.explicitLanguage.find((phrase) => !/^(?:not|no|fine|okay|ok)\b/i.test(phrase));
  if (explicit && explicit.split(/\s+/).length <= 5) add(explicit);
  if (d.achievement >= 0.45 && d.relief >= 0.45) add("proud and relieved");
  else if (d.achievement >= 0.45) add("proud of the progress");
  else if (d.relief >= 0.45) add("relieved that the pressure has eased");
  if (d.socialExposure >= 0.45 && d.selfEvaluation >= 0.45) add("self-conscious about how you came across");
  else if (d.selfEvaluation >= 0.45) add("hard on yourself about what happened");
  if (d.unfairness >= 0.45 && d.otherAgency >= 0.35) add("wronged and frustrated by how you were treated");
  if (d.connection <= -0.35) add("disconnected and wanting more support");
  if (d.loss >= 0.45) add("missing what is no longer there");
  if (d.certainty <= 0.3 && d.activation > 0.08) add("uncertain and keyed up");
  else if (d.certainty <= 0.3) add("uncertain about what to make of it");
  if (d.hope >= 0.45 && d.valence < 0) add("still hoping things can improve");
  if (!parts.length && d.valence < -0.12 && d.activation > 0.16 && d.control < -0.12) add("strained and short on control");
  else if (!parts.length && d.valence < -0.12 && d.activation <= 0.16) add("worn down by the situation");
  else if (!parts.length && d.valence > 0.12 && d.activation > 0.16) add("energised by what happened");
  else if (!parts.length && d.valence > 0.12) add("quietly positive about it");
  return parts.slice(0, 4).join(", ").replace(/, ([^,]+)$/, parts.length === 2 ? " and $1" : ", and $1");
}
