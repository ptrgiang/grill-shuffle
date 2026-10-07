// Daily puzzle client helpers (pure): streak, countdown, choosing the server's pre-built level.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceStreak, currentStreak, msUntilNextDaily, formatCountdown, serverDailyLevel, rankLine } from '../../client/game/daily.js';
import { encodeDaily } from '../../shared/challenge.js';
import { PUZZLE_RULE_VERSION } from '../../shared/version.js';
import { puzzleForCode } from '../../solver/presets.js';

test('streak: consecutive UTC days extend it, a gap restarts it, the same day changes nothing', () => {
  let s = advanceStreak(null, '2026-10-05');
  assert.deepEqual(s, { last: '2026-10-05', count: 1, best: 1 });
  s = advanceStreak(s, '2026-10-06');
  s = advanceStreak(s, '2026-10-07');
  assert.deepEqual(s, { last: '2026-10-07', count: 3, best: 3 });
  assert.deepEqual(advanceStreak(s, '2026-10-07'), s);
  // an older day (a replayed daily link) leaves the streak alone
  assert.deepEqual(advanceStreak(s, '2026-10-01'), s);
  // across a month end
  assert.equal(advanceStreak({ last: '2026-10-31', count: 4, best: 4 }, '2026-11-01').count, 5);
  s = advanceStreak(s, '2026-10-09');
  assert.deepEqual(s, { last: '2026-10-09', count: 1, best: 3 });
  assert.equal(currentStreak(s, '2026-10-10'), 1);
  assert.equal(currentStreak(s, '2026-10-11'), 0);
  assert.equal(currentStreak(null, '2026-10-11'), 0);
});

test('countdown to the next daily (00:00 UTC)', () => {
  assert.equal(msUntilNextDaily(Date.UTC(2026, 9, 7, 23, 59, 30)), 30_000);
  assert.equal(msUntilNextDaily(Date.UTC(2026, 9, 7, 0, 0, 0)), 86_400_000);
  assert.equal(msUntilNextDaily(Date.UTC(2026, 11, 31, 18, 0, 0)), 6 * 3600_000);
  assert.equal(formatCountdown(5 * 3600_000 + 3 * 60_000 + 9_000), '05:03:09');
  assert.equal(formatCountdown(400), '00:00:01');
  assert.equal(formatCountdown(-5), '00:00:00');
});

test('server daily level: used only when it matches the code, date and rules', () => {
  const date = '2026-10-05';
  const code = encodeDaily(date);
  const level = puzzleForCode(code).level;
  const info = { code, rulesVersion: PUZZLE_RULE_VERSION, level };
  assert.equal(serverDailyLevel(info, code, date), level);
  assert.equal(serverDailyLevel(null, code, date), null);
  assert.equal(serverDailyLevel({ ...info, level: null }, code, date), null);
  assert.equal(serverDailyLevel({ ...info, rulesVersion: PUZZLE_RULE_VERSION + 1 }, code, date), null);
  assert.equal(serverDailyLevel({ ...info, code: encodeDaily('2026-10-06') }, code, date), null);
  assert.equal(serverDailyLevel(info, code, '2026-10-06'), null);
  assert.equal(serverDailyLevel({ ...info, level: { ...level, board: { grills: [] } } }, code, date), null);
  assert.equal(serverDailyLevel({ ...info, level: { ...level, solver: undefined } }, code, date), null);
});

test('rank line', () => {
  assert.match(rankLine({ players: 1, percentile: 0, bestMoves: 9, moves: 9 }), /first chef/);
  assert.equal(rankLine({ players: 40, percentile: 72, bestMoves: 9, moves: 11 }), 'Better than 72% of 40 players. Best today: 9 moves.');
  assert.equal(rankLine({ players: 40, percentile: 90, bestMoves: 9, moves: 9 }), 'Today’s best! Better than 90% of 40 players.');
  assert.equal(rankLine({ players: 4, percentile: 0, bestMoves: 9, moves: 9 }), 'You matched today’s best (9 moves) among 4 players.');
  assert.equal(rankLine({ players: 4, percentile: 0, bestMoves: 9, moves: 12 }), '4 players today. Best today: 9 moves.');
});
