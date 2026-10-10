// The journey map (#84): one road through every stop instead of a tab per pack. Draws journeyModel()
// (client/game/journey.js). Design prototypes behind ?variant=1..5 (CONTRIBUTING.md step 0) until the owner picks one:
//   1 winding road (vertical)   2 long panorama (horizontal)   3 postcards per stop   4 map of Vietnam   5 notebook pages
import { h, iconEl, starsEl } from './dom.js';
import { t, pick } from '../i18n/index.js';
import { resolveTheme } from '../../shared/themes.js';
import { lockReason } from '../game/unlock.js';

// ---------------------------------------------------------------- shared pieces

const CART = '<svg viewBox="0 0 48 40"><path d="M6 8h28l-2 18H8z" fill="#c9cfd2" stroke="#5c6266" stroke-width="2"/><path d="M9 11h22v7H10z" fill="#9fd4e6" opacity=".8"/><path d="M34 10h8" stroke="#7a4a2a" stroke-width="3" stroke-linecap="round"/><circle cx="13" cy="31" r="6" fill="none" stroke="#3a3440" stroke-width="2.6"/><circle cx="29" cy="31" r="6" fill="none" stroke="#3a3440" stroke-width="2.6"/><path d="M13 25v12M7 31h12M29 25v12M23 31h12" stroke="#3a3440" stroke-width="1.2"/><path d="M8 6q12-5 26 0" fill="none" stroke="#ffb347" stroke-width="2" stroke-dasharray="2 3"/></svg>';
const BANAM = '<svg viewBox="0 0 32 40"><circle cx="16" cy="10" r="6.5" fill="#f2c6a0"/><path d="M9 9q0-7 7-7t7 7q-3-3-7-3t-7 3z" fill="#e9e4dc"/><circle cx="16" cy="2.6" r="2.8" fill="#e9e4dc"/><path d="M5 38q1-17 11-17t11 17z" fill="#3e4c7c"/><path d="M11 22q5 5 10 0" fill="none" stroke="#7e1f1a" stroke-width="2.2"/><path d="M26 30h5v8h-6z" fill="#d9b779"/></svg>';
const MARK = {
  page: '<svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5z" fill="#fff3e3" stroke="#7a4a2a" stroke-width="1.6"/><path d="M8 10h8M8 13.5h8M8 17h5" stroke="#7a4a2a" stroke-width="1.4"/></svg>',
  beat: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#ff7b54"/><path d="M10 8.5v7l5.5-3.5z" fill="#fff3e3"/></svg>',
  keepsake: '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1.5" fill="#fff3e3" stroke="#7a4a2a" stroke-width="1.6"/><rect x="14" y="8" width="4" height="4.5" fill="#ff7b54"/><path d="M6.5 11h6M6.5 14h5" stroke="#7a4a2a" stroke-width="1.3"/></svg>',
};

/** A style attribute from an object: custom properties (--j-*) cannot be assigned through el.style. */
const css = (o) => Object.entries(o).map(([k, v]) => `${k}: ${v}`).join('; ');

const svgEl = (cls, svg, label) => h(`span.${cls}`, label ? { html: svg, role: 'img', 'aria-label': label } : { html: svg, 'aria-hidden': 'true' });
const cartEl = () => svgEl('j-cart', CART, t('journey.cart'));
const banamEl = (withLabel = true) => h('span.j-banam', svgEl('j-banam-art', BANAM), withLabel ? h('span.j-banam-tag', t('journey.banamAhead')) : null);
const markEl = (mark) => (mark ? svgEl(`j-mark.j-mark-${mark}`, MARK[mark], t(`journey.mark.${mark}`)) : null);

