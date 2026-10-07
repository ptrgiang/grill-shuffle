// Procedural grills and prep trays. A GrillView is the visual of one board grill: body, fire, grate, slot rings,
// the lock overlay and the stacked-tray indicator. It is driven entirely by the board view; it holds no rules.
//
// Local frame: centred on the grill, items rest on y = 0 (the top of the grate), +z towards the player.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials } from './materials.js';
import { badgeTexture } from './textures.js';
import { grillWidth, slotOffsetX, GRILL_DEPTH, markerStyle } from './layout.js';

const geoCache = new Map();
const cached = (key, make) => {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
};

function grillGeometries(slots) {
  return cached(`grill:${slots}`, () => {
    const w = grillWidth(slots), d = GRILL_DEPTH, wall = 0.13, h = 0.34;
    const walls = [
      [w, h, wall, 0, -0.17, d / 2 - wall / 2],
      [w, h, wall, 0, -0.17, -d / 2 + wall / 2],
      [wall, h, d, w / 2 - wall / 2, -0.17, 0],
      [wall, h, d, -w / 2 + wall / 2, -0.17, 0],
      [w, 0.06, d, 0, -0.31, 0],
    ].map(([x, y, z, px, py, pz]) => new RoundedBoxGeometry(x, y, z, 2, 0.035).translate(px, py, pz));
    const body = mergeGeometries(walls.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    const bars = [];
    for (let z = -d / 2 + 0.2; z <= d / 2 - 0.19; z += 0.115) bars.push(new THREE.CylinderGeometry(0.024, 0.024, w - 0.2, 6).rotateZ(Math.PI / 2).translate(0, -0.03, z));
    for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) bars.push(new THREE.CylinderGeometry(0.03, 0.03, d - 0.2, 6).rotateX(Math.PI / 2).translate(x, -0.06, 0));
    const grate = mergeGeometries(bars.map((g) => g.toNonIndexed()), false);
    const fire = new THREE.PlaneGeometry(w - wall * 2, d - wall * 2).rotateX(-Math.PI / 2).translate(0, -0.2, 0);
    const handles = mergeGeometries(
      [-1, 1].map((s) => new THREE.CapsuleGeometry(0.06, 0.5, 4, 8).rotateX(Math.PI / 2).translate(s * (w / 2 + 0.07), -0.12, 0).toNonIndexed()),
      false,
    );
    return { body, grate, fire, handles, w, d };
  });
}

function trayGeometries(slots) {
  return cached(`tray:${slots}`, () => {
    const w = grillWidth(slots) - 0.1, d = GRILL_DEPTH * 0.9;
    const board = new RoundedBoxGeometry(w, 0.14, d, 3, 0.06).translate(0, -0.09, 0);
    const lip = new RoundedBoxGeometry(w + 0.08, 0.06, d + 0.08, 2, 0.03).translate(0, -0.2, 0);
    return { board, lip, w, d };
  });
}

const ringGeo = (width) => cached(`ring:${width.toFixed(3)}`, () => new THREE.RingGeometry(0.3, 0.3 + width, 32).rotateX(-Math.PI / 2));
const discGeo = () => cached('disc', () => new THREE.CircleGeometry(0.3, 32).rotateX(-Math.PI / 2));
const glowGeo = (w, d, pad) => cached(`glow:${w.toFixed(2)}:${pad.toFixed(3)}`, () => new RoundedBoxGeometry(w + pad * 2, 0.02, d + pad * 2, 2, 0.12));
const dimGeo = (w, d) => cached(`dim:${w.toFixed(2)}`, () => new THREE.PlaneGeometry(w - 0.08, d - 0.08).rotateX(-Math.PI / 2));
const VALID = new THREE.Color('#ffe2a8'), HOVER = new THREE.Color('#b8ffb0'), INVALID = new THREE.Color('#ff4d4d');

