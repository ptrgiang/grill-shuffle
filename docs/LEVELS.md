# Levels and content

## Format (levelFormatVersion 1)

```json
{
  "formatVersion": 1,
  "id": "street-008",
  "name": "Stack Attack",
  "theme": "street_bbq",
  "tier": "normal",
  "moves": 10,
  "board": {
    "grills": [
      {"slots": ["shrimp", "corn", null], "layers": [["beef", "beef", "chicken"]]},
      {"slots": ["chicken", "corn", "beef"]},
      {"slots": ["shrimp", null, "corn"], "layers": [["shrimp", "chicken", null]]},
      {"slots": [null, null, null]}
    ]
  },
  "goals": [{"type": "clear_all"}],
  "modifiers": ["stacked_tray"],
  "hint": "Two grills hide stacked trays. Which one do you open first?",
  "solver": { "minMoves": 7, "difficulty": 42, "rating": "hard", "states": 3014, "solution": "m0.0-3.0 …" }
}
```
Grill fields: `type` (`grill` | `tray`), `slots`, optional `layers` (each exactly as long as `slots`), optional
`lock`. A slot is `null`, a food id, or a burning item `{"food": "shrimp", "burn": 4}` (rules v2, modifier
`burn_counter`; see docs/PUZZLE.md). `tier` decides the move budget from the solver minimum; `moves` and `solver` are **written by tooling**
(`npm run solve -- <id> --write`), never by hand. No level carries code.

## Packs

`content/levels/<pack>/pack.json` lists level ids in play order; the client bundles every pack at build time.
Packs play in `order` (then id).

### Unlocks

