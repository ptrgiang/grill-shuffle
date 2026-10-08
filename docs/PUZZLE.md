# Puzzle rules (puzzleRuleVersion 2)

## Board

A board is 2–12 **grills**. Each grill has 1–6 **slots** (normally 3). A slot is empty (`null`) or holds an item
`{ id, food }` (plus `burn` or `charred`, see Burn counter). Slot order inside a grill never matters to the rules.

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
3. **Burn** (moves only, v3): unless every goal is already met, every burning item on a heated grill ticks down;
   at 0 it chars.
4. No match during the move → combo resets to 0.
5. Anything charred → `lost ('charred')`. Else all goals met → `won`. Else no moves left → `lost ('moves')`. Else no
   legal move and no usable booster → `lost ('stuck')`.

## Events

`move, match {grill, food, foods, itemIds, slots, chain, combo, burning?}, score, goal_progress,
lock_progress, unlock, reveal {grill, items, layersLeft}, burn_tick {items: [{grill, slot, itemId, food, burn}]},
charred {grill, slot, itemId, food}, combo, combo_reset, booster, level_complete, level_failed {reason}`.
The renderer and audio consume these; nothing else does.

## Obstacles (all turn-based)

| Mechanic | Data | Rule |
|---|---|---|
| Locked grill | `"lock": N` | Can't take from or drop on it. Each match anywhere ticks every lock down by one. At 0 it opens and can match at once. |
| Stacked tray | `"layers": [[…], …]` | Hidden trays under a grill. When the grill is empty (by matching *or* moving everything away) the next layer flips up. |
| Prep tray | `"type": "tray"` | Holds food, never matches. A parking buffer. |
| Burn counter (v2) | `{"food": "shrimp", "burn": N}` | The item chars after N moves on a heated grill (below). |

Planned: grill heat states, frozen item, chain link, covered grill.

### Burn counter

- A slot cell may be an object `{"food": "shrimp", "burn": N}` (N 1..20; modifier `burn_counter`). Stacked layers hold
  plain foods only. In the state the item is `{ id, food, burn }`.
- After every **move** that leaves the level unfinished, every burning item on a heated grill loses the grill's heat
  (`burnHeat`: 1 on an open grill; 0 on a prep tray or a locked, covered grill). The moved item ticks too. Boosters
  cost no move and never tick. An item matched during the move is gone before the tick.
- At 0 the item becomes **charred** `{ id, food, charred: true }` and **the level is lost** at the end of that move
  (`failReason: 'charred'`), whatever the goals. No goal is needed to make burning matter.
- History: v2 (2026-10-07, a few hours live) let charred food stay on the board and clear with any other charred
  food, plus `protect_food` / `clear_before_char` goals to make charring cost anything. Play-testing showed boards
  where everything charred on move 1 with no consequence (#47); v3 replaced all of it with "a char loses".
- Rule version: a board stamps the lowest rule version it needs (`ruleVersionOf`): boards without burning items are
  still v1, so their hashes, fan-booster seeds and stored replays are unchanged. Burn boards are v3.
- Level design: counters of 3 or more, and the board's no-burn optimal line should char something (so the counter
  changes the plan, not just the colour). Trays and locked grills are the tools for buying time.
- Visuals (minimal for now): a counter badge on burning items, the charred material on charred ones. Staged
  cook/char visuals and grill heat build on `burnHeat` and the `burn_tick`/`charred` events.

## Combo

Each match in an unbroken run of productive moves raises the combo: x1, x2, x3… A move with no match resets it.
No timers, no reflexes.

## Goals

`clear_all`, `clear_food {food, count}`, `serve_food {food, count}`, `complete_matches {count}`, `reach_score {count}`,
`clear_blocker` (open every lock), `reveal_hidden` (flip every stacked tray). Several goals compose; all must be met.

## Boosters

Deterministic actions `{ type: 'booster', booster, from?, to? }`; cost no move; one charge each.
- **Tongs** — lift one item from any grill, *including a locked one*, into an empty slot of another open grill.
- **Fan** — redistribute every item on the open grills over the same occupied slots (seeded from the state hash).

`canUseBooster(state, action)`, `applyAction(state, action)`. Levels grant charges via `"boosters": { "tongs": 1 }`.

**In the game** (#9): one HUD button per booster the level grants, after Undo / Hint / Restart, with its charges.
Tongs arm the input (`Session.arm('tongs')`): the next pick, from any grill including a locked one, and drop is the
booster action; tapping the button again disarms. Fan asks for a second tap within 4 s, then blows. The client is
generic over `BOOSTERS` (`needs: 'none'` fires on confirm, `needs: 'from+to'` arms), so new boosters only need an
icon (`client/ui/dom.js`) and a tip line (`client/main.js` `BOOSTER_TIPS`).
**Stars are unaffected** by boosters (charges are scarce, granted per level); the result screen lists the boosters
used. Charges come only from the level for now; a persistent inventory is a separate issue.
Granted today: Street BBQ 41–50 one Tongs each; Beach Grill 37–50 one Tongs + one Fan each.

## Stars and budgets

From the solver minimum `min` (shared/progression.js): budget easy `min + ⌈0.7·min⌉`, normal `+⌈0.4·min⌉`,
hard `+max(1, ⌈0.2·min⌉)`, expert `+1`. Stars: 3 at ≤ `min + max(1, round(0.1·min))`, 2 at ≤
`min + max(2, round(0.4·min))`, 1 for any win.
