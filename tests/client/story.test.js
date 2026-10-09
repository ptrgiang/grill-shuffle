// Story engine (client/game/story.js): trigger order, seen beats never replay, a returning player gets the cold open +
// one recap once (never a backlog), pack unlock beat once, keepsakes from first wins, and the content validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storyFor, beatsFor, addSeen, validateStory, storyIds, RECAP_ID } from '../../client/game/story.js';
import { checkText } from '../../scripts/lib/content-rules.js';
import { loadPacks, loadStory } from '../../scripts/lib/content.js';

const packs = [
  { id: 'street', theme: 'street', levels: ['s1', 's2', 's3', 's4'] },
  { id: 'beach', theme: 'beach', levels: ['b1', 'b2'] },
];
const themes = { street: {}, beach: { unlock: { stars: 0 } } };
const world = { packs, themes };
const txt = (s) => ({ vi: s, en: s });
const beat = (id, at, extra = {}) => ({ id, at, cast: ['ut'], scene: 'alley', title: txt(id), lines: [txt('…')], ...extra });
const story = [
  {
    pack: 'street',
    beats: [
      beat('cold', { on: 'firstLaunch' }),
      beat('notebook', { level: 's1', on: 'firstWin' }),
      beat('ch2', { level: 's2', on: 'firstWin' }),
      beat('ch2b', { level: 's2', on: 'firstWin' }),
      beat('page', { level: 's4', on: 'firstWin' }),
      beat('street-done', { pack: 'street', on: 'complete' }),
    ],
    keepsakes: [
      { id: 'k-photo', level: 's2', kind: 'photo', art: 'photo', lines: [txt('a photo')] },
      { id: 'k-note', level: 's3', kind: 'note', art: 'note', lines: [txt('a note')] },
    ],
  },
  { pack: 'beach', beats: [beat('arrival', { pack: 'beach', on: 'unlock' }), beat('b-ch', { level: 'b1', on: 'firstWin' })], keepsakes: [] },
];
const won = (...ids) => Object.fromEntries(ids.map((id) => [id, { stars: 1 }]));
const ids = (beats) => beats.map((b) => (b.recap ? `recap:${b.beats.map((m) => m.id).join(',')}` : b.id));

/** Plays an event like the client will: show what it triggers, then mark it seen. */
function play(save, event) {
  const r = storyFor(event, save, story, world);
  save.seen = addSeen(save.seen, r.seen);
  return { beats: ids(r.beats), keepsakes: r.keepsakes.map((k) => k.id) };
}

test('story: a new player gets the cold open on first launch, never again', () => {
  const save = { progress: {}, seen: [] };
  assert.deepEqual(play(save, { on: 'launch' }), { beats: ['cold'], keepsakes: [] });
  assert.deepEqual(play(save, { on: 'launch' }), { beats: [], keepsakes: [] });
});

test('story: wins trigger the level beats in file order, then keepsakes; seen beats never replay', () => {
  const save = { progress: {}, seen: [] };
  play(save, { on: 'launch' });
  save.progress = won('s1');
  assert.deepEqual(play(save, { on: 'win', level: 's1' }), { beats: ['notebook'], keepsakes: [] });
  assert.deepEqual(play(save, { on: 'win', level: 's1' }), { beats: [], keepsakes: [] }, 'replaying a level plays nothing');
  save.progress = won('s1', 's2');
  assert.deepEqual(play(save, { on: 'win', level: 's2' }), { beats: ['ch2', 'ch2b'], keepsakes: ['k-photo'] });
  save.progress = won('s1', 's2', 's3');
  assert.deepEqual(play(save, { on: 'win', level: 's3' }), { beats: [], keepsakes: ['k-note'] });
});

test('story: the last win of a pack plays its beat, the complete beat, then the next pack\'s arrival, once', () => {
  const save = { progress: won('s1', 's2', 's3'), seen: ['cold', 'notebook', 'ch2', 'ch2b', 'k-photo', 'k-note'] };
  save.progress = won('s1', 's2', 's3', 's4');
  assert.deepEqual(play(save, { on: 'win', level: 's4' }).beats, ['page', 'street-done', 'arrival']);
  assert.deepEqual(play(save, { on: 'win', level: 's4' }).beats, []);
  save.progress = won('s1', 's2', 's3', 's4', 'b1');
  assert.deepEqual(play(save, { on: 'win', level: 'b1' }).beats, ['b-ch'], 'arrival only once');
});

