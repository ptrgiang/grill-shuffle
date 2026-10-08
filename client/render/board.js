// BoardView: renders a puzzle state and plays the simulation's events as animation.
//
//   INPUT -> SIMULATION -> NEXT STATE + EVENTS -> BoardView.play(next, events) -> animation timeline -> visuals
//
// The view never decides anything about the game. Every item's resting place is read from the authoritative state;
// events only decide HOW the view gets there (arcs, bursts, reveals) and WHEN presentation callbacks (sound, HUD)
// fire. Skipping or cutting animations short (skip(), or a new move arriving mid-animation) cannot change the game:
// reconcile() always converges the view onto the state.
import * as THREE from 'three';
import { layoutBoard, hitTestSegment } from './layout.js';
import { GrillView } from './grill.js';
import { createFood, foodMaterial } from './foods.js';
import { Particles } from './particles.js';
import { badgeTexture, softDot } from './textures.js';
import { materials } from './materials.js';

export const TIMING = Object.freeze({
  move: 0.17, // pick-up-to-land arc
  dragLand: 0.09, // from the finger to the slot
  matchPop: 0.08,
  matchConverge: 0.14,
  matchServe: 0.22,
  chainGap: 0.12,
  reveal: 0.32,
  endDelay: 0.45,
});
const MATCH_DUR = TIMING.matchPop + TIMING.matchConverge + TIMING.matchServe;
const LIFT = 0.42; // selected / dragged height
// top of the tallest standing item incl. the selected lift and bob: picking covers the column from the table up to it
export const PICK_TOP = 0.75;

