// Minimal DOM helpers. The UI is plain DOM over the canvas; no framework.

/** h('div.class#id', { attrs, on: {click} }, ...children) */
export function h(tag, props = {}, ...children) {
  const [name, ...rest] = tag.split(/(?=[.#])/);
  const el = document.createElement(name || 'div');
  for (const r of rest) {
    if (r[0] === '.') el.classList.add(r.slice(1));
    else if (r[0] === '#') el.id = r.slice(1);
  }
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = {};
  }
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

export const icons = {
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12h9a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  hint: '<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3Z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9.5 20.5h5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="m16 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="m8.3 10.8 7.4-3.6m-7.4 6 7.4 3.6" stroke="currentColor" stroke-width="2"/></svg>',
  tongs: '<svg viewBox="0 0 24 24"><path d="M5 3l7 12M19 3l-7 12M12 15v6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M10.2 2.6a1.6 1.6 0 0 1 3.2 0V11l4.6.9a2.4 2.4 0 0 1 1.9 2.7l-.8 5.1a3 3 0 0 1-3 2.5h-5.3a3 3 0 0 1-2.4-1.2l-3.6-4.8a1.6 1.6 0 0 1 2.5-2l2.9 2.9Z"/></svg>',
  fan: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7s2 5-4 7Zm2 2c4 0 7 1 7 4s-5 2-7-4Zm-2 2c0 4-1 7-4 7s-2-5 4-7Zm-2-2c-4 0-7-1-7-4s5-2 7 4Z"/></svg>',
};

export const iconEl = (name, cls = 'ico') => h(`span.${cls}`, { html: icons[name], 'aria-hidden': 'true' });

let toastTimer = null;
export function toast(text, ms = 2200) {
  let t = document.querySelector('.toast');
  if (!t) document.body.append((t = h('div.toast', { role: 'status' })));
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/** Floating text at a screen position (score popups). */
export function floatText(layer, text, x, y, cls = '') {
  const el = h(`div.float${cls ? '.' + cls : ''}`, { style: { left: `${x}px`, top: `${y}px` } }, text);
  layer.append(el);
  setTimeout(() => el.remove(), 1100);
}

export function starsEl(n, total = 3, cls = 'stars') {
  return h(`div.${cls}`, Array.from({ length: total }, (_, i) => h(`span.star${i < n ? '.on' : ''}`, { html: icons.star, style: { '--i': i } })));
}
