import { CHARS_PER_MINUTE, type CloudEngineId, type PlanId } from '@/lib/tts/engine';

/** Shared plan pool, measured in listening seconds. */
export const CLOUD_POOL = 'cloud';

export const PLAN_QUOTA_SECONDS: Record<PlanId, number> = {
  free: 0,
  plus: 8 * 3600,
  pro: 16 * 3600,
};

const DEFAULT_TRIAL_MINUTES = 10;

/** First-login cloud grant, in minutes. `NEXT_PUBLIC_TRIAL_MINUTES` so pricing copy can match. */
export function trialMinutesFromEnv(raw = process.env.NEXT_PUBLIC_TRIAL_MINUTES): number {
  if (raw == null || raw.trim() === '') return DEFAULT_TRIAL_MINUTES;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes < 0) return DEFAULT_TRIAL_MINUTES;
  return Math.floor(minutes);
}

export const TRIAL_MINUTES = trialMinutesFromEnv();
export const TRIAL_SECONDS = TRIAL_MINUTES * 60;
/** Frozen cycle for the one-off login grant. A new calendar month must not mint another grant. */
export const TRIAL_PERIOD_START = new Date(0);
export const TRIAL_PERIOD_END = new Date(0);
export const PACK_SECONDS = 10 * 3600;
export const PACK_TTL_MS = 365 * 24 * 3600 * 1000;

export function trialUsageValues(userUuid: string) {
  return {
    userUuid,
    engine: CLOUD_POOL,
    periodStart: TRIAL_PERIOD_START,
    periodEnd: TRIAL_PERIOD_END,
    quotaSeconds: TRIAL_SECONDS,
  };
}

export function detectSpeechLang(text: string): 'en' | 'zh' {
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
}

/** Round up so a 1-character request still spends a second. Same minute of quota is the same listening time in any language. */
export function secondsForChars(chars: number, lang: 'en' | 'zh'): number {
  return Math.max(1, Math.ceil((chars / CHARS_PER_MINUTE[lang]) * 60));
}

/** One second of audio spends one second of quota, subscribed or trial. */
export function creditSecondsFor(_engine: CloudEngineId, audioSeconds: number, _subscribed: boolean): number {
  return audioSeconds;
}

export type DrawSource = { kind: 'plan' } | { kind: 'pack'; packUuid: string };

export type DrawReason = 'quota_natural' | 'trial_exhausted' | 'unauthenticated';

export type DrawDecision = { ok: true; source: DrawSource } | { ok: false; reason: DrawReason };

/** Plan (or the frozen login trial) first, then the oldest pack that still covers the request. */
export function decideDraw(input: {
  engine: CloudEngineId;
  subscribed: boolean;
  planRemaining: number;
  packs: { uuid: string; remaining: number }[];
  need: number;
}): DrawDecision {
  if (input.need <= 0) return { ok: true, source: { kind: 'plan' } };

  if (input.planRemaining >= input.need) {
    return { ok: true, source: { kind: 'plan' } };
  }

  if (input.subscribed) {
    const pack = input.packs.find((item) => item.remaining >= input.need);
    if (pack) return { ok: true, source: { kind: 'pack', packUuid: pack.uuid } };
    return { ok: false, reason: 'quota_natural' };
  }

  return { ok: false, reason: input.planRemaining > 0 ? 'quota_natural' : 'trial_exhausted' };
}
