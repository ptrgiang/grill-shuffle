// Match detection. Pure: reads a state, returns the matches it contains, changes nothing.
//
// A match is `matchSize` items on one unlocked, matching-capable grill that share a matcher key.
// Slot positions inside a grill do not matter. When a grill holds more than matchSize items of a key
// (only possible with capacity > matchSize), the lowest slot indices clear first, deterministically.

import { MATCHERS, GRILL_TYPES } from './rules.js';

/** @returns {{grill:number, key:string, slots:number[]}[]} in grill order */
export function findMatches(state) {
  const { matcher, matchSize } = state.rules;
  const keyOf = MATCHERS[matcher];
  const out = [];
  for (let g = 0; g < state.grills.length; g++) {
    const grill = state.grills[g];
    if (grill.lock > 0 || !GRILL_TYPES[grill.type].matches) continue;
    // capacity is at most 6: a quadratic scan beats a Map
    const slots = grill.slots;
    let filled = 0;
    for (let s = 0; s < slots.length; s++) if (slots[s]) filled++;
    if (filled < matchSize) continue;
    let used = 0; // bitmask of slots already grouped
    for (let s = 0; s < slots.length; s++) {
      if (!slots[s] || used & (1 << s)) continue;
      const k = keyOf(slots[s]);
      const group = [s];
      for (let t = s + 1; t < slots.length; t++) if (slots[t] && !(used & (1 << t)) && keyOf(slots[t]) === k) group.push(t);
      for (const t of group) used |= 1 << t;
      for (let i = 0; i + matchSize <= group.length; i += matchSize) out.push({ grill: g, key: k, slots: group.slice(i, i + matchSize) });
    }
  }
  return out;
}

export const hasMatch = (state) => findMatches(state).length > 0;
