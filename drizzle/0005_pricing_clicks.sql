-- 定价页付费按钮点击。订阅未接通时也能记需求。
CREATE TABLE IF NOT EXISTS pricing_clicks (
  uuid TEXT PRIMARY KEY NOT NULL,
  user_uuid TEXT,
  email TEXT,
  product_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS pricing_clicks_created_idx ON pricing_clicks (created_at);
CREATE INDEX IF NOT EXISTS pricing_clicks_product_idx ON pricing_clicks (product_id);
