// Effetti sonori sintetizzati al volo con la Web Audio API: niente file audio da caricare
class SoundFX {
  constructor(muted = false) {
    this.ctx = null;
    this.master = null;
    this.noise = null; // buffer di rumore bianco, riusato per colpi ed esplosioni
    this.muted = muted;
  }

  // I browser avviano l'audio solo dopo un gesto dell'utente: va chiamata su click/tocco
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.attach(new AC());
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  // Prepara la catena audio su un contesto (anche un OfflineAudioContext, per provarla)
  attach(ctx) {
    this.ctx = ctx;
    // Saturazione morbida (tanh): i suoni normali passano quasi invariati, i picchi di più suoni
    // sommati (es. esplosione + riflessi) vengono smussati invece di distorcere
    const RANGE = 3; // il WaveShaper lavora su [-1, 1]: riduco l'ingresso e lo ricurvo su [-3, 3]
    const pre = ctx.createGain();
    pre.gain.value = 1 / RANGE;
    const clipper = ctx.createWaveShaper();
    const curve = new Float32Array(1025);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / 512) - 1) * RANGE);
    clipper.curve = curve;
    pre.connect(clipper).connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(pre);
    const len = ctx.sampleRate; // 1 secondo
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(muted) {
    this.muted = muted;
  }

  // Inviluppo: attacco rapido e coda esponenziale
  envelope(t, vol, dur, attack = 0.005) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.master);
    return g;
  }

  // Oscillatore con glissato da f0 a f1
  tone({ type = "sine", f0, f1 = f0, dur, vol = 0.2, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    osc.connect(this.envelope(t, vol, dur));
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // Rumore filtrato, con la frequenza del filtro che scorre da f0 a f1
  hiss({ type = "lowpass", f0 = 2000, f1 = f0, q = 1, dur, vol = 0.3, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
    src.connect(filter).connect(this.envelope(t, vol, dur, 0.003));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  play(name, data = {}) {
    if (this.muted || !this.ctx) return;
    switch (name) {
      case "select":
        this.tone({ f0: 660, dur: 0.06, vol: 0.06 });
        break;
      case "popup":
        this.tone({ f0: 880, dur: 0.05, vol: 0.05 });
        break;
      case "deny":
        this.tone({ type: "triangle", f0: 200, f1: 140, dur: 0.14, vol: 0.12 });
        break;
      case "lift":
        this.tone({ type: "triangle", f0: 380, f1: 620, dur: 0.07, vol: 0.06 });
        break;
      case "cancel":
        this.tone({ type: "triangle", f0: 420, f1: 260, dur: 0.1, vol: 0.06 });
        break;
      case "undo":
        this.tone({ type: "triangle", f0: 700, f1: 350, dur: 0.12, vol: 0.07 });
        this.tone({ type: "triangle", f0: 520, f1: 260, dur: 0.1, vol: 0.05, delay: 0.07 });
        break;
      case "peerJoined":
        [523.25, 783.99].forEach((f, i) =>
          this.tone({ type: "triangle", f0: f, dur: 0.15, vol: 0.08, delay: i * 0.1 }));
        break;
      case "peerLeft":
        [659.25, 392].forEach((f, i) =>
          this.tone({ type: "triangle", f0: f, dur: 0.18, vol: 0.08, delay: i * 0.12 }));
        break;
      case "notYourTurn":
      case "needFire":
        this.tone({ type: "square", f0: 180, dur: 0.06, vol: 0.04 });
        this.tone({ type: "square", f0: 180, dur: 0.06, vol: 0.04, delay: 0.09 });
        break;
      case "move":
        this.hiss({ type: "bandpass", f0: 1800, q: 2, dur: 0.06, vol: 0.4 });
        this.tone({ type: "triangle", f0: 320, f1: 180, dur: 0.08, vol: 0.12 });
        break;
      case "rotate":
        this.tone({ type: "triangle", f0: 520, dur: 0.06, vol: 0.1 });
        this.tone({ type: "triangle", f0: 780, dur: 0.07, vol: 0.1, delay: 0.06 });
        break;
      case "fire":
        this.tone({ type: "sawtooth", f0: 1600, f1: 180, dur: 0.35, vol: 0.09 });
        this.tone({ type: "square", f0: 3200, f1: 600, dur: 0.18, vol: 0.03 });
        this.hiss({ type: "highpass", f0: 4000, dur: 0.08, vol: 0.12 });
        break;
      case "reflect": {
        // Ogni rimbalzo un semitono più in alto
        const f = 1300 * Math.pow(2, Math.min(data.bounce || 0, 14) / 12);
        this.tone({ f0: f, f1: f * 0.97, dur: 0.16, vol: 0.08 });
        this.tone({ type: "triangle", f0: f * 2, dur: 0.05, vol: 0.025 });
        break;
      }
      case "block":
        this.tone({ type: "square", f0: 220, f1: 140, dur: 0.12, vol: 0.06 });
        this.hiss({ type: "bandpass", f0: 2500, q: 3, dur: 0.09, vol: 0.35 });
        break;
      case "destroy":
        this.hiss({ f0: 3500, f1: 200, dur: 0.5, vol: 0.6 });
        this.tone({ f0: 150, f1: 40, dur: 0.4, vol: 0.4 });
        break;
      case "king":
        this.hiss({ f0: 5000, f1: 120, dur: 1.4, vol: 0.6 });
        this.tone({ f0: 110, f1: 30, dur: 1.0, vol: 0.5 });
        this.hiss({ f0: 1500, f1: 100, dur: 0.9, vol: 0.4, delay: 0.25 });
        break;
      case "gameover":
        if (data.winner) {
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
            this.tone({ type: "square", f0: f, dur: 0.2, vol: 0.05, delay: i * 0.14 }));
        } else {
          [392, 261.63].forEach((f, i) =>
            this.tone({ type: "triangle", f0: f, dur: 0.4, vol: 0.12, delay: i * 0.3 }));
        }
        break;
    }
  }
}
