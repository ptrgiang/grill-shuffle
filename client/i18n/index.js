// Every player-facing string, in Vietnamese and English (owner, 2026-10-08: both languages in the same change, never
// an English-only string). Pure: no DOM at import, so pure modules (unlock.js, daily.js) and node tests use it too.
//
//   t('menu.play')                    the current language's text ('en' until setLang)
//   t('win.solved', { moves, min })   a string with {name} placeholders, or a function of the params
//   pick(level.name)                  content text: a plain string (legacy) or { vi, en }
//
// Dictionaries: vi.js and en.js, same keys (tests/client/i18n.test.js). A value is a string, a function of the params
// or an array (install steps). Missing in the current language → English → the key itself.
import en from './en.js';
import vi from './vi.js';

export const LANGS = Object.freeze(['vi', 'en']);
export const DICTS = Object.freeze({ vi, en });

let current = 'en';
const listeners = new Set();

export const lang = () => current;

/** The language to start with: the saved choice, else the browser's first vi / en preference, else English. */
export function detectLang(saved, preferred = []) {
  if (LANGS.includes(saved)) return saved;
  for (const p of preferred) {
    const base = String(p).toLowerCase().slice(0, 2);
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}

/** Switch language; listeners re-render. Returns whether it changed. */
export function setLang(l) {
  if (!LANGS.includes(l) || l === current) return false;
  current = l;
  for (const fn of listeners) fn(l);
  return true;
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const fill = (s, params) => s.replace(/\{(\w+)\}/g, (m, k) => (params && k in params ? String(params[k]) : m));

export function t(key, params) {
  const v = DICTS[current][key] ?? DICTS.en[key];
  if (v === undefined) return key;
  if (typeof v === 'function') return v(params ?? {});
  return typeof v === 'string' ? fill(v, params) : v;
}

/** Content text in the current language: `{ vi, en }`, or a legacy plain string (shown as is). */
export function pick(text) {
  if (text == null || typeof text === 'string') return text ?? '';
  return text[current] ?? text.en ?? text.vi ?? '';
}
