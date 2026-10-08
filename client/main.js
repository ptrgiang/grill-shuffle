// Grill Shuffle - app shell: routing, screens, and the game loop wiring.
//
//   /                 menu (+ SEO landing content below)
//   /<pack>/<n>       story level n of a pack, as numbered on screen, e.g. /street-bbq/12 (routes.js; old
//                     /level/<n> and /play/<id> URLs are rewritten to it)
//   /play             the next unfinished story level
//   /levels           level select
//   /daily            today's puzzle (same board for everyone, UTC day)
//   /p/<code>         a shared challenge (generated, story or daily code), optional ?m=<moves to beat>
import { Stage } from './render/stage.js';
import { BoardView } from './render/board.js';
import { foodIcon } from './render/icons.js';
import { Input } from './game/input.js';
import { Session } from './game/session.js';
import { parseRoute as routeOf, levelPath as pathOf, levelPosition, packSlug } from './game/routes.js';
import { PACKS, STORY, SHARE, THEMES, THEME_ICONS, getLevel, storyIndex, shareIndex, themeFor } from './game/content.js';
import { packStatus, packIndexOf, levelOpen, lockReason, storyStars, nextStoryLevel as firstOpenLevel, nextLevelAfter } from './game/unlock.js';
import { resolveTheme } from '../shared/themes.js';
import { puzzleFromCode, hintFor } from './game/solver-client.js';
import { Audio } from './audio/audio.js';
import * as db from './storage/db.js';
import { pullProgress, pushProgressSoon, submitResult, fetchDaily, flushOutbox } from './storage/sync.js';
import { advanceStreak, currentStreak, msUntilNextDaily, formatCountdown, serverDailyLevel, rankLine } from './game/daily.js';
import { h, iconEl, toast, floatText, starsEl } from './ui/dom.js';
import { Coach, coachMove } from './ui/coach.js';
import { isInstalled, installedThisVisit, canPrompt, promptInstall, onInstallChange, installGuide } from './ui/install.js';
import { FOODS } from '../shared/foods.js';
import { BOOSTERS } from '../shared/boosters.js';
import { starThresholds } from '../shared/progression.js';
import { decodeCode, encodeStory, encodeDaily, encodeGenerated, todayUTC, BANDS } from '../shared/challenge.js';
import { VERSIONS, PUZZLE_RULE_VERSION } from '../shared/version.js';
import { registerServiceWorker } from './ui/update.js';
import { marginsFrom, baseMargins, rects, isShortLandscape } from './ui/fit.js';
import { TIERS, QUALITY_SETTINGS, initialTier, lowerTier, FrameMonitor, IdleGate } from './render/quality.js';
import { StatsOverlay } from './ui/stats.js';

// quality: 'auto' | 'high' | 'medium' | 'low'; autoTier: where auto mode settled on this device
const DEFAULT_SETTINGS = { muted: false, sfxVolume: 1, ambienceVolume: 1, haptics: true, quality: 'auto', autoTier: null };

const ui = document.getElementById('ui');
const canvas = document.getElementById('stage');
const audio = new Audio();
audio.attach(document, window); // unlock on any gesture; fade + suspend while the page is hidden
const stage = new Stage(canvas, { theme: themeFor(null) });

/** Look and sound of a theme (content/themes/*.json): the stage re-skins itself, the ambience loop follows. */
function useTheme(theme) {
  stage.setTheme(theme);
  audio.setAmbience(stage.theme.ambience);
}
useTheme(themeFor(null));
const fxLayer = h('div.fx-layer');
document.getElementById('app').append(fxLayer);

const app = {
  route: null,
  session: null,
  level: null,
  mode: 'story', // story | daily | challenge
  code: null,
  target: null, // moves to beat (shared links)
  progress: {},
  streak: null, // local daily streak { last, count, best }
  settings: { ...DEFAULT_SETTINGS },
  hud: null,
  coach: null, // first-level onboarding hand (touch)
  seenBoosters: {}, // boosters the player has tried at least once (the HUD marks the others "new")
  busy: false,
};

// ---------------------------------------------------------------- board + input (one each, for the app's life)

const view = new BoardView(stage, { onFx: (ev, at) => onFx(ev, at) });
const input = new Input(canvas, () => app.session, view, {
  enabled: () => app.route === 'game' && app.session?.status === 'playing' && !app.modal,
  onGesture: () => audio.unlock(),
  haptics: () => app.settings.haptics !== false,
  onSelect: () => (audio.onEvent({ type: 'select' }), app.coach?.phase('drop')),
  onDeselect: () => app.coach?.phase('pick'),
  onInvalid: (g, o) => {
    if (!o?.quiet) audio.onEvent({ type: 'invalid' });
  },
  onMove: (move, { dropped }) => doAction(move, { dropped }),
});

// ---------------------------------------------------------------- render loop: on demand, adaptive quality

const idle = new IdleGate();
const frames = new FrameMonitor();
const urlQuality = new URLSearchParams(location.search).get('quality'); // ?quality=low: this visit only (testing)
const stats = new URLSearchParams(location.search).get('stats') === '1' ? new StatsOverlay(document.getElementById('app')) : null;
for (const ev of ['pointerdown', 'pointermove', 'wheel']) canvas.addEventListener(ev, () => idle.wake(), { passive: true });

