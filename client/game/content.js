// Level packs and themes, bundled at build time from content/ (Vite glob import). Adding a level is adding a JSON
// file and listing it in its pack.json: no code changes.
const levelFiles = import.meta.glob('../../content/levels/*/*.json', { eager: true, import: 'default' });
const themeFiles = import.meta.glob('../../content/themes/*.json', { eager: true, import: 'default' });

const packs = [];
const levels = new Map();
for (const [path, data] of Object.entries(levelFiles)) {
  if (path.endsWith('/pack.json')) packs.push(data);
  else levels.set(data.id, data);
}
packs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));

export const THEMES = Object.fromEntries(Object.values(themeFiles).map((t) => [t.id, t]));

/** Story order: every pack's levels, in pack order. */
export const STORY = packs.flatMap((p) => p.levels.filter((id) => levels.has(id)));

export const getLevel = (id) => levels.get(id) ?? null;
export const getPacks = () => packs;
export const storyIndex = (id) => STORY.indexOf(id);
export const themeFor = (level) => THEMES[level?.theme] ?? THEMES.street_bbq;
