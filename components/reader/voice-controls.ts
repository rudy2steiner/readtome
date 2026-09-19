'use client';

import { useMemo } from 'react';

import { isBillingEnabled } from '@/lib/config/features';
import { cloudLanguageOptions, primaryLang } from '@/lib/tts/voices';

export type VoiceControlProps = {
  voices: SpeechSynthesisVoice[];
  voiceId: string | null;
  langFilter: string;
  rate: number;
  onVoice: (voiceURI: string) => void;
  onLang: (lang: string) => void;
  onRate: (rate: number) => void;
};

export function useLanguageOptions(voices: SpeechSynthesisVoice[]): string[] {
  return useMemo(() => {
    const langs = new Set(voices.map((voice) => primaryLang(voice.lang)).filter(Boolean));
    if (isBillingEnabled) for (const lang of cloudLanguageOptions()) langs.add(lang);
    return Array.from(langs).sort();
  }, [voices]);
}

/**
 * Chrome rarely exposes Apple's Premium/Enhanced suffix. Rank by the labels we do get:
 * Google and neural marks first, then Apple's newer family, then known good defaults.
 * Novelty voices share short first names with some of those, so only demote unmarked ones.
 */
const PREMIUM = /\b(premium|高级|neural|natural|siri)\b|\.premium\./i;
const GOOGLE = /\bgoogle\b/i;
const ENHANCED = /\b(enhanced|增强)\b|\.enhanced\./i;
const APPLE_NEURAL = /\b(eddy|flo|reed|rocko|sandy|shelley)\b/i;
const KNOWN_GOOD = /\b(samantha|alex|daniel|karen|moira|li-mu|语舒|善怡|美嘉)\b/i;
const COMPACT = /\b(compact|紧凑|eloquence)\b|\.compact\./i;
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|junior|kathy|pipe organ|princess|ralph|trinoids|whisper|superstar|zarvox|jester|organ)\b/i;

export function browserVoiceQuality(voice: SpeechSynthesisVoice): number {
  const hay = `${voice.name} ${voice.voiceURI}`;
  if (PREMIUM.test(hay) || GOOGLE.test(hay)) return 80;
  if (ENHANCED.test(hay) || APPLE_NEURAL.test(hay)) return 65;
  if (KNOWN_GOOD.test(hay)) return 55;
  if (COMPACT.test(hay)) return 15;
  if (NOVELTY.test(hay)) return 5;
  if (voice.localService) return 35;
  if (voice.default) return 30;
  return 25;
}

/** All-languages uses the site locale for demo copy and the default voice. */
export function demoLangFor(langFilter: string, locale: string): string {
  return langFilter === 'all' || langFilter === 'multi' ? primaryLang(locale) : primaryLang(langFilter);
}

export function pickBrowserVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  return filterVoices(voices, lang, lang)[0] ?? filterVoices(voices, 'all', lang)[0];
}

export function browserVoiceMatchesLang(voice: SpeechSynthesisVoice, lang: string): boolean {
  return primaryLang(voice.lang) === primaryLang(lang);
}

export function filterVoices(
  voices: SpeechSynthesisVoice[],
  langFilter: string,
  locale?: string,
): SpeechSynthesisVoice[] {
  const wanted = langFilter === 'all' || langFilter === 'multi' ? null : primaryLang(langFilter);
  const filtered = wanted ? voices.filter((voice) => primaryLang(voice.lang) === wanted) : voices.slice();
  const localeLang = locale ? primaryLang(locale) : '';
  return filtered.sort((a, b) => {
    const quality = browserVoiceQuality(b) - browserVoiceQuality(a);
    if (quality) return quality;
    if (localeLang) {
      const localeMatch = Number(primaryLang(b.lang) === localeLang) - Number(primaryLang(a.lang) === localeLang);
      if (localeMatch) return localeMatch;
    }
    return a.name.localeCompare(b.name);
  });
}

export function languageDisplayName(lang: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(primaryLang(lang)) ?? lang;
  } catch {
    return lang;
  }
}