export class GrillView {
  /** @param grill  { type, slots: [...], lock, layers: [...] } (state or level shape: only counts are read) */
  constructor(grill) {
    const m = materials();
    this.type = grill.type ?? 'grill';
    this.slots = grill.slots.length;
    this.group = new THREE.Group();
    this.group.name = `grill-${this.type}`;
    if (this.type === 'tray') {
      const g = trayGeometries(this.slots);
      const board = new THREE.Mesh(g.board, m.tray);
      const lip = new THREE.Mesh(g.lip, m.trayRim);
      board.receiveShadow = lip.receiveShadow = true;
      board.castShadow = true;
      this.group.add(board, lip);
      this.w = g.w;
      this.d = g.d;
    } else {
      const g = grillGeometries(this.slots);
      this.fire = new THREE.Mesh(g.fire, m.emberHot);
      const body = new THREE.Mesh(g.body, m.grillBody);
      const grate = new THREE.Mesh(g.grate, m.grate);
      const handles = new THREE.Mesh(g.handles, m.handle);
      body.castShadow = body.receiveShadow = true;
      grate.receiveShadow = true;
      handles.castShadow = true;
      this.group.add(this.fire, body, grate, handles);
      this.w = g.w;
      this.d = g.d;
    }
    this.style = markerStyle(0);
    // drop-target / selection glow under the grill
    this.glowMat = m.highlight.clone();
    this.glow = new THREE.Mesh(glowGeo(this.w, this.d, this.style.glowPad), this.glowMat);
    this.glow.position.y = -0.345;
    this.glow.renderOrder = 1;
    this.group.add(this.glow);
    // "can't go here" while an item is selected: a dark veil over the grate, under the food
    this.dimMat = new THREE.MeshBasicMaterial({ color: 0x0c0608, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    this.dimMesh = new THREE.Mesh(dimGeo(this.w, this.d), this.dimMat);
    this.dimMesh.position.y = 0.006;
    this.dimMesh.renderOrder = 1;
    this.group.add(this.dimMesh);
    // slot markers: rings on empty slots, a pulsing disc on the empty slots of a grill that accepts the selected
    // item, a solid disc on the slot a drag would drop into
    this.slotRings = [];
    for (let s = 0; s < this.slots; s++) {
      const ring = new THREE.Mesh(ringGeo(this.style.ringWidth), m.slotPad.clone());
      ring.position.set(slotOffsetX(s, this.slots), 0.012, 0);
      ring.renderOrder = 2;
      const disc = new THREE.Mesh(discGeo(), m.target.clone());
      disc.position.set(slotOffsetX(s, this.slots), 0.014, 0);
      disc.renderOrder = 2;
      this.group.add(ring, disc);
      this.slotRings.push({ ring, disc, empty: false, target: false, candidate: false, dim: false });
    }
    this.lockGroup = null;
    this.layerGroup = null;
    this.setLock(grill.lock ?? 0, { instant: true });
    this.setLayers(grill.layers?.length ?? 0);
    this.glowLevel = 0;
    this.glowTarget = 0;
    this.dim = 0;
    this.dimTarget = 0;
    this.flash = 0; // invalid-action red flash, 1 -> 0
    this.shake = 0; // invalid-action shake, seconds left
    this.homeX = 0; // layout position; the shake wobbles around it
    this.time = Math.random() * 10;
    this.pulse = 0;
  }

  /** Size slot rings and the glow rim for the board's current scale (pixels per world unit). */
  setMarkerScale(pxPerWorld) {
    const st = markerStyle(pxPerWorld);
    if (st.ringWidth !== this.style.ringWidth) for (const r of this.slotRings) r.ring.geometry = ringGeo(st.ringWidth);
    if (st.glowPad !== this.style.glowPad) this.glow.geometry = glowGeo(this.w, this.d, st.glowPad);
    this.style = st;
  }

  /** Still animating (fades, flash, shake, unlock, a pulsing target): the board must keep rendering. */
  get busy() {
    return (
      Math.abs(this.glowTarget - this.glowLevel) > 0.005 || this.glowTarget > 0 || Math.abs(this.dimTarget - this.dim) > 0.005 ||
      this.flash > 0 || this.shake > 0 || this.pulse > 0 || this.unlocking > 0
    );
  }

  /** Where the grill sits in the board (the shake moves around this). */
  place(x, z) {
    this.homeX = x;
    this.group.position.set(x, 0, z);
    this.group.updateMatrixWorld(true);
  }

  /** Invalid action aimed at this grill: red flash + a short sideways shake. */
  reject() {
    this.flash = 1;
    this.shake = 0.32;
  }

  slotPosition(slot, out = new THREE.Vector3()) {
    return out.set(slotOffsetX(slot, this.slots), 0, 0).applyMatrix4(this.group.matrixWorld);
  }

  /** Slot marker state; drawn (with the candidate pulse) in update(). */
  setSlotState(slot, { empty, target = false, candidate = false, dim = false }) {
    Object.assign(this.slotRings[slot], { empty, target, candidate: candidate && empty, dim });
  }

  /** 0 = none, 1 = valid drop target (pulses), 2 = hovered target */
  setGlow(level) {
    this.glowTarget = level;
  }

  /** Dim the grill: it cannot take the selected item. */
  setDim(on) {
    this.dimTarget = on ? 1 : 0;
  }

  setLock(n, { instant = false } = {}) {
    const m = materials();
    this.lock = n;
    if (this.fire) this.fire.material = n > 0 ? m.emberCold : m.emberHot;
    if (n > 0 && !this.lockGroup) {
      const g = new THREE.Group();
      const lid = new THREE.Mesh(new THREE.BoxGeometry(this.w - 0.12, 0.03, this.d - 0.12), m.lid.clone()); // own materials: they fade out on unlock
      lid.position.y = 0.62;
      g.add(lid);
      for (const s of [-1, 1]) {
        const len = Math.hypot(this.w, this.d) * 0.95;
        const chain = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.07), Object.assign(m.chain.clone(), { transparent: true }));
        chain.position.y = 0.66;
        chain.rotation.y = s * Math.atan2(this.d, this.w);
        chain.castShadow = true;
        g.add(chain);
      }
      this.badgeMat = new THREE.SpriteMaterial({ map: badgeTexture(String(n), { icon: 'lock' }), depthTest: false, toneMapped: false });
      const badge = new THREE.Sprite(this.badgeMat);
      badge.scale.setScalar(0.62);
      badge.position.set(0, 0.85, this.d / 2 - 0.15);
      badge.renderOrder = 10;
      g.add(badge);
      this.badge = badge;
      this.lockGroup = g;
      this.group.add(g);
    } else if (n > 0 && this.badgeMat) {
      this.badgeMat.map.dispose();
      this.badgeMat.map = badgeTexture(String(n), { icon: 'lock' });
      this.pulse = 1;
    } else if (n === 0 && this.lockGroup) {
      if (instant) {
        this.group.remove(this.lockGroup);
        this.lockGroup = null;
      } else this.unlocking = 1;
    }
  }

