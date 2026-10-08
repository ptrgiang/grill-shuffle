// UI variants for the owner to choose from (CONTRIBUTING.md step 0, #79): captures every page once per variant
// (`variant=<v>` added to its query; the client reads it through client/ui/variant.js), lays the variants of each page
// side by side on one numbered sheet, pushes the sheets to the `pr-shots` branch (never merged) under
// issues/<n>/<sha>/ and posts or updates ONE comment on the issue, between
//   <!-- variant-shots:start --> ... <!-- variant-shots:end -->
//
//   npm run variant-shots -- --issue 84 --pages "/levels@390x844m,/@1280x800"
//   npm run variant-shots -- --issue 84 --variants 5 --labels "1:Road,2:Scroll,3:Postcards,4:Map,5:Notebook"
//   npm run variant-shots -- --issue 84 --no-publish          (local only: shots/variants/84/)
//   npm run variant-shots -- --issue 89 --set font ...         one issue, several decisions: `v-font=<v>` in the query
//                                                              (client: variant('font')), its own comment per set
//
// Page specs as in pr-shots (<path>@<W>x<H>[m][+select][+unlock][+tap=<css>]). Captures this working tree only.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome } from './lib/browser.js';
import { ROOT, parseArgs } from './lib/content.js';
import { parsePage, addQuery, capture, publish, withSection, git, gh } from './lib/shots.js';

const tagOf = (set) => (set ? `variant-shots:${set}` : 'variant-shots');
/** The query parameter of a set: `variant`, or `v-<set>`. */
export const paramOf = (set) => (set ? `v-${set}` : 'variant');

/** "1:Road,2:Long scroll" -> { 1: 'Road', 2: 'Long scroll' } */
export function parseLabels(s) {
  const out = {};
  for (const part of String(s ?? '').split(',')) {
    const m = /^\s*(\d+)\s*:\s*(.+?)\s*$/.exec(part);
    if (m) out[+m[1]] = m[2];
  }
  return out;
}

/** The page spec of variant `v`: same viewport and flags, `variant=<v>` (or `v-<set>=<v>`) in the query, `-v<v>` in the file name. */
export function variantPage(page, v, set = null) {
  return { ...page, name: `${page.name}-v${v}`, url: addQuery(page.url, `${paramOf(set)}=${v}`), variant: v };
}

/** The comment text: one sheet per page, the labels, and how to answer. */
export function commentBody({ issue, sha, branch, count, labels, sheets, errors = 0, set = null }) {
  const lines = [
    `## ${count} variants for #${issue}${set ? `: ${set}` : ''}`,
    `Branch \`${branch}@${sha}\`, captured by \`npm run variant-shots\` (headless Chrome, time frozen, quality high). Left to right: variant 1 to ${count}.`,
    '',
  ];
  const named = Array.from({ length: count }, (_, i) => i + 1).filter((v) => labels[v]);
  if (named.length) lines.push(named.map((v) => `**${v}** ${labels[v]}`).join(' · '), '');
  for (const s of sheets) lines.push(`**${s.spec}**`, '', `![${s.name}](${s.url})`, '');
  if (errors) lines.push(`Page errors during capture: ${errors} (see the run log).`, '');
  lines.push(`**Reply with the variant number** (e.g. \`3\`, or \`3 with the colours of 1\`). The PR builds only that one.`);
  return lines.join('\n');
}

