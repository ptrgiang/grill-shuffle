// Search over the shared simulation. The solver never has its own copy of the rules: it calls
// getLegalMoves / applyAction / canonicalKey exactly as the game does.
//
// explore(level)  - breadth-first exploration of the whole state graph up to a depth limit, keeping every edge,
//                   then a backwards pass for each state's distance to a win. Gives exact minimum moves plus the
//                   analysis the difficulty evaluator needs (dead ends, forced moves, optimal-solution count ...).
// astar(level)    - minimum moves only, with an admissible heuristic; for boards too big to explore fully.

import { createState } from '../shared/state.js';
import { getLegalMoves } from '../shared/moves.js';
import { applyAction } from '../shared/resolve.js';
import { canonicalKey } from '../shared/hash.js';
import { lowerBound } from './heuristic.js';

export const UNLIMITED_MOVES = 1_000_000;

/** Start state with an effectively unlimited move budget (the search controls depth itself). */
export function solverStart(level) {
  return createState({ ...level, moves: UNLIMITED_MOVES });
}

const expand = (state) => getLegalMoves(state, { unique: true });

/**
 * Breadth-first exploration.
 * opts.depthLimit: explore states up to this many moves from the start (default: decided after the first win is
 *   found, via opts.limitFor(minMoves)); opts.maxStates: give up (truncated) past this many states.
 * Returns the graph: { ids: Map key->id, depth[], parent[], parentMove[], edgeStart[], edges[], legal[], won[],
 *   lost[], minMoves, solutionNode, truncated, depthLimit }.
 */
export function explore(level, { depthLimit = null, limitFor = (m) => m * 2 + 2, maxStates = 400_000 } = {}) {
  const start = solverStart(level);
  const ids = new Map();
  const depth = [], parent = [], parentMove = [], legal = [], won = [], lost = [];
  const edgeStart = [], edgeCount = [], edges = [];
  const add = (key, d, p, mv, st) => {
    const id = depth.length;
    ids.set(key, id);
    depth.push(d);
    parent.push(p);
    parentMove.push(mv);
    legal.push(0);
    won.push(st.status === 'won');
    lost.push(st.status === 'lost');
    edgeStart.push(-1);
    edgeCount.push(0);
    return id;
  };
  let minMoves = null, solutionNode = -1, truncated = false;
  let limit = depthLimit;
  add(canonicalKey(start, { solver: true }), 0, -1, null, start);
  if (won[0]) {
    minMoves = 0;
    solutionNode = 0;
    limit ??= 0;
  }
  let frontier = [{ id: 0, state: start }];
  for (let d = 0; frontier.length && (limit === null || d < limit); d++) {
    const next = [];
    for (const { id, state } of frontier) {
      if (won[id] || lost[id]) continue;
      const moves = expand(state);
      legal[id] = moves.length;
      edgeStart[id] = edges.length;
      const first = edges.length;
      for (const mv of moves) {
        const r = applyAction(state, mv);
        const key = canonicalKey(r.state, { solver: true });
        let cid = ids.get(key);
        if (cid === undefined) {
          if (depth.length >= maxStates) {
            truncated = true;
            continue;
          }
          cid = add(key, d + 1, id, mv, r.state);
          next.push({ id: cid, state: r.state });
          if (won[cid] && minMoves === null) {
            minMoves = d + 1;
            solutionNode = cid;
            if (limit === null) limit = Math.max(d + 1, limitFor(d + 1));
          }
        }
        let dup = false;
        for (let e = first; e < edges.length; e++) if (edges[e] === cid) dup = true;
        if (!dup) edges.push(cid);
      }
      edgeCount[id] = edges.length - edgeStart[id];
    }
    frontier = next;
    if (truncated) break;
  }
  return { ids, depth, parent, parentMove, legal, won, lost, edgeStart, edgeCount, edges, minMoves, solutionNode, truncated, depthLimit: limit, start };
}

