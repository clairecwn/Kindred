// Procedurally generated ambient soundscape — no external files required.
// Uses Web Audio API: brown noise + layered sine drones + soft detuned pads.

export class AmbientPlayer {
  constructor() {
    this.ctx    = null;
    this.master = null;
    this.nodes  = [];
    this.active = false;
  }

  async start() {
    if (this.active) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") await this.ctx.resume();

    this.master = this.ctx.createGain();
    this.master.gain.setValueAtTime(0, this.ctx.currentTime);
    this.master.connect(this.ctx.destination);

    // Brown noise (warm, rain-like texture)
    this._brownNoise(0.045);

    // Bass drones — A1 + E2 (a fifth)
    this._drone(55.0,  0.08, 0.07);
    this._drone(82.4,  0.05, 0.11);

    // Mid-register pads — A3 + E4
    this._pad(220.0, 0.032, 18);
    this._pad(329.6, 0.020, 12);

    // High shimmer — very soft A4
    this._pad(440.0, 0.010, 8);

    // Gentle fade-in over 4 s
    this.master.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + 4);
    this.active = true;
  }

  stop() {
    if (!this.active || !this.master) return;
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2.5);
    setTimeout(() => {
      this.nodes.forEach(n => { try { n.stop?.(); } catch (_) {} });
      this.nodes = [];
      try { this.ctx?.close(); } catch (_) {}
      this.ctx = this.master = null;
      this.active = false;
    }, 2800);
  }

  setVolume(v) {
    if (!this.master) return;
    this.master.gain.linearRampToValueAtTime(
      Math.max(0, Math.min(1, v)) * 0.6,
      this.ctx.currentTime + 0.4
    );
  }

  // ── Private builders ──────────────────────────────────────────────────────

  _brownNoise(gain) {
    const rate = this.ctx.sampleRate;
    const buf  = this.ctx.createBuffer(1, rate * 6, rate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * w) / 1.02;
      last = data[i];
      data[i] *= 3.5;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop   = true;

    // Warm low-pass
    const lp = this.ctx.createBiquadFilter();
    lp.type            = "lowpass";
    lp.frequency.value = 600;
    lp.Q.value         = 0.5;

    const g = this.ctx.createGain();
    g.gain.value = gain;

    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start();
    this.nodes.push(src);
  }

  _drone(freq, gain, lfoHz) {
    const osc = this.ctx.createOscillator();
    osc.type           = "sine";
    osc.frequency.value = freq;

    // Very slow tremolo
    const lfo  = this.ctx.createOscillator();
    lfo.type            = "sine";
    lfo.frequency.value = lfoHz;

    const lfoG = this.ctx.createGain();
    lfoG.gain.value = gain * 0.35;

    const base = this.ctx.createGain();
    base.gain.value = gain * 0.65;

    lfo.connect(lfoG);
    lfoG.connect(base.gain);
    osc.connect(base);
    base.connect(this.master);

    lfo.start(); osc.start();
    this.nodes.push(osc, lfo);
  }

  _pad(freq, gain, detuneCents) {
    // Detuned pair → soft chorus
    for (const d of [-detuneCents, detuneCents]) {
      const osc = this.ctx.createOscillator();
      osc.type            = "sine";
      osc.frequency.value = freq;
      osc.detune.value    = d;

      const g = this.ctx.createGain();
      g.gain.value = gain;

      osc.connect(g); g.connect(this.master);
      osc.start();
      this.nodes.push(osc);
    }
  }
}

// Singleton — one player for the whole app
export const ambientPlayer = new AmbientPlayer();
