// Cloud sync with the Worker API. Best effort: offline, a 404 in `vite` dev without the Worker, or any error just
// means "local only". Never awaited on the play path.
import { get, set, playerId, mergeProgress } from './db.js';

async function api(path, { method = 'GET', body } = {}) {
  const pid = await playerId();
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', 'x-player-id': pid },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
  return res.json();
}

let pushTimer = null;

/** Pull cloud progress and merge it into the local save. */
export async function pullProgress() {
  try {
    const { progress } = await api('/api/progress');
    const merged = mergeProgress(await get('progress', {}), progress ?? {});
    await set('progress', merged);
    return merged;
  } catch {
    return null;
  }
}

/** Push local progress soon (debounced). */
export function pushProgressSoon() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      await api('/api/progress', { method: 'POST', body: { progress: await get('progress', {}) } });
    } catch {}
  }, 1500);
}

/** Submit a daily / challenge result (server re-plays the moves before storing it). */
export async function submitResult(kind, key, payload) {
  try {
    const path = kind === 'daily' ? '/api/daily/result' : `/api/challenge/${encodeURIComponent(key)}/result`;
    return await api(path, { method: 'POST', body: payload });
  } catch {
    return null;
  }
}

export async function fetchDaily() {
  try {
    return await api('/api/daily');
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
