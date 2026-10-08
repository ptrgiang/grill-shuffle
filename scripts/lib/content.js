// Reading and writing level content on disk (Node only).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const LEVELS_DIR = join(ROOT, 'content', 'levels');

/** Every pack: [{ dir, pack, levels: [{ file, level }] }] in pack order. */
export function loadPacks() {
  const out = [];
  for (const name of readdirSync(LEVELS_DIR, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const dir = join(LEVELS_DIR, name.name);
    const packFile = join(dir, 'pack.json');
    if (!existsSync(packFile)) continue;
    const pack = JSON.parse(readFileSync(packFile, 'utf8'));
    const levels = pack.levels.map((id) => {
      const file = join(dir, `${id}.json`);
      return { file, level: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null, id };
    });
    out.push({ dir, packFile, pack, levels });
  }
  return out;
}

export const THEMES_DIR = join(ROOT, 'content', 'themes');

/** Theme files by id (content/themes/*.json, format: shared/themes.js), each with its `file` path. */
export function loadThemes() {
  const out = {};
  for (const f of readdirSync(THEMES_DIR)) if (f.endsWith('.json')) {
    const t = JSON.parse(readFileSync(join(THEMES_DIR, f), 'utf8'));
    out[t.id] = { ...t, file: join(THEMES_DIR, f) };
  }
  return out;
}

export function allLevels() {
  return loadPacks().flatMap((p) => p.levels.map((l) => ({ ...l, pack: p.pack.id })));
}

export function findLevel(idOrPath) {
  if (existsSync(idOrPath)) return { file: resolve(idOrPath), level: JSON.parse(readFileSync(idOrPath, 'utf8')) };
  const hit = allLevels().find((l) => l.id === idOrPath || l.id.endsWith(`-${idOrPath}`) || l.id.endsWith(`-${String(idOrPath).padStart(3, '0')}`));
  if (!hit) throw new Error(`no level "${idOrPath}"`);
  return hit;
}

/** Stable, readable JSON: one grill per line. */
export function formatLevel(level) {
  const order = ['formatVersion', 'id', 'name', 'theme', 'tier', 'moves', 'board', 'goals', 'rules', 'modifiers', 'boosters', 'hint', 'solver'];
  const keys = [...order.filter((k) => k in level), ...Object.keys(level).filter((k) => !order.includes(k))];
  const lines = keys.map((k) => {
    if (k === 'board') {
      const gs = level.board.grills.map((g) => `      ${JSON.stringify(g)}`).join(',\n');
      return `  "board": {\n    "grills": [\n${gs}\n    ]\n  }`;
    }
    if (k === 'solver') return `  "solver": ${JSON.stringify(level.solver, null, 2).replace(/\n/g, '\n  ')}`;
    return `  ${JSON.stringify(k)}: ${JSON.stringify(level[k])}`;
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}

export function writeLevel(file, level) {
  writeFileSync(file, formatLevel(level));
}

/** --key value / --key=value / --flag */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}
