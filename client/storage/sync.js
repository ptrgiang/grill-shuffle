// Cloud sync with the Worker API. Best effort: a 404 in `vite` dev without the Worker, or any error just means
// "local only". Never awaited on the play path.
//
// Offline: what could not be sent waits in IndexedDB and goes out on the next `online` event or app start
// (flushOutbox): 'syncPending' (the progress push) and 'outbox' (daily / challenge results; the server re-plays
// them, accepts past dates, and keeps each player's best).
import { get, set, playerId, mergeProgress, markStorySeen } from './db.js';

const OUTBOX_MAX = 50;
const OUTBOX_MAX_AGE = 14 * 24 * 3600_000; // a result that still fails after two weeks is dropped

async function api(path, { method = 'GET', body, timeout } = {}) {
  const pid = await playerId();
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', 'x-player-id': pid },
    body: body ? JSON.stringify(body) : undefined,
    signal: timeout && AbortSignal.timeout ? AbortSignal.timeout(timeout) : undefined,
  });
  if (!res.ok) throw Object.assign(new Error(`${method} ${path}: ${res.status}`), { status: res.status });
  return res.json();
}

// no answer at all (offline, timeout) or a server hiccup: worth retrying later. A 4xx is final.
const retryable = (e) => !e?.status || e.status >= 500;

let pushTimer = null;

/** Pull cloud progress (and the seen story beats) and merge it into the local save. Returns the merged progress. */
export async function pullProgress() {
  try {
    const { progress, story } = await api('/api/progress');
    const merged = mergeProgress(await get('progress', {}), progress ?? {});
    await set('progress', merged);
    if (Array.isArray(story) && story.length) await markStorySeen(story.filter((id) => typeof id === 'string'));
    return merged;
  } catch {
    return null;
  }
}

async function pushProgress() {
  try {
    await api('/api/progress', { method: 'POST', body: { progress: await get('progress', {}), story: await get('storySeen', []) } });
    await set('syncPending', false);
    return true;
  } catch (e) {
    await set('syncPending', retryable(e));
    return false;
  }
}

/** Push local progress soon (debounced). */
export function pushProgressSoon() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushProgress, 1500);
}

const resultPath = (kind, key) => (kind === 'daily' ? '/api/daily/result' : `/api/challenge/${encodeURIComponent(key)}/result`);

/**
 * Submit a daily / challenge result (server re-plays the moves before storing it). Returns the server's answer,
 * `{ queued: true }` when it could not be sent and waits in the outbox, or null when the server rejected it.
 */
export async function submitResult(kind, key, payload) {
  try {
    return await api(resultPath(kind, key), { method: 'POST', body: payload, timeout: 20_000 });
  } catch (e) {
    if (!retryable(e)) return null;
    const box = await get('outbox', []);
    box.push({ kind, key, payload, at: Date.now() });
    await set('outbox', box.slice(-OUTBOX_MAX));
    return { queued: true };
  }
}

let flushing = null;
/** Send whatever waited while offline. Safe to call any time; one flush at a time. */
export function flushOutbox() {
  flushing ??= (async () => {
    try {
      if (await get('syncPending', false)) await pushProgress();
      const box = await get('outbox', []);
      const left = [];
      for (const item of box) {
        if (!(Date.now() - item.at < OUTBOX_MAX_AGE)) continue;
        try {
          await api(resultPath(item.kind, item.key), { method: 'POST', body: item.payload, timeout: 20_000 });
        } catch (e) {
          if (retryable(e)) left.push(item);
        }
      }
      // results queued while this flush ran are appended after the ones it read
      const now = await get('outbox', []);
      await set('outbox', [...left, ...now.slice(box.length)]);
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/** Today's daily info (+ the pre-built level when the Cron made it). Short timeout: generating locally is the fallback. */
export async function fetchDaily(date, { timeout = 2500 } = {}) {
  try {
    return await api(`/api/daily?date=${encodeURIComponent(date)}`, { timeout });
  } catch {
    return null;
  }
}

export async function fetchChallengeStats(code) {
  try {
    return await api(`/api/challenge/${encodeURIComponent(code)}`);
  } catch {
    return null;
  }
}
