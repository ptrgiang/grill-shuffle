// Move model. Every player action is a compact, deterministic command:
//   { type: 'move', from: { grill, slot }, to: { grill, slot } }
// Same command format for gameplay, solver, undo, replay, challenge sharing and debugging.
//
// Compact string form (replays, share links, D1): "m<fromGrill>.<fromSlot>-<toGrill>.<toSlot>",
// boosters: "b<id>[:<grill>.<slot>[-<grill>.<slot>]]".

/** Can the item at (grill, slot) be picked up under the normal rules? */
export function canPick(state, grill, slot) {
  const g = state.grills[grill];
  return !!g && g.lock === 0 && !!g.slots[slot];
}

/** Can something be dropped into (grill, slot) under the normal rules? */
export function canDrop(state, grill, slot) {
  const g = state.grills[grill];
  return !!g && g.lock === 0 && slot >= 0 && slot < g.slots.length && g.slots[slot] === null;
}

export function isLegalMove(state, move) {
  if (state.status !== 'playing' || state.movesLeft <= 0) return false;
  if (!move || move.type !== 'move' || !move.from || !move.to) return false;
  const { from, to } = move;
  if (from.grill === to.grill) return false; // slot order inside a grill has no meaning: not a move
  return canPick(state, from.grill, from.slot) && canDrop(state, to.grill, to.slot);
}

/** Cheap test: is there any legal move at all? (an item on one open grill and an empty slot on another) */
export function hasLegalMove(state) {
  if (state.status !== 'playing' || state.movesLeft <= 0) return false;
  let withItem = -1, withRoom = -1;
  for (let g = 0; g < state.grills.length; g++) {
    const gr = state.grills[g];
    if (gr.lock > 0) continue;
    const hasItem = gr.slots.some(Boolean), hasRoom = gr.slots.includes(null);
    if ((hasItem && withRoom >= 0 && withRoom !== g) || (hasRoom && withItem >= 0 && withItem !== g)) return true;
    if (hasItem && hasRoom && withItem >= 0 && withRoom >= 0) return true;
    if (hasItem && withItem < 0) withItem = g;
    if (hasRoom && withRoom < 0) withRoom = g;
  }
  return false;
}

/**
 * Legal moves. With { unique: true } (the solver's view) moves that lead to the same logical state are
 * collapsed: one per (source grill, food, destination grill), always into the destination's first empty slot.
 */
export function getLegalMoves(state, { unique = false } = {}) {
  const out = [];
  if (state.status !== 'playing' || state.movesLeft <= 0) return out;
  const gs = state.grills;
  const firstEmpty = gs.map((g) => (g.lock === 0 ? g.slots.indexOf(null) : -1));
  for (let fg = 0; fg < gs.length; fg++) {
    const src = gs[fg];
    if (src.lock > 0) continue;
    const seen = unique ? [] : null; // foods already taken from this grill (<= 6 entries)
    for (let fs = 0; fs < src.slots.length; fs++) {
      const item = src.slots[fs];
      if (!item) continue;
      if (unique) {
        if (seen.includes(item.food)) continue;
        seen.push(item.food);
      }
      for (let tg = 0; tg < gs.length; tg++) {
        if (tg === fg || firstEmpty[tg] < 0) continue;
        if (unique) out.push({ type: 'move', from: { grill: fg, slot: fs }, to: { grill: tg, slot: firstEmpty[tg] } });
        else gs[tg].slots.forEach((it, ts) => it === null && out.push({ type: 'move', from: { grill: fg, slot: fs }, to: { grill: tg, slot: ts } }));
      }
    }
  }
  return out;
}

const pos = (p) => `${p.grill}.${p.slot}`;
const unPos = (s) => {
  const [grill, slot] = s.split('.').map(Number);
  return { grill, slot };
};

export function encodeAction(a) {
  if (a.type === 'move') return `m${pos(a.from)}-${pos(a.to)}`;
  if (a.type === 'booster') {
    let s = `b${a.booster}`;
    if (a.from) s += `:${pos(a.from)}`;
    if (a.to) s += `-${pos(a.to)}`;
    return s;
  }
  throw new Error(`cannot encode action ${JSON.stringify(a)}`);
}

const MOVE_RE = /^m(\d+)\.(\d+)-(\d+)\.(\d+)$/;
const BOOSTER_RE = /^b([a-z_]+)(?::(\d+\.\d+))?(?:-(\d+\.\d+))?$/;

export function decodeAction(s) {
  let m = MOVE_RE.exec(s);
  if (m) return { type: 'move', from: { grill: +m[1], slot: +m[2] }, to: { grill: +m[3], slot: +m[4] } };
  m = BOOSTER_RE.exec(s);
  if (m) {
    const a = { type: 'booster', booster: m[1] };
    if (m[2]) a.from = unPos(m[2]);
    if (m[3]) a.to = unPos(m[3]);
    return a;
  }
  throw new Error(`bad action string ${JSON.stringify(s)}`);
}

export const encodeActions = (list) => list.map(encodeAction).join(' ');
export const decodeActions = (str) => (str.trim() ? str.trim().split(/\s+/).map(decodeAction) : []);
