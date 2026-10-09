// Before / after screenshots for a pull request: captures pages on the base (default origin/main, checked out in a
// temporary git worktree) and on this working tree, puts each pair side by side, pushes the images to the `pr-shots`
// branch (never merged; one folder per PR and commit) and writes them into the PR description between
//   <!-- pr-shots:start --> ... <!-- pr-shots:end -->   (replaced on every run, the rest of the body is kept).
//
//   npm run pr-shots                                   PR of the current branch, default pages
//   npm run pr-shots -- --pages "/saigon-alley/27@390x844m+select,/@1280x800"
//   npm run pr-shots -- --pr 61 --base origin/main --no-publish     (local only: shots/pr/)
//   npm run pr-shots -- --all --pages "…"              show every pair, also the small ones (a HUD line of text)
//
// Page spec: <path>@<W>x<H>[m][+select][+unlock][+tap=<css>]
//   m = phone (touch, DPR 2), +select = tap-select a food first (game pages), +unlock = every story level 3 stars
//   first (locked packs open, e.g. /fishing-village/37), +tap=<css> = tap that element first (e.g. a HUD button:
//   +tap=[data-booster=fan]; skipped quietly where it does not exist, as on a base without the feature).
// Every URL gets freeze=1&quality=high&coach=0 (still frames, pinned tier); a base without those flags ignores them.
// Pairs that differ by more than 0.4 % of their pixels are shown; the others are listed as unchanged (--all: every
// pair is shown, for changes too small for the threshold, e.g. a level name in the HUD).
import { writeFileSync, readFileSync, existsSync, rmSync, rmdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome } from './lib/browser.js';
import { ROOT, parseArgs } from './lib/content.js';
import { parsePage, capture, publish, withSection, git, gh } from './lib/shots.js';

export { parsePage, withSection };

const args = parseArgs();
const DEFAULT_PAGES = ['/saigon-alley/1@390x844m', '/saigon-alley/27@390x844m+select', '/saigon-alley/27@844x390m', '/saigon-alley/31@1280x800', '/@390x844m'];
const CHANNEL_TOL = 40, MAX_CHANGED = 0.004;
const OUT = join(ROOT, 'shots', 'pr');

/** Side-by-side image with labels + the changed-pixel ratio, rendered in headless Chrome. */
async function compose(pairs, labels) {
  const { page, close } = await launchChrome({ width: 800, height: 600, life: 3 * 60_000 });
  try {
    for (const pr of pairs) {
      const r = await page.evaluate(
        async (a64, b64, la, lb, tol) => {
          const load = (b) => new Promise((res, rej) => Object.assign(new Image(), { onload() { res(this); }, onerror: rej, src: `data:image/png;base64,${b}` }));
          const [a, b] = await Promise.all([load(a64), load(b64)]);
          const px = (img) => {
            const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
            const g = c.getContext('2d', { willReadFrequently: true });
            g.drawImage(img, 0, 0);
            return g.getImageData(0, 0, img.width, img.height).data;
          };
          let changed = 0;
          if (a.width === b.width && a.height === b.height) {
            const da = px(a), db = px(b);
            for (let i = 0; i < da.length; i += 4) if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > tol) changed++;
          } else changed = a.width * a.height;
          const gap = 24, head = 44, s = a.width >= 1000 ? 0.5 : 1; // desktop pairs at half size so they fit a PR
          const W = Math.round((a.width + b.width) * s) + gap * 3, H = Math.round(Math.max(a.height, b.height) * s) + head + gap;
          const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
          const g = c.getContext('2d');
          g.fillStyle = '#16101a';
          g.fillRect(0, 0, W, H);
          g.font = '600 20px system-ui, sans-serif';
          g.textBaseline = 'middle';
          const ax = gap, bx = gap * 2 + Math.round(a.width * s);
          g.fillStyle = '#d9c2ad';
          g.fillText(la, ax, head / 2);
          g.fillStyle = '#ffb347';
          g.fillText(lb, bx, head / 2);
          g.drawImage(a, ax, head, a.width * s, a.height * s);
          g.drawImage(b, bx, head, b.width * s, b.height * s);
          return { ratio: changed / (a.width * a.height), png: c.toDataURL('image/png').split(',')[1] };
        },
        readFileSync(pr.before).toString('base64'),
        readFileSync(pr.after).toString('base64'),
        labels.before,
        labels.after,
        CHANNEL_TOL,
      );
      pr.ratio = r.ratio;
      writeFileSync(pr.pair, Buffer.from(r.png, 'base64'));
    }
  } finally {
    await close();
  }
}

