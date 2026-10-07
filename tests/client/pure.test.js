// Client modules that are pure (no DOM / WebGL): layout + hit testing, the audio synthesizers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutBoard, hitTest, slotOffsetX, SLOT } from '../../client/render/layout.js';
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
