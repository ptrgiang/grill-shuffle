// Sanitising uploaded progress. A client can claim anything; the server keeps only story levels, plausible numbers,
// and never more stars than the claimed move count earns against the level's solver minimum.
// (Full proof would need the moves; story progress is low-stakes, daily/challenge results ARE replayed.)

export function mergeProgressRecords(entries, levels, starsFor) {
  const out = [];
  for (const [levelId, r] of entries) {
    const level = levels[levelId];
    if (!level || !r || typeof r !== 'object') continue;
    const min = level.solver?.minMoves ?? 1;
    const bestMoves = Number.isInteger(r.bestMoves) && r.bestMoves >= min && r.bestMoves <= level.moves ? r.bestMoves : null;
    if (bestMoves === null) continue;
    const stars = Math.min(Number.isInteger(r.stars) ? Math.max(0, Math.min(3, r.stars)) : 0, starsFor(bestMoves, min, true));
    const bestScore = Number.isInteger(r.bestScore) && r.bestScore >= 0 && r.bestScore < 1e7 ? r.bestScore : 0;
    out.push([levelId, { stars, bestMoves, bestScore }]);
  }
  return out;
}

/** A player's seen story beats / keepsakes: only ids the story has (content/story), each once. */
export function cleanSeen(list, allowed) {
  const known = new Set(allowed);
  return [...new Set(list.filter((id) => typeof id === 'string' && known.has(id)))];
}