function applyQuality() {
  const s = app.settings;
  const tier = TIERS[urlQuality] ? urlQuality : initialTier({ setting: s.quality, autoTier: s.autoTier, deviceMemory: navigator.deviceMemory, cores: navigator.hardwareConcurrency });
  stage.setQuality(tier);
  frames.reset();
  idle.wake();
}

/** After each rendered frame: feed the monitor (busy frames only: idle ticks are slow on purpose), step down if needed. */
function onRendered(info) {
  stats?.frame(info, { tier: stage.tierName, busy: idle.active });
  if (!idle.active) return;
  const auto = !TIERS[urlQuality] && app.settings.quality === 'auto';
  if (frames.add(info.dt * 1000) && auto && stage.tierName !== 'low') {
    app.settings.autoTier = lowerTier(stage.tierName);
    stage.setQuality(app.settings.autoTier);
    db.set('settings', app.settings);
  }
}

function doAction(action, opts = {}) {
  const r = app.session.apply(action);
  if (!r.ok) return false;
  dismissCoach();
  view.showHint(null);
  view.play(r.state, r.events, opts);
  app.hud?.update(r.state, { immediate: true });
  // no plain move left but a booster still works (else the simulation would have called it 'stuck')
  if (r.state.status === 'playing' && !app.session.legalMoves().length && app.session.boosterIds().some((id) => app.session.canUseBooster(id))) {
    app.hud?.tip('No moves left. A booster can still save it!');
  }
  return true;
}

/**
 * A booster button. Fan (no target) asks for a second tap to confirm, then fires. Tongs (pick + drop) arms the
 * input: the next pick (any grill, locked ones too) and drop is the booster; a second tap disarms.
 */
function tapBooster(id) {
  const s = app.session;
  if (app.route !== 'game' || app.modal || s.status !== 'playing') return;
  audio.onEvent({ type: 'button' });
  if (!app.seenBoosters[id]) {
    app.seenBoosters = { ...app.seenBoosters, [id]: true };
    db.set('seenBoosters', app.seenBoosters);
  }
  if (!s.canUseBooster(id) && s.armed !== id) {
    app.hud.tip(s.charges(id) > 0 ? `Nothing for the ${BOOSTERS[id].name.toLowerCase()} to do right now.` : `No ${BOOSTERS[id].name} left.`);
    return app.hud.update(s.state);
  }
  input.deselect();
  if (BOOSTERS[id].needs === 'none') {
    if (app.hud.confirming === id) {
      app.hud.confirm(null);
      app.hud.tipEl.classList.remove('show');
      doAction({ type: 'booster', booster: id });
    } else {
      s.arm(null);
      app.hud.confirm(id);
      app.hud.tip(BOOSTER_TIPS[id]);
    }
  } else {
    app.hud.confirm(null);
    if (s.armed === id) s.arm(null);
    else if (s.arm(id)) app.hud.tip(BOOSTER_TIPS[id]);
  }
  app.hud.update(s.state);
}

const BOOSTER_TIPS = {
  tongs: 'Tongs: pick any food, even off a locked grill, and drop it on an open one. Free, no move used.',
  fan: 'Fan: tap again to blow the food on the open grills into new spots. Free, no move used.',
};

/** Presentation events, on the animation's beat. Never feeds back into the simulation. */
function onFx(ev, at) {
  audio.onEvent(ev, at ? at.x / stage.size.w : 0.5);
  if (!app.hud) return;
  switch (ev.type) {
    case 'score':
      if (at) floatText(fxLayer, ev.combo > 1 ? `+${ev.points}  x${ev.combo}` : `+${ev.points}`, at.x, at.y - 10, ev.combo > 1 ? 'hot' : '');
      break;
    case 'goal_progress':
      app.hud.bumpGoal(ev.goal);
      app.hud.update(app.session.state);
      break;
    case 'combo':
      if (ev.combo >= 2) app.hud.combo(ev.combo);
      break;
    case 'level_complete':
      setTimeout(() => showResult(true), 250);
      break;
    case 'level_failed':
      setTimeout(() => showResult(false, ev.reason), 300);
      break;
  }
}

// ---------------------------------------------------------------- routing

const parseRoute = (path = location.pathname) => routeOf(path, PACKS);
const levelPath = (id) => pathOf(PACKS, id);

/** On-screen name of a story level: "Level 12", with the pack's name once there is more than one pack. */
function levelLabel(id) {
  const at = levelPosition(PACKS, id);
  if (!at) return null;
  return PACKS.length > 1 ? `${at.pack.name} · Level ${at.n}` : `Level ${at.n}`;
}

export function go(path, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  render();
}
window.addEventListener('popstate', () => render());
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-nav]');
  if (a) {
    e.preventDefault();
    audio.unlock();
    audio.onEvent({ type: 'button' });
    go(a.getAttribute('href'));
  }
});

