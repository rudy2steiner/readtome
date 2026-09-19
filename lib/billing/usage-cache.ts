const PREFIX = 'readtome.usage.v1';

export type CachedUsage = {
  plan: string;
  subscribed: boolean;
  periodStart: string;
  periodEnd: string;
  pools: { engine: string; quotaSeconds: number; usedSeconds: number; remainingSeconds: number }[];
  packs: { engine: string; remainingSeconds: number; expiresAt: string }[];
  trial: { remainingSeconds: number; consumed: boolean };
  orders: { productId: string; status: string; amountCents: number; createdAt: string }[];
  clips: { items: unknown[]; total: number; page: number; size: number; pages: number };
  admin?: boolean;
};

function key(user: string, page: number, size: number) {
  return `${PREFIX}:${user}:${page}:${size}`;
}

function isCachedUsage(value: unknown): value is CachedUsage {
  if (!value || typeof value !== 'object') return false;
  const row = value as CachedUsage;
  return (
    typeof row.plan === 'string' &&
    typeof row.subscribed === 'boolean' &&
    Array.isArray(row.pools) &&
    Array.isArray(row.packs) &&
    Array.isArray(row.orders) &&
    Boolean(row.clips && Array.isArray(row.clips.items))
  );
}

export function loadUsageCache(user: string, page: number, size: number): CachedUsage | null {
  if (typeof window === 'undefined' || !user) return null;
  try {
    const raw = window.localStorage.getItem(key(user, page, size));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isCachedUsage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveUsageCache(user: string, page: number, size: number, payload: CachedUsage): void {
  if (typeof window === 'undefined' || !user) return;
  try {
    window.localStorage.setItem(key(user, page, size), JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}

const ADMIN_PREFIX = 'readtome.admin.v1';

export type CachedAdmin = {
  site: { users: number; usedSeconds: number; remainingSeconds: number };
  users: { items: unknown[]; total: number; page: number; size: number; pages: number };
  sort: 'used' | 'remaining' | 'created';
  dir: 'asc' | 'desc';
};

function adminKey(user: string, page: number, size: number, sort: string, dir: string) {
  return `${ADMIN_PREFIX}:${user}:${page}:${size}:${sort}:${dir}`;
}

function isCachedAdmin(value: unknown): value is CachedAdmin {
  if (!value || typeof value !== 'object') return false;
  const row = value as CachedAdmin;
  return (
    Boolean(row.site && typeof row.site.users === 'number') &&
    Boolean(row.users && Array.isArray(row.users.items)) &&
    (row.sort === 'used' || row.sort === 'remaining' || row.sort === 'created') &&
    (row.dir === 'asc' || row.dir === 'desc')
  );
}

export function loadAdminCache(
  user: string,
  page: number,
  size: number,
  sort: CachedAdmin['sort'],
  dir: CachedAdmin['dir'],
): CachedAdmin | null {
  if (typeof window === 'undefined' || !user) return null;
  try {
    const raw = window.localStorage.getItem(adminKey(user, page, size, sort, dir));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isCachedAdmin(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAdminCache(
  user: string,
  page: number,
  size: number,
  sort: CachedAdmin['sort'],
  dir: CachedAdmin['dir'],
  payload: CachedAdmin,
): void {
  if (typeof window === 'undefined' || !user) return;
  try {
    window.localStorage.setItem(adminKey(user, page, size, sort, dir), JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}
