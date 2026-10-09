import { badgeSvg } from '../ui/brand.js';
import vi from '../i18n/vi.js';
import en from '../i18n/en.js';

// default: the badge big, then at 64 / 32 / 16 px as the app icon and the favicon show it.
// ?og=1: the 1200x630 share card (client/public/og.png):
//   npm run shot -- "/sandbox/brand?og=1" --w 1200 --h 630 --out client/public/og.png
const out = document.getElementById('out');
if (new URLSearchParams(location.search).get('og') === '1') {
  document.body.classList.add('og');
  out.innerHTML = `<div class="og-badge">${badgeSvg()}</div>
    <div class="og-text"><h1 class="title">${en['app.name']}</h1><p class="og-en">${en['app.subtitle']}</p><p class="og-vi">${vi['app.subtitle']}</p></div>`;
} else {
  out.innerHTML = [300, 64, 32, 16].map((w, i) => `<div style="width:${w}px">${badgeSvg({ id: `b${i}` })}</div>`).join('');
}
document.fonts.ready.then(() => (window.__sandboxReady = true));
