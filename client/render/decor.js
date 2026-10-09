// Theme art prototypes (#95, design/variants): Vietnamese detail around the board, behind `?variant=1..5`
// (client/ui/variant.js). Each variant is a recipe per theme: a surface under the grills (the table or the ground),
// an optional overlay (shadows of power lines, a tin roof), a few code-drawn props in the margins beside the board,
// and light tweaks. Presentation only. Once the owner picks, the pick moves into theme.json data and this switch goes.
import * as THREE from 'three';
import { mulberry32 } from '../../shared/rng.js';
import { variantFrom } from '../ui/variant.js';

// read from the URL here: the stage is built before boot() runs initVariant()
const pageVariant = () => variantFrom(globalThis.location?.search);

const TABLE_Y = -0.36;

function canvasTex(w, h, draw, repeat = 1, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

const grime = (g, w, h, rng, n = 900, dark = '30,24,20', light = '255,245,230', a = 0.06) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${rng() < 0.6 ? dark : light},${rng() * a})`;
    const r = 1 + rng() * 5;
    g.fillRect(rng() * w, rng() * h, r, r);
  }
};

// ---------------------------------------------------------------- surfaces

/** Gạch bông: the patterned cement tiles of an old Saigon sidewalk / shophouse floor. */
const gachBong = (dim = 1) =>
  canvasTex(512, 512, (g, W) => {
    const rng = mulberry32(7);
    const T = W / 4;
    const C = { base: '#b9ab92', red: '#86453a', teal: '#46685f', ink: '#2e2a26', ochre: '#a88a52' };
    for (let ty = 0; ty < 4; ty++)
      for (let tx = 0; tx < 4; tx++) {
        g.save();
        g.translate(tx * T, ty * T);
        g.fillStyle = C.base;
        g.fillRect(0, 0, T, T);
        // quarter flowers in the corners: four tiles make one rosette
        g.fillStyle = C.red;
        for (const [cx, cy] of [[0, 0], [T, 0], [0, T], [T, T]]) {
          g.beginPath();
          g.arc(cx, cy, T * 0.3, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = C.ochre;
        for (const [cx, cy] of [[0, 0], [T, 0], [0, T], [T, T]]) {
          g.beginPath();
          g.arc(cx, cy, T * 0.14, 0, Math.PI * 2);
          g.fill();
        }
        // the centre: a teal diamond with four petals
        g.fillStyle = C.teal;
        g.beginPath();
        g.moveTo(T / 2, T * 0.2);
        g.lineTo(T * 0.8, T / 2);
        g.lineTo(T / 2, T * 0.8);
        g.lineTo(T * 0.2, T / 2);
        g.closePath();
        g.fill();
        g.fillStyle = C.base;
        g.beginPath();
        g.arc(T / 2, T / 2, T * 0.1, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = C.ink;
        g.globalAlpha = 0.35;
        g.lineWidth = 2;
        g.strokeRect(T * 0.06, T * 0.06, T * 0.88, T * 0.88);
        g.globalAlpha = 1;
        // grout
        g.fillStyle = 'rgba(40,34,28,.55)';
        g.fillRect(0, 0, T, 2);
        g.fillRect(0, 0, 2, T);
        g.restore();
      }
    grime(g, W, W, rng, 2500, '40,30,24', '255,250,235', 0.09);
    if (dim < 1) {
      g.fillStyle = `rgba(20,14,12,${1 - dim})`;
      g.fillRect(0, 0, W, W);
    }
  }, 9);

/** The top of a stainless street cart: brushed, dented, a few rust spots. */
const steel = () =>
  canvasTex(512, 512, (g, W) => {
    const rng = mulberry32(13);
    g.fillStyle = '#7c8288';
    g.fillRect(0, 0, W, W);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(${rng() < 0.5 ? '40,44,50' : '255,255,255'},${rng() * 0.07})`;
      g.fillRect(0, rng() * W, W, 1);
    }
    for (let i = 0; i < 8; i++) {
      const x = rng() * W, y = rng() * W, r = 14 + rng() * 30;
      const d = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      d.addColorStop(0, 'rgba(255,255,255,.25)');
      d.addColorStop(0.6, 'rgba(30,30,40,.18)');
      d.addColorStop(1, 'rgba(30,30,40,0)');
      g.fillStyle = d;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 12; i++) {
      const x = rng() * W, y = rng() * W;
      g.fillStyle = `rgba(${rng() < 0.5 ? '150,70,30' : '110,50,25'},${0.25 + rng() * 0.3})`;
      g.beginPath();
      g.ellipse(x, y, 3 + rng() * 9, 2 + rng() * 5, rng() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,.2)';
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      const x = rng() * W, y = rng() * W;
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 12);
      g.stroke();
    }
    // the seams between the sheets
    g.fillStyle = 'rgba(30,30,36,.45)';
    g.fillRect(0, W / 2, W, 3);
    g.fillRect(W / 2, 0, 3, W);
  }, 8);

