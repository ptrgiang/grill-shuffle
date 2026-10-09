// Story scenes (Canvas 2D) on a 400 × 300 stage, ground at y = 250, painted through style.js. Saigon Alley, evening:
// two house fronts, tangled power lines, shop signs (shapes, no text), potted plants, an AC unit, a parked motorbike,
// the clearance notice, string lights (Street's signature transition: they flick on one by one), Bà Năm's grill
// cart, a honeycomb-coal stove and a red plastic stool with a dented cup of iced tea.
// `backdrop: false` draws only the props (the in-scene / storytime layouts).
import { smoke } from './rig.js';
import { shape, stroke, col, style } from './style.js';

export const STAGE = { w: 400, h: 300, ground: 250 };

const BULBS = 11;

/** Light level of bulb i at time t (0 off .. 1 on): staggered, with one flicker each. */
export function bulb(i, t, start = 0.4) {
  const on = start + i * 0.09;
  if (t < on) return 0;
  const k = t - on;
  return k < 0.06 ? 1 : k < 0.12 ? 0.25 : 1;
}

const rect = (x, y, w, h, r = 0) => {
  const p = new Path2D();
  r ? p.roundRect(x, y, w, h, r) : p.rect(x, y, w, h);
  return p;
};
const circle = (x, y, r) => {
  const p = new Path2D();
  p.arc(x, y, r, 0, Math.PI * 2);
  return p;
};

function houses(ctx) {
  const { ground } = STAGE;
  // left house: door, the notice, a shop sign; right house: window, balcony plants, AC unit
  shape(ctx, rect(-200, 70, 330, ground - 70), 'wallA', { line: false });
  shape(ctx, rect(130, 50, 470, ground - 50), 'wallB', { line: false });
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  for (let y = 84; y < ground; y += 22) ctx.fillRect(-200, y, 330, 1.5); // old paint lines
  shape(ctx, rect(20, 150, 46, 100, 2), 'door');
  shape(ctx, rect(-30, 92, 120, 22, 3), 'sign');
  ctx.fillStyle = col('signDark');
  for (const [x, w] of [[-20, 28], [14, 18], [38, 40]]) ctx.fillRect(x, 100, w, 6); // lettering as shapes
  shape(ctx, rect(300, 120, 50, 36, 2), 'window');
  ctx.fillStyle = col('windowLight');
  ctx.globalAlpha = 0.45;
  ctx.fillRect(304, 124, 42, 28);
  ctx.globalAlpha = 1;
  shape(ctx, rect(292, 156, 66, 5, 1), 'cartDark');
  for (const px of [298, 322, 346]) {
    shape(ctx, rect(px - 5, 146, 10, 10, 1), 'pot');
    shape(ctx, circle(px, 142, 7), 'plant');
  }
  shape(ctx, rect(236, 76, 34, 22, 2), 'notice'); // AC unit
  ctx.strokeStyle = col('noticeText');
  ctx.lineWidth = 0.8;
  for (let y = 80; y < 96; y += 3) {
    ctx.beginPath();
    ctx.moveTo(240, y);
    ctx.lineTo(266, y);
    ctx.stroke();
  }
  // the clearance notice on Cô Sáu's wall
  ctx.save();
  ctx.translate(86, 124);
  ctx.rotate(-0.04);
  shape(ctx, rect(0, 0, 30, 40, 1), 'notice');
  shape(ctx, rect(3, 4, 24, 6), 'noticeRed', { line: false });
  ctx.fillStyle = col('noticeText');
  for (let i = 0; i < 5; i++) ctx.fillRect(4, 15 + i * 5, 22 - (i % 2) * 6, 1.6);
  ctx.restore();
}

function wires(ctx) {
  ctx.strokeStyle = col('wire');
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-20, 18 + i * 4);
    ctx.quadraticCurveTo(160, 40 + i * 7, 420, 14 + i * 5);
    ctx.stroke();
  }
}

