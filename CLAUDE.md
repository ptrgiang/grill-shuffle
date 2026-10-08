# Grill Shuffle — agent notes

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first, and [docs/STORY.md](docs/STORY.md) for anything the player sees. Process: [CONTRIBUTING.md](CONTRIBUTING.md).

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
- Content direction (#62, revised 2026-10-08 by the owner; `docs/LEVELS.md` "Content rules"): one pack per theme,
  **at most 50 levels per pack**, each new theme has its own curve from easy and introduces its new foods. Shipped
  levels keep their position and id (never inserted, reordered or removed; new ones only at the end while < 50).
  **New features (boosters, mechanics, foods) go into existing levels, not new ones**: edit the level, raise its
  difficulty if needed, `solve -- <id> --write`. Inside a pack a level is never easier than any level before it, also
  after an edit (Street BBQ 1–50 are legacy-exempt). `validate:levels` enforces it against the base branch.
  Ask the owner before any exception.
- Levels are data. `moves` and `solver` blocks are written by `npm run solve -- <id> --write`, never by hand.
  Bulk content comes from `npm run generate:levels` into a staging folder, then human review.
- Any headless browser goes through `scripts/lib/browser.js` (`launchChrome`). Never launch Chrome/Puppeteer
  directly: on Windows a fresh Chromium profile signs in with an empty password ~40 s after start, and repeated
  failures lock the user's account. The launcher prevents that and checks the failed sign-in counter.
  `GS_NO_BROWSER=1` disables all browsers. If `gs-chrome.blocked` appears, read it: it lists the browsers that were up
  as OURS / FOREIGN. Other automation on the same machine can fail the blank-password check too; a FOREIGN-only block
  is not ours (issue #55): tell the user before deleting it.
- Workflow per task: inspect → find the owning subsystem → smallest coherent change → tests → sim/solver tests →
  validate levels → look at the change (`/sandbox/*`, `npm run shot`) → mobile input if touched → docs.

- Story (#78, `docs/STORY.md`): Vietnamese-rooted, mostly wordless, motion-driven; story work goes before feature work.
  Every player-facing string is written in **vi and en** in the same change (no English-only text, no later pass).
  Level display names / hints may be rewritten for the story; ids and positions never.
  Beats are content (`content/story/`) + client presentation; never in `shared/`/`solver/`, never change a level.
  Do not run huashu-art-motion's `render.py` here (it launches Playwright directly).
- UI changes: **5 variants in the issue first** (label `design/variants`), owner picks, then the PR (`CONTRIBUTING.md` step 0).

## Windows dev machine

- Git Bash rewrites arguments that start with `/` into Windows paths: prefix such commands with `MSYS_NO_PATHCONV=1`
  (e.g. `npm run shot -- /play/street-001`).
- This repo defaults to Vite on 5188 and wrangler dev on 8797, away from the common 5173 / 8787 that other local
  projects use (`GS_API_PORT` overrides the Vite `/api` target).
- Deploys normally go through CI. A manual `npx wrangler deploy` works too (wrangler is logged in).
