import { desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { findProduct } from './products';

export type PricingClickRow = {
  productId: string;
  productName: string;
  email: string | null;
  createdAt: string;
};

export type PricingClicksPayload = {
  total: number;
  byProduct: { productId: string; productName: string; count: number }[];
  items: PricingClickRow[];
};

export async function recordPricingClick(input: {
  productId: string;
  userUuid?: string | null;
  email?: string | null;
}): Promise<void> {
  if (!findProduct(input.productId)) return;
  const database = await db();
  if (!database) return;
  await database.insert(schema.pricingClicks).values({
    userUuid: input.userUuid ?? null,
    email: input.email ?? null,
    productId: input.productId,
  });
}

export async function listPricingClicks(limit = 50): Promise<PricingClicksPayload> {
  const empty = { total: 0, byProduct: [], items: [] };
  const database = await db();
  if (!database) return empty;

  const rows = await database.select().from(schema.pricingClicks).orderBy(desc(schema.pricingClicks.createdAt));
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.productId, (counts.get(row.productId) ?? 0) + 1);

  return {
    total: rows.length,
    byProduct: [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([productId, count]) => ({
        productId,
        productName: findProduct(productId)?.name ?? productId,
        count,
      })),
    items: rows.slice(0, limit).map((row) => ({
      productId: row.productId,
      productName: findProduct(row.productId)?.name ?? row.productId,
      email: row.email,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
