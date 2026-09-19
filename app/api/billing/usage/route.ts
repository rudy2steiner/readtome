import { and, desc, eq, gt } from 'drizzle-orm';
import { isAdminEmail } from '@/lib/auth/admin';
import { sessionFromRequest } from '@/lib/auth/from-request';
import { getEntitlement } from '@/lib/billing/entitlement';
import { CLOUD_POOL, PLAN_QUOTA_SECONDS, TRIAL_PERIOD_START, TRIAL_SECONDS } from '@/lib/billing/quota';
import { isBillingEnabled } from '@/lib/config/features';
import { db, schema } from '@/lib/db';
import { json, jsonError } from '@/lib/api/respond';
import { withApiLog } from '@/lib/log/call';
import { listUserListens } from '@/lib/tts/listens';

export const GET = withApiLog('billing.usage', async (req) => {
  if (!isBillingEnabled) return jsonError('billing_disabled', 503);

  const session = await sessionFromRequest(req);
  const uuid = session?.user?.uuid;
  if (!uuid) return jsonError('unauthenticated', 401);
  const database = await db();
  if (!database) return jsonError('database_not_configured', 503);

  const entitlement = await getEntitlement(uuid);
  const periodStart = entitlement.subscribed ? entitlement.periodStart : TRIAL_PERIOD_START;
  const usageRows = await database
    .select()
    .from(schema.usage)
    .where(and(eq(schema.usage.userUuid, uuid), eq(schema.usage.periodStart, periodStart)));

  const packs = await database
    .select()
    .from(schema.packs)
    .where(and(eq(schema.packs.userUuid, uuid), gt(schema.packs.expiresAt, new Date()), gt(schema.packs.remainingSeconds, 0)))
    .orderBy(schema.packs.expiresAt);

  const orders = await database.select().from(schema.orders).where(eq(schema.orders.userUuid, uuid)).orderBy(desc(schema.orders.createdAt)).limit(12);

  const quota = entitlement.subscribed ? PLAN_QUOTA_SECONDS[entitlement.plan] : TRIAL_SECONDS;
  const row = usageRows.find((item) => item.engine === CLOUD_POOL);
  const quotaSeconds = row?.quotaSeconds ?? quota;
  const usedSeconds = row?.usedSeconds ?? 0;
  const remainingSeconds = Math.max(quotaSeconds - usedSeconds, 0);
  const pools = [
    {
      engine: CLOUD_POOL,
      quotaSeconds,
      usedSeconds,
      remainingSeconds,
    },
  ];

  return json({
    admin: isAdminEmail(session.user.email),
    plan: entitlement.plan,
    subscribed: entitlement.subscribed,
    periodStart: entitlement.periodStart.toISOString(),
    periodEnd: entitlement.periodEnd.toISOString(),
    pools,
    packs: packs.map((pack) => ({
      engine: pack.engine,
      remainingSeconds: pack.remainingSeconds,
      totalSeconds: pack.totalSeconds,
      expiresAt: pack.expiresAt.toISOString(),
    })),
    trial: entitlement.subscribed
      ? { remainingSeconds: 0, consumed: true }
      : { remainingSeconds, consumed: remainingSeconds <= 0 },
    orders: orders.map((order) => ({
      id: order.uuid,
      productId: order.productId,
      status: order.status,
      amountCents: order.amountCents,
      currency: order.currency,
      interval: order.interval,
      periodStart: order.periodStart ? order.periodStart.toISOString() : null,
      periodEnd: order.periodEnd ? order.periodEnd.toISOString() : null,
      createdAt: order.createdAt.toISOString(),
    })),
    clips: await listUserListens(uuid, {
      page: new URL(req.url).searchParams.get('page'),
      size: new URL(req.url).searchParams.get('size'),
    }),
  });
});
