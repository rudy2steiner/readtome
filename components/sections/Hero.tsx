'use client';

import { useTranslations } from 'next-intl';

import { Reader } from '@/components/reader/Reader';
import { VoiceSamples } from '@/components/reader/VoiceSamples';
import { useBrowserVoices } from '@/components/reader/use-browser-voices';
import { isBillingEnabled } from '@/lib/config/features';
import { CheckTick } from './icons';

export function Hero() {
  const t = useTranslations();
  const voices = useBrowserVoices();

  return (
    <section className="lp-hero" id="hero">
      <div className="lp-hero-glow" aria-hidden />
      <div className="lp-wrap">
        <div className="lp-hero-head">
          <div className="lp-tagline">
            <span className="lp-tagline-dot" />
            <span>{t('hero.tagline')}</span>
          </div>
          <h1>{t('hero.title')}</h1>
          <p className="lp-hero-sub">{t('hero.description')}</p>

          <ul className="lp-facts">
            <li>
              <CheckTick />
              <span>{t('ui.factFree')}</span>
            </li>
            {voices.length > 0 && (
              <li>
                <CheckTick />
                <span>{t('ui.factVoices', { n: voices.length })}</span>
              </li>
            )}
            <li>
              <CheckTick />
              <span>{t('ui.noSignup')}</span>
            </li>
          </ul>
        </div>

        {isBillingEnabled && <VoiceSamples />}

        <Reader compact />
      </div>
    </section>
  );
}
