// Level generation CLI. Generates many candidates, keeps only solver-verified, in-band, non-duplicate ones.
//
//   npm run generate:levels -- --theme street_bbq --count 100 --difficulty 20:40
//     [--foods shrimp,beef,corn,chicken]  (default: the theme's food catalog; foods outside it are refused) [--grills 4:5] [--trays 0:1] [--empty 2:4] [--layers 0:2] [--locks 0:1]
//     [--lock-matches 1:3] [--food-count 3:4] [--min-moves 5:18] [--seed 1] [--candidates 2000]
//     [--out content/generated/<name>]   write level files + pack.json there (default: print a summary only)
//     [--prefix gen]                     id prefix
//     [--append <pack>]                  candidates to append to that pack (content rules, #62): the difficulty
//                                        range starts at the pack's current max (--difficulty only sets the top,
//                                        default max + 15) and the output is in ascending difficulty, so it can be
//                                        appended in order. Without --append the output is still sorted.
//
// Output goes to a staging folder, never straight into a production pack: a person plays them first, then moves
// the good ones into content/levels/<pack>/ and runs validate:levels.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs, formatLevel, allLevels, loadThemes, loadPacks, ROOT } from './lib/content.js';
import { packMaxDifficulty } from './lib/content-rules.js';
import { generateLevels } from '../solver/generator.js';
import { boardSignature } from '../solver/canonical.js';
import { validateLevel } from '../shared/levels.js';

const args = parseArgs();
const range = (v, d) => (v === undefined ? d : String(v).split(':').map(Number).concat(String(v).includes(':') ? [] : [Number(v)]).slice(0, 2));

// --append <pack>: new levels may never be easier than the pack's hardest level so far
const appendTo = args.append ? loadPacks().find((p) => p.pack.id === String(args.append)) : null;
if (args.append && !appendTo) throw new Error(`--append: no pack ${args.append}`);
const appendMin = appendTo ? packMaxDifficulty(appendTo.levels.map((l) => ({ difficulty: l.level?.solver?.difficulty }))) : null;
const theme = args.theme ?? appendTo?.pack.theme ?? 'street_bbq';
const catalog = loadThemes()[theme]?.foods; // the theme's food catalog: default food pool, and a hard limit
const config = {
  theme,
  ...(catalog ? { catalog } : {}),
  ...(args.foods ? { foods: String(args.foods).split(',') } : {}),
  foodCount: range(args['food-count'], [3, 4]),
  grills: range(args.grills, [4, 5]),
  trays: range(args.trays, [0, 0]),
  emptySlots: range(args.empty, [2, 4]),
  layers: range(args.layers, [0, 0]),
  locks: range(args.locks, [0, 0]),
  lockMatches: range(args['lock-matches'], [1, 3]),
  difficulty: appendTo ? [appendMin, args.difficulty ? range(args.difficulty).at(-1) : appendMin + 15] : range(args.difficulty, [20, 40]),
  minMoves: range(args['min-moves'], [4, 22]),
};
const count = Number(args.count ?? 10);
const maxCandidates = Number(args.candidates ?? Math.max(200, count * 40));
const seed = Number(args.seed ?? 1);
const prefix = args.prefix ?? 'gen';

// never re-generate a board that already ships
const exclude = new Set(allLevels().filter((l) => l.level && validateLevel(l.level).ok).map((l) => boardSignature(l.level)));

const t0 = Date.now();
let last = 0;
const { levels, stats } = generateLevels(config, {
  count,
  maxCandidates,
  seed,
  exclude,
  onProgress: (s) => {
    if (Date.now() - last > 2000) {
      last = Date.now();
      process.stderr.write(`  ${s.candidates} candidates, ${s.accepted} accepted\n`);
    }
  },
});

levels.sort((a, b) => a.report.difficulty.score - b.report.difficulty.score || a.report.minMoves - b.report.minMoves); // never easier
if (appendTo) console.log(`append to ${appendTo.pack.id}: max difficulty so far ${appendMin}, candidates in ascending order`);
levels.forEach((l, i) => {
  l.level.id = `${prefix}-${String(i + 1).padStart(3, '0')}`;
  l.level.name = `${config.theme} #${i + 1}`;
});

console.log(`config: ${JSON.stringify(config)}`);
console.log(`candidates: ${stats.candidates}, accepted: ${levels.length}/${count} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`rejected: ${JSON.stringify(stats.rejected)}`);
for (const { level, report } of levels) console.log(`  ${level.id}  min ${report.minMoves}  moves ${level.moves}  difficulty ${report.difficulty.score} ${report.difficulty.rating}  dead ${Math.round(report.deadEndRatio * 100)}%  ${JSON.stringify(level.board.grills.map((g) => g.slots))}`);

if (args.out) {
  const dir = resolve(ROOT, String(args.out));
  mkdirSync(dir, { recursive: true });
  for (const { level } of levels) writeFileSync(join(dir, `${level.id}.json`), formatLevel(level));
  writeFileSync(join(dir, 'pack.json'), JSON.stringify({ id: prefix, theme: config.theme, name: `Generated ${prefix}`, generator: { config, seed, maxCandidates }, levels: levels.map((l) => l.level.id) }, null, 2) + '\n');
  console.log(`wrote ${levels.length} levels to ${dir}`);
}
