// First-level onboarding on touch: an animated hand that taps the food to pick up, then taps the grill to send it to.
// Data-driven: the move shown is the first move of the level's solver solution (written by `npm run solve`), so it
// is always a legal, useful move. Presentation only: the hand never touches input or the game state.
import { decodeActions } from '../../shared/moves.js';
import { h, iconEl } from './dom.js';

/** The move the coach demonstrates for `level`, or null (no hint text or no solution to show). */
export function coachMove(level) {
  if (!level?.hint || !level.solver?.solution) return null;
  try {
    const first = decodeActions(level.solver.solution)[0];
    return first?.type === 'move' ? first : null;
  } catch {
    return null;
  }
}

export class Coach {
  /**
   * @param layer  element to draw in (covers the canvas, pointer-events: none)
   * @param view   BoardView (slotScreen for positions)
   * @param move   { from: { grill, slot }, to: { grill, slot } }
   */
  constructor(layer, view, move) {
    this.view = view;
    this.move = move;
    this.el = h('div.coach.pick', { 'aria-hidden': 'true' }, h('div.coach-ring.a'), h('div.coach-ring.b'), iconEl('hand', 'coach-hand'));
    layer.append(this.el);
    const tick = () => {
      if (!this.el) return;
      this.#place();
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  #place() {
    const a = this.view.slotScreen(this.move.from.grill, this.move.from.slot, 0.35);
    const b = this.view.slotScreen(this.move.to.grill, this.move.to.slot, 0.1);
    if (!a || !b) return;
    const st = this.el.style;
    st.setProperty('--ax', `${a.x.toFixed(1)}px`);
    st.setProperty('--ay', `${a.y.toFixed(1)}px`);
    st.setProperty('--bx', `${b.x.toFixed(1)}px`);
    st.setProperty('--by', `${b.y.toFixed(1)}px`);
  }

  /** 'pick': tap the food, then the grill. 'drop': something is selected, only tap the grill. */
  phase(name) {
    if (!this.el) return;
    this.el.classList.toggle('pick', name === 'pick');
    this.el.classList.toggle('drop', name === 'drop');
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.el?.remove();
    this.el = null;
  }
}
