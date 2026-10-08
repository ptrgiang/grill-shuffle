// Replay viewer logic (#30): plays a recorded action list through the same Session + simulation as a live game, one
// action at a time, so the board animates with the normal BoardView.play path. No DOM, no three.js, no clock of its
// own (the timer is injected): Node tests drive it directly.
//
//   ?r=<actions>&h=<hash>   a run: compact actions joined by ',' (shared/moves.js), h = the final hash it claims
//   ?r=best                 the level's stored solver solution
//
// The whole list is checked first with shared/replay.js; an invalid replay is never played.
import { Session } from './session.js';
import { replay } from '../../shared/replay.js';
import { decodeActions, encodeActions } from '../../shared/moves.js';

/** Playback speeds the viewer cycles through (animation and step pace both scale). */
export const SPEEDS = Object.freeze([1, 2]);

const BEST = 'best';
const CHARS = /^[a-z0-9.:_,-]*$/;

/** The replay a URL asks for: { best: true } | { actions: string (space-separated), hash } | null. */
export function parseReplayParam(search) {
  const q = new URLSearchParams(search);
  const r = q.get('r');
  if (r === null) return null;
  if (r === BEST) return { best: true, hash: null };
  if (!CHARS.test(r) || r.length > 6000) return { actions: null, hash: null, malformed: true };
  return { actions: r.split(',').filter(Boolean).join(' '), hash: q.get('h') || null };
}

/** Query string (without '?') for a run: its actions and the final hash it should reach. */
export function replayQuery(actions, hash) {
  const list = typeof actions === 'string' ? actions : encodeActions(actions);
  return `r=${list.trim().split(/\s+/).join(',')}${hash ? `&h=${hash}` : ''}`;
}

/** Pause after an action before the next one, in seconds at 1x: longer when something to watch happened. */
export function stepDelay(events) {
  let d = 0.7;
  if (events.some((e) => e.type === 'match')) d += 0.55;
  if (events.some((e) => e.type === 'reveal' || e.type === 'unlock')) d += 0.3;
  if (events.some((e) => e.type === 'booster')) d += 0.35;
  return d;
}

export class ReplayPlayer {
  /**
   * @param level    the level the run was played on
   * @param request  parseReplayParam(...) result
   * @param hooks    { onStep(result, index), onEnd(state), onReset(state), schedule(fn, ms) -> id, cancel(id) }
   */
  constructor(level, request, hooks = {}) {
    this.level = level;
    this.hooks = hooks;
    this.schedule = hooks.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.cancel = hooks.cancel ?? ((id) => clearTimeout(id));
    this.expected = request?.hash ?? null;
    this.source = request?.best ? 'best' : 'run';
    const text = request?.best ? level.solver?.solution ?? null : request?.actions ?? null;
    let actions = null;
    try {
      actions = text === null ? null : decodeActions(text);
    } catch {
      actions = null;
    }
    this.actions = actions ?? [];
    // validate the whole run before showing any of it
    const check = actions && actions.length ? replay(level, actions) : null;
    this.valid = !!check?.ok;
    this.error = !actions ? (request?.best ? 'no stored solution for this level' : 'malformed replay') : !actions.length ? 'empty replay' : check.ok ? null : check.error;
    this.finalHash = check?.ok ? check.hash : null;
    // a claimed hash that the run does not reach: it diverged (other rules version, edited link)
    this.matches = this.expected ? this.finalHash === this.expected : null;
    if (this.valid && this.expected && !this.matches) {
      this.valid = false;
      this.error = 'the run does not reach the board it claims';
    }
    this.session = new Session(level);
    this.index = 0; // next action to play
    this.playing = false;
    this.speed = SPEEDS[0];
    this.timer = null;
  }

  get done() {
    return this.index >= this.actions.length;
  }

  get state() {
    return this.session.state;
  }

  /** Play one action. Returns the simulation result, or null at the end / when invalid. */
  step() {
    if (!this.valid || this.done) return null;
    const r = this.session.apply(this.actions[this.index]);
    if (!r.ok) {
      // replay() said it was legal: only a bug gets here; stop rather than show a wrong board
      this.valid = false;
      this.error = `action ${this.index}: ${r.reason}`;
      this.pause();
      return null;
    }
    this.index++;
    this.hooks.onStep?.(r, this.index - 1);
    if (this.done) {
      this.pause();
      this.hooks.onEnd?.(this.session.state);
    }
    return r;
  }

  play() {
    if (!this.valid) return;
    if (this.done) this.restart();
    this.playing = true;
    this.#next(0.35);
  }

  pause() {
    this.playing = false;
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Back to the starting board (keeps playing if it was). */
  restart() {
    const was = this.playing;
    this.pause();
    this.session.restart();
    this.index = 0;
    this.hooks.onReset?.(this.session.state);
    if (was) this.play();
  }

  /** Jump to the end: every remaining action at once; onReset gets the final board (no per-step animation). */
  skip() {
    if (!this.valid) return;
    this.pause();
    while (!this.done) {
      const r = this.session.apply(this.actions[this.index]);
      if (!r.ok) break;
      this.index++;
    }
    this.hooks.onReset?.(this.session.state);
    if (this.done) this.hooks.onEnd?.(this.session.state);
  }

  /** Next speed in SPEEDS (wraps). */
  cycleSpeed() {
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
    return this.speed;
  }

  dispose() {
    this.pause();
  }

  #next(seconds) {
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = this.schedule(() => {
      this.timer = null;
      if (!this.playing) return;
      const r = this.step();
      if (r && this.playing) this.#next(stepDelay(r.events));
    }, (seconds * 1000) / this.speed);
  }
}
