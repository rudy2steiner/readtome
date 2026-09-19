import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** 产品内稳定 id（UUID 文本）。 */
const uuid = (name = 'uuid') => text(name).primaryKey().$defaultFn(() => crypto.randomUUID());

/** 毫秒时间戳。 */
const createdAt = () => integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date());

/** 登录用户。同一邮箱走两个 OAuth 提供商会是两行。 */
export const users = sqliteTable(
  'users',
  {
    /** 产品内稳定用户 id，usage / orders / packs 都挂它。 */
    uuid: uuid(),
    /** Google 返回的邮箱。 */
    email: text('email').notNull(),
    /** 展示名，可空。 */
    name: text('name'),
    /** 头像 URL，可空。 */
    image: text('image'),
    /** OAuth 提供商，现为 google。同一邮箱两个提供商是两行。 */
    provider: text('provider').notNull(),
    /** 提供商侧账号 id；与 provider 组成唯一键。 */
    providerAccountId: text('provider_account_id').notNull(),
    /** Stripe Customer，开通账单后才有。 */
    stripeCustomerId: text('stripe_customer_id'),
    /** 创建时间。 */
    createdAt: createdAt(),
  },
  (table) => ({
    byProviderAccount: uniqueIndex('users_provider_account_idx').on(table.provider, table.providerAccountId),
    byEmail: index('users_email_idx').on(table.email),
  }),
);

/**
 * 云端额度。订阅：每账期一行，换期不结转。
 * 试听：新用户登录写入一行，`period_start = 0`，终身一次不换期。
 */
export const usage = sqliteTable(
  'usage',
  {
    /** 行 id。 */
    uuid: uuid(),
    /** 对应用户。 */
    userUuid: text('user_uuid').notNull(),
    /** 额度池，现为 `cloud`。 */
    engine: text('engine').notNull(),
    /** 账期起（含）。试听为 0；订阅为 Stripe 账期。与 user+engine 唯一。 */
    periodStart: integer('period_start', { mode: 'timestamp_ms' }).notNull(),
    /** 账期止（不含）。 */
    periodEnd: integer('period_end', { mode: 'timestamp_ms' }).notNull(),
    /** 本期总额度秒数：试听由 NEXT_PUBLIC_TRIAL_MINUTES 写入 / Plus 8h / Pro 16h。 */
    quotaSeconds: integer('quota_seconds').notNull(),
    /** 已占听长时间（秒）。合成前 `used + n <= quota` 才累加。 */
    usedSeconds: integer('used_seconds').notNull().default(0),
    /** 已合成字符，只对账，不对外展示。 */
    usedChars: integer('used_chars').notNull().default(0),
    /** 最近一次占额或释放。 */
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    byUserEngine: uniqueIndex('usage_user_engine_period_idx').on(table.userUuid, table.engine, table.periodStart),
  }),
);

/** 订阅与一次性加油包。Stripe webhook 写入；`stripe_session_id` 幂等。 */
export const orders = sqliteTable(
  'orders',
  {
    /** 行 id；packs.order_uuid 指向它。 */
    uuid: uuid(),
    /** 付款用户。 */
    userUuid: text('user_uuid').notNull(),
    /** 如 `readtome-plus-monthly` / `readtome-pack-10h`。 */
    productId: text('product_id').notNull(),
    /** Checkout Session，唯一，防 webhook 重放。 */
    stripeSessionId: text('stripe_session_id').notNull(),
    /** 订阅单才有；加油包为空。 */
    stripeSubscriptionId: text('stripe_subscription_id'),
    /** `paid` / `canceled`，或 Stripe 原状态。 */
    status: text('status').notNull(),
    /** 实收金额，分。 */
    amountCents: integer('amount_cents').notNull(),
    /** 币种。 */
    currency: text('currency').notNull().default('usd'),
    /** `month` / `year` / `once`。 */
    interval: text('interval'),
    /** 订阅账期起；加油包可空。 */
    periodStart: integer('period_start', { mode: 'timestamp_ms' }),
    /** 订阅账期止；未过期才算有效订阅。 */
    periodEnd: integer('period_end', { mode: 'timestamp_ms' }),
    /** 下单时间。 */
    createdAt: createdAt(),
  },
  (table) => ({
    bySession: uniqueIndex('orders_stripe_session_idx').on(table.stripeSessionId),
    byUser: index('orders_user_idx').on(table.userUuid),
  }),
);

/**
 * 加油包余额。套餐用尽后才扣，先旧后新；购买起 12 个月有效。
 * 订阅失效期间不可用。
 */
export const packs = sqliteTable(
  'packs',
  {
    /** 包 id，扣减按它定位。 */
    uuid: uuid(),
    /** 所属用户。 */
    userUuid: text('user_uuid').notNull(),
    /** 额度池，现为 `cloud`。 */
    engine: text('engine').notNull(),
    /** 对应 `orders.uuid`。 */
    orderUuid: text('order_uuid').notNull(),
    /** 买入总量（秒），现 +10h = 36000。 */
    totalSeconds: integer('total_seconds').notNull(),
    /** 剩余秒数；原子递减。 */
    remainingSeconds: integer('remaining_seconds').notNull(),
    /** 过期时间。 */
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    /** 购买时间；消耗顺序按此升序。 */
    createdAt: createdAt(),
  },
  (table) => ({
    byUserEngine: index('packs_user_engine_idx').on(table.userUuid, table.engine),
  }),
);

/**
 * 一次阅读（同一用户 + 同一篇原文 + 同一声音）一行。
 * cache_key 是整篇的 session hash；各段 mp3 的 R2 key 在 parts 里。
 */
export const listens = sqliteTable(
  'listens',
  {
    uuid: uuid(),
    userUuid: text('user_uuid').notNull(),
    cacheKey: text('cache_key').notNull(),
    text: text('text').notNull(),
    voiceId: text('voice_id').notNull(),
    seconds: integer('seconds').notNull().default(0),
    cached: integer('cached', { mode: 'boolean' }).notNull().default(false),
    playCount: integer('play_count').notNull().default(1),
    createdAt: createdAt(),
    lastHeardAt: integer('last_heard_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
    /** JSON: { index, cacheKey, seconds, cached }[]，按朗读切段顺序。 */
    parts: text('parts').notNull().default('[]'),
  },
  (table) => ({
    byUserKey: uniqueIndex('listens_user_cache_idx').on(table.userUuid, table.cacheKey),
    byUserHeard: index('listens_user_heard_idx').on(table.userUuid, table.lastHeardAt),
  }),
);

/** Pricing CTA clicks. Stripe is optional; this is how we see demand before checkout exists. */
export const pricingClicks = sqliteTable(
  'pricing_clicks',
  {
    uuid: uuid(),
    userUuid: text('user_uuid'),
    email: text('email'),
    productId: text('product_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    byCreated: index('pricing_clicks_created_idx').on(table.createdAt),
    byProduct: index('pricing_clicks_product_idx').on(table.productId),
  }),
);
