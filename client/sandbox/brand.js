import { badgeSvg } from '../ui/brand.js';
import vi from '../i18n/vi.js';
import en from '../i18n/en.js';

// default: the badge big, then at 64 / 32 / 16 px as the app icon and the favicon show it. ?variant=1..5 (or
// ?scene=): one #93 prototype scene; ?all=1: every scene side by side.
// ?og=1: the 1200x630 share card (client/public/og.png):
//   npm run shot -- "/sandbox/brand?og=1" --w 1200 --h 630 --out client/public/og.png
const q = new URLSearchParams(location.search);
const scene = Number(q.get('scene') ?? q.get('variant')) || 1;
const out = document.getElementById('out');
const sizes = (s, k) => [300, 64, 32].map((w, i) => `<div style="width:${w}px">${badgeSvg({ id: `b${k}${i}`, scene: s })}</div>`).join('');
if (q.get('og') === '1') {
  document.body.classList.add('og');
  out.innerHTML = `<div class="og-badge">${badgeSvg({ scene })}</div>
    <div class="og-text"><h1 class="title">${en['app.name']}</h1><p class="og-en">${en['app.subtitle']}</p><p class="og-vi">${vi['app.subtitle']}</p></div>`;
} else if (q.get('all') === '1') {
  out.innerHTML = [1, 2, 3, 4, 5].map((s) => `<div class="cell">${s}<div style="width:300px">${badgeSvg({ id: `a${s}`, scene: s })}</div></div>`).join('');
} else {
  out.innerHTML = sizes(scene, 's');
}
document.fonts.ready.then(() => (window.__sandboxReady = true));
