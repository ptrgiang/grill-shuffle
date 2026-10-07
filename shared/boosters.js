// Boosters: deterministic actions with their own command shape
//   { type: 'booster', booster: 'tongs', from: { grill, slot }, to: { grill, slot } }
//   { type: 'booster', booster: 'fan' }
// A booster never costs a move, consumes one charge from state.boosters, and its result is resolved like a move's
// (matches, reveals, unlocks). Randomness (the fan) is seeded from the state's own hash, so a replay reproduces it.
//
// tongs - lift one item off a LOCKED grill (or a normal one) onto any empty slot of an unlocked grill.
// fan   - blows the food around: every item on the unlocked grills is redistributed over the same occupied slots.

import { canDrop } from './moves.js';
import { mulberry32, cyrb53 } from './rng.js';
import { canonicalKey } from './hash.js';

export const BOOSTERS = Object.freeze({
  tongs: { id: 'tongs', name: 'Tongs', needs: 'from+to' },
  fan: { id: 'fan', name: 'Fan', needs: 'none' },
});

export function canUseBooster(state, action) {
  if (state.status !== 'playing') return false;
  const def = BOOSTERS[action?.booster];
  if (!def || (state.boosters[action.booster] ?? 0) <= 0) return false;
  if (action.booster === 'tongs') {
    const { from, to } = action;
    if (!from || !to || from.grill === to.grill) return false;
    const src = state.grills[from.grill];
    return !!src && !!src.slots[from.slot] && canDrop(state, to.grill, to.slot);
  }
  if (action.booster === 'fan') {
    const open = state.grills.filter((g) => g.lock === 0);
    return open.reduce((n, g) => n + g.slots.filter(Boolean).length, 0) >= 2;
  }
  return false;
}

/** Can any booster charge be used at all right now? (decides whether a board with no legal move is lost) */
export function hasUsableBooster(state) {
  if ((state.boosters.fan ?? 0) > 0 && canUseBooster(state, { type: 'booster', booster: 'fan' })) return true;
  if ((state.boosters.tongs ?? 0) > 0) {
    const room = state.grills.map((g) => g.lock === 0 && g.slots.includes(null));
    return state.grills.some((g, gi) => g.slots.some(Boolean) && room.some((r, ti) => r && ti !== gi));
  }
  return false;
}

/**
 * Apply the booster's effect to a state the caller already cloned. Mutates; returns its events.
 * Resolution (matches etc.) is the caller's job (resolve.js applyAction).
 */
export function applyBoosterEffect(state, action) {
  state.boosters[action.booster] -= 1;
  const events = [{ type: 'booster', booster: action.booster }];
  if (action.booster === 'tongs') {
    const { from, to } = action;
    const item = state.grills[from.grill].slots[from.slot];
    state.grills[from.grill].slots[from.slot] = null;
    state.grills[to.grill].slots[to.slot] = item;
    events.push({ type: 'move', itemId: item.id, food: item.food, from, to, booster: 'tongs' });
  } else if (action.booster === 'fan') {
    const rng = mulberry32(cyrb53(canonicalKey(state)) >>> 0);
    const places = [];
    state.grills.forEach((g, gi) => g.lock === 0 && g.slots.forEach((it, si) => it && places.push({ grill: gi, slot: si, item: it })));
    const items = rng.shuffle(places.map((p) => p.item));
    places.forEach((p, i) => {
      state.grills[p.grill].slots[p.slot] = items[i];
      if (items[i] !== p.item) events.push({ type: 'move', itemId: items[i].id, food: items[i].food, to: { grill: p.grill, slot: p.slot }, booster: 'fan' });
    });
  }
  return events;
}
