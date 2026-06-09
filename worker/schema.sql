-- 预测表
CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  match_date TEXT NOT NULL,
  match_id TEXT NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(nickname, match_date, match_id)
);

-- 比赛结果表
CREATE TABLE IF NOT EXISTS results (
  match_id TEXT PRIMARY KEY,
  match_date TEXT NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
