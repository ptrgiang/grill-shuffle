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
geometry variants per food; per item the seed picks a variant, a small yaw and ±4 % scale. Silhouette and colour
are distinct for every food (steak red + fat rim, shrimp curled orange, drumstick with bone, corn yellow cob + husk,
carrot cone + greens, salmon slab with fat lines, toast slice outline).

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

`/sandbox/food` (lineup, `?grills=1`, sliders for cook/char/marks, `?spin=0` for stills),
`/sandbox/board` (any level or share code, solver stats, step / auto-play the solution, `?anim=0`).
Screenshots: `npm run shot -- --set` (uses the safe launcher). Planned: /sandbox/grills, materials, match,
particles, themes, mobile.
