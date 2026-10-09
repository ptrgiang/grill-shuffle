// The Bà Năm's Grill badge (#93, the owner's picks over four rounds): Bà Năm behind her stainless street cart, a glass
// cabinet with bánh mì and raw skewers on the left, a charcoal firebox on the right, in a bottle-cap stamp with a
// khăn rằn rim. The skewers lie the way street vendors lay them: across the firebox from rim to rim on two rails,
// bamboo ends pointing at the viewer. Pure SVG strings (no DOM, no text), so the menu, the favicon and the app icons
// (scripts/make-icons.js) all draw the same picture.

const P = {
  skin: '#f2c6a0', skinShade: '#d99e78', hair: '#e9e4dc', hairShade: '#b9b1a6', ink: '#3a2a26',
  shirt: '#3e4c7c', shirtDark: '#2b365c', rim: '#7e1f1a', field: '#f3b25e', glow: '#ffd27a',
  tin: '#a9aeb1', tinDark: '#6c7276',
  bamboo: '#d9b779', bambooDark: '#a8844a', pork: '#a0452a', porkDark: '#5e2414', fat: '#e8b48a',
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

const smoke = (id, xs, y0) =>
  `<path d="${xs.map((x) => `M${x} ${y0} c-7 -8 5 -14 -1 -24 c-4 -7 3 -11 0 -16`).join(' ')}" fill="none" stroke="url(#${id}-smoke)" stroke-width="4.5" stroke-linecap="round"/>`;

/** One skewer of pork (and a slice of fat) lying from the back rim (xb, yb) to the front (xf, yf), stick past the front. */
function skewer(xb, yb, xf, yf, kind = 0) {
  const at = (t) => [xb + (xf - xb) * t, yb + (yf - yb) * t];
  const pieces = [0.17, 0.46, 0.76].map((t, i) => {
    const [x, y] = at(t);
    const fill = kind === 1 ? (i % 2 ? '#ff8a5a' : '#ff7b54') : i === 1 ? P.fat : P.pork;
    const w = 8 + 3 * t; // nearer pieces look bigger
    return `<rect x="${(x - w / 2).toFixed(1)}" y="${(y - w * 0.36).toFixed(1)}" width="${w.toFixed(1)}" height="${(w * 0.72).toFixed(1)}" rx="${(w * 0.3).toFixed(1)}" fill="${fill}" stroke="${P.porkDark}" stroke-width=".6"/><path d="M${(x - w * 0.32).toFixed(1)} ${(y - 0.6).toFixed(1)} h${(w * 0.64).toFixed(1)}" stroke="${P.porkDark}" stroke-width="1.1" opacity=".7"/>`;
  });
  const [sx, sy] = at(1.3);
  return `<path d="M${xb.toFixed(1)} ${(yb - 2).toFixed(1)} L${sx.toFixed(1)} ${sy.toFixed(1)}" stroke="#7a5a2e" stroke-width="3" stroke-linecap="round"/><path d="M${xb.toFixed(1)} ${(yb - 2).toFixed(1)} L${sx.toFixed(1)} ${sy.toFixed(1)}" stroke="${P.bamboo}" stroke-width="1.8" stroke-linecap="round"/>${pieces.join('')}`;
}

/**
 * A long firebox seen a little from above: back rim at `yb`, front rim at `yf`, front face `h` tall. `n` skewers lie
 * across it from rim to rim, their bamboo ends sticking out over the front.
 */
function firebox(id, x0, x1, yb, yf, h, n, face = `url(#${id}-tin)`) {
  const inset = 9, cx = (x0 + x1) / 2;
  const sk = Array.from({ length: n }, (_, i) => {
    const xf = x0 + 9 + (i * (x1 - x0 - 18)) / (n - 1);
    const xb = cx + (xf - cx) * ((x1 - x0 - 2 * inset) / (x1 - x0));
    return skewer(xb, yb + 0.5, xf, yf - 0.5, i === Math.floor(n / 2) ? 1 : 0);
  }).join('');
  return `<path d="M${x0} ${yf} L${x0 + inset} ${yb} L${x1 - inset} ${yb} L${x1} ${yf} Z" fill="url(#${id}-coal)"/>
  <path d="M${x0 + inset} ${yb} L${x1 - inset} ${yb}" stroke="#4a403a" stroke-width="1.6"/>
  <path d="M${x0 + 3.5} ${(yb + (yf - yb) * 0.33).toFixed(1)} H${x1 - 3.5} M${x0 + 1.8} ${(yb + (yf - yb) * 0.66).toFixed(1)} H${x1 - 1.8}" stroke="#6d6a66" stroke-width="1.4"/>${sk}
  <rect x="${x0}" y="${yf}" width="${x1 - x0}" height="${h}" fill="${face}"/>
  <path d="M${x0} ${yf} H${x1}" stroke="#d8dcde" stroke-width="1.4"/>`;
}

/** A woven bamboo fan (quạt nan) with its handle, centre (cx, cy), tilted by `rot` degrees. */
const fan = (cx, cy, rot, r = 13) => `<g transform="rotate(${rot} ${cx} ${cy})"><path d="M${cx} ${cy + r - 1} v14" stroke="#8a5a2b" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ddbf84" stroke="#9a763e" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.66}" fill="none" stroke="#b8945a" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="${r * 0.34}" fill="none" stroke="#b8945a" stroke-width="1"/>
  <path d="M${cx - r} ${cy} H${cx + r} M${cx} ${cy - r} V${cy + r} M${cx - r * 0.7} ${cy - r * 0.7} L${cx + r * 0.7} ${cy + r * 0.7} M${cx + r * 0.7} ${cy - r * 0.7} L${cx - r * 0.7} ${cy + r * 0.7}" stroke="#b8945a" stroke-width=".8"/></g>`;

const shadow = (w = 66) => `<ellipse cx="100" cy="205" rx="${w}" ry="4.5" fill="#000" opacity=".22"/>`;

/** A spoked cart wheel with a rubber tyre (the round-2 cart). */
function wheel(cx, cy, rim = '#b9bec3') {
  const sp = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI * i) / 8;
    return `M${(cx - Math.cos(a) * 10).toFixed(1)} ${(cy - Math.sin(a) * 10).toFixed(1)} L${(cx + Math.cos(a) * 10).toFixed(1)} ${(cy + Math.sin(a) * 10).toFixed(1)}`;
  }).join(' ');
  return `<circle cx="${cx}" cy="${cy}" r="13" fill="#1f1612"/><circle cx="${cx}" cy="${cy}" r="10.4" fill="#3a2e28" stroke="${rim}" stroke-width="1.8"/>
  <path d="${sp}" stroke="#c9ced2" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="2.8" fill="#d9dde0" stroke="#6d6a66" stroke-width="1"/>`;
}

