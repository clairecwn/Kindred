/**
 * ItemArt — hand-drawn SVG illustrations for every purchasable item.
 * No emoji, no placeholder blobs — every item is fully illustrated.
 */

// ── HATS ──────────────────────────────────────────────────────────────────

export function SunriseBeret() {
  return (
    <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="b-top" cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#F0D060" />
          <stop offset="100%" stopColor="#C89820" />
        </radialGradient>
        <radialGradient id="b-shadow" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="rgba(30,20,8,0.14)" />
          <stop offset="100%" stopColor="rgba(30,20,8,0)" />
        </radialGradient>
      </defs>
      {/* Ground shadow */}
      <ellipse cx="60" cy="82" rx="34" ry="6" fill="rgba(30,20,8,0.10)" />
      {/* Beret underside rim */}
      <ellipse cx="60" cy="58" rx="40" ry="10" fill="#A87818" />
      {/* Beret main body */}
      <path d="M20 58 Q22 30 60 22 Q98 30 100 58 Q80 66 60 66 Q40 66 20 58Z" fill="url(#b-top)" />
      {/* Sheen highlight */}
      <path d="M30 52 Q38 30 60 24 Q44 26 34 40 Q26 50 28 58Z" fill="rgba(255,240,160,0.40)" />
      {/* Seam line */}
      <path d="M20 58 Q60 70 100 58" stroke="#B08820" strokeWidth="1.2" fill="none" />
      {/* Silk band at rim */}
      <ellipse cx="60" cy="59" rx="40" ry="8" fill="none" stroke="#9A7010" strokeWidth="2.5" />
      {/* Top button */}
      <circle cx="62" cy="24" r="4" fill="#9A7010" />
      <circle cx="62" cy="24" r="2" fill="#C8A030" />
      {/* Small decorative stitch marks */}
      <path d="M48 28 Q52 26 56 28" stroke="rgba(180,140,20,0.5)" strokeWidth="1" fill="none" />
      <path d="M64 26 Q68 25 72 27" stroke="rgba(180,140,20,0.5)" strokeWidth="1" fill="none" />
    </svg>
  );
}

export function CozyKnitHat() {
  return (
    <svg viewBox="0 0 120 110" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="kh-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E89080" />
          <stop offset="100%" stopColor="#C05840" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="60" cy="103" rx="28" ry="5" fill="rgba(30,20,8,0.10)" />
      {/* Hat body */}
      <path d="M28 72 Q26 44 36 28 Q46 14 60 12 Q74 14 84 28 Q94 44 92 72Z" fill="url(#kh-body)" />
      {/* Knit texture ribs (horizontal curves) */}
      <path d="M30 50 Q60 58 90 50" stroke="rgba(160,60,40,0.55)" strokeWidth="1.8" fill="none" />
      <path d="M29 60 Q60 68 91 60" stroke="rgba(160,60,40,0.55)" strokeWidth="1.8" fill="none" />
      <path d="M28 70 Q60 78 92 70" stroke="rgba(160,60,40,0.55)" strokeWidth="1.8" fill="none" />
      <path d="M32 40 Q60 47 88 40" stroke="rgba(160,60,40,0.40)" strokeWidth="1.4" fill="none" />
      <path d="M36 30 Q60 36 84 30" stroke="rgba(160,60,40,0.30)" strokeWidth="1.2" fill="none" />
      {/* Left highlight */}
      <path d="M36 28 Q32 44 30 62 Q34 44 40 30Z" fill="rgba(255,200,180,0.22)" />
      {/* Ribbed brim */}
      <path d="M26 72 Q60 82 94 72 L92 84 Q60 94 28 84Z" fill="#A84030" />
      {/* Brim rib lines */}
      {[35, 45, 55, 65, 75, 85].map((x, i) => (
        <line key={i} x1={x} y1={72 + (x - 60) * 0.08} x2={x - 1} y2={84 + (x - 60) * 0.06}
          stroke="rgba(140,40,20,0.55)" strokeWidth="1.2" />
      ))}
      {/* Pompom */}
      <circle cx="60" cy="12" r="11" fill="#F0A890" />
      <circle cx="55" cy="9" r="4" fill="rgba(255,220,210,0.6)" />
      <circle cx="64" cy="15" r="3" fill="rgba(200,100,80,0.35)" />
    </svg>
  );
}

export function StargazerCap() {
  return (
    <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="sc-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9098D8" />
          <stop offset="100%" stopColor="#6068A8" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="60" cy="94" rx="34" ry="5" fill="rgba(30,20,8,0.10)" />
      {/* Cap dome */}
      <path d="M22 62 Q24 36 40 24 Q50 16 60 16 Q70 16 80 24 Q96 36 98 62Z" fill="url(#sc-body)" />
      {/* Panel seams */}
      <path d="M60 18 L60 62" stroke="rgba(80,90,170,0.60)" strokeWidth="1.2" />
      <path d="M38 22 Q48 42 60 62" stroke="rgba(80,90,170,0.60)" strokeWidth="1.2" />
      <path d="M82 22 Q72 42 60 62" stroke="rgba(80,90,170,0.60)" strokeWidth="1.2" />
      {/* Sweatband at base */}
      <path d="M22 62 Q60 72 98 62 L96 68 Q60 78 24 68Z" fill="#4858A0" />
      {/* Brim */}
      <path d="M18 66 Q48 76 82 70 L84 66 L96 66 L94 72 Q58 82 20 72Z" fill="#3848A0" />
      {/* Brim highlight edge */}
      <path d="M18 66 Q50 62 82 68" stroke="rgba(120,140,220,0.50)" strokeWidth="1" fill="none" />
      {/* Star patch on crown */}
      <path d="M60 30 L62.5 37 L70 37 L64 41.5 L66.5 49 L60 44.5 L53.5 49 L56 41.5 L50 37 L57.5 37Z"
        fill="#E8D880" />
      <path d="M60 33 L61.5 37 L65 37 L62.5 39 L63.5 43 L60 41 L56.5 43 L57.5 39 L55 37 L58.5 37Z"
        fill="#F0E898" />
      {/* Strap at back */}
      <path d="M88 68 Q96 64 98 70 Q96 74 90 74Z" fill="#3848A0" />
      <rect x="89" y="69" width="5" height="3" rx="1" fill="rgba(255,255,255,0.4)" />
      {/* Button on top */}
      <circle cx="60" cy="18" r="3" fill="#3848A0" />
    </svg>
  );
}

