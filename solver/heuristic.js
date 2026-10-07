// Admissible lower bound on the moves still needed (for A*). Returns 0 whenever a cheap bound is not provably
// admissible (stacked trays can deliver food for free; score/blocker goals are not about placement; burning food
// can turn into charred items that match across foods).
//
// For a food f of which r more items must clear, in t = r / matchSize matches: at most min(c_g, matchSize) items
// can stay put on each matching grill g, and only t grills' worth of them can be part of those matches, so at least
// r - (sum of the t largest min(c_g, matchSize)) items have to move. Every move moves exactly one item.

import { GRILL_TYPES } from '../shared/rules.js';

export function lowerBound(state) {
  const size = state.rules.matchSize;
  if (state.rules.matcher !== 'same_food') return 0;
  if (state.grills.some((g) => g.layers.length)) return 0;
  // burning/charred food changes which items can match each other: the per-food argument no longer holds
  if (state.grills.some((g) => g.slots.some((it) => it && (it.burn || it.charred)))) return 0;
  const need = {};
  for (const goal of state.goals) {
    const left = goal.target - goal.progress;
    if (left <= 0) continue;
    if (goal.type === 'clear_all') {
      for (const g of state.grills) for (const it of g.slots) if (it) need[it.food] = Math.max(need[it.food] || 0, -1); // -1 = all of it
    } else if (goal.type === 'clear_food' || goal.type === 'serve_food') need[goal.food] = Math.max(need[goal.food] || 0, left);
  }
  let bound = 0;
  for (const food of Object.keys(need)) {
    const counts = [];
    let visible = 0;
    for (const g of state.grills) {
      let c = 0;
      for (const it of g.slots) if (it && it.food === food) c++;
      visible += c;
      if (c && GRILL_TYPES[g.type].matches) counts.push(Math.min(c, size));
    }
    const r = need[food] === -1 ? visible : Math.min(need[food], visible);
    const t = Math.ceil(r / size);
    counts.sort((a, b) => b - a);
    let stay = 0;
    for (let i = 0; i < t && i < counts.length; i++) stay += counts[i];
    bound += Math.max(0, t * size - stay - (t * size - r));
  }
  return bound;
}
