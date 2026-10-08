// Pooled particles: a fixed number of points per system, CPU-updated, one draw call per system.
// Two systems: additive (flame, sparks, embers) and normal-blended (smoke, steam). Never allocates per frame.
import * as THREE from 'three';
import { softDot } from './textures.js';

const VERT = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
varying float vAlpha; varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha; vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale;
}`;
const FRAG = `
uniform sampler2D uMap; varying float vAlpha; varying vec3 vColor;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  if (t.a * vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, t.a * vAlpha);
}`;

class System {
  constructor(max, blending) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.color = new Float32Array(max * 3);
    this.p = Array.from({ length: max }, () => ({ life: 0, age: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, s0: 0, s1: 0, a0: 0, c0: new THREE.Color(), c1: new THREE.Color() }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: softDot() }, uScale: { value: 40 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending,
      toneMapped: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    this.next = 0;
    this.live = 0;
  }

  spawn(o) {
    // ring buffer: the oldest particle is reused when full
    const p = this.p[this.next];
    this.next = (this.next + 1) % this.max;
    p.life = o.life;
    p.age = 0;
    p.x = o.x;
    p.y = o.y;
    p.z = o.z;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.vz = o.vz ?? 0;
    p.g = o.g ?? 0;
    p.drag = o.drag ?? 0;
    p.s0 = o.s0;
    p.s1 = o.s1 ?? o.s0;
    p.a0 = o.a ?? 1;
    p.c0.set(o.c0);
    p.c1.set(o.c1 ?? o.c0);
  }

  update(dt) {
    let live = 0;
    const tmp = this._c || (this._c = new THREE.Color());
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.age >= p.life) {
        this.alpha[i] = 0;
        continue;
      }
      live++;
      p.age += dt;
      const t = Math.min(1, p.age / p.life);
      const d = Math.pow(1 - p.drag, dt * 60);
      p.vx *= d;
      p.vz *= d;
      p.vy = p.vy * d - p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      this.size[i] = p.s0 + (p.s1 - p.s0) * t;
      this.alpha[i] = p.a0 * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
      tmp.copy(p.c0).lerp(p.c1, t);
      this.color[i * 3] = tmp.r;
      this.color[i * 3 + 1] = tmp.g;
      this.color[i * 3 + 2] = tmp.b;
    }
    this.live = live;
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.aColor.needsUpdate = true;
  }
}

export class Particles {
  constructor(scene) {
    this.add = new System(700, THREE.AdditiveBlending);
    this.soft = new System(260, THREE.NormalBlending);
    scene.add(this.add.points, this.soft.points);
    this.density = 1; // quality tier multiplier on spawn counts
    this.burstFor = 0; // seconds a burst / steam / poof is still in the air (ambient embers do not count)
  }

  /** Spawn count for `n` at the current density (at least 1 when n > 0). */
  #n(n) {
    return n > 0 ? Math.max(1, Math.round(n * this.density)) : 0;
  }

  /** A burst is still playing: the board renders every frame until it ends. */
  get busy() {
    return this.burstFor > 0;
  }

  /** pixels per world unit, so point sizes are in world units */
  setScale(pxPerWorld) {
    this.add.material.uniforms.uScale.value = pxPerWorld;
    this.soft.material.uniforms.uScale.value = pxPerWorld;
  }

  update(dt) {
    this.burstFor = Math.max(0, this.burstFor - dt);
    this.add.update(dt);
    this.soft.update(dt);
  }

  /** The match burst: a flame column, sparks flying out, a puff of smoke. intensity grows with the combo. */
  flameBurst(at, intensity = 1) {
    this.burstFor = Math.max(this.burstFor, 1.6);
    const n = this.#n(34 * intensity);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.55;
      this.add.spawn({ x: at.x + Math.cos(a) * r, y: at.y + 0.05, z: at.z + Math.sin(a) * r * 0.5, vx: Math.cos(a) * 0.3, vy: 1.6 + Math.random() * 1.8, vz: Math.sin(a) * 0.2, drag: 0.04, life: 0.5 + Math.random() * 0.35, s0: 0.7, s1: 0.18, c0: '#ffd27a', c1: '#ff3d0a', a: 0.9 });
    }
    const sparks = this.#n(22 * intensity);
    for (let i = 0; i < sparks; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3.5;
      this.add.spawn({ x: at.x, y: at.y + 0.3, z: at.z, vx: Math.cos(a) * sp, vy: 2.5 + Math.random() * 3, vz: Math.sin(a) * sp * 0.6, g: 9, drag: 0.02, life: 0.5 + Math.random() * 0.45, s0: 0.11, s1: 0.04, c0: '#fff4c2', c1: '#ff8a1e' });
    }
    for (let i = 0, k = this.#n(6); i < k; i++) this.soft.spawn({ x: at.x + (Math.random() - 0.5) * 0.8, y: at.y + 0.4, z: at.z + (Math.random() - 0.5) * 0.3, vy: 0.6 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.2, drag: 0.03, life: 1.1 + Math.random() * 0.5, s0: 0.5, s1: 1.4, c0: '#6a5a5a', c1: '#2a2228', a: 0.28 });
  }

  /** Little hiss when food lands: steam wisps. `ambient`: the idle wisps off food, which never keep the board busy. */
  steam(at, n = 4, { ambient = false } = {}) {
    if (!ambient) this.burstFor = Math.max(this.burstFor, 1.2);
    for (let i = 0, k = this.#n(n); i < k; i++) this.soft.spawn({ x: at.x + (Math.random() - 0.5) * 0.35, y: at.y + 0.2, z: at.z + (Math.random() - 0.5) * 0.2, vy: 0.5 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.15, drag: 0.02, life: 0.8 + Math.random() * 0.4, s0: 0.25, s1: 0.7, c0: '#fff6ee', c1: '#d8ccc4', a: 0.32 });
  }

  /** Ambient: occasional embers rising off a hot grill. */
  ember(at) {
    if (this.density < 1 && Math.random() > this.density) return;
    this.add.spawn({ x: at.x, y: at.y, z: at.z, vx: (Math.random() - 0.5) * 0.3, vy: 0.6 + Math.random() * 0.8, vz: (Math.random() - 0.5) * 0.1, drag: 0.01, life: 1 + Math.random(), s0: 0.06, s1: 0.02, c0: '#ffcc66', c1: '#ff4a10', a: 0.9 });
  }

  /** Fan booster: streaks of air sweeping across the board from the left, a little smoke carried along. */
  gust(width, depth) {
    this.burstFor = Math.max(this.burstFor, 1.1);
    const x0 = -width / 2 - 0.6;
    for (let i = 0, k = this.#n(40); i < k; i++) {
      const z = (Math.random() - 0.5) * (depth + 0.6), sp = 5 + Math.random() * 4;
      this.soft.spawn({ x: x0 - Math.random() * 1.2, y: 0.25 + Math.random() * 0.7, z, vx: sp, vy: (Math.random() - 0.3) * 0.4, vz: (Math.random() - 0.5) * 0.4, drag: 0.012, life: (width + 1.8) / sp, s0: 0.18, s1: 0.5, c0: '#ffffff', c1: '#e8f2ff', a: 0.4 });
    }
    for (let i = 0, k = this.#n(10); i < k; i++) this.soft.spawn({ x: (Math.random() - 0.5) * width, y: 0.3, z: (Math.random() - 0.5) * depth, vx: 2.4 + Math.random(), vy: 0.5, drag: 0.03, life: 0.9, s0: 0.4, s1: 1.1, c0: '#8a7a78', c1: '#3a3036', a: 0.22 });
  }

  /** Reveal / unlock poof. */
  poof(at, color = '#d7ecff') {
    this.burstFor = Math.max(this.burstFor, 0.7);
    for (let i = 0, k = this.#n(14); i < k; i++) {
      const a = (i / k) * Math.PI * 2;
      this.soft.spawn({ x: at.x, y: at.y + 0.2, z: at.z, vx: Math.cos(a) * 1.6, vy: 0.4, vz: Math.sin(a) * 0.9, drag: 0.08, life: 0.6, s0: 0.35, s1: 0.8, c0: color, c1: '#ffffff', a: 0.45 });
    }
  }
}
