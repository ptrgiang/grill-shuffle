---
name: next-issue
description: Pick the most important workable GitHub issue of Grill Shuffle and take it through the flow (claim, branch, implement, checks, PR, CI) up to review. Use when the user says "next issue", "làm issue tiếp theo", "tự chọn issue", "continue the roadmap", or starts a session asking to keep developing.
---

# Next issue: issue → branch → PR → review → merge → deploy

Follow CLAUDE.md and CONTRIBUTING.md. Stop at review unless the user explicitly asked you to merge.

## 1. Sync and pick

```bash
git checkout main && git pull --ff-only
npm ci            # only if package-lock.json changed
npm run next-issue
```
`next-issue` reads the pinned roadmap (#35, "Suggested order"), skips issues that are in progress, assigned, already
claimed by an open PR, or waiting for an open dependency, and prints the pick with its branch name.
If the user named an issue, use that one instead (still check it is not claimed).
If an open PR of yours already exists for the top issue, continue that PR instead of starting a new one.

## 2. Claim it (so a parallel session does not take it)

```bash
gh issue edit <n> --add-label status/in-progress --add-assignee @me
gh issue comment <n> --body "Started on branch <branch>."
git checkout -b <branch>          # the name written in the issue
```

## 3. Understand before coding

Read the whole issue (scope + acceptance), the docs it names, and the code it lists. Identify the owning subsystem
(`shared/` rules, `solver/`, `client/render`, `client/game`, `worker/`, `content/`). If the issue is too big for one
PR, split it: comment the split on the issue, create the follow-up issue(s), add them to the roadmap #35, and do the
first part only. If something in the issue is ambiguous enough to change the design, ask the user before building.

## 4. Implement + verify

- Smallest coherent change; tests next to it (sim/solver/worker/client as relevant).
- Always: `npm run ci` (check + tests + validate:levels + build).
- Content (levels, packs, foods, mechanics): follow the content rules (`docs/LEVELS.md`, #62 revised). Max 50 levels
  per pack; a pack below 50 grows with `generate:levels --append <pack>`; a new feature (booster, mechanic, food) goes
  into **existing** levels (edit + `solve -- <id> --write`), never into new levels or new packs just for it; never
  easier; ids and positions never change. If an issue asks for something else (inserting a level mid-pack, a
  breather, a 51st level), ask the user first.
- Rule changes: bump `PUZZLE_RULE_VERSION`, `npm run solve -- --all --write`, `npm run validate:levels`, `npm run fuzz -- 20000`.
- Input / UI / visuals: `npm run test:e2e`, `npm run shot -- --set`, and LOOK at the PNGs (desktop + 360/390/430 phones).
  Headless browsers only via `scripts/lib/browser.js`.
- Update the docs the issue touches.

## 5. Pull request

```bash
git push -u origin <branch>
gh pr create --base main --title "<type>: <summary>" --body-file <file>   # .github/pull_request_template.md, "Closes #<n>"
MSYS_NO_PATHCONV=1 npm run pr-shots -- --pages "<spec>,<spec>"          # UI PRs: before / after into the PR (5b)
gh pr checks <pr> --watch
```
Fix CI until green.

### 5b. Before / after screenshots (UI PRs: default ON)

The reviewer should see the change without checking out the branch. `npm run pr-shots` captures each page on
`origin/main` (temporary worktree `.pr-base/`) and on the branch, puts each pair side by side (left before, right
after), pushes the images to the `pr-shots` branch and writes them into the PR body between
`<!-- pr-shots:start -->` / `<!-- pr-shots:end -->`. It only shows pairs that changed; the rest are listed as
unchanged. Re-run after every visual fix: the section is replaced, older images stay on `pr-shots`.

- **When**: the diff (`git diff --name-only origin/main...HEAD`) touches anything that renders: `client/render/`,
  `client/ui/`, `client/style.css`, `client/main.js`, `client/index.html`, `client/public/`, `content/` (levels,
  themes), or food / theme data in `shared/`.
- **Pages**: pick the ones that SHOW the change, not just the default set. Spec `<path>@<W>x<H>[m][+select]`
  (`m` = phone with touch, `+select` = a food tap-selected first), e.g. `/level/27@390x844m+select`,
  `/level/31@1280x800`, `/@390x844m`, `/sandbox/food?spin=0&seed=1@1200x700`. A phone (390×844) always; desktop too
  when the layout or HUD changed; 360×640 / 844×390 when space is tight. States the URL cannot reach (a drag, a match
  burst) are described in words.
- **Check them yourself** (Read the PNGs in `shots/pr/<n>/`) before reporting: the "after" must show the intended
  change and nothing else. An unexpected change in a page you did not mean to touch is a finding: fix it or explain it.
- **Skip** when the change cannot be seen (pure logic, solver, worker, tests, docs, CI) or is a tiny tweak (a
  constant, a copy fix) where pictures add nothing, and whenever the user says to skip screenshots. Then the PR body
  says `Screenshots: skipped (<reason>)`, so the reviewer knows it was deliberate.

Then STOP and report to the user: PR link, what changed (point at the before/after section), how it was verified,
anything left open. Review is theirs.

## 6. After the user merges (or asks you to)

```bash
gh pr merge <pr> --squash --delete-branch
git checkout main && git pull --ff-only
gh run watch $(gh run list --branch main --event push -L 1 --json databaseId --jq '.[0].databaseId') --exit-status
curl -s -o /dev/null -w "%{http_code}\n" https://grillshuffle.thebuilder.work/
```
Verify the change on the live site. The issue closes through the PR; remove `status/in-progress` if it stays open.
Then offer the next pick (`npm run next-issue`).