/** Variants of one page side by side, numbered, rendered in headless Chrome. */
async function sheet(files, out, labels) {
  const { page, close } = await launchChrome({ width: 800, height: 600, life: 3 * 60_000 });
  try {
    const png = await page.evaluate(
      async (list, names) => {
        const load = (b) => new Promise((res, rej) => Object.assign(new Image(), { onload() { res(this); }, onerror: rej, src: `data:image/png;base64,${b}` }));
        const imgs = await Promise.all(list.map(load));
        const s = imgs[0].width >= 1000 ? 0.5 : 1; // desktop captures at half size
        const gap = 24, head = 48;
        const W = imgs.reduce((w, i) => w + Math.round(i.width * s), 0) + gap * (imgs.length + 1);
        const H = Math.max(...imgs.map((i) => Math.round(i.height * s))) + head + gap;
        const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
        const g = c.getContext('2d');
        g.fillStyle = '#16101a';
        g.fillRect(0, 0, W, H);
        g.textBaseline = 'middle';
        let x = gap;
        imgs.forEach((img, k) => {
          g.fillStyle = '#ffb347';
          g.font = '700 26px system-ui, sans-serif';
          g.fillText(String(k + 1), x, head / 2);
          if (names[k + 1]) {
            g.fillStyle = '#d9c2ad';
            g.font = '600 18px system-ui, sans-serif';
            g.fillText(names[k + 1], x + 26, head / 2);
          }
          g.drawImage(img, x, head, img.width * s, img.height * s);
          x += Math.round(img.width * s) + gap;
        });
        return c.toDataURL('image/png').split(',')[1];
      },
      files.map((f) => readFileSync(f).toString('base64')),
      labels,
    );
    writeFileSync(out, Buffer.from(png, 'base64'));
  } finally {
    await close();
  }
}

/** The id of this issue's variant comment, or null. */
function findComment(repo, issue, tag) {
  const all = JSON.parse(gh('api', `repos/${repo}/issues/${issue}/comments`, '--paginate'));
  return all.find((c) => c.body?.includes(`<!-- ${tag}:start -->`))?.id ?? null;
}

async function main() {
  const args = parseArgs();
  const issue = args.issue;
  if (!issue || issue === true) throw new Error('--issue <n> is required');
  const count = +(args.variants ?? 5);
  if (!(count >= 2 && count <= 9)) throw new Error('--variants must be 2..9');
  if (!args.pages || args.pages === true) throw new Error('--pages "<spec>,..." is required (the pages that show the change)');
  const pages = String(args.pages).split(',').map(parsePage);
  const labels = parseLabels(args.labels);
  const set = args.set && args.set !== true ? String(args.set).replace(/[^a-z0-9-]/gi, '') : null;
  const tag = tagOf(set);
  const publishIt = !args['no-publish'];
  const sha = git(ROOT, 'rev-parse', '--short', 'HEAD');
  const branch = git(ROOT, 'rev-parse', '--abbrev-ref', 'HEAD');
  if (git(ROOT, 'status', '--porcelain', '--untracked-files=no')) console.log('note: uncommitted changes are in the captures');

  const outDir = join(ROOT, 'shots', 'variants', String(issue), ...(set ? [set] : []));
  rmSync(outDir, { recursive: true, force: true });
  const shots = pages.flatMap((p) => Array.from({ length: count }, (_, i) => variantPage(p, i + 1, set)));
  const errors = await capture(ROOT, shots, join(outDir, 'raw'), 'variant');
  const sheets = [];
  for (const p of pages) {
    const out = join(outDir, `${p.name}.png`);
    await sheet(Array.from({ length: count }, (_, i) => join(outDir, 'raw', `${p.name}-v${i + 1}.png`)), out, labels);
    sheets.push({ spec: p.spec, name: p.name, file: out });
    console.log(`sheet ${p.spec} -> ${out}`);
  }
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  if (!publishIt) return;

  const repo = gh('repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner');
  const dir = `issues/${issue}/${sha}${set ? `/${set}` : ''}`;
  publish(sheets.map((s) => ({ src: s.file, name: `${s.name}.png` })), dir, `issue-${issue}: ${count} variants${set ? ` (${set})` : ''} at ${sha}`);
  for (const s of sheets) s.url = `https://github.com/${repo}/blob/pr-shots/${dir}/${s.name}.png?raw=true`;
  const text = commentBody({ issue, sha, branch, count, labels, sheets, errors: errors.length, set });
  const file = join(outDir, 'comment.md');
  const id = findComment(repo, issue, tag);
  if (id) {
    const old = JSON.parse(gh('api', `repos/${repo}/issues/comments/${id}`)).body;
    writeFileSync(file, withSection(old, text, tag));
    gh('api', '-X', 'PATCH', `repos/${repo}/issues/comments/${id}`, '-F', `body=@${file}`);
    console.log(`issue #${issue}: variant comment updated`);
  } else {
    writeFileSync(file, withSection('', text, tag).trimStart());
    gh('issue', 'comment', String(issue), '--body-file', file);
    console.log(`issue #${issue}: variant comment posted`);
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/variant-shots.js')) await main();
