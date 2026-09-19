'use client';

import { useTranslations } from 'next-intl';

import { LandingIcon, type LandingIconName } from './icons';

const BENEFITS: { key: 'quality' | 'styles' | 'speed' | 'batch'; icon: LandingIconName }[] = [
  { key: 'quality', icon: 'mic' },
  { key: 'styles', icon: 'globe' },
  { key: 'speed', icon: 'bolt' },
  { key: 'batch', icon: 'access' },
];

export function Benefits() {
  const t = useTranslations();

  return (
    <section className="lp-band lp-band-first" id="benefits">
      <div className="lp-wrap">
        <header className="lp-band-head">
          <span className="lp-eyebrow">{t('ui.benefits')}</span>
          <h2>{t('benefits.title')}</h2>
        </header>
        <div className="lp-grid-4">
          {BENEFITS.map((benefit) => (
            <article key={benefit.key} className="benefit-card">
              <span className="lp-ico">
                <LandingIcon name={benefit.icon} />
              </span>
              <h3>{t(`benefits.items.${benefit.key}.title`)}</h3>
              <p>{t(`benefits.items.${benefit.key}.description`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
