/**
 * With billing off the product is the free reader and nothing else: no cloud voice rows, no
 * pricing links, no checkout. This is also the rollback switch if the paid path misbehaves.
 */
export const isBillingEnabled = process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true';

/** Client-visible auth entry. Server still refuses Google unless AUTH_* secrets exist. */
export const isAuthUiEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';

/** Paid checkout. Off = plan CTAs say coming soon; on = Stripe Checkout / upgrade. */
export const isCheckoutEnabled = process.env.NEXT_PUBLIC_CHECKOUT_ENABLED === 'true';
