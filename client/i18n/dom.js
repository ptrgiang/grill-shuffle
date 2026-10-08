// Static page text (index.html landing, noscript, canvas label) in the current language: elements carry
// data-i18n="key" (text), data-i18n-html="key" (trusted markup from our own dictionaries) or data-i18n-aria="key".
import { t, lang } from './index.js';

export function applyStatic(root = document) {
  root.documentElement && (root.documentElement.lang = lang());
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}
