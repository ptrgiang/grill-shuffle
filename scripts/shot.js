// Deterministic screenshots of pages (through the safe launcher in scripts/lib/browser.js).
//   npm run shot -- /sandbox/food?spin=0 [--w 900 --h 600] [--mobile] [--out shots/food.png] [--wait 1500]
//   npm run shot -- --set   the standard visual-regression set (desktop + mobile, seeded) into shots/
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { launchChrome, startVite, sleep, collectPageErrors } from './lib/browser.js';
import { ROOT, parseArgs } from './lib/content.js';

const args = parseArgs();
const SET = [
  { path: '/sandbox/food?spin=0&seed=1', w: 1200, h: 700, out: 'food-lineup.png' },
  { path: '/sandbox/food?spin=0&seed=1&grills=1', w: 1200, h: 700, out: 'food-grills.png' },
  { path: '/sandbox/food?spin=0&seed=1&ui=0', w: 390, h: 844, mobile: true, out: 'food-lineup-390.png' }, // readability check
  { path: '/sandbox/food?spin=0&seed=1&ui=0&grills=1', w: 360, h: 800, mobile: true, out: 'food-grills-360.png' },
  { path: '/sandbox/board?level=street-003&anim=0', w: 1280, h: 800, out: 'board-desktop.png' },
  { path: '/sandbox/board?level=street-009&anim=0', w: 390, h: 844, mobile: true, out: 'board-mobile-390.png' },
  { path: '/sandbox/board?level=street-010&anim=0', w: 360, h: 800, mobile: true, out: 'board-mobile-360.png' },
  { path: '/sandbox/board?level=street-008&anim=0', w: 430, h: 932, mobile: true, out: 'board-mobile-430.png' },
  { path: '/sandbox/board?level=street-015&anim=0', w: 390, h: 844, mobile: true, out: 'board-mobile-390-oranges.png' }, // shrimp / carrot / salmon
  { path: '/sandbox/board?level=street-016&anim=0', w: 360, h: 800, mobile: true, out: 'board-mobile-360-slabs.png' }, // steak / toast / salmon
  { path: '/play/street-001', w: 390, h: 844, mobile: true, out: 'game-mobile.png' },
  { path: '/', w: 1280, h: 800, out: 'menu-desktop.png' },
  // issue #3 viewports: HUD vs board on small, tall and sideways phones
  ...[[360, 640], [390, 844], [430, 932], [844, 390], [1280, 800]].flatMap(([w, h]) => [
    { path: '/level/31', w, h, mobile: w < 1000, out: `layout-game-${w}x${h}.png` },
    { path: '/', w, h, mobile: w < 1000, out: `layout-menu-${w}x${h}.png` },
  ]),
];

const jobs = args.set
  ? SET
  : [{ path: args._[0] ?? '/', w: Number(args.w ?? 900), h: Number(args.h ?? 600), mobile: !!args.mobile, out: args.out ?? 'shot.png' }];

const vite = await startVite(ROOT);
const errors = [];
try {
  for (const job of jobs) {
    const { page, close } = await launchChrome({ width: job.w, height: job.h, mobile: job.mobile, life: 3 * 60_000 });
    try {
      collectPageErrors(page, errors, `${job.path}: `);
      await page.goto(vite.url + job.path, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction('window.__sandboxReady || window.__gameReady', { timeout: 30000 }).catch(() => {});
      await sleep(Number(args.wait ?? 1500));
      const file = job.out.includes('/') || job.out.includes('\\') ? join(ROOT, job.out) : join(ROOT, 'shots', job.out);
      mkdirSync(dirname(file), { recursive: true });
      await page.screenshot({ path: file });
      console.log(`shot ${job.path} -> ${file}`);
    } finally {
      await close();
    }
  }
} finally {
  vite.stop();
}
if (errors.length) {
  console.log('page errors:\n' + errors.join('\n'));
  process.exitCode = 1;
}
