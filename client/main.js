// Grill Shuffle - app shell: routing, screens, and the game loop wiring.
//
//   /                 menu (+ SEO landing content below)
//   /<pack>/<n>       story level n of a pack, as numbered on screen, e.g. /hem-sai-gon/12 = /saigon-alley/12
//                     (routes.js: one slug per language, rewritten to the current one; /play/<id> too)
//   /play             the next unfinished story level
//   /levels           level select
//   /daily            today's puzzle (same board for everyone, UTC day)
//   /p/<code>         a shared challenge (generated, story or daily code), optional ?m=<moves to beat>
//   any game URL + ?r=<actions>&h=<hash> (or ?r=best): the replay viewer (game/replay-player.js)
import { Stage } from './render/stage.js';
import { BoardView } from './render/board.js';
import { foodIcon } from './render/icons.js';
import { Input } from './game/input.js';
import { Session } from './game/session.js';
import { ReplayPlayer, parseReplayParam, replayQuery } from './game/replay-player.js';
import { parseRoute as routeOf, levelPath as pathOf, levelPosition, levelsPath } from './game/routes.js';
import { PACKS, STORY, SHARE, THEMES, THEME_ICONS, STORY_FILES, getLevel, storyIndex, shareIndex, themeFor } from './game/content.js';
import { storyFor, STORY_DEFAULT_ON } from './game/story.js';
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
import { BOOSTERS } from '../shared/boosters.js';
import { starThresholds } from '../shared/progression.js';
import { decodeCode, encodeStory, encodeDaily, encodeGenerated, todayUTC } from '../shared/challenge.js';
import { VERSIONS, PUZZLE_RULE_VERSION } from '../shared/version.js';
import { registerServiceWorker } from './ui/update.js';
import { marginsFrom, baseMargins, rects, isShortLandscape } from './ui/fit.js';
import { TIERS, QUALITY_SETTINGS, initialTier, lowerTier, FrameMonitor, IdleGate } from './render/quality.js';
import { StatsOverlay } from './ui/stats.js';
import { initVariant } from './ui/variant.js';
import { badgeSvg } from './ui/brand.js';
import { t, pick, lang, setLang, detectLang, onLangChange, LANGS, DICTS } from './i18n/index.js';
import { applyStatic } from './i18n/dom.js';

// quality: 'auto' | 'high' | 'medium' | 'low'; autoTier: where auto mode settled on this device
const DEFAULT_SETTINGS = { lang: null, muted: false, sfxVolume: 1, ambienceVolume: 1, haptics: true, quality: 'auto', autoTier: null, story: true };

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
  replay: null, // ReplayPlayer while the replay viewer is open (input off, nothing recorded)
  busy: false,
};

// ---------------------------------------------------------------- board + input (one each, for the app's life)

const view = new BoardView(stage, { onFx: (ev, at) => onFx(ev, at) });
const input = new Input(canvas, () => app.session, view, {
  enabled: () => app.route === 'game' && app.session?.status === 'playing' && !app.modal && !app.replay,
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
const urlLang = new URLSearchParams(location.search).get('lang'); // ?lang=vi: this visit only (screenshots, tests)
const stats = new URLSearchParams(location.search).get('stats') === '1' ? new StatsOverlay(document.getElementById('app')) : null;
// Story beats (#80 engine, #81 player, client/story/ lazy-loaded). Off in production until the art is finished (#106
// flips STORY_DEFAULT_ON); ?story=on turns it on for a visit. ?story=log only prints what a launch / win would
// trigger (nothing plays, nothing is marked seen).
const storyParam = new URLSearchParams(location.search).get('story');
const STORY_ON = storyParam === 'on' || STORY_DEFAULT_ON;
const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const beatPack = new Map(STORY_FILES.flatMap((f) => (f.beats ?? []).map((b) => [b.id, f.pack])));
const transitionOf = (beat) => THEMES[PACKS.find((p) => p.id === beatPack.get(beat.id))?.theme]?.story?.transition ?? 'lights';
let storyRunning = null;
/** Play what `event` triggers (unless the player turned the story off), then mark it all seen. */
async function runStory(event) {
  if (!STORY_ON && storyParam !== 'log') return;
  await storyRunning;
  const r = storyFor(event, { progress: app.progress, seen: await db.get('storySeen', []) }, STORY_FILES, { packs: PACKS, themes: THEMES });
  if (storyParam === 'log') {
    console.info('[story]', event, { beats: r.beats.map((b) => (b.recap ? `recap(${b.beats.map((m) => m.id).join(', ')})` : b.id)), keepsakes: r.keepsakes.map((k) => k.id) });
    return;
  }
  if (!r.seen.length) return;
  storyRunning = (async () => {
    if (r.beats.length && app.settings.story !== false) {
      const { playStory } = await import('./story/player.js');
      await playStory(r.beats, { reduced: reducedMotion(), transitionFor: transitionOf });
    }
    // a beat skipped (or the story turned off) counts as seen: it never comes back as a backlog
    await db.markStorySeen(r.seen);
    pushProgressSoon();
  })();
  await storyRunning;
  storyRunning = null;
}
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
    app.hud?.tip(t('tip.noMoves'));
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
    app.hud.tip(s.charges(id) > 0 ? (BOOSTER_IDLE.has(id) ? t(`booster.idle.${id}`) : t('booster.idle', { name: boosterName(id) })) : t('booster.none', { name: boosterName(id) }));
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
      app.hud.tip(t(`booster.tip.${id}`));
    }
  } else {
    app.hud.confirm(null);
    if (s.armed === id) s.arm(null);
    else if (s.arm(id)) {
      app.hud.tip(t(`booster.tip.${id}`));
      const grills = s.boosterGrills(); // torch / cooler / tray swap: the grills it can act on light up
      if (grills.length) view.setTargets(grills, -1, { slots: false });
    }
  }
  app.hud.update(s.state);
}

