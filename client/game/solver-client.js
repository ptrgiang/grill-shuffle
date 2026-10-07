// Promise wrapper around solver.worker.js. Falls back to running on the main thread if workers are unavailable.
import { serializeState } from '../../shared/state.js';

let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./solver.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (p) {
        pending.delete(e.data.id);
        p(e.data);
      }
    };
  } catch {
    worker = false;
  }
  return worker;
}

function call(msg) {
  const w = getWorker();
  if (!w) return fallback(msg);
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    w.postMessage({ ...msg, id });
  });
}

async function fallback(msg) {
  if (msg.type === 'puzzle') {
    const { puzzleForCode } = await import('../../solver/presets.js');
    const p = puzzleForCode(msg.code);
    return { ok: !!p, level: p?.level ?? null };
  }
  const { solveFromState } = await import('../../solver/search.js');
  const { deserializeState } = await import('../../shared/state.js');
  const r = solveFromState(deserializeState(msg.state));
  return { ok: true, solvable: r.solvable, move: r.moves?.[0] ?? null };
}

/** The level behind a generated / daily share code (deterministic). */
export const puzzleFromCode = (code) => call({ type: 'puzzle', code });
/** First move of a shortest win from this state. */
export const hintFor = (state) => call({ type: 'hint', state: serializeState(state) });
