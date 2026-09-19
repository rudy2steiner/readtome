-- 登录用户。同一邮箱走两个 OAuth 提供商会是两行。
CREATE TABLE IF NOT EXISTS users (
  uuid TEXT PRIMARY KEY NOT NULL,          -- 产品内稳定用户 id，usage / orders / packs 都挂它
  email TEXT NOT NULL,                     -- Google 返回的邮箱
  name TEXT,                               -- 展示名，可空
  image TEXT,                              -- 头像 URL，可空
  provider TEXT NOT NULL,                  -- OAuth 提供商，现为 google
  provider_account_id TEXT NOT NULL,       -- 提供商侧账号 id；与 provider 组成唯一键
  stripe_customer_id TEXT,                 -- Stripe Customer，开通账单后才有
  created_at INTEGER NOT NULL              -- 创建时间，毫秒时间戳
);

CREATE UNIQUE INDEX IF NOT EXISTS users_provider_account_idx ON users (provider, provider_account_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- 云端额度。订阅：每账期一行，换期不结转。试听：登录写入一行，period_start = 0，不换期。
CREATE TABLE IF NOT EXISTS usage (
  uuid TEXT PRIMARY KEY NOT NULL,          -- 行 id
  user_uuid TEXT NOT NULL,                 -- 对应用户
  engine TEXT NOT NULL,                    -- 额度池，现为 cloud（一份 AI 时长）
  period_start INTEGER NOT NULL,           -- 账期起（含），毫秒；试听为 0；与 user+engine 唯一
  period_end INTEGER NOT NULL,             -- 账期止（不含），毫秒；试听为 0
  quota_seconds INTEGER NOT NULL,          -- 试听 600 / Plus 8h / Pro 16h
  used_seconds INTEGER NOT NULL DEFAULT 0, -- 已占听长时间（秒）；合成前原子累加
  used_chars INTEGER NOT NULL DEFAULT 0,   -- 已合成字符，只给供应商对账，不对外展示
  updated_at INTEGER NOT NULL              -- 最近一次占额/释放，毫秒
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_user_engine_period_idx ON usage (user_uuid, engine, period_start);

-- 订阅与一次性加油包都落这里。Stripe webhook 写入；session id 幂等。
CREATE TABLE IF NOT EXISTS orders (
  uuid TEXT PRIMARY KEY NOT NULL,          -- 行 id；packs.order_uuid 指向它
  user_uuid TEXT NOT NULL,                 -- 付款用户
  product_id TEXT NOT NULL,                -- 如 readtome-plus-monthly / readtome-pack-10h
  stripe_session_id TEXT NOT NULL,         -- Checkout Session，唯一，防 webhook 重放
  stripe_subscription_id TEXT,             -- 订阅单才有；加油包为空
  status TEXT NOT NULL,                    -- paid / canceled，或 Stripe 原状态
  amount_cents INTEGER NOT NULL,           -- 实收金额，分
  currency TEXT NOT NULL DEFAULT 'usd',    -- 币种
  "interval" TEXT,                         -- month / year / once
  period_start INTEGER,                    -- 订阅账期起，毫秒；加油包可空
  period_end INTEGER,                      -- 订阅账期止，毫秒；未过期才算有效订阅
  created_at INTEGER NOT NULL              -- 下单时间，毫秒
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_idx ON orders (stripe_session_id);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_uuid);

-- 加油包余额。套餐用尽后才扣，先旧后新；购买起 12 个月有效，订阅失效期间不可用。
CREATE TABLE IF NOT EXISTS packs (
  uuid TEXT PRIMARY KEY NOT NULL,          -- 包 id，扣减按它定位
  user_uuid TEXT NOT NULL,                 -- 所属用户
  engine TEXT NOT NULL,                    -- 额度池，现为 cloud
  order_uuid TEXT NOT NULL,                -- 对应 orders.uuid
  total_seconds INTEGER NOT NULL,          -- 买入总量（秒），现 +10h = 36000
  remaining_seconds INTEGER NOT NULL,      -- 剩余秒数；原子递减
  expires_at INTEGER NOT NULL,             -- 过期时间，毫秒
  created_at INTEGER NOT NULL              -- 购买时间，毫秒；消耗顺序按此升序
);

CREATE INDEX IF NOT EXISTS packs_user_engine_idx ON packs (user_uuid, engine);
