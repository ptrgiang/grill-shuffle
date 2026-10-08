// Service worker registration (production builds only; see client/sw.js) and the "new version" prompt.
//
// A deploy ships a new sw.js. The browser installs it in the background (it precaches the new build) and it then
// waits: the open game keeps running on the old files. We show a small bar; "Update" tells the waiting worker to
// take over and reloads once it controls the page. Ignoring it is fine: the new version starts on the next launch
// once every tab of the old one is closed.
import { h } from './dom.js';
import { t } from '../i18n/index.js';

let bar = null;

function showUpdate(reg) {
  if (bar?.isConnected) return;
  bar = h('div.update-bar', { role: 'status' },
    h('span', t('update.ready')),
    h('button.btn.primary', { on: { click: () => reg.waiting?.postMessage({ type: 'skip-waiting' }) } }, t('update.update')),
    h('button.btn.ghost', { 'aria-label': t('update.later'), on: { click: () => bar.remove() } }, '✕'),
  );
  document.body.append(bar);
}

export async function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  let reg;
  try {
    reg = await navigator.serviceWorker.register('/sw.js');
  } catch {
    return; // no offline mode (private window, blocked storage...), the game still runs from the network
  }
  // a reload only when an update we prompted for takes over, never on the first install
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  const watch = (sw) => sw?.addEventListener('statechange', () => {
    if (sw.state === 'installed' && navigator.serviceWorker.controller) showUpdate(reg);
  });
  if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg);
  watch(reg.installing);
  reg.addEventListener('updatefound', () => watch(reg.installing));

  // an installed app can stay open for days: look for a deploy when it comes back to the foreground
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reg.update().catch(() => {});
  });
}
