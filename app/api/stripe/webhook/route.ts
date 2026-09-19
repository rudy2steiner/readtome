import { isStripeConfigured } from '@/lib/billing/config';
import { handleStripeWebhook } from '@/lib/billing/stripe';
import { json, jsonError } from '@/lib/api/respond';
import { withApiLog } from '@/lib/log/call';

export const POST = withApiLog('stripe.webhook', async (req) => {
  if (!isStripeConfigured()) return jsonError('stripe_not_configured', 503);

  const signature = req.headers.get('stripe-signature');
  if (!signature) return jsonError('missing_signature', 400);

  try {
    await handleStripeWebhook(await req.text(), signature);
    return json({ received: true });
  } catch (error) {
    console.error('stripe webhook failed', error);
    return jsonError('webhook_failed', 400);
  }
});
