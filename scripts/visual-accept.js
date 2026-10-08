// Take the visual baselines from CI: downloads the `visual` artifact of a CI run (default: the latest `visual` run of
// the current branch) and copies its captures into tests/visual/. Review the diff, then commit.
//   npm run visual:accept [-- <run-id>]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, copyFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './lib/content.js';

const gh = (...args) => execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const runId = process.argv[2] ?? gh('run', 'list', '--workflow', 'visual.yml', '--branch', branch, '-L', '1', '--json', 'databaseId', '--jq', '.[0].databaseId');
if (!runId) throw new Error(`no visual run on ${branch}: push first, or pass a run id`);
const dir = mkdtempSync(join(tmpdir(), 'gs-visual-'));
try {
  gh('run', 'download', String(runId), '-n', 'visual', '-D', dir);
  const src = existsSync(join(dir, 'actual')) ? join(dir, 'actual') : dir;
  const files = readdirSync(src).filter((f) => f.endsWith('.png'));
  if (!files.length) throw new Error(`run ${runId}: the visual artifact has no captures`);
  const dest = join(ROOT, 'tests', 'visual');
  mkdirSync(dest, { recursive: true });
  for (const f of files) copyFileSync(join(src, f), join(dest, f));
  console.log(`run ${runId}: ${files.length} baseline(s) -> tests/visual/\n${files.join('\n')}\nReview with git diff, then commit.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
