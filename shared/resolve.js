// Deterministic resolution. The only place board state changes.
//
//   applyAction(state, action) -> { ok, state: nextState, events, reason? }
//
// The input state is never mutated. Resolution order after a move (rules v2):
//   1. the item moves (movesLeft - 1)
//   2. loop until stable:
//        a. every match on the board clears (grill order, then slot order); each match:
//           combo + 1, score += matchScore * combo, goal progress, every locked grill's counter - 1
//        b. every empty unlocked grill with stacked trays reveals its next layer
//      (an unlock or a reveal can create new matches: those are chain matches, chain index > 0)
//   3. burn (v2): unless every goal is already met, every burning item on a heated grill ticks down; items reaching
//      0 char. If anything charred, step 2 runs again (charred items can complete a charred match: chain matches)
//   4. no match at all during the move -> combo resets
//   5. status: a goal failed (something charred that must not) -> lost ('charred'); all goals done -> won;
//      else no moves left or no legal move -> lost
// Boosters cost no move, so they never tick burn counters.
// Events describe every step, in order, for the renderer/audio. Skipping them changes nothing.

import { cloneState } from './state.js';
import { isLegalMove, hasLegalMove } from './moves.js';
import { findMatches } from './match.js';
import { tickLocks, revealLayers, tickBurns } from './obstacles.js';
import { comboOnMatch, comboOnQuietMove } from './combo.js';
import { goalsOnEvent, goalsDone, goalsFailed } from './goals.js';
import { canUseBooster, applyBoosterEffect, hasUsableBooster } from './boosters.js';

/**
 * Resolve matches/unlocks/reveals until the board is stable. Mutates `s`; returns { events, matchCount, chain }.
 * `chain`: index given to the first round of matches (0 = caused directly by the action).
 */
export function resolveMatches(s, chain = 0) {
  const events = [];
  let matchCount = 0;
  const emit = (ev) => {
    events.push(ev);
    for (const g of goalsOnEvent(s.goals, ev, s.score)) events.push(g);
  };
  for (let guard = 0; guard < 1000; guard++) {
    const matches = findMatches(s);
    for (const m of matches) {
      const grill = s.grills[m.grill];
      const items = m.slots.map((slot) => grill.slots[slot]);
      for (const slot of m.slots) grill.slots[slot] = null;
      s.matches += 1;
      matchCount += 1;
      const combo = comboOnMatch(s);
      const points = s.rules.matchScore * combo;
      s.score += points;
      const ev = { type: 'match', grill: m.grill, key: m.key, food: items[0].food, foods: items.map((it) => it.food), itemIds: items.map((it) => it.id), slots: m.slots, chain, combo };
      if (items[0].charred) ev.charred = true; // charred items only ever match each other
      for (const it of items) if (it.burn) (ev.burning ??= []).push(it.food); // foods saved before they charred
      emit(ev);
      emit({ type: 'score', points, total: s.score, combo });
      for (const ev of tickLocks(s)) emit(ev);
    }
    const reveals = revealLayers(s);
    for (const ev of reveals) emit(ev);
    if (!matches.length && !reveals.length) break;
    if (matches.length) chain += 1;
  }
  return { events, matchCount, chain };
}

/** Step 3: one move's heat. Mutates `s`, appends events; returns the matches charring caused. */
function burnTurn(s, events, chain) {
  if (goalsDone(s.goals)) return 0; // the move already won: nothing burns after the last bite
  const ticks = tickBurns(s);
  if (!ticks.length) return 0;
  for (const ev of ticks) {
    events.push(ev);
    events.push(...goalsOnEvent(s.goals, ev, s.score));
  }
  if (ticks.length === 1) return 0; // a burn_tick and nothing charred
  const r = resolveMatches(s, Math.max(1, chain));
  events.push(...r.events);
  return r.matchCount;
}

function finishTurn(s, events, matchCount, { countsAsMove }) {
  if (countsAsMove && matchCount === 0) {
    const ev = comboOnQuietMove(s);
    if (ev) events.push(ev);
  }
  if (matchCount > 0) events.push({ type: 'combo', combo: s.combo });
  if (goalsFailed(s.goals)) {
    s.status = 'lost';
    s.failReason = 'charred';
    events.push({ type: 'level_failed', reason: 'charred' });
  } else if (goalsDone(s.goals)) {
    s.status = 'won';
    events.push({ type: 'level_complete', movesUsed: s.movesUsed, score: s.score });
  } else if (s.movesLeft <= 0) {
    s.status = 'lost';
    s.failReason = 'moves';
    events.push({ type: 'level_failed', reason: 'moves' });
  } else if (!hasLegalMove(s) && !hasUsableBooster(s)) {
    s.status = 'lost';
    s.failReason = 'stuck';
    events.push({ type: 'level_failed', reason: 'stuck' });
  }
}

export function applyAction(state, action) {
  if (state.status !== 'playing') return { ok: false, state, events: [], reason: 'not playing' };
  if (action?.type === 'move') {
    if (!isLegalMove(state, action)) return { ok: false, state, events: [], reason: 'illegal move' };
    const s = cloneState(state);
    const { from, to } = action;
    const item = s.grills[from.grill].slots[from.slot];
    s.grills[from.grill].slots[from.slot] = null;
    s.grills[to.grill].slots[to.slot] = item;
    s.movesLeft -= 1;
    s.movesUsed += 1;
    const events = [{ type: 'move', itemId: item.id, food: item.food, from, to }];
    const r = resolveMatches(s);
    events.push(...r.events);
    const charMatches = burnTurn(s, events, r.chain);
    finishTurn(s, events, r.matchCount + charMatches, { countsAsMove: true });
    return { ok: true, state: s, events };
  }
  if (action?.type === 'booster') {
    if (!canUseBooster(state, action)) return { ok: false, state, events: [], reason: 'booster unavailable' };
    const s = cloneState(state);
    const events = applyBoosterEffect(s, action);
    const r = resolveMatches(s);
    events.push(...r.events);
    finishTurn(s, events, r.matchCount, { countsAsMove: false });
    return { ok: true, state: s, events };
  }
  return { ok: false, state, events: [], reason: 'unknown action' };
}

/** The spec'd entry point for plain moves. */
export const applyMove = (state, move) => applyAction(state, move);

export const isComplete = (state) => goalsDone(state.goals);
export const isFailed = (state) => state.status === 'lost';
