// Composable, data-driven objectives. Each goal type knows how to validate its JSON, build its runtime
// record ({ type, food?, target, progress }) and react to simulation events. A level is won when every goal's
// progress reaches its target.
//
// Planned (need the burn-counter modifier, not in rules v1): protect_food, clear_before_char.

import { isFood } from './foods.js';

const positiveInt = (n) => Number.isInteger(n) && n > 0;

export const GOAL_TYPES = Object.freeze({
  clear_food: {
    validate(goal, level, totals, size) {
      if (!isFood(goal.food)) return `unknown food ${goal.food}`;
      if (!positiveInt(goal.count) || goal.count % size) return `count must be a positive multiple of ${size}`;
      if ((totals[goal.food] || 0) < goal.count) return `only ${totals[goal.food] || 0} ${goal.food} on the board`;
      return null;
    },
    init: (goal) => ({ type: 'clear_food', food: goal.food, target: goal.count, progress: 0 }),
    onMatch: (g, m) => (g.progress += m.foods.filter((f) => f === g.food).length),
  },
  // "serve" is the player-facing verb for clearing; kept as its own type so themes can word it differently.
  serve_food: {
    validate: (goal, level, totals, size) => GOAL_TYPES.clear_food.validate(goal, level, totals, size),
    init: (goal) => ({ type: 'serve_food', food: goal.food, target: goal.count, progress: 0 }),
    onMatch: (g, m) => (g.progress += m.foods.filter((f) => f === g.food).length),
  },
  clear_all: {
    validate: () => null,
    init: (goal, level, totals) => ({ type: 'clear_all', target: Object.values(totals).reduce((a, b) => a + b, 0), progress: 0 }),
    onMatch: (g, m) => (g.progress += m.foods.length),
  },
  complete_matches: {
    validate: (goal) => (positiveInt(goal.count) ? null : 'count must be a positive integer'),
    init: (goal) => ({ type: 'complete_matches', target: goal.count, progress: 0 }),
    onMatch: (g) => (g.progress += 1),
  },
  reach_score: {
    validate: (goal) => (positiveInt(goal.count) ? null : 'count must be a positive integer'),
    init: (goal) => ({ type: 'reach_score', target: goal.count, progress: 0 }),
    onScore: (g, score) => (g.progress = score),
  },
  clear_blocker: {
    validate: (goal, level) => (level.board.grills.some((g) => (g.lock ?? 0) > 0) ? null : 'no locked grill on the board'),
    init: (goal, level) => ({ type: 'clear_blocker', target: level.board.grills.filter((g) => (g.lock ?? 0) > 0).length, progress: 0 }),
    onUnlock: (g) => (g.progress += 1),
  },
  reveal_hidden: {
    validate: (goal, level) => (level.board.grills.some((g) => (g.layers ?? []).length) ? null : 'no stacked trays on the board'),
    init: (goal, level) => ({ type: 'reveal_hidden', target: level.board.grills.reduce((n, g) => n + (g.layers ?? []).length, 0), progress: 0 }),
    onReveal: (g) => (g.progress += 1),
  },
});

export function initGoals(level, totals) {
  return level.goals.map((goal) => GOAL_TYPES[goal.type].init(goal, level, totals));
}

/** Feed one event to every goal. Returns the goal_progress events it caused. */
export function goalsOnEvent(goals, ev, score) {
  const out = [];
  goals.forEach((g, i) => {
    const spec = GOAL_TYPES[g.type];
    const before = g.progress;
    if (ev.type === 'match' && spec.onMatch) spec.onMatch(g, ev);
    else if (ev.type === 'unlock' && spec.onUnlock) spec.onUnlock(g, ev);
    else if (ev.type === 'reveal' && spec.onReveal) spec.onReveal(g, ev);
    else if (ev.type === 'score' && spec.onScore) spec.onScore(g, score);
    if (g.progress > g.target) g.progress = g.target;
    if (g.progress !== before) out.push({ type: 'goal_progress', goal: i, food: g.food, amount: g.progress - before, progress: g.progress, target: g.target });
  });
  return out;
}

export const goalsDone = (goals) => goals.every((g) => g.progress >= g.target);
