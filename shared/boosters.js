// Boosters: deterministic actions with their own command shape
//   { type: 'booster', booster: 'tongs', from: { grill, slot }, to: { grill, slot } }
//   { type: 'booster', booster: 'fan' }
//   { type: 'booster', booster: 'torch', from: { grill, slot } }
//   { type: 'booster', booster: 'tray_swap', from: { grill }, to: { grill } }
//   { type: 'booster', booster: 'cooler', from: { grill } }
// A booster never costs a move, consumes one charge from state.boosters, and its result is resolved like a move's
// (matches, reveals, unlocks). Randomness (the fan) is seeded from the state's own hash, so a replay reproduces it.
//
// tongs     - lift one item off a LOCKED grill (or a normal one) onto any empty slot of an unlocked grill.
// fan       - blows the food around: every item on the unlocked grills is redistributed over the same occupied slots.
// torch     - serve a set: the chosen item plus the nearest matchSize-1 items with its match key on unlocked grills
//             (its own grill first, in slot order, then the other grills in order) clear as one match: goals, score,
//             combo and lock counters count it like any match. Needs matchSize such items in view.
// tray_swap - swap everything on two unlocked grills with the same number of slots (hidden layers stay put).
// cooler    - every burning item on one unlocked grill stops burning for good.
//
// `needs` tells a UI what to ask the player for: none | item (one item) | from+to (an item, then a free slot) |
// grill (one grill) | grill+grill (two grills).

import { canDrop } from './moves.js';
import { mulberry32, cyrb53 } from './rng.js';
import { canonicalKey } from './hash.js';
import { MATCHERS } from './rules.js';

export const BOOSTERS = Object.freeze({
  tongs: { id: 'tongs', name: 'Tongs', needs: 'from+to' },
  fan: { id: 'fan', name: 'Fan', needs: 'none' },
  torch: { id: 'torch', name: 'Torch', needs: 'item' },
  tray_swap: { id: 'tray_swap', name: 'Tray Swap', needs: 'grill+grill' },
  cooler: { id: 'cooler', name: 'Cooler', needs: 'grill' },
});

const open = (state, gi) => !!state.grills[gi] && state.grills[gi].lock === 0;

/** Torch: the slots it would serve for an item at `from`, chosen item first; null when there are not enough. */
export function torchSet(state, from) {
  if (!open(state, from?.grill)) return null;
  const chosen = state.grills[from.grill].slots[from.slot];
  if (!chosen) return null;
  const keyOf = MATCHERS[state.rules.matcher];
  const key = keyOf(chosen);
  const set = [{ grill: from.grill, slot: from.slot }];
  const take = (gi) =>
    state.grills[gi].slots.forEach((it, si) => {
      if (set.length < state.rules.matchSize && it && !(gi === from.grill && si === from.slot) && keyOf(it) === key) set.push({ grill: gi, slot: si });
    });
  take(from.grill);
  state.grills.forEach((g, gi) => gi !== from.grill && g.lock === 0 && take(gi));
  return set.length === state.rules.matchSize ? set : null;
}

export function canUseBooster(state, action) {
  if (state.status !== 'playing') return false;
  const def = BOOSTERS[action?.booster];
  if (!def || (state.boosters[action.booster] ?? 0) <= 0) return false;
  const { from, to } = action;
  switch (action.booster) {
    case 'tongs': {
      if (!from || !to || from.grill === to.grill) return false;
      const src = state.grills[from.grill];
      return !!src && !!src.slots[from.slot] && canDrop(state, to.grill, to.slot);
    }
    case 'fan': {
      const items = state.grills.filter((g) => g.lock === 0);
      return items.reduce((n, g) => n + g.slots.filter(Boolean).length, 0) >= 2;
    }
    case 'torch':
      return !!torchSet(state, from);
    case 'tray_swap': {
      if (!from || !to || from.grill === to.grill || !open(state, from.grill) || !open(state, to.grill)) return false;
      const a = state.grills[from.grill], b = state.grills[to.grill];
      return a.slots.length === b.slots.length && (a.slots.some(Boolean) || b.slots.some(Boolean));
    }
    case 'cooler':
      return open(state, from?.grill) && state.grills[from.grill].slots.some((it) => it?.burn);
  }
  return false;
}

