// Session booster seam (client/game/session.js): arming a targeted booster turns the next pick + drop into it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../../client/game/session.js';
import { replay } from '../../shared/replay.js';
import { hashState } from '../../shared/hash.js';

const level = (boosters) => ({
  formatVersion: 1,
  id: 'test-boosters',
  moves: 10,
  board: {
    grills: [
      { slots: ['beef', 'corn', 'beef'] },
      { slots: ['corn', 'beef', 'corn'], lock: 1 },
      { slots: [null, null, null] },
    ],
  },
  goals: [{ type: 'clear_all' }],
  boosters,
});

test('session: boosters offered = level grants, in BOOSTERS order', () => {
  assert.deepEqual(new Session(level({ fan: 1, tongs: 2 })).boosterIds(), ['tongs', 'fan']);
  assert.deepEqual(new Session(level(undefined)).boosterIds(), []);
  assert.deepEqual(new Session(level({ tongs: 0 })).boosterIds(), []);
});

test('session: armed tongs pick off a locked grill and drop as a booster action; no move spent', () => {
  const s = new Session(level({ tongs: 1 }));
  assert.equal(s.canPick(1, 0), false, 'locked grill: not pickable for a plain move');
  assert.equal(s.arm('tongs'), 'tongs');
  assert.equal(s.canPick(1, 0), true, 'tongs reach the locked grill');
  assert.equal(s.canPick(2, 0), false, 'empty slot');
  const action = s.actionFor({ grill: 1, slot: 0 }, { grill: 2, slot: s.dropSlot(2, 0) });
  assert.equal(action.type, 'booster');
  const r = s.apply(action);
  assert.ok(r.ok, r.reason);
  assert.equal(s.armed, null, 'one use disarms');
  assert.equal(s.charges('tongs'), 0);
  assert.equal(s.state.movesUsed, 0);
  assert.equal(s.state.grills[2].slots[0].food, 'corn');
  assert.deepEqual(s.boostersUsed(), { tongs: 1 });
  assert.equal(s.canUseBooster('tongs'), false, 'no charge left');
  assert.equal(s.arm('tongs'), null, 'cannot arm without a charge');
  // the action log replays to the same state (share codes / server re-play)
  assert.equal(replay(level({ tongs: 1 }), s.actions).hash, hashState(s.state));
});

test('session: fan is not armed (it has no target); undo gives the charge back and disarms', () => {
  const s = new Session(level({ fan: 1, tongs: 1 }));
  assert.equal(s.arm('fan'), null);
  assert.ok(s.canUseBooster('fan'));
  assert.ok(s.apply({ type: 'booster', booster: 'fan' }).ok);
  assert.equal(s.charges('fan'), 0);
  s.arm('tongs');
  s.undo();
  assert.equal(s.charges('fan'), 1);
  assert.equal(s.armed, null);
  assert.deepEqual(s.boostersUsed(), {});
});

test('session: without an armed booster a pick + drop is a plain move', () => {
  const s = new Session(level({ tongs: 1 }));
  assert.deepEqual(s.actionFor({ grill: 0, slot: 1 }, { grill: 2, slot: 0 }), { type: 'move', from: { grill: 0, slot: 1 }, to: { grill: 2, slot: 0 } });
  s.arm('tongs');
  s.arm(null);
  assert.equal(s.actionFor({ grill: 0, slot: 1 }, { grill: 2, slot: 0 }).type, 'move');
});
