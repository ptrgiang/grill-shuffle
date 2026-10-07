// Web Audio engine. The context starts on the first user gesture (browsers require it); buffers are synthesised
// lazily by synth.js and cached. Nothing here touches game state.
import { SOUNDS } from './synth.js';

export class Audio {
  constructor({ muted = false } = {}) {
    this.ctx = null;
    this.buffers = new Map();
    this.muted = muted;
    this.volume = 0.8;
    this.ambienceOn = true;
  }

  /** Call from a pointer/key handler. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    // gentle bus compression keeps stacked combo layers from clipping
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 3;
    this.master.connect(this.comp).connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.amb = this.ctx.createGain();
    this.amb.gain.value = 0;
    this.amb.connect(this.master);
    // warm the common sounds in idle time
    const warm = ['select', 'land', 'match1', 'invalid', 'ambience', 'match2'];
    const step = () => {
      const n = warm.shift();
      if (!n) return;
      this.buffer(n);
      setTimeout(step, 30);
    };
    setTimeout(step, 0);
    if (this.ambienceOn) this.startAmbience();
  }

  buffer(name, variant = 0) {
    const key = `${name}:${variant}`;
    if (!this.buffers.has(key)) {
      const sr = this.ctx.sampleRate;
      const data = SOUNDS[name](sr, variant);
      const b = this.ctx.createBuffer(1, data.length, sr);
      b.copyToChannel(data, 0);
      this.buffers.set(key, b);
    }
    return this.buffers.get(key);
  }

  play(name, { gain = 1, rate = 1, pan = 0, variant = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer(name, variant);
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    let node = src.connect(g);
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node = node.connect(p);
    }
    node.connect(this.sfx);
    src.start(this.ctx.currentTime + delay);
  }

  startAmbience() {
    if (!this.ctx || this.ambSrc) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer('ambience');
    src.loop = true;
    src.connect(this.amb);
    src.start();
    this.ambSrc = src;
    this.amb.gain.setTargetAtTime(0.32, this.ctx.currentTime, 1.2);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  /** Presentation hook: a simulation/view event -> sound. pan from the screen x (0..1). */
  onEvent(ev, screenX = 0.5) {
    const pan = (screenX - 0.5) * 0.6;
    switch (ev.type) {
      case 'select':
        return this.play('select', { gain: 0.7, rate: 0.95 + Math.random() * 0.1 });
      case 'land':
        return this.play('land', { gain: 0.8, pan, variant: Math.floor(Math.random() * 3), rate: 0.94 + Math.random() * 0.12 });
      case 'invalid':
        return this.play('invalid', { gain: 0.8 });
      case 'match':
        return this.play(`match${Math.min(5, ev.combo ?? 1)}`, { gain: 0.9, pan });
      case 'unlock':
        return this.play('unlock', { gain: 0.8, pan });
      case 'lock_progress':
        return this.play('select', { gain: 0.5, rate: 0.7, pan });
      case 'reveal':
        return this.play('reveal', { gain: 0.8, pan });
      case 'level_complete':
        return this.play('complete', { gain: 0.9 });
      case 'level_failed':
        return this.play('fail', { gain: 0.8 });
      case 'button':
        return this.play('button', { gain: 0.6 });
    }
  }
}
