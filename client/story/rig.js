// Code-drawn story cast (Canvas 2D), pantomime grammar (docs/STORY.md): silhouette-first poses, a few key poses per
// character, snapped (~0.1 s) and held. A pose is plain numbers so the timeline can blend them.
//
// Units: a character stands at its feet (0, 0), about 105 units tall; `face` 1 = looking right, -1 = left.
// Angles are radians from hanging straight down; positive swings toward the facing direction.

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
};

const LOOKS = {
  ut: { skin: '#f0c49c', hair: '#1c1418', shirt: '#f4f1ec', pants: '#2c2f3e', apron: '#e8742c', lanyard: true, height: 1 },
  'co-sau': { skin: '#d9a47c', hair: '#8d8790', shirt: '#7a4a8c', pattern: '#e9b4d8', pants: '#3a2a30', bun: true, height: 0.94 },
  khang: { skin: '#e2b48c', hair: '#141014', shirt: '#fafafa', pants: '#1c1c22', chef: true, height: 1.04 },
};

const lerp = (a, b, k) => a + (b - a) * k;

/** Blend two poses (numbers lerp, the rest snaps to `b` from halfway). */
export function blendPose(a, b, k) {
  if (k >= 1 || a === b) return b;
  const out = { ...(k < 0.5 ? a : b) };
  for (const key of ['lean', 'head', 'legB', 'legF', 'mouth', 'eyes']) out[key] = lerp(a[key] ?? 0, b[key] ?? 0, k);
  for (const key of ['armB', 'armF']) out[key] = [lerp(a[key][0], b[key][0], k), lerp(a[key][1], b[key][1], k)];
  return out;
}

function limb(ctx, x, y, a1, a2, l1, l2, w, color, hand) {
  const ex = x + Math.sin(a1) * l1, ey = y + Math.cos(a1) * l1;
  const hx = ex + Math.sin(a1 + a2) * l2, hy = ey + Math.cos(a1 + a2) * l2;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  if (hand) {
    ctx.fillStyle = hand;
    ctx.beginPath();
    ctx.arc(hx, hy, w * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }
  return [hx, hy];
}

function prop(ctx, kind, x, y, t, p) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === 'phone') {
    ctx.fillStyle = '#15151c';
    ctx.fillRect(-4, -11, 8, 14);
    ctx.fillStyle = '#9fd6ff';
    ctx.fillRect(-3, -10, 6, 11);
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(4, -11, 2.6, 0, Math.PI * 2);
    ctx.fill();
    if (Math.sin(t * 40) > 0) {
      ctx.strokeStyle = '#ffffffaa';
      ctx.lineWidth = 1;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 7, -9);
        ctx.lineTo(s * 9, -6);
        ctx.stroke();
      }
    }
  } else if (kind === 'postcard') {
    ctx.rotate(-0.15);
    ctx.fillStyle = '#fdf3dc';
    ctx.fillRect(-10, -14, 20, 13);
    ctx.fillStyle = '#d2483a';
    ctx.fillRect(4, -12, 4, 4);
    ctx.strokeStyle = '#7c6a58';
    ctx.lineWidth = 0.8;
    for (const ly of [-9, -6, -3]) {
      ctx.beginPath();
      ctx.moveTo(-8, ly);
      ctx.lineTo(1, ly);
      ctx.stroke();
    }
  } else if (kind === 'fan') {
    ctx.rotate(p.fanning ? Math.sin(t * 14) * 0.5 : -0.3);
    ctx.fillStyle = '#d8b06a';
    ctx.beginPath();
    ctx.ellipse(0, -14, 11, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9c7436';
    ctx.lineWidth = 0.7;
    for (let i = -9; i <= 9; i += 3) {
      ctx.beginPath();
      ctx.moveTo(i, -26);
      ctx.lineTo(i, -2);
      ctx.moveTo(-10, -14 + i);
      ctx.lineTo(10, -14 + i);
      ctx.stroke();
    }
    ctx.fillStyle = '#7a5428';
    ctx.fillRect(-1.5, -2, 3, 8);
  }
  ctx.restore();
}

