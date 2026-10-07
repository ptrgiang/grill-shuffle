// Offline sync queue: results that cannot be sent wait in the outbox and go out on flushOutbox; a rejected result
// (4xx) is dropped, a progress push that failed is retried. db.js falls back to memory here (no IndexedDB in node).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitResult, flushOutbox } from '../../client/storage/sync.js';
import { get, set } from '../../client/storage/db.js';

const calls = [];
let mode = 'offline';
globalThis.fetch = async (path, init) => {
  calls.push({ path, method: init.method });
  if (mode === 'offline') throw new TypeError('Failed to fetch');
  if (mode === 'reject') return new Response('{}', { status: 400 });
  return new Response(JSON.stringify({ ok: true, verified: true }), { status: 200 });
};

test('offline results are queued, then sent by flushOutbox', async () => {
  await set('outbox', []);
  mode = 'offline';
  assert.deepEqual(await submitResult('daily', 'D-x', { date: '2026-10-07', moves: 'ab' }), { queued: true });
  assert.deepEqual(await submitResult('challenge', 'G-abc', { moves: 'cd' }), { queued: true });
  assert.equal((await get('outbox')).length, 2);

  await flushOutbox(); // still offline: nothing lost
  assert.equal((await get('outbox')).length, 2);

  mode = 'online';
  calls.length = 0;
  await flushOutbox();
  assert.deepEqual((await get('outbox')), []);
  assert.deepEqual(calls.map((c) => c.path), ['/api/daily/result', '/api/challenge/G-abc/result']);
});

test('a result the server rejects is not queued; a failed progress push is retried', async () => {
  await set('outbox', []);
  mode = 'reject';
  assert.equal(await submitResult('daily', 'D-x', { date: '2026-10-07' }), null);
  assert.deepEqual(await get('outbox'), []);

  await set('syncPending', true);
  mode = 'online';
  calls.length = 0;
  await flushOutbox();
  assert.equal(await get('syncPending'), false);
  assert.deepEqual(calls.map((c) => c.path), ['/api/progress']);
});

test('results older than two weeks are dropped from the outbox', async () => {
  await set('outbox', [{ kind: 'daily', key: 'D-old', payload: {}, at: Date.now() - 15 * 24 * 3600_000 }]);
  mode = 'offline';
  await flushOutbox();
  assert.deepEqual(await get('outbox'), []);
});
