// The counter above the board (#116, owner pick: the strip above the board + the painting's frame and paper + Út
// carrying the plate): the stop's place in a framed band, customers on red stools with an order bubble each, Út at
// Bà Năm's cart, Mực on it. A match plates the trio: it flies up from the grill to Út, who carries it to the
// customer; combos make them cheer, a win makes them wave, a loss lets Mực steal a shrimp. Presentation only.
//
//   const counter = mountCounter(hud, { level, theme, reduced, sound })
//   counter.onFx(ev, at)   the board's presentation events (match / combo / level_complete / level_failed)
// The HUD reserves the strip (`.counter-strip`, measured by HUD.margins() so the board makes room for it).
import { drawPerson, drawCat, POSES } from './rig.js';
import { drawScene, drawBeach, drawCart, drawStool } from './scene.js';
import { setStyle, overlay } from './style.js';
import { foodGlyph } from './food-glyph.js';
import { createCounter, serve, tick, cheer, win, lose, busy, T } from './counter-model.js';
import { cellFood } from '../../shared/levels.js';

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const CARRY = { ...POSES.walk, armF: [1.45, 0.1], prop: 'plate' };
// strangers only (owner, 2026-10-09): a customer must never look like a story character, and belongs to the place:
// the city's alley (a student, a xe ôm driver, an office worker, a worker, an old man) or the fishing village
const GUESTS = {
  street_bbq: ['guest-1', 'guest-2', 'guest-3', 'guest-4', 'guest-5'],
  beach_grill: ['beach-1', 'beach-2', 'beach-3', 'beach-4', 'beach-5'],
};

/** Items per food still on a simulation state's board (slots hold items, stacked layers hold cells). */
export function stateFoods(state) {
  const n = {};
  for (const g of state.grills) for (const cell of [...g.slots.map((it) => it?.food ?? null), ...(g.layers ?? []).flat().map(cellFood)]) if (cell) n[cell] = (n[cell] ?? 0) + 1;
  return n;
}

