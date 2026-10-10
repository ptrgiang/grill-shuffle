// The journey map (#84): every pack as one stop on Út's road, the cart at the level "Continue" opens, Bà Năm one stop
// ahead (docs/STORY.md "Retention loops"), the story's marks on the road. Pure: the screen (client/ui/journey.js) draws it.
import { packStatus, levelOpen, storyStars, nextStoryLevel } from './unlock.js';

/** The story's five stops (docs/STORY.md "The five stops"); stops without a pack yet show as teasers. */
export const JOURNEY_STOPS = 5;

/** Level id -> the story mark on the road: 'page' (a recipe page), 'beat' (a chapter step) or 'keepsake'. */
export function storyMarks(storyFiles) {
  const marks = new Map();
  for (const file of storyFiles ?? []) {
    for (const b of file.beats ?? []) {
      const id = b.at?.level;
      if (id) marks.set(id, b.reward?.recipePage ? 'page' : marks.get(id) === 'page' ? 'page' : 'beat');
    }
    for (const k of file.keepsakes ?? []) if (k.level && !marks.has(k.level)) marks.set(k.level, 'keepsake');
  }
  return marks;
}

/**
 * -> { stops, cart, banam, next, stars, total }
 * stops: one per story stop (JOURNEY_STOPS, or more when more packs ship): { n, pack, teaser, open, status, stars,
 * total, levels: [{ id, n, open, stars, current, mark }], cart, banam }. `cart`: index of the stop the cart is at
 * (the pack of the next level); `banam`: the stop after it (a teaser when that pack has not shipped).
 */
export function journeyModel(packs, progress, themes, storyFiles = []) {
  const next = nextStoryLevel(packs, progress, themes);
  const cart = Math.max(0, packs.findIndex((p) => p.levels.includes(next)));
  const banam = cart + 1;
  const marks = storyMarks(storyFiles);
  const stops = packs.map((pack, k) => {
    const status = packStatus(packs, k, progress, themes);
    return {
      n: k + 1,
      pack,
      teaser: false,
      open: status.open,
      status,
      stars: storyStars([pack], progress),
      total: pack.levels.length * 3,
      levels: pack.levels.map((id, i) => ({
        id,
        n: i + 1,
        open: levelOpen(packs, id, progress, themes),
        stars: progress[id]?.stars ?? 0,
        current: id === next,
        mark: marks.get(id) ?? null,
      })),
      cart: k === cart,
      banam: k === banam,
    };
  });
  for (let k = packs.length; k < JOURNEY_STOPS; k++) {
    stops.push({ n: k + 1, pack: null, teaser: true, open: false, status: null, stars: 0, total: 0, levels: [], cart: false, banam: k === banam });
  }
  return { stops, cart, banam, next, stars: storyStars(packs, progress), total: packs.reduce((n, p) => n + p.levels.length * 3, 0) };
}
