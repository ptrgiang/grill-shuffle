// Web Audio engine. Nothing here touches game state.
//
// Mobile lifecycle (iOS Safari is the strict one):
//   - The context may only start / resume inside a user gesture, and iOS only honours some gestures
//     (touchend, click, keydown; pointerdown is not always enough). attach() listens to all of them, for the
//     app's whole life, because iOS also suspends ("interrupted") the context after calls, Siri, the lock screen.
//   - Starting a silent 1-sample buffer inside the gesture is what actually "primes" output on old iOS.
//   - Hidden page (app switch, tab switch, bfcache): ambience fades out, the context suspends. Visible again:
//     resume (works on Android; on iOS the next gesture finishes the job) and fade ambience back in.
//   - Buffers are synthesised by synth.js. After unlock every sound is pre-generated during idle time, one per
//     idle slice, so the first match never stalls on a slow phone; ambience (the big one) starts once it is built.
import { SOUNDS } from './synth.js';

export const GESTURE_EVENTS = ['pointerdown', 'touchend', 'click', 'keydown'];
const AMBIENCE_LEVEL = 0.32; // ambience gain at volume 1
const MASTER_LEVEL = 0.8;
/** Warm-up order: what the first move and first match need, then the rest, then the 6 s ambience loop. */
export const WARM_ORDER = [
  ['select', 0], ['land', 0], ['match1', 0], ['button', 0], ['invalid', 0], ['land', 1], ['land', 2],
  ['match2', 0], ['match3', 0], ['match4', 0], ['match5', 0], ['unlock', 0], ['reveal', 0], ['complete', 0], ['fail', 0],
  ['ambience', 0],
];

const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1);

export class Audio {
  /**
   * @param {object} o
   * @param {boolean} [o.muted]
   * @param {number} [o.sfxVolume] 0..1
   * @param {number} [o.ambienceVolume] 0..1
   * @param {Function} [o.AudioContext] injectable for tests
   * @param {(fn: Function) => void} [o.idle] schedules a warm-up slice (default requestIdleCallback / setTimeout)
   */
  constructor({ muted = false, sfxVolume = 1, ambienceVolume = 1, AudioContext, idle } = {}) {
    this.ctx = null;
    this.buffers = new Map();
    this.muted = muted;
    this.sfxVolume = clamp01(sfxVolume);
    this.ambienceVolume = clamp01(ambienceVolume);
    this.ambienceOn = true;
    this.hidden = false;
    this.AC = AudioContext ?? globalThis.AudioContext ?? globalThis.webkitAudioContext;
    this.idle = idle ?? ((fn) => (globalThis.requestIdleCallback ? globalThis.requestIdleCallback(fn, { timeout: 200 }) : setTimeout(fn, 16)));
    this.warming = false;
    this.ambienceParams = null; // theme `ambience` (null: synth defaults)
    this.ambienceKey = '0';
  }

  /** The theme's ambience params ({ hiss, rumble, crackle, seed }). A change swaps the running loop. */
  setAmbience(params = null) {
    const key = params == null ? '0' : JSON.stringify(params);
    if (key === this.ambienceKey) return;
    this.ambienceParams = params;
    this.ambienceKey = key;
    if (!this.ambSrc) return; // not started yet: the warm-up starts the right one
    try {
      this.ambSrc.stop?.();
    } catch {}
    this.ambSrc.disconnect?.();
    this.ambSrc = null;
    this.idle(() => this.ambienceOn && this.startAmbience()); // building a 6 s loop: not inside the click
  }

