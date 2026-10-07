# Rendering, animation, input, audio

## Camera and layout

`OrthographicCamera` pitched 58° above the table (`render/layout.js` `CAMERA_ELEVATION`). Ortho keeps every grill
the same size wherever it sits, which matters more than depth on a phone. `layoutBoard` tries 1–4 columns and keeps
the one that shows the board largest in the area the HUD leaves free: portrait phones get one column (≈ 80 px slots
at 390 × 844), desktops two or three. `Stage.frame` fits that box with an asymmetric frustum so the board centres
between the HUD bars. `hitTest` uses the same numbers, so input never ray-casts meshes.

## Food

`render/foods.js`: `createShrimp/Beef/Chicken/Corn/Carrot/Salmon/Bread({ seed, cook, char, scale, variant })`.
Each food is one merged, vertex-coloured geometry built from primitives (tube with variable radius for the shrimp,
extruded noisy outlines for steak/salmon/toast, lathe for drumstick/carrot, displaced capsule for corn). Three
geometry variants per food; per item the seed picks a variant, a small yaw and ±4 % scale.

### Food lineup and palette

Every pair must be told apart at phone size (≈ 80 px slots at 390 px) by silhouette **and** colour. Check with
`/sandbox/food?spin=0&ui=0` at 390 px (portrait lays one food per row) and the `food-lineup-390.png` shot.

| Food | Code | Silhouette (top view) | Main colours | Kept apart from |
|---|---|---|---|---|
| Steak (`beef`) | `b` | round slab, **white fat rim** | `#93301f` red, `#5e1c10` sides, `#f3e2cf` fat | toast, salmon (slabs) |
| Shrimp | `s` | **curled C**, red tail fan, eye | `#ff6f45` shell, `#ffd2b8` belly, `#c8442a` lines | carrot, salmon (oranges) |
| Drumstick (`chicken`) | `c` | club + **white bone** with knuckles | `#d4842e` golden, `#9a5318` crisp, `#f4ebd9` bone | carrot (long, orange-brown) |
| Corn | `k` | long cylinder, kernel grid, pale husk | `#f7c623` kernels, `#c98b0c` gaps, `#cfe39a` husk | carrot (greens) |
| Carrot | `r` | **pointed cone + bushy greens** | `#ff8410` / `#d65a06` rings, `#4f9e2f`/`#5cc23a` greens | shrimp, drumstick, corn |
| Salmon | `l` | fillet with rounded back, **dark skin rim**, white fat lines | `#f98479` coral-pink, `#cf544c` sides, `#3a3f49`–`#6b7480` skin | shrimp (hue), steak/toast (slab) |
| Toast (`bread`) | `d` | square slice with **two-lobed crust top** | `#f6e0a8` crumb, `#b4702f` crust | steak, salmon (slabs) |

Rules of thumb: only steak has a light rim, only salmon a dark one; only shrimp curls; long foods (drumstick, corn,
carrot) differ in their ends (bone / husk / greens). New foods (#20 follow-up) must keep this table unambiguous.

Material (`render/materials.js`): `MeshStandardMaterial` + shader patch with `uCook`, `uChar`,
`uGrillMarkStrength`, `uGrillMarkAngle`, `uMarkFreq`, `uStripe*`. Grill marks are computed from object-space
position, only on upward faces, masked by the per-vertex `aSear` attribute (meat sears, bone/husk/leaves don't).
No texture per food.

## Grills

`render/grill.js` `GrillView`: walls, animated ember bed (`ShaderMaterial`, hot/cold), merged grate bars, handles,
slot rings, drop-target glow, lock overlay (lid, chains, padlock counter sprite), stacked-tray plates + `+N` badge.
Prep trays are wooden boards. Geometry cached per slot count.

## Animation

`render/board.js` `BoardView.play(next, events)` turns events into a timeline (`TIMING`): move arc 170 ms (drag
release 90 ms), landing squash + steam; per chain: pop 80 ms → converge 140 ms → flame burst, sparks, smoke, small
camera shake → serve 220 ms; lock counters on the burst; reveals after the matches; result screen after everything.
`reconcile()` always converges on the state. `animations: false` / `?anim=0` snaps (screenshots, tests).

## Input

`game/input.js`, Pointer Events only (mouse, touch, pen share one path). Press an item → it lifts and valid grills
glow. Drag past 7 px → it follows the pointer; release over a grill drops into the aimed slot or the nearest free
one. Release without dragging → it stays selected; tap a grill (or an item on a grill with room) to send it.
`touch-action: none` on the canvas.

## Audio

`audio/synth.js` generates every sound (thud, sizzle with crackle, sparkle, bell notes, metallic clank, whoosh,
ambience loop); `audio/audio.js` plays them through a compressor. Match sound = impact + sizzle + sparks + two-note
serve chime; combo raises the chime's pitch, adds an octave layer at x2, brightness at x3, a flourish at x4+.

## Sandboxes

`/sandbox/food` (lineup, `?grills=1`, sliders for cook/char/marks, `?spin=0` for stills, `?ui=0` hides the panel;
portrait windows lay out one food per row),
`/sandbox/board` (any level or share code, solver stats, step / auto-play the solution, `?anim=0`).
Screenshots: `npm run shot -- --set` (uses the safe launcher). Planned: /sandbox/grills, materials, match,
particles, themes, mobile.
