// URL <-> screen, pure (no DOM). `packs`: [{ id, slugs?: { vi, en }, levels: [level ids in play order] }] (content.js
// PACKS). Every pack has one slug per language (#92); either one opens it, links are written in the current language.
//   /                 menu
//   /levels           level select (tab of the pack "Continue" is in)
//   /levels/<slug>    level select on that pack's tab, e.g. /levels/lang-chai, /levels/fishing-village
//   /<slug>/<n>       story level n of a pack (1-based position inside the pack, the number shown on screen),
//                     e.g. /hem-sai-gon/12 = /saigon-alley/12
//   /play             the next unfinished story level
//   /play/<id>        id URL (tools, tests): opens the level, the client rewrites it to /<slug>/<n>
//   /daily            today's daily puzzle
//   /p/<code>         shared challenge (story codes go through the share index, not the play order)
import { lang, LANGS } from '../i18n/index.js';

/** First path segments that belong to pages, files or the API: never a pack slug (validate:levels checks). */
export const RESERVED_SLUGS = Object.freeze(['levels', 'level', 'play', 'daily', 'p', 'sandbox', 'assets', 'fonts', 'icons', 'api']);

/** A pack's slugs { vi, en }: `slugs` from pack.json, else its id with dashes in both (test fixtures). */
export function packSlugs(pack) {
  const base = String(pack.id).replace(/_/g, '-');
  return Object.fromEntries(LANGS.map((l) => [l, pack.slugs?.[l] ?? base]));
}

/** The pack's slug in language `l` (default: the current one). */
export const packSlug = (pack, l = lang()) => packSlugs(pack)[l];

const packBySlug = (packs, slug) => packs.find((k) => Object.values(packSlugs(k)).includes(slug));

/** -> { name, id?, pack? (pack id), code?, missing? } */
export function parseRoute(path, packs) {
  const p = path.replace(/\/+$/, '') || '/';
  let m;
  if (p === '/') return { name: 'menu' };
  if (p === '/levels') return { name: 'levels' };
  if ((m = /^\/levels\/([a-z0-9-]+)$/.exec(p))) {
    const pack = packBySlug(packs, m[1]);
    return pack ? { name: 'levels', pack: pack.id } : { name: 'levels' };
  }
  if (p === '/daily') return { name: 'daily' };
  if (p === '/play') return { name: 'play' };
  if ((m = /^\/play\/([a-z0-9-]+)$/.exec(p))) return { name: 'play', id: m[1] };
  if ((m = /^\/p\/([A-Za-z0-9-]+)$/.exec(p))) return { name: 'code', code: m[1] };
  if ((m = /^\/([a-z0-9-]+)\/(\d{1,4})$/.exec(p)) && !RESERVED_SLUGS.includes(m[1])) {
    const pack = packBySlug(packs, m[1]);
    if (pack) {
      const id = pack.levels[Number(m[2]) - 1];
      return id ? { name: 'play', id } : { name: 'play', missing: true };
    }
  }
  return { name: 'menu' };
}

/** { pack, n } of a story level (n = 1-based position inside its pack), or null. */
export function levelPosition(packs, id) {
  for (const pack of packs) {
    const i = pack.levels.indexOf(id);
    if (i >= 0) return { pack, n: i + 1 };
  }
  return null;
}

/** Canonical URL of a story level in language `l` (default: the current one), or null when it is in no pack. */
export function levelPath(packs, id, l = lang()) {
  const at = levelPosition(packs, id);
  return at ? `/${packSlug(at.pack, l)}/${at.n}` : null;
}

/** Canonical URL of a pack's tab in the level select. */
export const levelsPath = (pack, l = lang()) => `/levels/${packSlug(pack, l)}`;
