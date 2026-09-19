import Stripe from 'stripe';
import { logCall } from '@/lib/log/call';
import { isStripeConfigured, stripeSecret, stripeWebhookSecret } from './config';
import { findProduct, isPackProduct } from './products';
import { markSubscription, recordPaidSession } from './orders';

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (!cached) cached = new Stripe(stripeSecret());
  return cached;
}

export async function createCheckoutUrl(input: {
  productId: string;
  userUuid: string;
  email: string;
  origin: string;
}): Promise<string> {
  const product = findProduct(input.productId);
  if (!product) throw new Error('invalid product_id');

  const params = {
    mode: isPackProduct(product) ? 'payment' : 'subscription',
    customer_email: input.email,
    client_reference_id: input.userUuid,
    metadata: { userUuid: input.userUuid, productId: product.productId },
    success_url: `${input.origin}/account?checkout=success`,
    cancel_url: `${input.origin}/pricing?checkout=cancel`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: product.amountCents,
          product_data: { name: product.name },
          recurring: isPackProduct(product) ? undefined : { interval: product.interval === 'year' ? 'year' : 'month' },
        },
      },
    ],
  };
  const session = await stripe().checkout.sessions.create(params);
  logCall('stripe.checkout.create', params, { id: session.id, url: session.url, status: session.status });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return session.url;
}

export async function createPortalUrl(customerId: string, origin: string): Promise<string> {
  const params = { customer: customerId, return_url: `${origin}/account` };
  const session = await stripe().billingPortal.sessions.create(params);
  logCall('stripe.portal.create', params, { id: session.id, url: session.url });
  return session.url;
}

export async function handleStripeWebhook(rawBody: string, signature: string): Promise<void> {
  if (!isStripeConfigured()) throw new Error('stripe not configured');
  const event = stripe().webhooks.constructEvent(rawBody, signature, stripeWebhookSecret());
  logCall('stripe.webhook.event', { type: event.type, id: event.id }, event.data.object);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userUuid = session.metadata?.userUuid || session.client_reference_id;
    const productId = session.metadata?.productId;
    if (!userUuid || !productId) return;

    await recordPaidSession({
      sessionId: session.id,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      userUuid,
      productId,
      amountCents: session.amount_total ?? findProduct(productId)?.amountCents ?? 0,
      currency: session.currency ?? 'usd',
      periodStart: session.created ? new Date(session.created * 1000) : null,
      periodEnd: periodEndFromSession(session),
    });
    return;
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted' || event.type === 'invoice.paid') {
    const subscription = event.type === 'invoice.paid'
      ? await subscriptionFromInvoice(event.data.object as Stripe.Invoice)
      : (event.data.object as Stripe.Subscription);
    if (!subscription) return;
    await markSubscription({
      subscriptionId: subscription.id,
      status: event.type === 'customer.subscription.deleted' ? 'canceled' : subscription.status,
      periodStart: new Date(subscription.current_period_start * 1000),
      periodEnd: new Date(subscription.current_period_end * 1000),
    });
  }
}

function periodEndFromSession(session: Stripe.Checkout.Session): Date | null {
  const product = session.metadata?.productId ? findProduct(session.metadata.productId) : null;
  if (!product || isPackProduct(product)) return null;
  const start = session.created ? session.created * 1000 : Date.now();
  const end = new Date(start);
  if (product.interval === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

async function subscriptionFromInvoice(invoice: Stripe.Invoice): Promise<Stripe.Subscription | null> {
  const id = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  if (!id) return null;
  const subscription = await stripe().subscriptions.retrieve(id);
  logCall('stripe.subscription.retrieve', { id }, { id: subscription.id, status: subscription.status });
  return subscription;
}
