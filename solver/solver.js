// Public solver API.
//
//   solveLevel(level, opts) -> {
//     solvable, minMoves, visitedStates, branchingFactor, forcedMoves, deadEnds, deadEndRatio,
//     optimalSolutions, solution: [action...], solutionString, budget, difficulty: { score, rating, parts },
//     truncated, method: 'bfs' | 'astar'
//   }
//
// budget: the move budget the analysis is made against: opts.budget, else level.moves when opts.useLevelMoves,
// else moveBudget(minMoves, opts.tier ?? 'normal').

import { explore, analyzeGraph, pathTo, astar } from './search.js';
import { evaluateDifficulty } from './difficulty.js';
import { moveBudget } from '../shared/progression.js';
import { encodeActions } from '../shared/moves.js';

export function levelFeatures(level) {
  const gs = level.board.grills;
  return {
    grills: gs.length,
    slots: gs.reduce((n, g) => n + g.slots.length, 0),
    items: gs.reduce((n, g) => n + g.slots.filter(Boolean).length + (g.layers ?? []).reduce((m, l) => m + l.filter(Boolean).length, 0), 0),
    layers: gs.reduce((n, g) => n + (g.layers ?? []).length, 0),
    locks: gs.filter((g) => (g.lock ?? 0) > 0).length,
    trays: gs.filter((g) => g.type === 'tray').length,
  };
}

export function solveLevel(level, { tier = 'normal', budget = null, useLevelMoves = false, maxStates = 400_000, exploreTier = 'easy', astarFallback = true } = {}) {
  const t0 = Date.now();
  const fixed = budget ?? (useLevelMoves ? level.moves : null);
  // explore as deep as the budget the analysis needs (exploreTier 'easy' = deep enough to analyse any tier)
  const g = explore(level, { depthLimit: fixed, limitFor: (m) => moveBudget(m, budget ? tier : exploreTier), maxStates });
  const features = levelFeatures(level);
  if (g.minMoves === null) {
    if (g.truncated && !astarFallback) return { solvable: null, minMoves: null, visitedStates: g.depth.length, truncated: true, method: 'bfs', features, ms: Date.now() - t0, difficulty: null };
    if (g.truncated) {
      const a = astar(level, { maxStates: maxStates * 4 });
      if (a.solvable) {
        const b = fixed ?? moveBudget(a.minMoves, tier);
        return { solvable: true, minMoves: a.minMoves, visitedStates: a.visitedStates, solution: a.solution, solutionString: encodeActions(a.solution), budget: b, withinBudget: a.minMoves <= b, truncated: true, method: 'astar', features, ms: Date.now() - t0, difficulty: null };
      }
      return { solvable: a.solvable, minMoves: null, visitedStates: a.visitedStates, truncated: a.truncated, method: 'astar', features, ms: Date.now() - t0, difficulty: null };
    }
    return { solvable: false, minMoves: null, visitedStates: g.depth.length, truncated: false, method: 'bfs', features, ms: Date.now() - t0, difficulty: null, withinBudget: false };
  }
  const b = fixed ?? moveBudget(g.minMoves, tier);
  const solution = pathTo(g, g.solutionNode);
  const a = analyzeGraph(g, b);
  const difficulty = evaluateDifficulty(a, { minMoves: g.minMoves, budget: b, layers: features.layers, locks: features.locks });
  return {
    solvable: true,
    minMoves: g.minMoves,
    withinBudget: g.minMoves <= b,
    budget: b,
    visitedStates: g.depth.length,
    reachableStates: a.reachableStates,
    branchingFactor: round2(a.branchingFactor),
    distinctBranching: round2(a.distinctBranching),
    forcedMoves: a.forcedMoves,
    criticalSteps: a.criticalSteps,
    deadEnds: a.deadEnds,
    deadEndRatio: round2(a.deadEndRatio),
    freedom: round2(a.freedom),
    optimalSolutions: a.optimalSolutions,
    openingSafeRatio: round2(a.openingSafeRatio),
    solution,
    solutionString: encodeActions(solution),
    difficulty,
    truncated: g.truncated,
    method: 'bfs',
    features,
    ms: Date.now() - t0,
  };
}

const round2 = (x) => Math.round(x * 100) / 100;
