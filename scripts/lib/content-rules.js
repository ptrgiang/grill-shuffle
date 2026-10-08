// Content rules (issue #62), pure: levels are only appended at the end of a pack, and inside a pack a level is never
// easier than any level before it. validate-levels.js runs these against the base branch (git) in CI.
//
//   1. append only: the base's level list (and the share index) must be an exact prefix of the new one
//   2. never easier: from position `curveFrom` (1-based, pack.json; default 1) on, each level's stored solver
//      difficulty is >= the highest difficulty of every level before it in the pack (ties allowed)
// `curveFrom` exempts levels shipped before the rule (Street BBQ 1-50). It can never be raised past what the base
// already shipped, so it cannot be used to exempt new levels.

/** `base` (array or null for a new list) must be a prefix of `next`. Returns error strings, prefixed with `what`. */
export function checkAppendOnly(what, base, next) {
  if (!base) return [];
  const errors = [];
  const firstDiff = base.findIndex((id, i) => next[i] !== id);
  if (firstDiff >= 0) {
    const was = base[firstDiff], now = next[firstDiff];
    const moved = next.indexOf(was);
    errors.push(
      moved < 0
        ? `${what}: shipped entry ${was} (#${firstDiff + 1}) was removed; entries are only ever appended`
        : `${what}: #${firstDiff + 1} was ${was}, now ${now ?? 'nothing'}; shipped entries keep their position (new ones go at the end)`,
    );
  }
  return errors;
}

/**
 * `levels`: [{ id, difficulty }] in pack order. `curveFrom`: first 1-based position the rule applies to.
 * Returns error strings like "street-051 (#51) difficulty 54 < 58, the max so far (street-050, #50)".
 */
export function checkCurve(what, levels, curveFrom = 1) {
  const errors = [];
  let max = -Infinity, maxAt = -1;
  levels.forEach((l, i) => {
    const d = l.difficulty;
    if (typeof d !== 'number') return;
    if (i + 1 >= curveFrom && d < max) errors.push(`${what}: ${l.id} (#${i + 1}) difficulty ${d} < ${max}, the max so far (${levels[maxAt].id}, #${maxAt + 1}); a later level is never easier`);
    if (d > max) {
      max = d;
      maxAt = i;
    }
  });
  return errors;
}

/**
 * `curveFrom` may only exempt levels the base already shipped: <= base level count + 1, and never above the base's
 * own curveFrom. `base`: the base pack.json (null for a new pack).
 */
export function checkCurveFrom(what, pack, base) {
  const from = pack.curveFrom ?? 1;
  if (!Number.isInteger(from) || from < 1) return [`${what}: curveFrom must be a positive integer`];
  const limit = base ? Math.min(base.curveFrom ?? base.levels.length + 1, base.levels.length + 1) : 1;
  return from > limit ? [`${what}: curveFrom ${from} would exempt levels the base did not ship (at most ${limit})`] : [];
}

/** Highest stored difficulty in a pack (generate:levels --append starts there). */
export const packMaxDifficulty = (levels) => Math.max(...levels.map((l) => l.difficulty).filter((d) => typeof d === 'number'));