/** Glowing draught slots along the firebox band. */
const vents = (id, x0, x1, y) => {
  const n = Math.floor((x1 - x0 - 10) / 14);
  return Array.from({ length: n }, (_, i) => `<rect x="${(x0 + 9 + i * 14).toFixed(1)}" y="${y}" width="8" height="2.8" rx="1.4" fill="url(#${id}-vent)"/>`).join('');
};

const rivets = (pts, fill) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="${fill}"/>`).join('');

/** The cart body under the firebox. `body`: fill of the box, `trim`: rails, `extra`: drawn over the box (brushing). */
function cartBody(id, { body, trim, panel, extra = '', handle = '#9ea4a8', rim }) {
  return `<rect x="38" y="153" width="124" height="7" fill="#3a332f"/>${vents(id, 38, 162, 155.2)}
  <rect x="36" y="159.5" width="128" height="3" rx="1.5" fill="${trim}"/>
  <rect x="38" y="162" width="124" height="26" fill="${body}"/>${extra}
  <rect x="44" y="166" width="54" height="19" rx="2" fill="none" stroke="${panel}" stroke-width="1.3" opacity=".75"/>
  <rect x="102" y="166" width="54" height="19" rx="2" fill="none" stroke="${panel}" stroke-width="1.3" opacity=".75"/>
  ${rivets([[41, 165], [159, 165], [41, 185], [159, 185]], '#e9e4dc')}
  <rect x="36" y="187.5" width="128" height="3" rx="1.5" fill="${trim}"/>
  <path d="M162 168 L178 158 L184 158" fill="none" stroke="${handle}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M180 158 h7" stroke="#2a1c18" stroke-width="5" stroke-linecap="round"/>
  <path d="M60 190 v3 M140 190 v3" stroke="#6d6a66" stroke-width="3"/>${wheel(60, 194, rim)}${wheel(140, 194, rim)}`;
}

const brushed = Array.from({ length: 30 }, (_, i) => `<path d="M${40 + i * 4.1} 162 v26" stroke="${i % 3 ? '#ffffff' : '#7c8388'}" stroke-width=".5" opacity="${i % 3 ? 0.35 : 0.25}"/>`).join('');
/** The glass display cabinet on the counter: bánh mì and raw skewers waiting behind the glass. */
const cabinet = `<rect x="36" y="124" width="50" height="29" rx="2" fill="#dff1f4" fill-opacity=".45" stroke="#b9bec3" stroke-width="2"/>
  <path d="M36 138 H86" stroke="#b9bec3" stroke-width="1.4"/>
  <g fill="#d9a35e"><rect x="40" y="134" width="18" height="6" rx="3"/><rect x="62" y="134" width="18" height="6" rx="3"/></g>
  <path d="M42 152 l14 -5 M50 154 l14 -5 M58 156 l14 -5" stroke="#d9b779" stroke-width="1.4" stroke-linecap="round"/>
  <g fill="#c25a3a"><circle cx="47" cy="149.5" r="2.2"/><circle cx="55" cy="151.5" r="2.2"/><circle cx="63" cy="153.5" r="2.2"/><circle cx="52" cy="148" r="2.2"/></g>
  <path d="M40 130 L48 156" stroke="#ffffff" stroke-width="1.4" opacity=".55"/>`;

/** The cart: brushed stainless body, glass cabinet, firebox with skewers, spoked wheels, push handle, quạt nan. */
function cart(id) {
  const steel = `<linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef1f3"/><stop offset=".5" stop-color="#c3c8cc"/><stop offset="1" stop-color="#8f979c"/></linearGradient>`;
  return `<defs>${steel}</defs>${shadow()}${smoke(id, [120, 156], 134)}${cabinet}${firebox(id, 90, 164, 126, 148, 5, 4)}` +
    cartBody(id, { body: `url(#${id}-body)`, trim: '#eef0f1', panel: '#7c8388', extra: brushed, handle: '#d9dde0' }) + fan(26, 176, -16);
}

