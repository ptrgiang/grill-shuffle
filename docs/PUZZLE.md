# Puzzle rules (puzzleRuleVersion 1)

## Board

A board is 2–12 **grills**. Each grill has 1–6 **slots** (normally 3). A slot is empty (`null`) or holds an item
`{ id, food }`. Slot order inside a grill never matters to the rules.

```js
{
  levelId: 'street-004', movesLeft: 13, movesUsed: 0, score: 0, combo: 0, maxCombo: 0, matches: 0, nextItemId: 13,
  rules: { matcher: 'same_food', matchSize: 3, matchScore: 100 },
  grills: [ { id: 'g0', type: 'grill', lock: 0, slots: [{ id: 1, food: 'shrimp' }, { id: 2, food: 'beef' }, null], layers: [] } ],
  goals: [ { type: 'clear_all', target: 12, progress: 0 } ],
  boosters: {}, status: 'playing'
}
```

## Moves

`{ type: 'move', from: { grill, slot }, to: { grill, slot } }` — legal when the game is playing, moves remain, the
source slot holds an item, both grills are unlocked, the target slot is empty, and the grills differ. Compact form:
`m1.2-0.2`. A move costs one move.

## Resolution order (after every action)

1. The item moves; `movesLeft − 1`.
2. Repeat until nothing happens:
   - every match on the board clears (grill order, then slot order). A **match** = `matchSize` items on one
     unlocked grill of a matching type whose matcher keys are equal (`same_food`: identical food).
     Per match: combo +1, score += `matchScore × combo`, goal progress, every locked grill's counter −1.
   - every empty, unlocked grill with stacked trays reveals its next layer.
   Matches produced by an unlock or a reveal are **chain** matches (`chain` > 0 in the event).
3. No match during the move → combo resets to 0.
4. All goals met → `won`. Else no moves left → `lost ('moves')`. Else no legal move and no usable booster →
   `lost ('stuck')`.

## Events

`move, match {grill, food, foods, itemIds, slots, chain, combo}, score, goal_progress, lock_progress, unlock,
reveal {grill, items, layersLeft}, combo, combo_reset, booster, level_complete, level_failed`.
The renderer and audio consume these; nothing else does.

## Obstacles (all turn-based)

| Mechanic | Data | Rule |
|---|---|---|
| Locked grill | `"lock": N` | Can't take from or drop on it. Each match anywhere ticks every lock down by one. At 0 it opens and can match at once. |
| Stacked tray | `"layers": [[…], …]` | Hidden trays under a grill. When the grill is empty (by matching *or* moving everything away) the next layer flips up. |
| Prep tray | `"type": "tray"` | Holds food, never matches. A parking buffer. |

Planned, not in v1: burn counter (`charred` after N actions on a hot grill), frozen item, chain link, covered grill.
Grill heat states (cold/warm/hot/overheated) and food cook/char exist only visually for now (`uCook`, `uChar`).

## Combo

Each match in an unbroken run of productive moves raises the combo: x1, x2, x3… A move with no match resets it.
No timers, no reflexes.

## Goals

`clear_all`, `clear_food {food, count}`, `serve_food {food, count}`, `complete_matches {count}`, `reach_score {count}`,
`clear_blocker` (open every lock), `reveal_hidden` (flip every stacked tray). Several goals compose; all must be
met. Planned with the burn mechanic: `protect_food`, `clear_before_char`.

## Boosters

Deterministic actions `{ type: 'booster', booster, from?, to? }`; cost no move; one charge each.
- **Tongs** — lift one item from any grill, *including a locked one*, into an empty slot of another open grill.
- **Fan** — redistribute every item on the open grills over the same occupied slots (seeded from the state hash).

`canUseBooster(state, action)`, `applyAction(state, action)`. Levels grant charges via `"boosters": { "tongs": 1 }`.
The UI for boosters is not in the vertical slice yet.

## Stars and budgets

From the solver minimum `min` (shared/progression.js): budget easy `min + ⌈0.7·min⌉`, normal `+⌈0.4·min⌉`,
hard `+max(1, ⌈0.2·min⌉)`, expert `+1`. Stars: 3 at ≤ `min + max(1, round(0.1·min))`, 2 at ≤
`min + max(2, round(0.4·min))`, 1 for any win.