  /**
   * Wire the gesture + lifecycle listeners. Returns a detach function.
   * @param {EventTarget} doc the document (gestures, visibilitychange)
   * @param {EventTarget} [win] the window (pageshow / pagehide)
   */
  attach(doc = globalThis.document, win = globalThis.window) {
    const onGesture = () => this.unlock();
    const onVis = () => this.setHidden(doc.visibilityState === 'hidden');
    const onShow = () => this.setHidden(false);
    const onHide = () => this.setHidden(true);
    const opts = { capture: true, passive: true };
    for (const ev of GESTURE_EVENTS) doc.addEventListener(ev, onGesture, opts);
    doc.addEventListener('visibilitychange', onVis);
    win?.addEventListener('pageshow', onShow);
    win?.addEventListener('pagehide', onHide);
    return () => {
      for (const ev of GESTURE_EVENTS) doc.removeEventListener(ev, onGesture, opts);
      doc.removeEventListener('visibilitychange', onVis);
      win?.removeEventListener('pageshow', onShow);
      win?.removeEventListener('pagehide', onHide);
    };
  }

  /** Call from a gesture handler. Safe (and cheap) to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      if (!this.AC) return;
      try {
        this.ctx = new this.AC({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.#graph();
      this.#warm();
    }
    if (this.hidden) return;
    if (this.ctx.state !== 'running') {
      this.#primeSilence();
      this.ctx.resume?.().catch?.(() => {});
    }
  }

  #graph() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_LEVEL;
    // gentle bus compression keeps stacked combo layers from clipping
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 3;
    this.master.connect(this.comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVolume;
    this.sfx.connect(this.master);
    this.amb = ctx.createGain();
    this.amb.gain.value = 0;
    this.amb.connect(this.master);
  }

  /** A 1-sample silent buffer started inside the gesture: what makes old iOS actually open the output. */
  #primeSilence() {
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate || 22050);
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {}
  }

  /** Pre-generate every buffer, one per idle slice, then start the ambience loop. */
  #warm() {
    if (this.warming) return;
    this.warming = true;
    const queue = WARM_ORDER.slice();
    const step = () => {
      const next = queue.shift();
      if (!next) {
        this.warming = false;
        if (this.ambienceOn) this.startAmbience();
        return;
      }
      this.buffer(next[0], next[1]);
      this.idle(step);
    };
    this.idle(step);
  }

  buffer(name, variant = 0) {
    const amb = name === 'ambience'; // one loop per theme ambience
    const key = amb ? `ambience:${this.ambienceKey}` : `${name}:${variant}`;
    if (!this.buffers.has(key)) {
      const sr = this.ctx.sampleRate;
      const data = SOUNDS[name](sr, amb ? this.ambienceParams : variant);
      const b = this.ctx.createBuffer(1, data.length, sr);
      b.copyToChannel(data, 0);
      this.buffers.set(key, b);
    }
    return this.buffers.get(key);
  }

  play(name, { gain = 1, rate = 1, pan = 0, variant = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted || this.hidden || this.ctx.state === 'closed') return; // suspended: queued until resume
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
    this.#fadeAmbience(1.2);
  }

  #fadeAmbience(tc) {
    if (!this.amb) return;
    const target = this.hidden || !this.ambienceOn ? 0 : AMBIENCE_LEVEL * this.ambienceVolume;
    this.amb.gain.cancelScheduledValues?.(this.ctx.currentTime);
    this.amb.gain.setTargetAtTime(target, this.ctx.currentTime, tc);
  }

  /** Page hidden (app switch / tab switch / pagehide) or shown again. */
  setHidden(hidden) {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (!this.ctx) return;
    clearTimeout(this.suspendTimer);
    this.#fadeAmbience(hidden ? 0.08 : 0.8);
    if (hidden) {
      // let the short fade finish, then stop the clock (saves battery, avoids a click on return)
      this.suspendTimer = setTimeout(() => this.hidden && this.ctx.suspend?.().catch?.(() => {}), 300);
    } else {
      this.ctx.resume?.().catch?.(() => {}); // iOS may refuse outside a gesture; the next gesture resumes
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : MASTER_LEVEL, this.ctx.currentTime, 0.05);
  }

  /** Separate SFX / ambience levels, 0..1 each. */
  setVolumes({ sfx = this.sfxVolume, ambience = this.ambienceVolume } = {}) {
    this.sfxVolume = clamp01(sfx);
    this.ambienceVolume = clamp01(ambience);
    if (this.sfx) this.sfx.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.03);
    if (this.ambSrc) this.#fadeAmbience(0.1);
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
