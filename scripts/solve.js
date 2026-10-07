// Solver CLI.
//   npm run solve -- street-001            solve one level (id, number suffix or path)
//   npm run solve -- --all                 table of every level
//   npm run solve -- street-001 --write    set the level's move budget (from its tier) and solver block
//   npm run solve -- --all --write
//   npm run solve -- --code G1N3K7QX8      the puzzle behind a share code
//   npm run solve -- --seed 42 --band H    a generated puzzle by seed
//   --json   machine-readable output
import { findLevel, allLevels, writeLevel, parseArgs } from './lib/content.js';
import { solveLevel } from '../solver/solver.js';
import { solverMeta } from '../solver/generator.js';
import { moveBudget } from '../shared/progression.js';
import { validateLevel } from '../shared/levels.js';
import { puzzleForCode } from '../solver/presets.js';
import { encodeGenerated } from '../shared/challenge.js';

const args = parseArgs();

function solveOne(level, { write = false, file = null } = {}) {
  const v = validateLevel(level);
  if (!v.ok) return { level, error: v.errors.join('; ') };
  const tier = level.tier ?? 'normal';
  let report = solveLevel(level, { tier });
  if (report.solvable && write) {
    level.moves = moveBudget(report.minMoves, tier);
    report = solveLevel(level, { useLevelMoves: true });
    level.solver = solverMeta(report);
    writeLevel(file, level);
  } else if (report.solvable && !write) {
    report = solveLevel(level, { useLevelMoves: true });
  }
  return { level, report };
}

function print({ level, report, error }) {
  if (error) return console.log(`${level.id}: INVALID ${error}`);
  if (args.json) return console.log(JSON.stringify({ id: level.id, ...report }, null, 2));
  console.log(`\n${level.id}  ${level.name ?? ''}`);
  if (!report.solvable) return console.log(`  solvable: ${report.solvable}${report.truncated ? ' (search truncated)' : ''}  states: ${report.visitedStates}`);
  const d = report.difficulty;
  console.log(`  solvable:        yes${report.withinBudget ? '' : '  (NOT within the level\'s move budget!)'}`);
  console.log(`  min moves:       ${report.minMoves}   budget: ${report.budget}`);
  console.log(`  states explored: ${report.visitedStates}  (${report.ms} ms, ${report.method})`);
  if (d) {
    console.log(`  branching:       ${report.branchingFactor} legal / ${report.distinctBranching} distinct`);
    console.log(`  forced moves:    ${report.forcedMoves}   critical steps: ${report.criticalSteps}`);
    console.log(`  dead ends:       ${report.deadEnds} (${Math.round(report.deadEndRatio * 100)}% of reachable)`);
    console.log(`  optimal lines:   ${report.optimalSolutions}`);
    console.log(`  difficulty:      ${d.score} ${d.rating}  ${JSON.stringify(d.parts)}`);
  }
  console.log(`  solution:        ${report.solutionString}`);
}

if (args.code || args.seed !== undefined) {
  const code = args.code ?? encodeGenerated(args.band ?? 'N', Number(args.seed));
  const p = puzzleForCode(code);
  if (!p) {
    console.log(`no puzzle for ${code}`);
    process.exit(1);
  }
  console.log(`code ${code}`);
  print(solveOne(p.level));
  if (!args.json) console.log(JSON.stringify(p.level.board));
} else if (args.all) {
  const rows = [];
  let bad = 0;
  for (const { file, level, id } of allLevels()) {
    if (!level) {
      console.log(`${id}: missing file`);
      bad++;
      continue;
    }
    const r = solveOne(level, { write: !!args.write, file });
    if (r.error || !r.report.solvable) bad++;
    rows.push(r);
  }
  if (args.json) console.log(JSON.stringify(rows.map((r) => ({ id: r.level.id, ...(r.report ?? {}), error: r.error })), null, 2));
  else {
    console.log('id                 tier    min  moves  diff  rating     states  branch  dead%  forced  lines');
    for (const { level, report, error } of rows) {
      if (error || !report.solvable) {
        console.log(`${level.id.padEnd(18)} ${error ?? 'UNSOLVABLE'}`);
        continue;
      }
      const d = report.difficulty;
      console.log(`${level.id.padEnd(18)} ${(level.tier ?? '-').padEnd(7)} ${String(report.minMoves).padStart(3)}  ${String(level.moves).padStart(5)}  ${String(d.score).padStart(4)}  ${d.rating.padEnd(9)} ${String(report.visitedStates).padStart(7)}  ${String(report.branchingFactor).padStart(6)}  ${String(Math.round(report.deadEndRatio * 100)).padStart(5)}  ${String(report.forcedMoves).padStart(6)}  ${String(report.optimalSolutions).padStart(5)}`);
    }
  }
  process.exit(bad ? 1 : 0);
} else {
  const target = args._[0];
  if (!target) {
    console.log('usage: npm run solve -- <level-id | number | path> [--write] [--json] | --all | --code <code> | --seed <n> [--band E|N|H|V]');
    process.exit(1);
  }
  const { file, level } = findLevel(target);
  const r = solveOne(level, { write: !!args.write, file });
  print(r);
  process.exit(r.error || !r.report.solvable ? 1 : 0);
}
