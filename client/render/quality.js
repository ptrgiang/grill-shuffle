// Rendering quality: tiers, the frame-time monitor that steps them down, and the idle gate that renders a still
// board at a low tick. Pure (no three.js, no DOM): the stage applies a tier, main.js wires the loop.

/**
 * pixelRatio: cap on devicePixelRatio. shadows: 'pcf' with a `shadowMap`² map | 'off' (items get blob shadows).
 * (BasicShadowMap was tried for medium: jagged, hairy edges on the grill shadows at 512, so medium is PCF at 512.)
 * ember: 1 = two animated texture layers + flicker, 0 = one static layer. particles: multiplier on spawn counts.
 */
export const TIERS = Object.freeze({
  high: Object.freeze({ pixelRatio: 2, shadows: 'pcf', shadowMap: 1024, ember: 1, particles: 1 }),
  medium: Object.freeze({ pixelRatio: 1.5, shadows: 'pcf', shadowMap: 512, ember: 1, particles: 0.6 }),
  low: Object.freeze({ pixelRatio: 1, shadows: 'off', shadowMap: 0, ember: 0, particles: 0.35 }),
});
export const TIER_ORDER = Object.freeze(['high', 'medium', 'low']);
export const QUALITY_SETTINGS = Object.freeze(['auto', ...TIER_ORDER]);

export const lowerTier = (tier) => TIER_ORDER[Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(tier) + 1)];

/**
 * The tier to start with. `setting`: 'auto' | a tier name (manual override wins). `autoTier`: what auto mode settled
 * on last time on this device. Without history, small devices (≤ 2 GB or ≤ 4 cores, where the browser tells) start
 * at medium.
 */
export function initialTier({ setting = 'auto', autoTier = null, deviceMemory, cores } = {}) {
  if (TIERS[setting]) return setting;
  if (TIERS[autoTier]) return autoTier;
  if ((deviceMemory && deviceMemory <= 2) || (cores && cores <= 4)) return 'medium';
  return 'high';
}

/**
 * Average frame time over a sliding window of busy frames. `add(ms)` returns true when the average has stayed over
 * `limitMs` for `windowMs` worth of frames: time to step down a tier. Frames longer than `ignoreMs` (tab switch,
 * GC hiccup, first shader compile) are not counted. After a trigger it starts over, so each step gets a fresh window.
 */
export class FrameMonitor {
  constructor({ limitMs = 20, windowMs = 2000, ignoreMs = 250 } = {}) {
    Object.assign(this, { limitMs, windowMs, ignoreMs });
    this.reset();
  }

  reset() {
    this.frames = [];
    this.total = 0;
  }

  add(ms) {
    if (!(ms > 0) || ms > this.ignoreMs) return false;
    this.frames.push(ms);
    this.total += ms;
    while (this.total - this.frames[0] >= this.windowMs) this.total -= this.frames.shift();
    if (this.total < this.windowMs) return false;
    const slow = this.total / this.frames.length > this.limitMs;
    if (slow) this.reset();
    return slow;
  }

  /** Average of the frames in the window (ms), 0 when empty. */
  get average() {
    return this.frames.length ? this.total / this.frames.length : 0;
  }
}

/**
 * Render on demand: while something moves (busy), every frame; when the board is still, one frame per
 * `idleInterval` seconds (embers and bulbs keep flickering, the GPU mostly sleeps). Busy holds for `holdS` after
 * the last busy frame so a fade's last steps are smooth.
 */
export class IdleGate {
  constructor({ idleFps = 12, holdS = 0.6 } = {}) {
    this.idleInterval = 1 / idleFps;
    this.holdS = holdS;
    this.pending = 0; // seconds since the last rendered frame
    this.quietFor = Infinity;
  }

  /** dt since the previous rAF; `busy` = something animates. Returns the dt to render with, or 0 to skip. */
  tick(dt, busy) {
    this.pending += dt;
    this.quietFor = busy ? 0 : this.quietFor + dt;
    if (this.active || this.pending >= this.idleInterval) {
      const step = this.pending;
      this.pending = 0;
      return step;
    }
    return 0;
  }

  get active() {
    return this.quietFor < this.holdS;
  }

  /** Something outside the view changed (input, resize, modal): render the next frame. */
  wake() {
    this.quietFor = 0;
  }
}
