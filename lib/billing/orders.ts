import { and, desc, eq, gt, isNotNull } from 'drizzle-orm';
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

export type LiveSubscription = {
  uuid: string;
  productId: string;
  subscriptionId: string;
  customerId: string | null;
};

export async function getStripeCustomerId(userUuid: string): Promise<string | null> {
  const database = await db();
  if (!database) return null;
  const [user] = await database
    .select({ stripeCustomerId: schema.users.stripeCustomerId })
    .from(schema.users)
    .where(eq(schema.users.uuid, userUuid))
    .limit(1);
  return user?.stripeCustomerId ?? null;
}

export async function findOrderBySubscription(subscriptionId: string) {
  const database = await db();
  if (!database) return null;
  const [order] = await database
    .select({ uuid: schema.orders.uuid, productId: schema.orders.productId })
    .from(schema.orders)
    .where(eq(schema.orders.stripeSubscriptionId, subscriptionId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(1);
  return order ?? null;
}

export async function findLiveSubscription(userUuid: string, now = new Date()): Promise<LiveSubscription | null> {
  const database = await db();
  if (!database) return null;
  const [order] = await database
    .select({
      uuid: schema.orders.uuid,
      productId: schema.orders.productId,
      subscriptionId: schema.orders.stripeSubscriptionId,
    })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.userUuid, userUuid),
        eq(schema.orders.status, 'paid'),
        isNotNull(schema.orders.stripeSubscriptionId),
        isNotNull(schema.orders.periodEnd),
        gt(schema.orders.periodEnd, now),
      ),
    )
    .orderBy(desc(schema.orders.createdAt))
    .limit(1);

  if (!order?.subscriptionId) return null;
  const product = findProduct(order.productId);
  if (!product?.plan) return null;

  return {
    uuid: order.uuid,
    productId: order.productId,
    subscriptionId: order.subscriptionId,
    customerId: await getStripeCustomerId(userUuid),
  };
}

export async function rememberCheckoutSession(input: {
  userUuid: string;
  productId: string;
  sessionId: string;
  subscriptionId?: string | null;
  amountCents: number;
  currency: string;
}): Promise<void> {
  const product = findProduct(input.productId);
  if (!product) return;
  const database = await db();
  if (!database) return;

  const [existing] = await database
    .select({ uuid: schema.orders.uuid })
    .from(schema.orders)
    .where(eq(schema.orders.stripeSessionId, input.sessionId))
    .limit(1);
  if (existing) return;

  try {
    await database.insert(schema.orders).values({
      userUuid: input.userUuid,
      productId: input.productId,
      stripeSessionId: input.sessionId,
      stripeSubscriptionId: input.subscriptionId ?? null,
      status: 'created',
      amountCents: input.amountCents,
      currency: input.currency,
      interval: product.interval,
    });
  } catch {
    // Webhook may have written the paid row first.
  }
}

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
    .select({ uuid: schema.orders.uuid, status: schema.orders.status })
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
        productId: paid.productId,
        stripeSubscriptionId: paid.subscriptionId ?? null,
        amountCents: paid.amountCents,
        periodStart: paid.periodStart ?? null,
        periodEnd: paid.periodEnd ?? null,
      })
      .where(eq(schema.orders.uuid, orderUuid));
  }

  if (isPackProduct(product) && packSecondsFor(product) > 0) {
    const [pack] = await database
      .select({ uuid: schema.packs.uuid })
      .from(schema.packs)
      .where(eq(schema.packs.orderUuid, orderUuid))
      .limit(1);
    if (!pack) {
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
}

export async function patchSubscriptionOrder(input: {
  subscriptionId: string;
  status?: string;
  productId?: string;
  amountCents?: number;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}): Promise<void> {
  const database = await db();
  if (!database) return;
  const product = input.productId ? findProduct(input.productId) : null;
  const mapped = input.status
    ? input.status === 'active' || input.status === 'trialing'
      ? 'paid'
      : input.status === 'canceled'
        ? 'canceled'
        : input.status
    : undefined;

  await database
    .update(schema.orders)
    .set({
      ...(mapped ? { status: mapped } : {}),
      ...(product ? { productId: product.productId, interval: product.interval } : {}),
      ...(input.amountCents != null ? { amountCents: input.amountCents } : {}),
      ...(input.periodStart !== undefined ? { periodStart: input.periodStart } : {}),
      ...(input.periodEnd !== undefined ? { periodEnd: input.periodEnd } : {}),
    })
    .where(eq(schema.orders.stripeSubscriptionId, input.subscriptionId));
}

export async function markSubscription(input: {
  subscriptionId: string;
  status: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}): Promise<void> {
  await patchSubscriptionOrder(input);
}
