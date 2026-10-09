// #82 design variants (prototype behind ?variant=1..5): the cold open's key frame. Every variant keeps the beat's
// length and puts its key moment at ~9.6 s, so the sheets compare the same three times (4.6 / 9.6 / 13.6).
//   1  today: Út reads the postcard on the cart, Mực trots in
//   2  the tarp: the cart stands under a blue tarp; Út pulls it off, the string lights come on, the postcard was under it
//   3  the phone: a close-up of Út's phone, Bà Năm's missed calls, before the postcard
//   4  the notice: Út turns from the postcard to the clearance notice on Cô Sáu's wall; Cô Sáu in her doorway
//   5  the postcard: a close-up of the card, drawn in Bà Năm's past (Đông Hồ print): the cart by the sea
// Removed once the owner picks; the pick moves into beats.js.
import { STAGE, drawBeach, drawCart } from './scene.js';
import { setStyle, shape, col } from './style.js';
import { variantFrom } from '../ui/variant.js';

export const coldOpenVariant = () => variantFrom(globalThis.location?.search);

const G = STAGE.ground;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const rr = (x, y, w, h, r) => {
  const p = new Path2D();
  p.roundRect(x, y, w, h, r);
  return p;
};
/** 0 → 1 → 0 over [a, b] with quick fades: how present a close-up is at t. */
const window01 = (t, a, b, f = 0.35) => clamp(Math.min((t - a) / f, (b - t) / f));

/** A close-up card over the upper middle of the screen, scaled in from 0.9. */
function inset(ctx, w, h, k, draw, { ratio = 0.72, tilt = -0.03 } = {}) {
  if (k <= 0) return;
  const cw = Math.min(w * 0.78, h * 0.5), ch = cw * ratio;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.translate(w / 2, h * 0.36);
  ctx.rotate(tilt);
  ctx.scale(0.9 + 0.1 * ease(k), 0.9 + 0.1 * ease(k));
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  draw(ctx, cw, ch);
  ctx.restore();
}

// ---------------------------------------------------------------- 3: the phone, Bà Năm's missed calls

