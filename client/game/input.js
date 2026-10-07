// Pointer input: one state machine for mouse, touch and pen (Pointer Events).
//
//   press an item ---- move past a few px ----> drag; release over a grill = move there
//        |
//        +-- release without moving -> the item stays selected; tap a grill to send it there
//
// Both paths end in the same call: onMove(move, { dropped }). The input layer only asks the session what is legal;
// it never changes game state itself.
//
// Touch differs from mouse in three ways (POINTER_TUNING): a thumb jitters more, so a tap needs a larger drag
// threshold; it is fat, so grills get a wider hit margin; and it covers what it carries, so a dragged item is drawn
// `liftPx` above the finger. Everything aims with that lifted point (the "aim"): the hover/snap preview and the drop
// land where the item is, not where the finger is. Mouse keeps liftPx 0 (aim = cursor).

/** Per pointer type: dragPx = movement (CSS px) that turns a press into a drag; margin = hit margin (world units). */
export const POINTER_TUNING = Object.freeze({
  mouse: Object.freeze({ dragPx: 7, margin: 0.25, liftPx: 0, haptics: false }),
  pen: Object.freeze({ dragPx: 9, margin: 0.3, liftPx: 0, haptics: false }),
  touch: Object.freeze({ dragPx: 14, margin: 0.45, liftPx: 72, haptics: true }),
});

/** Tuning for a PointerEvent.pointerType ('' / unknown types behave like a mouse), with optional overrides. */
export function tuningFor(pointerType, overrides = {}) {
  const kind = POINTER_TUNING[pointerType] ? pointerType : 'mouse';
  return { ...POINTER_TUNING[kind], ...overrides[kind] };
}

/** Screen point the carried item is drawn at and aims with: the pointer, lifted by liftPx. */
export const aimPoint = (x, y, tuning) => ({ x, y: y - tuning.liftPx });

export class Input {
  /**
   * @param el       element receiving pointer events (the canvas)
   * @param session  () => Session
   * @param view     BoardView
   * @param hooks    { onMove(move, {dropped}), onSelect(), onInvalid(grill), onDeselect(), enabled(): bool,
   *                   haptics(): bool (vibrate on touch pick-up / drop; default off) }
   * @param opts     { tuning: { touch: { liftPx, ... }, mouse: {...} } } overrides of POINTER_TUNING
   */
  constructor(el, session, view, hooks, { tuning = {} } = {}) {
    this.tuning = tuning;
    this.el = el;
    this.session = session;
    this.view = view;
    this.hooks = hooks;
    this.press = null; // { id, grill, slot, x, y, wasSelected, tune }
    this.dragging = false;
    this.selected = null; // { grill, slot }
    this.handlers = {
      pointerdown: (e) => this.#down(e),
      pointermove: (e) => this.#move(e),
      pointerup: (e) => this.#up(e),
      pointercancel: (e) => this.#cancel(e),
      contextmenu: (e) => e.preventDefault(),
    };
    for (const [k, f] of Object.entries(this.handlers)) el.addEventListener(k, f);
    el.style.touchAction = 'none';
  }

  dispose() {
    for (const [k, f] of Object.entries(this.handlers)) this.el.removeEventListener(k, f);
  }

