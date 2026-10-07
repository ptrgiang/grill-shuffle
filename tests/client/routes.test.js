import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, levelPath } from '../../client/game/routes.js';

const STORY = ['street-001', 'street-002', 'street-003', 'street-014', 'street-004'];

test('routes: /level/<n> is the play position shown on screen', () => {
  assert.deepEqual(parseRoute('/level/4', STORY), { name: 'play', id: 'street-014' });
  assert.deepEqual(parseRoute('/level/5/', STORY), { name: 'play', id: 'street-004' });
  assert.deepEqual(parseRoute('/level/0', STORY), { name: 'play', missing: true });
  assert.deepEqual(parseRoute('/level/6', STORY), { name: 'play', missing: true });
  assert.deepEqual(parseRoute('/level/x', STORY), { name: 'menu' });
});

test('routes: old id URLs, continue, codes and pages still parse', () => {
  assert.deepEqual(parseRoute('/play/street-004', STORY), { name: 'play', id: 'street-004' });
  assert.deepEqual(parseRoute('/play', STORY), { name: 'play' });
  assert.deepEqual(parseRoute('/p/S1038', STORY), { name: 'code', code: 'S1038' });
  assert.deepEqual(parseRoute('/', STORY), { name: 'menu' });
  assert.deepEqual(parseRoute('/levels', STORY), { name: 'levels' });
  assert.deepEqual(parseRoute('/daily', STORY), { name: 'daily' });
});

test('routes: levelPath round-trips every story level', () => {
  STORY.forEach((id, i) => {
    assert.equal(levelPath(STORY, id), `/level/${i + 1}`);
    assert.equal(parseRoute(levelPath(STORY, id), STORY).id, id);
  });
  assert.equal(levelPath(STORY, 'daily-2026-10-07'), null);
});
