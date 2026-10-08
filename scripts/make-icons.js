// Writes the logo files from the Bà Năm badge (client/ui/brand.js, #93), so the menu, the favicon and the installed
// app all show the same drawing. Run after changing the badge: node scripts/make-icons.js
// (sharp comes in through wrangler's dependencies)
//
//   favicon.svg                        the badge on a square, transparent around it (tabs, the landing header)
//   icons/icon-192.png, icon-512.png   purpose "any": the badge on transparency (desktop, Android fallback)
//   icons/maskable-512.png             purpose "maskable": full-bleed dark background, badge inside the 80% safe zone
//   icons/apple-touch-icon.png         180x180, opaque and square: iOS rounds the corners itself
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { badgeSvg } from '../client/ui/brand.js';

const pub = resolve(import.meta.dirname, '../client/public');
const out = resolve(pub, 'icons');
mkdirSync(out, { recursive: true });

const BG = '#1b1420'; // the game's background (manifest background_color / theme_color)
const badge = badgeSvg().replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const VB = '-4 -4 208 216'; // badgeSvg's viewBox

/** The badge on a 100x100 square, `k` = its share of the square, on `bg` (null: transparent). */
const square = (k, bg) => {
  const s = 100 * k, x = (100 - s * (208 / 216)) / 2, y = (100 - s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}` +
    `<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(s * (208 / 216)).toFixed(2)}" height="${s.toFixed(2)}" viewBox="${VB}">${badge}</svg></svg>`;
};

const png = (svg, size, file) => sharp(Buffer.from(svg), { density: 72 * (size / 100) * 2 }).resize(size, size).png().toFile(resolve(out, file));

writeFileSync(resolve(pub, 'favicon.svg'), square(1, null) + '\n');
await Promise.all([
  png(square(1, null), 192, 'icon-192.png'),
  png(square(1, null), 512, 'icon-512.png'),
  png(square(0.78, BG), 512, 'maskable-512.png'),
  png(square(0.9, BG), 180, 'apple-touch-icon.png'),
]);
console.log('favicon.svg and icons written to', pub);
