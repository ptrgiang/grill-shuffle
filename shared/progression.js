// Stars and move budgets, both derived from the solver's minimum move count. Never from guesses.
//
// Budget by tier (min = solver minimum):     Stars for a win in `used` moves:
//   easy   min + ceil(0.7 min)                  3 stars  used <= min + max(1, round(0.1 min))
//   normal min + ceil(0.4 min)                  2 stars  used <= min + max(2, round(0.4 min))
//   hard   min + ceil(0.2 min)                  1 star   any win
//   expert min + 1
// e.g. min 10 -> budgets 17 / 14 / 12 / 11, stars 3 at <= 11, 2 at <= 14.

export const TIERS = Object.freeze(['easy', 'normal', 'hard', 'expert']);

export function moveBudget(minMoves, tier = 'normal') {
  const m = minMoves;
  switch (tier) {
    case 'easy':
      return m + Math.ceil(0.7 * m);
    case 'normal':
      return m + Math.ceil(0.4 * m);
    case 'hard':
      return m + Math.max(1, Math.ceil(0.2 * m));
    case 'expert':
      return m + 1;
    default:
      throw new Error(`unknown tier ${tier}`);
  }
}

export function starThresholds(minMoves) {
  return { three: minMoves + Math.max(1, Math.round(0.1 * minMoves)), two: minMoves + Math.max(2, Math.round(0.4 * minMoves)) };
}

export function starsFor(movesUsed, minMoves, won = true) {
  if (!won) return 0;
  if (!Number.isFinite(minMoves)) return 1;
  const t = starThresholds(minMoves);
  return movesUsed <= t.three ? 3 : movesUsed <= t.two ? 2 : 1;
}

/**
 * Linear unlock: level i opens once level i-1 has at least one star. A level already won stays open, so inserting a
 * new level into a pack's curve never locks a player out of levels they have played.
 */
export function isUnlocked(levelIds, index, progress) {
  if (index === 0) return true;
  if ((progress[levelIds[index]]?.stars ?? 0) > 0) return true;
  return (progress[levelIds[index - 1]]?.stars ?? 0) > 0;
}

export const totalStars = (progress) => Object.values(progress).reduce((n, p) => n + (p.stars || 0), 0);