/** A stop's colours from its theme: the stage background, the ember glow and the table. */
function colours(stop, themes) {
  if (stop.teaser) return { bg: '#2a2230', glow: '#6c6070', table: '#4a4050' };
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

/** A level on the road: a link when open, else a locked spot. `small`: number only (dense layouts). */
function node(level, ctx, { small = false } = {}) {
  const name = pick(ctx.getLevel(level.id)?.name) || level.id;
  const cls = `.j-node${level.current ? '.current' : ''}${level.stars ? '.done' : ''}${level.mark ? `.mark-${level.mark}` : ''}`;
  const body = [
    h('span.j-num', String(level.n)),
    small || !level.open ? null : starsEl(level.stars, 3, 'stars.tiny'),
    markEl(level.mark),
    level.current ? cartEl() : null,
  ];
  return level.open
    ? h(`a${cls}`, { href: ctx.levelPath(level.id), 'data-nav': true, 'data-level': level.id, title: name }, ...body)
    : h(`div${cls}.locked`, { 'data-level': level.id, title: name }, ...body);
}

function head(model, ctx, title = t('journey.title')) {
  return h('header.levels-head.j-head',
    h('a.btn.ghost', { href: '/', 'data-nav': true }, t('common.backToMenu')),
    h('h2', title),
    h('a.btn.j-daily', { href: '/daily', 'data-nav': true }, h('span', t('menu.daily')), ctx.streak ? h('span.badge', `🔥 ${ctx.streak}`) : null),
    h('span.badge', `★ ${model.stars}/${model.total}`),
  );
}

/** The stop the screen opens on: the one asked for (/levels/<slug>), else the cart's. */
const focusIndex = (model, packId) => Math.max(0, packId ? model.stops.findIndex((s) => s.pack?.id === packId) : model.cart);

// ---------------------------------------------------------------- 1: winding road (vertical)

function road(model, ctx) {
  const ROW = 78;
  const sections = model.stops.map((stop) => {
    const c = colours(stop, ctx.themes);
    const rows = stop.teaser ? 3 : stop.levels.length;
    const pts = Array.from({ length: rows }, (_, i) => ({ x: 50 + 30 * Math.sin(i * 0.75), y: ROW / 2 + i * ROW }));
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
    const hgt = rows * ROW;
    const lines = h('span.j-road-svg', { 'aria-hidden': 'true', html: `<svg viewBox="0 0 100 ${hgt}" preserveAspectRatio="none" style="height:${hgt}px"><path d="${path}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="26" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${stop.teaser ? '#6c6070' : c.table}" stroke-width="18" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" ${stop.open ? '' : 'stroke-dasharray="6 10"'}/></svg>` });
    const nodes = stop.teaser
      ? []
      : stop.levels.map((l, i) => h('div.j-place', { style: { left: `${pts[i].x}%`, top: `${pts[i].y}px` } }, node(l, ctx)));
    return h(`section.j-stop${stop.open ? '' : '.locked'}${stop.teaser ? '.teaser' : ''}`, { 'data-pack': stop.pack?.id ?? `stop-${stop.n}`, style: css({ '--j-bg': c.bg, '--j-glow': c.glow }) },
      h('div.j-stop-head', stopIcon(stop, ctx), h('div.j-stop-text', h('span.j-stop-n', t('journey.stop', { n: stop.n })), h('span.j-stop-name', stopName(stop)), h('span.j-stop-sub', stopSub(stop))), stop.banam ? banamEl() : null),
      h('div.j-road', { style: { height: `${hgt}px` } }, lines, ...nodes),
    );
  });
  return h('div.levels.journey.j-v1', head(model, ctx), h('div.j-roadmap', ...sections));
}

// ---------------------------------------------------------------- 2: long panorama (horizontal)

function panorama(model, ctx) {
  const STEP = 72;
  const panels = model.stops.map((stop) => {
    const c = colours(stop, ctx.themes);
    const n = stop.teaser ? 4 : stop.levels.length;
    const wave = (i) => 50 + 14 * Math.sin(i * 0.9);
    const width = 120 + n * STEP;
    const path = Array.from({ length: n }, (_, i) => `${i ? 'L' : 'M'}${80 + i * STEP} ${wave(i)}`).join(' ');
    return h(`section.j-panel${stop.open ? '' : '.locked'}${stop.teaser ? '.teaser' : ''}`, { 'data-pack': stop.pack?.id ?? `stop-${stop.n}`, style: css({ width: `${width}px`, '--j-bg': c.bg, '--j-glow': c.glow, '--j-table': c.table }) },
      h('div.j-panel-sky', { 'aria-hidden': 'true' }),
      h('div.j-panel-head', stopIcon(stop, ctx), h('div.j-stop-text', h('span.j-stop-n', t('journey.stop', { n: stop.n })), h('span.j-stop-name', stopName(stop)), h('span.j-stop-sub', stopSub(stop)))),
      stop.banam ? h('div.j-panel-banam', banamEl()) : null,
      h('div.j-panel-road', { 'aria-hidden': 'true', html: `<svg viewBox="0 0 ${width} 100" style="width:${width}px"><path d="${path}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="${c.table}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" ${stop.open ? '' : 'stroke-dasharray="8 12"'}/></svg>` }),
      ...(stop.teaser ? [] : stop.levels.map((l, i) => h('div.j-place', { style: { left: `${80 + i * STEP}px`, top: `calc(var(--j-road-top) + ${wave(i)}px)` } }, node(l, ctx)))),
    );
  });
  return h('div.levels.journey.j-v2', head(model, ctx), h('div.j-pano', ...panels));
}

// ---------------------------------------------------------------- 3: postcards per stop

function postcards(model, ctx) {
  const sel = focusIndex(model, ctx.packId);
  const cards = model.stops.map((stop, k) => {
    const c = colours(stop, ctx.themes);
    const front = h('div.j-card-front', { style: css({ '--j-bg': c.bg, '--j-glow': c.glow, '--j-table': c.table }) },
      h('div.j-card-art', stopIcon(stop, ctx)),
      h('div.j-card-text',
        h('span.j-stop-n', t('journey.stop', { n: stop.n })),
        h('span.j-card-name', stopName(stop)),
        h('span.j-stop-sub', stopSub(stop)),
        stop.banam ? h('span.j-card-banam', banamEl()) : null,
      ),
      h('span.j-stamp', { 'aria-hidden': 'true' }, String(stop.n)),
      stop.cart ? h('span.j-card-cart', cartEl()) : null,
    );
    const open = k === sel && !stop.teaser;
    const href = stop.pack ? `${ctx.levelsPath(stop.pack)}${location.search}` : null;
    return h(`article.j-card${open ? '.open' : ''}${stop.open ? '' : '.locked'}${stop.teaser ? '.teaser' : ''}`, { 'data-pack': stop.pack?.id ?? `stop-${stop.n}` },
      href && !open ? h('a.j-card-link', { href, 'data-nav': true }, front) : front,
      open ? h('div.j-card-back', h('div.j-dots', ...stop.levels.map((l) => node(l, ctx, { small: true })))) : null,
    );
  });
  return h('div.levels.journey.j-v3', head(model, ctx), h('div.j-cards', ...cards));
}

// ---------------------------------------------------------------- 4: map of Vietnam

// lon/lat -> the map's units (x 12 per degree of longitude from 102°E, y 12.5 per degree of latitude from 23.5°N)
const P = (lon, lat) => [((lon - 102) * 12).toFixed(1), ((23.5 - lat) * 12.5).toFixed(1)];
const VIETNAM = [
  [102.15, 22.4], [102.6, 22.75], [103.5, 22.6], [104.3, 22.75], [105.3, 23.3], [106.0, 22.95], [106.7, 22.8], [107.4, 21.65],
  [106.7, 20.9], [106.1, 20.0], [105.8, 19.2], [105.9, 18.6], [106.5, 17.9], [107.1, 17.0], [108.0, 16.3], [108.3, 15.9],
  [108.9, 15.2], [109.2, 13.8], [109.3, 12.6], [109.1, 11.6], [108.6, 11.1], [107.6, 10.5], [106.8, 10.3], [106.6, 9.6],
  [105.4, 8.6], [104.8, 8.6], [104.8, 9.6], [104.4, 10.4], [105.1, 10.9], [106.2, 11.1], [106.4, 11.7], [107.5, 12.3],
  [107.6, 13.2], [107.5, 14.6], [107.4, 15.2], [107.2, 15.9], [106.6, 16.5], [106.2, 17.3], [105.6, 18.1], [105.0, 18.7],
  [104.1, 19.3], [104.6, 19.7], [104.0, 20.0], [103.3, 20.6], [102.9, 21.0], [102.6, 21.4], [102.1, 22.0],
];
// where each stop is (docs/STORY.md "The five stops"): the alley, a central-coast fishing village, the lantern town,
// the northwest highlands, the rooftop above where the alley was
const PLACES = [[106.85, 11.2], [109.2, 13.4], [108.33, 15.88], [103.85, 22.3], [105.95, 10.25]];

function vnMap(model, ctx) {
  const sel = focusIndex(model, ctx.packId);
  const outline = `M${VIETNAM.map((p) => P(...p).join(' ')).join(' L')} Z`;
  const pts = PLACES.slice(0, model.stops.length).map((p) => P(...p));
  const done = pts.slice(0, model.cart + 1);
  const route = (list) => list.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const islands = [[104.0, 10.2, 'Phú Quốc'], [112.0, 16.5, 'Hoàng Sa'], [114.0, 10.0, 'Trường Sa']]
    .map(([lon, lat, name]) => { const [x, y] = P(lon, lat); return `<g class="j-isl"><circle cx="${x}" cy="${y}" r="1.4"/><circle cx="${+x + 3}" cy="${+y + 2}" r="1"/><circle cx="${+x - 2}" cy="${+y + 3}" r="0.9"/>${lon > 110 ? `<text x="${x}" y="${+y - 4}">${name}</text>` : ''}</g>`; }).join('');
  const svg = `<svg viewBox="-6 -6 170 196"><path class="j-sea" d="M-6 -6H164V190H-6Z"/><path class="j-land" d="${outline}"/>${islands}
    <path class="j-route" d="${route(pts)}"/><path class="j-route-done" d="${route(done)}"/></svg>`;
  const pins = model.stops.map((stop, k) => {
    const [x, y] = pts[k];
    const c = colours(stop, ctx.themes);
    const pin = h(`span.j-pin${k === sel ? '.sel' : ''}${stop.open ? '' : '.locked'}${stop.teaser ? '.teaser' : ''}`, { style: css({ '--j-glow': c.glow }) }, stop.teaser ? '?' : String(stop.n));
    const label = h('span.j-pin-label', stop.teaser ? null : stopName(stop));
    const inner = [pin, label, stop.cart ? cartEl() : null, stop.banam ? banamEl(false) : null];
    const style = { left: `${((+x + 6) / 170) * 100}%`, top: `${((+y + 6) / 196) * 100}%` };
    return stop.pack
      ? h('a.j-pin-at', { href: `${ctx.levelsPath(stop.pack)}${location.search}`, 'data-nav': true, 'data-pack': stop.pack.id, style }, ...inner)
      : h('div.j-pin-at', { 'data-pack': `stop-${stop.n}`, style }, ...inner);
  });
  const stop = model.stops[sel];
  return h('div.levels.journey.j-v4', head(model, ctx),
    h('div.j-mapwrap',
      h('div.j-map', h('span.j-map-svg', { 'aria-hidden': 'true', html: svg }), ...pins),
      h('section.j-detail', { 'data-pack': stop.pack?.id },
        h('div.j-stop-head', stopIcon(stop, ctx), h('div.j-stop-text', h('span.j-stop-n', t('journey.stop', { n: stop.n })), h('span.j-stop-name', stopName(stop)), h('span.j-stop-sub', stopSub(stop))), model.stops[sel + 1]?.banam ? banamEl() : null),
        h('div.j-dots', ...stop.levels.map((l) => node(l, ctx, { small: true }))),
      ),
    ),
  );
}

// ---------------------------------------------------------------- 5: notebook pages

function notebook(model, ctx) {
  const sel = focusIndex(model, ctx.packId);
  const stop = model.stops[sel];
  const tabs = h('nav.j-tabs', { 'aria-label': t('levels.themes') }, ...model.stops.map((s, k) => {
    const c = colours(s, ctx.themes);
    const inner = [h('span.j-tab-n', s.teaser ? '?' : String(s.n)), s.cart ? cartEl() : null];
    return s.pack
      ? h(`a.j-tab${k === sel ? '.sel' : ''}${s.open ? '' : '.locked'}`, { href: `${ctx.levelsPath(s.pack)}${location.search}`, 'data-nav': true, 'data-pack': s.pack.id, style: css({ '--j-glow': c.glow }) }, ...inner)
      : h('span.j-tab.teaser', { style: css({ '--j-glow': c.glow }) }, ...inner);
  }));
  const row = (l) => {
    const name = pick(ctx.getLevel(l.id)?.name) || l.id;
    const cls = `.j-line${l.current ? '.current' : ''}${l.open ? '' : '.locked'}`;
    const body = [h('span.j-line-n', String(l.n)), h('span.j-line-name', l.open ? name : '· · ·'), h('span.j-line-dots', { 'aria-hidden': 'true' }), markEl(l.mark), l.open ? starsEl(l.stars, 3, 'stars.tiny') : iconEl('lock')];
    return l.open ? h(`a${cls}`, { href: ctx.levelPath(l.id), 'data-nav': true, 'data-level': l.id }, ...body) : h(`div${cls}`, { 'data-level': l.id }, ...body);
  };
  const page = stop.teaser
    ? h('div.j-page.torn', h('p.j-missing', t('journey.missingPage')))
    : h(`div.j-page${stop.open ? '' : '.locked'}`,
        h('div.j-page-head', stopIcon(stop, ctx), h('div.j-stop-text', h('span.j-stop-n', t('journey.stop', { n: stop.n })), h('span.j-page-title', stopName(stop)), h('span.j-stop-sub', stopSub(stop)))),
        model.stops[sel + 1]?.banam ? h('p.j-note', banamEl(false), h('span', t('journey.banamNote'))) : null,
        h('div.j-lines', ...stop.levels.map(row)),
      );
  return h('div.levels.journey.j-v5', head(model, ctx), h('div.j-book', tabs, page));
}

// ---------------------------------------------------------------- entry

const VARIANTS = { 1: road, 2: panorama, 3: postcards, 4: vnMap, 5: notebook };

/**
 * The journey screen for variant `v` (1..5). ctx: { themes, themeIcons, getLevel, levelPath, levelsPath, packId, streak }.
 * After it is on screen call scrollToCart(el) so the cart is in view.
 */
export function journeyScreen(v, model, ctx) {
  return (VARIANTS[v] ?? road)(model, ctx);
}

export function scrollToCart(el, packId) {
  const target = (packId && el.querySelector(`.j-stop[data-pack="${packId}"], .j-panel[data-pack="${packId}"]`)) || el.querySelector('.j-node.current');
  target?.scrollIntoView({ block: packId ? 'start' : 'center', inline: 'center' });
}

export const JOURNEY_VARIANTS = Object.keys(VARIANTS).length;
