// Story player (#81, owner pick: full-screen vignette for every beat, comic panels for the "memories" recap).
// Lazy-loaded by main.js only when a beat is due, so the story code stays out of the main bundle.
//
//   playStory(items, opts)   plays beats in order (an item with `recap` is the memories page); resolves when done.
//                            opts.sound(name, { pan }): the beat's sound cues (client/story/cues.js, #113)
//   paintBeat(...)           one frame of a beat into a canvas region (also the sandbox's stills)
//
// Every beat is skippable by a tap (Escape skips the rest). Reduced motion: no camera or character motion, the three
// key moments of the beat as stills with cross-fades. The stop's signature transition comes from its theme
// (`story.transition`: lights | wave | fade).
import { pick, t as tr } from '../i18n/index.js';
import { drawPerson, drawCat } from './rig.js';
import { drawScene, drawBeach, drawCart, STAGE } from './scene.js';
import { overlay, setStyle } from './style.js';
import { stagingFor, actorAt } from './beats.js';
import { camAt, clamp } from './timeline.js';
import { cuesBetween, panFor } from './cues.js';

const CARD_IN = 0.6; // the caption card fades in after the first moment of the scene

/** Draw beat `id` at time t into a w × h region (camera fitted: a tall phone crops the stage to 1/1.5 of its width). */
export function paintBeat(ctx, id, t, w, h, { style = 'present' } = {}) {
  setStyle(style);
  const B = stagingFor(id);
  const c = camAt(B.cam, t);
  const wide = w / h > STAGE.w / STAGE.h;
  const s = (wide ? h / STAGE.h : Math.min(h / STAGE.h, (w / STAGE.w) * 1.5)) * c.z;
  const opts = B.scene(t);
  ctx.save();
  ctx.fillStyle = '#120a12';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2 - c.x * s, h / 2 - c.y * s);
  ctx.scale(s, s);
  if (B.beach) {
    drawBeach(ctx, t, opts);
    if (B.cart !== false) drawCart(ctx, opts.cartX ?? 196, STAGE.ground, t, opts.glow ?? 0.3);
  } else drawScene(ctx, t, s, opts);
  for (const a of B.actors) {
    const p = actorAt(a.keys, t);
    if (p) drawPerson(ctx, a.who, p.x, STAGE.ground, 1, p.face, p.pose, t);
  }
  const cat = B.cat(t);
  if (cat) drawCat(ctx, cat.x, cat.y, 0.9, cat.face, cat.pose, cat.k ?? t);
  ctx.restore();
  overlay(ctx, w, h, t);
}

/** The stop's signature transition over the first ~0.9 s of a beat. */
function drawTransition(ctx, kind, t, w, h) {
  if (kind === 'wave' && t < 0.9) {
    // a wave wipes across: deep water with a foam crest, revealing the scene behind it
    const k = clamp(t / 0.9);
    const x = -w * 0.2 + k * w * 1.4;
    ctx.save();
    ctx.fillStyle = '#2c5a78';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= h; y += 20) ctx.lineTo(x + Math.sin(y / 30 + t * 8) * 14, y);
    ctx.lineTo(w * 2, h);
    ctx.lineTo(w * 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e9f4f6';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
  } else if (t < 0.5) {
    // lights: the scene's own string lights flick on; fade (and lights) start from black
    ctx.fillStyle = `rgba(10,4,12,${1 - t / 0.5})`;
    ctx.fillRect(0, 0, w, h);
  }
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

function fitCanvas(cv) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}

/**
 * One beat full screen. Resolves 'done' | 'skip' | 'skipAll'. `still`: a fixed time (sandbox), never resolves.
 */
