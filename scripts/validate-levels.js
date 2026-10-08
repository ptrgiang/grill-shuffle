// npm run validate:levels  - CI gate for production level packs. Exits 1 on any error.
//
// Per level: schema/structure (shared/levels.js), food/goal/modifier/booster references, file name = id, then the
// solver: solvable, the stored minMoves is the true minimum, the move budget is the one its tier gives (never
// arbitrary), the stored solution replays to a win within the budget, the stored difficulty is current.
// Per pack: no duplicate ids, no structurally duplicated boards (food relabelling and grill order ignored).
// Share index (content/levels/share-index.json): every story level listed exactly once, every entry a story level.
// Content rules (#62, scripts/lib/content-rules.js), against the base revision: packs and the share index are only
// appended to, and from pack.json `curveFrom` on no level is easier (stored solver difficulty) than one before it.
//   --fast         skip the solver (structure only; the content rules still run)
//   --base <ref>   git revision to compare with (default: $GS_CONTENT_BASE, else origin/main when it exists).
//                  With --base / GS_CONTENT_BASE set (CI), an unreadable base is an error; locally it is skipped.
import { basename, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { loadPacks, loadThemes, parseArgs, LEVELS_DIR } from './lib/content.js';
import { isFood } from '../shared/foods.js';
import { validateLevel, cellFood } from '../shared/levels.js';
import { solveLevel } from '../solver/solver.js';
import { boardSignature } from '../solver/canonical.js';
import { moveBudget } from '../shared/progression.js';
import { replay } from '../shared/replay.js';
import { THEMES } from '../shared/levels.js';
import { checkAppendOnly, checkCurve, checkCurveFrom } from './lib/content-rules.js';
import { ROOT } from './lib/content.js';

const args = parseArgs();
const errors = [];
const ids = new Map();
const sigs = new Map();
let count = 0;
const themes = loadThemes();

// the base revision's copy of a content file (null: the file does not exist there, e.g. a new pack)
const baseRef = args.base ?? (process.env.GS_CONTENT_BASE || null);
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
let base = baseRef;
if (!base) {
  try {
    git('rev-parse', '--verify', '--quiet', 'origin/main');
    base = 'origin/main';
  } catch {}
}
if (base) {
  try {
    git('rev-parse', '--verify', '--quiet', `${base}^{commit}`);
  } catch {
    if (baseRef) errors.push(`content rules: base revision ${base} not found (fetch it: git fetch origin main)`);
    else console.log(`note: ${base} not found, content rules not checked against a base`);
    base = null;
  }
}
if (!base) console.log('note: no base revision, append-only not checked (pass --base <ref>)');
const atBase = (file) => {
  if (!base) return null;
  try {
    return JSON.parse(git('show', `${base}:${relative(ROOT, file).split('\\').join('/')}`));
  } catch {
    return null;
  }
};

for (const t of Object.values(themes)) {
  if (!THEMES.includes(t.id)) errors.push(`${t.file}: unknown theme id ${t.id}`);
  if (!Array.isArray(t.foods) || !t.foods.length) errors.push(`${t.file}: theme needs a foods[] catalog`);
  else for (const f of t.foods) if (!isFood(f)) errors.push(`${t.file}: unknown food ${f}`);
}

/** Every food a level can show: slots and stacked layers. */
const levelFoods = (level) => new Set(level.board.grills.flatMap((g) => [...g.slots, ...(g.layers ?? []).flat()]).map(cellFood).filter(Boolean));

for (const { pack, packFile, levels } of loadPacks()) {
  if (!pack.id || !Array.isArray(pack.levels)) errors.push(`${packFile}: pack needs id and levels[]`);
  if (pack.theme && !THEMES.includes(pack.theme)) errors.push(`${packFile}: unknown theme ${pack.theme}`);
  const basePack = atBase(packFile);
  errors.push(...checkAppendOnly(pack.id, basePack?.levels ?? null, pack.levels));
  errors.push(...checkCurveFrom(pack.id, pack, basePack));
  errors.push(...checkCurve(pack.id, levels.map(({ id, level }) => ({ id, difficulty: level?.solver?.difficulty })), pack.curveFrom ?? 1));
  for (const { file, level, id } of levels) {
    const at = `${pack.id}/${id}`;
    const err = (m) => errors.push(`${at}: ${m}`);
    if (!level) {
      err('file missing');
      continue;
    }
    count++;
    if (basename(file, '.json') !== level.id) err(`file name does not match id ${level.id}`);
    if (ids.has(level.id)) err(`duplicate id (also in ${ids.get(level.id)})`);
    ids.set(level.id, at);
    const v = validateLevel(level);
    for (const e of v.errors) err(e);
    if (!v.ok) continue;
    const catalog = themes[level.theme ?? pack.theme]?.foods;
    if (catalog) for (const f of levelFoods(level)) if (!catalog.includes(f)) err(`food ${f} is not in the ${level.theme ?? pack.theme} catalog`);
    const sig = boardSignature(level);
    if (sigs.has(sig)) err(`structural duplicate of ${sigs.get(sig)}`);
    sigs.set(sig, at);
    if (args.fast) continue;

    const r = solveLevel(level, { useLevelMoves: true });
    if (!r.solvable) {
      err(r.truncated ? 'solver could not finish (state space too large)' : 'UNSOLVABLE');
      continue;
    }
    if (!r.withinBudget) err(`needs ${r.minMoves} moves but the budget is ${level.moves}`);
    if (!level.solver) {
      err('no solver block (run: npm run solve -- ' + level.id + ' --write)');
      continue;
    }
    if (level.solver.minMoves !== r.minMoves) err(`stored minMoves ${level.solver.minMoves} but the solver finds ${r.minMoves}`);
    if (level.tier && level.moves !== moveBudget(r.minMoves, level.tier)) err(`moves ${level.moves} is not the ${level.tier} budget ${moveBudget(r.minMoves, level.tier)} for min ${r.minMoves}`);
    if (r.difficulty && level.solver.difficulty !== r.difficulty.score) err(`stored difficulty ${level.solver.difficulty} but it evaluates to ${r.difficulty.score} (re-run solve --write)`);
    const rep = replay(level, level.solver.solution ?? '');
    if (!rep.ok || rep.state.status !== 'won') err(`stored solution does not win (${rep.error ?? rep.state.status})`);
    else if (rep.state.movesUsed !== r.minMoves) err(`stored solution uses ${rep.state.movesUsed} moves, minimum is ${r.minMoves}`);
  }
}

const share = JSON.parse(readFileSync(join(LEVELS_DIR, 'share-index.json'), 'utf8')).levels;
errors.push(...checkAppendOnly('share-index.json', atBase(join(LEVELS_DIR, 'share-index.json'))?.levels ?? null, share));
const shareSeen = new Set();
for (const id of share) {
  if (shareSeen.has(id)) errors.push(`share-index.json: ${id} listed twice`);
  shareSeen.add(id);
  if (!ids.has(id)) errors.push(`share-index.json: ${id} is not a level in any pack (entries are never removed: put the level back)`);
}
for (const id of ids.keys()) if (!shareSeen.has(id)) errors.push(`share-index.json: story level ${id} missing (append it at the end)`);

if (errors.length) {
  console.log(errors.map((e) => `ERROR ${e}`).join('\n'));
  console.log(`\n${errors.length} error(s) in ${count} levels`);
  process.exit(1);
}
console.log(`OK: ${count} levels valid${args.fast ? ' (structure only)' : ', solver-verified'}`);
