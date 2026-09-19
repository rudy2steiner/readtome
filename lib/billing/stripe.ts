import Stripe from 'stripe';
import { logCall } from '@/lib/log/call';
import { isStripeConfigured, stripeSecret, stripeWebhookSecret } from './config';
import { findProduct, isPackProduct, isPlanUpgrade } from './products';
import {
  findLiveSubscription,
  findOrderBySubscription,
  getStripeCustomerId,
  markSubscription,
  patchSubscriptionOrder,
  recordPaidSession,
  rememberCheckoutSession,
} from './orders';
import { DowngradeNotAllowedError, NoActiveSubscriptionError } from './subscription-errors';

const ENDED_STATUSES = new Set(['canceled', 'unpaid', 'incomplete_expired']);

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (!cached) {
    cached = new Stripe(stripeSecret(), {
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return cached;
}

function isPublicSiteUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !/localhost|127\.0\.0\.1$/i.test(url.hostname);
  } catch {
    return false;
  }
}

/** Prefer a public https origin so a localhost `.env.local` cannot bake into production Checkout. */
function billingOrigin(requestOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_WEB_URL;
  if (isPublicSiteUrl(configured)) return configured.replace(/\/$/, '');
  if (isPublicSiteUrl(requestOrigin)) return requestOrigin.replace(/\/$/, '');
  return (configured || requestOrigin).replace(/\/$/, '');
}

function checkoutUrls(origin: string) {
  const base = billingOrigin(origin);
  return {
    successUrl: `${base}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/pricing?checkout=cancel`,
  };
}

async function resolveStripePriceId(client: Stripe, productId: string): Promise<string | null> {
  const prices = await client.prices.list({ lookup_keys: [productId], active: true, limit: 1 });
  return prices.data[0]?.id ?? null;
}

async function ensureStripePriceId(client: Stripe, productId: string): Promise<string> {
  const existing = await resolveStripePriceId(client, productId);
  if (existing) return existing;

  const product = findProduct(productId);
  if (!product) throw new Error('invalid product_id');

  const stripeProduct = await client.products.create({
    name: product.name,
    metadata: { productId: product.productId },
  });

  const price = await client.prices.create({
    product: stripeProduct.id,
    currency: 'usd',
    unit_amount: product.amountCents,
    lookup_key: product.productId,
    recurring: isPackProduct(product) ? undefined : { interval: product.interval === 'year' ? 'year' : 'month' },
  });

  return price.id;
}

async function resolveLiveSubscription(userUuid: string) {
  const active = await findLiveSubscription(userUuid);
  if (!active) return null;

  try {
    const subscription = await stripe().subscriptions.retrieve(active.subscriptionId);
    if (ENDED_STATUSES.has(subscription.status)) return null;
    return { ...active, subscription };
  } catch {
    return null;
  }
}

export async function createCheckoutSession(input: {
  productId: string;
  userUuid: string;
  email: string;
  origin: string;
}): Promise<{ url: string }> {
  const product = findProduct(input.productId);
  if (!product) throw new Error('invalid product_id');

  if (!isPackProduct(product)) {
    const active = await resolveLiveSubscription(input.userUuid);
    if (active) throw new Error('active subscription — use upgrade instead');
  }

  const client = stripe();
  const { successUrl, cancelUrl } = checkoutUrls(input.origin);
  const customerId = await getStripeCustomerId(input.userUuid);
  const pack = isPackProduct(product);

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: pack ? 'payment' : 'subscription',
    client_reference_id: input.userUuid,
    metadata: { userUuid: input.userUuid, productId: product.productId },
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: await ensureStripePriceId(client, product.productId), quantity: 1 }],
    ...(customerId ? { customer: customerId } : { customer_email: input.email }),
    ...(pack
      ? {}
      : {
          subscription_data: {
            metadata: { userUuid: input.userUuid, productId: product.productId },
          },
        }),
  };

  const session = await client.checkout.sessions.create(params);
  logCall('stripe.checkout.create', params, { id: session.id, url: session.url, status: session.status });
  if (!session.url) throw new Error('Stripe did not return a checkout URL');

  await rememberCheckoutSession({
    userUuid: input.userUuid,
    productId: product.productId,
    sessionId: session.id,
    amountCents: product.amountCents,
    currency: 'usd',
  });

  return { url: session.url };
}

export type CheckoutResult = { url: string } | { upgraded: true; productId: string };

