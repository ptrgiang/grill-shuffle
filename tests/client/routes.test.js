import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, levelPath, levelPosition, packSlug, RESERVED_SLUGS } from '../../client/game/routes.js';

const PACKS = [
  { id: 'street_bbq', name: 'Street BBQ', levels: ['street-001', 'street-002', 'street-003', 'street-014', 'street-004'] },
  { id: 'beach_grill', name: 'Beach Grill', levels: ['beach-001', 'beach-002'] },
  { id: 'night_market', slug: 'night', name: 'Night Market', levels: ['night-001'] },
];

test('routes: /<pack-slug>/<n> is the position inside the pack, as shown on screen', () => {
  assert.deepEqual(parseRoute('/street-bbq/4', PACKS), { name: 'play', id: 'street-014' });
  assert.deepEqual(parseRoute('/street-bbq/5/', PACKS), { name: 'play', id: 'street-004' });
  assert.deepEqual(parseRoute('/beach-grill/2', PACKS), { name: 'play', id: 'beach-002' });
  assert.deepEqual(parseRoute('/night/1', PACKS), { name: 'play', id: 'night-001' }); // pack.json slug wins
  assert.deepEqual(parseRoute('/street-bbq/0', PACKS), { name: 'play', missing: true });
  assert.deepEqual(parseRoute('/beach-grill/3', PACKS), { name: 'play', missing: true });
  assert.deepEqual(parseRoute('/nowhere/1', PACKS), { name: 'menu' });
  assert.deepEqual(parseRoute('/street-bbq/x', PACKS), { name: 'menu' });
});

test('routes: old /level/<n> links always mean Street BBQ, whatever the pack order', () => {
  assert.deepEqual(parseRoute('/level/4', PACKS), { name: 'play', id: 'street-014' });
  assert.deepEqual(parseRoute('/level/4', [...PACKS].reverse()), { name: 'play', id: 'street-014' });
  assert.deepEqual(parseRoute('/level/6', PACKS), { name: 'play', missing: true });
  assert.deepEqual(parseRoute('/level/x', PACKS), { name: 'menu' });
});

test('routes: old id URLs, continue, codes and pages still parse; reserved words are never packs', () => {
  assert.deepEqual(parseRoute('/play/street-004', PACKS), { name: 'play', id: 'street-004' });
  assert.deepEqual(parseRoute('/play', PACKS), { name: 'play' });
  assert.deepEqual(parseRoute('/p/S1038', PACKS), { name: 'code', code: 'S1038' });
  assert.deepEqual(parseRoute('/', PACKS), { name: 'menu' });
  assert.deepEqual(parseRoute('/levels', PACKS), { name: 'levels' });
  assert.deepEqual(parseRoute('/levels/beach-grill', PACKS), { name: 'levels', pack: 'beach-grill' }, 'a pack tab');
  assert.deepEqual(parseRoute('/levels/night', PACKS), { name: 'levels', pack: 'night' }, 'custom slug');
  assert.deepEqual(parseRoute('/levels/nope', PACKS), { name: 'levels' }, 'unknown tab: the default one');
  assert.deepEqual(parseRoute('/daily', PACKS), { name: 'daily' });
  const evil = [{ id: 'sandbox', levels: ['x-001'] }];
  assert.deepEqual(parseRoute('/sandbox/1', evil), { name: 'menu' });
  for (const w of ['levels', 'level', 'play', 'daily', 'p', 'sandbox', 'api']) assert.ok(RESERVED_SLUGS.includes(w));
});

test('routes: levelPath round-trips every story level of every pack', () => {
  for (const pack of PACKS)
    pack.levels.forEach((id, i) => {
      assert.equal(levelPath(PACKS, id), `/${packSlug(pack)}/${i + 1}`);
      assert.equal(parseRoute(levelPath(PACKS, id), PACKS).id, id);
      assert.deepEqual(levelPosition(PACKS, id), { pack, n: i + 1 });
    });
  assert.equal(levelPath(PACKS, 'street-014'), '/street-bbq/4');
  assert.equal(levelPath(PACKS, 'daily-2026-10-07'), null);
  assert.equal(packSlug({ id: 'street_bbq' }), 'street-bbq');
});