// ── SHIRTS / TOPS ─────────────────────────────────────────────────────────

export function LinenSet() {
  return (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="ls-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B8E0DC" />
          <stop offset="100%" stopColor="#88C0BC" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="60" cy="134" rx="36" ry="5" fill="rgba(30,20,8,0.09)" />
      {/* Left sleeve */}
      <path d="M14 54 L8 46 L8 76 Q8 82 14 80 L22 78 L24 56Z" fill="#98C8C4" />
      {/* Right sleeve */}
      <path d="M106 54 L112 46 L112 76 Q112 82 106 80 L98 78 L96 56Z" fill="#98C8C4" />
      {/* Main body */}
      <path d="M16 50 L14 36 L32 26 L38 40 Q48 46 60 46 Q72 46 82 40 L88 26 L106 36 L104 50 L104 118 Q104 124 96 124 L24 124 Q16 124 16 118Z"
        fill="url(#ls-body)" />
      {/* Left collar */}
      <path d="M38 40 L34 26 Q44 18 60 18 L60 46 Q48 46 38 40Z" fill="#FAFCFB" />
      {/* Right collar */}
      <path d="M82 40 L86 26 Q76 18 60 18 L60 46 Q72 46 82 40Z" fill="#F4FAF9" />
      {/* Collar fold shadows */}
      <path d="M44 26 L42 36 Q48 42 54 44 L50 32Z" fill="rgba(100,180,176,0.30)" />
      <path d="M76 26 L78 36 Q72 42 66 44 L70 32Z" fill="rgba(100,180,176,0.30)" />
      {/* Button placket */}
      <path d="M60 46 L60 124" stroke="#78B0AC" strokeWidth="2" />
      {/* Buttons */}
      {[58, 74, 90, 106].map((y, i) => (
        <g key={i}>
          <circle cx="60" cy={y} r="3.5" fill="#FAFCFB" />
          <circle cx="60" cy={y} r="2" fill="none" stroke="#88B8B4" strokeWidth="0.8" />
          <line x1="58.5" y1={y} x2="61.5" y2={y} stroke="#88B8B4" strokeWidth="0.6" />
          <line x1="60" y1={y - 1.5} x2="60" y2={y + 1.5} stroke="#88B8B4" strokeWidth="0.6" />
        </g>
      ))}
      {/* Chest pocket */}
      <path d="M22 62 L22 52 Q22 48 26 48 L40 48 Q44 48 44 52 L44 62" fill="none" stroke="#78B0AC" strokeWidth="1.8" />
      <path d="M22 62 L44 62" stroke="#78B0AC" strokeWidth="1.8" />
      {/* Pocket stitch */}
      <line x1="26" y1="48" x2="26" y2="62" stroke="rgba(100,160,156,0.40)" strokeWidth="0.8" />
      {/* Shirt tail hem */}
      <path d="M16 118 Q60 126 104 118" stroke="#78B0AC" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function FloralHoodie() {
  return (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="fh-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0A0B8" />
          <stop offset="100%" stopColor="#D07090" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="60" cy="134" rx="38" ry="5" fill="rgba(30,20,8,0.09)" />
      {/* Left sleeve */}
      <path d="M12 56 L6 44 L8 80 Q10 86 16 84 L24 80 L26 58Z" fill="#D888A0" />
      <path d="M6 80 L10 90 Q12 92 16 90 L16 84Z" fill="#C06880" />
      {/* Right sleeve */}
      <path d="M108 56 L114 44 L112 80 Q110 86 104 84 L96 80 L94 58Z" fill="#D888A0" />
      <path d="M114 80 L110 90 Q108 92 104 90 L104 84Z" fill="#C06880" />
      {/* Main body */}
      <path d="M14 52 L12 36 L30 24 L36 40 Q46 48 60 48 Q74 48 84 40 L90 24 L108 36 L106 52 L106 114 Q106 122 98 122 L22 122 Q14 122 14 114Z"
        fill="url(#fh-body)" />
      {/* Hood */}
      <path d="M36 40 Q30 26 34 14 Q42 4 60 4 Q78 4 86 14 Q90 26 84 40 Q74 48 60 48 Q46 48 36 40Z"
        fill="#D070888" />
      <path d="M36 40 Q30 26 34 14 Q42 4 60 4 Q78 4 86 14 Q90 26 84 40 Q74 48 60 48 Q46 48 36 40Z"
        fill="#D07090" />
      {/* Hood inner */}
      <path d="M40 38 Q36 26 40 16 Q46 8 60 8 Q74 8 80 16 Q84 26 80 38"
        fill="#B85870" />
      {/* Flowers on body */}
      {/* Flower 1 — left chest */}
      <g transform="translate(26,62)">
        <circle cx="0" cy="0" r="5" fill="#F8D0E0" />
        <circle cx="-5" cy="-3" r="4" fill="#F4C0D4" /><circle cx="5" cy="-3" r="4" fill="#F4C0D4" />
        <circle cx="-5" cy="3" r="4" fill="#F0B8CC" /><circle cx="5" cy="3" r="4" fill="#F0B8CC" />
        <circle cx="0" cy="-5" r="4" fill="#F4C0D4" />
        <circle cx="0" cy="0" r="3" fill="#F8E080" />
      </g>
      {/* Flower 2 — right side */}
      <g transform="translate(84,76)">
        <circle cx="0" cy="0" r="5" fill="#F8D0E0" />
        <circle cx="-5" cy="-3" r="4" fill="#F4C0D4" /><circle cx="5" cy="-3" r="4" fill="#F4C0D4" />
        <circle cx="0" cy="-5" r="4" fill="#F4C0D4" />
        <circle cx="0" cy="0" r="3" fill="#F8E080" />
      </g>
      {/* Flower 3 — small, lower left */}
      <g transform="translate(34,92)">
        <circle cx="0" cy="0" r="4" fill="#F8D0E0" />
        <circle cx="-4" cy="-2" r="3" fill="#F4C0D4" /><circle cx="4" cy="-2" r="3" fill="#F4C0D4" />
        <circle cx="0" cy="-4" r="3" fill="#F0B8CC" />
        <circle cx="0" cy="0" r="2.5" fill="#F8E080" />
      </g>
      {/* Leaf accents */}
      <path d="M18 82 Q22 74 28 80" stroke="#A0C8A0" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M90 60 Q96 54 98 62" stroke="#A0C8A0" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M78 96 Q84 90 88 98" stroke="#A0C8A0" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Kangaroo pocket */}
      <path d="M38 92 Q38 84 44 84 L76 84 Q82 84 82 92 L82 108" fill="none" stroke="#B85870" strokeWidth="2" />
      <path d="M60 84 L60 108" stroke="#B85870" strokeWidth="1.5" />
      {/* Drawstrings */}
      <line x1="49" y1="48" x2="45" y2="66" stroke="#F4C0D0" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="71" y1="48" x2="75" y2="66" stroke="#F4C0D0" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="45" cy="66" r="2.5" fill="#F4C0D0" />
      <circle cx="75" cy="66" r="2.5" fill="#F4C0D0" />
      {/* Hem ribbing */}
      <path d="M14 114 Q14 122 22 122 L98 122 Q106 122 106 114 L106 110 Q106 118 98 118 L22 118 Q14 118 14 110Z"
        fill="#B85870" />
    </svg>
  );
}

export function ForestVest() {
  return (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="fv-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#70B090" />
          <stop offset="100%" stopColor="#3D7A5A" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="60" cy="134" rx="36" ry="5" fill="rgba(30,20,8,0.09)" />
      {/* Vest body */}
      <path d="M22 52 L20 36 L36 26 L42 42 Q50 48 60 48 Q70 48 78 42 L84 26 L100 36 L98 52 L98 114 Q98 122 90 122 L30 122 Q22 122 22 114Z"
        fill="url(#fv-body)" />
      {/* V-neck */}
      <path d="M42 42 L60 64 L78 42" fill="none" stroke="#2D5A40" strokeWidth="2" />
      {/* Left collar */}
      <path d="M42 42 L38 26 Q46 18 60 20 L60 48 Q50 48 42 42Z" fill="#80C0A0" />
      {/* Right collar */}
      <path d="M78 42 L82 26 Q74 18 60 20 L60 48 Q70 48 78 42Z" fill="#74B898" />
      {/* Chest pockets left */}
      <path d="M28 64 L28 52 Q28 48 32 48 L46 48 Q50 48 50 52 L50 64" fill="none" stroke="#2D5A40" strokeWidth="1.8" />
      <path d="M28 64 L50 64" stroke="#2D5A40" strokeWidth="1.8" />
      {/* Pocket flap left */}
      <path d="M28 58 Q28 62 32 62 L46 62 Q50 62 50 58" fill="#3A7050" />
      {/* Chest pockets right */}
      <path d="M70 64 L70 52 Q70 48 74 48 L88 48 Q92 48 92 52 L92 64" fill="none" stroke="#2D5A40" strokeWidth="1.8" />
      <path d="M70 64 L92 64" stroke="#2D5A40" strokeWidth="1.8" />
      <path d="M70 58 Q70 62 74 62 L88 62 Q92 62 92 58" fill="#3A7050" />
      {/* Pocket buttons */}
      <circle cx="39" cy="53" r="2.5" fill="#D7C57E" /><circle cx="81" cy="53" r="2.5" fill="#D7C57E" />
      {/* Lower cargo pockets */}
      <path d="M26 88 Q26 78 30 78 L50 78 Q54 78 54 88 L54 104 Q54 108 50 108 L30 108 Q26 108 26 104Z"
        fill="#2D5A40" />
      <path d="M66 88 Q66 78 70 78 L90 78 Q94 78 94 88 L94 104 Q94 108 90 108 L70 108 Q66 108 66 104Z"
        fill="#2D5A40" />
      <circle cx="40" cy="80" r="2.5" fill="#D7C57E" /><circle cx="80" cy="80" r="2.5" fill="#D7C57E" />
      {/* Belt */}
      <path d="M22 110 L98 110" stroke="#D7C57E" strokeWidth="3.5" strokeLinecap="round" />
      {/* Buckle */}
      <rect x="54" y="107" width="12" height="6" rx="2" fill="#B0901C" />
      <rect x="56" y="108.5" width="8" height="3" rx="1" fill="none" stroke="#D7C57E" strokeWidth="0.8" />
      {/* Badge on left chest */}
      <path d="M31 70 L31 68 L33 66 L37 66 L39 68 L39 70 L37 72 L33 72Z" fill="#D7C57E" />
      <line x1="35" y1="66" x2="35" y2="72" stroke="#9A7010" strokeWidth="0.8" />
      <line x1="31" y1="69" x2="39" y2="69" stroke="#9A7010" strokeWidth="0.8" />
    </svg>
  );
}

// ── ACCESSORIES ───────────────────────────────────────────────────────────

export function MoonEarrings() {
  return (
    <svg viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="me-moon" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#DDD0F4" />
          <stop offset="100%" stopColor="#A890CC" />
        </radialGradient>
      </defs>
      {/* Display card texture */}
      <rect x="14" y="8" width="92" height="114" rx="10" fill="rgba(200,180,240,0.12)" stroke="rgba(180,160,220,0.25)" strokeWidth="1" />
      {/* Ear wire left */}
      <path d="M38 22 Q34 14 40 10 Q48 7 52 14" fill="none" stroke="#C0A8DC" strokeWidth="2.2" strokeLinecap="round" />
      {/* Chain left */}
      <line x1="40" y1="22" x2="38" y2="36" stroke="#C0A8DC" strokeWidth="1.2" strokeDasharray="2.5 1.5" />
      {/* Left crescent moon */}
      <path d="M30 50 Q22 58 24 70 Q26 82 38 88 Q46 90 50 85 Q36 80 34 70 Q32 60 42 50 Q36 42 30 50Z"
        fill="url(#me-moon)" />
      <path d="M35 50 Q30 58 31 68 Q32 76 37 82" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Left star accent */}
      <path d="M44 64 L45.2 67 L48.5 67 L46 69 L46.8 72 L44 70.5 L41.2 72 L42 69 L39.5 67 L42.8 67Z"
        fill="#E8D8F8" />
      {/* Small circle dangle */}
      <circle cx="38" cy="95" r="3.5" fill="#C8B0E8" />
      <circle cx="38" cy="95" r="2" fill="#E0D0F8" />
      {/* Ear wire right */}
      <path d="M82 22 Q86 14 80 10 Q72 7 68 14" fill="none" stroke="#C0A8DC" strokeWidth="2.2" strokeLinecap="round" />
      {/* Chain right */}
      <line x1="80" y1="22" x2="82" y2="36" stroke="#C0A8DC" strokeWidth="1.2" strokeDasharray="2.5 1.5" />
      {/* Right crescent moon */}
      <path d="M90 50 Q98 58 96 70 Q94 82 82 88 Q74 90 70 85 Q84 80 86 70 Q88 60 78 50 Q84 42 90 50Z"
        fill="url(#me-moon)" />
      <path d="M85 50 Q90 58 89 68 Q88 76 83 82" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Right star accent */}
      <path d="M76 64 L77.2 67 L80.5 67 L78 69 L78.8 72 L76 70.5 L73.2 72 L74 69 L71.5 67 L74.8 67Z"
        fill="#E8D8F8" />
      {/* Small circle dangle right */}
      <circle cx="82" cy="95" r="3.5" fill="#C8B0E8" />
      <circle cx="82" cy="95" r="2" fill="#E0D0F8" />
      {/* Scattered sparkles */}
      <circle cx="60" cy="40" r="2" fill="#C8B0E8" />
      <circle cx="54" cy="110" r="1.5" fill="#C8B0E8" />
      <circle cx="68" cy="108" r="1" fill="#D8C8F0" />
    </svg>
  );
}

