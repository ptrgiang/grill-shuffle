// Story scenes (Canvas 2D) on a 400 × 300 stage, ground at y = 250. Saigon Alley, evening: a worn wall, the
// clearance notice, string lights (Street's signature transition: they flick on one by one), Bà Năm's grill cart and
// a red plastic stool. `backdrop: false` draws only the props (the in-scene / board-overlay layouts).
import { smoke } from './rig.js';

export const STAGE = { w: 400, h: 300, ground: 250 };

const BULBS = 11;

/** Light level of bulb i at time t (0 off .. 1 on): staggered, with one flicker each. */
export function bulb(i, t, start = 0.4) {
  const on = start + i * 0.09;
  if (t < on) return 0;
  const k = t - on;
  return k < 0.06 ? 1 : k < 0.12 ? 0.25 : 1;
}

export function drawScene(ctx, t, s, { backdrop = true, lightsFrom = 0.4, glow = 0.4, postcardOnCart = false } = {}) {
  const { w, ground } = STAGE;
  if (backdrop) {
    const sky = ctx.createLinearGradient(0, 0, 0, ground);
    sky.addColorStop(0, '#2a1b33');
    sky.addColorStop(1, '#4a2c3a');
    ctx.fillStyle = sky;
    ctx.fillRect(-200, -100, w + 400, ground + 100);
    // the alley wall: two houses, a door, the notice
    ctx.fillStyle = '#5b3d45';
    ctx.fillRect(-200, 70, 330, ground - 70);
    ctx.fillStyle = '#4c3440';
    ctx.fillRect(130, 50, 470, ground - 50);
    ctx.fillStyle = '#2c1c24';
    ctx.fillRect(20, 150, 46, 100);
    ctx.fillStyle = '#3a6a5a';
    ctx.fillRect(300, 120, 50, 36);
    ctx.fillStyle = '#ffd9a0';
    ctx.globalAlpha = 0.35;
    ctx.fillRect(304, 124, 42, 28);
    ctx.globalAlpha = 1;
    // clearance notice (Cô Sáu's wall)
    ctx.save();
    ctx.translate(86, 118);
    ctx.rotate(-0.04);
    ctx.fillStyle = '#f4efe2';
    ctx.fillRect(0, 0, 30, 40);
    ctx.fillStyle = '#c8302a';
    ctx.fillRect(3, 4, 24, 6);
    ctx.fillStyle = '#8a8478';
    for (let i = 0; i < 5; i++) ctx.fillRect(4, 15 + i * 5, 22 - (i % 2) * 6, 1.6);
    ctx.restore();
    // ground
    ctx.fillStyle = '#2a1f24';
    ctx.fillRect(-200, ground, w + 400, 120);
    ctx.fillStyle = '#3a2c30';
    for (let i = -6; i < 16; i++) ctx.fillRect(i * 34, ground + 8 + (i % 2) * 14, 22, 3);
  }
  // string lights across the alley
  ctx.strokeStyle = '#1a1014';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-10, 40);
  ctx.quadraticCurveTo(w / 2, 90, w + 10, 36);
  ctx.stroke();
  for (let i = 0; i < BULBS; i++) {
    const k = (i + 0.5) / BULBS;
    const bx = -10 + k * (w + 20);
    const by = (1 - k) * (1 - k) * 40 + 2 * (1 - k) * k * 90 + k * k * 36 + 6;
    const on = bulb(i, t, lightsFrom);
    if (on) {
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, 22);
      g.addColorStop(0, `rgba(255,200,110,${0.55 * on})`);
      g.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(bx - 22, by - 22, 44, 44);
    }
    ctx.fillStyle = on ? '#ffe2a0' : '#5a4a40';
    ctx.beginPath();
    ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  drawStool(ctx, 300, ground);
  drawCart(ctx, 196, ground, t, glow, postcardOnCart);
}

function drawStool(ctx, x, y) {
  ctx.fillStyle = '#d8312a';
  ctx.fillRect(x - 13, y - 26, 26, 5);
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 21);
  ctx.lineTo(x - 15, y);
  ctx.lineTo(x - 9, y);
  ctx.lineTo(x - 7, y - 21);
  ctx.moveTo(x + 12, y - 21);
  ctx.lineTo(x + 15, y);
  ctx.lineTo(x + 9, y);
  ctx.lineTo(x + 7, y - 21);
  ctx.fill();
}

/** Bà Năm's cart: a metal grill box on two wheels, honeycomb coals glowing (`glow` 0..1), a postcard on top. */
export function drawCart(ctx, x, y, t, glow = 0.4, postcard = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#6a4a32';
  ctx.fillRect(-52, -62, 6, 62);
  ctx.fillStyle = '#3e3a44';
  ctx.beginPath();
  ctx.roundRect(-46, -66, 92, 40, 4);
  ctx.fill();
  ctx.fillStyle = '#2a262e';
  ctx.fillRect(-42, -30, 84, 4);
  // coals + grate
  const g = ctx.createLinearGradient(0, -70, 0, -62);
  g.addColorStop(0, `rgba(255,120,30,${0.25 + glow * 0.6})`);
  g.addColorStop(1, `rgba(120,20,0,${0.4 + glow * 0.5})`);
  ctx.fillStyle = g;
  ctx.fillRect(-42, -70, 84, 6);
  ctx.strokeStyle = '#141014';
  ctx.lineWidth = 1;
  for (let i = -40; i <= 40; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, -71);
    ctx.lineTo(i, -64);
    ctx.stroke();
  }
  if (glow > 0.5) {
    const h = ctx.createRadialGradient(0, -70, 2, 0, -70, 60);
    h.addColorStop(0, `rgba(255,140,40,${(glow - 0.5) * 0.7})`);
    h.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = h;
    ctx.fillRect(-60, -130, 120, 90);
  }
  if (glow < 0.25) smoke(ctx, 0, -76, t, 5);
  // wheels
  ctx.fillStyle = '#18141a';
  for (const wx of [-30, 30]) {
    ctx.beginPath();
    ctx.arc(wx, -10, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#9aa3ad';
  for (const wx of [-30, 30]) {
    ctx.beginPath();
    ctx.arc(wx, -10, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (postcard) {
    ctx.fillStyle = '#fdf3dc';
    ctx.save();
    ctx.translate(26, -74);
    ctx.rotate(0.12);
    ctx.fillRect(-9, -5, 18, 11);
    ctx.fillStyle = '#d2483a';
    ctx.fillRect(4, -3, 3, 3);
    ctx.restore();
  }
  ctx.restore();
}
