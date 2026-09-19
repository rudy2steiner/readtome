'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { loadAdminCache, loadUsageCache, saveAdminCache, saveUsageCache } from '@/lib/billing/usage-cache';
import { findProduct } from '@/lib/billing/products';
import { loggedFetch } from '@/lib/log/call';
import { signInWithGoogle } from '@/lib/auth/google-sign-in';

const CLIP_PAGE_SIZES = [10, 20, 50] as const;
const CLIP_DEFAULT_SIZE = 10;

type Clip = {
  id: string;
  text: string;
  voiceId: string;
  voiceName: string;
  seconds: number;
  chargedSeconds?: number;
  cached: boolean;
  playCount: number;
  partCount: number;
  createdAt: string;
  lastHeardAt: string;
};

type AdminUser = {
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

type AdminPayload = {
  site: { users: number; usedSeconds: number; remainingSeconds: number };
  users: { items: AdminUser[]; total: number; page: number; size: number; pages: number };
  sort: 'used' | 'remaining' | 'created';
  dir: 'asc' | 'desc';
  clicks?: {
    total: number;
    byProduct: { productId: string; productName: string; count: number }[];
    items: { productId: string; productName: string; email: string | null; createdAt: string }[];
  };
};

type OrderRow = {
  id?: string;
  productId: string;
  status: string;
  amountCents: number;
  currency?: string;
  interval?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  createdAt: string;
};

type UsagePayload = {
  admin?: boolean;
  plan: string;
  subscribed: boolean;
  periodStart: string;
  periodEnd: string;
  pools: { engine: string; quotaSeconds: number; usedSeconds: number; remainingSeconds: number }[];
  packs: { engine: string; remainingSeconds: number; totalSeconds?: number; expiresAt: string }[];
  trial: { remainingSeconds: number; consumed: boolean };
  orders: OrderRow[];
  clips: { items: Clip[]; total: number; page: number; size: number; pages: number };
};

type AccountTab = 'usage' | 'billing' | 'admin';
const ADMIN_PAGE_SIZES = [20, 50] as const;

function formatClipTime(seconds: number, t: ReturnType<typeof useTranslations>): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) {
    return rest || minutes
      ? `${hours}h ${minutes}m ${String(rest).padStart(2, '0')}s`
      : `${hours}h`;
  }
  if (minutes === 0) return t('sec', { n: total });
  if (rest === 0) return t('minSec', { m: minutes, s: '00' });
  return t('minSec', { m: minutes, s: String(rest).padStart(2, '0') });
}

