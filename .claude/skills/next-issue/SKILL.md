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
- Rule changes: bump `PUZZLE_RULE_VERSION`, `npm run solve -- --all --write`, `npm run validate:levels`, `npm run fuzz -- 20000`.
- Input / UI / visuals: `npm run test:e2e`, `npm run shot -- --set`, and LOOK at the PNGs (desktop + 360/390/430 phones).
  Headless browsers only via `scripts/lib/browser.js`.
- Update the docs the issue touches.

## 5. Pull request

```bash
git push -u origin <branch>
gh pr create --base main --title "<type>: <summary>" --body-file <file>   # .github/pull_request_template.md, "Closes #<n>"
gh pr checks <pr> --watch
```
Attach screenshots for visual changes (describe them if upload is not possible). Fix CI until green.
Then STOP and report to the user: PR link, what changed, how it was verified, anything left open. Review is theirs.

## 6. After the user merges (or asks you to)

```bash
gh pr merge <pr> --squash --delete-branch
git checkout main && git pull --ff-only
gh run watch $(gh run list --branch main --event push -L 1 --json databaseId --jq '.[0].databaseId') --exit-status
curl -s -o /dev/null -w "%{http_code}\n" https://grillshuffle.thebuilder.work/
```
Verify the change on the live site. The issue closes through the PR; remove `status/in-progress` if it stays open.
Then offer the next pick (`npm run next-issue`).