/** Distance (in moves) from every explored state to its nearest win, Infinity if none inside the explored graph. */
export function distancesToWin(g) {
  const n = g.depth.length;
  const dist = new Float64Array(n).fill(Infinity);
  // reverse adjacency
  const rStart = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) for (let e = 0; e < g.edgeCount[i]; e++) rStart[g.edges[g.edgeStart[i] + e] + 1]++;
  for (let i = 0; i < n; i++) rStart[i + 1] += rStart[i];
  const rEdges = new Int32Array(rStart[n]);
  const fill = rStart.slice(0, n);
  for (let i = 0; i < n; i++) for (let e = 0; e < g.edgeCount[i]; e++) rEdges[fill[g.edges[g.edgeStart[i] + e]]++] = i;
  const queue = [];
  for (let i = 0; i < n; i++)
    if (g.won[i]) {
      dist[i] = 0;
      queue.push(i);
    }
  for (let q = 0; q < queue.length; q++) {
    const v = queue[q];
    for (let e = rStart[v]; e < rStart[v + 1]; e++) {
      const u = rEdges[e];
      if (dist[u] === Infinity) {
        dist[u] = dist[v] + 1;
        queue.push(u);
      }
    }
  }
  return dist;
}

/** The move list from the start to node `id`. */
export function pathTo(g, id) {
  const moves = [];
  for (let v = id; v > 0; v = g.parent[v]) moves.push(g.parentMove[v]);
  return moves.reverse();
}

const childrenOf = (g, id) => g.edges.slice(g.edgeStart[id], g.edgeStart[id] + g.edgeCount[id]);

/**
 * Analysis of an explored graph against a move budget.
 */
export function analyzeGraph(g, budget) {
  const dist = distancesToWin(g);
  const n = g.depth.length;
  let expanded = 0, legalSum = 0, childSum = 0, deadEnds = 0, reachable = 0;
  for (let i = 0; i < n; i++) {
    if (g.depth[i] > budget) continue;
    reachable++;
    if (!g.won[i] && g.depth[i] + dist[i] > budget) deadEnds++;
    if (g.edgeStart[i] >= 0 && !g.won[i] && !g.lost[i]) {
      expanded++;
      legalSum += g.legal[i];
      childSum += g.edgeCount[i];
    }
  }
  // along one optimal solution: how many choices keep the level winnable / optimal
  let forcedMoves = 0, criticalSteps = 0, freedom = 0;
  const steps = [];
  if (g.solutionNode >= 0) {
    const path = [];
    for (let v = g.solutionNode; v >= 0; v = g.parent[v]) path.push(v);
    path.reverse();
    for (let k = 0; k < path.length - 1; k++) {
      const v = path[k];
      const kids = childrenOf(g, v);
      const left = budget - (k + 1);
      const safe = kids.filter((c) => dist[c] <= left).length;
      const optimal = kids.filter((c) => dist[c] === dist[v] - 1).length;
      steps.push({ choices: kids.length, safe, optimal });
      if (safe <= 1) forcedMoves++;
      if (kids.length > 1 && safe / kids.length <= 0.34) criticalSteps++;
      freedom += kids.length ? safe / kids.length : 0;
    }
  }
  // number of distinct optimal solutions (state paths), capped
  let optimalSolutions = 0;
  if (g.minMoves !== null) {
    const ways = new Map([[0, 1]]);
    const order = [0];
    const seen = new Set([0]);
    for (let q = 0; q < order.length; q++) {
      const v = order[q];
      const w = ways.get(v);
      if (g.won[v]) {
        if (g.depth[v] === g.minMoves) optimalSolutions += w;
        continue;
      }
      for (const c of childrenOf(g, v)) {
        if (g.depth[c] !== g.depth[v] + 1 || g.depth[c] + dist[c] !== g.minMoves) continue;
        ways.set(c, Math.min(1e9, (ways.get(c) || 0) + w));
        if (!seen.has(c)) {
          seen.add(c);
          order.push(c);
        }
      }
    }
  }
  const startKids = g.edgeStart[0] >= 0 ? childrenOf(g, 0) : [];
  return {
    reachableStates: reachable,
    branchingFactor: expanded ? legalSum / expanded : 0,
    distinctBranching: expanded ? childSum / expanded : 0,
    deadEnds,
    deadEndRatio: reachable ? deadEnds / reachable : 0,
    forcedMoves,
    criticalSteps,
    freedom: steps.length ? freedom / steps.length : 1,
    optimalSolutions,
    openingSafeRatio: startKids.length ? startKids.filter((c) => dist[c] <= budget - 1).length / startKids.length : 0,
    steps,
  };
}