function playBeat(root, beat, { transition, reduced, still = null, style, sound = () => {} }) {
  const B = stagingFor(beat.id);
  const view = el('div', 'story-beat');
  const cv = el('canvas', 'story-canvas');
  const card = el('div', 'story-card');
  card.append(el('div', 'story-title', pick(beat.title)), ...(beat.lines ?? []).map((l) => el('div', 'story-line', pick(l))));
  const skip = el('div', 'story-skip', tr('story.skip'));
  view.append(cv, card, skip);
  root.replaceChildren(view);
  let cardShown = false;
  const frame = (t) => {
    const { ctx, w, h } = fitCanvas(cv);
    paintBeat(ctx, beat.id, t, w, h, { style });
    if (!reduced) drawTransition(ctx, transition, t, w, h);
    card.classList.toggle('on', t >= CARD_IN);
    if (t >= CARD_IN && !cardShown && still == null) {
      cardShown = true;
      sound('chime');
    }
  };
  if (still != null) {
    frame(still);
    return new Promise(() => {});
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (how) => {
      if (done) return;
      done = true;
      view.removeEventListener('pointerup', onTap);
      window.removeEventListener('keydown', onKey);
      resolve(how);
    };
    const onTap = () => finish('skip');
    const onKey = (e) => {
      if (e.key === 'Escape') finish('skipAll');
      else if (e.key === ' ' || e.key === 'Enter') finish('skip');
    };
    view.addEventListener('pointerup', onTap);
    window.addEventListener('keydown', onKey);
    const t0 = performance.now();
    if (transition === 'wave' && !reduced) sound('wave');
    if (reduced) {
      // stills of the three key moments, cross-faded by CSS (no motion)
      let i = 0;
      const show = () => {
        if (done) return;
        if (i >= B.panels.length) return finish('done');
        cv.classList.remove('shown');
        requestAnimationFrame(() => {
          frame(B.panels[i++]);
          cv.classList.add('shown');
        });
        setTimeout(show, 2200);
      };
      show();
      return;
    }
    let heard = -0.001; // cues up to this time were played
    const loop = () => {
      if (done) return;
      const t = (performance.now() - t0) / 1000;
      const now = Math.min(t, B.length);
      const camX = camAt(B.cam, now).x;
      for (const c of cuesBetween(B, heard, now)) sound(c.name, { pan: panFor(c.x, camX) });
      heard = now;
      frame(now);
      if (t >= B.length + 0.8) finish('done');
      else requestAnimationFrame(loop);
    };
    loop();
  });
}

/** The memories page: one panel per beat the player passed before seeing it. Resolves when they continue. */
function playRecap(root, beats, { still = false, sound = () => {} }) {
  const page = el('div', 'story-recap');
  page.append(el('h2', 'story-recap-title', tr('story.memories')), el('p', 'story-recap-sub', tr('story.memoriesSub')));
  const grid = el('div', 'story-recap-grid');
  const panels = beats.map((b) => {
    const p = el('figure', 'story-panel');
    const cv = el('canvas', 'story-canvas');
    p.append(cv, el('figcaption', null, pick(b.title)));
    grid.append(p);
    return { b, cv };
  });
  const go = el('button', 'btn primary story-continue', tr('story.continue'));
  page.append(grid, go);
  root.replaceChildren(page);
  requestAnimationFrame(() => panels.forEach(({ b, cv }) => {
    const { ctx, w, h } = fitCanvas(cv);
    paintBeat(ctx, b.id, stagingFor(b.id).panels[1], w, h, { style: b.style ?? 'present' });
  }));
  if (still) return new Promise(() => {});
  sound('chime');
  return new Promise((resolve) => go.addEventListener('click', () => resolve('done'), { once: true }));
}

/**
 * Play story items (from client/game/story.js storyFor): beats and at most one recap. `transitionFor(beat)`: the
 * theme's transition for the beat's pack. Resolves when every item was shown or skipped.
 */
export async function playStory(items, { transitionFor = () => 'lights', reduced = false, still = null, onShown, sound } = {}) {
  const root = el('div', 'story-root');
  document.body.append(root);
  try {
    for (const item of items) {
      const how = item.recap
        ? await playRecap(root, item.beats, { still: still != null, sound })
        : await playBeat(root, item, { transition: transitionFor(item), reduced, still, style: item.style ?? 'present', sound });
      onShown?.(item);
      if (how === 'skipAll') break;
    }
  } finally {
    if (still == null) root.remove();
  }
}
