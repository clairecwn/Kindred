/**
 * Keepsakes.jsx — the six illustrated objects living on the cottage
 * windowsill. Each is a small, fully-shaded flat illustration (outline +
 * fill + one highlight/shade band) at a 24x24 local scale, never emoji,
 * never a plain colour swatch. Caller positions with a transform.
 */
const OUTLINE = "#2B1A10";

export function Shell() {
  return (
    <g aria-hidden="true">
      <path d="M-10 8 Q-11 -6 0 -10 Q11 -6 10 8 Q0 12 -10 8Z" fill="#F2C89A" stroke={OUTLINE} strokeWidth="1.6" />
      <path d="M0 -10 L0 9" stroke="#C89858" strokeWidth="1.1" />
      <path d="M-5 -7 Q-6 0 -6 7" stroke="#C89858" strokeWidth="1" fill="none" />
      <path d="M5 -7 Q6 0 6 7" stroke="#C89858" strokeWidth="1" fill="none" />
      <path d="M-8 -2 Q0 -6 8 -2" stroke="#FFEFD2" strokeWidth="1.2" fill="none" opacity="0.7" />
    </g>
  );
}

export function GrowingPlant() {
  return (
    <g aria-hidden="true">
      <path d="M-7 10 L-5 -1 L5 -1 L7 10Z" fill="#C9814E" stroke={OUTLINE} strokeWidth="1.6" />
      <path d="M-5 -1 L-6 3 L6 3 L5 -1Z" fill="#A4642F" />
      <path d="M0 -1 C-2 -9 -9 -9 -9 -13 C-3 -13 0 -8 0 -1Z" fill="#5E9C6E" stroke={OUTLINE} strokeWidth="1.3" />
      <path d="M0 -1 C2 -11 10 -10 10 -15 C3 -15 0 -9 0 -1Z" fill="#6FB07E" stroke={OUTLINE} strokeWidth="1.3" />
      <path d="M0 -1 C0 -12 0 -16 0 -18 C1 -12 1 -6 1 -1Z" fill="#4C8760" />
    </g>
  );
}

export function FramedLine() {
  return (
    <g aria-hidden="true">
      <rect x="-10" y="-10" width="20" height="20" rx="2" fill="#8A5A38" stroke={OUTLINE} strokeWidth="1.6" />
      <rect x="-7" y="-7" width="14" height="14" fill="#FBF1DC" />
      <path d="M-5 -1 Q-2 -5 0 -1 Q2 3 5 -1" stroke="#C0783E" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M-8 -9 L7 -9" stroke="#B98C5C" strokeWidth="1.4" opacity="0.6" />
    </g>
  );
}

export function PathStone() {
  return (
    <g aria-hidden="true">
      <ellipse cx="0" cy="2" rx="10" ry="7" fill="#B4ADA0" stroke={OUTLINE} strokeWidth="1.6" />
      <path d="M-8 3 Q0 8 8 3 Q0 6 -8 3Z" fill="#928B7E" opacity="0.7" />
      <path d="M-4 -2 Q0 -4 4 -1" stroke="#DCD6C8" strokeWidth="1.2" fill="none" opacity="0.8" />
    </g>
  );
}

export function PaperLantern() {
  return (
    <g aria-hidden="true">
      <ellipse cx="0" cy="0" rx="9" ry="10" fill="#F0B24A" stroke={OUTLINE} strokeWidth="1.6" />
      <path d="M-9 0 Q0 4 9 0" stroke="#C2811E" strokeWidth="1" fill="none" opacity="0.7" />
      <path d="M-9 -3 Q0 -6 9 -3" stroke="#C2811E" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M-6 -6 Q-2 -2 -4 4" stroke="#FFE7A8" strokeWidth="1.4" fill="none" opacity="0.6" />
      <rect x="-2" y="-12" width="4" height="3" fill="#8A5A38" />
      <path d="M0 10 L0 14" stroke="#8A5A38" strokeWidth="1.4" />
    </g>
  );
}

export function WeatherJar() {
  return (
    <g aria-hidden="true">
      <path d="M-7 -6 L7 -6 L6 9 Q0 12 -6 9Z" fill="rgba(180,212,224,0.55)" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="-8" y="-9" width="16" height="4" rx="1.5" fill="#8A5A38" stroke={OUTLINE} strokeWidth="1.3" />
      <path d="M-3 2 Q0 -3 3 1 Q1 5 -1 6Z" fill="#EAF4F8" opacity="0.85" />
      <path d="M-5 -4 L-5 6" stroke="#FFFFFF" strokeWidth="1" opacity="0.4" />
    </g>
  );
}

export const KEEPSAKES = [Shell, GrowingPlant, FramedLine, PathStone, PaperLantern, WeatherJar];
