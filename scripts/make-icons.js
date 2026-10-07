// Rasterises the logo (client/public/favicon.svg) into the PNG icons the web app manifest and iOS need.
// Run after changing the logo: node scripts/make-icons.js   (sharp comes in through wrangler's dependencies)
//
//   icons/icon-192.png, icon-512.png   purpose "any": the rounded logo on transparency (desktop, Android fallback)
//   icons/maskable-512.png             purpose "maskable": full-bleed background, logo inside the 80% safe zone
//   icons/apple-touch-icon.png         180x180, opaque and square: iOS rounds the corners itself
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const pub = resolve(import.meta.dirname, '../client/public');
const out = resolve(pub, 'icons');
mkdirSync(out, { recursive: true });

const logo = readFileSync(resolve(pub, 'favicon.svg'), 'utf8');
// the logo's own background tile (a colour or a gradient defined inside the logo), reused full-bleed
const BG = logo.match(/<rect width="64" height="64"[^>]*fill="([^"]+)"/)[1];
const inner = logo.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<rect width="64" height="64"[^>]*\/>/, '');

// the logo's artwork without its rounded tile, scaled by `k` around the centre on a square opaque background
const square = (k) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${BG}"/>` +
  `<g transform="translate(32 32) scale(${k}) translate(-32 -31.5)">${inner}</g></svg>`;

const png = (svg, size, file) => sharp(Buffer.from(svg), { density: 72 * (size / 64) * 2 }).resize(size, size).png().toFile(resolve(out, file));

await Promise.all([
  png(logo, 192, 'icon-192.png'),
  png(logo, 512, 'icon-512.png'),
  png(square(0.8), 512, 'maskable-512.png'),
  png(square(1), 180, 'apple-touch-icon.png'),
]);
console.log('icons written to', out);
