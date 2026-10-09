// The counter above the board (#116), pure (no DOM, no clock: the caller passes dt): customers on the stools with an
// order each, Út serving the finished trios. Presentation only; it follows the simulation's events and never feeds
// anything back into it.
//
//   const c = createCounter({ foods: { shrimp: 6, beef: 3 }, seats: 3, seed })
//   serve(c, food)      a trio of `food` was matched: Út carries it to whoever ordered it (or the next waiting
//                       customer); if Út is busy the plate flies straight to them
//   tick(c, dt)         advances every walk / meal / arrival; returns the cues to play ('step', 'clink', 'meow')
//   cheer(c) / win(c) / lose(c)    combos, the level won (everyone waves), lost (Mực steals a shrimp)
//
// Seat phases: empty → arriving → waiting (with an order) → eating → leaving → empty. A new customer arrives only for
// a food that is still on the board (`foods` counts items left; serve() takes three off).
import { mulberry32 } from '../../shared/rng.js';

export const T = Object.freeze({ fly: 0.45, walk: 0.9, hand: 0.25, eat: 2.4, leave: 1, arrive: 1, back: 0.8, direct: 0.6, cheer: 1.2, steal: 1.6 });
export const CAST = Object.freeze(['guest-1', 'guest-2', 'guest-3', 'guest-4', 'guest-5']); // strangers, never the story's cast

export function createCounter({ foods = {}, seats = 3, seed = 1, cast = CAST, carry = true } = {}) {
  const c = { rng: mulberry32(seed >>> 0 || 1), left: { ...foods }, cast, seats: [], ut: { phase: carry ? 'home' : 'off', t: 0 }, plates: [], cat: { phase: 'idle', t: 0 }, mood: { phase: 'idle', t: 0 }, guests: 0 };
  for (let i = 0; i < seats; i++) c.seats.push({ i, phase: 'empty', t: 0, who: null, order: null });
  for (const s of c.seats) seat(c, s, true);
  return c;
}

/** Foods that can still be ordered (on the board, not already ordered by someone waiting). */
function orderable(c) {
  const ordered = new Set(c.seats.filter((s) => s.phase === 'waiting' || s.phase === 'arriving').map((s) => s.order));
  const left = Object.keys(c.left).filter((f) => c.left[f] >= 3);
  const fresh = left.filter((f) => !ordered.has(f));
  return fresh.length ? fresh : left;
}

/** Seat a new customer (immediately at the start, else walking in). */
function seat(c, s, now = false) {
  const options = orderable(c);
  if (!options.length) {
    Object.assign(s, { phase: 'empty', t: 0, who: null, order: null });
    return;
  }
  const order = options[Math.floor(c.rng() * options.length)];
  const who = c.cast[(c.guests++ + s.i) % c.cast.length];
  Object.assign(s, { phase: now ? 'waiting' : 'arriving', t: 0, who, order });
}

/** A trio of `food` was matched. Returns the seat it goes to (or null: nobody waiting, a passer-by takes it). */
export function serve(c, food) {
  c.left[food] = Math.max(0, (c.left[food] ?? 0) - 3);
  const waiting = c.seats.filter((s) => s.phase === 'waiting' && !s.promised);
  const to = waiting.find((s) => s.order === food) ?? waiting[0] ?? null;
  if (!to) return null;
  to.promised = food;
  if (c.ut.phase === 'home') {
    // the plate flies up to Út, who carries it to the stool
    c.ut = { phase: 'fetch', t: 0, seat: to.i, food };
    c.plates.push({ food, t: 0, dur: T.fly, to: 'ut' });
  } else c.plates.push({ food, t: 0, dur: T.direct, to: to.i }); // Út is busy: straight to them
  return to;
}

function give(c, s) {
  Object.assign(s, { phase: 'eating', t: 0, eating: s.promised, promised: null });
}

/** Advance time by dt (s). Returns the sound cues that happened: [{ name, seat? }]. */
export function tick(c, dt) {
  const cues = [];
  for (const p of c.plates) p.t += dt;
  for (const p of c.plates.filter((q) => q.t >= q.dur)) {
    if (p.to !== 'ut') {
      give(c, c.seats[p.to]);
      cues.push({ name: 'clink', seat: p.to });
    }
  }
  c.plates = c.plates.filter((p) => p.t < p.dur);
  const u = c.ut;
  u.t += dt;
  if (u.phase === 'fetch' && u.t >= T.fly) Object.assign(u, { phase: 'walk', t: 0 });
  else if (u.phase === 'walk') {
    const step = Math.floor(u.t / 0.3) !== Math.floor((u.t - dt) / 0.3);
    if (step) cues.push({ name: 'step' });
    if (u.t >= T.walk) Object.assign(u, { phase: 'hand', t: 0 });
  } else if (u.phase === 'hand' && u.t >= T.hand) {
    give(c, c.seats[u.seat]);
    cues.push({ name: 'clink', seat: u.seat });
    Object.assign(u, { phase: 'back', t: 0 });
  } else if (u.phase === 'back' && u.t >= T.back) c.ut = { phase: 'home', t: 0 };
  for (const s of c.seats) {
    s.t += dt;
    if (s.phase === 'arriving' && s.t >= T.arrive) Object.assign(s, { phase: 'waiting', t: 0 });
    else if (s.phase === 'eating' && s.t >= T.eat) Object.assign(s, { phase: 'leaving', t: 0 });
    else if (s.phase === 'leaving' && s.t >= T.leave) seat(c, s);
  }
  for (const k of ['cat', 'mood']) {
    c[k].t += dt;
    if (c[k].phase !== 'idle' && c[k].phase !== 'won' && c[k].t >= (c[k].phase === 'steal' ? T.steal : T.cheer)) c[k] = { phase: 'idle', t: 0 };
  }
  return cues;
}

export const cheer = (c) => (c.mood = { phase: 'cheer', t: 0 });
export const win = (c) => (c.mood = { phase: 'won', t: 0 });
export function lose(c) {
  c.cat = { phase: 'steal', t: 0 };
  return [{ name: 'meow' }];
}

/** Anything moving (the renderer keeps drawing while true, then rests). */
export const busy = (c) => c.plates.length > 0 || (c.ut.phase !== 'home' && c.ut.phase !== 'off') || c.cat.phase !== 'idle' || c.mood.phase === 'cheer' || c.seats.some((s) => s.phase === 'arriving' || s.phase === 'eating' || s.phase === 'leaving');
