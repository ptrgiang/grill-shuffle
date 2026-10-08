// The Bà Năm's Grill badge (#93): Bà Năm and her charcoal grill in a bottle-cap stamp with a khăn rằn rim (style 4,
// the owner's pick). Pure SVG strings (no DOM, no text), so the menu, the favicon and the app icons
// (scripts/make-icons.js) all draw the same picture.
//
// Round 3 prototypes (?variant=1..5, removed after the pick): five traditional ways to grill in front of her, with the
// skewers laid the way street vendors do, across the firebox from rim to rim, bamboo ends pointing at the viewer.

const P = {
  skin: '#f2c6a0', skinShade: '#d99e78', hair: '#e9e4dc', hairShade: '#b9b1a6', ink: '#3a2a26',
  shirt: '#3e4c7c', shirtDark: '#2b365c', rim: '#7e1f1a', field: '#f3b25e', glow: '#ffd27a',
  wood: '#8a5a34', woodDark: '#5e3a20', woodLight: '#b07a4a', tin: '#a9aeb1', tinDark: '#6c7276', clay: '#b5653a', clayDark: '#7e3f22',
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

/** A wooden cart wheel with an iron tyre. */
function woodWheel(cx, cy, r = 13) {
  const sp = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI * i) / 6;
    return `M${(cx - Math.cos(a) * r * 0.8).toFixed(1)} ${(cy - Math.sin(a) * r * 0.8).toFixed(1)} L${(cx + Math.cos(a) * r * 0.8).toFixed(1)} ${(cy + Math.sin(a) * r * 0.8).toFixed(1)}`;
  }).join(' ');
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#3a2a20"/><circle cx="${cx}" cy="${cy}" r="${r - 2.4}" fill="none" stroke="${P.woodLight}" stroke-width="3"/>
  <path d="${sp}" stroke="${P.woodLight}" stroke-width="2.2"/><circle cx="${cx}" cy="${cy}" r="3.2" fill="${P.woodDark}" stroke="#2a1c14" stroke-width="1"/>`;
}

const planks = (x0, y0, w, h, n) =>
  Array.from({ length: n }, (_, i) => {
    const y = y0 + (i * h) / n;
    return `<rect x="${x0}" y="${y.toFixed(1)}" width="${w}" height="${(h / n - 0.8).toFixed(1)}" fill="${i % 2 ? P.wood : '#94603a'}"/>` +
      `<path d="M${x0 + 8 + i * 9} ${(y + 2).toFixed(1)} q14 2 30 0 M${x0 + 60 + i * 7} ${(y + 3).toFixed(1)} q12 -2 24 0" fill="none" stroke="${P.woodDark}" stroke-width=".7" opacity=".6"/>`;
  }).join('');

const shadow = (w = 66) => `<ellipse cx="100" cy="205" rx="${w}" ry="4.5" fill="#000" opacity=".22"/>`;

const SCENES = {
  // 1: an old wooden push cart: plank body, tin firebox on top, wooden wheels with iron tyres, two shafts to push
  1: (id) => `${shadow()}${smoke(id, [50, 150], 134)}
    ${firebox(id, 36, 164, 122, 153, 6, 5)}
    ${planks(36, 159, 128, 27, 4)}
    <rect x="34" y="156" width="132" height="3" fill="${P.woodDark}"/><rect x="34" y="156" width="4" height="34" fill="${P.woodDark}"/><rect x="162" y="156" width="4" height="34" fill="${P.woodDark}"/>
    <path d="M164 160 L190 152 M164 170 L190 162" stroke="${P.woodDark}" stroke-width="3.4" stroke-linecap="round"/>
    ${woodWheel(62, 192)}${woodWheel(138, 192)}${fan(26, 170, -16)}`,
  // 2: a clay brazier (lò đất) and a hinged wire grill (vỉ kẹp) held over it, the fan in her other hand
  2: (id) => `${shadow(46)}${smoke(id, [72, 132], 138)}
    <path d="M58 160 Q100 152 142 160 L136 196 Q100 204 64 196 Z" fill="${P.clay}"/>
    <path d="M58 160 Q100 152 142 160 Q100 168 58 160 Z" fill="url(#${id}-coal)"/>
    <path d="M62 174 Q100 182 138 174 M64 186 Q100 194 136 186" fill="none" stroke="${P.clayDark}" stroke-width="1.6" opacity=".7"/>
    <rect x="88" y="180" width="24" height="12" rx="3" fill="#2a1410"/><rect x="91" y="183" width="18" height="6" rx="2" fill="url(#${id}-vent)"/>
    <g transform="rotate(-6 100 148)"><rect x="62" y="140" width="76" height="16" rx="2" fill="none" stroke="#8a8f92" stroke-width="2"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="${70 + i * 12}" cy="148" rx="6" ry="4.4" fill="${i % 3 === 1 ? P.fat : P.pork}"/>`).join('')}
    <path d="${Array.from({ length: 10 }, (_, i) => `M${64 + i * 8} 140 V156`).join(' ')} M62 148 H138" stroke="#9aa0a3" stroke-width=".8"/>
    <path d="M138 146 L176 138 M138 150 L176 142" stroke="#8a8f92" stroke-width="2.2" stroke-linecap="round"/><rect x="170" y="136" width="14" height="9" rx="3" transform="rotate(-12 177 140)" fill="${P.woodDark}"/></g>
    ${fan(30, 166, -20)}`,
  // 3: a gánh (shoulder pole): her pole across the frame, a woven basket with a small firebox and skewers on each side
  3: (id) => `${shadow(80)}<path d="M8 142 L192 130" stroke="${P.bamboo}" stroke-width="5" stroke-linecap="round"/><path d="M8 142 L192 130" stroke="${P.bambooDark}" stroke-width="1" stroke-dasharray="14 10"/>
    ${smoke(id, [46], 140)}
    <path d="M24 141 L18 166 M40 140 L46 166 M160 132.5 L154 162 M176 131.5 L182 162" stroke="#6b4a2a" stroke-width="1.4"/>
    <g>${firebox(id, 14, 74, 158, 171, 4, 3)}<path d="M10 175 Q44 168 78 175 L72 198 Q44 205 16 198 Z" fill="${P.bamboo}"/><path d="M12 182 Q44 176 76 182 M14 190 Q44 184 74 190" fill="none" stroke="${P.bambooDark}" stroke-width="1.2"/><path d="M20 176 l6 22 M34 173 l2 28 M50 173 l-2 28 M64 175 l-6 22" stroke="${P.bambooDark}" stroke-width=".9"/></g>
    <g><path d="M140 160 Q166 154 196 160 L190 184 Q166 190 146 184 Z" fill="${P.bamboo}"/><path d="M142 168 Q168 162 194 168 M144 176 Q168 170 192 176" fill="none" stroke="${P.bambooDark}" stroke-width="1.2"/>
    <ellipse cx="160" cy="157" rx="10" ry="3.6" fill="#f4efe6" stroke="#5a7aa8" stroke-width="1.4"/><ellipse cx="160" cy="154" rx="10" ry="3.6" fill="#f4efe6" stroke="#5a7aa8" stroke-width="1.4"/><ellipse cx="178" cy="156" rx="8" ry="4" fill="#3fae78"/></g>`,
  // 4: a honeycomb coal stove (bếp tổ ong) with a long tin tray of skewers on top, on the ground
  4: (id) => `${shadow(60)}${smoke(id, [50, 150], 136)}
    ${firebox(id, 38, 162, 126, 157, 5, 5)}
    <path d="M66 162 V194 Q100 204 134 194 V162 Z" fill="url(#${id}-stove)"/><ellipse cx="100" cy="162" rx="34" ry="5.5" fill="#3e4836"/>
    <path d="M66 172 Q100 180 134 172 M66 186 Q100 194 134 186" fill="none" stroke="#3e4836" stroke-width="2"/>
    <rect x="88" y="176" width="24" height="12" rx="2" fill="#2a1410"/><rect x="90" y="178" width="20" height="8" rx="2" fill="url(#${id}-vent)"/>
    <path d="M64 168 h-5 v8 h5 M136 168 h5 v8 h-5" fill="none" stroke="#3e4836" stroke-width="2"/>${fan(170, 176, 14)}`,
  // 5: a wooden stall (sạp) under a striped awning: tin firebox on the counter, a lantern hanging from the awning
  5: (id) => `<g clip-path="url(#${id}-in)"><path d="M18 30 H182 V44 H18 Z" fill="#c8372d"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${18 + i * 18.2}" y="30" width="9.1" height="14" fill="#f4efe6"/>`).join('')}
    <path d="${Array.from({ length: 9 }, (_, i) => `M${18 + i * 18.2} 44 q9.1 8 18.2 0`).join(' ')}" fill="#c8372d"/></g>
    <path d="M160 50 v10" stroke="#3a2a20" stroke-width="1.4"/><ellipse cx="160" cy="68" rx="8" ry="10" fill="#e8452f"/><rect x="155" y="57" width="10" height="3" fill="#ffd23f"/><rect x="155" y="76" width="10" height="3" fill="#ffd23f"/><ellipse cx="160" cy="68" rx="4" ry="6" fill="#ffb347" opacity=".7"/>
    ${shadow()}${smoke(id, [50, 150], 134)}
    ${firebox(id, 36, 164, 122, 153, 6, 5)}
    <rect x="30" y="158" width="140" height="6" fill="${P.woodLight}"/>${planks(34, 164, 132, 30, 3)}
    <rect x="34" y="164" width="4" height="40" fill="${P.woodDark}"/><rect x="162" y="164" width="4" height="40" fill="${P.woodDark}"/>`,
};

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

/** The badge as an SVG string. `id` keeps gradient ids unique when several badges share a page; `scene` 1..5. */
export function badgeSvg({ id = 'bn', scene = 1 } = {}) {
  const fore = (SCENES[scene] ?? SCENES[1])(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 208 216" role="img" aria-hidden="true">${defs(id)}
  <path d="${scallop(96, 28, 5)}" fill="${P.rim}"/><circle cx="100" cy="100" r="86" fill="url(#${id}-check)" opacity=".9"/>
  <circle cx="100" cy="100" r="80" fill="${P.field}"/>
  <g clip-path="url(#${id}-in)"><circle cx="100" cy="64" r="56" fill="${P.glow}" opacity=".55"/>${grandma(id)}</g>${fore}</svg>`;
}
