// Content rules (#62): append-only packs and the never-easier curve. Pure checks; validate-levels.js runs them on
// the real packs against the base revision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAppendOnly, checkCurve, checkCurveFrom, packMaxDifficulty } from '../../scripts/lib/content-rules.js';
import { loadPacks } from '../../scripts/lib/content.js';

const base = ['a', 'b', 'c'];

test('append only: appending passes, inserting / reordering / removing fails', () => {
  assert.deepEqual(checkAppendOnly('p', base, ['a', 'b', 'c', 'd']), []);
  assert.deepEqual(checkAppendOnly('p', base, base), []);
  assert.deepEqual(checkAppendOnly('p', null, ['x']), []); // a new pack has no base
  assert.match(checkAppendOnly('p', base, ['a', 'x', 'b', 'c'])[0], /#2 was b, now x/); // inserted in the middle
  assert.match(checkAppendOnly('p', base, ['a', 'c', 'b'])[0], /#2 was b, now c/); // reordered
  assert.match(checkAppendOnly('p', base, ['a', 'c'])[0], /b \(#2\) was removed/);
  assert.match(checkAppendOnly('p', base, ['a', 'b'])[0], /c \(#3\) was removed/);
});

test('curve: never easier than the max so far, ties allowed, the frozen prefix only counts towards the max', () => {
  const lv = (...ds) => ds.map((difficulty, i) => ({ id: `l${i + 1}`, difficulty }));
  assert.deepEqual(checkCurve('p', lv(15, 20, 20, 33)), []);
  const e = checkCurve('p', lv(15, 30, 18, 40));
  assert.equal(e.length, 1);
  assert.match(e[0], /l3 \(#3\) difficulty 18 < 30, the max so far \(l2, #2\)/);
  // a breather after the max is caught even when the next level is harder again
  assert.equal(checkCurve('p', lv(15, 30, 31, 25, 40)).length, 1);
  // legacy prefix (curveFrom 4): dips inside 1-3 are allowed, but #4+ must reach the prefix's max
  assert.deepEqual(checkCurve('p', lv(30, 10, 20, 30, 31), 4), []);
  assert.match(checkCurve('p', lv(30, 10, 20, 29), 4)[0], /l4 \(#4\) difficulty 29 < 30/);
  assert.equal(packMaxDifficulty(lv(15, 58, 40)), 58);
});

test('curveFrom can only exempt levels the base already shipped', () => {
  const b50 = { levels: Array.from({ length: 50 }, (_, i) => `s${i}`) };
  assert.deepEqual(checkCurveFrom('p', { curveFrom: 51 }, b50), []); // one-time: exempt what shipped
  assert.match(checkCurveFrom('p', { curveFrom: 52 }, b50)[0], /at most 51/);
  assert.match(checkCurveFrom('p', { curveFrom: 60 }, { ...b50, levels: [...b50.levels, 'n1'], curveFrom: 51 })[0], /at most 51/); // never raised later
  assert.match(checkCurveFrom('p', { curveFrom: 3 }, null)[0], /at most 1/); // a new pack starts the rule at #1
  assert.deepEqual(checkCurveFrom('p', {}, null), []);
});

test('shipped packs: Street BBQ keeps its 50 legacy levels exempt, from #51 the rule applies', () => {
  const street = loadPacks().find((p) => p.pack.id === 'street_bbq');
  assert.equal(street.pack.curveFrom, 51);
  for (const { pack, levels } of loadPacks()) assert.deepEqual(checkCurve(pack.id, levels.map(({ id, level }) => ({ id, difficulty: level.solver.difficulty })), pack.curveFrom ?? 1), []);
});

test('content: tools and the client agree on story order (pack.json `order`, then id)', async () => {
  const { loadPacks } = await import('../../scripts/lib/content.js');
  const packs = loadPacks().map((p) => p.pack);
  const sorted = [...packs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
  assert.deepEqual(packs.map((p) => p.id), sorted.map((p) => p.id));
  assert.equal(packs[0].id, 'street_bbq', 'Street BBQ plays first');
});

test('content rules: a pack holds at most 50 levels', async () => {
  const { checkPackSize, MAX_PACK_LEVELS } = await import('../../scripts/lib/content-rules.js');
  assert.equal(MAX_PACK_LEVELS, 50);
  assert.deepEqual(checkPackSize('p', Array.from({ length: 50 }, (_, i) => `l${i}`)), []);
  assert.match(checkPackSize('p', Array.from({ length: 51 }, (_, i) => `l${i}`)).join(), /51 levels, a pack holds at most 50/);
});
