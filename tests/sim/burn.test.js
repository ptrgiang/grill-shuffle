import { test } from 'node:test';
import assert from 'node:assert/strict';
import { level, mv } from '../helpers/levels.js';
import { createState, serializeState, deserializeState } from '../../shared/state.js';
import { applyAction, applyMove } from '../../shared/resolve.js';
import { findMatches } from '../../shared/match.js';
import { hashState, canonicalKey } from '../../shared/hash.js';
import { validateLevel, ruleVersionOf, usedModifiers } from '../../shared/levels.js';
import { replay } from '../../shared/replay.js';
import { solveLevel } from '../../solver/solver.js';
import { astar } from '../../solver/search.js';

const itemAt = (s, g, slot) => s.grills[g].slots[slot];
const types = (events) => events.map((e) => e.type);

test('burn: every move ticks burning items on a hot grill; the moved item ticks too', () => {
  const lvl = level(['k3s.', 's..', 'kk.', 's..']);
  assert.ok(validateLevel(lvl).ok, validateLevel(lvl).errors.join());
  const s0 = createState(lvl);
  assert.equal(itemAt(s0, 0, 0).burn, 3);
  const r = applyMove(s0, mv(1, 0, 3, 1));
  assert.equal(itemAt(r.state, 0, 0).burn, 2);
  assert.equal(itemAt(s0, 0, 0).burn, 3, 'input state untouched');
  const tick = r.events.find((e) => e.type === 'burn_tick');
  assert.deepEqual(tick.items, [{ grill: 0, slot: 0, itemId: itemAt(s0, 0, 0).id, food: 'corn', burn: 2 }]);
  // move the burning corn itself: it keeps burning wherever it lands on a grill
  const r2 = applyMove(r.state, mv(0, 0, 1, 0));
  assert.equal(itemAt(r2.state, 1, 0).burn, 1);
});

test('burn: at 0 the item chars and the level is lost that move (rules v3)', () => {
  const lvl = level(['k1s.', 's..', 'kk.', 's..']);
  const r = applyMove(createState(lvl), mv(1, 0, 3, 1));
  const it = itemAt(r.state, 0, 0);
  assert.deepEqual({ ...it, id: 0 }, { id: 0, food: 'corn', charred: true });
  assert.equal(r.state.status, 'lost');
  assert.equal(r.state.failReason, 'charred');
  assert.deepEqual(types(r.events).slice(-3), ['burn_tick', 'charred', 'level_failed']);
  assert.equal(r.events.at(-1).reason, 'charred');
  assert.equal(applyMove(r.state, mv(0, 1, 1, 0)).ok, false, 'no move after a char');
  // saving the corn (matching it) keeps the level alive
  const ok = applyMove(createState(lvl), mv(0, 0, 2, 2));
  assert.equal(ok.state.status, 'playing');
});

test('burn: every food chars the same way: no goal is needed to lose', () => {
  const lvl = level(['ss.', 's..', 'b1k.', 'bb.', 'kk.'], { goals: [{ type: 'serve_food', food: 'shrimp', count: 3 }, { type: 'clear_food', food: 'corn', count: 3 }] });
  assert.ok(validateLevel(lvl).ok, validateLevel(lvl).errors.join());
  const r = applyMove(createState(lvl), mv(4, 0, 2, 2));
  assert.equal(r.state.status, 'lost');
  assert.equal(r.state.failReason, 'charred');
});

test('burn: prep trays and locked grills have no heat', () => {
  const lvl = level(['T:k2..', 'kk.', 'k.s#1', 'ss.', 's..', '...']);
  // corn 4? keep counts valid: tray corn + kk + k on the locked grill = 4 -> use a beef instead
  lvl.board.grills[2].slots = [{ food: 'beef', burn: 1 }, null, 'beef'];
  lvl.board.grills[5].slots = ['beef', null, null];
  lvl.modifiers = usedModifiers(lvl);
  assert.ok(validateLevel(lvl).ok, validateLevel(lvl).errors.join());
  const r = applyMove(createState(lvl), mv(4, 0, 5, 1));
  assert.equal(itemAt(r.state, 0, 0).burn, 2, 'tray: no tick');
  assert.equal(itemAt(r.state, 2, 0).burn, 1, 'locked grill: no tick');
  assert.ok(!r.events.some((e) => e.type === 'burn_tick'));
});

test('burn: an item matched on the move never ticks; the match lists it as burning', () => {
  const lvl = level(['s2s.', 's..', 'kk.', 'k..']);
  const r = applyMove(createState(lvl), mv(1, 0, 0, 2));
  const m = r.events.find((e) => e.type === 'match');
  assert.deepEqual(m.burning, ['shrimp']);
  assert.ok(!r.events.some((e) => e.type === 'burn_tick'));
  assert.equal(r.state.status, 'playing');
});