let blobGeometry = null, blobMaterial = null;
const blobGeo = () => (blobGeometry ??= new THREE.CircleGeometry(0.34, 20).rotateX(-Math.PI / 2));
const blobMat = () => (blobMaterial ??= Object.assign(materials().shadowBlob, { map: softDot() }));

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export class BoardView {
  /**
   * @param stage   Stage (render/stage.js)
   * @param opts    { onFx(event, screenPos) - presentation callback for audio / HUD, animations: boolean }
   */
  constructor(stage, { onFx = () => {}, animations = true } = {}) {
    this.stage = stage;
    this.onFx = onFx;
    this.animations = animations;
    this.root = new THREE.Group();
    stage.scene.add(this.root);
    this.particles = new Particles(stage.scene);
    this.grills = [];
    this.items = new Map(); // item id -> ItemView (items on the board in the current state)
    this.clearing = []; // ItemViews playing their match animation (already gone from the state)
    this.timeline = []; // { at, fn } scheduled presentation steps
    this.clock = 0;
    this.margins = { marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 };
    this.selected = null;
    this.drag = null;
    this.hover = null;
    this.targets = null; // grills that accept the selected item (null: nothing selected)
    this.hint = null;
    this.ambient = 0;
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe7b0', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    this.selRing.renderOrder = 3;
    this.root.add(this.selRing);
    this.blobs = false; // low quality tier: no shadow map, a soft blob under each item instead
    stage.onTier = (name, tier) => this.setQuality(tier);
    if (stage.tier) this.setQuality(stage.tier);
  }

  /** Follow the stage's quality tier: particle density, blob shadows when the shadow map is off. */
  setQuality(tier) {
    this.particles.density = tier.particles;
    this.blobs = tier.shadows === 'off';
    for (const v of this.items.values()) if (v.blob) v.blob.visible = this.blobs;
  }

  /**
   * Something on the board moves: animations, a selection, a drag, a burst, a fading glow. When false the board is
   * still and the loop can render at an idle tick (render/quality.js IdleGate).
   */
  get busy() {
    if (this.timeline.length || this.clearing.length || this.drag || this.selected || this.hint) return true;
    if (this.selRing.material.opacity > 0.01 || this.particles.busy || this.stage.busy) return true;
    for (const g of this.grills) if (g.busy) return true;
    for (const v of this.items.values()) if (v.motion || v.squash > 0 || v.shake > 0 || v.settle) return true;
    return false;
  }

  // ---------------------------------------------------------------- building

  /** Build grills for a (new) level and snap every item into place. */
  setState(state) {
    for (const g of this.grills) this.root.remove(g.group);
    for (const v of this.items.values()) this.root.remove(v.holder);
    for (const v of this.clearing) this.root.remove(v.holder);
    this.items.clear();
    this.clearing = [];
    this.timeline = [];
    this.selected = null;
    this.drag = null;
    this.targets = null;
    this.state = state;
    this.grills = state.grills.map((g) => new GrillView(g));
    for (const g of this.grills) this.root.add(g.group);
    this.relayout();
    this.reconcile(state, { snap: true });
  }

  setMargins(m) {
    this.margins = { ...this.margins, ...m };
    this.relayout();
  }

  relayout() {
    if (!this.state) return;
    const { w, h } = this.stage.size;
    const availW = w - this.margins.marginLeft - this.margins.marginRight, availH = h - this.margins.marginTop - this.margins.marginBottom;
    this.layout = layoutBoard(this.state.grills.map((g) => g.slots.length), Math.max(0.2, availW / Math.max(1, availH)));
    this.layout.grills.forEach((L, i) => this.grills[i].place(L.x, L.z));
    const hasLayers = this.state.grills.some((g) => g.layers.length);
    this.stage.frame({ width: this.layout.width + 0.5, depth: this.layout.depth + (hasLayers ? 0.7 : 0.2), height: 1.1, ...this.margins });
    this.particles.setScale((1 / this.stage.worldPerPixel) * this.stage.renderer.getPixelRatio());
    for (const g of this.grills) g.setMarkerScale(1 / this.stage.worldPerPixel);
    for (const v of this.items.values()) if (!v.motion && v !== this.drag?.view) v.holder.position.copy(this.slotPos(v.grill, v.slot));
  }

  slotPos(grill, slot, out = new THREE.Vector3()) {
    const L = this.layout.grills[grill];
    return out.set(L.x + (slot - (L.slots - 1) / 2) * 1.08, 0, L.z);
  }

  #makeItem(item, grill, slot) {
    const holder = new THREE.Group();
    const mesh = createFood(item.food, { seed: item.id * 977 + (this.state.levelId?.length ?? 0) });
    holder.add(mesh);
    const blob = new THREE.Mesh(blobGeo(), blobMat());
    blob.visible = this.blobs;
    blob.renderOrder = 1;
    holder.add(blob);
    holder.position.copy(this.slotPos(grill, slot));
    this.root.add(holder);
    return { id: item.id, food: item.food, grill, slot, holder, mesh, blob, motion: null, phase: this.stage.frozen ? 0 : Math.random() * 6.28, hiddenUntil: 0 };
  }

  /** Converge the view on `state`: create missing items, drop stale ones, retarget everything to its slot. */
  reconcile(state, { snap = false, grills = snap } = {}) {
    this.state = state;
    const seen = new Set();
    if (grills) this.#syncGrills(state, snap);
    state.grills.forEach((g, gi) => {
      g.slots.forEach((item, si) => {
        if (!item) return;
        seen.add(item.id);
        let v = this.items.get(item.id);
        if (!v) {
          v = this.#makeItem(item, gi, si);
          this.items.set(item.id, v);
        }
        this.#syncLook(v, item);
        if (v.grill !== gi || v.slot !== si || snap) {
          v.grill = gi;
          v.slot = si;
          if (snap || !this.animations) {
            v.motion = null;
            v.holder.position.copy(this.slotPos(gi, si));
          } else if (!v.motion && this.drag?.view !== v) this.#moveTo(v, TIMING.move);
        }
      });
    });
    for (const [id, v] of this.items) {
      if (!seen.has(id)) {
        this.root.remove(v.holder);
        this.items.delete(id);
      }
    }
    this.#refreshSlots();
  }

  /**
   * Burn state, read from the item (never from timers): a counter badge while it burns, the charred material once
   * it has. Minimal on purpose; staged cook/char visuals are their own feature.
   */
  #syncLook(v, item) {
    const burn = item.burn ?? 0;
    const charred = !!item.charred;
    if ((v.charred ?? false) !== charred) {
      v.charred = charred;
      v.mesh.material = charred ? foodMaterial(item.food, { char: 1, tint: '#4a3f3a' }) : foodMaterial(item.food);
    }
    if ((v.burn ?? 0) === burn) return;
    v.burn = burn;
    if (v.badge) {
      v.holder.remove(v.badge);
      v.badge.material.map.dispose();
      v.badge.material.dispose();
      v.badge = null;
    }
    if (!burn) return;
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(String(burn), { ring: burn <= 1 ? '#ff3b1f' : '#ff8a3d', bg: '#3a1712' }), depthTest: false, toneMapped: false }));
    badge.scale.setScalar(0.34);
    badge.position.set(0.24, 0.5, 0.18);
    badge.renderOrder = 10;
    v.holder.add(badge);
    v.badge = badge;
  }

  /** Locks and stacked-tray counts. During play() they change on their events' beats; this is the backstop. */
  #syncGrills(state, instant = false) {
    state.grills.forEach((g, gi) => {
      if (this.grills[gi].lock !== g.lock) this.grills[gi].setLock(g.lock, { instant });
      if (this.grills[gi].layers !== g.layers.length) this.grills[gi].setLayers(g.layers.length);
    });
    this.#refreshSlots();
  }

  #refreshSlots() {
    if (!this.state) return;
    this.state.grills.forEach((g, gi) => {
      const candidate = !!this.targets?.includes(gi) && !this.hover;
      g.slots.forEach((it, si) => this.grills[gi].setSlotState(si, { empty: !it, dim: g.lock > 0, candidate, target: !!this.hover && this.hover.grill === gi && this.hover.slot === si }));
    });
  }

  // ---------------------------------------------------------------- playing events

  /**
   * Animate from the current view to `next`, driven by the simulation's events.
   * `dropped`: the item was dragged and released (it lands from where the finger let go).
   */
  play(next, events, { dropped = false } = {}) {
    if (!this.animations) {
      this.reconcile(next, { snap: true });
      for (const ev of events) this.onFx(ev, null);
      return;
    }
    const now = this.clock;
    let land = now;
    let lastChain = -1, chainStart = now, lastEnd = now, cursor = now, burstAt = now;
    for (const ev of events) {
      switch (ev.type) {
        case 'move': {
          const v = this.items.get(ev.itemId);
          if (!v) break;
          v.grill = ev.to.grill;
          v.slot = ev.to.slot;
          const dur = dropped ? TIMING.dragLand : TIMING.move;
          this.#moveTo(v, dur, { arc: !dropped });
          land = Math.max(land, now + dur);
          cursor = land;
          this.#at(land, () => {
            this.particles.steam(this.slotPos(ev.to.grill, ev.to.slot), 3);
            this.onFx({ type: 'land', food: ev.food, booster: ev.booster }, this.#screen(ev.to.grill));
          });
          break;
        }
        case 'match': {
          if (ev.chain !== lastChain) {
            chainStart = lastChain < 0 ? land + 0.03 : Math.max(lastEnd, cursor) + TIMING.chainGap;
            lastChain = ev.chain;
          }
          this.#playMatch(ev, chainStart);
          burstAt = chainStart + TIMING.matchPop + TIMING.matchConverge;
          lastEnd = Math.max(lastEnd, chainStart + MATCH_DUR);
          this.#fxAt(burstAt, ev, ev.grill);
          break;
        }
        case 'lock_progress':
          this.#at(burstAt + 0.08, () => this.grills[ev.grill].setLock(ev.remaining));
          this.#fxAt(burstAt + 0.08, ev, ev.grill);
          break;
        case 'unlock':
          this.#at(burstAt + 0.1, () => {
            this.grills[ev.grill].setLock(0);
            this.particles.poof(this.slotPos(ev.grill, 1).setY(0.6), '#cfe3ff');
            this.#refreshSlots();
          });
          this.#fxAt(burstAt + 0.1, ev, ev.grill);
          break;
        case 'reveal': {
          const t = Math.max(lastEnd, cursor) + 0.02;
          this.#playReveal(ev, t);
          cursor = t + TIMING.reveal;
          this.#fxAt(t, ev, ev.grill);
          break;
        }
        case 'score':
        case 'goal_progress':
        case 'combo':
          this.#fxAt(Math.max(burstAt, land), ev, ev.grill ?? null);
          break;
        case 'combo_reset':
          this.#fxAt(land, ev, null);
          break;
        case 'charred':
          this.#at(land + 0.05, () => this.particles.poof(this.slotPos(ev.grill, ev.slot).setY(0.35), '#5a5350'));
          this.#fxAt(land + 0.05, ev, ev.grill);
          break;
        case 'level_complete':
        case 'level_failed':
          this.#fxAt(Math.max(lastEnd, cursor, land) + TIMING.endDelay, ev, null);
          break;
        default:
          this.#fxAt(land, ev, null);
      }
    }
    // the authoritative layout, whatever the events said; grill decorations catch up once the events have played
    this.reconcile(next);
    this.#at(Math.max(lastEnd, cursor, land) + 0.05, () => this.#syncGrills(this.state));
  }

  #at(t, fn) {
    this.timeline.push({ at: t, fn });
  }

  #fxAt(t, ev, grill) {
    this.#at(t, () => this.onFx(ev, grill === null || grill === undefined ? null : this.#screen(grill)));
  }

  #screen(grill) {
    const L = this.layout.grills[grill];
    return this.stage.toScreen(new THREE.Vector3(L.x, 0.6, L.z));
  }

  #moveTo(v, dur, { arc = true, delay = 0 } = {}) {
    const from = v.holder.position.clone();
    const to = this.slotPos(v.grill, v.slot);
    const dist = from.distanceTo(to);
    v.settle = false;
    v.motion = { kind: 'move', from, to, t0: this.clock + delay, dur: Math.max(0.06, dur * Math.min(1.4, 0.6 + dist * 0.12)), arc: arc ? Math.min(1.1, 0.25 + dist * 0.12) : 0 };
  }

  #playMatch(ev, start) {
    const views = ev.itemIds.map((id) => this.items.get(id)).filter(Boolean);
    const centre = this.slotPos(ev.grill, 0).add(this.slotPos(ev.grill, this.layout.grills[ev.grill].slots - 1)).multiplyScalar(0.5);
    for (const v of views) {
      this.items.delete(v.id);
      // a match can follow the landing of the very item that made it: start from where it will be
      const from = this.slotPos(v.grill, v.slot);
      const pre = v.motion?.kind === 'move' ? v.motion : null; // finish landing first
      v.blob.visible = false; // it flies off the grate
      v.motion = { kind: 'match', from, centre: centre.clone(), t0: start, combo: ev.combo, spin: (Math.random() - 0.5) * 2, pre };
      this.clearing.push(v);
    }
    this.#at(start + TIMING.matchPop + TIMING.matchConverge, () => {
      this.particles.flameBurst(centre.clone().setY(0.15), Math.min(2.2, 0.9 + 0.3 * (ev.combo - 1)));
      this.stage.addShake(0.05 + 0.025 * Math.min(4, ev.combo));
      this.grills[ev.grill].pulse = 1;
    });
  }

  #playReveal(ev, t) {
    for (const it of ev.items) {
      let v = this.items.get(it.id);
      if (!v) {
        v = this.#makeItem({ id: it.id, food: it.food }, ev.grill, it.slot);
        this.items.set(it.id, v);
      }
      v.hiddenUntil = t;
      v.holder.visible = false;
      v.motion = { kind: 'reveal', to: this.slotPos(ev.grill, it.slot), t0: t + it.slot * 0.04 };
    }
    this.#at(t, () => {
      this.grills[ev.grill].setLayers(ev.layersLeft);
      this.particles.poof(this.slotPos(ev.grill, 1), '#fff2d6');
    });
  }

  /** Jump every running animation to its end (fast-forward). Game state is unaffected by definition. */
  skip() {
    this.clock += 10;
    this.update(0);
    for (const v of this.clearing) this.root.remove(v.holder);
    this.clearing = [];
  }

  // ---------------------------------------------------------------- selection, dragging, hints (input -> view)

  /**
   * Screen pixel -> { grill, slot } under it (rule-free: the controller decides what is legal).
   * Pure math, no ray-cast: the pixel's ray from the table (y = 0) up to PICK_TOP is tested against the layout, so
   * a tap on the top of a tall item hits its slot as well as a tap on its foot. `margin` (world units) widens grills.
   */
  pick(px, py, { margin = 0.25 } = {}) {
    if (!this.layout) return null;
    const foot = this.stage.toPlane(px, py, 0);
    const top = this.stage.toPlane(px, py, PICK_TOP);
    return hitTestSegment(this.layout, foot.x, foot.z, top.z, { margin });
  }

  itemAt(grill, slot) {
    const it = this.state?.grills[grill]?.slots[slot];
    return it ? this.items.get(it.id) : null;
  }

  select(grill, slot) {
    const prev = this.selected?.view;
    this.selected = grill === null ? null : { grill, slot, view: this.itemAt(grill, slot) };
    // put down without a move: a small squash when it touches the grate again
    if (prev && prev !== this.selected?.view && !prev.motion) prev.settle = true;
  }

  /** Screen position of a slot, `y` world units above the grate (overlays such as the onboarding hand). */
  slotScreen(grill, slot, y = 0) {
    if (!this.layout?.grills[grill]) return null;
    return this.stage.toScreen(this.slotPos(grill, slot).setY(y));
  }

  beginDrag(grill, slot) {
    const view = this.itemAt(grill, slot);
    if (!view) return;
    view.motion = null;
    this.drag = { grill, slot, view };
  }

  dragTo(px, py) {
    if (!this.drag) return;
    const p = this.stage.toPlane(px, py, LIFT + 0.15);
    this.drag.target = p;
  }

  /** Snap a dragged / selected item back to its slot (invalid drop). */
  cancelDrag({ invalid = false } = {}) {
    const d = this.drag;
    this.drag = null;
    if (d?.view) {
      this.#moveTo(d.view, 0.16, { arc: false });
      if (invalid) d.view.shake = 0.35;
    }
  }

  endDrag() {
    this.drag = null;
  }

  /**
   * Show where the selected item can go: `targets` (grill indexes) pulse, every other grill except `fromGrill`
   * dims. Touch has no hover, so this is the whole answer to "where can this go?". null clears.
   */
  setTargets(targets, fromGrill = -1) {
    this.targets = targets ? [...targets] : null;
    this.grills.forEach((g, i) => {
      g.setGlow(targets?.includes(i) ? 1 : 0);
      g.setDim(!!targets && !targets.includes(i) && i !== fromGrill);
    });
    this.#refreshSlots();
  }

  setHover(hit, valid) {
    this.hover = hit && valid ? hit : null;
    if (hit && this.grills[hit.grill]) this.grills.forEach((g, i) => g.glowTarget > 0 && g.setGlow(i === hit.grill && valid ? 2 : 1));
    this.#refreshSlots();
  }

  /** An action aimed at `grill` was refused: the grill and its food shake, the grill flashes red. */
  flashInvalid(grill) {
    const g = this.grills[grill];
    if (!g) return;
    g.reject();
    for (const v of this.items.values()) if (v.grill === grill && !v.motion) v.shake = 0.3;
  }

  showHint(move) {
    this.hint = move ? { move, until: this.clock + 3 } : null;
  }

  // ---------------------------------------------------------------- frame

  update(dt) {
    this.clock += dt;
    const now = this.clock;
    if (this.timeline.length) {
      this.timeline.sort((a, b) => a.at - b.at);
      while (this.timeline.length && this.timeline[0].at <= now) this.timeline.shift().fn();
    }
    for (const g of this.grills) g.update(dt, { frozen: this.stage.frozen });
    const tmp = new THREE.Vector3();
    for (const v of this.items.values()) this.#updateItem(v, now, dt, tmp);
    for (let i = this.clearing.length - 1; i >= 0; i--) {
      const v = this.clearing[i];
      if (this.#updateMatch(v, now)) {
        this.root.remove(v.holder);
        this.clearing.splice(i, 1);
      }
    }
    // selection ring
    const sel = this.drag?.view ?? this.selected?.view;
    const ringMat = this.selRing.material;
    if (sel && this.items.has(sel.id)) {
      this.selRing.position.set(sel.holder.position.x, 0.02, sel.holder.position.z);
      ringMat.opacity += (0.85 - ringMat.opacity) * Math.min(1, dt * 18);
      this.selRing.scale.setScalar(1 + 0.06 * Math.sin(this.#osc(now) * 8));
    } else ringMat.opacity *= Math.pow(0.001, dt);
    // hint pulse
    if (this.hint && now > this.hint.until) this.hint = null;
    // ambient sizzle: embers off hot grills, wisps of steam off food
    this.ambient -= dt;
    if (this.ambient <= 0 && this.grills.length && !this.stage.frozen) {
      this.ambient = 0.18 + Math.random() * 0.25;
      const gi = Math.floor(Math.random() * this.grills.length);
      const g = this.grills[gi];
      if (g.type === 'grill' && !g.lock) {
        const L = this.layout.grills[gi];
        this.particles.ember(new THREE.Vector3(L.x + (Math.random() - 0.5) * L.w * 0.8, -0.05, L.z + (Math.random() - 0.5) * 1.1));
        if (Math.random() < 0.3) {
          const items = [...this.items.values()].filter((v) => v.grill === gi && v.holder.visible);
          if (items.length) this.particles.steam(items[Math.floor(Math.random() * items.length)].holder.position, 1, { ambient: true });
        }
      }
    }
    this.particles.update(dt);
  }

  #updateItem(v, now, dt, tmp) {
    const h = v.holder;
    let lift = 0, scale = 1;
    if (this.drag?.view === v && this.drag.target) {
      h.position.lerp(this.drag.target, 1 - Math.pow(1e-7, dt));
      scale = 1.12;
    } else if (v.motion?.kind === 'move') {
      const m = v.motion;
      const t = Math.max(0, Math.min(1, (now - m.t0) / m.dur));
      const e = easeInOut(t);
      h.position.lerpVectors(m.from, m.to, e);
      h.position.y = m.from.y * (1 - e) + Math.sin(Math.PI * t) * m.arc;
      scale = 1 + 0.08 * Math.sin(Math.PI * t);
      if (t >= 1) {
        v.motion = null;
        v.squash = 1;
      }
    } else if (v.motion?.kind === 'reveal') {
      const m = v.motion;
      const t = (now - m.t0) / TIMING.reveal;
      if (t < 0) return;
      h.visible = true;
      const e = Math.min(1, t);
      h.position.copy(m.to);
      h.position.y = (1 - easeOut(e)) * -0.35;
      scale = Math.max(0.001, backOut(e));
      if (t >= 1) v.motion = null;
    } else {
      h.visible = true;
      const sel = this.selected?.view === v;
      lift = sel ? LIFT * 0.6 + Math.sin(this.#osc(now) * 5) * 0.03 : 0;
      tmp.copy(this.slotPos(v.grill, v.slot));
      h.position.x += (tmp.x - h.position.x) * Math.min(1, dt * 20);
      h.position.z += (tmp.z - h.position.z) * Math.min(1, dt * 20);
      h.position.y += (lift - h.position.y) * Math.min(1, dt * 18);
      if (sel) scale = 1.08;
      else if (v.settle && h.position.y < 0.03) {
        v.settle = false;
        v.squash = 0.8;
      }
      if (this.hint) {
        const hm = this.hint.move;
        if (hm.from.grill === v.grill && hm.from.slot === v.slot) {
          h.position.y = 0.15 + Math.abs(Math.sin(this.#osc(now) * 6 + 1)) * 0.3;
        }
      }
    }
    // landing squash, sizzle wobble, invalid shake
    if (v.squash > 0) {
      v.squash = Math.max(0, v.squash - dt * 6);
      const s = Math.sin(v.squash * Math.PI) * 0.12;
      h.scale.set(scale * (1 + s), scale * (1 - s * 1.4), scale * (1 + s));
    } else {
      const wob = 1 + Math.sin(this.#osc(now) * 9 + v.phase) * 0.006;
      h.scale.set(scale, scale * wob, scale);
    }
    if (v.shake > 0) {
      v.shake = Math.max(0, v.shake - dt);
      h.position.x += Math.sin(now * 70) * v.shake * 0.12;
    }
    if (this.blobs) v.blob.position.y = (0.004 - h.position.y) / Math.max(0.01, h.scale.y); // stays on the grate
  }

  /** Time for idle oscillations (bob, wobble, pulses): pinned at 0 on a frozen stage, so stills are repeatable. */
  #osc(now) {
    return this.stage.frozen ? 0 : now;
  }

  /** Match animation for one item. Returns true when it is finished. */
  #updateMatch(v, now) {
    const m = v.motion;
    const t = now - m.t0;
    const h = v.holder;
    h.visible = true;
    if (t < 0) {
      // still landing: finish the move's arc
      if (m.pre) {
        const q = Math.max(0, Math.min(1, (now - m.pre.t0) / m.pre.dur));
        h.position.lerpVectors(m.pre.from, m.pre.to, easeInOut(q));
        h.position.y = m.pre.from.y * (1 - q) + Math.sin(Math.PI * q) * m.pre.arc;
      } else h.position.lerp(m.from, 0.35);
      return false;
    }
    const p1 = TIMING.matchPop, p2 = p1 + TIMING.matchConverge, p3 = p2 + TIMING.matchServe;
    if (t < p1) {
      const e = t / p1;
      h.position.copy(m.from);
      h.position.y = 0.18 * e;
      h.scale.setScalar(1 + 0.18 * Math.sin(e * Math.PI * 0.5));
    } else if (t < p2) {
      const e = easeInOut((t - p1) / TIMING.matchConverge);
      h.position.lerpVectors(m.from, m.centre, e * 0.7);
      h.position.y = 0.18 + 0.32 * e;
      h.rotation.y = m.spin * e;
      h.scale.setScalar(1.18 - 0.1 * e);
    } else if (t < p3) {
      const e = (t - p2) / TIMING.matchServe;
      const c = m.centre;
      h.position.set(c.x + (h.position.x - c.x) * (1 - e * 0.6), 0.5 + e * e * 3.2, c.z - e * 0.6);
      h.rotation.y += 0.25;
      h.scale.setScalar(Math.max(0.001, 1.08 * (1 - easeOut(e))));
    } else return true;
    return false;
  }
}