/** The alley at night: worn cement, cracks, a stain, a drain cover. */
const cement = () =>
  canvasTex(512, 512, (g, W) => {
    const rng = mulberry32(17);
    g.fillStyle = '#58534d';
    g.fillRect(0, 0, W, W);
    grime(g, W, W, rng, 4000, '20,18,16', '200,190,175', 0.12);
    for (let i = 0; i < 4; i++) {
      const x = rng() * W, y = rng() * W, r = 40 + rng() * 70;
      const s = g.createRadialGradient(x, y, 2, x, y, r);
      s.addColorStop(0, 'rgba(20,16,14,.35)');
      s.addColorStop(1, 'rgba(20,16,14,0)');
      g.fillStyle = s;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.strokeStyle = 'rgba(20,16,14,.6)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      let x = rng() * W, y = rng() * W;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) g.lineTo((x += (rng() - 0.5) * 50), (y += (rng() - 0.3) * 30));
      g.stroke();
    }
    // expansion joints of the poured slab
    g.fillStyle = 'rgba(15,12,10,.5)';
    g.fillRect(0, W * 0.5, W, 3);
  }, 10);

/** A quán's plastic tablecloth: faded roses on cream, a fold line. */
const tablecloth = () =>
  canvasTex(512, 512, (g, W) => {
    const rng = mulberry32(19);
    g.fillStyle = '#d4c3ab';
    g.fillRect(0, 0, W, W);
    // a thin check under the flowers
    g.fillStyle = 'rgba(190,70,70,.12)';
    for (let i = 0; i < W; i += 32) {
      g.fillRect(i, 0, 12, W);
      g.fillRect(0, i, W, 12);
    }
    for (let i = 0; i < 18; i++) {
      const x = ((i % 6) + (Math.floor(i / 6) % 2) * 0.5) * (W / 6) + 30, y = Math.floor(i / 6) * (W / 3) + 60;
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        g.fillStyle = 'rgba(200,70,80,.55)';
        g.beginPath();
        g.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 9, 6, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgba(230,180,70,.8)';
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(80,140,80,.55)';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(x + s * 20, y + 12, 10, 4, s * 0.6, 0, Math.PI * 2);
        g.fill();
      }
    }
    grime(g, W, W, rng, 900, '60,30,20', '255,255,255', 0.06);
    g.fillStyle = 'rgba(255,255,255,.18)';
    g.fillRect(0, W * 0.33, W, 2);
  }, 12);

