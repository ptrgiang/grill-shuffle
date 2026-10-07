// Procedural grills and prep trays. A GrillView is the visual of one board grill: body, fire, grate, slot rings,
// the lock overlay and the stacked-tray indicator. It is driven entirely by the board view; it holds no rules.
//
// Local frame: centred on the grill, items rest on y = 0 (the top of the grate), +z towards the player.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials } from './materials.js';
import { badgeTexture } from './textures.js';
import { grillWidth, slotOffsetX, GRILL_DEPTH } from './layout.js';

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

const ringGeo = () => cached('ring', () => new THREE.RingGeometry(0.3, 0.38, 32).rotateX(-Math.PI / 2));
const discGeo = () => cached('disc', () => new THREE.CircleGeometry(0.3, 32).rotateX(-Math.PI / 2));
const glowGeo = (w, d) => cached(`glow:${w.toFixed(2)}`, () => new RoundedBoxGeometry(w + 0.3, 0.02, d + 0.3, 2, 0.12));

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
    // drop-target / selection glow under the grill
    this.glowMat = m.highlight.clone();
    this.glow = new THREE.Mesh(glowGeo(this.w, this.d), this.glowMat);
    this.glow.position.y = -0.345;
    this.glow.renderOrder = 1;
    this.group.add(this.glow);
    // slot markers: faint rings on empty slots, a disc when a slot is the drop target
    this.slotRings = [];
    for (let s = 0; s < this.slots; s++) {
      const ring = new THREE.Mesh(ringGeo(), m.slotPad.clone());
      ring.position.set(slotOffsetX(s, this.slots), 0.012, 0);
      ring.renderOrder = 2;
      const disc = new THREE.Mesh(discGeo(), m.target.clone());
      disc.position.set(slotOffsetX(s, this.slots), 0.014, 0);
      disc.renderOrder = 2;
      this.group.add(ring, disc);
      this.slotRings.push({ ring, disc });
    }
    this.lockGroup = null;
    this.layerGroup = null;
    this.setLock(grill.lock ?? 0, { instant: true });
    this.setLayers(grill.layers?.length ?? 0);
    this.glowLevel = 0;
    this.glowTarget = 0;
    this.pulse = 0;
  }

  slotPosition(slot, out = new THREE.Vector3()) {
    return out.set(slotOffsetX(slot, this.slots), 0, 0).applyMatrix4(this.group.matrixWorld);
  }

  /** Empty-slot rings: visible, dimmed or hidden. */
  setSlotState(slot, { empty, target = false, dim = false }) {
    const { ring, disc } = this.slotRings[slot];
    ring.material.opacity = empty ? (dim ? 0.08 : 0.24) : 0;
    disc.material.opacity = target ? 0.55 : 0;
  }

  /** 0 = none, 1 = valid drop target, 2 = hovered target, -1 = invalid */
  setGlow(level) {
    this.glowTarget = level;
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
    const k = 1 - Math.pow(0.0005, dt);
    this.glowLevel += (this.glowTarget - this.glowLevel) * k;
    const lv = this.glowLevel;
    this.glowMat.opacity = Math.abs(lv) * 0.45;
    if (lv < 0) this.glowMat.color.set('#ff6b6b');
    else this.glowMat.color.set(lv > 1.2 ? '#b8ffb0' : '#ffe2a8');
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
