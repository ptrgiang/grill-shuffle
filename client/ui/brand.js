// The Bà Năm's Grill badge (#93, owner's pick: style 4, the cart redrawn without lettering): Bà Năm behind her
// charcoal grill cart, in a bottle-cap stamp with a khăn rằn rim. Pure SVG strings (no DOM, no text), so the menu, the
// favicon and the app icons (scripts/make-icons.js) all draw the same picture.

const P = {
  skin: '#f2c6a0', skinShade: '#d99e78', hair: '#e9e4dc', hairShade: '#b9b1a6', ink: '#3a2a26',
  shirt: '#3e4c7c', shirtDark: '#2b365c', rim: '#7e1f1a', field: '#f3b25e', glow: '#ffd27a',
};

/** Bà Năm, head and shoulders, centred on x 100; her shoulders end around y 180. */
function grandma(id) {
  return `
  <path d="M44 184 C46 148 66 134 100 134 C134 134 154 148 156 184 Z" fill="${P.shirt}"/>
  <path d="M86 135 L100 154 L114 135" fill="none" stroke="${P.shirtDark}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M78 134 Q100 150 122 134 L121 143 Q100 158 79 143 Z" fill="url(#${id}-check)"/>
  <path d="M112 146 l10 14 l-8 1 z" fill="url(#${id}-check)"/>
  <rect x="90" y="114" width="20" height="24" rx="7" fill="${P.skinShade}"/>
  <circle cx="72.5" cy="99" r="6" fill="${P.skin}"/><circle cx="127.5" cy="99" r="6" fill="${P.skin}"/>
  <circle cx="72.5" cy="108" r="2.8" fill="#3fae78"/><circle cx="127.5" cy="108" r="2.8" fill="#3fae78"/>
  <ellipse cx="100" cy="97" rx="27" ry="29" fill="${P.skin}"/>
  <path d="M72 98 C69 70 84 63 100 63 C116 63 131 70 128 98 C124 84 114 77 100 77 C86 77 76 84 72 98 Z" fill="${P.hair}"/>
  <path d="M100 65 C95 70 89 75 81 80 M100 65 C105 70 111 75 119 80" fill="none" stroke="${P.hairShade}" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="100" cy="57" r="13" fill="${P.hair}"/>
  <path d="M90 55 q10 -9 20 0 M92 61 q8 -5 16 0" fill="none" stroke="${P.hairShade}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M91 51 L116 60" stroke="#8a5a2b" stroke-width="2.8" stroke-linecap="round"/><circle cx="117" cy="60.4" r="2.6" fill="#c8372d"/>
  <path d="M82 86 q6 -4 12 -1 M106 85 q6 -3 12 1" fill="none" stroke="#a89e95" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="89" cy="97" r="9.5" fill="#ffffff" fill-opacity=".22" stroke="${P.ink}" stroke-width="2.6"/>
  <circle cx="111" cy="97" r="9.5" fill="#ffffff" fill-opacity=".22" stroke="${P.ink}" stroke-width="2.6"/>
  <path d="M98.5 96 q1.5 -2 3 0" fill="none" stroke="${P.ink}" stroke-width="2.2"/>
  <path d="M84.5 98.5 q4.5 -4.5 9 0 M106.5 98.5 q4.5 -4.5 9 0" fill="none" stroke="${P.ink}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M75 93 l-3 -2 M75 97 l-4 0 M125 93 l3 -2 M125 97 l4 0" stroke="${P.skinShade}" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="82" cy="110" r="5.5" fill="#f08a7a" opacity=".5"/><circle cx="118" cy="110" r="5.5" fill="#f08a7a" opacity=".5"/>
  <path d="M91 113 q9 8 18 0" fill="none" stroke="#8a3a2a" stroke-width="2.6" stroke-linecap="round"/>`;
}

