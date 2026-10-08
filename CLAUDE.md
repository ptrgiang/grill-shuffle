# Grill Shuffle — agent notes

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first. Process: [CONTRIBUTING.md](CONTRIBUTING.md).

## Starting a session

Work is driven by GitHub issues (`ptrgiang/grill-shuffle`), ordered by the pinned roadmap issue #35.
When asked to continue development / take the next issue, use the `next-issue` skill (`/next-issue`):
`git checkout main && git pull`, `npm run next-issue`, claim the pick (`status/in-progress` + assign), work it on the
branch named in the issue, open a PR with `Closes #n`, get CI green, then stop for the user's review.
Never push to `main` directly (it is not branch-protected, treat it as if it were). Merge only when the user says so;
merging deploys to https://grillshuffle.thebuilder.work through CI.

## Rules

- The simulation in `shared/` is authoritative. Never derive game truth from meshes; never put rules in render,
  input or animation code. `shared/` and `solver/` must stay free of three.js, the DOM, `Math.random` and the clock
  (`npm run check` enforces it).
- A rule change that can alter any move sequence's outcome bumps `PUZZLE_RULE_VERSION`, and needs
  `npm test` + `npm run solve -- --all` + `npm run validate:levels`. Never edit a shipped `CHALLENGE_PRESETS` version.
- Content direction (#62, `docs/LEVELS.md` "Content rules"): levels are only **appended** to the end of a pack, never
  inserted, reordered or removed; inside a pack a new level is never easier (solver difficulty ≥ every earlier level;
  Street BBQ from #51, ≥ 58); each new pack has its own curve from easy; new foods / mechanics only in new levels.
  `validate:levels` enforces it against the base branch. Ask the owner before any exception.
- Levels are data. `moves` and `solver` blocks are written by `npm run solve -- <id> --write`, never by hand.
  Bulk content comes from `npm run generate:levels` into a staging folder, then human review.
- Any headless browser goes through `scripts/lib/browser.js` (`launchChrome`). Never launch Chrome/Puppeteer
  directly: on Windows a fresh Chromium profile signs in with an empty password ~40 s after start, and repeated
  failures lock the user's account. The launcher prevents that and checks the failed sign-in counter.
  `GS_NO_BROWSER=1` disables all browsers. If `gs-chrome.blocked` appears, read it: it lists the browsers that were up
  as OURS / FOREIGN. Other automation on this machine (facebook-studio's Playwright, threads-topic) fails the
  blank-password check several times a day; a FOREIGN-only block is not ours (issue #55), tell the user before deleting it.
- Workflow per task: inspect → find the owning subsystem → smallest coherent change → tests → sim/solver tests →
  validate levels → look at the change (`/sandbox/*`, `npm run shot`) → mobile input if touched → docs.

## This machine (Windows)

- Git Bash rewrites arguments that start with `/` into Windows paths: prefix such commands with `MSYS_NO_PATHCONV=1`
  (e.g. `npm run shot -- /play/street-001`).
- Ports 5173 and 5180 (pianory) and 8787 (facebook-studio's shopee proxy, restarts itself) belong to other local
  projects. This repo defaults to Vite on 5188 and wrangler dev on 8797 (`GS_API_PORT` overrides the Vite `/api` target).
- Deploys normally go through CI. A manual `npx wrangler deploy` works too (wrangler is logged in).
