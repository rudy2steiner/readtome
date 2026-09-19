'use client';

import { useTranslations } from 'next-intl';

const STEPS: { key: 'upload' | 'style' | 'generate' | 'download'; planned?: boolean }[] = [
  { key: 'upload' },
  { key: 'style' },
  { key: 'generate' },
  { key: 'download', planned: true },
];

export function HowItWorks() {
  const t = useTranslations();

  return (
    <section className="lp-band" id="how">
      <div className="lp-wrap">
        <header className="lp-band-head">
          <span className="lp-eyebrow">{t('ui.how')}</span>
          <h2>{t('howItWorks.title')}</h2>
        </header>
        <ol className="lp-steps">
          {STEPS.map((step) => (
            <li key={step.key} className="lp-step">
              <span className="lp-step-num">{t(`howItWorks.steps.${step.key}.number`)}</span>
              <h3>
                <span>{t(`howItWorks.steps.${step.key}.title`)}</span>
                {step.planned && <span className="lp-badge">{t('ui.planned')}</span>}
              </h3>
              <p>{t(`howItWorks.steps.${step.key}.description`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
