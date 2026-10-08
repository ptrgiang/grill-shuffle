// Level packs and themes, bundled at build time from content/ (Vite glob import). Adding a level is adding a JSON
// file and listing it in its pack.json: no code changes.
//
// Dev server only: ?fixtures=1 on the first page load also loads tests/fixtures/levels (a locked second pack on the
// test_mint theme) and tests/fixtures/themes, for e2e and for looking at pack unlocks. Production builds never do.
import shareIndexFile from '../../content/levels/share-index.json';

const levelFiles = import.meta.glob('../../content/levels/*/*.json', { eager: true, import: 'default' });
const themeFiles = import.meta.glob('../../content/themes/*.json', { eager: true, import: 'default' });

const fixtures = import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('fixtures') === '1';
const fixtureLevels = fixtures ? import.meta.glob('../../tests/fixtures/levels/*/*.json', { eager: true, import: 'default' }) : {};
const fixtureThemes = fixtures ? import.meta.glob('../../tests/fixtures/themes/*.json', { eager: true, import: 'default' }) : {};

const packs = [];
const levels = new Map();
for (const [path, data] of Object.entries({ ...levelFiles, ...fixtureLevels })) {
  if (path.endsWith('/pack.json')) packs.push(data);
  else levels.set(data.id, data);
}
packs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));

export const THEMES = Object.fromEntries([...Object.values(fixtureThemes), ...Object.values(themeFiles)].map((t) => [t.id, t]));

/** Packs for routes and the level select: { id, slug?, name, theme, levels } with only levels that exist. */
export const PACKS = packs.map((p) => ({ ...p, levels: p.levels.filter((id) => levels.has(id)) }));

/** Story order: every pack's levels, in pack order (unlocks, "next level", continue). */
export const STORY = PACKS.flatMap((p) => p.levels);

export const getLevel = (id) => levels.get(id) ?? null;
export const getPacks = () => packs;
export const storyIndex = (id) => STORY.indexOf(id);

/** Story share codes: a position in the append-only content/levels/share-index.json, never the play order. */
export const SHARE = shareIndexFile.levels;
export const shareIndex = (id) => SHARE.indexOf(id);

/** A level's theme: its own `theme`, else its pack's, else Street BBQ. */
export const themeFor = (level) => THEMES[level?.theme ?? PACKS.find((p) => p.levels.includes(level?.id))?.theme] ?? THEMES.street_bbq;
