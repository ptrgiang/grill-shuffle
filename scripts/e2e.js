// End-to-end: plays real levels through real input in headless Chrome (safe launcher), reading the result from the
// authoritative simulation state (window.__gs.state), never from meshes.
//   desktop: mouse drag-and-drop, plus an invalid drop that must change nothing
//   mobile:  touch tap-to-select (on the top of the item) + tap-destination at 390 x 844
//   mobile-drag: touch drag-and-drop at 390 x 844; the carried item must ride above the finger and land where the
//                item (not the finger) is released
//   burn-*: the burn levels (rules v3) won through tap / drag, the tray level included
//   burn-char: lets an item char on purpose and expects the level lost with the "Burnt!" screen
//   landscape: tap play on a phone held sideways (844 x 390, HUD in side columns, asymmetric camera frustum)
//   layout-*: at 360x640, 390x844, 430x932, 844x390 and 1280x800 the game HUD and the menu never cover the board, the
//             board stays on screen, and every control is a tap target of at least 44 x 44 px
// Each winning case solves the level with its stored optimal solution and expects a 3-star win and the results screen.
import { launchChrome, startVite, sleep, collectPageErrors } from './lib/browser.js';
import { ROOT } from './lib/content.js';
import { decodeActions, getLegalMoves } from '../shared/moves.js';
import { createState } from '../shared/state.js';
import { applyAction } from '../shared/resolve.js';
import { POINTER_TUNING } from '../client/game/input.js';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const level = (id) => JSON.parse(readFileSync(join(ROOT, 'content/levels/street_bbq', `${id}.json`), 'utf8'));
const STORY = JSON.parse(readFileSync(join(ROOT, 'content/levels/street_bbq/pack.json'), 'utf8')).levels;
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

async function slotXY(page, grill, slot, y = 0.12) {
  return page.evaluate(
    (g, s, y) => {
      const v = window.__gs.view;
      const p = v.slotPos(g, s);
      p.y = y;
      return v.stage.toScreen(p);
    },
    grill,
    slot,
    y,
  );
}

/** Screen position of the dragged item (`target`: where it is heading; else where it is drawn), null if none. */
const dragXY = (page, target = false) =>
  page.evaluate((target) => {
    const v = window.__gs.view;
    const p = target ? v.drag?.target : v.drag?.view?.holder.position;
    return p ? v.stage.toScreen(p) : null;
  }, target);

/** The board's screen box: every slot centre of every grill, padded by half an item. */
const boardBox = (page) =>
  page.evaluate(() => {
    const v = window.__gs.view;
    const xs = [], ys = [];
    v.layout.grills.forEach((L, g) => {
      for (let s = 0; s < L.slots; s++) {
        for (const dx of [-0.5, 0.5]) for (const dz of [-0.45, 0.45]) {
          const p = v.slotPos(g, s);
          p.x += dx;
          p.z += dz;
          const q = v.stage.toScreen(p);
          xs.push(q.x);
          ys.push(q.y);
        }
      }
    });
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  });

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