export async function checkoutOrUpgrade(input: {
  productId: string;
  userUuid: string;
  email: string;
  origin: string;
}): Promise<CheckoutResult> {
  const active = await resolveLiveSubscription(input.userUuid);
  if (active) return upgradeSubscription({ productId: input.productId, userUuid: input.userUuid, origin: input.origin });
  return createCheckoutSession(input);
}

export async function upgradeSubscription(input: {
  productId: string;
  userUuid: string;
  origin: string;
}): Promise<CheckoutResult> {
  const product = findProduct(input.productId);
  if (!product?.plan) throw new Error('invalid product_id');

  const active = await resolveLiveSubscription(input.userUuid);
  if (!active) throw new NoActiveSubscriptionError();

  if (active.productId === product.productId) return { upgraded: true, productId: product.productId };

  const current = findProduct(active.productId);
  if (!current || !isPlanUpgrade(current, product)) throw new DowngradeNotAllowedError();

  const client = stripe();
  const subscription = active.subscription;
  const itemId = subscription.items.data[0]?.id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!itemId || !customerId) throw new Error('subscription item missing');

  const priceId = await ensureStripePriceId(client, product.productId);
  const updated = await client.subscriptions.update(subscription.id, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'always_invoice',
    billing_cycle_anchor: 'now',
    cancel_at_period_end: false,
    expand: ['latest_invoice'],
    metadata: {
      ...subscription.metadata,
      userUuid: input.userUuid,
      pendingProductId: product.productId,
    },
  });

  const invoice = await latestInvoice(client, updated);
  if (invoice.status === 'paid' || (await payInvoiceIfNeeded(client, invoice))?.status === 'paid') {
    await finalizeUpgrade(client, invoice, product.productId);
    return { upgraded: true, productId: product.productId };
  }

  return {
    url: await createUpgradeCheckout(client, invoice, {
      customerId,
      userUuid: input.userUuid,
      productId: product.productId,
      productName: product.name,
      fromProductId: active.productId,
      origin: input.origin,
    }),
  };
}

export async function createPortalUrl(input: { userUuid: string; email: string; origin: string }): Promise<string> {
  const customerId = await resolvePortalCustomer(input.userUuid, input.email);
  if (!customerId) throw new Error('no stripe customer');

  const params = { customer: customerId, return_url: `${billingOrigin(input.origin)}/account` };
  const session = await stripe().billingPortal.sessions.create(params);
  logCall('stripe.portal.create', params, { id: session.id, url: session.url });
  if (!session.url) throw new Error('portal session missing url');
  return session.url;
}

