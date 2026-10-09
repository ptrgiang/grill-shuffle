// #81 design variants (CONTRIBUTING.md step 0): five ways to present a story beat over the game, behind ?variant=1..5.
// Opened on a game page with ?beat=<beat id> (&t=<seconds> = one still frame, for variant-shots). Prototype only:
// after the owner's pick, the chosen layout becomes client/story/player.js and this file goes.
//   1 vignette    full-screen illustrated scene, paper caption card
//   2 panels      comic panels over the dimmed board (anticipation / action / reaction)
//   3 in-scene    no backdrop: the cast acts on a counter in front of the live board
//   4 letterbox   cinematic bars, title in the top bar, the line as a subtitle
//   5 storytime   the board stays; a notebook strip at the bottom, drawn in ink
import { variant } from '../ui/variant.js';
import { pick, t as tr } from '../i18n/index.js';
import { drawPerson, drawCat, POSES, blendPose } from './rig.js';
import { drawScene, drawBeach, STAGE } from './scene.js';
import { overlay } from './style.js';

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const SNAP = 0.12; // pose snap, then hold (pantomime grammar)

/** Evaluate an actor track at time t -> { x, face, pose } or null before its first key. */
function track(keys, t) {
  let i = -1;
  while (i + 1 < keys.length && keys[i + 1].t <= t) i++;
  if (i < 0) return null;
  const k = keys[i], n = keys[i + 1], prev = keys[i - 1];
  let x = k.x;
  let pose = POSES[k.pose];
  if (n?.move) {
    x = k.x + (n.x - k.x) * ease(clamp((t - k.t) / (n.t - k.t)));
    pose = POSES.walk;
  } else if (prev) pose = blendPose(POSES[prev.pose], pose, clamp((t - k.t) / SNAP));
  return { x, face: n?.move ? Math.sign(n.x - k.x) || k.face : k.face, pose };
}

const camAt = (keys, t) => {
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].t <= t) i++;
  const k = keys[i], n = keys[i + 1];
  if (!n) return k;
  const e = ease(clamp((t - k.t) / Math.min(1.2, n.t - k.t)));
  return n.cut ? k : { x: k.x + (n.x - k.x) * e, y: k.y + (n.y - k.y) * e, z: k.z + (n.z - k.z) * e };
};

// Two beats from content/story/street_bbq.json, blocked as pantomime.
const BEATS = {
  'street.cold-open': {
    length: 16,
    panels: [4.6, 9.4, 13.6],
    cam: [{ t: 0, x: 200, y: 150, z: 1 }, { t: 3, x: 190, y: 170, z: 1.15 }, { t: 8.4, x: 205, y: 190, z: 1.6 }, { t: 11.2, x: 130, y: 170, z: 1.5 }, { t: 14.5, x: 200, y: 160, z: 1.1 }],
    ut: [{ t: 2.4, x: -40, face: 1, pose: 'stand' }, { t: 6, x: 150, face: 1, pose: 'phone', move: true }, { t: 7.4, x: 150, face: 1, pose: 'reach' }, { t: 8.2, x: 150, face: 1, pose: 'read' }, { t: 11.2, x: 150, face: -1, pose: 'read' }, { t: 12, x: 150, face: -1, pose: 'shock' }, { t: 13.2, x: 150, face: -1, pose: 'slump' }],
    cat: (t) => (t < 8.6 ? null : { x: t < 9.4 ? 280 - (t - 8.6) * 70 : 224, y: t < 9.4 ? STAGE.ground - (t - 8.6) * 82 : STAGE.ground - 70, pose: t < 9.4 ? 'jump' : 'sit', face: -1 }),
    scene: (t) => ({ lightsFrom: 0.4, glow: 0.35, postcardOnCart: t < 8.2 }),
  },
  'street.fan': {
    length: 8,
    panels: [1.2, 3.9, 6.4],
    cam: [{ t: 0, x: 205, y: 185, z: 1.35 }, { t: 5, x: 200, y: 180, z: 1.45 }],
    ut: [{ t: 0, x: 150, face: 1, pose: 'cough' }, { t: 3.6, x: 150, face: 1, pose: 'stand' }, { t: 5.2, x: 150, face: 1, pose: 'smile' }],
    sau: [{ t: 0.9, x: 430, face: -1, pose: 'stand' }, { t: 2.6, x: 252, face: -1, pose: 'point', move: true }, { t: 3.3, x: 252, face: -1, pose: 'fan' }],
    cat: () => ({ x: 304, y: STAGE.ground - 26, pose: 'sit', face: -1 }),
    scene: (t) => ({ lightsFrom: -5, glow: clamp((t - 3.3) / 1.6) * 0.6 + 0.12 }),
  },
  // #106 comparison: a flashback in Bà Năm's past (no shipped beat yet; Fishing Village, "The fish seller")
  'flashback.fish': {
    length: 12,
    panels: [2, 6, 10],
    cam: [{ t: 0, x: 225, y: 185, z: 1.2 }, { t: 6, x: 220, y: 190, z: 1.3 }],
    who: 'ba-nam-young',
    ut: [{ t: 0, x: 440, face: -1, pose: 'carryWalk' }, { t: 6, x: 272, face: -1, pose: 'carry', move: true }],
    cat: () => null,
    draw: drawBeach,
    scene: () => ({}),
  },
};

