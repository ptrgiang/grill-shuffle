// Procedural canvas textures, generated once and cached. No image files.
import * as THREE from 'three';
import { mulberry32 } from '../../shared/rng.js';

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c, { repeat = 1, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

/** Soft round sprite for particles and glows. */
export const softDot = () =>
  once('softDot', () => {
    const c = canvas(64);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.65)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return tex(c, { srgb: false });
  });

/** 'r,g,b' of a #rrggbb colour, for canvas rgba() strings. */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');

/** Wooden table planks (theme `table`: base hue / saturation / lightness, plank count, seed). */
export const woodPlanks = ({ hue = 28, saturation = 22, lightness = 34, planks = 6, seed = 11 } = {}) =>
  once(`wood:${hue}:${saturation}:${lightness}:${planks}:${seed}`, () => {
    const W = 512, c = canvas(W);
    const g = c.getContext('2d');
    const rng = mulberry32(seed);
    const ph = W / planks;
    for (let p = 0; p < planks; p++) {
      const l = lightness + rng() * 8;
      g.fillStyle = `hsl(${hue + rng() * 6}, ${saturation + rng() * 8}%, ${l}%)`;
      g.fillRect(0, p * ph, W, ph);
      // grain
      for (let i = 0; i < 70; i++) {
        const y = p * ph + rng() * ph;
        g.strokeStyle = `rgba(${rng() < 0.5 ? '40,20,10' : '255,210,170'},${0.04 + rng() * 0.07})`;
        g.lineWidth = 0.6 + rng() * 1.6;
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 2 + (rng() - 0.5) * 2);
        g.stroke();
      }
      // knots
      for (let k = 0; k < 2; k++) {
        if (rng() < 0.5) continue;
        const kx = rng() * W, ky = p * ph + ph * (0.3 + rng() * 0.4);
        const grad = g.createRadialGradient(kx, ky, 1, kx, ky, 10);
        grad.addColorStop(0, 'rgba(50,25,12,0.6)');
        grad.addColorStop(1, 'rgba(50,25,12,0)');
        g.fillStyle = grad;
        g.fillRect(kx - 12, ky - 12, 24, 24);
      }
      g.fillStyle = 'rgba(20,10,5,0.55)';
      g.fillRect(0, p * ph, W, 3);
    }
    return tex(c, { repeat: 1 });
  });

/** Glowing coals seen through the grate (luminance + colour in one map). Colours: theme `grill.ember`. */
export const embers = ({ bed = '#2a0d05', hot = '#ffbe5a', warm = '#ff5a14', glow = '#a01e05', fade = '#280802', coal = '#140c0a' } = {}) =>
  once(`embers:${bed}:${hot}:${warm}:${glow}:${fade}:${coal}`, () => {
    const W = 256, c = canvas(W, W / 2);
    const g = c.getContext('2d');
    const rng = mulberry32(5);
    g.fillStyle = bed;
    g.fillRect(0, 0, W, W / 2);
    for (let i = 0; i < 160; i++) {
      const x = rng() * W, y = rng() * (W / 2), r = 5 + rng() * 14;
      const heat = rng();
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, heat > 0.6 ? `rgba(${rgb(hot)},0.95)` : `rgba(${rgb(warm)},0.85)`);
      grad.addColorStop(0.6, `rgba(${rgb(glow)},0.5)`);
      grad.addColorStop(1, `rgba(${rgb(fade)},0)`);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // dark coal lumps on top
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(${rgb(coal)},${0.35 + rng() * 0.4})`;
      g.beginPath();
      g.ellipse(rng() * W, rng() * (W / 2), 4 + rng() * 9, 3 + rng() * 6, rng() * 3, 0, Math.PI * 2);
      g.fill();
    }
    return tex(c);
  });

/** Brushed dark metal (roughness variation baked into colour). */
export const brushedMetal = () =>
  once('metal', () => {
    const W = 256, c = canvas(W);
    const g = c.getContext('2d');
    const rng = mulberry32(3);
    g.fillStyle = '#5a5560';
    g.fillRect(0, 0, W, W);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '255,255,255'},${rng() * 0.06})`;
      g.fillRect(0, rng() * W, W, 1);
    }
    return tex(c);
  });

/** A round badge with a number, e.g. the padlock counter or the stacked-tray count. */
export function badgeTexture(text, { bg = '#2b2230', fg = '#fff3e0', ring = '#ffb347', icon = null } = {}) {
  const c = canvas(128);
  const g = c.getContext('2d');
  g.fillStyle = ring;
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = bg;
  g.beginPath();
  g.arc(64, 64, 50, 0, Math.PI * 2);
  g.fill();
  if (icon === 'lock') {
    g.strokeStyle = fg;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(64, 46, 15, Math.PI, 0);
    g.stroke();
    g.fillStyle = fg;
    g.fillRect(42, 46, 44, 34);
    g.fillStyle = bg;
    g.font = 'bold 30px Fredoka, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 65);
  } else {
    g.fillStyle = fg;
    g.font = 'bold 54px Fredoka, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 68);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
