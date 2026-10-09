# Cloudflare

One Worker (`worker/index.js`) + Workers Static Assets (`dist/`, the Vite build) + D1. Config: `wrangler.jsonc`.

- `run_worker_first: ["/api/*"]`: only the API runs code; everything else is served as static assets.
- `not_found_handling: "single-page-application"`: `/<pack>/<n>` (e.g. `/hem-sai-gon/12`, `/saigon-alley/12`), `/play/…`, `/p/<code>`, `/daily`, `/levels` serve `index.html`.
- `/sandbox/board` resolves to `sandbox/board.html` (default html handling).

## API

All JSON; players are anonymous device ids sent as `x-player-id` (`[A-Za-z0-9-]{8,64}`, created client-side).

| Route | |
|---|---|
| `GET /api/version` | rule / format / challenge / generator / save versions |
| `GET /api/me` | registers / touches the player |
| `GET /api/progress` | best per story level |
| `POST /api/progress` `{ progress }` | merged per level (max stars, min moves); only story levels; stars capped by what the claimed moves earn |
| `GET /api/daily[?date=]` | `{ date, code, seed, band, rulesVersion, challengeVersion, boardHash, minMoves, level, players, bestMoves, avgMoves }`; `level` is the pre-built puzzle (null until built, or when built under older rules) |
| `POST /api/daily/result` `{ date, moves, hash }` | replayed on the server; keeps the player's best; returns percentile |
| `POST /api/challenge` `{ band }` | a fresh generated code |
| `GET /api/challenge/:code` | stats for a code |
| `POST /api/challenge/:code/result` `{ moves, hash }` | replayed; best kept; percentile |

Results are **move lists** replayed with the shared simulation (`verified = 1`), never trusted totals. Generated
and daily puzzles are built from their code once (solver CPU) and cached in `challenge_links`. The account is on Workers Paid
(30 s CPU per request / cron run by default; a build takes ~150 ms); `limits.cpu_ms` can raise it (commented in wrangler.jsonc).
No per-move writes.

## Cron: daily pre-build

`triggers.crons: ["5 0 * * *"]` runs the Worker's `scheduled` handler (`prebuildDaily` in `worker/index.js`) at
00:05 UTC: it builds today's and tomorrow's daily into `challenge_links` (already cached days are a lookup), so the
solver never runs on a player's request and `GET /api/daily` can hand the level to the client, which then skips local
generation (`client/game/daily.js` `serverDailyLevel` checks code, date, rules version and structure; otherwise the
client generates the same board itself). Tomorrow is built a day early so midnight players already hit the cache.
Local test: `npx wrangler dev --test-scheduled`, then `curl "http://localhost:8797/cdn-cgi/handler/scheduled?cron=5+0+*+*+*"`.
Worker tests call `worker.scheduled(...)` directly.

The daily result screen shows the server's verified rank (percentile, players today, best moves), a local streak
(`dailyStreak` in IndexedDB: consecutive UTC days with a daily win) and the countdown to the next daily.

## D1 schema (`migrations/0001_init.sql`)

`users`, `user_settings`, `level_progress`, `challenge_links`, `challenge_results`, `daily_results`,
`booster_inventory`. Planned: `event_progress`, `analytics_rollups`.

## Share links

`/p/<code>` where the code is self-contained (`shared/challenge.js`): `G1<band><seed5><check>` generated,
`S1<index2><check>` story level, `D1<day3><check>` daily. No lookup is needed to rebuild the board; the server only
stores results. `?m=<moves>` carries the sharer's move count as a target.

## Local

```
npm run db:migrate:local     # .wrangler/ local D1
npm run preview              # build + wrangler dev on :8797 (dev.port in wrangler.jsonc)
npm run dev                  # Vite on :5188 (proxies /api to :8797, or GS_API_PORT; the game works without it)
```

## Deploy

Production: **https://banamgrill.thebuilder.work** (Worker custom domain, `routes` in wrangler.jsonc; zone
`thebuilder.work` on the same Cloudflare account). D1 `grill-shuffle` id `25ccd2c2-595c-4c22-b13d-62e6e349bb08`.
Until #94 (2026-10-09) the game was served at grillshuffle.thebuilder.work; that custom domain was detached
completely (no redirect: there were no real players yet, owner's decision). A newly attached custom domain takes a
few minutes for DNS and its certificate, so the CI smoke test retries for up to five minutes.

CI/CD (`.github/workflows/ci.yml`): every PR and push runs check → tests → validate:levels → fuzz → build. On
push to `main` the `deploy` job applies D1 migrations, runs `wrangler deploy` and smoke-tests the site. It needs
two repository secrets: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (an API token with *Workers Scripts:
Edit*, *D1: Edit*, *Workers Routes: Edit* and *Zone: Read* for thebuilder.work). Without the token the job skips with
a notice.

Manual: `npm run deploy` (CI checks, then `wrangler deploy`), migrations with
`npx wrangler d1 migrations apply grill-shuffle --remote`.

## Not used yet (on purpose)

- **R2**: procedural food and synthesised audio need no assets. Reserve for audio banks, GLB, seasonal themes,
  generated share images.
- **Durable Objects / WebSockets**: only for realtime features (race, tournament room, presence). A race would put
  both players on the same code and sync only moves/results through one object.
