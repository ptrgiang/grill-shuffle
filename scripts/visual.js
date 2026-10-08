// Visual regression: capture a fixed set of pages with time frozen (?freeze=1) and compare each with its committed
// baseline in tests/visual/ by pixel diff (in headless Chrome, so no image library is needed).
//   npm run visual                 compare; writes shots/visual/{actual,diff}/ and fails on an unexpected change
//   npm run visual -- --update     overwrite the baselines with this machine's captures
//   npm run visual:accept [-- <run-id>]   take the baselines from a CI run's `visual` artifact (the usual way)
// Baselines come from CI (Linux): fonts and the software rasterizer differ slightly between OSes, so captures made on
// Windows / macOS are only compared locally, never committed. Captures are at device pixel ratio 1 to keep the
// committed PNGs small; `quality=high` pins the tier so a slow machine's auto-downgrade cannot change the look.
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome, startVite, sleep, collectPageErrors } from './lib/browser.js';
import { ROOT, parseArgs } from './lib/content.js';

const BASELINE_DIR = join(ROOT, 'tests', 'visual');
const OUT = join(ROOT, 'shots', 'visual');

// pixels whose largest channel difference is above CHANNEL_TOL count as changed; a capture fails when more than
// MAX_CHANGED of its pixels changed (anti-aliasing and sub-pixel float noise stay well below that)
const CHANNEL_TOL = 40;
const MAX_CHANGED = 0.004;

const q = 'freeze=1&quality=high&coach=0';
const SET = [
  { name: 'food-lineup', path: `/sandbox/food?spin=0&seed=1&${q}`, w: 1200, h: 700 },
  { name: 'board-desktop', path: `/sandbox/board?level=street-003&anim=0&${q}`, w: 1280, h: 800 },
  { name: 'game-360x640', path: `/level/31?${q}`, w: 360, h: 640, mobile: true },
  { name: 'game-390x844', path: `/level/1?${q}`, w: 390, h: 844, mobile: true },
  { name: 'game-430x932', path: `/level/24?${q}`, w: 430, h: 932, mobile: true },
  { name: 'game-844x390', path: `/level/27?${q}`, w: 844, h: 390, mobile: true },
  { name: 'game-1280x800', path: `/level/31?${q}`, w: 1280, h: 800 },
  { name: 'menu-390x844', path: `/?${q}`, w: 390, h: 844, mobile: true },
  { name: 'menu-1280x800', path: `/?${q}`, w: 1280, h: 800 },
];

/** Compare two PNGs (buffers) inside the page. Returns { width, height, changed, ratio, sizeMismatch, diffPng }. */
async function compare(page, baseline, actual) {
  return page.evaluate(
    async (a64, b64, tol) => {
      const load = (b) => new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = `data:image/png;base64,${b}`;
      });
      const [a, b] = await Promise.all([load(a64), load(b64)]);
      if (a.width !== b.width || a.height !== b.height) return { sizeMismatch: `${a.width}x${a.height} vs ${b.width}x${b.height}` };
      const px = (img) => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height);
      };
      const da = px(a), db = px(b);
      const out = new ImageData(a.width, a.height);
      let changed = 0;
      for (let i = 0; i < da.data.length; i += 4) {
        const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
        const grey = (db.data[i] + db.data[i + 1] + db.data[i + 2]) / 9; // faded actual image as context
        if (d > tol) {
          changed++;
          out.data.set([255, 0, 64, 255], i);
        } else out.data.set([grey, grey, grey, 255], i);
      }
      const c = document.createElement('canvas');
      c.width = a.width;
      c.height = a.height;
      c.getContext('2d').putImageData(out, 0, 0);
      return { width: a.width, height: a.height, changed, ratio: changed / (a.width * a.height), diffPng: c.toDataURL('image/png').split(',')[1] };
    },
    baseline.toString('base64'),
    actual.toString('base64'),
    CHANNEL_TOL,
  );
}

async function main() {
  const args = parseArgs();
  const only = args._[0];
  const jobs = only ? SET.filter((j) => j.name.includes(only)) : SET;
  for (const d of ['actual', 'diff']) mkdirSync(join(OUT, d), { recursive: true });
  mkdirSync(BASELINE_DIR, { recursive: true });
  const vite = await startVite(ROOT);
  const errors = [];
  const results = [];
  try {
    for (const job of jobs) {
      const { page, close } = await launchChrome({ width: job.w, height: job.h, mobile: !!job.mobile, dpr: 1, life: 3 * 60_000 });
      try {
        collectPageErrors(page, errors, `${job.name}: `);
        await page.goto(vite.url + job.path, { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction('window.__sandboxReady || window.__gameReady', { timeout: 30000 }).catch(() => {});
        await page.evaluate(() => document.fonts?.ready);
        await sleep(1800); // CSS transitions (tip, menu) finish; the canvas is frozen anyway
        const actual = await page.screenshot({ type: 'png' });
        const file = `${job.name}.png`;
        writeFileSync(join(OUT, 'actual', file), actual);
        const basePath = join(BASELINE_DIR, file);
        if (args.update) {
          writeFileSync(basePath, actual);
          results.push({ name: job.name, status: 'updated' });
        } else if (!existsSync(basePath)) {
          results.push({ name: job.name, status: 'missing', note: 'no baseline (npm run visual:accept after CI, or --update on Linux)' });
        } else {
          const r = await compare(page, readFileSync(basePath), actual);
          if (r.sizeMismatch) results.push({ name: job.name, status: 'changed', note: `size ${r.sizeMismatch}` });
          else {
            if (r.changed) writeFileSync(join(OUT, 'diff', file), Buffer.from(r.diffPng, 'base64'));
            const pct = (r.ratio * 100).toFixed(3);
            results.push({ name: job.name, status: r.ratio > MAX_CHANGED ? 'changed' : 'ok', note: `${r.changed} px changed (${pct} %)` });
          }
        }
      } finally {
        await close();
      }
    }
  } finally {
    vite.stop();
  }
  for (const r of results) console.log(`${r.status === 'ok' || r.status === 'updated' ? 'ok  ' : 'FAIL'} ${r.name}: ${r.status}${r.note ? ` - ${r.note}` : ''}`);
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  const failed = results.filter((r) => r.status === 'changed' || r.status === 'missing').length;
  if (failed) console.log(`\n${failed} capture(s) differ from tests/visual/. Diffs: shots/visual/diff/. If the change is intended: npm run visual:accept`);
  // stale baselines (a capture removed from SET) are reported, not deleted
  const known = new Set(SET.map((j) => `${j.name}.png`));
  const stale = existsSync(BASELINE_DIR) ? readdirSync(BASELINE_DIR).filter((f) => f.endsWith('.png') && !known.has(f)) : [];
  if (stale.length) console.log(`stale baselines (not in SET): ${stale.join(', ')}`);
  process.exitCode = failed || errors.length ? 1 : 0;
}

await main();
