// Grill Shuffle - app shell: routing, screens, and the game loop wiring.
//
//   /                 menu (+ SEO landing content below)
//   /play[/<id>]      story level (default: the next unfinished one)
//   /levels           level select
//   /daily            today's puzzle (same board for everyone, UTC day)
//   /p/<code>         a shared challenge (generated, story or daily code), optional ?m=<moves to beat>
import { Stage } from './render/stage.js';
import { BoardView } from './render/board.js';
import { foodIcon } from './render/icons.js';
import { Input } from './game/input.js';
import { Session } from './game/session.js';
import { STORY, SHARE, getLevel, storyIndex, shareIndex, themeFor } from './game/content.js';
import { puzzleFromCode, hintFor } from './game/solver-client.js';
import { Audio } from './audio/audio.js';
import * as db from './storage/db.js';
import { pullProgress, pushProgressSoon, submitResult, fetchDaily } from './storage/sync.js';
import { advanceStreak, currentStreak, msUntilNextDaily, formatCountdown, serverDailyLevel, rankLine } from './game/daily.js';
import { h, iconEl, toast, floatText, starsEl } from './ui/dom.js';
import { FOODS } from '../shared/foods.js';
import { starThresholds, isUnlocked, totalStars } from '../shared/progression.js';
import { decodeCode, encodeStory, encodeDaily, encodeGenerated, todayUTC, BANDS } from '../shared/challenge.js';
import { VERSIONS } from '../shared/version.js';

const ui = document.getElementById('ui');
const canvas = document.getElementById('stage');
const audio = new Audio();
const stage = new Stage(canvas, { theme: themeFor(null) });
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
  settings: { muted: false },
  hud: null,
  busy: false,
};

// ---------------------------------------------------------------- board + input (one each, for the app's life)

const view = new BoardView(stage, { onFx: (ev, at) => onFx(ev, at) });
new Input(canvas, () => app.session, view, {
  enabled: () => app.route === 'game' && app.session?.status === 'playing' && !app.modal,
  onGesture: () => audio.unlock(),
  onSelect: () => audio.onEvent({ type: 'select' }),
  onInvalid: (g, o) => {
    if (!o?.quiet) audio.onEvent({ type: 'invalid' });
  },
  onMove: (move, { dropped }) => doAction(move, { dropped }),
});

function doAction(action, opts = {}) {
  const r = app.session.apply(action);
  if (!r.ok) return false;
  view.showHint(null);
  view.play(r.state, r.events, opts);
  app.hud?.update(r.state, { immediate: true });
  return true;
}

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

function parseRoute(path = location.pathname) {
  const p = path.replace(/\/+$/, '') || '/';
  let m;
  if (p === '/') return { name: 'menu' };
  if (p === '/levels') return { name: 'levels' };
  if (p === '/daily') return { name: 'daily' };
  if (p === '/play') return { name: 'play' };
  if ((m = /^\/play\/([a-z0-9-]+)$/.exec(p))) return { name: 'play', id: m[1] };
  if ((m = /^\/p\/([A-Za-z0-9-]+)$/.exec(p))) return { name: 'code', code: m[1] };
  return { name: 'menu' };
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
  document.body.classList.toggle('in-game', r.name !== 'menu');
  if (r.name === 'menu') return showMenu();
  if (r.name === 'levels') return showLevels();
  if (r.name === 'play') {
    const id = r.id ?? nextStoryLevel();
    const lvl = getLevel(id);
    if (!lvl) return go('/', { replace: true });
    return startLevel(lvl, { mode: 'story' });
  }
  if (r.name === 'daily') return startCode(encodeDaily(todayUTC()), { mode: 'daily' });
  if (r.name === 'code') return startCode(r.code, { mode: 'challenge' });
}

