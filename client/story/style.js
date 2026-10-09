// #106 art-direction variants: one set of shapes (rig.js, scene.js), five ways to paint them, behind ?v-art=1..5
// (client/ui/variant.js set "art"). Every shape goes through shape() / stroke(), which apply the style's palette,
// outline, shading and texture; overlay() adds the screen-space paper / lacquer finish.
//   1 flat       modern flat cartoon, dark outline (Venba, Saigon street illustrators)
//   2 toy        chunky rounded "toy" figures, soft 3D shading, big heads (matches the 3D foods; Royal Match cutscenes)
//   3 cutout     layered paper cut-out, drop shadows, a slight wobble (paper lanterns, the postcard)
//   4 dongho     Đông Hồ woodblock print: thick black line, flat folk colours slightly off-register, điệp paper
//   5 lacquer    sơn mài: black ground, vermilion, gold leaf edges, eggshell-white crackle
import { variant } from '../ui/variant.js';

const BASE = {
  ink: '#1a1416', skinUt: '#f0c49c', hairUt: '#1c1418', shirtUt: '#f4f1ec', pantsUt: '#2c2f3e', apron: '#e8742c', apronDark: '#c55a1c',
  lanyard: '#2f6fd6', card: '#ffffff', skinSau: '#d9a47c', hairSau: '#8d8790', shirtSau: '#7a4a8c', patternSau: '#e9b4d8', pantsSau: '#3a2a30',
  cat: '#121014', catEye: '#ffd23c', sky1: '#2a1b33', sky2: '#4a2c3a', wallA: '#5b3d45', wallB: '#4c3440', door: '#2c1c24',
  window: '#3a6a5a', windowLight: '#ffd9a0', notice: '#f4efe2', noticeRed: '#c8302a', noticeText: '#8a8478', ground: '#2a1f24', groundLine: '#3a2c30',
  wire: '#1a1014', bulbOn: '#ffe2a0', bulbOff: '#5a4a40', glow: '255,200,110', cartBody: '#3e3a44', cartDark: '#2a262e', cartPole: '#6a4a32',
  coalHot: '255,120,30', wheel: '#18141a', hub: '#9aa3ad', stool: '#d8312a', postcard: '#fdf3dc', stamp: '#d2483a', postLine: '#7c6a58',
  fan: '#d8b06a', fanLine: '#9c7436', fanHandle: '#7a5428', phone: '#15151c', screen: '#9fd6ff', badge: '#ff3b30', smoke: '190,180,175',
  sign: '#e8c34a', signDark: '#b8862a', plant: '#3f7a4a', pot: '#a8552e', shoe: '#1a1414', cheek: 'rgba(240,110,110,.35)',
  // flashback: the fishing village at dawn, Bà Năm as a girl
  dawn1: '#f2b880', dawn2: '#f6dcb0', sun: '#f6e27a', sea: '#3d6e8a', seaLight: '#8ab8c8', sand: '#e2c48e', boat: '#6a8a5a', boatTrim: '#c0483a',
  boatEye: '#f4efe2', basket: '#b8864a', basketLine: '#7a5428', fish: '#9ab0b8', pole: '#8a6a3a', skinBa: '#e2b07c', hairBa: '#1c1418', shirtBa: '#e9e2d0', pantsBa: '#1e1a1c', scarf: '#b8382c',
};

const FOLK = {
  ink: '#16110e', hairUt: '#16110e', pantsUt: '#2c4a6e', apron: '#b8382c', apronDark: '#8e2a20', lanyard: '#2c4a6e',
  shirtSau: '#2c4a6e', patternSau: '#efe4cc', pantsSau: '#16110e', sky1: '#2c3e5c', sky2: '#2c3e5c', wallA: '#d8b45a', wallB: '#b85440',
  door: '#16110e', window: '#4f7a4a', windowLight: '#efe4cc', notice: '#efe4cc', noticeRed: '#b8382c', noticeText: '#16110e', ground: '#5a4a32',
  groundLine: '#16110e', bulbOn: '#f2d27a', bulbOff: '#5a4a32', cartBody: '#3a3a3a', cartDark: '#16110e', stool: '#b8382c', postcard: '#efe4cc',
  stamp: '#b8382c', sign: '#d9a521', plant: '#4f7a4a', pot: '#8e4a2a', cat: '#16110e', catEye: '#d9a521',
  dawn1: '#e0a060', dawn2: '#efe4cc', sun: '#d9a521', sea: '#2c4a6e', seaLight: '#6a8aa8', sand: '#d8b45a', boat: '#4f7a4a', boatTrim: '#b8382c',
  boatEye: '#efe4cc', basket: '#a8743a', fish: '#7a9aa8', pole: '#7a5428', shirtBa: '#efe4cc', pantsBa: '#16110e', scarf: '#b8382c',
};

