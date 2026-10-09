// Art direction (#106, owner pick A): one set of shapes (rig.js, scene.js), two ways to paint them.
//   present   flat cartoon, dark outline, warm palette with a few folk accents and a faint paper grain: Út's story
//   past      Đông Hồ woodblock print: thick black key line, flat folk colours slightly off-register, điệp paper with
//             crushed-shell glints: Bà Năm's past (flashbacks, old photos, postcards, recipe pages)
// The switch between them tells the player "this is her past" without words. Every shape goes through shape() /
// stroke(), which apply the palette, outline and shading; overlay() adds the screen-space paper finish.

const BASE = {
  ink: '#1a1416', skinUt: '#f0c49c', hairUt: '#1c1418', shirtUt: '#f4f1ec', pantsUt: '#2c2f3e', apron: '#e8742c', apronDark: '#c55a1c',
  lanyard: '#2f6fd6', card: '#ffffff', skinSau: '#d9a47c', hairSau: '#8d8790', shirtSau: '#7a4a8c', patternSau: '#e9b4d8', pantsSau: '#3a2a30',
  cat: '#121014', catEye: '#ffd23c', sky1: '#2a1b33', sky2: '#4a2c3a', wallA: '#5b3d45', wallB: '#4c3440', door: '#2c1c24',
  window: '#3a6a5a', windowLight: '#ffd9a0', notice: '#f4efe2', noticeRed: '#c8302a', noticeText: '#8a8478', ground: '#2a1f24', groundLine: '#3a2c30',
  wire: '#1a1014', bulbOn: '#ffe2a0', bulbOff: '#5a4a40', glow: '255,200,110', cartBody: '#3e3a44', cartDark: '#2a262e', cartPole: '#6a4a32',
  coalHot: '255,120,30', wheel: '#18141a', hub: '#9aa3ad', stool: '#d8312a', postcard: '#fdf3dc', stamp: '#d2483a', postLine: '#7c6a58',
  fan: '#d8b06a', fanLine: '#9c7436', fanHandle: '#7a5428', phone: '#15151c', screen: '#9fd6ff', badge: '#ff3b30', smoke: '190,180,175',
  sign: '#e8c34a', signDark: '#b8862a', plant: '#3f7a4a', pot: '#a8552e', shoe: '#1a1414', cheek: 'rgba(240,110,110,.35)',
  // guests at the counter (#116): strangers with their own looks, so nobody mistakes them for the story's cast
  skinG1: '#f2c8a0', hairG1: '#201818', shirtG1: '#f6f6f2', pantsG1: '#2d4f8a', bagG1: '#2f3d6a',
  skinG2: '#c98a5c', hairG2: '#1c1414', shirtG2: '#3f8a4a', pantsG2: '#3a3a40', helmetG2: '#f2c230',
  skinG3: '#f4cfae', hairG3: '#3a2418', shirtG3: '#e88aa8', pantsG3: '#2a2a32',
  skinG4: '#b98058', hairG4: '#1a1414', shirtG4: '#8a9098', pantsG4: '#4a3f30', capG4: '#2f6fd6',
  skinG5: '#d9a47c', hairG5: '#c9c4bc', shirtG5: '#7a5a3a', pantsG5: '#5a5248',
  // Fishing Village guests: a fish seller in a nón lá, a young fisherman with a towel on his head, a child in a sun
  // hat, an old fisherman in a bucket hat, a village woman
  skinB1: '#c99068', hairB1: '#1c1414', shirtB1: '#8a6a4a', pantsB1: '#1e1a1c', hatB1: '#e6d29a',
  skinB2: '#a86a42', hairB2: '#141010', shirtB2: '#f2f0ea', pantsB2: '#3a5a7a', towelB2: '#d9e6ea',
  skinB3: '#e2a87a', hairB3: '#201818', shirtB3: '#f2a33a', pantsB3: '#3a6a9a', hatB3: '#f4e8c8',
  skinB4: '#a0663e', hairB4: '#d0ccc4', shirtB4: '#5a7a6a', pantsB4: '#5a5040', hatB4: '#7a8a5a',
  skinB5: '#d29a6e', hairB5: '#1c1414', shirtB5: '#3f8a6a', patternB5: '#f2e6b0', pantsB5: '#2a2a32',
  steel1: '#e8ecee', steel2: '#aab1b6', steelDark: '#6e767b', rust: '#9a4a22', rustDark: '#6a3014', glass: '#cfe8ec',
  // flashback: the fishing village at dawn, Bà Năm as a girl
  // the rest of the cast
  skinKhang: '#e2b48c', hairKhang: '#141014', chef: '#fafafa', pantsKhang: '#1c1c22', skinTu: '#b8784a', hairTu: '#5a5450', shirtTu: '#5a86a0', pantsTu: '#6a5a44',
  skinA: '#c89068', hairA: '#9a9490', shirtA: '#f4f1ec', pantsA: '#4a4a5a', skinB: '#f0c8a0', hairB: '#2a1a1a', shirtB: '#e9e2f0', pantsB: '#3a4a7a',
  notebook: '#c8a070', page: '#fbf3e0', flyer: '#ffffff', flyerBlue: '#2f6fd6', plate: '#f4f1ec', dawnSky1: '#f2b880', dawnSky2: '#9ab0c8',
  stormSky1: '#3e4652', stormSky2: '#7a8490', stormSea: '#2a3e4e', rain: 'rgba(210,225,235,.45)', lantern: '#c8302a', lanternCap: '#d9a521',
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
  present: {
    id: 'present', outline: { color: '#2a1a22', width: 2 }, head: 1.05, eyesWhite: true, cheeks: true, paper: 0.035, cel: true, shine: true,
    palette: { ...BASE, wallA: '#6e4a40', wallB: '#5a3a3e', sky1: '#2e1e30', sky2: '#5a3438', sign: '#e8b84a', apron: '#e06a2c', stool: '#c8342a' },
  },
  past: {
    id: 'past', outline: { color: '#16110e', width: 2.6 }, shade: 'print', head: 1.08, paper: 0.08, diep: true, flatSky: true,
    palette: { ...BASE, ...FOLK, skinUt: '#e9c08a', shirtUt: '#efe4cc', skinSau: '#d9a86e', hairSau: '#7a7268', skinBa: '#e9c08a' },
  },
};

