export type EngineId = 'browser' | 'natural';

export type CloudEngineId = Exclude<EngineId, 'browser'>;

export type PlanId = 'free' | 'plus' | 'pro';

export type VoiceGender = 'female' | 'male';

export type Voice = {
  id: string;
  engine: EngineId;
  /** Identifier the supplier expects. Empty for browser voices, which carry a URI instead. */
  providerVoice: string;
  lang: string;
  name: string;
  minPlan: PlanId;
  /** Present when the supplier publishes it. Atlas xAI does. */
  gender?: VoiceGender;
};

export type SpeakRequest = {
  text: string;
  voiceId: string;
  rate: number;
  sourceText?: string;
  partIndex?: number;
};

export type PlaybackEvents = {
  onSegmentEnd: () => void;
  /** Browser voices report this natively; cloud playback interpolates it from audio duration. */
  onWordBoundary?: (charIndex: number) => void;
  /** Media length of the chunk that just started, in seconds at 1x. */
  onDuration?: (seconds: number) => void;
  onError: (error: Error) => void;
};

/**
 * Both playback paths implement this, so the reader state machine never branches on engine.
 * `BrowserPlayer` wraps SpeechSynthesisUtterance; `CloudPlayer` wraps <audio> over /api/tts/speak.
 */
export interface SegmentPlayer {
  readonly engine: EngineId;
  speak(request: SpeakRequest, events: PlaybackEvents): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
}

/** Atlas Cloud list prices per 1K characters, read from the model catalog on 2026-09-18. */
export const PRICE_PER_1K_CHARS: Record<CloudEngineId, number> = {
  natural: 0.015,
};

/**
 * Measured on the same passage through both engines: 527 English characters and 153 Chinese
 * characters each produced ~31s of audio. Quotas are displayed in hours using the English rate,
 * which is the conservative direction — Chinese listeners get roughly 3.3x more time per character.
 */
export const CHARS_PER_MINUTE = { en: 1020, zh: 305 } as const;

/**
 * Synthesis runs at roughly 2.5s of fixed overhead plus 16ms per character, so a one-sentence
 * chunk cannot keep ahead of playback while a 300-character chunk renders at ~2.5x realtime.
 */
export const CHUNK_TARGET_CHARS = { min: 200, max: 400 } as const;

export type CloudSynthesisRequest = {
  text: string;
  providerVoice: string;
  lang: string;
};

export type SynthesisResult =
  | { status: 'done'; audio: ArrayBuffer; format: 'mp3'; chars: number }
  | { status: 'pending'; taskId: string; chars: number };

/**
 * Server-side supplier adapter. Adding an engine means adding one of these plus catalog entries;
 * nothing else in the stack learns the supplier's name.
 */
export interface CloudTtsAdapter {
  readonly engine: CloudEngineId;
  readonly pricePer1kChars: number;
  readonly maxCharsPerRequest: number;
  synthesize(request: CloudSynthesisRequest): Promise<SynthesisResult>;
  /** Present only for suppliers that synthesize asynchronously. */
  poll?(taskId: string): Promise<SynthesisResult>;
}

/**
 * Key deliberately excludes rate and volume: both are applied client-side on the audio element,
 * so one cached clip serves every playback speed.
 */
export async function audioCacheKey(text: string, voiceId: string, format = 'mp3'): Promise<string> {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const data = new TextEncoder().encode(`${voiceId}|${format}|${normalized}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
