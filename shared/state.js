// Authoritative puzzle state. Plain JSON-serializable data; no DOM, no three.js, no Math.random.
//
// state = {
//   v: ruleVersionOf(level) (<= PUZZLE_RULE_VERSION: the rules the board needs), levelId,
//   rules: { matcher, matchSize, matchScore },
//   movesLeft, movesUsed, score, combo, maxCombo, matches,
//   nextItemId,                       item ids are a deterministic sequence: rendering identity, never game logic
//   grills: [ { id, type, lock, slots: [ {id, food, burn?, charred?} | null ], layers: [ [food|null, ...], ... ] } ],
//   goals: [ { type, food?, target, progress, failed? } ],
//   boosters: { [id]: count },
//   status: 'playing' | 'won' | 'lost', failReason?: 'moves' | 'stuck' | 'charred'
// }
// An item has `burn` (moves left before it chars, > 0) only while it is burning, and `charred: true` once it has.

import { resolveRules } from './rules.js';
import { initGoals } from './goals.js';
import { foodTotals, cellFood, cellBurn, ruleVersionOf } from './levels.js';
import { foodCode, foodFromCode } from './foods.js';

export function createState(level) {
  let nextItemId = 1;
  const grills = level.board.grills.map((g, i) => ({
    id: `g${i}`,
    type: g.type ?? 'grill',
    lock: g.lock ?? 0,
    slots: g.slots.map((c) => (c ? (cellBurn(c) ? { id: nextItemId++, food: cellFood(c), burn: cellBurn(c) } : { id: nextItemId++, food: cellFood(c) }) : null)),
    layers: (g.layers ?? []).map((layer) => layer.slice()),
  }));
  return {
    v: ruleVersionOf(level),
    levelId: level.id,
    rules: resolveRules(level.rules),
    movesLeft: level.moves,
    movesUsed: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    matches: 0,
    nextItemId,
    grills,
    goals: initGoals(level, foodTotals(level)),
    boosters: { ...(level.boosters ?? {}) },
    status: 'playing',
  };
}

/** Fast structural clone (hot path for the solver). */
export function cloneState(s) {
  return {
    v: s.v,
    levelId: s.levelId,
    rules: s.rules,
    movesLeft: s.movesLeft,
    movesUsed: s.movesUsed,
    score: s.score,
    combo: s.combo,
    maxCombo: s.maxCombo,
    matches: s.matches,
    nextItemId: s.nextItemId,
    grills: s.grills.map((g) => ({ id: g.id, type: g.type, lock: g.lock, slots: g.slots.slice(), layers: g.layers })),
    goals: s.goals.map((g) => ({ ...g })),
    boosters: { ...s.boosters },
    status: s.status,
    ...(s.failReason ? { failReason: s.failReason } : {}),
  };
}

// Items are never mutated in place (moves relocate the same object), so slots.slice() above is a safe clone, and
// layer arrays are immutable (obstacles.js replaces them on a reveal), so they are shared between states.

// cell: <food code><id>[~<burn>|!]   e.g. s12, s12~3 (burning), s12! (charred)
const cell = (it) => (it ? `${foodCode(it.food)}${it.id}${it.burn ? `~${it.burn}` : it.charred ? '!' : ''}` : '_');
function unCell(c) {
  if (c === '_') return null;
  const m = /^(.)(\d+)(?:~(\d+)|(!))?$/.exec(c);
  const it = { id: Number(m[2]), food: foodFromCode(m[1]) };
  if (m[3]) it.burn = Number(m[3]);
  if (m[4]) it.charred = true;
  return it;
}
const layerStr = (layer) => layer.map((f) => (f ? foodCode(f) : '_')).join('');
const unLayer = (s) => [...s].map((c) => (c === '_' ? null : foodFromCode(c)));

/** Compact, lossless serialization (JSON-safe object). */
export function serializeState(s) {
  return {
    v: s.v,
    l: s.levelId,
    r: s.rules,
    m: [s.movesLeft, s.movesUsed, s.score, s.combo, s.maxCombo, s.matches, s.nextItemId],
    g: s.grills.map((g) => [g.type, g.lock, g.slots.map(cell).join(','), g.layers.map(layerStr)]),
    o: s.goals,
    b: s.boosters,
    s: s.status,
    ...(s.failReason ? { f: s.failReason } : {}),
  };
}

export function deserializeState(d) {
  const [movesLeft, movesUsed, score, combo, maxCombo, matches, nextItemId] = d.m;
  return {
    v: d.v,
    levelId: d.l,
    rules: resolveRules(d.r),
    movesLeft,
    movesUsed,
    score,
    combo,
    maxCombo,
    matches,
    nextItemId,
    grills: d.g.map(([type, lock, slots, layers], i) => ({ id: `g${i}`, type, lock, slots: slots.split(',').map(unCell), layers: layers.map(unLayer) })),
    goals: d.o.map((g) => ({ ...g })),
    boosters: { ...d.b },
    status: d.s,
    ...(d.f ? { failReason: d.f } : {}),
  };
}

/** Every visible item: [{ grill, slot, item }]. */
export function itemsOf(state) {
  const out = [];
  state.grills.forEach((g, gi) => g.slots.forEach((item, si) => item && out.push({ grill: gi, slot: si, item })));
  return out;
}
