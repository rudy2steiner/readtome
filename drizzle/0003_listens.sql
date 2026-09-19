-- 用户听过的云端片段。R2 用 cache_key 取 mp3；同一用户同一 key 一行。
CREATE TABLE IF NOT EXISTS listens (
  uuid TEXT PRIMARY KEY NOT NULL,
  user_uuid TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  text TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  cached INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_heard_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS listens_user_cache_idx ON listens (user_uuid, cache_key);
CREATE INDEX IF NOT EXISTS listens_user_heard_idx ON listens (user_uuid, last_heard_at);
