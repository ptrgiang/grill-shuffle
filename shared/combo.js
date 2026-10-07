// Combo: consecutive productive moves. A move is productive when it causes at least one match
// (including chain matches it triggers). Each match during a productive streak raises the combo by one;
// a move with no match resets it. Turn-based only: no timers, no reflexes.
//
//   match -> x1, next productive move -> x2, ... non-productive move -> reset.

/** Called once per match, before scoring it. Mutates state; returns the new combo level. */
export function comboOnMatch(state) {
  state.combo += 1;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;
  return state.combo;
}

/** Called after a move that made no match. Mutates; returns a combo_reset event or null. */
export function comboOnQuietMove(state) {
  if (state.combo === 0) return null;
  const was = state.combo;
  state.combo = 0;
  return { type: 'combo_reset', was };
}