async function main() {
  const pages = (args.pages ? String(args.pages).split(',') : DEFAULT_PAGES).map(parsePage);
  const base = args.base ?? 'origin/main';
  const publishIt = !args['no-publish'];
  const pr = publishIt ? JSON.parse(gh('pr', 'view', ...(args.pr ? [String(args.pr)] : []), '--json', 'number,body,headRefName')) : { number: args.pr ?? 'local' };
  if (git(ROOT, 'status', '--porcelain', '--untracked-files=no')) console.log('note: uncommitted changes are in the "after" captures');
  git(ROOT, 'fetch', 'origin', 'main');
  const baseSha = git(ROOT, 'rev-parse', '--short', base);
  const headSha = git(ROOT, 'rev-parse', '--short', 'HEAD');
  const branch = git(ROOT, 'rev-parse', '--abbrev-ref', 'HEAD');
  const outDir = join(OUT, String(pr.number));
  rmSync(outDir, { recursive: true, force: true });

  // the base in a temporary worktree inside the repo (.pr-base/, gitignored: no 8.3 temp paths, inside Vite's allow
  // list), sharing this checkout's node_modules through a junction
  const wt = join(ROOT, '.pr-base');
  if (existsSync(wt)) throw new Error(`${wt} exists (an earlier run died?): rmdir ${join(wt, 'node_modules')}, then git worktree remove --force .pr-base`);
  git(ROOT, 'worktree', 'add', '--detach', wt, base);
  const errors = [];
  try {
    symlinkSync(join(ROOT, 'node_modules'), join(wt, 'node_modules'), 'junction');
    if (git(ROOT, 'diff', '--name-only', base, 'HEAD', '--', 'package-lock.json')) console.log('note: package-lock.json differs from the base; the base runs with this branch\'s node_modules');
    errors.push(...(await capture(wt, pages, join(outDir, 'before'), 'before')));
  } finally {
    // drop the junction itself (rmdir removes the link, never the target's files) BEFORE git deletes the worktree:
    // `worktree remove` deletes untracked files and must not walk into this checkout's node_modules
    const link = join(wt, 'node_modules');
    try {
      rmdirSync(link);
    } catch {}
    if (existsSync(link)) throw new Error(`could not remove the node_modules link in ${wt}; remove it by hand (rmdir), then git worktree prune`);
    git(ROOT, 'worktree', 'remove', '--force', wt);
  }
  errors.push(...(await capture(ROOT, pages, join(outDir, 'after'), 'after')));

  const pairs = pages.map((p) => ({ ...p, before: join(outDir, 'before', `${p.name}.png`), after: join(outDir, 'after', `${p.name}.png`), pair: join(outDir, `${p.name}.png`) }));
  await compose(pairs, { before: `Before · ${base.replace('origin/', '')} ${baseSha}`, after: `After · ${branch} ${headSha}` });
  const shown = (p) => args.all || p.ratio > MAX_CHANGED;
  const changed = pairs.filter(shown);
  const same = pairs.filter((p) => !shown(p));
  for (const p of pairs) console.log(`${p.ratio > MAX_CHANGED ? 'changed  ' : 'unchanged'} ${p.spec}  ${(p.ratio * 100).toFixed(2)} % -> ${p.pair}`);
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  if (!publishIt) return;

  const repo = gh('repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner');
  const dir = `pr-${pr.number}/${headSha}`;
  if (changed.length) publish(changed.map((p) => ({ src: p.pair, name: `${p.name}.png` })), dir, `pr-${pr.number}: before/after at ${headSha} (base ${baseSha})`); // nothing to push when nothing changed
  const img = (p) => `https://github.com/${repo}/blob/pr-shots/${dir}/${p.name}.png?raw=true`;
  const lines = [
    '## Screenshots: before / after',
    `Base \`${base.replace('origin/', '')}@${baseSha}\` → \`${branch}@${headSha}\`, captured by \`npm run pr-shots\` (headless Chrome, time frozen, quality high). Left: before, right: after.`,
    '',
  ];
  if (changed.length) for (const p of changed) lines.push(`**${p.spec}**: ${(p.ratio * 100).toFixed(1)} % of pixels changed`, '', `![${p.name}](${img(p)})`, '');
  else lines.push('No visual change on any captured page.', '');
  if (same.length) lines.push(`Unchanged (< ${MAX_CHANGED * 100} % of pixels): ${same.map((p) => `\`${p.spec}\``).join(', ')}`);
  if (errors.length) lines.push('', `Page errors during capture: ${errors.length} (see the run log).`);
  const file = join(outDir, 'body.md');
  writeFileSync(file, withSection(pr.body ?? '', lines.join('\n')));
  gh('pr', 'edit', String(pr.number), '--body-file', file);
  console.log(`PR #${pr.number} updated: ${changed.length} changed, ${same.length} unchanged`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/pr-shots.js')) await main();
