// The journey map's model (client/game/journey.js): stops, the cart, Bà Năm one stop ahead, story marks on the road.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { journeyModel, storyMarks, JOURNEY_STOPS } from '../../client/game/journey.js';

const packs = [
  { id: 'street', name: 'Street BBQ', theme: 'street', levels: ['s1', 's2', 's3'] },
  { id: 'beach', name: 'Beach Grill', theme: 'beach', levels: ['b1', 'b2'] },
];
const themes = { street: {}, beach: { unlock: { stars: 6 } } };
const story = [
  { pack: 'street', beats: [{ id: 'a', at: { on: 'firstLaunch' } }, { id: 'b', at: { level: 's2', on: 'firstWin' } }, { id: 'c', at: { level: 's3', on: 'firstWin' }, reward: { recipePage: 1 } }], keepsakes: [{ id: 'k', level: 's1' }, { id: 'k2', level: 's2' }] },
];
const won = (...pairs) => Object.fromEntries(pairs.map(([id, stars]) => [id, { stars }]));

test('journey: marks: a recipe page beats a beat, a beat beats a keepsake', () => {
  assert.deepEqual([...storyMarks(story)].sort(), [['s1', 'keepsake'], ['s2', 'beat'], ['s3', 'page']]);
  assert.equal(storyMarks(undefined).size, 0);
});

test('journey: fresh save: the cart at stop 1, Bà Năm at stop 2, teasers up to the five stops', () => {
  const m = journeyModel(packs, {}, themes, story);
  assert.equal(m.stops.length, JOURNEY_STOPS);
  assert.deepEqual([m.cart, m.banam, m.next], [0, 1, 's1']);
  assert.deepEqual(m.stops.map((s) => [s.open, s.teaser, s.cart, s.banam]), [
    [true, false, true, false], [false, false, false, true], [false, true, false, false], [false, true, false, false], [false, true, false, false],
  ]);
  assert.deepEqual(m.stops[0].levels.map((l) => [l.n, l.open, l.current, l.mark]), [[1, true, true, 'keepsake'], [2, false, false, 'beat'], [3, false, false, 'page']]);
  assert.deepEqual([m.stars, m.total], [0, 15]);
});

test('journey: into the second pack: the cart moves on, Bà Năm ahead on a teaser stop', () => {
  const m = journeyModel(packs, won(['s1', 2], ['s2', 2], ['s3', 3]), themes, story);
  assert.deepEqual([m.cart, m.banam, m.next], [1, 2, 'b1']);
  assert.equal(m.stops[1].open, true);
  assert.equal(m.stops[2].teaser && m.stops[2].banam, true);
  assert.deepEqual([m.stops[0].stars, m.stops[0].total, m.stars], [7, 9, 7]);
});
