// client/game/replay-player.js: URL params, validation before playing, stepping, timer-driven playback, skip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ReplayPlayer, parseReplayParam, replayQuery, stepDelay, SPEEDS } from '../../client/game/replay-player.js';
import { replay } from '../../shared/replay.js';
import { hashState } from '../../shared/hash.js';

const level = JSON.parse(readFileSync(new URL('../../content/levels/street_bbq/street-003.json', import.meta.url), 'utf8'));
const best = level.solver.solution;

/** A fake timer: run() fires everything queued, in order, as often as it re-schedules. */
function clock() {
  const q = [];
  return {
    schedule: (fn, ms) => (q.push({ fn, ms }), q.length),
    cancel: () => {},
    run(max = 1000) {
      for (let i = 0; i < max && q.length; i++) q.shift().fn();
    },
    get pending() {
      return q.length;
    },
    q,
  };
}

test('replay params: best, a run with its hash, malformed, none', () => {
  assert.deepEqual(parseReplayParam('?r=best'), { best: true, hash: null });
  assert.deepEqual(parseReplayParam('?m=4&r=m0.0-2.0,btorch:2.1,bfan&h=abc'), { actions: 'm0.0-2.0 btorch:2.1 bfan', hash: 'abc' });
  assert.equal(parseReplayParam('?r=<script>').malformed, true);
  assert.equal(parseReplayParam('?m=4'), null);
  const q = replayQuery('m0.0-2.0 m1.2-0.0', 'h1');
  assert.equal(q, 'r=m0.0-2.0,m1.2-0.0&h=h1');
  assert.deepEqual(parseReplayParam(`?${q}`), { actions: 'm0.0-2.0 m1.2-0.0', hash: 'h1' });
});

test('replay player: the stored solution is validated, then steps to the same final hash', () => {
  const steps = [];
  let ended = null;
  const p = new ReplayPlayer(level, { best: true }, { onStep: (r, i) => steps.push(i), onEnd: (s) => (ended = s) });
  assert.ok(p.valid, p.error);
  assert.equal(p.finalHash, replay(level, best).hash);
  while (p.step());
  assert.equal(steps.length, level.solver.minMoves);
  assert.equal(p.state.status, 'won');
  assert.equal(hashState(ended), p.finalHash);
  assert.equal(p.step(), null, 'nothing after the end');
});

test('replay player: an illegal or diverging run is refused before anything plays', () => {
  const bad = new ReplayPlayer(level, { actions: 'm9.9-0.0', hash: null });
  assert.equal(bad.valid, false);
  assert.match(bad.error, /action 0/);
  assert.equal(bad.step(), null);
  const wrongHash = new ReplayPlayer(level, { actions: best, hash: 'zzzzzzzzzzz' });
  assert.equal(wrongHash.valid, false);
  assert.equal(wrongHash.matches, false);
  const right = new ReplayPlayer(level, { actions: best, hash: replay(level, best).hash });
  assert.ok(right.valid && right.matches);
  assert.equal(new ReplayPlayer(level, { actions: null, malformed: true }).error, 'malformed replay');
  assert.equal(new ReplayPlayer({ ...level, solver: undefined }, { best: true }).error, 'no stored solution for this level');
});

test('replay player: play runs on the timer, faster at 2x; pause stops; restart and skip', () => {
  const c = clock();
  let resets = 0;
  const p = new ReplayPlayer(level, { best: true }, { schedule: c.schedule, cancel: c.cancel, onReset: () => resets++ });
  p.play();
  const first = c.q[0].ms;
  c.q.shift().fn(); // first action
  assert.equal(p.index, 1);
  p.pause();
  c.run();
  assert.equal(p.index, 1, 'paused: queued ticks do nothing');
  assert.equal(p.cycleSpeed(), SPEEDS[1]);
  p.play();
  assert.ok(c.q.at(-1).ms < first, 'faster');
  c.run();
  assert.ok(p.done && !p.playing);
  p.restart();
  assert.equal(p.index, 0);
  assert.equal(p.state.movesUsed, 0);
  p.skip();
  assert.ok(p.done);
  assert.equal(hashState(p.state), p.finalHash);
  assert.equal(resets, 2);
});

test('replay player: step pacing waits longer for a match', () => {
  assert.ok(stepDelay([{ type: 'move' }, { type: 'match' }]) > stepDelay([{ type: 'move' }]));
});
