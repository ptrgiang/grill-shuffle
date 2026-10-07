// End-to-end: plays real levels through real input in headless Chrome (safe launcher), reading the result from the
// authoritative simulation state (window.__gs.state), never from meshes.
//   desktop: mouse drag-and-drop, plus an invalid drop that must change nothing
//   mobile:  touch tap-to-select + tap-destination at 390 x 844
// Each solves the level with its stored optimal solution and expects a 3-star win and the results screen.
import { launchChrome, startVite, sleep, collectPageErrors } from './lib/browser.js';
import { ROOT } from './lib/content.js';
import { decodeActions } from '../shared/moves.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const level = (id) => JSON.parse(readFileSync(join(ROOT, 'content/levels/street_bbq', `${id}.json`), 'utf8'));
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

async function slotXY(page, grill, slot) {
  return page.evaluate(
    (g, s) => {
      const v = window.__gs.view;
      const p = v.slotPos(g, s);
      p.y = 0.12;
      return v.stage.toScreen(p);
    },
    grill,
    slot,
  );
}

async function settle(page, ms = 700) {
  await sleep(ms);
}

async function run(name, { w, h, mobile, levelId, mode }) {
  const lvl = level(levelId);
  const moves = decodeActions(lvl.solver.solution);
  const { page, close } = await launchChrome({ width: w, height: h, mobile, life: 3 * 60_000 });
  const errors = [];
  collectPageErrors(page, errors);
  try {
    await page.goto(`${vite.url}/play/${levelId}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__gameReady === true', { timeout: 30000 });
    await settle(page, 600);
    const state = () => page.evaluate(() => ({ status: window.__gs.state.status, movesUsed: window.__gs.state.movesUsed, grills: window.__gs.state.grills.map((g) => g.slots.map((x) => x && x.food)) }));

    if (mode === 'drag') {
      // an invalid drop (back onto its own grill) must change nothing
      const before = await state();
      const m0 = moves[0];
      const a = await slotXY(page, m0.from.grill, m0.from.slot);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(a.x + 25, a.y + 5, { steps: 4 });
      await page.mouse.move(a.x + 2, a.y, { steps: 4 });
      await page.mouse.up();
      await settle(page, 300);
      check(JSON.stringify(await state()) === JSON.stringify(before), `${name}: dropping back on its own grill changes nothing`);
    }

    for (const m of moves) {
      const a = await slotXY(page, m.from.grill, m.from.slot);
      const b = await slotXY(page, m.to.grill, m.to.slot);
      if (mode === 'drag') {
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
        await page.mouse.up();
      } else {
        await page.touchscreen.tap(a.x, a.y);
        await sleep(120);
        await page.touchscreen.tap(b.x, b.y);
      }
      await settle(page, 450);
    }
    await settle(page, 1500);
    const s = await state();
    check(s.status === 'won', `${name}: level ${levelId} won through ${mode} input (status ${s.status})`);
    check(s.movesUsed === lvl.solver.minMoves, `${name}: used ${s.movesUsed} moves = solver minimum ${lvl.solver.minMoves}`);
    // the results screen waits for the match animation (slow in software rendering: dt is clamped per frame)
    await page.waitForFunction(() => document.querySelectorAll('.stars.big .star.on').length > 0, { timeout: 30000 }).catch(() => {});
    await sleep(1200);
    const modal = await page.evaluate(() => ({ title: document.querySelector('.modal h2')?.textContent, stars: document.querySelectorAll('.stars.big .star.on').length }));
    check(modal.stars === 3, `${name}: results screen shows ${modal.stars} stars ("${modal.title}")`);
    const saved = await page.evaluate((id) => new Promise((res) => {
      const r = indexedDB.open('grill-shuffle');
      r.onsuccess = () => {
        const q = r.result.transaction('kv').objectStore('kv').get('progress');
        q.onsuccess = () => res(q.result?.[id] ?? null);
      };
    }), levelId);
    check(saved?.stars === 3, `${name}: progress saved to IndexedDB (${JSON.stringify(saved)})`);
    const fps = await page.evaluate(() => new Promise((res) => {
      let n = 0;
      const t0 = performance.now();
      const f = () => (++n, performance.now() - t0 < 1000 ? requestAnimationFrame(f) : res(n));
      requestAnimationFrame(f);
    }));
    console.log(`     ${name}: ~${fps} frames/s in headless software rendering (not a GPU measurement)`);
    check(errors.length === 0, `${name}: no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
    await page.screenshot({ path: join(ROOT, 'shots', `e2e-${name}.png`) });
  } finally {
    await close();
  }
}

const vite = await startVite(ROOT);
try {
  await run('desktop', { w: 1280, h: 800, mobile: false, levelId: 'street-003', mode: 'drag' });
  await run('mobile', { w: 390, h: 844, mobile: true, levelId: 'street-006', mode: 'tap' });
} finally {
  vite.stop();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall e2e checks passed');
process.exit(failures ? 1 : 0);
