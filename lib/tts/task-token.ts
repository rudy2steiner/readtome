import type { Reservation } from '@/lib/billing/reserve';

export type SpeakTask = {
  atlasTaskId: string;
  voiceId: string;
  cacheKey: string;
  sessionKey: string;
  partIndex: number;
  reservation: Reservation;
  /** Older tokens stored the chunk text here; new ones keep the full document on the listen row. */
  text?: string;
};

function secret(): string {
  return process.env.AUTH_SECRET || process.env.ATLASCLOUD_API_KEY || 'build-placeholder';
}

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bufferToB64url(sig);
}

function bufferToB64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function signSpeakTask(task: SpeakTask): Promise<string> {
  const body = bufferToB64url(new TextEncoder().encode(JSON.stringify(task)).buffer);
  return `${body}.${await hmac(body)}`;
}

export async function readSpeakTask(token: string): Promise<SpeakTask | null> {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  if ((await hmac(body)) !== sig) return null;
  try {
    const json = new TextDecoder().decode(Uint8Array.from(atob(body.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
    return JSON.parse(json) as SpeakTask;
  } catch {
    return null;
  }
}