/** A spoked cart wheel at (cx, cy). */
function wheel(cx, cy) {
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI * i) / 8;
    const dx = (Math.cos(a) * 10).toFixed(1), dy = (Math.sin(a) * 10).toFixed(1);
    return `M${cx - dx} ${cy - dy} L${cx + +dx} ${cy + +dy}`;
  }).join(' ');
  return `<circle cx="${cx}" cy="${cy}" r="13" fill="#1f1612"/><circle cx="${cx}" cy="${cy}" r="10.4" fill="#3a2e28" stroke="#b9bec3" stroke-width="1.8"/>
  <path d="${spokes}" stroke="#c9ced2" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="2.8" fill="#d9dde0" stroke="#6d6a66" stroke-width="1"/>`;
}

/** The charcoal grill cart in front of her: grate with skewers, corn and shrimp over embers, red body, spoked wheels. */
function cart(id) {
  const vents = [0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${52 + i * 14}" y="152.6" width="8" height="2.8" rx="1.4" fill="url(#${id}-vent)"/>`).join('');
  const grate = Array.from({ length: 15 }, (_, i) => `M${46 + i * 7.6} 141.5 L${44 + i * 7.9} 148.5`).join(' ');
  return `
  <ellipse cx="100" cy="205" rx="66" ry="4.5" fill="#000" opacity=".22"/>
  <path d="M50 134 c-7 -8 5 -14 -1 -24 c-4 -7 3 -11 0 -16 M150 134 c-7 -8 5 -14 -1 -24 c-4 -7 3 -11 0 -16" fill="none" stroke="url(#${id}-smoke)" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M38 150 L46 140 L154 140 L162 150 Z" fill="#2b2522"/>
  <path d="M46 141.5 L154 141.5 L159 148.5 L41 148.5 Z" fill="url(#${id}-coal)"/>
  <path d="${grate}" stroke="#4a403a" stroke-width="1"/>
  <path d="M43 145 H157" stroke="#4a403a" stroke-width="1"/>
  <path d="M52 149 L86 135" stroke="#c9a46a" stroke-width="1.8" stroke-linecap="round"/>
  <g fill="#9c3b22"><rect x="57" y="139.5" width="9" height="8.5" rx="2.6" transform="rotate(-22 61.5 143.7)"/><rect x="66" y="136" width="9" height="8.5" rx="2.6" transform="rotate(-22 70.5 140.2)"/><rect x="75" y="132.5" width="9" height="8.5" rx="2.6" transform="rotate(-22 79.5 136.7)"/></g>
  <path d="M59 143 l5 -2 M68 139.5 l5 -2 M77 136 l5 -2" stroke="#3a1a10" stroke-width="1.3"/>
  <path d="M88 147 c-2 -9 9 -12 12 -4 M101 142 c-2 -9 9 -12 12 -4" fill="none" stroke="#ff7b54" stroke-width="7" stroke-linecap="round"/>
  <path d="M88 147 c-2 -9 9 -12 12 -4 M101 142 c-2 -9 9 -12 12 -4" fill="none" stroke="#ffd1b8" stroke-width="1.4" stroke-dasharray="2 3" stroke-linecap="round"/>
  <rect x="119" y="129" width="32" height="13" rx="6.5" transform="rotate(-8 135 135.5)" fill="#f2bf2a"/>
  <path d="M125 129.6 l1.4 12 M132 128.6 l1.4 12 M139 127.6 l1.4 12 M146 126.6 l1.4 12" stroke="#8a5a1a" stroke-width="1.8" opacity=".75" transform="rotate(-8 135 135.5)"/>
  <path d="M151 132 l8 -2.5" stroke="#7cb342" stroke-width="3.4" stroke-linecap="round"/>
  <rect x="38" y="150" width="124" height="8" fill="#3a332f"/>${vents}
  <rect x="36" y="157.5" width="128" height="3.2" rx="1.6" fill="#c9ced2"/>
  <rect x="38" y="160" width="124" height="26" fill="url(#${id}-body)"/>
  <rect x="44" y="164" width="54" height="17" rx="2" fill="none" stroke="#7e1f1a" stroke-width="1.4" opacity=".7"/>
  <rect x="102" y="164" width="54" height="17" rx="2" fill="none" stroke="#7e1f1a" stroke-width="1.4" opacity=".7"/>
  <g fill="#e9c4a0" opacity=".9"><circle cx="41" cy="163" r="1.2"/><circle cx="159" cy="163" r="1.2"/><circle cx="41" cy="183" r="1.2"/><circle cx="159" cy="183" r="1.2"/></g>
  <rect x="36" y="185.5" width="128" height="3.2" rx="1.6" fill="#9ea4a8"/>
  <path d="M162 165 L178 158 L184 158" fill="none" stroke="#9ea4a8" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M180 158 h7" stroke="#2a1c18" stroke-width="5" stroke-linecap="round"/>
  <path d="M60 188 v4 M140 188 v4" stroke="#6d6a66" stroke-width="3"/>
  ${wheel(60, 192)}${wheel(140, 192)}
  <g transform="rotate(-16 27 170)"><path d="M27 182 v14" stroke="#8a5a2b" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="27" cy="170" r="13" fill="#ddbf84" stroke="#9a763e" stroke-width="2"/>
  <circle cx="27" cy="170" r="8.6" fill="none" stroke="#b8945a" stroke-width="1"/><circle cx="27" cy="170" r="4.4" fill="none" stroke="#b8945a" stroke-width="1"/>
  <path d="M14.5 170 H39.5 M27 157.5 V182.5 M18.2 161.2 L35.8 178.8 M35.8 161.2 L18.2 178.8" stroke="#b8945a" stroke-width=".8"/></g>`;
}

const defs = (id) => `<defs>
  <pattern id="${id}-check" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f4efe6"/><rect width="3" height="3" fill="#2a2a2a"/><rect x="3" y="3" width="3" height="3" fill="#2a2a2a"/></pattern>
  <clipPath id="${id}-in"><circle cx="100" cy="100" r="80"/></clipPath>
  <linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9452f"/><stop offset=".55" stop-color="#bb3326"/><stop offset="1" stop-color="#8e251c"/></linearGradient>
  <linearGradient id="${id}-coal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset=".5" stop-color="#ff6a1f"/><stop offset="1" stop-color="#7a1c08"/></linearGradient>
  <radialGradient id="${id}-vent" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#ffcf6a"/><stop offset="1" stop-color="#d9480f"/></radialGradient>
  <linearGradient id="${id}-smoke" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff6e8" stop-opacity=".7"/><stop offset="1" stop-color="#fff6e8" stop-opacity="0"/></linearGradient>
</defs>`;

/** A bottle-cap edge of `n` teeth around (100, 100). */
function scallop(r, n, depth) {
  let d = '';
  for (let i = 0; i <= n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const rr = i % 2 ? r - depth : r;
    d += `${i ? 'L' : 'M'}${(100 + rr * Math.cos(a)).toFixed(1)} ${(100 + rr * Math.sin(a)).toFixed(1)} `;
  }
  return `${d}Z`;
}

/** The badge as an SVG string. `id` keeps gradient ids unique when several badges share a page. */
export function badgeSvg({ id = 'bn' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 208 216" role="img" aria-hidden="true">${defs(id)}
  <path d="${scallop(96, 28, 5)}" fill="${P.rim}"/><circle cx="100" cy="100" r="86" fill="url(#${id}-check)" opacity=".9"/>
  <circle cx="100" cy="100" r="80" fill="${P.field}"/>
  <g clip-path="url(#${id}-in)"><circle cx="100" cy="64" r="56" fill="${P.glow}" opacity=".55"/>${grandma(id)}</g>${cart(id)}</svg>`;
}
