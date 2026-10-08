// Pack / level unlocks, pure (no DOM). Packs come in order (content.js PACKS), each with its theme
// (content/themes/<id>.json `unlock.stars`). Content rule 4 (#62): a pack opens after the previous pack.
//
//   pack 0                 always open
//   pack k > 0             open when every level of pack k-1 has a star AND the story star total reaches the
//                          theme's `unlock.stars`; once any of its levels has a star it stays open (an appended
//                          level or a raised requirement never locks a player out of a pack they were playing)
//   level inside a pack    the pack is open and (first level, or the previous level has a star, or it has one itself)
//
// Only story stars count: dailies and challenges do not open packs.
import { isUnlocked } from '../../shared/progression.js';

const starred = (progress, id) => (progress[id]?.stars ?? 0) > 0;

/** Stars earned on the story levels of these packs. */
export const storyStars = (packs, progress) => packs.reduce((n, p) => n + p.levels.reduce((m, id) => m + (progress[id]?.stars ?? 0), 0), 0);

/** Stars a pack needs (its theme's `unlock.stars`, 0 without one). */
export const starsNeeded = (pack, themes) => themes[pack.theme]?.unlock?.stars ?? 0;

/**
 * -> { open, previousDone, need, have, previous } for packs[index].
 * `previous` is the pack that has to be finished first (null for the first pack).
 */
export function packStatus(packs, index, progress, themes) {
  const pack = packs[index];
  const need = starsNeeded(pack, themes);
  const have = storyStars(packs, progress);
  if (index === 0) return { open: true, previousDone: true, need, have, previous: null };
  const previous = packs[index - 1];
  const previousDone = previous.levels.every((id) => starred(progress, id));
  const playing = pack.levels.some((id) => starred(progress, id));
  return { open: playing || (previousDone && have >= need), previousDone, need, have, previous };
}

/** Index of the pack that holds a story level, or -1. */
export const packIndexOf = (packs, id) => packs.findIndex((p) => p.levels.includes(id));

/** Is this story level playable? */
export function levelOpen(packs, id, progress, themes) {
  const k = packIndexOf(packs, id);
  if (k < 0) return false;
  if (!packStatus(packs, k, progress, themes).open) return false;
  return isUnlocked(packs[k].levels, packs[k].levels.indexOf(id), progress);
}

/** The level "Continue" / "Play" opens: the first open level without a star, else the last open level. */
export function nextStoryLevel(packs, progress, themes) {
  let last = null;
  for (const pack of packs) {
    for (const id of pack.levels) {
      if (!levelOpen(packs, id, progress, themes)) continue;
      if (!starred(progress, id)) return id;
      last = id;
    }
  }
  return last ?? packs[0]?.levels[0] ?? null;
}

/** The story level after `id` when it is open (the result screen's "Next level"), else null. */
export function nextLevelAfter(packs, id, progress, themes) {
  const story = packs.flatMap((p) => p.levels);
  const i = story.indexOf(id);
  const next = i >= 0 ? story[i + 1] : null;
  return next && levelOpen(packs, next, progress, themes) ? next : null;
}

/** Player-facing reason a pack is locked, e.g. "Finish Street BBQ and earn ★ 40" (null when open). */
export function lockReason(status) {
  if (status.open) return null;
  const stars = status.need > status.have ? `earn ★ ${status.need}` : null;
  if (!status.previousDone) return stars ? `Finish ${status.previous.name} and ${stars}` : `Finish ${status.previous.name}`;
  return `${stars[0].toUpperCase()}${stars.slice(1)} (you have ★ ${status.have})`;
}
