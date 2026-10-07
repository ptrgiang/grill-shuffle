import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/content.js';
import { createD1 } from '../helpers/d1.js';
import { encodeStory, encodeGenerated, encodeDaily } from '../../shared/challenge.js';

let worker, env, LEVELS, STORY;
before(async () => {
  execFileSync(process.execPath, [join(ROOT, 'scripts/build-content.js')], { stdio: 'ignore' });
  worker = (await import('../../worker/index.js')).default;
  ({ LEVELS, STORY } = await import('../../worker/content.gen.js'));
  env = { DB: createD1(join(ROOT, 'migrations')), ASSETS: { fetch: async () => new Response('asset', { status: 200 }) } };
});

const PID = 'test-player-0001';
const call = async (method, path, { body, pid = PID, raw } = {}) => {
  const headers = { 'content-type': 'application/json' };
  if (pid) headers['x-player-id'] = pid;
  const res = await worker.fetch(new Request(`https://x.test${path}`, { method, headers, body: raw ?? (body ? JSON.stringify(body) : undefined) }), env);
  return { status: res.status, data: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() };
};

test('version and static fallthrough', async () => {
  const v = await call('GET', '/api/version');
  assert.equal(v.status, 200);
  assert.equal(v.data.puzzleRuleVersion, 2);
  assert.equal(v.data.levels, STORY.length);
  const page = await call('GET', '/play/street-001');
  assert.equal(page.data, 'asset');
});

