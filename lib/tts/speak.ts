import { releaseReservation, reserveCloudSeconds, settleReservation, type Reservation } from '@/lib/billing/reserve';
import { audioCacheKey } from './engine';
import { CLOUD_ADAPTERS } from './atlas';
import { getAudioBucket, readCachedAudio, writeCachedAudio } from './cache';
import { detectSpeechLang, secondsForChars } from '@/lib/billing/quota';
import { rememberListen } from './listens';
import { mp3DurationSeconds } from './mp3-duration';
import { findCloudVoice, poolFor } from './voices';
import { signSpeakTask } from './task-token';

export type SpeakOk = { audio: ArrayBuffer; cached: boolean } | { taskId: string; token: string };
export type SpeakFail = { error: 'unauthenticated' | 'trial_exhausted' | 'quota_natural' | 'missing_key' | 'supplier' | 'unknown_voice' };

export async function speakCloud(input: {
  text: string;
  voiceId: string;
  userUuid: string | null;
  sourceText?: string;
  partIndex?: number;
}): Promise<SpeakOk | SpeakFail> {
  const voice = findCloudVoice(input.voiceId);
  const engine = voice ? poolFor(voice) : null;
  if (!voice || !engine) return { error: 'unknown_voice' };
  if (!input.userUuid) return { error: 'unauthenticated' };

  const sourceText = input.sourceText?.trim() ? input.sourceText : input.text;
  const sessionKey = await audioCacheKey(sourceText, voice.id);
  const partIndex = Number.isFinite(input.partIndex) ? Number(input.partIndex) : 0;
  const cacheKey = await audioCacheKey(input.text, voice.id);
  const bucket = await getAudioBucket();
  if (bucket) {
    const hit = await readCachedAudio(bucket, cacheKey);
    if (hit) {
      await rememberListen({
        userUuid: input.userUuid,
        sessionKey,
        text: sourceText,
        voiceId: voice.id,
        part: {
          index: partIndex,
          cacheKey,
          seconds: 0,
          duration: mp3DurationSeconds(hit),
          cached: true,
        },
      });
      return { audio: hit, cached: true };
    }
  }

  const chars = input.text.length;
  const reserved = await reserveCloudSeconds({
    userUuid: input.userUuid,
    engine,
    seconds: secondsForChars(chars, detectSpeechLang(input.text)),
    chars,
  });
  if (!reserved.ok) return { error: reserved.reason === 'unauthenticated' ? 'unauthenticated' : reserved.reason };

  try {
    const adapter = CLOUD_ADAPTERS[engine];
    const result = await adapter.synthesize({
      text: input.text,
      providerVoice: voice.providerVoice,
      lang: voice.lang,
    });

    if (result.status === 'pending') {
      await rememberListen({
        userUuid: input.userUuid,
        sessionKey,
        text: sourceText,
        voiceId: voice.id,
      });
      const token = await signSpeakTask({
        atlasTaskId: result.taskId,
        voiceId: voice.id,
        cacheKey,
        sessionKey,
        partIndex,
        reservation: reserved.reservation,
      });
      return { taskId: result.taskId, token };
    }

    if (bucket) await writeCachedAudio(bucket, cacheKey, result.audio);
    await recordListen(input.userUuid, sourceText, voice.id, sessionKey, partIndex, cacheKey, reserved.reservation, result.audio);
    return { audio: result.audio, cached: false };
  } catch (error) {
    await releaseReservation(reserved.reservation);
    if ((error as { name?: string }).name === 'MissingCredentialsError') return { error: 'missing_key' };
    return { error: 'supplier' };
  }
}

export async function finishCloudTask(token: string): Promise<SpeakOk | SpeakFail | { pending: true }> {
  const { readSpeakTask } = await import('./task-token');
  const task = await readSpeakTask(token);
  if (!task) return { error: 'supplier' };

  const voice = findCloudVoice(task.voiceId);
  const engine = voice ? poolFor(voice) : null;
  if (!voice || !engine) return { error: 'unknown_voice' };

  try {
    const adapter = CLOUD_ADAPTERS[engine];
    if (!adapter.poll) return { error: 'supplier' };
    const result = await adapter.poll(task.atlasTaskId);
    if (result.status === 'pending') return { pending: true };

    const bucket = await getAudioBucket();
    if (bucket) await writeCachedAudio(bucket, task.cacheKey, result.audio);
    await recordListen(
      task.reservation.userUuid,
      task.text || '',
      voice.id,
      task.sessionKey || task.cacheKey,
      Number.isFinite(task.partIndex) ? task.partIndex : 0,
      task.cacheKey,
      task.reservation,
      result.audio,
    );
    return { audio: result.audio, cached: false };
  } catch (error) {
    await releaseReservation(task.reservation);
    if ((error as { name?: string }).name === 'MissingCredentialsError') return { error: 'missing_key' };
    return { error: 'supplier' };
  }
}

async function recordListen(
  userUuid: string,
  text: string,
  voiceId: string,
  sessionKey: string,
  partIndex: number,
  cacheKey: string,
  reservation: Reservation,
  audio: ArrayBuffer,
): Promise<void> {
  const duration = mp3DurationSeconds(audio);
  const charged = await settleReservation(reservation, duration);
  await rememberListen({
    userUuid,
    sessionKey,
    text,
    voiceId,
    part: {
      index: partIndex,
      cacheKey,
      seconds: charged,
      duration: duration || charged,
      cached: false,
    },
  });
}

