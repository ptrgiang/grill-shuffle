// Off-main-thread solver work: building generated / daily puzzles from their codes, and hints.
import { puzzleForCode } from '../../solver/presets.js';
import { solveFromState } from '../../solver/search.js';
import { deserializeState } from '../../shared/state.js';

self.onmessage = (e) => {
  const { id, type } = e.data;
  try {
    if (type === 'puzzle') {
      const p = puzzleForCode(e.data.code);
      self.postMessage({ id, ok: !!p, level: p?.level ?? null });
    } else if (type === 'hint') {
      const r = solveFromState(deserializeState(e.data.state), { maxStates: 150_000 });
      self.postMessage({ id, ok: true, solvable: r.solvable, move: r.moves?.[0] ?? null, remaining: r.moves?.length ?? null });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message ?? err) });
  }
};
