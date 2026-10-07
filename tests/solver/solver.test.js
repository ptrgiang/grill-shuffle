import { test } from 'node:test';
import assert from 'node:assert/strict';
import { level } from '../helpers/levels.js';
import { solveLevel } from '../../solver/solver.js';
import { astar } from '../../solver/search.js';
import { lowerBound } from '../../solver/heuristic.js';
import { boardSignature } from '../../solver/canonical.js';
import { generateLevels, makeCandidate } from '../../solver/generator.js';
import { replay } from '../../shared/replay.js';
import { createState } from '../../shared/state.js';
import { validateLevel } from '../../shared/levels.js';
import { mulberry32 } from '../../shared/rng.js';
import { puzzleForCode } from '../../solver/presets.js';
import { encodeGenerated } from '../../shared/challenge.js';

test('solves a one-move board', () => {
  const r = solveLevel(level(['ss.', 's..', 'bb.', 'b..']));
  assert.equal(r.solvable, true);
  assert.equal(r.minMoves, 2);
  assert.equal(r.solution.length, 2);
  assert.ok(replay(level(['ss.', 's..', 'bb.', 'b..']), r.solution).state.status === 'won');
});

test('known minimum: 9 items over 4 grills', () => {
  const lvl = level(['sbs', 'bk.', 'ksb', 'k..']);
  const r = solveLevel(lvl);
  assert.equal(r.solvable, true);
  assert.equal(r.minMoves, 5);
  const rep = replay(lvl, r.solutionString);
  assert.ok(rep.ok);
  assert.equal(rep.state.status, 'won');
  assert.equal(rep.state.movesUsed, 5);
  for (const k of ['visitedStates', 'branchingFactor', 'forcedMoves', 'deadEnds', 'optimalSolutions']) assert.ok(k in r, k);
  assert.ok(r.difficulty.score >= 0 && r.difficulty.score <= 100);
});

test('detects impossible boards', () => {
  // a locked grill that needs 2 matches but only 1 match is possible outside it
  const r = solveLevel(level(['ss.', 's..', 'kbk#2', 'bb.'.replace('bb.', 'k..'), 'b..', 'b..']));
  assert.equal(r.solvable, false);
  // locked forever: no match can ever happen
  const r2 = solveLevel(level(['sb.', 'bs.', 'skb#1', '...']));
  assert.equal(r2.solvable, false);
});

test('A* agrees with BFS on minimum moves (random boards)', () => {
  const rng = mulberry32(99);
  let checked = 0;
  for (let i = 0; i < 40 && checked < 12; i++) {
    const lvl = makeCandidate({ grills: [3, 4], foodCount: [2, 3], emptySlots: [2, 4], layers: [0, 1], locks: [0, 1] }, Math.floor(rng() * 1e9));
    if (!lvl || !validateLevel(lvl).ok) continue;
    const b = solveLevel(lvl, { maxStates: 100_000 });
    if (b.truncated) continue;
    const a = astar(lvl);
    assert.equal(a.solvable, b.solvable, JSON.stringify(lvl.board));
    if (b.solvable) assert.equal(a.minMoves, b.minMoves, JSON.stringify(lvl.board));
    checked++;
  }
  assert.ok(checked >= 8);
});

test('heuristic never overestimates (vs exact BFS distance at the start)', () => {
  const rng = mulberry32(5);
  for (let i = 0; i < 30; i++) {
    const lvl = makeCandidate({ grills: [3, 4], foodCount: [2, 3], emptySlots: [2, 4] }, Math.floor(rng() * 1e9));
    if (!lvl || !validateLevel(lvl).ok) continue;
    const r = solveLevel(lvl, { maxStates: 100_000 });
    if (r.solvable) assert.ok(lowerBound(createState(lvl)) <= r.minMoves);
  }
});

test('board signature: invariant to food relabelling and grill order', () => {
  const a = level(['sb.', 'bs.', 'k..', 'kk.', 'sb.']);
  const b = level(['ck.', 'kc.', 'b..', 'bb.', 'ck.'].reverse());
  assert.equal(boardSignature(a), boardSignature(b));
  const c = level(['sb.', 'bs.', 'k..', 'kk.', 'ss.'.replace('ss.', 'sb.')]);
  assert.equal(boardSignature(a), boardSignature(c));
  const d = level(['sb.', 'bk.', 's..', 'kk.', 'sb.']);
  assert.notEqual(boardSignature(a), boardSignature(d));
});

test('generator: deterministic, constrained, solver-verified, deduplicated', () => {
  const cfg = { grills: [4, 4], foodCount: [3, 3], emptySlots: [3, 3], difficulty: [0, 100], minMoves: [3, 20] };
  const a = generateLevels(cfg, { count: 4, maxCandidates: 60, seed: 7 });
  const b = generateLevels(cfg, { count: 4, maxCandidates: 60, seed: 7 });
  assert.deepEqual(a.levels.map((l) => l.level), b.levels.map((l) => l.level));
  assert.ok(a.levels.length >= 2);
  const sigs = new Set();
  for (const { level: lvl, report, signature } of a.levels) {
    assert.ok(validateLevel(lvl).ok, validateLevel(lvl).errors.join());
    assert.equal(lvl.board.grills.length, 4);
    assert.ok(report.solvable && report.minMoves <= lvl.moves);
    const rep = replay(lvl, lvl.solver.solution);
    assert.equal(rep.state.status, 'won');
    assert.ok(!sigs.has(signature));
    sigs.add(signature);
  }
  const c = generateLevels(cfg, { count: 4, maxCandidates: 60, seed: 8 });
  assert.notDeepEqual(a.levels.map((l) => l.level.board), c.levels.map((l) => l.level.board));
});

test('share code -> same puzzle every time', () => {
  const code = encodeGenerated('E', 4242);
  const p1 = puzzleForCode(code);
  const p2 = puzzleForCode(code);
  assert.ok(p1);
  assert.deepEqual(p1.level, p2.level);
  assert.equal(replay(p1.level, p1.level.solver.solution).state.status, 'won');
});