export function GoldenLeaf() {
  return (
    <svg viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="gl-leaf" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ECC040" />
          <stop offset="50%" stopColor="#D4A020" />
          <stop offset="100%" stopColor="#A87810" />
        </linearGradient>
      </defs>
      {/* Leaf shape */}
      <path d="M60 14 Q74 20 84 38 Q94 56 90 76 Q86 96 72 108 Q60 116 60 116 Q60 116 48 108 Q34 96 30 76 Q26 56 36 38 Q46 20 60 14Z"
        fill="url(#gl-leaf)" />
      {/* Central vein */}
      <path d="M60 14 L60 116" stroke="#8A6010" strokeWidth="1.8" />
      {/* Left veins */}
      <path d="M60 32 Q48 40 34 44" stroke="#9A7010" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M60 50 Q46 56 32 60" stroke="#9A7010" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M60 68 Q48 74 34 76" stroke="#9A7010" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M60 84 Q50 88 38 90" stroke="#9A7010" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M60 98 Q52 100 44 102" stroke="#9A7010" strokeWidth="1.0" fill="none" strokeLinecap="round" />
      {/* Right veins */}
      <path d="M60 32 Q72 40 86 44" stroke="#9A7010" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M60 50 Q74 56 88 60" stroke="#9A7010" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M60 68 Q72 74 86 76" stroke="#9A7010" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M60 84 Q70 88 82 90" stroke="#9A7010" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M60 98 Q68 100 76 102" stroke="#9A7010" strokeWidth="1.0" fill="none" strokeLinecap="round" />
      {/* Sheen highlight */}
      <path d="M60 14 Q66 24 68 40 Q68 56 65 70 Q62 24 60 14Z" fill="rgba(255,230,120,0.38)" />
      {/* Autumn colour variation patch */}
      <path d="M70 52 Q80 60 82 74 Q78 68 72 62Z" fill="rgba(200,140,20,0.30)" />
      {/* Stem */}
      <path d="M60 116 Q58 122 60 128" stroke="#8A6010" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* Brooch clasp */}
      <rect x="52" y="122" width="16" height="4" rx="2" fill="#C09020" />
      <circle cx="56" cy="124" r="1.5" fill="#E8C040" />
      <circle cx="64" cy="124" r="1.5" fill="#E8C040" />
    </svg>
  );
}

