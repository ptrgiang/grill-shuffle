// Board obstacles. Each is a tiny rule applied during resolution; all are turn-based.
//
// Locked grill  - grill.lock = N: nothing can be taken from or put on it. Every match anywhere on the board
//                 takes one off every locked grill's counter; at 0 it opens (and may match at once).
// Stacked tray  - grill.layers: hidden trays waiting under the grill. When the grill is empty (by matching or by
//                 moving everything away) the next layer flips up into its slots. Layers are revealed in order.
// Prep tray     - grill.type = 'tray': holds food, never matches (see rules.js GRILL_TYPES).
// Burn counter  - item.burn = N (rules v2): after every move that leaves the level unfinished, every burning item on
//                 a heated grill loses burnHeat(grill) from its counter; at 0 it becomes charred ({ charred: true },
//                 no burn) and the level is lost at the end of that move (rules v3, resolve.js).
//                 Prep trays and locked (covered) grills have no heat: food parked there stops burning.

import { GRILL_TYPES } from './rules.js';

/** Count one match against every locked grill. Mutates; returns unlock / lock_progress events. */
export function tickLocks(state) {
  const events = [];
  state.grills.forEach((g, i) => {
    if (g.lock <= 0) return;
    g.lock -= 1;
    events.push(g.lock === 0 ? { type: 'unlock', grill: i } : { type: 'lock_progress', grill: i, remaining: g.lock });
  });
  return events;
}

/** Flip up the next layer on every empty, unlocked grill that has one. Mutates; returns reveal events. */
export function revealLayers(state) {
  const events = [];
  state.grills.forEach((g, i) => {
    if (g.lock > 0 || !g.layers.length || g.slots.some(Boolean)) return;
    const [layer, ...rest] = g.layers;
    g.layers = rest;
    const items = [];
    g.slots = layer.map((food, slot) => {
      if (!food) return null;
      const item = { id: state.nextItemId++, food };
      items.push({ slot, id: item.id, food });
      return item;
    });
    events.push({ type: 'reveal', grill: i, items, layersLeft: rest.length });
  });
  return events;
}

/** Burn ticks per move for items on this grill. The one place heat is decided (grill heat states build on it). */
export const burnHeat = (grill) => (grill.lock > 0 ? 0 : GRILL_TYPES[grill.type].heat);

/**
 * One move's worth of heat. Mutates the slots (replacing item objects, never editing them); returns
 * [burn_tick { items: [{ grill, slot, itemId, food, burn }] }, charred { grill, slot, itemId, food } ...] or [].
 */
export function tickBurns(state) {
  let ticked = null, charred = null; // allocated only when something burns (solver hot path)
  const grills = state.grills;
  for (let gi = 0; gi < grills.length; gi++) {
    const g = grills[gi];
    const slots = g.slots;
    for (let si = 0; si < slots.length; si++) {
      const it = slots[si];
      if (!it || !it.burn) continue;
      const heat = burnHeat(g);
      if (!heat) break;
      const burn = Math.max(0, it.burn - heat);
      slots[si] = burn > 0 ? { id: it.id, food: it.food, burn } : { id: it.id, food: it.food, charred: true };
      (ticked ??= []).push({ grill: gi, slot: si, itemId: it.id, food: it.food, burn });
      if (!burn) (charred ??= []).push({ type: 'charred', grill: gi, slot: si, itemId: it.id, food: it.food });
    }
  }
  if (!ticked) return NONE;
  return charred ? [{ type: 'burn_tick', items: ticked }, ...charred] : [{ type: 'burn_tick', items: ticked }];
}
const NONE = Object.freeze([]);
