import type { CloudEngineId, PlanId, Voice, VoiceGender } from './engine';
import { XAI_PRESETS } from './xai-catalog';

const PLAN_RANK: Record<PlanId, number> = { free: 0, plus: 1, pro: 2 };

function natural(providerVoice: string, name: string, lang: string, gender?: VoiceGender): Voice {
  return { id: `natural:${providerVoice}`, engine: 'natural', providerVoice, lang, name, minPlan: 'plus', gender };
}

/** Atlas xAI catalog. MiniMax is parked until a listening test justifies the extra cost. */
export const CLOUD_VOICES: Voice[] = XAI_PRESETS.map(([id, name, lang, gender]) =>
  natural(id, name, lang, gender === 'female' || gender === 'male' ? gender : undefined),
);

export function findCloudVoice(voiceId: string): Voice | null {
  return CLOUD_VOICES.find((voice) => voice.id === voiceId) ?? null;
}

export function isEntitled(voice: Voice, plan: PlanId): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[voice.minPlan];
}

export function poolFor(voice: Voice): CloudEngineId | null {
  return voice.engine === 'browser' ? null : voice.engine;
}

/** `en-US` and `en_GB` both become `en`. `all` / `multi` stay as-is. */
export function primaryLang(tag: string): string {
  if (tag === 'all' || tag === 'multi') return tag;
  return tag.replace('_', '-').split('-')[0]?.toLowerCase() || tag.toLowerCase();
}

/**
 * xAI multilingual voices stay visible under every language chip. A dedicated `multi` chip
 * shows only those. Regional tags collapse to one language, so English is one choice.
 */
export function matchesCloudLang(voice: Voice, langFilter: string): boolean {
  if (langFilter === 'all') return true;
  if (langFilter === 'multi') return voice.lang === 'multi';
  if (voice.lang === 'multi') return true;
  return primaryLang(voice.lang) === primaryLang(langFilter);
}

export function matchesCloudGender(voice: Voice, genderFilter: string): boolean {
  if (genderFilter === 'all') return true;
  return voice.gender === genderFilter;
}

export function matchesVoiceQuery(voice: Voice, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [voice.name, voice.providerVoice, voice.lang, voice.gender].some((value) => value?.toLowerCase().includes(needle));
}

export function cloudLanguageOptions(): string[] {
  return Array.from(
    new Set(CLOUD_VOICES.map((voice) => voice.lang).filter((lang) => lang !== 'multi').map(primaryLang)),
  ).sort();
}
