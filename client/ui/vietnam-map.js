// The journey map's picture of Vietnam (#84, owner pick 3 + 4): an old paper map drawn in code (no image to load,
// works offline). Pure SVG strings; the screen (client/ui/journey.js) puts the pins, the cart and Bà Năm over it.
//
// Coordinates: longitude / latitude, projected by P() into the viewBox below (12 units a degree of longitude from
// 101.4°E, 12.5 a degree of latitude from 23.9°N). The outline is hand-traced and smoothed, a picture, not a survey.

export const VIEW = { x: 0, y: 0, w: 168, h: 200 };
export const P = (lon, lat) => [+((lon - 101.4) * 12).toFixed(1), +((23.9 - lat) * 12.5).toFixed(1)];

// mainland, clockwise from the northwest corner (Lai Châu): the northern border, the coast down to Cà Mau, then the
// Cambodian and Lao borders back north
const OUTLINE = [
  [102.14, 22.4], [102.48, 22.77], [103.03, 22.45], [103.33, 22.8], [103.97, 22.5], [104.25, 22.77], [104.8, 22.82],
  [105.33, 23.32], [105.88, 22.92], [106.7, 22.86], [106.55, 22.46], [106.8, 22.0], [107.35, 21.6], [107.97, 21.53],
  [107.4, 21.25], [106.8, 20.95], [106.55, 20.55], [106.0, 19.95], [105.85, 19.55], [105.75, 19.05], [105.95, 18.6],
  [106.25, 18.25], [106.55, 17.85], [106.85, 17.4], [107.15, 16.95], [107.55, 16.6], [108.0, 16.3], [108.25, 16.08],
  [108.35, 15.75], [108.65, 15.3], [108.85, 14.9], [109.0, 14.4], [109.2, 13.8], [109.3, 13.1], [109.45, 12.85],
  [109.2, 12.6], [109.25, 12.1], [109.15, 11.75], [108.95, 11.4], [108.55, 11.0], [108.1, 10.85], [107.6, 10.55],
  [107.2, 10.4], [106.8, 10.35], [106.75, 10.0], [106.55, 9.6], [106.2, 9.4], [105.8, 9.2], [105.5, 8.95], [105.15, 8.6],
  [104.8, 8.6], [104.85, 9.0], [104.85, 9.6], [105.05, 10.0], [104.85, 10.3], [104.45, 10.42], [105.05, 10.9],
  [105.85, 10.85], [106.15, 11.1], [106.45, 11.65], [106.95, 11.95], [107.55, 12.3], [107.55, 12.85], [107.55, 13.4],
  [107.45, 14.0], [107.55, 14.7], [107.3, 15.0], [107.65, 15.45], [107.15, 15.9], [106.85, 16.3], [106.5, 16.55],
  [106.25, 17.1], [105.8, 17.6], [105.6, 18.05], [105.15, 18.5], [104.6, 18.85], [103.95, 19.2], [104.4, 19.65],
  [104.1, 20.4], [103.7, 20.65], [103.2, 20.85], [102.85, 21.2], [102.95, 21.7], [102.6, 21.9],
];
// the neighbours, one muted mass behind Vietnam (no borders or names drawn): the frame's top-left corner, the
// south China coast, inland down Vietnam's west (hidden under it), the Cambodian and Thai coast, the frame's left edge
const NEIGHBOURS = [
  [101.0, 24.3], [116.0, 24.3], [116.0, 22.9], [113.6, 22.2], [111.6, 21.55], [110.45, 21.25], [110.25, 20.35],
  [109.75, 21.45], [108.6, 21.7], [107.97, 21.53], [106.9, 21.4], [105.6, 19.4], [106.1, 17.6], [107.0, 15.4],
  [107.1, 12.8], [106.1, 11.2], [104.45, 10.42], [104.05, 10.62], [103.55, 10.55], [103.1, 11.25], [102.6, 12.0],
  [102.2, 12.35], [101.0, 12.7],
];
// islands: [lon, lat, rx, ry] in degrees
const HAINAN = [109.65, 19.2, 0.95, 0.68];
const ISLANDS = [[103.97, 10.25, 0.18, 0.3], [106.6, 8.7, 0.1, 0.07], [107.6, 20.95, 0.12, 0.06], [108.1, 21.0, 0.1, 0.05]];
const ARCHIPELAGOS = [
  { at: [111.9, 16.4], label: 'paracel', dots: [[0, 0], [0.6, 0.3], [-0.5, 0.5], [0.3, -0.5], [1.0, -0.2], [-0.2, 0.9]] },
  { at: [113.9, 9.9], label: 'spratly', dots: [[0, 0], [0.7, 0.6], [-0.6, -0.4], [1.2, -0.3], [-1.0, 0.7], [0.3, 1.2], [1.6, 1.0]] },
];
const RIVERS = [
  [[103.7, 22.4], [104.4, 21.95], [105.2, 21.35], [105.85, 21.03], [106.25, 20.6], [106.55, 20.3]], // Sông Hồng
  [[105.05, 10.95], [105.45, 10.5], [105.85, 10.1], [106.35, 9.6]], // Tiền / Hậu, the Mekong's two arms
  [[105.25, 10.95], [105.75, 10.4], [106.25, 10.05], [106.65, 9.85]],
];
// the Hoàng Liên Sơn and the Trường Sơn range, as little ink peaks
const PEAKS = [
  [103.6, 22.15], [104.05, 21.85], [103.35, 21.6], [104.7, 22.3], [105.6, 22.45], [104.3, 21.2], [104.75, 20.7],
  [105.3, 19.4], [105.85, 18.3], [106.3, 17.6], [106.95, 16.55], [107.45, 15.65], [107.85, 14.75], [108.1, 13.9],
  [108.0, 12.95], [108.4, 12.2],
];

