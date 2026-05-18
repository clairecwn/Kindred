// Web Audio API sound engine — no external files required

let _ctx = null;
let _gain = null;
let _muted = false;
let _ambientOn = false;
let _ambientTimer = null;

function ctx() {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      _gain = _ctx.createGain();
      _gain.gain.value = 0.45;
      _gain.connect(_ctx.destination);
    } catch { return null; }
  }
  return _ctx;
}

function beep(freq, dur, type = "sine", vol = 0.28, delay = 0) {
  if (_muted) return;
  const c = ctx(); if (!c) return;
  if (c.state === "suspended") c.resume();
  const osc = c.createOscillator();
  const g   = c.createGain();
  const t   = c.currentTime + delay;
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.016);
  g.gain.setValueAtTime(vol, t + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(_gain);
  osc.start(t); osc.stop(t + dur + 0.06);
}

export const sfx = {
  click:    () => beep(700, 0.06, "sine", 0.13),
  coin:     () => { beep(880, 0.09, "sine", 0.35); beep(1320, 0.14, "sine", 0.25, 0.07); },
  purchase: () => [440, 554, 659, 880].forEach((f, i) => beep(f, 0.17, "triangle", 0.28, i * 0.08)),
  win:      () => { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.22, "sine", 0.3, i * 0.11)); beep(1047, 0.38, "sine", 0.2, 0.42); },
  lose:     () => { beep(280, 0.3, "sawtooth", 0.18); beep(220, 0.25, "sawtooth", 0.14, 0.28); },
  error:    () => beep(200, 0.25, "square", 0.12),
  dice:     () => [220, 300, 220, 380, 260].forEach((f, i) => beep(f, 0.055, "square", 0.08, i * 0.05)),
  move:     () => beep(523, 0.09, "sine", 0.2),
  place:    () => { beep(330, 0.12, "triangle", 0.22); beep(440, 0.12, "triangle", 0.18, 0.08); },
  chat:     () => beep(880, 0.06, "sine", 0.1),
  star:     () => [659, 784, 988, 1319].forEach((f, i) => beep(f, 0.2, "sine", 0.3, i * 0.1)),
  flip:     () => beep(440, 0.07, "sine", 0.12),
  match:    () => { beep(784, 0.1, "sine", 0.25); beep(1047, 0.15, "sine", 0.2, 0.1); },
  tap:      () => beep(600, 0.05, "sine", 0.14),
  correct:  () => { beep(659, 0.12, "sine", 0.25); beep(784, 0.18, "sine", 0.2, 0.1); },
  wrong:    () => beep(260, 0.22, "sawtooth", 0.15),

  setMuted(v) { _muted = v; if (v) this.stopAmbient(); },
  getMuted()  { return _muted; },

  resumeCtx() { const c = ctx(); if (c?.state === "suspended") c.resume(); },

  startAmbient() {
    if (_ambientOn || _muted) return;
    _ambientOn = true;
    // C major pentatonic: C D E G A
    const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
    const tick = () => {
      if (!_ambientOn) return;
      const f = notes[Math.floor(Math.random() * notes.length)];
      beep(f * 0.5, 2.2 + Math.random() * 1.4, "sine", 0.022 + Math.random() * 0.018);
      if (Math.random() > 0.5) beep(f, 1.0 + Math.random() * 0.8, "sine", 0.01, 0.35);
      _ambientTimer = setTimeout(tick, 700 + Math.random() * 1100);
    };
    tick();
  },

  stopAmbient() {
    _ambientOn = false;
    if (_ambientTimer) { clearTimeout(_ambientTimer); _ambientTimer = null; }
  },
};
