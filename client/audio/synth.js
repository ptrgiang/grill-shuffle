// Procedural sound generators. Pure functions (no DOM / Web Audio): (sampleRate, ...) => Float32Array (mono),
// peak-normalised. The engine (audio.js) turns them into AudioBuffers once; Node can test them directly.
//
// Palette: warm and soft. Food thuds, hiss, crackle, glassy sparkles, a small two-note "order up" chime.
// No harsh casino sounds: nothing square-wave, nothing above ~0.9 peak, short tails.
import { mulberry32 } from '../../shared/rng.js';

const TAU = Math.PI * 2;

const buf = (sr, dur) => new Float32Array(Math.max(1, Math.floor(sr * dur)));

function normalize(a, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  if (m > 1e-9) for (let i = 0; i < a.length; i++) a[i] *= peak / m;
  return a;
}

/** Mix src into dst at time t (s) with gain g. */
function mix(dst, src, sr, t, g = 1) {
  const o = Math.floor(t * sr);
  for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * g;
  return dst;
}

/** One-pole low-pass / high-pass in place. */
function lowpass(a, sr, fc) {
  const k = 1 - Math.exp((-TAU * fc) / sr);
  let y = 0;
  for (let i = 0; i < a.length; i++) a[i] = y += k * (a[i] - y);
  return a;
}
function highpass(a, sr, fc) {
  const k = Math.exp((-TAU * fc) / sr);
  let x1 = 0, y = 0;
  for (let i = 0; i < a.length; i++) {
    y = k * (y + a[i] - x1);
    x1 = a[i];
    a[i] = y;
  }
  return a;
}

/** Pitch-dropping sine thump. */
export function thud(sr, f0 = 190, f1 = 70, dur = 0.16) {
  const a = buf(sr, dur);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / sr;
    ph += (f1 + (f0 - f1) * Math.exp(-t / 0.025)) / sr;
    a[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.045) * (1 - Math.exp(-t / 0.002));
  }
  return a;
}

/** Hiss: band-limited noise with a fast attack and a decay; crackle pops on top. */
export function sizzle(sr, dur = 0.5, seed = 1, { crackle = 0.5, bright = 1 } = {}) {
  const rng = mulberry32(seed);
  const a = buf(sr, dur);
  for (let i = 0; i < a.length; i++) a[i] = rng() * 2 - 1;
  highpass(a, sr, 2200 * bright);
  lowpass(a, sr, 9000);
  for (let i = 0; i < a.length; i++) {
    const t = i / sr;
    a[i] *= (1 - Math.exp(-t / 0.01)) * Math.exp(-t / (dur * 0.35)) * (0.75 + 0.25 * Math.sin(t * 90 + rng()));
  }
  const pops = Math.floor(dur * 40 * crackle);
  for (let k = 0; k < pops; k++) {
    const at = Math.floor(rng() * a.length * 0.8);
    const amp = (0.4 + rng() * 0.8) * Math.exp(-(at / sr) / (dur * 0.4));
    for (let j = 0; j < 30 && at + j < a.length; j++) a[at + j] += (rng() * 2 - 1) * amp * Math.exp(-j / 6);
  }
  return normalize(a, 0.8);
}

/** Glassy sparkle: a few short high sine pings. */
export function sparkle(sr, seed = 1, n = 5, dur = 0.5) {
  const rng = mulberry32(seed);
  const a = buf(sr, dur);
  for (let k = 0; k < n; k++) {
    const f = 2600 + rng() * 3200, t0 = rng() * dur * 0.5;
    const o = Math.floor(t0 * sr);
    for (let i = 0; o + i < a.length; i++) {
      const t = i / sr;
      a[o + i] += Math.sin(TAU * f * t) * Math.exp(-t / 0.05) * (0.5 + rng() * 0.0);
    }
  }
  return normalize(a, 0.6);
}

/** Soft bell / marimba-ish note: sine + a couple of decaying partials. */
export function note(sr, f, dur = 0.5, { bright = 0.35, decay = 0.18 } = {}) {
  const a = buf(sr, dur);
  for (let i = 0; i < a.length; i++) {
    const t = i / sr;
    const env = (1 - Math.exp(-t / 0.003)) * Math.exp(-t / decay);
    a[i] = env * (Math.sin(TAU * f * t) + bright * Math.sin(TAU * f * 2.01 * t) * Math.exp(-t / 0.06) + bright * 0.4 * Math.sin(TAU * f * 3.98 * t) * Math.exp(-t / 0.03));
  }
  return normalize(a, 0.8);
}

