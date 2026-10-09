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
// theme icons: content/themes/<id>.svg next to the theme file (square, viewBox 0 0 48 48; validate:levels checks them)
const iconFiles = import.meta.glob('../../content/themes/*.svg', { eager: true, query: '?raw', import: 'default' });
const fixtureIcons = fixtures ? import.meta.glob('../../tests/fixtures/themes/*.svg', { eager: true, query: '?raw', import: 'default' }) : {};

const packs = [];
const levels = new Map();
for (const [path, data] of Object.entries({ ...levelFiles, ...fixtureLevels })) {
  if (path.endsWith('/pack.json')) packs.push(data);
  else levels.set(data.id, data);
}
packs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));

export const THEMES = Object.fromEntries([...Object.values(fixtureThemes), ...Object.values(themeFiles)].map((t) => [t.id, t]));

/** Theme id -> its icon's SVG markup (themes without one fall back to a colour swatch). */
export const THEME_ICONS = Object.fromEntries(Object.entries({ ...fixtureIcons, ...iconFiles }).map(([path, svg]) => [path.split('/').pop().replace(/\.svg$/, ''), svg]));

/** Packs for routes and the level select: { id, slug?, name, theme, levels } with only levels that exist. */
export const PACKS = packs.map((p) => ({ ...p, levels: p.levels.filter((id) => levels.has(id)) }));

/** Story order: every pack's levels, in pack order (unlocks, "next level", continue). */
export const STORY = PACKS.flatMap((p) => p.levels);

/** Story beats and keepsakes (content/story/<pack>.json, client/game/story.js), in pack order. */
const storyFiles = import.meta.glob('../../content/story/*.json', { eager: true, import: 'default' });
export const STORY_FILES = PACKS.map((p) => Object.values(storyFiles).find((s) => s.pack === p.id)).filter(Boolean);

export const getLevel = (id) => levels.get(id) ?? null;
export const getPacks = () => packs;
export const storyIndex = (id) => STORY.indexOf(id);

/** Story share codes: a position in the append-only content/levels/share-index.json, never the play order. */
export const SHARE = shareIndexFile.levels;
export const shareIndex = (id) => SHARE.indexOf(id);

/** The look a story level's stage wears (content/story/<pack>.json `looks`, #95), or null (dailies, challenges). */
const LOOKS = new Map(STORY_FILES.flatMap((s) => Object.entries(s.looks ?? {})));
export const lookFor = (level) => LOOKS.get(level?.id) ?? null;

/** A level's theme: its own `theme`, else its pack's, else Street BBQ. */
export const themeFor = (level) => THEMES[level?.theme ?? PACKS.find((p) => p.levels.includes(level?.id))?.theme] ?? THEMES.street_bbq;
