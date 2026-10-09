// Code-drawn story cast (Canvas 2D), pantomime grammar (docs/STORY.md): silhouette-first poses, a few key poses per
// character, snapped (~0.1 s) and held. A pose is plain numbers so the timeline can blend them. Every shape is a
// Path2D painted through style.js (palette, outline, shading per art direction).
//
// Units: a character stands at its feet (0, 0), about 105 units tall; `face` 1 = looking right, -1 = left.
// Angles are radians from hanging straight down; positive swings toward the facing direction.
import { shape, stroke, style, col } from './style.js';

export const POSES = {
  stand: { lean: 0, head: 0, armB: [0.08, 0.1], armF: [0.08, 0.1], legB: 0, legF: 0, mouth: 0, eyes: 1 },
  walk: { lean: 0.05, head: 0, armB: [0.08, 0.1], armF: [0.08, 0.1], legB: 0, legF: 0, mouth: 0, eyes: 1, walk: 1 },
  phone: { lean: -0.04, head: 0.28, armB: [0.1, 0.1], armF: [0.55, 1.9], legB: 0, legF: 0, mouth: 0, eyes: 1, prop: 'phone' },
  reach: { lean: 0.18, head: 0.15, armB: [0.2, 0.2], armF: [1.35, 0.25], legB: -0.12, legF: 0.15, mouth: 0, eyes: 1 },
  read: { lean: -0.02, head: 0.32, armB: [0.5, 1.7], armF: [0.6, 1.6], legB: 0, legF: 0, mouth: 0, eyes: 0.6, prop: 'postcard' },
  shock: { lean: -0.14, head: -0.18, armB: [0.9, 0.9], armF: [1.0, 0.9], legB: -0.1, legF: 0.1, mouth: 2, eyes: 1.5, prop: 'postcard' },
  slump: { lean: 0.2, head: 0.45, armB: [0.02, 0], armF: [0.15, 0.3], legB: 0, legF: 0, mouth: -1, eyes: 0.4, prop: 'postcard' },
  cough: { lean: 0.32, head: 0.4, armB: [0.1, 0.1], armF: [1.2, 2.2], legB: -0.1, legF: 0.08, mouth: 2, eyes: 0, smoke: 1 },
  fan: { lean: 0.12, head: 0.2, armB: [0.25, 0.4], armF: [1.0, 0.9], legB: -0.08, legF: 0.1, mouth: 1, eyes: 1, prop: 'fan', fanning: 1 },
  point: { lean: 0.05, head: 0.05, armB: [0.1, 0.1], armF: [1.6, 0.05], legB: 0, legF: 0, mouth: 1, eyes: 1, prop: 'fan' },
  smile: { lean: -0.04, head: -0.12, armB: [0.15, 0.3], armF: [0.15, 0.3], legB: 0, legF: 0, mouth: 1, eyes: 0.5 },
  sit: { lean: 0.05, head: 0, armB: [0.6, 1.2], armF: [0.7, 1.3], legB: 1.45, legF: 1.5, knee: -1.45, mouth: 0, eyes: 1, sit: 1 },
  eat: { lean: 0.12, head: 0.12, armB: [0.6, 1.2], armF: [0.8, 2.1], legB: 1.45, legF: 1.5, knee: -1.45, mouth: 1, eyes: 0.5, sit: 1 },
  serve: { lean: 0.1, head: 0.05, armB: [0.2, 0.3], armF: [1.45, 0.1], legB: -0.08, legF: 0.1, mouth: 1, eyes: 1, prop: 'plate' },
  give: { lean: 0.08, head: 0.05, armB: [0.1, 0.1], armF: [1.4, 0.2], legB: 0, legF: 0.08, mouth: 1, eyes: 1 },
  take: { lean: 0.1, head: 0.1, armB: [0.1, 0.1], armF: [1.3, 0.3], legB: 0, legF: 0.08, mouth: 0, eyes: 1 },
  hang: { lean: -0.05, head: -0.3, armB: [0.1, 0.1], armF: [2.7, 0.2], legB: 0, legF: 0, mouth: 0, eyes: 1, prop: 'lanyard' },
  wave: { lean: 0, head: -0.05, armB: [0.1, 0.1], armF: [2.6, 0.5], legB: 0, legF: 0, mouth: 1, eyes: 0.5, waving: 1 },
  push: { lean: 0.25, head: -0.05, armB: [1.25, 0.15], armF: [1.3, 0.15], legB: -0.25, legF: 0.3, mouth: 0, eyes: 1 },
  pushWalk: { lean: 0.25, head: -0.05, armB: [1.25, 0.15], armF: [1.3, 0.15], legB: 0, legF: 0, mouth: 1, eyes: 1, walk: 1 },
  nod: { lean: 0.04, head: 0.25, armB: [0.1, 0.1], armF: [0.1, 0.1], legB: 0, legF: 0, mouth: 1, eyes: 0.5 },
  carry: { lean: 0.06, head: -0.05, armB: [2.5, 0.6], armF: [0.9, 1.7], legB: 0, legF: 0, mouth: 1, eyes: 0.5, pole: 1 },
  carryWalk: { lean: 0.1, head: 0, armB: [2.5, 0.6], armF: [0.9, 1.7], legB: 0, legF: 0, mouth: 0, eyes: 1, pole: 1, walk: 1 },
};