async function render() {
  const r = parseRoute();
  closeModal();
  dismissCoach();
  document.body.classList.toggle('in-game', r.name !== 'menu');
  if (r.name === 'menu') return showMenu();
  if (r.name === 'levels') return showLevels(r.pack);
  if (r.name === 'play') {
    const lvl = r.missing ? null : getLevel(r.id ?? nextStoryLevel());
    if (!lvl) return go('/', { replace: true });
    const k = packIndexOf(PACKS, lvl.id);
    const status = k > 0 ? packStatus(PACKS, k, app.progress, THEMES) : null;
    if (status && !status.open) {
      toast(`${PACKS[k].name} is locked. ${lockReason(status)}.`);
      return go(`/levels/${packSlug(PACKS[k])}`, { replace: true });
    }
    const canonical = levelPath(lvl.id);
    if (canonical && location.pathname !== canonical) history.replaceState(null, '', canonical + location.search);
    return startLevel(lvl, { mode: 'story' });
  }
  if (r.name === 'daily') return startCode(encodeDaily(todayUTC()), { mode: 'daily' });
  if (r.name === 'code') return startCode(r.code, { mode: 'challenge' });
}

function nextStoryLevel() {
  return firstOpenLevel(PACKS, app.progress, THEMES);
}

// ---------------------------------------------------------------- screens

function screen(...children) {
  ui.replaceChildren(...children);
}

function showMenu() {
  app.route = 'menu';
  app.hud = null;
  // an idle board behind the menu, as a live preview
  const demo = getLevel(STORY[2] ?? STORY[0]);
  const stars = storyStars(PACKS, app.progress); // story levels only: dailies and challenges have their own records
  const streak = currentStreak(app.streak, todayUTC());
  const next = nextStoryLevel();
  useTheme(themeFor(getLevel(next))); // the menu wears the theme of the level "Continue" opens
  screen(
    h('div.menu',
      h('div.logo', h('img.logo-mark', { src: '/favicon.svg', alt: '' }), h('h1.title', 'Grill Shuffle'), h('p.subtitle', 'Food Sort & Match Puzzle')),
      h('div.menu-spacer'),
      h('div.menu-buttons',
        h('a.btn.big.primary', { href: levelPath(next) ?? '/play', 'data-nav': true }, stars ? `Continue · ${levelLabel(next)}` : 'Play'),
        h('div.row',
          h('a.btn', { href: '/daily', 'data-nav': true }, h('span', 'Daily Grill'), streak ? h('span.badge', `🔥 ${streak}`) : null),
          h('a.btn', { href: '/levels', 'data-nav': true }, h('span', 'Levels'), stars ? h('span.badge', `★ ${stars}`) : null),
        ),
        h('button.btn.ghost', { on: { click: () => challengePicker() } }, "Chef's Challenge"),
      ),
      h('div.menu-foot', soundToggle(), installButton(), h('a.link', { href: '#about', on: { click: (e) => { e.preventDefault(); document.getElementById('landing').scrollIntoView({ behavior: 'smooth' }); } } }, 'About the game ↓')),
    ),
  );
  app.fit = demo ? menuMargins : null;
  if (demo) {
    app.session = new Session(demo);
    view.setMargins(menuMargins());
    view.setState(app.session.state);
  }
}

// the idle preview board sits between the title and the buttons (beside the buttons on a sideways phone)
function menuMargins() {
  const menu = ui.querySelector('.menu');
  const { w: W, h: H } = stage.size;
  const q = (sel) => rects(menu, sel);
  return isShortLandscape()
    ? marginsFrom(W, H, { top: q('.logo'), right: [...q('.menu-buttons'), ...q('.menu-foot')] }, baseMargins(16, 10), 12)
    : marginsFrom(W, H, { top: q('.logo'), bottom: [...q('.menu-buttons'), ...q('.menu-foot')] }, baseMargins(12, 10), 12);
}

/** Re-measure what the UI covers and re-frame the board (resize, rotation, address bar, late fonts). */
function refit() {
  if (app.fit) view.setMargins(app.fit());
  else view.relayout();
}

// hidden inside the installed app; the browser's own prompt when it has one, else the steps for this device
function installButton() {
  if (isInstalled()) return null;
  const b = h('button.btn.ghost.install-btn', { on: { click: async () => {
    audio.unlock();
    audio.onEvent({ type: 'button' });
    if (canPrompt()) {
      if (await promptInstall()) toast('Grill Shuffle installed!');
    } else openModal(...installGuide(), h('button.btn.ghost', { on: { click: closeModal } }, 'Close'));
  } } }, 'Install app');
  const off = onInstallChange(() => {
    if (!b.isConnected) return off();
    if (installedThisVisit()) b.remove();
  });
  return b;
}

function soundToggle() {
  const b = h('button.icon-btn', { 'aria-label': 'Sound on/off', on: { click: () => setMuted(!app.settings.muted, b) } });
  b.replaceChildren(iconEl(app.settings.muted ? 'mute' : 'sound'));
  return b;
}

async function setMuted(m, btn) {
  app.settings.muted = m;
  audio.unlock();
  audio.setMuted(m);
  btn?.replaceChildren(iconEl(m ? 'mute' : 'sound'));
  await db.set('settings', app.settings);
}

