import { test } from 'node:test';
import assert from 'node:assert/strict';
import { level, mv } from '../helpers/levels.js';
import { createState, serializeState, deserializeState, cloneState } from '../../shared/state.js';
import { getLegalMoves, isLegalMove, encodeAction, decodeAction, encodeActions, decodeActions, hasLegalMove } from '../../shared/moves.js';
import { applyAction, applyMove, isComplete, isFailed } from '../../shared/resolve.js';
import { findMatches } from '../../shared/match.js';
import { hashState, canonicalKey } from '../../shared/hash.js';
import { validateLevel } from '../../shared/levels.js';

test('createState builds items with sequential ids and goals', () => {
  const s = createState(level(['ss.', 'sbb', 'b..']));
  assert.equal(s.grills.length, 3);
  assert.deepEqual(s.grills[0].slots.map((x) => x && x.id), [1, 2, null]);
  assert.equal(s.goals[0].target, 6);
  assert.equal(s.status, 'playing');
});

test('legal moves: only from unlocked items into empty slots of other unlocked grills', () => {
  const s = createState(level(['ss.', 'sbb', 'b..', 'kk.#2'], { goals: [{ type: 'clear_food', food: 'shrimp', count: 3 }] }));
  const moves = getLegalMoves(s);
  for (const m of moves) {
    assert.ok(isLegalMove(s, m));
    assert.notEqual(m.from.grill, m.to.grill);
    assert.notEqual(m.from.grill, 3);
    assert.notEqual(m.to.grill, 3);
  }
  // 5 items; grill 0 has 1 empty, grill 1 none, grill 2 two
  // items in g0 (2) -> g2 (2 slots) = 4; g1 (3) -> g0 (1) + g2 (2) = 9; g2 (1) -> g0 (1) = 1
  assert.equal(moves.length, 14);
  assert.equal(isLegalMove(s, mv(0, 0, 0, 2)), false, 'same grill');
  assert.equal(isLegalMove(s, mv(0, 0, 1, 0)), false, 'occupied');
  assert.equal(isLegalMove(s, mv(0, 2, 2, 1)), false, 'empty source');
  assert.equal(isLegalMove(s, mv(3, 0, 2, 1)), false, 'locked source');
  assert.equal(isLegalMove(s, mv(0, 0, 3, 2)), false, 'locked target');
});

test('unique legal moves collapse equivalent moves', () => {
  const s = createState(level(['ss.', 'sbb', 'b..']));
  const u = getLegalMoves(s, { unique: true });
  // g0: shrimp -> g2 (1); g1: shrimp, beef -> g0, g2 (4); g2: beef -> g0 (1)
  assert.equal(u.length, 6);
});

test('a triple on one grill clears and reports events', () => {
  const s0 = createState(level(['ss.', 'sbb', 'b..']));
  const r = applyMove(s0, mv(1, 0, 0, 2));
  assert.ok(r.ok);
  assert.deepEqual(r.state.grills[0].slots, [null, null, null]);
  const types = r.events.map((e) => e.type);
  assert.deepEqual(types.slice(0, 2), ['move', 'match']);
  const match = r.events.find((e) => e.type === 'match');
  assert.equal(match.food, 'shrimp');
  assert.equal(match.grill, 0);
  assert.deepEqual(match.itemIds.sort(), [1, 2, 3]);
  const gp = r.events.find((e) => e.type === 'goal_progress');
  assert.equal(gp.amount, 3);
  assert.equal(r.state.matches, 1);
  assert.equal(r.state.combo, 1);
  assert.equal(r.state.score, 100);
  assert.equal(r.state.movesLeft, 29);
  // input untouched
  assert.equal(s0.grills[0].slots[2], null);
  assert.equal(s0.movesLeft, 30);
});

test('illegal moves are rejected without changing the state', () => {
  const s0 = createState(level(['ss.', 'sbb', 'b..']));
  const r = applyMove(s0, mv(0, 0, 1, 1));
  assert.equal(r.ok, false);
  assert.equal(r.state, s0);
  assert.deepEqual(r.events, []);
});