/** Items per food on a level's board (slots and stacked layers). */
export function boardFoods(level) {
  const n = {};
  for (const g of level.board.grills) for (const cell of [...g.slots, ...(g.layers ?? []).flat()]) {
    const f = cellFood(cell);
    if (f) n[f] = (n[f] ?? 0) + 1;
  }
  return n;
}

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function mountCounter(hud, { level, state = null, theme = 'street_bbq', reduced = false, sound = () => {} } = {}) {
  const strip = hud.querySelector('.counter-strip');
  const cv = document.createElement('canvas');
  cv.className = 'counter-canvas';
  hud.prepend(cv);
  const wide = () => strip.getBoundingClientRect().width > 620;
  const make = (foods) => createCounter({ foods, seats: wide() ? 4 : 3, seed: hash(level.id), cast: GUESTS[theme] ?? GUESTS.street_bbq, carry: !reduced });
  let c = make(state ? stateFoods(state) : boardFoods(level)); // mounted late: the board as it is now
  const beach = theme === 'beach_grill';
  let last = performance.now(), running = false, t = 0;
  const from = new Map(); // plate -> screen point it started from (the matched grill)

  // strip layout (screen px): Út's home by the cart on the left, the stools spread to the right
  const geo = () => {
    const r = strip.getBoundingClientRect();
    const sc = (r.height - 12) / 118;
    const n = c.seats.length;
    const seatX = (i) => r.x + r.width * (0.36 + (0.6 * (i + 0.5)) / n);
    return { r, sc, ground: r.y + r.height - 6, home: r.x + r.width * 0.08, cart: r.x + r.width * 0.19, seatX };
  };

  function person(ctx, g, who, x, face, pose) {
    ctx.save();
    ctx.translate(x, g.ground);
    ctx.scale(g.sc, g.sc);
    drawPerson(ctx, who, 0, 0, 1, face, pose, t);
    ctx.restore();
  }

  function bubble(ctx, x, y, food, sc, done) {
    const r = 15 * Math.max(0.8, sc);
    ctx.fillStyle = done ? '#e3f4d4' : '#fbf1dc';
    ctx.strokeStyle = 'rgba(40,20,20,.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(x - r * 1.05, y - r, r * 2.1, r * 1.75, r * 0.5);
    ctx.moveTo(x - r * 0.3, y + r * 0.74);
    ctx.lineTo(x - r * 0.55, y + r * 1.15);
    ctx.lineTo(x + r * 0.1, y + r * 0.74);
    ctx.fill();
    ctx.stroke();
    if (done) {
      ctx.fillStyle = '#d0445a';
      ctx.font = `${Math.round(r)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('♥', x, y + r * 0.35);
    } else foodGlyph(ctx, food, x, y - r * 0.12, r * 0.6);
  }

  function plate(ctx, x, y, food, r, glow = false) {
    ctx.save();
    if (glow) {
      ctx.shadowColor = 'rgba(255,220,150,.9)';
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = '#f4f1ec';
    ctx.strokeStyle = 'rgba(40,20,20,.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.3, r * 1.5, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    for (const dx of [-0.7, 0, 0.7]) foodGlyph(ctx, food, x + dx * r, y, r * 0.55);
  }

  function draw() {
    const H = hud.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(H.width * dpr) || cv.height !== Math.round(H.height * dpr)) {
      cv.width = Math.round(H.width * dpr);
      cv.height = Math.round(H.height * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, H.width, H.height);
    const g = geo();
    if (g.r.width < 10 || g.r.height < 10) return; // hidden (phones held sideways)
    setStyle('present');
    // the framed band: the place, cropped to cover the strip with its ground at the bottom
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(g.r.x, g.r.y, g.r.width, g.r.height, 12);
    ctx.clip();
    const s = Math.max(g.r.width / 400, (g.r.height + 20) / 150);
    ctx.save();
    ctx.translate(g.r.x + g.r.width / 2 - 200 * s, g.ground - 250 * s);
    ctx.scale(s, s);
    if (beach) drawBeach(ctx, t, {});
    else drawScene(ctx, t, s, { lightsFrom: -5, glow: 0.5, props: false });
    ctx.restore();
    // Bà Năm's cart, Mực on it; Út behind it at home
    const u = c.ut;
    const walkTo = (k) => g.home + (g.seatX(u.seat) - 40 * g.sc - g.home) * ease(clamp(k)); // stops just short of the stool
    let ux = g.home, upose = POSES.stand, uface = 1;
    if (u.phase === 'fetch') upose = { ...POSES.reach, prop: null };
    else if (u.phase === 'walk') (ux = walkTo(u.t / T.walk)), (upose = CARRY);
    else if (u.phase === 'hand') (ux = walkTo(1)), (upose = POSES.serve);
    else if (u.phase === 'back') (ux = walkTo(1 - u.t / T.back)), (upose = POSES.walk), (uface = -1);
    if (c.mood.phase === 'won' && u.phase === 'home') upose = POSES.smile;
    person(ctx, g, 'ut', ux, uface, upose);
    ctx.save();
    ctx.translate(g.cart, g.ground);
    ctx.scale(g.sc * 0.8, g.sc * 0.8);
    drawCart(ctx, 0, 0, t, 0.6);
    ctx.restore();
    const cat = c.cat;
    if (cat.phase === 'steal') {
      const k = cat.t / T.steal;
      ctx.save();
      ctx.translate(g.cart + 50 * g.sc + k * g.r.width * 0.9, g.ground - Math.sin(Math.PI * Math.min(1, k * 4)) * 12 * g.sc);
      ctx.scale(g.sc * 0.8, g.sc * 0.8);
      drawCat(ctx, 0, 0, 1, 1, k < 0.25 ? 'jump' : 'walk', k * 4);
      foodGlyph(ctx, 'shrimp', 14, -24, 7);
      ctx.restore();
    } else {
      ctx.save();
      // Mực sits on the ground beside the cart (owner, 2026-10-09: not on the grill)
      ctx.translate(g.cart + 50 * g.sc, g.ground);
      ctx.scale(g.sc * 0.8, g.sc * 0.8);
      drawCat(ctx, 0, 0, 1, -1, 'sit', t);
      ctx.restore();
    }
    // the stools and the customers
    c.seats.forEach((st) => {
      const x = g.seatX(st.i);
      ctx.save();
      ctx.translate(x, g.ground);
      ctx.scale(g.sc, g.sc);
      drawStool(ctx, 0, 0);
      ctx.restore();
      if (st.phase === 'empty' || !st.who) return;
      const edge = g.r.x + g.r.width + 30;
      if (st.phase === 'arriving') return person(ctx, g, st.who, edge + (x - edge) * ease(clamp(st.t / T.arrive)), -1, POSES.walk);
      if (st.phase === 'leaving') return person(ctx, g, st.who, x + (edge - x) * ease(clamp(st.t / T.leave)), 1, POSES.walk);
      const cheering = c.mood.phase === 'cheer' || c.mood.phase === 'won';
      const pose = st.phase === 'eating' ? POSES.eat : cheering ? { ...POSES.sit, armF: [2.6, 0.5], waving: 1, mouth: 1 } : POSES.sit;
      person(ctx, g, st.who, x, -1, pose);
      if (st.phase === 'eating') plate(ctx, x - 10 * g.sc, g.ground - 50 * g.sc, st.eating, 7 * g.sc + 3);
      if (st.phase === 'waiting' || (st.phase === 'eating' && st.t < 1)) bubble(ctx, x + 6 * g.sc, g.r.y + 22, st.order, g.sc, st.phase === 'eating');
    });
    // the painting: paper grain on the band, a thin gold frame
    overlay(ctx, H.width, H.height, t);
    ctx.restore();
    ctx.strokeStyle = 'rgba(30,14,10,.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(g.r.x, g.r.y, g.r.width, g.r.height, 12);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(217,165,33,.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(g.r.x + 3, g.r.y + 3, g.r.width - 6, g.r.height - 6, 9);
    ctx.stroke();
    // plates in flight: from the matched grill up to Út (or straight to the customer), a dotted trail behind
    for (const p of c.plates) {
      const a = from.get(p) ?? { x: g.r.x + g.r.width / 2, y: g.r.y + g.r.height + 80 };
      const b = p.to === 'ut' ? { x: g.home + 18 * g.sc, y: g.ground - 70 * g.sc } : { x: g.seatX(p.to) - 10 * g.sc, y: g.ground - 50 * g.sc };
      const k = ease(clamp(p.t / p.dur));
      const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k - Math.sin(Math.PI * k) * 40;
      if (reduced) {
        ctx.globalAlpha = 1 - k;
        plate(ctx, a.x, a.y, p.food, 10);
        ctx.globalAlpha = k;
        plate(ctx, b.x, b.y, p.food, 10);
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.fillStyle = 'rgba(255,240,200,.7)';
      for (let i = 1; i <= 5; i++) {
        const q = k * (i / 6);
        ctx.beginPath();
        ctx.arc(a.x + (b.x - a.x) * q, a.y + (b.y - a.y) * q - Math.sin(Math.PI * q) * 40, 1.5 + i * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      plate(ctx, x, y, p.food, 13, true);
    }
  }

  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000); // slow devices: catch up, but never jump a whole walk
    last = now;
    t += dt;
    for (const q of tick(c, dt)) sound(q.name, { pan: 0 });
    draw();
    if (cv.isConnected && busy(c)) requestAnimationFrame(frame);
    else running = false;
  }
  const wake = () => {
    if (running || !cv.isConnected) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };
  const onResize = () => (cv.isConnected ? requestAnimationFrame(draw) : removeEventListener('resize', onResize));
  addEventListener('resize', onResize);
  requestAnimationFrame(draw);
  if (document.fonts) document.fonts.ready.then(() => requestAnimationFrame(draw));

  return {
    onFx(ev, at) {
      if (ev.type === 'match') {
        const before = c.plates.length;
        if (serve(c, ev.food) && c.plates.length > before) from.set(c.plates[c.plates.length - 1], at ?? null);
      } else if (ev.type === 'combo' && ev.combo >= 2) cheer(c);
      else if (ev.type === 'level_complete') win(c);
      else if (ev.type === 'level_failed') for (const q of lose(c)) sound(q.name);
      else return;
      wake();
    },
    /** Restart / undo: seat the counter again for what is on the board now (no plates in flight, no old cheer). */
    reset(state) {
      c = make(stateFoods(state));
      from.clear();
      requestAnimationFrame(draw);
    },
    /** Draw once (screenshots, a resize). */
    redraw: () => draw(),
    get model() {
      return c;
    },
  };
}
