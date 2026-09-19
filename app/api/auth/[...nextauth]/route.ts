import { handlers } from '@/lib/auth';
import { withApiLog } from '@/lib/log/call';

export const GET = withApiLog('auth.get', handlers.GET);
export const POST = withApiLog('auth.post', handlers.POST);
