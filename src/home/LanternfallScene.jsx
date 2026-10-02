import Sky, { RainOverlay } from "./Sky.jsx";
import Cottage from "./Cottage.jsx";
import Lantern from "./Lantern.jsx";
import { getAvatarSpot } from "./avatarSpot.js";

// Eleven lantern positions along the path, ordered far-to-near — index 10
// sits at the doorstep. Fixed hand-placed points so the curve reads as one
// consistent path every time, not a random scatter.
const LANTERN_POINTS = [
  { x: 55, y: 562 }, { x: 140, y: 548 }, { x: 215, y: 528 }, { x: 300, y: 540 },
  { x: 385, y: 510 }, { x: 470, y: 522 }, { x: 555, y: 495 }, { x: 630, y: 505 },
  { x: 700, y: 478 }, { x: 760, y: 488 }, { x: 815, y: 462 },
];

function pathD(points) {
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    d += ` Q${p0.x} ${p0.y} ${mx} ${my}`;
  }
  d += ` T${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
}

/**
 * LanternfallScene — one illustrated exterior, edge to edge, in three
 * moods. Everything here is inline SVG: no emoji, no photo backdrops, no
 * flat placeholder rectangles standing in for objects.
 */
export default function LanternfallScene({ sky = "steady", lanternsLit = 0, character }) {
  const lit = Math.max(0, Math.min(11, lanternsLit));
  const firstLitIndex = 11 - lit;

  const avatarSpot = getAvatarSpot(sky);

  return (
    <svg
      className="lf-scene"
      viewBox="0 0 1280 605"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Your cottage at the edge of the Grove"
    >
      <style>{`
        .lf-scene .lf-flicker,
        .lf-scene .lf-smoke,
        .lf-scene .lf-rain { animation: none; }
        @media (prefers-reduced-motion: no-preference) {
          .lf-scene .lf-flicker { animation: lf-flicker 3.4s ease-in-out infinite; transform-origin: center; }
          .lf-scene .lf-smoke circle:nth-child(1) { animation: lf-smoke-a 6s ease-in-out infinite; }
          .lf-scene .lf-smoke circle:nth-child(2) { animation: lf-smoke-b 6s ease-in-out infinite 0.6s; }
          .lf-scene .lf-smoke circle:nth-child(3) { animation: lf-smoke-c 6s ease-in-out infinite 1.2s; }
          .lf-scene .lf-rain { animation: lf-rain 0.7s linear infinite; }
        }
        @keyframes lf-flicker {
          0%, 100% { opacity: 1; }
          45% { opacity: 0.82; }
          55% { opacity: 0.98; }
          70% { opacity: 0.88; }
        }
        @keyframes lf-smoke-a { 0% { transform: translate(0,0); opacity: 0.7; } 100% { transform: translate(6px,-38px); opacity: 0; } }
        @keyframes lf-smoke-b { 0% { transform: translate(0,0); opacity: 0.65; } 100% { transform: translate(-8px,-46px); opacity: 0; } }
        @keyframes lf-smoke-c { 0% { transform: translate(0,0); opacity: 0.55; } 100% { transform: translate(10px,-54px); opacity: 0; } }
        @keyframes lf-rain { 0% { transform: translate(0,0); } 100% { transform: translate(-14px,60px); } }
      `}</style>

      <defs>
        <radialGradient id="lf-lantern-glow-shared" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFDC8E" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFDC8E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lf-wall-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#402A14" stopOpacity="0.22" />
        </linearGradient>
      </defs>

      {LANTERN_POINTS.map((_, i) => (
        <radialGradient key={i} id={`lf-glow-${i}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFDC8E" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFDC8E" stopOpacity="0" />
        </radialGradient>
      ))}

      <Sky sky={sky} />

      {/* path */}
      <path d={pathD(LANTERN_POINTS)} stroke="#B8895A" strokeWidth="26" fill="none" strokeLinecap="round" opacity="0.9" />
      <path d={pathD(LANTERN_POINTS)} stroke="#9C6E42" strokeWidth="26" fill="none" strokeLinecap="round" strokeDasharray="1 34" opacity="0.5" />

      {sky === "flourishing" && (
        <ellipse cx={avatarSpot.x + 30} cy={avatarSpot.y + 6} rx="70" ry="10" fill="rgba(30,18,6,0.28)" />
      )}

      {LANTERN_POINTS.map((p, i) => (
        <Lantern key={i} id={i} x={p.x} y={p.y} lit={i >= firstLitIndex} delay={i * 0.35} />
      ))}

      <Cottage sky={sky} />

      {/* The actual 3D avatar is composited on top of this SVG by HomeView
          (see AvatarStage + getAvatarSpot) — this scene only draws the
          ground shadow at the same anchor point. */}

      <RainOverlay sky={sky} />
    </svg>
  );
}