export const STYLES = {
  // #106 comparison: A = 1 for the present (warmer, a hint of paper) + 4 for Bà Năm's past; B = one fused style
  flatWarm: {
    id: 'flatWarm', outline: { color: '#2a1a22', width: 2 }, head: 1.05, eyesWhite: true, cheeks: true, paper: 0.035,
    palette: { ...BASE, wallA: '#6e4a40', wallB: '#5a3a3e', sky1: '#2e1e30', sky2: '#5a3438', sign: '#e8b84a', apron: '#e06a2c' },
  },
  fusion: {
    id: 'fusion', outline: { color: '#1e1612', width: 2.3 }, head: 1.08, eyesWhite: true, cheeks: true, paper: 0.05, diep: true, flatSky: true,
    palette: { ...BASE, ...FOLK, ink: '#1e1612', shirtUt: '#f2ead8', skinUt: '#eec396' },
  },
  flat: { id: 'flat', outline: { color: '#2a1a22', width: 2 }, palette: BASE, head: 1.05, eyesWhite: true, cheeks: true },
  toy: {
    id: 'toy', outline: null, shade: 'toy', head: 1.55, legs: 0.68, limbs: 1.4, body: 1.12, eyesWhite: true, eyeShine: true, cheeks: true,
    palette: { ...BASE, skinUt: '#ffcfa6', shirtUt: '#ffffff', apron: '#ff8a3d', apronDark: '#e2662a', shirtSau: '#9a5cc0', patternSau: '#ffd0f0', cat: '#26222c', wallA: '#7a5060', wallB: '#664058', sky1: '#3a2550', sky2: '#6a3a5a', cartBody: '#5a5668', stool: '#ff4236', ground: '#3a2a34' },
  },
  cutout: {
    id: 'cutout', outline: null, shade: 'cutout', head: 1.12, wobble: true, paper: 0.07, cutEdge: '#f7efdf',
    palette: { ...BASE, skinUt: '#eab894', shirtUt: '#f2ece0', apron: '#d8692e', apronDark: '#b8541f', shirtSau: '#6e4a86', patternSau: '#e2b6d6', sky1: '#2c2440', sky2: '#4e3448', wallA: '#8a5a48', wallB: '#6e4a4e', door: '#3a2a2a', ground: '#3a2e2a', groundLine: '#4a3c34', cartBody: '#4a4652', notice: '#f2ead8', stool: '#cc3a2e' },
  },
  dongho: {
    id: 'dongho', outline: { color: '#16110e', width: 2.6 }, shade: 'print', head: 1.08, paper: 0.08, diep: true, flatSky: true,
    palette: {
      ...BASE, ...FOLK, ink: '#16110e', skinUt: '#e9c08a', hairUt: '#16110e', shirtUt: '#efe4cc', pantsUt: '#2c4a6e', apron: '#b8382c', apronDark: '#8e2a20',
      lanyard: '#2c4a6e', skinSau: '#d9a86e', hairSau: '#7a7268', shirtSau: '#2c4a6e', patternSau: '#efe4cc', pantsSau: '#16110e',
      sky1: '#2c3e5c', sky2: '#2c3e5c', wallA: '#d8b45a', wallB: '#b85440', door: '#16110e', window: '#4f7a4a', windowLight: '#efe4cc',
      notice: '#efe4cc', noticeRed: '#b8382c', noticeText: '#16110e', ground: '#5a4a32', groundLine: '#16110e', bulbOn: '#f2d27a', bulbOff: '#5a4a32',
      cartBody: '#3a3a3a', cartDark: '#16110e', stool: '#b8382c', postcard: '#efe4cc', stamp: '#b8382c', sign: '#d9a521', plant: '#4f7a4a', pot: '#8e4a2a', cat: '#16110e', catEye: '#d9a521',
    },
  },
  lacquer: {
    id: 'lacquer', outline: { color: 'rgba(214,168,72,.75)', width: 0.9 }, shade: 'lacquer', head: 1.05, crackle: ['shirtUt', 'notice', 'postcard', 'card'], gold: true,
    palette: {
      ...BASE, ink: '#0c0806', skinUt: '#d9a35a', hairUt: '#0c0806', shirtUt: '#efe6d2', pantsUt: '#2a1a12', apron: '#a82a18', apronDark: '#7a1c10',
      lanyard: '#c8961e', skinSau: '#c88e4a', hairSau: '#8a7a62', shirtSau: '#5a1e14', patternSau: '#e8c26a', pantsSau: '#1a100c',
      sky1: '#0c0806', sky2: '#1a0e08', wallA: '#3a1a10', wallB: '#2a120c', door: '#0c0806', window: '#5a3a14', windowLight: '#e8c26a',
      notice: '#efe6d2', noticeRed: '#a82a18', noticeText: '#5a4a32', ground: '#120a06', groundLine: '#3a2410', bulbOn: '#f2d27a', bulbOff: '#4a3418', glow: '232,186,90',
      cartBody: '#2a1a12', cartDark: '#140c08', cartPole: '#5a3a1a', wheel: '#0c0806', hub: '#c8961e', stool: '#a82a18', postcard: '#efe6d2', stamp: '#a82a18',
      fan: '#c8961e', fanLine: '#7a5a1a', sign: '#c8961e', signDark: '#7a5a1a', plant: '#3a4a1a', pot: '#7a2a14', cat: '#0c0806', catEye: '#f2d27a', cheek: 'rgba(0,0,0,0)',
    },
  },
};

