// Tiny level builders for tests. Grill shorthand: a string of food letters and '.', e.g. 'ss.' = shrimp, shrimp, empty.
//   s shrimp  b beef  c chicken  k corn  r carrot  l salmon  d bread  u sausage  m mushroom  p pepper  w skewer
// Prefix 'T:' makes a prep tray, suffix '#N' locks it for N matches, '/xyz' adds stacked layers, 's4' burns (see cells).

import { foodFromCode } from '../../shared/foods.js';
import { usedModifiers } from '../../shared/levels.js';

// A food letter followed by digits is a burning item: 's3' = shrimp that chars after 3 moves on a hot grill.
const cells = (s) => [...s.matchAll(/(\.)|([a-z])(\d*)/g)].map(([, dot, c, burn]) => (dot ? null : burn ? { food: foodFromCode(c), burn: Number(burn) } : foodFromCode(c)));

export function grill(spec) {
  let s = spec;
  const g = {};
  if (s.startsWith('T:')) {
    g.type = 'tray';
    s = s.slice(2);
  }
  const lockAt = s.indexOf('#');
  if (lockAt >= 0) {
    g.lock = Number(s.slice(lockAt + 1));
    s = s.slice(0, lockAt);
  }
  const [slots, ...layers] = s.split('/');
  g.slots = cells(slots);
  if (layers.length) g.layers = layers.map(cells);
  return g;
}

export function level(specs, { id = 'test-level', moves = 30, goals = [{ type: 'clear_all' }], ...rest } = {}) {
  const lvl = { formatVersion: 1, id, theme: 'street_bbq', moves, board: { grills: specs.map(grill) }, goals, modifiers: [], ...rest };
  lvl.modifiers = usedModifiers(lvl);
  return lvl;
}

export const mv = (fg, fs, tg, ts) => ({ type: 'move', from: { grill: fg, slot: fs }, to: { grill: tg, slot: ts } });
