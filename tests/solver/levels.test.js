// Every shipped story level has an answer and can be won: checked in `npm test`, not only in validate:levels.
//   1. the stored solution replays legally from the start and ends in a win, inside the level's move budget;
//   2. the solver, run from scratch, proves the board winnable and agrees with the stored minimum;
//   3. the solver's own line replays to a win too (the answer does not depend on the stored file).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPacks } from '../../scripts/lib/content.js';
import { validateLevel } from '../../shared/levels.js';
import { replay } from '../../shared/replay.js';
import { solveLevel } from '../../solver/solver.js';

const packs = loadPacks();

for (const { pack, levels } of packs) {
  for (const { id, level } of levels) {
    test(`${pack.id}/${id}: has a solution and is winnable`, () => {
      assert.ok(level, 'level file missing');
      const v = validateLevel(level);
      assert.ok(v.ok, v.errors.join('; '));
      assert.ok(level.solver?.solution, 'no stored solution (run: npm run solve -- ' + id + ' --write)');

      const stored = replay(level, level.solver.solution);
      assert.ok(stored.ok, `stored solution is illegal: ${stored.error}`);
      assert.equal(stored.state.status, 'won', 'stored solution does not win');
      assert.equal(stored.state.movesUsed, level.solver.minMoves);
      assert.ok(stored.state.movesUsed <= level.moves, `solution needs ${stored.state.movesUsed} moves, budget ${level.moves}`);

      const r = solveLevel(level, { useLevelMoves: true });
      assert.equal(r.solvable, true, r.truncated ? 'solver could not finish' : 'solver finds no win');
      assert.equal(r.minMoves, level.solver.minMoves, 'stored minMoves is not the true minimum');
      assert.ok(r.withinBudget);
      const fresh = replay(level, r.solutionString);
      assert.ok(fresh.ok && fresh.state.status === 'won', "solver's own line does not win");
    });
  }
}

test('street_bbq ships its 50 legacy levels (and any appended after them), each once, all with a name, tier and hint', () => {
  const street = packs.find((p) => p.pack.id === 'street_bbq');
  assert.ok(street);
  assert.ok(street.pack.levels.length >= 50); // levels are only appended (#62)
  assert.equal(street.pack.levels[0], 'street-001');
  assert.equal(new Set(street.pack.levels).size, street.pack.levels.length);
  for (const { id, level } of street.levels) {
    assert.ok(level?.name, `${id}: name`);
    assert.ok(level.tier, `${id}: tier`);
    assert.ok(level.hint, `${id}: hint`);
  }
});
