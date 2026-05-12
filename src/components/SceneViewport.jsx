import { Minus, Plus, Scan, Move } from "lucide-react";

export default function SceneViewport({ title, subtitle, zoom, setZoom, pan, setPan, children }) {
  const clampZoom = (next) => Math.min(1.75, Math.max(0.75, next));

  function move(dx, dy) {
    setPan((current) => ({
      x: Math.min(80, Math.max(-80, current.x + dx)),
      y: Math.min(60, Math.max(-60, current.y + dy))
    }));
  }

  return (
    <section className="scene-shell">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="zoom-controls" aria-label="Scene controls">
          <button type="button" onClick={() => setZoom((value) => clampZoom(value - 0.15))} aria-label="Zoom out">
            <Minus size={16} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => clampZoom(value + 0.15))} aria-label="Zoom in">
            <Plus size={16} />
          </button>
          <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset view">
            <Scan size={16} />
          </button>
        </div>
      </div>

      <div className="scene-frame">
        <div
          className="scene-world"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {children}
        </div>
      </div>

      <div className="nudge-pad" aria-label="Move scene">
        <button type="button" onClick={() => move(0, -18)} aria-label="Move view up"><Move size={15} /> Up</button>
        <button type="button" onClick={() => move(18, 0)} aria-label="Move view left">Left</button>
        <button type="button" onClick={() => move(-18, 0)} aria-label="Move view right">Right</button>
        <button type="button" onClick={() => move(0, 18)} aria-label="Move view down">Down</button>
      </div>
    </section>
  );
}
