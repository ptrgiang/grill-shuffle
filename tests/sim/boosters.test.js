// Torch, Tray Swap, Cooler (#28): rules, events, encoding, replay. Tongs / fan: systems.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { level, mv } from '../helpers/levels.js';
import { createState } from '../../shared/state.js';
import { applyAction, applyMove } from '../../shared/resolve.js';
import { canUseBooster, hasUsableBooster, boosterActions, torchSet, BOOSTERS } from '../../shared/boosters.js';
import { encodeAction, decodeAction, encodeActions, decodeActions } from '../../shared/moves.js';
import { replay } from '../../shared/replay.js';
import { hashState } from '../../shared/hash.js';
import { validateLevel } from '../../shared/levels.js';

const B = (booster, from, to) => ({ type: 'booster', booster, ...(from ? { from } : {}), ...(to ? { to } : {}) });
const foods = (s) => s.grills.map((g) => g.slots.map((it) => it?.food ?? null));

test('boosters: every booster declares what it needs; levels may grant the new ones', () => {
  for (const b of Object.values(BOOSTERS)) assert.ok(['none', 'item', 'from+to', 'grill', 'grill+grill'].includes(b.needs), b.id);
  const lvl = level(['ss.', 's..', 'bb.', 'b..'], { boosters: { torch: 1, tray_swap: 2, cooler: 1 } });
  assert.ok(validateLevel(lvl).ok, validateLevel(lvl).errors.join());
});

test('torch: serves the chosen item + the nearest of its food (own grill first, then grill order) as one match', () => {
  //            0       1       2       3       4
  const lvl = level(['sbs', 'bk.', 'skk', 'bk.#1', '...'], { boosters: { torch: 1 }, goals: [{ type: 'clear_food', food: 'shrimp', count: 3 }, { type: 'complete_matches', count: 1 }] });
  const s = createState(lvl);
  assert.deepEqual(torchSet(s, { grill: 0, slot: 2 }), [{ grill: 0, slot: 2 }, { grill: 0, slot: 0 }, { grill: 2, slot: 0 }]);
  const r = applyAction(s, B('torch', { grill: 0, slot: 2 }));
  assert.ok(r.ok, r.reason);
  assert.deepEqual(foods(r.state)[0], [null, 'beef', null]);
  assert.equal(r.state.grills[2].slots[0], null);
  const m = r.events.find((e) => e.type === 'match');
  assert.deepEqual([m.food, m.grill, m.booster, m.chain, m.places.length, m.slots], ['shrimp', 0, 'torch', 0, 3, [2, 0]]);
  assert.equal(r.state.matches, 1);
  assert.equal(r.state.score, 100);
  assert.equal(r.state.movesUsed, 0, 'no move spent');
  assert.equal(r.state.boosters.torch, 0);
  assert.equal(r.state.grills[3].lock, 0, 'the served set counts against locks');
  assert.ok(r.events.some((e) => e.type === 'unlock' && e.grill === 3));
  assert.equal(r.state.status, 'won', 'goals count it');
});

test('torch: not without matchSize of that food in view; locked grills are out of reach', () => {
  const lvl = level(['sbk', 'bk.', 's..#2', 'sbk', '...'], { boosters: { torch: 1 } });
  const s = createState(lvl);
  assert.equal(torchSet(s, { grill: 0, slot: 0 }), null, 'only 2 shrimp on open grills');
  assert.equal(canUseBooster(s, B('torch', { grill: 2, slot: 0 })), false, 'target on a locked grill');
  assert.ok(canUseBooster(s, B('torch', { grill: 0, slot: 1 })), '3 beef in view');
  assert.equal(canUseBooster(s, B('torch', { grill: 4, slot: 0 })), false, 'empty slot');
});

test('torch: a reveal it causes chains on from it', () => {
  const lvl = level(['s./kkk', 's..', 's..', 'b..', 'bb.'], { boosters: { torch: 1 } });
  const r = applyAction(createState(lvl), B('torch', { grill: 0, slot: 0 }));
  assert.ok(r.ok);
  const matches = r.events.filter((e) => e.type === 'match');
  assert.deepEqual(matches.map((e) => [e.food, e.chain]), [['shrimp', 0], ['corn', 1]]);
  assert.equal(r.state.matches, 2);
});

