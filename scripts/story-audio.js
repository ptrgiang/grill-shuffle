// npm run story-audio [-- <beat id> ...]: the sound of each story beat as a WAV (shots/story-audio/<id>.wav), mixed
// offline from the same cues and generators the game plays (client/story/cues.js, client/audio/synth.js), so the
// sound can be reviewed without a browser. Stereo, 44.1 kHz; the caption chime at 0.6 s, the wave transition at 0.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, parseArgs } from './lib/content.js';
import { BEATS } from '../client/story/beats.js';
import { allCues, panFor } from '../client/story/cues.js';
import { camAt } from '../client/story/timeline.js';
import { SOUNDS } from '../client/audio/synth.js';
import { STORY_SOUNDS } from '../client/audio/audio.js';

const SR = 44100;
const args = parseArgs();
const ids = args._.length ? args._ : Object.keys(BEATS);
const out = join(ROOT, 'shots', 'story-audio');
mkdirSync(out, { recursive: true });
const cache = new Map();
const sound = (name, v) => {
  const key = `${name}:${v}`;
  if (!cache.has(key)) cache.set(key, SOUNDS[`story_${name}`](SR, v));
  return cache.get(key);
};

function wav(L, R) {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 4, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  return b;
}

for (const id of ids) {
  const B = BEATS[id];
  if (!B) throw new Error(`no staging for ${id}`);
  const len = Math.ceil((B.length + 1.5) * SR);
  const L = new Float32Array(len), R = new Float32Array(len);
  const cues = allCues(B).map((c) => ({ ...c, pan: panFor(c.x, camAt(B.cam, c.t).x) }));
  cues.push({ name: 'chime', t: 0.6, pan: 0 });
  if (B.beach) cues.push({ name: 'wave', t: 0, pan: 0 });
  let k = 0;
  for (const c of cues) {
    const S = STORY_SOUNDS[c.name];
    const a = sound(c.name, S.variants ? k++ % S.variants : 0);
    const p = (c.pan ?? 0) * 0.7, gl = S.gain * Math.cos(((p + 1) * Math.PI) / 4), gr = S.gain * Math.sin(((p + 1) * Math.PI) / 4);
    const o = Math.floor(c.t * SR);
    for (let i = 0; i < a.length && o + i < len; i++) {
      L[o + i] += a[i] * gl * 0.8;
      R[o + i] += a[i] * gr * 0.8;
    }
  }
  writeFileSync(join(out, `${id}.wav`), wav(L, R));
  console.log(`${id}.wav  ${B.length}s  ${cues.length} cues: ${[...new Set(cues.map((c) => c.name))].join(', ')}`);
}
