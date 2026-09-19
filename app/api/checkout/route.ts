import { sessionFromRequest } from '@/lib/auth/from-request';
import { isBillingEnabled, isCheckoutEnabled } from '@/lib/config/features';
import { isBillingConfigured } from '@/lib/billing/config';
import { getEntitlement } from '@/lib/billing/entitlement';
import { findProduct, isPackProduct } from '@/lib/billing/products';
import { checkoutOrUpgrade, createCheckoutSession } from '@/lib/billing/stripe';
import { DowngradeNotAllowedError, NoActiveSubscriptionError } from '@/lib/billing/subscription-errors';
import { json, jsonError } from '@/lib/api/respond';
import { withApiLog } from '@/lib/log/call';

export const POST = withApiLog('checkout', async (req) => {
  if (!isBillingEnabled || !isCheckoutEnabled) return jsonError('billing_disabled', 503);
  if (!isBillingConfigured()) return jsonError('stripe_not_configured', 503);

  const session = await sessionFromRequest(req);
  const uuid = session?.user?.uuid;
  const email = session?.user?.email;
  if (!uuid || !email) return jsonError('unauthenticated', 401);

  const body = (await req.json()) as { product_id?: string };
  const product = body.product_id ? findProduct(body.product_id) : null;
  if (!product) return jsonError('invalid_product', 400);

  const origin = new URL(req.url).origin;

  if (isPackProduct(product)) {
    const entitlement = await getEntitlement(uuid);
    if (!entitlement.subscribed) return jsonError('need_plan', 400);
    try {
      return json(await createCheckoutSession({ productId: product.productId, userUuid: uuid, email, origin }));
    } catch (error) {
      console.error('checkout failed', error);
      return jsonError('checkout_failed', 500);
    }
  }

  try {
    return json(await checkoutOrUpgrade({ productId: product.productId, userUuid: uuid, email, origin }));
  } catch (error) {
    if (error instanceof DowngradeNotAllowedError) return jsonError('downgrade_not_allowed', 400);
    if (error instanceof NoActiveSubscriptionError) {
      try {
        return json(await createCheckoutSession({ productId: product.productId, userUuid: uuid, email, origin }));
      } catch (fallback) {
        console.error('checkout failed', fallback);
        return jsonError('checkout_failed', 500);
      }
    }
    console.error('checkout failed', error);
    return jsonError('checkout_failed', 500);
  }
});