export function CoralBranch() {
  return (
    <svg viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Sand base */}
      <ellipse cx="60" cy="122" rx="28" ry="6" fill="rgba(220,200,160,0.50)" />
      {/* Main trunk */}
      <path d="M60 118 Q58 100 60 88" stroke="#D07860" strokeWidth="8" strokeLinecap="round" fill="none" />
      {/* Primary left branch */}
      <path d="M58 92 Q44 76 30 64" stroke="#D07860" strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* Primary right branch */}
      <path d="M62 88 Q74 72 84 60" stroke="#D07860" strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* Center left branch */}
      <path d="M59 95 Q52 82 48 68" stroke="#C86850" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Secondary left */}
      <path d="M36 66 Q24 52 18 40" stroke="#C06048" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M30 64 Q22 50 18 38" stroke="#C06048" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M36 66 Q30 50 28 36" stroke="#B85840" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Secondary right */}
      <path d="M80 62 Q88 48 92 36" stroke="#C06048" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M86 58 Q94 46 96 34" stroke="#B85840" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M84 60 Q90 48 88 34" stroke="#C06048" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      {/* Small tips */}
      <path d="M48 68 Q42 56 40 44" stroke="#B05038" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M48 68 Q52 58 56 46" stroke="#B05038" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Round tip caps */}
      {[[18,38],[18,40],[28,34],[40,42],[56,44],[92,34],[96,32],[88,32],[18,40]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="4.5" fill="#F0A888" />
      ))}
      <circle cx="60" cy="86" r="5" fill="#F0A888" />
      <circle cx="30" cy="62" r="4" fill="#F0A888" />
      <circle cx="84" cy="58" r="4" fill="#F0A888" />
    </svg>
  );
}

