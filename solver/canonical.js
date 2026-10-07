// Canonical forms used by the solver and the generator.
//
// State level: shared/hash.js canonicalKey (grill-permutation and slot-order invariant).
// Level level (dedupe): boardSignature additionally ignores WHICH foods are used - a board and the same board with
// shrimp and corn swapped are structural duplicates. The signature is the lexicographically smallest canonical form
// over every relabelling of the foods present (k! relabellings; boards use at most 7 foods).

import { cyrb53 } from '../shared/rng.js';
import { cellFood, cellBurn } from '../shared/levels.js';

export { canonicalKey, hashState, hashBoard } from '../shared/hash.js';

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  arr.forEach((x, i) => {
    for (const p of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}

function grillForm(g, label) {
  const cells = g.slots.map((c) => (c ? label[cellFood(c)] + (cellBurn(c) || '') : '')).sort().join('');
  const layers = (g.layers ?? []).map((l) => l.map((f) => (f ? label[f] : '')).sort().join('')).join('/');
  return `${g.type === 'tray' ? 'T' : 'G'}${g.slots.length}${g.lock ? `L${g.lock}` : ''}:${cells}${layers ? '|' + layers : ''}`;
}

export function boardSignature(level) {
  const present = new Set();
  for (const g of level.board.grills) {
    for (const c of g.slots) if (c) present.add(cellFood(c));
    for (const l of g.layers ?? []) for (const f of l) if (f) present.add(f);
  }
  const foods = [...present].sort();
  const letters = 'ABCDEFG';
  let best = null;
  for (const perm of permutations(foods)) {
    const label = {};
    perm.forEach((f, i) => (label[f] = letters[i]));
    const form = level.board.grills.map((g) => grillForm(g, label)).sort().join(';');
    if (best === null || form < best) best = form;
  }
  const goals = level.goals.map((g) => g.type).sort().join(',');
  return `${best}#${goals}`;
}

export const boardSignatureHash = (level) => cyrb53(boardSignature(level)).toString(36);

