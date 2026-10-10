// The journey map (#84, owner pick: postcards + the map of Vietnam): replaces the tab per pack. A map of the
// country with a pin per stop (the cart where it is, Bà Năm one stop ahead), and below it one postcard per stop; the
// focused stop's postcard is turned over to show its levels. Draws journeyModel() (client/game/journey.js).
import { h, starsEl } from './dom.js';
import { t, pick } from '../i18n/index.js';
import { resolveTheme } from '../../shared/themes.js';
import { lockReason } from '../game/unlock.js';
import { mapSvg, P, VIEW } from './vietnam-map.js';

const CART = '<svg viewBox="0 0 48 40"><path d="M6 8h28l-2 18H8z" fill="#c9cfd2" stroke="#5c6266" stroke-width="2"/><path d="M9 11h22v7H10z" fill="#9fd4e6" opacity=".8"/><path d="M34 10h8" stroke="#7a4a2a" stroke-width="3" stroke-linecap="round"/><circle cx="13" cy="31" r="6" fill="none" stroke="#3a3440" stroke-width="2.6"/><circle cx="29" cy="31" r="6" fill="none" stroke="#3a3440" stroke-width="2.6"/><path d="M13 25v12M7 31h12M29 25v12M23 31h12" stroke="#3a3440" stroke-width="1.2"/><path d="M8 6q12-5 26 0" fill="none" stroke="#ffb347" stroke-width="2" stroke-dasharray="2 3"/></svg>';
const BANAM = '<svg viewBox="0 0 32 40"><circle cx="16" cy="10" r="6.5" fill="#f2c6a0"/><path d="M9 9q0-7 7-7t7 7q-3-3-7-3t-7 3z" fill="#e9e4dc"/><circle cx="16" cy="2.6" r="2.8" fill="#e9e4dc"/><path d="M5 38q1-17 11-17t11 17z" fill="#3e4c7c"/><path d="M11 22q5 5 10 0" fill="none" stroke="#7e1f1a" stroke-width="2.2"/><path d="M26 30h5v8h-6z" fill="#d9b779"/></svg>';
const MARK = {
  page: '<svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5z" fill="#fff3e3" stroke="#7a4a2a" stroke-width="1.6"/><path d="M8 10h8M8 13.5h8M8 17h5" stroke="#7a4a2a" stroke-width="1.4"/></svg>',
  beat: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#ff7b54"/><path d="M10 8.5v7l5.5-3.5z" fill="#fff3e3"/></svg>',
  keepsake: '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1.5" fill="#fff3e3" stroke="#7a4a2a" stroke-width="1.6"/><rect x="14" y="8" width="4" height="4.5" fill="#ff7b54"/><path d="M6.5 11h6M6.5 14h5" stroke="#7a4a2a" stroke-width="1.3"/></svg>',
};

// where each stop is (docs/STORY.md "The five stops"): the Saigon alley, a central-coast fishing village, the lantern
// town by a river, the northwest highlands, the rooftop above where the alley was (beside the alley's pin)
export const PLACES = [[106.85, 11.15], [109.2, 13.45], [108.33, 15.88], [103.85, 22.3], [105.95, 10.3]];

/** A style attribute from an object: custom properties (--j-*) cannot be assigned through el.style. */
const css = (o) => Object.entries(o).map(([k, v]) => `${k}: ${v}`).join('; ');

const svgEl = (cls, svg, label) => h(`span.${cls}`, label ? { html: svg, role: 'img', 'aria-label': label } : { html: svg, 'aria-hidden': 'true' });
const cartEl = () => svgEl('j-cart', CART, t('journey.cart'));
const banamEl = (withLabel = true) => h('span.j-banam', svgEl('j-banam-art', BANAM, withLabel ? null : t('journey.banamAhead')), withLabel ? h('span.j-banam-tag', t('journey.banamAhead')) : null);
const markEl = (mark) => (mark ? svgEl(`j-mark.j-mark-${mark}`, MARK[mark], t(`journey.mark.${mark}`)) : null);