function phoneCard(ctx, cw, ch) {
  const pw = ch * 0.62, ph = ch * 1.15;
  setStyle('present');
  shape(ctx, rr(-pw / 2, -ph / 2, pw, ph, pw * 0.14), 'phone');
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#f4efe6';
  ctx.beginPath();
  ctx.roundRect(-pw / 2 + 6, -ph / 2 + 14, pw - 12, ph - 28, pw * 0.08);
  ctx.fill();
  // the caller: Bà Năm's avatar (grey bun, round glasses), her name, the red missed-call mark ×5
  const ay = -ph * 0.2;
  ctx.fillStyle = '#e9c08a';
  ctx.beginPath();
  ctx.arc(0, ay, pw * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b9b2a8';
  ctx.beginPath();
  ctx.arc(0, ay - pw * 0.13, pw * 0.15, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, ay - pw * 0.26, pw * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a2a22';
  ctx.lineWidth = 1.6;
  for (const ex of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(ex * pw * 0.07, ay + pw * 0.02, pw * 0.05, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#2a1a22';
  ctx.font = `700 ${Math.round(pw * 0.15)}px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Bà Năm', 0, ay + pw * 0.42); // a name: the same in vi and en
  ctx.fillStyle = '#e0362c';
  ctx.font = `700 ${Math.round(pw * 0.2)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillText('↙ ×5', 0, ay + pw * 0.72);
  // a sixth call ringing: the green / red buttons, the red one under Út's thumb
  for (const [bx, c] of [[-0.22, '#3bb36a'], [0.22, '#e0362c']]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(bx * pw, ph * 0.33, pw * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- 4: the clearance notice

function noticeCard(ctx, cw, ch) {
  setStyle('present');
  shape(ctx, rr(-cw * 0.36, -ch / 2, cw * 0.72, ch, 4), 'notice');
  ctx.shadowColor = 'transparent';
  shape(ctx, rr(-cw * 0.32, -ch / 2 + 10, cw * 0.64, ch * 0.13, 2), 'noticeRed', { line: false });
  // the tower that will stand here: a glass block with a crane over it
  const tx = -cw * 0.24, ty = -ch * 0.18;
  ctx.fillStyle = '#8fa6b8';
  ctx.fillRect(tx, ty, cw * 0.14, ch * 0.42);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) ctx.fillRect(tx + 4 + c * cw * 0.042, ty + 6 + r * ch * 0.064, cw * 0.025, ch * 0.03);
  ctx.strokeStyle = '#d9a521';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(tx + cw * 0.19, ty + ch * 0.42);
  ctx.lineTo(tx + cw * 0.19, ty - ch * 0.08);
  ctx.lineTo(tx - cw * 0.02, ty - ch * 0.08);
  ctx.stroke();
  // lines of small print
  ctx.fillStyle = col('noticeText');
  for (let i = 0; i < 6; i++) ctx.fillRect(-cw * 0.02, -ch * 0.16 + i * ch * 0.07, cw * (0.3 - (i % 2) * 0.07), 2);
  // the date, circled red: numbers, the same in vi and en
  ctx.fillStyle = '#2a1a22';
  ctx.font = `800 ${Math.round(ch * 0.1)}px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('30.11', cw * 0.06, ch * 0.34);
  ctx.strokeStyle = '#d0302a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cw * 0.06, ch * 0.305, cw * 0.15, ch * 0.08, -0.08, 0, Math.PI * 2);
  ctx.stroke();
}

// ---------------------------------------------------------------- 5: the postcard, in Bà Năm's past

function postcardCard(ctx, cw, ch) {
  setStyle('past');
  shape(ctx, rr(-cw / 2, -ch / 2, cw, ch, 3), 'postcard');
  ctx.shadowColor = 'transparent';
  // the picture side: the cart on the sand by the sea, a print on điệp paper
  ctx.save();
  ctx.beginPath();
  ctx.rect(-cw / 2 + 8, -ch / 2 + 8, cw * 0.62, ch - 16);
  ctx.clip();
  const s = (ch - 16) / 300;
  ctx.translate(-cw / 2 + 8 + cw * 0.31 - 200 * s, -ch / 2 + 8);
  ctx.scale(s, s);
  drawBeach(ctx, 0, {});
  drawCart(ctx, 200, G, 0, 0.3);
  ctx.restore();
  // the writing side: lines of her hand, the stamp
  const x0 = cw * 0.17;
  shape(ctx, rr(cw * 0.36, -ch / 2 + 10, cw * 0.1, ch * 0.16, 1), 'stamp', { line: false });
  ctx.strokeStyle = col('noticeText');
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const y = -ch * 0.12 + i * ch * 0.1;
    ctx.moveTo(x0, y);
    for (let x = x0; x < cw * 0.46; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.7 + i) * 1.4);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- the stagings

/** The cold open's staging for variant v (2..5), built on today's (v1). */
export function coldOpenFor(v, base, { onCart }) {
  if (v === 2) {
    const UT = [
      { t: 2.4, x: -40, face: 1, pose: 'phone' },
      { t: 7.4, x: 112, face: 1, pose: 'phone', move: true },
      { t: 8.4, x: 112, face: 1, pose: 'reach' },
      { t: 10.4, x: 112, face: 1, pose: 'stand' },
      { t: 11, x: 150, face: 1, pose: 'reach', move: true },
      { t: 11.6, x: 150, face: 1, pose: 'read' },
      { t: 13.2, x: 150, face: -1, pose: 'shock' },
      { t: 14.2, x: 150, face: -1, pose: 'slump' },
    ];
    return {
      ...base,
      panels: [5, 9.6, 13.6],
      cam: [{ t: 0, x: 200, y: 160, z: 1 }, { t: 6, x: 180, y: 180, z: 1.3 }, { t: 9.6, x: 185, y: 175, z: 1.25 }, { t: 12, x: 200, y: 190, z: 1.55 }, { t: 15, x: 190, y: 165, z: 1.1 }],
      actors: [{ who: 'ut', keys: UT }],
      cat: (t) => (t < 10.6 ? null : t < 11.6 ? { x: 330 - (t - 10.6) * 72, y: G, pose: 'walk', face: -1 } : onCart(196)),
      scene: (t) => ({ lightsFrom: 9, glow: t < 9 ? 0.05 : 0.35, postcardOnCart: t > 9.3 && t < 11.4, tarp: ease(clamp((t - 8.6) / 1.6)) }),
    };
  }
  if (v === 3) {
    const UT = [
      { t: 2.4, x: -40, face: 1, pose: 'stand' },
      { t: 6, x: 140, face: 1, pose: 'phone', move: true },
      { t: 11.4, x: 140, face: 1, pose: 'phone' },
      { t: 11.8, x: 150, face: 1, pose: 'reach', move: true },
      { t: 12.4, x: 150, face: 1, pose: 'read' },
      { t: 13.6, x: 150, face: -1, pose: 'shock' },
      { t: 14.6, x: 150, face: -1, pose: 'slump' },
    ];
    return {
      ...base,
      panels: [5, 9.6, 13.6],
      cam: [{ t: 0, x: 200, y: 150, z: 1 }, { t: 5, x: 170, y: 175, z: 1.3 }, { t: 11.5, x: 190, y: 190, z: 1.55 }, { t: 15, x: 200, y: 160, z: 1.1 }],
      actors: [{ who: 'ut', keys: UT }],
      cat: (t) => (t < 12 ? null : t < 13 ? { x: 330 - (t - 12) * 72, y: G, pose: 'walk', face: -1 } : onCart(196)),
      scene: (t) => ({ lightsFrom: 0.4, glow: 0.35, postcardOnCart: t < 12.4 }),
      inset: (ctx, t, w, h) => inset(ctx, w, h, window01(t, 7.2, 11.4), (c, cw, ch) => phoneCard(c, cw, ch, t), { ratio: 1.2, tilt: 0.04 }),
    };
  }
  if (v === 4) {
    const UT = [
      { t: 2.4, x: -40, face: 1, pose: 'stand' },
      { t: 6, x: 150, face: 1, pose: 'phone', move: true },
      { t: 7, x: 150, face: 1, pose: 'reach' },
      { t: 7.6, x: 150, face: 1, pose: 'read' },
      { t: 8.6, x: 150, face: -1, pose: 'read' },
      { t: 9.2, x: 150, face: -1, pose: 'shock' },
      { t: 13, x: 150, face: -1, pose: 'slump' },
    ];
    return {
      ...base,
      panels: [5, 9.6, 13.6],
      cam: [{ t: 0, x: 200, y: 150, z: 1 }, { t: 3, x: 190, y: 170, z: 1.15 }, { t: 7.6, x: 205, y: 190, z: 1.6 }, { t: 9.2, x: 110, y: 170, z: 1.45 }, { t: 14.5, x: 150, y: 165, z: 1.15 }],
      actors: [{ who: 'ut', keys: UT }, { who: 'co-sau', keys: [{ t: 8.8, x: 43, face: 1, pose: 'stand' }, { t: 12.6, x: 43, face: 1, pose: 'nod' }] }],
      cat: (t) => (t < 11.6 ? null : t < 12.6 ? { x: 330 - (t - 11.6) * 72, y: G, pose: 'walk', face: -1 } : onCart(196)),
      scene: (t) => ({ lightsFrom: 0.4, glow: 0.35, postcardOnCart: t < 7.6 }),
      inset: (ctx, t, w, h) => inset(ctx, w, h, window01(t, 9.3, 12.6), noticeCard, { ratio: 1.05, tilt: -0.04 }),
    };
  }
  if (v === 5) {
    return {
      ...base,
      panels: [5, 9.6, 13.6],
      inset: (ctx, t, w, h) => inset(ctx, w, h, window01(t, 8.6, 11.6), postcardCard, { ratio: 0.66, tilt: -0.05 }),
    };
  }
  return base;
}