/** Fine wet / dry sand with ripples. */
const sand = (warm = 0) =>
  canvasTex(512, 512, (g, W) => {
    const rng = mulberry32(23);
    g.fillStyle = warm ? '#cfa978' : '#ccb084';
    g.fillRect(0, 0, W, W);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${rng() < 0.5 ? '120,90,50' : '255,250,235'},${rng() * 0.18})`;
      g.fillRect(rng() * W, rng() * W, 1.5, 1.5);
    }
    g.strokeStyle = 'rgba(120,90,50,.13)';
    g.lineWidth = 3;
    for (let y = 10; y < W; y += 22) {
      g.beginPath();
      for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + y) * 5);
      g.stroke();
    }
  }, 12);

/** Boat planks painted blue, the paint peeling to grey wood, one red stripe. */
const boatPlanks = () =>
  canvasTex(512, 512, (g, W) => {
    const rng = mulberry32(29);
    const n = 6, ph = W / n;
    for (let p = 0; p < n; p++) {
      g.fillStyle = p === 2 ? '#a8463c' : `hsl(${198 + rng() * 6}, ${42 + rng() * 10}%, ${40 + rng() * 6}%)`;
      g.fillRect(0, p * ph, W, ph);
      for (let i = 0; i < 9; i++) {
        g.fillStyle = `rgba(150,140,120,${0.35 + rng() * 0.3})`; // bare wood where the paint flaked off
        g.beginPath();
        g.ellipse(rng() * W, p * ph + rng() * ph, 4 + rng() * 22, 2 + rng() * 5, (rng() - 0.5) * 0.3, 0, Math.PI * 2);
        g.fill();
      }
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = `rgba(20,30,40,${0.05 + rng() * 0.08})`;
        g.beginPath();
        const y = p * ph + rng() * ph;
        g.moveTo(0, y);
        g.lineTo(W, y + (rng() - 0.5) * 4);
        g.stroke();
      }
      g.fillStyle = 'rgba(15,20,25,.6)';
      g.fillRect(0, p * ph, W, 3);
    }
  }, 9);

/** Bamboo slats (a phên tre table top). */
const bamboo = () =>
  canvasTex(512, 512, (g, W) => {
    const rng = mulberry32(31);
    const n = 16, sw = W / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = `hsl(${38 + rng() * 6}, ${45 + rng() * 10}%, ${58 + rng() * 8}%)`;
      g.fillRect(i * sw, 0, sw, W);
      g.fillStyle = 'rgba(255,255,255,.18)';
      g.fillRect(i * sw + 3, 0, 3, W);
      g.fillStyle = 'rgba(70,45,20,.4)';
      g.fillRect(i * sw, 0, 2, W);
      for (let k = 0; k < 2; k++) {
        const y = rng() * W; // the nodes
        g.fillStyle = 'rgba(110,75,35,.45)';
        g.fillRect(i * sw, y, sw, 4);
      }
    }
  }, 10);

// ---------------------------------------------------------------- overlays (transparent planes on the surface)

/** Shadows of the tangled power lines overhead. */
const wireShadows = () =>
  canvasTex(1024, 1024, (g, W) => {
    const rng = mulberry32(37);
    g.strokeStyle = 'rgba(0,0,0,.42)';
    for (let i = 0; i < 26; i++) {
      g.lineWidth = 1.5 + rng() * 3;
      const y0 = rng() * W, y1 = y0 + (rng() - 0.5) * W * 0.6, sag = 40 + rng() * 120;
      g.beginPath();
      g.moveTo(-20, y0);
      g.bezierCurveTo(W * 0.3, y0 + sag, W * 0.7, y1 + sag, W + 20, y1);
      g.stroke();
    }
    // a knot of wires around a pole's bracket
    for (let i = 0; i < 14; i++) {
      g.lineWidth = 1 + rng() * 2;
      g.beginPath();
      g.ellipse(W * 0.82, W * 0.2, 20 + rng() * 50, 10 + rng() * 25, rng() * 3, 0, Math.PI * 2);
      g.stroke();
    }
  }, 1, false);

/** Shade of a corrugated tin roof: soft stripes, a bright band of low sun at one edge. */
const roofShade = () =>
  canvasTex(512, 512, (g, W) => {
    for (let x = 0; x < W; x++) {
      const a = 0.24 + 0.16 * Math.sin((x / W) * Math.PI * 2 * 16);
      g.fillStyle = `rgba(40,20,10,${a})`;
      g.fillRect(x, 0, 1, W);
    }
  }, 1, false);

/** A fishing net (diamond mesh), transparent between the cords. */
const netTex = () =>
  canvasTex(256, 256, (g, W) => {
    g.strokeStyle = 'rgba(40,70,80,.85)';
    g.lineWidth = 2;
    const s = 32;
    for (let i = -W; i < W * 2; i += s) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + W, W);
      g.stroke();
      g.beginPath();
      g.moveTo(i, W);
      g.lineTo(i + W, 0);
      g.stroke();
    }
    g.fillStyle = 'rgba(40,70,80,.9)';
    for (let x = 0; x <= W; x += s / 2) for (let y = (x / (s / 2)) % 2 ? s / 2 : 0; y <= W; y += s) g.fillRect(x - 2, y - 2, 4, 4);
  }, 3);

/** Woven bamboo strips (the hand fan, the basket boat). */
const weave = (a = '#c9a15e', b = '#a57c3c', n = 12) =>
  canvasTex(256, 256, (g, W) => {
    const s = W / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const over = (x + y) % 2 === 0;
        g.fillStyle = over ? a : b;
        g.fillRect(x * s, y * s, s, s);
        g.fillStyle = 'rgba(0,0,0,.18)';
        if (over) g.fillRect(x * s, y * s + s - 2, s, 2);
        else g.fillRect(x * s + s - 2, y * s, 2, s);
      }
  }, 2);

// ---------------------------------------------------------------- props

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
const shadowed = (m) => ((m.castShadow = true), (m.receiveShadow = true), m);

/** Trà đá in a dented plastic cup: amber tea, ice on top, a straw. */
function teaCup() {
  const g = new THREE.Group();
  const cup = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.2, 0.62, 18, 1, true), std({ color: '#e9dcc4', transparent: true, opacity: 0.55, roughness: 0.3, side: THREE.DoubleSide })));
  cup.scale.x = 0.9; // a dent
  cup.position.y = 0.31;
  const tea = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.19, 0.52, 18), std({ color: '#b5651d', roughness: 0.25 }));
  tea.position.y = 0.27;
  tea.scale.x = 0.9;
  g.add(cup, tea);
  const rng = mulberry32(3);
  for (let i = 0; i < 4; i++) {
    const ice = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.13), std({ color: '#eaf6ff', transparent: true, opacity: 0.85, roughness: 0.1 }));
    ice.position.set((rng() - 0.5) * 0.22, 0.54, (rng() - 0.5) * 0.22);
    ice.rotation.set(rng(), rng(), rng());
    g.add(ice);
  }
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8), std({ color: '#e23b3b' }));
  straw.position.set(0.06, 0.62, 0);
  straw.rotation.z = -0.35;
  g.add(straw);
  return g;
}

/** A small bowl of muối ớt chanh with a lime wedge. */
function saltBowl() {
  const g = new THREE.Group();
  const bowl = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.18, 0.16, 20), std({ color: '#f4f1ea', roughness: 0.35 })));
  bowl.position.y = 0.08;
  const salt = new THREE.Mesh(new THREE.CircleGeometry(0.26, 20), std({ color: '#e59a6a' }));
  salt.rotation.x = -Math.PI / 2;
  salt.position.y = 0.162;
  const lime = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI), std({ color: '#7bbf3a', roughness: 0.5 }));
  lime.position.set(0.08, 0.2, 0.02);
  lime.rotation.set(-Math.PI / 2, 0, 0.4);
  g.add(bowl, salt, lime);
  return g;
}

/** Quạt nan: the woven bamboo fan the vendor waves over the coals. */
function fan() {
  const g = new THREE.Group();
  const leaf = shadowed(new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), std({ map: weave(), roughness: 0.8, side: THREE.DoubleSide })));
  leaf.rotation.x = -Math.PI / 2;
  leaf.scale.set(1, 0.82, 1);
  leaf.position.y = 0.05;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 6, 28), std({ color: '#6b4a24' }));
  rim.rotation.x = -Math.PI / 2;
  rim.scale.set(1, 0.82, 1);
  rim.position.y = 0.05;
  const handle = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.7), std({ color: '#8a6232' })));
  handle.position.set(0, 0.05, 0.78);
  g.add(leaf, rim, handle);
  return g;
}

/** Than tổ ong: a honeycomb coal briquette; `glow` = burning (embers in the holes). */
function briquette(glow = false) {
  const top = canvasTex(128, 128, (g, W) => {
    g.fillStyle = glow ? '#4a3a34' : '#2e2a28';
    g.fillRect(0, 0, W, W);
    const holes = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos((i / 6) * Math.PI * 2) * 0.32, Math.sin((i / 6) * Math.PI * 2) * 0.32]), ...Array.from({ length: 12 }, (_, i) => [Math.cos((i / 12) * Math.PI * 2 + 0.26) * 0.64, Math.sin((i / 12) * Math.PI * 2 + 0.26) * 0.64])];
    for (const [x, y] of holes) {
      g.fillStyle = glow ? '#ff7a1a' : '#0c0a09';
      g.beginPath();
      g.arc(W / 2 + (x * W) / 2.4, W / 2 + (y * W) / 2.4, W * 0.055, 0, Math.PI * 2);
      g.fill();
    }
  });
  const mats = [std({ color: glow ? '#5a4a44' : '#3a3634', roughness: 0.95 }), std({ map: top, emissive: glow ? '#ffffff' : '#000000', emissiveMap: glow ? top : null, emissiveIntensity: glow ? 0.6 : 0 }), std({ color: '#222' })];
  const m = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 24), mats));
  m.position.y = 0.25;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

/** A red plastic stool (ghế nhựa đỏ), seen from above: the square seat with its grip slot, four splayed legs. */
function stool(color = '#d8322e') {
  const g = new THREE.Group();
  const mat = std({ color, roughness: 0.45 });
  const seatTex = canvasTex(128, 128, (c, W) => {
    c.fillStyle = color;
    c.fillRect(0, 0, W, W);
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.beginPath();
    c.roundRect(W * 0.35, W * 0.46, W * 0.3, W * 0.08, 6);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.18)';
    c.lineWidth = 3;
    c.strokeRect(W * 0.08, W * 0.08, W * 0.84, W * 0.84);
  });
  const seat = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), [mat, mat, std({ map: seatTex, roughness: 0.45 }), mat, mat, mat]));
  seat.position.y = 0.62;
  g.add(seat);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.12), mat));
    leg.position.set(x * 0.4, 0.31, z * 0.4);
    leg.rotation.set(z * 0.12, 0, -x * 0.12);
    g.add(leg);
  }
  return g;
}

/** Thúng chai: the round woven basket boat, tarred dark, a rim of bamboo. */
function basketBoat(r = 1.5) {
  const g = new THREE.Group();
  const hull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std({ map: weave('#4a3424', '#35251a', 20), side: THREE.DoubleSide, roughness: 0.9 })));
  hull.scale.y = 0.38;
  hull.position.y = r * 0.38;
  const rim = shadowed(new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 8, 40), std({ color: '#a0814f' })));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = r * 0.38;
  const oar = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, r * 1.7), std({ color: '#8a6a40' })));
  oar.position.set(r * 0.2, r * 0.3, 0);
  oar.rotation.y = 0.5;
  g.add(hull, rim, oar);
  return g;
}

/** Net floats (phao): orange and white balls on a cord. */
function floats(n = 4) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const b = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), std({ color: i % 2 ? '#f2efe6' : '#f07a2a', roughness: 0.4 })));
    b.position.set(i * 0.38, 0.17, Math.sin(i) * 0.12);
    g.add(b);
  }
  return g;
}

/** A piece of drying net, draped flat, floats on its edge. */
function netPatch(w = 2.4, d = 3.2) {
  const g = new THREE.Group();
  const t = netTex();
  t.repeat.set(w / 0.9, d / 0.9);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.9 }));
  net.rotation.x = -Math.PI / 2;
  net.position.y = 0.02;
  net.receiveShadow = true;
  const f = floats(Math.max(2, Math.round(w / 0.5)));
  f.position.set(-w / 2 + 0.2, 0, -d / 2);
  g.add(net, f);
  return g;
}

/** A few shells on the sand. */
function shells() {
  const g = new THREE.Group();
  const rng = mulberry32(41);
  for (let i = 0; i < 5; i++) {
    const s = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: ['#f3e3d3', '#e8b8a0', '#f6efe4'][i % 3], roughness: 0.4 })));
    s.scale.set(1, 0.5, 1.3);
    s.position.set((rng() - 0.5) * 1.2, 0, (rng() - 0.5) * 1.2);
    s.rotation.y = rng() * 3;
    g.add(s);
  }
  return g;
}

/** A blue plastic bucket of ice (the catch kept cold). */
function bucket() {
  const g = new THREE.Group();
  const b = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.36, 0.7, 20, 1, true), std({ color: '#2d78b8', side: THREE.DoubleSide, roughness: 0.5 })));
  b.position.y = 0.35;
  const ice = new THREE.Mesh(new THREE.CircleGeometry(0.43, 20), std({ color: '#e6f4fb', roughness: 0.2 }));
  ice.rotation.x = -Math.PI / 2;
  ice.position.y = 0.6;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 6, 24), std({ color: '#2a6aa0' }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.7;
  g.add(b, ice, rim);
  return g;
}

// ---------------------------------------------------------------- recipes

// `at`: [side, u, gap]: left / right of the board (u = 0 far … 1 near), far / near (u = 0 left … 1 right); gap = world
// units between the board's edge and the prop's centre. Props past the visible edge are simply cut off by the frame.
const P = (make, side, u, gap, rot = 0, scale = 1) => ({ make, at: [side, u, gap], rot, scale });

const LATE_SUN = { lights: { sky: '#ffe0b8', key: '#ffc890', rim: '#ff9a60', keyIntensity: 2.3, exposure: 1.05 }, palette: { background: '#e8a070', vignette: '#7a4a38' } };

const RECIPES = {
  street_bbq: {
    // 1: the sidewalk itself: grills on gạch bông, red stools around, iced tea on the floor
    1: { surface: () => gachBong(0.4), props: [P(stool, 'left', 0.25, 0.85), P(stool, 'right', 0.7, 0.85, 0.3), P(teaCup, 'left', 0.75, 0.6), P(teaCup, 'right', 0.2, 0.55), P(() => briquette(true), 'right', 0.42, 0.6)] },
    // 2: today's wood, with the stall's things on it: woven fan, honeycomb coal, iced tea, salt-chili-lime
    2: { props: [P(fan, 'left', 0.3, 0.8, 0.4), P(() => briquette(true), 'right', 0.25, 0.6), P(() => briquette(false), 'right', 0.48, 0.6), P(teaCup, 'left', 0.78, 0.55), P(saltBowl, 'right', 0.78, 0.55)] },
    // 3: the cart's stainless top, dented and spotted with rust
    3: { surface: steel, lights: { exposure: 0.95 }, props: [P(teaCup, 'left', 0.2, 0.55), P(saltBowl, 'left', 0.62, 0.5), P(fan, 'right', 0.5, 0.8, -0.5)] },
    // 4: the alley at night: bare cement, the power lines' tangle cast across it, stools, more lights
    4: { surface: cement, overlay: wireShadows, backdrop: { count: 34, opacity: 0.45 }, props: [P(stool, 'left', 0.55, 0.85, 0.2), P(stool, 'right', 0.3, 0.85, -0.2), P(teaCup, 'right', 0.8, 0.55)] },
    // 5: a quán nhậu's plastic tablecloth
    5: { surface: tablecloth, lights: { exposure: 0.92 }, props: [P(teaCup, 'left', 0.25, 0.55), P(teaCup, 'right', 0.65, 0.55), P(saltBowl, 'left', 0.7, 0.5), P(fan, 'right', 0.25, 0.8, 0.6)] },
  },
  beach_grill: {
    // 1: on the sand between the basket boats
    1: { surface: () => sand(), props: [P(() => basketBoat(1.5), 'left', 0.35, 1.5), P(() => basketBoat(1.3), 'right', 0.7, 1.35), P(() => floats(4), 'right', 0.15, 0.4), P(shells, 'left', 0.85, 0.6)] },
    // 2: today's driftwood, nets drying beside the grills
    2: { props: [P(() => netPatch(2.2, 3.4), 'left', 0.5, 1.2), P(() => netPatch(2.2, 2.6), 'right', 0.4, 1.2), P(bucket, 'right', 0.85, 0.6)] },
    // 3: the stall under a corrugated tin roof, the late sun
    3: { overlay: roofShade, ...LATE_SUN, props: [P(bucket, 'left', 0.3, 0.6), P(teaCup, 'right', 0.25, 0.55), P(() => floats(3), 'right', 0.7, 0.4)] },
    // 4: planks from an old boat, blue paint peeling, a red stripe
    4: { surface: boatPlanks, props: [P(() => netPatch(2, 3), 'right', 0.5, 1.1), P(() => floats(3), 'left', 0.3, 0.4), P(bucket, 'left', 0.75, 0.6)] },
    // 5: sand in the late afternoon: a basket boat, a net, long warm light
    5: { surface: () => sand(1), ...LATE_SUN, props: [P(() => basketBoat(1.5), 'right', 0.4, 1.5), P(() => netPatch(2.2, 3), 'left', 0.45, 1.2), P(shells, 'right', 0.9, 0.5)] },
  },
};

/** The recipe of this page load for a theme (null: the shipped look). */
export function decorRecipe(themeId, v = pageVariant()) {
  return RECIPES[themeId]?.[v] ?? null;
}

/** Light / palette / backdrop tweaks of the recipe, merged onto the resolved theme. */
export function decorTheme(t) {
  const r = decorRecipe(t.id);
  if (!r) return t;
  return { ...t, lights: { ...t.lights, ...r.lights }, palette: { ...t.palette, ...r.palette }, backdrop: { ...t.backdrop, ...r.backdrop } };
}

/** Builds the recipe's surface / overlay / props on the stage; `fit(view)` places them each time the frame changes. */
export function createDecor(stage, t) {
  const r = decorRecipe(t.id);
  const group = new THREE.Group();
  group.position.y = TABLE_Y;
  if (!r) return { group, surface: null, fit() {}, dispose() {} };
  let overlay = null;
  if (r.overlay) {
    overlay = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: r.overlay(), transparent: true, depthWrite: false, toneMapped: false }));
    overlay.rotation.x = -Math.PI / 2;
    overlay.position.y = 0.015;
    overlay.renderOrder = -1;
    group.add(overlay);
  }
  const props = r.props.map((p) => {
    const o = p.make();
    o.rotation.y = p.rot;
    o.scale.setScalar(p.scale);
    group.add(o);
    return { o, at: p.at };
  });
  return {
    group,
    surface: r.surface ? r.surface() : null,
    /** view: { x0, x1, z0, z1 } visible table area, { w, d } the board. */
    fit({ x0, x1, z0, z1, w, d }) {
      if (overlay) {
        overlay.scale.set(x1 - x0, z1 - z0, 1);
        overlay.position.x = (x0 + x1) / 2;
        overlay.position.z = (z0 + z1) / 2;
      }
      const zs = Math.max(z0 + 0.4, -d / 2 - 0.3), ze = Math.min(z1 - 0.4, d / 2 + 0.3);
      const half = Math.min(-x0, x1);
      for (const { o, at: [side, u, gap] } of props) {
        const sg = side === 'left' ? -1 : 1;
        if (side === 'far' || side === 'near') o.position.set(-w / 2 + w * u, 0, (side === 'far' ? -1 : 1) * (d / 2 + gap));
        else if (half - w / 2 >= gap * 1.4) o.position.set(sg * (w / 2 + gap), 0, zs + (ze - zs) * u);
        else if (gap >= 1.2) o.position.set(sg * half, 0, z1 - gap * 0.5); // a big one (a boat): half out of the corner
        else {
          // no room beside the board (a wide board on a wide screen): the strip below it, from the corners inwards
          const zn = Math.min(z1 - gap * 0.7, d / 2 + gap);
          o.position.set(sg * (half - gap - u * half * 0.45), 0, zn);
        }
      }
    },
    dispose() {
      group.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [o.material].flat()) if (m) (m.map?.dispose(), m.dispose());
      });
    },
  };
}
