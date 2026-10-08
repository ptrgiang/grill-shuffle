// scripts/variant-shots.js (specs, labels, comment) and client/ui/variant.js (the ?variant switch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLabels, variantPage, commentBody, paramOf } from '../../scripts/variant-shots.js';
import { parsePage, addQuery, withSection } from '../../scripts/lib/shots.js';
import { variantFrom, initVariant, variant } from '../../client/ui/variant.js';

test('variant-shots: one capture per variant, flags kept, before the #fragment', () => {
  const v = variantPage(parsePage('/levels?fixtures=1#pack-test_mint@390x844m+unlock'), 3);
  assert.equal(v.name, 'levels-fixtures-1-pack-test-mint-390x844-v3');
  assert.equal(v.url, '/levels?fixtures=1&freeze=1&quality=high&coach=0&variant=3#pack-test_mint');
  assert.deepEqual([v.w, v.h, v.mobile, v.unlock, v.variant], [390, 844, true, true, 3]);
  assert.equal(addQuery('/', 'variant=1'), '/?variant=1');
});

test('variant-shots: labels and the comment', () => {
  assert.deepEqual(parseLabels('1:Road, 2: Long scroll ,x,5:Notebook'), { 1: 'Road', 2: 'Long scroll', 5: 'Notebook' });
  assert.deepEqual(parseLabels(undefined), {});
  const body = commentBody({ issue: 84, sha: 'abc1234', branch: 'feat/journey-map', count: 5, labels: { 1: 'Road', 3: 'Postcards' }, sheets: [{ spec: '/levels@390x844m', name: 'levels-390x844', url: 'https://x/y.png' }] });
  assert.match(body, /^## 5 variants for #84/);
  assert.match(body, /\*\*1\*\* Road · \*\*3\*\* Postcards/);
  assert.match(body, /!\[levels-390x844\]\(https:\/\/x\/y\.png\)/);
  assert.match(body, /Reply with the variant number/);
  const c = withSection('', 'A', 'variant-shots').trimStart();
  assert.equal(c, '<!-- variant-shots:start -->\nA\n<!-- variant-shots:end -->\n');
  assert.equal(withSection(c, 'B', 'variant-shots'), '<!-- variant-shots:start -->\nB\n<!-- variant-shots:end -->\n');
});

test('client variant switch: 1..9 only, read once, mirrored on <html>', () => {
  assert.equal(variantFrom('?variant=3'), 3);
  assert.equal(variantFrom('?a=1&variant=9'), 9);
  for (const bad of ['', '?variant=0', '?variant=10', '?variant=2.5', '?variant=x', undefined]) assert.equal(variantFrom(bad), 0, String(bad));
  const root = { dataset: {} };
  assert.equal(initVariant({ search: '?variant=4' }, root), 4);
  assert.equal(variant(), 4);
  assert.equal(root.dataset.variant, '4');
  const plain = { dataset: {} };
  assert.equal(initVariant({ search: '' }, plain), 0);
  assert.equal(variant(), 0);
  assert.equal(plain.dataset.variant, undefined);
});

test('variant-shots: sets (several decisions in one issue)', () => {
  assert.equal(paramOf(null), 'variant');
  assert.equal(paramOf('font'), 'v-font');
  assert.equal(variantPage(parsePage('/@390x844m'), 2, 'font').url, '/?freeze=1&quality=high&coach=0&v-font=2');
  assert.match(commentBody({ issue: 89, sha: 'a', branch: 'b', count: 5, labels: {}, sheets: [], set: 'font' }), /^## 5 variants for #89: font/);
  initVariant({ search: '?v-font=3&v-switch=5' }, { dataset: {} });
  assert.deepEqual([variant('font'), variant('switch'), variant('other'), variant()], [3, 5, 0, 0]);
});
