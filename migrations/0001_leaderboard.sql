CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  rules_key TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  consumed_at INTEGER,
  simulation INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rules_key TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  solved INTEGER NOT NULL,
  max_combo INTEGER NOT NULL,
  average_accuracy INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES game_sessions(id)
);
CREATE INDEX IF NOT EXISTS leaderboard_by_rules_score ON leaderboard_entries(rules_key, score DESC, solved DESC, created_at ASC, id ASC);