const NOTE = (semis) => 523.25 * Math.pow(2, semis / 12); // relative to C5

/** UI select / pick-up: a soft wooden tick. */
export function selectSound(sr) {
  const a = buf(sr, 0.09);
  mix(a, note(sr, 880, 0.08, { bright: 0.2, decay: 0.02 }), sr, 0, 0.6);
  mix(a, thud(sr, 420, 200, 0.06), sr, 0, 0.5);
  return normalize(a, 0.55);
}

/** Food landing on the grate: thud + a short hiss. */
export function landSound(sr, seed = 1) {
  const a = buf(sr, 0.42);
  mix(a, thud(sr, 210, 80, 0.15), sr, 0, 0.9);
  mix(a, sizzle(sr, 0.4, seed, { crackle: 0.3 }), sr, 0.01, 0.35);
  return normalize(a, 0.7);
}

/** Can't go there: two low muted bumps. */
export function invalidSound(sr) {
  const a = buf(sr, 0.22);
  mix(a, note(sr, 196, 0.1, { bright: 0.05, decay: 0.03 }), sr, 0, 0.6);
  mix(a, note(sr, 174.6, 0.1, { bright: 0.05, decay: 0.03 }), sr, 0.09, 0.5);
  lowpass(a, sr, 1200);
  return normalize(a, 0.45);
}

/**
 * The match: food impact + sizzle burst + sparks + a two-note serve chime. Energy rises with the combo:
 * x1 basic; x2 adds a layer (fuller sizzle, octave under the chime); x3 brighter chime; x4+ a small flourish.
 */
export function matchSound(sr, combo = 1, seed = 1) {
  const c = Math.max(1, Math.min(6, combo));
  const a = buf(sr, 1.05);
  mix(a, thud(sr, 160, 60, 0.2), sr, 0, 0.8);
  mix(a, sizzle(sr, 0.75, seed, { crackle: 0.9, bright: 0.9 }), sr, 0.02, 0.55 + (c >= 2 ? 0.15 : 0));
  mix(a, sparkle(sr, seed + 7, 3 + c, 0.45), sr, 0.04, 0.22 + 0.04 * c);
  const step = [0, 2, 4, 7, 9, 12][c - 1];
  const t0 = 0.12;
  mix(a, note(sr, NOTE(4 + step), 0.5, { bright: c >= 3 ? 0.6 : 0.35 }), sr, t0, 0.42);
  mix(a, note(sr, NOTE(11 + step), 0.6, { bright: c >= 3 ? 0.6 : 0.35 }), sr, t0 + 0.085, 0.42);
  if (c >= 2) mix(a, note(sr, NOTE(-8 + step), 0.5, { bright: 0.1, decay: 0.2 }), sr, t0, 0.22);
  if (c >= 4) for (let k = 0; k < 3; k++) mix(a, note(sr, NOTE(16 + step + k * 3), 0.25, { bright: 0.4, decay: 0.07 }), sr, t0 + 0.2 + k * 0.05, 0.18);
  return normalize(a, 0.85);
}

/** Lock opening: metallic clank (inharmonic partials) + a rising chime. */
export function unlockSound(sr) {
  const a = buf(sr, 0.8);
  const partials = [523, 1187, 1693, 2453, 3120];
  const clank = buf(sr, 0.35);
  for (let i = 0; i < clank.length; i++) {
    const t = i / sr;
    let s = 0;
    partials.forEach((f, k) => (s += Math.sin(TAU * f * t) * Math.exp(-t / (0.09 / (1 + k * 0.4))) / (1 + k)));
    clank[i] = s * (1 - Math.exp(-t / 0.001));
  }
  mix(a, clank, sr, 0, 0.6);
  mix(a, note(sr, NOTE(7), 0.4), sr, 0.12, 0.35);
  mix(a, note(sr, NOTE(12), 0.5), sr, 0.2, 0.35);
  return normalize(a, 0.75);
}

