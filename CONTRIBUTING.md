# Contributing: issue → branch → PR → review → merge → deploy

1. **Issue.** Pick with `npm run next-issue` (roadmap #35 order, skips claimed/blocked issues), then claim it
   (`status/in-progress` + assignee). Every change starts from an issue (templates: feature, bug). It states the problem, scope and
   acceptance criteria, and names its branch. Labels: `area/*`, `priority/*`; milestone = the plan step.
2. **Branch** from up-to-date `main`, named in the issue: `feat/…`, `fix/…`, `perf/…`, `content/…`, `chore/…`,
   `test/…`. One issue per branch; keep it independent of other open branches.
3. **Work** (see `CLAUDE.md`): smallest coherent change, tests with it. Locally before pushing:
   ```
   npm run ci                      # check + tests + validate:levels + build
   npm run test:e2e                # when input / UI changed (safe headless launcher)
   npm run shot -- --set           # when visuals changed: look at every PNG
   ```
   After opening the PR, for any UI change: `npm run pr-shots -- --pages "/level/27@390x844m+select,..."` puts
   before / after pairs (main vs the branch) into the PR body, so the reviewer sees the change without a checkout.
4. **Pull request** into `main`, using the template, with `Closes #<issue>`. CI (`checks` job) must be green; on
   PRs touching `client/`, `content/` or `shared/` the `visual` workflow pixel-compares frozen captures against
   `tests/visual/` (see `docs/RENDERING.md`, "Visual regression"). An intended look change: `npm run visual:accept`,
   review the new baselines in the diff, commit them.
5. **Review.** Reviewer checks the template's checklist: simulation stays authoritative and deterministic, rule
   changes bump `PUZZLE_RULE_VERSION`, levels re-solved, mobile checked when input/UI changed, docs updated.
6. **Merge**: squash only (the PR title becomes the commit), branch auto-deleted.
7. **Deploy**: the push to `main` runs CI again and the `deploy` job (D1 migrations → `wrangler deploy` →
   smoke test) to https://grillshuffle.thebuilder.work. Verify the change on the live site (and a phone for
   mobile issues), then the issue closes via the PR.

Rollback: `npx wrangler rollback` (previous Worker version) or revert the squash commit on `main`.

Note: `main` is not branch-protected (needs GitHub Pro on a private repo). Treat it as protected: no direct pushes.
