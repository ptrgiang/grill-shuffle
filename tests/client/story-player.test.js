// Story player data (client/story/): timeline evaluation (pose snap + hold, eased walks, prop overrides, camera) and
// the staging of every shipped beat (#81). Drawing itself is checked by screenshots (npm run shot -- --set).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { track, camAt, SNAP } from '../../client/story/timeline.js';
import { POSES, blendPose } from '../../client/story/rig.js';
import { BEATS, stagingFor, FALLBACK } from '../../client/story/beats.js';
import { loadStory } from '../../scripts/lib/content.js';

const at = (keys, t) => track(keys, t, POSES, blendPose);

test('timeline: nothing before the first key; a pose snaps in SNAP seconds, then holds', () => {
  const keys = [{ t: 1, x: 10, face: 1, pose: 'stand' }, { t: 2, x: 10, face: 1, pose: 'shock' }];
  assert.equal(at(keys, 0.5), null);
  assert.equal(at(keys, 1.5).pose, POSES.stand);
  const mid = at(keys, 2 + SNAP / 2).pose;
  assert.ok(mid.lean < 0 && mid.lean > POSES.shock.lean, 'blending toward the new pose');
  assert.equal(at(keys, 2 + SNAP).pose, POSES.shock, 'snapped, then held');
  assert.equal(at(keys, 9).pose, POSES.shock);
});

test('timeline: a move eases between the keys in the walk pose and faces the way it goes', () => {
  const keys = [{ t: 0, x: 0, face: 1, pose: 'stand' }, { t: 2, x: -100, face: -1, pose: 'smile', move: true, walk: 'pushWalk' }];
  const a = at(keys, 0.5), b = at(keys, 1), c = at(keys, 1.5);
  assert.ok(a.x > b.x && b.x > c.x && c.x > -100);
  assert.equal(b.x, -50, 'ease in-out: halfway at half time');
  assert.equal(b.face, -1);
  assert.equal(b.pose.walk, 1);
  assert.equal(b.pose.lean, POSES.pushWalk.lean);
  assert.equal(at(keys, 2.5).pose, POSES.smile);
});

test('timeline: a key overrides the prop and sets extra fields', () => {
  const keys = [{ t: 0, x: 0, face: 1, pose: 'read', prop: 'flyer', set: { noLanyard: 1 } }];
  const p = at(keys, 1).pose;
  assert.equal(p.prop, 'flyer');
  assert.equal(p.noLanyard, 1);
  assert.equal(POSES.read.prop, 'postcard', 'the shared pose is not mutated');
});

test('timeline: the camera eases from the previous key and holds', () => {
  const keys = [{ t: 0, x: 0, y: 0, z: 1 }, { t: 2, x: 100, y: 0, z: 2 }];
  assert.deepEqual(camAt(keys, 1), { x: 0, y: 0, z: 1 });
  const mid = camAt(keys, 2.6);
  assert.ok(mid.x > 0 && mid.x < 100);
  assert.deepEqual(camAt(keys, 5), { x: 100, y: 0, z: 2 });
});

test('staging: every shipped beat is staged, in order, with three moments inside its length', () => {
  const ids = loadStory().flatMap((s) => (s.beats ?? []).map((b) => b.id));
  for (const id of ids) assert.ok(BEATS[id], `${id} has staging in client/story/beats.js`);
  assert.equal(stagingFor('no.such.beat'), FALLBACK);
  for (const [id, b] of Object.entries(BEATS)) {
    assert.equal(b.panels.length, 3, `${id}: three panels`);
    for (const p of b.panels) assert.ok(p >= 0 && p <= b.length, `${id}: panel ${p} within ${b.length} s`);
    for (const a of b.actors) {
      for (let i = 1; i < a.keys.length; i++) assert.ok(a.keys[i].t >= a.keys[i - 1].t, `${id}/${a.who}: keys sorted`);
      for (const k of a.keys) assert.ok(POSES[k.pose] && (!k.walk || POSES[k.walk]), `${id}/${a.who}: pose ${k.pose}`);
    }
    for (let i = 1; i < b.cam.length; i++) assert.ok(b.cam[i].t > b.cam[i - 1].t, `${id}: camera keys sorted`);
    assert.equal(typeof b.scene(0), 'object');
  }
});

test('staging: the level-50 carts do not jump when Út takes the handle', () => {
  for (const id of ['street.first-page', 'beach.second-page']) {
    const B = BEATS[id];
    const x = (t) => B.scene(t).cartX;
    for (let t = 0; t < B.length; t += 0.05) assert.ok(Math.abs(x(t + 0.05) - x(t)) < 12, `${id}: cart moves smoothly at ${t.toFixed(2)} s (${x(t)} -> ${x(t + 0.05)})`);
  }
});

test('sound cues: every beat is heard, in order, from its motion', async () => {
  const { allCues, cuesBetween } = await import('../../client/story/cues.js');
  const names = (id) => new Set(allCues(BEATS[id]).map((c) => c.name));
  const has = (id, ...want) => want.forEach((n) => assert.ok(names(id).has(n), `${id}: ${n} (${[...names(id)].join(', ')})`));
  has('street.cold-open', 'step', 'paper', 'bulb', 'meow', 'sting');
  has('street.fan', 'step', 'fan', 'coals');
  has('street.flyer', 'step', 'paper', 'sting', 'buzz');
  has('street.first-page', 'paper', 'step');
  has('beach.storm', 'rain', 'step');
  has('beach.khang', 'basket', 'surf');
  has('street.regulars', 'clink', 'moto');
  has('street.lanyard', 'clink', 'buzz');
  has('beach.second-page', 'paper', 'step');
  for (const [id, B] of Object.entries(BEATS)) {
    const all = allCues(B);
    assert.ok(all.length > 0, `${id}: has cues`);
    for (let i = 1; i < all.length; i++) assert.ok(all[i].t >= all[i - 1].t, `${id}: cues in time order`);
    // frame by frame, the windows add up to the whole list (no cue lost or doubled between frames)
    let n = 0, t = -0.001;
    for (let now = 0; now <= B.length; now += 1 / 30) {
      n += cuesBetween(B, t, now).length;
      t = now;
    }
    n += cuesBetween(B, t, B.length).length;
    assert.equal(n, all.length, `${id}: per-frame cues = all cues`);
  }
});

test('sound: every story cue has a generator that is short, finite and soft', async () => {
  const { SOUNDS } = await import('../../client/audio/synth.js');
  for (const name of ['step', 'paper', 'buzz', 'bulb', 'fan', 'coals', 'wave', 'rain', 'meow', 'chime', 'sting', 'basket', 'clink', 'moto', 'surf']) {
    const a = SOUNDS[`story_${name}`](8000);
    assert.ok(a.length > 0 && a.length <= 8000 * 8, `${name}: length`);
    let peak = 0;
    for (const v of a) {
      assert.ok(Number.isFinite(v), `${name}: finite`);
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(peak > 0.05 && peak <= 0.9, `${name}: peak ${peak}`);
  }
});