// tapped while it has a charge but nothing to act on: why not (yet); the others get the generic line
const BOOSTER_IDLE = new Set(['torch', 'tray_swap', 'cooler']);
const boosterName = (id) => t(`booster.${id}`);
const foodName = (id) => t(`food.${id}`);

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
      if (app.replay) break; // the viewer has its own end card
      setTimeout(() => showResult(true), 250);
      break;
    case 'level_failed':
      if (app.replay) break;
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
  return PACKS.length > 1 ? t('level.labelPack', { pack: pick(at.pack.name), n: at.n }) : t('level.label', { n: at.n });
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
  stopReplay();
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
      toast(t('pack.locked', { pack: pick(PACKS[k].name), reason: lockReason(status) }));
      return go(levelsPath(PACKS[k]), { replace: true });
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
      h('div.logo', h('span.badge-art', { html: badgeSvg() }), h('h1.title', t('app.name')), h('p.subtitle', t('app.subtitle'))),
      h('div.menu-spacer'),
      h('div.menu-buttons',
        h('a.btn.big.primary', { href: levelPath(next) ?? '/play', 'data-nav': true }, stars ? t('menu.continue', { label: levelLabel(next) }) : t('menu.play')),
        h('div.row',
          h('a.btn', { href: '/daily', 'data-nav': true }, h('span', t('menu.daily')), streak ? h('span.badge', `🔥 ${streak}`) : null),
          h('a.btn', { href: '/levels', 'data-nav': true }, h('span', t('menu.levels')), stars ? h('span.badge', `★ ${stars}`) : null),
        ),
        h('button.btn.ghost', { on: { click: () => challengePicker() } }, t('menu.challenge')),
      ),
      h('div.menu-foot', soundToggle(), langSwitch(), installButton(), h('a.link', { href: '#about', on: { click: (e) => { e.preventDefault(); document.getElementById('landing').scrollIntoView({ behavior: 'smooth' }); } } }, t('menu.about'))),
    ),
  );
  if (!app.settings.lang && !LANGS.includes(urlLang)) langPicker(); // first launch: ask once (#89); ?lang= skips it
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
      if (await promptInstall()) toast(t('menu.installed'));
    } else openModal(...installGuide(), h('button.btn.ghost', { on: { click: closeModal } }, t('common.close')));
  } } }, t('menu.install'));
  const off = onInstallChange(() => {
    if (!b.isConnected) return off();
    if (installedThisVisit()) b.remove();
  });
  return b;
}

function soundToggle() {
  const b = h('button.icon-btn', { 'aria-label': t('sound.toggle'), on: { click: () => setMuted(!app.settings.muted, b) } });
  b.replaceChildren(iconEl(app.settings.muted ? 'mute' : 'sound'));
  return b;
}

// ---------------------------------------------------------------- language (vi / en: client/i18n)

/** Use a language: dictionaries, <html lang>, the landing text; listeners redraw what is on screen. */
function useLang(l, { save = false } = {}) {
  if (save) {
    app.settings.lang = l; // before the redraw: the menu must not ask again
    db.set('settings', app.settings);
  }
  setLang(l);
  applyStatic(document);
}

