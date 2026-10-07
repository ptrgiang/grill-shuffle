// Client modules that are pure (no DOM / WebGL): layout + hit testing, the audio synthesizers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutBoard, hitTest, hitTestSegment, slotOffsetX, SLOT, CAMERA_ELEVATION, markerStyle } from '../../client/render/layout.js';
import { coachMove } from '../../client/ui/coach.js';
import { POINTER_TUNING, tuningFor, aimPoint } from '../../client/game/input.js';
import { SOUNDS, matchSound } from '../../client/audio/synth.js';
import { marginsFrom } from '../../client/ui/fit.js';

test('layout: portrait boards stack, landscape boards spread', () => {
  const portrait = layoutBoard([3, 3, 3, 3, 2], 390 / 640);
  const landscape = layoutBoard([3, 3, 3, 3, 2], 1280 / 600);
  assert.ok(portrait.cols < landscape.cols, `${portrait.cols} vs ${landscape.cols}`);
  // no two grills overlap
  for (const L of [portrait, landscape])
    for (let i = 0; i < L.grills.length; i++)
      for (let j = i + 1; j < L.grills.length; j++) {
        const a = L.grills[i], b = L.grills[j];
        const overlap = Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2;
        assert.ok(!overlap, `grills ${i} and ${j} overlap`);
      }
});

test('hit test: every slot centre maps back to its slot; off-board is null', () => {
  const L = layoutBoard([3, 3, 2, 3], 1.4);
  L.grills.forEach((g, gi) => {
    for (let s = 0; s < g.slots; s++) assert.deepEqual(hitTest(L, g.x + slotOffsetX(s, g.slots), g.z), { grill: gi, slot: s });
    // generous edges: just past the last slot still counts
    assert.deepEqual(hitTest(L, g.x + slotOffsetX(g.slots - 1, g.slots) + SLOT * 0.6, g.z), { grill: gi, slot: g.slots - 1 });
  });
  assert.equal(hitTest(L, 100, 100), null);
});

test('hit test segment: a tap anywhere on a standing item column hits its slot', () => {
  const L = layoutBoard([3, 3, 3, 3], 390 / 700); // portrait phone: one column, rows back to front
  const H = 0.75; // item column height (BoardView PICK_TOP)
  const back = H / Math.tan(CAMERA_ELEVATION); // how far behind the item the ray through its top meets the table
  L.grills.forEach((g, gi) => {
    for (let s = 0; s < g.slots; s++) {
      const x = g.x + slotOffsetX(s, g.slots);
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        // the pixel showing height f*H of the item: its ray meets the table f*back behind the slot
        const zFoot = g.z - f * back;
        assert.deepEqual(hitTestSegment(L, x, zFoot, zFoot + back), { grill: gi, slot: s }, `grill ${gi} slot ${s} at ${f}`);
      }
    }
  });
  // a zero-length segment is the plain point test
  const g = L.grills[1];
  assert.deepEqual(hitTestSegment(L, g.x, g.z, g.z), hitTest(L, g.x, g.z));
  assert.equal(hitTestSegment(L, 100, 100, 101), null);
});

test('hit test: a wider (touch) margin catches taps just outside a grill', () => {
  const L = layoutBoard([3, 3], 1.4);
  const g = L.grills[0];
  const x = g.x - g.w / 2 - 0.35; // past the rim, beyond the mouse margin
  assert.equal(hitTest(L, x, g.z, { margin: POINTER_TUNING.mouse.margin }), null);
  assert.deepEqual(hitTest(L, x, g.z, { margin: POINTER_TUNING.touch.margin }), { grill: 0, slot: 0 });
});

test('pointer tuning: touch is more tolerant and lifts the carried item; mouse is unchanged', () => {
  const mouse = tuningFor('mouse'), touch = tuningFor('touch');
  assert.equal(mouse.dragPx, 7);
  assert.equal(mouse.liftPx, 0);
  assert.ok(touch.dragPx > mouse.dragPx && touch.margin > mouse.margin);
  assert.ok(touch.liftPx >= 60 && touch.liftPx <= 80, `${touch.liftPx}`);
  assert.deepEqual(tuningFor(''), mouse, 'unknown pointer types behave like a mouse');
  assert.equal(tuningFor('touch', { touch: { liftPx: 64 } }).liftPx, 64, 'configurable');
  assert.deepEqual(aimPoint(100, 300, touch), { x: 100, y: 300 - touch.liftPx });
  assert.deepEqual(aimPoint(100, 300, mouse), { x: 100, y: 300 });
});

