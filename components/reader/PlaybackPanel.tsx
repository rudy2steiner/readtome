'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';

import { useToast } from '@/hooks/use-toast';
import { isAuthUiEnabled, isBillingEnabled } from '@/lib/config/features';
import { Link } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { Voice, VoiceGender } from '@/lib/tts/engine';
import { CLOUD_VOICES, matchesCloudGender, matchesCloudLang, matchesVoiceQuery, primaryLang } from '@/lib/tts/voices';
import { LockIcon } from './icons';
import { filterVoices, languageDisplayName, useLanguageOptions, type VoiceControlProps } from './voice-controls';

type TierFilter = 'all' | 'free' | 'pro';
type GenderFilter = 'all' | VoiceGender;

/** Language, speed and voice selection — the Playback column of the TTSReader reference layout. */
export function PlaybackPanel({ voices, voiceId, langFilter, rate, onVoice, onLang, onRate }: VoiceControlProps) {
  const t = useTranslations('reader');
  const locale = useLocale();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [tier, setTier] = useState<TierFilter>('all');
  const [gender, setGender] = useState<GenderFilter>('all');
  const [query, setQuery] = useState('');
  const signedIn = Boolean(session?.user);
  const languages = useLanguageOptions(voices);
  const browserVoices = filterVoices(voices, langFilter, locale);
  const catalog = isBillingEnabled ? CLOUD_VOICES : [];
  const cloudVoices = useMemo(
    () =>
      catalog.filter(
        (voice) => matchesCloudLang(voice, langFilter) && matchesCloudGender(voice, gender) && matchesVoiceQuery(voice, query),
      ),
    [catalog, langFilter, gender, query],
  );
  const visibleBrowser = query.trim()
    ? browserVoices.filter((voice) => `${voice.name} ${voice.lang}`.toLowerCase().includes(query.trim().toLowerCase()))
    : browserVoices;

  return (
    <aside className="overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex gap-1.5 border-b p-2.5">
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[13px] font-semibold text-blue-700">{t('tabPlayback')}</span>
      </div>

      <Section label={t('language')}>
        <div className={cn('grid gap-2', isBillingEnabled && 'grid-cols-2')}>
          <select
            className="w-full rounded-lg border bg-background px-2.5 py-2 text-sm"
            value={primaryLang(langFilter)}
            onChange={(event) => onLang(event.target.value)}
          >
            <option value="all">
              {t('allLanguages')} ({languages.length})
            </option>
            {isBillingEnabled && <option value="multi">{t('multilingual')}</option>}
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {languageDisplayName(lang, locale)}
              </option>
            ))}
          </select>
          {isBillingEnabled && (
            <select
              className="w-full rounded-lg border bg-background px-2.5 py-2 text-sm"
              value={gender}
              onChange={(event) => setGender(event.target.value as GenderFilter)}
            >
              <option value="all">{t('genderAll')}</option>
              <option value="female">{t('genderFemale')}</option>
              <option value="male">{t('genderMale')}</option>
            </select>
          )}
        </div>
      </Section>

      <Section label={t('speed')} value={`${rate.toFixed(1)}x`}>
        <div className="flex items-center gap-2.5 text-xs tabular-nums text-muted-foreground">
          <span>0.5x</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={rate}
            onChange={(event) => onRate(Number(event.target.value))}
            className="w-full"
          />
          <span>2.0x</span>
        </div>
      </Section>

      <Section label={t('voiceSelection')}>
        {/* Nothing to filter between when cloud voices are switched off. */}
        <div className={cn('mb-2.5 flex gap-1.5', !isBillingEnabled && 'hidden')}>
          {(['all', 'free', 'pro'] as TierFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTier(option)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-semibold',
                tier === option ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground',
              )}
            >
              {t(option === 'all' ? 'filterAll' : option === 'free' ? 'filterFree' : 'filterPro')}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('voiceSearch')}
          className="mb-2.5 w-full rounded-lg border bg-background px-2.5 py-2 text-sm"
        />

        <div className="grid max-h-[360px] gap-1.5 overflow-y-auto pr-1">
          {tier !== 'free' && cloudVoices.length > 0 && (
            <VoiceGroup
              label={`${t('groupNatural')} (${cloudVoices.length})`}
              extra={
                <Link href="/pricing" className="font-semibold text-blue-700 hover:underline">
                  {t('seePlans')}
                </Link>
              }
              voices={cloudVoices}
              voiceId={voiceId}
              locked={!isAuthUiEnabled || !signedIn}
              locale={locale}
              genderLabel={(value) => (value === 'female' ? t('genderFemale') : t('genderMale'))}
              multilingual={t('multilingual')}
              onPick={(id) => {
                if (!isAuthUiEnabled || !signedIn) {
                  toast({ description: t('premiumSignIn') });
                  return;
                }
                onVoice(id);
              }}
            />
          )}

          {tier !== 'pro' && (
            <>
              {tier !== 'free' && cloudVoices.length > 0 && (
                <div className="voice-group">
                  <span>{t('groupBrowser')}</span>
                </div>
              )}
              {visibleBrowser.map((voice) => (
                <button
                  key={voice.voiceURI}
                  type="button"
                  className="voice-item"
                  data-active={voice.voiceURI === voiceId}
                  onClick={() => onVoice(voice.voiceURI)}
                >
                  <span className="flex-1 truncate font-semibold">{voice.name}</span>
                  <span className="flex-none text-[11px] tabular-nums text-muted-foreground">{voice.lang}</span>
                  <span className="flex-none rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-emerald-700">
                    Free
                  </span>
                </button>
              ))}
            </>
          )}

          {visibleBrowser.length === 0 && (tier === 'free' || cloudVoices.length === 0) && (
            <p className="text-sm text-muted-foreground">{t('noVoices')}</p>
          )}
        </div>
      </Section>

      <div className="p-3.5">
        <p className="text-sm text-muted-foreground">{t('note')}</p>
      </div>
    </aside>
  );
}

function VoiceGroup({
  label,
  extra,
  voices,
  voiceId,
  locked,
  locale,
  genderLabel,
  multilingual,
  onPick,
}: {
  label: string;
  extra?: ReactNode;
  voices: Voice[];
  voiceId: string | null;
  locked: boolean;
  locale: string;
  genderLabel: (gender: VoiceGender) => string;
  multilingual: string;
  onPick: (id: string) => void;
}) {
  return (
    <>
      <div className="voice-group">
        <span>{label}</span>
        {extra}
      </div>
      {voices.map((voice) => (
        <button
          key={voice.id}
          type="button"
          className="voice-item"
          data-active={voice.id === voiceId}
          onClick={() => onPick(voice.id)}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{voice.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{voiceMeta(voice, locale, genderLabel, multilingual)}</span>
          </span>
          {locked && (
            <span className="flex flex-none items-center rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
              <LockIcon />
            </span>
          )}
        </button>
      ))}
    </>
  );
}

function voiceMeta(
  voice: Voice,
  locale: string,
  genderLabel: (gender: VoiceGender) => string,
  multilingual: string,
): string {
  const lang = voice.lang === 'multi' ? multilingual : languageDisplayName(voice.lang, locale);
  return voice.gender ? `${genderLabel(voice.gender)}, ${lang}` : lang;
}

function Section({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="border-b p-3.5">
      <div className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
        {value && <span className="ml-auto normal-case tracking-normal text-foreground">{value}</span>}
      </div>
      {children}
    </div>
  );
}
