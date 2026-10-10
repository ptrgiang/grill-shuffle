// The Three.js stage: renderer, orthographic camera framed on the board, light rig and backdrop, all coloured by the
// theme (content/themes/*.json, shared/themes.js). Knows nothing about rules. The board view (board.js) puts things on it.
import * as THREE from 'three';
import { materials, tickMaterials, setEmberDetail, applyMaterialTheme } from './materials.js';
import { resolveTheme, withLook } from '../../shared/themes.js';
import { TIERS } from './quality.js';
import { CAMERA_ELEVATION } from './layout.js';
import { softDot } from './textures.js';
import { createDecor } from './decor.js';

const urlFlag = (name) => typeof location !== 'undefined' && new URLSearchParams(location.search).get(name) === '1';

export class Stage {
  /**
   * @param canvas  the <canvas>
   * @param opts    { theme, shadows, pixelRatioMax, frozen }
   *                theme: a theme file (partial is fine: shared/themes.js fills in the defaults)
   *                frozen: stills for pixel-compared screenshots. The stage clock stands still (no ember drift, no
   *                bulb flicker) and the board pins its idle oscillations, but the view still gets real dt so fades
   *                and moves settle into their end state. Default: the page URL has ?freeze=1.
   */
  constructor(canvas, { theme = {}, shadows = true, pixelRatioMax = 2, preserveDrawingBuffer = false, frozen = urlFlag('freeze') } = {}) {
    this.canvas = canvas;
    this.frozen = frozen;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap is gone from three r18x
    this.pixelRatioMax = pixelRatioMax;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color();
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    this.cameraDistance = 30;
    this.focus = new THREE.Vector3();
    this.viewBox = { width: 8, depth: 6, height: 1, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 };
    this.shake = 0;

    this.#lights();
    this.#backdrop();
    this.setTheme(theme);
    this.time = 0;
    this.updaters = new Set();
    this.tier = null;
    this.onTier = null; // (name, tier) => void: board view / particles follow the tier
    this.resize();
  }

  /** Apply a quality tier (render/quality.js TIERS): pixel ratio, shadow map, ember shader detail. */
  setQuality(name) {
    const t = TIERS[name];
    if (!t || this.tierName === name) return;
    const prev = this.tier;
    this.tierName = name;
    this.tier = t;
    this.pixelRatioMax = t.pixelRatio;
    const sm = this.renderer.shadowMap;
    const enabled = t.shadows !== 'off';
    if (sm.enabled !== enabled) {
      sm.enabled = enabled;
      this.scene.traverse((o) => {
        if (!o.material) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true; // shadow code is compiled in
      });
    }
    if (enabled && prev?.shadowMap !== t.shadowMap) {
      this.key.shadow.mapSize.set(t.shadowMap, t.shadowMap);
      this.key.shadow.map?.dispose();
      this.key.shadow.map = null;
    }
    setEmberDetail(t.ember);
    this.resize();
    this.onTier?.(name, t);
  }

  /**
   * Colour the whole stage for a theme: background, lights, exposure, table, grills (shared materials), vignette and
   * backdrop, dressed in one of the theme's looks (by name, #95: surface, overlay, props). Cheap when neither changed.
   */
  setTheme(theme = {}, look = null) {
    if (this.theme && theme.id && this.theme.id === theme.id && (this.theme.look?.name ?? null) === (look && theme.looks?.[look] ? look : null)) return;
    const t = withLook(resolveTheme(theme), look);
    this.theme = t;
    this.scene.background.set(t.palette.background);
    this.renderer.toneMappingExposure = t.lights.exposure;
    this.hemi.color.set(t.lights.sky);
    this.hemi.groundColor.set(t.lights.ground);
    this.hemi.intensity = t.lights.skyIntensity;
    this.key.color.set(t.lights.key);
    this.key.intensity = t.lights.keyIntensity;
    this.rim.color.set(t.lights.rim);
    this.rim.intensity = t.lights.rimIntensity;
    applyMaterialTheme(t);
    this.#decor(t);
    this.#vignetteTexture(t.palette.vignette);
    this.#bulbs(t.backdrop);
    if (this.size) this.#fit();
  }

