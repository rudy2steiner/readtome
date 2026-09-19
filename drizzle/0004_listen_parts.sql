-- 一次阅读合并成一行：整篇原文 + 各段音频 key。
ALTER TABLE listens ADD COLUMN parts TEXT NOT NULL DEFAULT '[]';

-- 已有按切段存的行，把原来的 cache_key 收成一段，避免播放时找不到音频。
UPDATE listens
SET parts = printf(
  '[{"index":0,"cacheKey":"%s","seconds":%d,"cached":%s}]',
  cache_key,
  seconds,
  CASE cached WHEN 1 THEN 'true' ELSE 'false' END
)
WHERE parts = '[]';