async function runLayout(w, h) {
  const name = `layout-${w}x${h}`;
  const mobile = w < 1000;
  const { page, close } = await launchChrome({ width: w, height: h, mobile, life: 3 * 60_000 });
  const errors = [];
  collectPageErrors(page, errors);
  const covers = (sel) =>
    page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return { sel, left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height, label: e.getAttribute('aria-label') || e.textContent.trim().slice(0, 24) }; }).filter((r) => r.w > 0 && r.h > 0), sel);
  try {
    for (const [path, ui, controls] of [
      ['/level/31', '.hud-top, .goal, .tool', '.hud button'],
      ['/', '.logo, .menu-buttons, .menu-foot', '.menu button, .menu a'],
    ]) {
      await page.goto(vite.url + path, { waitUntil: 'load' });
      if (path !== '/') await page.waitForFunction('window.__gameReady === true', { timeout: 30000 });
      else await page.waitForSelector('.menu');
      await settle(page, 900);
      const where = path === '/' ? 'menu' : 'game';
      const box = await boardBox(page);
      check(box.left >= 0 && box.top >= 0 && box.right <= w && box.bottom <= h, `${name} ${where}: board fully on screen ${JSON.stringify(box, (k, v) => (typeof v === 'number' ? Math.round(v) : v))}`);
      const hit = (await covers(ui)).filter((r) => overlaps(r, box));
      check(hit.length === 0, `${name} ${where}: no UI over the board ${hit.map((r) => r.label).join(', ')}`);
      const small = (await covers(controls)).filter((r) => r.w < 44 || r.h < 44);
      check(small.length === 0, `${name} ${where}: every control at least 44 px ${small.map((r) => `${r.label} ${Math.round(r.w)}x${Math.round(r.h)}`).join(', ')}`);
    }
    check(errors.length === 0, `${name}: no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  } finally {
    await close();
  }
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
    const path = await page.evaluate(() => location.pathname);
    check(path === `/level/${STORY.indexOf(levelId) + 1}`, `${name}: /play/${levelId} is rewritten to the on-screen number (${path})`);
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

    const lift = POINTER_TUNING.touch.liftPx;
    let carried = Infinity;
    for (const m of moves) {
      // taps aim at the top of the item (a thumb on its silhouette), drags and destinations at the slot
      const a = await slotXY(page, m.from.grill, m.from.slot, mode === 'tap' ? 0.4 : 0.12);
      const b = await slotXY(page, m.to.grill, m.to.slot);
      if (mode === 'touch-drag') {
        // the finger ends liftPx below the destination slot: the item, drawn above the finger, is what is aimed
        const end = { x: b.x, y: b.y + lift };
        await page.touchscreen.touchStart(a.x, a.y);
        for (let i = 1; i <= 10; i++) {
          const f = { x: a.x + ((end.x - a.x) * i) / 10, y: a.y + ((end.y - a.y) * i) / 10 };
          await page.touchscreen.touchMove(f.x, f.y);
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // move delivered
          // where the view puts the carried item (headless software rendering runs at a few fps, so the drawn item
          // trails the finger; the target is what a real device's 60 fps easing reaches within a few frames)
          const t = await dragXY(page, true);
          if (t) carried = Math.min(carried, f.y - t.y);
          // hold still once mid-drag: the drawn item must sit above the finger; keep a frame for review
          if (i === 8 && m === moves[0]) {
            await sleep(1500);
            const it = await dragXY(page);
            check(!!it && f.y - it.y > lift * 0.8, `${name}: held still, the drawn item sits ${it ? Math.round(f.y - it.y) : '?'} px above the finger`);
            await page.evaluate(({ x, y }) => {
              const d = document.createElement('div');
              d.id = 'e2e-finger';
              d.style.cssText = `position:fixed;left:${x - 18}px;top:${y - 18}px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.45);border:2px solid #fff;pointer-events:none;z-index:99`;
              document.body.append(d);
            }, f);
            await page.screenshot({ path: join(ROOT, 'shots', `e2e-${name}-carry.png`) });
            await page.evaluate(() => document.getElementById('e2e-finger')?.remove());
          }
        }
        await sleep(120);
        await page.touchscreen.touchEnd();
      } else if (mode === 'drag') {
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
    if (mode === 'touch-drag') check(carried >= lift - 2, `${name}: the carried item aims above the finger for the whole drag (min ${Math.round(carried)} px, lift ${lift})`);
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

/** A shortest legal move sequence that loses `lvl` by charring (iterative deepening; burn levels are small). */
function charLine(lvl) {
  for (let depth = 1; depth <= 8; depth++) {
    const dfs = (s, path) => {
      if (s.status === 'lost') return s.failReason === 'charred' ? path : null;
      if (s.status !== 'playing' || path.length === depth) return null;
      for (const m of getLegalMoves(s)) {
        const found = dfs(applyAction(s, m).state, [...path, m]);
        if (found) return found;
      }
      return null;
    };
    const line = dfs(createState(lvl), []);
    if (line) return line;
  }
  return null;
}

async function runCharred(name, { w, h, mobile, levelId }) {
  const moves = charLine(level(levelId));
  check(!!moves, `${name}: found a line that chars ${levelId}`);
  if (!moves) return;
  const { page, close } = await launchChrome({ width: w, height: h, mobile, life: 3 * 60_000 });
  const errors = [];
  collectPageErrors(page, errors);
  try {
    await page.goto(`${vite.url}/level/${STORY.indexOf(levelId) + 1}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__gameReady === true', { timeout: 30000 });
    await settle(page, 600);
    const badges = await page.evaluate(() => window.__gs.state.grills.flatMap((g) => g.slots).filter((it) => it?.burn).length);
    check(badges > 0, `${name}: ${badges} burning item(s) on the board`);
    for (const m of moves) {
      const a = await slotXY(page, m.from.grill, m.from.slot);
      const b = await slotXY(page, m.to.grill, m.to.slot);
      await page.touchscreen.tap(a.x, a.y);
      await sleep(120);
      await page.touchscreen.tap(b.x, b.y);
      await settle(page, 450);
    }
    await settle(page, 1500);
    const s = await page.evaluate(() => ({ status: window.__gs.state.status, reason: window.__gs.state.failReason, charred: window.__gs.state.grills.flatMap((g) => g.slots).filter((it) => it?.charred).length }));
    check(s.status === 'lost' && s.reason === 'charred' && s.charred > 0, `${name}: ${moves.length} move(s) char ${s.charred} item(s) and lose the level (${s.status}, ${s.reason})`);
    await page.waitForFunction(() => !!document.querySelector('.modal h2'), { timeout: 30000 }).catch(() => {});
    const title = await page.evaluate(() => document.querySelector('.modal h2')?.textContent);
    check(title === 'Burnt!', `${name}: fail screen says "${title}"`);
    check(errors.length === 0, `${name}: no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
    await page.screenshot({ path: join(ROOT, 'shots', `e2e-${name}.png`) });
  } finally {
    await close();
  }
}

mkdirSync(join(ROOT, 'shots'), { recursive: true });
const vite = await startVite(ROOT);
try {
  await run('desktop', { w: 1280, h: 800, mobile: false, levelId: 'street-003', mode: 'drag' });
  await run('mobile', { w: 390, h: 844, mobile: true, levelId: 'street-006', mode: 'tap' });
  await run('mobile-drag', { w: 390, h: 844, mobile: true, levelId: 'street-003', mode: 'touch-drag' });
  await run('burn-two', { w: 1280, h: 800, mobile: false, levelId: 'street-012', mode: 'drag' });
  await run('burn-tray', { w: 390, h: 844, mobile: true, levelId: 'street-013', mode: 'tap' });
  await runCharred('burn-char', { w: 390, h: 844, mobile: true, levelId: 'street-012' });
  await run('landscape', { w: 844, h: 390, mobile: true, levelId: 'street-010', mode: 'tap' });
  for (const [w, h] of [[360, 640], [390, 844], [430, 932], [844, 390], [1280, 800]]) await runLayout(w, h);
} finally {
  vite.stop();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall e2e checks passed');
process.exit(failures ? 1 : 0);
