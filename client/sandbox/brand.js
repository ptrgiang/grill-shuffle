import { badgeSvg } from '../ui/brand.js';

const q = new URLSearchParams(location.search);
const one = Number(q.get('style') ?? q.get('variant')); // ?variant: variant-shots captures one style per variant
const styles = one >= 1 && one <= 5 ? [one] : [1, 2, 3, 4, 5];
document.getElementById('out').innerHTML = styles
  .map((s) => `<div class="cell">${s}<div class="big">${badgeSvg(s)}</div><div class="small"><div class="s64">${badgeSvg(s, { text: false })}</div><div class="s32">${badgeSvg(s, { text: false })}</div></div></div>`)
  .join('');
document.fonts.ready.then(() => (window.__sandboxReady = true));
