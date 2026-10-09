// The counter above the board (client/story/counter-model.js, #116): orders, Út serving, direct plates when he is
// busy, customers eating / leaving / arriving only for foods still on the board, cheer / win / lose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCounter, serve, tick, cheer, win, lose, busy, T } from '../../client/story/counter-model.js';
import { boardFoods } from '../../client/story/counter.js';
import { loadPacks } from '../../scripts/lib/content.js';

const run = (c, secs) => {
  const cues = [];
  for (let t = 0; t < secs; t += 0.05) cues.push(...tick(c, 0.05));
  return cues.map((q) => q.name);
};

test('counter: every seat orders a food that is on the board, different ones while possible', () => {
  const c = createCounter({ foods: { shrimp: 6, beef: 3, corn: 3 }, seats: 3, seed: 4 });
  const orders = c.seats.map((s) => s.order);
  assert.equal(new Set(orders).size, 3);
  for (const o of orders) assert.ok(['shrimp', 'beef', 'corn'].includes(o));
  assert.ok(c.seats.every((s) => s.phase === 'waiting'));
  assert.equal(busy(c), false, 'nothing moves before the first match');
});

test('counter: Út carries a trio to the customer who ordered it, they eat, leave, and someone new sits down', () => {
  const c = createCounter({ foods: { shrimp: 6, beef: 3, corn: 3 }, seats: 3, seed: 4 });
  const who = c.seats.find((s) => s.order === 'beef');
  assert.equal(serve(c, 'beef'), who);
  assert.equal(c.ut.phase, 'fetch');
  const cues = run(c, T.fly + T.walk + T.hand + 0.1);
  assert.ok(cues.includes('step') && cues.includes('clink'), cues.join(','));
  assert.equal(who.phase, 'eating');
  assert.equal(who.eating, 'beef');
  run(c, T.back + T.eat + T.leave + T.arrive + 0.2);
  assert.equal(c.ut.phase, 'home');
  assert.equal(who.phase, 'waiting', 'a new customer took the stool');
  assert.notEqual(who.order, 'beef', 'no more beef on the board: nobody orders it');
  assert.equal(busy(c), false);
});

test('counter: while Út is out, the next plate flies straight to its customer', () => {
  const c = createCounter({ foods: { shrimp: 6, beef: 3, corn: 3 }, seats: 3, seed: 4 });
  serve(c, 'beef');
  const s2 = serve(c, 'corn');
  assert.equal(c.plates.at(-1).to, s2.i);
  run(c, T.direct + 0.05);
  assert.equal(s2.phase, 'eating');
});

test('counter: a trio nobody waits for goes to a passer-by; reduced motion never sends Út walking', () => {
  const c = createCounter({ foods: { shrimp: 3 }, seats: 1, seed: 1 });
  serve(c, 'shrimp');
  assert.equal(serve(c, 'shrimp'), null, 'the only customer already has a plate coming');
  const r = createCounter({ foods: { shrimp: 6 }, seats: 2, seed: 1, carry: false });
  serve(r, 'shrimp');
  assert.equal(r.ut.phase, 'off');
  assert.equal(r.plates[0].to !== 'ut', true);
  run(r, 1);
  assert.equal(busy(r) || r.seats.some((s) => s.phase === 'eating'), true);
});

test('counter: cheer, win and lose', () => {
  const c = createCounter({ foods: { shrimp: 6 }, seats: 2, seed: 2 });
  cheer(c);
  assert.equal(busy(c), true);
  run(c, T.cheer + 0.1);
  assert.equal(c.mood.phase, 'idle');
  assert.deepEqual(lose(c).map((q) => q.name), ['meow']);
  assert.equal(c.cat.phase, 'steal');
  win(c);
  assert.equal(c.mood.phase, 'won');
});

test('counter: board foods count every slot and stacked layer of a shipped level', () => {
  const level = loadPacks()[0].levels.find((l) => l.level.board.grills.some((g) => g.layers)).level;
  const counts = boardFoods(level);
  const total = level.board.grills.reduce((n, g) => n + g.slots.filter(Boolean).length + (g.layers ?? []).flat().filter(Boolean).length, 0);
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), total);
});