/** Stacked tray flipping up: a soft whoosh + pop. */
export function revealSound(sr, seed = 3) {
  const rng = mulberry32(seed);
  const a = buf(sr, 0.4);
  const w = buf(sr, 0.3);
  for (let i = 0; i < w.length; i++) w[i] = rng() * 2 - 1;
  lowpass(w, sr, 1800);
  for (let i = 0; i < w.length; i++) {
    const t = i / w.length;
    w[i] *= Math.sin(Math.PI * t) * 0.8;
  }
  mix(a, w, sr, 0, 0.6);
  mix(a, thud(sr, 320, 160, 0.08), sr, 0.22, 0.6);
  return normalize(a, 0.6);
}

/** Level complete: warm arpeggio over a sizzle swell. */
export function completeSound(sr) {
  const a = buf(sr, 1.6);
  [0, 4, 7, 12, 16].forEach((s, i) => mix(a, note(sr, NOTE(s), 0.7, { bright: 0.45, decay: 0.25 }), sr, i * 0.09, 0.4));
  mix(a, note(sr, NOTE(-12), 1.2, { bright: 0.1, decay: 0.5 }), sr, 0.36, 0.25);
  mix(a, sizzle(sr, 1.2, 9, { crackle: 0.7 }), sr, 0.1, 0.12);
  return normalize(a, 0.8);
}

export function failSound(sr) {
  const a = buf(sr, 0.9);
  mix(a, note(sr, NOTE(-5), 0.5, { bright: 0.15, decay: 0.2 }), sr, 0, 0.4);
  mix(a, note(sr, NOTE(-9), 0.7, { bright: 0.15, decay: 0.28 }), sr, 0.18, 0.4);
  lowpass(a, sr, 2400);
  return normalize(a, 0.55);
}

export function buttonSound(sr) {
  return normalize(note(sr, 660, 0.07, { bright: 0.15, decay: 0.02 }), 0.4);
}

/** Fan booster: a soft swell of low air noise that rises and falls (no hiss crackle). */
export function gustSound(sr, seed = 9) {
  const dur = 0.75;
  const rng = mulberry32(seed);
  const a = buf(sr, dur);
  for (let i = 0; i < a.length; i++) a[i] = rng() * 2 - 1;
  lowpass(a, sr, 1400);
  highpass(a, sr, 180);
  for (let i = 0; i < a.length; i++) {
    const t = i / sr;
    a[i] *= Math.sin((Math.PI * t) / dur) ** 2 * (0.8 + 0.2 * Math.sin(t * 23));
  }
  return normalize(a, 0.6);
}

/** Torch booster: a lit burner (soft low roar swelling in), crackle on top. */
export function torchSound(sr, seed = 13) {
  const dur = 0.6;
  const rng = mulberry32(seed);
  const a = buf(sr, dur);
  for (let i = 0; i < a.length; i++) a[i] = rng() * 2 - 1;
  lowpass(a, sr, 900);
  for (let i = 0; i < a.length; i++) {
    const t = i / sr;
    a[i] *= (1 - Math.exp(-t / 0.08)) * Math.exp(-t / 0.3);
  }
  mix(a, sizzle(sr, 0.5, seed, { crackle: 0.9, bright: 0.8 }), sr, 0.05, 0.4);
  return normalize(a, 0.6);
}

/** Cooler booster: an icy sparkle over a short, fading hiss. */
export function coolerSound(sr) {
  const a = buf(sr, 0.6);
  mix(a, sparkle(sr, 21, 6, 0.55), sr, 0, 0.7);
  mix(a, sizzle(sr, 0.45, 5, { crackle: 0, bright: 1.6 }), sr, 0, 0.25);
  return normalize(a, 0.5);
}

/** Tray swap booster: two quick wooden slides (one per grill). */
export function swapSound(sr) {
  const a = buf(sr, 0.3);
  mix(a, thud(sr, 300, 160, 0.09), sr, 0, 0.6);
  mix(a, thud(sr, 240, 120, 0.09), sr, 0.1, 0.6);
  mix(a, sizzle(sr, 0.25, 8, { crackle: 0, bright: 0.5 }), sr, 0, 0.15);
  return normalize(a, 0.5);
}

