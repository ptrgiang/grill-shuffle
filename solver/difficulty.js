// Difficulty evaluator. Turns solver analysis into a 0..100 score. The weights are tuning knobs, not truths:
// change them, re-run `npm run solve -- --all` and compare the ordering against play-testing notes (docs/SOLVER.md).

export const DIFFICULTY_WEIGHTS = Object.freeze({
  depth: 30, // how long the shortest solution is (saturates at depthSat moves)
  depthSat: 24,
  deadEnds: 22, // share of reachable states (within budget) from which the level can no longer be won
  tightness: 18, // along the optimal line: share of choices that would lose the level
  branching: 10, // how many options the player has to scan per move (log scale, saturates at 24)
  margin: 12, // how little slack the move budget leaves above the minimum
  hidden: 2, // per stacked layer (capped at hiddenCap)
  hiddenCap: 6,
  lock: 2, // per locked grill (capped at lockCap)
  lockCap: 4,
});

export const RATINGS = Object.freeze([
  { max: 20, id: 'easy', name: 'Easy' },
  { max: 40, id: 'normal', name: 'Normal' },
  { max: 60, id: 'hard', name: 'Hard' },
  { max: 80, id: 'very_hard', name: 'Very Hard' },
  { max: Infinity, id: 'challenge', name: 'Challenge' },
]);

export const ratingOf = (score) => RATINGS.find((r) => score <= r.max);

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * @param a     analysis (search.js analyzeGraph)
 * @param info  { minMoves, budget, layers, locks }
 * @returns { score, rating, parts }  parts: each component's contribution
 */
export function evaluateDifficulty(a, info, w = DIFFICULTY_WEIGHTS) {
  const { minMoves, budget, layers = 0, locks = 0 } = info;
  const parts = {
    depth: w.depth * clamp01(minMoves / w.depthSat),
    deadEnds: w.deadEnds * Math.pow(clamp01(a.deadEndRatio), 0.7),
    tightness: w.tightness * clamp01(1 - a.freedom),
    branching: w.branching * clamp01(Math.log2(Math.max(1, a.branchingFactor)) / Math.log2(24)),
    margin: w.margin * (1 - clamp01((budget - minMoves) / Math.max(1, 0.7 * minMoves))),
    mechanics: Math.min(w.hiddenCap, w.hidden * layers) + Math.min(w.lockCap, w.lock * locks),
  };
  const score = Math.round(Math.min(100, Object.values(parts).reduce((s, v) => s + v, 0)));
  for (const k of Object.keys(parts)) parts[k] = Math.round(parts[k] * 10) / 10;
  return { score, rating: ratingOf(score).id, parts };
}
