const OUTLINE = "#2B1A10";

/**
 * One illustrated lantern post. Lit ones get a warm glow pool on the
 * ground and a gentle flicker (CSS animation, disabled entirely under
 * prefers-reduced-motion via the stylesheet in LanternfallScene.jsx).
 */
export default function Lantern({ x, y, lit, delay = 0, id }) {
  const glowId = `lf-glow-${id}`;
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      {lit && (
        <g className="lf-flicker" style={{ animationDelay: `${delay}s` }}>
          <ellipse cx="0" cy="4" rx="34" ry="10" fill={`url(#${glowId})`} />
        </g>
      )}
      {/* post */}
      <rect x="-3" y="-38" width="6" height="40" fill="#5A3B22" stroke={OUTLINE} strokeWidth="1.4" />
      <path d="M-3 -38 L3 -38 L3 -10 L-3 -10Z" fill="#3F2A18" opacity="0.4" />
      {/* lamp head */}
      <path d="M-9 -50 L9 -50 L7 -38 L-7 -38Z" fill={lit ? "#F0B24A" : "#4A4438"} stroke={OUTLINE} strokeWidth="1.6" />
      <rect x="-2.4" y="-58" width="4.8" height="4" fill="#3A2A18" />
      <path d="M-8.5 -49 L-3 -46 L-3 -39 L-8.5 -39Z" fill={lit ? "#FFE9AE" : "#3A362E"} opacity="0.8" />
      {lit && (
        <g className="lf-flicker" style={{ animationDelay: `${delay}s` }}>
          <circle cx="0" cy="-44" r="13" fill={`url(#${glowId})`} opacity="0.9" />
        </g>
      )}
      <path d="M-9 -50 Q0 -55 9 -50" stroke={lit ? "#FFDD8A" : "#6A6458"} strokeWidth="1.4" fill="none" opacity="0.7" />
      <path d="M-9 -38 L9 -38 L6 -34 L-6 -34Z" fill="#3F2A18" />
    </g>
  );
}
