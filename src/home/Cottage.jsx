import { KEEPSAKES } from "./Keepsakes.jsx";

const OUTLINE = "#2B1A10";

/**
 * The one cottage the whole game is anchored to — same walls, same door,
 * same window in every state. Only the light, the shutters and the smoke
 * change between steady / rough / flourishing.
 */
export default function Cottage({ sky }) {
  const shuttersOpen = sky !== "rough";
  const windowOpen = sky === "flourishing";
  const glowStrength = sky === "rough" ? 1 : sky === "flourishing" ? 0.85 : 0.95;

  return (
    <g aria-hidden="true">
      {/* ground shadow under the house */}
      <ellipse cx="915" cy="474" rx="180" ry="16" fill="rgba(20,14,8,0.22)" />

      {/* chimney smoke (behind roof so it emerges from the flue) */}
      <g className="lf-smoke" opacity="0.75">
        <circle cx="800" cy="150" r="9" fill="#EDE7DC" />
        <circle cx="806" cy="128" r="12" fill="#EDE7DC" opacity="0.85" />
        <circle cx="796" cy="104" r="15" fill="#EDE7DC" opacity="0.7" />
      </g>

      {/* roof */}
      <path d="M735 305 L915 148 L1095 305 Z" fill="#8A3B2C" stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round" />
      <path d="M915 148 L1095 305 L1060 305 L915 176Z" fill="#A5503C" />
      <path d="M735 305 L915 148 L930 160 L760 305Z" fill="#6E2C20" opacity="0.6" />
      <rect x="735" y="298" width="360" height="14" rx="5" fill="#5E2418" stroke={OUTLINE} strokeWidth="3" />

      {/* chimney stack */}
      <rect x="782" y="150" width="34" height="70" fill="#9B6A4A" stroke={OUTLINE} strokeWidth="4" />
      <rect x="778" y="146" width="42" height="12" rx="2" fill="#7A4E34" stroke={OUTLINE} strokeWidth="3" />

      {/* walls */}
      <rect x="762" y="310" width="306" height="164" fill="#E4C387" stroke={OUTLINE} strokeWidth="5" />
      {[335, 365, 395, 425, 455].map((y) => (
        <line key={y} x1="762" y1={y} x2="1068" y2={y} stroke="#C6A263" strokeWidth="2" opacity="0.55" />
      ))}
      <rect x="762" y="310" width="306" height="164" fill="url(#lf-wall-shade)" />

      {/* door */}
      <path d="M900 474 L900 400 Q900 384 918 384 Q936 384 936 400 L936 474Z"
        fill="#7A4A2C" stroke={OUTLINE} strokeWidth="4.5" />
      <path d="M905 470 L905 402 Q905 392 918 392 Q931 392 931 402 L931 470Z" fill="none" stroke="#5E3620" strokeWidth="2" opacity="0.6" />
      <circle cx="927" cy="438" r="3.2" fill="#F0C860" stroke={OUTLINE} strokeWidth="1" />

      {/* window + shutters + glow */}
      <g>
        <rect x="820" y="345" width="88" height="66" rx="4" fill="#5A3B22" stroke={OUTLINE} strokeWidth="4" />
        <rect x="828" y="352" width="72" height="52" fill={sky === "rough" ? "#E8B85C" : "#F6CD72"} opacity={glowStrength} />
        <rect x="828" y="352" width="72" height="52" fill="url(#lf-window-glow)" opacity={glowStrength} />
        <line x1="864" y1="352" x2="864" y2="404" stroke="#5A3B22" strokeWidth="4" />
        <line x1="828" y1="378" x2="900" y2="378" stroke="#5A3B22" strokeWidth="4" />
        {windowOpen && (
          <rect x="828" y="352" width="72" height="52" fill="none" stroke="#FFE9AE" strokeWidth="2" opacity="0.5" />
        )}
        {/* shutters */}
        <g transform={shuttersOpen ? "translate(-30 0) rotate(-18 820 378)" : undefined}>
          <rect x="800" y="345" width="20" height="66" rx="3" fill="#4E7A5C" stroke={OUTLINE} strokeWidth="3" />
          <line x1="800" y1="362" x2="820" y2="362" stroke="#33543E" strokeWidth="1.6" />
          <line x1="800" y1="394" x2="820" y2="394" stroke="#33543E" strokeWidth="1.6" />
        </g>
        <g transform={shuttersOpen ? "translate(30 0) rotate(18 908 378)" : undefined}>
          <rect x="908" y="345" width="20" height="66" rx="3" fill="#4E7A5C" stroke={OUTLINE} strokeWidth="3" />
          <line x1="908" y1="362" x2="928" y2="362" stroke="#33543E" strokeWidth="1.6" />
          <line x1="908" y1="394" x2="928" y2="394" stroke="#33543E" strokeWidth="1.6" />
        </g>
      </g>

      {/* windowsill + keepsakes */}
      <rect x="808" y="411" width="112" height="10" rx="2" fill="#6E4A2C" stroke={OUTLINE} strokeWidth="2.2" />
      <rect x="808" y="411" width="112" height="4" fill="#8A6038" opacity="0.7" />
      {KEEPSAKES.map((Piece, i) => (
        <g key={i} transform={`translate(${822 + i * 18.5} 402) scale(0.78)`}>
          <Piece />
        </g>
      ))}
    </g>
  );
}
