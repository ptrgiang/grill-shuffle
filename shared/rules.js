// Data-driven puzzle rules. A level may override any field via `level.rules`; nothing here knows about rendering.
//
// matcher: how items are grouped for matching. Items whose matcher keys are equal can form a match.
//   same_food - identical food ids (the base rule)
//   category  - same food category (meat / seafood / veg / grain): a later variant
// matchSize: how many matching items on ONE grill clear together.

import { FOODS } from './foods.js';

export const MATCHERS = Object.freeze({
  same_food: (item) => item.food,
  category: (item) => FOODS[item.food].category,
});

export const DEFAULT_RULES = Object.freeze({
  matcher: 'same_food',
  matchSize: 3,
  matchScore: 100, // points per match, multiplied by the combo level at the time of the match
});

/** Merge level overrides onto the defaults and check them. */
export function resolveRules(overrides = {}) {
  const r = { ...DEFAULT_RULES, ...(overrides || {}) };
  if (!MATCHERS[r.matcher]) throw new Error(`unknown matcher "${r.matcher}"`);
  if (!Number.isInteger(r.matchSize) || r.matchSize < 2 || r.matchSize > 6) throw new Error(`bad matchSize ${r.matchSize}`);
  return r;
}

/**
 * Grill types. A `tray` (prep tray) holds food but never cooks, so it never matches: a buffer the player can park on.
 */
export const GRILL_TYPES = Object.freeze({
  grill: { matches: true },
  tray: { matches: false },
});
