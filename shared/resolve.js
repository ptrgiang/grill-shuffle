// Deterministic resolution. The only place board state changes.
//
//   applyAction(state, action) -> { ok, state: nextState, events, reason? }
//
// The input state is never mutated. Resolution order after a move (rules v1):
//   1. the item moves (movesLeft - 1)
//   2. loop until stable:
//        a. every match on the board clears (grill order, then slot order); each match:
//           combo + 1, score += matchScore * combo, goal progress, every locked grill's counter - 1
//        b. every empty unlocked grill with stacked trays reveals its next layer
//      (an unlock or a reveal can create new matches: those are chain matches, chain index > 0)
//   3. no match at all during the move -> combo resets
//   4. status: all goals done -> won; else no moves left or no legal move -> lost
// Events describe every step, in order, for the renderer/audio. Skipping them changes nothing.

import { cloneState } from './state.js';
import { isLegalMove, hasLegalMove } from './moves.js';
import { findMatches } from './match.js';
import { tickLocks, revealLayers } from './obstacles.js';
import { comboOnMatch, comboOnQuietMove } from './combo.js';
import { goalsOnEvent, goalsDone } from './goals.js';
import { canUseBooster, applyBoosterEffect, hasUsableBooster } from './boosters.js';

/** Resolve matches/unlocks/reveals until the board is stable. Mutates `s`; returns { events, matchCount }. */
export function resolveMatches(s) {
  const events = [];
  let matchCount = 0;
  let chain = 0;
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
      emit({ type: 'match', grill: m.grill, key: m.key, food: items[0].food, foods: items.map((it) => it.food), itemIds: items.map((it) => it.id), slots: m.slots, chain, combo });
      emit({ type: 'score', points, total: s.score, combo });
      for (const ev of tickLocks(s)) emit(ev);
    }
    const reveals = revealLayers(s);
    for (const ev of reveals) emit(ev);
    if (!matches.length && !reveals.length) break;
    if (matches.length) chain += 1;
  }
  return { events, matchCount };
}

function finishTurn(s, events, matchCount, { countsAsMove }) {
  if (countsAsMove && matchCount === 0) {
    const ev = comboOnQuietMove(s);
    if (ev) events.push(ev);
  }
  if (matchCount > 0) events.push({ type: 'combo', combo: s.combo });
  if (goalsDone(s.goals)) {
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
    finishTurn(s, events, r.matchCount, { countsAsMove: true });
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