test('win when every goal is met; loss when moves run out', () => {
  let s = createState(level(['ss.', 'sbb', 'b..'], { moves: 3 }));
  s = applyMove(s, mv(1, 0, 0, 2)).state;
  const r = applyMove(s, mv(2, 0, 1, 0));
  assert.equal(r.state.status, 'won');
  assert.ok(isComplete(r.state));
  assert.ok(r.events.some((e) => e.type === 'level_complete'));

  let t = createState(level(['ss.', 'sbb', 'b..'], { moves: 1 }));
  const r2 = applyMove(t, mv(0, 0, 2, 1));
  assert.equal(r2.state.status, 'lost');
  assert.equal(r2.state.failReason, 'moves');
  assert.ok(isFailed(r2.state));
  assert.equal(applyMove(r2.state, mv(0, 1, 2, 2)).ok, false, 'no moves after the end');
});

test('loss when stuck (no legal move left)', () => {
  // moving the last shrimp off g0 fills g1 and flips g0's stacked tray up full: every open slot is gone
  const lvl = level(['s../kbk', 'bk.', 'ssb#5'], { moves: 10 });
  const r = applyMove(createState(lvl), mv(0, 0, 1, 2));
  assert.ok(r.ok);
  assert.equal(hasLegalMove(r.state), false);
  assert.equal(r.state.status, 'lost');
  assert.equal(r.state.failReason, 'stuck');
});

test('combo grows on consecutive productive moves and resets on a quiet move', () => {
  let s = createState(level(['ss.', 'bb.', 'kk.', 'sbk', '...']));
  s = applyMove(s, mv(3, 0, 0, 2)).state;
  assert.equal(s.combo, 1);
  s = applyMove(s, mv(3, 1, 1, 2)).state;
  assert.equal(s.combo, 2);
  assert.equal(s.score, 100 + 200);
  const r = applyMove(s, mv(3, 2, 4, 0));
  assert.equal(r.state.combo, 0);
  assert.ok(r.events.some((e) => e.type === 'combo_reset' && e.was === 2));
  assert.equal(r.state.maxCombo, 2);
});

test('prep trays never match', () => {
  const t = createState(level(['T:ss.', 's..', 'bbk', 'b.k', '...']));
  const r = applyMove(t, mv(1, 0, 0, 2));
  assert.ok(r.ok);
  assert.equal(findMatches(r.state).length, 0);
  assert.equal(r.state.grills[0].slots.filter(Boolean).length, 3);
  assert.ok(!r.events.some((e) => e.type === 'match'));
});

test('locked grill opens after N matches anywhere and can chain', () => {
  // g2 locked for 1 match and already holds a triple of corn -> unlock -> chain match
  const lvl = level(['ss.', 's..', 'kkk#1', 'bb.', 'b..']);
  assert.ok(validateLevel(lvl).ok, validateLevel(lvl).errors.join());
  let s = createState(lvl);
  const r = applyMove(s, mv(1, 0, 0, 2));
  const types = r.events.map((e) => e.type);
  assert.ok(types.includes('unlock'));
  const matches = r.events.filter((e) => e.type === 'match');
  assert.equal(matches.length, 2);
  assert.equal(matches[0].chain, 0);
  assert.equal(matches[1].chain, 1);
  assert.equal(matches[1].food, 'corn');
  assert.equal(r.state.combo, 2);
  assert.equal(r.state.grills[2].lock, 0);
});

test('lock counts down by one per match', () => {
  const lvl = level(['ss.', 's..', 'kbk#2', 'bb.', 'k..']);
  let s = createState(lvl);
  const r = applyMove(s, mv(1, 0, 0, 2));
  assert.equal(r.state.grills[2].lock, 1);
  assert.ok(r.events.some((e) => e.type === 'lock_progress' && e.remaining === 1));
});

