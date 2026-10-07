// Solver benchmark:  npm run bench:solver
// Solves every story level and a fixed set of generated boards per band; prints states, time, states/second.
// Compare before/after any change to shared/ hot paths (moves, match, resolve, hash) or the search.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveLevel } from './solver.js';
import { generateLevels } from './generator.js';
import { CHALLENGE_PRESETS } from './presets.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'levels', 'street_bbq');
const rows = [];
const time = (name, fn) => {
  const t0 = performance.now();
  const r = fn();
  const ms = performance.now() - t0;
  rows.push({ name, states: r.visitedStates ?? 0, ms: Math.round(ms), perSec: Math.round(((r.visitedStates ?? 0) / ms) * 1000), min: r.minMoves ?? '-' });
};

for (const f of readdirSync(root).filter((f) => f.startsWith('street-')).sort()) {
  const level = JSON.parse(readFileSync(join(root, f), 'utf8'));
  time(level.id, () => solveLevel(level, { useLevelMoves: true }));
}
for (const band of ['E', 'N', 'H']) {
  const { levels } = generateLevels(CHALLENGE_PRESETS[1][band], { count: 3, mode: 'first', seed: 1234, maxCandidates: 80 });
  levels.forEach((l, i) => time(`gen-${band}-${i}`, () => solveLevel(l.level, { useLevelMoves: true })));
}
console.log('level           min   states      ms   states/s');
for (const r of rows) console.log(`${r.name.padEnd(14)} ${String(r.min).padStart(4)} ${String(r.states).padStart(8)} ${String(r.ms).padStart(7)} ${String(r.perSec).padStart(10)}`);
const tot = rows.reduce((a, r) => ({ s: a.s + r.states, ms: a.ms + r.ms }), { s: 0, ms: 0 });
console.log(`total: ${tot.s} states in ${tot.ms} ms (${Math.round((tot.s / tot.ms) * 1000)} states/s)`);
