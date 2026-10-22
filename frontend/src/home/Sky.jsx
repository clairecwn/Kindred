const STARS = [
  [120, 60], [260, 40], [400, 80], [90, 120], [520, 55],
  [610, 95], [200, 30], [340, 110], [40, 70], [460, 35],
];

const CLOUDS = [
  { x: 140, y: 90, s: 1 }, { x: 340, y: 60, s: 0.8 }, { x: 560, y: 110, s: 0.9 },
  { x: 80, y: 150, s: 0.7 }, { x: 640, y: 70, s: 1.1 },
];

/**
 * Full-bleed sky + treeline. One scene, three moods:
 *  - steady:      clear dusk, low stars
 *  - rough:       soft rain, low cloud — still warm at the house, never bleak
 *  - flourishing: late golden light, long shadows, sun low on the treeline
 */
export default function Sky({ sky }) {
  const gradientId =
    sky === "rough" ? "lf-sky-rough" : sky === "flourishing" ? "lf-sky-flourishing" : "lf-sky-steady";

  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id="lf-sky-steady" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A2A52" />
          <stop offset="55%" stopColor="#4A3E68" />
          <stop offset="100%" stopColor="#C9793E" />
        </linearGradient>
        <linearGradient id="lf-sky-rough" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4E5A66" />
          <stop offset="60%" stopColor="#6B7784" />
          <stop offset="100%" stopColor="#8B9398" />
        </linearGradient>
        <linearGradient id="lf-sky-flourishing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5A4A78" />
          <stop offset="45%" stopColor="#D68A4C" />
          <stop offset="100%" stopColor="#F4C15C" />
        </linearGradient>
        <linearGradient id="lf-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky === "rough" ? "#3C4A3E" : "#3E5C34"} />
          <stop offset="100%" stopColor={sky === "rough" ? "#28342A" : "#2A4020"} />
        </linearGradient>
        <radialGradient id="lf-window-glow" cx="50%" cy="55%" r="65%">
          <stop offset="0%" stopColor="#FFF3C4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F6CD72" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lf-lantern-glow-a" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFDC8E" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFDC8E" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="1280" height="470" fill={`url(#${gradientId})`} />

      {sky === "steady" &&
        STARS.map(([x, y], i) => (
          <circle key={i} cx={x + (i % 3) * 220} cy={y} r={i % 2 ? 1.6 : 2.4} fill="#FFF6D8" opacity="0.85" />
        ))}

      {sky === "steady" && (
        <circle cx="1120" cy="70" r="34" fill="#F3E7B8" opacity="0.9" />
      )}

      {sky === "flourishing" && (
        <>
          <circle cx="180" cy="360" r="60" fill="#FCE38A" opacity="0.9" />
          <circle cx="180" cy="360" r="90" fill="#FCE38A" opacity="0.28" />
        </>
      )}

      {sky === "rough" &&
        CLOUDS.map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.s})`} opacity="0.8">
            <ellipse cx="0" cy="0" rx="70" ry="26" fill="#7C868F" />
            <ellipse cx="40" cy="-8" rx="46" ry="20" fill="#8A939B" />
            <ellipse cx="-40" cy="6" rx="42" ry="18" fill="#727C85" />
          </g>
        ))}

      {/* treeline */}
      <path
        d="M0 420 Q60 380 140 410 Q200 375 260 408 Q330 372 400 406 Q470 378 540 410
           Q610 380 700 412 L1280 412 L1280 470 L0 470Z"
        fill={sky === "rough" ? "#233428" : "#25361E"}
      />
      <path
        d="M700 412 Q800 388 900 414 Q1000 386 1090 414 Q1180 390 1280 412 L1280 470 L700 470Z"
        fill={sky === "rough" ? "#1C2A21" : "#1D2C17"}
      />

      {/* ground */}
      <rect x="0" y="465" width="1280" height="140" fill="url(#lf-ground)" />
    </g>
  );
}

export function RainOverlay({ sky }) {
  if (sky !== "rough") return null;
  const drops = Array.from({ length: 40 }, (_, i) => ({
    x: (i * 53) % 1280,
    y: (i * 37) % 605,
    delay: (i % 10) * 0.12,
  }));
  return (
    <g aria-hidden="true" opacity="0.5">
      {drops.map((d, i) => (
        <line
          key={i}
          className="lf-rain"
          x1={d.x} y1={d.y} x2={d.x - 10} y2={d.y + 22}
          stroke="#DCE7EE" strokeWidth="2" strokeLinecap="round"
          style={{ animationDelay: `${d.delay}s` }}
        />
      ))}
    </g>
  );
}
