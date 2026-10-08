// URL <-> screen, pure (no DOM). `packs`: [{ id, slug, levels: [level ids in play order] }] (content.js PACKS).
//   /                 menu
//   /levels           level select
//   /<slug>/<n>       story level n of a pack (1-based position inside the pack, the number shown on screen),
//                     e.g. /street-bbq/12 (#63)
//   /level/<n>        old URL (before packs): level n of Street BBQ (LEGACY_PACK); rewritten to /street-bbq/<n>
//   /play             the next unfinished story level
//   /play/<id>        old id URL: opens the level, the client rewrites it to /<slug>/<n>
//   /daily            today's daily puzzle
//   /p/<code>         shared challenge (story codes go through the share index, not the play order)

/** First path segments that belong to pages, files or the API: never a pack slug (validate:levels checks). */
export const RESERVED_SLUGS = Object.freeze(['levels', 'level', 'play', 'daily', 'p', 'sandbox', 'assets', 'fonts', 'icons', 'api']);

/** The only pack that existed when story URLs were /level/<n>: those old links always mean this pack. */
export const LEGACY_PACK = 'street_bbq';

/** A pack's URL slug: `slug` from pack.json, else its id with dashes (street_bbq -> street-bbq). */
export const packSlug = (pack) => pack.slug ?? String(pack.id).replace(/_/g, '-');

/** -> { name, id?, code?, missing? } */
export function parseRoute(path, packs) {
  const p = path.replace(/\/+$/, '') || '/';
  let m;
  if (p === '/') return { name: 'menu' };
  if (p === '/levels') return { name: 'levels' };
  if (p === '/daily') return { name: 'daily' };
  if (p === '/play') return { name: 'play' };
  if ((m = /^\/level\/(\d{1,4})$/.exec(p))) return levelAt(packs.find((k) => k.id === LEGACY_PACK), Number(m[1]));
  if ((m = /^\/play\/([a-z0-9-]+)$/.exec(p))) return { name: 'play', id: m[1] };
  if ((m = /^\/p\/([A-Za-z0-9-]+)$/.exec(p))) return { name: 'code', code: m[1] };
  if ((m = /^\/([a-z0-9-]+)\/(\d{1,4})$/.exec(p)) && !RESERVED_SLUGS.includes(m[1])) {
    const pack = packs.find((k) => packSlug(k) === m[1]);
    if (pack) return levelAt(pack, Number(m[2]));
  }
  return { name: 'menu' };
}

function levelAt(pack, n) {
  const id = pack?.levels[n - 1];
  return id ? { name: 'play', id } : { name: 'play', missing: true };
}

/** { pack, n } of a story level (n = 1-based position inside its pack), or null. */
export function levelPosition(packs, id) {
  for (const pack of packs) {
    const i = pack.levels.indexOf(id);
    if (i >= 0) return { pack, n: i + 1 };
  }
  return null;
}

/** Canonical URL of a story level, or null when the id is not in any pack. */
export function levelPath(packs, id) {
  const at = levelPosition(packs, id);
  return at ? `/${packSlug(at.pack)}/${at.n}` : null;
}
