// The Bà Năm's Grill badge (#93): Bà Năm behind her grill cart. Pure SVG strings (no DOM), so the menu, the favicon
// and scripts/make-icons.js draw the same picture. `badgeSvg(style, { text })`: `text` false drops lettering (icons:
// rasterisers have no web font).

const P = {
  skin: '#f2c6a0', skinShade: '#d99e78', hair: '#e9e4dc', hairShade: '#b9b1a6', ink: '#3a2a26',
  shirt: '#3e4c7c', shirtDark: '#2b365c', red: '#c8372d', redLight: '#e85c43', redDark: '#7e1f1a',
  cream: '#f7ead2', gold: '#ffd23f', ember: '#ff8a3a',
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
  <path d="M91 51 L116 60" stroke="#8a5a2b" stroke-width="2.8" stroke-linecap="round"/><circle cx="117" cy="60.4" r="2.6" fill="${P.red}"/>
  <path d="M82 86 q6 -4 12 -1 M106 85 q6 -3 12 1" fill="none" stroke="#a89e95" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="89" cy="97" r="9.5" fill="#ffffff" fill-opacity=".22" stroke="${P.ink}" stroke-width="2.6"/>
  <circle cx="111" cy="97" r="9.5" fill="#ffffff" fill-opacity=".22" stroke="${P.ink}" stroke-width="2.6"/>
  <path d="M98.5 96 q1.5 -2 3 0" fill="none" stroke="${P.ink}" stroke-width="2.2"/>
  <path d="M84.5 98.5 q4.5 -4.5 9 0 M106.5 98.5 q4.5 -4.5 9 0" fill="none" stroke="${P.ink}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M75 93 l-3 -2 M75 97 l-4 0 M125 93 l3 -2 M125 97 l4 0" stroke="${P.skinShade}" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="82" cy="110" r="5.5" fill="#f08a7a" opacity=".5"/><circle cx="118" cy="110" r="5.5" fill="#f08a7a" opacity=".5"/>
  <path d="M91 113 q9 8 18 0" fill="none" stroke="#8a3a2a" stroke-width="2.6" stroke-linecap="round"/>`;
}

/** The cart in front of her: grill with food and embers, red body, wheels. `text`: "BÀ NĂM" on the cart. */
function cart(text) {
  return `
  <path d="M50 132 c-6 -9 5 -14 0 -24 M150 132 c-6 -9 5 -14 0 -24" fill="none" stroke="#fff6e8" stroke-width="3" stroke-linecap="round" opacity=".45"/>
  <rect x="58" y="140" width="22" height="10" rx="5" fill="#f5c518"/><path d="M62 142v6M67 142v6M72 142v6M77 142v6" stroke="#d9a400" stroke-width="1.2"/>
  <path d="M89 150 c2 -14 18 -14 18 -3" fill="none" stroke="#ff7b54" stroke-width="7" stroke-linecap="round"/>
  <path d="M112 148 l30 -9" stroke="#8a5a2b" stroke-width="2.2" stroke-linecap="round"/>
  <rect x="116" y="138" width="9" height="9" rx="3" transform="rotate(-17 120 142)" fill="#a8402c"/><rect x="128" y="134.5" width="9" height="9" rx="3" transform="rotate(-17 132 139)" fill="#3c9a3a"/>
  <rect x="40" y="149" width="120" height="11" rx="4" fill="#2a1c18"/>
  <path d="M46 154.5h108" stroke="${P.ember}" stroke-width="2.6" stroke-dasharray="8 4" stroke-linecap="round"/>
  <rect x="34" y="160" width="132" height="28" rx="7" fill="${P.red}"/>
  <rect x="34" y="160" width="132" height="8" rx="4" fill="${P.redLight}"/>
  <path d="M166 168 h14" stroke="#7a4a2a" stroke-width="5" stroke-linecap="round"/>
  ${text ? `<text x="100" y="183" text-anchor="middle" font-family="'Baloo 2', system-ui, sans-serif" font-weight="800" font-size="15" letter-spacing="1" fill="${P.gold}">BÀ NĂM</text>` : `<rect x="78" y="174" width="44" height="6" rx="3" fill="${P.gold}" opacity=".85"/>`}
  <circle cx="62" cy="190" r="11" fill="#2a1c18"/><circle cx="62" cy="190" r="4" fill="#c9b08e"/>
  <circle cx="138" cy="190" r="11" fill="#2a1c18"/><circle cx="138" cy="190" r="4" fill="#c9b08e"/>`;
}

/** A string of bulbs on an arc from (x0, y) to (x1, y), sagging by `sag`. */
function bulbs(x0, x1, y, sag, n = 9) {
  const pts = Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    return [x0 + (x1 - x0) * t, y + 4 * sag * t * (1 - t) + 4];
  });
  const cols = ['#ffd27a', '#ff9a5a', '#fff1c9'];
  return `<path d="M${x0} ${y} Q${(x0 + x1) / 2} ${y + 2 * sag} ${x1} ${y}" fill="none" stroke="#2a1a14" stroke-width="1.6"/>` +
    pts.map(([x, yy], i) => `<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="3.6" fill="${cols[i % 3]}"/>`).join('');
}

const defs = (id, extra = '') => `<defs>
  <pattern id="${id}-check" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f4efe6"/><rect width="3" height="3" fill="#2a2a2a"/><rect x="3" y="3" width="3" height="3" fill="#2a2a2a"/></pattern>
  <clipPath id="${id}-in"><circle cx="100" cy="100" r="84"/></clipPath>${extra}</defs>`;

const scallop = (r, n, depth) => {
  let d = '';
  for (let i = 0; i <= n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const rr = i % 2 ? r - depth : r;
    d += `${i ? 'L' : 'M'}${(100 + rr * Math.cos(a)).toFixed(1)} ${(100 + rr * Math.sin(a)).toFixed(1)} `;
  }
  return d + 'Z';
};

/** Styles 1..5 (the #93 variants). */
export function badgeSvg(style = 1, { text = true } = {}) {
  const id = `bn${style}`;
  const figure = grandma(id);
  const front = cart(text);
  let body;
  switch (style) {
    case 2: // dusk in the alley: sunset sky, string lights behind her, dark red ring
      body = defs(id, `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1d3c"/><stop offset=".6" stop-color="#a8473a"/><stop offset="1" stop-color="#f08a4a"/></linearGradient>`) +
        `<circle cx="100" cy="100" r="94" fill="${P.redDark}"/><circle cx="100" cy="100" r="88" fill="none" stroke="${P.gold}" stroke-width="1.6"/>` +
        `<g clip-path="url(#${id}-in)"><rect width="200" height="200" fill="url(#${id}-sky)"/><path d="M16 120 h30 v-34 h22 v34 M132 120 v-44 h26 v18 h26 v26" fill="#2a1626" opacity=".55"/>${bulbs(14, 186, 40, 22)}${figure}</g>` + front;
      break;
    case 3: // a ring of lettering around her
      body = defs(id, `<path id="${id}-top" d="M24 100 a76 76 0 0 1 152 0"/><path id="${id}-bot" d="M14 100 a86 86 0 0 0 172 0"/>`) +
        `<circle cx="100" cy="100" r="96" fill="${P.redDark}"/><circle cx="100" cy="100" r="70" fill="${P.cream}"/>` +
        (text ? `<text font-family="'Baloo 2', system-ui, sans-serif" font-weight="800" font-size="15" letter-spacing="2.6" fill="${P.cream}"><textPath href="#${id}-top" startOffset="50%" text-anchor="middle">BÀ NĂM’S GRILL</textPath></text>` +
          `<text font-family="'Baloo 2', system-ui, sans-serif" font-weight="700" font-size="13" letter-spacing="2" fill="${P.gold}"><textPath href="#${id}-bot" startOffset="50%" text-anchor="middle">★ HẺM SÀI GÒN ★</textPath></text>` : '') +
        `<g transform="translate(100 100) scale(.7) translate(-100 -112)"><g clip-path="url(#${id}-in)">${figure}</g>${front}</g>`;
      break;
    case 4: // a bottle-cap stamp, khăn rằn checks in the rim
      body = defs(id) + `<path d="${scallop(96, 28, 5)}" fill="${P.redDark}"/><circle cx="100" cy="100" r="86" fill="url(#${id}-check)" opacity=".9"/>` +
        `<circle cx="100" cy="100" r="80" fill="#f3b25e"/><g clip-path="url(#${id}-in)"><circle cx="100" cy="64" r="56" fill="#ffd27a" opacity=".55"/>${figure}</g>` + front;
      break;
    case 5: // flat two-tone: reads at 32 px
      body = defs(id) + `<circle cx="100" cy="100" r="94" fill="${P.redDark}"/><circle cx="100" cy="100" r="84" fill="${P.cream}"/>` +
        `<g clip-path="url(#${id}-in)">${figure.replace(/fill="url\([^)]*check\)"/g, `fill="${P.red}"`)}</g>` + front.replace(/<path d="M50 132[^>]*\/>/, '');
      break;
    default: // 1: cream stamp, double ring, the cart breaks out of the frame
      body = defs(id, `<radialGradient id="${id}-bg" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#fff6e3"/><stop offset="1" stop-color="#ecd3a8"/></radialGradient>`) +
        `<circle cx="100" cy="100" r="94" fill="${P.redDark}"/><circle cx="100" cy="100" r="86" fill="url(#${id}-bg)"/><circle cx="100" cy="100" r="80" fill="none" stroke="${P.redDark}" stroke-width="1.4" stroke-dasharray="4 3"/>` +
        `<g clip-path="url(#${id}-in)">${bulbs(18, 182, 46, 16)}${figure}</g>` + front;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 208 212" role="img" aria-hidden="true">${body}</svg>`;
}
