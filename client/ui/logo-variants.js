// #93 design prototypes (?variant=1..5): the logo / title block of the menu for "Bà Năm's Grill". Removed once the
// owner picks; the pick moves into the menu (and becomes favicon / app icon).
import { h } from './dom.js';

const CART = `<svg viewBox="0 0 120 84" aria-hidden="true">
  <path d="M44 14c-3-5 3-8 0-13M60 16c-3-5 3-8 0-13M76 14c-3-5 3-8 0-13" fill="none" stroke="#fff3df" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>
  <path d="M10 22 Q60 34 110 22" fill="none" stroke="#2a1a14" stroke-width="1.6"/>
  <g fill="#ffd27a"><circle cx="22" cy="26" r="3.4"/><circle cx="41" cy="30" r="3.4"/><circle cx="60" cy="31" r="3.4"/><circle cx="79" cy="30" r="3.4"/><circle cx="98" cy="26" r="3.4"/></g>
  <rect x="24" y="36" width="72" height="8" rx="3" fill="#3a2a26"/>
  <path d="M28 40h64" stroke="#ff7a2e" stroke-width="2" stroke-dasharray="5 3"/>
  <rect x="18" y="44" width="84" height="22" rx="5" fill="#c8372d"/>
  <rect x="18" y="44" width="84" height="6" rx="3" fill="#e35a3f"/>
  <path d="M102 50h12" stroke="#7a4a2a" stroke-width="4" stroke-linecap="round"/>
  <circle cx="36" cy="72" r="9" fill="#2a1a14"/><circle cx="36" cy="72" r="3.5" fill="#b9a48a"/>
  <circle cx="86" cy="72" r="9" fill="#2a1a14"/><circle cx="86" cy="72" r="3.5" fill="#b9a48a"/>
</svg>`;

const GRANDMA = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="47" fill="#f6e6c8" stroke="#8a2a1e" stroke-width="5"/>
  <circle cx="50" cy="50" r="40" fill="none" stroke="#8a2a1e" stroke-width="1.4" stroke-dasharray="3 3"/>
  <path d="M22 88c4-16 14-24 28-24s24 8 28 24" fill="#5a2412"/>
  <circle cx="50" cy="44" r="16" fill="#5a2412"/>
  <circle cx="50" cy="26" r="7.5" fill="#5a2412"/>
  <path d="M41 44h7m4 0h7" stroke="#f6e6c8" stroke-width="1.8"/><circle cx="44" cy="44" r="4.4" fill="none" stroke="#f6e6c8" stroke-width="1.8"/><circle cx="56" cy="44" r="4.4" fill="none" stroke="#f6e6c8" stroke-width="1.8"/>
  <path d="M68 30c-2-4 2-6 0-10M76 34c-2-4 2-6 0-10" fill="none" stroke="#c8372d" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const LIGHTS = `<svg viewBox="0 0 300 54" preserveAspectRatio="none" aria-hidden="true">
  <path d="M4 8 Q150 60 296 8" fill="none" stroke="#2a1a14" stroke-width="2"/>
  ${Array.from({ length: 11 }, (_, i) => { const x = 4 + i * 29.2; const tt = (x - 4) / 292; const y = 8 + 4 * 26 * tt * (1 - tt) + 6; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${i % 3 === 0 ? '#ff9a5a' : i % 3 === 1 ? '#ffd27a' : '#fff1c9'}"/>`; }).join('')}
</svg>`;

/** The logo block for variant `v` (1..5); `name` and `tagline` already translated. */
export function logoVariant(v, name, tagline) {
  const title = (cls = '') => h(`h1.title${cls}`, name);
  const sub = h('p.subtitle', tagline);
  switch (v) {
    case 1: return h('div.logo.logo-v1', h('span.logo-art', { html: CART }), title(), sub);
    case 2: return h('div.logo.logo-v2', h('span.logo-art', { html: GRANDMA }), title(), sub);
    case 3: return h('div.logo.logo-v3', h('div.paper', h('span.tape'), title('.ink'), h('p.subtitle.ink-sub', tagline)));
    case 4: return h('div.logo.logo-v4', h('div.sign', h('span.bolt.l'), h('span.bolt.r'), h('h1.sign-name', name), h('p.sign-sub', tagline)));
    case 5: return h('div.logo.logo-v5', h('span.logo-lights', { html: LIGHTS }), title('.glow'), sub);
  }
  return null;
}
