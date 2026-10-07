Closes #

## What and why

## How it was checked
- [ ] `npm run ci` green locally (check, tests, validate:levels, build)
- [ ] `npm run test:e2e` (input / UI changes)
- [ ] Screenshots for visual changes (desktop + 390×844 phone)
- [ ] Tried on a real touch device (mobile issues)

## Review checklist
- [ ] Simulation stays authoritative; no rules in render / input / animation code
- [ ] Deterministic: no `Math.random` / clock in `shared/` or `solver/` (`npm run check`)
- [ ] Rule change → `PUZZLE_RULE_VERSION` bumped, levels re-solved (`npm run solve -- --all --write`)
- [ ] Shipped `CHALLENGE_PRESETS` versions untouched
- [ ] Docs updated (`docs/*.md`)
