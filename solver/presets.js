// Generator configs behind share codes and the daily puzzle, by CHALLENGE_VERSION and band.
// Band C (Challenge, 81+) has no v1 preset yet: boards that hard are too large to analyse in a browser.
// NEVER edit a shipped version's configs: old links must keep producing the same board. Add a new version instead.

import { generateLevels } from './generator.js';
import { deriveSeed } from '../shared/rng.js';
import { BANDS, decodeCode, dailySeed, dailyBand, encodeGenerated, encodeDaily } from '../shared/challenge.js';

const BASE = { theme: 'street_bbq', foods: ['shrimp', 'beef', 'corn', 'chicken', 'carrot'], maxStates: 60_000 };

export const CHALLENGE_PRESETS = Object.freeze({
  1: {
    E: { ...BASE, foodCount: [3, 3], grills: [4, 4], emptySlots: [3, 4], minMoves: [3, 10], difficulty: BANDS.E.difficulty },
    N: { ...BASE, foodCount: [3, 4], grills: [4, 5], emptySlots: [2, 4], layers: [0, 1], minMoves: [5, 14], difficulty: BANDS.N.difficulty },
    H: { ...BASE, foodCount: [4, 4], grills: [5, 5], trays: [0, 1], emptySlots: [2, 3], layers: [1, 2], locks: [0, 1], minMoves: [7, 18], difficulty: BANDS.H.difficulty },
    V: { ...BASE, foodCount: [4, 5], grills: [5, 5], trays: [0, 1], emptySlots: [2, 3], layers: [1, 2], locks: [1, 1], minMoves: [9, 22], difficulty: BANDS.V.difficulty },
  },
});

/** Deterministically build the puzzle for a decoded generated/daily code. Returns { level, report } or null. */
export function puzzleFor({ version, band, seed }, { maxCandidates = 400 } = {}) {
  const preset = CHALLENGE_PRESETS[version]?.[band];
  if (!preset) return null;
  const { levels } = generateLevels(preset, { count: 1, mode: 'first', seed: deriveSeed(seed, band), maxCandidates });
  if (!levels.length) return null;
  const { level, report } = levels[0];
  return { level, report };
}

export function puzzleForCode(code) {
  const d = decodeCode(code);
  if (!d) return null;
  if (d.kind === 'generated') return withId(puzzleFor(d), `p-${d.code.toLowerCase()}`, d.code);
  if (d.kind === 'daily') return withId(puzzleFor({ version: d.version, band: dailyBand(d.date), seed: dailySeed(d.date, d.version) }), `daily-${d.date}`, d.code);
  return null;
}

export function dailyPuzzle(dateStr) {
  return puzzleForCode(encodeDaily(dateStr));
}

export function newChallengeCode(band, seed) {
  return encodeGenerated(band, seed);
}

function withId(p, id, code) {
  if (!p) return null;
  p.level.id = id;
  p.level.name = id.startsWith('daily') ? `Daily ${id.slice(6)}` : `Challenge ${code}`;
  p.level.code = code;
  return p;
}
