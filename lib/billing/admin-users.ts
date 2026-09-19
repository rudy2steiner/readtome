import { and, desc, eq, gt, isNotNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { findProduct } from './products';

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

  const [people, usageRows, liveOrders] = await Promise.all([
    database.select().from(schema.users),
    database.select().from(schema.usage),
    database
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.status, 'paid'), isNotNull(schema.orders.periodEnd), gt(schema.orders.periodEnd, now)))
      .orderBy(desc(schema.orders.createdAt)),
  ]);

  const usageByUser = new Map<string, typeof usageRows>();
  for (const row of usageRows) {
    const list = usageByUser.get(row.userUuid) ?? [];
    list.push(row);
    usageByUser.set(row.userUuid, list);
  }

  const planByUser = new Map<string, string>();
  for (const order of liveOrders) {
    if (planByUser.has(order.userUuid)) continue;
    const plan = findProduct(order.productId)?.plan;
    if (plan && plan !== 'free') planByUser.set(order.userUuid, plan);
  }

  const rows: AdminUserRow[] = people.map((user) => {
    const periods = usageByUser.get(user.uuid) ?? [];
    const current = periods.reduce<((typeof periods)[number] | undefined)>(
      (latest, row) => (!latest || row.updatedAt > latest.updatedAt ? row : latest),
      undefined,
    );
    const usedSeconds = periods.reduce((sum, row) => sum + row.usedSeconds, 0);
    const quotaSeconds = current?.quotaSeconds ?? 0;
    const remainingSeconds = current ? Math.max(current.quotaSeconds - current.usedSeconds, 0) : 0;
    const plan = planByUser.get(user.uuid) ?? 'free';
    return {
      uuid: user.uuid,
      email: user.email,
      name: user.name,
      image: user.image,
      plan,
      subscribed: plan !== 'free',
      usedSeconds,
      remainingSeconds,
      quotaSeconds,
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