// ── GARDEN ────────────────────────────────────────────────────────────────

export function CherryBlossom() {
  return (
    <svg viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Pot */}
      <path d="M44 118 Q40 112 40 108 L42 106 L78 106 L80 108 Q80 112 76 118Z" fill="#C87848" />
      <ellipse cx="60" cy="106" rx="19" ry="5" fill="#E8986A" />
      <path d="M42 108 Q60 114 78 108" stroke="#A85C30" strokeWidth="1" fill="none" />
      {/* Soil */}
      <ellipse cx="60" cy="106" rx="18" ry="4" fill="#7A5030" />
      {/* Trunk */}
      <path d="M60 106 Q58 92 60 78 Q62 64 58 52" stroke="#7A5038" strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* Branches */}
      <path d="M60 78 Q48 68 36 58" stroke="#7A5038" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M60 70 Q72 60 84 50" stroke="#7A5038" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M58 62 Q48 52 40 42" stroke="#6A4430" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M58 60 Q68 50 76 40" stroke="#6A4430" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M58 52 Q50 42 46 30" stroke="#5A3828" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M58 52 Q66 44 72 32" stroke="#5A3828" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Blossom clusters */}
      {[
        [36, 54, 14], [28, 48, 11], [44, 44, 12], [24, 58, 10],
        [84, 46, 13], [92, 40, 10], [78, 36, 11], [86, 54, 9],
        [46, 28, 12], [56, 22, 13], [66, 24, 11], [72, 30, 10],
        [40, 38, 9], [68, 38, 10],
      ].map(([cx, cy, r], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill={i % 3 === 0 ? "#F4C0D0" : i % 3 === 1 ? "#F8D0DC" : "#EEB0C4"} />
          {/* Petal hint */}
          <circle cx={cx - r * 0.5} cy={cy - r * 0.5} r={r * 0.55}
            fill={i % 2 === 0 ? "#F8D8E4" : "#F0C8D8"} />
        </g>
      ))}
      {/* Flower centers */}
      {[[36, 54], [84, 46], [56, 22], [46, 28]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.5" fill="#F8E898" />
      ))}
      {/* Falling petals */}
      <path d="M96 72 Q100 68 98 74 Q96 78 92 76Z" fill="#F4C0D0" />
      <path d="M30 80 Q28 76 34 78 Q36 82 32 82Z" fill="#F8D0DC" />
      <path d="M88 80 Q92 78 90 84 Q88 86 86 84Z" fill="#EEB0C4" />
    </svg>
  );
}

export function FireflyLantern() {
  return (
    <svg viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="fl-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF8C0" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#FFE060" stopOpacity="0.60" />
          <stop offset="100%" stopColor="#FFB820" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Hanging cord */}
      <path d="M60 8 Q60 14 60 20" stroke="#8A6030" strokeWidth="2" strokeLinecap="round" />
      {/* Top cap */}
      <path d="M42 22 Q60 16 78 22 L74 28 Q60 24 46 28Z" fill="#C89030" />
      <ellipse cx="60" cy="22" rx="18" ry="4" fill="#E8B040" />
      {/* Lantern body */}
      <path d="M46 30 Q32 42 30 62 Q28 82 34 96 Q42 108 60 110 Q78 108 86 96 Q92 82 90 62 Q88 42 74 30Z"
        fill="#FFE878" />
      {/* Glow core */}
      <ellipse cx="60" cy="70" rx="22" ry="28" fill="url(#fl-glow)" />
      {/* Lantern ribs */}
      <path d="M46 30 Q44 62 46 96" stroke="#C8A020" strokeWidth="1.5" fill="none" />
      <path d="M74 30 Q76 62 74 96" stroke="#C8A020" strokeWidth="1.5" fill="none" />
      <path d="M38 38 Q36 62 38 88" stroke="#C8A020" strokeWidth="1" fill="none" />
      <path d="M82 38 Q84 62 82 88" stroke="#C8A020" strokeWidth="1" fill="none" />
      {/* Horizontal bands */}
      <path d="M36 50 Q60 46 84 50" stroke="#C8A020" strokeWidth="1.5" fill="none" />
      <path d="M32 70 Q60 66 88 70" stroke="#C8A020" strokeWidth="1.5" fill="none" />
      <path d="M34 88 Q60 84 86 88" stroke="#C8A020" strokeWidth="1.5" fill="none" />
      {/* Decorative pattern */}
      <path d="M52 56 Q56 50 60 56 Q64 50 68 56" stroke="#E8A820" strokeWidth="1.5" fill="none" />
      <path d="M50 74 Q55 68 60 74 Q65 68 70 74" stroke="#E8A820" strokeWidth="1.5" fill="none" />
      {/* Bottom cap */}
      <path d="M34 98 Q42 108 60 110 Q78 108 86 98 L82 96 Q68 106 52 96Z" fill="#C89030" />
      <ellipse cx="60" cy="110" rx="10" ry="3" fill="#E8B040" />
      {/* Tassel */}
      <path d="M60 112 Q58 118 56 124" stroke="#C89030" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M60 112 Q60 118 60 124" stroke="#C89030" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M60 112 Q62 118 64 124" stroke="#C89030" strokeWidth="1.5" strokeLinecap="round" />
      {/* Firefly glow dots */}
      <circle cx="50" cy="62" r="2.5" fill="#FFFCE0" />
      <circle cx="68" cy="78" r="2" fill="#FFFCE0" />
      <circle cx="54" cy="82" r="1.5" fill="#FFFCE0" />
    </svg>
  );
}