/** A closed (or open) path through the points, smoothed with quadratic curves through the midpoints. */
export function smoothPath(points, closed = true) {
  const pts = points.map((p) => P(...p));
  const mid = (a, b) => [+((a[0] + b[0]) / 2).toFixed(1), +((a[1] + b[1]) / 2).toFixed(1)];
  if (!closed) {
    let d = `M${pts[0].join(' ')}`;
    for (let i = 1; i < pts.length - 1; i++) d += ` Q${pts[i].join(' ')} ${mid(pts[i], pts[i + 1]).join(' ')}`;
    return `${d} L${pts.at(-1).join(' ')}`;
  }
  const n = pts.length;
  let d = `M${mid(pts[n - 1], pts[0]).join(' ')}`;
  for (let i = 0; i < n; i++) d += ` Q${pts[i].join(' ')} ${mid(pts[i], pts[(i + 1) % n]).join(' ')}`;
  return `${d} Z`;
}

const ellipse = ([lon, lat, rx, ry]) => { const [x, y] = P(lon, lat); return `<ellipse cx="${x}" cy="${y}" rx="${rx * 12}" ry="${ry * 12.5}"/>`; };

/**
 * The map: sea, graticule, compass, land (with peaks and rivers), islands, the route through the stops.
 * `places`: [lon, lat] per stop; `reached`: how many stops the cart has reached (the solid part of the route);
 * `labels`: { sea, paracel, spratly } in the player's language.
 */
