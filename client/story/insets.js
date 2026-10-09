// Close-ups over a story beat (screen space, drawn by the player after the stage: staging `inset(ctx, t, w, h)`).
// A card over the upper middle of the screen, so the caption card below stays free. Nearly wordless: a name and a
// count (client/i18n, the same in vi and en).
import { STAGE, drawBeach } from './scene.js';
import { setStyle, shape } from './style.js';
import { drawPerson, POSES } from './rig.js';
import { t as tr } from '../i18n/index.js';

const G = STAGE.ground;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const rr = (x, y, w, h, r) => {
  const p = new Path2D();
  p.roundRect(x, y, w, h, r);
  return p;
};
/** 0 → 1 → 0 over [a, b] with quick fades: how present a close-up is at t. */
export const window01 = (t, a, b, f = 0.35) => clamp(Math.min((t - a) / f, (b - t) / f));

/** A close-up card over the upper middle of the screen, scaled in from 0.9. */
export function inset(ctx, w, h, k, draw, { ratio = 0.72, tilt = -0.03 } = {}) {
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

/** Út's phone: Bà Năm's avatar (grey bun, round glasses), her name, ↙ ×5 missed calls, a sixth ringing. */
export function phoneCard(ctx, cw, ch) {
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
  ctx.fillText(tr('story.callerBa'), 0, ay + pw * 0.42);
  ctx.fillStyle = '#e0362c';
  ctx.font = `700 ${Math.round(pw * 0.2)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillText(tr('story.missedCalls', { n: 5 }), 0, ay + pw * 0.72);
  // a sixth call ringing: the green / red buttons, the red one under Út's thumb
  for (const [bx, c] of [[-0.22, '#3bb36a'], [0.22, '#e0362c']]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(bx * pw, ph * 0.33, pw * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** An old photo (Bà Năm's past, the Đông Hồ print): young Bà Năm waving from her father's boat. The clue to the coast. */
export function photoCard(ctx, cw, ch, t = 0) {
  setStyle('past');
  shape(ctx, rr(-cw / 2, -ch / 2, cw, ch, 2), 'postcard');
  ctx.shadowColor = 'transparent';
  const m = cw * 0.06, iw = cw - m * 2, ih = ch - m * 2.6;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-cw / 2 + m, -ch / 2 + m, iw, ih);
  ctx.clip();
  // the stage from x 40 to 270, y 110 to 250: the boat on the sand, the sea behind
  const s = Math.max(iw / 230, ih / 140);
  ctx.translate(-cw / 2 + m + iw / 2 - 155 * s, -ch / 2 + m + ih / 2 - 168 * s);
  ctx.scale(s, s);
  drawBeach(ctx, t, {});
  drawPerson(ctx, 'ba-nam-young', 150, 210, 1, 1, POSES.wave, t);
  ctx.restore();
}