function motorbike(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  for (const wx of [-22, 22]) {
    shape(ctx, circle(wx, -11, 11), 'wheel');
    shape(ctx, circle(wx, -11, 3.5), 'hub', { line: false });
  }
  const body = new Path2D();
  body.moveTo(-26, -20);
  body.quadraticCurveTo(-10, -36, 8, -26);
  body.lineTo(18, -36);
  body.lineTo(24, -20);
  body.lineTo(-26, -14);
  body.closePath();
  shape(ctx, body, 'window');
  shape(ctx, rect(-20, -34, 22, 6, 3), 'cartDark');
  const bar = new Path2D();
  bar.moveTo(18, -36);
  bar.lineTo(16, -48);
  bar.lineTo(24, -50);
  stroke(ctx, bar, 'cartDark', 2.5);
  ctx.restore();
}

/**
 * The alley. Options: `props: false` (only the place: houses, wires, lights), `lightsFrom` (s, when the string lights start flicking on; null = off), `glow` (coals 0..1),
 * `postcardOnCart`, `dawn` (a pale morning sky, lights off), `cartX` (the cart rolls), `lanyardOnNail`,
 * `phone` ('buzz' | 'dark': Út's phone lying on the cart).
 */
export function drawScene(ctx, t, s, { backdrop = true, lightsFrom = 0.4, glow = 0.4, postcardOnCart = false, dawn = false, cartX = 196, lanyardOnNail = false, phone = null, props = true } = {}) {
  const { w, ground } = STAGE;
  if (backdrop) {
    const sky = ctx.createLinearGradient(0, -100, 0, ground);
    sky.addColorStop(0, col(dawn ? 'dawnSky2' : 'sky1'));
    sky.addColorStop(1, col(dawn ? 'dawnSky1' : 'sky2'));
    ctx.fillStyle = sky;
    if (style().flatSky) ctx.fillStyle = col('sky1');
    ctx.fillRect(-200, -400, w + 400, ground + 400); // tall phone screens see far above the stage
    houses(ctx);
    shape(ctx, rect(-200, ground, w + 400, 400), 'ground', { line: false });
    ctx.fillStyle = col('groundLine');
    for (let i = -6; i < 16; i++) ctx.fillRect(i * 34, ground + 8 + (i % 2) * 14, 22, 3);
    motorbike(ctx, 40, ground);
    if (lanyardOnNail) {
      // Cô Sáu's nail, beside the notice: the lanyard left hanging
      shape(ctx, circle(126, 128, 1.6), 'ink', { line: false });
      ctx.strokeStyle = col('lanyard');
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(122, 130);
      ctx.lineTo(126, 128);
      ctx.lineTo(130, 130);
      ctx.lineTo(126, 146);
      ctx.closePath();
      ctx.stroke();
      shape(ctx, new Path2D('M122 146 h8 v10 h-8 Z'), 'card');
    }
  }
  wires(ctx);
  // string lights across the alley
  ctx.strokeStyle = col('wire');
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-10, 40);
  ctx.quadraticCurveTo(w / 2, 90, w + 10, 36);
  ctx.stroke();
  for (let i = 0; i < BULBS; i++) {
    const k = (i + 0.5) / BULBS;
    const bx = -10 + k * (w + 20);
    const by = (1 - k) * (1 - k) * 40 + 2 * (1 - k) * k * 90 + k * k * 36 + 6;
    const on = lightsFrom == null || dawn ? 0 : bulb(i, t, lightsFrom);
    if (on) {
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, 24);
      g.addColorStop(0, `rgba(${col('glow')},${0.55 * on})`);
      g.addColorStop(1, `rgba(${col('glow')},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(bx - 24, by - 24, 48, 48);
    }
    shape(ctx, circle(bx, by, 3.4), on ? 'bulbOn' : 'bulbOff', { line: false });
  }
  if (!props) return; // the counter (client/story/counter.js) places its own stools and cart
  if (backdrop) drawSugarcaneCart(ctx, 362, ground);
  drawStool(ctx, 300, ground);
  drawStove(ctx, 262, ground, t, glow);
  drawCart(ctx, cartX, ground, t, glow, postcardOnCart);
  if (phone) {
    // Út's phone on the cart: face up and buzzing, or face down and dark
    ctx.save();
    ctx.translate(cartX - 30, ground - 70);
    shape(ctx, new Path2D('M-6 -2 h12 v4 h-12 Z'), 'phone');
    if (phone === 'buzz' && Math.sin(t * 40) > 0) shape(ctx, circle(6, -3, 2.2), 'badge', { line: false });
    ctx.restore();
  }
}

/** Cô Sáu's sugarcane-juice cart next door: a glass case, cane stalks standing in it, the press wheel. */
function drawSugarcaneCart(ctx, x, y) {
  shape(ctx, rect(x - 26, y - 58, 52, 40, 3), 'window');
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(x - 22, y - 54, 44, 32);
  for (const sx of [-16, -10, -4]) {
    const cane = new Path2D();
    cane.moveTo(x + sx, y - 22);
    cane.lineTo(x + sx + 2, y - 76);
    stroke(ctx, cane, 'plant', 3.2);
    ctx.fillStyle = col('signDark');
    for (let k = 0; k < 4; k++) ctx.fillRect(x + sx - 1, y - 32 - k * 12, 3.6, 1.2); // cane nodes
  }
  shape(ctx, circle(x + 12, y - 38, 9), 'cartDark');
  shape(ctx, circle(x + 12, y - 38, 3), 'hub', { line: false });
  shape(ctx, rect(x - 28, y - 20, 56, 6, 2), 'sign');
  for (const wx of [-18, 18]) {
    shape(ctx, circle(x + wx, y - 8, 8), 'wheel');
    shape(ctx, circle(x + wx, y - 8, 2.5), 'hub', { line: false });
  }
}

export function drawStool(ctx, x, y) {
  const p = new Path2D();
  p.rect(x - 13, y - 26, 26, 5);
  p.moveTo(x - 12, y - 21);
  p.lineTo(x - 15, y);
  p.lineTo(x - 9, y);
  p.lineTo(x - 7, y - 21);
  p.closePath();
  p.moveTo(x + 12, y - 21);
  p.lineTo(x + 15, y);
  p.lineTo(x + 9, y);
  p.lineTo(x + 7, y - 21);
  p.closePath();
  shape(ctx, p, 'stool');
  // a dented cup of iced tea
  const cup = new Path2D();
  cup.moveTo(x - 9, y - 38);
  cup.lineTo(x - 1, y - 38);
  cup.lineTo(x - 2, y - 26);
  cup.lineTo(x - 8, y - 26);
  cup.closePath();
  shape(ctx, cup, 'window');
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(x - 8, y - 36, 2, 8);
}

/** The honeycomb-coal stove (bếp than tổ ong) beside the cart. */
function drawStove(ctx, x, y, t, glow) {
  shape(ctx, rect(x - 9, y - 22, 18, 22, 2), 'pot');
  shape(ctx, rect(x - 8, y - 26, 16, 5, 1), 'cartDark');
  ctx.fillStyle = `rgba(${col('coalHot')},${0.5 + glow * 0.5})`;
  for (const [cx, cy] of [[-4, -24], [0, -24], [4, -24]]) {
    ctx.beginPath();
    ctx.arc(x + cx, y + cy, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Bà Năm's cart, as on the badge (client/ui/brand.js): a stainless body with two panels and rivets, a small glass
 * cabinet with bánh mì, the firebox with coals glowing (`glow` 0..1), spoked wheels, the push handle; years of use on
 * it (owner, 2026-10-09): rust patches and streaks, a dent, worn paint. A postcard can lie on top.
 */
export function drawCart(ctx, x, y, t, glow = 0.4, postcard = false) {
  ctx.save();
  ctx.translate(x, y);
  // push handle (Út's side)
  const handle = new Path2D();
  handle.moveTo(-44, -40);
  handle.lineTo(-58, -52);
  handle.lineTo(-64, -52);
  stroke(ctx, handle, 'steelDark', 3.4);
  // the stainless body
  const body = new Path2D();
  body.rect(-46, -64, 92, 38);
  shape(ctx, body, 'steel2');
  ctx.save();
  ctx.clip(body);
  const sheen = ctx.createLinearGradient(0, -64, 0, -26);
  sheen.addColorStop(0, 'rgba(255,255,255,.55)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,.1)');
  sheen.addColorStop(1, 'rgba(0,0,0,.18)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-46, -64, 92, 38);
  // rust: blotches where the paint wore through, streaks running down from the rivets, a dented corner
  ctx.fillStyle = col('rust');
  for (const [rx, ry, w, h, a] of [[-38, -34, 11, 6, 0.55], [-30, -30, 6, 4, 0.4], [24, -36, 13, 7, 0.5], [33, -31, 7, 5, 0.45], [-8, -60, 8, 4, 0.35], [10, -29, 9, 3.5, 0.4]]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(rx, ry, w / 2, h / 2, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = col('rustDark');
  for (const [sx, sy, sh] of [[-42, -58, 14], [42, -58, 18], [-4, -48, 10], [20, -47, 12]]) ctx.fillRect(sx, sy, 1.4, sh);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(40,30,30,.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, -64);
  ctx.quadraticCurveTo(36, -58, 46, -60);
  ctx.stroke();
  ctx.restore();
  // panels and rivets
  ctx.strokeStyle = col('steelDark');
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.7;
  ctx.strokeRect(-41, -60, 39, 29);
  ctx.strokeRect(2, -60, 39, 29);
  ctx.globalAlpha = 1;
  ctx.fillStyle = col('steel1');
  for (const [rx, ry] of [[-43, -61], [43, -61], [-43, -29], [43, -29]]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  shape(ctx, new Path2D('M-48 -66 h96 v3 h-96 Z'), 'steel1', { line: false });
  shape(ctx, new Path2D('M-48 -27 h96 v3 h-96 Z'), 'steelDark', { line: false });
  // the glass cabinet on the left of the top: bánh mì behind the glass
  shape(ctx, new Path2D('M-44 -94 h38 v28 h-38 Z'), 'glass');
  ctx.fillStyle = '#d9a35e';
  ctx.beginPath();
  ctx.roundRect(-40, -77, 14, 6, 3);
  ctx.roundRect(-24, -77, 14, 6, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.beginPath();
  ctx.moveTo(-40, -92);
  ctx.lineTo(-33, -69);
  ctx.stroke();
  // the firebox: coals glowing under the grate (right of the top)
  const fx = -4;
  const g = ctx.createLinearGradient(0, -72, 0, -64);
  g.addColorStop(0, `rgba(${col('coalHot')},${0.3 + glow * 0.6})`);
  g.addColorStop(1, `rgba(120,20,0,${0.4 + glow * 0.5})`);
  ctx.fillStyle = g;
  ctx.fillRect(fx, -72, 48, 7);
  ctx.strokeStyle = col('cartDark');
  ctx.lineWidth = 1;
  for (let i = fx + 2; i <= fx + 46; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, -73);
    ctx.lineTo(i, -65);
    ctx.stroke();
  }
  if (glow > 0.5) {
    const h = ctx.createRadialGradient(20, -70, 2, 20, -70, 50);
    h.addColorStop(0, `rgba(${col('coalHot')},${(glow - 0.5) * 0.7})`);
    h.addColorStop(1, `rgba(${col('coalHot')},0)`);
    ctx.fillStyle = h;
    ctx.fillRect(-30, -130, 100, 90);
  }
  if (glow < 0.25) smoke(ctx, 20, -76, t, 5);
  // spoked wheels, a little rust on the hubs
  for (const wx of [-28, 28]) {
    shape(ctx, circle(wx, -10, 10), 'wheel');
    ctx.strokeStyle = col('steel2');
    ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + wx;
      ctx.beginPath();
      ctx.moveTo(wx, -10);
      ctx.lineTo(wx + Math.cos(a) * 7.5, -10 + Math.sin(a) * 7.5);
      ctx.stroke();
    }
    shape(ctx, circle(wx, -10, 2.6), 'rust', { line: false });
  }
  if (postcard) {
    ctx.save();
    ctx.translate(26, -78);
    ctx.rotate(0.12);
    shape(ctx, rect(-9, -5, 18, 11, 1), 'postcard');
    shape(ctx, rect(4, -3, 3, 3), 'stamp', { line: false });
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Flashback (Bà Năm's past, #106): the central-coast fishing village at dawn. Sun on the sea, a wooden boat with
 * painted eyes on its bow (mắt thuyền), a round basket boat (thuyền thúng) and nets drying on poles.
 */
export function drawBeach(ctx, t, { storm = false, boatX = 0 } = {}) {
  const { w, ground } = STAGE;
  const sky = ctx.createLinearGradient(0, -100, 0, 170);
  sky.addColorStop(0, col(storm ? 'stormSky1' : 'dawn1'));
  sky.addColorStop(1, col(storm ? 'stormSky2' : 'dawn2'));
  ctx.fillStyle = sky;
  if (style().flatSky) ctx.fillStyle = col('dawn2');
  ctx.fillRect(-200, -400, w + 400, 580);
  if (!storm) shape(ctx, circle(176, 128, 24), 'sun', { line: false });
  shape(ctx, rect(-200, 165, w + 400, 50), storm ? 'stormSea' : 'sea', { line: false });
  ctx.strokeStyle = col('seaLight');
  ctx.lineWidth = storm ? 2.4 : 1.6;
  for (let i = 0; i < 9; i++) {
    const y = 172 + (i % 3) * 12, x = -40 + i * 52 + Math.sin(t * (storm ? 3 : 1) + i) * (storm ? 14 : 6);
    const hgt = storm ? 9 : 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 9, y - hgt, x + 18, y);
    ctx.stroke();
  }
  shape(ctx, rect(-200, 212, w + 400, 400), 'sand', { line: false });
  // nets on poles
  for (const nx of [96]) {
    const p = new Path2D();
    p.moveTo(nx, ground);
    p.lineTo(nx, 150);
    p.moveTo(nx + 46, ground);
    p.lineTo(nx + 46, 150);
    stroke(ctx, p, 'pole', 2.4);
    ctx.strokeStyle = col('ink');
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.6;
    for (let i = 0; i <= 46; i += 6) {
      ctx.beginPath();
      ctx.moveTo(nx + i, 154);
      ctx.lineTo(nx + i, 205);
      ctx.stroke();
    }
    for (let j = 154; j <= 205; j += 6) {
      ctx.beginPath();
      ctx.moveTo(nx, j);
      ctx.lineTo(nx + 46, j);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // her father's boat, drawn up on the sand: painted eyes on the bow (`boatX`: hauled further up before the storm)
  ctx.save();
  ctx.translate(boatX, 0);
  const boat = new Path2D();
  boat.moveTo(70, 228);
  boat.lineTo(222, 228);
  boat.quadraticCurveTo(244, 226, 250, 206);
  boat.lineTo(50, 210);
  boat.quadraticCurveTo(56, 226, 70, 228);
  boat.closePath();
  shape(ctx, boat, 'boat');
  shape(ctx, rect(52, 206, 198, 6, 2), 'boatTrim');
  const eye = new Path2D();
  eye.ellipse(230, 216, 7, 4, 0, 0, Math.PI * 2);
  shape(ctx, eye, 'boatEye');
  shape(ctx, circle(232, 216, 2.4), 'ink', { line: false });
  ctx.restore();
  // a round basket boat
  const thung = new Path2D();
  thung.ellipse(332, 244, 24, 11, 0, 0, Math.PI);
  thung.closePath();
  shape(ctx, thung, 'basket');
  ctx.strokeStyle = col('basketLine');
  ctx.lineWidth = 0.7;
  for (let i = -20; i <= 20; i += 5) {
    ctx.beginPath();
    ctx.moveTo(332 + i, 244);
    ctx.lineTo(332 + i * 0.8, 253);
    ctx.stroke();
  }
  if (storm) {
    ctx.strokeStyle = col('rain');
    ctx.lineWidth = 1;
    for (let k = 0; k < 90; k++) {
      const rx = ((k * 53 + t * 260) % 640) - 120, ry = ((k * 97 + t * 520) % 420) - 100;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4, ry + 12);
      ctx.stroke();
    }
  }
}
