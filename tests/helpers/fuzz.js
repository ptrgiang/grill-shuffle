// Fuzzing the shared simulation: random valid boards, random legal play, invariants after every step.
// Used by tests/sim/fuzz.test.js (short) and scripts/fuzz.js (long runs).

import { mulberry32, deriveSeed } from '../../shared/rng.js';
import { makeCandidate } from '../../solver/generator.js';
import { validateLevel, foodTotals, usedModifiers } from '../../shared/levels.js';
import { createState, serializeState, deserializeState } from '../../shared/state.js';
import { getLegalMoves, isLegalMove, hasLegalMove } from '../../shared/moves.js';
import { applyAction } from '../../shared/resolve.js';
import { hashState } from '../../shared/hash.js';
import { replay } from '../../shared/replay.js';
import { findMatches } from '../../shared/match.js';
import { canUseBooster, hasUsableBooster, boosterActions } from '../../shared/boosters.js';

const CONFIG = { grills: [2, 6], foodCount: [1, 5], trays: [0, 1], emptySlots: [1, 5], layers: [0, 3], locks: [0, 2], lockMatches: [1, 3], foods: ['shrimp', 'beef', 'corn', 'chicken', 'carrot', 'salmon', 'bread'] };

function check(cond, msg, ctx) {
  if (!cond) throw new Error(`invariant: ${msg}\n${JSON.stringify(ctx)}`);
}

export function invariants(level, state, ctx) {
  const total = Object.values(foodTotals(level)).reduce((a, b) => a + b, 0);
  let visible = 0, hidden = 0, charred = 0;
  const ids = new Set();
  state.grills.forEach((g, gi) => {
    check(g.slots.length === level.board.grills[gi].slots.length, 'capacity changed', ctx);
    for (const it of g.slots)
      if (it) {
        visible++;
        if (it.charred) charred++;
        check(it.burn === undefined || (Number.isInteger(it.burn) && it.burn > 0), 'burn counter out of range', ctx);
        check(!(it.burn && it.charred), 'item both burning and charred', ctx);
        check(!ids.has(it.id), 'duplicate item id', ctx);
        ids.add(it.id);
        check(it.id < state.nextItemId, 'id beyond nextItemId', ctx);
      }
    for (const l of g.layers) hidden += l.filter(Boolean).length;
    check(g.lock >= 0, 'negative lock', ctx);
  });
  const cleared = state.matches * state.rules.matchSize;
  check(visible + hidden + cleared === total, `item conservation ${visible}+${hidden}+${cleared} != ${total}`, ctx); // charred included
  const burnable = level.board.grills.reduce((n, g) => n + g.slots.filter((c) => c && typeof c === 'object').length, 0);
  check(charred <= burnable, `${charred} charred items but only ${burnable} could burn`, ctx);
  if (charred) check(state.status === 'lost' && state.failReason === 'charred', 'charred item but the level is not lost (charred)', ctx);
  if (state.failReason === 'charred') check(charred > 0, 'lost (charred) with nothing charred', ctx);
  check(findMatches(state).length === 0, 'unresolved match left on board', ctx);
  for (const g of state.goals) check(g.progress >= 0 && g.progress <= g.target, 'goal progress out of range', ctx);
  if (state.status === 'playing') check(state.movesLeft > 0 && (hasLegalMove(state) || hasUsableBooster(state)), 'playing without a move', ctx);
  const round = deserializeState(JSON.parse(JSON.stringify(serializeState(state))));
  check(hashState(round) === hashState(state), 'serialization changed the hash', ctx);
}

// boosters added after tongs / fan draw from their own stream, so the older cases keep their action sequences
const NEW_BOOSTERS = ['torch', 'tray_swap', 'cooler'];

/** Booster uses so far, by id (the long run prints them: coverage, not an invariant). */
export const boosterUses = {};

/** Half the boards get burning items. Mutates the level; keeps it valid. */
function addBurn(level, rng) {
  if (rng.chance(0.5)) return;
  const burning = [];
  for (const g of level.board.grills)
    g.slots.forEach((f, i) => {
      if (f && rng.chance(0.35)) {
        g.slots[i] = { food: f, burn: rng.int(1, 8) };
        burning.push(f);
      }
    });
  if (!burning.length) return;
  level.modifiers = usedModifiers(level);
  if (!validateLevel(level).ok) throw new Error(`fuzz: burn made an invalid level: ${validateLevel(level).errors.join()}`);
}

/** One fuzz case. Returns the number of steps played. */
export function fuzzCase(seed) {
  const rng = mulberry32(seed);
  const level = makeCandidate(CONFIG, deriveSeed(seed, 'board'));
  if (!level || !validateLevel(level).ok) return 0;
  addBurn(level, mulberry32(deriveSeed(seed, 'burn'))); // own stream: the pre-burn cases keep their move sequences
  level.moves = rng.int(3, 40);
  level.boosters = { tongs: rng.int(0, 2), fan: rng.int(0, 2) };
  const brng = mulberry32(deriveSeed(seed, 'boosters'));
  for (const id of NEW_BOOSTERS) level.boosters[id] = brng.int(0, 2);
  let state = createState(level);
  const actions = [];
  const ctx = { seed };
  invariants(level, state, ctx);
  while (state.status === 'playing') {
    let action;
    const moves = getLegalMoves(state);
    const tongs = boosterActions(state, 'tongs');
    const extra = NEW_BOOSTERS.flatMap((id) => boosterActions(state, id));
    if ((rng.chance(0.08) || (!moves.length && !tongs.length && !extra.length)) && canUseBooster(state, { type: 'booster', booster: 'fan' })) action = { type: 'booster', booster: 'fan' };
    else if ((rng.chance(0.05) || !moves.length) && tongs.length) action = rng.pick(tongs);
    else if ((brng.chance(0.06) || !moves.length) && extra.length) action = brng.pick(extra);
    else {
      check(moves.length > 0, 'no legal moves while playing', ctx);
      action = rng.pick(moves);
      check(isLegalMove(state, action), 'generated move is illegal', ctx);
    }
    const a = applyAction(state, action);
    const b = applyAction(state, action);
    check(a.ok && b.ok, 'legal action rejected', { ...ctx, action });
    check(hashState(a.state) === hashState(b.state), 'same state + action -> different result', ctx);
    check(JSON.stringify(a.events) === JSON.stringify(b.events), 'same state + action -> different events', ctx);
    actions.push(action);
    if (action.type === 'booster') boosterUses[action.booster] = (boosterUses[action.booster] ?? 0) + 1;
    state = a.state;
    invariants(level, state, { ...ctx, step: actions.length });
  }
  const r = replay(level, actions);
  check(r.ok && r.hash === hashState(state), 'replay diverged', ctx);
  return actions.length;
}