test('story: a locked pack has no arrival yet; a win elsewhere does not play other levels\' beats', () => {
  const save = { progress: won('s1', 's2'), seen: ['cold'] };
  const r = beatsFor({ on: 'win', level: 's2' }, save, story, world);
  assert.deepEqual(ids(r), ['ch2', 'ch2b'], 'the unseen s1 beat waits for the next launch recap, not this win');
  const locked = { ...world, themes: { ...themes, beach: { unlock: { stars: 99 } } } };
  assert.deepEqual(ids(beatsFor({ on: 'win', level: 's4' }, { progress: won('s1', 's2', 's3', 's4'), seen: [] }, story, locked)), ['page', 'street-done']);
});

test('story: a player already past chapters gets the cold open + ONE recap once, then only new beats', () => {
  const save = { progress: won('s1', 's2', 's3', 's4'), seen: [] };
  assert.deepEqual(play(save, { on: 'launch' }), {
    beats: ['cold', 'recap:notebook,ch2,ch2b,page,street-done,arrival'],
    keepsakes: ['k-photo', 'k-note'],
  });
  assert.ok(!save.seen.includes(RECAP_ID), 'the recap itself is not an id');
  assert.deepEqual(play(save, { on: 'launch' }), { beats: [], keepsakes: [] }, 'never a backlog');
  assert.deepEqual(play(save, { on: 'win', level: 's2' }).beats, [], 'recapped beats count as seen');
  save.progress = won('s1', 's2', 's3', 's4', 'b1');
  assert.deepEqual(play(save, { on: 'win', level: 'b1' }).beats, ['b-ch'], 'new beats play in full');
});

test('story: beats passed elsewhere (sync, new content) come back as a recap, after the cold open was seen', () => {
  const save = { progress: won('s1'), seen: ['cold', 'notebook'] };
  save.progress = won('s1', 's2'); // won on another device
  assert.deepEqual(play(save, { on: 'launch' }), { beats: ['recap:ch2,ch2b'], keepsakes: ['k-photo'] });
  assert.deepEqual(play(save, { on: 'launch' }).beats, []);
});

test('story: seen ids merge unique and sorted', () => {
  assert.deepEqual(addSeen(['b', 'a'], ['a', 'c']), ['a', 'b', 'c']);
  assert.deepEqual(addSeen(undefined, undefined), []);
});

test('story: validation catches bad references, ids, cast, text and rewards', () => {
  const v = (s) => validateStory(s, packs, { checkText });
  assert.deepEqual(v(story), []);
  const bad = [
    {
      pack: 'street',
      beats: [
        beat('cold', { on: 'firstLaunch' }),
        beat('cold', { level: 's1', on: 'firstWin' }),
        beat('x1', { level: 'b1', on: 'firstWin' }),
        beat('x2', { pack: 'street', on: 'unlock' }),
        beat('x3', { on: 'later' }),
        beat('Bad Id', { level: 's1', on: 'firstWin' }),
        beat('x4', { level: 's1', on: 'firstWin' }, { cast: ['nobody'], title: 'English only', lines: [txt('a'), txt('b')] }),
        beat('x5', { level: 's1', on: 'firstWin' }, { lines: [{ vi: 'x'.repeat(81), en: 'ok' }], reward: { booster: 'laser' } }),
        beat('x6', { level: 's1', on: 'firstWin' }, { reward: { keepsake: 'nope' } }),
        beat('recap', { level: 's1', on: 'firstWin' }),
      ],
      keepsakes: [{ id: 'k1', level: 'b2', kind: 'sticker', art: 'Art!', lines: [] }],
    },
    { pack: 'beach', beats: [beat('cold2', { on: 'firstLaunch' })] },
    { pack: 'nowhere', beats: [] },
  ];
  const errors = v(bad).join('\n');
  for (const want of [
    /duplicate id cold/,
    /level b1 is not a level of street/,
    /the first pack is always open/,
    /at\.on must be/,
    /"Bad Id" must be lowercase/,
    /unknown cast member nobody/,
    /title: must be \{ "vi"/,
    /at most 1 line/,
    /vi text longer than 80/,
    /unknown booster laser/,
    /no keepsake nope/,
    /"recap" is reserved/,
    /keepsake k1: level b2 is not a level of street/,
    /kind must be one of/,
    /art must be an id/,
    /needs a caption line/,
    /firstLaunch belongs to the first pack/,
    /more than one firstLaunch/,
    /no pack nowhere/,
  ]) assert.match(errors, want);
});

test('story: the shipped story content is valid and its ids are unique', () => {
  const content = loadStory();
  const shipped = loadPacks().map(({ pack }) => ({ id: pack.id, levels: pack.levels }));
  assert.deepEqual(validateStory(content, shipped, { checkText }), []);
  const all = storyIds(content);
  assert.equal(new Set(all).size, all.length);
  // the cold open plays for a brand-new save
  assert.deepEqual(ids(beatsFor({ on: 'launch' }, { progress: {}, seen: [] }, content, { packs: shipped, themes: {} })), ['street.cold-open']);
});
