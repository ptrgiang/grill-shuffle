// Pack / level unlocks (client/game/unlock.js): previous pack finished + theme star requirement, never re-locks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storyStars, packStatus, levelOpen, nextStoryLevel, nextLevelAfter, lockReason } from '../../client/game/unlock.js';

const packs = [
  { id: 'street', name: 'Street BBQ', theme: 'street', levels: ['s1', 's2', 's3'] },
  { id: 'beach', name: 'Beach Grill', theme: 'beach', levels: ['b1', 'b2'] },
  { id: 'night', name: 'Night Market', theme: 'night', levels: ['n1'] },
];
const themes = { street: { unlock: { stars: 0 } }, beach: { unlock: { stars: 7 } }, night: {} };
const won = (...pairs) => Object.fromEntries(pairs.map(([id, stars]) => [id, { stars }]));

test('unlock: first pack open, later packs locked on a fresh save', () => {
  assert.equal(packStatus(packs, 0, {}, themes).open, true);
  const b = packStatus(packs, 1, {}, themes);
  assert.deepEqual([b.open, b.previousDone, b.need, b.have], [false, false, 7, 0]);
  assert.equal(lockReason(b), 'Finish Street BBQ and earn ★ 7');
  assert.equal(levelOpen(packs, 'b1', {}, themes), false);
  assert.equal(levelOpen(packs, 's1', {}, themes), true);
  assert.equal(levelOpen(packs, 's2', {}, themes), false);
});

test('unlock: previous pack finished but not enough stars -> still locked, says how many', () => {
  const p = won(['s1', 2], ['s2', 2], ['s3', 2]);
  const b = packStatus(packs, 1, p, themes);
  assert.deepEqual([b.open, b.previousDone, b.have], [false, true, 6]);
  assert.equal(lockReason(b), 'Earn ★ 7 (you have ★ 6)');
  assert.equal(nextLevelAfter(packs, 's3', p, themes), null, 'no "Next level" into a locked pack');
  assert.equal(nextStoryLevel(packs, p, themes), 's3', 'continue stays on the last open level');
});

test('unlock: finished + stars -> open; next level crosses the pack boundary', () => {
  const p = won(['s1', 3], ['s2', 2], ['s3', 2]);
  assert.equal(packStatus(packs, 1, p, themes).open, true);
  assert.equal(lockReason(packStatus(packs, 1, p, themes)), null);
  assert.equal(nextLevelAfter(packs, 's3', p, themes), 'b1');
  assert.equal(nextStoryLevel(packs, p, themes), 'b1');
  assert.equal(levelOpen(packs, 'b2', p, themes), false, 'inside a pack levels still open one by one');
});

test('unlock: a pack without unlock.stars only needs the previous pack', () => {
  const p = won(['s1', 3], ['s2', 3], ['s3', 3], ['b1', 1], ['b2', 1]);
  assert.equal(packStatus(packs, 2, p, themes).open, true);
  assert.equal(lockReason(packStatus(packs, 2, won(['s1', 3]), themes)), 'Finish Beach Grill');
});

test('unlock: an appended level or dailies never lock a pack the player already plays', () => {
  const appended = [{ ...packs[0], levels: [...packs[0].levels, 's4'] }, packs[1]];
  const p = won(['s1', 3], ['s2', 3], ['s3', 3], ['b1', 2]);
  assert.equal(packStatus(appended, 1, p, themes).open, true, 'b1 has a star: stays open');
  assert.equal(levelOpen(appended, 's4', p, themes), true, 'the new level opens after s3');
  assert.equal(storyStars(packs, { ...p, 'daily:2026-10-08': { stars: 3 } }), 11, 'daily stars do not count');
});

test('unlock: a single pack behaves like before (continue = first level without a star)', () => {
  const one = [packs[0]];
  assert.equal(nextStoryLevel(one, {}, themes), 's1');
  assert.equal(nextStoryLevel(one, won(['s1', 1]), themes), 's2');
  assert.equal(nextStoryLevel(one, won(['s1', 1], ['s2', 1], ['s3', 1]), themes), 's3');
});
