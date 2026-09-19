import { getCloudflareContext } from '@opennextjs/cloudflare';
import { logCall } from '@/lib/log/call';

/**
 * Only the two R2 operations this cache needs, so nothing else has to depend on workers-types.
 */
export type AudioBucket = {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
};

const KEY_PREFIX = 'tts/';

/** Absent in local dev without an R2 binding, in which case synthesis simply never hits cache. */
export async function getAudioBucket(): Promise<AudioBucket | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return ((env as Record<string, unknown>).AUDIO_CACHE as AudioBucket | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function readCachedAudio(bucket: AudioBucket, key: string): Promise<ArrayBuffer | null> {
  const object = await bucket.get(KEY_PREFIX + key);
  const audio = object ? await object.arrayBuffer() : null;
  logCall('r2.audio.get', { key: KEY_PREFIX + key }, audio ? { hit: true, bytes: audio.byteLength } : { hit: false });
  return audio;
}

export async function writeCachedAudio(bucket: AudioBucket, key: string, audio: ArrayBuffer): Promise<void> {
  await bucket.put(KEY_PREFIX + key, audio, { httpMetadata: { contentType: 'audio/mpeg' } });
  logCall('r2.audio.put', { key: KEY_PREFIX + key, bytes: audio.byteLength }, { ok: true });
}