let saveSettingsTimer = 0;
function volumeSlider(label, key) {
  const apply = (v) => {
    app.settings[key] = v;
    audio.setVolumes({ sfx: app.settings.sfxVolume, ambience: app.settings.ambienceVolume });
    clearTimeout(saveSettingsTimer);
    saveSettingsTimer = setTimeout(() => db.set('settings', app.settings), 250);
  };
  const input = h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(app.settings[key] * 100), 'aria-label': `${label} volume`, on: { input: (e) => apply(e.target.value / 100) } });
  return h('label.volume', h('span', label), input);
}

/** Graphics: Auto (steps down by itself when frames are slow) or a fixed tier. */
function qualityPicker() {
  const label = { auto: 'Auto', high: 'High', medium: 'Med', low: 'Low' };
  const buttons = QUALITY_SETTINGS.map((q) =>
    h('button.seg-btn', { 'aria-pressed': String(app.settings.quality === q), on: { click: () => {
      audio.onEvent({ type: 'button' });
      app.settings.quality = q;
      if (q === 'auto') app.settings.autoTier = null; // re-measure from the top
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === buttons[QUALITY_SETTINGS.indexOf(q)]));
      applyQuality();
      db.set('settings', app.settings);
    } } }, label[q]),
  );
  return h('div.volume', h('span', 'Graphics'), h('div.seg', { role: 'group', 'aria-label': 'Graphics quality' }, ...buttons));
}

function challengePicker() {
  audio.unlock();
  openModal(
    h('h2', "Chef's Challenge"),
    h('p.muted', 'A fresh, computer-verified puzzle. Pick the heat:'),
    h('div.band-grid', ...['E', 'N', 'H', 'V'].map((b) =>
      h('button.btn', { on: { click: () => go(`/p/${encodeGenerated(b, Math.floor(Math.random() * 32 ** 5))}`) } }, BANDS[b].name),
    )),
    h('button.btn.ghost', { on: { click: closeModal } }, 'Back'),
  );
}

