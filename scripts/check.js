// Fast CI sanity pass: syntax-check every module, and enforce the architecture's import boundaries:
//   shared/ and solver/ must not import three, DOM-only code, client/ or worker/, and must not use Math.random.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/content.js';

let failed = 0, n = 0;
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
};
['shared', 'solver', 'client', 'worker', 'scripts', 'tests'].forEach((d) => walk(join(ROOT, d)));

for (const p of files) {
  n++;
  try {
    execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' });
  } catch (e) {
    failed++;
    console.log(`SYNTAX ${relative(ROOT, p)}\n${e.stderr}`);
  }
  const rel = relative(ROOT, p).replace(/\\/g, '/');
  if (rel.startsWith('shared/') || rel.startsWith('solver/')) {
    const src = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // code only
    const rules = [
      [/from ['"]three/, 'imports three.js'],
      [/from ['"][./]*client\//, 'imports client code'],
      [/from ['"][./]*worker\//, 'imports worker code'],
      [/\b(document|window|localStorage|indexedDB)\./, 'touches the DOM'],
      [/Math\.random\(/, 'uses Math.random (use shared/rng.js)'],
      [/Date\.now\(|performance\.now\(/, 'reads the clock', /(solver\/(solver|benchmark)|shared\/challenge)\.js$/], // timing stats; todayUTC()
    ];
    for (const [re, what, allow] of rules) {
      if (allow && allow.test(rel)) continue;
      if (re.test(src)) {
        failed++;
        console.log(`BOUNDARY ${rel} ${what}`);
      }
    }
  }
}
console.log(`${n - failed}/${n} files OK`);
process.exit(failed ? 1 : 0);
