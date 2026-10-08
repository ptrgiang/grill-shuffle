// #93 design prototypes (?variant=1..5): Bà Năm with her cart in a badge (client/ui/brand.js), above the name.
// Removed once the owner picks; the pick becomes the menu logo, the favicon and the app icon.
import { h } from './dom.js';
import { badgeSvg } from './brand.js';

export function logoVariant(v, name, tagline) {
  if (!(v >= 1 && v <= 5)) return null;
  return h('div.logo.logo-badge', h('span.badge-art', { html: badgeSvg(v) }), h('h1.title', name), h('p.subtitle', tagline));
}