export function AccountPage() {
  const t = useTranslations('account');
  const { data: session, status } = useSession();
  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AccountTab>('usage');
  const [clipPage, setClipPage] = useState(1);
  const [clipSize, setClipSize] = useState(CLIP_DEFAULT_SIZE);
  const [admin, setAdmin] = useState<AdminPayload | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminPage, setAdminPage] = useState(1);
  const [adminSize, setAdminSize] = useState(20);
  const [adminSort, setAdminSort] = useState<AdminPayload['sort']>('used');
  const [adminDir, setAdminDir] = useState<AdminPayload['dir']>('desc');

  const cacheUser = session?.user?.uuid || session?.user?.email || '';

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('checkout') === 'success') {
      setTab('billing');
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !cacheUser) return;
    const cached = loadUsageCache(cacheUser, clipPage, clipSize);
    if (cached) {
      setUsage({ ...cached, clips: normalizeClips(cached.clips, clipPage, clipSize) });
      setError(null);
    }

    let cancelled = false;
    loggedFetch('client.billing.usage', `/api/billing/usage?page=${clipPage}&size=${clipSize}`, { cache: 'no-store' })
      .then(async (r) => {
        const data = (await r.json()) as UsagePayload & { error?: string; clips?: UsagePayload['clips'] | Clip[] };
        if (!r.ok) throw new Error(data.error || 'usage');
        return { ...data, clips: normalizeClips(data.clips, clipPage, clipSize) };
      })
      .then((fresh) => {
        if (cancelled) return;
        setUsage(fresh);
        setError(null);
        saveUsageCache(cacheUser, clipPage, clipSize, fresh);
      })
      .catch((err) => {
        if (cancelled || cached) return;
        setError(err instanceof Error ? err.message : 'usage');
      });
    return () => {
      cancelled = true;
    };
  }, [status, cacheUser, clipPage, clipSize]);

  useEffect(() => {
    if (status !== 'authenticated' || !cacheUser || !usage?.admin) return;
    const cached = loadAdminCache(cacheUser, adminPage, adminSize, adminSort, adminDir);
    if (cached) {
      setAdmin(cached as AdminPayload);
      setAdminError(null);
    }
    if (tab !== 'admin') return;

    let cancelled = false;
    loggedFetch(
      'client.admin.users',
      `/api/admin/users?page=${adminPage}&size=${adminSize}&sort=${adminSort}&dir=${adminDir}`,
      { cache: 'no-store' },
    )
      .then(async (r) => {
        const data = (await r.json()) as AdminPayload & { error?: string };
        if (!r.ok) throw new Error(data.error || 'admin');
        return data;
      })
      .then((fresh) => {
        if (cancelled) return;
        setAdmin(fresh);
        setAdminError(null);
        saveAdminCache(cacheUser, adminPage, adminSize, adminSort, adminDir, fresh);
      })
      .catch((err) => {
        if (cancelled || cached) return;
        setAdminError(err instanceof Error ? err.message : 'admin');
      });
    return () => {
      cancelled = true;
    };
  }, [status, cacheUser, usage?.admin, tab, adminPage, adminSize, adminSort, adminDir]);

  if (status === 'loading') return <p className="lp-wrap py-12 text-left text-muted-foreground">{t('loading')}</p>;

  if (!session?.user) {
    return (
      <div className="lp-wrap py-16 text-left">
        <h1 className="text-2xl font-bold">{t('needSignIn')}</h1>
        <button type="button" className="mt-4 text-primary underline" onClick={() => void signInWithGoogle('/account')}>
          {t('signIn')}
        </button>
      </div>
    );
  }

  return (
    <div className="lp-wrap py-12 text-left">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-muted-foreground">
        {t('signedInAs')} {session.user.email}
      </p>

      {error && (
        <p className="mt-6 text-sm text-muted-foreground">
          {error === 'database_not_configured' ? t('unavailable') : t('loadFailed')}
        </p>
      )}

      {usage && (
        <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
          <nav className="flex shrink-0 flex-row gap-1 md:w-44 md:flex-col" aria-label={t('title')}>
            <TabButton active={tab === 'usage'} onClick={() => setTab('usage')}>
              {t('tabUsage')}
            </TabButton>
            <TabButton active={tab === 'billing'} onClick={() => setTab('billing')}>
              {t('tabBilling')}
            </TabButton>
            {usage.admin && (
              <TabButton active={tab === 'admin'} onClick={() => setTab('admin')}>
                {t('tabAdmin')}
              </TabButton>
            )}
          </nav>

          <div className="min-w-0 flex-1">
            {tab === 'usage' ? (
              <UsagePanel
                usage={usage}
                t={t}
                onPage={setClipPage}
                onSize={(size) => {
                  setClipSize(size);
                  setClipPage(1);
                }}
              />
            ) : tab === 'billing' ? (
              <BillingPanel usage={usage} t={t} />
            ) : (
              <AdminPanel
                admin={admin}
                error={adminError}
                t={t}
                onPage={setAdminPage}
                onSize={(size) => {
                  setAdminSize(size);
                  setAdminPage(1);
                }}
                onSort={(sort) => {
                  if (sort === adminSort) setAdminDir((dir) => (dir === 'desc' ? 'asc' : 'desc'));
                  else {
                    setAdminSort(sort);
                    setAdminDir('desc');
                  }
                  setAdminPage(1);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function normalizeClips(
  clips: UsagePayload['clips'] | Clip[] | undefined,
  page: number,
  size: number,
): UsagePayload['clips'] {
  if (clips && !Array.isArray(clips) && Array.isArray(clips.items)) return clips;
  const items = Array.isArray(clips) ? clips : [];
  return { items, total: items.length, page, size, pages: 1 };
}

function UsagePanel({
  usage,
  t,
  onPage,
  onSize,
}: {
  usage: UsagePayload;
  t: ReturnType<typeof useTranslations>;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  return (
    <section className="rounded-2xl border p-6 text-left">
      <h2 className="font-semibold">{t('plan')}</h2>
      <p className="mt-1 text-2xl font-bold capitalize">{usage.plan}</p>
      {usage.subscribed && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('resets')} {new Date(usage.periodEnd).toLocaleDateString()}
        </p>
      )}
      <div className="mt-6 space-y-4">
        {usage.pools.map((pool) => {
          const pct = pool.quotaSeconds > 0 ? Math.min(100, (pool.usedSeconds / pool.quotaSeconds) * 100) : 0;
          return (
            <div key={pool.engine} className="rounded-xl bg-muted/50 p-4">
              <p className="text-sm font-semibold">{t('planPool')}</p>
              <p className="mt-2 text-lg tabular-nums">
                {formatClipTime(pool.usedSeconds, t)} / {formatClipTime(pool.quotaSeconds, t)}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('remaining')} {formatClipTime(pool.remainingSeconds, t)}
                {usage.subscribed ? ` · ${t('resets')} ${new Date(usage.periodEnd).toLocaleDateString()}` : ''}
              </p>
            </div>
          );
        })}
        {usage.packs.map((pack) => {
          const total = pack.totalSeconds ?? pack.remainingSeconds;
          const used = Math.max(0, total - pack.remainingSeconds);
          const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
          return (
            <div key={`${pack.engine}-${pack.expiresAt}`} className="rounded-xl bg-muted/50 p-4">
              <p className="text-sm font-semibold">{t('packs')}</p>
              <p className="mt-2 text-lg tabular-nums">
                {formatClipTime(used, t)} / {formatClipTime(total, t)}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('remaining')} {formatClipTime(pack.remainingSeconds, t)}
                {' · '}
                {t('packValid', { date: new Date(pack.expiresAt).toLocaleDateString() })}
              </p>
            </div>
          );
        })}
      </div>
      {!usage.subscribed && (
        <p className="mt-4 text-sm text-muted-foreground">
          {t('trialLeft')} {formatClipTime(usage.trial.remainingSeconds, t)}
        </p>
      )}

      <div className="mt-8 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">{t('clips')}</h3>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {t('clipsPageSize')}
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm text-foreground"
              value={usage.clips.size}
              onChange={(event) => onSize(Number(event.target.value))}
            >
              {CLIP_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        {usage.clips.total === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('clipsEmpty')}</p>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {usage.clips.items.map((clip) => (
                <ClipRow key={clip.id} clip={clip} t={t} />
              ))}
            </ul>
            <ClipPager clips={usage.clips} t={t} onPage={onPage} />
          </>
        )}
      </div>
    </section>
  );
}

function ClipPager({
  clips,
  t,
  onPage,
}: {
  clips: UsagePayload['clips'];
  t: ReturnType<typeof useTranslations>;
  onPage: (page: number) => void;
}) {
  if (clips.pages <= 1) return null;
  const from = (clips.page - 1) * clips.size + 1;
  const to = Math.min(clips.page * clips.size, clips.total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">{t('clipsRange', { from, to, total: clips.total })}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={clips.page <= 1}
          onClick={() => onPage(clips.page - 1)}
        >
          {t('clipsPrev')}
        </button>
        <span className="tabular-nums text-muted-foreground">{t('clipsPage', { page: clips.page, pages: clips.pages })}</span>
        <button
          type="button"
          className="rounded-md border px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={clips.page >= clips.pages}
          onClick={() => onPage(clips.page + 1)}
        >
          {t('clipsNext')}
        </button>
      </div>
    </div>
  );
}

function ClipRow({ clip, t }: { clip: Clip; t: ReturnType<typeof useTranslations> }) {
  const [open, setOpen] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [moreBelow, setMoreBelow] = useState(false);
  const duration = clip.seconds;
  const long = clip.text.length > 160 || clip.text.includes('\n');

  const syncOverflow = () => {
    const el = textRef.current;
    if (!el || !open) {
      setOverflows(false);
      setMoreBelow(false);
      return;
    }
    const hasOverflow = el.scrollHeight > el.clientHeight + 1;
    setOverflows(hasOverflow);
    setMoreBelow(hasOverflow && el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };

  useEffect(() => {
    const el = textRef.current;
    if (!open || !el) {
      setOverflows(false);
      setMoreBelow(false);
      return;
    }
    const update = () => {
      const hasOverflow = el.scrollHeight > el.clientHeight + 1;
      setOverflows(hasOverflow);
      setMoreBelow(hasOverflow && el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, clip.text]);

  return (
    <li className="rounded-xl bg-muted/50 p-4">
      <div className="relative">
        {open || !long ? (
          <div
            ref={textRef}
            onScroll={syncOverflow}
            className={
              open
                ? 'max-h-48 overflow-y-auto whitespace-pre-wrap pr-1 text-sm leading-relaxed'
                : 'text-sm leading-relaxed'
            }
          >
            {clip.text}
          </div>
        ) : (
          <button
            type="button"
            className="line-clamp-2 w-full text-left text-sm leading-relaxed"
            aria-expanded={false}
            onClick={() => setOpen(true)}
          >
            {clip.text}
          </button>
        )}
        {open && moreBelow ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted to-transparent"
          />
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {clip.voiceName}
        {' · '}
        {new Date(clip.lastHeardAt).toLocaleString()}
        {duration > 0 ? ` · ${formatClipTime(duration, t)}` : ''}
        {clip.partCount > 1 ? ` · ${t('clipsParts', { count: clip.partCount })}` : ''}
        {clip.playCount > 1 ? ` · ${t('clipsPlays', { count: clip.playCount })}` : ''}
      </p>
      {long || (open && overflows) ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {long ? (
            <button
              type="button"
              className="text-xs font-medium text-primary"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? t('clipsCollapse') : t('clipsExpand')}
            </button>
          ) : null}
          {open && overflows ? <span className="text-xs text-muted-foreground">{t('clipsScroll')}</span> : null}
        </div>
      ) : null}
      <ClipAudio id={clip.id} partCount={clip.partCount || 1} unavailable={t('clipUnavailable')} />
    </li>
  );
}

function ClipAudio({ id, partCount, unavailable }: { id: string; partCount: number; unavailable: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [part, setPart] = useState(0);
  const [missing, setMissing] = useState(false);
  const count = Math.max(1, partCount);
  const src = `/api/billing/clip/${id}?part=${part}`;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || part === 0) return;
    void audio.play().catch(() => undefined);
  }, [part]);

  return (
    <div className="mt-3">
      {missing ? (
        <p className="text-xs text-muted-foreground">{unavailable}</p>
      ) : (
        <audio
          ref={audioRef}
          className="w-full"
          controls
          preload="none"
          src={src}
          onEnded={() => {
            if (part + 1 < count) setPart(part + 1);
            else setPart(0);
          }}
          onError={() => setMissing(true)}
        />
      )}
    </div>
  );
}

function AdminPanel({
  admin,
  error,
  t,
  onPage,
  onSize,
  onSort,
}: {
  admin: AdminPayload | null;
  error: string | null;
  t: ReturnType<typeof useTranslations>;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
  onSort: (sort: AdminPayload['sort']) => void;
}) {
  if (error) {
    return (
      <section className="rounded-2xl border p-6 text-left">
        <p className="text-sm text-muted-foreground">{error === 'forbidden' ? t('adminForbidden') : t('loadFailed')}</p>
      </section>
    );
  }
  if (!admin) {
    return (
      <section className="rounded-2xl border p-6 text-left">
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </section>
    );
  }

  const mark = (sort: AdminPayload['sort']) =>
    admin.sort === sort ? (admin.dir === 'desc' ? ' ↓' : ' ↑') : '';

  return (
    <section className="rounded-2xl border p-6 text-left">
      <h2 className="font-semibold">{t('tabAdmin')}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStat label={t('adminUsers')} value={String(admin.site.users)} />
        <AdminStat label={t('adminSiteUsed')} value={formatClipTime(admin.site.usedSeconds, t)} />
        <AdminStat label={t('adminSiteLeft')} value={formatClipTime(admin.site.remainingSeconds, t)} />
        <AdminStat label={t('adminClicks')} value={String(admin.clicks?.total ?? 0)} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {admin.dir === 'asc' ? t('adminSortAsc') : t('adminSortDesc')}
        </p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t('clipsPageSize')}
          <select
            className="rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            value={admin.users.size}
            onChange={(event) => onSize(Number(event.target.value))}
          >
            {ADMIN_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {admin.users.total === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t('adminEmpty')}</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">{t('adminColUser')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('adminColPlan')}</th>
                  <th className="pb-2 pr-3 font-medium">
                    <button type="button" className="font-medium hover:text-foreground" onClick={() => onSort('used')}>
                      {t('adminColUsed')}
                      {mark('used')}
                    </button>
                  </th>
                  <th className="pb-2 pr-3 font-medium">
                    <button type="button" className="font-medium hover:text-foreground" onClick={() => onSort('remaining')}>
                      {t('adminColLeft')}
                      {mark('remaining')}
                    </button>
                  </th>
                  <th className="pb-2 font-medium">
                    <button type="button" className="font-medium hover:text-foreground" onClick={() => onSort('created')}>
                      {t('adminColJoined')}
                      {mark('created')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {admin.users.items.map((user) => (
                  <tr key={user.uuid} className="border-b last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-medium">{user.name || user.email}</p>
                      {user.name ? <p className="text-xs text-muted-foreground">{user.email}</p> : null}
                    </td>
                    <td className="py-3 pr-3 capitalize">{user.plan}</td>
                    <td className="py-3 pr-3 tabular-nums">{formatClipTime(user.usedSeconds, t)}</td>
                    <td className="py-3 pr-3 tabular-nums">{formatClipTime(user.remainingSeconds, t)}</td>
                    <td className="py-3 tabular-nums text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ClipPager clips={admin.users} t={t} onPage={onPage} />
        </>
      )}

      <div className="mt-8 border-t pt-6">
        <h3 className="font-semibold">{t('adminClicks')}</h3>
        {admin.clicks?.byProduct.length ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {admin.clicks.byProduct.map((item) => `${item.productName} ${item.count}`).join(' · ')}
          </p>
        ) : null}
        {!admin.clicks?.items.length ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('adminClicksEmpty')}</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {admin.clicks.items.map((click, index) => (
              <li key={`${click.productId}-${click.createdAt}-${index}`} className="flex flex-wrap justify-between gap-2">
                <span>
                  {click.productName}
                  <span className="text-muted-foreground"> · {click.email || t('adminAnonymous')}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{new Date(click.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AdminStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function orderProductLabel(productId: string, t: ReturnType<typeof useTranslations>): string {
  const product = findProduct(productId);
  if (!product) return productId;
  if (product.plan === 'plus') return t('orderPlus');
  if (product.plan === 'pro') return t('orderPro');
  if (product.packSeconds) return t('orderPack', { hours: Math.round(product.packSeconds / 3600) });
  return product.name;
}

function orderIntervalLabel(interval: string | null | undefined, t: ReturnType<typeof useTranslations>): string | null {
  if (interval === 'month') return t('orderMonthly');
  if (interval === 'year') return t('orderYearly');
  if (interval === 'once') return t('orderOnce');
  return null;
}

function orderStatusLabel(status: string, t: ReturnType<typeof useTranslations>): string {
  if (status === 'paid' || status === 'complete' || status === 'active' || status === 'trialing') return t('orderPaid');
  if (status === 'canceled' || status === 'unpaid') return t('orderCanceled');
  if (status === 'created' || status === 'incomplete' || status === 'open') return t('orderPending');
  return status;
}

function formatOrderMoney(cents: number, currency: string | undefined, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : locale, {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function formatOrderTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale === 'zh' ? 'zh-CN' : locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function BillingPanel({ usage, t }: { usage: UsagePayload; t: ReturnType<typeof useTranslations> }) {
  const locale = useLocale();
  const orders = usage.orders.filter((order) => {
    const status = order.status;
    return status !== 'created' && status !== 'incomplete' && status !== 'open';
  });
  return (
    <section className="rounded-2xl border p-6 text-left">
      <h2 className="font-semibold">{t('orders')}</h2>
      {orders.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t('noOrders')}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {orders.map((order) => {
            const interval = orderIntervalLabel(order.interval ?? findProduct(order.productId)?.interval, t);
            const period =
              order.periodStart && order.periodEnd
                ? `${new Date(order.periodStart).toLocaleDateString(locale === 'zh' ? 'zh-CN' : locale)} – ${new Date(order.periodEnd).toLocaleDateString(locale === 'zh' ? 'zh-CN' : locale)}`
                : null;
            return (
              <li key={order.id ?? `${order.productId}-${order.createdAt}`} className="rounded-xl bg-muted/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {orderProductLabel(order.productId, t)}
                      {interval ? <span className="font-normal text-muted-foreground"> · {interval}</span> : null}
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">{orderStatusLabel(order.status, t)}</p>
                  </div>
                  <p className="text-base font-semibold tabular-nums">{formatOrderMoney(order.amountCents, order.currency, locale)}</p>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {order.id ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">{t('orderId')}</dt>
                      <dd className="mt-0.5 break-all font-mono text-xs tabular-nums">{order.id}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('orderTime')}</dt>
                    <dd className="mt-0.5 tabular-nums">{formatOrderTime(order.createdAt, locale)}</dd>
                  </div>
                  {period ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">{t('orderPeriod')}</dt>
                      <dd className="mt-0.5 tabular-nums">{period}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
      {usage.subscribed && (
        <button
          type="button"
          className="mt-4 text-sm text-primary underline"
          onClick={async () => {
            const response = await loggedFetch('client.billing.portal', '/api/billing/portal', { method: 'POST' });
            const data = (await response.json()) as { url?: string };
            if (data.url) window.location.href = data.url;
          }}
        >
          {t('manage')}
        </button>
      )}
    </section>
  );
}
