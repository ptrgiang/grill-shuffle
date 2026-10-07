// Board obstacles (rules v1). Each is a tiny rule applied during resolution; all are turn-based.
//
// Locked grill  - grill.lock = N: nothing can be taken from or put on it. Every match anywhere on the board
//                 takes one off every locked grill's counter; at 0 it opens (and may match at once).
// Stacked tray  - grill.layers: hidden trays waiting under the grill. When the grill is empty (by matching or by
//                 moving everything away) the next layer flips up into its slots. Layers are revealed in order.
// Prep tray     - grill.type = 'tray': holds food, never matches (see rules.js GRILL_TYPES).

/** Count one match against every locked grill. Mutates; returns unlock / lock_progress events. */
export function tickLocks(state) {
  const events = [];
  state.grills.forEach((g, i) => {
    if (g.lock <= 0) return;
    g.lock -= 1;
    events.push(g.lock === 0 ? { type: 'unlock', grill: i } : { type: 'lock_progress', grill: i, remaining: g.lock });
  });
  return events;
}

/** Flip up the next layer on every empty, unlocked grill that has one. Mutates; returns reveal events. */
export function revealLayers(state) {
  const events = [];
  state.grills.forEach((g, i) => {
    if (g.lock > 0 || !g.layers.length || g.slots.some(Boolean)) return;
    const [layer, ...rest] = g.layers;
    g.layers = rest;
    const items = [];
    g.slots = layer.map((food, slot) => {
      if (!food) return null;
      const item = { id: state.nextItemId++, food };
      items.push({ slot, id: item.id, food });
      return item;
    });
    events.push({ type: 'reveal', grill: i, items, layersLeft: rest.length });
  });
  return events;
}
