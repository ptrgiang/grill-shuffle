# What we took from `webdevcody/survive-the-night-fps` (and what we didn't)

Studied at commit `HEAD` of 2026-10-07 (shallow clone). It is a co-op horror FPS: three.js client, authoritative
Node/uWebSockets.js server, binary protocol, PostgreSQL, Railway. Very different game, useful engineering habits.

## Adopted

| Pattern there | How Grill Shuffle uses it |
|---|---|
| `shared/` = pure JS used by both ends, no DOM, no three.js | `shared/` is the whole puzzle simulation; the browser, the solver, the generator and the Worker all import it. `npm run check` enforces the boundary (no three, no DOM, no `Math.random`, no clock). |
| `mulberry32` seeded PRNG + integer hash noise, identical everywhere | `shared/rng.js` (mulberry32, cyrb53, `deriveSeed`). Pinned values are unit-tested: changing them changes every seeded level and share link. |
| Procedural canvas textures, no image files | `client/render/textures.js`: wood, embers, metal, badges, particle dot. |
| Procedural models built from primitives | `client/render/foods.js`, `grill.js`: every food and grill is code. |
| Procedural audio synthesised as pure functions `(sampleRate, …) => Float32Array`, testable in Node | `client/audio/synth.js` (tested in `tests/client/pure.test.js`); `audio.js` only wraps Web Audio (lifecycle tested against a fake context in `tests/client/audio.test.js`). |
| Shared geometry/materials, fixed light count, no per-frame allocation | One merged geometry per food variant, one material per look, fixed 3-light rig, pooled particles. |
| Sandbox pages per subsystem (`client/sandbox/*`) | `/sandbox/food`, `/sandbox/board`. |
| Tiny dependency list, many plain `node` test scripts, a `node --check` sweep | `three` only at runtime; tests use `node:test`; `scripts/check.js`. |
| **The safe headless-browser launcher** (Chromium's blank-password probe can lock a Windows account) | `scripts/lib/browser.js` keeps the essential rules: pre-seeded `Local State`, failed-sign-in counter checked before/after with a block file, no credentials, one browser per machine, watchdog, SwiftShader, `GS_NO_BROWSER=1` kill switch. Every Puppeteer use goes through it. |
| Docs that explain conventions and invariants, not just APIs | `docs/*.md`. |

## Rejected (FPS-specific or against this project's platform rules)

- Client-side prediction, reconciliation, entity interpolation, lag compensation, hit detection, binary delta
  snapshots: a turn-based puzzle has none of these problems. A move is one tiny deterministic command.
- uWebSockets.js / Node HTTP servers / worker-thread rooms / Railway / PostgreSQL: replaced by a Cloudflare Worker,
  Workers Static Assets and D1. No server is involved in a move at all.
- Large procedural world generation (terrain, roads, buildings): our "world" is a few grills; generation effort goes
  into puzzles instead (generator + solver + difficulty evaluator).
- CC0 sample banks: Grill Shuffle ships no audio files yet; everything is synthesised (R2 is reserved for audio
  banks if we ever want them).
- Crowd/bone-texture/multi-draw batching: our draw-call count is ~50; we measured before optimising (see
  `docs/PERFORMANCE.md`).