export async function handleStripeWebhook(rawBody: string, signature: string): Promise<void> {
  if (!isStripeConfigured()) throw new Error('stripe not configured');
  const event = await stripe().webhooks.constructEventAsync(rawBody, signature, stripeWebhookSecret());
  logCall('stripe.webhook.event', { type: event.type, id: event.id }, event.data.object);

  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    return;
  }
  if (event.type === 'invoice.paid') {
    await handleInvoicePaid(event.data.object as Stripe.Invoice);
    return;
  }
  if (event.type === 'customer.subscription.updated') {
    await syncSubscription(event.data.object as Stripe.Subscription);
    return;
  }
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const period = resolveSubscriptionPeriod(subscription);
    await markSubscription({
      subscriptionId: subscription.id,
      status: 'canceled',
      periodStart: unixDate(period.start),
      periodEnd: unixDate(period.end),
    });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.flow === 'subscription_upgrade') {
    await handleUpgradeCheckoutCompleted(session);
    return;
  }

  const productId = session.metadata?.productId;
  const userUuid = session.metadata?.userUuid || session.client_reference_id;
  if (!productId || !userUuid) return;

  const product = findProduct(productId);
  if (!product) return;

  const subscriptionId = idOf(session.subscription);
  const subscription = subscriptionId ? await loadSubscription(subscriptionId) : null;
  const period = subscription ? resolveSubscriptionPeriod(subscription) : { start: null, end: null };

  await recordPaidSession({
    sessionId: session.id,
    subscriptionId,
    customerId: idOf(session.customer),
    userUuid,
    productId,
    amountCents: session.amount_total ?? product.amountCents,
    currency: session.currency ?? 'usd',
    periodStart: unixDate(period.start) ?? (isPackProduct(product) ? null : session.created ? new Date(session.created * 1000) : null),
    periodEnd: unixDate(period.end) ?? periodEndFromProduct(productId, session.created),
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = resolveInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await loadSubscription(subscriptionId);
  const productId = resolveProductId(subscription);
  const userUuid = subscription.metadata?.userUuid;
  if (!productId || !userUuid) return;

  const product = findProduct(productId);
  if (!product) return;

  const period = resolveSubscriptionPeriod(subscription, invoice);
  const customerId = idOf(subscription.customer);

  // First payment is written by checkout.session.completed (same session id).
  if (invoice.billing_reason === 'subscription_create') return;

  if (invoice.billing_reason === 'subscription_update' || subscription.metadata?.pendingProductId === productId) {
    await commitProductMetadata(subscription, productId);
  }

  const existing = await findOrderBySubscription(subscriptionId);
  if (existing) {
    await patchSubscriptionOrder({
      subscriptionId,
      status: 'paid',
      productId,
      amountCents: product.amountCents,
      periodStart: unixDate(period.start),
      periodEnd: unixDate(period.end),
    });
    return;
  }

  await recordPaidSession({
    sessionId: invoice.id,
    subscriptionId,
    customerId,
    userUuid,
    productId,
    amountCents: invoice.amount_paid ?? product.amountCents,
    currency: invoice.currency ?? 'usd',
    periodStart: unixDate(period.start),
    periodEnd: unixDate(period.end),
  });
}

async function handleUpgradeCheckoutCompleted(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.stripe_invoice_id;
  const productId = session.metadata?.productId;
  if (!invoiceId || !productId) return;

  const client = stripe();
  let invoice = await client.invoices.retrieve(invoiceId);
  if (invoice.status !== 'paid') {
    invoice = await client.invoices.pay(invoiceId, { paid_out_of_band: true });
  }
  await finalizeUpgrade(client, invoice, productId);
}

async function finalizeUpgrade(client: Stripe, invoice: Stripe.Invoice, productId: string) {
  const subscriptionId = resolveInvoiceSubscriptionId(invoice);
  if (!subscriptionId) throw new Error('upgrade invoice missing subscription');

  const product = findProduct(productId);
  if (!product) throw new Error('invalid product_id');

  const subscription = await loadSubscription(subscriptionId);
  await commitProductMetadata(subscription, productId);
  const period = resolveSubscriptionPeriod(subscription, invoice);
  await patchSubscriptionOrder({
    subscriptionId,
    status: 'paid',
    productId,
    amountCents: product.amountCents,
    periodStart: unixDate(period.start),
    periodEnd: unixDate(period.end),
  });
}

async function createUpgradeCheckout(
  client: Stripe,
  invoice: Stripe.Invoice,
  params: {
    customerId: string;
    userUuid: string;
    productId: string;
    productName: string;
    fromProductId: string;
    origin: string;
  },
): Promise<string> {
  const amountDue = invoice.amount_due ?? 0;
  if (amountDue <= 0) throw new Error('upgrade payment unavailable');

  const { successUrl, cancelUrl } = checkoutUrls(params.origin);
  const session = await client.checkout.sessions.create({
    mode: 'payment',
    customer: params.customerId,
    client_reference_id: invoice.id,
    metadata: {
      flow: 'subscription_upgrade',
      stripe_invoice_id: invoice.id,
      userUuid: params.userUuid,
      productId: params.productId,
      fromProductId: params.fromProductId,
    },
    line_items: [
      {
        price_data: {
          currency: invoice.currency ?? 'usd',
          unit_amount: amountDue,
          product_data: { name: params.productName },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  if (!session.url) throw new Error('upgrade checkout session missing url');
  return session.url;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const period = resolveSubscriptionPeriod(subscription);
  const productId = resolveCommittedProductId(subscription);
  const product = productId ? findProduct(productId) : null;
  await patchSubscriptionOrder({
    subscriptionId: subscription.id,
    status: ENDED_STATUSES.has(subscription.status) ? 'canceled' : subscription.status,
    productId: product?.productId,
    amountCents: product?.amountCents,
    periodStart: unixDate(period.start),
    periodEnd: unixDate(period.end),
  });
}

async function resolvePortalCustomer(userUuid: string, email: string): Promise<string | null> {
  const stored = await getStripeCustomerId(userUuid);
  if (stored) return stored;

  const active = await findLiveSubscription(userUuid);
  if (active?.subscriptionId) {
    try {
      const subscription = await stripe().subscriptions.retrieve(active.subscriptionId);
      const customerId = idOf(subscription.customer);
      if (customerId) return customerId;
    } catch {
      // fall through to email lookup
    }
  }

  const customers = await stripe().customers.list({ email, limit: 1 });
  return customers.data[0]?.id ?? null;
}

async function loadSubscription(id: string): Promise<Stripe.Subscription> {
  return stripe().subscriptions.retrieve(id, { expand: ['latest_invoice'] });
}

async function latestInvoice(client: Stripe, subscription: Stripe.Subscription): Promise<Stripe.Invoice> {
  const latest = subscription.latest_invoice;
  const invoiceId = typeof latest === 'string' ? latest : latest?.id;
  if (invoiceId) return client.invoices.retrieve(invoiceId);
  const list = await client.invoices.list({ subscription: subscription.id, limit: 1 });
  const invoice = list.data[0];
  if (!invoice) throw new Error('upgrade invoice missing');
  return invoice;
}

async function payInvoiceIfNeeded(client: Stripe, invoice: Stripe.Invoice): Promise<Stripe.Invoice | null> {
  if (invoice.status === 'paid') return invoice;
  try {
    return await client.invoices.pay(invoice.id);
  } catch (error) {
    logCall('stripe.invoice.pay.deferred', { id: invoice.id }, error);
    return null;
  }
}

async function commitProductMetadata(subscription: Stripe.Subscription, productId: string) {
  await stripe().subscriptions.update(subscription.id, {
    metadata: {
      ...subscription.metadata,
      productId,
      pendingProductId: '',
    },
  });
}

function resolveProductId(subscription: Stripe.Subscription): string | null {
  const pending = subscription.metadata?.pendingProductId;
  if (pending && findProduct(pending)) return pending;
  const lookupKey = subscription.items.data[0]?.price?.lookup_key;
  if (lookupKey && findProduct(lookupKey)) return lookupKey;
  const committed = subscription.metadata?.productId;
  return committed && findProduct(committed) ? committed : null;
}

function resolveCommittedProductId(subscription: Stripe.Subscription): string | null {
  const lookupKey = subscription.items.data[0]?.price?.lookup_key;
  if (lookupKey && findProduct(lookupKey)) return lookupKey;
  const committed = subscription.metadata?.productId;
  return committed && findProduct(committed) ? committed : null;
}

function resolveInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent as { subscription_details?: { subscription?: string | { id: string } } } | null;
  const fromParent = parent?.subscription_details?.subscription;
  if (typeof fromParent === 'string') return fromParent;
  if (fromParent && typeof fromParent === 'object') return fromParent.id;
  const legacy = (invoice as { subscription?: string | { id: string } | null }).subscription;
  if (typeof legacy === 'string') return legacy;
  if (legacy && typeof legacy === 'object') return legacy.id;
  return null;
}

function resolveSubscriptionPeriod(
  subscription: Stripe.Subscription,
  invoice?: Stripe.Invoice | null,
): { start: number | null; end: number | null } {
  const item = subscription.items.data[0] as { current_period_start?: number; current_period_end?: number } | undefined;
  const sub = subscription as { current_period_start?: number; current_period_end?: number; billing_cycle_anchor?: number };
  const latestInvoice = subscription.latest_invoice;
  const latest = latestInvoice && typeof latestInvoice !== 'string' ? latestInvoice : null;

  const candidates = [
    { start: item?.current_period_start ?? null, end: item?.current_period_end ?? null },
    { start: sub.current_period_start ?? null, end: sub.current_period_end ?? null },
    { start: invoice?.period_start ?? null, end: invoice?.period_end ?? null },
    { start: latest?.period_start ?? null, end: latest?.period_end ?? null },
  ];

  if (sub.billing_cycle_anchor) {
    const months = subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 12 : 1;
    const nowSec = Math.floor(Date.now() / 1000);
    let start = sub.billing_cycle_anchor;
    let end = addUnixMonths(start, months);
    while (end <= nowSec) {
      start = end;
      end = addUnixMonths(start, months);
    }
    candidates.push({ start, end });
  }

  return candidates.find((period) => period.start && period.end && period.end > period.start) ?? { start: null, end: null };
}

function periodEndFromProduct(productId: string, created?: number | null): Date | null {
  const product = findProduct(productId);
  if (!product || isPackProduct(product)) return null;
  const end = new Date((created ?? Math.floor(Date.now() / 1000)) * 1000);
  if (product.interval === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

function addUnixMonths(unixSec: number, months: number): number {
  const date = new Date(unixSec * 1000);
  date.setUTCMonth(date.getUTCMonth() + months);
  return Math.floor(date.getTime() / 1000);
}

function unixDate(value: number | null | undefined): Date | null {
  return value ? new Date(value * 1000) : null;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}
