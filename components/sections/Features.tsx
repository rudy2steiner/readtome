'use client';

import { useTranslations } from 'next-intl';

import { LandingIcon, type LandingIconName } from './icons';

const FEATURES: { key: 'styleTransfer' | 'customPrompts' | 'batchProcessing' | 'highResolution'; icon: LandingIconName; planned?: boolean }[] = [
  { key: 'styleTransfer', icon: 'sliders' },
  { key: 'customPrompts', icon: 'file', planned: true },
  { key: 'batchProcessing', icon: 'layers', planned: true },
  { key: 'highResolution', icon: 'download', planned: true },
];

export function Features() {
  const t = useTranslations();

  return (
    <section className="lp-band lp-band-alt" id="features">
      <div className="lp-wrap">
        <header className="lp-band-head">
          <span className="lp-eyebrow">{t('ui.features')}</span>
          <h2>{t('features.title')}</h2>
        </header>
        <div className="feature-rows">
          {FEATURES.map((feature) => (
            <article key={feature.key} className="feature-row">
              <span className="lp-ico">
                <LandingIcon name={feature.icon} />
              </span>
              <div>
                <h3>
                  <span>{t(`features.items.${feature.key}.title`)}</span>
                  {feature.planned && <span className="lp-badge">{t('ui.planned')}</span>}
                </h3>
                <p>{t(`features.items.${feature.key}.description`)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
