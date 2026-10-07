// Writes dist/sw.js from client/sw.js after `vite build`: the precache list (every build file the game needs) and a
// version hashed from their contents, so each deploy that changes anything installs a new service worker.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { ROOT } from './lib/content.js';

const DIST = join(ROOT, 'dist');
// not part of the offline game: dev / visual-check pages, crawler and share-preview files, the worker itself
const SKIP = [/^\/sandbox\//, /^\/assets\/sandbox\//, /^\/og\.png$/, /^\/robots\.txt$/, /^\/sitemap\.xml$/, /^\/sw\.js$/, /\.map$/, /^\/fonts\/OFL\.txt$/];

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

const files = walk(DIST)
  .map((f) => ({ file: f, url: '/' + relative(DIST, f).split(sep).join('/') }))
  .filter(({ url }) => !SKIP.some((re) => re.test(url)))
  .sort((a, b) => a.url.localeCompare(b.url));

const hash = createHash('sha256');
for (const { file, url } of files) hash.update(url).update(readFileSync(file));
const version = hash.digest('hex').slice(0, 12);

// index.html is the SPA shell, cached as '/' (Workers Static Assets redirects /index.html to /)
const precache = files.map(({ url }) => (url === '/index.html' ? '/' : url));
if (!precache.includes('/')) throw new Error('build-sw: dist/index.html missing, run vite build first');

const src = readFileSync(join(ROOT, 'client', 'sw.js'), 'utf8')
  .replace("'__VERSION__'", JSON.stringify(version))
  .replace('__PRECACHE__', JSON.stringify(precache));
writeFileSync(join(DIST, 'sw.js'), src);
const kb = files.reduce((n, { file }) => n + statSync(file).size, 0) / 1024;
console.log(`dist/sw.js: version ${version}, ${precache.length} files precached (${Math.round(kb)} KB)`);
