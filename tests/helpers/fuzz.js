// Fuzzing the shared simulation: random valid boards, random legal play, invariants after every step.
// Used by tests/sim/fuzz.test.js (short) and scripts/fuzz.js (long runs).

import { mulberry32, deriveSeed } from '../../shared/rng.js';
import { makeCandidate } from '../../solver/generator.js';
import { validateLevel, foodTotals } from '../../shared/levels.js';
import { createState, serializeState, deserializeState } from '../../shared/state.js';
import { getLegalMoves, isLegalMove, hasLegalMove } from '../../shared/moves.js';
import { applyAction } from '../../shared/resolve.js';
import { hashState } from '../../shared/hash.js';
import { replay } from '../../shared/replay.js';
import { findMatches } from '../../shared/match.js';
import { canUseBooster, hasUsableBooster } from '../../shared/boosters.js';

const CONFIG = { grills: [2, 6], foodCount: [1, 5], trays: [0, 1], emptySlots: [1, 5], layers: [0, 3], locks: [0, 2], lockMatches: [1, 3], foods: ['shrimp', 'beef', 'corn', 'chicken', 'carrot', 'salmon', 'bread'] };

function check(cond, msg, ctx) {
  if (!cond) throw new Error(`invariant: ${msg}\n${JSON.stringify(ctx)}`);
}

export function invariants(level, state, ctx) {
  const total = Object.values(foodTotals(level)).reduce((a, b) => a + b, 0);
  let visible = 0, hidden = 0;
  const ids = new Set();
  state.grills.forEach((g, gi) => {
    check(g.slots.length === level.board.grills[gi].slots.length, 'capacity changed', ctx);
    for (const it of g.slots)
      if (it) {
        visible++;
        check(!ids.has(it.id), 'duplicate item id', ctx);
        ids.add(it.id);
        check(it.id < state.nextItemId, 'id beyond nextItemId', ctx);
      }
    for (const l of g.layers) hidden += l.filter(Boolean).length;
    check(g.lock >= 0, 'negative lock', ctx);
  });
  const cleared = state.matches * state.rules.matchSize;
  check(visible + hidden + cleared === total, `item conservation ${visible}+${hidden}+${cleared} != ${total}`, ctx);
  check(findMatches(state).length === 0, 'unresolved match left on board', ctx);
  for (const g of state.goals) check(g.progress >= 0 && g.progress <= g.target, 'goal progress out of range', ctx);
  if (state.status === 'playing') check(state.movesLeft > 0 && (hasLegalMove(state) || hasUsableBooster(state)), 'playing without a move', ctx);
  const round = deserializeState(JSON.parse(JSON.stringify(serializeState(state))));
  check(hashState(round) === hashState(state), 'serialization changed the hash', ctx);
}

function tongsActions(state) {
  const out = [];
  state.grills.forEach((g, fg) =>
    g.slots.forEach((it, fs) => {
      if (!it) return;
      state.grills.forEach((t, tg) => t.slots.forEach((x, ts) => {
        const a = { type: 'booster', booster: 'tongs', from: { grill: fg, slot: fs }, to: { grill: tg, slot: ts } };
        if (canUseBooster(state, a)) out.push(a);
      }));
    }),
  );
  return out;
}

/** One fuzz case. Returns the number of steps played. */
export function fuzzCase(seed) {
  const rng = mulberry32(seed);
  const level = makeCandidate(CONFIG, deriveSeed(seed, 'board'));
  if (!level || !validateLevel(level).ok) return 0;
  level.moves = rng.int(3, 40);
  level.boosters = { tongs: rng.int(0, 2), fan: rng.int(0, 2) };
  let state = createState(level);
  const actions = [];
  const ctx = { seed };
  invariants(level, state, ctx);
  while (state.status === 'playing') {
    let action;
    const moves = getLegalMoves(state);
    const tongs = tongsActions(state);
    if ((rng.chance(0.08) || (!moves.length && !tongs.length)) && canUseBooster(state, { type: 'booster', booster: 'fan' })) action = { type: 'booster', booster: 'fan' };
    else if ((rng.chance(0.05) || !moves.length) && tongs.length) action = rng.pick(tongs);
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
    state = a.state;
    invariants(level, state, { ...ctx, step: actions.length });
  }
  const r = replay(level, actions);
  check(r.ok && r.hash === hashState(state), 'replay diverged', ctx);
  return actions.length;
}