test('stacked tray reveals when its grill empties (by match or by moving away)', () => {
  const lvl = level(['ss./kkb', 's..', 'b..', 'bk.', '...']);
  assert.ok(validateLevel(lvl).ok, validateLevel(lvl).errors.join());
  let s = createState(lvl);
  const r = applyMove(s, mv(1, 0, 0, 2));
  const rev = r.events.find((e) => e.type === 'reveal');
  assert.ok(rev);
  assert.equal(rev.grill, 0);
  assert.equal(rev.layersLeft, 0);
  assert.deepEqual(r.state.grills[0].slots.map((x) => x && x.food), ['corn', 'corn', 'beef']);
  assert.ok(rev.items.every((it) => it.id >= 1));
  // ids keep increasing
  const maxBefore = Math.max(...s.grills.flatMap((g) => g.slots.filter(Boolean).map((x) => x.id)));
  assert.ok(rev.items.every((it) => it.id > maxBefore));

  // emptying by moving away also reveals
  const lvl2 = level(['s../kkb', 'ss.', 'b.k', 'bk.', '...']);
  const r2 = applyMove(createState(lvl2), mv(0, 0, 1, 2));
  assert.ok(r2.events.some((e) => e.type === 'reveal' && e.grill === 0));
});

test('a reveal that lands a triple matches as a chain', () => {
  // corn under g0 is a full triple: clearing the shrimp flips it up and it clears at once
  const lvl = level(['ss./kkk', 's..', 'bb.', 'b..']);
  const r = applyMove(createState(lvl), mv(1, 0, 0, 2));
  const matches = r.events.filter((e) => e.type === 'match');
  assert.deepEqual(matches.map((m) => [m.food, m.chain]), [['shrimp', 0], ['corn', 1]]);
  assert.equal(r.state.combo, 2);
});

test('action encoding round-trips', () => {
  const a = mv(1, 2, 3, 0);
  assert.equal(encodeAction(a), 'm1.2-3.0');
  assert.deepEqual(decodeAction('m1.2-3.0'), a);
  const b = { type: 'booster', booster: 'tongs', from: { grill: 2, slot: 1 }, to: { grill: 0, slot: 0 } };
  assert.deepEqual(decodeAction(encodeAction(b)), b);
  assert.deepEqual(decodeAction('bfan'), { type: 'booster', booster: 'fan' });
  const list = [a, b, { type: 'booster', booster: 'fan' }];
  assert.deepEqual(decodeActions(encodeActions(list)), list);
  assert.throws(() => decodeAction('x1'));
});

test('serialize / deserialize is lossless', () => {
  let s = createState(level(['ss./kkb', 's..', 'b.k#1', 'bk.', 'T:..']));
  s = applyMove(s, mv(1, 0, 0, 2)).state;
  const d = JSON.parse(JSON.stringify(serializeState(s)));
  const back = deserializeState(d);
  assert.deepEqual(back, s);
  assert.equal(hashState(back), hashState(s));
});

test('hash ignores slot order, grill order and item ids; sees everything else', () => {
  const a = createState(level(['sb.', 'bs.', 'k..', 'kk.']));
  const b = createState(level(['kk.', '.bs', 'k..', 'bs.']));
  assert.equal(canonicalKey(a), canonicalKey(b));
  assert.equal(hashState(a), hashState(b));
  const c = cloneState(a);
  c.movesLeft -= 1;
  assert.notEqual(hashState(a), hashState(c));
  assert.equal(canonicalKey(a, { solver: true }), canonicalKey(c, { solver: true }), 'solver key ignores moves');
  const d = createState(level(['sb.', 'bs.', 'k..', 'kk.#1']));
  assert.notEqual(hashState(a), hashState(d), 'lock matters');
});

test('rules are data-driven: category matcher', () => {
  // shrimp + salmon are both seafood
  const lvl = level(['sl.', 's..', 'bb.', 'b..'], { rules: { matcher: 'category' }, goals: [{ type: 'complete_matches', count: 2 }] });
  const r = applyMove(createState(lvl), mv(1, 0, 0, 2));
  const m = r.events.find((e) => e.type === 'match');
  assert.ok(m);
  assert.equal(m.key, 'seafood');
  assert.deepEqual(m.foods.sort(), ['salmon', 'shrimp', 'shrimp']);
});
