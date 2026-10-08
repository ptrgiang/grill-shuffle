# Story: Xe nướng của bà (Grandma's grill cart)

Owner direction 2026-10-08 (#78): the puzzle gets a story layer that is **Vietnamese-rooted, told mostly through
motion**, and turns the packs into one journey the player wants to keep travelling. Story work comes before feature
work in the roadmap (#35, milestone Story: #78–#86).

## Premise

Út, a young cook, inherits Bà Năm's grill cart: a dented charcoal cart from a Saigon alley, and with it her recipe
notebook, most pages torn out and lost. Út pushes the cart from stop to stop. Each stop is one pack; finishing a
chapter gives a page back, and every page holds a dish and a memory of Bà Năm. The last stop brings Út home, to a
rooftop above the same alley, with the notebook whole.

The game never says this in long text. It shows it: a cart, a notebook, people at a counter, food on a grill.

## Cast

| Who | Role | Look / grammar |
|---|---|---|
| **Út** | the player's cook; quiet, stubborn, kind | round storytime shapes, nón lá or cap, apron; eyebrows carry emotion |
| **Bà Năm** | grandma, appears only in memories (flashbacks, notebook margins) | warmer, softer palette, paper grain, slightly faded |
| **Mực** | black alley cat that jumps onto the cart in the prologue and travels along | reacts to combos, steals a shrimp when the player fails, sleeps on the notebook |
| **Bin** | a schoolkid regular; grows up across the stops (school uniform → teenager → student) | time passing without words |
| one **host per stop** | teaches that stop's signature mechanic, gives the page | see below |

## The five stops (pack order)

| # | Pack | Place | Host | Teaches | Arc (prologue → finale) | Transition | Lead instrument |
|---|---|---|---|---|---|---|---|
| 1 | Street BBQ | Saigon alley, evening | Cô Sáu, sugarcane-juice cart next door | basics, locks, stacked trays, burn counter | the cold cart lit again → the alley comes back to it → first page, a postcard from the coast | string lights flick on | plucked, pitch-bent lead (đàn bầu spirit) |
| 2 | Beach Grill | central-coast fishing village | Chú Tư, old fisherman | stacked trays as the tide; squid, scallop, pineapple | a stranger on the sand → the village's festival grill → seafood page, a lantern in a box | wave wipe | bamboo flute |
| 3 | Night Market (#22) | lantern town by a river | Chị Hoa, lantern stall | locked grills, hidden slots; night rush | lost in the crowd → own stall at the market → page, a highland bus ticket | lanterns light in sequence | đàn tranh-like arpeggio |
| 4 | Mountain Camp (#23) | northwest highlands, cold nights | a highland ranger (name and look agreed with the owner, respectful of the region's communities) | frozen items (#8) | the cart breaks down in the fog, missing grandma → a fire shared with strangers → the hardest page | mist parts | mouth harp / flute drone |
| 5 | Rooftop Grill (#24) | Saigon rooftop above the first alley | Khang, a rival chef who becomes a friend | grill heat (#25) | the city does not care → the alley comes up to the roof → notebook whole, Bà Năm's last page | city lights wave on | full arrangement of the motif |

Themed foods of later stops may lean on Vietnamese street food where they stay readable at 360 px (#22–#24 decide).
Seasonal events (#32) are side stories on the same cart: Tết, Trung thu.

## Beats

A **beat** is one short scene (≤ 8 s, skippable) stored as content (`content/story/<pack>.json`, format in #80).

Per 50-level pack:

| When | Beat |
|---|---|
| first entry into the pack (unlock) | prologue / arrival: the place, the host |
| first win of levels 10, 20, 30, 40 | chapter beat: one step of the arc, often with Bin or Mực |
| first win of level 50 | finale: the page comes back, a teaser object for the next stop |

Rules:

- Beats attach to **existing level ids**. Story never adds, removes, reorders or edits a level (content rules,
  `docs/LEVELS.md`). It never touches `shared/` or `solver/` and never changes what a move does.
- Beats play **after** a win or on entering a pack, never during play and never before the first move of a level.
- A player who is already past a chapter gets **only the latest** chapter beat once, not the backlog (#80).
- Every beat is skippable by a tap; a "skip story" setting turns them off; reduced motion (#16) = fades only.
- Text: a chapter title and at most one short line per beat, stored in vi and en. Everything else is pose, icon
  bubble (a food, a heart, a question mark), object and light.

## Motion grammar

Borrowed from [huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion), adapted to a live game:

1. **One key frame first.** Every beat starts as one still that is approved (5 variants in its issue for the first
   frame of a chapter), then gets motion.
2. **Storytime poses.** Characters snap between 5–6 poses in ~0.1 s and hold (~0.4 s typical); a reaction is a cut
   to a close-up. Cheap, readable on a phone, consistent.
3. **Forward-only journey.** On the journey map (#84) the camera only moves forward and the cart only rolls on,
   which matches the content rules: levels are only appended, never easier.
4. **Signature transitions.** Crossing into a stop uses that stop's own language (table above), not a generic fade.
5. **Picture and sound on one grid.** A 3-note motif (Bà Năm's tune) re-orchestrated per stop (#85); cuts land on
   bar lines, no cross-fades.
6. **Characters drawn in code** in the game (small, offline, consistent with the procedural foods). AI-generated
   frames only for key art and trailers, never required at runtime.

huashu-art-motion's `render.py` launches Playwright directly: never run it on this machine (see `CLAUDE.md`, browser
rule). Its ideas and parameters are what we take, not its pipeline.

## Retention loops (no new currency)

- **The journey**: one road, the next stop visible as a teaser, the cart rolling on after each win (#84).
- **Chapters**: a beat every 10 levels, a finale with a page at 50.
- **The notebook** (#86): pages, margin notes at star milestones, best replays (#77) kept as "memories".
- **People**: hosts and regulars return across stops; Bin grows up.
- **Gifts**: earned boosters (#74) arrive from characters.
- **Festivals**: events (#32) as side stories.

Stars stay the only progression unit (§75: no extra currencies).

## References

What we take from known games:

| Game | Lesson |
|---|---|
| Candy Crush Saga | short intro / outro per episode; the story never blocks the next level |
| Royal Match, Homescapes | progress feeds a visible place; characters react to the player |
| Cut the Rope | wordless scenes of a few seconds, no translation needed |
| Monument Valley | story told by space and motion |
| Venba, Unpacking | food and objects carry family memory |
| Two Dots, Alto's Adventure | the level list as a journey |

## Process

Story issues follow the normal flow (`CONTRIBUTING.md`) plus the UI variant step: anything that changes what the
player sees gets **5 variants in its issue** (label `design/variants`), the owner picks one, the PR builds only that.
