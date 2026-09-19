import { sessionFromRequest } from '@/lib/auth/from-request';
import { recordPricingClick } from '@/lib/billing/clicks';
import { findProduct } from '@/lib/billing/products';
import { json, jsonError } from '@/lib/api/respond';
import { isBillingEnabled } from '@/lib/config/features';
import { withApiLog } from '@/lib/log/call';

export const POST = withApiLog('billing.click', async (req) => {
  if (!isBillingEnabled) return jsonError('billing_disabled', 503);

  const body = (await req.json().catch(() => ({}))) as { product_id?: string };
  const product = body.product_id ? findProduct(body.product_id) : null;
  if (!product) return jsonError('invalid_product', 400);

  const session = await sessionFromRequest(req);
  await recordPricingClick({
    productId: product.productId,
    userUuid: session?.user?.uuid,
    email: session?.user?.email,
  });
  return json({ ok: true });
});