`client/game/unlock.js` (pure). The first pack is open. Pack k opens when **every level of pack k-1 has a star and**
the story star total reaches its theme's `unlock.stars`; once one of its levels has a star it stays open (appended
levels or a raised requirement never lock a player out). Inside a pack levels open one by one (previous level won).
Only story stars count, not dailies or challenges. The level select groups by pack: a locked pack shows its theme
swatch and what it needs ("Finish Street BBQ and earn ★ 75"), its levels are not links. The level select has one
**tab per pack** (`/levels/<slug>`, the theme's icon, name, stars or the requirement); plain `/levels` opens the tab of the
pack "Continue" is in. A deep link into a locked pack lands on that pack's tab with a toast; "Continue" and the result screen's "Next level" never enter a locked pack
(the result screen offers "Levels" instead). The menu wears the theme of the level "Continue" opens.

Shipped: Street BBQ, then Beach Grill (★ 75). `npm run test:e2e` (`packs-390`) checks Beach Grill's lock, the deep
link, the unlock and its theme. `?fixtures=1` on the dev server adds a third test pack (`tests/fixtures/levels/test_mint`,
`order` 99, theme `test_mint`, ★ 40).

### Content rules (#62, decided 2026-10-08; revised the same day by the owner: 50-level packs, features go into existing levels)

1. **One pack per theme, at most 50 levels.** Each theme ships one pack that grows to 50 levels and then is full.
   Each new theme starts its own curve from easy and introduces its own new foods (taught inside its 50).
2. **Ids and positions never change.** Shipped levels are never inserted between, reordered or removed, and their ids
   never change: `/<pack-slug>/<n>` (#63) and share codes always open the same level. Display **names and hints may be
   rewritten** for the story (owner, 2026-10-08, `docs/STORY.md`), always in vi and en. While a pack has fewer than 50 levels, new
   ones go at the **end** only.
3. **New features go into existing levels.** A new booster, mechanic or food does not get new levels or a new pack:
   the levels it suits are **edited in place** (board, `boosters`, `modifiers`, foods; difficulty may go up), then
   `npm run solve -- <id> --write` and `npm run validate:levels`. The theme's `mechanics` / `foods` grow with it.
4. **Never easier.** Inside a pack, each level's stored solver `difficulty` is **≥ the highest difficulty of every
   level before it** (ties allowed; no easier "breather" levels). This holds after an edit too: raising level k may
   mean raising the levels after it.
5. **Street BBQ 1–50 are legacy** (`"curveFrom": 51` in its `pack.json`: they predate rule 4 and keep their
   shipped order; the pack is full).
6. **Packs unlock in order** (see Unlocks). The level select shows one tab per pack (`/levels/<slug>`) **until the
   journey map (#84) ships**: owner, 2026-10-08, the tabs may be replaced by one continuous road through all packs
   (the story, `docs/STORY.md`), chosen from 5 variants. `/levels/<slug>` and `/<pack-slug>/<n>` keep working.
7. **Story beats never change levels.** Beats (`content/story/`, #80) attach to existing level ids; they never add,
   reorder or edit a level and never count for difficulty.

Editing a level keeps players' stars (progress is per level id). A challenge link to it opens the edited board, so
its stored best moves / player counts may mix the old and new board.

`validate:levels` enforces 1, 2 and 4 against the base revision (`scripts/lib/content-rules.js`): the base's `pack.json`
list and `share-index.json` must be exact prefixes of the new ones, and from `curveFrom` (default 1) each level's
difficulty must reach the running max. `curveFrom` can only exempt levels the base already shipped. The base is
`--base <ref>`, else `$GS_CONTENT_BASE` (CI: the PR's target branch, or the previous `main` tip on a push), else
`origin/main`. If a recalibration (#15) or rule change shifts stored difficulties so that a pack breaks rule 2, the
check fails and a person decides: shipped levels are never reordered to fix it.

## Validation (`npm run validate:levels`, CI gate)

Structure, food/goal/modifier/booster references, totals divisible by the match size, no starting match, a legal
first move, file name = id, no duplicate ids, no structural duplicates — then the solver: solvable, stored
`minMoves` is the true minimum, `moves` is exactly the tier's budget, stored solution replays to a win in `minMoves`,
stored difficulty is current.

`tests/solver/levels.test.js` repeats the core of it inside `npm test`: for every shipped level the stored solution
replays legally to a win inside the move budget, the solver re-proves the board winnable from scratch with the same
minimum, and its own line wins too. It also checks that Street BBQ still starts with its legacy levels (at least 50),
each with a name, tier and hint. `tests/content/rules.test.js` covers the content-rule checks.

## Beach Grill — curve (#17)

The second pack (`/beach-grill/<n>`, theme `beach_grill`): a sunny beach look, catalog shrimp, salmon, corn, pepper,
skewer, sausage + the beach foods **squid, scallop, pineapple** (#70); mechanics prep tray, stacked tray and lock
(no burn counters). Opens after Street BBQ with ★ 75. **Full: 50 levels**, its own curve from easy, never easier
(#62). Levels 1–12 (#17) teach the basics and the mechanics; 13–50 (#70) bring one new food per stage, then mix all
nine. 37–50 use the `expert` tier (minimum + 1 moves): under `hard` the generator tops out at difficulty 59, and the
pack's last stretch has to stay above level 36 (owner's choice, 2026-10-08).

| # | id | Name | Teaches | min | moves | difficulty |
|---|---|---|---|---|---|---|
| 1 | `beach-001` | Low Tide | three foods, the basics | 5 | 9 | 15 easy |
| 2 | `beach-002` | Shrimp on the Sand | shrimp + skewer | 5 | 9 | 15 easy |
| 3 | `beach-003` | Sausage Sizzle | sausage | 4 | 7 | 18 easy |
| 4 | `beach-004` | Salt Breeze | salmon + corn + skewer | 4 | 7 | 19 easy |
| 5 | `beach-005` | Cooler Box | **prep tray** | 6 | 9 | 29 normal |
| 6 | `beach-006` | Picnic Spread | tray, five grills | 7 | 10 | 29 normal |
| 7 | `beach-007` | Buried Treasure | **stacked tray** | 6 | 9 | 33 normal |
| 8 | `beach-008` | Sandcastle | stack, five grills | 8 | 12 | 33 normal |
| 9 | `beach-009` | Lifeguard Tower | **lock** + stack | 7 | 9 | 44 hard |
| 10 | `beach-010` | Rising Tide | lock + stack | 8 | 10 | 44 hard |
| 11 | `beach-011` | Sunset Rush | lock 3 + stack, five grills | 8 | 10 | 44 hard |
| 12 | `beach-012` | Last Light | lock + stack, longest line | 10 | 12 | 44 hard |
| 13–20 | `beach-013`…`020` | Ink Spot … Rip Current | **squid** (13), with the lock and stacks | 4–8 | 5–10 | 48–50 hard |
| 21–28 | `beach-021`…`028` | Sea Glass … Lighthouse | **scallop** (22) | 4–10 | 5–12 | 52–56 hard |
| 29–36 | `beach-029`…`036` | Golden Ring … Salt Spray | **pineapple** (29) | 5–10 | 6–12 | 56–59 hard |
| 37–50 | `beach-037`…`050` | Beach Party … Moonlit Grill | five of the nine foods, two plates + a lock | 8–13 | 9–14 | 66–72 expert |

Generated with (staging, then picked by hand):
```
npm run generate:levels -- --theme beach_grill --prefix beach-a --count 8 --difficulty 10:24 --grills 3:4 --food-count 3:3 --empty 2:4 --candidates 1500 --seed 101 --out content/generated/beach-a
npm run generate:levels -- --theme beach_grill --prefix beach-b --count 6 --difficulty 22:36 --grills 4:4 --trays 1:1 --food-count 3:4 --empty 2:3 --candidates 3000 --seed 202 --out content/generated/beach-b
npm run generate:levels -- --theme beach_grill --prefix beach-c --count 6 --difficulty 26:40 --grills 4:5 --layers 1:1 --food-count 4:4 --empty 2:3 --candidates 3000 --seed 303 --out content/generated/beach-c
npm run generate:levels -- --theme beach_grill --prefix beach-d --count 6 --difficulty 36:52 --grills 4:5 --layers 1:2 --locks 1:1 --food-count 4:5 --empty 2:3 --candidates 4000 --seed 404 --out content/generated/beach-d
```
Levels 13–50 came from runs like these (staging, picked by hand, ordered by difficulty; `--tier` sets the move budget
the boards are rated under):
```
npm run generate:levels -- --theme beach_grill --prefix bA --foods squid,shrimp,salmon,corn --food-count 4:4 --difficulty 44:52 --grills 4:5 --layers 1:2 --locks 0:1 --empty 2:3 --count 14 --candidates 700 --seed 701 --out content/generated/bA
npm run generate:levels -- --theme beach_grill --prefix bB --foods scallop,squid,pepper,skewer --food-count 4:4 --difficulty 50:58 --grills 4:5 --layers 1:2 --locks 0:1 --empty 2:3 --count 14 --candidates 700 --seed 702 --out content/generated/bB
npm run generate:levels -- --theme beach_grill --prefix bC --foods pineapple,scallop,squid,corn --food-count 4:4 --difficulty 54:64 --grills 5:5 --layers 1:2 --locks 0:1 --empty 2:3 --count 14 --candidates 300 --seed 703 --out content/generated/bC
npm run generate:levels -- --theme beach_grill --prefix bD --food-count 5:5 --difficulty 60:75 --grills 5:5 --layers 1:2 --locks 1:1 --empty 2:3 --count 12 --candidates 400 --seed 704 --out content/generated/bD
```
(plus `bE` 62:80 with two plates, seed 705, and `bF` squid/pepper/skewer/sausage 44:52, seed 706). The pack is full:
new features now go into these levels (rule 3).

## Street BBQ — curve (50 legacy levels)

Levels 1–50 are in their shipped order, which predates the content rules: it has easier breathers and levels that
were inserted mid-curve (#54). It stays as is (rule 3). Levels from 51 on are appended in order of difficulty, at 58
or more.

| # | Name | Teaches | min | moves | difficulty |
|---|---|---|---|---|---|
| 1 | First Flip | three of a kind clears | 2 | 4 | 15 easy |
| 2 | Corn Joins In | empty slots are workspace | 6 | 11 | 15 easy |
| 3 | Drumstick Dash | four foods, planning | 8 | 14 | 20 easy |
| 4 (`street-014`) | Salmon Slab | **salmon** | 6 | 11 | 19 easy |
| 5 (`street-017`) | Fish Fry | salmon in a plain board | 5 | 9 | 18 easy |
| 6 (`street-018`) | Corn Rows | crowded board, clear to make room | 5 | 9 | 18 easy |
| 7 (`street-004`) | Side Tray | prep tray (all grills full) | 9 | 13 | 25 normal |
| 8 (`street-019`) | Tray Service | tray as parking | 6 | 9 | 29 normal |
| 9 (`street-005`) | Shrimp Order | `clear_food` goal | 4 | 6 | 26 normal |
| 10 (`street-015`) | Orange Trio | **carrot**; shrimp / carrot / salmon side by side, tray | 8 | 12 | 26 normal |
| 11 (`street-020`) | Carrot Cake Walk | breather: four foods | 6 | 11 | 18 easy |
| 12 (`street-021`) | Salmon Shuffle | tray with a doubled food | 6 | 9 | 29 normal |
| 13 (`street-006`) | Under the Lid | stacked tray reveal | 7 | 12 | 21 normal |
| 14 (`street-022`) | Peek Under | stack: reveal by clearing | 7 | 10 | 29 normal |
| 15 (`street-023`) | Corn Cellar | stack hides the missing trio | 6 | 9 | 29 normal |
| 16 (`street-007`) | Padlocked | locked grill | 6 | 9 | 25 normal |
| 17 (`street-024`) | Key Ring | lock 1 | 5 | 7 | 29 normal |
| 18 (`street-016`) | Toast or Steak | **bread**; steak / toast / salmon slabs, lock | 6 | 9 | 31 normal |
| 19 (`street-025`) | Breather | breather | 5 | 9 | 18 easy |
| 20 (`street-026`) | Locked Pantry | lock 1, three foods behind it | 7 | 10 | 29 normal |
| 21 (`street-027`) | Bread Basement | stack with bread | 8 | 12 | 29 normal |
| 22 (`street-028`) | Beef Rush | tray, doubled beef | 6 | 9 | 29 normal |
| 23 (`street-029`) | Quick Pick | lock 1, short | 4 | 6 | 29 normal |
| 24 (`street-008`) | Stack Attack | two stacks, ordering | 7 | 10 | 42 hard |
| 25 (`street-030`) | Double Decker | two stacks | 7 | 9 | 45 hard |
| 26 (`street-031`) | Root Cellar | two stacks, mixed layers | 7 | 9 | 46 hard |
| 27 (`street-009`) | Hot Seat | lock + stack + tray | 9 | 11 | 43 hard |
| 28 (`street-032`) | Sunday Grill | breather | 5 | 9 | 18 easy |
| 29 (`street-033`) | Triple Lock | two stacks + lock 3 | 7 | 9 | 46 hard |
| 30 (`street-034`) | Surf and Turf | tray + stack + lock 2 | 6 | 8 | 46 hard |
| 31 (`street-010`) | Grand Grill | five foods, all mechanics | 11 | 14 | 52 hard |
| 32 (`street-035`) | Corner Stand | tray + stack | 6 | 8 | 46 hard |
| 33 (`street-011`) | Sizzle | burn counter: a char loses, serve it first | 6 | 11 | 33 normal |
| 34 (`street-012`) | Two Timers | two burning foods, order by counter | 6 | 9 | 49 hard |
| 35 (`street-013`) | Off the Heat | prep tray stops burning: park, set up, bring back | 9 | 13 | 49 hard |
| 36 (`street-036`) | Two Layers | two stacks, doubled food | 6 | 8 | 46 hard |
| 37 (`street-037`) | Night Shift | stack + lock 2 | 8 | 10 | 45 hard |
| 38 (`street-038`) | Five Spice | five foods, stack + lock 3 | 9 | 11 | 50 hard |
| 39 (`street-039`) | Slow Cook | stack + lock 2 | 7 | 9 | 48 hard |
| 40 (`street-040`) | Breather Bites | breather: two stacks + lock 1 | 8 | 10 | 46 hard |
| 41 (`street-041`) | Full House | stack + lock, doubled shrimp | 7 | 9 | 49 hard |
| 42 (`street-042`) | Market Rush | five foods, two stacks + lock 2 | 7 | 9 | 51 hard |
| 43 (`street-043`) | Long Haul | 10-move line, stack + lock | 10 | 12 | 51 hard |
| 44 (`street-049`) | Twelve Steps | 12-move line (long breather) | 12 | 15 | 46 hard |
| 45 (`street-045`) | Mixed Grill | five foods, stack + lock 2 | 9 | 11 | 50 hard |
| 46 (`street-046`) | Deep Stack | two stacks + lock 3 | 9 | 11 | 53 hard |
| 47 (`street-047`) | Chef Special | two stacks + lock 3, 10 moves | 10 | 12 | 54 hard |
| 48 (`street-048`) | Closing Time | five foods, two stacks + lock 2 | 9 | 11 | 56 hard |
| 49 (`street-044`) | Last Orders | two stacks + lock 2 | 9 | 11 | 56 hard |
| 50 (`street-050`) | Street Legend | finale: two stacks + lock | 10 | 12 | 58 hard |

Sizzle / Two Timers / Off the Heat (33–35) use the burn counter (rules v3: any char loses). On each, the optimal line
of the same board without counters chars something, so the counter changes the plan. Two Timers replaced "Burnt Ends"
(v2: six counters of 1, everything charred on move 1 and play went on); Off the Heat was rebuilt so the tray is required (9 moves vs 8 without counters).

Ids are stable (`street-001`…`010` keep their ids); play order is `pack.json`. Story share codes (`S…`) encode a
position in the append-only `content/levels/share-index.json`, not the play order: append every new story level
there, never reorder or remove (`validate:levels` and `tests/solver/share-index.test.js` enforce it). Packs are
append-only too since #62. The original ten were hand-designed,
then solver-checked; level 12's lock was reduced from 2 to 1 after the solver proved the 2-lock version impossible,
and Padlocked / Stack Attack were swapped after the difficulty evaluator ranked "Stack Attack" well above
"Padlocked". The three food-teaching levels came from `npm run generate:levels` (food-restricted runs: salmon with
the first three foods; carrot with the other oranges; bread with the other slabs plus a lock), were picked by hand,
renamed, given a tier and hint, and solved with `solve --write`. (They were inserted mid-pack; since #62 new
levels are only appended.)

`street-017`…`050` (issue #10) came from six `generate:levels` runs, one per stage: plain easy boards (difficulty
12–24), tray only, stack only, lock only (20–38 each), combinations (38–55: 1–2 stacks, 0–1 lock, 0–1 tray) and late
boards (52–75 at generation: 5 grills, 1–2 stacks, a lock). Picks were made per slot with food bans, so no level uses
a food before its teaching level (no carrot or bread before Orange Trio, no bread before Toast or Steak), and every
mechanic gets solo levels before the first combination (Stack Attack, 24). Breathers (easy boards at 11, 19, 28; lighter
hard boards at 40 and 44) break up the climb: legacy only, new levels never dip (#62). Late levels use the `hard` tier (min + 20 %), not `expert` (min + 1):
with hidden stacks an `expert` budget punishes a first look at the board. Burn-counter levels are not generated (the
generator has no counters yet), so the three hand-made ones stay.

## Theme format

A theme is a content package, data only: `content/themes/<id>.json`, one per pack (`pack.json` `theme`). It sets how
the pack looks and sounds, which foods and mechanics its levels may use, and what unlocks it. `shared/themes.js` holds
the format: `THEME_DEFAULTS` (Street BBQ's look), `resolveTheme` (a partial file filled in from the defaults; nested
objects merge, arrays replace) and `validateTheme`. `content/themes/street_bbq.json` spells every field out and is
the reference.

| Key | What | Read by |
|---|---|---|
| `id`, `name`, `description` | snake_case id (one of `shared/levels.js` `THEMES`), display name | `validate:levels` |
| `foods` | the food catalog (below) | `validate:levels`, `generate:levels` |
| `mechanics` | modifiers a level of this theme may use (`locked_grill`, `stacked_tray`, `prep_tray`, `burn_counter`) | `validate:levels` |
| `palette` | `background` (clear colour), `vignette` (table edge darkening) | `Stage.setTheme` |
| `lights` | `sky` / `ground` (hemisphere), `key`, `rim` colours, their intensities, tone-mapping `exposure` | `Stage.setTheme` |
| `grill` | `body`, `grate`, `grateGlow`, `handle`, `lid`, `chain`, `layerPlate`, `tray`, `trayRim`; `ember` { `bed`, `hot`, `warm`, `glow`, `fade`, `coal` } | `applyMaterialTheme`, `textures.embers` |
| `table` | `color` tint, wood `hue` / `saturation` / `lightness` (each plank adds a seeded 0–6 / 0–8 / 0–8), `planks`, `seed` | `textures.woodPlanks` |
| `backdrop` | `preset` (`bokeh` sprites at the far edge, or `none`), `colors`, `count`, `opacity`, `size`, `height` | `Stage.setTheme` |
| `ambience` | `preset` (`grill`), `hiss`, `rumble`, `crackle` (pops / s), `seed` | `synth.ambienceLoop`, `Audio.setAmbience` |
| `unlock` | `{ "stars": N }`: story stars needed to open the pack (after the previous pack, see Unlocks) | `game/unlock.js` |
| icon (`<id>.svg`) | separate file next to the theme: the theme's own picture (Street BBQ: grill under string lights; Beach Grill: beach umbrella, sun and waves). One `<svg>`, `viewBox="0 0 48 48"`, drawn on its own tile, readable at 30 px; no scripts, handlers, links or images; ≤ 8 KB (`validateThemeIcon`). Required for every theme a pack uses | level select tab |

The game applies the theme of the level being played (and of the menu's demo board): `Stage.setTheme` recolours the
lights, background, table, the shared grill materials and the backdrop in place, and the ambience loop is rebuilt for
the new params. Colours are `#rrggbb`; unknown keys are errors, so a typo cannot fall back to the default silently.
`?theme=<id>` on `/sandbox/board` and `/sandbox/food` shows any theme, including the test fixtures in
`tests/fixtures/themes/` (`test_mint`: a partial theme, never in a pack; the `theme-test-mint` visual capture keeps it
rendering). A new theme is a JSON file plus its id in `THEMES`: no code.

## Theme food catalogs

Each theme declares the foods it serves (`content/themes/<id>.json` `foods`). `validate:levels` checks every theme
file against the format, rejects a level that uses a food outside its theme's catalog or a mechanic outside its
`mechanics`, and a pack whose theme has no file; `generate:levels` draws from the catalog when `--foods` is not given and
refuses foods outside it (`resolveConfig({ catalog })` in `solver/generator.js`). Shipped challenge presets keep
their explicit food lists.

Street BBQ serves sausage, mushroom, bell pepper and skewer too (#39). No Street level uses them yet; the pack is full
(50), so they arrive by editing existing Street levels (rule 3), never through new ones. When generating boards for a
pack, pass `--foods` for the foods its levels should show, or the default draw from the whole catalog brings in foods
no level has taught yet.

## Growing content (agent workflow)

> Generate 100 Night Market levels at difficulty 35–55 using shrimp, beef, chicken, corn, locked grills and hidden slots.

```
npm run generate:levels -- --theme night_market --foods shrimp,beef,chicken,corn --count 100 \
  --difficulty 35:55 --grills 4:5 --locks 0:1 --layers 1:2 --candidates 4000 --out content/generated/night-1
```
To grow an existing pack, generate with `--append <pack>`: the difficulty range starts at the pack's current max
(`--difficulty` then only sets the top) and candidates come out in ascending difficulty, ready to append in order:
```
npm run generate:levels -- --append street_bbq --count 20 --difficulty 75 --grills 5:5 --layers 1:2 --locks 0:1   --candidates 4000 --out content/generated/street-51
```
A new pack starts at level 1 with its own easy start and must rise from there. Output goes to a staging folder (gitignored). A person plays a sample (`/sandbox/board?level=…` after copying into
a pack), keeps the good ones in `content/levels/<pack>/`, then `npm run solve -- --all --write` and
`npm run validate:levels`. Do not hand-write levels in bulk; do not commit unsolved levels.
