// Local save in IndexedDB: a tiny key-value store. Writes are immediate and local; cloud sync (sync.js) runs after,
// asynchronously, and never blocks play. Falls back to memory when IndexedDB is unavailable (private mode etc.).
//
// keys: 'progress'  { [levelId]: { stars, bestMoves, bestScore, at } }
//       'settings'  { muted, sfxVolume, ambienceVolume, haptics, reducedMotion }
//       'current'   last story level id
//       'daily:<date>', 'challenge:<code>'  { stars, moves, score, at }
//       'dailyStreak'  { last: date, count, best }   consecutive UTC days with a daily win (client/game/daily.js)
//       'boosters'  { tongs, fan }
//       'dailyLevel:<date>'  the daily board once built (server or local), so it opens instantly and offline
//       'syncPending'  true while a progress push waits for the network; 'outbox'  [{ kind, key, payload, at }]
//                   results not sent yet (storage/sync.js flushOutbox)
//       'storySeen' [ids]  story beats played and keepsakes given (client/game/story.js); synced with the progress
//       'meta'      { saveVersion, playerId }
import { SAVE_VERSION } from '../../shared/version.js';
import { addSeen } from '../game/story.js';

const DB = 'grill-shuffle';
const STORE = 'kv';
const memory = new Map();
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      if (!('indexedDB' in globalThis)) return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

export async function get(key, fallback = null) {
  const db = await open();
  if (!db) return memory.has(key) ? memory.get(key) : fallback;
  return new Promise((resolve) => {
    try {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result === undefined ? fallback : r.result);
      r.onerror = () => resolve(fallback);
    } catch {
      resolve(fallback);
    }
  });
}

export async function set(key, value) {
  memory.set(key, value);
  const db = await open();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Anonymous player id (no account): created once, kept in localStorage + IndexedDB. */
export async function playerId() {
  let id = null;
  try {
    id = localStorage.getItem('gs.pid');
  } catch {}
  if (!id) {
    const meta = await get('meta', {});
    id = meta.playerId;
  }
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replace(/[^a-z0-9-]/gi, '');
  }
  try {
    localStorage.setItem('gs.pid', id);
  } catch {}
  await set('meta', { saveVersion: SAVE_VERSION, playerId: id });
  return id;
}

/** Record a win: keeps the best stars / fewest moves / best score. Returns { record, improved }. */
export async function recordResult(levelId, { stars, moves, score }) {
  const progress = await get('progress', {});
  const old = progress[levelId];
  const rec = {
    stars: Math.max(old?.stars ?? 0, stars),
    bestMoves: Math.min(old?.bestMoves ?? Infinity, moves),
    bestScore: Math.max(old?.bestScore ?? 0, score),
    at: Date.now(),
  };
  progress[levelId] = rec;
  await set('progress', progress);
  return { record: rec, improved: !old || rec.stars > old.stars || rec.bestMoves < old.bestMoves };
}

/** Mark story beats / keepsakes as seen (once they were shown). Returns the new seen list. */
export async function markStorySeen(ids) {
  const seen = addSeen(await get('storySeen', []), ids);
  await set('storySeen', seen);
  return seen;
}

/** Merge progress from elsewhere (cloud): per level, the best of both. */
export function mergeProgress(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, r] of Object.entries(b)) {
    const l = out[id];
    out[id] = l
      ? { stars: Math.max(l.stars ?? 0, r.stars ?? 0), bestMoves: Math.min(l.bestMoves ?? Infinity, r.bestMoves ?? Infinity), bestScore: Math.max(l.bestScore ?? 0, r.bestScore ?? 0), at: Math.max(l.at ?? 0, r.at ?? 0) }
      : r;
  }
  return out;
}
