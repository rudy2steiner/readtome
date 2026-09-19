import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { CloudEngineId } from '@/lib/tts/engine';
import { getEntitlement } from './entitlement';
import {
  CLOUD_POOL,
  creditSecondsFor,
  decideDraw,
  PLAN_QUOTA_SECONDS,
  TRIAL_PERIOD_START,
  trialUsageValues,
  type DrawDecision,
  type DrawSource,
} from './quota';

export type Reservation = {
  userUuid: string;
  engine: CloudEngineId;
  source: DrawSource;
  /** usage.period_start we incremented; epoch ms for the login trial row. */
  periodStartMs: number;
  seconds: number;
  chars: number;
};

export type ReserveResult = { ok: true; reservation: Reservation } | { ok: false; reason: Exclude<DrawDecision, { ok: true }>['reason'] };

export async function grantTrialUsage(userUuid: string): Promise<void> {
  const database = await db();
  if (!database) return;
  await database.insert(schema.usage).values(trialUsageValues(userUuid)).onConflictDoNothing();
}

/**
 * One atomic attempt per source. The WHERE clause is the lock: two concurrent prefetches cannot
 * both increment past the remaining seconds, which is how a 3-chunk window never blows the cap.
 */
export async function reserveCloudSeconds(input: {
  userUuid: string;
  engine: CloudEngineId;
  seconds: number;
  chars: number;
  now?: Date;
}): Promise<ReserveResult> {
  const database = await db();
  if (!database) return { ok: false, reason: 'unauthenticated' };

  const now = input.now ?? new Date();
  const entitlement = await getEntitlement(input.userUuid, now);
  const need = creditSecondsFor(input.engine, input.seconds, entitlement.subscribed);
  const periodStart = entitlement.subscribed ? entitlement.periodStart : TRIAL_PERIOD_START;
  const periodEnd = entitlement.subscribed ? entitlement.periodEnd : trialUsageValues(input.userUuid).periodEnd;
  const quotaSeconds = entitlement.subscribed ? PLAN_QUOTA_SECONDS[entitlement.plan] : trialUsageValues(input.userUuid).quotaSeconds;

  await database
    .insert(schema.usage)
    .values({
      userUuid: input.userUuid,
      engine: CLOUD_POOL,
      periodStart,
      periodEnd,
      quotaSeconds,
    })
    .onConflictDoNothing();

  const [usage] = await database
    .select()
    .from(schema.usage)
    .where(
      and(
        eq(schema.usage.userUuid, input.userUuid),
        eq(schema.usage.engine, CLOUD_POOL),
        eq(schema.usage.periodStart, periodStart),
      ),
    )
    .limit(1);

  const packs = entitlement.subscribed
    ? await database
        .select({ uuid: schema.packs.uuid, remaining: schema.packs.remainingSeconds })
        .from(schema.packs)
        .where(
          and(
            eq(schema.packs.userUuid, input.userUuid),
            gt(schema.packs.remainingSeconds, 0),
            gt(schema.packs.expiresAt, now),
          ),
        )
        .orderBy(asc(schema.packs.createdAt))
    : [];

  const decision = decideDraw({
    engine: input.engine,
    subscribed: entitlement.subscribed,
    planRemaining: usage ? usage.quotaSeconds - usage.usedSeconds : 0,
    packs,
    need,
  });

  if (!decision.ok) return decision;

  const billed = { ...input, seconds: need };
  const taken = await take(decision.source, billed, periodStart);
  if (!taken) {
    return { ok: false, reason: entitlement.subscribed ? 'quota_natural' : 'trial_exhausted' };
  }

  return {
    ok: true,
    reservation: {
      userUuid: input.userUuid,
      engine: input.engine,
      source: decision.source,
      periodStartMs: periodStart.getTime(),
      seconds: need,
      chars: input.chars,
    },
  };
}

