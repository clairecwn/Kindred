// ── Kindred v3 — Framer Motion Animation Library ─────────────────────────
// All ease-out spring curves for a delightful, non-jarring feel.
// Respects prefers-reduced-motion via Framer Motion's built-in support.

export const spring = {
  type: "spring",
  stiffness: 280,
  damping: 22,
  mass: 0.8,
};

export const springBouncy = {
  type: "spring",
  stiffness: 380,
  damping: 18,
  mass: 0.7,
};

export const springGentle = {
  type: "spring",
  stiffness: 180,
  damping: 26,
  mass: 1,
};

export const easeOut = {
  type: "tween",
  ease: [0.0, 0.0, 0.2, 1],
  duration: 0.25,
};

// ── Page / Screen transitions ────────────────────────────────────────────
export const pageVariants = {
  hidden:  { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1,
    transition: { ...spring, staggerChildren: 0.05 } },
  exit:    { opacity: 0, y: -8, scale: 0.98,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
};

// ── Card / list item stagger ─────────────────────────────────────────────
export const cardVariants = {
  hidden:  { opacity: 0, y: 20, scale: 0.94 },
  visible: { opacity: 1, y: 0,  scale: 1,
    transition: springBouncy },
};

export const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

// ── Button press (clay squish) ───────────────────────────────────────────
export const clayPress = {
  whileHover:  { y: -3, transition: { duration: 0.12, ease: [0.0,0.0,0.2,1] } },
  whileTap:    { y: 3,  scale: 0.96, transition: { duration: 0.08 } },
};

// ── Answer choice buttons (quiz) ─────────────────────────────────────────
export const answerVariants = {
  hidden:  { opacity: 0, scale: 0.85, y: 15 },
  visible: { opacity: 1, scale: 1,    y: 0,
    transition: springBouncy },
  hover:   { scale: 1.04, y: -2, transition: { duration: 0.15 } },
  tap:     { scale: 0.94, y: 2,  transition: { duration: 0.08 } },
  selected: { scale: 1.06,
    boxShadow: "0 0 0 4px rgba(255,127,92,0.5)",
    transition: springBouncy },
};

// ── Question slide ───────────────────────────────────────────────────────
export const questionVariants = {
  enter:  { opacity: 0, x: 60,  scale: 0.95 },
  center: { opacity: 1, x: 0,   scale: 1,   transition: spring },
  exit:   { opacity: 0, x: -50, scale: 0.95,
    transition: { duration: 0.20, ease: [0.4,0,1,1] } },
};

// ── Character emotion reactions ──────────────────────────────────────────
export const charCelebrate = {
  y:       [0, -18, 0, -10, 0],
  rotate:  [0,  3, -3,  2,  0],
  scale:   [1,  1.08, 1, 1.04, 1],
  transition: { duration: 0.8, ease: "easeOut" },
};

export const charNod = {
  rotate: [0, -4, 4, -2, 0],
  transition: { duration: 0.5, ease: "easeOut" },
};

export const charWave = {
  rotate:  [0, -10, 10, -8, 6, 0],
  transition: { duration: 0.7, ease: "easeOut" },
};

export const charShrug = {
  y:      [0, -4, 0],
  scaleY: [1, 0.95, 1],
  transition: { duration: 0.4, ease: "easeOut" },
};

// ── Progress bar fill ────────────────────────────────────────────────────
export const progressFill = (pct) => ({
  initial: { scaleX: 0, originX: 0 },
  animate: { scaleX: pct / 100, originX: 0,
    transition: { ...springGentle, delay: 0.1 } },
});

// ── Modal / overlay appear ───────────────────────────────────────────────
export const overlayVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.18 } },
};

export const sheetVariants = {
  hidden:  { y: "100%", opacity: 0 },
  visible: { y: 0, opacity: 1, transition: spring },
  exit:    { y: "100%", opacity: 0,
    transition: { duration: 0.22, ease: [0.4,0,1,1] } },
};

// ── Store item card ──────────────────────────────────────────────────────
export const storeCardVariants = {
  hidden:  { opacity: 0, y: 24, rotateX: 8 },
  visible: { opacity: 1, y: 0,  rotateX: 0,
    transition: springBouncy },
  hover:   { y: -6, scale: 1.03,
    boxShadow: "0 12px 0 0 rgba(61,43,31,0.14), 0 20px 40px rgba(61,43,31,0.14)",
    transition: { duration: 0.2 } },
  tap:     { y: 2, scale: 0.97, transition: { duration: 0.08 } },
};

// ── Floating island element wiggle ───────────────────────────────────────
export const islandWiggle = {
  animate: {
    y:      [0, -6, 0, -3, 0],
    rotate: [0,  1, -1, 0.5, 0],
    transition: { duration: 4, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 },
  },
};

// ── Coin collect bounce ──────────────────────────────────────────────────
export const coinCollect = {
  animate: {
    y:       [0, -24, 0],
    scale:   [1, 1.4, 0],
    opacity: [1, 1, 0],
    transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
  },
};

// ── Toast / notification pop ─────────────────────────────────────────────
export const toastVariants = {
  hidden:  { opacity: 0, y: 20, scale: 0.9 },
  visible: { opacity: 1, y: 0,  scale: 1,  transition: springBouncy },
  exit:    { opacity: 0, y: 8,  scale: 0.94,
    transition: { duration: 0.18 } },
};

// ── Helper: staggered children ───────────────────────────────────────────
export function staggerContainer(delay = 0.08) {
  return {
    hidden:  {},
    visible: { transition: { staggerChildren: delay, delayChildren: 0.1 } },
  };
}
