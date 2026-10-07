// Version stamps. Bump the one whose meaning changes; old challenges/replays carry the version they were made with.
//
// PUZZLE_RULE_VERSION  - anything that can change the outcome of a move sequence (matching, reveal order, locks, combo).
// LEVEL_FORMAT_VERSION - the JSON shape of content/levels/*.json.
// CHALLENGE_VERSION    - the share-code layout and the daily/challenge generator config.
// GENERATOR_VERSION    - the seeded level generator (same seed + same version => same level).
// SAVE_VERSION         - the IndexedDB save layout.

export const PUZZLE_RULE_VERSION = 1;
export const LEVEL_FORMAT_VERSION = 1;
export const CHALLENGE_VERSION = 1;
export const GENERATOR_VERSION = 1;
export const SAVE_VERSION = 1;

export const VERSIONS = Object.freeze({
  puzzleRuleVersion: PUZZLE_RULE_VERSION,
  levelFormatVersion: LEVEL_FORMAT_VERSION,
  challengeVersion: CHALLENGE_VERSION,
  generatorVersion: GENERATOR_VERSION,
  saveVersion: SAVE_VERSION,
});