/** A stop's colours from its theme: the stage background, the ember glow and the table. */
function colours(stop, themes) {
  if (stop.teaser) return { bg: '#3a3040', glow: '#8a7e8e', table: '#4a4050' };
  const th = resolveTheme(themes[stop.pack.theme] ?? {});
  return { bg: th.palette.background, glow: th.grill.ember.hot, table: th.table.color };
}

const stopName = (stop) => (stop.teaser ? t('journey.unknown') : pick(stop.pack.name));
const stopSub = (stop) => (stop.teaser ? t('journey.soon') : stop.open ? `★ ${stop.stars}/${stop.total}` : lockReason(stop.status));

function stopIcon(stop, ctx) {
  if (stop.teaser) return h('span.j-stop-icon.j-unknown', { 'aria-hidden': 'true' }, '?');
  const svg = ctx.themeIcons[stop.pack.theme];
  if (svg) return h('span.j-stop-icon', { 'aria-hidden': 'true', html: svg });
  const c = colours(stop, ctx.themes);
  return h('span.j-stop-icon', { 'aria-hidden': 'true', style: { background: `linear-gradient(135deg, ${c.bg} 0 45%, ${c.glow} 45% 60%, ${c.table} 60%)` } });
}

/** A level on the postcard's back: a link when open, else a locked spot. */
function node(level, ctx) {
  const name = pick(ctx.getLevel(level.id)?.name) || level.id;
  const cls = `.j-node${level.current ? '.current' : ''}${level.stars ? '.done' : ''}`;
  const label = `${t('level.label', { n: level.n })}: ${name}`;
  const body = [h('span.j-num', String(level.n)), level.stars ? starsEl(level.stars, 3, 'stars.tiny') : null, markEl(level.mark), level.current ? cartEl() : null];
  return level.open
    ? h(`a${cls}`, { href: ctx.levelPath(level.id), 'data-nav': true, 'data-level': level.id, title: name, 'aria-label': label }, ...body)
    : h(`div${cls}.locked`, { 'data-level': level.id, title: name }, ...body);
}

function head(model, ctx) {
  return h('header.levels-head.j-head',
    h('a.btn.ghost', { href: '/', 'data-nav': true }, t('common.backToMenu')),
    h('h2', t('journey.title')),
    h('a.btn.j-daily', { href: '/daily', 'data-nav': true }, h('span', t('menu.daily')), ctx.streak ? h('span.badge', `🔥 ${ctx.streak}`) : null),
    h('span.badge.j-total', `★ ${model.stars}/${model.total}`),
  );
}

/** The stop the screen opens on: the one asked for (/levels/<slug>), else the cart's. */
export const focusIndex = (model, packId) => Math.max(0, packId ? model.stops.findIndex((s) => s.pack?.id === packId) : model.cart);

/** Where a stop's pin sits over the map, in % of the map box. */
function pinAt(k) {
  const [x, y] = P(...PLACES[k % PLACES.length]);
  return { left: ((x - VIEW.x) / VIEW.w) * 100, top: ((y - VIEW.y) / VIEW.h) * 100 };
}

