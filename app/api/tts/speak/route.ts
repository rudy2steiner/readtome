import { sessionFromRequest } from '@/lib/auth/from-request';
import { isBillingEnabled } from '@/lib/config/features';
import { json, jsonError } from '@/lib/api/respond';
import { withApiLog } from '@/lib/log/call';
import { speakCloud } from '@/lib/tts/speak';

function encodeAudio(audio: ArrayBuffer): string {
  return Buffer.from(audio).toString('base64');
}

export const POST = withApiLog('tts.speak', async (req) => {
  if (!isBillingEnabled) return jsonError('billing_disabled', 503);

  const session = await sessionFromRequest(req);
  const body = (await req.json()) as { text?: string; voiceId?: string; sourceText?: string; partIndex?: number };
  if (!body.text?.trim() || !body.voiceId) return jsonError('invalid_request', 400);

  const result = await speakCloud({
    text: body.text,
    voiceId: body.voiceId,
    userUuid: session?.user?.uuid ?? null,
    sourceText: body.sourceText,
    partIndex: body.partIndex,
  });
  if ('error' in result) {
    const status = result.error === 'unauthenticated' ? 401 : result.error === 'unknown_voice' ? 400 : 409;
    return jsonError(result.error, status);
  }
  if ('audio' in result) {
    return json({ audio: encodeAudio(result.audio), format: 'mp3', cached: result.cached });
  }
  return json({ taskId: result.taskId, token: result.token });
});