  setLayers(n) {
    if (this.layerGroup) {
      this.group.remove(this.layerGroup);
      this.layerGroup = null;
    }
    this.layers = n;
    if (!n) return;
    const m = materials();
    const g = new THREE.Group();
    for (let i = 0; i < Math.min(n, 3); i++) {
      const plate = new THREE.Mesh(cached(`plate:${this.w.toFixed(2)}`, () => new RoundedBoxGeometry(this.w - 0.1, 0.07, 0.5, 2, 0.03)), m.layerPlate);
      plate.position.set(0, -0.3 + i * 0.02, -this.d / 2 - 0.12 - i * 0.16);
      plate.castShadow = plate.receiveShadow = true;
      g.add(plate);
    }
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(`+${n}`, { ring: '#7fd3ff', bg: '#20303c' }), depthTest: false, toneMapped: false }));
    badge.scale.setScalar(0.5);
    badge.position.set(this.w / 2 - 0.1, 0.45, -this.d / 2 + 0.05);
    badge.renderOrder = 10;
    g.add(badge);
    this.layerGroup = g;
    this.group.add(g);
  }

  update(dt) {
    this.time += dt;
    const k = 1 - Math.pow(0.0005, dt);
    this.glowLevel += (this.glowTarget - this.glowLevel) * k;
    this.dim += (this.dimTarget - this.dim) * k;
    this.flash = Math.max(0, this.flash - dt * 2.6);
    const lv = this.glowLevel;
    const wave = 0.5 + 0.5 * Math.sin(this.time * 6.5); // valid targets breathe so they read without hover
    const valid = Math.min(1, lv) * (0.42 + 0.33 * wave) + Math.max(0, lv - 1) * 0.25;
    this.glowMat.color.copy(lv > 1.2 ? HOVER : VALID).lerp(INVALID, this.flash);
    this.glowMat.opacity = Math.max(valid, this.flash * 0.9);
    this.dimMat.opacity = this.dim * 0.62 + this.flash * 0.25;
    this.dimMat.color.setRGB(0.05 + this.flash * 0.6, 0.02, 0.03);
    const st = this.style;
    for (const r of this.slotRings) {
      r.ring.material.opacity = r.empty ? (r.dim ? 0.08 : st.ringOpacity * (1 - 0.6 * this.dim)) : 0;
      r.disc.material.opacity = r.target ? 0.6 : r.candidate ? st.candidateOpacity * (0.45 + 0.55 * wave) : 0;
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      this.group.position.x = this.homeX + Math.sin(this.time * 60) * this.shake * 0.35;
    } else if (this.group.position.x !== this.homeX) this.group.position.x = this.homeX;
    if (this.pulse > 0 && this.badge) {
      this.pulse = Math.max(0, this.pulse - dt * 3);
      this.badge.scale.setScalar(0.62 * (1 + 0.35 * Math.sin(this.pulse * Math.PI)));
    }
    if (this.unlocking > 0 && this.lockGroup) {
      this.unlocking -= dt * 2.2;
      const t = 1 - Math.max(0, this.unlocking);
      this.lockGroup.position.y = t * t * 2.2;
      this.lockGroup.rotation.z = t * 0.5;
      this.lockGroup.traverse((o) => o.material && (o.material.opacity = 1 - t));
      if (this.unlocking <= 0) {
        this.group.remove(this.lockGroup);
        this.lockGroup = null;
      }
    }
  }
}