/** Redraw the current screen in the new language. A level keeps its session; an open pause menu reopens. */
function relabel() {
  if (app.route === 'menu' || app.route === 'levels') return render();
  if (app.route !== 'game' || !app.hud) return;
  const path = app.mode === 'story' && !app.replay ? levelPath(app.level.id) : null; // the URL follows the language
  if (path && location.pathname !== path) history.replaceState(null, '', path + location.search);
  const pause = app.modal?.dataset.kind === 'pause';
  closeModal();
  app.hud = new Hud(app.level, { replay: app.replay });
  screen(app.hud.el);
  app.hud.update(app.session.state, { immediate: true });
  view.setMargins(app.hud.margins());
  if (pause) pauseMenu();
}
onLangChange(() => relabel());

/** VI | EN segmented switch; a tap saves the player's choice. */
function langSwitch() {
  const buttons = LANGS.map((l) => h('button.seg-btn', { lang: l, 'aria-pressed': String(lang() === l), on: { click: () => (audio.onEvent({ type: 'button' }), useLang(l, { save: true })) } }, t(`lang.short.${l}`)));
  return h('div.seg.lang-seg', { role: 'group', 'aria-label': t('lang.label') }, ...buttons);
}

/** The language picker: title in both languages, one big button each. */
function langPicker() {
  audio.unlock();
  openModal(
    h('h2.lang-pick-title', DICTS.vi['lang.pickTitle'], h('br'), h('span.muted', DICTS.en['lang.pickTitle'])),
    h('div.modal-buttons.lang-pick', ...LANGS.map((l) => h(`button.btn${lang() === l ? '.primary' : ''}`, { lang: l, on: { click: () => (closeModal(), useLang(l, { save: true })) } }, DICTS[l][`lang.${l}`]))),
  );
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
  const input = h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(app.settings[key] * 100), 'aria-label': t('settings.volume', { label }), on: { input: (e) => apply(e.target.value / 100) } });
  return h('label.volume', h('span', label), input);
}

/** Graphics: Auto (steps down by itself when frames are slow) or a fixed tier. */
function qualityPicker() {
  const buttons = QUALITY_SETTINGS.map((q) =>
    h('button.seg-btn', { 'aria-pressed': String(app.settings.quality === q), on: { click: () => {
      audio.onEvent({ type: 'button' });
      app.settings.quality = q;
      if (q === 'auto') app.settings.autoTier = null; // re-measure from the top
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === buttons[QUALITY_SETTINGS.indexOf(q)]));
      applyQuality();
      db.set('settings', app.settings);
    } } }, t(`quality.${q}`)),
  );
  return h('div.volume', h('span', t('settings.graphics')), h('div.seg', { role: 'group', 'aria-label': t('settings.graphicsQuality') }, ...buttons));
}

/** Story beats on / off ("skip story"): off still marks them seen, so turning it on later never replays a backlog. */
function storyPicker() {
  const buttons = [true, false].map((on) =>
    h('button.seg-btn', { 'aria-pressed': String((app.settings.story !== false) === on), on: { click: () => {
      audio.onEvent({ type: 'button' });
      app.settings.story = on;
      buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === (on ? 0 : 1))));
      db.set('settings', app.settings);
    } } }, t(on ? 'common.on' : 'common.off')),
  );
  return h('div.volume', h('span', t('settings.story')), h('div.seg', { role: 'group', 'aria-label': t('settings.story') }, ...buttons));
}

function challengePicker() {
  audio.unlock();
  openModal(
    h('h2', t('menu.challenge')),
    h('p.muted', t('challenge.pick')),
    h('div.band-grid', ...['E', 'N', 'H', 'V'].map((b) =>
      h('button.btn', { on: { click: () => go(`/p/${encodeGenerated(b, Math.floor(Math.random() * 32 ** 5))}`) } }, t(`band.${b}`)),
    )),
    h('button.btn.ghost', { on: { click: closeModal } }, t('common.back')),
  );
}

