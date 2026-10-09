// #116 design variants (prototype, removed after the owner's pick): the story inside the level screen. Five ways to put
// the scene and the customers around the board and to serve a finished trio. ?variant=1..5 on a story level;
// &serve=<0..1> freezes a plate in flight (variant-shots). Presentation only: nothing here touches the simulation.
//   1 counter    a strip above the board: customers on red stools facing the cart, order bubbles
//   2 scene      the whole alley around the board (the board is the cart's grill); customers below it
//   3 carry      Út at the bottom strip carries the plate to the customer's stool
//   4 painting   the level as a framed painting (Đám Cưới Chuột's album); a scene band on top
//   5 tickets    order tickets on a string under the HUD; a finished trio stamps and flies off a ticket
import { drawPerson, drawCat, POSES } from './rig.js';
import { drawScene, STAGE } from './scene.js';
import { setStyle, col, overlay } from './style.js';

const FOOD = {
  shrimp: ['#ff8a4c', 'curl'], beef: ['#b8323a', 'slab'], chicken: ['#d98a3a', 'leg'], corn: ['#f2c94c', 'cob'],
  carrot: ['#ff7a2a', 'cone'], salmon: ['#ff9a8a', 'slab'], bread: ['#e8b86a', 'slab'], squid: ['#efe6e0', 'cone'],
};

