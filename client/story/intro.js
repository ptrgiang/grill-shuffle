// The level's opening (owner, 2026-10-09): the story told before play, not a banner over it. The stop's page keeper
// (Cô Sáu in the alley, Chú Tư at the beach) talks in front of the place while the level's line types out; the game
// behind is blurred; "Serve" starts the level. A tap finishes the typing; Enter / Space serves once it is done.
//
//   await playIntro({ who, place, title, text, serveLabel, saysLabel, reduced, sound })
import { drawPerson, POSES } from './rig.js';
import { drawScene, drawBeach } from './scene.js';
import { setStyle, overlay } from './style.js';
import { t as tr } from '../i18n/index.js';

const CPS = 34; // characters per second
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

/** One frame of the narrator in front of the place. `talking`: the mouth moves and a hand gestures. */
export function paintNarrator(ctx, w, h, { who, place, t, talking }) {
  setStyle('present');
  ctx.save();
  const s = Math.max(w / 400, h / 210); // wide enough to see the alley: wall, lights, the notice
  ctx.translate(w / 2 - 200 * s, h - 4 - 250 * s);
  ctx.scale(s, s);
  if (place === 'beach') drawBeach(ctx, t, {});
  else drawScene(ctx, t, s, { lightsFrom: -5, glow: 0.5, props: false });
  ctx.restore();
  const sc = (h - 10) / 112;
  const beat = Math.floor(t * 7);
  const pose = talking
    ? { ...POSES.point, prop: null, mouth: beat % 2 ? 2 : 0.2, armF: [1.2 + Math.sin(t * 3) * 0.35, 0.6], head: Math.sin(t * 2.2) * 0.08 }
    : { ...POSES.smile };
  ctx.save();
  ctx.translate(w * 0.22, h - 4 - Math.abs(Math.sin(t * 3.5)) * (talking ? 1.5 : 0));
  ctx.scale(sc, sc);
  drawPerson(ctx, who, 0, 0, 1, 1, pose, t);
  ctx.restore();
  overlay(ctx, w, h, t);
}

export function playIntro({ who = 'co-sau', place = 'alley', title = '', text = '', serveLabel = tr('intro.serve'), saysLabel = '', reduced = false, sound = () => {} } = {}) {
  const root = el('div', 'level-intro');
  const card = el('div', 'intro-card');
  const cv = el('canvas', 'intro-scene');
  const name = el('div', 'intro-says', saysLabel);
  const head = el('div', 'intro-title', title);
  const body = el('p', 'intro-text');
  const go = el('button', 'btn primary intro-serve', serveLabel);
  card.append(cv, name, head, body, go);
  root.append(card);
  document.body.append(root);
  sound('chime');
  let shown = reduced ? text.length : 0;
  let t = 0, last = performance.now(), done = false;
  const typed = () => shown >= text.length;
  const paint = () => {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr)) {
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintNarrator(ctx, r.width, r.height, { who, place, t, talking: !typed() && !reduced });
  };
  return new Promise((resolve) => {
    const finish = () => {
      if (done) return;
      done = true;
      removeEventListener('keydown', onKey);
      root.classList.add('out');
      setTimeout(() => root.remove(), 250);
      resolve();
    };
    const complete = () => {
      shown = text.length;
      body.textContent = text;
      go.classList.add('ready');
    };
    const onKey = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      typed() ? finish() : complete();
    };
    addEventListener('keydown', onKey);
    card.addEventListener('click', (e) => {
      if (e.target === go) return;
      if (!typed()) complete();
    });
    go.addEventListener('click', () => (typed() ? finish() : complete())); // an early tap shows the whole text first
    if (reduced) complete();
    const frame = (now) => {
      if (done) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!reduced) t += dt; // reduced motion: a still scene
      if (!typed()) {
        const before = Math.floor(shown);
        shown = Math.min(text.length, shown + dt * CPS);
        if (Math.floor(shown) !== before) body.textContent = text.slice(0, Math.floor(shown));
        if (typed()) go.classList.add('ready');
      }
      paint();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
