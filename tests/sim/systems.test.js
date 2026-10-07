import { test } from 'node:test';
import assert from 'node:assert/strict';
import { level, mv } from '../helpers/levels.js';
import { createState } from '../../shared/state.js';
import { applyAction, applyMove } from '../../shared/resolve.js';
import { canUseBooster } from '../../shared/boosters.js';
import { replay, verifyReplay } from '../../shared/replay.js';
import { hashState } from '../../shared/hash.js';
import { mulberry32, cyrb53, deriveSeed, seedFromString } from '../../shared/rng.js';
import { validateLevel } from '../../shared/levels.js';
import { moveBudget, starsFor, starThresholds, isUnlocked } from '../../shared/progression.js';
import { encodeGenerated, encodeStory, encodeDaily, decodeCode, normalizeCode, dailySeed, dayNumber, dateOfDay } from '../../shared/challenge.js';

test('goal: clear_food counts only its food; level ends when all goals are met', () => {
  const lvl = level(['ss.', 's..', 'bb.', 'b..'], { goals: [{ type: 'clear_food', food: 'shrimp', count: 3 }] });
  const r = applyMove(createState(lvl), mv(1, 0, 0, 2));
  assert.equal(r.state.goals[0].progress, 3);
  assert.equal(r.state.status, 'won');
});

test('goal: complete_matches, reach_score, clear_blocker, reveal_hidden', () => {
  const lvl = level(['ss./bbk', 's..', 'kk.#1', 'b..', '...'], {
    goals: [
      { type: 'complete_matches', count: 1 },
      { type: 'reach_score', count: 100 },
      { type: 'clear_blocker' },
      { type: 'reveal_hidden' },
    ],
  });
  assert.ok(validateLevel(lvl).ok, validateLevel(lvl).errors.join());
  const r = applyMove(createState(lvl), mv(1, 0, 0, 2));
  assert.deepEqual(r.state.goals.map((g) => [g.progress, g.target]), [[1, 1], [100, 100], [1, 1], [1, 1]]);
  assert.equal(r.state.status, 'won');
});

test('goal validation catches bad references', () => {
  const bad = (goals) => validateLevel(level(['ss.', 's..', 'bb.', 'b..'], { goals })).errors;
  assert.match(bad([{ type: 'clear_food', food: 'corn', count: 3 }]).join(), /only 0 corn/);
  assert.match(bad([{ type: 'clear_food', food: 'shrimp', count: 2 }]).join(), /multiple of 3/);
  assert.match(bad([{ type: 'clear_food', food: 'pizza', count: 3 }]).join(), /unknown food/);
  assert.match(bad([{ type: 'nope' }]).join(), /unknown type/);
  assert.match(bad([{ type: 'clear_blocker' }]).join(), /no locked grill/);
});

test('validator: structure, counts, starting matches, modifiers, boosters', () => {
  const v = (lvl) => validateLevel(lvl).errors.join(' | ');
  assert.equal(v(level(['ss.', 's..', 'bb.', 'b..'])), '');
  assert.match(v(level(['ss.', 'ss.', 'bb.', 'b..'])), /shrimp: 4 items/);
  assert.match(v(level(['sss', '...', 'bb.', 'b..'])), /starts with a match/);
  assert.match(v(level(['sbs', 'bsb'])), /no empty slot/);
  const pizza = level(['ss.', 's..', 'bb.', 'b..']);
  pizza.board.grills[3].slots[2] = 'pizza';
  assert.match(v(pizza), /unknown food/);
  const undeclared = level(['ss.', 's..', 'bb.#1', 'b..']);
  undeclared.modifiers = [];
  assert.match(v(undeclared), /locked_grill/);
  assert.match(v({ ...level(['ss.', 's..', 'bb.', 'b..']), boosters: { hammer: 1 } }), /unknown booster/);
  assert.match(v({ ...level(['ss.', 's..', 'bb.', 'b..']), moves: 0 }), /moves/);
  assert.match(v({ ...level(['ss.', 's..', 'bb.', 'b..']), id: 'Bad Id' }), /bad id/);
});

test('booster: tongs lifts an item out of a locked grill, costs no move', () => {
  const lvl = level(['ss.', 'bsk#3', 'bb.', 'k..', 'k..'], { boosters: { tongs: 1 } });
  let s = createState(lvl);
  const act = { type: 'booster', booster: 'tongs', from: { grill: 1, slot: 1 }, to: { grill: 0, slot: 2 } };
  assert.ok(canUseBooster(s, act));
  const r = applyAction(s, act);
  assert.ok(r.ok);
  assert.equal(r.state.boosters.tongs, 0);
  assert.equal(r.state.movesLeft, s.movesLeft);
  assert.ok(r.events.some((e) => e.type === 'match' && e.food === 'shrimp'));
  assert.equal(r.state.grills[1].lock, 2);
  assert.equal(applyAction(r.state, act).ok, false, 'no charges left');
});

