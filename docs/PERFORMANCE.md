# Performance

## Budget

60 fps desktop and modern phones, 30 fps acceptable on low-end. A board has at most ~12 grills and ~40 items.

## What a frame costs (by construction)

- One draw call per item (merged vertex-coloured geometry) — ≤ ~40.
- Per grill: fire, body, grate, handles, glow, slot rings (≈ 6 + 2 × slots), cached geometry.
- Two particle draw calls total (pooled, fixed 700 + 260 points, no per-frame allocation).
- Fixed light rig: hemisphere + one shadow-casting directional (1024² map on high) + rim. Light count never changes.
- Materials shared; food materials compiled once per program key (`gs-food-1`).
- Pixel ratio capped per quality tier (2 / 1.5 / 1).

## Quality tiers (`client/render/quality.js`)

| tier | pixel ratio | shadows | ember shader | particles |
|---|---|---|---|---|
| high | ≤ 2 | PCF, 1024² | two drifting layers + flicker | 100 % |
| medium | ≤ 1.5 | PCF, 512² | same | 60 % |
| low | 1 | off; soft blob under each item | one still layer | 35 % |

`BasicShadowMap` was tried for medium and dropped: at 512² the grill shadows get jagged, hairy edges.

- **Start**: the Graphics setting (pause menu: Auto / High / Med / Low) wins; in Auto, the tier auto mode settled on last
  time on this device (`settings.autoTier`); without history, high, or medium when the browser reports ≤ 2 GB memory
  or ≤ 4 cores (`initialTier`).
- **Auto-downgrade** (`FrameMonitor`): busy frames only (idle ticks are slow on purpose); when the average frame
  interval stays over 20 ms for 2 s, one tier down, saved as `autoTier`. Frames over 250 ms (tab switch, first shader
  compile) are not counted. Choosing Auto again clears `autoTier` and measures from the top.
- **Render on demand** (`IdleGate`): every frame while the board is busy (`BoardView.busy`: timeline, matches, drag,
  selection, hint, a burst in the air, fading glows, camera shake) and for 0.6 s after; when still, 12 frames/s
  (ember flicker and bulbs keep moving, the GPU mostly sleeps). Pointer input and resizes wake it at once.
  A scene change that is not an animation (new state, layout, slot markers, theme, quality, size) calls
  `Stage.invalidate()`, which counts as busy until the next frame is drawn, so it shows at once instead of on the next
  idle tick. A frozen stage (`?freeze=1`, screenshots) goes through the same gate but draws no idle frames
  (`FROZEN_IDLE_FPS = 0`): they are all the same picture. Before, it skipped the gate and redrew that picture as fast
  as it could: in SwiftShader at 390 × 844 @3× with shadows, ~9 cores busy between captures; now ~0.
  `npm run variant-shots` (5 variants × 2 pages + 2 sheets, headless Chrome CPU incl. renderers): 269 core-s before,
  126 after this fix, 47 with the GPU for captures people look at (`launchChrome({ gpu: true })`, docs/RENDERING.md).
- **Hidden page**: the rAF loop stops on `visibilitychange` and restarts without a time jump.
- `?quality=high|medium|low` forces a tier for one visit (testing, screenshots: `quality-*.png` in `npm run shot -- --set`).

## Measuring: `?stats=1`

A corner overlay, averaged over 0.5 s: rendered fps, frame interval (avg + max), CPU ms per frame (view update +
`render()` call; GPU time is not visible from JS), draw calls, triangles, tier, busy / idle, render / device pixel
ratio. On a phone: open `https://banamgrill.thebuilder.work/saigon-alley/27?stats=1&quality=low` (or medium / high), make
a few moves, read the busy numbers.

We have not needed instancing: ~100 draw calls is far from a problem. If profiling ever says otherwise, the plan is
one `InstancedMesh` per food variant with transient meshes for animating items (the item view already separates
`holder` from `mesh`).

## Measured

Real devices: not recorded yet (follow-up issue). Fill in per device: model, browser, tier, busy fps / frame ms,
idle fps, calls, triangles, on `/saigon-alley/27?stats=1`.

| device | browser | tier | busy fps (ms) | idle fps | calls | tris |
|---|---|---|---|---|---|---|
| | | | | | | |

Headless reference, `/play/street-009` at 390 × 844 @3× in SwiftShader: high 97 calls / 55.2k triangles, low
85 calls / 30.0k (no shadow pass); CPU per frame 2–3 ms in every tier, so on real phones the GPU (fill rate: pixel
ratio, shadow pass, ember shader) is the cost the tiers cut.

Looks (#95, props beside the board): low tier, 390 × 844, `/saigon-alley/3` (sidewalk: two stools, two cups, a
coal) 89 → 116 calls, 35.3k → 36.2k triangles; `/saigon-alley/19` (night) 89 → 109; `/saigon-alley/2` (cart)
71 → 82; CPU per frame unchanged (~1 ms). Props merge their repeated parts (stool legs, ice cubes) into one mesh.

The counter band (#91, its own 2D canvas and rAF loop, drawn only while something moves): on the low tier it draws at
~15 fps without the paper grain. Headless, low tier, `/saigon-alley/27` while it serves: the board's CPU per frame
1.1 ms at 390 × 844 (as before), 1.2 → 1.4 ms at 844 × 390 (sideways phones now get the band).

- Headless Chrome with **SwiftShader** (software GL, no GPU) at 1280 × 800: ~8 fps; 390 × 844 @3×: ~6 fps.
  Not a target measurement, only a floor: the animation clock clamps dt to 50 ms, so animations run slower there
  but never skip. Measure real devices with the browser's performance panel on `/sandbox/board`.
- Solver: ~20–35k states/s in Node (`npm run bench:solver`); the generator and hints run in a Web Worker.
- Bundle: ~160 KB gzip JS (three.js is most of it), 3 KB CSS, no images, no audio files.

## Rules

Measure before optimising; `npm run bench:solver` before/after any change to shared hot paths. No allocation in
per-frame paths except the small scratch vectors already in `BoardView.update`.