/** Draw a person. `who`: ut | co-sau | khang; `p`: a pose; `t`: time (walk cycle, buzzing phone). */
export function drawPerson(ctx, who, x, y, s, face, p, t = 0) {
  const L = LOOKS[who];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * face * L.height, s * L.height);
  const swing = p.walk ? Math.sin(t * 9) * 0.45 : 0;
  const bob = p.walk ? Math.abs(Math.cos(t * 9)) * 2 : 0;
  ctx.translate(0, -bob);
  // legs
  limb(ctx, -3, -42, p.legB + swing, 0, 21, 21, 9, L.pants, '#1a1414');
  limb(ctx, 3, -42, p.legF - swing, 0, 21, 21, 9, L.pants, '#1a1414');
  ctx.save();
  ctx.translate(0, -42);
  ctx.rotate(p.lean);
  // back arm
  limb(ctx, -3, -34, p.armB[0] - swing * 0.6, p.armB[1], 17, 15, 7, L.shirt, L.skin);
  // torso
  ctx.fillStyle = L.shirt;
  ctx.beginPath();
  ctx.roundRect(-12, -38, 24, 40, 7);
  ctx.fill();
  if (L.pattern) {
    ctx.fillStyle = L.pattern;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(-8 + (i % 3) * 8, -32 + Math.floor(i / 3) * 11, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (L.apron) {
    // too big for Út: down to the knees, ties hanging
    ctx.fillStyle = L.apron;
    ctx.beginPath();
    ctx.moveTo(-8, -30);
    ctx.lineTo(8, -30);
    ctx.lineTo(13, -16);
    ctx.lineTo(15, 20);
    ctx.lineTo(-15, 20);
    ctx.lineTo(-13, -16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c55a1c';
    ctx.fillRect(-6, -2, 12, 7);
  }
  if (L.chef) {
    ctx.fillStyle = '#d9d9d9';
    for (const by of [-30, -20, -10]) for (const bx of [-4, 4]) {
      ctx.beginPath();
      ctx.arc(bx, by, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (L.lanyard) {
    ctx.strokeStyle = '#2f6fd6';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-5, -38);
    ctx.lineTo(0, -22);
    ctx.lineTo(5, -38);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-4, -22, 8, 10);
    ctx.fillStyle = '#2f6fd6';
    ctx.fillRect(-4, -22, 8, 3);
  }
  // head
  ctx.save();
  ctx.translate(0, -48);
  ctx.rotate(p.head);
  ctx.fillStyle = L.skin;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = L.hair;
  ctx.beginPath();
  ctx.arc(0, -2, 12.6, Math.PI * 1.05, Math.PI * 2.02);
  ctx.lineTo(10, -3);
  ctx.quadraticCurveTo(2, -7, -12, 0);
  ctx.fill();
  if (L.bun) {
    ctx.beginPath();
    ctx.arc(-9, -9, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (L.chef) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-11, -24, 22, 14, 6);
    ctx.fill();
  }
  // face: eyes (a dot, a line when closed / happy, big when shocked) and mouth
  ctx.fillStyle = '#1a1414';
  ctx.strokeStyle = '#1a1414';
  ctx.lineWidth = 1.4;
  if (p.eyes > 0.8) {
    ctx.beginPath();
    ctx.arc(6, -1, 1.5 * Math.min(p.eyes, 1.6), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(6, p.eyes > 0.3 ? 0 : -1, 2, Math.PI * 1.1, Math.PI * 1.9);
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
  // front arm + prop in hand
  const [hx, hy] = limb(ctx, 3, -34, p.armF[0] + swing * 0.6, p.armF[1], 17, 15, 7, L.shirt, L.skin);
  if (p.prop) prop(ctx, p.prop, hx, hy, t, p);
  ctx.restore();
  if (p.smoke) smoke(ctx, 26, -100, t);
  ctx.restore();
}

/** A puff of grey smoke, rising. */
export function smoke(ctx, x, y, t, n = 4) {
  for (let i = 0; i < n; i++) {
    const k = (t * 0.7 + i / n) % 1;
    ctx.fillStyle = `rgba(190,180,175,${0.55 * (1 - k)})`;
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
  ctx.fillStyle = '#121014';
  if (pose === 'sleep') {
    ctx.beginPath();
    ctx.ellipse(0, -7, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(12, -9, 6.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const hop = pose === 'jump' ? -Math.sin(Math.min(1, t) * Math.PI) * 30 : 0;
    ctx.translate(0, hop);
    ctx.beginPath();
    ctx.ellipse(-2, -12, 11, pose === 'sit' ? 12 : 8, pose === 'sit' ? -0.3 : 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, pose === 'sit' ? -25 : -20, 7, 0, Math.PI * 2);
    ctx.fill();
    for (const ex of [4, 11]) {
      ctx.beginPath();
      ctx.moveTo(ex - 3, pose === 'sit' ? -29 : -24);
      ctx.lineTo(ex, pose === 'sit' ? -36 : -31);
      ctx.lineTo(ex + 3, pose === 'sit' ? -29 : -24);
      ctx.fill();
    }
    ctx.strokeStyle = '#121014';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, -10);
    ctx.quadraticCurveTo(-24, -14 + Math.sin(t * 3) * 4, -20, -28);
    ctx.stroke();
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(11, pose === 'sit' ? -26 : -21, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
