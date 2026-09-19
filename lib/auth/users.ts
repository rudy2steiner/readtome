import { and, eq } from 'drizzle-orm';
import { grantTrialUsage } from '@/lib/billing/reserve';
import { db, schema } from '@/lib/db';

export type SignInUser = {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
  providerAccountId: string;
};

/**
 * Returns the stable uuid the rest of the product keys on (usage, orders, packs). Called on every
 * sign-in, so it must be idempotent: the second login of the same Google account updates the
 * profile rather than creating a twin. A brand-new user also gets the one-off trial usage row.
 */
export async function handleSignInUser(user: SignInUser): Promise<string | null> {
  const database = await db();
  if (!database) return null;
  const [existing] = await database
    .select({ uuid: schema.users.uuid })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.provider, user.provider),
        eq(schema.users.providerAccountId, user.providerAccountId),
      ),
    )
    .limit(1);

  if (existing) {
    await database
      .update(schema.users)
      .set({ email: user.email, name: user.name ?? null, image: user.image ?? null })
      .where(eq(schema.users.uuid, existing.uuid));
    return existing.uuid;
  }

  const [created] = await database
    .insert(schema.users)
    .values({
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      provider: user.provider,
      providerAccountId: user.providerAccountId,
    })
    .returning({ uuid: schema.users.uuid });

  if (!created?.uuid) return null;
  await grantTrialUsage(created.uuid);
  return created.uuid;
}
