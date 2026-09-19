import type { PlanId } from '@/lib/tts/engine';
import { PACK_SECONDS, PLAN_QUOTA_SECONDS } from './quota';

export type ProductInterval = 'month' | 'year' | 'once';

export type CheckoutProduct = {
  productId: string;
  name: string;
  amountCents: number;
  interval: ProductInterval;
  plan?: Exclude<PlanId, 'free'>;
  packSeconds?: number;
};

export const CHECKOUT_PRODUCTS: Record<string, CheckoutProduct> = {
  'readtome-plus-monthly': { productId: 'readtome-plus-monthly', name: 'Read To Me Plus', amountCents: 900, interval: 'month', plan: 'plus' },
  'readtome-plus-yearly': { productId: 'readtome-plus-yearly', name: 'Read To Me Plus', amountCents: 8400, interval: 'year', plan: 'plus' },
  'readtome-pro-monthly': { productId: 'readtome-pro-monthly', name: 'Read To Me Pro', amountCents: 1900, interval: 'month', plan: 'pro' },
  'readtome-pro-yearly': { productId: 'readtome-pro-yearly', name: 'Read To Me Pro', amountCents: 18000, interval: 'year', plan: 'pro' },
  'readtome-pack-10h': {
    productId: 'readtome-pack-10h',
    name: 'AI voices +10 hours',
    amountCents: 1500,
    interval: 'once',
    packSeconds: PACK_SECONDS,
  },
  /** Legacy Stripe ids still grant the same shared hours. */
  'readtome-pack-natural-10h': {
    productId: 'readtome-pack-natural-10h',
    name: 'AI voices +10 hours',
    amountCents: 1500,
    interval: 'once',
    packSeconds: PACK_SECONDS,
  },
  'readtome-pack-expressive-1h': {
    productId: 'readtome-pack-expressive-1h',
    name: 'AI voices +3 hours',
    amountCents: 600,
    interval: 'once',
    packSeconds: 3 * 3600,
  },
};

export function findProduct(productId: string): CheckoutProduct | null {
  return CHECKOUT_PRODUCTS[productId] ?? null;
}

export function isPackProduct(product: CheckoutProduct): boolean {
  return product.interval === 'once';
}

export function packSecondsFor(product: CheckoutProduct): number {
  return product.packSeconds ?? 0;
}

export function planQuota(plan: PlanId) {
  return PLAN_QUOTA_SECONDS[plan];
}

/** Plus monthly < Plus yearly < Pro monthly < Pro yearly. Packs are not ranked. */
export function productRank(product: CheckoutProduct): number {
  const plan = product.plan === 'pro' ? 2 : product.plan === 'plus' ? 1 : 0;
  const interval = product.interval === 'year' ? 1 : 0;
  return plan * 10 + interval;
}

export function isPlanUpgrade(from: CheckoutProduct, to: CheckoutProduct): boolean {
  if (!from.plan || !to.plan) return false;
  return productRank(to) > productRank(from);
}
