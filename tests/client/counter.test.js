// The counter above the board (client/story/counter-model.js, #116): orders, Út serving, direct plates when he is
// busy, customers eating / ordering again / leaving / arriving only for foods still on the board, cheer / win / lose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCounter, serve, tick, cheer, wow, win, lose, busy, T } from '../../client/story/counter-model.js';
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

test('counter: the plate goes up to the cart, Út carries it to who ordered it; they eat and order again', () => {
  const c = createCounter({ foods: { shrimp: 6, beef: 3, corn: 3 }, seats: 3, seed: 4 });
  const who = c.seats.find((s) => s.order === 'beef');
  serve(c, 'beef');
  assert.equal(c.plates[0].to, 'cart');
  const cues = run(c, T.fly + T.pick + T.walk + T.hand + 0.15);
  assert.ok(cues.includes('step') && cues.includes('clink'), cues.join(','));
  assert.equal(who.phase, 'eating');
  assert.equal(who.eating, 'beef');
  run(c, T.back + T.eat + 0.2);
  assert.equal(c.ut.phase, 'home');
  assert.equal(who.phase, 'waiting', 'still hungry: the same customer orders again');
  assert.notEqual(who.order, 'beef', 'no more beef on the board: nobody orders it');
  assert.equal(busy(c), false);
});

test('counter: every match is one delivery, also when matches come faster than Út walks', () => {
  const foods = { shrimp: 9, beef: 9, corn: 9, squid: 9 };
  const c = createCounter({ foods, seats: 2, seed: 7 });
  const order = ['shrimp', 'beef', 'corn', 'squid', 'shrimp', 'beef', 'corn', 'squid', 'shrimp', 'beef', 'corn', 'squid'];
  let clinks = 0;
  order.forEach((f, i) => {
    serve(c, f);
    clinks += run(c, i % 3 === 0 ? 0.3 : 1.1).filter((n) => n === 'clink').length; // bursts of combos, then pauses
  });
  for (let k = 0; k < 400 && busy(c); k++) clinks += run(c, 0.5).filter((n) => n === 'clink').length;
  assert.equal(c.served, order.length, 'every trio reached a customer');
  assert.equal(clinks, order.length);
  assert.equal(c.queue.length, 0);
  const guests = c.guests;
  assert.ok(guests < order.length, `few customers served many times (${guests} customers, ${order.length} plates)`);
});

test('counter: while Út is out, plates wait on the cart and he hurries', () => {
  const c = createCounter({ foods: { shrimp: 6, beef: 3, corn: 3 }, seats: 3, seed: 4 });
  serve(c, 'beef');
  run(c, T.fly + 0.05);
  serve(c, 'corn');
  serve(c, 'shrimp');
  run(c, T.fly + 0.05);
  assert.equal(c.queue.length, 2, 'two plates wait for Út');
  for (let k = 0; k < 100 && c.ut.phase !== 'pick'; k++) run(c, 0.05);
  assert.equal(c.queue.length, 1, 'Út took the next one');
  assert.ok(c.ut.d.walk < T.walk, 'one more waits: he walks faster');
});

test('counter: a plate with nobody seated waits until someone comes; reduced motion never sends Út walking', () => {
  const c = createCounter({ foods: { shrimp: 3 }, seats: 1, seed: 1 });
  c.seats[0].appetite = 1;
  serve(c, 'shrimp');
  run(c, T.fly + T.pick + T.walk + T.hand + T.eat + 0.3);
  assert.equal(c.seats[0].phase, 'leaving', 'ate their fill, nothing left on the board');
  serve(c, 'shrimp'); // a late trio (the counter can lag the board)
  for (let k = 0; k < 200 && busy(c); k++) run(c, 0.1);
  assert.equal(c.served, 2, 'someone came for the waiting plate');
  const r = createCounter({ foods: { shrimp: 6 }, seats: 2, seed: 1, carry: false });
  serve(r, 'shrimp');
  serve(r, 'shrimp');
  run(r, T.fly + T.direct + 0.1);
  assert.equal(r.ut.phase, 'off');
  assert.equal(r.served, 2);
});

test('counter: a booster makes the customers look up for a moment; it never cuts a cheer or a win short', () => {
  const c = createCounter({ foods: { shrimp: 6 }, seats: 2, seed: 2 });
  wow(c);
  assert.equal(c.mood.phase, 'wow');
  assert.equal(busy(c), true);
  run(c, T.cheer + 0.1);
  assert.equal(c.mood.phase, 'idle');
  cheer(c);
  wow(c);
  assert.equal(c.mood.phase, 'cheer');
  win(c);
  wow(c);
  assert.equal(c.mood.phase, 'won');
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

test('counter: after a restart / undo the counter is seated from the board as it is now', async () => {
  const { stateFoods } = await import('../../client/story/counter.js');
  const { createState } = await import('../../shared/state.js');
  const level = loadPacks()[0].levels.find((l) => l.level.board.grills.some((g) => g.layers)).level;
  assert.deepEqual(stateFoods(createState(level)), boardFoods(level), 'a fresh state holds the whole board');
  const s = createState(level);
  s.grills[0].slots[0] = null; // an item gone (a match undone later puts it back)
  const left = stateFoods(s);
  assert.equal(Object.values(left).reduce((a, b) => a + b, 0), Object.values(boardFoods(level)).reduce((a, b) => a + b, 0) - 1);
});
