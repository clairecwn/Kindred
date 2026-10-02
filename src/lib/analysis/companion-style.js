/** Final style boundary for every user-visible companion response. */

export const COMPANION_STYLE_VERSION = "companion-style-2026.10.2";

const LONG_DASH = /\s*[—–]\s*/g;

export function normaliseCompanionStyle(text) {
  return String(text ?? "")
    .replace(LONG_DASH, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function hasArtificialStyleTell(text) {
  const value = String(text ?? "");
  if (/[—–]/.test(value)) return "long-dash";
  if (/\b(?:delve|unpack this|hold space|give yourself grace|healing journey|navigate these feelings)\b/i.test(value)) return "therapy-cliche";
  if (/\b(?:thank you for sharing|your feelings are valid|i hear you|i'?m here with you|tell me more|say more about that)\b/i.test(value)) return "canned-empathy";
  if (/^(?:it sounds like|it seems like|what i(?:'m| am) hearing is)\b/i.test(value)) return "formulaic-opener";
  return null;
}