test('tray swap: swaps two open grills of the same size, may make a match, may reveal', () => {
  const lvl = level(['T:sss', 'b../kc.', 'cbk', 'bk.#3', 'c..'], { boosters: { tray_swap: 3 } });
  const s = createState(lvl);
  assert.equal(canUseBooster(s, B('tray_swap', { grill: 0 }, { grill: 3 })), false, 'locked grill');
  assert.equal(canUseBooster(s, B('tray_swap', { grill: 0 }, { grill: 0 })), false, 'same grill');
  const r = applyAction(s, B('tray_swap', { grill: 0 }, { grill: 1 }));
  assert.ok(r.ok, r.reason);
  // the three shrimp leave the tray (never matches) for a grill: they match; grill 1 is then empty and reveals
  assert.ok(r.events.some((e) => e.type === 'match' && e.food === 'shrimp' && e.grill === 1));
  assert.deepEqual(foods(r.state)[0], ['beef', null, null]);
  assert.ok(r.events.some((e) => e.type === 'reveal' && e.grill === 1));
  assert.deepEqual(foods(r.state)[1], ['corn', 'chicken', null]);
  assert.equal(r.state.movesUsed, 0);
  const sizes = level(['ss..', 'b..', 'bb.', 's..'], { boosters: { tray_swap: 1 } });
  assert.equal(canUseBooster(createState(sizes), B('tray_swap', { grill: 0 }, { grill: 1 })), false, 'different sizes');
});

test('tray swap: burning items keep their counters; nothing ticks (no move)', () => {
  const lvl = level(['s3b.', 'b..', 'T:sb.', 's..'], { boosters: { tray_swap: 1 } });
  const r = applyAction(createState(lvl), B('tray_swap', { grill: 0 }, { grill: 2 }));
  assert.ok(r.ok);
  assert.equal(r.state.grills[2].slots[0].burn, 3);
});

test('cooler: every burning item on one open grill stops burning; nothing else changes', () => {
  const lvl = level(['s2b1.', 'b2..', 'sb.', 's..'], { boosters: { cooler: 1 } });
  const s = createState(lvl);
  assert.equal(canUseBooster(s, B('cooler', { grill: 2 })), false, 'nothing burns there');
  const r = applyAction(s, B('cooler', { grill: 0 }));
  assert.ok(r.ok, r.reason);
  assert.deepEqual(r.state.grills[0].slots.map((it) => it?.burn), [undefined, undefined, undefined]);
  assert.equal(r.state.grills[1].slots[0].burn, 2, 'other grills keep burning');
  const ev = r.events.find((e) => e.type === 'cooled');
  assert.deepEqual(ev.items.map((i) => i.food), ['shrimp', 'beef']);
  assert.equal(s.grills[0].slots[0].burn, 2, 'input state untouched');
  // the cooled food survives moves that would have charred it
  const next = applyMove(r.state, mv(3, 0, 2, 2));
  assert.notEqual(next.state.failReason, 'charred');
});

test('boosters: compact encoding of grill targets round-trips; replay reproduces the hash', () => {
  const list = [B('torch', { grill: 2, slot: 1 }), B('tray_swap', { grill: 0 }, { grill: 3 }), B('cooler', { grill: 4 })];
  assert.deepEqual(list.map(encodeAction), ['btorch:2.1', 'btray_swap:0-3', 'bcooler:4']);
  for (const a of list) assert.deepEqual(decodeAction(encodeAction(a)), a);
  assert.deepEqual(decodeActions(encodeActions(list)), list);
  const lvl = level(['s3bs', 'kb.', 'T:k..', 'skb', 'k..'], { boosters: { torch: 1, tray_swap: 1, cooler: 1 } });
  let s = createState(lvl);
  const acts = [B('cooler', { grill: 0 }), B('torch', { grill: 0, slot: 0 }), B('tray_swap', { grill: 1 }, { grill: 3 })];
  for (const a of acts) {
    const r = applyAction(s, a);
    assert.ok(r.ok, `${encodeAction(a)}: ${r.reason}`);
    s = r.state;
  }
  const rp = replay(lvl, encodeActions(acts));
  assert.ok(rp.ok, rp.error);
  assert.equal(rp.hash, hashState(s));
});

test('boosters: a board with no legal move is not lost while a booster still applies', () => {
  const lvl = level(['sbk', 'kbs', 'bsk'], { boosters: { torch: 1 } });
  const s = createState(lvl);
  assert.equal(boosterActions(s, 'torch').length, 9);
  assert.ok(hasUsableBooster(s));
  assert.equal(hasUsableBooster(createState({ ...lvl, boosters: { cooler: 1 } })), false, 'nothing burns');
  assert.deepEqual(boosterActions(createState({ ...lvl, boosters: { torch: 0 } }), 'torch'), []);
});