test('synth: every sound renders finite, bounded, non-silent audio deterministically', () => {
  const sr = 22050;
  for (const [name, gen] of Object.entries(SOUNDS)) {
    const a = gen(sr);
    assert.ok(a.length > sr * 0.05, `${name} too short`);
    let peak = 0;
    for (const v of a) {
      assert.ok(Number.isFinite(v), `${name} has NaN`);
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(peak > 0.2 && peak <= 0.95, `${name} peak ${peak}`);
  }
  assert.deepEqual(matchSound(sr, 2, 4), matchSound(sr, 2, 4));
});

test('fit: margins clear every HUD rect, never shrink below the base, ignore hidden rects', () => {
  const base = { marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10 };
  const r = (left, top, w, h) => ({ left, top, right: left + w, bottom: top + h, width: w, height: h });
  // portrait: a top bar and goal chips above, tools below
  const p = marginsFrom(390, 844, { top: [r(10, 8, 370, 46), r(150, 62, 90, 46)], bottom: [r(80, 770, 72, 64)] }, base, 6);
  assert.deepEqual(p, { marginTop: 114, marginBottom: 80, marginLeft: 10, marginRight: 10 });
  // landscape: a left column and a right column of tools
  const l = marginsFrom(844, 390, { left: [r(10, 8, 176, 46), r(10, 116, 176, 46)], right: [r(766, 100, 68, 60)] }, base);
  assert.deepEqual(l, { marginTop: 10, marginBottom: 10, marginLeft: 194, marginRight: 86 });
  // a hidden element (display: none) does not count; an element inside the base keeps the base
  assert.deepEqual(marginsFrom(390, 844, { top: [r(0, 0, 0, 0), r(0, 0, 50, 1)] }, base), base);
});

test('slot markers: sized in pixels, so phones get thicker, stronger rings than desktop', () => {
  const phone = markerStyle(40), desktop = markerStyle(110);
  assert.ok(phone.ringWidth * 40 >= 4.9, `phone ring ${phone.ringWidth * 40}px`);
  assert.ok(phone.ringWidth > desktop.ringWidth);
  assert.ok(phone.ringOpacity > desktop.ringOpacity && phone.candidateOpacity > desktop.candidateOpacity);
  assert.equal(markerStyle(1000).ringWidth, 0.08); // never thinner than the original world size
  assert.equal(markerStyle(5).ringWidth, 0.16); // nor fatter than the slot can carry
  assert.ok(markerStyle(0).ringWidth > 0); // before the first frame
});

test('coach: shows the first move of the solver solution, only for levels with a hint', () => {
  const level = { hint: 'Tap, then tap a grill', solver: { solution: 'm1.2-0.2 m2.0-1.2' } };
  assert.deepEqual(coachMove(level), { type: 'move', from: { grill: 1, slot: 2 }, to: { grill: 0, slot: 2 } });
  assert.equal(coachMove({ ...level, hint: undefined }), null);
  assert.equal(coachMove({ hint: 'x', solver: {} }), null);
  assert.equal(coachMove({ hint: 'x', solver: { solution: 'btongs:0.1 m1.2-0.2' } }), null); // booster first: no hand
  assert.equal(coachMove({ hint: 'x', solver: { solution: 'garbage' } }), null);
});

test('quality: start tier from setting, history, then device size', async () => {
  const { initialTier, lowerTier, TIERS, TIER_ORDER } = await import('../../client/render/quality.js');
  assert.equal(initialTier({ setting: 'low', autoTier: 'high' }), 'low'); // manual override wins
  assert.equal(initialTier({ setting: 'auto', autoTier: 'medium' }), 'medium'); // where auto settled last time
  assert.equal(initialTier({ deviceMemory: 2, cores: 8 }), 'medium');
  assert.equal(initialTier({ deviceMemory: 8, cores: 4 }), 'medium');
  assert.equal(initialTier({ deviceMemory: 8, cores: 8 }), 'high');
  assert.equal(initialTier({}), 'high'); // Safari tells nothing: start high, the monitor steps down
  assert.equal(lowerTier('high'), 'medium');
  assert.equal(lowerTier('low'), 'low');
  // each step is cheaper on every axis
  for (let i = 1; i < TIER_ORDER.length; i++) {
    const a = TIERS[TIER_ORDER[i - 1]], b = TIERS[TIER_ORDER[i]];
    assert.ok(b.pixelRatio <= a.pixelRatio && b.shadowMap <= a.shadowMap && b.ember <= a.ember && b.particles <= a.particles);
  }
});

test('quality: the monitor steps down only after 2 s of slow frames, ignoring hiccups', async () => {
  const { FrameMonitor } = await import('../../client/render/quality.js');
  const m = new FrameMonitor();
  const feed = (ms, seconds) => {
    let fired = 0;
    for (let t = 0; t < seconds * 1000; t += ms) fired += m.add(ms) ? 1 : 0;
    return fired;
  };
  assert.equal(feed(16.7, 10), 0); // 60 fps: never
  m.reset();
  assert.equal(feed(25, 1.5), 0); // slow, but not for long enough yet
  assert.equal(feed(25, 0.6), 1); // past 2 s: one step
  m.reset();
  for (let i = 0; i < 200; i++) assert.equal(m.add(i % 50 ? 16 : 400), false); // a 400 ms hitch every 50 frames is ignored
  m.reset();
  assert.equal(feed(30, 1) + feed(10, 3), 0); // a 1 s slow patch: no 2 s window averages over 20 ms
});

test('quality: idle gate renders every frame while busy, ~12 fps when still', async () => {
  const { IdleGate } = await import('../../client/render/quality.js');
  const g = new IdleGate({ idleFps: 12, holdS: 0.6 });
  const run = (seconds, busy) => {
    let rendered = 0;
    for (let t = 0; t < seconds; t += 1 / 60) if (g.tick(1 / 60, busy) > 0) rendered++;
    return rendered;
  };
  assert.ok(run(1, true) >= 59);
  run(0.6, false); // hold: still every frame while a fade ends
  const still = run(2, false);
  assert.ok(still >= 22 && still <= 26, `${still} frames in 2 s idle`);
  // the dt handed over covers the skipped frames, so time-driven effects keep their speed
  let total = 0;
  for (let i = 0; i < 120; i++) total += g.tick(1 / 60, false);
  assert.ok(Math.abs(total - 2) < 0.1, `${total}`);
  g.wake();
  assert.ok(g.tick(1 / 60, false) > 0); // input: render right away
});
