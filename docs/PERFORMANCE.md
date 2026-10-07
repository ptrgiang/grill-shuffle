# Performance

## Budget

60 fps desktop and modern phones, 30 fps acceptable on low-end. A board has at most ~12 grills and ~40 items.

## What a frame costs (by construction)

- One draw call per item (merged vertex-coloured geometry) — ≤ ~40.
- Per grill: fire, body, grate, handles, glow, slot rings (≈ 6 + 2 × slots), cached geometry.
- Two particle draw calls total (pooled, fixed 700 + 260 points, no per-frame allocation).
- Fixed light rig: hemisphere + one shadow-casting directional (1024² map) + rim. Light count never changes.
- Materials shared; food materials compiled once per program key (`gs-food-1`).
- Pixel ratio capped at 2.

We have not needed instancing: ~100 draw calls is far from a problem. If profiling ever says otherwise, the plan is
one `InstancedMesh` per food variant with transient meshes for animating items (the item view already separates
`holder` from `mesh`).

## Measured

- Headless Chrome with **SwiftShader** (software GL, no GPU) at 1280 × 800: ~8 fps; 390 × 844 @3×: ~6 fps.
  Not a target measurement, only a floor: the animation clock clamps dt to 50 ms, so animations run slower there
  but never skip. Measure real devices with the browser's performance panel on `/sandbox/board`.
- Solver: ~20–35k states/s in Node (`npm run bench:solver`); the generator and hints run in a Web Worker.
- Bundle: ~160 KB gzip JS (three.js is most of it), 3 KB CSS, no images, no audio files.

## Rules

Measure before optimising; `npm run bench:solver` before/after any change to shared hot paths. No allocation in
per-frame paths except the small scratch vectors already in `BoardView.update`.