function map(model, ctx, sel) {
  const labels = { sea: t('journey.sea'), paracel: t('journey.paracel'), spratly: t('journey.spratly') };
  const pins = model.stops.map((stop, k) => {
    const c = colours(stop, ctx.themes);
    const { left, top } = pinAt(k);
    const cls = `.j-pin-at${k === sel ? '.sel' : ''}${stop.open ? '' : '.locked'}${stop.teaser ? '.teaser' : ''}${k === 4 ? '.west' : ''}`;
    const inner = [
      h('span.j-pin', { style: css({ '--j-glow': c.glow }) }, stop.teaser ? '?' : String(stop.n)),
      stop.teaser ? null : h('span.j-pin-label', stopName(stop)),
      stop.banam ? banamEl(false) : null,
    ];
    const style = css({ left: `${left}%`, top: `${top}%` });
    return stop.pack
      ? h(`a${cls}`, { href: ctx.levelsPath(stop.pack), 'data-nav': true, 'data-pack': stop.pack.id, style, 'aria-label': `${t('journey.stop', { n: stop.n })}: ${stopName(stop)}` }, ...inner)
      : h(`div${cls}`, { 'data-pack': `stop-${stop.n}`, style, 'aria-label': `${t('journey.stop', { n: stop.n })}: ${stopName(stop)}` }, ...inner);
  });
  // the cart on the map: at its stop; after moving on to a new stop it rolls there from the last one (journeyScreen)
  const at = pinAt(model.cart);
  const cart = h('span.j-map-cart', { style: css({ left: `${at.left}%`, top: `${at.top}%` }) }, cartEl());
  return h('div.j-map', h('span.j-map-svg', { 'aria-hidden': 'true', html: mapSvg({ places: PLACES.slice(0, model.stops.length), reached: model.cart + 1, labels }) }), cart, ...pins);
}

function postcard(stop, k, sel, ctx) {
  const c = colours(stop, ctx.themes);
  const open = k === sel && !stop.teaser;
  const front = h('div.j-card-front', { style: css({ '--j-bg': c.bg, '--j-glow': c.glow }) },
    h('div.j-card-art', stopIcon(stop, ctx)),
    h('div.j-card-text',
      h('span.j-stop-n', t('journey.stop', { n: stop.n })),
      h('span.j-card-name', stopName(stop)),
      h('span.j-stop-sub', stopSub(stop)),
      stop.banam ? h('span.j-card-banam', banamEl()) : null,
    ),
    h('span.j-stamp', { 'aria-hidden': 'true' }, stop.teaser ? '?' : String(stop.n)),
    stop.cart ? h('span.j-card-cart', cartEl()) : null,
  );
  return h(`article.j-card${open ? '.open' : ''}${stop.open ? '' : '.locked'}${stop.teaser ? '.teaser' : ''}`, { 'data-pack': stop.pack?.id ?? `stop-${stop.n}`, 'aria-current': open ? 'page' : null },
    stop.pack && !open ? h('a.j-card-link', { href: ctx.levelsPath(stop.pack), 'data-nav': true }, front) : front,
    open ? h('div.j-card-back', h('div.j-dots', ...stop.levels.map((l) => node(l, ctx)))) : null,
  );
}

/**
 * The journey screen. ctx: { themes, themeIcons, getLevel, levelPath, levelsPath, packId, streak }.
 * After it is on screen call showCart(el, from) to bring the cart into view (and roll it on the map).
 */
export function journeyScreen(model, ctx) {
  const sel = focusIndex(model, ctx.packId);
  return h('div.levels.journey', head(model, ctx),
    h('div.j-layout',
      h('div.j-mapcol', map(model, ctx, sel)),
      h('div.j-cards', ...model.stops.map((stop, k) => postcard(stop, k, sel, ctx))),
    ),
  );
}

/**
 * Scroll to the stop asked for (/levels/<slug>) or to the cart's level. `from`: the stop the cart was at the last time
 * the map was shown; when it moved on, it rolls along the route on the map (≤ 0.6 s, not with reduced motion).
 */
export function showCart(el, { packId = null, from = null, cart = 0, reduced = false } = {}) {
  const target = packId ? el.querySelector(`.j-card[data-pack="${packId}"]`) : el.querySelector('.j-node.current') ?? el.querySelector('.j-card.open');
  target?.scrollIntoView({ block: packId ? 'start' : 'center' });
  const mapCart = el.querySelector('.j-map-cart');
  if (!mapCart || reduced || from === null || from === cart) return;
  const to = { left: mapCart.style.left, top: mapCart.style.top };
  const start = pinAt(from);
  mapCart.style.transition = 'none';
  Object.assign(mapCart.style, { left: `${start.left}%`, top: `${start.top}%` });
  void mapCart.offsetWidth; // apply the start before the transition
  mapCart.style.transition = '';
  mapCart.classList.add('rolling');
  Object.assign(mapCart.style, to);
}
