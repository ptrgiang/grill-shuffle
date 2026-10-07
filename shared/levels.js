// Level format (LEVEL_FORMAT_VERSION 1) and its structural validator.
// Levels are pure data: no level ever ships custom code. See docs/LEVELS.md.
//
// {
//   "formatVersion": 1,
//   "id": "street-001",
//   "name": "First Flip",
//   "theme": "street_bbq",
//   "moves": 9,
//   "board": { "grills": [ { "type": "grill", "slots": ["shrimp", null, {"food": "beef", "burn": 4}], "layers": [["corn", "corn", null]], "lock": 0 } ] },
//   "goals": [ { "type": "clear_all" } ],
//   "rules": { },                 optional overrides of shared/rules.js DEFAULT_RULES
//   "modifiers": [ ],              mechanics in play (informational + validated)
//   "boosters": { "tongs": 1 },    optional per-level booster allowance
//   "solver": { "minMoves": 6, "difficulty": 18, "rating": "easy" }   written by tooling, verified by validate:levels
// }

import { isFood } from './foods.js';
import { GRILL_TYPES, resolveRules, MATCHERS } from './rules.js';
import { GOAL_TYPES } from './goals.js';
import { BOOSTERS } from './boosters.js';
import { LEVEL_FORMAT_VERSION } from './version.js';

export const THEMES = Object.freeze(['street_bbq', 'beach_grill', 'night_market', 'mountain_camp', 'rooftop_grill']);
export const MODIFIERS = Object.freeze(['locked_grill', 'stacked_tray', 'prep_tray', 'burn_counter']);
export const LIMITS = Object.freeze({ maxGrills: 12, maxSlots: 6, maxLayers: 6, maxLock: 9, maxMoves: 99, maxBurn: 20 });

// A visible slot cell is null, a food id ("shrimp"), or an item with a burn counter ({"food": "shrimp", "burn": 4}).
// Stacked layers hold plain food ids only.
/** Food id of a level slot cell (null for an empty slot). */
export const cellFood = (cell) => (cell && typeof cell === 'object' ? cell.food : cell) ?? null;
/** Burn counter of a level slot cell (0 = does not burn). */
export const cellBurn = (cell) => (cell && typeof cell === 'object' ? cell.burn ?? 0 : 0);

/**
 * The puzzle rule version a level is played under: the lowest one that has every mechanic it uses. Boards without
 * v2 mechanics stay v1, so their state hashes (and the fan booster's seed, which comes from the hash) and every
 * stored replay stay exactly what they were before v2 existed.
 */
export function ruleVersionOf(level) {
  return level.board.grills.some((g) => g.slots.some((c) => cellBurn(c) > 0)) ? 2 : 1;
}

/** Every food id on the board, including hidden layers, with counts. */
export function foodTotals(level) {
  const totals = {};
  for (const g of level.board.grills) {
    for (const c of g.slots) {
      const f = cellFood(c);
      if (f) totals[f] = (totals[f] || 0) + 1;
    }
    for (const layer of g.layers || []) for (const f of layer) if (f) totals[f] = (totals[f] || 0) + 1;
  }
  return totals;
}

/** Which modifiers a level actually uses (derived from its board). */
export function usedModifiers(level) {
  const used = new Set();
  for (const g of level.board.grills) {
    if ((g.lock || 0) > 0) used.add('locked_grill');
    if ((g.layers || []).length) used.add('stacked_tray');
    if ((g.type || 'grill') === 'tray') used.add('prep_tray');
    if (g.slots.some((c) => cellBurn(c) > 0)) used.add('burn_counter');
  }
  return [...used].sort();
}

/**
 * Structural validation (no solving). Returns { ok, errors: string[] }.
 */