/** Every action booster `id` could take right now (UI targets, fuzzing). Empty when it has no charge. */
export function boosterActions(state, id) {
  const def = BOOSTERS[id];
  if (!def || (state.boosters[id] ?? 0) <= 0 || state.status !== 'playing') return [];
  const out = [];
  const add = (a) => canUseBooster(state, a) && out.push(a);
  const G = state.grills;
  if (def.needs === 'none') add({ type: 'booster', booster: id });
  else if (def.needs === 'item') G.forEach((g, gi) => g.slots.forEach((it, si) => it && add({ type: 'booster', booster: id, from: { grill: gi, slot: si } })));
  else if (def.needs === 'grill') G.forEach((_, gi) => add({ type: 'booster', booster: id, from: { grill: gi } }));
  else if (def.needs === 'grill+grill') G.forEach((_, a) => G.forEach((__, b) => a < b && add({ type: 'booster', booster: id, from: { grill: a }, to: { grill: b } })));
  else if (def.needs === 'from+to')
    G.forEach((g, fg) => g.slots.forEach((it, fs) => it && G.forEach((t, tg) => t.slots.forEach((_, ts) => add({ type: 'booster', booster: id, from: { grill: fg, slot: fs }, to: { grill: tg, slot: ts } })))));
  return out;
}

/** Can any booster charge be used at all right now? (decides whether a board with no legal move is lost) */
export function hasUsableBooster(state) {
  for (const id in state.boosters) {
    if ((state.boosters[id] ?? 0) <= 0 || !BOOSTERS[id]) continue;
    if (id === 'tongs') {
      // fast path (the common case): something to lift and somewhere else to put it
      const room = state.grills.map((g) => g.lock === 0 && g.slots.includes(null));
      if (state.grills.some((g, gi) => g.slots.some(Boolean) && room.some((r, ti) => r && ti !== gi))) return true;
    } else if (boosterActions(state, id).length) return true;
  }
  return false;
}

/**
 * Apply the booster's effect to a state the caller already cloned. Mutates; returns { events, serve? }.
 * `serve` (torch): the items to clear as one match, already removed from the board; resolve.js scores it.
 * Resolution (matches etc.) is the caller's job (resolve.js applyAction).
 */
export function applyBoosterEffect(state, action) {
  const set = action.booster === 'torch' ? torchSet(state, action.from) : null; // before the charge changes the hash
  state.boosters[action.booster] -= 1;
  const events = [{ type: 'booster', booster: action.booster, ...(action.from ? { from: action.from } : {}), ...(action.to ? { to: action.to } : {}) }];
  const { from, to } = action;
  if (action.booster === 'tongs') {
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
  } else if (action.booster === 'torch') {
    const items = set.map((p) => state.grills[p.grill].slots[p.slot]);
    for (const p of set) state.grills[p.grill].slots[p.slot] = null;
    return { events, serve: { grill: from.grill, key: MATCHERS[state.rules.matcher](items[0]), items, places: set } };
  } else if (action.booster === 'tray_swap') {
    const a = state.grills[from.grill], b = state.grills[to.grill];
    [a.slots, b.slots] = [b.slots, a.slots];
    for (const [g, gi] of [[a, from.grill], [b, to.grill]])
      g.slots.forEach((it, si) => it && events.push({ type: 'move', itemId: it.id, food: it.food, to: { grill: gi, slot: si }, booster: 'tray_swap' }));
  } else if (action.booster === 'cooler') {
    const g = state.grills[from.grill];
    const cooled = [];
    g.slots = g.slots.map((it, si) => {
      if (!it?.burn) return it;
      cooled.push({ grill: from.grill, slot: si, itemId: it.id, food: it.food });
      return { id: it.id, food: it.food }; // new object: items are never edited in place
    });
    events.push({ type: 'cooled', grill: from.grill, items: cooled });
  }
  return { events };
}