// ------------------------------------------------------------------ A*

// min-heap on f, ties to the deeper node (larger g): reaches a win sooner
const before = (x, y) => x.f < y.f || (x.f === y.f && x.g > y.g);
class Heap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(x) {
    const a = this.a;
    let i = a.push(x) - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!before(x, a[p])) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = x;
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (!a.length) return top;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = l < a.length && before(a[l], last) ? l : -1;
      if (r < a.length && before(a[r], m < 0 ? last : a[l])) m = r;
      if (m < 0) break;
      a[i] = a[m];
      i = m;
    }
    a[i] = last;
    return top;
  }
}

/** A* for minimum moves. Returns { solvable, minMoves, solution, visitedStates, truncated }. */
export function astar(level, { maxStates = 2_000_000 } = {}) {
  const start = solverStart(level);
  const best = new Map();
  const heap = new Heap();
  const startKey = canonicalKey(start, { solver: true });
  best.set(startKey, 0);
  heap.push({ f: lowerBound(start), g: 0, state: start, moves: null });
  let visited = 0;
  while (heap.size) {
    const node = heap.pop();
    const key = canonicalKey(node.state, { solver: true });
    if (best.get(key) < node.g) continue;
    visited++;
    if (node.state.status === 'won') {
      const solution = [];
      for (let m = node.moves; m; m = m.prev) solution.push(m.move);
      return { solvable: true, minMoves: node.g, solution: solution.reverse(), visitedStates: visited, truncated: false };
    }
    if (node.state.status !== 'playing') continue;
    if (best.size > maxStates) return { solvable: null, minMoves: null, solution: null, visitedStates: visited, truncated: true };
    for (const mv of expand(node.state)) {
      const r = applyAction(node.state, mv);
      const k = canonicalKey(r.state, { solver: true });
      const g = node.g + 1;
      if ((best.get(k) ?? Infinity) <= g) continue;
      best.set(k, g);
      heap.push({ f: g + lowerBound(r.state), g, state: r.state, moves: { move: mv, prev: node.moves } });
    }
  }
  return { solvable: false, minMoves: null, solution: null, visitedStates: visited, truncated: false };
}

/**
 * Shortest win from an arbitrary in-play state (hints). Respects the state's own moves left.
 * Returns { solvable, moves: [action...], visitedStates, truncated }.
 */
export function solveFromState(state, { maxStates = 200_000 } = {}) {
  if (state.status === 'won') return { solvable: true, moves: [], visitedStates: 1, truncated: false };
  const seen = new Set([canonicalKey(state, { solver: true })]);
  let frontier = [{ state, path: null }];
  let visited = 1;
  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      for (const mv of expand(node.state)) {
        const r = applyAction(node.state, mv);
        const key = canonicalKey(r.state, { solver: true });
        if (seen.has(key)) continue;
        seen.add(key);
        visited++;
        const path = { move: mv, prev: node.path };
        if (r.state.status === 'won') {
          const moves = [];
          for (let p = path; p; p = p.prev) moves.push(p.move);
          return { solvable: true, moves: moves.reverse(), visitedStates: visited, truncated: false };
        }
        if (r.state.status === 'playing') next.push({ state: r.state, path });
        if (visited > maxStates) return { solvable: null, moves: null, visitedStates: visited, truncated: true };
      }
    }
    frontier = next;
  }
  return { solvable: false, moves: null, visitedStates: visited, truncated: false };
}
