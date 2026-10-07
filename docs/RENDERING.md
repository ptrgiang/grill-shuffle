# Rendering, animation, input, audio

## Camera and layout

`OrthographicCamera` pitched 58° above the table (`render/layout.js` `CAMERA_ELEVATION`). Ortho keeps every grill
the same size wherever it sits, which matters more than depth on a phone. `layoutBoard` tries 1–4 columns and keeps
the one that shows the board largest in the area the HUD leaves free: portrait phones get one column (≈ 80 px slots
at 390 × 844), desktops two or three. `Stage.frame` fits that box with an asymmetric frustum (vertical and
horizontal) so the board centres in the free area. `hitTest` uses the same numbers, so input never ray-casts meshes.

The free area is measured, not guessed (`ui/fit.js`): after layout, the HUD (or menu) rects push the margins
(`marginsFrom`), on top of the safe-area insets. It is re-measured on `resize`, `orientationchange`,
`visualViewport` resize (address bar) and when the web font arrives. Phones held sideways (`SHORT_LANDSCAPE`,
landscape and ≤ 520 px tall) get side columns: pause / moves / level / goals / tip on the left, tools on the right,
so the board keeps the full height. The level hint sits over the goal chips, never over the board. `npm run test:e2e`
checks at 360×640, 390×844, 430×932, 844×390 and 1280×800 that no HUD or menu element covers the board and every
control is at least 44 × 44 px.

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
Burn state (rules v2) is read from the item in `BoardView.reconcile`: a burning item carries a small counter badge
sprite, a charred item swaps to the cached `foodMaterial(food, { char: 1 })`; a `charred` event adds a smoke poof.
`/sandbox/board?level=street-012&anim=0&steps=1` shows charred food (`steps=N` plays N solution moves).

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
glow. Drag past the threshold → it follows the pointer; release over a grill drops into the aimed slot or the nearest
free one, and while dragging over a valid grill that slot's disc lights up (snap preview). Release without dragging →
it stays selected; tap a grill (or an item on a grill with room) to send it. `touch-action: none` on the canvas.

Per pointer type (`POINTER_TUNING`, overridable through `new Input(..., { tuning })`):

| | drag threshold | hit margin | carried item drawn |
|---|---|---|---|
| mouse | 7 px | 0.25 | at the cursor |
| pen | 9 px | 0.3 | at the pen |
| touch | 14 px | 0.45 | 72 px above the finger |

The lifted point (the "aim") is what hovers, previews and drops: the item lands where it is drawn, not under the
finger. Picking is pure math (`BoardView.pick` → `layout.hitTestSegment`): the pixel's ray is tested from the table
up to `PICK_TOP` (tallest item incl. lift), so a tap anywhere on a standing item's silhouette hits its slot. Touch
pick-ups and drops give an 8 ms haptic tick (`navigator.vibrate`) unless `settings.haptics` is `false`.

### Feedback without hover (touch)

Touch has no hover, so a selection alone has to answer "where can this go?" (`BoardView.setTargets(targets, from)`):
grills that accept the item breathe (pulsing glow rim) and their empty slots show pulsing green discs; every other
grill except the source gets a dark veil over its grate. Slot rings and the glow rim are sized in screen pixels
(`layout.markerStyle(pxPerWorld)`: rings at least ~5 px, stronger opacity below 70 px per world unit), so phones get
legible markers. A refused action (`flashInvalid`) flashes the grill red and shakes it with its food, plays the
`invalid` sound and buzzes (14-50-14 ms) on touch. Putting a selected item down without a move squashes it as it
touches the grate.

Onboarding (`ui/coach.js`): on the first story level, until it is won, a touch screen shows an animated hand that taps
the food, then the grill. The move is the first move of the level's solver `solution` (so it is always legal and
useful) and needs a level `hint`; after a selection the hand only taps the grill, the first move removes it.
`?coach=1` / `?coach=0` force it on / off (screenshots).

## Quality and frame pacing

Tiers, auto-downgrade, render on demand and `?stats=1`: [PERFORMANCE.md](PERFORMANCE.md). The stage applies a tier
(`Stage.setQuality`: pixel ratio, shadow map on/off and size, ember shader `EMBER_LOW` define); the board view
follows through `stage.onTier` (particle density, blob shadows).

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