function showLevels(slug) {
  app.route = 'levels';
  app.hud = null;
  app.fit = null;
  // one tab per pack (theme), numbered inside the pack (the URL number). /levels/<slug> picks the tab; plain /levels
  // opens the pack "Continue" is in (old /levels#pack-<id> links too). A pack opens when the previous one is finished
  // and its theme's star requirement is met (game/unlock.js); a locked tab says what it needs.
  const hashId = location.hash.startsWith('#pack-') ? location.hash.slice(6) : null;
  const sel = Math.max(0, PACKS.findIndex((p) => (slug ? packSlug(p) === slug : hashId ? p.id === hashId : p.levels.includes(nextStoryLevel()))));
  const pack = PACKS[sel];
  const card = (id, n) => {
    const lvl = getLevel(id);
    const open = levelOpen(PACKS, id, app.progress, THEMES);
    const stars = app.progress[id]?.stars ?? 0;
    return open
      ? h('a.level-card', { href: levelPath(id), 'data-nav': true }, h('span.num', String(n)), h('span.name', lvl.name ?? id), starsEl(stars, 3, 'stars.small'))
      : h('div.level-card.locked', h('span.num', String(n)), iconEl('lock'));
  };
  const swatch = (p) => {
    if (THEME_ICONS[p.theme]) return h('span.pack-swatch.pack-icon', { 'aria-hidden': 'true', html: THEME_ICONS[p.theme] });
    const t = resolveTheme(THEMES[p.theme] ?? {});
    return h('span.pack-swatch', { 'aria-hidden': 'true', style: { background: `linear-gradient(135deg, ${t.palette.background} 0 40%, ${t.grill.ember.hot} 40% 60%, ${t.table.color} 60%)` } });
  };
  const one = PACKS.length === 1;
  const status = packStatus(PACKS, sel, app.progress, THEMES);
  const tabs = one
    ? null
    : h('nav.pack-tabs', { 'aria-label': 'Themes' },
        ...PACKS.map((p, k) => {
          const st = packStatus(PACKS, k, app.progress, THEMES);
          const cls = `a.pack-tab${st.open ? '' : '.locked'}`;
          return h(cls, { href: `/levels/${packSlug(p)}`, 'data-nav': true, 'data-pack': p.id, 'aria-current': k === sel ? 'page' : null },
            swatch(p),
            h('span.pack-tab-text', h('span.pack-tab-name', p.name), h('span.pack-tab-sub', st.open ? `★ ${storyStars([p], app.progress)}/${p.levels.length * 3}` : `★ ${st.need}`)),
            st.open ? null : iconEl('lock'),
          );
        }),
      );
  screen(
    h('div.levels',
      h('header.levels-head', h('a.btn.ghost', { href: '/', 'data-nav': true }, '← Menu'), h('h2', one ? pack.name : 'Levels'), h('span.badge', `★ ${storyStars(PACKS, app.progress)}/${STORY.length * 3}`)),
      tabs,
      h(`section.pack${status.open ? '' : '.locked'}#pack-${pack.id}`, { 'data-pack': pack.id },
        status.open ? null : h('p.pack-lock', iconEl('lock'), h('span', lockReason(status))),
        h('div.level-grid', ...pack.levels.map((id, i) => card(id, i + 1))),
      ),
    ),
  );
  document.querySelector('.pack-tab[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}


// ---------------------------------------------------------------- playing

async function startCode(code, { mode }) {
  const d = decodeCode(code);
  if (!d) {
    toast('That challenge link looks broken.');
    return go('/', { replace: true });
  }
  if (d.kind === 'story') {
    const id = SHARE[d.index];
    return id && getLevel(id) ? startLevel(getLevel(id), { mode: 'challenge', code: d.code }) : go('/', { replace: true });
  }
  screen(h('div.loading', h('div.spinner'), h('p', d.kind === 'daily' ? "Lighting today's grill…" : 'Prepping your challenge…')));
  app.route = 'loading';
  app.fit = null;
  // the daily: the copy saved on this device, else the server's pre-built one (Cron), else build it here (same code,
  // same board). Saved once built, so it opens instantly and offline.
  const saved = d.kind === 'daily' ? serverDailyLevel(await db.get(`dailyLevel:${d.date}`), d.code, d.date) : null;
  const pre = saved ?? (d.kind === 'daily' ? serverDailyLevel(await fetchDaily(d.date), d.code, d.date) : null);
  const res = pre ? { ok: true, level: pre } : await puzzleFromCode(d.code);
  if (d.kind === 'daily' && !saved && res?.ok) db.set(`dailyLevel:${d.date}`, { code: d.code, rulesVersion: PUZZLE_RULE_VERSION, level: res.level });
  if (parseRoute().name !== (mode === 'daily' ? 'daily' : 'code')) return; // navigated away meanwhile
  if (!res?.ok) {
    toast('Could not build that puzzle.');
    return go('/', { replace: true });
  }
  startLevel(res.level, { mode: d.kind === 'daily' ? 'daily' : 'challenge', code: d.code });
}

function startLevel(level, { mode, code = null }) {
  app.route = 'game';
  app.mode = mode;
  app.level = level;
  app.code = code ?? (mode === 'story' ? encodeStory(shareIndex(level.id)) : null);
  const m = Number(new URLSearchParams(location.search).get('m'));
  app.target = Number.isFinite(m) && m > 0 ? m : null;
  app.session = new Session(level);
  useTheme(themeFor(level));
  if (mode === 'story') db.set('current', level.id);
  app.hud = new Hud(level);
  screen(app.hud.el);
  app.hud.update(app.session.state, { immediate: true }); // goals first: their chips are part of what the HUD covers
  app.fit = () => app.hud.margins();
  view.setMargins(app.hud.margins());
  view.setState(app.session.state);
  if (level.hint && mode === 'story' && !(app.progress[level.id]?.stars > 0)) app.hud.tip(level.hint);
  dismissCoach();
  if (wantsCoach(level, mode)) app.coach = new Coach(fxLayer, view, coachMove(level));
  if (app.target) app.hud.tip(`A friend finished this in ${app.target} moves. Can you beat it?`);
  window.__gameReady = true;
}

/** Onboarding hand: first story level, not yet won, on a touch screen (`?coach=1` / `?coach=0` force it). */
function wantsCoach(level, mode) {
  const force = new URLSearchParams(location.search).get('coach');
  if (force === '0' || !coachMove(level)) return false;
  if (force === '1') return true;
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return touch && mode === 'story' && storyIndex(level.id) === 0 && !(app.progress[level.id]?.stars > 0);
}

function dismissCoach() {
  app.coach?.dispose();
  app.coach = null;
}

function restart() {
  app.hud?.confirm(null);
  app.session.restart();
  view.setState(app.session.state);
  app.hud.update(app.session.state, { immediate: true });
  closeModal();
}

/** Put a booster down without using it (armed tongs, a fan waiting for its confirm tap). */
function disarm() {
  input.deselect();
  app.session.arm(null);
  app.hud?.confirm(null);
  app.hud?.update(app.session.state);
}

function undo() {
  if (!app.session.canUndo()) return;
  app.hud?.confirm(null);
  view.skip();
  app.session.undo();
  view.setState(app.session.state);
  app.hud.update(app.session.state, { immediate: true });
  closeModal();
}

async function hint() {
  if (app.session.status !== 'playing' || app.busy) return;
  if (app.session.armed || app.hud?.confirming) disarm();
  app.busy = true;
  const r = await hintFor(app.session.state);
  app.busy = false;
  if (r?.move) {
    app.session.hints++;
    view.showHint(r.move);
    view.select(r.move.from.grill, r.move.from.slot);
    view.setTargets([r.move.to.grill], r.move.from.grill);
    setTimeout(() => {
      view.select(null);
      view.setTargets(null);
    }, 1600);
  } else toast(r?.solvable === false ? 'No win from here: undo or restart.' : 'The chef is thinking too hard. Try again.');
}

class Hud {
  constructor(level) {
    this.level = level;
    const title = app.mode === 'daily' ? `Daily · ${level.id.slice(6)}` : app.mode === 'challenge' && !STORY.includes(level.id) ? `Challenge ${app.code}` : levelLabel(level.id);
    this.movesEl = h('span.moves-num', '0');
    this.goalsEl = h('div.goals');
    this.comboEl = h('div.combo');
    this.tipEl = h('div.tip');
    this.undoBtn = h('button.tool', { 'aria-label': 'Undo', on: { click: () => (audio.onEvent({ type: 'button' }), undo()) } }, iconEl('undo'), h('span', 'Undo'));
    // one button per booster the level grants (generic over BOOSTERS: new ones only need an icon and a tip)
    this.confirming = null;
    this.boosters = app.session.boosterIds().map((id) => {
      const count = h('span.charge');
      const label = h('span.tool-label', BOOSTERS[id].name);
      const el = h('button.tool.booster', { 'data-booster': id, 'aria-label': BOOSTERS[id].name, on: { click: () => tapBooster(id) } }, iconEl(id), label, count, app.seenBoosters[id] ? null : h('span.new-tag', 'New'));
      return { id, el, count, label };
    });
    this.el = h('div.hud',
      h('header.hud-top',
        h('button.icon-btn', { 'aria-label': 'Pause', on: { click: () => pauseMenu() } }, iconEl('pause')),
        h('div.hud-title', h('div.lvl', title), h('div.lvl-name', level.name ?? '')),
        h('div.moves', h('span.moves-label', 'Moves'), this.movesEl),
      ),
      this.goalsEl,
      this.comboEl,
      this.tipEl,
      h('footer.hud-bottom',
        this.undoBtn,
        h('button.tool', { 'aria-label': 'Hint', on: { click: () => (audio.onEvent({ type: 'button' }), hint()) } }, iconEl('hint'), h('span', 'Hint')),
        h('button.tool', { 'aria-label': 'Restart', on: { click: () => (audio.onEvent({ type: 'button' }), restart()) } }, iconEl('restart'), h('span', 'Restart')),
        this.boosters.length ? h('span.tool-sep', { 'aria-hidden': 'true' }) : null,
        ...this.boosters.map((b) => b.el),
      ),
    );
    if (this.boosters.length) this.el.querySelector('.hud-bottom').classList.add('has-boosters');
    this.goalEls = [];
  }

  /** Board margins from the HUD as laid out now: bars above and below, or side columns on a sideways phone. */
  margins() {
    const { w: W, h: H } = stage.size;
    const q = (sel) => rects(this.el, sel);
    const base = baseMargins();
    return isShortLandscape()
      ? marginsFrom(W, H, { left: [...q('.hud-top'), ...q('.goal')], right: q('.tool') }, base)
      : marginsFrom(W, H, { top: [...q('.hud-top'), ...q('.goal')], bottom: q('.tool') }, base, 6);
  }

  update(s, { immediate = false } = {}) {
    this.movesEl.textContent = String(s.movesLeft);
    this.movesEl.parentElement.classList.toggle('low', s.movesLeft <= 3 && s.status === 'playing');
    this.undoBtn.disabled = !app.session.canUndo();
    const ses = app.session;
    for (const b of this.boosters) {
      const n = ses.charges(b.id);
      const armed = ses.armed === b.id || this.confirming === b.id;
      b.count.textContent = String(n);
      b.el.disabled = !armed && !ses.canUseBooster(b.id);
      b.el.classList.toggle('armed', armed);
      b.el.setAttribute('aria-pressed', String(armed));
      b.label.textContent = this.confirming === b.id ? 'Blow!' : ses.armed === b.id ? 'Cancel' : BOOSTERS[b.id].name;
      if (app.seenBoosters[b.id]) b.el.querySelector('.new-tag')?.remove();
    }
    view.setReach(ses.armed === 'tongs');
    if (!this.goalEls.length) {
      this.goalEls = s.goals.map((g) => {
        const icon = g.food ? h('img.goal-icon', { src: foodIcon(stage.renderer, g.food), alt: FOODS[g.food].name }) : h('span.goal-icon.all', '🔥');
        const count = h('span.goal-count');
        const el = h('div.goal', icon, count);
        el.title = goalLabel(g);
        this.goalsEl.append(el);
        return { el, count };
      });
    }
    s.goals.forEach((g, i) => {
      const left = g.target - g.progress;
      const ge = this.goalEls[i];
      ge.count.textContent = left > 0 ? (g.type === 'clear_all' ? `${left} left` : `×${left}`) : '✓';
      ge.el.classList.toggle('done', left <= 0);
    });
  }

  /** A no-target booster waiting for its confirming second tap (null: none). Times out by itself. */
  confirm(id) {
    this.confirming = id;
    clearTimeout(this.confirmTimer);
    if (id) this.confirmTimer = setTimeout(() => (this.confirm(null), this.update(app.session.state)), 4000);
  }

  bumpGoal(i) {
    const ge = this.goalEls[i];
    if (!ge) return;
    ge.el.classList.remove('bump');
    void ge.el.offsetWidth;
    ge.el.classList.add('bump');
  }

  combo(n) {
    this.comboEl.textContent = n >= 4 ? `Sizzling! x${n}` : n === 3 ? `Hot streak x3` : `Combo x${n}`;
    this.comboEl.classList.remove('show');
    void this.comboEl.offsetWidth;
    this.comboEl.classList.add('show');
  }

  tip(text) {
    this.tipEl.textContent = text;
    this.tipEl.classList.add('show');
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => this.tipEl.classList.remove('show'), 5200);
  }
}

function goalLabel(g) {
  switch (g.type) {
    case 'clear_all':
      return 'Clear every item';
    case 'clear_food':
    case 'serve_food':
      return `Serve ${g.target} ${FOODS[g.food].name}`;
    case 'complete_matches':
      return `Make ${g.target} matches`;
    case 'reach_score':
      return `Score ${g.target}`;
    case 'clear_blocker':
      return 'Open every locked grill';
    case 'reveal_hidden':
      return 'Flip every stacked tray';
  }
  return g.type;
}

// ---------------------------------------------------------------- modals

function openModal(...children) {
  closeModal();
  app.modal = h('div.modal-back', h('div.modal', ...children));
  ui.append(app.modal);
  requestAnimationFrame(() => app.modal?.classList.add('open'));
}
function closeModal() {
  app.modal?.remove();
  app.modal = null;
}

function pauseMenu() {
  audio.onEvent({ type: 'button' });
  openModal(
    h('h2', 'Paused'),
    h('div.modal-buttons',
      h('button.btn.primary', { on: { click: closeModal } }, 'Resume'),
      h('button.btn', { on: { click: restart } }, 'Restart'),
      h('a.btn', { href: '/levels', 'data-nav': true }, 'Levels'),
      h('a.btn.ghost', { href: '/', 'data-nav': true }, 'Menu'),
    ),
    h('div.volumes', volumeSlider('Effects', 'sfxVolume'), volumeSlider('Ambience', 'ambienceVolume'), qualityPicker()),
    h('div.modal-foot', soundToggle()),
  );
}

async function showResult(won, reason) {
  const s = app.session.state;
  const level = app.level;
  if (!won) {
    openModal(
      h('h2', reason === 'stuck' ? 'No room left!' : reason === 'charred' ? 'Burnt!' : 'Out of moves'),
      h('p.muted', reason === 'stuck' ? 'Every slot is full. Undo a move or start over.' : reason === 'charred' ? 'Food left on the heat too long chars. Serve it, or park it on a tray, before its counter runs out.' : 'So close. One more try?'),
      h('div.modal-buttons',
        h('button.btn.primary', { on: { click: restart } }, 'Try again'),
        app.session.canUndo() ? h('button.btn', { on: { click: undo } }, 'Undo last move') : null,
        h('a.btn.ghost', { href: '/', 'data-nav': true }, 'Menu'),
      ),
    );
    return;
  }
  const min = level.solver?.minMoves;
  const stars = app.session.stars();
  const key = app.mode === 'daily' ? `daily:${level.id.slice(6)}` : level.id;
  const { improved } = await db.recordResult(key, { stars, moves: s.movesUsed, score: s.score });
  app.progress = await db.get('progress', {});
  pushProgressSoon();
  const submitted = app.mode !== 'story' && app.code
    ? submitResult(app.mode === 'daily' ? 'daily' : 'challenge', app.code, { code: app.code, date: app.mode === 'daily' ? level.id.slice(6) : undefined, moves: app.session.replayString(), hash: app.session.finalHash(), versions: VERSIONS })
    : null;
  const daily = app.mode === 'daily' ? await dailyPanel(level.id.slice(6), s.movesUsed, submitted) : null;
  const t = min ? starThresholds(min) : null;
  const idx = storyIndex(level.id);
  const nextId = app.mode === 'story' && idx >= 0 ? nextLevelAfter(PACKS, level.id, app.progress, THEMES) : null;
  const moreLocked = app.mode === 'story' && !nextId && idx >= 0 && idx < STORY.length - 1; // next pack not open yet
  const used = Object.entries(app.session.boostersUsed()).map(([id, n]) => (n > 1 ? `${BOOSTERS[id].name} ×${n}` : BOOSTERS[id].name));
  const beat = app.target ? (s.movesUsed < app.target ? `You beat your friend's ${app.target} moves!` : s.movesUsed === app.target ? `Tied with your friend's ${app.target} moves.` : `Your friend did it in ${app.target}. Rematch?`) : null;
  openModal(
    h('h2.win', stars === 3 ? 'Chef’s kiss!' : 'Order up!'),
    starsEl(stars, 3, 'stars.big'),
    h('div.result-stats',
      h('div', h('b', String(s.movesUsed)), h('span', 'moves')),
      h('div', h('b', String(s.score)), h('span', 'score')),
      h('div', h('b', `x${s.maxCombo}`), h('span', 'best combo')),
    ),
    min ? h('p.muted', stars === 3 ? `Solved in ${s.movesUsed}. The best possible is ${min}.` : `3 stars at ${t.three} moves or fewer (best possible: ${min}).`) : null,
    used.length ? h('p.muted.boosters-used', `Boosters used: ${used.join(', ')}`) : null,
    beat ? h('p.beat', beat) : null,
    daily,
    improved && app.mode === 'story' ? h('p.muted', 'New best saved.') : null,
    h('div.modal-buttons',
      nextId
        ? h('a.btn.primary', { href: levelPath(nextId), 'data-nav': true }, 'Next level')
        : moreLocked
          ? h('a.btn.primary', { href: '/levels', 'data-nav': true }, 'Levels')
          : h('a.btn.primary', { href: '/', 'data-nav': true }, 'Menu'),
      h('button.btn', { on: { click: () => share(s.movesUsed) } }, iconEl('share'), ' Challenge a friend'),
      h('button.btn.ghost', { on: { click: restart } }, 'Replay'),
    ),
  );
}

/**
 * The daily's part of the result screen: local streak, the server's verified rank among today's players (filled
 * in when the replayed result comes back), and the countdown to tomorrow's grill.
 */
async function dailyPanel(date, moves, submitted) {
  const streak = (app.streak = advanceStreak(await db.get('dailyStreak', null), date));
  await db.set('dailyStreak', streak);
  const rank = h('p.daily-rank.muted', 'Checking your moves with the kitchen…');
  const verified = h('span.verified.pending', 'verifying');
  const clock = h('b.countdown', formatCountdown(msUntilNextDaily(Date.now())));
  const panel = h('div.daily-panel',
    h('div.daily-row',
      h('span.streak', { title: `Best streak: ${streak.best} days` }, '🔥 ', h('b', String(streak.count)), ' day streak'),
      verified,
    ),
    rank,
    h('p.next-daily', 'Next daily grill in ', clock),
  );
  const timer = setInterval(() => {
    const left = msUntilNextDaily(Date.now());
    clock.textContent = formatCountdown(left);
    if (!clock.isConnected || left < 1000) clearInterval(timer); // the modal closed, or the day rolled over
  }, 1000);
  submitted?.then((r) => {
    if (r?.queued) {
      verified.className = 'verified off';
      verified.textContent = 'offline';
      rank.textContent = 'Saved. Your result joins today’s ranking when you are back online.';
    } else if (r?.verified) {
      verified.className = 'verified ok';
      verified.textContent = '✓ verified';
      rank.textContent = rankLine({ ...r, moves });
      rank.classList.remove('muted');
    } else {
      verified.className = 'verified off';
      verified.textContent = 'offline';
      rank.textContent = 'Saved on this device. Rankings need a connection.';
    }
  });
  return panel;
}

async function share(moves) {
  const code = app.code ?? encodeStory(shareIndex(app.level.id));
  const url = `${location.origin}/p/${code}?m=${moves}`;
  const text = `I cleared this Grill Shuffle board in ${moves} moves. Can you beat it?`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Grill Shuffle', text, url });
      return;
    }
  } catch {}
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('Challenge link copied!');
  } catch {
    toast(url, 6000);
  }
}

