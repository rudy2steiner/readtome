import { sessionFromRequest } from '@/lib/auth/from-request';
import { isBillingEnabled } from '@/lib/config/features';
import { isBillingConfigured } from '@/lib/billing/config';
import { getEntitlement } from '@/lib/billing/entitlement';
import { findProduct, isPackProduct } from '@/lib/billing/products';
import { createCheckoutUrl } from '@/lib/billing/stripe';
import { json, jsonError } from '@/lib/api/respond';
import { withApiLog } from '@/lib/log/call';

export const POST = withApiLog('checkout', async (req) => {
  if (!isBillingEnabled) return jsonError('billing_disabled', 503);
  if (!isBillingConfigured()) return jsonError('stripe_not_configured', 503);

  const session = await sessionFromRequest(req);
  const uuid = session?.user?.uuid;
  const email = session?.user?.email;
  if (!uuid || !email) return jsonError('unauthenticated', 401);

  const body = (await req.json()) as { product_id?: string };
  const product = body.product_id ? findProduct(body.product_id) : null;
  if (!product) return jsonError('invalid_product', 400);

  if (isPackProduct(product)) {
    const entitlement = await getEntitlement(uuid);
    if (!entitlement.subscribed) return jsonError('need_plan', 400);
  }

  try {
    const origin = new URL(req.url).origin;
    const url = await createCheckoutUrl({ productId: product.productId, userUuid: uuid, email, origin });
    return json({ url });
  } catch (error) {
    console.error('checkout failed', error);
    return jsonError('checkout_failed', 500);
  }
});
