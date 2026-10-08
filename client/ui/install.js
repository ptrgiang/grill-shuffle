// "Install app": the browser's own install prompt when it offers one (Chrome / Edge / Samsung Internet fire
// beforeinstallprompt), otherwise step-by-step instructions for the platform the player is on.
import { h } from './dom.js';
import { t } from '../i18n/index.js';

let deferred = null; // the captured beforeinstallprompt event
let installedNow = false; // installed during this visit (this tab stays a browser tab)
const listeners = new Set();
const changed = () => listeners.forEach((fn) => fn());

/** Running as the installed app (standalone window / home screen), not in a browser tab. */
export const isInstalled = () =>
  matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui), (display-mode: window-controls-overlay)').matches ||
  navigator.standalone === true;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep the mini-infobar away; the menu has its own button
    deferred = e;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    changed();
  });
  // the window title of the installed app is just the name, not the SEO title
  if (isInstalled()) document.title = t('app.name');
}

export function platform(ua = navigator.userAgent, touch = navigator.maxTouchPoints > 1) {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch)) return 'ios'; // iPadOS reports as a Mac
  if (/Android/.test(ua)) return 'android';
  if (/Firefox\//.test(ua)) return 'firefox-desktop';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua)) return 'mac-safari';
  return 'desktop';
}

// texts: install.<platform>.title / .steps in client/i18n
const PLATFORMS = ['ios', 'android', 'desktop', 'mac-safari', 'firefox-desktop'];

/** Calls `onChange` whenever the native prompt becomes available or the app gets installed. */
export function onInstallChange(onChange) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export const canPrompt = () => !!deferred;
export const installedThisVisit = () => installedNow;

/** Shows the native prompt. Resolves true if the player accepted. */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  e.prompt();
  const { outcome } = await e.userChoice;
  changed();
  return outcome === 'accepted';
}

/** Modal content: this platform's steps first, the others folded below. */
export function installGuide(current = platform()) {
  const block = (key) => h('div.install-steps', h('h3', t(`install.${key}.title`)), h('ol', t(`install.${key}.steps`).map((s) => h('li', s))));
  const others = PLATFORMS.filter((k) => k !== current && k !== 'firefox-desktop');
  return [
    h('h2', t('install.title')),
    h('p.muted', t('install.intro')),
    block(current),
    h('details.install-more', h('summary', t('install.others')), others.map(block)),
  ];
}