const defs = (id) => `<defs>
  <pattern id="${id}-check" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f4efe6"/><rect width="3" height="3" fill="#2a2a2a"/><rect x="3" y="3" width="3" height="3" fill="#2a2a2a"/></pattern>
  <clipPath id="${id}-in"><circle cx="100" cy="100" r="80"/></clipPath>
  <linearGradient id="${id}-tin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.tin}"/><stop offset="1" stop-color="${P.tinDark}"/></linearGradient>
  <linearGradient id="${id}-coal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a1c08"/><stop offset=".45" stop-color="#ff6a1f"/><stop offset="1" stop-color="#ffb347"/></linearGradient>
  <linearGradient id="${id}-stove" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4d5a47"/><stop offset=".45" stop-color="#8a9880"/><stop offset="1" stop-color="#4d5a47"/></linearGradient>
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
  const fore = cart(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 208 216" role="img" aria-hidden="true">${defs(id)}
  <path d="${scallop(96, 28, 5)}" fill="${P.rim}"/><circle cx="100" cy="100" r="86" fill="url(#${id}-check)" opacity=".9"/>
  <circle cx="100" cy="100" r="80" fill="${P.field}"/>
  <g clip-path="url(#${id}-in)"><circle cx="100" cy="64" r="56" fill="${P.glow}" opacity=".55"/>${grandma(id)}</g>${fore}</svg>`;
}
