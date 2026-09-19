import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { findProduct, isPackProduct, packSecondsFor } from './products';
import { CLOUD_POOL, PACK_TTL_MS } from './quota';

export type PaidSession = {
  sessionId: string;
  subscriptionId?: string | null;
  customerId?: string | null;
  userUuid: string;
  productId: string;
  amountCents: number;
  currency: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
};

/** Idempotent: Stripe retries checkout.session.completed, so the session id is the unique key. */
export async function recordPaidSession(paid: PaidSession): Promise<void> {
  const product = findProduct(paid.productId);
  if (!product) return;

  const database = await db();
  if (!database) return;

  if (paid.customerId) {
    await database.update(schema.users).set({ stripeCustomerId: paid.customerId }).where(eq(schema.users.uuid, paid.userUuid));
  }

  const [existing] = await database
    .select({ uuid: schema.orders.uuid })
    .from(schema.orders)
    .where(eq(schema.orders.stripeSessionId, paid.sessionId))
    .limit(1);

  const orderUuid = existing
    ? existing.uuid
    : (
        await database
          .insert(schema.orders)
          .values({
            userUuid: paid.userUuid,
            productId: paid.productId,
            stripeSessionId: paid.sessionId,
            stripeSubscriptionId: paid.subscriptionId ?? null,
            status: 'paid',
            amountCents: paid.amountCents,
            currency: paid.currency,
            interval: product.interval,
            periodStart: paid.periodStart ?? null,
            periodEnd: paid.periodEnd ?? null,
          })
          .returning({ uuid: schema.orders.uuid })
      )[0]?.uuid;

  if (!orderUuid) return;

  if (existing) {
    await database
      .update(schema.orders)
      .set({
        status: 'paid',
        stripeSubscriptionId: paid.subscriptionId ?? null,
        periodStart: paid.periodStart ?? null,
        periodEnd: paid.periodEnd ?? null,
      })
      .where(eq(schema.orders.uuid, orderUuid));
  }

  if (isPackProduct(product) && packSecondsFor(product) > 0 && !existing) {
    const seconds = packSecondsFor(product);
    await database.insert(schema.packs).values({
      userUuid: paid.userUuid,
      engine: CLOUD_POOL,
      orderUuid,
      totalSeconds: seconds,
      remainingSeconds: seconds,
      expiresAt: new Date(Date.now() + PACK_TTL_MS),
    });
  }
}

export async function markSubscription(input: {
  subscriptionId: string;
  status: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}): Promise<void> {
  const mapped = input.status === 'active' || input.status === 'trialing' ? 'paid' : input.status === 'canceled' ? 'canceled' : input.status;
  const database = await db();
  if (!database) return;
  await database
    .update(schema.orders)
    .set({
      status: mapped,
      periodStart: input.periodStart ?? undefined,
      periodEnd: input.periodEnd ?? undefined,
    })
    .where(eq(schema.orders.stripeSubscriptionId, input.subscriptionId));
}