  #xy(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  #haptic(tune) {
    if (!tune.haptics || !this.hooks.haptics?.()) return;
    try {
      navigator.vibrate?.(8);
    } catch {}
  }

  #enabled() {
    return this.hooks.enabled?.() ?? true;
  }

  deselect() {
    this.selected = null;
    this.view.select(null);
    this.view.setTargets(null);
    this.view.setHover(null, false);
  }

  #select(grill, slot) {
    this.selected = { grill, slot };
    this.view.select(grill, slot);
    this.view.setTargets(this.session().targetsFor({ grill, slot }));
    this.hooks.onSelect?.(grill, slot);
  }

  /** Try to move the selected item to (grill, slot). Returns true if a move was made. */
  #commit(from, hit, dropped) {
    const s = this.session();
    if (!hit || hit.grill === from.grill) return false;
    const slot = s.dropSlot(hit.grill, hit.slot);
    if (slot < 0) {
      this.hooks.onInvalid?.(hit.grill);
      this.view.flashInvalid(hit.grill);
      return false;
    }
    this.hooks.onMove({ type: 'move', from: { grill: from.grill, slot: from.slot }, to: { grill: hit.grill, slot } }, { dropped });
    return true;
  }

  #down(e) {
    if (!this.#enabled() || (e.button !== undefined && e.button > 0)) return;
    this.hooks.onGesture?.();
    const tune = tuningFor(e.pointerType, this.tuning);
    const { x, y } = this.#xy(e);
    const hit = this.view.pick(x, y, { margin: tune.margin });
    const s = this.session();
    // a grill tapped while something is selected: send it there
    if (this.selected && hit && hit.grill !== this.selected.grill && !s.canPick(hit.grill, hit.slot)) {
      const from = this.selected;
      this.deselect();
      if (this.#commit(from, hit, false)) this.#haptic(tune);
      else this.view.cancelDrag();
      return;
    }
    if (this.selected && hit && hit.grill !== this.selected.grill && s.canPick(hit.grill, hit.slot)) {
      // tapping an item on another grill: if that grill has room, the tap means "move there", else reselect
      if (s.dropSlot(hit.grill, hit.slot) >= 0) {
        const from = this.selected;
        this.deselect();
        if (this.#commit(from, hit, false)) this.#haptic(tune);
        return;
      }
    }
    if (hit && s.canPick(hit.grill, hit.slot)) {
      const wasSelected = !!this.selected && this.selected.grill === hit.grill && this.selected.slot === hit.slot;
      this.press = { id: e.pointerId, grill: hit.grill, slot: hit.slot, x, y, wasSelected, tune };
      this.dragging = false;
      this.el.setPointerCapture?.(e.pointerId);
      if (!wasSelected) {
        this.#select(hit.grill, hit.slot);
        this.#haptic(tune);
      }
      return;
    }
    if (this.selected) this.deselect();
    if (hit) {
      this.hooks.onInvalid?.(hit.grill, { quiet: true });
    }
  }

  #move(e) {
    if (!this.press || e.pointerId !== this.press.id) return;
    const { x, y } = this.#xy(e);
    const tune = this.press.tune;
    if (!this.dragging && Math.hypot(x - this.press.x, y - this.press.y) > tune.dragPx) {
      this.dragging = true;
      this.view.beginDrag(this.press.grill, this.press.slot);
    }
    if (this.dragging) {
      const aim = aimPoint(x, y, tune);
      this.view.dragTo(aim.x, aim.y);
      const hit = this.view.pick(aim.x, aim.y, { margin: tune.margin });
      const valid = !!hit && hit.grill !== this.press.grill && this.session().dropSlot(hit.grill, hit.slot) >= 0;
      this.view.setHover(hit && valid ? { grill: hit.grill, slot: this.session().dropSlot(hit.grill, hit.slot) } : hit, valid);
    }
  }

  #up(e) {
    if (!this.press || e.pointerId !== this.press.id) return;
    const p = this.press;
    this.press = null;
    this.el.releasePointerCapture?.(e.pointerId);
    if (this.dragging) {
      this.dragging = false;
      const { x, y } = this.#xy(e);
      const aim = aimPoint(x, y, p.tune);
      const hit = this.view.pick(aim.x, aim.y, { margin: p.tune.margin });
      const from = { grill: p.grill, slot: p.slot };
      this.view.setHover(null, false);
      if (hit && hit.grill !== p.grill) {
        const ok = this.#commit(from, hit, true);
        if (ok) {
          this.view.endDrag();
          this.#haptic(p.tune);
        } else this.view.cancelDrag({ invalid: true });
      } else this.view.cancelDrag();
      this.deselect();
      return;
    }
    // a tap on an already-selected item deselects it
    if (p.wasSelected) this.deselect();
  }

  #cancel(e) {
    if (!this.press || e.pointerId !== this.press.id) return;
    this.press = null;
    if (this.dragging) this.view.cancelDrag();
    this.dragging = false;
    this.deselect();
  }
}