/** Tongs booster: two light metal clicks (the tongs closing), then the item lifts. */
export function tongsSound(sr) {
  const a = buf(sr, 0.2);
  mix(a, note(sr, 1760, 0.06, { bright: 0.5, decay: 0.012 }), sr, 0, 0.5);
  mix(a, note(sr, 2093, 0.06, { bright: 0.5, decay: 0.012 }), sr, 0.06, 0.45);
  mix(a, thud(sr, 380, 180, 0.07), sr, 0.06, 0.3);
  return normalize(a, 0.5);
}

/**
 * Seamless grill ambience: steady high hiss, slow crackle, warm rumble. Params come from the theme's `ambience`
 * (hiss level, rumble level, crackle pops per second, noise seed); the defaults are Street BBQ.
 */
export function ambienceLoop(sr, { hiss = 0.14, rumble: rumbleLevel = 2.2, crackle = 7, seed = 21 } = {}, dur = 6) {
  const rng = mulberry32(seed);
  const n = Math.floor(sr * dur);
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = rng() * 2 - 1;
  highpass(a, sr, 3000);
  lowpass(a, sr, 8000);
  for (let i = 0; i < n; i++) a[i] *= hiss * (0.8 + 0.2 * Math.sin((TAU * i) / n * 3));
  const rumble = new Float32Array(n);
  for (let i = 0; i < n; i++) rumble[i] = rng() * 2 - 1;
  lowpass(rumble, sr, 120);
  lowpass(rumble, sr, 120);
  for (let i = 0; i < n; i++) a[i] += rumble[i] * rumbleLevel;
  const pops = Math.floor(dur * crackle);
  for (let k = 0; k < pops; k++) {
    const at = Math.floor(rng() * n);
    const amp = 0.15 + rng() * 0.45;
    const len = 20 + Math.floor(rng() * 60);
    for (let j = 0; j < len; j++) a[(at + j) % n] += (rng() * 2 - 1) * amp * Math.exp(-j / (len / 4));
  }
  // crossfade the ends so the loop has no click
  const xf = Math.floor(sr * 0.25);
  for (let i = 0; i < xf; i++) {
    const t = i / xf;
    a[i] = a[i] * t + a[n - xf + i] * (1 - t);
  }
  return normalize(a.subarray(0, n - xf), 0.6);
}

// ---- story beats (#113): motion you can hear, no voice-over. Same palette: soft, warm, short.

const noise = (sr, dur, seed) => {
  const rng = mulberry32(seed);
  const a = buf(sr, dur);
  for (let i = 0; i < a.length; i++) a[i] = rng() * 2 - 1;
  return a;
};

/** A footstep on the alley's concrete / the sand: a muffled thump with a little grit. */
export function stepSound(sr, seed = 1) {
  const a = buf(sr, 0.12);
  mix(a, thud(sr, 150 + seed * 7, 60, 0.1), sr, 0, 0.7);
  const g = lowpass(noise(sr, 0.05, 40 + seed), sr, 900);
  for (let i = 0; i < g.length; i++) g[i] *= Math.exp(-i / sr / 0.012);
  mix(a, g, sr, 0.002, 0.5);
  return normalize(a, 0.5);
}

/** Paper coming out: a postcard, a page, the flyer: a few dry rustles. */
export function paperSound(sr, seed = 5) {
  const rng = mulberry32(seed);
  const dur = 0.42;
  const a = highpass(noise(sr, dur, seed), sr, 1800);
  lowpass(a, sr, 7000);
  const bursts = [0, 0.09, 0.2, 0.3].map((t) => t + rng() * 0.03);
  for (let i = 0; i < a.length; i++) {
    const t = i / sr;
    let env = 0;
    for (const b of bursts) if (t >= b) env += Math.exp(-(t - b) / 0.035) * (1 - Math.exp(-(t - b) / 0.003));
    a[i] *= env;
  }
  return normalize(a, 0.45);
}

/** The phone vibrating on the cart: two low hums with a rattle. */
export function buzzSound(sr) {
  const dur = 0.62;
  const a = buf(sr, dur);
  for (let i = 0; i < a.length; i++) {
    const t = i / sr;
    const on = (t < 0.24 || (t > 0.34 && t < 0.58)) ? 1 : 0;
    const gate = on * (1 - Math.exp(-((t < 0.3 ? t : t - 0.34)) / 0.01));
    a[i] = gate * (Math.sin(TAU * 155 * t) + 0.35 * Math.sin(TAU * 310 * t) + 0.15 * Math.sin(TAU * 465 * t)) * (0.8 + 0.2 * Math.sin(TAU * 31 * t));
  }
  return normalize(lowpass(a, sr, 1600), 0.5);
}