// palette keys per character (style.js)
const LOOKS = {
  ut: { skin: 'skinUt', hair: 'hairUt', shirt: 'shirtUt', pants: 'pantsUt', apron: true, lanyard: true, height: 1 },
  'co-sau': { skin: 'skinSau', hair: 'hairSau', shirt: 'shirtSau', pattern: 'patternSau', pants: 'pantsSau', bun: true, height: 0.94 },
  khang: { skin: 'skinKhang', hair: 'hairKhang', shirt: 'chef', pants: 'pantsKhang', chef: true, height: 1.06 },
  'chu-tu': { skin: 'skinTu', hair: 'hairTu', shirt: 'shirtTu', pants: 'pantsTu', cap: true, height: 0.98 },
  // two regulars of the alley: an uncle in a white singlet, a student
  'regular-a': { skin: 'skinA', hair: 'hairA', shirt: 'shirtA', pants: 'pantsA', short: true, height: 0.96 },
  'regular-b': { skin: 'skinB', hair: 'hairB', shirt: 'shirtB', pants: 'pantsB', braid: true, height: 0.92 },
  // guests at the counter: a student with a backpack, a xe ôm driver in his helmet, an office worker with a bob and
  // glasses, a worker in a cap, an old man with glasses
  'guest-1': { skin: 'skinG1', hair: 'hairG1', shirt: 'shirtG1', pants: 'pantsG1', backpack: 'bagG1', height: 0.95 },
  'guest-2': { skin: 'skinG2', hair: 'hairG2', shirt: 'shirtG2', pants: 'pantsG2', helmet: 'helmetG2', height: 1.02 },
  'guest-3': { skin: 'skinG3', hair: 'hairG3', shirt: 'shirtG3', pants: 'pantsG3', bob: true, glasses: true, height: 0.93 },
  'guest-4': { skin: 'skinG4', hair: 'hairG4', shirt: 'shirtG4', pants: 'pantsG4', cap: true, capColor: 'capG4', height: 1 },
  'guest-5': { skin: 'skinG5', hair: 'hairG5', shirt: 'shirtG5', pants: 'pantsG5', glasses: true, height: 0.94 },
  'beach-1': { skin: 'skinB1', hair: 'hairB1', shirt: 'shirtB1', pants: 'pantsB1', bun: true, nonla: 'hatB1', height: 0.93 },
  'beach-2': { skin: 'skinB2', hair: 'hairB2', shirt: 'shirtB2', pants: 'pantsB2', short: true, headTowel: 'towelB2', height: 1 },
  'beach-3': { skin: 'skinB3', hair: 'hairB3', shirt: 'shirtB3', pants: 'pantsB3', sunhat: 'hatB3', height: 0.74 },
  'beach-4': { skin: 'skinB4', hair: 'hairB4', shirt: 'shirtB4', pants: 'pantsB4', sunhat: 'hatB4', glasses: false, height: 0.95 },
  'beach-5': { skin: 'skinB5', hair: 'hairB5', shirt: 'shirtB5', pattern: 'patternB5', pants: 'pantsB5', bob: true, height: 0.92 },
  // flashback: Bà Năm as a girl selling her father's catch (a headscarf, a long braid, a shoulder pole)
  'ba-nam-young': { skin: 'skinBa', hair: 'hairBa', shirt: 'shirtBa', pants: 'pantsBa', braid: true, scarf: true, height: 0.9 },
};

const lerp = (a, b, k) => a + (b - a) * k;

