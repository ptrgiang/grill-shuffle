// A play session of one level: the authoritative state, the action log (replay / share / D1 results) and undo.
// No DOM, no three.js: this is the seam between input and the shared simulation.
import { createState } from '../../shared/state.js';
import { applyAction } from '../../shared/resolve.js';
import { getLegalMoves, canPick, canDrop, encodeActions } from '../../shared/moves.js';
import { hashState } from '../../shared/hash.js';
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
    }
    return r;
  }

  canUndo() {
    return this.history.length > 0;
  }

  undo() {
    if (!this.history.length) return null;
    this.state = this.history.pop();
    this.actions.pop();
    this.undos++;
    return this.state;
  }

  // ---- questions the input layer asks (rules live in shared/, these only forward)
  canPick(grill, slot) {
    return this.state.status === 'playing' && canPick(this.state, grill, slot);
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
