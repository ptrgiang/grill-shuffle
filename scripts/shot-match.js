// Frames of the match presentation (selection -> lift -> converge -> flame burst -> serve):
//   node scripts/shot-match.js  -> shots/match-<n>.png
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { launchChrome, startVite, sleep } from './lib/browser.js';
import { ROOT } from './lib/content.js';

const vite = await startVite(ROOT);
const { page, close } = await launchChrome({ width: 700, height: 520 });
try {
  mkdirSync(join(ROOT, 'shots'), { recursive: true });
  await page.goto(`${vite.url}/sandbox/board?level=street-001`, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__sandboxReady');
  await page.evaluate(() => document.getElementById('panel').classList.add('min'));
  await sleep(800);
  await page.evaluate(() => window.__board.doMove({ type: 'move', from: { grill: 1, slot: 2 }, to: { grill: 0, slot: 2 } }));
  for (let i = 0; i < 6; i++) {
    await page.screenshot({ path: join(ROOT, 'shots', `match-${i}.png`) });
    await sleep(260);
  }
} finally {
  await close();
  vite.stop();
}
