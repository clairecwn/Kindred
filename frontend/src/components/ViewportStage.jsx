import { useStageScale } from "../hooks/useStageScale.js";

/**
 * Renders children into the design canvas and scales it uniformly to cover the
 * viewport, so every element keeps the exact size and spacing it had on the
 * original layout no matter what screen it lands on. See useStageScale for how
 * the canvas is sized.
 */
export default function ViewportStage({ children }) {
  const { scale, width, height } = useStageScale();

  return (
    <div className="viewport-fit">
      <div
        className="design-stage"
        style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
