import { useEffect, useMemo, useState } from "react";
import {
  createStoryState, persistStoryState, currentGlow, recordVisit,
  completeTask, skipTask, raiseFriendship, markBeatSeen,
} from "./storyState.js";
import { pendingBeats } from "./beats.js";
import { selectDailyTasks } from "./questSelector.js";
import { NPC_DIALOGUE, pickLine } from "./npcDialogue.js";
import { CAST } from "./cast.js";

// ── StoryOverlay: the Grove's daily invitation card + story-beat toast ──
// A single floating HUD panel, styled to match the existing parchment
// .grove-* classes, offering today's 1-3 tasks with a plain, always-
// visible "Not today" skip on every one — no confirmation dialog, no
// guilt copy, no streak-loss warning, because skipping costs nothing.
// A soft-glow chip shows the streak as a dimming warmth, never a number
// that can hit zero and never a countdown. Story beats surface as a
// small dismissible toast the moment their gate is met — never blocking
// the canvas underneath, matching Homescapes' between-session drip.
//
// `analysis` is optional and may be null/undefined (a brand-new user, or
// a caller that hasn't wired the analysis layer in yet); the selector
// already degrades gracefully for that case.
export default function StoryOverlay({ analysis, open, onToggle }) {
  const [state, setState] = useState(() => createStoryState());
  const [beatQueue, setBeatQueue] = useState([]);

  // Record a visit once per mount (opening Grove at all counts as
  // showing up, independent of whether any task gets completed).
  useEffect(() => {
    setState((s) => {
      const next = recordVisit(s);
      persistStoryState(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const pending = pendingBeats(state, state.seenBeatIds);
    if (pending.length && beatQueue.length === 0) {
      setBeatQueue([pending[0]]);
    }
    // Only re-check when progress counters actually move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tasksCompleted, state.districtsVisited.length]);

  const draw = useMemo(
    () => selectDailyTasks(analysis, { recentTaskIds: state.recentTaskIds }),
    // Re-drawn only when the analysis result or the recent-task history
    // changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analysis, state.recentTaskIds.join(",")],
  );

  const glow = currentGlow(state);

  function handleComplete(task) {
    setState((s) => {
      const next = completeTask(s, task.id, { districtId: task.district });
      const npcId = npcForDistrict(task.district);
      const raised = npcId ? raiseFriendship(next, npcId, 1) : next;
      persistStoryState(raised);
      return raised;
    });
  }

  function handleSkip(task) {
    setState((s) => {
      const next = skipTask(s);
      persistStoryState(next);
      return next;
    });
  }

  function dismissBeat(beat) {
    setState((s) => {
      const next = markBeatSeen(s, beat.id);
      persistStoryState(next);
      return next;
    });
    setBeatQueue((q) => q.filter((b) => b.id !== beat.id));
  }

  const activeBeat = beatQueue[0] ?? null;

  return (
    <>
      {/* Soft-glow streak chip: a warmth level, never a countable streak
          number, and never framed as something that can "break." */}
      <button
        type="button"
        className="grove-glow-chip"
        onClick={onToggle}
        title="The Grove keeps a quiet spot ready for you"
        style={{ "--glow": glow }}
      >
        <span className="grove-glow-dot" />
        {open ? "Hide today" : "Today in the Grove"}
      </button>

      {open && (
        <div className="grove-story-panel">
          <div className="grove-story-header">
            <div className="grove-story-title">A few things, if you'd like</div>
            <div className="grove-story-sub">
              None of these are owed. Skipping costs nothing.
            </div>
          </div>
          <div className="grove-story-tasks">
            {draw.tasks.map((task) => (
              <div key={task.id} className="grove-story-task">
                <span className="grove-story-task-text">{task.text}</span>
                <div className="grove-story-task-actions">
                  <button
                    type="button"
                    className="grove-btn grove-btn--sm grove-btn--green"
                    onClick={() => handleComplete(task)}
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    className="grove-btn grove-btn--sm grove-btn--dark"
                    onClick={() => handleSkip(task)}
                  >
                    Not today
                  </button>
                </div>
              </div>
            ))}
            {!draw.tasks.length && (
              <div className="grove-story-task-text">
                Nothing planned today either. Wandering counts.
              </div>
            )}
          </div>
          {!draw.reliable && (
            <div className="grove-story-footnote">
              Keeping things gentle today — the Grove doesn't know you well enough yet to do more than that.
            </div>
          )}
        </div>
      )}

      {activeBeat && (
        <div className="grove-story-beat" role="status">
          <div className="grove-story-beat-title">{activeBeat.title}</div>
          {activeBeat.lines.map((line, i) => (
            <div key={i} className="grove-story-beat-line">{line}</div>
          ))}
          <button
            type="button"
            className="grove-btn grove-btn--sm grove-btn--gold"
            onClick={() => dismissBeat(activeBeat)}
          >
            Mm.
          </button>
        </div>
      )}
    </>
  );
}

// Who is standing in a district, sourced from the cast itself rather than
// a second hand-kept table — adding a resident in story/cast.js is all it
// takes for their moodEcho line to show up in the right place.
function npcForDistrict(districtId) {
  return CAST.find((c) => c.district === districtId)?.id ?? null;
}
