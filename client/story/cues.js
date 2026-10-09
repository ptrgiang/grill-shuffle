// Sound cues of a story beat (#113), pure (no DOM, no audio): motion you can hear, no voice-over. Derived from the
// staging (client/story/beats.js), so a newly staged beat sounds right without extra data.
//
//   cuesBetween(staging, t0, t1) -> [{ name, x }] for every cue with time in (t0, t1]
//
// name: step (an actor walking, ~3 per second) · paper (a postcard / page / flyer / notebook comes out) · basket ·
// sting (a shock) · fan (the woven fan, every 0.9 s while fanning) · bulb (each string light flicking on) · coals (the
// glow catching) · buzz (the phone, every 1.2 s) · meow (Mực jumps) · rain (the storm, once at the start) · clink
// (a plate served, the lanyard hung) · moto (a motorbike squeezing past, once in an alley beat) · surf (soft waves on
// the beach, every 3.5 s).
// x: stage x of the source (the player pans by it). The caption chime and the stop's transition are the player's.
import { POSES } from './rig.js';

const STEP = 0.33;
const PAPER = ['postcard', 'page', 'flyer', 'notebook', 'lanternPage'];
const BULBS = 11;

const propOf = (k) => (k.prop !== undefined ? k.prop : POSES[k.pose]?.prop ?? null);
const inWin = (t, t0, t1) => t > t0 && t <= t1;
const GRID = 0.025;
/** Times where `pred` turns true, on a fixed 1/40 s grid inside (t0, t1] (any split of a beat finds the same ones). */
function edges(pred, t0, t1) {
  const out = [];
  for (let k = Math.max(1, Math.floor(t0 / GRID) + 1); k * GRID <= t1; k++) if (pred(k * GRID) && !pred((k - 1) * GRID)) out.push(k * GRID);
  return out;
}

/** Times k * every (from `start`) inside (t0, t1], before `end`. */
function ticks(start, end, every, t0, t1) {
  const out = [];
  for (let k = Math.max(0, Math.ceil((t0 - start) / every)); start + k * every <= Math.min(t1, end); k++) {
    const t = start + k * every;
    if (inWin(t, t0, t1)) out.push(t);
  }
  return out;
}

export function cuesBetween(B, t0, t1) {
  const cues = [];
  for (const { keys } of B.actors) {
    keys.forEach((k, i) => {
      const prev = keys[i - 1];
      // a key with `move` is the end of a walk: footsteps all the way from the previous key
      if (k.move && prev) for (const t of ticks(prev.t + 0.1, k.t, STEP, t0, t1)) cues.push({ name: 'step', x: prev.x + ((k.x - prev.x) * (t - prev.t)) / (k.t - prev.t), t });
      // the plate / the card lands a moment after the gesture: its own time decides the window
      if ((k.pose === 'serve' || k.pose === 'hang') && prev?.pose !== k.pose && inWin(k.t + 0.2, t0, t1)) cues.push({ name: 'clink', x: k.x, t: k.t + 0.2 });
      if (!inWin(k.t, t0, t1)) return;
      const prop = propOf(k), before = prev ? propOf(prev) : null;
      if (prop && prop !== before && PAPER.includes(prop)) cues.push({ name: 'paper', x: k.x, t: k.t });
      if (prop === 'basket' && before !== 'basket') cues.push({ name: 'basket', x: k.x, t: k.t });
      if (k.pose === 'shock' && prev?.pose !== 'shock') cues.push({ name: 'sting', x: k.x, t: k.t });
    });
    // the woven fan: a gust every 0.9 s while a key's pose is fanning (until the next key)
    keys.forEach((k, i) => {
      if (!POSES[k.pose]?.fanning) return;
      for (const t of ticks(k.t, keys[i + 1]?.t ?? B.length, 0.9, t0, t1)) cues.push({ name: 'fan', x: k.x, t });
    });
  }
  const s1 = B.scene(t1);
  // string lights: each bulb flicks on at lightsFrom + i * 0.09 s (scene.js bulb()); not at dawn
  if (s1.lightsFrom != null && !s1.dawn && !B.beach) {
    for (let i = 0; i < BULBS; i++) {
      const on = s1.lightsFrom + i * 0.09;
      if (inWin(on, t0, t1) && on >= 0) cues.push({ name: 'bulb', x: -10 + ((i + 0.5) / BULBS) * 420, t: on });
    }
  }
  for (const t of edges((u) => (B.scene(u).glow ?? 0) > 0.5, t0, t1)) cues.push({ name: 'coals', x: B.scene(t).cartX ?? 196, t });
  // the phone: buzzing while the scene says so, every 1.2 s from the beat's start
  for (const t of ticks(0, B.length, 1.2, t0, t1)) if (B.scene(t).phone === 'buzz') cues.push({ name: 'buzz', x: (B.scene(t).cartX ?? 196) - 30, t });
  // Mực's jump
  // Mực turns up mid-beat: a meow
  for (const t of edges((u) => B.cat(u) != null, t0, t1)) cues.push({ name: 'meow', x: B.cat(t).x, t });
  // the place: a motorbike passes once in the alley; soft surf on the beach
  if (!B.beach && B.length >= 7 && inWin(B.length * 0.45, t0, t1)) cues.push({ name: 'moto', x: 400, t: B.length * 0.45 });
  if (B.beach) for (const t of ticks(2, B.length, 3.5, t0, t1)) cues.push({ name: 'surf', x: 200, t });
  // the storm: rain over the whole beat
  if (t0 < 0 && t1 >= 0 && B.scene(0).storm) cues.push({ name: 'rain', x: 200, t: 0 });
  return cues.sort((a, b) => a.t - b.t);
}

/** Every cue of a beat, in order (tests, the sandbox). */
export const allCues = (B) => cuesBetween(B, -1, B.length);

/** Stereo pan -1..1 for a stage x seen through a camera at cam.x (about 200 units across). */
export const panFor = (x, camX) => Math.max(-1, Math.min(1, (x - camX) / 200));

