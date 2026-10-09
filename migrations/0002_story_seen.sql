-- Story beats a player has seen and keepsakes they were given (client/game/story.js): ids from content/story, only
-- ever added. A seen beat never replays, also on another device.
CREATE TABLE IF NOT EXISTS story_seen (
  user_id TEXT NOT NULL REFERENCES users(id),
  beat_id TEXT NOT NULL,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, beat_id)
);
