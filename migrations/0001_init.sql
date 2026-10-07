-- Grill Shuffle D1 schema v1.
-- Players are anonymous device ids (x-player-id). Nothing per move is stored: only results and progress.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  settings TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

-- best result per player per story level (stars are derived from best_moves vs the level's solver minimum)
CREATE TABLE IF NOT EXISTS level_progress (
  user_id TEXT NOT NULL REFERENCES users(id),
  level_id TEXT NOT NULL,
  stars INTEGER NOT NULL,
  best_moves INTEGER,
  best_score INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, level_id)
);

-- generated / daily puzzles the server has built from their code (cached: building one costs solver CPU)
CREATE TABLE IF NOT EXISTS challenge_links (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  level_json TEXT NOT NULL,
  board_hash TEXT NOT NULL,
  min_moves INTEGER,
  rules_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- best verified result per player per challenge code; `actions` is the compact move list, replayed server-side
CREATE TABLE IF NOT EXISTS challenge_results (
  code TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  moves INTEGER NOT NULL,
  score INTEGER NOT NULL,
  actions TEXT NOT NULL,
  final_hash TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (code, user_id)
);
CREATE INDEX IF NOT EXISTS challenge_results_code_moves ON challenge_results (code, moves);

CREATE TABLE IF NOT EXISTS daily_results (
  date TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  moves INTEGER NOT NULL,
  score INTEGER NOT NULL,
  actions TEXT NOT NULL,
  final_hash TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (date, user_id)
);
CREATE INDEX IF NOT EXISTS daily_results_date_moves ON daily_results (date, moves);

CREATE TABLE IF NOT EXISTS booster_inventory (
  user_id TEXT NOT NULL REFERENCES users(id),
  booster TEXT NOT NULL,
  count INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, booster)
);
