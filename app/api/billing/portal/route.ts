import { sessionFromRequest } from '@/lib/auth/from-request';
import { isBillingConfigured } from '@/lib/billing/config';
import { getEntitlement } from '@/lib/billing/entitlement';
import { createPortalUrl } from '@/lib/billing/stripe';
import { isBillingEnabled } from '@/lib/config/features';
import { json, jsonError } from '@/lib/api/respond';
import { withApiLog } from '@/lib/log/call';

export const POST = withApiLog('billing.portal', async (req) => {
  if (!isBillingEnabled) return jsonError('billing_disabled', 503);
  if (!isBillingConfigured()) return jsonError('stripe_not_configured', 503);

  const session = await sessionFromRequest(req);
  const uuid = session?.user?.uuid;
  if (!uuid) return jsonError('unauthenticated', 401);

  const entitlement = await getEntitlement(uuid);
  if (!entitlement.stripeCustomerId) return jsonError('no_customer', 400);

  const origin = new URL(req.url).origin;
  const url = await createPortalUrl(entitlement.stripeCustomerId, origin);
  return json({ url });
});