// ---------------------------------------------------------------- keyboard

window.addEventListener('keydown', (e) => {
  if (app.route !== 'game') return;
  if (e.key === 'Escape') app.modal ? closeModal() : app.session?.armed || app.hud?.confirming ? disarm() : pauseMenu();
  else if ((e.key === 'z' || e.key === 'Z') && !app.modal) undo();
  else if ((e.key === 'r' || e.key === 'R') && !app.modal) restart();
  else if ((e.key === 'h' || e.key === 'H') && !app.modal) hint();
});

// ---------------------------------------------------------------- boot

let refitQueued = false;
function onViewportChange() {
  if (refitQueued) return;
  refitQueued = true;
  requestAnimationFrame(() => {
    refitQueued = false;
    stage.resize();
    refit();
    idle.wake();
  });
}
window.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', onViewportChange);
window.visualViewport?.addEventListener('resize', onViewportChange); // mobile address bar showing / hiding
document.fonts?.ready.then(onViewportChange); // Fredoka arriving changes the HUD's size

async function boot() {
  app.settings = { ...DEFAULT_SETTINGS, ...(await db.get('settings', {})) };
  audio.setMuted(app.settings.muted);
  audio.setVolumes({ sfx: app.settings.sfxVolume, ambience: app.settings.ambienceVolume });
  app.progress = await db.get('progress', {});
  app.streak = await db.get('dailyStreak', null);
  app.seenBoosters = await db.get('seenBoosters', {});
  render();
  applyQuality();
  stage.start((dt) => view.update(dt), { gate: (dt) => idle.tick(dt, view.busy), onRendered });
  syncNow();
  registerServiceWorker();
}
// pull cloud progress, then send whatever waited while offline
function syncNow() {
  pullProgress().then((p) => {
    if (p) app.progress = p;
    flushOutbox();
  });
}
window.addEventListener('online', syncNow);
boot();

// test / debugging hooks (the e2e script reads the authoritative state through these, never from meshes)
window.__gs = { app, view, stage, audio, go, doAction, idle, packs: PACKS, get state() { return app.session?.state; } };