/** Blend two poses (numbers lerp, the rest snaps to `b` from halfway). */
export function blendPose(a, b, k) {
  if (k >= 1 || a === b) return b;
  const out = { ...(k < 0.5 ? a : b) };
  for (const key of ['lean', 'head', 'legB', 'legF', 'knee', 'mouth', 'eyes']) out[key] = lerp(a[key] ?? 0, b[key] ?? 0, k);
  for (const key of ['armB', 'armF']) out[key] = [lerp(a[key][0], b[key][0], k), lerp(a[key][1], b[key][1], k)];
  return out;
}

const circle = (x, y, r) => {
  const p = new Path2D();
  p.arc(x, y, r, 0, Math.PI * 2);
  return p;
};
const rrect = (x, y, w, h, r) => {
  const p = new Path2D();
  p.roundRect(x, y, w, h, r);
  return p;
};
const poly = (...pts) => {
  const p = new Path2D();
  p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
  p.closePath();
  return p;
};

function limb(ctx, x, y, a1, a2, l1, l2, w, key, end) {
  const ex = x + Math.sin(a1) * l1, ey = y + Math.cos(a1) * l1;
  const hx = ex + Math.sin(a1 + a2) * l2, hy = ey + Math.cos(a1 + a2) * l2;
  const p = new Path2D();
  p.moveTo(x, y);
  p.lineTo(ex, ey);
  p.lineTo(hx, hy);
  stroke(ctx, p, key, w);
  if (end === 'shoe') {
    const shoe = new Path2D();
    shoe.ellipse(hx + w * 0.35, hy + w * 0.12, w * 0.78, w * 0.46, 0, 0, Math.PI * 2);
    shape(ctx, shoe, 'shoe');
  } else if (end) shape(ctx, circle(hx, hy, w * 0.62), end);
  return [hx, hy];
}

