// End-to-end: plays real levels through real input in headless Chrome (safe launcher), reading the result from the
// authoritative simulation state (window.__gs.state), never from meshes.
//   desktop: mouse drag-and-drop, plus an invalid drop that must change nothing
//   mobile:  touch tap-to-select (on the top of the item) + tap-destination at 390 x 844
//   mobile-drag: touch drag-and-drop at 390 x 844; the carried item must ride above the finger and land where the
//                item (not the finger) is released
//   burn-*: the burn levels (rules v3) won through tap / drag, the tray level included
//   burn-char: lets an item char on purpose and expects the level lost with the "Burnt!" screen
//   mobile-360: a full tap win on the smallest supported phone, 360 x 640 at DPR 3
//   story-390: with ?story=on, the cold open plays on first launch and a tap skips it; winning level 1 plays its beat
//              (the notebook) before the results; a tap skips it, the beats are saved as seen, "Next" opens level 2
//   landscape: tap play on a phone held sideways (844 x 390, HUD in side columns, asymmetric camera frustum)
//   layout-*: at 360x640, 390x844, 430x932, 844x390 and 1280x800 the game HUD and the menu never cover the board, the
//             board stays on screen, and every control is a tap target of at least 44 x 44 px
// Each winning case solves the level with its stored optimal solution and expects a 3-star win and the results screen.
import { launchChrome, startVite, sleep, collectPageErrors } from './lib/browser.js';
import { ROOT } from './lib/content.js';
import { decodeActions, getLegalMoves } from '../shared/moves.js';
import { createState } from '../shared/state.js';
import { applyAction } from '../shared/resolve.js';
import { boosterActions } from '../shared/boosters.js';
import { replay } from '../shared/replay.js';
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
      ['/saigon-alley/31', '.hud-top, .goal, .tool', '.hud button'],
      ['/saigon-alley/41', '.hud-top, .goal, .tool', '.hud button'], // + booster buttons
      ['/?lang=en', '.logo, .menu-buttons, .menu-foot', '.menu button, .menu a'], // ?lang: no first-launch picker
      ['/?lang=vi', '.logo, .menu-buttons, .menu-foot', '.menu button, .menu a'], // Vietnamese labels run longer
    ]) {
      await page.goto(vite.url + path, { waitUntil: 'load' });
      if (!path.startsWith('/?')) await page.waitForFunction('window.__gameReady === true', { timeout: 30000 });
      else await page.waitForSelector('.menu');
      await settle(page, 900);
      const where = path.startsWith('/?') ? `menu ${path.slice(2)}` : 'game';
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
    check(path === `/saigon-alley/${STORY.indexOf(levelId) + 1}`, `${name}: /play/${levelId} is rewritten to /saigon-alley/<on-screen number> (${path})`);
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
    const links = await page.evaluate(() => [...document.querySelectorAll('.result-links .link')].map((a) => a.textContent.trim()));
    check(links.includes('Watch the best solution') && links.includes('Share my replay'), `${name}: results offer the best solution and a replay link (${links.join(' / ')})`);
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
    await page.goto(`${vite.url}/saigon-alley/${STORY.indexOf(levelId) + 1}`, { waitUntil: 'load' });
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

/** Issue #4: a still board renders at the idle tick, input wakes it, tiers switch mid-game, the Graphics picker works. */
async function runQuality(name, { w, h }) {
  const { page, close } = await launchChrome({ width: w, height: h, mobile: true, life: 3 * 60_000 });
  const errors = [];
  collectPageErrors(page, errors);
  try {
    await page.goto(`${vite.url}/hem-sai-gon/27?quality=low&coach=0`, { waitUntil: 'load' }); // the Vietnamese slug (#92)
    await page.waitForFunction('window.__gameReady === true', { timeout: 30000 });
    const url = await page.evaluate(() => location.pathname + location.search);
    check(url === '/saigon-alley/27?quality=low&coach=0', `${name}: the other language's slug lands on the English /saigon-alley/27 with its query (${url})`);
    await settle(page, 1500);
    check(await page.evaluate(() => window.__gs.stage.tierName) === 'low', `${name}: ?quality=low applies the low tier`);
    const frames = () => page.evaluate(() => window.__gs.stage.renderer.info.render.frame);
    const still = await page.evaluate(() => ({ busy: window.__gs.view.busy, active: window.__gs.idle.active }));
    const f0 = await frames();
    await sleep(2000);
    const idleFps = ((await frames()) - f0) / 2;
    check(!still.busy && !still.active && idleFps <= 14, `${name}: a still board renders at the idle tick (${idleFps} frames/s, ${JSON.stringify(still)})`);
    const a = await slotXY(page, 0, 0, 0.3);
    await page.touchscreen.tap(a.x, a.y);
    await sleep(100);
    check(await page.evaluate(() => window.__gs.view.busy && window.__gs.idle.active), `${name}: a selection makes the board busy`);
    for (const q of ['high', 'medium', 'low']) {
      await page.evaluate((q) => window.__gs.stage.setQuality(q), q);
      await sleep(400);
    }
    check(await page.evaluate(() => window.__gs.stage.tierName) === 'low', `${name}: tiers switch mid-game`);
    await page.click('button[aria-label="Pause"]');
    await page.waitForSelector('.seg-btn');
    await page.evaluate(() => [...document.querySelectorAll('.seg-btn')].find((b) => b.textContent === 'Med').click());
    await sleep(300);
    const picked = await page.evaluate(() => ({ setting: window.__gs.app.settings.quality, pressed: document.querySelector('.seg-btn[aria-pressed="true"]')?.textContent }));
    check(picked.setting === 'medium' && picked.pressed === 'Med', `${name}: Graphics picker sets the quality (${JSON.stringify(picked)})`);
    check(errors.length === 0, `${name}: no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  } finally {
    await close();
  }
}

// #9: a booster level on a phone. Tongs: tap the button (armed), tap food on a LOCKED grill, tap an open slot; the
// food moves, no move is spent, the charge is gone. Fan: tap twice (confirm), the open grills' food is reshuffled.
async function runBoosters(name, { w, h }) {
  const { page, close } = await launchChrome({ width: w, height: h, mobile: true, life: 3 * 60_000 });
  const errors = [];
  collectPageErrors(page, errors);
  const st = () => page.evaluate(() => {
    const s = window.__gs.state;
    const btn = (id) => document.querySelector(`.tool.booster[data-booster="${id}"]`);
    return { movesUsed: s.movesUsed, boosters: s.boosters, grills: s.grills.map((g) => g.slots.map((x) => x && x.food)), armed: window.__gs.app.session.armed, tongs: btn('tongs') && { cls: btn('tongs').className, disabled: btn('tongs').disabled, charge: btn('tongs').querySelector('.charge').textContent } };
  });
  try {
    await page.goto(`${vite.url}/saigon-alley/41`, { waitUntil: 'load' });
    await page.waitForFunction('window.__gameReady === true', { timeout: 30000 });
    await settle(page, 600);
    const lvl = level('street-041');
    const lockedGrill = lvl.board.grills.findIndex((g) => g.lock);
    const fromSlot = lvl.board.grills[lockedGrill].slots.findIndex(Boolean);
    const toGrill = lvl.board.grills.findIndex((g, i) => !g.lock && i !== lockedGrill && g.slots.includes(null));
    const toSlot = lvl.board.grills[toGrill].slots.indexOf(null);
    let s = await st();
    check(s.tongs && s.tongs.charge === '1' && !s.tongs.disabled, `${name}: the level's Tongs show in the HUD with 1 charge (${JSON.stringify(s.tongs)})`);
    await page.tap('.tool.booster[data-booster="tongs"]');
    await sleep(200);
    s = await st();
    check(s.armed === 'tongs' && /armed/.test(s.tongs.cls), `${name}: tapping Tongs arms them`);
    await page.screenshot({ path: join(ROOT, 'shots', `e2e-${name}-armed.png`) });
    const food = lvl.board.grills[lockedGrill].slots[fromSlot];
    const a = await slotXY(page, lockedGrill, fromSlot, 0.4);
    const b = await slotXY(page, toGrill, toSlot);
    await page.touchscreen.tap(a.x, a.y);
    await sleep(150);
    await page.touchscreen.tap(b.x, b.y);
    await settle(page, 900);
    s = await st();
    check(s.grills[toGrill][toSlot] === food && s.grills[lockedGrill][fromSlot] === null, `${name}: Tongs lift ${food} off locked grill ${lockedGrill} onto grill ${toGrill}`);
    check(s.movesUsed === 0 && s.boosters.tongs === 0 && s.armed === null, `${name}: no move spent, charge used, disarmed (${JSON.stringify({ moves: s.movesUsed, boosters: s.boosters })})`);
    check(s.tongs.disabled && s.tongs.charge === '0', `${name}: the empty Tongs button is disabled`);
    await page.screenshot({ path: join(ROOT, 'shots', `e2e-${name}-used.png`) });

    // Tray Swap (same level): tap the button, then two grills; their contents trade places
    const swap = boosterActions(createState(lvl), 'tray_swap').find((a) => a.from.grill !== toGrill && a.to.grill !== toGrill && a.from.grill !== lockedGrill && a.to.grill !== lockedGrill);
    const before = await st();
    await page.tap('.tool.booster[data-booster="tray_swap"]');
    await sleep(200);
    for (const g of [swap.from.grill, swap.to.grill]) {
      const p = await slotXY(page, g, 1);
      await page.touchscreen.tap(p.x, p.y);
      await sleep(250);
    }
    await settle(page, 900);
    s = await st();
    const swapped = JSON.stringify(s.grills[swap.from.grill]) === JSON.stringify(before.grills[swap.to.grill]) && JSON.stringify(s.grills[swap.to.grill]) === JSON.stringify(before.grills[swap.from.grill]);
    check(swapped && s.movesUsed === 0 && s.boosters.tray_swap === 0, `${name}: Tray Swap trades grills ${swap.from.grill} and ${swap.to.grill} with two taps (${JSON.stringify(s.grills)})`);

    // Torch (Street BBQ 32): tap the button, tap a food: it and two more of it are served as one match
    await page.evaluate(() => window.__gs.go('/saigon-alley/32'));
    await page.waitForFunction(() => window.__gs.app.level?.id === 'street-035', { timeout: 15000 });
    await settle(page, 600);
    const torch = boosterActions(createState(level('street-035')), 'torch')[0];
    await page.tap('.tool.booster[data-booster="torch"]');
    await sleep(200);
    const tp = await slotXY(page, torch.from.grill, torch.from.slot, 0.4);
    await page.touchscreen.tap(tp.x, tp.y);
    await settle(page, 1200);
    const t = await page.evaluate(() => ({ matches: window.__gs.state.matches, moves: window.__gs.state.movesUsed, torch: window.__gs.state.boosters.torch }));
    check(t.matches === 1 && t.moves === 0 && t.torch === 0, `${name}: Torch serves a set with one tap, no move spent (${JSON.stringify(t)})`);
    check(errors.length === 0, `${name}: no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  } finally {
    await close();
  }
}

// #30: the replay viewer. The best solution skipped to its end, a shared run played at 2x against its claimed hash,
// a broken link refused. Nothing is recorded and the board takes no input.
async function runReplay(name, { w, h }) {
  const { page, close } = await launchChrome({ width: w, height: h, mobile: true, life: 3 * 60_000 });
  const errors = [];
  collectPageErrors(page, errors);
  const lvl = level('street-003');
  const want = replay(lvl, lvl.solver.solution).hash;
  const open = async (query) => {
    await page.evaluate(() => (window.__gameReady = false));
    await page.goto(`${vite.url}/saigon-alley/3?${query}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__gameReady === true', { timeout: 30000 });
    await settle(page, 500);
  };
  const info = () => page.evaluate(() => {
    const gs = window.__gs, p = gs.app.replay;
    return { valid: p?.valid, index: p?.index, total: p?.actions.length, status: gs.state.status, hash: p?.finalHash, modal: document.querySelector('.modal h2')?.textContent ?? null, code: document.querySelector('.replay-hash code')?.textContent ?? null, match: !!document.querySelector('.replay-hash .verified.ok'), stored: gs.app.progress['street-003'] ?? null };
  });
  try {
    await open('r=best');
    let s = await info();
    check(s.valid && s.total === lvl.solver.minMoves, `${name}: ?r=best loads the stored solution (${s.total} moves)`);
    await page.screenshot({ path: join(ROOT, 'shots', `e2e-${name}-playing.png`) });
    // the board takes no input while watching
    const a = await slotXY(page, 0, 0, 0.4);
    await page.touchscreen.tap(a.x, a.y);
    check(await page.evaluate(() => window.__gs.view.selected === null), `${name}: tapping the board selects nothing`);
    await page.tap('button.tool[aria-label="End"]');
    await page.waitForSelector('.replay-hash code', { timeout: 15000 });
    s = await info();
    check(s.status === 'won' && s.index === s.total && s.code === want, `${name}: End jumps to the solved board; the end card shows its hash ${s.code}`);
    check(s.stored === null, `${name}: watching records no result`);
    await page.screenshot({ path: join(ROOT, 'shots', `e2e-${name}-end.png`) });

    await open(`r=${lvl.solver.solution.split(' ').join(',')}&h=${want}`);
    await page.tap('button.tool[aria-label="Speed"]');
    await page.waitForSelector('.replay-hash code', { timeout: 60000 });
    s = await info();
    check(s.status === 'won' && s.match, `${name}: a shared run plays through at 2x and matches its claimed hash`);

    await open('r=m9.9-0.0');
    s = await info();
    check(s.valid === false && /Can.t show this replay/.test(s.modal ?? ''), `${name}: a broken replay link is refused (${s.modal})`);
    check(errors.length === 0, `${name}: no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  } finally {
    await close();
  }
}

// #67 / #17: the second pack (Beach Grill) is locked behind Street BBQ + its theme's stars, deep links to it land on
// the level select at that pack, and finishing the requirement opens it in its own theme.
async function runPacks(name, { w, h }) {
  const { page, close } = await launchChrome({ width: w, height: h, mobile: true, life: 3 * 60_000 });
  const errors = [];
  collectPageErrors(page, errors);
  const tabState = () =>
    page.evaluate(() => {
      const tab = document.querySelector('.pack-tab[data-pack="beach_grill"]');
      const sec = document.querySelector('section.pack');
      const r = tab.getBoundingClientRect();
      const cards = sec ? [...sec.querySelectorAll('.level-card')] : [];
      return {
        path: location.pathname, shown: sec?.dataset.pack, tabLocked: tab.classList.contains('locked'), current: tab.getAttribute('aria-current'),
        tabFits: r.left >= 0 && r.right <= innerWidth, tabH: Math.round(r.height), locked: sec?.classList.contains('locked'),
        reason: sec?.querySelector('.pack-lock')?.textContent, links: cards.filter((c) => c.tagName === 'A').length, cards: cards.length,
      };
    });
  try {
    await page.goto(`${vite.url}/levels`, { waitUntil: 'load' });
    await page.waitForSelector('.pack-tab[data-pack="beach_grill"]', { timeout: 30000 });
    let st = await tabState();
    check(st.shown === 'street_bbq' && st.tabLocked && st.tabFits && st.tabH >= 44, `${name}: /levels opens the Street BBQ tab; the Beach Grill tab shows locked, fits and is tappable (${JSON.stringify({ shown: st.shown, fits: st.tabFits, h: st.tabH })})`);

    await page.click('.pack-tab[data-pack="beach_grill"]');
    await page.waitForFunction(() => location.pathname === '/levels/fishing-village', { timeout: 10000 });
    st = await tabState();
    check(st.shown === 'beach_grill' && st.current === 'page' && st.locked && /Finish Saigon Alley/.test(st.reason) && /★ 75/.test(st.reason), `${name}: the Beach Grill tab (/levels/fishing-village) shows its requirement (${st.reason})`);
    check(st.cards === 50 && st.links === 0, `${name}: its levels are not playable (${st.links}/${st.cards} links)`);
    await sleep(300);
    await page.screenshot({ path: join(ROOT, 'shots', `e2e-${name}.png`) });

    await page.evaluate(() => window.__gs.go('/fishing-village/1'));
    await page.waitForFunction(() => location.pathname === '/levels/fishing-village', { timeout: 10000 });
    const toast = await page.evaluate(() => document.querySelector('.toast.show')?.textContent ?? '');
    check(/Fishing Village is locked/.test(toast), `${name}: a deep link into the locked pack lands on its tab with a toast (${toast})`);

    await page.evaluate(() => {
      const gs = window.__gs;
      for (const id of gs.packs.find((p) => p.id === 'street_bbq').levels) gs.app.progress[id] = { stars: 3 };
      gs.app.progress['daily:2026-10-08'] = { stars: 3 }; // a daily result: not a story star
      gs.go('/levels');
    });
    const badge = await page.evaluate(() => document.querySelector('.levels-head .badge')?.textContent);
    const story = await page.evaluate(() => window.__gs.packs.reduce((n, p) => n + p.levels.length, 0));
    check(badge === `★ 150/${story * 3}`, `${name}: the star total counts story levels only, not dailies (${badge})`);
    st = await tabState();
    check(st.shown === 'beach_grill' && !st.tabLocked && !st.locked && st.links === 1, `${name}: finishing Street BBQ with enough stars opens the pack, and /levels now opens its tab (${JSON.stringify({ shown: st.shown, links: st.links })})`);
    await page.evaluate(() => window.__gs.go('/fishing-village/1'));
    await page.waitForFunction(() => window.__gs.app.level?.id === 'beach-001', { timeout: 15000 });
    const theme = await page.evaluate(() => window.__gs.stage.theme.id);
    check(theme === 'beach_grill', `${name}: its level plays in the pack's theme (${theme})`);
    check(errors.length === 0, `${name}: no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  } finally {
    await close();
  }
}

/** Language (#89): the first launch asks once; the choice switches the UI and sticks; the pause menu can change it. */
async function runLang(name, { w, h }) {
  const { page, close } = await launchChrome({ width: w, height: h, mobile: true, life: 3 * 60_000 });
  const errors = [];
  collectPageErrors(page, errors);
  try {
    await page.goto(`${vite.url}/`, { waitUntil: 'load' });
    await page.waitForSelector('.menu');
    const picker = await page.waitForSelector('.lang-pick button[lang="vi"]', { timeout: 10000 }).catch(() => null);
    check(!!picker, `${name}: the first launch asks for the language`);
    await sleep(400);
    await page.screenshot({ path: join(ROOT, 'shots', `e2e-${name}-picker.png`) });
    await picker?.tap();
    await page.waitForFunction(() => document.documentElement.lang === 'vi' && !document.querySelector('.modal-back'), { timeout: 10000 });
    const menu = await page.evaluate(() => ({
      play: document.querySelector('.menu-buttons .btn.big')?.textContent,
      pressed: document.querySelector('.menu-foot .lang-seg [aria-pressed="true"]')?.getAttribute('lang'),
      landing: document.querySelector('[data-i18n="landing.h.how"]')?.textContent,
    }));
    check(menu.play === 'Chơi' && menu.pressed === 'vi' && menu.landing === 'Cách chơi', `${name}: picking Tiếng Việt switches the menu and the landing text (${JSON.stringify(menu)})`);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.menu');
    await sleep(800);
    const again = await page.evaluate(() => ({ lang: document.documentElement.lang, asked: !!document.querySelector('.lang-pick') }));
    check(again.lang === 'vi' && !again.asked, `${name}: the choice is saved, no second question (${JSON.stringify(again)})`);
    await page.evaluate(() => window.__gs.go('/saigon-alley/3?coach=0'));
    await page.waitForFunction('window.__gameReady === true', { timeout: 30000 });
    const viPath = await page.evaluate(() => location.pathname);
    check(viPath === '/hem-sai-gon/3', `${name}: in Vietnamese the English slug is rewritten to the Vietnamese one (${viPath})`);
    const session = await page.evaluate(() => (window.__gsSession = window.__gs.app.session, true));
    await page.tap('.hud-top .icon-btn');
    await page.waitForSelector('.modal .lang-seg button[lang="en"]');
    await page.tap('.modal .lang-seg button[lang="en"]');
    await page.waitForFunction(() => document.documentElement.lang === 'en', { timeout: 10000 });
    await sleep(300);
    const after = await page.evaluate(() => ({ path: location.pathname, title: document.querySelector('.modal h2')?.textContent, moves: document.querySelector('.moves-label')?.textContent, same: window.__gsSession === window.__gs.app.session }));
    check(session && after.path === '/saigon-alley/3' && after.title === 'Paused' && after.moves === 'Moves' && after.same, `${name}: English from the pause menu relabels the HUD and the URL, keeps the level and the pause menu (${JSON.stringify(after)})`);
    check(errors.length === 0, `${name}: no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  } finally {
    await close();
  }
}

async function runStoryBeats(name, { w, h }) {
  const levelId = STORY[0];
  const lvl = level(levelId);
  const { page, close } = await launchChrome({ width: w, height: h, mobile: true, life: 3 * 60_000 });
  const errors = [];
  collectPageErrors(page, errors);
  const seen = () => page.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('grill-shuffle');
    r.onsuccess = () => {
      const q = r.result.transaction('kv').objectStore('kv').get('storySeen');
      q.onsuccess = () => res(q.result ?? []);
    };
  }));
  const tapStory = async () => {
    await page.touchscreen.tap(w / 2, h / 3);
    await page.waitForFunction(() => !document.querySelector('.story-root'), { timeout: 10000 }).catch(() => {});
  };
  try {
    await page.goto(`${vite.url}/play/${levelId}?story=on`, { waitUntil: 'load' });
    await page.waitForFunction('window.__gameReady === true', { timeout: 30000 });
    const cold = await page.waitForFunction(() => document.querySelector('.story-root .story-beat'), { timeout: 15000 }).then(() => true, () => false);
    check(cold, `${name}: the cold open plays on first launch`);
    await sleep(1500);
    await page.screenshot({ path: join(ROOT, 'shots', `e2e-${name}-cold-open.png`) });
    await tapStory();
    check(!(await page.$('.story-root')), `${name}: a tap skips the cold open`);
    await sleep(500);
    check((await seen()).includes('street.cold-open'), `${name}: the cold open is saved as seen`);
    await settle(page, 600);
    for (const m of decodeActions(lvl.solver.solution)) {
      const a = await slotXY(page, m.from.grill, m.from.slot, 0.4);
      const b = await slotXY(page, m.to.grill, m.to.slot);
      await page.touchscreen.tap(a.x, a.y);
      await sleep(120);
      await page.touchscreen.tap(b.x, b.y);
      await settle(page, 450);
    }
    const beat = await page.waitForFunction(() => document.querySelector('.story-root .story-beat'), { timeout: 30000 }).then(() => true, () => false);
    check(beat, `${name}: winning level 1 plays its beat before the results`);
    check(!(await page.$('.modal .stars.big')), `${name}: the results wait for the beat`);
    await sleep(1200);
    await page.screenshot({ path: join(ROOT, 'shots', `e2e-${name}-beat.png`) });
    await tapStory();
    await page.waitForFunction(() => document.querySelectorAll('.stars.big .star.on').length > 0, { timeout: 30000 }).catch(() => {});
    check((await page.$$('.stars.big .star.on')).length === 3, `${name}: the results follow the beat`);
    check((await seen()).includes('street.notebook'), `${name}: the beat is saved as seen`);
    await page.evaluate(() => document.querySelector('.modal .btn.primary')?.click());
    await page.waitForFunction(() => location.pathname === '/saigon-alley/2' && window.__gameReady === true, { timeout: 30000 }).catch(() => {});
    const path = await page.evaluate(() => location.pathname);
    check(path === '/saigon-alley/2', `${name}: "Next" goes straight on to level 2 (${path})`);
    check(!(await page.$('.story-root')), `${name}: nothing replays on level 2`);
    check(errors.length === 0, `${name}: no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  } finally {
    await close();
  }
}

mkdirSync(join(ROOT, 'shots'), { recursive: true });
// `npm run test:e2e -- --only replay,boosters`: just the groups whose name starts with one of those
const onlyAt = process.argv.indexOf('--only');
const ONLY = onlyAt > 0 ? process.argv[onlyAt + 1].split(',') : null;
const want = (name) => !ONLY || ONLY.some((p) => name.startsWith(p));
const vite = await startVite(ROOT);
try {
  const groups = [
    ['desktop', () => run('desktop', { w: 1280, h: 800, mobile: false, levelId: 'street-003', mode: 'drag' })],
    ['mobile', () => run('mobile', { w: 390, h: 844, mobile: true, levelId: 'street-006', mode: 'tap' })],
    ['mobile-drag', () => run('mobile-drag', { w: 390, h: 844, mobile: true, levelId: 'street-003', mode: 'touch-drag' })],
    ['burn-two', () => run('burn-two', { w: 1280, h: 800, mobile: false, levelId: 'street-012', mode: 'drag' })],
    ['burn-tray', () => run('burn-tray', { w: 390, h: 844, mobile: true, levelId: 'street-013', mode: 'tap' })],
    ['burn-char', () => runCharred('burn-char', { w: 390, h: 844, mobile: true, levelId: 'street-012' })],
    ['mobile-360', () => run('mobile-360', { w: 360, h: 640, mobile: true, levelId: 'street-009', mode: 'tap' })],
    ['story-390', () => runStoryBeats('story-390', { w: 390, h: 844 })],
    ['landscape', () => run('landscape', { w: 844, h: 390, mobile: true, levelId: 'street-010', mode: 'tap' })],
    ...[[360, 640], [390, 844], [430, 932], [844, 390], [1280, 800]].map(([w, h]) => [`layout-${w}x${h}`, () => runLayout(w, h)]),
    ['quality', () => runQuality('quality', { w: 390, h: 844 })],
    ['packs-390', () => runPacks('packs-390', { w: 390, h: 844 })],
    ['boosters-390', () => runBoosters('boosters-390', { w: 390, h: 844 })],
    ['replay-390', () => runReplay('replay-390', { w: 390, h: 844 })],
    ['lang-390', () => runLang('lang-390', { w: 390, h: 844 })],
  ];
  for (const [name, fn] of groups) if (want(name)) await fn();
} finally {
  vite.stop();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall e2e checks passed');
process.exit(failures ? 1 : 0);