let current = 'present';
/** The style the next drawing uses ('present' | 'past'). */
export const setStyle = (id) => {
  current = STYLES[id] ? id : 'present';
};
export const style = () => STYLES[current];

export const col = (key) => style().palette[key] ?? key;

// deterministic noise for textures (stills must match between runs)
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/** Fill a Path2D in the current style. `key`: a palette key or a colour; `line: false` = no outline. */
export function shape(ctx, path, key, { line = true } = {}) {
  const S = style();
  ctx.save();
  // past: the colour block is printed slightly off-register from the black key line
  if (S.shade === 'print') ctx.translate(1.3, 0.9);
  ctx.fillStyle = col(key);
  ctx.fill(path);
  if (S.cel && line) {
    // one cel-shadow tone: the shape shifted up-left, so a crescent of shade stays along its lower right edge
    ctx.clip(path);
    ctx.fillStyle = 'rgba(40,12,40,.2)';
    ctx.fill(path);
    ctx.translate(-2.2, -2.6);
    ctx.fillStyle = col(key);
    ctx.fill(path);
  }
  ctx.restore();
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
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (S.outline) {
    ctx.strokeStyle = S.outline.color;
    ctx.lineWidth = width + S.outline.width * 2;
    ctx.stroke(path);
  }
  if (S.shade === 'print') ctx.translate(1.3, 0.9);
  ctx.strokeStyle = col(key);
  ctx.lineWidth = width;
  ctx.stroke(path);
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

/** Screen-space finish over a painted region: paper grain (both), điệp glints (past). */
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
}
