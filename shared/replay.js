// Replays are the level + the ordered list of actions. Never animation frames.
//   initial state + action sequence -> same final state hash, everywhere.

import { createState } from './state.js';
import { applyAction } from './resolve.js';
import { hashState } from './hash.js';
import { decodeActions } from './moves.js';

/**
 * Run actions (objects or the compact string) from the level's start.
 * Returns { ok, state, hash, steps, error? } - stops at the first illegal action.
 */
export function replay(level, actions) {
  const list = typeof actions === 'string' ? decodeActions(actions) : actions;
  let state = createState(level);
  for (let i = 0; i < list.length; i++) {
    const r = applyAction(state, list[i]);
    if (!r.ok) return { ok: false, state, hash: hashState(state), steps: i, error: `action ${i}: ${r.reason}` };
    state = r.state;
  }
  return { ok: true, state, hash: hashState(state), steps: list.length };
}

/** True when the actions replay legally and end on the expected hash. */
export function verifyReplay(level, actions, expectedHash) {
  const r = replay(level, actions);
  return r.ok && r.hash === expectedHash;
}
