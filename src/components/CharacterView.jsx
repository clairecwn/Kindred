import { useLayoutEffect, useMemo, useRef, useState } from "react";
import AvatarStage from "../avatar/AvatarStage.jsx";
import {
  CAST, DEFAULT_CHARACTER, getCharacter,
  SKIN_TONES, SKIN_TONE_NAMES, HAIR_TONES, HAIR_TONE_NAMES, hexCss,
} from "../avatar/index.js";
import { adaptLegacyDescriptor } from "../avatar/kindredAdapter.js";
import "../avatar/avatar.css";

/**
 * CharacterView — the dressing room. One screen, nothing scrolls: the chosen
 * character stands on a lit podium in the middle of a walk-in closet, the
 * cast models full-body down the left, and skin and hair get a panel each on
 * the right.
 *
 * The character turns a full 360 degrees by dragging across it. Yaw only,
 * handled inside AvatarStage, so it can never tip over.
 *
 * Everything writes to the single saved record under "kindred.character".
 * Note what is NOT passed to the rig: the saved record is read for its id and
 * its two tone indices and nothing else. Older saves still carry an equipped
 * wardrobe and a `palette.cloth` from the retired wardrobe screen, and
 * passing either one through covers each character's authored two-tone outfit
 * with a blank garment -- which is exactly how everyone ended up in white.
 */

/** Measure a node so the three.js canvas is handed real pixels rather than a
 *  percentage it cannot letterbox correctly. */
function useBoxSize(ref) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setBox({ width: Math.round(r.width), height: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}

function TonePanel({ title, tones, names, value, onPick, onHover }) {
  return (
    <section className="dr-panel dr-panel--tones">
      <div className="dr-panel-title">{title}</div>
      <div className="dr-tone-grid">
        {tones.map((hex, i) => (
          <button
            key={i}
            type="button"
            className={`dr-tone${value === i ? " active" : ""}`}
            style={{ "--swatch-color": hexCss(hex) }}
            onClick={() => onPick(i)}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(i)}
            onBlur={() => onHover(null)}
            title={names[i] ?? `Tone ${i + 1}`}
            aria-label={`${title}: ${names[i] ?? i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

export default function CharacterView({ emotion, character, setCharacter }) {
  const [hover, setHover] = useState(null);   // { skinTone } | { hairTone }
  const [reactKey, setReactKey] = useState(0);
  const stageRef = useRef(null);
  const castRef = useRef(null);
  const stageBox = useBoxSize(stageRef);
  const castBox = useBoxSize(castRef);

  const resolved = useMemo(() => adaptLegacyDescriptor(character ?? {}), [character]);
  const activeId = resolved.character ?? DEFAULT_CHARACTER;
  const active = getCharacter(activeId);
  const skinTone = character?.skinTone ?? null;
  const hairTone = character?.hairTone ?? null;

  function patch(next) {
    setCharacter((c) => ({ ...(c ?? {}), ...next }));
    setReactKey((k) => k + 1);
  }

  // Built from scratch each time rather than spread from the saved record,
  // so nothing the old wardrobe screen left behind can reach the rig.
  const preview = useMemo(() => ({
    character: activeId,
    skinTone: hover?.skinTone ?? skinTone,
    hairTone: hover?.hairTone ?? hairTone,
  }), [activeId, skinTone, hairTone, hover]);

  const canvasH = Math.max(200, Math.min(Math.round(stageBox.height - 48), 520));
  const canvasW = Math.max(170, Math.min(stageBox.width, Math.round(canvasH * 0.86)));

  // The cast rail never scrolls. Each of the five cards takes an equal share
  // of whatever height the rail actually has, and the model inside is sized
  // from that share, so the whole body fits on every card at every window
  // height instead of the first and last being clipped.
  const CARD_GAP = 6;
  const NAME_H = 17;
  const cardH = castBox.height > 0
    ? Math.floor((castBox.height - CARD_GAP * (CAST.length - 1)) / CAST.length)
    : 0;
  const modelH = Math.max(34, cardH - NAME_H - 4);
  const modelW = Math.max(30, Math.min(castBox.width - 14, Math.round(modelH * 0.82)));

  return (
    <div className="dressing-room anim-fade-in">
      {/* The room itself is a Blender render (assets_blender/kindred_dressing_room.blend);
          only the light and the falloff are drawn here, over the top of it. */}
      <div className="dr-room" aria-hidden="true">
        <div className="dr-spotlight" />
        <div className="dr-vignette" />
      </div>

      <div className="dr-layout">

        {/* ── Characters ──────────────────────────────────────────── */}
        <section className="dr-panel dr-panel--cast">
          <div className="dr-panel-title">Characters</div>
          <div className="dr-cast-list" ref={castRef}>
            {CAST.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`dr-kin${activeId === c.id ? " active" : ""}`}
                style={{ height: cardH > 0 ? cardH : undefined }}
                onClick={() => patch({ character: c.id })}
                title={c.name}
              >
                {cardH > 0 && (
                  <AvatarStage
                    className="dr-kin-model"
                    character={{ character: c.id, skinTone, hairTone }}
                    angle={0.42}
                    size={{ width: modelW, height: modelH }}
                    static
                  />
                )}
                <span className="dr-kin-name">{c.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── The podium ──────────────────────────────────────────── */}
        <div className="dr-stage" ref={stageRef}>
          <div className="dr-stage-name">{active.name}</div>
          <div className="dr-podium" aria-hidden="true" />
          <div className="dr-avatar">
            {stageBox.width > 0 && (
              <AvatarStage
                character={preview}
                clip={emotion ?? "calm"}
                reactKey={reactKey}
                reactClip="wave"
                spinnable
                size={{ width: canvasW, height: canvasH }}
              />
            )}
          </div>
        </div>

        {/* ── Skin and hair, one panel each ───────────────────────── */}
        <div className="dr-right">
          <TonePanel
            title="Skin"
            tones={SKIN_TONES}
            names={SKIN_TONE_NAMES}
            value={skinTone}
            onPick={(i) => patch({ skinTone: i })}
            onHover={(i) => setHover(i == null ? null : { skinTone: i })}
          />
          <TonePanel
            title="Hair"
            tones={HAIR_TONES}
            names={HAIR_TONE_NAMES}
            value={hairTone}
            onPick={(i) => patch({ hairTone: i })}
            onHover={(i) => setHover(i == null ? null : { hairTone: i })}
          />
        </div>

      </div>
    </div>
  );
}
