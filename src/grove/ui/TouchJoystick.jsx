import { useCallback, useRef, useState } from "react";

// src/grove/ui/TouchJoystick.jsx
//
// A minimal on-screen joystick for touch devices, feeding normalized {x, z}
// into PlayerController.setTouchVector (see player/PlayerController.js).
// Keyboard (WASD/arrows) always takes priority when active, so this never
// fights a desktop user; it exists purely so Grove is walkable on a phone
// or tablet with no keyboard at all. Styled as a chunky candy-button knob
// (see ../grove.css) to match the rest of Grove's HUD art direction.

const BASE_RADIUS = 48; // px, matches .grove-joystick-base
const KNOB_RADIUS = 22; // px, matches .grove-joystick-knob

export default function TouchJoystick({ onChange }) {
  const baseRef = useRef(null);
  const [active, setActive] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointerId = useRef(null);

  const updateFromPoint = useCallback((clientX, clientY) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const max = BASE_RADIUS - KNOB_RADIUS / 2;
    if (dist > max) {
      dx = (dx / dist) * max;
      dy = (dy / dist) * max;
    }
    setKnob({ x: dx, y: dy });
    // Screen down (+Y) maps to world +Z (south), matching WASD's S key.
    const nx = max > 0 ? dx / max : 0;
    const nz = max > 0 ? dy / max : 0;
    onChange?.(nx, nz);
  }, [onChange]);

  function onPointerDown(e) {
    e.preventDefault();
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setActive(true);
    updateFromPoint(e.clientX, e.clientY);
  }

  function onPointerMove(e) {
    if (pointerId.current !== e.pointerId) return;
    updateFromPoint(e.clientX, e.clientY);
  }

  function endTouch(e) {
    if (pointerId.current !== null && e.pointerId !== undefined && pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange?.(0, 0);
  }

  return (
    <div
      ref={baseRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endTouch}
      onPointerCancel={endTouch}
      onPointerLeave={endTouch}
      className="grove-joystick-base"
      aria-label="Move"
      role="presentation"
    >
      <div
        className={`grove-joystick-knob${active ? " grove-joystick-knob--active" : ""}`}
        style={{
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          transition: active ? "none" : "transform 120ms ease-out",
        }}
      />
    </div>
  );
}
