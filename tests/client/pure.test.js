// Client modules that are pure (no DOM / WebGL): layout + hit testing, the audio synthesizers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutBoard, hitTest, hitTestSegment, slotOffsetX, SLOT, CAMERA_ELEVATION } from '../../client/render/layout.js';
import { POINTER_TUNING, tuningFor, aimPoint } from '../../client/game/input.js';
import { SOUNDS, matchSound } from '../../client/audio/synth.js';

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
