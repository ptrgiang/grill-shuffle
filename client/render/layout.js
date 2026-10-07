// Board layout: where each grill sits on the table. Pure math (no three.js), so it is testable and the input code
// can hit-test against the same numbers the renderer draws with.
//
// World units: one slot is SLOT world units wide. The board lies on the XZ plane, +Z towards the player, Y up.

export const SLOT = 1.08; // distance between slot centres
export const GRILL_DEPTH = 1.5;
export const GRILL_PAD = 0.32; // rim beyond the outer slots
export const GAP_X = 0.42;
export const GAP_Z = 0.55;
export const CAMERA_ELEVATION = (58 * Math.PI) / 180; // camera pitch above the table

export const grillWidth = (slots) => slots * SLOT + GRILL_PAD * 2;

/** Slot centre relative to its grill's centre. */
export const slotOffsetX = (slot, slots) => (slot - (slots - 1) / 2) * SLOT;

/**
 * Lay the grills out in rows, choosing the column count that lets the board appear largest in the available
 * screen area (aspect = available width / height in pixels).
 * Returns { grills: [{ x, z, w, d, slots }], width, depth, cols }.
 */
export function layoutBoard(slotCounts, aspect) {
  const n = slotCounts.length;
  let best = null;
  for (let cols = 1; cols <= Math.min(4, n); cols++) {
    const rows = Math.ceil(n / cols);
    const cellW = Math.max(...slotCounts.map(grillWidth));
    const width = cols * cellW + (cols - 1) * GAP_X;
    const depth = rows * GRILL_DEPTH + (rows - 1) * GAP_Z;
    const projH = depth * Math.sin(CAMERA_ELEVATION) + 0.9; // + item height / lift headroom
    const scale = Math.min(aspect / width, 1 / projH); // relative pixels per world unit
    // prefer fewer, fuller rows when nearly equal (a ragged last row reads worse)
    const ragged = n % cols ? 0.97 : 1;
    const score = scale * ragged;
    if (!best || score > best.score) best = { cols, rows, cellW, width, depth, score };
  }
  const { cols, rows, cellW, width, depth } = best;
  const grills = slotCounts.map((slots, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const col = i - row * cols;
    const rowWidth = inRow * cellW + (inRow - 1) * GAP_X;
    const x = -rowWidth / 2 + cellW / 2 + col * (cellW + GAP_X);
    const z = -depth / 2 + GRILL_DEPTH / 2 + row * (GRILL_DEPTH + GAP_Z);
    return { x, z, w: grillWidth(slots), d: GRILL_DEPTH, slots };
  });
  return { grills, width, depth, cols, rows };
}

/** World position (on the table plane) -> { grill, slot } under it, or null. Generous: the whole grill cell counts. */
export function hitTest(layout, x, z, { margin = 0.25 } = {}) {
  let best = null;
  layout.grills.forEach((g, gi) => {
    const dx = x - g.x, dz = z - g.z;
    if (Math.abs(dx) > g.w / 2 + margin || Math.abs(dz) > g.d / 2 + margin) return;
    const dist = Math.abs(dz) + Math.max(0, Math.abs(dx) - g.w / 2);
    if (best && best.dist <= dist) return;
    let slot = Math.round(dx / SLOT + (g.slots - 1) / 2);
    slot = Math.max(0, Math.min(g.slots - 1, slot));
    best = { grill: gi, slot, dist };
  });
  return best && { grill: best.grill, slot: best.slot };
}
