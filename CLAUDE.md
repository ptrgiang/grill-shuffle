# Grill Shuffle — agent notes

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first.

- The simulation in `shared/` is authoritative. Never derive game truth from meshes; never put rules in render,
  input or animation code. `shared/` and `solver/` must stay free of three.js, the DOM, `Math.random` and the clock
  (`npm run check` enforces it).
- A rule change that can alter any move sequence's outcome bumps `PUZZLE_RULE_VERSION`, and needs
  `npm test` + `npm run solve -- --all` + `npm run validate:levels`. Never edit a shipped `CHALLENGE_PRESETS` version.
- Levels are data. `moves` and `solver` blocks are written by `npm run solve -- <id> --write`, never by hand.
  Bulk content comes from `npm run generate:levels` into a staging folder, then human review.
- Any headless browser goes through `scripts/lib/browser.js` (`launchChrome`). Never launch Chrome/Puppeteer
  directly: on Windows a fresh Chromium profile signs in with an empty password ~40 s after start, and repeated
  failures lock the user's account. The launcher prevents that and checks the failed sign-in counter.
  `GS_NO_BROWSER=1` disables all browsers. In Git Bash, prefix commands that pass URL paths with `MSYS_NO_PATHCONV=1`.
- Workflow per task: inspect → find the owning subsystem → smallest coherent change → tests → sim/solver tests →
  validate levels → look at the change (`/sandbox/*`, `npm run shot`) → mobile input if touched → docs.
