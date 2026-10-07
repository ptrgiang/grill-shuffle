// Seeded level generator.
//
//   seed -> candidate -> validate -> solve -> difficulty -> quality filter -> dedupe -> rank -> accept
//
// Same config + same seed + same GENERATOR_VERSION => same levels, on every machine (challenge links and the daily
// puzzle rely on this). Nothing is accepted without the solver proving it winnable inside its move budget.

import { mulberry32, deriveSeed } from '../shared/rng.js';
import { validateLevel, usedModifiers } from '../shared/levels.js';
import { LEVEL_FORMAT_VERSION, GENERATOR_VERSION } from '../shared/version.js';
import { moveBudget } from '../shared/progression.js';
import { solveLevel } from './solver.js';
import { boardSignature } from './canonical.js';

export const DEFAULT_CONFIG = Object.freeze({
  theme: 'street_bbq',
  foods: ['shrimp', 'beef', 'corn', 'chicken'],
  foodCount: [3, 4], // how many different foods
  grills: [3, 5], // cooking grills (3 slots each)
  trays: [0, 0], // prep trays (2 slots, never match)
  emptySlots: [2, 4], // empty visible slots at the start
  layers: [0, 0], // grills that get one stacked tray underneath
  locks: [0, 0], // locked grills
  lockMatches: [1, 3],
  difficulty: [20, 40],
  minMoves: [4, 22],
  maxForcedShare: 0.75, // reject when more than this share of the optimal line is forced
  minDeadEndRatio: 0.01, // reject boards where no decision matters
  maxStates: 250_000,
  idPrefix: 'gen',
});

const between = (rng, [lo, hi]) => rng.int(lo, hi);

export function tierForDifficulty(lo, hi) {
  const mid = (lo + hi) / 2;
  return mid <= 20 ? 'easy' : mid <= 40 ? 'normal' : mid <= 60 ? 'hard' : 'expert';
}

/** One random candidate board (may be invalid / unsolvable: the pipeline checks). */
export function makeCandidate(config, seed) {
  const c = { ...DEFAULT_CONFIG, ...config };
  const rng = mulberry32(seed);
  const nGrills = between(rng, c.grills);
  const nTrays = between(rng, c.trays);
  const nLayers = Math.min(nGrills, between(rng, c.layers));
  const nLocks = Math.min(nGrills - 1, between(rng, c.locks));
  const grills = [];
  for (let i = 0; i < nGrills; i++) grills.push({ type: 'grill', slots: [null, null, null], layers: [], lock: 0 });
  for (let i = 0; i < nTrays; i++) grills.push({ type: 'tray', slots: [null, null], layers: [], lock: 0 });
  const S = grills.reduce((n, g) => n + g.slots.length, 0);

  // layers: distinct grills, each one hidden tray of 2-3 items
  const order = rng.shuffle([...Array(nGrills).keys()]);
  const layerSizes = order.slice(0, nLayers).map((gi) => ({ gi, size: rng.int(2, 3) }));
  let H = layerSizes.reduce((n, l) => n + l.size, 0);
  let E = between(rng, c.emptySlots);
  let V = S - E;
  // total items must be a multiple of 3: trim visible items (more empty space) first
  while ((V + H) % 3 && V > 3) V--;
  E = S - V;
  if (E < 1 || V < 3) return null;
  const T = (V + H) / 3;
  const k = Math.min(T, between(rng, c.foodCount), c.foods.length);
  const foods = rng.shuffle(c.foods.slice()).slice(0, k);
  const triples = foods.slice();
  while (triples.length < T) triples.push(rng.pick(foods));
  const items = rng.shuffle(triples.flatMap((f) => [f, f, f]));

  for (const { gi, size } of layerSizes) {
    const layer = [null, null, null];
    const at = rng.shuffle([0, 1, 2]).slice(0, size);
    for (const s of at) layer[s] = items.pop();
    grills[gi].layers.push(layer);
  }
  const slots = [];
  grills.forEach((g, gi) => g.slots.forEach((_, si) => slots.push([gi, si])));
  rng.shuffle(slots);
  for (let i = 0; i < V; i++) {
    const [gi, si] = slots[i];
    grills[gi].slots[si] = items.pop();
  }
  // locks go on full-ish grills without layers, never on every grill
  const lockable = order.slice(nLayers).filter((gi) => grills[gi].slots.some(Boolean));
  for (let i = 0; i < nLocks && i < lockable.length; i++) grills[lockable[i]].lock = between(rng, c.lockMatches);

  const board = {
    grills: grills.map((g) => {
      const out = { slots: g.slots };
      if (g.type !== 'grill') out.type = g.type;
      if (g.layers.length) out.layers = g.layers;
      if (g.lock) out.lock = g.lock;
      return out;
    }),
  };
  const level = { formatVersion: LEVEL_FORMAT_VERSION, id: 'candidate', theme: c.theme, moves: 99, board, goals: [{ type: 'clear_all' }], modifiers: [] };
  level.modifiers = usedModifiers(level);
  return level;
}

