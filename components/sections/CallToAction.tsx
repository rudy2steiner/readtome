'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/lib/navigation';
import { LandingIcon } from './icons';

export function CallToAction() {
  const t = useTranslations();

  return (
    <section className="cta-wrap" id="cta">
      <div className="lp-wrap">
        <div className="cta-panel">
          <h2>{t('cta.title')}</h2>
          <p>{t('cta.description')}</p>
          <Link href="/reader" className="lp-btn lp-btn-invert">
            <span>{t('cta.button')}</span>
            <LandingIcon name="arrow" className="lp-arrow" />
          </Link>
        </div>
      </div>
    </section>
  );
}
