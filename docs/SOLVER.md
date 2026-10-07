# Solver, difficulty and generator

## Assumptions

- The solver calls the **same** `getLegalMoves` / `applyAction` / `canonicalKey` as the game. There is no second
  copy of the rules to drift.
- Full information: the solver sees stacked layers (the player sees only their count). Difficulty adds a term for
  hidden layers.
- Boosters are ignored by the solver (levels must be winnable without them).
- Unit move cost, so breadth-first search gives exact minimums.

## State space reduction

- `canonicalKey(state, { solver: true })`: each grill's foods are sorted (slot order is irrelevant) and grills are
  sorted (identical grills are interchangeable). Moves left/used are excluded (BFS depth tracks them); score/combo
  only count when a `reach_score` goal exists.
- `getLegalMoves(state, { unique: true })`: one move per (source grill, food, destination grill), always into the
  destination's first empty slot.

## `explore` → analysis

`search.explore` runs BFS up to a depth limit (the move budget), keeping every edge. `distancesToWin` runs a
backwards BFS from every winning state. Then, against budget `B`:

| Output | Meaning |
|---|---|
| `minMoves` | depth of the first winning state |
| `visitedStates` | states explored |
| `branchingFactor` | mean legal (unique) moves per expanded state; `distinctBranching` = distinct children |
| `deadEnds`, `deadEndRatio` | reachable states (depth ≤ B) from which no win fits in the remaining budget |
| `forcedMoves` | steps on the optimal line where only one choice keeps the level winnable |
| `criticalSteps` | steps where ≤ ⅓ of the choices keep it winnable |
| `freedom` | mean share of safe choices along the optimal line |
| `optimalSolutions` | number of distinct optimal state paths (capped at 1e9) |
| `openingSafeRatio` | share of first moves that keep the level winnable |
| `solution` | one optimal action list (and `solutionString`) |

Boards too large for exploration (`maxStates`) fall back to **A\*** with `heuristic.lowerBound` (admissible:
proved in the file, tested against BFS on random boards). Hints use `solveFromState` (BFS from the live state, in
a Web Worker).

## Difficulty (0..100, tunable in `solver/difficulty.js`)

```
depth     30 · min(1, minMoves / 24)
deadEnds  22 · deadEndRatio^0.7
tightness 18 · (1 − freedom)
branching 10 · log2(branchingFactor) / log2(24)
margin    12 · (1 − (budget − min) / (0.7 · min))
mechanics  2 per stacked layer (≤ 6) + 2 per lock (≤ 4)
```
Ratings: 0–20 Easy, 21–40 Normal, 41–60 Hard, 61–80 Very Hard, 81+ Challenge. The formula is a starting point:
change weights, run `npm run solve -- --all`, compare the ordering with play-test notes, then
`npm run solve -- --all --write` (validate:levels fails until stored difficulties are refreshed).

## Generator (`solver/generator.js`)

```
seed ─► makeCandidate (grills, trays, empties, layers, locks, foods as whole triples)
     ─► validateLevel ─► boardSignature dedupe ─► solveLevel(tier budget)
     ─► rejectReason: unsolvable · too big · trivial · too long · outside difficulty ·
                      excessively forced · no meaningful decisions · unreadable
     ─► moves = moveBudget(min, tier); solver block stored ─► rank (closeness to target, critical steps)
```
Same config + seed + `GENERATOR_VERSION` ⇒ same levels (tested). `boardSignature` is invariant to grill order and
to relabelling foods (k! relabellings), so "the same board with shrimp and corn swapped" is a duplicate.

## CLI

```
npm run solve -- street-004             # one level: min moves, states, branching, dead ends, difficulty, solution
npm run solve -- --all                  # table for every level
npm run solve -- street-004 --write     # set moves from the level's tier and store the solver block
npm run solve -- --seed 42 --band H     # the puzzle behind a generated code
npm run generate:levels -- --theme street_bbq --count 100 --difficulty 20:40 --out content/generated/batch1
npm run bench:solver
```

## Performance (Node 24, this machine)

~20–35k states/s through the full simulation (events included). All 10 story levels solve in < 0.5 s each;
Hard generated boards 10–45k states (0.5–2 s). Band C (81+) has no v1 preset: such boards are too large to
analyse in a browser tab. Next optimisation, if needed: a compact integer state encoding used by both solver and
game, measured with `npm run bench:solver`.
