import { sessionFromRequest } from '@/lib/auth/from-request';
import { isBillingEnabled } from '@/lib/config/features';
import { jsonError } from '@/lib/api/respond';
import { withApiLog } from '@/lib/log/call';
import { getAudioBucket, readCachedAudio } from '@/lib/tts/cache';
import { getUserListen, listenAudioKeys } from '@/lib/tts/listens';

export const GET = withApiLog('billing.clip', async (req, ctx: { params: { id: string } }) => {
  if (!isBillingEnabled) return jsonError('billing_disabled', 503);

  const session = await sessionFromRequest(req);
  const uuid = session?.user?.uuid;
  if (!uuid) return jsonError('unauthenticated', 401);

  const listen = await getUserListen(uuid, ctx.params.id);
  if (!listen) return jsonError('not_found', 404);

  const keys = listenAudioKeys(listen);
  const part = Number(new URL(req.url).searchParams.get('part') ?? 0);
  const cacheKey = keys[Number.isFinite(part) ? part : 0];
  if (!cacheKey) return jsonError('audio_unavailable', 404);

  const bucket = await getAudioBucket();
  if (!bucket) return jsonError('audio_unavailable', 503);
  const audio = await readCachedAudio(bucket, cacheKey);
  if (!audio) return jsonError('audio_unavailable', 404);

  return new Response(audio, {
    status: 200,
    headers: {
      'content-type': 'audio/mpeg',
      'cache-control': 'private, max-age=3600',
    },
  });
});
