import { isAdminEmail } from '@/lib/auth/admin';
import { sessionFromRequest } from '@/lib/auth/from-request';
import { listAdminUsers } from '@/lib/billing/admin-users';
import { listPricingClicks } from '@/lib/billing/clicks';
import { json, jsonError } from '@/lib/api/respond';
import { isBillingEnabled } from '@/lib/config/features';
import { withApiLog } from '@/lib/log/call';

export const GET = withApiLog('admin.users', async (req) => {
  if (!isBillingEnabled) return jsonError('billing_disabled', 503);

  const session = await sessionFromRequest(req);
  if (!session?.user?.uuid) return jsonError('unauthenticated', 401);
  if (!isAdminEmail(session.user.email)) return jsonError('forbidden', 403);

  const params = new URL(req.url).searchParams;
  const payload = await listAdminUsers({
    page: params.get('page'),
    size: params.get('size'),
    sort: params.get('sort'),
    dir: params.get('dir'),
  });
  if (!payload) return jsonError('database_not_configured', 503);
  return json({ ...payload, clicks: await listPricingClicks() });
});
