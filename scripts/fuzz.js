// Long fuzz run over the shared simulation:  npm run fuzz -- [cases=20000] [startSeed=1]
import { fuzzCase, boosterUses } from '../tests/helpers/fuzz.js';

const cases = Number(process.argv[2] ?? 20000);
const start = Number(process.argv[3] ?? 1);
const t0 = Date.now();
let steps = 0;
for (let i = 0; i < cases; i++) {
  try {
    steps += fuzzCase(start + i);
  } catch (e) {
    console.error(`FAIL seed ${start + i}\n${e.message}`);
    process.exit(1);
  }
  if ((i + 1) % 2000 === 0) console.log(`${i + 1} cases, ${steps} steps, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
console.log(`OK: ${cases} cases, ${steps} steps, all invariants held (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
console.log(`booster uses: ${Object.entries(boosterUses).map(([id, n]) => `${id} ${n}`).join(', ')}`);