/** Draw the beat at time t into a canvas region (stage coordinates fitted to w × h, camera applied). */
function paint(ctx, beat, t, w, h, { backdrop = true, cam = true } = {}) {
  const c = cam ? camAt(beat.cam, t) : { x: 200, y: 150, z: 1 };
  // a wide region fits the stage's height (the backdrop runs on sideways); a tall phone screen crops the stage at most
  // to 1/1.5 of its width, so the cast stays readable
  const wide = w / h > STAGE.w / STAGE.h;
  const s = (wide ? h / STAGE.h : Math.min(h / STAGE.h, (w / STAGE.w) * 1.5)) * c.z;
  ctx.save();
  ctx.translate(w / 2 - c.x * s, h / 2 - c.y * s);
  ctx.scale(s, s);
  if (beat.draw) beat.draw(ctx, t);
  else drawScene(ctx, t, s, { backdrop, ...beat.scene(t) });
  const sau = beat.sau && track(beat.sau, t);
  if (sau) drawPerson(ctx, 'co-sau', sau.x, STAGE.ground, 1, sau.face, sau.pose, t);
  const ut = track(beat.ut, t);
  if (ut) drawPerson(ctx, beat.who ?? 'ut', ut.x, STAGE.ground, 1, ut.face, ut.pose, t);
  const cat = beat.cat(t);
  if (cat) drawCat(ctx, cat.x, cat.y, 0.9, cat.face, cat.pose, cat.pose === 'jump' ? (t - 8.6) / 0.8 : t);
  ctx.restore();
  overlay(ctx, w, h, t);
}

const h = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
};

function canvasIn(parent) {
  const cv = h('canvas', 'sv-canvas');
  parent.append(cv);
  return cv;
}

function sizeCanvas(cv) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr);
  cv.height = Math.round(r.height * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}

const CSS = `
.sv { position: fixed; inset: 0; z-index: 60; font-family: var(--font); color: var(--ink); }
.sv-canvas { position: absolute; display: block; }
.sv-skip { position: absolute; top: max(12px, env(safe-area-inset-top)); right: 12px; z-index: 2; font-size: 13px; padding: 6px 12px; border-radius: 99px; background: rgba(0,0,0,.45); color: #fff3e3cc; }
.sv-title { font-weight: 800; letter-spacing: .01em; }
/* 1 vignette */
.sv-1 { background: #120a12; }
.sv-1 .sv-canvas { inset: 0; width: 100%; height: 100%; }
.sv-1::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 55%, rgba(10,4,12,.85)); pointer-events: none; }
.sv-1 .sv-card { position: absolute; left: 50%; bottom: max(28px, env(safe-area-inset-bottom)); transform: translateX(-50%) rotate(-1deg); z-index: 1; width: min(86vw, 420px); background: #fbf1dc; color: #3a2630; border-radius: 6px; padding: 14px 18px; box-shadow: 0 8px 24px rgba(0,0,0,.45); }
.sv-1 .sv-title { font-size: 22px; color: #b5482a; }
.sv-1 .sv-line { font-size: 16px; margin-top: 4px; }
/* 2 comic panels */
.sv-2 { background: rgba(18,10,18,.92); display: grid; gap: 10px; padding: 64px 16px 24px; box-sizing: border-box; grid-template-rows: auto 1fr 1fr 1fr auto; }
.sv-2 .sv-panel { position: relative; overflow: hidden; border: 3px solid #fbf1dc; border-radius: 4px; background: #000; box-shadow: 0 4px 0 rgba(0,0,0,.4); transition: opacity .3s, transform .3s; }
.sv-2 .sv-panel.off { opacity: 0; transform: translateY(8px); }
.sv-2 .sv-panel .sv-canvas { inset: 0; width: 100%; height: 100%; }
.sv-2 .sv-title { font-size: 22px; text-align: center; color: var(--accent); }
.sv-2 .sv-line { text-align: center; font-size: 16px; background: #fbf1dc; color: #3a2630; padding: 8px 12px; border-radius: 4px; }
@media (min-aspect-ratio: 1/1) { .sv-2 { grid-template-rows: auto 1fr auto; grid-template-columns: 1fr 1fr 1fr; padding: 48px 40px 40px; } .sv-2 .sv-title, .sv-2 .sv-line { grid-column: 1 / -1; } .sv-2 .sv-panel { min-height: 0; } }
/* 3 in-scene */
.sv-3 { background: linear-gradient(to bottom, rgba(18,10,18,0) 35%, rgba(18,10,18,.55)); }
.sv-3 .sv-canvas { left: 0; right: 0; bottom: 0; width: 100%; height: 62%; }
.sv-3 .sv-counter { position: absolute; left: 0; right: 0; bottom: 0; height: 9%; background: linear-gradient(#8a5a34, #5a3820); box-shadow: 0 -4px 10px rgba(0,0,0,.4); }
.sv-3 .sv-bubble .sv-title { color: #b5482a; font-size: 17px; }
.sv-3 .sv-bubble { position: absolute; left: 50%; bottom: 66%; transform: translateX(-50%); max-width: 78vw; background: #fbf1dc; color: #3a2630; border-radius: 16px; padding: 10px 14px; font-size: 16px; text-align: center; box-shadow: 0 4px 0 rgba(0,0,0,.35); }
/* 4 letterbox */
.sv-4 { background: #000; }
.sv-4 .sv-canvas { left: 0; width: 100%; top: 50%; transform: translateY(-50%); aspect-ratio: 16 / 9; height: auto; }
@media (min-aspect-ratio: 1/1) { .sv-4 .sv-canvas { aspect-ratio: 2.35 / 1; } }
.sv-4 .sv-title { position: absolute; left: 0; right: 0; top: 18%; text-align: center; font-size: 13px; letter-spacing: .3em; text-transform: uppercase; color: #fff3e3aa; font-weight: 600; }
.sv-4 .sv-line { position: absolute; left: 8%; right: 8%; bottom: 18%; text-align: center; font-size: 17px; color: #fff3e3; }
/* 5 storytime strip */
.sv-5 { top: auto; height: 40%; background: #f6ecd6; background-image: repeating-linear-gradient(#f6ecd6 0 27px, #d9c9ae 27px 28px); border-top: 3px solid #c89660; box-shadow: 0 -8px 24px rgba(0,0,0,.45); color: #3a2630; }
.sv-5 .sv-canvas { left: 0; top: 0; width: 100%; height: calc(100% - 76px); mix-blend-mode: multiply; }
.sv-5 .sv-title { position: absolute; left: 16px; bottom: 38px; font-size: 18px; color: #b5482a; }
.sv-5 .sv-line { position: absolute; left: 16px; right: 16px; bottom: 8px; font-size: 15px; font-style: italic; }
.sv-5 .sv-skip { top: 8px; background: rgba(58,38,48,.12); color: #3a2630; }
`;

