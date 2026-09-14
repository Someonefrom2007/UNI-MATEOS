// Ambient soundscape engine — fully synthesized with WebAudio (no external
// streams, works offline in production builds). Each mode wires nodes into a
// shared master bus that also feeds an AnalyserNode used by the UI equalizer.

const CHORD = [220, 261.63, 329.63, 440]; // A3-ish stack for the cyber arp
const LOFI_CHORD = [196, 246.94, 293.66]; // G3-ish warm pad

export class SoundscapeEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    this.nodes = [];
    this.timers = [];
    this.mode = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const webkitCtor = typeof window !== "undefined" ? (/** @type {any} */ (window).webkitAudioContext) : null;
    const Ctor = typeof window !== "undefined" && (window.AudioContext || webkitCtor);
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.82;
    this.analyser.connect(this.master);
    return this.ctx;
  }

  add(node) {
    this.nodes.push(node);
  }

  addTimer(id) {
    this.timers.push(id);
  }

  clear() {
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];
    this.nodes.forEach((n) => {
      try {
        if (typeof n.stop === "function") n.stop();
      } catch {
        /* already stopped */
      }
      try {
        if (typeof n.disconnect === "function") n.disconnect();
      } catch {
        /* already disconnected */
      }
    });
    this.nodes = [];
  }

  start(mode) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.clear();
    this.mode = mode;
    if (mode === "cyber") this.buildCyber(ctx);
    else if (mode === "lo-fi") this.buildLofi(ctx);
    else if (mode === "binaural") this.buildBinaural(ctx);
    else if (mode === "brown") this.buildBrown(ctx);
  }

  stop() {
    this.clear();
    this.mode = null;
  }

  dispose() {
    this.stop();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        /* already closed */
      }
      this.ctx = null;
      this.master = null;
      this.analyser = null;
    }
  }

  levels(bars = 24) {
    if (!this.analyser || !this.ctx) return Array(bars).fill(2);
    const buf = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buf);
    const out = [];
    const step = buf.length / bars;
    for (let i = 0; i < bars; i++) {
      const start = Math.floor(i * step);
      const end = Math.max(start + 1, Math.floor((i + 1) * step));
      let sum = 0;
      for (let j = start; j < end; j++) sum += buf[j];
      const avg = sum / (end - start);
      out.push(Math.round(4 + (avg / 255) * 90));
    }
    return out;
  }

  buildCyber(ctx) {
    const master = this.master;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1300;
    filter.Q.value = 0.6;
    filter.connect(master);
    this.add(filter);

    const delay = ctx.createDelay();
    delay.delayTime.value = 0.3;
    const dg = ctx.createGain();
    dg.gain.value = 0.5;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    filter.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(dg);
    dg.connect(master);
    this.add(delay);
    this.add(dg);
    this.add(fb);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 500;
    lfo.connect(lfoAmt);
    lfoAmt.connect(filter.frequency);
    lfo.start();
    this.add(lfo);
    this.add(lfoAmt);

    CHORD.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? "sawtooth" : "square";
      o.frequency.value = f * (i === 2 ? 2 : 1);
      o.detune.value = i % 2 ? 6 : -6;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.03 : 0.08;
      o.connect(g);
      g.connect(filter);
      o.start();
      this.add(o);
      this.add(g);
    });

    const arp = setInterval(() => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = CHORD[Math.floor(Math.random() * CHORD.length)] * 2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(g);
      g.connect(filter);
      o.start(t);
      o.stop(t + 0.6);
      this.add(o);
      this.add(g);
    }, 820);
    this.addTimer(arp);
  }

  buildLofi(ctx) {
    const master = this.master;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.connect(master);
    this.add(filter);

    LOFI_CHORD.forEach((f) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const wob = ctx.createOscillator();
      wob.frequency.value = 0.4 + Math.random() * 0.3;
      const amt = ctx.createGain();
      amt.gain.value = 3.5;
      wob.connect(amt);
      amt.connect(o.detune);
      const v = ctx.createGain();
      v.gain.value = 0.045;
      o.connect(v);
      v.connect(filter);
      o.start();
      wob.start();
      this.add(o);
      this.add(v);
      this.add(wob);
      this.add(amt);
    });

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = "highpass";
    nf.frequency.value = 5200;
    const ng = ctx.createGain();
    ng.gain.value = 0.012;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(master);
    noise.start();
    this.add(noise);
    this.add(nf);
    this.add(ng);
  }

  buildBinaural(ctx) {
    const base = 180;
    const beat = 10; // ~10 Hz alpha
    [0, 1].forEach((ch) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = base + (ch === 0 ? 0 : beat);
      const g = ctx.createGain();
      g.gain.value = 0.12;
      const pan = ctx.createStereoPanner();
      pan.pan.value = ch === 0 ? -1 : 1;
      o.connect(g);
      g.connect(pan);
      pan.connect(this.master);
      o.start();
      this.add(o);
      this.add(g);
      this.add(pan);
    });
  }

  buildBrown(ctx) {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 480;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    this.add(src);
    this.add(f);
    this.add(g);
  }
}