function showLevels(packId) {
  app.route = 'levels';
  app.hud = null;
  app.fit = null;
  // one tab per pack (theme), numbered inside the pack (the URL number). /levels/<slug> (either language) picks the tab; plain /levels
  // opens the pack "Continue" is in (old /levels#pack-<id> links too). A pack opens when the previous one is finished
  // and its theme's star requirement is met (game/unlock.js); a locked tab says what it needs.
  const hashId = location.hash.startsWith('#pack-') ? location.hash.slice(6) : null;
  const sel = Math.max(0, PACKS.findIndex((p) => (packId ? p.id === packId : hashId ? p.id === hashId : p.levels.includes(nextStoryLevel()))));
  const pack = PACKS[sel];
  if (packId && location.pathname !== levelsPath(pack)) history.replaceState(null, '', levelsPath(pack)); // the other language's slug
  const card = (id, n) => {
    const lvl = getLevel(id);
    const open = levelOpen(PACKS, id, app.progress, THEMES);
    const stars = app.progress[id]?.stars ?? 0;
    return open
      ? h('a.level-card', { href: levelPath(id), 'data-nav': true }, h('span.num', String(n)), h('span.name', pick(lvl.name) || id), starsEl(stars, 3, 'stars.small'))
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
    : h('nav.pack-tabs', { 'aria-label': t('levels.themes') },
        ...PACKS.map((p, k) => {
          const st = packStatus(PACKS, k, app.progress, THEMES);
          const cls = `a.pack-tab${st.open ? '' : '.locked'}`;
          return h(cls, { href: levelsPath(p), 'data-nav': true, 'data-pack': p.id, 'aria-current': k === sel ? 'page' : null },
            swatch(p),
            h('span.pack-tab-text', h('span.pack-tab-name', pick(p.name)), h('span.pack-tab-sub', st.open ? `★ ${storyStars([p], app.progress)}/${p.levels.length * 3}` : `★ ${st.need}`)),
            st.open ? null : iconEl('lock'),
          );
        }),
      );
  screen(
    h('div.levels',
      h('header.levels-head', h('a.btn.ghost', { href: '/', 'data-nav': true }, t('common.backToMenu')), h('h2', one ? pick(pack.name) : t('levels.title')), h('span.badge', `★ ${storyStars(PACKS, app.progress)}/${STORY.length * 3}`)),
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
    toast(t('code.broken'));
    return go('/', { replace: true });
  }
  if (d.kind === 'story') {
    const id = SHARE[d.index];
    return id && getLevel(id) ? startLevel(getLevel(id), { mode: 'challenge', code: d.code }) : go('/', { replace: true });
  }
  screen(h('div.loading', h('div.spinner'), h('p', t(d.kind === 'daily' ? 'code.loadingDaily' : 'code.loadingChallenge'))));
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
    toast(t('code.failed'));
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
  useTheme(themeFor(level));
  const request = parseReplayParam(location.search);
  if (request) return startReplay(level, request);
  app.session = new Session(level);
  if (mode === 'story') db.set('current', level.id);
  app.hud = new Hud(level);
  screen(app.hud.el);
  app.hud.update(app.session.state, { immediate: true }); // goals first: their chips are part of what the HUD covers
  app.fit = () => app.hud.margins();
  view.setMargins(app.hud.margins());
  view.setState(app.session.state);
  if (level.hint && mode === 'story' && !(app.progress[level.id]?.stars > 0)) app.hud.tip(pick(level.hint));
  dismissCoach();
  if (wantsCoach(level, mode)) app.coach = new Coach(fxLayer, view, coachMove(level));
  if (app.target) app.hud.tip(t('tip.friend', { moves: app.target }));
  window.__gameReady = true;
}

// ---------------------------------------------------------------- replay viewer

/**
 * Watch a run (?r=<actions>&h=<hash>) or the stored best solution (?r=best) on the normal board: the same session,
 * simulation and BoardView.play as a live game. The whole run is checked first; an invalid one is never shown. Input
 * is off and nothing is recorded (no stars, no results).
 */
function startReplay(level, request) {
  dismissCoach();
  const player = new ReplayPlayer(level, request, {
    onStep: (r) => {
      view.play(r.state, r.events);
      app.hud?.update(r.state);
    },
    onReset: (s) => {
      view.skip();
      view.setState(s);
      app.hud?.update(s, { immediate: true });
    },
    onEnd: () => {
      app.hud?.update(player.state);
      setTimeout(() => app.replay === player && player.done && replayEndCard(player), 1100 / player.speed);
    },
  });
  app.replay = player;
  app.session = player.session;
  app.hud = new Hud(level, { replay: player });
  screen(app.hud.el);
  app.hud.update(player.state, { immediate: true });
  app.fit = () => app.hud.margins();
  view.setMargins(app.hud.margins());
  view.setState(player.state);
  if (!player.valid) {
    openModal(
      h('h2', t('replay.invalidTitle')),
      h('p.muted', t('replay.invalidBody', { error: player.error })),
      h('div.modal-buttons', h('a.btn.primary', { href: location.pathname, 'data-nav': true }, t('replay.playLevel')), h('a.btn.ghost', { href: '/', 'data-nav': true }, t('common.menu'))),
    );
  } else {
    app.hud.tip(t(player.source === 'best' ? 'replay.tipBest' : 'replay.tip', { n: player.actions.length }));
    player.play();
    app.hud.update(player.state);
  }
  window.__gameReady = true;
}

function stopReplay() {
  app.replay?.dispose();
  app.replay = null;
}

function replayEndCard(p) {
  const s = p.state;
  openModal(
    h('h2.win', t(p.source === 'best' ? 'replay.endBest' : 'replay.end')),
    h('p.muted', s.status === 'won' ? t('replay.cleared', { n: s.movesUsed }) : s.status === 'lost' ? t('replay.lost') : t('replay.stopped', { n: s.movesUsed })),
    h('p.replay-hash', t('replay.finalBoard'), h('code', p.finalHash), p.matches ? h('span.verified.ok', t('replay.same')) : null),
    h('div.modal-buttons',
      h('a.btn.primary', { href: location.pathname, 'data-nav': true }, t('replay.playYourself')),
      h('button.btn', { on: { click: () => (closeModal(), p.restart(), p.play(), app.hud.update(p.state)) } }, t('replay.again')),
      h('a.btn.ghost', { href: '/', 'data-nav': true }, t('common.menu')),
    ),
  );
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
  } else toast(t(r?.solvable === false ? 'hint.noWin' : 'hint.busy'));
}

class Hud {
  /** `replay`: a ReplayPlayer; the bottom bar becomes its controls and the moves box its progress. */
  constructor(level, { replay = null } = {}) {
    this.level = level;
    this.replay = replay;
    const name = app.mode === 'daily' ? t('hud.daily', { date: level.id.slice(6) }) : app.mode === 'challenge' && !STORY.includes(level.id) ? t('hud.challenge', { code: app.code }) : levelLabel(level.id);
    // replay: what is playing on top, the level underneath (its name would not fit as well)
    const title = replay ? t(replay.source === 'best' ? 'hud.bestSolution' : 'hud.replay') : name;
    const sub = replay ? name : pick(level.name);
    this.movesEl = h('span.moves-num', '0');
    this.goalsEl = h('div.goals');
    this.comboEl = h('div.combo');
    this.tipEl = h('div.tip');
    this.undoBtn = h('button.tool', { 'aria-label': t('hud.undo'), on: { click: () => (audio.onEvent({ type: 'button' }), undo()) } }, iconEl('undo'), h('span', t('hud.undo')));
    // one button per booster the level grants (generic over BOOSTERS: new ones only need an icon and a tip)
    this.confirming = null;
    this.boosters = app.session.boosterIds().map((id) => {
      const count = h('span.charge');
      const label = h('span.tool-label', boosterName(id));
      const el = h('button.tool.booster', { 'data-booster': id, 'aria-label': boosterName(id), on: { click: () => tapBooster(id) } }, iconEl(id), label, count, app.seenBoosters[id] ? null : h('span.new-tag', t('booster.new')));
      return { id, el, count, label };
    });
    const tool = (label, icon, fn) => h('button.tool', { 'aria-label': label, on: { click: () => (audio.onEvent({ type: 'button' }), fn(), this.update(app.session.state)) } }, iconEl(icon), h('span.tool-label', label));
    if (replay) {
      // the viewer's controls instead of undo / hint / boosters
      this.undoBtn = null;
      this.boosters = [];
      this.playBtn = tool(t('hud.pause'), 'pause', () => replay.toggle());
      this.speedBtn = h('button.tool.replay-speed', { 'aria-label': t('hud.speed'), on: { click: () => (audio.onEvent({ type: 'button' }), replay.cycleSpeed(), this.update(replay.state)) } }, h('span.speed-num', '1×'), h('span.tool-label', t('hud.speed')));
      this.stepBtn = tool(t('hud.step'), 'step', () => (replay.pause(), replay.step()));
      this.skipBtn = tool(t('hud.end'), 'skip', () => replay.skip());
    }
    const footer = replay
      ? h('footer.hud-bottom.compact', tool(t('hud.restart'), 'restart', () => replay.restart()), this.playBtn, this.stepBtn, this.speedBtn, this.skipBtn)
      : h('footer.hud-bottom',
          this.undoBtn,
          h('button.tool', { 'aria-label': t('hud.hint'), on: { click: () => (audio.onEvent({ type: 'button' }), hint()) } }, iconEl('hint'), h('span', t('hud.hint'))),
          h('button.tool', { 'aria-label': t('hud.restart'), on: { click: () => (audio.onEvent({ type: 'button' }), restart()) } }, iconEl('restart'), h('span', t('hud.restart'))),
          this.boosters.length ? h('span.tool-sep', { 'aria-hidden': 'true' }) : null,
          ...this.boosters.map((b) => b.el),
        );
    this.el = h(`div.hud${replay ? '.replaying' : ''}`,
      h('header.hud-top',
        replay
          ? h('a.icon-btn', { href: location.pathname, 'data-nav': true, 'aria-label': t('hud.closeReplay') }, iconEl('close'))
          : h('button.icon-btn', { 'aria-label': t('hud.pause'), on: { click: () => pauseMenu() } }, iconEl('pause')),
        h('div.hud-title', h('div.lvl', title), h('div.lvl-name', sub)),
        h('div.moves', h('span.moves-label', t(replay ? 'hud.step' : 'hud.moves')), this.movesEl),
      ),
      this.goalsEl,
      this.comboEl,
      this.tipEl,
      footer,
    );
    if (this.boosters.length) footer.classList.add('has-boosters');
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
    const rp = this.replay;
    this.movesEl.textContent = rp ? `${rp.index}/${rp.actions.length}` : String(s.movesLeft);
    this.movesEl.parentElement.classList.toggle('low', !rp && s.movesLeft <= 3 && s.status === 'playing');
    if (rp) {
      this.playBtn.replaceChildren(iconEl(rp.playing ? 'pause' : 'play'), h('span.tool-label', t(rp.playing ? 'hud.pause' : rp.done ? 'hud.again' : 'hud.play')));
      this.playBtn.setAttribute('aria-label', t(rp.playing ? 'hud.pause' : 'hud.play'));
      this.speedBtn.querySelector('.speed-num').textContent = `${rp.speed}×`;
      for (const b of [this.playBtn, this.stepBtn, this.skipBtn]) b.disabled = !rp.valid;
      if (rp.done) this.stepBtn.disabled = this.skipBtn.disabled = true;
    }
    if (this.undoBtn) this.undoBtn.disabled = !app.session.canUndo();
    const ses = app.session;
    for (const b of this.boosters) {
      const n = ses.charges(b.id);
      const armed = ses.armed === b.id || this.confirming === b.id;
      b.count.textContent = String(n);
      b.el.disabled = !armed && !ses.canUseBooster(b.id);
      b.el.classList.toggle('armed', armed);
      b.el.setAttribute('aria-pressed', String(armed));
      b.label.textContent = this.confirming === b.id ? t('booster.blow') : ses.armed === b.id ? t('booster.cancel') : boosterName(b.id);
      if (app.seenBoosters[b.id]) b.el.querySelector('.new-tag')?.remove();
    }
    view.setReach(ses.armed === 'tongs');
    if (!this.goalEls.length) {
      this.goalEls = s.goals.map((g) => {
        const icon = g.food ? h('img.goal-icon', { src: foodIcon(stage.renderer, g.food), alt: foodName(g.food) }) : h('span.goal-icon.all', '🔥');
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
      ge.count.textContent = left > 0 ? (g.type === 'clear_all' ? t('goal.left', { n: left }) : `×${left}`) : '✓';
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
    this.comboEl.textContent = n >= 4 ? t('combo.sizzling', { n }) : n === 3 ? t('combo.hot') : t('combo.n', { n });
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
      return t('goal.clear_all');
    case 'clear_food':
    case 'serve_food':
      return t('goal.serve', { n: g.target, food: foodName(g.food) });
    case 'complete_matches':
      return t('goal.matches', { n: g.target });
    case 'reach_score':
      return t('goal.score', { n: g.target });
    case 'clear_blocker':
      return t('goal.blocker');
    case 'reveal_hidden':
      return t('goal.hidden');
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
    h('h2', t('pause.title')),
    h('div.modal-buttons',
      h('button.btn.primary', { on: { click: closeModal } }, t('pause.resume')),
      h('button.btn', { on: { click: restart } }, t('hud.restart')),
      h('a.btn', { href: '/levels', 'data-nav': true }, t('menu.levels')),
      h('a.btn.ghost', { href: '/', 'data-nav': true }, t('common.menu')),
    ),
    h('div.volumes', volumeSlider(t('settings.effects'), 'sfxVolume'), volumeSlider(t('settings.ambience'), 'ambienceVolume'), qualityPicker(), STORY_ON ? storyPicker() : null, h('div.volume', h('span', t('lang.label')), langSwitch())),
    h('div.modal-foot', soundToggle()),
  );
  app.modal.dataset.kind = 'pause';
}

async function showResult(won, reason) {
  const s = app.session.state;
  const level = app.level;
  if (!won) {
    openModal(
      h('h2', t(reason === 'stuck' ? 'lose.stuck' : reason === 'charred' ? 'lose.charred' : 'lose.moves')),
      h('p.muted', t(reason === 'stuck' ? 'lose.stuckBody' : reason === 'charred' ? 'lose.charredBody' : 'lose.movesBody')),
      h('div.modal-buttons',
        h('button.btn.primary', { on: { click: restart } }, t('lose.retry')),
        app.session.canUndo() ? h('button.btn', { on: { click: undo } }, t('lose.undo')) : null,
        h('a.btn.ghost', { href: '/', 'data-nav': true }, t('common.menu')),
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
  if (app.mode === 'story') await runStory({ on: 'win', level: level.id }); // the beats first, then "Next" goes on
  const submitted = app.mode !== 'story' && app.code
    ? submitResult(app.mode === 'daily' ? 'daily' : 'challenge', app.code, { code: app.code, date: app.mode === 'daily' ? level.id.slice(6) : undefined, moves: app.session.replayString(), hash: app.session.finalHash(), versions: VERSIONS })
    : null;
  const daily = app.mode === 'daily' ? await dailyPanel(level.id.slice(6), s.movesUsed, submitted) : null;
  const th = min ? starThresholds(min) : null;
  const idx = storyIndex(level.id);
  const nextId = app.mode === 'story' && idx >= 0 ? nextLevelAfter(PACKS, level.id, app.progress, THEMES) : null;
  const moreLocked = app.mode === 'story' && !nextId && idx >= 0 && idx < STORY.length - 1; // next pack not open yet
  const used = Object.entries(app.session.boostersUsed()).map(([id, n]) => (n > 1 ? t('booster.count', { name: boosterName(id), n }) : boosterName(id)));
  const beat = app.target ? t(s.movesUsed < app.target ? 'win.beat' : s.movesUsed === app.target ? 'win.tied' : 'win.rematch', { n: app.target }) : null;
  openModal(
    h('h2.win', t(stars === 3 ? 'win.three' : 'win.title')),
    starsEl(stars, 3, 'stars.big'),
    h('div.result-stats',
      h('div', h('b', String(s.movesUsed)), h('span', t('win.moves'))),
      h('div', h('b', String(s.score)), h('span', t('win.score'))),
      h('div', h('b', `x${s.maxCombo}`), h('span', t('win.combo'))),
    ),
    min ? h('p.muted', stars === 3 ? t('win.solved', { moves: s.movesUsed, min }) : t('win.threeAt', { three: th.three, min })) : null,
    used.length ? h('p.muted.boosters-used', t('win.boosters', { list: used.join(', ') })) : null,
    beat ? h('p.beat', beat) : null,
    daily,
    improved && app.mode === 'story' ? h('p.muted', t('win.newBest')) : null,
    h('div.modal-buttons',
      nextId
        ? h('a.btn.primary', { href: levelPath(nextId), 'data-nav': true }, t('win.next'))
        : moreLocked
          ? h('a.btn.primary', { href: '/levels', 'data-nav': true }, t('menu.levels'))
          : h('a.btn.primary', { href: '/', 'data-nav': true }, t('common.menu')),
      h('button.btn', { on: { click: () => share(s.movesUsed) } }, iconEl('share'), t('win.challenge')),
      h('button.btn.ghost', { on: { click: restart } }, t('win.again')),
    ),
    h('div.result-links',
      level.solver?.solution ? h('a.link', { href: `${location.pathname}?r=best`, 'data-nav': true }, iconEl('play'), t('win.watchBest')) : null,
      h('button.link', { on: { click: () => shareReplay() } }, iconEl('share'), t('win.shareReplay')),
    ),
  );
}

/** A link that replays this exact run for anyone (checked against its final hash when it opens). */
async function shareReplay() {
  const code = app.code ?? encodeStory(shareIndex(app.level.id));
  const url = `${location.origin}/p/${code}?${replayQuery(app.session.replayString(), app.session.finalHash())}`;
  const text = t('share.replayText', { n: app.session.state.movesUsed });
  try {
    if (navigator.share) {
      await navigator.share({ title: t('share.replayTitle'), text, url });
      return;
    }
  } catch {}
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast(t('share.replayCopied'));
  } catch {
    toast(url, 6000);
  }
}

/**
 * The daily's part of the result screen: local streak, the server's verified rank among today's players (filled
 * in when the replayed result comes back), and the countdown to tomorrow's grill.
 */
async function dailyPanel(date, moves, submitted) {
  const streak = (app.streak = advanceStreak(await db.get('dailyStreak', null), date));
  await db.set('dailyStreak', streak);
  const rank = h('p.daily-rank.muted', t('daily.checking'));
  const verified = h('span.verified.pending', t('daily.verifying'));
  const clock = h('b.countdown', formatCountdown(msUntilNextDaily(Date.now())));
  const panel = h('div.daily-panel',
    h('div.daily-row',
      h('span.streak', { title: t('daily.bestStreak', { n: streak.best }) }, '🔥 ', h('b', String(streak.count)), t('daily.streak')),
      verified,
    ),
    rank,
    h('p.next-daily', t('daily.next'), clock),
  );
  const timer = setInterval(() => {
    const left = msUntilNextDaily(Date.now());
    clock.textContent = formatCountdown(left);
    if (!clock.isConnected || left < 1000) clearInterval(timer); // the modal closed, or the day rolled over
  }, 1000);
  submitted?.then((r) => {
    if (r?.queued) {
      verified.className = 'verified off';
      verified.textContent = t('daily.offline');
      rank.textContent = t('daily.queued');
    } else if (r?.verified) {
      verified.className = 'verified ok';
      verified.textContent = t('daily.verified');
      rank.textContent = rankLine({ ...r, moves });
      rank.classList.remove('muted');
    } else {
      verified.className = 'verified off';
      verified.textContent = t('daily.offline');
      rank.textContent = t('daily.local');
    }
  });
  return panel;
}

async function share(moves) {
  const code = app.code ?? encodeStory(shareIndex(app.level.id));
  const url = `${location.origin}/p/${code}?m=${moves}`;
  const text = t('share.text', { n: moves });
  try {
    if (navigator.share) {
      await navigator.share({ title: t('share.title'), text, url });
      return;
    }
  } catch {}
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast(t('share.copied'));
  } catch {
    toast(url, 6000);
  }
}

// ---------------------------------------------------------------- keyboard

window.addEventListener('keydown', (e) => {
  if (app.route !== 'game') return;
  if (app.replay) {
    // viewer: space plays / pauses, right arrow steps, Esc closes the end card or leaves the viewer
    if (e.key === ' ') {
      e.preventDefault();
      app.replay.toggle();
    } else if (e.key === 'ArrowRight') {
      app.replay.pause();
      app.replay.step();
    } else if (e.key === 'Escape') return app.modal ? closeModal() : go(location.pathname);
    app.hud?.update(app.replay.state);
    return;
  }
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
document.fonts?.ready.then(onViewportChange); // Baloo 2 arriving changes the HUD's size

async function boot() {
  initVariant(); // ?variant=<n>: design prototypes (CONTRIBUTING.md step 0)
  app.settings = { ...DEFAULT_SETTINGS, ...(await db.get('settings', {})) };
  useLang(LANGS.includes(urlLang) ? urlLang : detectLang(app.settings.lang, navigator.languages ?? [navigator.language]));
  audio.setMuted(app.settings.muted);
  audio.setVolumes({ sfx: app.settings.sfxVolume, ambience: app.settings.ambienceVolume });
  app.progress = await db.get('progress', {});
  app.streak = await db.get('dailyStreak', null);
  app.seenBoosters = await db.get('seenBoosters', {});
  render();
  applyQuality();
  stage.start((dt) => view.update(dt * (app.replay?.speed ?? 1)), { gate: (dt) => idle.tick(dt, view.busy), onRendered });
  // the cold open (first launch) and the memories recap, once the cloud's seen list is merged (or after 3 s offline)
  Promise.race([syncNow(), new Promise((r) => setTimeout(r, 3000))]).then(() => runStory({ on: 'launch' }));
  registerServiceWorker();
}
// pull cloud progress, then send whatever waited while offline
function syncNow() {
  return pullProgress().then((p) => {
    if (p) app.progress = p;
    flushOutbox();
  });
}
window.addEventListener('online', syncNow);
boot();

// test / debugging hooks (the e2e script reads the authoritative state through these, never from meshes)
window.__gs = { app, view, stage, audio, go, doAction, idle, packs: PACKS, get state() { return app.session?.state; } };
