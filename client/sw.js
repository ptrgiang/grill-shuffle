// Grill Shuffle service worker: the whole game offline. scripts/build-sw.js fills in VERSION and PRECACHE (every
// file of the build the game needs) and writes it to dist/sw.js. Not used in `vite` dev.
//
//   navigations   the cached app shell ('/', the SPA's index.html), network only if it is missing
//   build files   cache first (hashed names: a file never changes under the same URL)
//   /api/*        not touched: the network, or the client's offline handling (storage/sync.js)
//   anything else not touched (sandbox pages, og.png, robots.txt...)
//
// Updates: a new build means a new VERSION, so the browser installs this worker again. It precaches the new files
// into a new cache and waits; the page asks it to take over ('skip-waiting', client/ui/update.js), and the old
// caches are deleted when it activates.
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const PREFIX = 'grill-shuffle-';
const CACHE = PREFIX + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(PRECACHE.map(async (url) => cache.put(url, await fetchBuildFile(url))));
    })(),
  );
});

// Right after a deploy some Cloudflare edges still answer a new file with the SPA fallback (index.html, 200). Such a
// response cached as a font or a script would stay wrong until the next deploy, so only the shell '/' may be HTML:
// retry a few times, then fail the install (the browser tries again on a later visit; the old worker keeps serving).
async function fetchBuildFile(url, tries = 3) {
  for (let i = 1; ; i++) {
    const res = await fetch(new Request(url, { cache: 'reload' })).catch(() => null);
    const html = (res?.headers.get('content-type') ?? '').startsWith('text/html');
    if (res?.ok && !res.redirected && html === (url === '/')) return res;
    if (i >= tries) throw new Error(`precache ${url}: ${res ? `${res.status} ${res.headers.get('content-type')}` : 'network error'}`);
    await new Promise((r) => setTimeout(r, 2000 * i));
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'skip-waiting') self.skipWaiting();
});

const precached = new Set(PRECACHE);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/sandbox')) return;
  if (req.mode === 'navigate') {
    event.respondWith(fromCache('/', req));
    return;
  }
  if (precached.has(url.pathname)) event.respondWith(fromCache(url.pathname, req));
});

async function fromCache(key, req) {
  const cache = await caches.open(CACHE);
  return (await cache.match(key)) ?? fetch(req);
}