async function take(source: DrawSource, input: { userUuid: string; engine: CloudEngineId; seconds: number; chars: number }, periodStart: Date): Promise<boolean> {
  const database = await db();
  if (!database) return false;

  if (source.kind === 'plan') {
    const updated = await database
      .update(schema.usage)
      .set({
        usedSeconds: sql`${schema.usage.usedSeconds} + ${input.seconds}`,
        usedChars: sql`${schema.usage.usedChars} + ${input.chars}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.usage.userUuid, input.userUuid),
          eq(schema.usage.engine, CLOUD_POOL),
          eq(schema.usage.periodStart, periodStart),
          sql`${schema.usage.usedSeconds} + ${input.seconds} <= ${schema.usage.quotaSeconds}`,
        ),
      )
      .returning({ used: schema.usage.usedSeconds });
    return updated.length > 0;
  }

  const updated = await database
    .update(schema.packs)
    .set({ remainingSeconds: sql`${schema.packs.remainingSeconds} - ${input.seconds}` })
    .where(and(eq(schema.packs.uuid, source.packUuid), sql`${schema.packs.remainingSeconds} >= ${input.seconds}`))
    .returning({ remaining: schema.packs.remainingSeconds });
  return updated.length > 0;
}

/** After the mp3 exists, move the hold to the real duration: refund leftover, or take the shortfall. */
export async function settleReservation(reservation: Reservation, actualSeconds: number): Promise<number> {
  const actual = Math.max(0, Math.round(actualSeconds));
  if (actual <= 0) return reservation.seconds;
  const delta = actual - reservation.seconds;
  if (delta === 0) return actual;
  if (delta < 0) {
    await releaseSeconds(reservation, -delta);
    return actual;
  }
  return reservation.seconds + (await takeMore(reservation, delta));
}

export async function releaseReservation(reservation: Reservation): Promise<void> {
  await releaseSeconds(reservation, reservation.seconds, true);
}

async function releaseSeconds(reservation: Reservation, seconds: number, refundChars = false): Promise<void> {
  if (seconds <= 0) return;
  const database = await db();
  if (!database) return;

  if (reservation.source.kind === 'plan') {
    await database
      .update(schema.usage)
      .set({
        usedSeconds: sql`max(${schema.usage.usedSeconds} - ${seconds}, 0)`,
        ...(refundChars ? { usedChars: sql`max(${schema.usage.usedChars} - ${reservation.chars}, 0)` } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.usage.userUuid, reservation.userUuid),
          eq(schema.usage.engine, CLOUD_POOL),
          eq(schema.usage.periodStart, new Date(reservation.periodStartMs)),
        ),
      );
    return;
  }

  await database
    .update(schema.packs)
    .set({ remainingSeconds: sql`${schema.packs.remainingSeconds} + ${seconds}` })
    .where(eq(schema.packs.uuid, reservation.source.packUuid));
}

async function takeMore(reservation: Reservation, seconds: number): Promise<number> {
  if (seconds <= 0) return 0;
  const fromHold = await takeAvailable(reservation.source, reservation, seconds);
  if (fromHold >= seconds) return fromHold;

  const leftover = seconds - fromHold;
  const entitlement = await getEntitlement(reservation.userUuid);
  if (!entitlement.subscribed) return fromHold;

  if (reservation.source.kind !== 'plan') {
    const extraPlan = await takeAvailable({ kind: 'plan' }, reservation, leftover);
    if (fromHold + extraPlan >= seconds) return fromHold + extraPlan;
    return fromHold + extraPlan + (await takeFromPacks(reservation.userUuid, leftover - extraPlan, new Date()));
  }

  return fromHold + (await takeFromPacks(reservation.userUuid, leftover, new Date()));
}

async function takeAvailable(source: DrawSource, reservation: Reservation, seconds: number): Promise<number> {
  const database = await db();
  if (!database || seconds <= 0) return 0;
  const periodStart = new Date(reservation.periodStartMs);

  if (source.kind === 'plan') {
    const [row] = await database
      .select({ used: schema.usage.usedSeconds, quota: schema.usage.quotaSeconds })
      .from(schema.usage)
      .where(
        and(
          eq(schema.usage.userUuid, reservation.userUuid),
          eq(schema.usage.engine, CLOUD_POOL),
          eq(schema.usage.periodStart, periodStart),
        ),
      )
      .limit(1);
    const room = row ? Math.max(0, row.quota - row.used) : 0;
    const need = Math.min(seconds, room);
    if (need <= 0) return 0;
    const ok = await take(source, { userUuid: reservation.userUuid, engine: reservation.engine, seconds: need, chars: 0 }, periodStart);
    return ok ? need : 0;
  }

  const [pack] = await database
    .select({ remaining: schema.packs.remainingSeconds })
    .from(schema.packs)
    .where(eq(schema.packs.uuid, source.packUuid))
    .limit(1);
  const need = Math.min(seconds, Math.max(0, pack?.remaining ?? 0));
  if (need <= 0) return 0;
  const ok = await take(source, { userUuid: reservation.userUuid, engine: reservation.engine, seconds: need, chars: 0 }, periodStart);
  return ok ? need : 0;
}

async function takeFromPacks(userUuid: string, seconds: number, now: Date): Promise<number> {
  const database = await db();
  if (!database || seconds <= 0) return 0;
  const packs = await database
    .select({ uuid: schema.packs.uuid, remaining: schema.packs.remainingSeconds })
    .from(schema.packs)
    .where(and(eq(schema.packs.userUuid, userUuid), gt(schema.packs.remainingSeconds, 0), gt(schema.packs.expiresAt, now)))
    .orderBy(asc(schema.packs.createdAt));

  let taken = 0;
  let leftover = seconds;
  for (const pack of packs) {
    if (leftover <= 0) break;
    const chunk = Math.min(leftover, pack.remaining);
    const ok = await take({ kind: 'pack', packUuid: pack.uuid }, { userUuid, engine: CLOUD_POOL, seconds: chunk, chars: 0 }, new Date(0));
    if (!ok) continue;
    taken += chunk;
    leftover -= chunk;
  }
  return taken;
}
