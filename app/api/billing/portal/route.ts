import { sessionFromRequest } from '@/lib/auth/from-request';
import { isBillingConfigured } from '@/lib/billing/config';
import { createPortalUrl } from '@/lib/billing/stripe';
import { isBillingEnabled } from '@/lib/config/features';
import { json, jsonError } from '@/lib/api/respond';
import { withApiLog } from '@/lib/log/call';

export const POST = withApiLog('billing.portal', async (req) => {
  if (!isBillingEnabled) return jsonError('billing_disabled', 503);
  if (!isBillingConfigured()) return jsonError('stripe_not_configured', 503);

  const session = await sessionFromRequest(req);
  const uuid = session?.user?.uuid;
  const email = session?.user?.email;
  if (!uuid || !email) return jsonError('unauthenticated', 401);

  try {
    const origin = new URL(req.url).origin;
    const url = await createPortalUrl({ userUuid: uuid, email, origin });
    return json({ url });
  } catch (error) {
    console.error('portal failed', error);
    return jsonError('no_customer', 400);
  }
});