/** Quality gate. Returns null when accepted, else the reason. */
export function rejectReason(report, c) {
  if (report.truncated) return 'too big to analyse';
  if (!report.solvable) return 'unsolvable';
  if (report.minMoves < c.minMoves[0]) return 'trivial';
  if (report.minMoves > c.minMoves[1]) return 'too long';
  if (!report.difficulty) return 'no difficulty';
  const d = report.difficulty.score;
  if (d < c.difficulty[0] || d > c.difficulty[1]) return 'outside difficulty';
  if (report.forcedMoves / report.minMoves > c.maxForcedShare) return 'excessively forced';
  if (report.deadEndRatio < c.minDeadEndRatio) return 'no meaningful decisions';
  if (report.features.grills > 8) return 'unreadable (too many grills)';
  return null;
}

/**
 * Generate levels.
 * opts: { count, maxCandidates, seed, mode: 'rank' | 'first', exclude: Set<signature>, onProgress(stats) }
 * Returns { levels: [{ level, report, signature, seed }], stats: { candidates, rejected: {reason: n} } }.
 */
export function generateLevels(config, { count = 10, maxCandidates = 500, seed = 1, mode = 'rank', exclude = new Set(), onProgress = null } = {}) {
  const c = { ...DEFAULT_CONFIG, ...config };
  const tier = c.tier ?? tierForDifficulty(c.difficulty[0], c.difficulty[1]);
  const accepted = [];
  const seen = new Set(exclude);
  const stats = { candidates: 0, rejected: {} };
  const reject = (r) => (stats.rejected[r] = (stats.rejected[r] || 0) + 1);
  for (let i = 0; i < maxCandidates; i++) {
    if (mode === 'first' && accepted.length >= count) break;
    const candSeed = deriveSeed(seed, 'g', GENERATOR_VERSION, i);
    const level = makeCandidate(c, candSeed);
    stats.candidates++;
    if (!level) {
      reject('bad shape');
      continue;
    }
    if (!validateLevel(level).ok) {
      reject('invalid');
      continue;
    }
    const signature = boardSignature(level);
    if (seen.has(signature)) {
      reject('duplicate');
      continue;
    }
    const report = solveLevel(level, { tier, exploreTier: tier, maxStates: c.maxStates, astarFallback: false });
    const why = rejectReason(report, c);
    if (why) {
      reject(why);
      continue;
    }
    seen.add(signature);
    level.moves = moveBudget(report.minMoves, tier);
    level.solver = solverMeta(report);
    accepted.push({ level, report, signature, seed: candSeed });
    onProgress?.({ ...stats, accepted: accepted.length });
  }
  if (mode === 'rank') {
    const mid = (c.difficulty[0] + c.difficulty[1]) / 2;
    const interest = (r) => Math.abs(r.difficulty.score - mid) - 2 * Math.min(3, r.criticalSteps) - (r.optimalSolutions > 1 && r.optimalSolutions < 200 ? 2 : 0);
    accepted.sort((a, b) => interest(a.report) - interest(b.report) || a.seed - b.seed);
  }
  return { levels: accepted.slice(0, count), stats };
}

/** The metadata block a level stores about its own solution (verified by validate:levels). */
export function solverMeta(report) {
  return {
    minMoves: report.minMoves,
    difficulty: report.difficulty.score,
    rating: report.difficulty.rating,
    states: report.visitedStates,
    solution: report.solutionString,
  };
}