const ORDER = ['flat', 'toy', 'cutout', 'dongho', 'lacquer'];
const CMP = ['flatWarm', 'dongho', 'fusion']; // ?v-cmp=1..3 (#106 comparison sheet)
export const style = () => STYLES[variant('cmp') ? CMP[variant('cmp') - 1] : ORDER[(variant('art') || 1) - 1]] ?? STYLES.flat;

export const col = (key) => style().palette[key] ?? key;

/** Lighten (+) / darken (-) a #rrggbb colour. */
export function tone(hex, amt) {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}

// deterministic noise for textures (stills must match between runs)
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function crackle(ctx, path, seed) {
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = 'rgba(90,70,40,.45)';
  ctx.lineWidth = 0.5;
  const r = rnd(seed);
  for (let i = 0; i < 40; i++) {
    const x = r() * 240 - 120, y = r() * 240 - 160;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + r() * 9 - 4.5, y + r() * 9 - 4.5);
    ctx.lineTo(x + r() * 9 - 4.5, y + r() * 9 - 4.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** Fill a Path2D in the current style. `key`: a palette key or a colour. */
export function shape(ctx, path, key, { line = true } = {}) {
  const S = style();
  const c = col(key);
  ctx.save();
  if (S.shade === 'cutout') {
    ctx.shadowColor = 'rgba(25,12,8,.5)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.shadowBlur = 3;
    // the scissor edge: a cream rim around every cut piece (half of it shows outside the fill); walls / details without
    // a line stay plain
    if (line) {
      ctx.strokeStyle = S.cutEdge;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.stroke(path);
    }
    ctx.shadowColor = 'transparent';
  }
  if (S.shade === 'print') {
    // off-register colour block under the black key line
    ctx.save();
    ctx.translate(1.3, 0.9);
    ctx.fillStyle = c;
    ctx.fill(path);
    ctx.restore();
  } else if (S.shade === 'toy') {
    ctx.fillStyle = tone(c, -0.22);
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    ctx.translate(-1.4, -2);
    ctx.fillStyle = c;
    ctx.fill(path);
    ctx.translate(-1.2, -1.6);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fill(path);
    ctx.restore();
  } else {
    ctx.fillStyle = c;
    ctx.fill(path);
  }
  ctx.restore();
  if (S.crackle?.includes(key)) crackle(ctx, path, key.length * 977);
  if (line && S.outline) {
    ctx.strokeStyle = S.outline.color;
    ctx.lineWidth = S.outline.width;
    ctx.lineJoin = 'round';
    ctx.stroke(path);
  }
}

/** Stroke a thick line (limbs, poles, the cat's tail) in the current style. */
export function stroke(ctx, path, key, width) {
  const S = style();
  const c = col(key);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (S.shade === 'cutout') {
    ctx.shadowColor = 'rgba(25,12,8,.5)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.shadowBlur = 3;
  }
  if (S.outline && S.shade !== 'lacquer') {
    ctx.strokeStyle = S.outline.color;
    ctx.lineWidth = width + S.outline.width * 2;
    ctx.stroke(path);
  }
  if (S.shade === 'print') ctx.translate(1.3, 0.9);
  if (S.shade === 'toy') {
    ctx.strokeStyle = tone(c, -0.22);
    ctx.lineWidth = width;
    ctx.stroke(path);
    ctx.translate(-0.8, -1.2);
    ctx.strokeStyle = c;
    ctx.lineWidth = width * 0.7;
    ctx.stroke(path);
  } else {
    if (S.shade === 'lacquer') {
      ctx.strokeStyle = S.outline.color;
      ctx.lineWidth = width + 1.6;
      ctx.stroke(path);
    }
    ctx.strokeStyle = c;
    ctx.lineWidth = width;
    ctx.stroke(path);
  }
  ctx.restore();
}

let grain = null;
function grainPattern(ctx) {
  if (grain) return grain;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const r = rnd(7);
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 205 + r() * 50;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // paper fibres
  g.strokeStyle = 'rgba(90,70,50,.35)';
  for (let i = 0; i < 40; i++) {
    const x = r() * 128, y = r() * 128;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + r() * 10, y + r() * 6, x + r() * 18 - 4, y + r() * 10 - 5);
    g.stroke();
  }
  grain = ctx.createPattern(cv, 'repeat');
  return grain;
}

/** Screen-space finish over a painted region: paper grain, điệp sparkle, lacquer sheen. */
export function overlay(ctx, w, h, t) {
  const S = style();
  if (S.paper) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = S.paper * 2.2;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (S.diep) {
    // giấy điệp: crushed shell glints in the paper
    const r = rnd(11);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < (w * h) / 900; i++) {
      const x = r() * w, y = r() * h, a = 0.25 + 0.35 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.fillStyle = `rgba(255,250,235,${a * 0.5})`;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    ctx.restore();
  }
  if (S.gold) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,220,140,0)');
    g.addColorStop(0.45, 'rgba(255,220,140,.10)');
    g.addColorStop(0.55, 'rgba(255,220,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}