/** A string-light bulb flicking on: a tiny glassy tick and a short filament ring. */
export function bulbSound(sr, seed = 2) {
  const a = buf(sr, 0.16);
  mix(a, note(sr, 2300 + seed * 140, 0.12, { bright: 0.1, decay: 0.025 }), sr, 0, 0.6);
  const c = highpass(noise(sr, 0.01, seed), sr, 3000);
  mix(a, c, sr, 0, 0.5);
  return normalize(a, 0.35);
}

/** The coals catching under the fan: a sizzle that swells. */
export function coalsSound(sr, seed = 17) {
  const s = sizzle(sr, 1.3, seed, { crackle: 0.9, bright: 0.8 });
  for (let i = 0; i < s.length; i++) {
    const t = i / sr;
    s[i] *= Math.min(1, t / 0.35);
  }
  return normalize(s, 0.6);
}

/** A wave washing in (Fishing Village transition): low noise swelling and drawing back, with foam. */
export function waveSound(sr, seed = 23) {
  const dur = 1.6;
  const a = lowpass(noise(sr, dur, seed), sr, 700);
  const foam = highpass(noise(sr, dur, seed + 1), sr, 2500);
  for (let i = 0; i < a.length; i++) {
    const t = i / sr;
    const env = Math.sin(Math.PI * Math.min(1, t / dur)) ** 1.5;
    a[i] = a[i] * env + foam[i] * 0.25 * Math.max(0, Math.sin(Math.PI * Math.min(1, (t - 0.4) / 0.9))) ** 2;
  }
  return normalize(a, 0.6);
}

/** Rain on the beach for the whole storm: steady hiss, drops on top, fading in and out. */
export function rainSound(sr, seed = 29, dur = 8) {
  const rng = mulberry32(seed);
  const a = lowpass(highpass(noise(sr, dur, seed), sr, 900), sr, 6000);
  for (let i = 0; i < a.length; i++) {
    const t = i / sr;
    a[i] *= 0.45 * Math.min(1, t / 0.8, (dur - t) / 0.8);
  }
  for (let k = 0; k < dur * 35; k++) {
    const at = Math.floor(rng() * a.length);
    const f = 1800 + rng() * 2500;
    for (let j = 0; j < sr * 0.02 && at + j < a.length; j++) a[at + j] += Math.sin(TAU * f * j / sr) * Math.exp(-j / sr / 0.004) * 0.4;
  }
  return normalize(a, 0.55);
}

/** Mực: a short meow (a harmonic voice gliding up and down). */
export function meowSound(sr) {
  const dur = 0.55;
  const a = buf(sr, dur);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / sr, k = t / dur;
    const f0 = 520 + 260 * Math.sin(Math.PI * Math.min(1, k * 1.4)) - 120 * k;
    ph += f0 / sr;
    const env = Math.min(1, t / 0.04) * Math.exp(-Math.max(0, t - 0.25) / 0.12);
    const open = 0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, k * 1.2)); // the mouth opens: brighter
    let v = 0;
    for (let h = 1; h <= 6; h++) v += Math.sin(TAU * ph * h) / h ** (2 - open);
    a[i] = v * env;
  }
  return normalize(lowpass(a, sr, 3500), 0.45);
}

/** The caption card: a soft two-note chime (the start of Bà Năm's motif to come, #85). */
export function chimeSound(sr) {
  const a = buf(sr, 0.9);
  mix(a, note(sr, NOTE(7), 0.6, { bright: 0.2, decay: 0.3 }), sr, 0, 0.5);
  mix(a, note(sr, NOTE(12), 0.6, { bright: 0.2, decay: 0.35 }), sr, 0.16, 0.45);
  return normalize(a, 0.4);
}

