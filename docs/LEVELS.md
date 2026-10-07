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
`lock`. `tier` decides the move budget from the solver minimum; `moves` and `solver` are **written by tooling**
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
| 4 | Side Tray | prep tray (all grills full) | 9 | 13 | 25 normal |
| 5 | Shrimp Order | `clear_food` goal | 4 | 6 | 26 normal |
| 6 | Under the Lid | stacked tray reveal | 7 | 12 | 21 normal |
| 7 | Padlocked | locked grill | 6 | 9 | 25 normal |
| 8 | Stack Attack | two stacks, ordering | 7 | 10 | 42 hard |
| 9 | Hot Seat | lock + stack + tray | 9 | 11 | 43 hard |
| 10 | Grand Grill | five foods, all mechanics | 11 | 14 | 52 hard |

All hand-designed, then solver-checked; level 9's lock was reduced from 2 to 1 after the solver proved the 2-lock
version impossible, and 7/8 were swapped after the difficulty evaluator ranked "Stack Attack" well above "Padlocked".

## Growing content (agent workflow)

> Generate 100 Night Market levels at difficulty 35–55 using shrimp, beef, chicken, corn, locked grills and hidden slots.

```
npm run generate:levels -- --theme night_market --foods shrimp,beef,chicken,corn --count 100 \
  --difficulty 35:55 --grills 4:5 --locks 0:1 --layers 1:2 --candidates 4000 --out content/generated/night-1
```
Output goes to a staging folder (gitignored). A person plays a sample (`/sandbox/board?level=…` after copying into
a pack), keeps the good ones in `content/levels/<pack>/`, then `npm run solve -- --all --write` and
`npm run validate:levels`. Do not hand-write levels in bulk; do not commit unsolved levels.