function prop(ctx, kind, x, y, t, p) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === 'phone') {
    shape(ctx, rrect(-4.5, -12, 9, 15, 1.5), 'phone');
    shape(ctx, rrect(-3, -10.5, 6, 11, 1), 'screen', { line: false });
    shape(ctx, circle(4.5, -12, 2.6), 'badge');
  } else if (kind === 'postcard') {
    ctx.rotate(-0.15);
    shape(ctx, rrect(-11, -15, 22, 14, 1), 'postcard');
    shape(ctx, rrect(4, -13, 4.5, 4.5, 0.5), 'stamp', { line: false });
    ctx.strokeStyle = col('postLine');
    ctx.lineWidth = 0.8;
    for (const ly of [-10, -7, -4]) {
      ctx.beginPath();
      ctx.moveTo(-8, ly);
      ctx.lineTo(1, ly);
      ctx.stroke();
    }
  } else if (kind === 'notebook' || kind === 'page' || kind === 'flyer') {
    ctx.rotate(-0.2);
    if (kind === 'notebook') {
      // open notebook; the right page torn out (a ragged stub)
      shape(ctx, rrect(-15, -16, 30, 18, 1.5), 'notebook');
      shape(ctx, rrect(-13, -15, 12.5, 16, 0.5), 'page', { line: false });
      shape(ctx, new Path2D('M1 -15 L4 -12 L2 -9 L5 -6 L2 -3 L4 0 L1 1 Z'), 'page', { line: false });
      ctx.strokeStyle = col('postLine');
      ctx.lineWidth = 0.7;
      for (const ly of [-12, -9, -6, -3]) {
        ctx.beginPath();
        ctx.moveTo(-11, ly);
        ctx.lineTo(-3, ly);
        ctx.stroke();
      }
    } else {
      shape(ctx, rrect(-8, -18, 16, 20, 1), kind);
      ctx.fillStyle = col(kind === 'flyer' ? 'flyerBlue' : 'postLine');
      if (kind === 'flyer') {
        ctx.fillRect(-6, -16, 12, 7); // the tower, in Út's company colours
        ctx.fillRect(-6, -6, 9, 1.5);
        ctx.fillRect(-6, -3, 12, 1.5);
      } else for (const ly of [-14, -10, -6, -2]) ctx.fillRect(-6, ly, 11, 0.9);
    }
  } else if (kind === 'basket') {
    for (const fx of [-5, 0, 5]) {
      const fish = new Path2D();
      fish.ellipse(fx, -12, 5, 2.2, fx * 0.12 - 0.5, 0, Math.PI * 2);
      shape(ctx, fish, 'fish');
    }
    shape(ctx, new Path2D('M-11 -10 L11 -10 Q10 4 0 4 Q-10 4 -11 -10 Z'), 'basket');
  } else if (kind === 'lanternPage') {
    ctx.rotate(-0.2);
    shape(ctx, rrect(-8, -18, 16, 20, 1), 'page');
    ctx.fillStyle = col('postLine');
    for (const ly of [-14, -10]) ctx.fillRect(-6, ly, 11, 0.9);
    // a tiny paper lantern tucked in the page: the clue to the next stop
    const l = new Path2D();
    l.ellipse(2, -2, 4.5, 5.5, 0, 0, Math.PI * 2);
    shape(ctx, l, 'lantern');
    shape(ctx, rrect(-1, -8.5, 6, 2, 0.5), 'lanternCap', { line: false });
    shape(ctx, rrect(-1, 3, 6, 2, 0.5), 'lanternCap', { line: false });
  } else if (kind === 'plate') {
    shape(ctx, new Path2D('M-12 -2 Q0 4 12 -2 Z'), 'plate');
    for (const fx of [-6, 0, 6]) shape(ctx, rrect(fx - 2.5, -9, 5, 7, 2), 'apron');
  } else if (kind === 'lanyard') {
    ctx.strokeStyle = col('lanyard');
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(0, 14);
    ctx.lineTo(4, 0);
    ctx.stroke();
    shape(ctx, rrect(-4, 14, 8, 10, 1), 'card');
  } else if (kind === 'fan') {
    // quạt nan: woven bamboo, a short handle
    ctx.rotate(p.fanning ? Math.sin(t * 14) * 0.5 : -0.3);
    const blade = new Path2D();
    blade.ellipse(0, -14, 11, 13, 0, 0, Math.PI * 2);
    shape(ctx, rrect(-1.6, -3, 3.2, 9, 1), 'fanHandle');
    shape(ctx, blade, 'fan');
    ctx.save();
    ctx.clip(blade);
    ctx.strokeStyle = col('fanLine');
    ctx.lineWidth = 0.7;
    for (let i = -12; i <= 12; i += 3) {
      ctx.beginPath();
      ctx.moveTo(i - 6, -28);
      ctx.lineTo(i + 6, 0);
      ctx.moveTo(i + 6, -28);
      ctx.lineTo(i - 6, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Draw a person. `who`: ut | co-sau; `p`: a pose; `t`: time (walk cycle, buzzing phone). */
export function drawPerson(ctx, who, x, y, s, face, p, t = 0) {
  const L = LOOKS[who];
  const S = style();
  const legs = S.legs ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * face * L.height, s * L.height);
  // contact shadow
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const swing = p.walk ? Math.sin(t * 9) * 0.45 : 0;
  const bob = p.walk ? Math.abs(Math.cos(t * 9)) * 2 : 0;
  const hip = -42 * legs;
  ctx.translate(0, -bob + (p.sit ? 16 : 0));
  const lw = S.limbs ?? 1;
  limb(ctx, -3.5, hip, p.legB + swing, p.knee ?? 0, 21 * legs, 21 * legs, 10.5 * lw, L.pants, 'shoe');
  limb(ctx, 3.5, hip, p.legF - swing, p.knee ?? 0, 21 * legs, 21 * legs, 10.5 * lw, L.pants, 'shoe');
  ctx.save();
  ctx.translate(0, hip);
  ctx.rotate(p.lean);
  if (L.backpack) shape(ctx, rrect(-20, -36, 10, 26, 4), L.backpack);
  limb(ctx, -3, -34, p.armB[0] - swing * 0.6, p.armB[1], 17 * (2 - lw) * 0.95, 15 * (2 - lw), 8.5 * lw, L.shirt, L.skin);
  // tapered shirt with a collar (rounder in the toy style)
  const bw = S.body ?? 1;
  const torso = new Path2D();
  torso.moveTo(-12 * bw, -36);
  torso.quadraticCurveTo(-13.5 * bw, -38, -11 * bw, -39);
  torso.lineTo(11 * bw, -39);
  torso.quadraticCurveTo(13.5 * bw, -38, 12 * bw, -36);
  torso.lineTo(13.5 * bw, -2);
  torso.quadraticCurveTo(14 * bw, 3, 9 * bw, 3);
  torso.lineTo(-9 * bw, 3);
  torso.quadraticCurveTo(-14 * bw, 3, -13.5 * bw, -2);
  torso.closePath();
  shape(ctx, torso, L.shirt);
  shape(ctx, poly(-6, -39, 0, -32, 6, -39, 3, -40, 0, -36, -3, -40), L.shirt);
  if (p.pole) pole(ctx, t, p.walk);
  if (L.pattern) {
    ctx.fillStyle = col(L.pattern);
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(-7 + (i % 3) * 7, -31 + Math.floor(i / 3) * 10, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (L.apron) {
    // too big for Út: down to the knees
    shape(ctx, poly(-8, -30, 8, -30, 13, -16, 15, 20, -15, 20, -13, -16), 'apron');
    shape(ctx, rrect(-6, -2, 12, 7, 1), 'apronDark', { line: false });
  }
  if (L.chef) {
    ctx.fillStyle = col('ink');
    for (const by of [-30, -21, -12]) for (const bx of [-4, 4]) {
      ctx.beginPath();
      ctx.arc(bx, by, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (L.short) {
    // áo ba lỗ: the singlet shows the shoulders; a towel over one of them
    shape(ctx, rrect(-12, -40, 7, 6, 2), L.skin, { line: false });
    shape(ctx, rrect(5, -40, 7, 6, 2), L.skin, { line: false });
    shape(ctx, rrect(4, -40, 6, 18, 2), 'notice');
  }
  if (L.lanyard && !p.noLanyard && p.prop !== 'lanyard') {
    ctx.strokeStyle = col('lanyard');
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-5, -38);
    ctx.lineTo(0, -22);
    ctx.lineTo(5, -38);
    ctx.stroke();
    shape(ctx, rrect(-4, -22, 8, 10, 1), 'card');
    ctx.fillStyle = col('lanyard');
    ctx.fillRect(-4, -22, 8, 3);
  }
  // head (bigger in the toy style)
  ctx.save();
  ctx.translate(0, -48 - (S.head - 1) * 10);
  ctx.rotate(p.head);
  ctx.scale(S.head, S.head);
  if (L.bun) shape(ctx, circle(-9, -9, 5.5), L.hair);
  if (L.braid) {
    const braid = new Path2D();
    braid.moveTo(-10, 0);
    braid.quadraticCurveTo(-16, 14, -12, 30);
    stroke(ctx, braid, L.hair, 4.5);
  }
  shape(ctx, circle(0, 0, 12), L.skin);
  const hair = new Path2D();
  if (L.bob) {
    // a bob: rounded down to the jaw at the back, a straight fringe
    hair.moveTo(-13, 8);
    hair.arc(0, -1, 13.4, Math.PI * 0.8, Math.PI * 1.9);
    hair.lineTo(11, -4);
    hair.lineTo(-2, -5);
    hair.lineTo(-6, 6);
  } else if (L.bun || L.braid) {
    // Cô Sáu / young Bà Năm: hair combed back (bun / braid)
    hair.arc(0, -1, 12.8, Math.PI * 0.95, Math.PI * 1.95);
    hair.quadraticCurveTo(4, -9, -12.5, 1);
  } else {
    // Út: short, tousled, a side fringe falling toward the face
    hair.moveTo(-12.5, 3);
    hair.arc(0, -1, 13, Math.PI * 0.92, Math.PI * 1.88);
    hair.lineTo(13, -3);
    hair.lineTo(9, -4);
    hair.lineTo(10, 0);
    hair.lineTo(5, -5);
    hair.lineTo(4, -1);
    hair.lineTo(-1, -6);
    hair.lineTo(-6, -4);
    hair.lineTo(-9, 1);
  }
  hair.closePath();
  shape(ctx, hair, L.hair);
  if (S.shine) {
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -1, 9.5, Math.PI * 1.3, Math.PI * 1.55);
    ctx.stroke();
  }
  if (L.chef) shape(ctx, rrect(-10, -26, 20, 15, 6), 'chef');
  if (L.cap) {
    const cap = new Path2D();
    cap.arc(0, -3, 13, Math.PI, Math.PI * 2);
    cap.lineTo(19, -3);
    cap.lineTo(13, -1);
    cap.closePath();
    shape(ctx, cap, L.capColor ?? 'boatTrim');
  }
  if (L.nonla) {
    // nón lá: the conical hat of the fish sellers
    shape(ctx, new Path2D('M-22 -4 L0 -26 L22 -4 Q0 0 -22 -4 Z'), L.nonla);
    ctx.strokeStyle = 'rgba(120,90,40,.5)';
    ctx.lineWidth = 0.6;
    for (const k of [0.35, 0.6, 0.85]) {
      ctx.beginPath();
      ctx.moveTo(-22 * k, -26 + 22 * k);
      ctx.lineTo(22 * k, -26 + 22 * k);
      ctx.stroke();
    }
  }
  if (L.sunhat) {
    // a soft bucket / sun hat
    shape(ctx, new Path2D('M-18 -5 Q0 -9 18 -5 L14 -2 Q0 -5 -14 -2 Z'), L.sunhat);
    shape(ctx, new Path2D('M-11 -5 Q-10 -20 0 -20 Q10 -20 11 -5 Z'), L.sunhat);
  }
  if (L.headTowel) {
    // a towel knotted round the head against the sun
    shape(ctx, new Path2D('M-13 -3 Q-12 -15 0 -15 Q12 -15 13 -3 L13 1 L-13 1 Z'), L.headTowel);
    shape(ctx, new Path2D('M-13 -1 L-19 4 L-16 6 L-12 2 Z'), L.headTowel);
  }
  if (L.helmet) {
    // a motorbike half-helmet, strap under the chin
    const hm = new Path2D();
    hm.arc(0, -2, 14.5, Math.PI * 1.02, Math.PI * 1.98);
    hm.lineTo(15, -1);
    hm.lineTo(-14.5, -1);
    hm.closePath();
    shape(ctx, hm, L.helmet);
    ctx.strokeStyle = col('ink');
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-8, -1);
    ctx.quadraticCurveTo(-4, 12, 4, 10);
    ctx.stroke();
  }
  if (L.scarf) {
    const scarf = new Path2D();
    scarf.moveTo(-13, 2);
    scarf.arc(0, -1, 13.6, Math.PI * 0.95, Math.PI * 1.9);
    scarf.lineTo(9, -6);
    scarf.quadraticCurveTo(0, -9, -9, -4);
    scarf.lineTo(-15, 8);
    scarf.closePath();
    shape(ctx, scarf, 'scarf');
  }
  // ear
  shape(ctx, circle(-3, 1, 2.6), L.skin, { line: false });
  if (S.cheeks) {
    ctx.fillStyle = col('cheek');
    ctx.beginPath();
    ctx.ellipse(5, 4, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // face: eyebrows carry the mood (raised in shock, slanted when sad), eyes (white + pupil in the cartoon style, a line
  // when closed / happy, big when shocked), a small nose, the mouth
  ctx.fillStyle = col('ink');
  ctx.strokeStyle = col('ink');
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3;
  const browUp = p.eyes > 1.2 ? 2.2 : 0, sad = p.mouth < -0.5 ? 1.6 : 0;
  ctx.beginPath();
  ctx.moveTo(3.6, -5.6 - browUp + sad);
  ctx.lineTo(9, -6.2 - browUp - sad * 0.4);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(11.2, 0.5);
  ctx.quadraticCurveTo(12.6, 2.4, 10.8, 3);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  if (p.eyes > 0.8) {
    if (S.eyesWhite) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(6, -1.5, 2.6 * Math.min(p.eyes, 1.4), 3 * Math.min(p.eyes, 1.4), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col('ink');
    }
    ctx.beginPath();
    ctx.arc(6.6, -1.2, 1.5 * Math.min(p.eyes, 1.5), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(6, p.eyes > 0.3 ? 0 : -1, 2.2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  if (L.glasses) {
    ctx.strokeStyle = col('ink');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(6.6, -1.2, 3.4, 0, Math.PI * 2);
    ctx.moveTo(3.2, -1.6);
    ctx.lineTo(-2, -2.4);
    ctx.stroke();
  }
  ctx.beginPath();
  if (p.mouth > 1.5) ctx.arc(7, 6, 2.2, 0, Math.PI * 2);
  else if (p.mouth > 0.5) ctx.arc(6, 4, 3, Math.PI * 0.15, Math.PI * 0.85);
  else if (p.mouth < -0.5) ctx.arc(6, 8, 3, Math.PI * 1.15, Math.PI * 1.85);
  else {
    ctx.moveTo(4, 6);
    ctx.lineTo(9, 6);
  }
  p.mouth > 1.5 ? ctx.fill() : ctx.stroke();
  ctx.restore();
  const wave = p.waving ? Math.sin(t * 10) * 0.35 : 0;
  const [hx, hy] = limb(ctx, 3, -34, p.armF[0] + swing * 0.6, p.armF[1] + wave, 17 * (2 - lw) * 0.95, 15 * (2 - lw), 8.5 * lw, L.shirt, L.skin);
  if (p.prop) prop(ctx, p.prop, hx, hy, t, p);
  ctx.restore();
  if (p.smoke) smoke(ctx, 26, -100, t);
  ctx.restore();
}

/** Đòn gánh: a bamboo pole across the shoulder, a basket of fish swinging at each end. */
function pole(ctx, t, walking) {
  const sway = walking ? Math.sin(t * 9) * 0.08 : Math.sin(t * 1.5) * 0.03;
  ctx.save();
  ctx.translate(0, -40);
  ctx.rotate(sway);
  const bar = new Path2D();
  bar.moveTo(-40, 2);
  bar.quadraticCurveTo(0, -3, 40, 2);
  stroke(ctx, bar, 'pole', 3);
  for (const x of [-38, 38]) {
    ctx.strokeStyle = col('basketLine');
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x - 7, 28);
    ctx.moveTo(x, 2);
    ctx.lineTo(x + 7, 28);
    ctx.stroke();
    for (const fx of [-5, 0, 5]) {
      const fish = new Path2D();
      fish.ellipse(x + fx, 26, 5, 2.2, fx * 0.12 - 0.5, 0, Math.PI * 2);
      shape(ctx, fish, 'fish');
    }
    const basket = new Path2D();
    basket.moveTo(x - 10, 28);
    basket.lineTo(x + 10, 28);
    basket.quadraticCurveTo(x + 9, 42, x, 42);
    basket.quadraticCurveTo(x - 9, 42, x - 10, 28);
    basket.closePath();
    shape(ctx, basket, 'basket');
  }
  ctx.restore();
}

/** A puff of grey smoke, rising. */
export function smoke(ctx, x, y, t, n = 4) {
  const rgb = col('smoke');
  for (let i = 0; i < n; i++) {
    const k = (t * 0.7 + i / n) % 1;
    ctx.fillStyle = `rgba(${rgb},${0.55 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(k * 6 + i) * 6, y - k * 40, 6 + k * 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Mực, the black alley cat. `pose`: sit | walk | jump | sleep. */
export function drawCat(ctx, x, y, s, face, pose, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * face, s);
  if (pose === 'sleep') {
    const body = new Path2D();
    body.ellipse(0, -7, 16, 8, 0, 0, Math.PI * 2);
    shape(ctx, body, 'cat');
    shape(ctx, circle(12, -9, 6.5), 'cat');
  } else {
    const sit = pose === 'sit';
    ctx.translate(0, pose === 'jump' ? -Math.sin(Math.min(1, t) * Math.PI) * 30 : 0);
    const tail = new Path2D();
    tail.moveTo(-12, -10);
    tail.quadraticCurveTo(-24, -14 + Math.sin(t * 3) * 4, -20, -28);
    stroke(ctx, tail, 'cat', 3);
    const body = new Path2D();
    body.ellipse(-2, -12, 11, sit ? 12 : 8, sit ? -0.3 : 0, 0, Math.PI * 2);
    shape(ctx, body, 'cat');
    const hy = sit ? -25 : -20;
    const head = new Path2D();
    head.arc(8, hy, 7, 0, Math.PI * 2);
    for (const ex of [4, 11]) {
      head.moveTo(ex - 3.5, hy - 3);
      head.lineTo(ex, hy - 11);
      head.lineTo(ex + 3.5, hy - 3);
      head.closePath();
    }
    shape(ctx, head, 'cat');
    ctx.fillStyle = 'rgba(240,140,160,.75)';
    for (const ex of [4, 11]) {
      ctx.beginPath();
      ctx.moveTo(ex - 1.6, hy - 4);
      ctx.lineTo(ex, hy - 8.4);
      ctx.lineTo(ex + 1.6, hy - 4);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 0.5;
    for (const dy of [-0.8, 1.2]) {
      ctx.beginPath();
      ctx.moveTo(13, hy + 2);
      ctx.lineTo(19, hy + 1 + dy * 1.6);
      ctx.stroke();
    }
    ctx.fillStyle = col('catEye');
    ctx.beginPath();
    ctx.arc(11, hy - 1, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