export function HerbGarden() {
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Left pot — sage */}
      <path d="M18 96 Q14 90 14 86 L16 84 L34 84 L36 86 Q36 90 32 96Z" fill="#B06840" />
      <ellipse cx="25" cy="84" rx="10" ry="3.5" fill="#C88060" />
      <path d="M16 86 Q25 90 34 86" stroke="#8A4820" strokeWidth="0.8" fill="none" />
      <ellipse cx="25" cy="84" rx="9" ry="3" fill="#5A3820" />
      {/* Sage plant */}
      <path d="M25 84 L25 68" stroke="#6A9060" strokeWidth="2" strokeLinecap="round" />
      <path d="M25 76 L18 64" stroke="#6A9060" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M25 72 L32 62" stroke="#6A9060" strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="25" cy="66" rx="6" ry="9" fill="#80A870" transform="rotate(-8 25 66)" />
      <ellipse cx="18" cy="62" rx="5" ry="8" fill="#70A060" transform="rotate(-20 18 62)" />
      <ellipse cx="32" cy="60" rx="5" ry="7" fill="#88B878" transform="rotate(15 32 60)" />
      <path d="M22 62 Q25 58 28 62" stroke="#5A8050" strokeWidth="0.8" fill="none" />

      {/* Middle pot — thyme */}
      <path d="M50 98 Q46 92 46 88 L48 86 L72 86 L74 88 Q74 92 70 98Z" fill="#B86840" />
      <ellipse cx="61" cy="86" rx="13" ry="4" fill="#D08060" />
      <path d="M48 88 Q61 92 74 88" stroke="#8A4820" strokeWidth="0.8" fill="none" />
      <ellipse cx="61" cy="86" rx="12" ry="3.5" fill="#5A3820" />
      {/* Thyme — bushy, small leaves */}
      <path d="M61 86 L61 66" stroke="#7A8840" strokeWidth="2" strokeLinecap="round" />
      <path d="M61 80 L52 70" stroke="#7A8840" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M61 76 L70 66" stroke="#7A8840" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M61 72 L54 62" stroke="#7A8840" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M61 72 L68 62" stroke="#7A8840" strokeWidth="1.4" strokeLinecap="round" />
      {[
        [61,64],[52,68],[70,64],[54,60],[68,60],[48,72],[74,68],[56,56],[66,56]
      ].map(([cx,cy],i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={5} ry={3.5}
          fill={i%2===0?"#98A860":"#88A050"}
          transform={`rotate(${i*20-40} ${cx} ${cy})`} />
      ))}

      {/* Right pot — lavender */}
      <path d="M88 96 Q84 90 84 86 L86 84 L104 84 L106 86 Q106 90 102 96Z" fill="#B06840" />
      <ellipse cx="95" cy="84" rx="10" ry="3.5" fill="#C88060" />
      <path d="M86 86 Q95 90 104 86" stroke="#8A4820" strokeWidth="0.8" fill="none" />
      <ellipse cx="95" cy="84" rx="9" ry="3" fill="#5A3820" />
      {/* Lavender spikes */}
      {[-12,-6,0,6,12].map((dx, i) => (
        <g key={i}>
          <path d={`M${95+dx} 84 L${95+dx+dx*0.1} ${56+i*2}`} stroke="#888898" strokeWidth="1.5" strokeLinecap="round" />
          {/* Flower buds */}
          {[0,6,12,18].map(dy => (
            <ellipse key={dy} cx={95+dx+dx*0.05} cy={56+i*2+dy*0.8} rx={2.5} ry={2}
              fill={dy===0?"#B8A0D0":dy===6?"#A890C0":"#C8B0E0"} />
          ))}
        </g>
      ))}
      {/* Soil plate beneath all pots */}
      <path d="M10 98 Q60 104 110 98 L108 102 Q60 108 12 102Z" fill="rgba(100,70,40,0.18)" />
    </svg>
  );
}

// ── FURNITURE (new) ───────────────────────────────────────────────────────

export function CozyArmchair() {
  return (
    <svg viewBox="0 0 120 110" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="ac-fabric" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8C8A8" />
          <stop offset="100%" stopColor="#C8A078" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="60" cy="106" rx="42" ry="5" fill="rgba(30,20,8,0.10)" />
      {/* Left front leg */}
      <rect x="24" y="88" width="8" height="16" rx="3" fill="#A07840" />
      {/* Right front leg */}
      <rect x="88" y="88" width="8" height="16" rx="3" fill="#A07840" />
      {/* Back legs (partially hidden) */}
      <rect x="20" y="82" width="6" height="12" rx="2" fill="#8A6430" />
      <rect x="94" y="82" width="6" height="12" rx="2" fill="#8A6430" />
      {/* Seat cushion */}
      <path d="M20 62 Q20 56 26 56 L94 56 Q100 56 100 62 L100 86 Q100 92 94 92 L26 92 Q20 92 20 86Z"
        fill="url(#ac-fabric)" />
      {/* Seat cushion top highlight */}
      <path d="M24 58 Q60 54 96 58 Q96 62 60 64 Q24 62 24 58Z" fill="rgba(255,240,220,0.40)" />
      {/* Seat cushion stitch */}
      <path d="M22 74 Q60 70 98 74" stroke="#B08858" strokeWidth="1.2" fill="none" />
      {/* Seat cushion button */}
      <circle cx="60" cy="74" r="3" fill="#A07040" />
      <circle cx="60" cy="74" r="1.5" fill="#C09060" />
      {/* Back cushion */}
      <path d="M26 28 Q26 22 32 22 L88 22 Q94 22 94 28 L94 58 Q94 64 88 64 L32 64 Q26 64 26 58Z"
        fill="#D8B898" />
      {/* Back cushion highlight */}
      <path d="M30 24 Q60 20 90 24 L90 30 Q60 26 30 30Z" fill="rgba(255,240,220,0.35)" />
      {/* Back cushion stitching */}
      <path d="M28 40 Q60 36 92 40" stroke="#B89870" strokeWidth="1.2" fill="none" />
      <path d="M28 52 Q60 48 92 52" stroke="#B89870" strokeWidth="1.2" fill="none" />
      {/* Left arm */}
      <path d="M16 30 Q16 24 20 24 L30 24 Q34 24 34 30 L34 76 Q34 82 28 82 L18 82 Q14 82 14 76Z"
        fill="#D0B090" />
      {/* Left armrest pad */}
      <path d="M14 26 Q24 22 34 26 L34 34 Q24 30 14 34Z" fill="#E8C8A8" />
      {/* Right arm */}
      <path d="M104 30 Q104 24 100 24 L90 24 Q86 24 86 30 L86 76 Q86 82 92 82 L102 82 Q106 82 106 76Z"
        fill="#D0B090" />
      {/* Right armrest pad */}
      <path d="M106 26 Q96 22 86 26 L86 34 Q96 30 106 34Z" fill="#E8C8A8" />
      {/* Throw pillow */}
      <path d="M68 36 Q68 30 74 30 L90 30 Q96 30 96 36 L96 52 Q96 58 90 58 L74 58 Q68 58 68 52Z"
        fill="#F0D8D0" />
      <path d="M70 32 Q82 28 94 32" stroke="#D8B8B0" strokeWidth="1" fill="none" />
      <path d="M70 56 Q82 52 94 56" stroke="#D8B8B0" strokeWidth="1" fill="none" />
      <circle cx="82" cy="44" r="2.5" fill="#D8B8B0" />
    </svg>
  );
}

