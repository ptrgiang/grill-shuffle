// Shared by pr-shots (before / after into a PR) and variant-shots (N variants into an issue comment): page specs,
// capture through the safe launcher, publishing to the `pr-shots` branch, marker-delimited sections.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchChrome, startVite, sleep, collectPageErrors } from './browser.js';
import { ROOT } from './content.js';
import { tapSelect } from './pages.js';

export const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export const gh = (...a) => execFileSync('gh', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function parsePage(spec) {
  const m = /^(.+?)@(\d+)x(\d+)(m?)((?:\+(?:select|unlock|tap=[^+]+))*)$/.exec(spec.trim());
  if (!m) throw new Error(`bad page spec "${spec}" (want /path@390x844m[+select][+unlock][+tap=<css>])`);
  const [, path, w, h, mobile, flags] = m;
  const select = /\+select(?=\+|$)/.test(flags), unlock = /\+unlock(?=\+|$)/.test(flags);
  const tap = /\+tap=([^+]+)/.exec(flags)?.[1] ?? null;
  const tapName = tap ? `-tap-${tap.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}` : '';
  const name = `${path.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'menu'}-${w}x${h}${select ? '-select' : ''}${tapName}`;
  const q = 'freeze=1&quality=high&coach=0';
  const [page, hash] = path.split('#'); // the flags go in the query, before a #fragment
  return { spec, name, url: page + (page.includes('?') ? '&' : '?') + q + (hash ? `#${hash}` : ''), w: +w, h: +h, mobile: !!mobile, select, unlock, tap };
}

/** `url` with `extra` ("a=1&b=2") added to its query, before any #fragment. */
export function addQuery(url, extra) {
  const [page, hash] = url.split('#');
  return page + (page.includes('?') ? '&' : '?') + extra + (hash ? `#${hash}` : '');
}

/**
 * Vite for the base worktree, through the API: its node_modules is a link to this checkout's, which Vite's
 * fs.strict would refuse (403) as outside the worktree. The worktree's own vite.config.js is used, plus fs.allow.
 */
async function startBaseVite(root) {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: join(root, 'vite.config.js'), root: join(root, 'client'), logLevel: 'silent', server: { port: 0, strictPort: false, fs: { allow: [root, ROOT] } } });
  await server.listen();
  const url = server.resolvedUrls.local[0].replace(/\/$/, '');
  return { url, stop: () => server.close() };
}

export async function capture(root, pages, dir, label) {
  mkdirSync(dir, { recursive: true });
  const vite = root === ROOT ? await startVite(root) : await startBaseVite(root);
  const errors = [];
  try {
    for (const p of pages) {
      const { page, close } = await launchChrome({ width: p.w, height: p.h, mobile: p.mobile, dpr: p.mobile ? 2 : 1, life: 3 * 60_000 });
      try {
        collectPageErrors(page, errors, `${label} ${p.name}: `);
        if (p.unlock) {
          // open the menu, give every story level 3 stars (in memory: this profile is thrown away), then navigate
          // ?lang= is read once at boot, so the menu load carries the page's language
          const lang = new URL(p.url, 'http://x').searchParams.get('lang');
          await page.goto(vite.url + '/?freeze=1&quality=high&coach=0' + (lang ? `&lang=${encodeURIComponent(lang)}` : ''), { waitUntil: 'load', timeout: 60000 });
          // the menu renders after boot loaded the saved progress, which would overwrite stars given earlier
          await page.waitForSelector('.menu', { timeout: 30000 });
          await page.evaluate((u) => {
            const gs = window.__gs;
            for (const pk of gs.packs) for (const id of pk.levels) gs.app.progress[id] = { stars: 3 };
            window.__gameReady = false;
            history.pushState(null, '', u);
            gs.go(location.pathname + location.search + location.hash, { replace: true });
          }, p.url);
        } else await page.goto(vite.url + p.url, { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction('window.__sandboxReady || window.__gameReady', { timeout: 30000 }).catch(() => {});
        await page.evaluate(() => document.fonts?.ready);
        await sleep(1800);
        if (p.select && !(await tapSelect(page).catch(() => false))) errors.push(`${label} ${p.name}: nothing to select`);
        if (p.select) await sleep(700);
        if (p.tap && (await page.$(p.tap))) {
          await page.tap(p.tap);
          await sleep(900);
        }
        await page.screenshot({ path: join(dir, `${p.name}.png`) });
      } finally {
        await close();
      }
    }
  } finally {
    vite.stop();
  }
  return errors;
}

/** Push files to the `pr-shots` branch under `dir/`, through a temporary worktree. */
export function publish(files, dir, message) {
  const wt = mkdtempSync(join(tmpdir(), 'gs-prshots-'));
  rmSync(wt, { recursive: true, force: true });
  let remote = true;
  try {
    git(ROOT, 'fetch', 'origin', 'pr-shots');
  } catch {
    remote = false;
  }
  try {
    try {
      git(ROOT, 'branch', '-D', 'pr-shots');
    } catch {}
    if (remote) git(ROOT, 'worktree', 'add', '-B', 'pr-shots', wt, 'origin/pr-shots');
    else {
      git(ROOT, 'worktree', 'add', '--orphan', '-b', 'pr-shots', wt);
      writeFileSync(join(wt, 'README.md'), '# pr-shots\n\nBefore / after screenshots for pull requests (`npm run pr-shots`). Never merged into `main`.\n');
    }
    mkdirSync(join(wt, dir), { recursive: true });
    for (const f of files) copyFileSync(f.src, join(wt, dir, f.name));
    git(wt, 'add', '-A');
    if (git(wt, 'status', '--porcelain')) {
      // a re-run with identical images has nothing to commit; the files are already on the branch
      git(wt, 'commit', '-m', message);
      git(wt, 'push', 'origin', 'pr-shots');
    }
  } finally {
    try {
      git(ROOT, 'worktree', 'remove', '--force', wt);
    } catch {}
    try {
      git(ROOT, 'branch', '-D', 'pr-shots');
    } catch {}
  }
}

/** `body` with the `tag` section replaced (or appended before the attribution footer). */
export function withSection(body, section, tag = 'pr-shots') {
  const START = `<!-- ${tag}:start -->`, END = `<!-- ${tag}:end -->`;
  const block = `${START}\n${section}\n${END}`;
  if (body.includes(START) && body.includes(END)) return body.slice(0, body.indexOf(START)) + block + body.slice(body.indexOf(END) + END.length);
  const foot = body.lastIndexOf('🤖 Generated with');
  return foot >= 0 ? `${body.slice(0, foot)}${block}\n\n${body.slice(foot)}` : `${body.trimEnd()}\n\n${block}\n`;
}