test('burn: the winning move does not tick (nothing burns after the last bite)', () => {
  const lvl = level(['ss.', 's..', 'k1k.', 'k..'], { goals: [{ type: 'serve_food', food: 'shrimp', count: 3 }] });
  const r = applyMove(createState(lvl), mv(1, 0, 0, 2));
  assert.equal(r.state.status, 'won');
  assert.equal(itemAt(r.state, 2, 0).burn, 1);
});

test('burn: boosters cost no move and never tick', () => {
  const lvl = level(['k2s.', 's..', 'kk.', 's..'], { boosters: { tongs: 1, fan: 1 } });
  const r = applyAction(createState(lvl), { type: 'booster', booster: 'tongs', from: { grill: 1, slot: 0 }, to: { grill: 3, slot: 1 } });
  assert.ok(r.ok);
  assert.equal(itemAt(r.state, 0, 0).burn, 2);
});

test('burn: serialization round-trips burn and charred; the hash sees both', () => {
  const lvl = level(['k2s1.', 's..', 'kk.', 's..', '...']);
  let s = createState(lvl);
  s = applyMove(s, mv(1, 0, 4, 0)).state; // k1, s charred (lost: the final state still serializes and hashes)
  const back = deserializeState(JSON.parse(JSON.stringify(serializeState(s))));
  assert.deepEqual(back.grills, s.grills);
  assert.equal(hashState(back), hashState(s));
  const fresh = createState(level(['k2s1.', 's..', 'kk.', 's..', '...']));
  const other = createState(level(['k3s1.', 's..', 'kk.', 's..', '...']));
  assert.notEqual(hashState(fresh), hashState(other), 'burn value matters');
  const unburnt = { ...s, grills: s.grills.map((g) => ({ ...g, slots: g.slots.map((it) => (it?.charred ? { id: it.id, food: it.food } : it)) })) };
  assert.notEqual(canonicalKey(s, { solver: true }), canonicalKey(unburnt, { solver: true }), 'charred matters');
});

test('rule version: boards without burn stay v1 (same hashes and replays), burn boards are v3', () => {
  const v1 = level(['ss.', 's..', 'bb.', 'b..']);
  assert.equal(ruleVersionOf(v1), 1);
  assert.equal(createState(v1).v, 1);
  assert.match(canonicalKey(createState(v1)), /^v1#G3:b;G3:bb;G3:s;G3:ss#/);
  const v3 = level(['s2s.', 's..', 'bb.', 'b..']);
  assert.equal(ruleVersionOf(v3), 3);
  assert.equal(createState(v3).v, 3);
});

test('burn validation: counters, layers, modifiers, goals', () => {
  const v = (lvl) => validateLevel(lvl).errors.join(' | ');
  const base = () => level(['s2s.', 's..', 'bb.', 'b..']);
  assert.equal(v(base()), '');
  const big = base();
  big.board.grills[0].slots[0].burn = 21;
  assert.match(v(big), /burn must be an integer 1\.\.20/);
  const zero = base();
  zero.board.grills[0].slots[0].burn = 0;
  assert.match(v(zero), /burn must be/);
  const extra = base();
  extra.board.grills[0].slots[0].cooked = true;
  assert.match(v(extra), /only have food and burn/);
  const undeclared = base();
  undeclared.modifiers = [];
  assert.match(v(undeclared), /burn_counter/);
  const layered = level(['s..', 's..', 'bb./s..', 'b..']);
  layered.board.grills[2].layers[0][0] = { food: 'shrimp', burn: 2 };
  assert.match(v(layered), /unknown food/);
  assert.match(v({ ...base(), goals: [{ type: 'protect_food', food: 'shrimp' }] }), /unknown type protect_food/);
  assert.match(v({ ...base(), goals: [{ type: 'clear_before_char' }] }), /unknown type clear_before_char/);
});

test('solver: respects burn counters (BFS and A* agree), solution replays', () => {
  // naive order (bring the 3rd shrimp first, then corn) is fine; but the corn chars after 2 moves unless cleared first
  const lvl = level(['k2s.', 's..', 'k.s', 'k..', '...']);
  assert.ok(validateLevel(lvl).ok, validateLevel(lvl).errors.join());
  const r = solveLevel(lvl);
  assert.ok(r.solvable);
  const a = astar(lvl);
  assert.equal(a.minMoves, r.minMoves);
  const rep = replay(lvl, r.solutionString);
  assert.equal(rep.state.status, 'won');
  // with the counter at 1 the corn cannot be saved: two corn have to move first
  const hopeless = level(['k1s.', 's..', 'k.s', 'k..', '...']);
  assert.equal(solveLevel(hopeless).solvable, false);
});
