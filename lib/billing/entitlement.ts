import { and, desc, eq, gt, isNotNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { PlanId } from '@/lib/tts/engine';
import { findProduct } from './products';

export type Entitlement = {
  plan: PlanId;
  subscribed: boolean;
  periodStart: Date;
  periodEnd: Date;
  stripeCustomerId: string | null;
};

function calendarPeriod(now = new Date()): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { periodStart, periodEnd };
}

export async function getEntitlement(userUuid: string, now = new Date()): Promise<Entitlement> {
  const fallback = { plan: 'free' as const, subscribed: false, stripeCustomerId: null, ...calendarPeriod(now) };
  const database = await db();
  if (!database) return fallback;
  const [user] = await database
    .select({ stripeCustomerId: schema.users.stripeCustomerId })
    .from(schema.users)
    .where(eq(schema.users.uuid, userUuid))
    .limit(1);

  const [order] = await database
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.userUuid, userUuid),
        eq(schema.orders.status, 'paid'),
        isNotNull(schema.orders.periodEnd),
        gt(schema.orders.periodEnd, now),
      ),
    )
    .orderBy(desc(schema.orders.createdAt))
    .limit(1);

  if (!order) {
    return { ...fallback, stripeCustomerId: user?.stripeCustomerId ?? null };
  }

  const product = findProduct(order.productId);
  const plan = product?.plan ?? 'free';
  if (plan === 'free') {
    return { ...fallback, stripeCustomerId: user?.stripeCustomerId ?? null };
  }

  return {
    plan,
    subscribed: true,
    periodStart: order.periodStart ?? fallback.periodStart,
    periodEnd: order.periodEnd ?? fallback.periodEnd,
    stripeCustomerId: user?.stripeCustomerId ?? null,
  };
}
