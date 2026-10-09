// The counter above the board (#116), pure (no DOM, no clock: the caller passes dt): customers on the stools with an
// order each, Út serving the finished trios. Presentation only; it follows the simulation's events and never feeds
// anything back into it.
//
//   const c = createCounter({ foods: { shrimp: 6, beef: 3 }, seats: 2, seed })
//   serve(c, food)      a trio of `food` was matched: the plate flies up to the cart and waits there; Út carries the
//                       plates one by one, each to a seated customer (the one who ordered it first). Every match is
//                       one plate and one delivery: nothing is dropped, a queue makes Út hurry
//   tick(c, dt)         advances every walk / meal / arrival; returns the cues to play ('step', 'clink', 'meow')
//   cheer(c) / win(c) / lose(c)    combos, the level won (everyone waves), lost (Mực steals a shrimp)
//
// Seat phases: empty → arriving → waiting (with an order) → eating → waiting (orders again) … → leaving → empty.
// A customer stays for 2–3 plates (few customers, served many times, owner 2026-10-09), then leaves. A new one arrives
// for a food that is still on the board (`foods` counts items left; serve() takes three off), or for a plate that is
// already waiting at the cart.
import { mulberry32 } from '../../shared/rng.js';

export const T = Object.freeze({ fly: 0.45, pick: 0.2, walk: 0.9, hand: 0.25, eat: 2.4, leave: 1, arrive: 1, back: 0.8, direct: 0.6, cheer: 1.2, steal: 1.6 });
export const CAST = Object.freeze(['guest-1', 'guest-2', 'guest-3', 'guest-4', 'guest-5']); // strangers, never the story's cast
const SEATED = new Set(['waiting', 'eating']);

export function createCounter({ foods = {}, seats = 2, seed = 1, cast = CAST, carry = true } = {}) {
  const c = { rng: mulberry32(seed >>> 0 || 1), left: { ...foods }, cast, carry, seats: [], queue: [], ut: { phase: carry ? 'home' : 'off', t: 0 }, plates: [], cat: { phase: 'idle', t: 0 }, mood: { phase: 'idle', t: 0 }, guests: 0, served: 0 };
  for (let i = 0; i < seats; i++) c.seats.push({ i, phase: 'empty', t: 0, who: null, order: null });
  for (const s of c.seats) seat(c, s, true);
  return c;
}

/** Foods that can still be ordered (on the board or waiting at the cart, not already ordered by someone waiting). */
function orderable(c) {
  const ordered = new Set(c.seats.filter((s) => s.phase === 'waiting' || s.phase === 'arriving').map((s) => s.order));
  const left = [...new Set([...Object.keys(c.left).filter((f) => c.left[f] >= 3), ...c.queue])];
  const fresh = left.filter((f) => !ordered.has(f));
  return fresh.length ? fresh : left;
}

const pick = (c, options) => options[Math.floor(c.rng() * options.length)];

/** Seat a new customer (immediately at the start, else walking in). */
function seat(c, s, now = false) {
  const options = orderable(c);
  if (!options.length) {
    Object.assign(s, { phase: 'empty', t: 0, who: null, order: null });
    return;
  }
  const who = c.cast[(c.guests++ + s.i) % c.cast.length];
  Object.assign(s, { phase: now ? 'waiting' : 'arriving', t: 0, who, order: pick(c, options), ate: 0, appetite: 2 + Math.floor(c.rng() * 2), promised: null });
}

/** A trio of `food` was matched: its plate flies up to the cart. Returns the plate (the renderer knows where it rose from). */
export function serve(c, food) {
  c.left[food] = Math.max(0, (c.left[food] ?? 0) - 3);
  const p = { food, t: 0, dur: T.fly, to: 'cart' };
  c.plates.push(p);
  return p;
}

/** The seated customer a plate of `food` goes to: who ordered it, else who waits, else who is still eating. */
function target(c, food) {
  const free = c.seats.filter((s) => SEATED.has(s.phase) && !s.promised);
  return free.find((s) => s.phase === 'waiting' && s.order === food) ?? free.find((s) => s.phase === 'waiting') ?? free.find((s) => s.phase === 'eating') ?? null;
}

/** Send the plates waiting at the cart: Út takes the first one (he hurries when more wait); without him they fade over. */
function dispatch(c) {
  while (c.queue.length) {
    if (c.carry && c.ut.phase !== 'home') return;
    const to = target(c, c.queue[0]);
    if (!to) return;
    const food = c.queue.shift();
    to.promised = food;
    if (!c.carry) {
      c.plates.push({ food, t: 0, dur: T.direct, to: to.i, from: 'cart' });
      continue;
    }
    const sp = Math.min(2.5, 1 + 0.5 * c.queue.length);
    c.ut = { phase: 'pick', t: 0, seat: to.i, food, d: { pick: T.pick / sp, walk: T.walk / sp, hand: T.hand / sp, back: T.back / sp } };
    return;
  }
}

function give(c, s, food) {
  c.served++;
  Object.assign(s, { phase: 'eating', t: 0, eating: food, promised: null, ate: s.ate + 1 });
}

/** Advance time by dt (s). Returns the sound cues that happened: [{ name, seat? }]. */
export function tick(c, dt) {
  const cues = [];
  for (const p of c.plates) p.t += dt;
  for (const p of c.plates.filter((q) => q.t >= q.dur)) {
    if (p.to === 'cart') c.queue.push(p.food);
    else {
      give(c, c.seats[p.to], p.food);
      cues.push({ name: 'clink', seat: p.to });
    }
  }
  c.plates = c.plates.filter((p) => p.t < p.dur);
  const u = c.ut;
  u.t += dt;
  if (u.phase === 'pick' && u.t >= u.d.pick) Object.assign(u, { phase: 'walk', t: 0 });
  else if (u.phase === 'walk') {
    const step = Math.floor(u.t / 0.3) !== Math.floor((u.t - dt) / 0.3);
    if (step) cues.push({ name: 'step' });
    if (u.t >= u.d.walk) Object.assign(u, { phase: 'hand', t: 0 });
  } else if (u.phase === 'hand' && u.t >= u.d.hand) {
    give(c, c.seats[u.seat], u.food);
    cues.push({ name: 'clink', seat: u.seat });
    Object.assign(u, { phase: 'back', t: 0 });
  } else if (u.phase === 'back' && u.t >= u.d.back) c.ut = { phase: 'home', t: 0 };
  for (const s of c.seats) {
    s.t += dt;
    if (s.phase === 'arriving' && s.t >= T.arrive) Object.assign(s, { phase: 'waiting', t: 0 });
    else if (s.phase === 'eating' && s.t >= T.eat && !s.promised) {
      // still hungry and something left to order: order again, else make room
      const options = s.ate < s.appetite ? orderable(c) : [];
      if (options.length) Object.assign(s, { phase: 'waiting', t: 0, order: pick(c, options) });
      else Object.assign(s, { phase: 'leaving', t: 0 });
    } else if (s.phase === 'leaving' && s.t >= T.leave) seat(c, s);
    else if (s.phase === 'empty' && c.queue.length) seat(c, s); // a plate is waiting: someone comes for it
  }
  dispatch(c);
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
export const busy = (c) => c.plates.length > 0 || c.queue.length > 0 || (c.ut.phase !== 'home' && c.ut.phase !== 'off') || c.cat.phase !== 'idle' || c.mood.phase === 'cheer' || c.seats.some((s) => s.phase === 'arriving' || s.phase === 'eating' || s.phase === 'leaving');
