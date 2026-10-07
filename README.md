# Grill Shuffle

**Food Sort & Match Puzzle** — a tactile 2.5D grill puzzle in the browser. Drag food between grills, put three of a
kind together, watch them flame up and get served. Every level is proven solvable by a solver, its move budget and
stars come from the true minimum, and boards can be shared as links that rebuild the exact same puzzle.

Play: **https://grillshuffle.thebuilder.work**

Original game: its own rules, levels, obstacles, art (all procedural), audio (all synthesised) and progression.

```
inspect → move → match → sizzle → clear → chain → complete goals
```

## Quick start

```bash
npm install
npm run dev                 # http://localhost:5188  (the game; plays fully offline)
npm test                    # simulation, solver, fuzz, worker API, pure client tests
npm run validate:levels     # every production level: schema + solver verification
npm run solve -- street-004 # min moves, states, branching, dead ends, difficulty, solution
```

Pages: `/` menu · `/level/<n>` · `/play` (continue) · `/levels` · `/daily` · `/p/<code>` shared challenge ·
`/sandbox/food` · `/sandbox/board?level=street-009`.

Controls: drag a food onto another grill, or tap it then tap a grill. `Z` undo, `R` restart, `H` hint, `Esc` pause.

## What's here (vertical slice)

- **Deterministic engine** (`shared/`): board state, move model, legal moves, triple matching (data-driven matchers),
  chain resolution, combo, composable goals, locked grills, stacked trays (reveal), prep trays, two boosters,
  canonical hashing, replay, share codes. Renderer-independent; fuzz-tested (same state + move ⇒ same result;
  replay ⇒ same hash).
- **Solver + difficulty + generator** (`solver/`): BFS state-graph analysis (min moves, dead ends, forced moves,
  optimal-line count), A* fallback, admissible heuristic, tunable difficulty score, seeded generator with quality
  filter and food-relabelling-invariant dedupe.
- **Street BBQ**: 10 hand-designed, solver-verified levels (difficulty 15 → 52).
- **Renderer** (`client/render/`): orthographic 2.5D diorama, procedural grills and 7 procedural foods with shader
  grill marks, pooled flame/spark/steam particles, event-driven animation that never affects the result.
- **Input**: Pointer Events (mouse/touch/pen), drag-and-drop and tap-tap, mobile-first layout.
- **Audio**: Web Audio, every sound synthesised; combo-aware match sound; grill ambience.
- **Progress**: IndexedDB save, stars, unlocks; async sync to the Worker.
- **Cloudflare**: Worker API + Static Assets + D1 (progress, daily and challenge results replayed server-side).
- **Daily puzzle** and **shareable challenges** (`/p/<code>`, self-contained codes, `?m=` target to beat).

## Scripts

| | |
|---|---|
| `npm run dev` / `build` / `preview` | Vite dev · production build · build + `wrangler dev` (Worker + local D1) |
| `npm test` (`test:sim`, `test:solver`, `test:worker`) | node:test suites |
| `npm run fuzz -- 20000` | long fuzz run of the simulation |
| `npm run check` | syntax + architecture boundaries (shared/solver: no three/DOM/Math.random/clock) |
| `npm run solve -- <id> [--write] / --all / --code <c>` | solver CLI |
| `npm run validate:levels` | CI gate for level packs |
| `npm run generate:levels -- --count 100 --difficulty 20:40 [--out dir]` | generator CLI |
| `npm run bench:solver` | solver throughput |
| `npm run shot -- --set` / `npm run test:e2e` | screenshots / browser e2e (safe headless launcher) |
| `npm run db:migrate:local` / `npm run deploy` | D1 local migrations / CI + `wrangler deploy` |

## Docs

[Architecture](docs/ARCHITECTURE.md) · [Puzzle rules](docs/PUZZLE.md) · [Solver & generator](docs/SOLVER.md) ·
[Levels](docs/LEVELS.md) · [Rendering](docs/RENDERING.md) · [Cloudflare](docs/CLOUDFLARE.md) ·
[Performance](docs/PERFORMANCE.md) · [Reference study](docs/REFERENCE.md)

## Status and next milestones

Done: M0–M9 (foundation, simulation, solver, renderer, input, match presentation, level system, difficulty,
generator, first 10 levels), parts of M11–M15 (stars/progression, IndexedDB, Worker + D1 sync, daily, share links).
Next: burn counter + one more blocker (M10), booster UI, `/sandbox` pages for grills/particles/themes, real-device
performance pass, expand Street BBQ to ~50 levels via the generator + human review (M16).