export function ReadingLamp() {
  return (
    <svg viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="rl-glow" cx="50%" cy="90%" r="70%">
          <stop offset="0%" stopColor="#FFF8D0" stopOpacity="0.90" />
          <stop offset="100%" stopColor="#FFD060" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Base shadow */}
      <ellipse cx="60" cy="126" rx="24" ry="4" fill="rgba(30,20,8,0.12)" />
      {/* Weighted base */}
      <path d="M36 118 Q36 110 44 110 L76 110 Q84 110 84 118 L82 122 Q60 126 38 122Z" fill="#8A7060" />
      <ellipse cx="60" cy="110" rx="20" ry="5" fill="#A08878" />
      {/* Main pole */}
      <rect x="57" y="36" width="6" height="76" rx="3" fill="#A08878" />
      {/* Pole highlight */}
      <rect x="58" y="36" width="2" height="76" rx="1" fill="rgba(255,255,255,0.25)" />
      {/* Curved arm */}
      <path d="M60 36 Q62 20 72 16 Q82 12 88 20" stroke="#A08878" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* Arm highlight */}
      <path d="M60 36 Q62 20 72 16 Q82 12 88 20" stroke="rgba(255,255,255,0.20)" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Shade outer */}
      <path d="M72 20 Q80 22 96 38 L88 44 Q80 34 72 32 Q64 30 60 34 L54 26 Q62 20 72 20Z" fill="#C8A878" />
      {/* Shade body */}
      <path d="M54 26 Q58 24 72 26 Q84 28 88 44 L78 50 Q70 44 60 44 Q52 44 48 50 L40 44 Q44 32 54 26Z"
        fill="#E8C898" />
      {/* Shade inner (lit) */}
      <path d="M56 30 Q64 26 76 30 Q84 34 86 44 L76 48 Q70 42 60 42 Q52 42 48 48 L42 44 Q44 34 56 30Z"
        fill="#FFF0C0" />
      {/* Glow effect below shade */}
      <ellipse cx="64" cy="52" rx="28" ry="16" fill="url(#rl-glow)" />
      {/* Shade detail rim */}
      <path d="M40 44 Q64 56 88 44" stroke="#C8A060" strokeWidth="1.5" fill="none" />
      {/* Bulb */}
      <circle cx="64" cy="44" r="4" fill="#FFF8D0" />
      {/* Cord */}
      <path d="M60 80 Q54 88 52 100" stroke="#7A6050" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function CoffeeTable() {
  return (
    <svg viewBox="0 0 120 110" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="ct-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4B890" />
          <stop offset="100%" stopColor="#B89868" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="60" cy="106" rx="44" ry="5" fill="rgba(30,20,8,0.10)" />
      {/* Legs */}
      <path d="M28 74 L22 98 Q22 102 26 102 L30 102 L36 78Z" fill="#8A6840" />
      <path d="M92 74 L98 98 Q98 102 94 102 L90 102 L84 78Z" fill="#8A6840" />
      <path d="M32 74 L28 98 L36 98 L40 74Z" fill="#9A7848" />
      <path d="M88 74 L92 98 L84 98 L80 74Z" fill="#9A7848" />
      {/* Lower shelf */}
      <path d="M30 88 Q60 84 90 88 L88 92 Q60 88 32 92Z" fill="#A07848" />
      {/* Table top edge */}
      <path d="M14 66 Q14 72 20 74 L100 74 Q106 72 106 66 Z" fill="#9A7848" />
      {/* Table top surface */}
      <path d="M14 56 Q14 62 20 66 L100 66 Q106 62 106 56 Q106 50 100 48 L20 48 Q14 50 14 56Z"
        fill="url(#ct-top)" />
      {/* Wood grain lines */}
      <path d="M20 52 Q60 50 100 52" stroke="rgba(150,110,60,0.35)" strokeWidth="1" fill="none" />
      <path d="M18 56 Q60 54 102 56" stroke="rgba(150,110,60,0.35)" strokeWidth="1" fill="none" />
      <path d="M18 60 Q60 58 102 60" stroke="rgba(150,110,60,0.35)" strokeWidth="1" fill="none" />
      {/* Table top highlight */}
      <path d="M22 50 Q60 47 98 50 L96 52 Q60 49 24 52Z" fill="rgba(255,240,210,0.35)" />
      {/* Decorative items on table */}
      {/* Small plant */}
      <ellipse cx="82" cy="47" rx="7" ry="4" fill="#90B878" />
      <path d="M82 47 L82 40" stroke="#7A9860" strokeWidth="1.5" />
      <circle cx="82" cy="39" r="4" fill="#A0C888" />
      {/* Cup */}
      <path d="M40 48 L36 42 Q36 40 38 40 L46 40 Q48 40 48 42 L44 48Z" fill="#E8C8A0" />
      <path d="M38 42 Q42 40 46 42" stroke="#C8A880" strokeWidth="0.8" fill="none" />
      <path d="M46 44 Q50 44 50 46 Q50 48 46 46" stroke="#C8A880" strokeWidth="1.2" fill="none" />
      {/* Book */}
      <path d="M54 48 L54 40 Q54 38 56 38 L68 38 Q70 38 70 40 L70 48Z" fill="#C8A0D0" />
      <path d="M55 42 L69 42" stroke="#A880B0" strokeWidth="0.8" fill="none" />
      <path d="M55 44 L69 44" stroke="#A880B0" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

export function CozyBookshelf() {
  return (
    <svg viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Shadow */}
      <ellipse cx="60" cy="126" rx="42" ry="5" fill="rgba(30,20,8,0.10)" />
      {/* Main frame */}
      <path d="M14 20 L14 118 Q14 124 20 124 L100 124 Q106 124 106 118 L106 20 Q106 14 100 14 L20 14 Q14 14 14 20Z"
        fill="#C09868" />
      {/* Frame inner recess */}
      <rect x="20" y="20" width="80" height="98" rx="2" fill="#D4B080" />
      {/* Shelf 1 */}
      <rect x="18" y="54" width="84" height="6" rx="1" fill="#A87840" />
      {/* Shelf 2 */}
      <rect x="18" y="88" width="84" height="6" rx="1" fill="#A87840" />
      {/* ── Top shelf books ── */}
      {/* Book A — tall red */}
      <path d="M24 24 L24 52 Q24 54 26 54 L34 54 Q36 54 36 52 L36 24 Q36 22 34 22 L26 22 Q24 22 24 24Z" fill="#D06050" />
      <path d="M24 24 L26 24 L26 52 L24 52Z" fill="#B84040" />
      <path d="M28 28 L34 28" stroke="rgba(255,220,210,0.7)" strokeWidth="1" /><path d="M28 31 L34 31" stroke="rgba(255,220,210,0.7)" strokeWidth="1" />
      {/* Book B — small teal */}
      <path d="M38 32 L38 54 Q38 54 40 54 L46 54 Q48 54 48 52 L48 32 Q48 30 46 30 L40 30 Q38 30 38 32Z" fill="#60A888" />
      <path d="M38 32 L40 32 L40 54 L38 54Z" fill="#489870" />
      {/* Book C — wide lavender */}
      <path d="M50 26 L50 54 Q50 54 52 54 L66 54 Q68 54 68 52 L68 26 Q68 24 66 24 L52 24 Q50 24 50 26Z" fill="#A898D8" />
      <path d="M50 26 L52 26 L52 54 L50 54Z" fill="#8878C0" />
      <path d="M54 30 L66 30" stroke="rgba(240,235,255,0.7)" strokeWidth="1" /><path d="M54 33 L66 33" stroke="rgba(240,235,255,0.7)" strokeWidth="1" />
      <path d="M54 36 L62 36" stroke="rgba(240,235,255,0.7)" strokeWidth="1" />
      {/* Bookend + small plant */}
      <circle cx="82" cy="44" r="7" fill="#A0C888" />
      <path d="M82 44 L82 54" stroke="#7A9860" strokeWidth="1.5" />
      <path d="M76 52 L88 52" stroke="#8A6840" strokeWidth="2" strokeLinecap="round" />
      {/* ── Middle shelf books ── */}
      {/* Book D — gold */}
      <path d="M24 60 L24 86 Q24 88 26 88 L30 88 Q32 88 32 86 L32 60 Q32 58 30 58 L26 58 Q24 58 24 60Z" fill="#D4A030" />
      <path d="M24 60 L26 60 L26 88 L24 88Z" fill="#B88020" />
      {/* Book E — pink */}
      <path d="M34 62 L34 88 Q34 88 36 88 L46 88 Q48 88 48 86 L48 62 Q48 60 46 60 L36 60 Q34 60 34 62Z" fill="#E8A0A8" />
      <path d="M34 62 L36 62 L36 88 L34 88Z" fill="#D08090" />
      <path d="M38 66 L46 66" stroke="rgba(255,240,240,0.7)" strokeWidth="1" /><path d="M38 69 L46 69" stroke="rgba(255,240,240,0.7)" strokeWidth="1" />
      {/* Book F — dark green, wide */}
      <path d="M50 58 L50 88 Q50 88 52 88 L68 88 Q70 88 70 86 L70 58 Q70 56 68 56 L52 56 Q50 56 50 58Z" fill="#4A7A58" />
      <path d="M50 58 L52 58 L52 88 L50 88Z" fill="#2D5A38" />
      <path d="M54 62 L68 62" stroke="rgba(200,240,210,0.6)" strokeWidth="1" /><path d="M54 65 L68 65" stroke="rgba(200,240,210,0.6)" strokeWidth="1" />
      <path d="M54 68 L62 68" stroke="rgba(200,240,210,0.6)" strokeWidth="1" />
      {/* Small figurine */}
      <circle cx="80" cy="82" r="4" fill="#F0D8C0" />
      <path d="M78 88 L82 88 Q84 88 84 86 L84 84 Q82 82 80 82 Q78 82 76 84 L76 86 Q76 88 78 88Z" fill="#E0C0A0" />
      {/* ── Bottom shelf ── */}
      <path d="M24 94 L24 118 Q24 120 26 120 L36 120 Q38 120 38 118 L38 94 Q38 92 36 92 L26 92 Q24 92 24 94Z" fill="#D07850" />
      <path d="M40 96 L40 120 Q40 120 42 120 L60 120 Q62 120 62 118 L62 96 Q62 94 60 94 L42 94 Q40 94 40 96Z" fill="#80A8B8" />
      <path d="M44 100 L60 100" stroke="rgba(220,240,248,0.7)" strokeWidth="1" />
      {/* Basket */}
      <path d="M66 102 Q66 96 70 96 L90 96 Q94 96 94 102 L92 120 L68 120Z" fill="#C8A860" />
      <path d="M66 102 Q80 98 94 102" stroke="#A88840" strokeWidth="1" fill="none" />
      {[70,76,82,88].map((x,i) => (
        <line key={i} x1={x} y1={102} x2={x-1} y2={120} stroke="#A88840" strokeWidth="0.8" />
      ))}
      <path d="M64 96 Q80 92 96 96" stroke="#A88840" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
