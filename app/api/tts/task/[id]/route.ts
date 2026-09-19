import { isBillingEnabled } from '@/lib/config/features';
import { json, jsonError } from '@/lib/api/respond';
import { withApiLog } from '@/lib/log/call';
import { finishCloudTask } from '@/lib/tts/speak';

export const POST = withApiLog('tts.task', async (req, { params }: { params: { id: string } }) => {
  if (!isBillingEnabled) return jsonError('billing_disabled', 503);

  const body = (await req.json()) as { token?: string };
  if (!body.token) return jsonError('invalid_request', 400);

  const result = await finishCloudTask(body.token);
  if ('pending' in result) return json({ pending: true, taskId: params.id });
  if ('error' in result) return jsonError(result.error, 409);
  return json({ audio: Buffer.from(result.audio).toString('base64'), format: 'mp3', cached: result.cached });
});
