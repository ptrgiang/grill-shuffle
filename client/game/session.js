// A play session of one level: the authoritative state, the action log (replay / share / D1 results) and undo.
// No DOM, no three.js: this is the seam between input and the shared simulation.
import { createState } from '../../shared/state.js';
import { applyAction } from '../../shared/resolve.js';
import { getLegalMoves, canPick, canDrop, encodeActions } from '../../shared/moves.js';
import { hashState } from '../../shared/hash.js';
import { BOOSTERS, canUseBooster, boosterActions } from '../../shared/boosters.js';
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
    this.armed = null; // a targeted booster waiting for its target(s) on the board
    this.pendingGrill = null; // grill+grill boosters: the first grill tapped
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
      this.pendingGrill = null;
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

  /** Could `id` be used now? Targeted boosters: is there any target at all. */
  canUseBooster(id) {
    return this.state.status === 'playing' && this.charges(id) > 0 && boosterActions(this.state, id).length > 0;
  }

  /** What the armed booster asks for: 'from+to' | 'item' | 'grill' | 'grill+grill', or null when none is armed. */
  get armedNeeds() {
    return this.armed ? BOOSTERS[this.armed].needs : null;
  }

  /** Aim a targeted booster (the next tap(s) on the board use it), or disarm with null. Returns the armed id. */
  arm(id) {
    this.armed = id && BOOSTERS[id] && BOOSTERS[id].needs !== 'none' && this.canUseBooster(id) ? id : null;
    this.pendingGrill = null;
    return this.armed;
  }

  /**
   * A tap on the board while a tap-targeted booster (item / grill / grill+grill) is armed.
   * Returns { action } when the tap completes a legal use, { pending: [grills] } after the first of two grills
   * (the grills it can swap with), { cancel: true } when that first grill is tapped again, { invalid: true } else.
   */
  tapTarget(hit) {
    const id = this.armed;
    const needs = this.armedNeeds;
    if (!hit || !needs || needs === 'from+to') return { invalid: true };
    const legal = (a) => (canUseBooster(this.state, a) ? { action: a } : { invalid: true });
    if (needs === 'item') return legal({ type: 'booster', booster: id, from: { grill: hit.grill, slot: hit.slot } });
    if (needs === 'grill') return legal({ type: 'booster', booster: id, from: { grill: hit.grill } });
    // grill+grill: first tap picks a grill, the second its partner
    if (this.pendingGrill === null || this.pendingGrill === undefined) {
      const partners = boosterActions(this.state, id).flatMap((a) => (a.from.grill === hit.grill ? [a.to.grill] : a.to.grill === hit.grill ? [a.from.grill] : []));
      if (!partners.length) return { invalid: true };
      this.pendingGrill = hit.grill;
      return { pending: partners };
    }
    if (hit.grill === this.pendingGrill) {
      this.pendingGrill = null;
      return { cancel: true };
    }
    const r = legal({ type: 'booster', booster: id, from: { grill: this.pendingGrill }, to: { grill: hit.grill } });
    if (r.action) this.pendingGrill = null;
    return r;
  }

  /** Grills the armed tap-targeted booster could act on now (to light them up); [] for tongs / none armed. */
  boosterGrills() {
    if (!this.armed || this.armedNeeds === 'from+to') return [];
    const set = new Set();
    for (const a of boosterActions(this.state, this.armed)) {
      set.add(a.from.grill);
      if (a.to) set.add(a.to.grill);
    }
    return [...set].sort((a, b) => a - b);
  }

  /** Boosters used so far in this attempt, e.g. { tongs: 1 } (the result screen notes them; stars are unaffected). */
  boostersUsed() {
    const used = {};
    for (const a of this.actions) if (a.type === 'booster') used[a.booster] = (used[a.booster] ?? 0) + 1;
    return used;
  }

  /** The action a pick at `from` and a drop at `to` mean right now: a plain move, or the armed booster. */
  actionFor(from, to) {
    return this.armedNeeds === 'from+to' ? { type: 'booster', booster: this.armed, from, to } : { type: 'move', from, to };
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
    this.pendingGrill = null;
    return this.state;
  }

  // ---- questions the input layer asks (rules live in shared/, these only forward)
  canPick(grill, slot) {
    if (this.state.status !== 'playing') return false;
    // tongs reach any item, locked grills included
    if (this.armedNeeds === 'from+to') return !!this.state.grills[grill]?.slots[slot];
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