/** A small food glyph (bubbles, plates, tickets). */
function food(ctx, id, x, y, r) {
  const [c, kind] = FOOD[id] ?? ['#ccc', 'slab'];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = c;
  ctx.strokeStyle = 'rgba(40,20,20,.7)';
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  if (kind === 'curl') ctx.arc(0, 0, r * 0.8, Math.PI * 0.2, Math.PI * 1.75);
  else if (kind === 'cob') ctx.ellipse(0, 0, r * 0.42, r * 0.95, 0.5, 0, Math.PI * 2);
  else if (kind === 'cone') {
    ctx.moveTo(-r * 0.3, -r);
    ctx.lineTo(r * 0.3, -r);
    ctx.lineTo(0, r);
    ctx.closePath();
  } else if (kind === 'leg') {
    ctx.ellipse(-r * 0.15, -r * 0.2, r * 0.6, r * 0.75, 0.6, 0, Math.PI * 2);
  } else ctx.ellipse(0, 0, r * 0.95, r * 0.65, 0, 0, Math.PI * 2);
  if (kind === 'curl') {
    ctx.lineWidth = r * 0.45;
    ctx.strokeStyle = c;
    ctx.stroke();
  } else {
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** A plate with three of a food, a dotted trail behind it (`from`) and a soft glow so it reads in flight. */
function plate(ctx, id, x, y, r, from) {
  if (from) {
    ctx.fillStyle = 'rgba(255,240,200,.75)';
    for (let i = 1; i <= 6; i++) {
      const k = i / 7;
      ctx.beginPath();
      ctx.arc(from.x + (x - from.x) * k, from.y + (y - from.y) * k, 1.5 + k * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.save();
  ctx.shadowColor = 'rgba(255,220,150,.9)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#f4f1ec';
  ctx.strokeStyle = 'rgba(40,20,20,.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.3, r * 1.5, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  for (const dx of [-0.7, 0, 0.7]) food(ctx, id, x + dx * r, y, r * 0.55);
}

/** An order bubble over a customer. */
function bubble(ctx, id, x, y, r, done = false) {
  ctx.fillStyle = done ? '#d8f2c8' : '#fbf1dc';
  ctx.strokeStyle = 'rgba(40,20,20,.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - r * 1.2, y - r, r * 2.4, r * 1.7, r * 0.5);
  ctx.moveTo(x - r * 0.25, y + r * 0.7);
  ctx.lineTo(x, y + r * 1.15);
  ctx.lineTo(x + r * 0.25, y + r * 0.7);
  ctx.fill();
  ctx.stroke();
  food(ctx, id, x, y - r * 0.15, r * 0.6);
}

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const arc = (a, b, k, lift) => ({ x: a.x + (b.x - a.x) * ease(k), y: a.y + (b.y - a.y) * ease(k) - Math.sin(Math.PI * k) * lift });

/** Customers in a row inside a rect (screen px): who, order, x. */
function row(ctx, rect, people, { scale, stools = true, ground }) {
  const out = [];
  people.forEach((p, i) => {
    const x = rect.x + rect.w * ((i + 0.5) / people.length);
    ctx.save();
    ctx.translate(x, ground);
    ctx.scale(scale, scale);
    if (stools) {
      ctx.fillStyle = col('stool');
      ctx.fillRect(-13, -26, 26, 5);
      ctx.fillRect(-14, -21, 5, 21);
      ctx.fillRect(9, -21, 5, 21);
    }
    drawPerson(ctx, p.who, 0, 0, 1, p.face ?? -1, POSES[p.pose ?? 'sit'], 1);
    ctx.restore();
    out.push({ ...p, x, y: ground - 120 * scale });
  });
  return out;
}

const PEOPLE = [
  { who: 'regular-a', order: 'beef', pose: 'sit' },
  { who: 'regular-b', order: 'shrimp', pose: 'sit' },
  { who: 'co-sau', order: 'corn', pose: 'sit' },
];

/** Mount the prototype in the HUD element. `margins()` of the HUD must leave room for the returned strip. */
export function mountInplay(hud, v, { serve = null, boardRect }) {
  const cv = document.createElement('canvas');
  cv.className = `inplay inplay-${v}`;
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
  hud.prepend(cv);
  const draw = (t) => {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = r.width * dpr;
    cv.height = r.height * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height;
    const B = boardRect();
    const strip = hud.querySelector('.inplay-strip')?.getBoundingClientRect();
    setStyle('present');
    const k = serve ?? (t % 2.4) / 2.4;
    const from = { x: B.x + B.w * 0.5, y: B.y + B.h * 0.35 };
    if (v === 1 || v === 3 || v === 4) {
      // the scene band: a slice of the alley behind the customers
      ctx.save();
      ctx.beginPath();
      ctx.rect(strip.x, strip.y, strip.width, strip.height);
      ctx.clip();
      const s = strip.height / 150;
      ctx.translate(strip.x + strip.width / 2 - 200 * s, strip.y - 110 * s);
      ctx.scale(s, s);
      drawScene(ctx, 3, s, { lightsFrom: -5, glow: 0.5, cartX: v === 3 ? 999 : 999 });
      ctx.restore();
      if (v === 4) {
        overlay(ctx, W, H, t);
      }
      const people = v === 3 ? PEOPLE.slice(0, 2) : PEOPLE;
      const area = v === 3 ? { x: strip.x + strip.width * 0.35, w: strip.width * 0.65 } : { x: strip.x, w: strip.width };
      const seats = row(ctx, area, people, { scale: strip.height / 170, ground: strip.y + strip.height - 4 });
      seats.forEach((p, i) => bubble(ctx, p.order, p.x + 22, p.y + 18, 12, i === 0 && k > 0.95));
      if (v === 3) {
        // Út carries the plate along the strip to the first customer
        const ux = strip.x + strip.width * (0.12 + 0.3 * ease(k));
        ctx.save();
        ctx.translate(ux, strip.y + strip.height - 4);
        const sc = strip.height / 170;
        ctx.scale(sc, sc);
        drawPerson(ctx, 'ut', 0, 0, 1, 1, POSES.serve, k * 3);
        ctx.restore();
      } else {
        const to = { x: seats[0].x, y: seats[0].y + 60 * (strip.height / 170) };
        const p = arc(from, to, k, 60);
        plate(ctx, 'beef', p.x, p.y, 19, from);
      }
      if (v === 4) {
        // the painting's frame around the whole level
        ctx.strokeStyle = '#3a1a10';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, W - 10, H - 10);
        ctx.strokeStyle = '#d9a521';
        ctx.lineWidth = 2;
        ctx.strokeRect(12, 12, W - 24, H - 24);
      }
    } else if (v === 2) {
      // the alley all around the board; the board is the cart's grill (a hole in the scene)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.roundRect(B.x - 6, B.y - 6, B.w + 12, B.h + 12, 16);
      ctx.clip('evenodd');
      const s = Math.max(W / 400, H / 300) * 0.9;
      ctx.translate(W / 2 - 200 * s, H * 0.62 - 250 * s);
      ctx.scale(s, s);
      drawScene(ctx, 3, s, { lightsFrom: -5, glow: 0.5, cartX: 999 });
      ctx.restore();
      ctx.strokeStyle = '#3e3a44';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.roundRect(B.x - 6, B.y - 6, B.w + 12, B.h + 12, 16);
      ctx.stroke();
      const seats = row(ctx, { x: strip.x, w: strip.width }, PEOPLE, { scale: strip.height / 150, ground: strip.y + strip.height });
      seats.forEach((p, i) => bubble(ctx, p.order, p.x + 22, p.y + 14, 12, i === 0 && k > 0.95));
      const to = { x: seats[0].x, y: seats[0].y + 50 };
      const p = arc(from, to, k, -40);
      plate(ctx, 'beef', p.x, p.y, 19, from);
    } else if (v === 5) {
      // order tickets on a string
      const y0 = strip.y + 10;
      ctx.strokeStyle = '#3a2a20';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(strip.x, y0);
      ctx.quadraticCurveTo(strip.x + strip.width / 2, y0 + 14, strip.x + strip.width, y0);
      ctx.stroke();
      PEOPLE.forEach((p, i) => {
        const x = strip.x + strip.width * ((i + 0.5) / 3);
        const done = i === 0;
        const fly = done ? ease(k) : 0;
        ctx.save();
        ctx.translate(x + fly * 120, y0 + 8 - fly * 80);
        ctx.rotate((i - 1) * 0.06 + fly * 0.6);
        ctx.globalAlpha = 1 - fly * 0.8;
        ctx.fillStyle = '#fbf1dc';
        ctx.strokeStyle = 'rgba(40,20,20,.5)';
        ctx.fillRect(-34, 0, 68, strip.height - 22);
        ctx.strokeRect(-34, 0, 68, strip.height - 22);
        ctx.fillStyle = '#c8302a';
        ctx.fillRect(-34, 0, 68, 5);
        ctx.save();
        ctx.translate(-14, strip.height - 30);
        ctx.scale(0.32, 0.32);
        drawPerson(ctx, p.who, 0, 0, 1, 1, POSES.smile, 1);
        ctx.restore();
        for (const d of [0, 1, 2]) food(ctx, p.order, 12, 16 + d * 14, 6);
        if (done && k > 0.2) {
          ctx.strokeStyle = '#2f8a3a';
          ctx.lineWidth = 3;
          ctx.strokeRect(-26, 12, 52, 26);
          ctx.fillStyle = '#2f8a3a';
          ctx.font = 'bold 13px Baloo 2, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✓', 0, 31);
        }
        ctx.restore();
      });
    }
  };
  if (serve != null) requestAnimationFrame(() => draw(0));
  else {
    const t0 = performance.now();
    const loop = () => {
      if (!cv.isConnected) return;
      draw((performance.now() - t0) / 1000);
      requestAnimationFrame(loop);
    };
    loop();
  }
}