/** A shock (the flyer, the notice): a plucked note bending up, đàn bầu spirit. */
export function stingSound(sr) {
  const dur = 0.7;
  const a = buf(sr, dur);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / sr;
    const f = 330 * Math.pow(2, Math.min(1, t / 0.25) * 5 / 12);
    ph += f / sr;
    a[i] = Math.exp(-t / 0.22) * (1 - Math.exp(-t / 0.002)) * (Math.sin(TAU * ph) + 0.3 * Math.sin(TAU * ph * 2) * Math.exp(-t / 0.08));
  }
  return normalize(a, 0.45);
}

/** A basket of fish set down / handed over: a wicker creak and a soft thump. */
export function basketSound(sr, seed = 31) {
  const a = buf(sr, 0.3);
  mix(a, thud(sr, 120, 55, 0.18), sr, 0.02, 0.6);
  const c = lowpass(highpass(noise(sr, 0.12, seed), sr, 1200), sr, 4000);
  for (let i = 0; i < c.length; i++) c[i] *= Math.exp(-i / sr / 0.03) * (0.6 + 0.4 * Math.sin(i / sr * 400));
  mix(a, c, sr, 0, 0.5);
  return normalize(a, 0.5);
}

/** A plate set down / the lanyard's card on the nail: a small ceramic clink. */
export function clinkSound(sr, seed = 0) {
  const a = buf(sr, 0.3);
  mix(a, note(sr, 1480 + seed * 90, 0.28, { bright: 0.5, decay: 0.07 }), sr, 0, 0.6);
  mix(a, note(sr, 2210 + seed * 60, 0.2, { bright: 0.2, decay: 0.04 }), sr, 0.004, 0.35);
  return normalize(a, 0.4);
}

/** A motorbike squeezing past the alley: a soft engine hum rising and falling as it passes (no harsh edges). */
export function motoSound(sr, seed = 37) {
  const dur = 2.4;
  const rng = mulberry32(seed);
  const a = buf(sr, dur);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / sr, k = t / dur;
    const f = 78 + 22 * Math.tanh((0.5 - k) * 6); // higher coming, lower going (Doppler)
    ph += f / sr;
    let v = 0;
    for (let h = 1; h <= 7; h++) v += Math.sin(TAU * ph * h + h) / h;
    a[i] = (v + (rng() * 2 - 1) * 0.25) * Math.exp(-(((k - 0.5) / 0.22) ** 2));
  }
  return normalize(lowpass(a, sr, 1200), 0.45);
}

/** Registry: name -> (sampleRate, variant) => Float32Array. */
export const SOUNDS = {
  select: (sr) => selectSound(sr),
  land: (sr, v = 0) => landSound(sr, 11 + v),
  invalid: (sr) => invalidSound(sr),
  match1: (sr) => matchSound(sr, 1, 3),
  match2: (sr) => matchSound(sr, 2, 4),
  match3: (sr) => matchSound(sr, 3, 5),
  match4: (sr) => matchSound(sr, 4, 6),
  match5: (sr) => matchSound(sr, 5, 7),
  unlock: (sr) => unlockSound(sr),
  reveal: (sr) => revealSound(sr),
  complete: (sr) => completeSound(sr),
  fail: (sr) => failSound(sr),
  button: (sr) => buttonSound(sr),
  gust: (sr) => gustSound(sr),
  tongs: (sr) => tongsSound(sr),
  torch: (sr) => torchSound(sr),
  cooler: (sr) => coolerSound(sr),
  swap: (sr) => swapSound(sr),
  ambience: (sr, params) => ambienceLoop(sr, params ?? undefined),
  story_step: (sr, v = 0) => stepSound(sr, 1 + v),
  story_paper: (sr, v = 0) => paperSound(sr, 5 + v),
  story_buzz: (sr) => buzzSound(sr),
  story_bulb: (sr, v = 0) => bulbSound(sr, 2 + v),
  story_fan: (sr) => gustSound(sr, 41),
  story_coals: (sr) => coalsSound(sr),
  story_wave: (sr) => waveSound(sr),
  story_rain: (sr) => rainSound(sr),
  story_meow: (sr) => meowSound(sr),
  story_chime: (sr) => chimeSound(sr),
  story_sting: (sr) => stingSound(sr),
  story_basket: (sr) => basketSound(sr),
  story_clink: (sr, v = 0) => clinkSound(sr, v),
  story_moto: (sr) => motoSound(sr),
  story_surf: (sr) => waveSound(sr, 47),
};