test('booster: fan reshuffles deterministically', () => {
  const lvl = level(['sb.', 'kb.', 'sk.', 'bsk'], { boosters: { fan: 2 } });
  const s = createState(lvl);
  const a = applyAction(s, { type: 'booster', booster: 'fan' });
  const b = applyAction(s, { type: 'booster', booster: 'fan' });
  assert.ok(a.ok);
  assert.equal(hashState(a.state), hashState(b.state));
  assert.equal(a.state.boosters.fan, 1);
  const count = (st) => st.grills.flatMap((g) => g.slots).filter(Boolean).length;
  assert.equal(count(a.state) + a.state.goals[0].progress, count(s));
});

test('replay reproduces the final hash; illegal step is reported', () => {
  const lvl = level(['ss./kkb', 's..', 'b..', 'bk.', '...']);
  const moves = [mv(1, 0, 0, 2), mv(3, 0, 2, 1)];
  let s = createState(lvl);
  for (const m of moves) s = applyMove(s, m).state;
  const r = replay(lvl, moves);
  assert.ok(r.ok);
  assert.equal(r.hash, hashState(s));
  assert.ok(verifyReplay(lvl, 'm1.0-0.2 m3.0-2.1', hashState(s)));
  const bad = replay(lvl, 'm1.0-0.2 m1.0-0.2');
  assert.equal(bad.ok, false);
  assert.equal(bad.steps, 1);
});

test('rng: deterministic streams and hashes', () => {
  const a = mulberry32(123), b = mulberry32(123);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
  const r = mulberry32(7);
  for (let i = 0; i < 1000; i++) {
    const x = r.int(2, 5);
    assert.ok(x >= 2 && x <= 5 && Number.isInteger(x));
  }
  assert.equal(cyrb53('grill'), cyrb53('grill'));
  assert.notEqual(cyrb53('grill'), cyrb53('grilL'));
  assert.equal(deriveSeed(1, 'a', 2), deriveSeed(1, 'a', 2));
  assert.notEqual(deriveSeed(1, 'a', 2), deriveSeed(1, 'a', 3));
  // pinned values: if these change, every seeded level and challenge link changes
  assert.equal(seedFromString('grill-shuffle'), 3468901386);
  assert.equal(Math.floor(mulberry32(1)() * 1e9), 627073940);
});

test('progression: budgets and stars follow the solver minimum', () => {
  assert.deepEqual(['easy', 'normal', 'hard', 'expert'].map((t) => moveBudget(10, t)), [17, 14, 12, 11]);
  assert.deepEqual(starThresholds(10), { three: 11, two: 14 });
  assert.equal(starsFor(11, 10), 3);
  assert.equal(starsFor(12, 10), 2);
  assert.equal(starsFor(15, 10), 1);
  assert.equal(starsFor(15, 10, false), 0);
  assert.equal(isUnlocked(['a', 'b'], 1, {}), false);
  assert.equal(isUnlocked(['a', 'b'], 1, { a: { stars: 1 } }), true);
});

test('challenge codes round-trip and reject typos', () => {
  const g = encodeGenerated('N', 123456);
  assert.equal(g.length, 9);
  assert.deepEqual(decodeCode(g), { kind: 'generated', version: 1, band: 'N', seed: 123456, code: g });
  assert.deepEqual(decodeCode(g.toLowerCase()), decodeCode(g));
  const flipped = g.slice(0, 4) + (g[4] === 'A' ? 'B' : 'A') + g.slice(5);
  assert.equal(decodeCode(flipped), null);
  const s = encodeStory(7);
  assert.equal(decodeCode(s).index, 7);
  const d = encodeDaily('2026-10-07');
  assert.equal(decodeCode(d).date, '2026-10-07');
  assert.equal(dateOfDay(dayNumber('2027-03-01')), '2027-03-01');
  assert.equal(normalizeCode('g1-n0o'), 'G1N00');
  assert.equal(dailySeed('2026-10-07'), dailySeed('2026-10-07'));
  assert.notEqual(dailySeed('2026-10-07'), dailySeed('2026-10-08'));
  assert.equal(decodeCode('zz'), null);
});