export function validateLevel(level) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!level || typeof level !== 'object') return { ok: false, errors: ['level is not an object'] };
  if (level.formatVersion !== LEVEL_FORMAT_VERSION) err(`formatVersion must be ${LEVEL_FORMAT_VERSION}`);
  if (typeof level.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(level.id)) err(`bad id ${JSON.stringify(level.id)}`);
  if (level.theme !== undefined && !THEMES.includes(level.theme)) err(`unknown theme ${level.theme}`);
  if (!Number.isInteger(level.moves) || level.moves < 1 || level.moves > LIMITS.maxMoves) err(`moves must be an integer 1..${LIMITS.maxMoves}`);

  let rules = null;
  try {
    rules = resolveRules(level.rules);
  } catch (e) {
    err(e.message);
  }

  const grills = level.board?.grills;
  if (!Array.isArray(grills) || grills.length < 2 || grills.length > LIMITS.maxGrills) {
    err(`board.grills must have 2..${LIMITS.maxGrills} grills`);
    return { ok: false, errors };
  }
  let openEmpty = 0;
  grills.forEach((g, i) => {
    const at = `grill ${i}`;
    const type = g.type ?? 'grill';
    if (!GRILL_TYPES[type]) err(`${at}: unknown type ${type}`);
    if (!Array.isArray(g.slots) || g.slots.length < 1 || g.slots.length > LIMITS.maxSlots) {
      err(`${at}: slots must have 1..${LIMITS.maxSlots} entries`);
      return;
    }
    g.slots.forEach((c, s) => {
      if (c === null) return;
      if (c && typeof c === 'object') {
        if (Object.keys(c).some((k) => k !== 'food' && k !== 'burn')) err(`${at} slot ${s}: an item may only have food and burn`);
        if (!Number.isInteger(c.burn) || c.burn < 1 || c.burn > LIMITS.maxBurn) err(`${at} slot ${s}: burn must be an integer 1..${LIMITS.maxBurn}`);
      }
      if (!isFood(cellFood(c))) err(`${at}: unknown food ${JSON.stringify(cellFood(c))}`);
    });
    const lock = g.lock ?? 0;
    if (!Number.isInteger(lock) || lock < 0 || lock > LIMITS.maxLock) err(`${at}: lock must be an integer 0..${LIMITS.maxLock}`);
    const layers = g.layers ?? [];
    if (!Array.isArray(layers) || layers.length > LIMITS.maxLayers) err(`${at}: layers must be an array of at most ${LIMITS.maxLayers}`);
    else
      layers.forEach((layer, j) => {
        if (!Array.isArray(layer) || layer.length !== g.slots.length) err(`${at} layer ${j}: must have exactly ${g.slots.length} entries`);
        else {
          if (!layer.some(Boolean)) err(`${at} layer ${j}: empty layer`);
          for (const f of layer) if (f !== null && !isFood(f)) err(`${at} layer ${j}: unknown food ${JSON.stringify(f)}`);
        }
      });
    if (lock === 0) openEmpty += g.slots.filter((f) => f === null).length;
    if (rules && type === 'grill' && lock === 0) {
      const counts = {};
      for (const c of g.slots) {
        if (!isFood(cellFood(c))) continue;
        const k = MATCHERS[rules.matcher]({ food: cellFood(c) });
        counts[k] = (counts[k] || 0) + 1;
      }
      if (Object.values(counts).some((n) => n >= rules.matchSize)) err(`${at}: starts with a match already on it`);
    }
  });
  if (openEmpty === 0) err('no empty slot on an unlocked grill: the first move is impossible');
  else {
    const open = grills.map((g, i) => ({ i, ok: (g.lock ?? 0) === 0 && Array.isArray(g.slots) }));
    const hasFirstMove = open.some((a) => a.ok && grills[a.i].slots.some(Boolean) && open.some((b) => b.ok && b.i !== a.i && grills[b.i].slots.includes(null)));
    if (!hasFirstMove) err('no legal first move (no item can reach an empty slot on another grill)');
  }

  const totals = foodTotals(level);
  const size = rules?.matchSize ?? 3;
  if (rules && rules.matcher === 'same_food') {
    for (const [f, n] of Object.entries(totals)) if (n % size) err(`food ${f}: ${n} items is not a multiple of ${size}`);
  }
  if (!Object.keys(totals).length) err('board has no food');

  if (!Array.isArray(level.goals) || !level.goals.length) err('goals must be a non-empty array');
  else
    level.goals.forEach((goal, i) => {
      const spec = GOAL_TYPES[goal?.type];
      if (!spec) return err(`goal ${i}: unknown type ${goal?.type}`);
      const problem = spec.validate(goal, level, totals, size);
      if (problem) err(`goal ${i} (${goal.type}): ${problem}`);
    });
  if (Array.isArray(level.goals) && level.goals.length && level.goals.every((goal) => GOAL_TYPES[goal?.type]?.constraint))
    err('goals: needs at least one goal besides constraints like protect_food');

  for (const m of level.modifiers ?? []) if (!MODIFIERS.includes(m)) err(`unknown modifier ${m}`);
  const declared = new Set(level.modifiers ?? []);
  for (const m of usedModifiers(level)) if (!declared.has(m)) err(`board uses ${m} but modifiers does not declare it`);

  for (const [b, n] of Object.entries(level.boosters ?? {})) {
    if (!BOOSTERS[b]) err(`unknown booster ${b}`);
    if (!Number.isInteger(n) || n < 0 || n > 9) err(`booster ${b}: count must be 0..9`);
  }
  return { ok: errors.length === 0, errors };
}