function nextStoryLevel() {
  return STORY.find((id) => !(app.progress[id]?.stars > 0)) ?? STORY.at(-1);
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
  if (demo) {
    app.session = new Session(demo);
    view.setMargins({ marginTop: stage.size.h < 700 ? 150 : 190, marginBottom: 290, marginSide: 12 });
    view.setState(app.session.state);
  }
  const stars = totalStars(app.progress);
  const streak = currentStreak(app.streak, todayUTC());
  const next = nextStoryLevel();
  const nextIdx = storyIndex(next) + 1;
  screen(
    h('div.menu',
      h('div.logo', h('h1.title', 'Grill Shuffle'), h('p.subtitle', 'Food Sort & Match Puzzle')),
      h('div.menu-spacer'),
      h('div.menu-buttons',
        h('a.btn.big.primary', { href: '/play', 'data-nav': true }, stars ? `Continue · Level ${nextIdx}` : 'Play'),
        h('div.row',
          h('a.btn', { href: '/daily', 'data-nav': true }, h('span', 'Daily Grill'), streak ? h('span.badge', `🔥 ${streak}`) : null),
          h('a.btn', { href: '/levels', 'data-nav': true }, h('span', 'Levels'), stars ? h('span.badge', `★ ${stars}`) : null),
        ),
        h('button.btn.ghost', { on: { click: () => challengePicker() } }, "Chef's Challenge"),
      ),
      h('div.menu-foot', soundToggle(), h('a.link', { href: '#about', on: { click: (e) => { e.preventDefault(); document.getElementById('landing').scrollIntoView({ behavior: 'smooth' }); } } }, 'About the game ↓')),
    ),
  );
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

function showLevels() {
  app.route = 'levels';
  app.hud = null;
  const cards = STORY.map((id, i) => {
    const lvl = getLevel(id);
    const open = isUnlocked(STORY, i, app.progress);
    const stars = app.progress[id]?.stars ?? 0;
    return open
      ? h('a.level-card', { href: `/play/${id}`, 'data-nav': true }, h('span.num', String(i + 1)), h('span.name', lvl.name ?? id), starsEl(stars, 3, 'stars.small'))
      : h('div.level-card.locked', h('span.num', String(i + 1)), iconEl('lock'));
  });
  screen(
    h('div.levels',
      h('header.levels-head', h('a.btn.ghost', { href: '/', 'data-nav': true }, '← Menu'), h('h2', 'Street BBQ'), h('span.badge', `★ ${totalStars(app.progress)}/${STORY.length * 3}`)),
      h('div.level-grid', ...cards),
    ),
  );
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
  // the daily is pre-built on the server (Cron): use it when it is there, else build it here (same code, same board)
  const pre = d.kind === 'daily' ? serverDailyLevel(await fetchDaily(d.date), d.code, d.date) : null;
  const res = pre ? { ok: true, level: pre } : await puzzleFromCode(d.code);
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
  if (mode === 'story') db.set('current', level.id);
  app.hud = new Hud(level);
  screen(app.hud.el);
  view.setMargins(app.hud.margins());
  view.setState(app.session.state);
  app.hud.update(app.session.state, { immediate: true });
  if (level.hint && mode === 'story' && !(app.progress[level.id]?.stars > 0)) app.hud.tip(level.hint);
  if (app.target) app.hud.tip(`A friend finished this in ${app.target} moves. Can you beat it?`);
  window.__gameReady = true;
}

function restart() {
  app.session.restart();
  view.setState(app.session.state);
  app.hud.update(app.session.state, { immediate: true });
  closeModal();
}

function undo() {
  if (!app.session.canUndo()) return;
  view.skip();
  app.session.undo();
  view.setState(app.session.state);
  app.hud.update(app.session.state, { immediate: true });
  closeModal();
}

async function hint() {
  if (app.session.status !== 'playing' || app.busy) return;
  app.busy = true;
  const r = await hintFor(app.session.state);
  app.busy = false;
  if (r?.move) {
    app.session.hints++;
    view.showHint(r.move);
    view.select(r.move.from.grill, r.move.from.slot);
    view.setTargets([r.move.to.grill]);
    setTimeout(() => {
      view.select(null);
      view.setTargets(null);
    }, 1600);
  } else toast(r?.solvable === false ? 'No win from here: undo or restart.' : 'The chef is thinking too hard. Try again.');
}

class Hud {
  constructor(level) {
    this.level = level;
    const title = app.mode === 'daily' ? `Daily · ${level.id.slice(6)}` : app.mode === 'challenge' && !STORY.includes(level.id) ? `Challenge ${app.code}` : `Level ${storyIndex(level.id) + 1}`;
    this.movesEl = h('span.moves-num', '0');
    this.goalsEl = h('div.goals');
    this.comboEl = h('div.combo');
    this.tipEl = h('div.tip');
    this.undoBtn = h('button.tool', { 'aria-label': 'Undo', on: { click: () => (audio.onEvent({ type: 'button' }), undo()) } }, iconEl('undo'), h('span', 'Undo'));
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
      ),
    );
    this.goalEls = [];
  }

  margins() {
    const w = stage.size.w;
    return { marginTop: w < 600 ? 128 : 118, marginBottom: w < 600 ? 92 : 86, marginSide: 10 };
  }

  update(s, { immediate = false } = {}) {
    this.movesEl.textContent = String(s.movesLeft);
    this.movesEl.parentElement.classList.toggle('low', s.movesLeft <= 3 && s.status === 'playing');
    this.undoBtn.disabled = !app.session.canUndo();
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
      const guard = g.type === 'protect_food'; // a constraint: nothing to collect, it can only fail
      ge.count.textContent = g.failed ? '✗' : guard ? 'safe' : left > 0 ? (g.type === 'clear_all' ? `${left} left` : `×${left}`) : '✓';
      ge.el.classList.toggle('done', left <= 0 && !g.failed && !guard);
    });
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
    case 'protect_food':
      return `Don't let any ${FOODS[g.food].name} char`;
    case 'clear_before_char':
      return `Serve ${g.target} burning ${g.food ? FOODS[g.food].name : 'item'}${g.target === 1 ? '' : 's'} before they char`;
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
    h('div.modal-foot', soundToggle()),
  );
}

