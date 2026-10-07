// Share codes and daily seeds. Pure and offline: a code fully determines its puzzle (no server lookup), so a link
// keeps working forever as long as the CHALLENGE_VERSION it names is still supported.
//
// Code = <kind><version><payload><check>, Crockford base32 (no I, L, O, U), case-insensitive.
//   G1 <band> <seed:5>   generated puzzle: band = difficulty band (E N H V C), seed = 25 bits
//   S1 <index:2>         story level by index in the level list
//   D1 <day:3>           daily puzzle: days since 2026-01-01
// The check character catches typos.  e.g.  /p/G1N3K7QX

import { cyrb53, seedFromString } from './rng.js';
import { CHALLENGE_VERSION } from './version.js';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VALUE = Object.fromEntries([...ALPHABET].map((c, i) => [c, i]));
const DAY0 = Date.UTC(2026, 0, 1);

export const BANDS = Object.freeze({
  E: { id: 'E', name: 'Easy', difficulty: [8, 22] },
  N: { id: 'N', name: 'Normal', difficulty: [21, 40] },
  H: { id: 'H', name: 'Hard', difficulty: [41, 60] },
  V: { id: 'V', name: 'Very Hard', difficulty: [61, 80] },
  C: { id: 'C', name: 'Challenge', difficulty: [81, 100] },
});

function toB32(n, len) {
  let s = '';
  for (let i = 0; i < len; i++) {
    s = ALPHABET[n % 32] + s;
    n = Math.floor(n / 32);
  }
  return s;
}
function fromB32(s) {
  let n = 0;
  for (const c of s) {
    const v = VALUE[c];
    if (v === undefined) return NaN;
    n = n * 32 + v;
  }
  return n;
}
const check = (body) => ALPHABET[cyrb53(body) % 32];

/** Normalise user input: upper case, Crockford's confusables (O->0, I/L->1), no separators. */
export const normalizeCode = (s) => String(s).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');

export function encodeGenerated(band, seed, version = CHALLENGE_VERSION) {
  if (!BANDS[band]) throw new Error(`unknown band ${band}`);
  const body = `G${toB32(version, 1)}${band}${toB32(seed % 32 ** 5, 5)}`;
  return body + check(body);
}
export function encodeStory(index, version = CHALLENGE_VERSION) {
  const body = `S${toB32(version, 1)}${toB32(index, 2)}`;
  return body + check(body);
}
export function encodeDaily(dateStr, version = CHALLENGE_VERSION) {
  const body = `D${toB32(version, 1)}${toB32(dayNumber(dateStr), 3)}`;
  return body + check(body);
}

/** -> { kind: 'generated'|'story'|'daily', version, ... } or null when malformed / bad check character. */
export function decodeCode(input) {
  const code = normalizeCode(input);
  if (code.length < 4) return null;
  const body = code.slice(0, -1);
  if (check(body) !== code.at(-1)) return null;
  const kind = body[0];
  const version = fromB32(body[1]);
  const payload = body.slice(2);
  if (kind === 'G' && payload.length === 6 && BANDS[payload[0]]) {
    const seed = fromB32(payload.slice(1));
    return Number.isFinite(seed) ? { kind: 'generated', version, band: payload[0], seed, code } : null;
  }
  if (kind === 'S' && payload.length === 2) {
    const index = fromB32(payload);
    return Number.isFinite(index) ? { kind: 'story', version, index, code } : null;
  }
  if (kind === 'D' && payload.length === 3) {
    const day = fromB32(payload);
    return Number.isFinite(day) ? { kind: 'daily', version, day, date: dateOfDay(day), code } : null;
  }
  return null;
}

export function dayNumber(dateStr) {
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  if (!Number.isFinite(t)) throw new Error(`bad date ${dateStr}`);
  return Math.round((t - DAY0) / 86_400_000);
}
export const dateOfDay = (day) => new Date(DAY0 + day * 86_400_000).toISOString().slice(0, 10);
/** Today's UTC date, YYYY-MM-DD (the daily puzzle rolls over at 00:00 UTC for everybody). */
export const todayUTC = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

/** The daily puzzle's seed: hash(date + challengeVersion). */
export const dailySeed = (dateStr, version = CHALLENGE_VERSION) => seedFromString(`daily:${dateStr}:v${version}`) % 32 ** 5;
/** Weekday decides the daily band: lighter early in the week, harder at the weekend. */
export function dailyBand(dateStr) {
  const wd = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return wd === 0 || wd === 6 ? 'H' : wd === 1 ? 'E' : 'N';
}