test('player id is required and validated', async () => {
  assert.equal((await call('GET', '/api/me', { pid: null })).status, 401);
  assert.equal((await call('GET', '/api/me', { pid: 'bad id!' })).status, 401);
  const me = await call('GET', '/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.playerId, PID);
});

test('progress: sanitised, merged, never more stars than the moves earn', async () => {
  const id = STORY[0];
  const min = LEVELS[id].solver.minMoves;
  let r = await call('POST', '/api/progress', { body: { progress: { [id]: { stars: 3, bestMoves: min, bestScore: 300 }, 'not-a-level': { stars: 3, bestMoves: 1 }, [STORY[1]]: { stars: 3, bestMoves: 999 } } } });
  assert.equal(r.status, 200);
  assert.equal(r.data.stored, 1);
  // a worse later upload does not lower the best
  await call('POST', '/api/progress', { body: { progress: { [id]: { stars: 1, bestMoves: LEVELS[id].moves, bestScore: 10 } } } });
  r = await call('GET', '/api/progress');
  assert.deepEqual({ ...r.data.progress[id], at: 0 }, { stars: 3, bestMoves: min, bestScore: 300, at: 0 });
  // inflated stars are capped
  const id2 = STORY[2];
  await call('POST', '/api/progress', { body: { progress: { [id2]: { stars: 3, bestMoves: LEVELS[id2].moves } } } });
  r = await call('GET', '/api/progress');
  assert.equal(r.data.progress[id2].stars, 1);
});

test('malformed inputs are rejected', async () => {
  assert.equal((await call('POST', '/api/progress', { raw: '{nope' })).status, 400);
  assert.equal((await call('POST', '/api/progress', { body: { progress: [1, 2] } })).status, 400);
  assert.equal((await call('POST', '/api/progress', { raw: 'x'.repeat(70000) })).status, 413);
  assert.equal((await call('GET', '/api/challenge/!!')).status, 404);
  assert.equal((await call('GET', '/api/challenge/ZZZZZZ')).status, 404);
  assert.equal((await call('DELETE', '/api/progress')).status, 405);
  assert.equal((await call('GET', '/api/nothing')).status, 404);
  const code = encodeStory(0);
  assert.equal((await call('POST', `/api/challenge/${code}/result`, { body: { moves: 'DROP TABLE users' } })).status, 400);
  assert.equal((await call('POST', `/api/challenge/${code}/result`, { body: { moves: 'm0.0-0.1' } })).status, 422);
  assert.equal((await call('GET', '/api/daily?date=yesterday')).status, 400);
});

test('story challenge result: replayed server-side, best kept, stats + percentile', async () => {
  const code = encodeStory(2);
  const lvl = LEVELS[STORY[2]];
  // not a win: rejected
  const first = lvl.solver.solution.split(' ')[0];
  assert.equal((await call('POST', `/api/challenge/${code}/result`, { body: { moves: first } })).status, 422);
  // wrong claimed hash: rejected
  assert.equal((await call('POST', `/api/challenge/${code}/result`, { body: { moves: lvl.solver.solution, hash: 'nope' } })).status, 422);
  const ok = await call('POST', `/api/challenge/${code}/result`, { body: { moves: lvl.solver.solution } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.verified, true);
  assert.equal(ok.data.moves, lvl.solver.minMoves);
  assert.equal(ok.data.players, 1);
  const s = await call('GET', `/api/challenge/${code}`);
  assert.equal(s.data.bestMoves, lvl.solver.minMoves);
  assert.equal(s.data.kind, 'story');
});

test('story codes resolve through the share index, not the play order', async () => {
  const { levelForCode } = await import('../../worker/index.js');
  const { SHARE } = await import('../../worker/content.gen.js');
  for (let i = 0; i < SHARE.length; i++) assert.equal((await levelForCode(env, encodeStory(i))).level.id, SHARE[i]);
  // a code shipped for position 3 still opens street-004, wherever the pack now plays it
  assert.equal((await levelForCode(env, encodeStory(3))).level.id, 'street-004');
  assert.equal(await levelForCode(env, encodeStory(SHARE.length)), null);
});

test('generated challenge: built once from its code, cached, verified', async () => {
  const create = await call('POST', '/api/challenge', { body: { band: 'E' } });
  assert.equal(create.status, 201);
  assert.match(create.data.code, /^G1E/);
  const code = encodeGenerated('E', 777);
  const { puzzleForCode } = await import('../../solver/presets.js');
  const p = puzzleForCode(code);
  const r = await call('POST', `/api/challenge/${code}/result`, { body: { moves: p.level.solver.solution } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const cached = await env.DB.prepare('SELECT kind, min_moves FROM challenge_links WHERE code = ?1').bind(code).first();
  assert.equal(cached.kind, 'generated');
  assert.equal(cached.min_moves, p.level.solver.minMoves);
});

test('daily: same puzzle for everyone; result verified', async () => {
  const date = '2026-10-05'; // a Monday: band E (fast to build)
  const d = await call('GET', `/api/daily?date=${date}`);
  assert.equal(d.status, 200);
  assert.equal(d.data.code, encodeDaily(date));
  const { puzzleForCode } = await import('../../solver/presets.js');
  const p = puzzleForCode(encodeDaily(date));
  const r = await call('POST', '/api/daily/result', { body: { date, moves: p.level.solver.solution } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const r2 = await call('POST', '/api/daily/result', { pid: 'another-player-02', body: { date, moves: p.level.solver.solution } });
  assert.equal(r2.data.players, 2);
  const d2 = await call('GET', `/api/daily?date=${date}`);
  assert.ok(d2.data.boardHash);
  assert.equal(d2.data.minMoves, p.level.solver.minMoves);
});

test('cron: scheduled handler pre-builds today and tomorrow; /api/daily then serves the level', async () => {
  // 2026-10-12 is a Monday (band E), 10-13 a Tuesday (band N): quick to build
  const now = Date.UTC(2026, 9, 12, 0, 5);
  const waits = [];
  await worker.scheduled({ scheduledTime: now, cron: '5 0 * * *' }, env, { waitUntil: (p) => waits.push(p) });
  assert.equal(waits.length, 1);
  const out = await waits[0];
  assert.deepEqual(out.map((d) => [d.date, d.status]), [['2026-10-12', 'built'], ['2026-10-13', 'built']]);
  const { puzzleForCode } = await import('../../solver/presets.js');
  for (const date of ['2026-10-12', '2026-10-13']) {
    const d = await call('GET', `/api/daily?date=${date}`);
    assert.equal(d.status, 200);
    // the cached level is exactly what a client would generate from the code
    assert.deepEqual(d.data.level, puzzleForCode(encodeDaily(date)).level);
    assert.equal(d.data.minMoves, d.data.level.solver.minMoves);
  }
  // a second run only reads the cache
  const { prebuildDaily } = await import('../../worker/index.js');
  assert.deepEqual((await prebuildDaily(env, now)).map((d) => d.status), ['cached', 'cached']);
  // a day nobody built yet: no level, the client generates it itself
  assert.equal((await call('GET', '/api/daily?date=2026-12-01')).data.level, null);
});

test('daily: a level cached under older rules is not handed out', async () => {
  const date = '2026-10-19';
  await env.DB.prepare('INSERT INTO challenge_links (code, kind, level_json, board_hash, min_moves, rules_version, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(encodeDaily(date), 'daily', '{"id":"old"}', 'h', 5, 0, 0)
    .run();
  assert.equal((await call('GET', `/api/daily?date=${date}`)).data.level, null);
});
