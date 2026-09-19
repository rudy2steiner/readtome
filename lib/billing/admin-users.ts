import { and, desc, eq, gt, isNotNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { PlanId } from '@/lib/tts/engine';
import { findProduct } from './products';
import { PLAN_QUOTA_SECONDS, TRIAL_PERIOD_START, TRIAL_SECONDS } from './quota';

export const ADMIN_USER_PAGE_SIZES = [20, 50] as const;
export type AdminUserSort = 'used' | 'remaining' | 'created';
export type AdminUserDir = 'asc' | 'desc';

export type AdminUserRow = {
  uuid: string;
  email: string;
  name: string | null;
  image: string | null;
  plan: string;
  subscribed: boolean;
  usedSeconds: number;
  remainingSeconds: number;
  quotaSeconds: number;
  createdAt: string;
};

export type AdminUsersPayload = {
  site: { users: number; usedSeconds: number; remainingSeconds: number };
  users: { items: AdminUserRow[]; total: number; page: number; size: number; pages: number };
  sort: AdminUserSort;
  dir: AdminUserDir;
};

function pageSize(value: unknown): number {
  const size = Number(value);
  return ADMIN_USER_PAGE_SIZES.includes(size as (typeof ADMIN_USER_PAGE_SIZES)[number]) ? size : 20;
}

function pageAt(value: unknown, pages: number): number {
  const page = Math.floor(Number(value));
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, Math.max(pages, 1));
}

function sortKey(value: unknown): AdminUserSort {
  return value === 'remaining' || value === 'created' ? value : 'used';
}

function sortDir(value: unknown): AdminUserDir {
  return value === 'asc' ? 'asc' : 'desc';
}

function calendarPeriodStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function periodStartMs(value: Date | number): number {
  return value instanceof Date ? value.getTime() : value;
}

/** Current-cycle plan/trial plus unexpired packs — not the latest-touched usage row. */
export function adminUserBalance(input: {
  subscribed: boolean;
  plan: PlanId;
  periodStart: Date;
  now?: Date;
  usageRows: { periodStart: Date | number; periodEnd?: Date | number; usedSeconds: number; quotaSeconds: number }[];
  packRemainingSeconds: number;
}): { usedSeconds: number; remainingSeconds: number; quotaSeconds: number } {
  const startMs = (input.subscribed ? input.periodStart : TRIAL_PERIOD_START).getTime();
  const nowMs = (input.now ?? new Date()).getTime();
  const row =
    input.usageRows.find((item) => periodStartMs(item.periodStart) === startMs) ??
    input.usageRows.find((item) => {
      if (!input.subscribed || item.periodEnd == null) return false;
      return periodStartMs(item.periodStart) <= nowMs && nowMs < periodStartMs(item.periodEnd);
    });
  const quotaSeconds = row?.quotaSeconds ?? (input.subscribed ? PLAN_QUOTA_SECONDS[input.plan] : TRIAL_SECONDS);
  const usedSeconds = row?.usedSeconds ?? 0;
  const planRemaining = Math.max(quotaSeconds - usedSeconds, 0);
  const packRemaining = input.subscribed ? Math.max(0, input.packRemainingSeconds) : 0;
  return {
    usedSeconds,
    remainingSeconds: planRemaining + packRemaining,
    quotaSeconds,
  };
}

export async function listAdminUsers(query: {
  page?: unknown;
  size?: unknown;
  sort?: unknown;
  dir?: unknown;
  now?: Date;
}): Promise<AdminUsersPayload | null> {
  const database = await db();
  if (!database) return null;
  const now = query.now ?? new Date();

  const [people, usageRows, liveOrders, livePacks] = await Promise.all([
    database.select().from(schema.users),
    database.select().from(schema.usage),
    database
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.status, 'paid'), isNotNull(schema.orders.periodEnd), gt(schema.orders.periodEnd, now)))
      .orderBy(desc(schema.orders.createdAt)),
    database
      .select({
        userUuid: schema.packs.userUuid,
        remainingSeconds: schema.packs.remainingSeconds,
      })
      .from(schema.packs)
      .where(and(gt(schema.packs.expiresAt, now), gt(schema.packs.remainingSeconds, 0))),
  ]);

  const usageByUser = new Map<string, typeof usageRows>();
  for (const row of usageRows) {
    const list = usageByUser.get(row.userUuid) ?? [];
    list.push(row);
    usageByUser.set(row.userUuid, list);
  }

  const liveByUser = new Map<string, { plan: Exclude<PlanId, 'free'>; periodStart: Date }>();
  for (const order of liveOrders) {
    if (liveByUser.has(order.userUuid)) continue;
    const plan = findProduct(order.productId)?.plan;
    if (plan && plan !== 'free') {
      liveByUser.set(order.userUuid, {
        plan,
        periodStart: order.periodStart ?? calendarPeriodStart(now),
      });
    }
  }

  const packLeftByUser = new Map<string, number>();
  for (const pack of livePacks) {
    packLeftByUser.set(pack.userUuid, (packLeftByUser.get(pack.userUuid) ?? 0) + pack.remainingSeconds);
  }

  const rows: AdminUserRow[] = people.map((user) => {
    const live = liveByUser.get(user.uuid);
    const plan = live?.plan ?? 'free';
    const subscribed = Boolean(live);
    const balance = adminUserBalance({
      subscribed,
      plan,
      periodStart: live?.periodStart ?? TRIAL_PERIOD_START,
      usageRows: usageByUser.get(user.uuid) ?? [],
      packRemainingSeconds: packLeftByUser.get(user.uuid) ?? 0,
    });
    return {
      uuid: user.uuid,
      email: user.email,
      name: user.name,
      image: user.image,
      plan,
      subscribed,
      usedSeconds: balance.usedSeconds,
      remainingSeconds: balance.remainingSeconds,
      quotaSeconds: balance.quotaSeconds,
      createdAt: user.createdAt.toISOString(),
    };
  });

  const sort = sortKey(query.sort);
  const dir = sortDir(query.dir);
  const sign = dir === 'asc' ? 1 : -1;
  rows.sort((left, right) => {
    if (sort === 'created') return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * sign;
    if (sort === 'remaining') return (left.remainingSeconds - right.remainingSeconds) * sign;
    if (left.usedSeconds !== right.usedSeconds) return (left.usedSeconds - right.usedSeconds) * sign;
    return (new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()) * sign;
  });

  const size = pageSize(query.size);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = pageAt(query.page, pages);
  const siteUsed = rows.reduce((sum, row) => sum + row.usedSeconds, 0);
  const siteRemaining = rows.reduce((sum, row) => sum + row.remainingSeconds, 0);

  return {
    site: { users: rows.length, usedSeconds: siteUsed, remainingSeconds: siteRemaining },
    users: {
      items: rows.slice((page - 1) * size, page * size),
      total: rows.length,
      page,
      size,
      pages,
    },
    sort,
    dir,
  };
}
