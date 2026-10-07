// Picks the most important issue that can be worked on right now (for a person or an agent starting a session).
//   npm run next-issue            the pick, with why the issues ahead of it were skipped
//   npm run next-issue -- --json  machine-readable
//   npm run next-issue -- --all   the full ranked list
//
// Order: the "Suggested order" section of the pinned roadmap issue (type/epic). Edit that issue to reprioritise.
// Issues not listed there come after, by priority label then number.
// Skipped: labelled status/in-progress, assigned, already closed by an open PR ("Closes #n"), or depending on an issue
// that is still open ("Depends on ... #n" in the body).
import { execFileSync } from 'node:child_process';

const REPO = process.env.GH_REPO ?? 'ptrgiang/grill-shuffle';
const args = new Set(process.argv.slice(2));
const gh = (...a) => JSON.parse(execFileSync('gh', [...a, '-R', REPO], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));

const issues = gh('issue', 'list', '--state', 'open', '--limit', '300', '--json', 'number,title,labels,assignees,milestone,body,url');
const prs = gh('pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,body,title,headRefName');
const openSet = new Set(issues.map((i) => i.number));
const labels = (i) => i.labels.map((l) => l.name);

// roadmap order
const roadmap = issues.find((i) => labels(i).includes('type/epic'));
const order = [];
if (roadmap) {
  const m = /## Suggested order([\s\S]*?)(\n## |$)/.exec(roadmap.body);
  for (const n of (m?.[1] ?? '').matchAll(/#(\d+)/g)) if (!order.includes(+n[1])) order.push(+n[1]);
}

// open PRs that close an issue
const claimedByPr = new Map();
for (const pr of prs) for (const n of `${pr.title}\n${pr.body}`.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi)) claimedByPr.set(+n[1], pr.number);

function dependsOn(body) {
  const out = new Set();
  for (const m of body.matchAll(/Depends on[\s\S]*?(?=\n## |\n---|$)/gi)) for (const n of m[0].matchAll(/#(\d+)/g)) out.add(+n[1]);
  return [...out];
}

const PRIORITY = { 'priority/high': 0, 'priority/medium': 1, 'priority/low': 2 };
const prio = (i) => Math.min(3, ...labels(i).map((l) => PRIORITY[l] ?? 3));

const ranked = issues
  .filter((i) => !labels(i).includes('type/epic'))
  .map((i) => {
    const idx = order.indexOf(i.number);
    return { ...i, rank: idx >= 0 ? idx : 1000 + prio(i) * 1000 + i.number };
  })
  .sort((a, b) => a.rank - b.rank)
  .map((i) => {
    const why = [];
    if (labels(i).includes('status/in-progress')) why.push('in progress');
    if (i.assignees.length) why.push(`assigned to ${i.assignees.map((a) => a.login).join(', ')}`);
    if (claimedByPr.has(i.number)) why.push(`open PR #${claimedByPr.get(i.number)}`);
    const blockers = dependsOn(i.body).filter((n) => openSet.has(n) && n !== i.number);
    if (blockers.length) why.push(`waits for ${blockers.map((n) => `#${n}`).join(', ')}`);
    const branch = /branch `([^`]+)`/.exec(i.body)?.[1] ?? null;
    return { number: i.number, title: i.title, url: i.url, milestone: i.milestone?.title ?? null, labels: labels(i), branch, inRoadmap: order.includes(i.number), blocked: why };
  });

const pick = ranked.find((i) => !i.blocked.length) ?? null;

if (args.has('--json')) {
  console.log(JSON.stringify({ pick, skippedAhead: pick ? ranked.slice(0, ranked.indexOf(pick)) : ranked, roadmap: roadmap?.number ?? null }, null, 2));
} else {
  if (!roadmap) console.log('(no roadmap issue labelled type/epic: ordering by priority only)');
  const ahead = pick ? ranked.slice(0, ranked.indexOf(pick)) : ranked;
  for (const i of ahead) console.log(`skip #${i.number} ${i.title} — ${i.blocked.join('; ')}`);
  if (pick) {
    console.log(`\nNEXT #${pick.number} ${pick.title}`);
    console.log(`  milestone: ${pick.milestone ?? '-'}   labels: ${pick.labels.join(', ')}`);
    console.log(`  branch:    ${pick.branch ?? '(name one in the issue)'}`);
    console.log(`  ${pick.url}`);
  } else console.log('\nNothing workable: every open issue is blocked, claimed or waiting.');
  if (args.has('--all')) {
    console.log('\nFull order:');
    for (const i of ranked) console.log(`  #${i.number} ${i.blocked.length ? `[${i.blocked.join('; ')}] ` : ''}${i.title}`);
  }
}
