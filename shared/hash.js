// Canonical state representation and hashing.
//
// Slot order inside a grill never affects the rules, and two grills with identical type/lock/contents/layers are
// interchangeable, so the canonical form sorts each grill's foods and then sorts the grills themselves.
// Item ids (rendering identity) are excluded; burn counters, charred items and failed goals are included.
//
// canonicalKey(state, { solver: true }) is the solver's transposition key: it drops what the search tracks
// itself (moves left/used) and what cannot change the outcome for the level's goals (score/combo unless a
// reach_score goal exists).

import { foodCode } from './foods.js';
import { cyrb53 } from './rng.js';

// Stacked layers are immutable once created (reveals replace the array, never edit it), so their key is cached.
const layerKeys = new WeakMap();
function layersKey(layers) {
  let k = layerKeys.get(layers);
  if (k === undefined) {
    k = '|' + layers.map((l) => l.map((f) => (f ? foodCode(f) : '')).sort().join('')).join('/');
    layerKeys.set(layers, k);
  }
  return k;
}

// hot path for the solver: small insertion sort instead of map/sort/join
const codes = [];
function grillKey(g) {
  let n = 0;
  const slots = g.slots;
  for (let i = 0; i < slots.length; i++) {
    const it = slots[i];
    if (!it) continue;
    // food code, then the burn counter (digits) or '*' for charred: unambiguous since food codes are letters
    const c = it.burn ? foodCode(it.food) + it.burn : it.charred ? foodCode(it.food) + '*' : foodCode(it.food);
    let j = n++;
    while (j > 0 && codes[j - 1] > c) {
      codes[j] = codes[j - 1];
      j--;
    }
    codes[j] = c;
  }
  let k = (g.type === 'tray' ? 'T' : 'G') + slots.length + (g.lock ? 'L' + g.lock : '') + ':';
  for (let i = 0; i < n; i++) k += codes[i];
  if (g.layers.length) k += layersKey(g.layers);
  return k;
}

export function canonicalKey(state, { solver = false } = {}) {
  const grills = state.grills.map(grillKey).sort().join(';');
  let goals = '';
  for (const g of state.goals) goals += g.progress + (g.failed ? 'x,' : ',');
  if (solver) {
    const scoreMatters = state.goals.some((g) => g.type === 'reach_score');
    return `${grills}#${goals}${scoreMatters ? `#${state.score},${state.combo}` : ''}`;
  }
  const boosters = Object.keys(state.boosters).sort().map((b) => `${b}${state.boosters[b]}`).join('');
  return `v${state.v}#${grills}#${goals}#${state.movesLeft},${state.movesUsed},${state.score},${state.combo},${state.matches}#${boosters}#${state.status}`;
}

/** Stable short hash of the full logical state (base36). Same logical state => same hash. */
export function hashState(state) {
  return cyrb53(canonicalKey(state)).toString(36).padStart(11, '0');
}

/** Hash of a level's starting board alone (dedupe / challenge identity). */
export function hashBoard(state) {
  return cyrb53(state.grills.map(grillKey).sort().join(';')).toString(36).padStart(11, '0');
}
