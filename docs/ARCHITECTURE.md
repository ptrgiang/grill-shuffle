# Architecture

```
                       CLOUDFLARE
                 Worker (/api/*) + Static Assets (dist/)
                          │
              ┌───────────┼─────────────┐
              ▼           ▼             ▼
             D1           R2       Durable Objects
         progression   (unused)    (unused: realtime later)
                          │
                       BROWSER
   input ─► Session ─► shared simulation ─► next state + events ─► BoardView timeline ─► three.js
                 │                                                       │
              IndexedDB ◄── results ── (async) ──► /api sync         Web Audio
```

## The one rule

**The simulation (`shared/`) is authoritative. The renderer is not.** Nothing reads game truth from meshes. The
view is a function of `(state, events)`; skipping every animation (`BoardView.skip()`, `?anim=0`) leaves the game
exactly where it was. The e2e test reads results from `window.__gs.state`, never from the scene.

## Layout

```
shared/        pure, deterministic puzzle engine (no DOM, no three.js, no Math.random, no clock)
  version.js     puzzleRuleVersion / levelFormatVersion / challengeVersion / generatorVersion / saveVersion
  foods.js       food catalog (id, one-char code, name, colour hint, category)
  rules.js       data-driven rules: matchers (same_food, category), matchSize, grill types (grill, tray)
  levels.js      level format + structural validator
  state.js       createState / cloneState / serializeState / deserializeState
  moves.js       move model, legality, getLegalMoves (full and solver-unique), compact action strings
  match.js       findMatches (pure)
  resolve.js     applyAction / applyMove: the only place state changes; produces events
  obstacles.js   locked grills, stacked trays
  combo.js       combo on consecutive productive moves
  goals.js       composable objectives
  boosters.js    tongs, fan (deterministic, seeded from the state hash)
  hash.js        canonicalKey / hashState / hashBoard
  replay.js      replay(level, actions) -> same final hash
  progression.js move budgets + stars from solver minimum, unlocks
  challenge.js   share codes (offline, checksummed), daily seed/band
solver/        search over the shared simulation
  search.js      BFS exploration with full edge graph, distance-to-win, analysis; A*; solveFromState (hints)
  heuristic.js   admissible lower bound
  difficulty.js  0..100 difficulty from the analysis (tunable weights)
  solver.js      solveLevel(level) -> report
  canonical.js   board signature for dedupe (grill order + food relabelling invariant)
  generator.js   seeded candidates -> validate -> solve -> filter -> dedupe -> rank
  presets.js     generator configs per challenge version/band; puzzleForCode
  benchmark.js
client/        browser game (Vite root)
  main.js        routes, screens, HUD, wiring
  ui/            dom.js (h, toasts), fit.js (board margins measured from the HUD / menu), coach.js (first-level
                 onboarding hand), install.js, update.js
  sw.js          service worker source (offline); scripts/build-sw.js writes dist/sw.js with the precache list
  game/          session.js (state + undo + action log), input.js (pointer state machine), content.js (packs),
                 solver.worker.js + solver-client.js (generation and hints off the main thread)
  render/        stage.js (renderer, camera, lights, backdrop), layout.js (pure board layout + hit test),
                 board.js (BoardView: state + events -> animation), grill.js, foods.js, materials.js,
                 particles.js, textures.js, icons.js
  audio/         synth.js (pure generators), audio.js (Web Audio engine: gesture unlock + iOS priming,
                 hide/show suspend + ambience fade, sfx/ambience volumes, idle buffer warm-up)
  storage/       db.js (IndexedDB kv), sync.js (best-effort cloud sync + offline outbox, flushed on `online`)
  ui/            dom.js (tiny DOM helpers), install.js ("Install app": native prompt or per-platform steps),
                 update.js (registers the service worker in production builds, "new version" bar)
  public/        fonts/ (self-hosted Fredoka, OFL), favicon.svg (the logo), manifest.webmanifest + icons/ (installed app: name and icon are
                 "Grill Shuffle"; regenerate the PNGs with node scripts/make-icons.js after a logo change)
  sandbox/       /sandbox/food, /sandbox/board
content/       levels/<pack>/*.json + pack.json, themes/*.json
worker/        index.js (API), progress.js (sanitising uploads), content.gen.js (generated)
migrations/    D1 schema
scripts/       solve, validate-levels, generate-levels, fuzz, check, shot, e2e, build-content, build-sw, make-icons, lib/browser.js
tests/         node:test suites: sim/, solver/, worker/, client/
```

## Data flow of one move

1. `Input` (pointer down/move/up) asks the `Session` what is legal (`canPick`, `targetsFor`, `dropSlot`) and emits
   `{ type: 'move', from, to }`.
2. `Session.apply` → `shared/resolve.applyAction` returns `{ ok, state, events }` and records the action.
3. `BoardView.play(state, events)` schedules the presentation: arc, landing hiss, per-chain match bursts, lock
   counters, reveals, end screen. It calls `onFx(event, screenPos)` on each beat (audio, HUD, score popups).
4. `reconcile(state)` makes the view converge on the authoritative layout regardless of what animations did.

Input is never blocked by animation. A move during an animation simply retargets.

## Determinism

Same level + same actions ⇒ same final `hashState`, on every machine (fuzz-tested). Item ids are a deterministic
sequence used only as rendering identity. Fan booster randomness is seeded from the state's own canonical hash.
Generators are seeded with `deriveSeed(seed, …)` and versioned.

## Versioning

`shared/version.js`. A change that can alter the outcome of any action sequence bumps `PUZZLE_RULE_VERSION`. Share
codes carry `CHALLENGE_VERSION`; `solver/presets.js` keeps one frozen config set per version so old links keep
producing the same board. Saves carry `SAVE_VERSION`.

## Offline (PWA)

The production build is fully playable offline once it has been opened once:

- `dist/sw.js` (from `client/sw.js` + `scripts/build-sw.js`, part of `npm run build`) precaches every build file
  except the sandbox, crawler and share-preview files. Navigations get the cached app shell (`/`, the SPA
  `index.html`); hashed assets are cache-first; `/api/*` is never touched. The cache name carries a hash of the
  precached files, so every deploy that changes them installs a new worker.
- Updates: the new worker precaches in the background and waits; `client/ui/update.js` shows "A new version is
  ready" and on "Update" lets it take over and reloads. The worker is not registered under `vite` dev.
- Story levels are bundled; the daily is built locally by the solver worker when `/api/daily` is unreachable and
  saved as `dailyLevel:<date>`; generated challenges are built locally anyway.
- Writes never wait for the network: a failed progress push sets `syncPending`, a daily / challenge result that
  could not be sent goes to `outbox` (4xx answers are final and dropped). `flushOutbox` sends both on app start
  and on the `online` event; the server re-plays each result and keeps the player's best.
- Fonts are self-hosted (`client/public/fonts`), no third-party request at all.
