'use client';

import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Globe } from 'lucide-react';

import { Link, usePathname } from '@/lib/navigation';
import { languageConfig } from '@/lib/config/navigation';
import { isBillingEnabled } from '@/lib/config/features';

export function Footer() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="lp-wrap">
        <div className="footer-cols">
          <div className="footer-brand">
            <Link href="/" className="brand">
              <Image
                className="brand-mark"
                src="/brand/readtome-pulse-mark.svg"
                alt=""
                width={40}
                height={30}
              />
              <span className="brand-name">{t('common.title')}</span>
            </Link>
            <p>{t('common.description')}</p>
          </div>
          <div>
            <h4>{t('footer.product')}</h4>
            <Link href="/reader">{t('nav.reader')}</Link>
            <Link href="/#features">{t('footer.features')}</Link>
            {isBillingEnabled && <Link href="/pricing">{t('nav.pricing')}</Link>}
            <Link href="/#how">{t('ui.how')}</Link>
          </div>
          <div>
            <h4>{t('footer.support')}</h4>
            <Link href="/#faq">{t('nav.faq')}</Link>
            <Link href="/contact">{t('footer.contact')}</Link>
            <Link href="/help">{t('footer.helpCenter')}</Link>
          </div>
          <div>
            <h4>{t('footer.legal')}</h4>
            <Link href="/privacy">{t('footer.privacy')}</Link>
            <Link href="/terms">{t('footer.terms')}</Link>
            <Link href="/cookies">{t('footer.cookies')}</Link>
          </div>
        </div>
        <div className="footer-langs">
          <Globe className="footer-langs-icon" aria-hidden />
          <span className="footer-langs-label">{t('footer.languages')}</span>
          {languageConfig.map((lang) =>
            locale === lang.code ? (
              <span key={lang.code} className="footer-lang is-active" aria-current="page">
                {lang.nativeName}
              </span>
            ) : (
              <Link key={lang.code} href={pathname} locale={lang.code} className="footer-lang">
                {lang.nativeName}
              </Link>
            ),
          )}
        </div>
        <div className="footer-base">
          <span>
            © {year} {t('common.title')} — {t('footer.rights')}
          </span>
          <span>{t('footer.engines')}</span>
        </div>
      </div>
    </footer>
  );
}
