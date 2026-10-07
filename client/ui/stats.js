// `?stats=1` dev overlay: rendered fps, frame interval, CPU time per frame, draw calls, triangles, tier, busy / idle.
// Numbers are averaged over half a second; nothing is drawn into the WebGL canvas.
import { h } from './dom.js';

export class StatsOverlay {
  constructor(parent) {
    this.el = h('div.stats-overlay', { 'aria-hidden': 'true' });
    parent.append(this.el);
    this.reset(performance.now());
  }

  reset(now) {
    Object.assign(this, { t0: now, n: 0, dt: 0, cpu: 0, worstDt: 0 });
  }

  /** One rendered frame: { dt (s), cpuMs, calls, triangles } from Stage.start; { tier, busy } from the loop. */
  frame(info, { tier, busy }) {
    this.n++;
    this.dt += info.dt;
    this.cpu += info.cpuMs;
    this.worstDt = Math.max(this.worstDt, info.dt);
    const now = performance.now();
    if (now - this.t0 < 500) return;
    const s = (now - this.t0) / 1000;
    const tris = info.triangles >= 1000 ? `${(info.triangles / 1000).toFixed(1)}k` : String(info.triangles);
    this.el.textContent =
      `${(this.n / s).toFixed(0)} fps · ${((this.dt / this.n) * 1000).toFixed(1)} ms (max ${(this.worstDt * 1000).toFixed(0)})` +
      ` · cpu ${(this.cpu / this.n).toFixed(1)} ms\n${info.calls} calls · ${tris} tris · ${tier} · ${busy ? 'busy' : 'idle'}` +
      ` · px ${info.pixelRatio}/${devicePixelRatio}`;
    this.reset(now);
  }
}
