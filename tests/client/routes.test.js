import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, levelPath, levelsPath, levelPosition, packSlug, packSlugs, RESERVED_SLUGS } from '../../client/game/routes.js';
import { setLang } from '../../client/i18n/index.js';

const PACKS = [
  { id: 'street_bbq', slugs: { vi: 'hem-sai-gon', en: 'saigon-alley' }, levels: ['street-001', 'street-002', 'street-003', 'street-014', 'street-004'] },
  { id: 'beach_grill', slugs: { vi: 'lang-chai', en: 'fishing-village' }, levels: ['beach-001', 'beach-002'] },
  { id: 'test_mint', levels: ['mint-001'] }, // no slugs (fixture): its id with dashes in both languages
];

test('routes: /<slug>/<n> is the position inside the pack; either language opens it', () => {
  assert.deepEqual(parseRoute('/hem-sai-gon/4', PACKS), { name: 'play', id: 'street-014' });
  assert.deepEqual(parseRoute('/saigon-alley/4', PACKS), { name: 'play', id: 'street-014' });
  assert.deepEqual(parseRoute('/saigon-alley/5/', PACKS), { name: 'play', id: 'street-004' });
  assert.deepEqual(parseRoute('/lang-chai/2', PACKS), { name: 'play', id: 'beach-002' });
  assert.deepEqual(parseRoute('/fishing-village/2', PACKS), { name: 'play', id: 'beach-002' });
  assert.deepEqual(parseRoute('/test-mint/1', PACKS), { name: 'play', id: 'mint-001' });
  assert.deepEqual(parseRoute('/hem-sai-gon/0', PACKS), { name: 'play', missing: true });
  assert.deepEqual(parseRoute('/lang-chai/3', PACKS), { name: 'play', missing: true });
  assert.deepEqual(parseRoute('/nowhere/1', PACKS), { name: 'menu' });
  assert.deepEqual(parseRoute('/hem-sai-gon/x', PACKS), { name: 'menu' });
});

test('routes: old slugs and /level/<n> are gone (no players yet, owner 2026-10-08)', () => {
  assert.deepEqual(parseRoute('/street-bbq/4', PACKS), { name: 'menu' });
  assert.deepEqual(parseRoute('/level/4', PACKS), { name: 'menu' });
});

test('routes: id URLs, continue, codes, tabs and pages; reserved words are never packs', () => {
  assert.deepEqual(parseRoute('/play/street-004', PACKS), { name: 'play', id: 'street-004' });
  assert.deepEqual(parseRoute('/play', PACKS), { name: 'play' });
  assert.deepEqual(parseRoute('/p/S1038', PACKS), { name: 'code', code: 'S1038' });
  assert.deepEqual(parseRoute('/', PACKS), { name: 'menu' });
  assert.deepEqual(parseRoute('/levels', PACKS), { name: 'levels' });
  assert.deepEqual(parseRoute('/levels/lang-chai', PACKS), { name: 'levels', pack: 'beach_grill' });
  assert.deepEqual(parseRoute('/levels/fishing-village', PACKS), { name: 'levels', pack: 'beach_grill' });
  assert.deepEqual(parseRoute('/levels/nope', PACKS), { name: 'levels' }, 'unknown tab: the default one');
  assert.deepEqual(parseRoute('/daily', PACKS), { name: 'daily' });
  assert.deepEqual(parseRoute('/sandbox/1', [{ id: 'sandbox', levels: ['x-001'] }]), { name: 'menu' });
  for (const w of ['levels', 'level', 'play', 'daily', 'p', 'sandbox', 'api']) assert.ok(RESERVED_SLUGS.includes(w));
});

test('routes: links follow the language and round-trip every story level', () => {
  for (const l of ['en', 'vi']) {
    setLang(l);
    for (const pack of PACKS)
      pack.levels.forEach((id, i) => {
        assert.equal(levelPath(PACKS, id), `/${packSlug(pack)}/${i + 1}`);
        assert.equal(parseRoute(levelPath(PACKS, id), PACKS).id, id);
        assert.deepEqual(levelPosition(PACKS, id), { pack, n: i + 1 });
      });
  }
  setLang('vi');
  assert.equal(levelPath(PACKS, 'street-014'), '/hem-sai-gon/4');
  assert.equal(levelsPath(PACKS[1]), '/levels/lang-chai');
  setLang('en');
  assert.equal(levelPath(PACKS, 'street-014'), '/saigon-alley/4');
  assert.equal(levelPath(PACKS, 'street-014', 'vi'), '/hem-sai-gon/4', 'explicit language');
  assert.equal(levelsPath(PACKS[1]), '/levels/fishing-village');
  assert.equal(levelPath(PACKS, 'daily-2026-10-07'), null);
  assert.deepEqual(packSlugs({ id: 'test_mint' }), { vi: 'test-mint', en: 'test-mint' });
});
