// A play session of one level: the authoritative state, the action log (replay / share / D1 results) and undo.
// No DOM, no three.js: this is the seam between input and the shared simulation.
import { createState } from '../../shared/state.js';
import { applyAction } from '../../shared/resolve.js';
import { getLegalMoves, canPick, canDrop, encodeActions } from '../../shared/moves.js';
import { hashState } from '../../shared/hash.js';
import { BOOSTERS, canUseBooster } from '../../shared/boosters.js';
import { starsFor } from '../../shared/progression.js';

export class Session {
  constructor(level) {
    this.level = level;
    this.restart();
  }

  restart() {
    this.state = createState(this.level);
    this.history = []; // previous states, for undo
    this.actions = []; // applied actions, in order
    this.undos = 0;
    this.hints = 0;
    this.armed = null; // a targeted booster ('tongs') waiting for its pick and drop
  }

  get status() {
    return this.state.status;
  }

  /** Apply an action. Returns the simulation result ({ ok, state, events }) and records it. */
  apply(action) {
    const r = applyAction(this.state, action);
    if (r.ok) {
      this.history.push(this.state);
      this.actions.push(action);
      this.state = r.state;
      this.armed = null;
    }
    return r;
  }

  // ---- boosters (rules in shared/boosters.js; this only tracks which one the player is aiming)

  /** Boosters this level offers (charges at the start), in BOOSTERS order. */
  boosterIds() {
    return Object.keys(BOOSTERS).filter((id) => (this.level.boosters?.[id] ?? 0) > 0);
  }

  charges(id) {
    return this.state.boosters[id] ?? 0;
  }

  /** Could `id` be used now? Targeted boosters: is there any pick + drop at all. */
  canUseBooster(id) {
    if (this.state.status !== 'playing' || this.charges(id) <= 0) return false;
    if (BOOSTERS[id]?.needs === 'none') return canUseBooster(this.state, { type: 'booster', booster: id });
    const st = this.state;
    return st.grills.some((g, gi) => g.slots.some(Boolean) && st.grills.some((_, ti) => ti !== gi && st.grills[ti].slots.some((__, s) => canDrop(st, ti, s))));
  }

  /** Aim a targeted booster (the next pick + drop uses it), or disarm with null. Returns the armed id. */
  arm(id) {
    this.armed = id && BOOSTERS[id]?.needs === 'from+to' && this.canUseBooster(id) ? id : null;
    return this.armed;
  }

  /** Boosters used so far in this attempt, e.g. { tongs: 1 } (the result screen notes them; stars are unaffected). */
  boostersUsed() {
    const used = {};
    for (const a of this.actions) if (a.type === 'booster') used[a.booster] = (used[a.booster] ?? 0) + 1;
    return used;
  }

  /** The action a pick at `from` and a drop at `to` mean right now: a plain move, or the armed booster. */
  actionFor(from, to) {
    return this.armed ? { type: 'booster', booster: this.armed, from, to } : { type: 'move', from, to };
  }

  canUndo() {
    return this.history.length > 0;
  }

  undo() {
    if (!this.history.length) return null;
    this.state = this.history.pop();
    this.actions.pop();
    this.undos++;
    this.armed = null;
    return this.state;
  }

  // ---- questions the input layer asks (rules live in shared/, these only forward)
  canPick(grill, slot) {
    if (this.state.status !== 'playing') return false;
    // tongs reach any item, locked grills included
    if (this.armed) return !!this.state.grills[grill]?.slots[slot];
    return canPick(this.state, grill, slot);
  }

  /** Grills an item at `from` could be moved to. */
  targetsFor(from) {
    return this.state.grills.map((g, i) => i).filter((i) => i !== from.grill && this.state.grills[i].slots.some((_, s) => canDrop(this.state, i, s)));
  }

  /** The best empty slot on `grill` for a drop aimed at `slot` (the aimed one if free, else the nearest free one). */
  dropSlot(grill, slot) {
    const g = this.state.grills[grill];
    if (!g) return -1;
    if (canDrop(this.state, grill, slot)) return slot;
    let best = -1;
    g.slots.forEach((_, s) => {
      if (canDrop(this.state, grill, s) && (best < 0 || Math.abs(s - slot) < Math.abs(best - slot))) best = s;
    });
    return best;
  }

  legalMoves() {
    return getLegalMoves(this.state);
  }

  replayString() {
    return encodeActions(this.actions);
  }

  finalHash() {
    return hashState(this.state);
  }

  stars() {
    return starsFor(this.state.movesUsed, this.level.solver?.minMoves, this.state.status === 'won');
  }
}
