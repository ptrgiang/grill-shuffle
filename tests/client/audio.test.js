// Audio engine lifecycle (unlock, priming, hide/show, volumes, idle warm-up) against a fake Web Audio context.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Audio, GESTURE_EVENTS, WARM_ORDER } from '../../client/audio/audio.js';

const param = (value = 0) => ({ value, setTargetAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
const node = (extra = {}) => ({ connect: (n) => n, ...extra });

class FakeContext {
  static instances = [];
  constructor() {
    this.state = 'suspended';
    this.sampleRate = 8000;
    this.currentTime = 0;
    this.destination = node();
    this.sources = [];
    this.resumes = 0;
    this.suspends = 0;
    FakeContext.instances.push(this);
  }
  resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
  suspend() { this.suspends++; this.state = 'suspended'; return Promise.resolve(); }
  createGain() { return node({ gain: param(1) }); }
  createDynamicsCompressor() { return node({ threshold: param(), ratio: param() }); }
  createStereoPanner() { return node({ pan: param() }); }
  createBuffer(ch, length) { return { length, copyToChannel() {} }; }
  createBufferSource() {
    const s = node({ playbackRate: param(1), started: false, start() { this.started = true; } });
    this.sources.push(s);
    return s;
  }
}

function setup(opts = {}) {
  FakeContext.instances = [];
  const queue = [];
  const audio = new Audio({ AudioContext: FakeContext, idle: (fn) => queue.push(fn), ...opts });
  const drain = () => { while (queue.length) queue.shift()(); };
  return { audio, queue, drain };
}

test('audio: no context before a gesture; every unlock gesture creates and primes one', () => {
  for (const ev of GESTURE_EVENTS) {
    const { audio } = setup();
    const doc = new EventTarget();
    doc.visibilityState = 'visible';
    const detach = audio.attach(doc, new EventTarget());
    assert.equal(audio.ctx, null);
    doc.dispatchEvent(new Event(ev));
    const ctx = audio.ctx;
    assert.ok(ctx, `${ev} unlocks`);
    assert.equal(ctx.resumes, 1);
    // a silent 1-sample buffer was started inside the gesture (iOS priming)
    assert.ok(ctx.sources.some((s) => s.buffer?.length === 1 && s.started), `${ev} primes`);
    doc.dispatchEvent(new Event(ev));
    assert.equal(FakeContext.instances.length, 1, 'one context only');
    assert.equal(ctx.resumes, 1, 'no resume while running');
    detach();
  }
});

test('audio: an interrupted context (iOS call / lock screen) is resumed by the next gesture', () => {
  const { audio } = setup();
  audio.unlock();
  audio.ctx.state = 'interrupted';
  audio.unlock();
  assert.equal(audio.ctx.state, 'running');
  assert.equal(audio.ctx.resumes, 2);
});

test('audio: buffers are pre-generated in idle slices, then ambience starts', () => {
  const { audio, queue, drain } = setup();
  audio.unlock();
  assert.equal(audio.buffers.size, 0, 'nothing synthesised inside the gesture');
  assert.ok(queue.length === 1);
  queue.shift()();
  assert.equal(audio.buffers.size, 1, 'one buffer per idle slice');
  drain();
  for (const [n, v] of WARM_ORDER) assert.ok(audio.buffers.has(`${n}:${v}`), `${n}:${v} warmed`);
  for (let c = 1; c <= 5; c++) assert.ok(audio.buffers.has(`match${c}:0`));
  assert.ok(audio.ambSrc, 'ambience started after warm-up');
  assert.ok(audio.amb.gain.value > 0);
});

test('audio: hidden page fades ambience out and suspends; visible resumes and fades back', async () => {
  const { audio, drain } = setup({ ambienceVolume: 0.5 });
  const doc = new EventTarget();
  const win = new EventTarget();
  audio.attach(doc, win);
  doc.dispatchEvent(new Event('touchend'));
  drain();
  const ctx = audio.ctx;
  const on = audio.amb.gain.value;
  assert.ok(on > 0);
  doc.visibilityState = 'hidden';
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(audio.amb.gain.value, 0, 'ambience faded');
  audio.onEvent({ type: 'button' });
  const n = ctx.sources.length;
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(ctx.suspends, 1);
  assert.equal(ctx.sources.length, n, 'no sfx while hidden');
  win.dispatchEvent(new Event('pageshow'));
  assert.equal(ctx.state, 'running');
  assert.equal(audio.amb.gain.value, on, 'ambience back at its level');
  win.dispatchEvent(new Event('pagehide'));
  assert.equal(audio.hidden, true);
});

test('audio: separate sfx / ambience volumes, mute keeps the graph', () => {
  const { audio, drain } = setup();
  audio.unlock();
  drain();
  const full = audio.amb.gain.value;
  audio.setVolumes({ sfx: 0.25, ambience: 0.5 });
  assert.equal(audio.sfx.gain.value, 0.25);
  assert.equal(audio.amb.gain.value, full * 0.5);
  audio.setVolumes({ sfx: 7, ambience: NaN });
  assert.equal(audio.sfxVolume, 1);
  assert.equal(audio.ambienceVolume, 1);
  audio.setMuted(true);
  assert.equal(audio.master.gain.value, 0);
  const n = audio.ctx.sources.length;
  audio.onEvent({ type: 'match', combo: 2 });
  assert.equal(audio.ctx.sources.length, n, 'muted: nothing plays');
  audio.setMuted(false);
  audio.onEvent({ type: 'match', combo: 9 });
  assert.equal(audio.ctx.sources.length, n + 1);
});

test('audio: no Web Audio support is a silent no-op', () => {
  const audio = new Audio({ AudioContext: null });
  audio.AC = undefined;
  audio.unlock();
  audio.setHidden(true);
  audio.setVolumes({ sfx: 0.5 });
  audio.onEvent({ type: 'select' });
  assert.equal(audio.ctx, null);
});

test('audio: a theme ambience swaps the running loop (built in an idle slice), same params keep it', () => {
  const { audio, drain } = setup();
  audio.unlock();
  drain();
  const first = audio.ambSrc;
  audio.setAmbience({ hiss: 0.08, rumble: 1.2, crackle: 2, seed: 7 });
  assert.equal(audio.ambSrc, null, 'old loop stopped');
  drain();
  assert.ok(audio.ambSrc && audio.ambSrc !== first, 'new loop running');
  assert.equal(audio.ambSrc.buffer, audio.buffers.get('ambience:{"hiss":0.08,"rumble":1.2,"crackle":2,"seed":7}'));
  const second = audio.ambSrc;
  audio.setAmbience({ hiss: 0.08, rumble: 1.2, crackle: 2, seed: 7 });
  assert.equal(audio.ambSrc, second, 'unchanged params: no swap');
});