/** Mount the prototype for `beatId` over the page; `still`: seconds of the frozen frame, or null to play. */
export function mountProto(beatId, still, storyFiles) {
  if (variant('cmp') === 2) beatId = 'flashback.fish'; // #106 comparison: A's flashback frame
  const beat = BEATS[beatId];
  if (!beat) return;
  const data = storyFiles.flatMap((f) => f.beats ?? []).find((b) => b.id === beatId);
  const v = variant() || 1;
  const style = h('style');
  style.textContent = CSS;
  const root = h('div', `sv sv-${v}`);
  const skip = h('div', 'sv-skip', tr('story.skip'));
  const fb = beatId === 'flashback.fish';
  const title = h('div', 'sv-title', fb ? tr('story.protoFlashTitle') : pick(data?.title));
  const line = h('div', 'sv-line', fb ? tr('story.protoFlashLine') : pick(data?.lines?.[0]));
  document.head.append(style);
  let draw;
  if (v === 2) {
    const panels = beat.panels.map((pt) => {
      const p = h('div', 'sv-panel');
      const cv = canvasIn(p);
      return { el: p, cv, pt };
    });
    root.append(skip, title, ...panels.map((p) => p.el), line);
    draw = (t) => panels.forEach((p) => {
      p.el.classList.toggle('off', t < p.pt - 0.4);
      const { ctx, w, h: hh } = sizeCanvas(p.cv);
      paint(ctx, beat, Math.min(t, p.pt), w, hh);
    });
  } else {
    const cv = canvasIn(root);
    if (v === 1) {
      const card = h('div', 'sv-card');
      card.append(title, line);
      root.append(card, skip);
    } else if (v === 3) {
      const bubble = h('div', 'sv-bubble');
      bubble.append(title, line);
      root.append(h('div', 'sv-counter'), bubble, skip);
    } else root.append(title, line, skip);
    draw = (t) => {
      const { ctx, w, h: hh } = sizeCanvas(cv);
      ctx.clearRect(0, 0, w, hh);
      if (v === 5) ctx.filter = 'grayscale(1) sepia(0.6) contrast(1.15)';
      paint(ctx, beat, t, w, hh, { backdrop: v !== 3 && v !== 5, cam: v !== 3 });
      ctx.filter = 'none';
    };
  }
  document.body.append(root);
  if (still != null) {
    requestAnimationFrame(() => draw(still));
    return;
  }
  const t0 = performance.now();
  const loop = () => {
    draw(((performance.now() - t0) / 1000) % beat.length);
    if (root.isConnected) requestAnimationFrame(loop);
  };
  loop();
  root.addEventListener('pointerdown', () => root.remove());
}