export function mapSvg({ places, reached, labels }) {
  const land = smoothPath(OUTLINE);
  const pts = places.map((p) => P(...p));
  const line = (list) => list.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const grat = [];
  for (let lon = 102; lon <= 115; lon += 2) grat.push(`M${P(lon, 24)[0]} 0V${VIEW.h}`);
  for (let lat = 10; lat <= 23; lat += 2) grat.push(`M0 ${P(102, lat)[1]}H${VIEW.w}`);
  const peaks = PEAKS.map((p) => { const [x, y] = P(...p); return `M${x - 2.4} ${y + 1.6}L${x} ${y - 1.8}L${x + 2.4} ${y + 1.6}`; }).join('');
  const arch = ARCHIPELAGOS.map(({ at, label, dots }) => {
    const [x, y] = P(...at);
    const ds = dots.map(([dx, dy]) => `<circle cx="${(x + dx * 3).toFixed(1)}" cy="${(y + dy * 3).toFixed(1)}" r="${dx === 0 && dy === 0 ? 1.3 : 0.9}"/>`).join('');
    return `<g class="jm-arch">${ds}<text x="${x + 2}" y="${y - 6}" text-anchor="middle">${labels[label]}</text></g>`;
  }).join('');
  const [cx, cy] = [20, 182];
  return `<svg viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="jm-waves" width="14" height="8" patternUnits="userSpaceOnUse"><path d="M0 5q3.5-3 7 0t7 0" fill="none" stroke="#9cc3cf" stroke-width=".5" opacity=".55"/></pattern>
    <radialGradient id="jm-sea" cx="60%" cy="45%" r="75%"><stop offset="0" stop-color="#cfe6e4"/><stop offset="1" stop-color="#a9cfd2"/></radialGradient>
    <linearGradient id="jm-land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3e2bf"/><stop offset="1" stop-color="#e6cfa0"/></linearGradient>
    <filter id="jm-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.2" flood-color="#5d4a2c" flood-opacity=".35"/></filter>
  </defs>
  <rect width="${VIEW.w}" height="${VIEW.h}" fill="url(#jm-sea)"/>
  <rect width="${VIEW.w}" height="${VIEW.h}" fill="url(#jm-waves)"/>
  <path d="${grat.join('')}" stroke="#7fa9b3" stroke-width=".35" stroke-dasharray="1.5 2" opacity=".6"/>
  <text class="jm-sea-label" x="${P(112.6, 12.2)[0]}" y="${P(112.6, 12.2)[1]}" text-anchor="middle">${labels.sea}</text>
  <g class="jm-compass" transform="translate(${cx} ${cy})"><circle r="9" fill="none" stroke="#7a5a3a" stroke-width=".5"/><path d="M0 -12L2 0L0 12L-2 0Z" fill="#7a5a3a"/><path d="M-12 0L0 2L12 0L0 -2Z" fill="#b39572"/><path d="M0 -12L2 0L-2 0Z" fill="#b32d24"/><text y="-14">N</text></g>
  <path d="${smoothPath(NEIGHBOURS)}" fill="#ddd2ba" stroke="#b9a988" stroke-width=".5"/>
  <g fill="#ddd2ba" stroke="#b9a988" stroke-width=".5">${ellipse(HAINAN)}</g>
  <path d="${land}" fill="#c9b48a" transform="translate(0.9 1.4)" opacity=".55"/>
  <path d="${land}" fill="url(#jm-land)" stroke="#8a6a44" stroke-width=".7" stroke-linejoin="round" filter="url(#jm-shadow)"/>
  <g fill="url(#jm-land)" stroke="#8a6a44" stroke-width=".5">${ISLANDS.map(ellipse).join('')}</g>
  <g fill="#8a6a44">${arch}</g>
  <path d="${peaks}" fill="none" stroke="#a88a5c" stroke-width=".7" stroke-linejoin="round" stroke-linecap="round"/>
  <g fill="none" stroke="#6fa8c0" stroke-width=".9" stroke-linecap="round">${RIVERS.map((r) => `<path d="${smoothPath(r, false)}"/>`).join('')}</g>
  <path class="jm-route" d="${line(pts)}" fill="none" stroke="#7e1f1a" stroke-width="1.1" stroke-dasharray="2.2 2.2" stroke-linecap="round" opacity=".75"/>
  <path class="jm-route-done" d="${line(pts.slice(0, reached))}" fill="none" stroke="#d2462a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}
