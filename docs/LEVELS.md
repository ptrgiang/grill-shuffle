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

## Validation (`npm run validate:levels`, CI gate)

Structure, food/goal/modifier/booster references, totals divisible by the match size, no starting match, a legal
first move, file name = id, no duplicate ids, no structural duplicates — then the solver: solvable, stored
`minMoves` is the true minimum, `moves` is exactly the tier's budget, stored solution replays to a win in `minMoves`,
stored difficulty is current.

## Street BBQ (vertical slice) — curve

| # | Name | Teaches | min | moves | difficulty |
|---|---|---|---|---|---|
| 1 | First Flip | three of a kind clears | 2 | 4 | 15 easy |
| 2 | Corn Joins In | empty slots are workspace | 6 | 11 | 15 easy |
| 3 | Drumstick Dash | four foods, planning | 8 | 14 | 20 easy |
| 4 (`street-014`) | Salmon Slab | **salmon** | 6 | 11 | 19 easy |
| 5 | Side Tray | prep tray (all grills full) | 9 | 13 | 25 normal |
| 6 | Shrimp Order | `clear_food` goal | 4 | 6 | 26 normal |
| 7 (`street-015`) | Orange Trio | **carrot**; shrimp / carrot / salmon side by side, tray | 8 | 12 | 26 normal |
| 8 | Under the Lid | stacked tray reveal | 7 | 12 | 21 normal |
| 9 | Padlocked | locked grill | 6 | 9 | 25 normal |
| 10 (`street-016`) | Toast or Steak | **bread**; steak / toast / salmon slabs, lock | 6 | 9 | 31 normal |
| 11 | Stack Attack | two stacks, ordering | 7 | 10 | 42 hard |
| 12 | Hot Seat | lock + stack + tray | 9 | 11 | 43 hard |
| 13 | Grand Grill | five foods, all mechanics | 11 | 14 | 52 hard |
| 14 (`street-011`) | Sizzle | burn counter, `protect_food` | 6 | 11 | 33 normal |
| 15 (`street-012`) | Burnt Ends | charred food clears with charred food (any food) | 6 | 9 | 27 normal |
| 16 (`street-013`) | Off the Heat | prep tray stops burning, `clear_before_char` | 8 | 12 | 46 hard |

14–16 were added with rules v2 (burn counter). Their difficulty is driven by dead ends: once a protected item chars,
every later state is lost.

Ids are stable (`street-001`…`010` keep their ids); play order is `pack.json`. Story share codes (`S…`) encode a
position in the append-only `content/levels/share-index.json`, not the play order, so levels can be inserted
anywhere in a pack without breaking shared links: append every new story level there, never reorder or remove
(`validate:levels` and `tests/solver/share-index.test.js` enforce it). The original ten were hand-designed,
then solver-checked; level 12's lock was reduced from 2 to 1 after the solver proved the 2-lock version impossible,
and Padlocked / Stack Attack were swapped after the difficulty evaluator ranked "Stack Attack" well above
"Padlocked". The three food-teaching levels came from `npm run generate:levels` (food-restricted runs: salmon with
the first three foods; carrot with the other oranges; bread with the other slabs plus a lock), were picked by hand,
renamed, given a tier and hint, and solved with `solve --write`. Inserting a level never locks progress: a won
level stays open (`isUnlocked`).

## Theme food catalogs

Each theme declares the foods it serves (`content/themes/<id>.json` `foods`). `validate:levels` rejects a level that
uses a food outside its theme's catalog; `generate:levels` draws from the catalog when `--foods` is not given and
refuses foods outside it (`resolveConfig({ catalog })` in `solver/generator.js`). Shipped challenge presets keep
their explicit food lists.

## Growing content (agent workflow)

> Generate 100 Night Market levels at difficulty 35–55 using shrimp, beef, chicken, corn, locked grills and hidden slots.

```
npm run generate:levels -- --theme night_market --foods shrimp,beef,chicken,corn --count 100 \
  --difficulty 35:55 --grills 4:5 --locks 0:1 --layers 1:2 --candidates 4000 --out content/generated/night-1
```
Output goes to a staging folder (gitignored). A person plays a sample (`/sandbox/board?level=…` after copying into
a pack), keeps the good ones in `content/levels/<pack>/`, then `npm run solve -- --all --write` and
`npm run validate:levels`. Do not hand-write levels in bulk; do not commit unsolved levels.
