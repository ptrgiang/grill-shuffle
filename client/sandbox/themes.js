// ?theme=<id> for the sandboxes: every content theme plus the test fixtures (tests/fixtures/themes, e.g. test_mint),
// so a theme can be looked at before any pack uses it. The game itself only knows content/themes.
import { THEMES } from '../game/content.js';

const fixtures = import.meta.glob('../../tests/fixtures/themes/*.json', { eager: true, import: 'default' });
const ALL = { ...Object.fromEntries(Object.values(fixtures).map((t) => [t.id, t])), ...THEMES };

/** The theme named by ?theme=, or null when the URL names none (or an unknown one). */
export function themeFromUrl(params = new URLSearchParams(location.search)) {
  const id = params.get('theme');
  return id ? ALL[id] ?? null : null;
}