async function showResult(won, reason) {
  const s = app.session.state;
  const level = app.level;
  if (!won) {
    openModal(
      h('h2', reason === 'stuck' ? 'No room left!' : reason === 'charred' ? 'Burnt!' : 'Out of moves'),
      h('p.muted', reason === 'stuck' ? 'Every slot is full. Undo a move or start over.' : reason === 'charred' ? 'That one had to be served before it charred.' : 'So close. One more try?'),
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
  const nextId = app.mode === 'story' && idx >= 0 ? STORY[idx + 1] : null;
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
    beat ? h('p.beat', beat) : null,
    daily,
    improved && app.mode === 'story' ? h('p.muted', 'New best saved.') : null,
    h('div.modal-buttons',
      nextId ? h('a.btn.primary', { href: `/play/${nextId}`, 'data-nav': true }, 'Next level') : h('a.btn.primary', { href: '/', 'data-nav': true }, 'Menu'),
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
    if (r?.verified) {
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
  if (e.key === 'Escape') app.modal ? closeModal() : pauseMenu();
  else if ((e.key === 'z' || e.key === 'Z') && !app.modal) undo();
  else if ((e.key === 'r' || e.key === 'R') && !app.modal) restart();
  else if ((e.key === 'h' || e.key === 'H') && !app.modal) hint();
});

// ---------------------------------------------------------------- boot

window.addEventListener('resize', () => {
  stage.resize();
  if (app.hud) view.setMargins(app.hud.margins());
  else view.relayout();
});

async function boot() {
  app.settings = { muted: false, ...(await db.get('settings', {})) };
  audio.setMuted(app.settings.muted);
  app.progress = await db.get('progress', {});
  app.streak = await db.get('dailyStreak', null);
  render();
  stage.start((dt) => view.update(dt));
  pullProgress().then((p) => {
    if (p) app.progress = p;
  });
}
boot();

// test / debugging hooks (the e2e script reads the authoritative state through these, never from meshes)
window.__gs = { app, view, stage, go, doAction, get state() { return app.session?.state; } };