  #lights() {
    // fixed rig: hemisphere fill + one key that casts shadows + a low rim light from behind (colours: setTheme)
    this.hemi = new THREE.HemisphereLight();
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight();
    this.key.position.set(-6, 14, 8);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.radius = 4;
    const sc = this.key.shadow.camera;
    sc.left = -9;
    sc.right = 9;
    sc.top = 9;
    sc.bottom = -9;
    sc.near = 1;
    sc.far = 40;
    this.scene.add(this.key, this.key.target);
    this.rim = new THREE.DirectionalLight();
    this.rim.position.set(6, 4, -8);
    this.scene.add(this.rim);
  }

  #backdrop() {
    const m = materials();
    // the table: a big plank surface the grills stand on
    const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), m.table);
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.36;
    table.receiveShadow = true;
    this.scene.add(table);
    this.table = table;
    // backdrop sprites (bokeh: string lights / lanterns) drifting at the far edge of the table, built by setTheme
    this.bulbs = new THREE.Group();
    this.scene.add(this.bulbs);
    // vignette-ish darkening ring on the table edges (texture: setTheme)
    this.vignette = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    this.vignette.rotation.x = -Math.PI / 2;
    this.vignette.position.y = -0.34;
    this.vignette.renderOrder = -1;
    this.scene.add(this.vignette);
  }

  #decor(t) {
    if (this.decor) {
      this.scene.remove(this.decor.group);
      this.decor.dispose();
    }
    this.decor = createDecor(t);
    this.scene.add(this.decor.group);
    if (this.decor.surface) {
      const m = materials();
      m.table.map = this.decor.surface;
      m.table.color.set('#ffffff');
      m.table.needsUpdate = true;
    }
  }

  #vignetteTexture(color) {
    const vg = document.createElement('canvas');
    vg.width = vg.height = 256;
    const g = vg.getContext('2d');
    const c = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)).join(',');
    const grad = g.createRadialGradient(128, 128, 40, 128, 128, 128);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.7, `rgba(${c},0.35)`);
    grad.addColorStop(1, `rgba(${c},0.9)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const mat = this.vignette.material;
    mat.map?.dispose();
    mat.map = new THREE.CanvasTexture(vg);
    mat.needsUpdate = true;
  }

  /** Backdrop preset `bokeh`: soft additive sprites; `none`: nothing. */
  #bulbs({ preset, colors, count, opacity, size, height }) {
    for (const b of this.bulbs.children) b.material.dispose();
    this.bulbs.clear();
    this.bulbStyle = { size, height };
    if (preset !== 'bokeh') return;
    const dot = softDot();
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: colors[i % colors.length], transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      s.userData.phase = i * 1.7;
      s.userData.base = opacity + (i % 3) * 0.12;
      this.bulbs.add(s);
    }
  }

  /** Frame a board of this size (world units) inside the screen area left free by the HUD (pixels).
   *  marginSide sets both sides; marginLeft / marginRight override it (landscape HUD columns). */
  frame({ width, depth, height = 1.2, marginTop = 0, marginBottom = 0, marginSide = 0, marginLeft = marginSide, marginRight = marginSide }) {
    this.viewBox = { width, depth, height, marginTop, marginBottom, marginLeft, marginRight };
    this.#fit();
  }

  #fit() {
    const { width, depth, height, marginTop, marginBottom, marginLeft, marginRight } = this.viewBox;
    const W = this.size.w, H = this.size.h;
    const availW = Math.max(100, W - marginLeft - marginRight), availH = Math.max(100, H - marginTop - marginBottom);
    const s = Math.sin(CAMERA_ELEVATION), c = Math.cos(CAMERA_ELEVATION);
    const projW = width + 0.6;
    const projH = depth * s + height * c + 0.6;
    const wpp = Math.max(projW / availW, projH / availH); // world units per pixel
    this.worldPerPixel = wpp;
    // asymmetric frustum so the board centres in the free area, not the whole screen
    const shiftPx = (marginTop - marginBottom) / 2, shiftX = (marginLeft - marginRight) / 2;
    const halfW = (W * wpp) / 2, halfH = (H * wpp) / 2;
    this.camera.left = -halfW - shiftX * wpp;
    this.camera.right = halfW - shiftX * wpp;
    this.camera.top = halfH + shiftPx * wpp;
    this.camera.bottom = -halfH + shiftPx * wpp;
    const dir = new THREE.Vector3(0, s, c);
    this.camera.position.copy(this.focus).addScaledVector(dir, this.cameraDistance);
    this.camera.lookAt(this.focus);
    this.camera.updateProjectionMatrix();
    // backdrop pieces follow the frame
    const zOf = (v) => this.focus.z - v / s; // a screen offset (world units) -> z on the table
    // the look's props stay in the area the HUD leaves free (a sideways phone's columns cover the sides)
    const vx0 = this.focus.x + this.camera.left, vx1 = this.focus.x + this.camera.right;
    this.decor?.fit({ x0: vx0 + marginLeft * wpp, x1: vx1 - marginRight * wpp, z0: zOf(this.camera.top), z1: zOf(this.camera.bottom), w: width, d: depth, vx0, vx1 });
    const span = Math.max(W, H) * wpp * 1.6;
    this.vignette.scale.set(span, span * 1.2, 1);
    const farZ = -depth / 2 - 1.6 - (marginTop * wpp) / s;
    const { size, height: bulbY } = this.bulbStyle;
    this.bulbs.children.forEach((b, i) => {
      const u = i / Math.max(1, this.bulbs.children.length - 1);
      const x = (u - 0.5) * span * 0.9;
      b.userData.pos = new THREE.Vector3(x, bulbY - Math.sin(u * Math.PI) * 0.25 + (i % 2) * 0.12, farZ - 1.2 + Math.sin(u * 9) * 0.4);
      b.position.copy(b.userData.pos);
      b.scale.setScalar(size + (i % 3) * 0.2);
    });
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width || this.canvas.clientWidth || 300));
    const h = Math.max(1, Math.round(r.height || this.canvas.clientHeight || 150));
    this.size = { w, h };
    this.renderer.setPixelRatio(Math.min(this.pixelRatioMax, window.devicePixelRatio || 1));
    this.renderer.setSize(w, h, false);
    this.#fit();
  }

  /** World point -> CSS pixel position on the canvas. */
  toScreen(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.size.w, y: (-p.y * 0.5 + 0.5) * this.size.h };
  }

  /** CSS pixel -> point on the horizontal plane y = planeY. */
  toPlane(px, py, planeY = 0, out = new THREE.Vector3()) {
    const ndc = new THREE.Vector3((px / this.size.w) * 2 - 1, -(py / this.size.h) * 2 + 1, -1);
    const origin = ndc.clone().unproject(this.camera);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const t = (planeY - origin.y) / dir.y;
    return out.copy(origin).addScaledVector(dir, t);
  }

  addShake(amount) {
    this.shake = Math.min(0.25, this.shake + amount);
  }

  render(dt) {
    this.time += dt;
    tickMaterials(this.time);
    for (const f of this.updaters) f(dt, this.time);
    for (const b of this.bulbs.children) {
      b.material.opacity = b.userData.base + 0.12 * Math.sin(this.time * 1.3 + b.userData.phase);
      if (b.userData.pos) b.position.y = b.userData.pos.y + Math.sin(this.time * 0.6 + b.userData.phase) * 0.04;
    }
    if (this.shake > 0.001) {
      const s = this.shake;
      this.camera.position.x += (Math.random() - 0.5) * s * 0.4; // presentation only: never feeds the simulation
      this.camera.position.z += (Math.random() - 0.5) * s * 0.3;
      this.renderer.render(this.scene, this.camera);
      this.#fit();
      this.shake *= Math.pow(0.002, dt);
    } else this.renderer.render(this.scene, this.camera);
  }

  /**
   * requestAnimationFrame loop. `gate(dt)` (optional) returns the dt to render with, or 0 to skip this frame
   * (render on demand); `onFrame(dt)` advances the view before the render; `onRendered(info)` gets
   * { dt, cpuMs, calls, triangles } after it. dt is clamped to 50 ms, so a slow device animates slower, never skips.
   * Stops while the page is hidden and restarts without a jump when it comes back.
   */
  start(onFrame, { gate = null, onRendered = null } = {}) {
    let last = performance.now();
    const loop = (now) => {
      const raw = (now - last) / 1000;
      last = now;
      const step = this.frozen ? raw : gate ? gate(raw) : raw;
      if (step > 0) {
        const dt = Math.min(0.05, step);
        const t0 = performance.now();
        onFrame?.(dt);
        this.render(this.frozen ? 0 : dt);
        const info = this.renderer.info.render;
        onRendered?.({ dt: step, cpuMs: performance.now() - t0, calls: info.calls, triangles: info.triangles, pixelRatio: this.renderer.getPixelRatio() });
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    if (!this.onVisibility && typeof document !== 'undefined') {
      this.onVisibility = () => {
        cancelAnimationFrame(this.raf);
        if (document.visibilityState === 'hidden') return;
        last = performance.now();
        this.raf = requestAnimationFrame(loop);
      };
      document.addEventListener('visibilitychange', this.onVisibility);
    }
  }

  stop() {
    cancelAnimationFrame(this.raf);
    if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility);
    this.onVisibility = null;
  }

  /** Something on screen moves (camera shake). */
  get busy() {
    return this.shake > 0.001;
  }
}
